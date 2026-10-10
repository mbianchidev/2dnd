import { describe, expect, it, vi } from "vitest";
import {
  createCombatDicePresentation,
  createComponentDicePresentation,
  createD20Presentation,
  createSkillDicePresentation,
  DicePresentationController,
  DiceRollHistory,
  formatDicePresentation,
  getDicePresentationDuration,
} from "../src/systems/dicePresentation";
import { snapshotD20Roll } from "../src/systems/rollResults";
import type {
  DicePresentation,
  DicePresentationAdapter,
} from "../src/systems/dicePresentation";
import type { ResolvedD20Roll } from "../src/systems/rollResults";

function receipt(
  changes: Partial<ResolvedD20Roll> = {},
): ResolvedD20Roll {
  return snapshotD20Roll({
    naturalRolls: [12],
    selectedIndex: 0,
    selection: "normal",
    naturalRoll: 12,
    modifier: 3,
    total: 15,
    ...changes,
  });
}

function presentation(): DicePresentation {
  return createD20Presentation(receipt(), {
    category: "skill",
    label: "Wisdom check",
    outcome: "success",
    threshold: { kind: "DC", value: 14 },
  });
}

describe("resolved dice mapping", () => {
  it("copies and freezes exact authoritative values without RNG or arithmetic", () => {
    const rng = vi.spyOn(Math, "random");
    const naturals = [4, 19];
    const result = receipt({
      naturalRolls: naturals,
      selectedIndex: 1,
      selection: "advantage",
      naturalRoll: 19,
      modifier: -2,
      total: 17,
    });
    const view = createD20Presentation(result, {
      category: "skill",
      label: "Check",
      outcome: "failure",
      threshold: { kind: "DC", value: 18 },
    });
    naturals[1] = 1;
    expect(view.roll).toEqual(result);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.naturalRolls)).toBe(true);
    expect(Object.isFrozen(view)).toBe(true);
    expect(formatDicePresentation(view)).toContain("Advantage");
    expect(formatDicePresentation(view)).toContain("19 selected");
    expect(formatDicePresentation(view)).toContain("-2 = 17 vs DC 18");
    expect(formatDicePresentation(view)).toContain("Failure");
    expect(rng).not.toHaveBeenCalled();
    rng.mockRestore();
  });

  it("never recalculates a supplied total or decides the outcome", () => {
    const view = createD20Presentation(receipt({ total: 73 }), {
      category: "save",
      label: "Save",
      outcome: "failure",
      threshold: { kind: "DC", value: 10 },
    });
    expect(formatDicePresentation(view)).toContain("= 73 vs DC 10");
    expect(formatDicePresentation(view)).toContain("Failure");
  });

  it("shows both disadvantage dice and the selected natural 1, not the discarded 20", () => {
    const roll = receipt({
      naturalRolls: [20, 1],
      selectedIndex: 1,
      selection: "disadvantage",
      naturalRoll: 1,
      modifier: 8,
      total: 9,
    });
    const view = createCombatDicePresentation({
      rollResult: roll,
      hit: false,
      critical: false,
      fumble: true,
      damage: 0,
      targetAC: 12,
    }, {
      label: "Hero attacks",
      revealThreshold: false,
    });
    expect(view?.outcome).toBe("fumble");
    expect(view?.roll?.selectedIndex).toBe(1);
    expect(formatDicePresentation(view!))
      .toContain("Disadvantage: d20 [20, 1 selected]");
    expect(formatDicePresentation(view!)).not.toContain("Critical hit");
    expect(formatDicePresentation(view!)).not.toContain("AC");
  });

  it("uses canonical critical and auto-hit flags without inventing dice", () => {
    const critical = createCombatDicePresentation({
      rollResult: receipt({
        naturalRolls: [20],
        naturalRoll: 20,
        total: 23,
      }),
      critical: true,
      hit: true,
      damage: 11,
      targetAC: 99,
    }, { label: "Attack" });
    expect(formatDicePresentation(critical!)).toContain("Critical hit");
    expect(formatDicePresentation(critical!)).toContain("11 damage (aggregate)");

    const missile = createCombatDicePresentation({
      autoHit: true,
      hit: true,
      damage: 8,
      targetAC: 99,
    }, { label: "Magic Missile", revealThreshold: true });
    expect(missile?.roll).toBeUndefined();
    expect(missile?.threshold).toBeUndefined();
    expect(formatDicePresentation(missile!)).toContain("Auto-hit (no attack roll)");
    expect(formatDicePresentation(missile!)).not.toMatch(/d20|\bAC\b|critical/i);
  });

  it("redacts undiscovered AC and hidden monster bonuses/totals from the entire view", () => {
    const attack = {
      rollResult: receipt({ modifier: 137, total: 149 }),
      hit: true,
      damage: 4,
      targetAC: 91,
    };
    const hidden = createCombatDicePresentation(attack, {
      label: "Monster attacks",
      revealModifier: false,
      revealThreshold: false,
    });
    expect(hidden?.roll?.naturalRoll).toBe(12);
    expect(hidden?.roll?.modifier).toBeUndefined();
    expect(hidden?.roll?.total).toBeUndefined();
    expect(hidden?.threshold).toBeUndefined();
    expect(JSON.stringify(hidden)).not.toMatch(/137|149|91/);
    expect(formatDicePresentation(hidden!)).not.toMatch(/137|149|91|AC/);

    const known = createCombatDicePresentation(attack, {
      label: "Hero attacks",
      revealThreshold: true,
    });
    expect(known?.threshold).toEqual({ kind: "AC", value: 91 });
    expect(formatDicePresentation(known!)).toContain("vs AC 91");
  });

  it("keeps skill-check natural 1/20 separate from attack fumbles/criticals", () => {
    for (const naturalRoll of [1, 20]) {
      const view = createSkillDicePresentation({
        ability: "wisdom",
        naturalRoll,
        modifier: 0,
        total: naturalRoll,
        dc: 25,
        success: false,
      }, { label: "Wisdom check" });
      expect(view.outcome).toBe("failure");
      expect(formatDicePresentation(view)).not.toMatch(/critical|fumble/i);
    }
  });

  it("presents exact non-d20 components only when a canonical resolver supplies them", () => {
    const view = createComponentDicePresentation({
      sides: 6,
      naturalRolls: [2, 5],
      modifier: 1,
      total: 8,
    }, {
      category: "healing",
      label: "Heal",
      outcome: "success",
    });
    expect(view.roll).toBeUndefined();
    expect(formatDicePresentation(view)).toContain("d6 [2, 5] +1 = 8");
    expect(formatDicePresentation(view)).not.toContain("d20");
    expect(createCombatDicePresentation({
      hit: true,
      damage: 8,
    }, { label: "No exposed dice" })).toBeNull();
    const hidden = createComponentDicePresentation({
      sides: 6, naturalRolls: [2, 5], modifier: 131, total: 138,
    }, {
      category: "damage", label: "Components", outcome: "hit", revealModifier: false,
    });
    expect(JSON.stringify(hidden)).not.toMatch(/131|138/);
    expect(formatDicePresentation(hidden)).toContain("d6 [2, 5]");
  });

  it("rejects invalid or missing exact natural faces", () => {
    expect(() => receipt({ naturalRolls: [0] })).toThrow(/natural/i);
    expect(() => receipt({ selectedIndex: 1 })).toThrow(/selected/i);
    expect(() => receipt({ naturalRoll: 7 })).toThrow(/selected/i);
  });
});

describe("non-blocking dice presentation lifecycle", () => {
  function setup() {
    const scheduled: Array<() => void> = [];
    const cancelTimer = vi.fn();
    const adapter: DicePresentationAdapter = {
      record: vi.fn(),
      show: vi.fn(),
      settle: vi.fn(),
      clear: vi.fn(),
      schedule: vi.fn((_duration, complete) => {
        scheduled.push(complete);
        return cancelTimer;
      }),
    };
    const controller = new DicePresentationController(adapter);
    return { controller, adapter, scheduled, cancelTimer };
  }

  it("records and shows immediately, deduplicates one receipt, and fast-forwards only visuals", () => {
    const { controller, adapter, scheduled, cancelTimer } = setup();
    const source = {};
    const view = presentation();
    controller.present(view, { frequency: "all", speed: "normal" }, false, source);
    controller.present(view, { frequency: "all", speed: "normal" }, false, source);
    expect(adapter.record).toHaveBeenCalledTimes(1);
    expect(adapter.show).toHaveBeenCalledTimes(1);
    expect(controller.history).toHaveLength(1);
    expect(controller.phase).toBe("animating");
    controller.fastForward();
    controller.fastForward();
    scheduled[0]!();
    expect(cancelTimer).toHaveBeenCalledTimes(1);
    expect(adapter.settle).toHaveBeenCalledTimes(1);
    expect(controller.phase).toBe("ready");
    expect(controller.history[0]?.text).toBe(formatDicePresentation(view));
  });

  it("deduplicates stable action IDs from custom component resolvers", () => {
    const { controller, adapter } = setup();
    for (let index = 0; index < 2; index += 1) {
      const view = createComponentDicePresentation({
        sides: 6, naturalRolls: [2, 5], modifier: 0, total: 7,
      }, { id: "table:round:4", category: "other", label: "Crown & Bones", outcome: "rolled", detail: "Safe" });
      controller.present(view, { frequency: "all", speed: "normal" }, false);
    }
    expect(adapter.record).toHaveBeenCalledTimes(1);
    expect(controller.history[0]?.text).toContain("Safe");
  });

  it("keeps disabled, instant, and reduced-motion information without scheduling", () => {
    for (const [preferences, reducedMotion] of [
      [{ frequency: "off", speed: "normal" }, false],
      [{ frequency: "all", speed: "instant" }, false],
      [{ frequency: "all", speed: "normal" }, true],
    ] as const) {
      const { controller, adapter } = setup();
      controller.present(presentation(), preferences, reducedMotion);
      expect(adapter.record).toHaveBeenCalledTimes(1);
      expect(adapter.show).toHaveBeenCalledWith(expect.objectContaining({
        duration: 0,
        text: formatDicePresentation(presentation()),
      }));
      expect(adapter.schedule).not.toHaveBeenCalled();
      expect(controller.phase).toBe("ready");
    }
  });

  it("cleans timers and stale completions once without rerunning log or scene callbacks", () => {
    const { controller, adapter, scheduled, cancelTimer } = setup();
    controller.present(presentation(), { frequency: "all", speed: "normal" }, false);
    controller.cleanup();
    controller.cleanup();
    scheduled[0]!();
    controller.fastForward();
    controller.present(presentation(), { frequency: "all", speed: "normal" }, false);
    expect(cancelTimer).toHaveBeenCalledTimes(1);
    expect(adapter.clear).toHaveBeenCalledTimes(1);
    expect(adapter.record).toHaveBeenCalledTimes(1);
    expect(controller.phase).toBe("clean");
    expect(controller.history).toEqual([]);
  });

  it("cancels superseded visuals, retains bounded logs, and never consumes RNG", () => {
    const { controller, adapter, scheduled } = setup();
    const rng = vi.spyOn(Math, "random");
    for (let index = 0; index < 45; index += 1) {
      controller.present(presentation(), { frequency: "all", speed: "normal" }, false);
    }
    scheduled[0]!();
    expect(controller.phase).toBe("animating");
    scheduled[scheduled.length - 1]!();
    expect(controller.phase).toBe("ready");
    expect(controller.history).toHaveLength(40);
    expect(adapter.record).toHaveBeenCalledTimes(45);
    expect(rng).not.toHaveBeenCalled();
    rng.mockRestore();
  });

  it("filters visual frequency only and gives fast mode a shorter visual duration", () => {
    const ordinaryAttack = createD20Presentation(receipt(), {
      category: "attack",
      label: "Attack",
      outcome: "hit",
    });

    expect(getDicePresentationDuration(
      ordinaryAttack, { frequency: "important", speed: "normal" }, false,
    )).toBe(0);
    expect(getDicePresentationDuration(
      presentation(), { frequency: "important", speed: "normal" }, false,
    )).toBe(450);
    expect(getDicePresentationDuration(
      presentation(), { frequency: "all", speed: "fast" }, false,
    )).toBe(150);
  });

  it("keeps bounded resolved history across visual cleanup and explicitly resets at title", () => {
    const history = new DiceRollHistory();
    const { controller, adapter } = setup();
    vi.mocked(adapter.record).mockImplementation((event) => history.append(event));
    for (let index = 0; index < 45; index += 1) {
      controller.present(presentation(), { frequency: "off", speed: "instant" }, true);
    }
    controller.cleanup();
    expect(history.entries).toHaveLength(40);
    expect(history.entries[0]?.text).toBe(formatDicePresentation(presentation()));
    expect(Object.isFrozen(history.entries)).toBe(true);
    history.clear();
    expect(history.entries).toEqual([]);
  });
});
