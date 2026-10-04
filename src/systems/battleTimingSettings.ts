import {
  TIMED_ROUND_DURATIONS,
  type BattleTimingAdjustment,
  type BattleTimingSettings,
  type TimedRoundDurationSeconds,
} from "../data/battleTiming";

export function createBattleTimingSettings(): BattleTimingSettings {
  return { mode: "standard", durationSeconds: 30, timeoutAction: "defend" };
}

export function isTimedRoundDuration(value: unknown): value is TimedRoundDurationSeconds {
  return typeof value === "number"
    && TIMED_ROUND_DURATIONS.some((duration) => duration === value);
}

/** Repair configuration without ever treating a malformed mode as an opt-in. */
export function normalizeBattleTimingSettings(value: unknown): BattleTimingSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return createBattleTimingSettings();
  }
  const mode = "mode" in value && value.mode === "timed" ? "timed" : "standard";
  const durationSeconds = "durationSeconds" in value && isTimedRoundDuration(value.durationSeconds)
    ? value.durationSeconds
    : 30;
  return { mode, durationSeconds, timeoutAction: "defend" };
}

export function resolveBattleTimingSettings(
  settings: Readonly<BattleTimingSettings>,
  adjustment?: Readonly<BattleTimingAdjustment>,
): BattleTimingSettings {
  const resolved = normalizeBattleTimingSettings(settings);
  if (resolved.mode === "timed" && isTimedRoundDuration(adjustment?.durationSeconds)) {
    resolved.durationSeconds = adjustment.durationSeconds;
  }
  return resolved;
}
