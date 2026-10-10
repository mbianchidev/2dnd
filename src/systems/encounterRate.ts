export const MAX_ENCOUNTER_RATE = 0.15;

/** Clamp only after all environmental, profile, and future scale layers. */
export function getEffectiveEncounterRate(
  baseRate: number,
  ...multipliers: number[]
): number {
  if (![baseRate, ...multipliers].every(Number.isFinite)) {
    throw new Error("[encounter] Encounter modifiers must be finite.");
  }
  const rate = multipliers.reduce(
    (current, multiplier) => current * multiplier,
    Math.max(0, baseRate),
  );
  return Math.min(MAX_ENCOUNTER_RATE, Math.max(0, rate));
}
