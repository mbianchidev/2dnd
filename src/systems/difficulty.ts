import {
  CUSTOM_NUMERIC_DIFFICULTY_RULES,
  STANDARD_DIFFICULTY_SELECTION,
  getDifficultyProfile,
} from "../data/difficulty";
import type {
  DefeatXpPenalty,
  DifficultySelection,
  DifficultyTimedRoundDurationSeconds,
  EnemyAiPolicy,
} from "../data/difficulty";
import type { Monster } from "../data/monsters";
import { isDifficultySelection } from "./difficultyState";
import type { CampaignDifficultyState } from "./difficultyState";
import { getEffectiveEncounterRate } from "./encounterRate";

export * from "./difficultyState";
export type {
  CustomDifficultyOverrides,
  DifficultyProfileId,
  DifficultyPresetId,
  DifficultySelection,
} from "../data/difficulty";

/** Optional future scaling composes once, after the canonical profile. */
export interface DifficultyScaleLayer {
  readonly enemyHpMultiplier?: number;
  readonly enemyDamageMultiplier?: number;
  readonly encounterPressureMultiplier?: number;
  readonly xpRewardMultiplier?: number;
  readonly goldRewardMultiplier?: number;
  readonly priceMultiplier?: number;
}

export interface DifficultyRules {
  readonly enemyHpMultiplier: number;
  readonly enemyDamageMultiplier: number;
  readonly enemyAccuracyBonus: number;
  readonly enemyAiPolicy: EnemyAiPolicy;
  readonly encounterPressureMultiplier: number;
  readonly fleeDcAdjustment: number;
  readonly skillCheckAssistance: number;
  readonly defeatGoldRetention: number;
  readonly defeatXpPenalty: DefeatXpPenalty;
  readonly defeatRecoveryMultiplier: number;
  readonly priceMultiplier: number;
  readonly xpRewardMultiplier: number;
  readonly goldRewardMultiplier: number;
}

export interface DifficultyTimingAdjustment {
  readonly durationSeconds?: DifficultyTimedRoundDurationSeconds;
}

export interface DifficultyEffectPreview {
  readonly id: string;
  readonly label: string;
  readonly value: string;
}

export interface DifficultyAchievementEligibility {
  readonly generalAchievements: true;
  readonly challengeProfile: "veteran" | "legendary" | null;
  readonly reason: string;
}

function composeMultiplier(base: number, scale: number | undefined): number {
  const layer = scale ?? 1;
  if (!Number.isFinite(layer) || layer < 0.25 || layer > 4) {
    throw new Error(`[difficulty] Scale multiplier must be between 0.25 and 4: ${layer}`);
  }
  return base * layer;
}

/** Derive immutable mechanics. No preference, scene, or mutable definition is read. */
export function resolveDifficultyRules(
  selection: DifficultySelection = STANDARD_DIFFICULTY_SELECTION,
  scale: DifficultyScaleLayer = {},
): Readonly<DifficultyRules> {
  if (!isDifficultySelection(selection)) {
    throw new Error("[difficulty] Invalid profile or Custom modifier.");
  }
  const modifiers = {
    ...getDifficultyProfile(selection.profileId).modifiers,
    ...(selection.profileId === "custom" ? selection.overrides : {}),
  };
  return Object.freeze({
    enemyHpMultiplier: composeMultiplier(modifiers.enemyHpPercent / 100, scale.enemyHpMultiplier),
    enemyDamageMultiplier: composeMultiplier(modifiers.enemyDamagePercent / 100, scale.enemyDamageMultiplier),
    enemyAccuracyBonus: modifiers.enemyAccuracyBonus,
    enemyAiPolicy: modifiers.enemyAiPolicy,
    encounterPressureMultiplier: composeMultiplier(modifiers.encounterPressurePercent / 100, scale.encounterPressureMultiplier),
    fleeDcAdjustment: modifiers.fleeDcAdjustment,
    skillCheckAssistance: modifiers.skillCheckAssistance,
    defeatGoldRetention: 1 - modifiers.defeatGoldLossPercent / 100,
    defeatXpPenalty: modifiers.defeatXpPenalty,
    defeatRecoveryMultiplier: modifiers.defeatRecoveryPercent / 100,
    priceMultiplier: composeMultiplier(modifiers.pricePercent / 100, scale.priceMultiplier),
    xpRewardMultiplier: composeMultiplier(modifiers.xpRewardPercent / 100, scale.xpRewardMultiplier),
    goldRewardMultiplier: composeMultiplier(modifiers.goldRewardPercent / 100, scale.goldRewardMultiplier),
  });
}

export const STANDARD_DIFFICULTY_RULES = resolveDifficultyRules();

/** Optional wallet/adapter inputs explicitly retain neutral legacy behavior. */
export function getCampaignDifficultyRules(
  campaign: { readonly difficulty?: CampaignDifficultyState },
  scale?: DifficultyScaleLayer,
): Readonly<DifficultyRules> {
  return resolveDifficultyRules(
    campaign.difficulty?.selection ?? STANDARD_DIFFICULTY_SELECTION,
    scale,
  );
}

function scaleQuantity(amount: number, multiplier: number, minimum = 0): number {
  if (!Number.isFinite(amount) || amount < 0 || amount > Number.MAX_SAFE_INTEGER) {
    throw new Error(`[difficulty] Invalid base quantity: ${amount}`);
  }
  return Math.max(minimum, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(amount * multiplier)));
}

/** Clone runtime enemy HP only; accuracy never leaks into initiative or saves. */
export function scaleEnemy(monster: Monster, rules: DifficultyRules): Monster {
  return { ...monster, hp: scaleQuantity(monster.hp, rules.enemyHpMultiplier, 1) };
}

/** Apply after status/synergy damage and before elemental or shield reductions. */
export function scaleEnemyDamage(amount: number, rules: DifficultyRules): number {
  return scaleQuantity(amount, rules.enemyDamageMultiplier);
}

export function scaleReward(
  amount: number,
  kind: "xp" | "gold",
  rules: DifficultyRules,
): number {
  return scaleQuantity(amount, kind === "xp" ? rules.xpRewardMultiplier : rules.goldRewardMultiplier);
}

/** Compose prices with the existing final social discount/surcharge bounds. */
export function scaleCost(
  amount: number,
  rules: DifficultyRules,
  socialDiscount = 0,
  minimum: 0 | 1 = 0,
): number {
  if (!Number.isFinite(socialDiscount)) {
    throw new Error("[difficulty] Invalid social price adjustment.");
  }
  const adjustment = Math.min(0.35, Math.max(-0.25, socialDiscount));
  return scaleQuantity(amount, rules.priceMultiplier * (1 - adjustment), minimum);
}

/** Selling follows prices, not gold-reward bonuses, to avoid buy/sell arbitrage. */
export function scaleSaleValue(amount: number, rules: DifficultyRules): number {
  return scaleQuantity(amount, rules.priceMultiplier);
}

export function getDifficultyEncounterRate(
  baseRate: number,
  rules: DifficultyRules,
  ...environmentMultipliers: number[]
): number {
  return getEffectiveEncounterRate(
    baseRate,
    ...environmentMultipliers,
    rules.encounterPressureMultiplier,
  );
}

/** A suggestion for #164's opt-in consumer, never permission to enable timing. */
export function getDifficultyTimingAdjustment(
  selection: DifficultySelection,
): DifficultyTimingAdjustment {
  if (!isDifficultySelection(selection)) throw new Error("[difficulty] Invalid timing selection.");
  const durationSeconds = selection.profileId === "custom"
    ? selection.overrides?.timedRoundDurationSeconds
    : getDifficultyProfile(selection.profileId).modifiers.timedRoundDurationSeconds;
  return durationSeconds === undefined ? {} : { durationSeconds };
}

export function getDifficultyAchievementEligibility(
  state: CampaignDifficultyState,
): DifficultyAchievementEligibility {
  const profileId = state.selection.profileId;
  if (state.changeCount > 0 || state.initialProfileId !== profileId) {
    return {
      generalAchievements: true,
      challengeProfile: null,
      reason: "Rules changed or repaired. General and previously earned achievements remain available.",
    };
  }
  if (profileId === "veteran" || profileId === "legendary") {
    return {
      generalAchievements: true,
      challengeProfile: profileId,
      reason: `Unchanged ${getDifficultyProfile(profileId).name} campaign; preset challenge credit available.`,
    };
  }
  return {
    generalAchievements: true,
    challengeProfile: null,
    reason: profileId === "custom"
      ? "Custom rules do not claim preset challenge credit. General achievements remain available."
      : "General achievements remain available on this profile.",
  };
}

export function isDifficultyChallengeEligible(
  state: CampaignDifficultyState,
  minimum: "veteran" | "legendary",
): boolean {
  const profile = getDifficultyAchievementEligibility(state).challengeProfile;
  return profile === "legendary" || (minimum === "veteran" && profile === "veteran");
}

export function getDifficultyEffectPreview(
  selection: DifficultySelection,
): readonly DifficultyEffectPreview[] {
  if (!isDifficultySelection(selection)) throw new Error("[difficulty] Invalid preview selection.");
  const profile = getDifficultyProfile(selection.profileId);
  const modifiers = {
    ...profile.modifiers,
    ...(selection.profileId === "custom" ? selection.overrides : {}),
  };
  return [
    ...CUSTOM_NUMERIC_DIFFICULTY_RULES.map((rule) => ({
      id: rule.id,
      label: rule.label,
      value: `${modifiers[rule.id]}${rule.unit}`,
    })),
    { id: "enemyAiPolicy", label: "Enemy tactics", value: modifiers.enemyAiPolicy },
    {
      id: "defeatXpPenalty",
      label: "Knockout XP penalty",
      value: modifiers.defeatXpPenalty === "none" ? "None" : "Current-level progress",
    },
    {
      id: "timedRoundDurationSeconds",
      label: "Optional timer suggestion",
      value: modifiers.timedRoundDurationSeconds === undefined
        ? "No adjustment; timing stays opt-in"
        : `${modifiers.timedRoundDurationSeconds}s, only if timing is already enabled`,
    },
  ];
}
