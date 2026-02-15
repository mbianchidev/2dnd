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
  getCityChunkMap,
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
  if (player.position.inDungeon) {
    const dungeon = getDungeon(player.position.dungeonId);
    if (!dungeon) return noMove;
    const newX = player.position.x + dx;
    const newY = player.position.y + dy;
    if (newX < 0 || newX >= MAP_WIDTH || newY < 0 || newY >= MAP_HEIGHT) return noMove;
    const terrain = dungeon.mapData[newY][newX];
    if (!isWalkable(terrain)) return noMove;
    player.position.x = newX;
    player.position.y = newY;
    return { moved: true, chunkChanged: false, newTerrain: terrain };
  }

  // ── City movement ────────────────────────────────────────────
  if (player.position.inCity) {
    const city = getCity(player.position.cityId);
    if (!city) return noMove;
    const chunkMap = getCityChunkMap(city, player.position.cityChunkIndex);
    const newX = player.position.x + dx;
    const newY = player.position.y + dy;
    if (newX < 0 || newX >= MAP_WIDTH || newY < 0 || newY >= MAP_HEIGHT) return noMove;
    const terrain = chunkMap[newY][newX];
    if (!isWalkable(terrain)) return noMove;
    player.position.x = newX;
    player.position.y = newY;
    return { moved: true, chunkChanged: false, newTerrain: terrain };
  }

  // ── Overworld movement (with chunk transitions) ──────────────
  let newX = player.position.x + dx;
  let newY = player.position.y + dy;
  let newChunkX = player.position.chunkX;
  let newChunkY = player.position.chunkY;

  // Chunk boundary wrapping
  if (newX < 0) { newChunkX--; newX = MAP_WIDTH - 1; }
  else if (newX >= MAP_WIDTH) { newChunkX++; newX = 0; }
  if (newY < 0) { newChunkY--; newY = MAP_HEIGHT - 1; }
  else if (newY >= MAP_HEIGHT) { newChunkY++; newY = 0; }

  const terrain = getTerrainAt(newChunkX, newChunkY, newX, newY);
  if (terrain === undefined || !isWalkable(terrain)) return noMove;

  const chunkChanged = newChunkX !== player.position.chunkX || newChunkY !== player.position.chunkY;
  player.position.x = newX;
  player.position.y = newY;
  player.position.chunkX = newChunkX;
  player.position.chunkY = newChunkY;

  return { moved: true, chunkChanged, newTerrain: terrain };
}
