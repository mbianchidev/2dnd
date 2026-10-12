import {
  CUSTOM_NUMERIC_DIFFICULTY_RULES,
  DEFEAT_XP_PENALTIES,
  DIFFICULTY_PROFILE_IDS,
  DIFFICULTY_TIMED_ROUND_DURATIONS,
  ENEMY_AI_POLICIES,
} from "../data/difficulty";
import type { CustomDifficultyOverrides, DifficultyModifiers, DifficultySelection } from "../data/difficulty";
import { normalizeDifficultySelection, resolveDifficultyModifiers } from "./difficulty";

export type DifficultyEditorRuleId = keyof DifficultyModifiers;

function cycleValue<T>(
  options: readonly T[],
  current: T,
  direction: -1 | 1,
): T {
  const index = options.indexOf(current);
  return options[(Math.max(0, index) + direction + options.length) % options.length]!;
}

export function cycleDifficultyProfile(
  selection: DifficultySelection,
  direction: -1 | 1,
  rememberedCustom: CustomDifficultyOverrides = {},
): DifficultySelection {
  const profileId = cycleValue(DIFFICULTY_PROFILE_IDS, selection.profileId, direction);
  return profileId === "custom"
    ? normalizeDifficultySelection({ profileId, overrides: rememberedCustom })
    : { profileId };
}

/** Preview edits never mutate the selection, campaign, or canonical definitions. */
export function adjustCustomDifficultyRule(
  selection: DifficultySelection,
  id: DifficultyEditorRuleId,
  direction: -1 | 1,
): DifficultySelection {
  if (selection.profileId !== "custom") {
    throw new Error("[difficulty] Select Custom before adjusting its rules.");
  }
  const current = resolveDifficultyModifiers(selection);
  const numeric = CUSTOM_NUMERIC_DIFFICULTY_RULES.find((rule) => rule.id === id);
  if (numeric) {
    const value = Math.max(numeric.minimum, Math.min(numeric.maximum,
      current[numeric.id] + numeric.step * direction));
    return normalizeDifficultySelection({
      profileId: "custom", overrides: { ...selection.overrides, [numeric.id]: value },
    });
  }
  if (id === "enemyAiPolicy") {
    return normalizeDifficultySelection({
      profileId: "custom",
      overrides: {
        ...selection.overrides,
        enemyAiPolicy: cycleValue(ENEMY_AI_POLICIES, current.enemyAiPolicy, direction),
      },
    });
  }
  if (id === "defeatXpPenalty") {
    return normalizeDifficultySelection({
      profileId: "custom",
      overrides: {
        ...selection.overrides,
        defeatXpPenalty: cycleValue(DEFEAT_XP_PENALTIES, current.defeatXpPenalty, direction),
      },
    });
  }
  if (id === "timedRoundDurationSeconds") {
    const durations = [undefined, ...DIFFICULTY_TIMED_ROUND_DURATIONS];
    const duration = cycleValue(durations, current.timedRoundDurationSeconds, direction);
    const overrides = { ...selection.overrides };
    delete overrides.timedRoundDurationSeconds;
    return normalizeDifficultySelection({
      profileId: "custom",
      overrides: duration === undefined ? overrides : { ...overrides, timedRoundDurationSeconds: duration },
    });
  }
  throw new Error(`[difficulty] Unsupported Custom control: ${id}`);
}
