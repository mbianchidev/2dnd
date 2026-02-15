/**
 * Encounter system: manages encounter state (enabled/disabled for debugging).
 */

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
