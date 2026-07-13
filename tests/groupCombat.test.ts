import { describe, expect, it } from "vitest";
import {
  calculateEncounterRewards,
  createGroupCombatants,
  deriveMonsterStats,
  findLowestHpAllyIndex,
  getFormationAttackPenalty,
  getMonsterDefendChance,
  getSelectableTargetIndices,
  getSynergyACBonus,
  getSynergyAttackBonus,
  getSynergyDamageBonus,
  getTargetIndices,
  getFleeDC,
  isSynergyActive,
  recordGroupDefeats,
  rollGroupInitiative,
} from "../src/systems/groupCombat";
import {
  createGroupEncounter,
  createSoloEncounter,
  getMonsterGroupTemplate,
  type MonsterEncounter,
} from "../src/data/monsterGroups";
import { getMonster } from "../src/data/monsters";
import { createCodex } from "../src/systems/codex";
import { Element } from "../src/data/elements";

function createTestEncounter(): MonsterEncounter {
  return {
    id: "testGroup",
    name: "Test Group",
    isGroup: true,
    members: [
      { monster: getMonster("goblin")!, position: "front" },
      { monster: getMonster("goblin")!, position: "front" },
      { monster: getMonster("wraith")!, position: "back" },
    ],
    synergy: {
      type: "pack_tactics",
      description: "Test synergy",
      attackBonus: 2,
      acBonus: 1,
      damageBonus: 1,
      breakThreshold: 2,
    },
  };
}

describe("group combat", () => {
  it("creates independent combatants with duplicate labels", () => {
    const combatants = createGroupCombatants(createTestEncounter());

    expect(combatants.map((combatant) => combatant.label)).toEqual([
      "Goblin A",
      "Goblin B",
      "Wraith",
    ]);
    expect(combatants[0]?.effects).not.toBe(combatants[1]?.effects);
  });

  it("sorts player and monster initiative with player-favored ties", () => {
    const combatants = createGroupCombatants(createTestEncounter());
    const rolls = [18, 12, 18, 8];
    const result = rollGroupInitiative(
      3,
      combatants,
      () => 0,
      () => rolls.shift()!,
    );

    expect(result.order).toEqual([
      { combatantId: "party:hero", initiative: 18 },
      { combatantId: "testGroup:enemy:goblin:2", initiative: 18 },
      { combatantId: "testGroup:enemy:goblin:1", initiative: 12 },
      { combatantId: "testGroup:enemy:wraith:1", initiative: 8 },
    ]);
  });

  it("protects the back row from melee until the front row falls", () => {
    const combatants = createGroupCombatants(createTestEncounter());

    expect(getSelectableTargetIndices(combatants, "melee")).toEqual([0, 1]);
    expect(getSelectableTargetIndices(combatants, "ranged")).toEqual([0, 1, 2]);
    expect(getFormationAttackPenalty(combatants, 2, "ranged")).toBe(0);

    combatants[0]!.isAlive = false;
    combatants[1]!.isAlive = false;

    expect(getSelectableTargetIndices(combatants, "melee")).toEqual([2]);
    expect(getFormationAttackPenalty(combatants, 2, "melee")).toBe(2);
  });

  it("selects targets for row, all-enemy, and random-two actions", () => {
    const combatants = createGroupCombatants(createTestEncounter());

    expect(getTargetIndices(combatants, "all_enemies")).toEqual([0, 1, 2]);
    expect(getTargetIndices(combatants, "front_row")).toEqual([0, 1]);
    expect(getTargetIndices(combatants, "back_row")).toEqual([2]);
    expect(getTargetIndices(combatants, "random_2", () => 0)).toEqual([0, 1]);
  });

  it("applies synergy bonuses until the configured defeat threshold", () => {
    const encounter = createTestEncounter();
    const combatants = createGroupCombatants(encounter);

    expect(isSynergyActive(encounter.synergy, combatants)).toBe(true);
    expect(getSynergyAttackBonus(encounter.synergy, combatants, 0)).toBe(2);
    expect(getSynergyACBonus(encounter.synergy, combatants, 0)).toBe(1);
    expect(getSynergyDamageBonus(encounter.synergy, combatants, 0)).toBe(1);

    combatants[0]!.isAlive = false;
    expect(isSynergyActive(encounter.synergy, combatants)).toBe(true);
    combatants[1]!.isAlive = false;
    expect(isSynergyActive(encounter.synergy, combatants)).toBe(false);
    expect(getSynergyAttackBonus(encounter.synergy, combatants, 2)).toBe(0);
  });

  it("raises shield-wall defend chance only for protected front members", () => {
    const encounter = createGroupEncounter(
      getMonsterGroupTemplate("cryptGuard")!,
    )!;
    const combatants = createGroupCombatants(encounter);
    const frontIndex = combatants.findIndex((member) => member.position === "front");
    const backIndex = combatants.findIndex((member) => member.position === "back");

    expect(getMonsterDefendChance(encounter.synergy, combatants, frontIndex)).toBeGreaterThan(0.08);
    expect(getMonsterDefendChance(encounter.synergy, combatants, backIndex)).toBe(0.08);
  });

  it("scales flee DC with the number of living monsters", () => {
    expect(getFleeDC(1)).toBe(10);
    expect(getFleeDC(2)).toBe(12);
    expect(getFleeDC(4)).toBe(16);
  });

  it("discounts group rewards while preserving solo rewards", () => {
    const goblin = getMonster("goblin")!;
    const orc = getMonster("orc")!;

    expect(calculateEncounterRewards(createSoloEncounter(goblin))).toEqual({
      xp: goblin.xpReward,
      gold: goblin.goldReward,
    });
    expect(calculateEncounterRewards({
      id: "rewardGroup",
      name: "Reward Group",
      isGroup: true,
      members: [
        { monster: goblin, position: "front" },
        { monster: orc, position: "front" },
      ],
    })).toEqual({
      xp: Math.floor((goblin.xpReward + orc.xpReward) * 0.85),
      gold: Math.floor((goblin.goldReward + orc.goldReward) * 0.85),
    });
  });

  it("records every defeated monster independently in the Codex", () => {
    const codex = createCodex();
    const combatants = createGroupCombatants(createTestEncounter());
    combatants[0]!.acDiscovered = true;
    combatants[0]!.droppedItemIds.push("potion");
    combatants[2]!.elementalDiscoveries.add(Element.Radiant);

    recordGroupDefeats(codex, combatants);

    expect(codex.entries.goblin?.timesDefeated).toBe(2);
    expect(codex.entries.goblin?.acDiscovered).toBe(true);
    expect(codex.entries.goblin?.itemsDropped).toContain("potion");
    expect(codex.entries.wraith?.timesDefeated).toBe(1);
    expect(codex.entries.wraith?.discoveredElements).toContain(Element.Radiant);
  });

  it("finds the living ally with the lowest HP percentage", () => {
    const combatants = createGroupCombatants(createTestEncounter());
    combatants[0]!.currentHp = 10;
    combatants[1]!.currentHp = 5;
    combatants[2]!.currentHp = 10;

    expect(findLowestHpAllyIndex(combatants)).toBe(2);
  });

  it("derives bounded monster saving-throw stats", () => {
    expect(deriveMonsterStats(6)).toEqual({
      strength: 16,
      dexterity: 16,
      constitution: 16,
      intelligence: 13,
      wisdom: 13,
      charisma: 13,
    });
    expect(deriveMonsterStats(30).strength).toBe(20);
  });
});
