/**
 * Encounter system: manages encounter state (enabled/disabled for debugging).
 */

export const MAX_ENCOUNTER_RATE = 0.15;

/** Apply stacked encounter modifiers without ever exceeding the 15% cap. */
export function getEffectiveEncounterRate(
  baseRate: number,
  ...multipliers: number[]
): number {
  const rate = multipliers.reduce(
    (current, multiplier) => current * multiplier,
    Math.max(0, baseRate),
  );
  return Math.min(MAX_ENCOUNTER_RATE, Math.max(0, rate));
}

export class EncounterSystem {
  private debugEncountersEnabled = true;
  
  /**
   * Enable or disable random encounters (debug mode).
   */
  setEncountersEnabled(enabled: boolean): void {
    this.debugEncountersEnabled = enabled;
  }
  
  /**
   * Check if encounters are enabled.
   */
  areEncountersEnabled(): boolean {
    return this.debugEncountersEnabled;
  }
}
