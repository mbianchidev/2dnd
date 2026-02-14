/**
 * Fog of war system: manages tile exploration and visibility.
 */

import Phaser from "phaser";
import { MAP_WIDTH, MAP_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT } from "../data/map";

export class FogOfWar {
  private explored: Set<string> = new Set();
  private debugFogDisabled = false;
  
  /**
   * Generate a unique key for a tile position.
   */
  private exploredKey(x: number, y: number): string {
    return `${x},${y}`;
  }
  
  /**
   * Check if a tile has been explored.
   */
  isExplored(x: number, y: number): boolean {
    if (this.debugFogDisabled) return true;
    return this.explored.has(this.exploredKey(x, y));
  }
  
  /**
   * Reveal tiles around a center position.
   */
  revealAround(centerX: number, centerY: number, radius = 2): void {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= radius) {
          const nx = centerX + dx;
          const ny = centerY + dy;
          if (nx >= 0 && nx < WORLD_WIDTH && ny >= 0 && ny < WORLD_HEIGHT) {
            this.explored.add(this.exploredKey(nx, ny));
          }
        }
      }
    }
  }
  
  /**
   * Reveal the entire world map (debug command).
   */
  revealEntireWorld(): void {
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let x = 0; x < WORLD_WIDTH; x++) {
        this.explored.add(this.exploredKey(x, y));
      }
    }
  }
  
  /**
   * Enable or disable fog of war (debug mode).
   */
  setFogDisabled(disabled: boolean): void {
    this.debugFogDisabled = disabled;
  }
  
  /**
   * Check if fog is disabled.
   */
  isFogDisabled(): boolean {
    return this.debugFogDisabled;
  }
  
  /**
   * Get all explored tile keys.
   */
  getExploredTiles(): Set<string> {
    return this.explored;
  }
  
  /**
   * Load explored tiles from save data.
   */
  loadExplored(tiles: string[]): void {
    this.explored = new Set(tiles);
  }
  
  /**
   * Get explored tiles as array for saving.
   */
  getExploredArray(): string[] {
    return Array.from(this.explored);
  }
}
