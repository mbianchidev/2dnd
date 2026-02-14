/**
 * Save / Load game state to localStorage.
 */

import type { PlayerState } from "./player";
import type { BestiaryData } from "./bestiary";
import { createBestiary } from "./bestiary";
import type { WeatherState } from "./weather";
import { createWeatherState } from "./weather";

const SAVE_KEY = "2dnd_save";

export interface SaveData {
  version: number;
  player: PlayerState;
  defeatedBosses: string[];
  bestiary: BestiaryData;
  appearanceId: string;
  timestamp: number;
  /** Day/night cycle step counter (added in v1). */
  timeStep?: number;
  /** Weather state (added in v1). */
  weatherState?: WeatherState;
}

/** Save the current game state. */
export function saveGame(
  player: PlayerState,
  defeatedBosses: Set<string>,
  bestiary: BestiaryData,
  appearanceId: string,
  timeStep: number = 0,
  weatherState?: WeatherState
): void {
  const data: SaveData = {
    version: 1,
    player,
    defeatedBosses: [...defeatedBosses],
    bestiary,
    appearanceId,
    timestamp: Date.now(),
    timeStep,
    weatherState,
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
    
    // Migration: Convert old flat structure to new nested structure
    const playerAny = data.player as any;
    if (!data.player.position) {
      // Old save format - migrate to nested structure
      data.player.position = {
        x: playerAny.x ?? 3,
        y: playerAny.y ?? 3,
        chunkX: playerAny.chunkX ?? 4,
        chunkY: playerAny.chunkY ?? 2,
        inDungeon: playerAny.inDungeon ?? false,
        dungeonId: playerAny.dungeonId ?? "",
        inCity: playerAny.inCity ?? false,
        cityId: playerAny.cityId ?? "",
      };
      // Clean up old flat fields
      delete playerAny.x;
      delete playerAny.y;
      delete playerAny.chunkX;
      delete playerAny.chunkY;
      delete playerAny.inDungeon;
      delete playerAny.dungeonId;
      delete playerAny.inCity;
      delete playerAny.cityId;
    }
    
    if (!data.player.progression) {
      // Old save format - migrate to nested structure
      data.player.progression = {
        openedChests: playerAny.openedChests ?? [],
        collectedTreasures: playerAny.collectedTreasures ?? [],
        exploredTiles: playerAny.exploredTiles ?? {},
      };
      // Clean up old flat fields
      delete playerAny.openedChests;
      delete playerAny.collectedTreasures;
      delete playerAny.exploredTiles;
    }
    
    if (data.player.equippedShield === undefined) data.player.equippedShield = null;
    if (data.timeStep === undefined) data.timeStep = 0;
    if (!data.weatherState) data.weatherState = createWeatherState();
    // Backward compat: last town defaults to Willowdale
    if (data.player.lastTownX === undefined) data.player.lastTownX = 2;
    if (data.player.lastTownY === undefined) data.player.lastTownY = 2;
    if (data.player.lastTownChunkX === undefined) data.player.lastTownChunkX = 4;
    if (data.player.lastTownChunkY === undefined) data.player.lastTownChunkY = 2;
    if (data.player.bankBalance === undefined) data.player.bankBalance = 0;
    if (data.player.lastBankDay === undefined) data.player.lastBankDay = 0;
    // Backward compat: mount system
    if (data.player.mountId === undefined) data.player.mountId = "";
    // Backward compat: short rest system
    if (data.player.shortRestsRemaining === undefined) data.player.shortRestsRemaining = 2;
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
