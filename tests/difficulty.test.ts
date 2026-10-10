import { describe, expect, it } from "vitest";
import {
  CUSTOM_NUMERIC_DIFFICULTY_RULES,
  DEFEAT_XP_PENALTIES,
  DIFFICULTY_PROFILES,
  DIFFICULTY_TIMED_ROUND_DURATIONS,
  ENEMY_AI_POLICIES,
  STANDARD_DIFFICULTY_MODIFIERS,
  STANDARD_DIFFICULTY_SELECTION,
  getDifficultyProfile,
} from "../src/data/difficulty";
import { ALL_MONSTERS } from "../src/data/monsters";
import {
  DIFFICULTY_HISTORY_LIMIT,
  STANDARD_DIFFICULTY_RULES,
  areDifficultySelectionsEqual,
  createCampaignDifficulty,
  getDifficultyAchievementEligibility,
  getDifficultyEffectPreview,
  getDifficultyEncounterRate,
  getDifficultyTimingAdjustment,
  isDifficultyChallengeEligible,
  isDifficultySelection,
  normalizeCampaignDifficulty,
  normalizeDifficultySelection,
  resolveDifficultyRules,
  scaleCost,
  scaleEnemy,
  scaleEnemyDamage,
  scaleReward,
  scaleSaleValue,
} from "../src/systems/difficulty";
import type { DifficultyScaleLayer } from "../src/systems/difficulty";
import { getEffectiveEncounterRate } from "../src/systems/encounterRate";

describe("canonical difficulty profiles", () => {
  it("makes Standard an explicit identity for every existing modifier", () => {
    expect(STANDARD_DIFFICULTY_RULES).toEqual({
      enemyHpMultiplier: 1,
      enemyDamageMultiplier: 1,
      enemyAccuracyBonus: 0,
      enemyAiPolicy: "standard",
      encounterPressureMultiplier: 1,
      fleeDcAdjustment: 0,
      skillCheckAssistance: 0,
      defeatGoldRetention: 0.7,
      defeatXpPenalty: "currentLevel",
      defeatRecoveryMultiplier: 0.5,
      priceMultiplier: 1,
      xpRewardMultiplier: 1,
      goldRewardMultiplier: 1,
    });
    expect(getDifficultyTimingAdjustment(STANDARD_DIFFICULTY_SELECTION)).toEqual({});
    expect(getDifficultyProfile("standard").modifiers).toBe(STANDARD_DIFFICULTY_MODIFIERS);
    expect(Object.isFrozen(STANDARD_DIFFICULTY_RULES)).toBe(true);
  });

  it.each(DIFFICULTY_PROFILES)("keeps $name within every supported Custom bound", (profile) => {
    const selection = normalizeDifficultySelection({ profileId: profile.id });
    const rules = resolveDifficultyRules(selection);
    for (const definition of CUSTOM_NUMERIC_DIFFICULTY_RULES) {
      const value = profile.modifiers[definition.id];
      expect(value).toBeGreaterThanOrEqual(definition.minimum);
      expect(value).toBeLessThanOrEqual(definition.maximum);
      expect((value - definition.minimum) % definition.step).toBe(0);
    }
    expect(rules.enemyHpMultiplier).toBeGreaterThan(0);
    expect(rules.enemyDamageMultiplier).toBeGreaterThan(0);
    expect(rules.defeatGoldRetention).toBeGreaterThanOrEqual(0.5);
    expect(rules.defeatRecoveryMultiplier).toBeGreaterThanOrEqual(0.5);
    expect(getDifficultyEffectPreview(selection)).toHaveLength(14);
  });

  it("keeps Story, Veteran and Legendary mechanically distinct and previewed", () => {
    const story = resolveDifficultyRules({ profileId: "story" });
    const veteran = resolveDifficultyRules({ profileId: "veteran" });
    const legendary = resolveDifficultyRules({ profileId: "legendary" });
    expect(story.enemyHpMultiplier).toBeLessThan(1);
    expect(story.skillCheckAssistance).toBe(2);
    expect(story.defeatXpPenalty).toBe("none");
    expect(veteran.enemyDamageMultiplier).toBeGreaterThan(1);
    expect(legendary.enemyDamageMultiplier).toBeGreaterThan(veteran.enemyDamageMultiplier);
    expect(legendary.enemyAiPolicy).toBe("relentless");
    expect(getDifficultyEffectPreview({ profileId: "legendary" })).toContainEqual({
      id: "defeatGoldLossPercent", label: "Defeat gold loss", value: "40%",
    });
  });
});

describe("constrained Custom rules", () => {
  it.each(CUSTOM_NUMERIC_DIFFICULTY_RULES)(
    "validates every supported value and repairs the $id boundaries",
    (rule) => {
      for (let value = rule.minimum; value <= rule.maximum; value += rule.step) {
        const selection = { profileId: "custom", overrides: { [rule.id]: value } };
        expect(isDifficultySelection(selection)).toBe(true);
        expect(() => resolveDifficultyRules(normalizeDifficultySelection(selection))).not.toThrow();
      }
      for (const value of [rule.minimum - 1, rule.maximum + 1, NaN, Infinity, "100"]) {
        const selection = { profileId: "custom", overrides: { [rule.id]: value } };
        expect(isDifficultySelection(selection)).toBe(false);
        const repaired = normalizeDifficultySelection(selection);
        expect(isDifficultySelection(repaired)).toBe(true);
        expect(() => resolveDifficultyRules(repaired)).not.toThrow();
      }
    },
  );

  it("validates finite enums and only supported timer suggestions", () => {
    for (const enemyAiPolicy of ENEMY_AI_POLICIES) {
      expect(isDifficultySelection({ profileId: "custom", overrides: { enemyAiPolicy } })).toBe(true);
    }
    for (const defeatXpPenalty of DEFEAT_XP_PENALTIES) {
      expect(isDifficultySelection({ profileId: "custom", overrides: { defeatXpPenalty } })).toBe(true);
    }
    for (const timedRoundDurationSeconds of DIFFICULTY_TIMED_ROUND_DURATIONS) {
      const selection = normalizeDifficultySelection({
        profileId: "custom", overrides: { timedRoundDurationSeconds },
      });
      expect(getDifficultyTimingAdjustment(selection)).toEqual({
        durationSeconds: timedRoundDurationSeconds,
      });
    }
    expect(isDifficultySelection({
      profileId: "custom", overrides: { enemyAiPolicy: "impossible" },
    })).toBe(false);
    expect(isDifficultySelection({
      profileId: "custom", overrides: { timedRoundDurationSeconds: 1 },
    })).toBe(false);
  });

  it("omits neutral overrides and rejects overrides on a preset", () => {
    const custom = normalizeDifficultySelection({
      profileId: "custom",
      overrides: {
        ...STANDARD_DIFFICULTY_MODIFIERS,
        futureUnsupportedRule: 123,
      },
    });
    expect(custom).toEqual({ profileId: "custom", overrides: {} });
    expect(resolveDifficultyRules(custom)).toEqual(STANDARD_DIFFICULTY_RULES);
    expect(isDifficultySelection({ profileId: "legendary", overrides: { enemyHpPercent: 50 } }))
      .toBe(false);
    expect(normalizeDifficultySelection(null)).toEqual(STANDARD_DIFFICULTY_SELECTION);
    expect(() => createCampaignDifficulty({
      profileId: "custom", overrides: { enemyHpPercent: 1000 },
    })).toThrow("Invalid campaign selection");
  });

  it("compares canonical values rather than object order or neutral overrides", () => {
    expect(areDifficultySelectionsEqual(
      { profileId: "custom", overrides: { enemyHpPercent: 100, pricePercent: 90 } },
      { profileId: "custom", overrides: { pricePercent: 90 } },
    )).toBe(true);
    expect(areDifficultySelectionsEqual(
      STANDARD_DIFFICULTY_SELECTION,
      { profileId: "custom", overrides: {} },
    )).toBe(false);
  });
});

describe("once-only rule composition and bounded outcomes", () => {
  const scaleKeys: readonly (keyof DifficultyScaleLayer)[] = [
    "enemyHpMultiplier", "enemyDamageMultiplier", "encounterPressureMultiplier",
    "xpRewardMultiplier", "goldRewardMultiplier", "priceMultiplier",
  ];

  it("applies each profile and future layer exactly once", () => {
    const scale: DifficultyScaleLayer = {
      enemyHpMultiplier: 2,
      enemyDamageMultiplier: 2,
      encounterPressureMultiplier: 2,
      xpRewardMultiplier: 2,
      goldRewardMultiplier: 2,
      priceMultiplier: 2,
    };
    const rules = resolveDifficultyRules({ profileId: "legendary" }, scale);
    expect(rules.enemyHpMultiplier).toBe(2.8);
    expect(rules.enemyDamageMultiplier).toBe(2.6);
    expect(scaleReward(100, "xp", rules)).toBe(240);
    expect(scaleReward(100, "gold", rules)).toBe(240);
    expect(scaleCost(100, rules)).toBe(240);
    expect(scaleEnemyDamage(100, rules)).toBe(260);
    expect(scale).toEqual({
      enemyHpMultiplier: 2, enemyDamageMultiplier: 2,
      encounterPressureMultiplier: 2, xpRewardMultiplier: 2,
      goldRewardMultiplier: 2, priceMultiplier: 2,
    });
  });

  it.each(scaleKeys)("rejects an invalid $0 scale instead of silently falling back", (key) => {
    for (const value of [0, -1, 0.249, 4.001, NaN, Infinity]) {
      expect(() => resolveDifficultyRules(STANDARD_DIFFICULTY_SELECTION, { [key]: value }))
        .toThrow("Scale multiplier");
    }
    expect(() => resolveDifficultyRules(STANDARD_DIFFICULTY_SELECTION, { [key]: 0.25 }))
      .not.toThrow();
    expect(() => resolveDifficultyRules(STANDARD_DIFFICULTY_SELECTION, { [key]: 4 }))
      .not.toThrow();
  });

  it.each(DIFFICULTY_PROFILES)("preserves all $name enemy definitions and HP bounds", (profile) => {
    const rules = resolveDifficultyRules(normalizeDifficultySelection({ profileId: profile.id }));
    for (const monster of ALL_MONSTERS) {
      const before = JSON.stringify(monster);
      const runtime = scaleEnemy(monster, rules);
      expect(runtime).not.toBe(monster);
      expect(runtime.hp).toBeGreaterThanOrEqual(1);
      expect(runtime.attackBonus).toBe(monster.attackBonus);
      expect(runtime.damageDie).toBe(monster.damageDie);
      expect(runtime.damageCount).toBe(monster.damageCount);
      expect(runtime.xpReward).toBe(monster.xpReward);
      expect(JSON.stringify(monster)).toBe(before);
      if (profile.id === "standard") expect(runtime).toEqual(monster);
    }
  });

  it.each(DIFFICULTY_PROFILES)("clamps $name encounter pressure after every layer", (profile) => {
    const selection = normalizeDifficultySelection({ profileId: profile.id });
    const rules = resolveDifficultyRules(selection, { encounterPressureMultiplier: 4 });
    expect(getDifficultyEncounterRate(0.15, rules, 10, 10, 10)).toBe(0.15);
    expect(getDifficultyEncounterRate(0, rules, 10, 10)).toBe(0);
    expect(getDifficultyEncounterRate(0.08, rules, 0)).toBe(0);
    for (const base of [0.001, 0.02, 0.08, 0.15]) {
      expect(getDifficultyEncounterRate(base, rules, 1.5, 0.8)).toBeLessThanOrEqual(0.15);
    }
    expect(() => getEffectiveEncounterRate(0.1, NaN)).toThrow("finite");
  });

  it("uses exact Standard rounding, zero-price semantics and social limits", () => {
    for (let amount = 0; amount <= 1000; amount += 1) {
      expect(scaleReward(amount, "xp", STANDARD_DIFFICULTY_RULES)).toBe(amount);
      expect(scaleReward(amount, "gold", STANDARD_DIFFICULTY_RULES)).toBe(amount);
      expect(scaleSaleValue(amount, STANDARD_DIFFICULTY_RULES)).toBe(amount);
      expect(scaleCost(amount, STANDARD_DIFFICULTY_RULES, 0.35, 1))
        .toBe(Math.max(1, Math.floor(amount * 0.65)));
      expect(scaleCost(amount, STANDARD_DIFFICULTY_RULES, -0.25, 1))
        .toBe(Math.max(1, Math.floor(amount * 1.25)));
    }
    expect(scaleCost(0, STANDARD_DIFFICULTY_RULES)).toBe(0);
    expect(scaleCost(100, STANDARD_DIFFICULTY_RULES, 1)).toBe(65);
    expect(scaleCost(100, STANDARD_DIFFICULTY_RULES, -1)).toBe(125);
    expect(() => scaleReward(-1, "xp", STANDARD_DIFFICULTY_RULES)).toThrow("Invalid base");
    expect(() => scaleCost(100, STANDARD_DIFFICULTY_RULES, NaN)).toThrow("social");
  });

  it("preserves every odd-value historical floor for neutral future scales and social adjustments", () => {
    const neutralLayers = [
      resolveDifficultyRules({ profileId: "standard" }, { priceMultiplier: 1 }),
      resolveDifficultyRules({ profileId: "custom", overrides: {} }, { priceMultiplier: 1 }),
      resolveDifficultyRules(
        { profileId: "custom", overrides: { pricePercent: 125 } },
        { priceMultiplier: 0.8 },
      ),
    ];
    for (const rules of neutralLayers) {
      expect(rules.priceMultiplier).toBe(1);
      for (let amount = 0; amount <= 1000; amount += 1) {
        for (const discount of [-0.25, -0.1, 0, 0.05, 0.1, 0.25, 0.35]) {
          for (const minimum of [0, 1] as const) {
            expect(scaleCost(amount, rules, discount, minimum))
              .toBe(Math.max(minimum, Math.floor(amount * (1 - discount))));
          }
        }
      }
    }
  });

  it.each(DIFFICULTY_PROFILES)("cannot create $name buy/sell reward arbitrage", (profile) => {
    const rules = resolveDifficultyRules(normalizeDifficultySelection({ profileId: profile.id }));
    for (let cost = 1; cost < 500; cost += 1) {
      expect(scaleSaleValue(Math.floor(cost / 2), rules))
        .toBeLessThanOrEqual(scaleCost(cost, rules, 0.35, 1));
      expect(scaleReward(cost, "gold", rules)).toBeGreaterThanOrEqual(0);
      expect(scaleEnemyDamage(0, rules)).toBe(0);
    }
  });
});

describe("campaign normalization and honest eligibility", () => {
  it.each(DIFFICULTY_PROFILES)("round-trips a fresh $name campaign without derived modifiers", (profile) => {
    const selection = normalizeDifficultySelection({ profileId: profile.id });
    const state = createCampaignDifficulty(selection);
    expect(normalizeCampaignDifficulty(JSON.parse(JSON.stringify(state)))).toEqual(state);
    expect(Object.keys(state).sort()).toEqual([
      "changeCount", "history", "initialProfileId", "selection",
    ]);
    expect(getDifficultyAchievementEligibility(state).generalAchievements).toBe(true);
  });

  it("migrates every older schema to Standard, never retroactive challenge credit", () => {
    for (let version = 0; version <= 18; version += 1) {
      const state = normalizeCampaignDifficulty({
        selection: { profileId: "legendary" },
      }, version);
      expect(state).toEqual(createCampaignDifficulty());
      expect(isDifficultyChallengeEligible(state, "veteran")).toBe(false);
    }
  });

  it("never infers preset continuity from missing or repaired modern metadata", () => {
    for (const malformed of [null, undefined, [], {}, {
      selection: { profileId: "legendary" }, initialProfileId: "legendary",
      changeCount: 0, history: "corrupt",
    }, {
      selection: { profileId: "legendary" }, initialProfileId: "story",
      changeCount: 0, history: [],
    }]) {
      const state = normalizeCampaignDifficulty(malformed);
      expect(state.changeCount).toBeGreaterThanOrEqual(1);
      expect(isDifficultyChallengeEligible(state, "legendary")).toBe(false);
    }
  });

  it("keeps challenge credit separate from Custom identity and accessibility", () => {
    const veteran = createCampaignDifficulty({ profileId: "veteran" });
    const legendary = createCampaignDifficulty({ profileId: "legendary" });
    const custom = createCampaignDifficulty({ profileId: "custom", overrides: {} });
    expect(isDifficultyChallengeEligible(veteran, "veteran")).toBe(true);
    expect(isDifficultyChallengeEligible(veteran, "legendary")).toBe(false);
    expect(isDifficultyChallengeEligible(legendary, "veteran")).toBe(true);
    expect(isDifficultyChallengeEligible(legendary, "legendary")).toBe(true);
    expect(isDifficultyChallengeEligible(custom, "veteran")).toBe(false);
    expect(getDifficultyAchievementEligibility(legendary)).not.toHaveProperty("accessibility");
  });

  it("cannot restore unchanged-preset credit through Custom round trips or truncated history", () => {
    const state = createCampaignDifficulty({ profileId: "legendary" });
    state.changeCount = 42;
    state.history = Array.from({ length: 42 }, (_, index) => ({
      sequence: index + 1,
      timeStep: index,
      cause: "playerConfirmed" as const,
      from: index % 2 === 0
        ? { profileId: "legendary" as const }
        : { profileId: "custom" as const, overrides: { enemyHpPercent: 140 } },
      to: index % 2 === 0
        ? { profileId: "custom" as const, overrides: { enemyHpPercent: 140 } }
        : { profileId: "legendary" as const },
    }));
    const normalized = normalizeCampaignDifficulty(state);
    expect(normalized.history).toHaveLength(DIFFICULTY_HISTORY_LIMIT);
    expect(normalized.changeCount).toBe(42);
    expect(isDifficultyChallengeEligible(normalized, "legendary")).toBe(false);
    normalized.history = [];
    expect(isDifficultyChallengeEligible(normalizeCampaignDifficulty(normalized), "legendary"))
      .toBe(false);
  });
});
