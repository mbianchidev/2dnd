/**
 * Encounter system: handles random encounters, battle triggering, and boss challenges.
 */

import type { Terrain } from "../data/map";
import { getRandomEncounter, getDungeonEncounter, getBoss, getNightEncounter, type Monster } from "../data/monsters";
import { ENCOUNTER_RATES } from "../data/map";
import { isNightTime, getEncounterMultiplier } from "./daynight";
import { getWeatherEncounterMultiplier } from "./weather";
import type { WeatherState } from "./weather";

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
  
  /**
   * Check for a random encounter based on terrain, time of day, weather, and mount.
   * Returns the monster to encounter, or null if no encounter.
   */
  checkEncounter(
    terrain: Terrain,
    timeStep: number,
    weatherState: WeatherState,
    mountId: string,
    inDungeon: boolean
  ): Monster | null {
    if (!this.debugEncountersEnabled) {
      return null;
    }
    
    let baseRate = ENCOUNTER_RATES[terrain] ?? 0.02;
    
    // Time multiplier
    const timeMultiplier = getEncounterMultiplier(timeStep);
    baseRate *= timeMultiplier;
    
    // Weather multiplier
    const weatherMultiplier = getWeatherEncounterMultiplier(weatherState.current);
    baseRate *= weatherMultiplier;
    
    // Mount reduces encounter rate by 50%
    if (mountId) {
      baseRate *= 0.5;
    }
    
    if (Math.random() < baseRate) {
      if (inDungeon) {
        return getDungeonEncounter();
      } else if (isNightTime(timeStep)) {
        return getNightEncounter();
      } else {
        return getRandomEncounter(terrain);
      }
    }
    
    return null;
  }
  
  /**
   * Get a boss encounter for a specific dungeon.
   */
  getBossEncounter(dungeonId: string): Monster | null {
    return getBoss(dungeonId);
  }
}
