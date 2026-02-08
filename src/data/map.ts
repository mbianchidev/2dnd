/**
 * Overworld map data — multi-chunk world system.
 * The world is a 3×3 grid of 20×15-tile chunks.
 * Each chunk has its own terrain, towns, and bosses.
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
}

export interface TownData {
  name: string;
  x: number; // local tile x within chunk
  y: number; // local tile y within chunk
  hasShop: boolean;
  shopItems: string[]; // item IDs available in this town's shop
}

export interface BossData {
  name: string;
  monsterId: string;
  x: number; // local tile x within chunk
  y: number; // local tile y within chunk
}

export interface WorldChunk {
  name: string;
  mapData: Terrain[][];
  towns: TownData[];
  bosses: BossData[];
}

export interface DungeonData {
  id: string;           // unique dungeon ID
  name: string;
  /** The chunk + tile where this dungeon entrance is on the overworld */
  entranceChunkX: number;
  entranceChunkY: number;
  entranceTileX: number;
  entranceTileY: number;
  /** The interior map (same 20×15 grid) */
  mapData: Terrain[][];
  /** Player spawn position when entering */
  spawnX: number;
  spawnY: number;
}

export interface ChestData {
  id: string;         // unique chest ID (used to track opened state)
  itemId: string;     // the item inside
  x: number;          // tile position
  y: number;
  /** For overworld chests: which chunk. For dungeon chests: which dungeon ID */
  location: { type: "overworld"; chunkX: number; chunkY: number }
          | { type: "dungeon"; dungeonId: string };
}

/** Colors for each terrain type (used for procedural rendering). */
export const TERRAIN_COLORS: Record<Terrain, number> = {
  [Terrain.Grass]: 0x4caf50,
  [Terrain.Forest]: 0x2e7d32,
  [Terrain.Mountain]: 0x795548,
  [Terrain.Water]: 0x2196f3,
  [Terrain.Sand]: 0xfdd835,
  [Terrain.Town]: 0xff9800,
  [Terrain.Dungeon]: 0x616161,
  [Terrain.Boss]: 0xd32f2f,
  [Terrain.Path]: 0xbcaaa4,
  [Terrain.DungeonFloor]: 0x555555,
  [Terrain.DungeonWall]: 0x222222,
  [Terrain.DungeonExit]: 0x66bb6a,
  [Terrain.Chest]: 0xffc107,
};

/** Encounter rates per terrain (0 = no encounters). */
export const ENCOUNTER_RATES: Record<Terrain, number> = {
  [Terrain.Grass]: 0.08,
  [Terrain.Forest]: 0.15,
  [Terrain.Mountain]: 0.12,
  [Terrain.Water]: 0,
  [Terrain.Sand]: 0.06,
  [Terrain.Town]: 0,
  [Terrain.Dungeon]: 0.2,
  [Terrain.Boss]: 0,
  [Terrain.Path]: 0.04,
  [Terrain.DungeonFloor]: 0.12,
  [Terrain.DungeonWall]: 0,
  [Terrain.DungeonExit]: 0,
  [Terrain.Chest]: 0,
};

/** Tile dimensions of each chunk. */
export const MAP_WIDTH = 20;
export const MAP_HEIGHT = 15;

/** World dimensions in chunks. */
export const WORLD_WIDTH = 3;
export const WORLD_HEIGHT = 3;

/*
 * Edge connectivity convention:
 *   North/South exits: walkable at columns 8-11
 *   East/West exits:   walkable at rows 5-9
 */

// ──────────────────────────────────────────────────────────────────
// Chunk (0,0) — Mountain Peak
// Features: Dungeon at (7,6). Exits: East, South.
// ──────────────────────────────────────────────────────────────────
// prettier-ignore
const CHUNK_0_0: Terrain[][] = [
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 2, 2, 0, 0, 1, 1, 0, 0, 2, 2, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 2, 0, 0, 8, 0, 0, 8, 0, 0, 2, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 0, 0, 1, 8, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0],
  [2, 2, 2, 2, 0, 0, 1, 6, 8, 0, 0, 8, 0, 0, 1, 0, 0, 0, 0, 0],
  [2, 2, 2, 2, 0, 0, 1, 1, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 0],
  [2, 2, 2, 2, 0, 0, 1, 0, 8, 0, 0, 8, 0, 0, 1, 0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2, 0, 0, 0, 8, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2, 2, 0, 0, 8, 0, 0, 8, 0, 0, 2, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 2, 2, 0, 8, 1, 1, 8, 0, 2, 2, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 2, 2, 2, 8, 8, 8, 8, 2, 2, 2, 2, 2, 2, 2, 2],
];

// ──────────────────────────────────────────────────────────────────
// Chunk (1,0) — Northern Forest
// Features: Troll boss at (10,7). Exits: West, East, South.
// ──────────────────────────────────────────────────────────────────
// prettier-ignore
const CHUNK_1_0: Terrain[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1],
  [1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1],
  [1, 0, 0, 1, 0, 0, 0, 0, 8, 0, 0, 8, 0, 0, 0, 0, 1, 0, 0, 1],
  [1, 0, 1, 1, 0, 0, 0, 8, 8, 0, 0, 8, 8, 0, 0, 0, 1, 1, 0, 1],
  [0, 0, 0, 1, 0, 0, 8, 8, 0, 1, 1, 0, 8, 8, 0, 0, 1, 0, 0, 0],
  [0, 0, 1, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0, 1, 0, 0],
  [0, 8, 8, 8, 8, 8, 0, 0, 0, 0, 7, 0, 0, 0, 8, 8, 8, 8, 8, 0],
  [0, 0, 1, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0, 1, 0, 0],
  [0, 0, 0, 1, 0, 0, 8, 8, 0, 1, 1, 0, 8, 8, 0, 0, 1, 0, 0, 0],
  [1, 0, 1, 1, 0, 0, 0, 8, 8, 0, 0, 8, 8, 0, 0, 0, 1, 1, 0, 1],
  [1, 0, 0, 1, 0, 0, 0, 0, 8, 0, 0, 8, 0, 0, 0, 0, 1, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1],
  [1, 1, 0,12, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1],
];

// ──────────────────────────────────────────────────────────────────
// Chunk (2,0) — Misty Highlands
// Features: Wilderness. Exits: West, South.
// ──────────────────────────────────────────────────────────────────
// prettier-ignore
const CHUNK_2_0: Terrain[][] = [
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [2, 2, 1, 1, 2, 2, 2, 1, 0, 0, 0, 1, 2, 2, 2, 1, 1, 2, 2, 2],
  [2, 1, 1, 0, 0, 2, 1, 0, 0, 1, 1, 0, 0, 1, 2, 0, 0, 1, 1, 2],
  [2, 1, 0, 0, 0, 0, 0, 0, 8, 0, 0, 8, 0, 0, 0, 0, 0, 0, 1, 2],
  [2, 0, 0, 1, 0, 0, 0, 0, 8, 0, 0, 8, 0, 0, 0, 0, 1, 0, 0, 2],
  [0, 0, 0, 1, 0, 0, 0, 8, 8, 1, 1, 8, 8, 0, 0, 0, 1, 0, 0, 2],
  [0, 0, 1, 0, 0, 1, 8, 8, 0, 0, 0, 0, 8, 8, 1, 0, 0, 1, 0, 2],
  [0, 8, 8, 8, 8, 8, 8, 0, 0, 1, 1, 0, 0, 8, 8, 8, 8, 8, 0, 2],
  [0, 0, 1, 0, 0, 1, 8, 8, 0, 0, 0, 0, 8, 8, 1, 0, 0, 1, 0, 2],
  [0, 0, 0, 1, 0, 0, 0, 8, 8, 1, 1, 8, 8, 0, 0, 0, 1, 0, 0, 2],
  [2, 0, 0, 1, 0, 0, 0, 0, 8, 0, 0, 8, 0, 0, 0, 0, 1, 0, 0, 2],
  [2, 1, 0, 0, 0, 0, 0, 0, 8, 0, 0, 8, 0, 0, 0, 0, 0, 0, 1, 2],
  [2, 1, 1, 0, 0, 2, 1, 0, 0, 1, 1, 0, 0, 1, 2, 0, 0, 1, 1, 2],
  [2, 2, 1, 1, 2, 2, 2, 1, 0, 0, 0, 1, 2, 2, 2, 1, 1, 2, 2, 2],
  [2, 2, 2, 2, 2, 2, 2, 2, 8, 8, 8, 8, 2, 2, 2, 2, 2, 2, 2, 2],
];

// ──────────────────────────────────────────────────────────────────
// Chunk (0,1) — Western Plains / Ironhold
// Features: Ironhold at (5,7). Exits: North, East, South.
// ──────────────────────────────────────────────────────────────────
// prettier-ignore
const CHUNK_0_1: Terrain[][] = [
  [2, 2, 2, 2, 2, 2, 2, 2, 8, 8, 8, 8, 2, 2, 2, 2, 2, 2, 2, 2],
  [2, 0, 0, 0, 1, 0, 0, 0, 8, 0, 0, 8, 0, 0, 1, 0, 0, 0, 0, 2],
  [2, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 2],
  [2, 0, 0, 1, 0, 0, 0, 8, 8, 0, 0, 8, 8, 0, 0, 0, 1, 0, 0, 2],
  [0, 0, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0],
  [0, 8, 8, 8, 8, 5, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 0],
  [0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0],
  [0, 0, 1, 0, 0, 0, 8, 8, 0, 0, 0, 0, 8, 8, 0, 0, 0, 1, 0, 2],
  [2, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0, 2],
  [2, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 2],
  [2, 0, 0, 0, 1, 0, 0, 0, 8, 0, 0, 8, 0, 0, 1, 0, 0, 0, 0, 2],
  [2, 2, 2, 2, 2, 2, 2, 2, 8, 8, 8, 8, 2, 2, 2, 2, 2, 2, 2, 2],
];

// ──────────────────────────────────────────────────────────────────
// Chunk (1,1) — Central Heartlands (Starting Area)
// Features: Willowdale at (2,2), Dungeon at (16,2). Exits: all four.
// Modified from the original single map — other towns/bosses moved out.
// ──────────────────────────────────────────────────────────────────
// prettier-ignore
const CHUNK_1_1: Terrain[][] = [
  [2, 2, 2, 2, 2, 2, 3, 3, 8, 8, 8, 8, 3, 2, 2, 2, 2, 2, 2, 2],
  [2, 1, 1, 0, 0, 0, 3, 3, 4, 4, 4, 4, 3, 0, 0, 1, 1, 1, 2, 2],
  [2, 1, 5, 8, 0, 1, 0, 3, 4, 4, 4, 4, 3, 0, 1, 1, 6, 1, 1, 2],
  [2, 0, 8, 0, 0, 1, 0, 0, 3, 4, 4, 3, 0, 0, 0, 8, 8, 0, 0, 2],
  [0, 0, 8, 0, 1, 1, 0, 0, 0, 3, 3, 0, 0, 1, 0, 0, 8, 0, 0, 0],
  [0, 0, 8, 8, 8, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 8, 0, 0, 0],
  [0, 0, 0, 0, 8, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0, 0],
  [0, 0, 0, 0, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 0, 0, 0],
  [0, 0, 1, 0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
  [0, 1, 1, 0, 0, 0, 0, 0, 8, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 0],
  [0, 1, 0, 0, 0, 8, 8, 8, 8, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0],
  [2, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 2],
  [2, 0, 0, 1, 1, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 1, 0, 0, 0, 2],
  [2, 2, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 2, 2],
  [2, 2, 2, 2, 1, 1, 2, 2, 0, 0, 0, 0, 2, 2, 1, 1, 2, 2, 2, 2],
];

// ──────────────────────────────────────────────────────────────────
// Chunk (2,1) — Eastern Desert / Sandport
// Features: Sandport at (12,6). Exits: West, North, South.
// ──────────────────────────────────────────────────────────────────
// prettier-ignore
const CHUNK_2_1: Terrain[][] = [
  [2, 2, 4, 4, 4, 4, 4, 4, 8, 8, 8, 8, 4, 4, 4, 4, 4, 4, 2, 2],
  [4, 4, 4, 4, 4, 4, 4, 4, 8, 4, 4, 8, 4, 4, 4, 4, 4, 4, 4, 4],
  [4, 4, 4, 4, 0, 3, 0, 4, 8, 4, 4, 8, 4, 4, 4, 4, 4, 4, 4, 4],
  [4, 4, 4, 0, 3, 3, 0, 4, 8, 4, 4, 8, 4, 4, 0, 3, 0, 4, 4, 4],
  [4, 4, 4, 0, 3, 0, 0, 8, 8, 4, 4, 8, 8, 0, 3, 3, 0, 4, 4, 4],
  [0, 0, 4, 4, 0, 0, 8, 8, 4, 4, 4, 4, 8, 8, 0, 3, 0, 4, 4, 4],
  [0, 0, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 5, 8, 4, 0, 0, 4, 4, 4],
  [0, 8, 8, 8, 8, 8, 4, 4, 4, 4, 4, 4, 8, 8, 8, 8, 8, 4, 4, 4],
  [0, 0, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 8, 4, 4, 4, 4, 4, 4, 4],
  [0, 0, 4, 4, 4, 4, 8, 8, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4],
  [4, 4, 4, 0, 3, 0, 4, 8, 8, 4, 4, 8, 4, 4, 0, 3, 0, 4, 4, 4],
  [4, 4, 0, 3, 3, 0, 4, 4, 8, 4, 4, 8, 4, 0, 3, 3, 0, 4, 4, 4],
  [4, 4, 0, 3, 0, 0, 4, 4, 8, 4, 4, 8, 4, 0, 0, 3, 0, 4, 4, 4],
  [4, 4, 4, 0, 0, 4, 4, 4, 8, 4, 4, 8, 4, 4, 0, 0, 4, 4, 4, 4],
  [4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4],
];

// ──────────────────────────────────────────────────────────────────
// Chunk (0,2) — Marshlands
// Features: Wilderness / swamp. Exits: North, East.
// ──────────────────────────────────────────────────────────────────
// prettier-ignore
const CHUNK_0_2: Terrain[][] = [
  [2, 2, 2, 2, 2, 2, 2, 2, 8, 8, 8, 8, 2, 2, 2, 2, 2, 2, 2, 2],
  [2, 0, 0, 3, 0, 0, 3, 0, 8, 0, 0, 8, 0, 3, 0, 0, 3, 0, 0, 2],
  [2, 0, 3, 3, 0, 0, 0, 0, 8, 0, 0, 8, 0, 0, 0, 3, 3, 0, 0, 2],
  [2, 0, 0, 3, 0, 0, 0, 8, 8, 0, 0, 8, 8, 0, 0, 0, 3, 0, 0, 2],
  [2, 0, 0, 0, 0, 3, 8, 8, 0, 0, 0, 0, 8, 8, 3, 0, 0, 0, 0, 0],
  [2, 0, 3, 0, 0, 8, 8, 0, 0, 3, 3, 0, 0, 8, 8, 0, 0, 3, 0, 0],
  [2, 0, 0, 0, 8, 8, 0, 0, 3, 3, 3, 3, 0, 0, 8, 8, 0, 0, 0, 0],
  [2, 0, 3, 8, 8, 0, 0, 3, 3, 0, 0, 3, 3, 0, 0, 8, 8, 8, 8, 0],
  [2, 0, 0, 0, 8, 8, 0, 0, 3, 3, 3, 3, 0, 0, 8, 8, 0, 0, 0, 0],
  [2, 0, 3, 0, 0, 8, 8, 0, 0, 3, 3, 0, 0, 8, 8, 0, 0, 3, 0, 0],
  [2, 0, 0, 0, 0, 3, 8, 8, 0, 0, 0, 0, 8, 8, 3, 0, 0, 0, 0, 2],
  [2, 0, 0, 3, 0, 0, 0, 8, 8, 0, 0, 8, 8, 0, 0, 0, 3, 0, 0, 2],
  [2, 0, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 0, 0, 2],
  [2, 0, 0, 3, 0, 0, 3, 0, 0, 0, 0, 0, 0, 3, 0, 0, 3, 0, 0, 2],
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
];

// ──────────────────────────────────────────────────────────────────
// Chunk (1,2) — Southern Forest / Thornvale
// Features: Thornvale at (10,7). Exits: North, West, East.
// ──────────────────────────────────────────────────────────────────
// prettier-ignore
const CHUNK_1_2: Terrain[][] = [
  [1, 1, 1, 1, 1, 2, 2, 2, 0, 0, 0, 0, 2, 2, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 1, 1, 0, 0, 8, 0, 0, 8, 0, 0, 1, 1, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 1, 0, 0, 0, 8, 8, 0, 0, 8, 8, 0, 0, 0, 1, 0, 0, 1],
  [1, 0, 1, 1, 0, 0, 8, 8, 0, 0, 0, 0, 8, 8, 0, 0, 1, 1, 0, 1],
  [0, 0, 0, 0, 0, 8, 8, 0, 0, 1, 1, 0, 0, 8, 8, 0, 0, 0, 0, 0],
  [0, 0, 1, 0, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 0, 1, 0, 0],
  [0, 8, 8, 8, 8, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 8, 8, 8, 8, 0],
  [0, 0, 1, 0, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 0, 1, 0, 0],
  [0, 0, 0, 0, 0, 8, 8, 0, 0, 1, 1, 0, 0, 8, 8, 0, 0, 0, 0, 0],
  [1, 0, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 1, 0, 0, 0, 8, 8, 0, 0, 8, 8, 0, 0, 0, 1, 0, 0, 1],
  [1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1],
  [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1],
];

// ──────────────────────────────────────────────────────────────────
// Chunk (2,2) — Dragon's Domain
// Features: Dragon boss at (10,7). Exits: West, North.
// ──────────────────────────────────────────────────────────────────
// prettier-ignore
const CHUNK_2_2: Terrain[][] = [
  [2, 2, 2, 2, 4, 4, 4, 4, 8, 8, 8, 8, 4, 4, 4, 4, 2, 2, 2, 2],
  [2, 4, 4, 4, 4, 4, 4, 4, 8, 4, 4, 8, 4, 4, 4, 4, 4, 4, 4, 2],
  [2, 4, 4, 2, 4, 4, 4, 4, 8, 4, 4, 8, 4, 4, 4, 2, 4, 4, 4, 2],
  [2, 4, 2, 2, 4, 4, 4, 8, 8, 4, 4, 8, 8, 4, 4, 2, 2, 4, 4, 2],
  [2, 4, 4, 2, 4, 4, 8, 8, 0, 0, 0, 0, 8, 8, 4, 4, 2, 4, 4, 2],
  [0, 0, 4, 4, 4, 8, 8, 0, 0, 0, 0, 0, 0, 8, 8, 4, 4, 4, 4, 2],
  [0, 0, 4, 4, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 4, 4, 2, 2],
  [0, 8, 8, 8, 8, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 8, 8, 2, 2, 2],
  [0, 0, 4, 4, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 4, 4, 2, 2],
  [0, 0, 4, 4, 4, 8, 8, 0, 0, 0, 0, 0, 0, 8, 8, 4, 4, 4, 4, 2],
  [2, 4, 4, 2, 4, 4, 8, 8, 0, 0, 0, 0, 8, 8, 4, 4, 2, 4, 4, 2],
  [2, 4, 2, 2, 4, 4, 4, 8, 8, 4, 4, 8, 8, 4, 4, 2, 2, 4, 4, 2],
  [2, 4, 4, 2, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 2, 4, 4, 4, 2],
  [2, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 2],
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
];

// ══════════════════════════════════════════════════════════════════
// Dungeon Interior Maps
// ══════════════════════════════════════════════════════════════════

// W = DungeonWall (10), F = DungeonFloor (9), E = DungeonExit (11), C = Chest (12)
const W = Terrain.DungeonWall;
const F = Terrain.DungeonFloor;
const E = Terrain.DungeonExit;
const C = Terrain.Chest;

// prettier-ignore
const DUNGEON_HEARTLANDS: Terrain[][] = [
  [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
  [W, F, F, W, F, F, F, F, F, W, F, F, F, F, F, F, W, F, C, W],
  [W, F, F, W, F, W, W, W, F, W, F, W, W, W, W, F, W, F, F, W],
  [W, F, F, W, F, W, F, F, F, F, F, F, F, W, F, F, W, F, F, W],
  [W, F, W, W, F, W, F, W, W, W, W, W, F, W, F, W, W, F, F, W],
  [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W],
  [W, W, W, F, W, W, W, F, W, W, W, W, F, W, W, W, F, W, W, W],
  [W, F, F, F, F, F, F, F, W, C, F, W, F, F, F, F, F, F, F, W],
  [W, F, W, W, F, W, W, F, W, F, F, W, F, W, W, F, W, W, F, W],
  [W, F, F, F, F, W, F, F, F, F, F, F, F, F, W, F, F, F, F, W],
  [W, W, W, F, W, W, F, W, W, W, W, W, W, F, W, W, F, W, W, W],
  [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W],
  [W, F, W, W, W, F, W, W, W, F, F, W, W, W, F, W, W, W, F, W],
  [W, E, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, C, F, W],
  [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
];

/** All dungeon interiors in the game. */
export const DUNGEONS: DungeonData[] = [
  {
    id: "heartlands_dungeon",
    name: "Heartlands Crypt",
    entranceChunkX: 1,
    entranceChunkY: 1,
    entranceTileX: 16,
    entranceTileY: 2,
    mapData: DUNGEON_HEARTLANDS,
    spawnX: 1,
    spawnY: 13,
  },
];

/** All treasure chests in the game. */
export const CHESTS: ChestData[] = [
  // Dungeon chests — inside Heartlands Crypt
  { id: "crypt_flame",   itemId: "flameBlade",     x: 18, y: 1,  location: { type: "dungeon", dungeonId: "heartlands_dungeon" } },
  { id: "crypt_guardian", itemId: "cryptGuardian", x: 9,  y: 7,  location: { type: "dungeon", dungeonId: "heartlands_dungeon" } },
  { id: "crypt_frost",   itemId: "frostfang",      x: 17, y: 13, location: { type: "dungeon", dungeonId: "heartlands_dungeon" } },
  // Overworld chest — hidden in Northern Forest
  { id: "forest_shadow", itemId: "shadowCloak",    x: 3,  y: 13, location: { type: "overworld", chunkX: 1, chunkY: 0 } },
];

/** Get a chest at the given position. */
export function getChestAt(
  x: number,
  y: number,
  location: { type: "overworld"; chunkX: number; chunkY: number } | { type: "dungeon"; dungeonId: string }
): ChestData | undefined {
  return CHESTS.find((c) => {
    if (c.x !== x || c.y !== y) return false;
    if (c.location.type !== location.type) return false;
    if (c.location.type === "overworld" && location.type === "overworld") {
      return c.location.chunkX === location.chunkX && c.location.chunkY === location.chunkY;
    }
    if (c.location.type === "dungeon" && location.type === "dungeon") {
      return c.location.dungeonId === location.dungeonId;
    }
    return false;
  });
}

/** Get a dungeon by its overworld entrance location. */
export function getDungeonAt(
  cx: number,
  cy: number,
  x: number,
  y: number
): DungeonData | undefined {
  return DUNGEONS.find(
    (d) =>
      d.entranceChunkX === cx &&
      d.entranceChunkY === cy &&
      d.entranceTileX === x &&
      d.entranceTileY === y
  );
}

/** Get a dungeon by its ID. */
export function getDungeon(id: string): DungeonData | undefined {
  return DUNGEONS.find((d) => d.id === id);
}

// ══════════════════════════════════════════════════════════════════
// World grid — WORLD_CHUNKS[chunkY][chunkX]
// ══════════════════════════════════════════════════════════════════

export const WORLD_CHUNKS: WorldChunk[][] = [
  // Row 0 (north)
  [
    {
      name: "Mountain Peak",
      mapData: CHUNK_0_0,
      towns: [],
      bosses: [],
    },
    {
      name: "Northern Forest",
      mapData: CHUNK_1_0,
      towns: [],
      bosses: [{ name: "Cave Troll", monsterId: "troll", x: 10, y: 7 }],
    },
    {
      name: "Misty Highlands",
      mapData: CHUNK_2_0,
      towns: [],
      bosses: [],
    },
  ],
  // Row 1 (middle)
  [
    {
      name: "Western Plains",
      mapData: CHUNK_0_1,
      towns: [
        {
          name: "Ironhold",
          x: 5,
          y: 7,
          hasShop: true,
          shopItems: ["greaterPotion", "ether", "greatSword", "plateArmor", "towerShield"],
        },
      ],
      bosses: [],
    },
    {
      name: "Heartlands",
      mapData: CHUNK_1_1,
      towns: [
        {
          name: "Willowdale",
          x: 2,
          y: 2,
          hasShop: true,
          shopItems: ["potion", "ether", "shortSword", "leatherArmor", "woodenShield", "dungeonKey"],
        },
      ],
      bosses: [],
    },
    {
      name: "Eastern Desert",
      mapData: CHUNK_2_1,
      towns: [
        {
          name: "Sandport",
          x: 12,
          y: 6,
          hasShop: true,
          shopItems: ["potion", "greaterPotion", "longSword", "chainMail", "ironShield"],
        },
      ],
      bosses: [],
    },
  ],
  // Row 2 (south)
  [
    {
      name: "Marshlands",
      mapData: CHUNK_0_2,
      towns: [],
      bosses: [],
    },
    {
      name: "Southern Forest",
      mapData: CHUNK_1_2,
      towns: [
        {
          name: "Thornvale",
          x: 10,
          y: 7,
          hasShop: true,
          shopItems: ["potion", "ether", "greaterPotion", "longSword", "chainMail", "ironShield"],
        },
      ],
      bosses: [],
    },
    {
      name: "Dragon's Domain",
      mapData: CHUNK_2_2,
      towns: [],
      bosses: [{ name: "Young Red Dragon", monsterId: "dragon", x: 10, y: 7 }],
    },
  ],
];

// ══════════════════════════════════════════════════════════════════
// Helper functions
// ══════════════════════════════════════════════════════════════════

/** Get a chunk by its world coordinates. Returns undefined for invalid positions. */
export function getChunk(cx: number, cy: number): WorldChunk | undefined {
  if (cx < 0 || cx >= WORLD_WIDTH || cy < 0 || cy >= WORLD_HEIGHT) return undefined;
  return WORLD_CHUNKS[cy][cx];
}

/** Check if a terrain is walkable. */
export function isWalkable(terrain: Terrain): boolean {
  return terrain !== Terrain.Water && terrain !== Terrain.Mountain && terrain !== Terrain.DungeonWall;
}

/** Get terrain at a tile position within a chunk. Returns undefined if out of bounds. */
export function getTerrainAt(
  cx: number,
  cy: number,
  x: number,
  y: number
): Terrain | undefined {
  const chunk = getChunk(cx, cy);
  if (!chunk) return undefined;
  if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return undefined;
  return chunk.mapData[y][x];
}

/** Get all towns across the entire world. Includes chunk coordinates. */
export function getAllTowns(): Array<TownData & { chunkX: number; chunkY: number }> {
  const result: Array<TownData & { chunkX: number; chunkY: number }> = [];
  for (let cy = 0; cy < WORLD_HEIGHT; cy++) {
    for (let cx = 0; cx < WORLD_WIDTH; cx++) {
      const chunk = WORLD_CHUNKS[cy][cx];
      for (const town of chunk.towns) {
        result.push({ ...town, chunkX: cx, chunkY: cy });
      }
    }
  }
  return result;
}

/** Get all bosses across the entire world. Includes chunk coordinates. */
export function getAllBosses(): Array<BossData & { chunkX: number; chunkY: number }> {
  const result: Array<BossData & { chunkX: number; chunkY: number }> = [];
  for (let cy = 0; cy < WORLD_HEIGHT; cy++) {
    for (let cx = 0; cx < WORLD_WIDTH; cx++) {
      const chunk = WORLD_CHUNKS[cy][cx];
      for (const boss of chunk.bosses) {
        result.push({ ...boss, chunkX: cx, chunkY: cy });
      }
    }
  }
  return result;
}

/** Region accent colors for the world map overlay. */
export const REGION_COLORS: Record<string, number> = {
  "Mountain Peak": 0x795548,
  "Northern Forest": 0x2e7d32,
  "Misty Highlands": 0x607d8b,
  "Western Plains": 0x8bc34a,
  "Heartlands": 0x4caf50,
  "Eastern Desert": 0xfdd835,
  "Marshlands": 0x00796b,
  "Southern Forest": 0x388e3c,
  "Dragon's Domain": 0xd32f2f,
};
