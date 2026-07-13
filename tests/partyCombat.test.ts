import { describe, expect, it } from "vitest";
import {
  createBattleResult,
  createGroupCombatants,
  createHeroCombatant,
  createPartyCombatant,
  getBattleTargetIds,
  isPartyDefeated,
  resolveBattleRewards,
  rollBattleInitiative,
  selectMonsterTarget,
  type BattleCombatantState,
} from "../src/systems/groupCombat";
import { createPlayer, type PlayerStats } from "../src/systems/player";
import type { MonsterEncounter } from "../src/data/monsterGroups";
import { getMonster } from "../src/data/monsters";

const stats: PlayerStats = {
  strength: 12,
  dexterity: 14,
  constitution: 12,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

function createEncounter(): MonsterEncounter {
  return {
    id: "partyContract",
    name: "Party Contract",
    isGroup: true,
    members: [
      { monster: getMonster("goblin")!, position: "front" },
      { monster: getMonster("wraith")!, position: "back" },
    ],
  };
}

describe("party-ready battle contracts", () => {
  it("creates stable enemy IDs with explicit side and actor kind", () => {
    const first = createGroupCombatants(createEncounter());
    const second = createGroupCombatants(createEncounter());

    expect(first.map((combatant) => combatant.id)).toEqual(
      second.map((combatant) => combatant.id),
    );
    expect(first[0]?.id).toBe("partyContract:enemy:goblin:1");
    expect(first[0]?.side).toBe("enemy");
    expect(first[0]?.actorKind).toBe("monster");
    expect(first[0]?.isKnockedOut).toBe(false);
  });

  it("backs the hero combatant with PlayerState instead of duplicated HP/effects", () => {
    const player = createPlayer("Hero", stats);
    const hero = createHeroCombatant(player);

    hero.currentHp = 3;
    hero.isDefending = true;
    hero.effects.push({ id: "poison", remainingTurns: 2, source: "Test" });

    expect(player.hp).toBe(3);
    expect(hero.currentHp).toBe(3);
    expect(hero.isAlive).toBe(true);
    expect(hero.isDefending).toBe(true);
    expect(player.activeEffects).toEqual(hero.effects);

    player.hp = 0;
    expect(hero.isAlive).toBe(false);
    expect(hero.isKnockedOut).toBe(true);
  });

  it("backs companion combatants with mutable source state", () => {
    const source = {
      id: "lyra",
      name: "Lyra",
      hp: 20,
      maxHp: 30,
      stats,
      activeEffects: [],
      getArmorClass: () => 14,
    };
    const companion = createPartyCombatant(source, "companion", "back");

    companion.currentHp = 12;
    companion.isDefending = true;

    expect(companion.id).toBe("party:companion:lyra");
    expect(companion.side).toBe("party");
    expect(companion.position).toBe("back");
    expect(source.hp).toBe(12);
    expect(companion.getArmorClass(2)).toBe(14);
  });

  it("orders arbitrary actors by stable combatant ID", () => {
    const player = createPlayer("Hero", stats);
    const hero = createHeroCombatant(player);
    const companion = createPartyCombatant({
      id: "lyra",
      name: "Lyra",
      hp: 20,
      maxHp: 20,
      stats,
      activeEffects: [],
      getArmorClass: () => 13,
    }, "companion");
    const enemies = createGroupCombatants(createEncounter());
    const rolls = [15, 18, 12, 18];

    const result = rollBattleInitiative(
      [hero, companion, ...enemies],
      () => 0,
      () => rolls.shift()!,
    );

    expect(result.order.map((turn) => turn.combatantId)).toEqual([
      companion.id,
      enemies[1]!.id,
      hero.id,
      enemies[0]!.id,
    ]);
  });

  it("omits knocked-out actors before rolling initiative", () => {
    const player = createPlayer("Hero", stats);
    const hero = createHeroCombatant(player);
    const companion = createPartyCombatant({
      id: "lyra",
      name: "Lyra",
      hp: 0,
      maxHp: 20,
      stats,
      activeEffects: [],
      getArmorClass: () => 13,
    }, "companion");
    const enemy = createGroupCombatants(createEncounter())[0]!;

    const result = rollBattleInitiative(
      [hero, companion, enemy],
      () => 0,
      () => 10,
    );

    expect(result.order.map((turn) => turn.combatantId)).toEqual([
      hero.id,
      enemy.id,
    ]);
    expect(result.rolls[companion.id]).toBeUndefined();
  });

  it("resolves enemy, row, self, ally, and whole-party scopes", () => {
    const player = createPlayer("Hero", stats);
    const hero = createHeroCombatant(player);
    const companion = createPartyCombatant({
      id: "lyra",
      name: "Lyra",
      hp: 20,
      maxHp: 20,
      stats,
      activeEffects: [],
      getArmorClass: () => 13,
    }, "companion", "back");
    const enemies = createGroupCombatants(createEncounter());
    const combatants: BattleCombatantState[] = [hero, companion, ...enemies];

    expect(getBattleTargetIds(combatants, hero.id, "single_enemy")).toEqual([
      enemies[0]!.id,
    ]);
    expect(getBattleTargetIds(combatants, hero.id, "all_enemies")).toEqual(
      enemies.map((enemy) => enemy.id),
    );
    expect(getBattleTargetIds(combatants, hero.id, "front_row_enemies")).toEqual([
      enemies[0]!.id,
    ]);
    expect(getBattleTargetIds(combatants, hero.id, "self")).toEqual([hero.id]);
    expect(getBattleTargetIds(combatants, hero.id, "single_ally")).toEqual([
      companion.id,
    ]);
    expect(getBattleTargetIds(combatants, hero.id, "all_allies")).toEqual([
      companion.id,
    ]);
    expect(getBattleTargetIds(combatants, hero.id, "all_party")).toEqual([
      hero.id,
      companion.id,
    ]);
    expect(getBattleTargetIds([hero, ...enemies], hero.id, "single_ally")).toEqual([
      hero.id,
    ]);
  });

  it("selects only living, conscious party targets for monster AI", () => {
    const player = createPlayer("Hero", stats);
    const hero = createHeroCombatant(player);
    const companion = createPartyCombatant({
      id: "lyra",
      name: "Lyra",
      hp: 20,
      maxHp: 20,
      stats,
      activeEffects: [],
      getArmorClass: () => 13,
    }, "companion");
    player.hp = 0;

    expect(selectMonsterTarget([hero, companion], () => 0)?.id).toBe(
      companion.id,
    );
    companion.currentHp = 0;
    expect(selectMonsterTarget([hero, companion], () => 0)).toBeUndefined();
    expect(isPartyDefeated([hero, companion])).toBe(true);
  });

  it("creates extensible rewards and battle result payloads", () => {
    const encounter = createEncounter();
    const player = createPlayer("Hero", stats);
    const hero = createHeroCombatant(player);
    const enemies = createGroupCombatants(encounter);
    enemies[0]!.currentHp = 0;
    enemies[0]!.isAlive = false;
    enemies[0]!.isKnockedOut = true;
    const rewards = resolveBattleRewards(encounter, {
      adjustRewards: (base) => ({ xp: base.xp + 10, gold: base.gold + 5 }),
    });
    const result = createBattleResult(
      "victory",
      [hero],
      enemies,
      rewards,
      ["potion"],
    );

    expect(rewards.xp).toBeGreaterThan(10);
    expect(result.outcome).toBe("victory");
    expect(result.defeatedEnemyIds).toEqual([enemies[0]!.id]);
    expect(result.survivingPartyIds).toEqual([hero.id]);
    expect(result.droppedItemIds).toEqual(["potion"]);
  });
});
