export const DIFFICULTY_PROFILE_IDS = [
  "story", "standard", "veteran", "legendary", "custom",
] as const;

export type DifficultyProfileId = (typeof DIFFICULTY_PROFILE_IDS)[number];
export type DifficultyPresetId = Exclude<DifficultyProfileId, "custom">;
export type EnemyAiPolicy = "gentle" | "standard" | "tactical" | "relentless";
export type DefeatXpPenalty = "currentLevel" | "none";
export type DifficultyTimedRoundDurationSeconds = 15 | 30 | 45 | 60 | 90;

export interface DifficultyModifiers {
  readonly enemyHpPercent: number;
  readonly enemyDamagePercent: number;
  readonly enemyAccuracyBonus: number;
  readonly enemyAiPolicy: EnemyAiPolicy;
  readonly encounterPressurePercent: number;
  readonly fleeDcAdjustment: number;
  readonly skillCheckAssistance: number;
  readonly defeatGoldLossPercent: number;
  readonly defeatXpPenalty: DefeatXpPenalty;
  readonly defeatRecoveryPercent: number;
  readonly pricePercent: number;
  readonly xpRewardPercent: number;
  readonly goldRewardPercent: number;
  readonly timedRoundDurationSeconds?: DifficultyTimedRoundDurationSeconds;
}

export type CustomDifficultyOverrides = Partial<DifficultyModifiers>;

export type DifficultySelection =
  | {
    readonly profileId: DifficultyPresetId;
    readonly overrides?: never;
  }
  | {
    readonly profileId: "custom";
    readonly overrides?: CustomDifficultyOverrides;
  };

export interface DifficultyProfileDefinition {
  readonly id: DifficultyProfileId;
  readonly name: string;
  readonly description: string;
  readonly modifiers: Readonly<DifficultyModifiers>;
}

export const STANDARD_DIFFICULTY_SELECTION: DifficultySelection =
  Object.freeze({ profileId: "standard" });

export const STANDARD_DIFFICULTY_MODIFIERS: Readonly<DifficultyModifiers> =
  Object.freeze({
    enemyHpPercent: 100,
    enemyDamagePercent: 100,
    enemyAccuracyBonus: 0,
    enemyAiPolicy: "standard",
    encounterPressurePercent: 100,
    fleeDcAdjustment: 0,
    skillCheckAssistance: 0,
    defeatGoldLossPercent: 30,
    defeatXpPenalty: "currentLevel",
    defeatRecoveryPercent: 50,
    pricePercent: 100,
    xpRewardPercent: 100,
    goldRewardPercent: 100,
  });

export const DIFFICULTY_PROFILES: readonly DifficultyProfileDefinition[] =
  Object.freeze([
    Object.freeze({
      id: "story",
      name: "Story",
      description: "Gentler enemies, assisted checks, and loss-free recovery.",
      modifiers: Object.freeze({
        ...STANDARD_DIFFICULTY_MODIFIERS,
        enemyHpPercent: 75,
        enemyDamagePercent: 75,
        enemyAccuracyBonus: -2,
        enemyAiPolicy: "gentle",
        encounterPressurePercent: 70,
        fleeDcAdjustment: -2,
        skillCheckAssistance: 2,
        defeatGoldLossPercent: 0,
        defeatXpPenalty: "none",
        defeatRecoveryPercent: 100,
        pricePercent: 90,
        xpRewardPercent: 120,
        goldRewardPercent: 120,
        timedRoundDurationSeconds: 60,
      }),
    }),
    Object.freeze({
      id: "standard",
      name: "Standard",
      description: "The original rules, exactly. No mechanical adjustments.",
      modifiers: STANDARD_DIFFICULTY_MODIFIERS,
    }),
    Object.freeze({
      id: "veteran",
      name: "Veteran",
      description: "Stronger foes and tactical targeting, with greater rewards.",
      modifiers: Object.freeze({
        ...STANDARD_DIFFICULTY_MODIFIERS,
        enemyHpPercent: 120,
        enemyDamagePercent: 115,
        enemyAccuracyBonus: 1,
        enemyAiPolicy: "tactical",
        encounterPressurePercent: 110,
        fleeDcAdjustment: 1,
        defeatGoldLossPercent: 35,
        pricePercent: 110,
        xpRewardPercent: 110,
        goldRewardPercent: 110,
        timedRoundDurationSeconds: 30,
      }),
    }),
    Object.freeze({
      id: "legendary",
      name: "Legendary",
      description: "Relentless foes and higher stakes, without locking story paths.",
      modifiers: Object.freeze({
        ...STANDARD_DIFFICULTY_MODIFIERS,
        enemyHpPercent: 140,
        enemyDamagePercent: 130,
        enemyAccuracyBonus: 2,
        enemyAiPolicy: "relentless",
        encounterPressurePercent: 120,
        fleeDcAdjustment: 2,
        defeatGoldLossPercent: 40,
        pricePercent: 120,
        xpRewardPercent: 120,
        goldRewardPercent: 120,
        timedRoundDurationSeconds: 15,
      }),
    }),
    Object.freeze({
      id: "custom",
      name: "Custom",
      description: "Bounded rules based on Standard; no preset challenge credit.",
      modifiers: STANDARD_DIFFICULTY_MODIFIERS,
    }),
  ]);

export type NumericDifficultyRuleId = Exclude<
  keyof DifficultyModifiers,
  "enemyAiPolicy" | "defeatXpPenalty" | "timedRoundDurationSeconds"
>;

export interface NumericDifficultyRuleDefinition {
  readonly id: NumericDifficultyRuleId;
  readonly label: string;
  readonly minimum: number;
  readonly maximum: number;
  readonly step: number;
  readonly unit: "%" | "";
}

export const CUSTOM_NUMERIC_DIFFICULTY_RULES:
readonly NumericDifficultyRuleDefinition[] = Object.freeze([
  { id: "enemyHpPercent", label: "Enemy HP", minimum: 50, maximum: 200, step: 5, unit: "%" },
  { id: "enemyDamagePercent", label: "Enemy damage", minimum: 50, maximum: 175, step: 5, unit: "%" },
  { id: "enemyAccuracyBonus", label: "Enemy accuracy", minimum: -3, maximum: 3, step: 1, unit: "" },
  { id: "encounterPressurePercent", label: "Encounter pressure", minimum: 50, maximum: 150, step: 5, unit: "%" },
  { id: "fleeDcAdjustment", label: "Flee DC adjustment", minimum: -3, maximum: 3, step: 1, unit: "" },
  { id: "skillCheckAssistance", label: "Non-combat assistance", minimum: 0, maximum: 4, step: 1, unit: "" },
  { id: "defeatGoldLossPercent", label: "Defeat gold loss", minimum: 0, maximum: 50, step: 5, unit: "%" },
  { id: "defeatRecoveryPercent", label: "Defeat HP/MP recovery", minimum: 50, maximum: 100, step: 10, unit: "%" },
  { id: "pricePercent", label: "Prices and fees", minimum: 75, maximum: 150, step: 5, unit: "%" },
  { id: "xpRewardPercent", label: "XP rewards", minimum: 75, maximum: 150, step: 5, unit: "%" },
  { id: "goldRewardPercent", label: "Gold rewards", minimum: 75, maximum: 150, step: 5, unit: "%" },
]);

export const ENEMY_AI_POLICIES: readonly EnemyAiPolicy[] =
  Object.freeze(["gentle", "standard", "tactical", "relentless"]);
export const DEFEAT_XP_PENALTIES: readonly DefeatXpPenalty[] =
  Object.freeze(["currentLevel", "none"]);
export const DIFFICULTY_TIMED_ROUND_DURATIONS:
readonly DifficultyTimedRoundDurationSeconds[] =
  Object.freeze([15, 30, 45, 60, 90]);

export function isDifficultyProfileId(value: unknown): value is DifficultyProfileId {
  return DIFFICULTY_PROFILE_IDS.some((id) => id === value);
}

export function getDifficultyProfile(
  profileId: DifficultyProfileId,
): DifficultyProfileDefinition {
  const profile = DIFFICULTY_PROFILES.find((entry) => entry.id === profileId);
  if (!profile) throw new Error(`[difficulty] Unknown profile: ${profileId}`);
  return profile;
}
