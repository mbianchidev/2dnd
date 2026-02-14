/**
 * Grid-based movement system.
 *
 * Extracts the core movement logic (bounds checking, walkability,
 * chunk transitions, position updates) from OverworldScene so
 * it can be tested independently and reused.
 */

import type { PlayerState } from "./player";
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  isWalkable,
  getTerrainAt,
  getDungeon,
  getCity,
} from "../data/map";

/** Result of a grid move attempt. */
export interface MoveResult {
  /** Whether the move was successful. */
  moved: boolean;
  /** Whether the move caused a chunk transition (overworld only). */
  chunkChanged: boolean;
  /** The terrain type at the new position (if moved). */
  newTerrain?: number;
}

/**
 * Attempt a grid move for the player. Updates `player.x`, `player.y`
 * (and chunk coordinates for overworld moves) if the move is valid.
 *
 * This is a pure position-resolution function: it does not trigger
 * animations, audio, encounters, or any scene-specific side effects.
 */
export function tryGridMove(
  player: PlayerState,
  dx: number,
  dy: number,
): MoveResult {
  const noMove: MoveResult = { moved: false, chunkChanged: false };

  // ── Dungeon movement ─────────────────────────────────────────
  if (player.inDungeon) {
    const dungeon = getDungeon(player.dungeonId);
    if (!dungeon) return noMove;
    const newX = player.x + dx;
    const newY = player.y + dy;
    if (newX < 0 || newX >= MAP_WIDTH || newY < 0 || newY >= MAP_HEIGHT) return noMove;
    const terrain = dungeon.mapData[newY][newX];
    if (!isWalkable(terrain)) return noMove;
    player.x = newX;
    player.y = newY;
    return { moved: true, chunkChanged: false, newTerrain: terrain };
  }

  // ── City movement ────────────────────────────────────────────
  if (player.inCity) {
    const city = getCity(player.cityId);
    if (!city) return noMove;
    const newX = player.x + dx;
    const newY = player.y + dy;
    if (newX < 0 || newX >= MAP_WIDTH || newY < 0 || newY >= MAP_HEIGHT) return noMove;
    const terrain = city.mapData[newY][newX];
    if (!isWalkable(terrain)) return noMove;
    player.x = newX;
    player.y = newY;
    return { moved: true, chunkChanged: false, newTerrain: terrain };
  }

  // ── Overworld movement (with chunk transitions) ──────────────
  let newX = player.x + dx;
  let newY = player.y + dy;
  let newChunkX = player.chunkX;
  let newChunkY = player.chunkY;

  // Chunk boundary wrapping
  if (newX < 0) { newChunkX--; newX = MAP_WIDTH - 1; }
  else if (newX >= MAP_WIDTH) { newChunkX++; newX = 0; }
  if (newY < 0) { newChunkY--; newY = MAP_HEIGHT - 1; }
  else if (newY >= MAP_HEIGHT) { newChunkY++; newY = 0; }

  const terrain = getTerrainAt(newChunkX, newChunkY, newX, newY);
  if (terrain === undefined || !isWalkable(terrain)) return noMove;

  const chunkChanged = newChunkX !== player.chunkX || newChunkY !== player.chunkY;
  player.x = newX;
  player.y = newY;
  player.chunkX = newChunkX;
  player.chunkY = newChunkY;

  return { moved: true, chunkChanged, newTerrain: terrain };
}
