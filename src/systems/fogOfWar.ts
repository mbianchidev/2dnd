/**
 * Fog of war system: manages tile exploration and visibility.
 * Handles dungeon, city, and overworld exploration separately.
 */

import { MAP_WIDTH, MAP_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT, DUNGEONS } from "../data/map";
import type { PlayerState } from "./player";

export class FogOfWar {
  private exploredTiles: Record<string, boolean> = {};
  private debugFogDisabled = false;
  
  /**
   * Build the explored-tiles key for a position (respects dungeon/city vs overworld).
   */
  exploredKey(x: number, y: number, player: PlayerState): string {
    if (player.position.inDungeon) {
      return `d:${player.position.dungeonId},${x},${y}`;
    }
    if (player.position.inCity) {
      return `c:${player.position.cityId},${x},${y}`;
    }
    return `${player.position.chunkX},${player.position.chunkY},${x},${y}`;
  }
  
  /**
   * Check if a tile has been explored.
   */
  isExplored(x: number, y: number, player: PlayerState): boolean {
    if (this.debugFogDisabled) return true;
    return !!this.exploredTiles[this.exploredKey(x, y, player)];
  }
  
  /**
   * Reveal tiles in a radius around a given position.
   */
  revealAround(centerX: number, centerY: number, radius: number, player: PlayerState): void {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = centerX + dx;
        const ny = centerY + dy;
        if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT) {
          this.exploredTiles[this.exploredKey(nx, ny, player)] = true;
        }
      }
    }
  }
  
  /**
   * Reveal every tile in every overworld chunk and every dungeon (debug command).
   */
  revealEntireWorld(): void {
    // Reveal all overworld chunks
    for (let cy = 0; cy < WORLD_HEIGHT; cy++) {
      for (let cx = 0; cx < WORLD_WIDTH; cx++) {
        for (let ty = 0; ty < MAP_HEIGHT; ty++) {
          for (let tx = 0; tx < MAP_WIDTH; tx++) {
            this.exploredTiles[`${cx},${cy},${tx},${ty}`] = true;
          }
        }
      }
    }
    // Reveal all dungeons
    for (const d of DUNGEONS) {
      for (let ty = 0; ty < MAP_HEIGHT; ty++) {
        for (let tx = 0; tx < MAP_WIDTH; tx++) {
          this.exploredTiles[`d:${d.id},${tx},${ty}`] = true;
        }
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
   * Get the explored tiles record.
   */
  getExploredTiles(): Record<string, boolean> {
    return this.exploredTiles;
  }
  
  /**
   * Set the explored tiles record (for loading from player state).
   */
  setExploredTiles(tiles: Record<string, boolean>): void {
    this.exploredTiles = tiles;
  }
}
