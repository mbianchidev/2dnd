import { debugLog } from "../config";
import {
  CUSTOM_NUMERIC_DIFFICULTY_RULES,
  DEFEAT_XP_PENALTIES,
  DIFFICULTY_TIMED_ROUND_DURATIONS,
  ENEMY_AI_POLICIES,
  STANDARD_DIFFICULTY_MODIFIERS,
  STANDARD_DIFFICULTY_SELECTION,
  isDifficultyProfileId,
} from "../data/difficulty";
import type {
  CustomDifficultyOverrides,
  DifficultyProfileId,
  DifficultySelection,
} from "../data/difficulty";

export const DIFFICULTY_SAVE_VERSION = 19;
export const DIFFICULTY_HISTORY_LIMIT = 20;

export interface DifficultyChangeCause {
  readonly sequence: number;
  readonly timeStep: number;
  readonly cause: "playerConfirmed";
  readonly from: DifficultySelection;
  readonly to: DifficultySelection;
}

export interface CampaignDifficultyState {
  selection: DifficultySelection;
  initialProfileId: DifficultyProfileId;
  changeCount: number;
  history: DifficultyChangeCause[];
}

interface SelectionNormalization {
  selection: DifficultySelection;
  repaired: boolean;
}

type MutableDifficultyOverrides = {
  -readonly [Key in keyof CustomDifficultyOverrides]: CustomDifficultyOverrides[Key];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function repairSelection(value: unknown): SelectionNormalization {
  if (!isRecord(value) || !isDifficultyProfileId(value.profileId)) {
    return { selection: STANDARD_DIFFICULTY_SELECTION, repaired: true };
  }
  if (value.profileId !== "custom") {
    return {
      selection: { profileId: value.profileId },
      repaired: value.overrides !== undefined,
    };
  }
  if (value.overrides === undefined) {
    return { selection: { profileId: "custom", overrides: {} }, repaired: false };
  }
  if (!isRecord(value.overrides)) {
    return { selection: { profileId: "custom", overrides: {} }, repaired: true };
  }
  const candidate = value.overrides;
  const overrides: MutableDifficultyOverrides = {};
  const knownKeys = new Set<string>([
    ...CUSTOM_NUMERIC_DIFFICULTY_RULES.map((rule) => rule.id),
    "enemyAiPolicy", "defeatXpPenalty", "timedRoundDurationSeconds",
  ]);
  let repaired = Object.keys(candidate).some((key) => !knownKeys.has(key));
  for (const rule of CUSTOM_NUMERIC_DIFFICULTY_RULES) {
    const raw = candidate[rule.id];
    if (raw === undefined) continue;
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      repaired = true;
      continue;
    }
    const bounded = Math.min(rule.maximum, Math.max(rule.minimum, raw));
    const normalized = rule.minimum
      + Math.round((bounded - rule.minimum) / rule.step) * rule.step;
    repaired ||= normalized !== raw;
    if (normalized !== STANDARD_DIFFICULTY_MODIFIERS[rule.id]) {
      overrides[rule.id] = normalized;
    }
  }
  const ai = ENEMY_AI_POLICIES.find((entry) => entry === candidate.enemyAiPolicy);
  if (ai) {
    if (ai !== "standard") overrides.enemyAiPolicy = ai;
  } else if (candidate.enemyAiPolicy !== undefined) repaired = true;
  const xp = DEFEAT_XP_PENALTIES.find((entry) => entry === candidate.defeatXpPenalty);
  if (xp) {
    if (xp !== "currentLevel") overrides.defeatXpPenalty = xp;
  } else if (candidate.defeatXpPenalty !== undefined) repaired = true;
  const duration = DIFFICULTY_TIMED_ROUND_DURATIONS.find(
    (entry) => entry === candidate.timedRoundDurationSeconds,
  );
  if (duration) overrides.timedRoundDurationSeconds = duration;
  else if (candidate.timedRoundDurationSeconds !== undefined) repaired = true;
  return { selection: { profileId: "custom", overrides }, repaired };
}

/** Validate runtime input; save repair is intentionally a separate path. */
export function isDifficultySelection(value: unknown): value is DifficultySelection {
  return !repairSelection(value).repaired;
}

/** Canonicalize bounded Custom overrides without persisting neutral values. */
export function normalizeDifficultySelection(value: unknown): DifficultySelection {
  const result = repairSelection(value);
  if (result.repaired) debugLog("[difficulty] Repaired invalid profile or Custom bounds.");
  return result.selection;
}

export function areDifficultySelectionsEqual(
  left: DifficultySelection,
  right: DifficultySelection,
): boolean {
  return JSON.stringify(repairSelection(left).selection)
    === JSON.stringify(repairSelection(right).selection);
}

/** Fresh campaigns own only canonical selections and continuity metadata. */
export function createCampaignDifficulty(
  selection: DifficultySelection = STANDARD_DIFFICULTY_SELECTION,
): CampaignDifficultyState {
  const normalized = repairSelection(selection);
  if (normalized.repaired) throw new Error("[difficulty] Invalid campaign selection.");
  return {
    selection: normalized.selection,
    initialProfileId: selection.profileId,
    changeCount: 0,
    history: [],
  };
}

/** Repair from unknown without restoring lost preset challenge continuity. */
export function normalizeCampaignDifficulty(
  value: unknown,
  sourceVersion: number = DIFFICULTY_SAVE_VERSION,
): CampaignDifficultyState {
  if (sourceVersion < DIFFICULTY_SAVE_VERSION) return createCampaignDifficulty();
  if (!isRecord(value)) {
    debugLog("[difficulty] Missing campaign rules; recovered Standard without challenge continuity.");
    return { ...createCampaignDifficulty(), changeCount: 1 };
  }
  const normalized = repairSelection(value.selection);
  const initialValid = isDifficultyProfileId(value.initialProfileId);
  const initialProfileId: DifficultyProfileId = isDifficultyProfileId(value.initialProfileId)
    ? value.initialProfileId : "standard";
  const countValid = isNonnegativeInteger(value.changeCount);
  let changeCount: number = isNonnegativeInteger(value.changeCount) ? value.changeCount : 1;
  let repaired = normalized.repaired || !initialValid || !countValid;
  const history: DifficultyChangeCause[] = [];
  if (Array.isArray(value.history)) {
    for (const candidate of value.history.slice(-DIFFICULTY_HISTORY_LIMIT)) {
      if (!isRecord(candidate)) {
        repaired = true;
        continue;
      }
      const from = repairSelection(candidate.from);
      const to = repairSelection(candidate.to);
      const previous = history[history.length - 1];
      if (
        !isNonnegativeInteger(candidate.sequence)
        || candidate.sequence < 1
        || !isNonnegativeInteger(candidate.timeStep)
        || candidate.cause !== "playerConfirmed"
        || from.repaired
        || to.repaired
        || areDifficultySelectionsEqual(from.selection, to.selection)
        || (previous !== undefined && candidate.sequence <= previous.sequence)
      ) {
        repaired = true;
        continue;
      }
      if (previous && !areDifficultySelectionsEqual(previous.to, from.selection)) {
        repaired = true;
      }
      history.push({
        sequence: candidate.sequence,
        timeStep: candidate.timeStep,
        cause: "playerConfirmed",
        from: from.selection,
        to: to.selection,
      });
      changeCount = Math.max(changeCount, candidate.sequence);
    }
  } else repaired = true;
  const latest = history[history.length - 1];
  if (latest && !areDifficultySelectionsEqual(latest.to, normalized.selection)) {
    repaired = true;
  }
  if (initialProfileId !== normalized.selection.profileId || repaired) {
    changeCount = Math.max(1, changeCount);
  }
  if (repaired) debugLog("[difficulty] Repaired campaign rule history; preset continuity unavailable.");
  return {
    selection: normalized.selection,
    initialProfileId,
    changeCount,
    history,
  };
}
