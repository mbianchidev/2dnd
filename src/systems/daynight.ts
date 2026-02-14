/**
 * Day/Night cycle system.
 * Time advances with each player step on the overworld.
 * The cycle influences encounter rates and monster types.
 */

/** The time periods in the cycle, plus a special Dungeon period. */
export enum TimePeriod {
  Dawn = "Dawn",
  Day = "Day",
  Dusk = "Dusk",
  Night = "Night",
  /** Special period used inside dungeons — time stands still. */
  Dungeon = "Dungeon",
}

/**
 * Total steps in one full day/night cycle.
 * With a ~150 ms move delay this gives roughly 9 minutes per cycle
 * at sustained walking speed.
 */
export const CYCLE_LENGTH = 360;

/** Step ranges for each period within one cycle (0-indexed). */
const PERIOD_RANGES: { period: TimePeriod; start: number; end: number }[] = [
  { period: TimePeriod.Dawn, start: 0, end: 44 },       // 45 steps
  { period: TimePeriod.Day, start: 45, end: 219 },      // 175 steps
  { period: TimePeriod.Dusk, start: 220, end: 264 },    // 45 steps
  { period: TimePeriod.Night, start: 265, end: 359 },   // 95 steps
];

/** Get the current time period from the step counter. */
export function getTimePeriod(step: number): TimePeriod {
  const pos = ((step % CYCLE_LENGTH) + CYCLE_LENGTH) % CYCLE_LENGTH;
  for (const range of PERIOD_RANGES) {
    if (pos >= range.start && pos <= range.end) return range.period;
  }
  return TimePeriod.Day; // fallback
}

/**
 * Encounter rate multiplier for each time period.
 * Night has more encounters, dawn/dusk are transitional.
 */
const ENCOUNTER_MULTIPLIERS: Record<TimePeriod, number> = {
  [TimePeriod.Dawn]: 1.0,
  [TimePeriod.Day]: 1.0,
  [TimePeriod.Dusk]: 1.25,
  [TimePeriod.Night]: 1.5,
  [TimePeriod.Dungeon]: 1.0,
};

/** Return the encounter-rate multiplier for the given step. */
export function getEncounterMultiplier(step: number): number {
  return ENCOUNTER_MULTIPLIERS[getTimePeriod(step)];
}

/**
 * Whether nocturnal (night-only) monsters can appear at this step.
 * They appear during Dusk and Night.
 */
export function isNightTime(step: number): boolean {
  const period = getTimePeriod(step);
  return period === TimePeriod.Night || period === TimePeriod.Dusk;
}

/**
 * Camera tint color for each time period, used to visually indicate
 * the cycle on the overworld map layer.
 *
 * Values are Phaser tint colors (0xRRGGBB).
 * Day = no tint (white), Dawn/Dusk = warm orange, Night = cool blue.
 */
export const PERIOD_TINT: Record<TimePeriod, number> = {
  [TimePeriod.Dawn]: 0xffd5a0,
  [TimePeriod.Day]: 0xffffff,
  [TimePeriod.Dusk]: 0xffa570,
  [TimePeriod.Night]: 0x6688cc,
  [TimePeriod.Dungeon]: 0x556688,
};

/** Human-readable emoji + label for the HUD. */
export const PERIOD_LABEL: Record<TimePeriod, string> = {
  [TimePeriod.Dawn]: "🌅 Dawn",
  [TimePeriod.Day]: "☀️ Day",
  [TimePeriod.Dusk]: "🌇 Dusk",
  [TimePeriod.Night]: "🌙 Night",
  [TimePeriod.Dungeon]: "🔦 Dungeon",
};
