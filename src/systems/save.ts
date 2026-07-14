/**
 * Save / Load game state to localStorage.
 */

import type { PlayerState } from "./player";
import type { CodexData } from "./codex";
import { createCodex } from "./codex";
import type { WeatherState } from "./weather";
import { createWeatherState } from "./weather";
import {
  CITIES,
  MAP_HEIGHT,
  MAP_WIDTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  getCity,
  getCityChunk,
  getDungeon,
  getDungeonLevelMap,
  getDungeonLevelSpawn,
  getDungeonTotalLevels,
  getTerrainAt,
  isWalkable,
} from "../data/map";
import { debugLog } from "../config";
import { isElement } from "../data/elements";
import {
  LEGACY_TRAP_SEED,
  isTrapState,
  type TrapState,
} from "../data/traps";
import { normalizeActiveEffects } from "./statusEffects";
import { normalizeQuestLog } from "./quests";
import { normalizeSkillCheckRecords } from "./skillChecks";
import {
  normalizePartyState,
  synchronizeCompanionRecruitment,
} from "./party";

const SAVE_KEY = "2dnd_save";
const SAVE_VERSION = 6;

export interface SaveData {
  version: number;
  player: PlayerState;
  defeatedBosses: string[];
  codex: CodexData;
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
  codex: CodexData,
  appearanceId: string,
  timeStep: number = 0,
  weatherState?: WeatherState
): void {
  const data: SaveData = {
    version: SAVE_VERSION,
    player,
    defeatedBosses: [...defeatedBosses],
    codex,
    appearanceId,
    timestamp: Date.now(),
    timeStep,
    weatherState,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (error) {
    debugLog("[save] Failed to save", error);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) ? value : fallback;
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function normalizeExploredTiles(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) return {};
  const exploredTiles: Record<string, boolean> = {};
  for (const [key, explored] of Object.entries(value)) {
    if (explored === true) exploredTiles[key] = true;
  }
  return exploredTiles;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getInterimTrapSeed(
  player: PlayerState,
  layoutRecord: unknown,
): number | undefined {
  if (!isRecord(layoutRecord)) return undefined;
  const optionId = layoutRecord["optionId"];
  if (typeof optionId === "string" && optionId.startsWith("layout:")) {
    const exactSeed = Number(optionId.slice("layout:".length));
    if (Number.isInteger(exactSeed) && exactSeed > 0) return exactSeed;
  }
  const naturalRoll = layoutRecord["naturalRoll"];
  const modifier = layoutRecord["modifier"];
  if (
    typeof naturalRoll !== "number"
    || !Number.isInteger(naturalRoll)
    || typeof modifier !== "number"
    || !Number.isInteger(modifier)
  ) {
    return undefined;
  }
  const appearance = player.customAppearance
    ? [
      player.customAppearance.skinColor,
      player.customAppearance.hairStyle,
      player.customAppearance.hairColor,
    ].join(":")
    : "default";
  return hashString([
    player.name,
    player.appearanceId,
    appearance,
    naturalRoll,
    modifier,
  ].join(":"));
}

function getInterimTrapState(record: unknown): TrapState | undefined {
  if (!isRecord(record)) return undefined;
  const optionId = record["optionId"];
  const success = record["success"] === true;
  if (typeof optionId !== "string") return undefined;
  if (optionId.startsWith("triggered:")) return "triggered";
  if (optionId === "disarm") return success ? "disarmed" : "triggered";
  if (optionId === "detect") return success ? "detected" : "missed";
  return undefined;
}

function migrateInterimTrapProgression(player: PlayerState): void {
  const progression = player.progression as unknown as Record<string, unknown>;
  const rawChecks = isRecord(progression["skillChecks"])
    ? progression["skillChecks"]
    : {};
  const existingSeed = progression["trapSeed"];
  if (
    !(typeof existingSeed === "number"
      && Number.isInteger(existingSeed)
      && existingSeed > 0)
  ) {
    const migratedSeed = getInterimTrapSeed(
      player,
      rawChecks["trap:layout"],
    );
    if (migratedSeed !== undefined) progression["trapSeed"] = migratedSeed;
  }

  const states = isRecord(progression["trapStates"])
    ? { ...progression["trapStates"] }
    : {};
  for (const [checkId, record] of Object.entries(rawChecks)) {
    if (!checkId.startsWith("trap:") || checkId === "trap:layout") continue;
    const trapId = checkId.slice("trap:".length);
    if (states[trapId] !== undefined) continue;
    const state = getInterimTrapState(record);
    if (state) states[trapId] = state;
  }
  progression["trapStates"] = states;

  const hadGuidanceItem = player.inventory.some(
    (item) => item.id === "adventurerTrapNotes",
  );
  if (hadGuidanceItem) {
    progression["trapGuidance"] = true;
    player.inventory = player.inventory.filter(
      (item) => item.id !== "adventurerTrapNotes",
    );
  }

  progression["skillChecks"] = Object.fromEntries(
    Object.entries(rawChecks).filter(([checkId]) => !checkId.startsWith("trap:")),
  );
}

function normalizeTrapSeed(value: unknown): {
  seed: number;
  valid: boolean;
} {
  const valid = typeof value === "number"
    && Number.isInteger(value)
    && value > 0;
  return {
    seed: valid ? value : LEGACY_TRAP_SEED,
    valid,
  };
}

function normalizeTrapStates(value: unknown): Record<string, TrapState> {
  if (!isRecord(value)) return {};
  const trapStates: Record<string, TrapState> = {};
  for (const [trapId, state] of Object.entries(value)) {
    if (isTrapState(state)) trapStates[trapId] = state;
  }
  return trapStates;
}

function isValidMapPosition(mapData: number[][], x: number, y: number): boolean {
  return Number.isInteger(x)
    && Number.isInteger(y)
    && x >= 0
    && x < MAP_WIDTH
    && y >= 0
    && y < MAP_HEIGHT
    && isWalkable(mapData[y][x]);
}

function normalizePlayerLocation(player: PlayerState): void {
  const position = player.position;
  position.x = readInteger(position.x, 3);
  position.y = readInteger(position.y, 3);
  position.chunkX = readInteger(position.chunkX, 4);
  position.chunkY = readInteger(position.chunkY, 2);
  position.inDungeon = readBoolean(position.inDungeon);
  position.dungeonId = readString(position.dungeonId);
  position.dungeonLevel = readInteger(position.dungeonLevel, 0);
  position.inCity = readBoolean(position.inCity);
  position.cityId = readString(position.cityId);
  position.cityChunkIndex = readInteger(position.cityChunkIndex, 0);

  if (position.inDungeon) {
    const dungeon = getDungeon(position.dungeonId);
    if (dungeon) {
      position.inCity = false;
      position.cityId = "";
      position.cityChunkIndex = 0;
      const maxLevel = getDungeonTotalLevels(dungeon) - 1;
      position.dungeonLevel = Math.min(Math.max(position.dungeonLevel, 0), maxLevel);
      const levelMap = getDungeonLevelMap(dungeon, position.dungeonLevel);
      if (!isValidMapPosition(levelMap, position.x, position.y)) {
        const spawn = getDungeonLevelSpawn(dungeon, position.dungeonLevel);
        position.x = spawn.x;
        position.y = spawn.y;
      }
      return;
    }
    position.inDungeon = false;
    position.dungeonId = "";
    position.dungeonLevel = 0;
  }

  if (position.inCity) {
    const city = getCity(position.cityId);
    if (city) {
      position.inDungeon = false;
      position.dungeonId = "";
      position.dungeonLevel = 0;
      const maxChunkIndex = city.chunks?.length ?? 0;
      position.cityChunkIndex = Math.min(
        Math.max(position.cityChunkIndex, 0),
        maxChunkIndex,
      );
      const chunk = getCityChunk(city, position.cityChunkIndex);
      if (chunk && !isValidMapPosition(chunk.mapData, position.x, position.y)) {
        position.x = chunk.spawnX;
        position.y = chunk.spawnY;
      }
      return;
    }
    position.inCity = false;
    position.cityId = "";
    position.cityChunkIndex = 0;
  }

  position.chunkX = Math.min(Math.max(position.chunkX, 0), WORLD_WIDTH - 1);
  position.chunkY = Math.min(Math.max(position.chunkY, 0), WORLD_HEIGHT - 1);
  const terrain = getTerrainAt(
    position.chunkX,
    position.chunkY,
    position.x,
    position.y,
  );
  if (terrain === undefined || !isWalkable(terrain)) {
    position.chunkX = 4;
    position.chunkY = 2;
    position.x = 3;
    position.y = 3;
  }
}

/** Load a saved game. Returns null if no save exists or it's corrupt. */
export function loadGame(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !isRecord(parsed["player"])) return null;
    if (typeof parsed["version"] !== "number") return null;
    const data = parsed as unknown as SaveData;

    // Migration: old saves stored this field as "bestiary" — map to "codex"
    if (!data.codex && parsed["bestiary"]) {
      data.codex = parsed["bestiary"] as CodexData;
      delete parsed["bestiary"];
    }

    if (!data.codex || !isRecord(data.codex.entries)) {
      data.codex = createCodex();
    }
    for (const entry of Object.values(data.codex.entries)) {
      entry.discoveredElements = Array.isArray(entry.discoveredElements)
        ? entry.discoveredElements.filter(isElement)
        : [];
    }
    data.appearanceId = readString(data.appearanceId, "knight");
    data.defeatedBosses = normalizeStringArray(data.defeatedBosses);
    data.player.knownAbilities = normalizeStringArray(data.player.knownAbilities);
    data.player.knownTalents = normalizeStringArray(data.player.knownTalents);

    const playerRecord = data.player as unknown as Record<string, unknown>;
    if (!isRecord(playerRecord["position"])) {
      data.player.position = {
        x: readInteger(playerRecord["x"], 3),
        y: readInteger(playerRecord["y"], 3),
        chunkX: readInteger(playerRecord["chunkX"], 4),
        chunkY: readInteger(playerRecord["chunkY"], 2),
        inDungeon: readBoolean(playerRecord["inDungeon"]),
        dungeonId: readString(playerRecord["dungeonId"]),
        dungeonLevel: readInteger(playerRecord["dungeonLevel"], 0),
        inCity: readBoolean(playerRecord["inCity"]),
        cityId: readString(playerRecord["cityId"]),
        cityChunkIndex: 0,
      };
      delete playerRecord["x"];
      delete playerRecord["y"];
      delete playerRecord["chunkX"];
      delete playerRecord["chunkY"];
      delete playerRecord["inDungeon"];
      delete playerRecord["dungeonId"];
      delete playerRecord["dungeonLevel"];
      delete playerRecord["inCity"];
      delete playerRecord["cityId"];
    }

    if (data.player.position.dungeonLevel === undefined) {
      data.player.position.dungeonLevel = 0;
    }
    if (data.player.position.cityChunkIndex === undefined) {
      data.player.position.cityChunkIndex = 0;
    }

    if (!isRecord(playerRecord["progression"])) {
      data.player.progression = {
        openedChests: normalizeStringArray(playerRecord["openedChests"]),
        collectedTreasures: normalizeStringArray(playerRecord["collectedTreasures"]),
        exploredTiles: normalizeExploredTiles(playerRecord["exploredTiles"]),
        discoveredCities: [],
        quests: normalizeQuestLog(playerRecord["quests"]),
        skillChecks: {},
        trapSeed: LEGACY_TRAP_SEED,
        trapStates: {},
        trapGuidance: false,
      };
      delete playerRecord["openedChests"];
      delete playerRecord["collectedTreasures"];
      delete playerRecord["exploredTiles"];
    }

    data.player.progression.openedChests = normalizeStringArray(
      data.player.progression.openedChests,
    );
    data.player.progression.collectedTreasures = normalizeStringArray(
      data.player.progression.collectedTreasures,
    );
    data.player.progression.exploredTiles = normalizeExploredTiles(
      data.player.progression.exploredTiles,
    );
    migrateInterimTrapProgression(data.player);
    data.player.progression.quests = normalizeQuestLog(
      data.player.progression.quests,
    );
    data.player.progression.skillChecks = normalizeSkillCheckRecords(
      data.player.progression.skillChecks,
    );
    const trapSeed = normalizeTrapSeed(data.player.progression.trapSeed);
    data.player.progression.trapSeed = trapSeed.seed;
    data.player.progression.trapStates = trapSeed.valid
      ? normalizeTrapStates(data.player.progression.trapStates)
      : {};
    data.player.progression.trapGuidance = readBoolean(
      data.player.progression.trapGuidance,
    );
    data.player.party = normalizePartyState(playerRecord["party"]);
    synchronizeCompanionRecruitment(data.player);

    if (data.player.equippedShield === undefined) data.player.equippedShield = null;
    if (data.player.equippedOffHand === undefined) data.player.equippedOffHand = null;
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
    if (data.player.shortRestsRemaining === undefined) data.player.shortRestsRemaining = 2;
    if (data.player.pendingLevelUps === undefined) data.player.pendingLevelUps = 0;
    data.player.activeEffects = normalizeActiveEffects(data.player.activeEffects);

    const p = data.player;
    if (p.equippedWeapon) {
      const match = p.inventory.find(i => i.id === p.equippedWeapon!.id && i.type === "weapon");
      if (match) p.equippedWeapon = match;
    }
    if (p.equippedOffHand) {
      const match = p.inventory.find(i => i.id === p.equippedOffHand!.id && i.type === "weapon");
      if (match) p.equippedOffHand = match;
    }
    if (p.equippedArmor) {
      const match = p.inventory.find(i => i.id === p.equippedArmor!.id && i.type === "armor");
      if (match) p.equippedArmor = match;
    }
    if (p.equippedShield) {
      const match = p.inventory.find(i => i.id === p.equippedShield!.id && i.type === "shield");
      if (match) p.equippedShield = match;
    }

    const validCityIds = new Set(CITIES.map((city) => city.id));
    if (!Array.isArray(data.player.progression.discoveredCities)) {
      const ids = new Set<string>();
      for (const key of Object.keys(data.player.progression.exploredTiles)) {
        if (key.startsWith("c:")) {
          const cityId = key.split(",")[0].substring(2);
          if (validCityIds.has(cityId)) ids.add(cityId);
        }
      }
      data.player.progression.discoveredCities = [...ids];
    } else {
      data.player.progression.discoveredCities = [
        ...new Set(
          data.player.progression.discoveredCities.filter((cityId) =>
            typeof cityId === "string" && validCityIds.has(cityId)
          ),
        ),
      ];
    }

    normalizePlayerLocation(data.player);
    data.version = SAVE_VERSION;
    return data;
  } catch (error) {
    debugLog("[save] Failed to load save", error);
    return null;
  }
}

/** Check if a save exists. */
export function hasSave(): boolean {
  return loadGame() !== null;
}

/** Delete the save. */
export function deleteSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (error) {
    debugLog("[save] Failed to delete save", error);
  }
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
