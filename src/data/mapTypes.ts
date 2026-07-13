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
  DungeonStairs = 42,
  DungeonBoss = 43,
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

/** Bidirectional or one-way connection between two dungeon levels. */
export interface DungeonConnection {
  fromLevel: number;
  fromX: number;
  fromY: number;
  toLevel: number;
  toX: number;
  toY: number;
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
  /** Explicit level transitions keyed by their source tile. */
  connections: DungeonConnection[];
}

export type ChestLocation =
  | { type: "overworld"; chunkX: number; chunkY: number }
  | { type: "dungeon"; dungeonId: string; dungeonLevel?: number };

export interface ChestData {
  id: string;
  itemId: string;
  x: number;
  y: number;
  location: ChestLocation;
  /** Dexterity DC for a locked or trapped chest. */
  lockDc?: number;
  /** Nonlethal damage taken when the lock check fails. */
  trapDamage?: number;
  /** Wisdom DC to notice a hidden compartment after opening. */
  secretDc?: number;
  /** Bonus gold found when the hidden-compartment check succeeds. */
  secretGold?: number;
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

/** Explicit connection between two chunks within a city. */
export interface CityConnection {
  fromChunkIndex: number;
  fromX: number;
  fromY: number;
  toChunkIndex: number;
  toX: number;
  toY: number;
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
   /** Gate transitions keyed by their source chunk and tile. */
   connections: CityConnection[];
}

export const MAP_WIDTH = 20;
export const MAP_HEIGHT = 15;
export const WORLD_WIDTH = 10;
export const WORLD_HEIGHT = 9;
