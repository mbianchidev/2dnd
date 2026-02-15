/**
 * Shared types, enums, and constants for the map system.
 * Extracted to break circular dependencies between map sub-modules.
 */

export enum Terrain {
  Grass = 0,
  Forest = 1,
  Mountain = 2,
  Water = 3,
  Sand = 4,
  Town = 5,
  Dungeon = 6,
  Boss = 7,
  Path = 8,
  DungeonFloor = 9,
  DungeonWall = 10,
  DungeonExit = 11,
  Chest = 12,
  Tundra = 13,
  Swamp = 14,
  DeepForest = 15,
  Volcanic = 16,
  Canyon = 17,
  MinorTreasure = 18,
  CityFloor = 19,
  CityWall = 20,
  CityExit = 21,
  Carpet = 22,
  Well = 23,
  Fountain = 24,
  Crate = 25,
  Barrel = 26,
  ShopFloor = 27,
  Temple = 28,
  Statue = 29,
  River = 30,
  Mill = 31,
  CropField = 32,
  Fence = 33,
  House = 34,
  Flower = 35,
  Cactus = 36,
  Geyser = 37,
  Mushroom = 38,
  Casino = 39,
  CityPath = 40,
  DungeonStairs = 41,
  DungeonBoss = 42,
}

export interface TownData {
  name: string;
  x: number;
  y: number;
  hasShop: boolean;
  shopItems: string[];
}

export interface BossData {
  name: string;
  monsterId: string;
  x: number;
  y: number;
}

export interface WorldChunk {
  name: string;
  mapData: Terrain[][];
  towns: TownData[];
  bosses: BossData[];
}

/** Per-level map data for multi-level dungeons. */
export interface DungeonLevel {
  mapData: Terrain[][];
  spawnX: number;
  spawnY: number;
}

export interface DungeonData {
  id: string;
  name: string;
  entranceChunkX: number;
  entranceChunkY: number;
  entranceTileX: number;
  entranceTileY: number;
  /** Level 0 (entrance level) map — kept for backward compatibility. */
  mapData: Terrain[][];
  spawnX: number;
  spawnY: number;
  /** Additional dungeon levels (index 0 = level 1, etc.). Level 0 uses mapData/spawnX/spawnY above. */
  levels?: DungeonLevel[];
  /** Unique boss monster ID for this dungeon. */
  bossId?: string;
}

export interface ChestData {
  id: string;
  itemId: string;
  x: number;
  y: number;
  location: { type: "overworld"; chunkX: number; chunkY: number }
          | { type: "dungeon"; dungeonId: string };
}

export interface CityShopData {
  type: "weapon" | "armor" | "magic" | "inn" | "bank" | "general" | "stable";
  name: string;
  x: number;
  y: number;
  shopItems: string[];
}

export interface CityData {
  id: string;
  name: string;
  chunkX: number;
  chunkY: number;
  tileX: number;
  tileY: number;
  mapData: Terrain[][];
  spawnX: number;
  spawnY: number;
  shops: CityShopData[];
}

export const MAP_WIDTH = 20;
export const MAP_HEIGHT = 15;
export const WORLD_WIDTH = 10;
export const WORLD_HEIGHT = 9;
