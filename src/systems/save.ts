/**
 * Save / Load game state to localStorage.
 */

import type { PlayerState } from "./player";
import type { BestiaryData } from "./bestiary";
import { createBestiary } from "./bestiary";

const SAVE_KEY = "2dnd_save";

export interface SaveData {
  version: number;
  player: PlayerState;
  defeatedBosses: string[];
  bestiary: BestiaryData;
  appearanceId: string;
  timestamp: number;
}

/** Save the current game state. */
export function saveGame(
  player: PlayerState,
  defeatedBosses: Set<string>,
  bestiary: BestiaryData,
  appearanceId: string
): void {
  const data: SaveData = {
    version: 1,
    player,
    defeatedBosses: [...defeatedBosses],
    bestiary,
    appearanceId,
    timestamp: Date.now(),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("[save] Failed to save:", e);
  }
}

/** Load a saved game. Returns null if no save exists or it's corrupt. */
export function loadGame(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (!data.player || !data.version) return null;
    // Ensure bestiary exists (may be missing from old saves)
    if (!data.bestiary) data.bestiary = createBestiary();
    if (!data.appearanceId) data.appearanceId = "knight";
    // Backward compat for new fields
    if (!data.player.knownAbilities) data.player.knownAbilities = [];
    if (!data.player.knownTalents) data.player.knownTalents = [];
    if (data.player.chunkX === undefined) data.player.chunkX = 1;
    if (data.player.chunkY === undefined) data.player.chunkY = 1;
    if (data.player.inDungeon === undefined) data.player.inDungeon = false;
    if (data.player.dungeonId === undefined) data.player.dungeonId = "";
    if (!data.player.openedChests) data.player.openedChests = [];
    if (!data.player.exploredTiles) data.player.exploredTiles = {};
    if (data.player.equippedShield === undefined) data.player.equippedShield = null;
    return data;
  } catch {
    return null;
  }
}

/** Check if a save exists. */
export function hasSave(): boolean {
  return loadGame() !== null;
}

/** Delete the save. */
export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

/** Get a brief summary of the save for the title screen. */
export function getSaveSummary(): string | null {
  const data = loadGame();
  if (!data) return null;
  const p = data.player;
  const date = new Date(data.timestamp);
  const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `${p.name} Lv.${p.level} | HP ${p.hp}/${p.maxHp} | Gold ${p.gold} | ${dateStr}`;
}
