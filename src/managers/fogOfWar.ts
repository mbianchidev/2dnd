/**
 * Fog of war system: manages tile exploration and visibility.
 * Handles dungeon, city, and overworld exploration separately.
 */

import { MAP_WIDTH, MAP_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT, DUNGEONS, CITIES, getCityChunkCount } from "../data/map";
import type { PlayerState } from "../systems/player";

export class FogOfWar {
  private exploredTiles: Record<string, boolean> = {};
  private debugFogDisabled = false;
  
  /**
   * Build the explored-tiles key for a position (respects dungeon/city vs overworld).
   * Level/chunk zero preserve the legacy key format for existing saves.
   */
  exploredKey(x: number, y: number, player: PlayerState): string {
    if (player.position.inDungeon) {
      const level = player.position.dungeonLevel;
      if (level > 0) {
        return `d:${player.position.dungeonId},${level},${x},${y}`;
      }
      return `d:${player.position.dungeonId},${x},${y}`;
    }
    if (player.position.inCity) {
      const ci = player.position.cityChunkIndex;
      if (ci > 0) {
        return `c:${player.position.cityId},${ci},${x},${y}`;
      }
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
   * Reveal every tile in every overworld chunk, dungeon, and city (debug command).
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
    // Reveal all dungeons (all levels)
    for (const d of DUNGEONS) {
      const totalLevels = 1 + (d.levels?.length ?? 0);
      for (let lvl = 0; lvl < totalLevels; lvl++) {
        for (let ty = 0; ty < MAP_HEIGHT; ty++) {
          for (let tx = 0; tx < MAP_WIDTH; tx++) {
            const key = lvl === 0
              ? `d:${d.id},${tx},${ty}`
              : `d:${d.id},${lvl},${tx},${ty}`;
            this.exploredTiles[key] = true;
          }
        }
      }
    }
    // Reveal all city chunks (primary + extra districts)
    for (const city of CITIES) {
      const chunkCount = getCityChunkCount(city);
      for (let ci = 0; ci < chunkCount; ci++) {
        for (let ty = 0; ty < MAP_HEIGHT; ty++) {
          for (let tx = 0; tx < MAP_WIDTH; tx++) {
            if (ci === 0) {
              this.exploredTiles[`c:${city.id},${tx},${ty}`] = true;
            } else {
              this.exploredTiles[`c:${city.id},${ci},${tx},${ty}`] = true;
            }
          }
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
