export const TIMED_ROUND_DURATIONS = [15, 30, 45, 60, 90] as const;

export type TimedRoundDurationSeconds = (typeof TIMED_ROUND_DURATIONS)[number];
export type BattleTimingMode = "standard" | "timed";

export interface BattleTimingSettings {
  mode: BattleTimingMode;
  durationSeconds: TimedRoundDurationSeconds;
  timeoutAction: "defend";
}

/** Runtime-only suggestion; it cannot opt a campaign into timed battles. */
export interface BattleTimingAdjustment {
  durationSeconds?: TimedRoundDurationSeconds;
}
