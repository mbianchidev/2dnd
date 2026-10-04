import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlayer } from "../src/systems/player";
import { getItem } from "../src/data/items";
import { getMonster } from "../src/data/monsters";
import { createSoloEncounter } from "../src/data/monsterGroups";
import {
  attemptFlee,
  playerAttack,
  playerOffHandAttack,
  playerUseAbility,
  playerCastSpellAtTargets,
} from "../src/systems/combat";
import { rollD20, rollWithAdvantage, rollWithDisadvantage } from "../src/systems/dice";
import {
  createGroupCombatants,
  createHeroCombatant,
  rollBattleInitiative,
} from "../src/systems/groupCombat";
import { applyStatusEffect, processStartOfTurn } from "../src/systems/statusEffects";
import {
  createCombatDicePresentation,
  createTrapDicePresentation,
  DicePresentationController,
  formatDicePresentation,
  redactSavingThrowMessage,
} from "../src/systems/dicePresentation";

const STATS = {
  strength: 14, dexterity: 14, constitution: 10,
  intelligence: 14, wisdom: 14, charisma: 10,
};

function createActor() {
  const actor = createPlayer("Receipt Tester", STATS, "wizard");
  actor.mp = 50;
  actor.maxMp = 50;
  actor.equippedOffHand = { ...getItem("dagger")! };
  return actor;
}

afterEach(() => vi.restoreAllMocks());

describe("canonical roll receipts", () => {
  it.each([
    ["advantage", rollWithAdvantage, 1],
    ["disadvantage", rollWithDisadvantage, 0],
  ] as const)("captures both %s naturals without extra RNG", (_mode, roll, selectedIndex) => {
    const random = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.999);
    const result = roll(-2);
    expect(result.rollResult.naturalRolls).toEqual([1, 20]);
    expect(result.rollResult.selectedIndex).toBe(selectedIndex);
    expect(result.rollResult.naturalRoll).toBe(result.chosen);
    expect(result.rollResult.total).toBe(result.total);
    expect(random).toHaveBeenCalledTimes(2);
  });

  it("preserves selected natural 1 across all disadvantage attack resolvers", () => {
    const monster = getMonster("orc")!;
    const resolvers = [
      (actor: ReturnType<typeof createActor>) => playerAttack(actor, monster),
      (actor: ReturnType<typeof createActor>) => playerOffHandAttack(actor, monster),
      (actor: ReturnType<typeof createActor>) => playerUseAbility(actor, "shieldBash", monster),
      (actor: ReturnType<typeof createActor>) =>
        playerCastSpellAtTargets(actor, "fireBolt", [{ monster }]).results[0]!,
    ];
    for (const resolve of resolvers) {
      const actor = createActor();
      applyStatusEffect(actor.activeEffects, "prone", "Test");
      const random = vi.spyOn(Math, "random")
        .mockReturnValueOnce(0.999)
        .mockReturnValueOnce(0)
        .mockReturnValue(0.5);
      const result = resolve(actor);
      expect(result.rollResult?.naturalRolls).toEqual([20, 1]);
      expect(result.rollResult?.naturalRoll).toBe(1);
      expect(result.rollResult?.selectedIndex).toBe(1);
      expect(result.hit).toBe(false);
      expect(result.fumble).toBe(true);
      expect(result.critical ?? false).toBe(false);
      expect(result.damage).toBe(0);
      random.mockRestore();
    }
  });

  it("captures real critical/fumble results without fabricating damage components", () => {
    const actor = createActor();
    const monster = getMonster("orc")!;
    const random = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.999)
      .mockReturnValue(0.5);
    const critical = playerAttack(actor, monster);
    expect(critical.critical).toBe(true);
    expect(critical.rollResult?.naturalRoll).toBe(20);
    expect(random).toHaveBeenCalledTimes(3);
    expect(createCombatDicePresentation(critical, { label: "Attack" })?.components)
      .toBeUndefined();
    random.mockReset().mockReturnValue(0);
    const fumble = playerAttack(actor, monster);
    expect(fumble.fumble).toBe(true);
    expect(fumble.rollResult?.naturalRoll).toBe(1);
    expect(random).toHaveBeenCalledTimes(1);
  });

  it("Magic Missile remains auto-hit and spends only its real damage RNG and MP", () => {
    const actor = createActor();
    applyStatusEffect(actor.activeEffects, "prone", "Test");
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const result = playerCastSpellAtTargets(actor, "magicMissile", [{
      monster: getMonster("orc")!,
    }]);
    const target = result.results[0]!;
    expect(target.autoHit).toBe(true);
    expect(target.rollResult).toBeUndefined();
    expect(target.disadvantage).toBe(false);
    expect(target.roll).toBeUndefined();
    expect(actor.mp).toBe(50 - result.mpUsed);
    const calls = random.mock.calls.length;
    const view = createCombatDicePresentation(target, { label: "Magic Missile" })!;
    expect(formatDicePresentation(view)).toContain("Auto-hit");
    expect(random).toHaveBeenCalledTimes(calls);
  });

  it("captures failed and successful status saves, including their exact modifiers", () => {
    const actor = createActor();
    applyStatusEffect(actor.activeEffects, "freeze", "Test");
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    const failed = processStartOfTurn(actor.activeEffects, actor.stats);
    expect(failed.savingThrows[0]).toMatchObject({
      effectId: "freeze", success: false, dc: 12,
      rollResult: { naturalRoll: 1, modifier: 0, total: 1 },
    });
    expect(actor.activeEffects).toHaveLength(1);
    random.mockReturnValue(0.999);
    const success = processStartOfTurn(actor.activeEffects, actor.stats);
    expect(success.savingThrows[0]?.rollResult.naturalRoll).toBe(20);
    expect(success.savingThrows[0]?.success).toBe(true);
    expect(redactSavingThrowMessage(
      success.messages[0]!, success.savingThrows, false,
    )).toBe("Saved vs Frozen!");
    expect(redactSavingThrowMessage(
      success.messages[0]!, success.savingThrows, true,
    )).toBe(success.messages[0]);
    expect(redactSavingThrowMessage(
      "Poisoned deals 4 damage!", success.savingThrows, false,
    )).toBe("Poisoned deals 4 damage!");
    expect(actor.activeEffects).toHaveLength(0);
    expect(random).toHaveBeenCalledTimes(2);
    expect(Object.isFrozen(success.savingThrows)).toBe(true);
  });

  it("initiative retains exact per-actor rolls and never infers naturals from legacy totals", () => {
    const actor = createActor();
    const hero = createHeroCombatant(actor);
    const enemies = createGroupCombatants(createSoloEncounter(getMonster("orc")!));
    const random = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.2)
      .mockReturnValueOnce(0.7);
    const result = rollBattleInitiative([hero, ...enemies],
      (combatant) => combatant.side === "party" ? 2 : 7);
    expect(result.rollResults[hero.id]).toMatchObject({
      naturalRoll: 5, modifier: 2, total: 7,
    });
    expect(result.rollResults[enemies[0]!.id]).toMatchObject({
      naturalRoll: 15, modifier: 7, total: 22,
    });
    expect(result.order[0]?.combatantId).toBe(enemies[0]!.id);
    expect(random).toHaveBeenCalledTimes(2);
    const legacy = rollBattleInitiative([hero], () => 3, () => 103);
    expect(legacy.rolls[hero.id]).toBe(103);
    expect(legacy.rollResults[hero.id]).toBeUndefined();
    expect(random).toHaveBeenCalledTimes(2);
  });

  it("flee returns the already-resolved d20 and living-group DC", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const result = attemptFlee(2, 3);
    expect(result).toMatchObject({
      success: false, dc: 14,
      rollResult: { naturalRoll: 11, modifier: 2, total: 13 },
    });
    expect(random).toHaveBeenCalledTimes(1);
  });

  it("enabled and disabled presentation preserve outcomes, resources and the next random roll", () => {
    function run(frequency: "all" | "off") {
      const actor = createActor();
      const monster = getMonster("orc")!;
      let seed = 57;
      let calls = 0;
      const random = vi.spyOn(Math, "random").mockImplementation(() => {
        calls += 1;
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 0x1_0000_0000;
      });
      const result = playerCastSpellAtTargets(actor, "fireBolt", [{ monster }]);
      const controller = new DicePresentationController({
        record: () => {},
        show: () => {},
        settle: () => {},
        clear: () => {},
        schedule: () => () => {},
      });
      const target = result.results[0]!;
      const view = createCombatDicePresentation(target, { label: "Spell" })!;
      controller.present(view, { frequency, speed: "normal" }, false, target);
      controller.present(view, { frequency, speed: "normal" }, false, target);
      controller.fastForward();
      controller.cleanup();
      const next = rollD20();
      const snapshot = { result, mp: actor.mp, hp: actor.hp, next, calls };
      random.mockRestore();
      return snapshot;
    }
    expect(run("all")).toEqual(run("off"));
  });
});

describe("trap discovery projection", () => {
  it("hides failed detection names, DCs and stable trap locations", () => {
    const view = createTrapDicePresentation({
      attempted: true, success: false, automatic: false,
      roll: 3, modifier: 2, total: 5, dc: 37, rewardXp: 0,
    }, "Secret Rune", true)!;
    expect(view.label).toBe("Dungeon awareness");
    expect(view.threshold).toBeUndefined();
    expect(JSON.stringify(view)).not.toMatch(/Secret|Rune|37/);
    expect(formatDicePresentation(view)).toContain("d20 3 +2 = 5");
  });

  it("shows known disarm DCs and never invents a die for automatic detection or repeat checks", () => {
    const automatic = {
      attempted: true, success: true, automatic: true,
      roll: null, modifier: 2, total: 12, dc: 12, rewardXp: 0,
    };
    const view = createTrapDicePresentation(automatic, "Spike Pit", true)!;
    expect(view.roll).toBeUndefined();
    expect(view.threshold).toBeUndefined();
    expect(formatDicePresentation(view)).toContain("Automatic (no roll)");
    expect(createTrapDicePresentation({ ...automatic, attempted: false }, "Pit", true))
      .toBeNull();
    expect(createTrapDicePresentation({
      ...automatic, automatic: false, roll: 15, total: 17,
    }, "Pit", false)?.threshold).toEqual({ kind: "DC", value: 12 });
  });
});
