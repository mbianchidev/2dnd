import { describe, expect, it } from "vitest";
import { CUSTOM_NUMERIC_DIFFICULTY_RULES } from "../src/data/difficulty";
import {
  adjustCustomDifficultyRule,
  cycleDifficultyProfile,
} from "../src/systems/difficultyEditor";
import { getDifficultyEffectChanges, resolveDifficultyModifiers } from "../src/systems/difficulty";
import { moveSpatialLayoutFocus, type SpatialFocusableLayoutItem } from "../src/systems/layout";

describe("pure difficulty editor", () => {
  it("cycles profiles without losing a remembered Custom draft", () => {
    expect(cycleDifficultyProfile({ profileId: "standard" }, -1)).toEqual({ profileId: "story" });
    expect(cycleDifficultyProfile({ profileId: "legendary" }, 1, { enemyHpPercent: 130 }))
      .toEqual({ profileId: "custom", overrides: { enemyHpPercent: 130 } });
    expect(cycleDifficultyProfile({ profileId: "custom" }, 1)).toEqual({ profileId: "story" });
  });

  it.each(CUSTOM_NUMERIC_DIFFICULTY_RULES)("clamps $id input at both ends without mutation", (rule) => {
    const original = { profileId: "custom" as const };
    let draft = adjustCustomDifficultyRule(original, rule.id, 1);
    for (let index = 0; index < 1000; index += 1) draft = adjustCustomDifficultyRule(draft, rule.id, 1);
    expect(resolveDifficultyModifiers(draft)[rule.id]).toBe(rule.maximum);
    for (let index = 0; index < 1000; index += 1) draft = adjustCustomDifficultyRule(draft, rule.id, -1);
    expect(resolveDifficultyModifiers(draft)[rule.id]).toBe(rule.minimum);
    expect(original).toEqual({ profileId: "custom" });
  });

  it("cycles typed enums, removes neutral overrides and never enables timing", () => {
    const custom = { profileId: "custom" as const };
    expect(resolveDifficultyModifiers(adjustCustomDifficultyRule(custom, "enemyAiPolicy", 1)).enemyAiPolicy)
      .toBe("tactical");
    expect(adjustCustomDifficultyRule(custom, "defeatXpPenalty", 1))
      .toEqual({ profileId: "custom", overrides: { defeatXpPenalty: "none" } });
    let timed = adjustCustomDifficultyRule(custom, "timedRoundDurationSeconds", 1);
    expect(timed).toEqual({ profileId: "custom", overrides: { timedRoundDurationSeconds: 15 } });
    timed = adjustCustomDifficultyRule(timed, "timedRoundDurationSeconds", -1);
    expect(timed).toEqual({ profileId: "custom", overrides: {} });
    expect(timed).not.toHaveProperty("enabled");
    expect(() => adjustCustomDifficultyRule({ profileId: "standard" }, "enemyHpPercent", 1))
      .toThrow("Select Custom");
  });

  it("previews exact changed Custom fields, not only an unchanged Custom label", () => {
    expect(getDifficultyEffectChanges(
      { profileId: "custom", overrides: { enemyHpPercent: 105 } },
      { profileId: "custom", overrides: { enemyHpPercent: 110, pricePercent: 85 } },
    )).toEqual([
      { id: "enemyHpPercent", label: "Enemy HP", from: "105%", to: "110%" },
      { id: "pricePercent", label: "Prices and fees", from: "100%", to: "85%" },
    ]);
    expect(getDifficultyEffectChanges({ profileId: "standard" }, { profileId: "custom" })).toEqual([]);
  });
});

describe("measured difficulty focus navigation", () => {
  const controls: SpatialFocusableLayoutItem[] = [
    { id: "profile", visible: true, enabled: true, bounds: { x: 100, y: 0, width: 400, height: 40 } },
    { id: "rule", visible: true, enabled: true, bounds: { x: 100, y: 60, width: 400, height: 40 } },
    { id: "previous", visible: true, enabled: true, bounds: { x: 100, y: 120, width: 180, height: 40 } },
    { id: "next", visible: true, enabled: true, bounds: { x: 320, y: 120, width: 180, height: 40 } },
    { id: "apply", visible: true, enabled: true, bounds: { x: 100, y: 180, width: 180, height: 40 } },
    { id: "close", visible: true, enabled: true, bounds: { x: 320, y: 180, width: 180, height: 40 } },
  ];
  it("follows real columns across irregular full-width rows", () => {
    expect(moveSpatialLayoutFocus(controls, "profile", "down")).toBe("rule");
    expect(moveSpatialLayoutFocus(controls, "rule", "down")).toBe("previous");
    expect(moveSpatialLayoutFocus(controls, "previous", "right")).toBe("next");
    expect(moveSpatialLayoutFocus(controls, "next", "down")).toBe("close");
    expect(moveSpatialLayoutFocus(controls, "apply", "up")).toBe("previous");
    expect(moveSpatialLayoutFocus(controls, "close", "down")).toBe("close");
  });
  it("excludes hidden and disabled entries rather than leaving navigation gaps", () => {
    const filtered = controls.map((control) => ({
      ...control, enabled: control.id !== "previous", visible: control.id !== "next",
    }));
    expect(moveSpatialLayoutFocus(filtered, "rule", "down")).toBe("apply");
    expect(moveSpatialLayoutFocus([], "rule", "down")).toBeUndefined();
  });
});
