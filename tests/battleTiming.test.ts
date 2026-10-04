import { describe, expect, it, vi } from "vitest";
import { TIMED_ROUND_DURATIONS } from "../src/data/battleTiming";
import {
  createBattleTimingSettings,
  normalizeBattleTimingSettings,
  resolveBattleTimingSettings,
} from "../src/systems/battleTimingSettings";
import {
  BattleDecisionClock,
  executeTimedBattleTimeout,
  type BattleTimingPauseReason,
} from "../src/systems/battleTiming";
import {
  consumeBattleActionEconomy,
  createBattleActionEconomy,
  createPlayerBattleActionSource,
  executeValidatedBattleAction,
  validateBattleAction,
} from "../src/systems/battleActions";
import {
  createGroupCombatants,
  createHeroCombatant,
} from "../src/systems/groupCombat";
import { createPlayer } from "../src/systems/player";
import { createSoloEncounter } from "../src/data/monsterGroups";
import { getMonster } from "../src/data/monsters";
import { getItem } from "../src/data/items";

function timedClock(): BattleDecisionClock {
  const clock = new BattleDecisionClock({
    mode: "timed",
    durationSeconds: 15,
    timeoutAction: "defend",
  });
  clock.beginTurn("turn:1", "party:hero");
  clock.advance(0);
  return clock;
}

function battle() {
  const player = createPlayer("TimingHero", {
    strength: 10, dexterity: 10, constitution: 10,
    intelligence: 10, wisdom: 10, charisma: 10,
  }, "barbarian");
  player.level = 5;
  player.knownAbilities.push("rage");
  const hero = createHeroCombatant(player);
  const enemies = createGroupCombatants(createSoloEncounter(getMonster("orc")!));
  const source = createPlayerBattleActionSource(player, hero);
  const context = {
    combatants: [hero, ...enemies],
    enemies,
    sources: [source],
  };
  return { player, hero, source, context };
}

describe("per-campaign battle timing settings", () => {
  it("defaults to Standard without opting in through an adjustment", () => {
    expect(createBattleTimingSettings()).toEqual({
      mode: "standard",
      durationSeconds: 30,
      timeoutAction: "defend",
    });
    expect(resolveBattleTimingSettings(createBattleTimingSettings(), {
      durationSeconds: 15,
    })).toEqual(createBattleTimingSettings());
  });

  it.each(TIMED_ROUND_DURATIONS)("preserves the supported %ss duration", (durationSeconds) => {
    expect(normalizeBattleTimingSettings({
      mode: "timed", durationSeconds, timeoutAction: "defend",
    })).toEqual({ mode: "timed", durationSeconds, timeoutAction: "defend" });
  });

  it.each([undefined, null, [], true, "timed", 15])(
    "repairs a malformed settings record %j to Standard",
    (value) => {
      expect(normalizeBattleTimingSettings(value)).toEqual(createBattleTimingSettings());
    },
  );

  it.each([0, -15, 16, 120, 1_000_000, 15.5, "15", null, NaN, Infinity])(
    "repairs an invalid duration %j without accepting arbitrary time limits",
    (durationSeconds) => {
      expect(normalizeBattleTimingSettings({
        mode: "timed", durationSeconds, timeoutAction: "attack",
      })).toEqual({ mode: "timed", durationSeconds: 30, timeoutAction: "defend" });
    },
  );

  it("does not turn malformed mode values into an opt-in", () => {
    expect(normalizeBattleTimingSettings({
      mode: true, durationSeconds: 15,
    })).toEqual({ mode: "standard", durationSeconds: 15, timeoutAction: "defend" });
  });

  it("resolves an optional bounded difficulty suggestion without mutating configuration", () => {
    const settings = { mode: "timed", durationSeconds: 30, timeoutAction: "defend" } as const;
    expect(resolveBattleTimingSettings(settings, { durationSeconds: 60 }))
      .toEqual({ ...settings, durationSeconds: 60 });
    expect(settings.durationSeconds).toBe(30);
  });
});

describe("deterministic decision clock", () => {
  it.each(TIMED_ROUND_DURATIONS)("uses the exact %ss active decision boundary", (durationSeconds) => {
    const clock = new BattleDecisionClock({
      mode: "timed", durationSeconds, timeoutAction: "defend",
    });
    clock.beginTurn(`duration:${durationSeconds}`, "party:hero");
    clock.advance(0);
    clock.advance(durationSeconds * 1_000 - 1);
    expect(clock.snapshot.decision?.remainingMs).toBe(1);
    expect(clock.claimTimeout(`duration:${durationSeconds}`)).toBe(false);
    clock.advance(1);
    expect(clock.claimTimeout(`duration:${durationSeconds}`)).toBe(true);
  });

  it("is inert in Standard, including large elapsed intervals", () => {
    const clock = new BattleDecisionClock(createBattleTimingSettings());
    clock.beginTurn("turn:1", "party:hero");
    clock.advance(1_000_000);
    expect(clock.snapshot.status).toBe("disabled");
    expect(clock.snapshot.decision).toBeNull();
    expect(clock.claimTimeout("turn:1")).toBe(false);
  });

  it("expires at exactly the active-time boundary and can be claimed only once", () => {
    const clock = timedClock();
    clock.advance(14_999);
    expect(clock.snapshot.decision?.remainingMs).toBe(1);
    expect(clock.claimTimeout("turn:1")).toBe(false);
    clock.advance(1);
    expect(clock.snapshot.status).toBe("expired");
    expect(clock.claimTimeout("turn:1")).toBe(true);
    expect(clock.claimTimeout("turn:1")).toBe(false);
    clock.advance(15_000);
    expect(clock.snapshot.status).toBe("claimed");
  });

  it.each<BattleTimingPauseReason>([
    "input", "action", "animation", "log", "overlay",
    "transition", "visibility", "focus", "controller", "scene",
  ])("does not spend active time while paused for %s", (reason) => {
    const clock = timedClock();
    clock.advance(4_000);
    clock.setPaused(reason, true);
    clock.advance(100_000);
    expect(clock.snapshot.status).toBe("paused");
    expect(clock.snapshot.decision?.remainingMs).toBe(11_000);
    expect(clock.claimTimeout("turn:1")).toBe(false);
    clock.setPaused(reason, false);
    clock.advance(100_000);
    expect(clock.snapshot.decision?.remainingMs).toBe(11_000);
    clock.advance(10_999);
    expect(clock.snapshot.decision?.remainingMs).toBe(1);
  });

  it("requires every overlapping pause reason to clear", () => {
    const clock = timedClock();
    clock.advance(5_000);
    clock.setPaused("animation", true);
    clock.setPaused("visibility", true);
    clock.setPaused("controller", true);
    clock.setPaused("animation", false);
    clock.advance(50_000);
    clock.setPaused("visibility", false);
    clock.advance(50_000);
    expect(clock.snapshot.pauseReasons).toEqual(["controller"]);
    expect(clock.snapshot.decision?.remainingMs).toBe(10_000);
    clock.setPaused("controller", false);
    clock.advance(50_000);
    clock.advance(9_999);
    expect(clock.snapshot.decision?.remainingMs).toBe(1);
  });

  it("cannot claim an expired decision during an authoritative action or overlay", () => {
    const clock = timedClock();
    clock.advance(15_000);
    clock.setPaused("action", true);
    clock.setPaused("overlay", true);
    expect(clock.claimTimeout("turn:1")).toBe(false);
    clock.setPaused("action", false);
    expect(clock.claimTimeout("turn:1")).toBe(false);
    clock.setPaused("overlay", false);
    expect(clock.claimTimeout("turn:1")).toBe(true);
  });

  it("keeps the same budget through targeting, menu changes, and bonus actions", () => {
    const clock = timedClock();
    clock.advance(6_000);
    clock.beginTurn("turn:1", "party:hero");
    clock.setPaused("action", true);
    clock.advance(2_000);
    clock.setPaused("action", false);
    clock.advance(2_000);
    clock.advance(3_000);
    expect(clock.snapshot.decision?.remainingMs).toBe(6_000);
  });

  it("gives a new controlled actor a fresh budget and rejects stale callbacks", () => {
    const clock = timedClock();
    clock.advance(15_000);
    clock.endTurn();
    clock.beginTurn("turn:2", "party:companion:guardian");
    clock.advance(700);
    expect(clock.claimTimeout("turn:1")).toBe(false);
    expect(clock.snapshot.decision).toMatchObject({
      id: "turn:2", actorId: "party:companion:guardian", remainingMs: 15_000,
    });
    clock.advance(15_000);
    expect(clock.claimTimeout("turn:2")).toBe(true);
  });

  it("never runs a previous decision after cleanup or scene re-entry", () => {
    const clock = timedClock();
    clock.advance(15_000);
    clock.destroy();
    clock.destroy();
    clock.advance(1_000_000);
    clock.beginTurn("turn:2", "party:hero");
    expect(clock.snapshot.status).toBe("stopped");
    expect(clock.snapshot.decision).toBeNull();
    expect(clock.claimTimeout("turn:1")).toBe(false);
    expect(clock.claimTimeout("turn:2")).toBe(false);
  });

  it("does not charge the frame that started a turn", () => {
    const clock = new BattleDecisionClock({
      mode: "timed", durationSeconds: 15, timeoutAction: "defend",
    });
    clock.beginTurn("turn:1", "party:hero");
    clock.advance(10_000);
    expect(clock.snapshot.decision?.remainingMs).toBe(15_000);
    clock.advance(1);
    expect(clock.snapshot.decision?.remainingMs).toBe(14_999);
  });

  it.each([-1, NaN, Infinity])("rejects invalid elapsed time %j explicitly", (delta) => {
    expect(() => timedClock().advance(delta)).toThrow(RangeError);
  });
});

describe("safe timeout action and economy", () => {
  it("executes one validated Defend without dice, MP, inventory, or enemy mutation", () => {
    const { player, hero, source, context } = battle();
    const clock = timedClock();
    clock.advance(15_000);
    const economy = createBattleActionEconomy(hero.id);
    const before = { mp: player.mp, items: player.inventory.slice(), hp: context.enemies[0]!.currentHp };
    const random = vi.spyOn(Math, "random");
    const result = executeTimedBattleTimeout(clock, "turn:1", source, economy, context);
    const duplicate = executeTimedBattleTimeout(clock, "turn:1", source, economy, context);
    expect(result).toMatchObject({
      claimed: true,
      executed: true,
      economy: { actionUsed: true, bonusActionUsed: false, itemsUsed: 0 },
      action: { plan: { kind: "defend", targetIds: [hero.id] } },
    });
    expect(duplicate.claimed).toBe(false);
    expect(hero.isDefending).toBe(true);
    expect(player.mp).toBe(before.mp);
    expect(player.inventory).toEqual(before.items);
    expect(context.enemies[0]!.currentHp).toBe(before.hp);
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });

  it.each(["item", "ability"] as const)(
    "preserves a spent bonus %s and consumes only the remaining main action",
    (kind) => {
      const { player, hero, source, context } = battle();
      player.inventory.push({ ...getItem("ether")! });
      if (kind === "item") player.mp = 0;
      let economy = createBattleActionEconomy(hero.id);
      const validation = validateBattleAction(context.combatants, {
        actorId: hero.id, kind,
        ...(kind === "item" ? { itemIndex: player.inventory.length - 1 } : { actionId: "rage" }),
      }, {
        mp: player.mp, inventory: player.inventory, economy,
        knownAbilityIds: player.knownAbilities,
      });
      expect(validation.plan).toBeDefined();
      const bonus = executeValidatedBattleAction(source, validation.plan!, context);
      expect(bonus.executed).toBe(true);
      economy = consumeBattleActionEconomy(economy, validation.plan!).state;
      const afterBonus = { mp: player.mp, inventory: player.inventory.slice() };
      const clock = timedClock();
      clock.advance(15_000);
      const result = executeTimedBattleTimeout(clock, "turn:1", source, economy, context);
      expect(result).toMatchObject({
        claimed: true, executed: true,
        economy: { actionUsed: true, bonusActionUsed: true, itemsUsed: kind === "item" ? 1 : 0 },
      });
      expect(player.mp).toBe(afterBonus.mp);
      expect(player.inventory).toEqual(afterBonus.inventory);
    },
  );

  it("ends a spent-main-action decision without consuming a bonus action or executing another action", () => {
    const { hero, source, context } = battle();
    const economy = { ...createBattleActionEconomy(hero.id), actionUsed: true };
    const clock = timedClock();
    clock.advance(15_000);
    const result = executeTimedBattleTimeout(clock, "turn:1", source, economy, context);
    expect(result.claimed).toBe(true);
    expect(result.executed).toBe(false);
    expect(result.economy).toBe(economy);
    expect(hero.isDefending).toBe(false);
  });

  it("does not mutate an actor knocked out before timeout resolution", () => {
    const { player, hero, source, context } = battle();
    const clock = timedClock();
    clock.advance(15_000);
    player.hp = 0;
    const economy = createBattleActionEconomy(hero.id);
    const result = executeTimedBattleTimeout(clock, "turn:1", source, economy, context);
    expect(result).toMatchObject({ claimed: true, executed: false, economy });
    expect(result.message).toContain("able to act");
    expect(hero.isDefending).toBe(false);
  });

  it("does not consume or execute a different actor's economy", () => {
    const { hero, source, context } = battle();
    const clock = timedClock();
    clock.advance(15_000);
    const economy = createBattleActionEconomy("party:companion:guardian");
    const result = executeTimedBattleTimeout(clock, "turn:1", source, economy, context);
    expect(result).toMatchObject({ claimed: true, executed: false, economy });
    expect(hero.isDefending).toBe(false);
  });
});
