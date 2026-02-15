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
  CityGate = 41,
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

export interface DungeonData {
  id: string;
  name: string;
  entranceChunkX: number;
  entranceChunkY: number;
  entranceTileX: number;
  entranceTileY: number;
  mapData: Terrain[][];
  spawnX: number;
  spawnY: number;
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

/** A single chunk/district within a multi-chunk city. */
export interface CityChunk {
  /** Display label for this district (e.g. "Market Quarter", "Docks"). */
  name: string;
  /** Interior map data (MAP_WIDTH × MAP_HEIGHT). */
  mapData: Terrain[][];
  /** Player spawn position when entering this chunk. */
  spawnX: number;
  spawnY: number;
  /** Shops within this chunk. */
  shops: CityShopData[];
}

export interface CityData {
  id: string;
  name: string;
  chunkX: number;
  chunkY: number;
  tileX: number;
  tileY: number;
  /** Primary chunk map data (chunk index 0). */
  mapData: Terrain[][];
  spawnX: number;
  spawnY: number;
  /** Shops in the primary chunk (chunk index 0). */
  shops: CityShopData[];
  /**
   * Additional city chunks (districts). Index 0 is always the primary chunk
   * derived from mapData/spawnX/spawnY/shops above. Extra chunks start at
   * index 1+. When this array is present, its entries are the extra districts.
   */
  chunks?: CityChunk[];
}

export const MAP_WIDTH = 20;
export const MAP_HEIGHT = 15;
export const WORLD_WIDTH = 10;
export const WORLD_HEIGHT = 9;
