/**
 * Overworld map data — multi-chunk world system.
 * The world is a 10x9 grid of 20x15-tile chunks (10x the original 3x3).
 * New biomes: tundra, swamp, deep forest, volcanic regions, canyons.
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
  type: "weapon" | "armor" | "magic" | "inn" | "bank" | "general";
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

/** Colors for each terrain type (used for procedural rendering). */
export const TERRAIN_COLORS: Record<Terrain, number> = {
  [Terrain.Grass]: 0x4caf50,
  [Terrain.Forest]: 0x2e7d32,
  [Terrain.Mountain]: 0x795548,
  [Terrain.Water]: 0x2196f3,
  [Terrain.Sand]: 0xfdd835,
  [Terrain.Town]: 0xab47bc,
  [Terrain.Dungeon]: 0x616161,
  [Terrain.Boss]: 0xd32f2f,
  [Terrain.Path]: 0xbcaaa4,
  [Terrain.DungeonFloor]: 0x555555,
  [Terrain.DungeonWall]: 0x222222,
  [Terrain.DungeonExit]: 0x66bb6a,
  [Terrain.Chest]: 0xffc107,
  [Terrain.Tundra]: 0xb0bec5,
  [Terrain.Swamp]: 0x558b2f,
  [Terrain.DeepForest]: 0x1b5e20,
  [Terrain.Volcanic]: 0xbf360c,
  [Terrain.Canyon]: 0xa1887f,
  [Terrain.MinorTreasure]: 0x4fc3f7,
  [Terrain.CityFloor]: 0xbcaaa4,
  [Terrain.CityWall]: 0x5d4037,
  [Terrain.CityExit]: 0x66bb6a,
  [Terrain.Carpet]: 0x8b1a1a,
  [Terrain.Well]: 0x607d8b,
  [Terrain.Fountain]: 0x4fc3f7,
  [Terrain.Crate]: 0x8d6e63,
  [Terrain.Barrel]: 0x6d4c41,
  [Terrain.ShopFloor]: 0xa1887f,
  [Terrain.Temple]: 0xd4af37,
  [Terrain.Statue]: 0x9e9e9e,
  [Terrain.River]: 0x42a5f5,
  [Terrain.Mill]: 0x8d6e63,
  [Terrain.CropField]: 0xaed581,
  [Terrain.Fence]: 0x795548,
  [Terrain.House]: 0x6d4c41,
  [Terrain.Flower]: 0x4caf50,
  [Terrain.Cactus]: 0x558b2f,
  [Terrain.Geyser]: 0x90a4ae,
  [Terrain.Mushroom]: 0x558b2f,
  [Terrain.Casino]: 0xdaa520,
  [Terrain.CityPath]: 0x9e9e9e,
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
  [Terrain.Tundra]: 0.07,
  [Terrain.Swamp]: 0.18,
  [Terrain.DeepForest]: 0.2,
  [Terrain.Volcanic]: 0,
  [Terrain.Canyon]: 0.1,
  [Terrain.MinorTreasure]: 0,
  [Terrain.CityFloor]: 0,
  [Terrain.CityWall]: 0,
  [Terrain.CityExit]: 0,
  [Terrain.Carpet]: 0,
  [Terrain.Well]: 0,
  [Terrain.Fountain]: 0,
  [Terrain.Crate]: 0,
  [Terrain.Barrel]: 0,
  [Terrain.ShopFloor]: 0,
  [Terrain.Temple]: 0,
  [Terrain.Statue]: 0,
  [Terrain.River]: 0,
  [Terrain.Mill]: 0,
  [Terrain.CropField]: 0,
  [Terrain.Fence]: 0,
  [Terrain.House]: 0,
  [Terrain.Flower]: 0.06,
  [Terrain.Cactus]: 0.05,
  [Terrain.Geyser]: 0,
  [Terrain.Mushroom]: 0.08,
  [Terrain.Casino]: 0,
  [Terrain.CityPath]: 0,
};

export const MAP_WIDTH = 20;
export const MAP_HEIGHT = 15;
export const WORLD_WIDTH = 10;
export const WORLD_HEIGHT = 9;

/** Check if a terrain is walkable. */
export function isWalkable(terrain: Terrain): boolean {
  return (
    terrain !== Terrain.Water &&
    terrain !== Terrain.Mountain &&
    terrain !== Terrain.DungeonWall &&
    terrain !== Terrain.Volcanic &&
    terrain !== Terrain.CityWall &&
    terrain !== Terrain.Well &&
    terrain !== Terrain.Fountain &&
    terrain !== Terrain.Crate &&
    terrain !== Terrain.Barrel &&
    terrain !== Terrain.Temple &&
    terrain !== Terrain.Statue &&
    terrain !== Terrain.River &&
    terrain !== Terrain.Mill &&
    terrain !== Terrain.Fence &&
    terrain !== Terrain.House &&
    terrain !== Terrain.Geyser &&
    terrain !== Terrain.Casino
  );
}

/** Terrain types that should not be replaced by road diversification or treasure placement. */
function isSpecialTerrain(t: Terrain): boolean {
  return t === Terrain.Town || t === Terrain.Boss || t === Terrain.Dungeon ||
    t === Terrain.Chest || t === Terrain.DungeonExit || t === Terrain.DungeonFloor ||
    t === Terrain.DungeonWall || t === Terrain.Water || t === Terrain.Mountain ||
    t === Terrain.Volcanic ||
    t === Terrain.CityFloor || t === Terrain.CityWall || t === Terrain.CityExit ||
    t === Terrain.Carpet || t === Terrain.Well || t === Terrain.Fountain ||
    t === Terrain.Crate || t === Terrain.Barrel || t === Terrain.ShopFloor ||
    t === Terrain.Temple || t === Terrain.Statue ||
    t === Terrain.River || t === Terrain.Mill || t === Terrain.CropField ||
    t === Terrain.Fence || t === Terrain.House ||
    t === Terrain.Flower || t === Terrain.Cactus || t === Terrain.Geyser || t === Terrain.Mushroom ||
    t === Terrain.Casino || t === Terrain.CityPath;
}

const dW = Terrain.DungeonWall;
const dF = Terrain.DungeonFloor;
const dE = Terrain.DungeonExit;
const dC = Terrain.Chest;

// prettier-ignore
const HEARTLANDS_CRYPT_INTERIOR: Terrain[][] = [
  [dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW],
  [dW,dF,dF,dW,dF,dF,dF,dF,dF,dW,dF,dF,dF,dF,dF,dF,dW,dF,dC,dW],
  [dW,dF,dF,dW,dF,dW,dW,dW,dF,dW,dF,dW,dW,dW,dW,dF,dW,dF,dF,dW],
  [dW,dF,dF,dW,dF,dW,dF,dF,dF,dF,dF,dF,dF,dW,dF,dF,dW,dF,dF,dW],
  [dW,dF,dW,dW,dF,dW,dF,dW,dW,dW,dW,dW,dF,dW,dF,dW,dW,dF,dF,dW],
  [dW,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dW],
  [dW,dW,dW,dF,dW,dW,dW,dF,dW,dW,dW,dW,dF,dW,dW,dW,dF,dW,dW,dW],
  [dW,dF,dF,dF,dF,dF,dF,dF,dW,dC,dF,dW,dF,dF,dF,dF,dF,dF,dF,dW],
  [dW,dF,dW,dW,dF,dW,dW,dF,dW,dF,dF,dW,dF,dW,dW,dF,dW,dW,dF,dW],
  [dW,dF,dF,dF,dF,dW,dF,dF,dF,dF,dF,dF,dF,dF,dW,dF,dF,dF,dF,dW],
  [dW,dW,dW,dF,dW,dW,dF,dW,dW,dW,dW,dW,dW,dF,dW,dW,dF,dW,dW,dW],
  [dW,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dW],
  [dW,dF,dW,dW,dW,dF,dW,dW,dW,dF,dF,dW,dW,dW,dF,dW,dW,dW,dF,dW],
  [dW,dE,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dC,dF,dW],
  [dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW],
];

// prettier-ignore
const FROST_CAVERN_INTERIOR: Terrain[][] = [
  [dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW],
  [dW,dF,dF,dF,dW,dF,dF,dF,dF,dW,dF,dF,dF,dF,dW,dF,dF,dC,dF,dW],
  [dW,dF,dW,dF,dW,dF,dW,dW,dF,dW,dF,dW,dW,dF,dW,dF,dW,dW,dF,dW],
  [dW,dF,dW,dF,dF,dF,dF,dW,dF,dF,dF,dF,dW,dF,dF,dF,dW,dF,dF,dW],
  [dW,dF,dW,dW,dW,dW,dF,dW,dW,dW,dW,dF,dW,dW,dW,dF,dW,dF,dW,dW],
  [dW,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dW],
  [dW,dW,dW,dF,dW,dW,dW,dF,dW,dW,dW,dW,dF,dW,dW,dF,dW,dW,dW,dW],
  [dW,dF,dF,dF,dF,dF,dF,dF,dW,dC,dF,dW,dF,dF,dF,dF,dF,dF,dF,dW],
  [dW,dF,dW,dW,dF,dW,dW,dF,dW,dF,dF,dW,dF,dW,dW,dF,dW,dW,dF,dW],
  [dW,dF,dF,dF,dF,dW,dF,dF,dF,dF,dF,dF,dF,dW,dF,dF,dF,dF,dF,dW],
  [dW,dW,dW,dF,dW,dW,dF,dW,dW,dW,dW,dW,dF,dW,dW,dF,dW,dW,dW,dW],
  [dW,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dW],
  [dW,dF,dW,dW,dW,dF,dW,dW,dW,dF,dF,dW,dW,dW,dF,dW,dW,dW,dF,dW],
  [dW,dE,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dC,dF,dF,dW],
  [dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW],
];

// prettier-ignore
const VOLCANIC_FORGE_INTERIOR: Terrain[][] = [
  [dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW],
  [dW,dF,dF,dF,dW,dF,dF,dF,dW,dF,dF,dW,dF,dF,dF,dW,dF,dF,dC,dW],
  [dW,dF,dW,dF,dW,dF,dW,dF,dW,dF,dF,dW,dF,dW,dF,dW,dF,dW,dF,dW],
  [dW,dF,dW,dF,dF,dF,dW,dF,dF,dF,dF,dF,dF,dW,dF,dF,dF,dW,dF,dW],
  [dW,dF,dW,dW,dW,dF,dW,dW,dW,dF,dF,dW,dW,dW,dF,dW,dW,dW,dF,dW],
  [dW,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dW],
  [dW,dW,dF,dW,dW,dW,dF,dW,dW,dW,dW,dW,dF,dW,dW,dW,dF,dW,dW,dW],
  [dW,dF,dF,dF,dF,dF,dF,dF,dF,dC,dF,dF,dF,dF,dF,dF,dF,dF,dF,dW],
  [dW,dW,dF,dW,dW,dW,dF,dW,dW,dF,dF,dW,dW,dF,dW,dW,dF,dW,dW,dW],
  [dW,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dW],
  [dW,dW,dW,dF,dW,dW,dW,dF,dW,dW,dW,dW,dF,dW,dW,dW,dF,dW,dW,dW],
  [dW,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dW],
  [dW,dF,dW,dW,dW,dF,dW,dW,dF,dF,dF,dF,dW,dW,dF,dW,dW,dW,dF,dW],
  [dW,dE,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dC,dF,dW],
  [dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW],
];

export const DUNGEONS: DungeonData[] = [
  { id: "heartlands_dungeon", name: "Heartlands Crypt", entranceChunkX: 4, entranceChunkY: 2, entranceTileX: 16, entranceTileY: 2, mapData: HEARTLANDS_CRYPT_INTERIOR, spawnX: 1, spawnY: 13 },
  { id: "frost_cavern", name: "Frost Cavern", entranceChunkX: 2, entranceChunkY: 0, entranceTileX: 14, entranceTileY: 5, mapData: FROST_CAVERN_INTERIOR, spawnX: 1, spawnY: 13 },
  { id: "volcanic_forge", name: "Volcanic Forge", entranceChunkX: 6, entranceChunkY: 5, entranceTileX: 14, entranceTileY: 5, mapData: VOLCANIC_FORGE_INTERIOR, spawnX: 1, spawnY: 13 },
];

// ─── City Interior Maps ─────────────────────────────────────────
const cW = Terrain.CityWall;
const cF = Terrain.CityFloor;
const cE = Terrain.CityExit;
const cP = Terrain.Carpet;
const wL = Terrain.Well;
const fT = Terrain.Fountain;
const kR = Terrain.Crate;
const bR = Terrain.Barrel;
const sF = Terrain.ShopFloor;
const tP = Terrain.Temple;
const sT = Terrain.Statue;
const rV = Terrain.River;
const mL = Terrain.Mill;
const cR = Terrain.CropField;
const fN = Terrain.Fence;
const cA = Terrain.Casino;
const pa = Terrain.CityPath;

// ── Willowdale — Quaint village with river, houses, and fountain ──
// prettier-ignore
const WILLOWDALE_INTERIOR: Terrain[][] = [
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW],
  [cW,cW,cW,cW,cW,cW,rV,rV,cF,cF,cF,cF,rV,rV,cW,cW,cW,cW,cW,cW],
  [cW,cW,sF,sF,sF,cW,rV,rV,cF,cF,cF,cF,rV,rV,cW,sF,sF,sF,cW,cW],
  [cW,cW,sF,sF,sF,cW,cF,cF,cF,cF,cF,cF,cF,cF,cW,sF,sF,sF,cW,cW],
  [cW,cF,cF,cP,cF,cF,cF,pa,pa,pa,pa,pa,pa,cF,cF,cF,cP,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,sT,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,fT,fT,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,wL,cF,fT,fT,cF,wL,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,cW,cW,cW,cW,cF,cF,cF,cF,pa,cF,cF,cF,cW,cW,cW,cW,cW,cW],
  [cW,cW,sF,sF,sF,cW,cF,cF,cF,cF,pa,cF,cF,cF,cW,sF,sF,sF,cW,cW],
  [cW,cW,sF,sF,sF,cW,cF,cF,cF,cF,pa,cF,cF,cF,cW,sF,sF,sF,cW,cW],
  [cW,cF,cF,cP,cF,cF,cF,pa,pa,pa,pa,pa,pa,cF,cF,cF,cP,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cE,cW,cW,cW,cW,cW,cW,cW,cW,cW],
];

// ── Ironhold — Dense forge city with narrow alleys and workshops ──
// prettier-ignore
const IRONHOLD_INTERIOR: Terrain[][] = [
  [cW,cW,sF,sF,sF,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,sF,sF,sF,cW,cW],
  [cW,cW,sF,sF,sF,cW,cF,cF,cF,sT,cF,cF,cF,cF,cW,sF,sF,sF,cW,cW],
  [cW,cF,cF,cP,cF,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cF,cP,cF,cF,cW],
  [cW,cF,cF,cF,cF,cW,sF,sF,sF,cW,cW,sF,sF,sF,cW,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cW,sF,sF,sF,cW,cW,sF,sF,sF,cW,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cP,cF,cF,pa,cF,cP,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,wL,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,kR,cF,cF,cF,cF,cF,cF,sT,pa,cF,cF,cF,cF,cF,cF,kR,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,bR,cF,bR,cF,cF,cF,cF,bR,cF,bR,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cE,cW,cW,cW,cW,cW,cW,cW,cW,cW],
];

// ── Sandport — Open desert bazaar with big casino, sun temple ──
// prettier-ignore
const SANDPORT_INTERIOR: Terrain[][] = [
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW],
  [cW,bR,sF,sF,sF,bR,cF,cF,cF,tP,cF,cF,cF,cF,bR,sF,sF,sF,bR,cW],
  [cW,sF,sF,sF,sF,sF,cF,cF,cF,cF,cF,cF,cF,cF,sF,sF,sF,sF,sF,cW],
  [cW,cF,cF,cP,cF,cF,pa,pa,pa,pa,pa,pa,pa,pa,cF,cF,cP,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cA,cA,cF,pa,cA,cA,cF,cF,cF,cF,cF,cF,cW],
  [cW,bR,sF,sF,sF,bR,cF,cA,cA,fT,fT,cA,cA,cF,bR,sF,sF,sF,bR,cW],
  [cW,sF,sF,sF,sF,sF,cF,cF,cF,fT,fT,cF,cF,cF,sF,sF,sF,sF,sF,cW],
  [cW,cF,cF,cP,cF,cF,pa,pa,pa,pa,pa,pa,pa,pa,cF,cF,cP,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,bR,sF,sF,sF,bR,cF,cF,wL,pa,cF,cF,bR,sF,sF,sF,bR,cF,cW],
  [cW,cF,sF,sF,sF,sF,sF,cF,cF,cF,pa,cF,cF,sF,sF,sF,sF,sF,cF,cW],
  [cW,cF,cF,cF,cP,cF,cF,pa,pa,pa,pa,pa,pa,cF,cF,cP,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cE,cW,cW,cW,cW,cW,cW,cW,cW,cW],
];

// ── Frostheim — Sturdy northern town with central hearth and frost temple ──
// prettier-ignore
const FROSTHEIM_INTERIOR: Terrain[][] = [
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW],
  [cW,cW,sF,sF,sF,cW,cF,cF,cF,tP,cF,cF,cF,cF,cW,sF,sF,sF,cW,cW],
  [cW,cW,sF,sF,sF,cW,cF,cF,cF,cF,cF,cF,cF,cF,cW,sF,sF,sF,cW,cW],
  [cW,cF,cF,cP,cF,cF,pa,pa,pa,pa,pa,pa,pa,pa,cF,cF,cP,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,sT,cF,cF,cF,cF,pa,cF,cF,cF,sT,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,fT,fT,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cF,cW],
  [cW,cW,sF,sF,sF,cW,sF,sF,sF,cW,cW,sF,sF,cW,sF,sF,sF,cW,cF,cW],
  [cW,cW,sF,sF,sF,cW,sF,sF,sF,cW,cW,sF,sF,cW,sF,sF,sF,cW,cF,cW],
  [cW,cF,cF,cP,cF,pa,pa,cP,pa,pa,pa,pa,cP,pa,cF,cP,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cE,cW,cW,cW,cW,cW,cW,cW,cW,cW],
];

// ── Deeproot — Forest village with mill, nature shrine and ancient tree ──
// prettier-ignore
const DEEPROOT_INTERIOR: Terrain[][] = [
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW],
  [cW,cF,cW,sF,sF,sF,cW,cF,cF,tP,cF,cF,cF,cW,sF,sF,sF,cW,cF,cW],
  [cW,cF,cW,sF,sF,sF,cW,cF,cF,cF,cF,cF,cF,cW,sF,sF,sF,cW,cF,cW],
  [cW,cF,cF,cF,cP,cF,cF,pa,pa,pa,pa,pa,pa,cF,cF,cP,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,wL,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,bR,cF,cF,pa,cF,bR,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,kR,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,kR,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,fT,fT,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cW,cW,cW,cW,cW,cF,cF,fT,fT,cF,cF,cW,cW,cW,cW,cW,cF,cW],
  [cW,cF,cW,sF,sF,sF,cW,cF,cF,cF,pa,cF,cF,cW,sF,sF,sF,cW,cF,cW],
  [cW,cF,cW,sF,sF,sF,cW,cF,cF,cF,pa,cF,cF,cW,sF,sF,sF,cW,cF,cW],
  [cW,cF,cF,cF,cP,cF,cF,pa,pa,pa,pa,pa,pa,cF,cF,cP,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cE,cW,cW,cW,cW,cW,cW,cW,cW,cW],
];

// ── Canyonwatch — Cliff-carved outpost with ancient cliff statues ──
// prettier-ignore
const CANYONWATCH_INTERIOR: Terrain[][] = [
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW],
  [cW,cW,sF,sF,sF,cW,cF,cF,cF,sT,sT,cF,cF,cF,cW,sF,sF,sF,cW,cW],
  [cW,cW,sF,sF,sF,cW,cF,cF,cF,cF,cF,cF,cF,cF,cW,sF,sF,sF,cW,cW],
  [cW,cF,cF,cP,cF,cF,pa,pa,pa,pa,pa,pa,pa,pa,cF,cF,cP,cF,cF,cW],
  [cW,cF,cF,cF,cW,cW,cW,cW,cW,cF,pa,cW,cW,cW,cW,cW,cF,cF,cF,cW],
  [cW,cF,cF,cF,cW,sF,sF,sF,cW,wL,pa,cW,sF,sF,sF,cW,cF,cF,cF,cW],
  [cW,cF,cF,cF,cW,sF,sF,sF,cW,cF,pa,cW,sF,sF,sF,cW,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cP,cF,cF,pa,pa,cF,cF,cP,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,bR,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,bR,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cE,cW,cW,cW,cW,cW,cW,cW,cW,cW],
];

// ── Bogtown — Ramshackle swamp settlement with weathered statue ──
// prettier-ignore
const BOGTOWN_INTERIOR: Terrain[][] = [
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW],
  [cW,cW,cW,cW,cW,cW,cF,cF,cF,sT,cF,cF,cF,cF,cW,cW,cW,cW,cW,cW],
  [cW,cW,sF,sF,sF,cW,cF,cF,cF,cF,cF,cF,cF,cF,cW,sF,sF,sF,cW,cW],
  [cW,cW,sF,sF,sF,cW,cF,cF,cF,cF,cF,cF,cF,cF,cW,sF,sF,sF,cW,cW],
  [cW,cF,cF,cP,cF,cF,pa,pa,pa,pa,pa,pa,pa,pa,cF,cF,cP,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,kR,cF,cF,wL,pa,cF,cF,kR,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,cW,cW,cW,cW,cF,bR,cF,cF,pa,cF,bR,cF,cW,cW,cW,cW,cW,cW],
  [cW,cW,sF,sF,sF,cW,cF,cF,cF,cF,pa,cF,cF,cF,cW,sF,sF,sF,cW,cW],
  [cW,cW,sF,sF,sF,cW,cF,cF,cF,cF,pa,cF,cF,cF,cW,sF,sF,sF,cW,cW],
  [cW,cF,cF,cP,cF,cF,pa,pa,pa,pa,pa,pa,pa,pa,cF,cF,cP,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cE,cW,cW,cW,cW,cW,cW,cW,cW,cW],
];

// ── Thornvale — Fortified woodland town with crop fields and garden statues ──
// prettier-ignore
const THORNVALE_INTERIOR: Terrain[][] = [
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW],
  [cW,cF,fN,cW,sF,sF,sF,cW,cF,cF,cF,cF,cW,sF,sF,sF,cW,fN,cF,cW],
  [cW,cF,cF,cW,sF,sF,sF,cW,cF,cF,cF,cF,cW,sF,sF,sF,cW,cF,cF,cW],
  [cW,cF,cF,cF,cF,cP,cF,cF,pa,pa,pa,pa,cF,cF,cP,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,wL,cF,fT,fT,cF,wL,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,fT,fT,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cW,cW,cW,cW,cW,cF,cF,pa,cF,cW,cW,cW,cW,cW,cF,cF,cW],
  [cW,cF,cF,cW,sF,sF,sF,cW,cF,cF,pa,cF,cW,sF,sF,sF,cW,cF,cF,cW],
  [cW,cF,cF,cW,sF,sF,sF,cW,cF,cF,pa,cF,cW,sF,sF,sF,cW,cF,cF,cW],
  [cW,cF,cF,cF,cF,cP,cF,cF,pa,pa,pa,pa,cF,cF,cP,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cE,cW,cW,cW,cW,cW,cW,cW,cW,cW],
];

// ── Ashfall — Heat-scarred town with fire temple and small casino ──
// prettier-ignore
const ASHFALL_INTERIOR: Terrain[][] = [
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW],
  [cW,cF,cW,cW,cW,cW,cW,cF,cF,tP,cF,cF,cF,cW,cW,cW,cW,cW,cF,cW],
  [cW,cF,cW,sF,sF,sF,cW,cF,cF,cF,cF,cF,cF,cW,sF,sF,sF,cW,cF,cW],
  [cW,cF,cW,sF,sF,sF,cW,cF,cF,cF,cF,cF,cF,cW,sF,sF,sF,cW,cF,cW],
  [cW,cF,cF,cF,cP,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cP,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cW,sF,sF,sF,cW,cW,sF,sF,sF,cW,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cW,sF,sF,sF,cW,cW,sF,sF,sF,cW,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cP,cF,cF,pa,cF,cP,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cW,cW,cW,cW,cW,cF,cF,cF,pa,cF,cF,cW,cW,cW,cW,cW,cF,cW],
  [cW,cF,cW,sF,sF,sF,cW,cF,cF,cF,pa,cF,cF,cW,sF,sF,sF,cW,cF,cW],
  [cW,cF,cW,sF,sF,sF,cW,cF,cF,cF,pa,cF,cF,cW,sF,sF,sF,cW,cF,cW],
  [cW,cF,cF,cF,cP,cF,cF,pa,pa,pa,pa,pa,pa,cF,cF,cP,cF,cF,cF,cW],
  [cW,cF,kR,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cE,cW,cW,cW,cW,cW,cW,cW,cW,cW],
];

// ── Dunerest — Desert oasis outpost with oasis shrine ──
// prettier-ignore
const DUNEREST_INTERIOR: Terrain[][] = [
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW],
  [cW,bR,sF,sF,sF,bR,cF,cF,cF,sT,cF,cF,cF,cF,bR,sF,sF,sF,bR,cW],
  [cW,sF,sF,sF,sF,sF,cF,cF,cF,cF,cF,cF,cF,cF,sF,sF,sF,sF,sF,cW],
  [cW,cF,cF,cP,cF,cF,pa,pa,pa,pa,pa,pa,pa,pa,cF,cF,cP,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,fT,fT,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,fT,fT,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,bR,cF,cF,cF,pa,cF,cF,bR,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,wL,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,bR,sF,sF,sF,bR,cF,cF,cF,cF,pa,cF,cF,cF,bR,sF,sF,sF,bR,cW],
  [cW,sF,sF,sF,sF,sF,cF,cF,cF,cF,pa,cF,cF,cF,sF,sF,sF,sF,sF,cW],
  [cW,cF,cF,cP,cF,cF,pa,pa,pa,pa,pa,pa,pa,pa,cF,cF,cP,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cE,cW,cW,cW,cW,cW,cW,cW,cW,cW],
];

// ── Ridgewatch — Mountain fortress with guardian statues and houses ──
// prettier-ignore
const RIDGEWATCH_INTERIOR: Terrain[][] = [
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW],
  [cW,cF,cW,sF,sF,sF,cW,cF,cF,sT,cF,cF,cF,cW,sF,sF,sF,cW,cF,cW],
  [cW,cF,cW,sF,sF,sF,cW,cF,cF,cF,cF,cF,cF,cW,sF,sF,sF,cW,cF,cW],
  [cW,cF,cF,cF,cP,cF,cF,pa,pa,pa,pa,pa,pa,cF,cF,cP,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,sT,fN,fN,cF,cF,pa,cF,fN,fN,sT,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,wL,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,bR,cF,cF,pa,cF,bR,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cW,cW,cW,cW,cW,fN,cF,cF,pa,cF,fN,cW,cW,cW,cW,cW,cF,cW],
  [cW,cF,cW,sF,sF,sF,cW,cF,cF,cF,pa,cF,cF,cW,sF,sF,sF,cW,cF,cW],
  [cW,cF,cW,sF,sF,sF,cW,cF,cF,cF,pa,cF,cF,cW,sF,sF,sF,cW,cF,cW],
  [cW,cF,cF,cF,cP,cF,cF,pa,pa,pa,pa,pa,pa,cF,cF,cP,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cE,cW,cW,cW,cW,cW,cW,cW,cW,cW],
];

// ── Shadowfen — Mysterious swamp town with dark temple ──
// prettier-ignore
const SHADOWFEN_INTERIOR: Terrain[][] = [
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW],
  [cW,cF,cF,cW,sF,sF,sF,cW,cF,tP,cF,cF,cW,sF,sF,sF,cW,cF,cF,cW],
  [cW,cF,cF,cW,sF,sF,sF,cW,cF,cF,cF,cF,cW,sF,sF,sF,cW,cF,cF,cW],
  [cW,cF,cF,cF,cF,cP,cF,cF,pa,pa,pa,pa,cF,cF,cP,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,sT,cF,bR,cF,cF,pa,cF,bR,cF,sT,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,wL,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cW,cW,cW,cW,cW,cF,cF,pa,cF,cW,cW,cW,cW,cW,cF,cF,cW],
  [cW,cF,cF,cW,sF,sF,sF,cW,cF,cF,pa,cF,cW,sF,sF,sF,cW,cF,cF,cW],
  [cW,cF,cF,cW,sF,sF,sF,cW,cF,cF,pa,cF,cW,sF,sF,sF,cW,cF,cF,cW],
  [cW,cF,cF,cF,cF,cP,cF,cF,pa,pa,pa,pa,cF,cF,cP,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cE,cW,cW,cW,cW,cW,cW,cW,cW,cW],
];

export const CITIES: CityData[] = [
  {
    id: "willowdale_city", name: "Willowdale", chunkX: 4, chunkY: 2, tileX: 2, tileY: 2,
    mapData: WILLOWDALE_INTERIOR, spawnX: 10, spawnY: 13,
    shops: [
      { type: "weapon", name: "Blade & Bow", x: 3, y: 4, shopItems: ["shortSword", "longSword"] },
      { type: "armor", name: "Hide & Mail", x: 16, y: 4, shopItems: ["leatherArmor", "woodenShield"] },
      { type: "general", name: "General Store", x: 3, y: 11, shopItems: ["potion", "ether", "dungeonKey"] },
      { type: "inn", name: "Willow Inn", x: 16, y: 11, shopItems: [] },
    ],
  },
  {
    id: "ironhold_city", name: "Ironhold", chunkX: 3, chunkY: 2, tileX: 5, tileY: 7,
    mapData: IRONHOLD_INTERIOR, spawnX: 10, spawnY: 13,
    shops: [
      { type: "weapon", name: "The Iron Anvil", x: 3, y: 2, shopItems: ["longSword", "greatSword"] },
      { type: "armor", name: "Fortress Armory", x: 16, y: 2, shopItems: ["chainMail", "plateArmor", "ironShield", "towerShield"] },
      { type: "general", name: "Ironhold Supply", x: 7, y: 5, shopItems: ["potion", "ether", "greaterPotion", "chimaeraWing"] },
      { type: "inn", name: "Anvil Rest", x: 12, y: 5, shopItems: [] },
    ],
  },
  {
    id: "sandport_city", name: "Sandport", chunkX: 5, chunkY: 2, tileX: 12, tileY: 6,
    mapData: SANDPORT_INTERIOR, spawnX: 10, spawnY: 13,
    shops: [
      { type: "weapon", name: "Desert Arms", x: 3, y: 3, shopItems: ["shortSword", "longSword", "greatSword"] },
      { type: "armor", name: "Sandport Outfitter", x: 16, y: 3, shopItems: ["leatherArmor", "chainMail", "ironShield"] },
      { type: "magic", name: "Oasis Arcana", x: 3, y: 7, shopItems: ["potion", "ether", "greaterPotion", "chimaeraWing"] },
      { type: "inn", name: "Desert Rose Inn", x: 16, y: 7, shopItems: [] },
      { type: "bank", name: "Merchant's Bank", x: 4, y: 11, shopItems: [] },
      { type: "general", name: "Bazaar Goods", x: 15, y: 11, shopItems: ["potion", "ether", "dungeonKey"] },
    ],
  },
  {
    id: "frostheim_city", name: "Frostheim", chunkX: 1, chunkY: 0, tileX: 10, tileY: 7,
    mapData: FROSTHEIM_INTERIOR, spawnX: 10, spawnY: 13,
    shops: [
      { type: "magic", name: "Frost Apothecary", x: 3, y: 3, shopItems: ["potion", "ether", "greaterPotion"] },
      { type: "armor", name: "Fur & Steel", x: 16, y: 3, shopItems: ["chainMail", "plateArmor", "ironShield", "towerShield"] },
      { type: "weapon", name: "Frostbite Arms", x: 3, y: 10, shopItems: ["longSword", "greatSword"] },
      { type: "inn", name: "Hearthstone Inn", x: 7, y: 10, shopItems: [] },
      { type: "general", name: "Frostheim Supply", x: 12, y: 10, shopItems: ["potion", "ether", "dungeonKey"] },
      { type: "weapon", name: "Ice Forge", x: 15, y: 10, shopItems: ["shortSword", "longSword"] },
    ],
  },
  {
    id: "deeproot_city", name: "Deeproot", chunkX: 2, chunkY: 1, tileX: 10, tileY: 7,
    mapData: DEEPROOT_INTERIOR, spawnX: 10, spawnY: 13,
    shops: [
      { type: "weapon", name: "Rootwood Arms", x: 4, y: 3, shopItems: ["shortSword", "longSword"] },
      { type: "armor", name: "Bark & Bough", x: 15, y: 3, shopItems: ["leatherArmor", "woodenShield"] },
      { type: "general", name: "Forest Provisions", x: 4, y: 11, shopItems: ["potion", "ether"] },
      { type: "inn", name: "Canopy Rest", x: 15, y: 11, shopItems: [] },
    ],
  },
  {
    id: "canyonwatch_city", name: "Canyonwatch", chunkX: 7, chunkY: 2, tileX: 10, tileY: 7,
    mapData: CANYONWATCH_INTERIOR, spawnX: 10, spawnY: 13,
    shops: [
      { type: "weapon", name: "Clifftop Blades", x: 3, y: 3, shopItems: ["longSword", "greatSword"] },
      { type: "armor", name: "Canyon Outfitter", x: 16, y: 3, shopItems: ["chainMail", "ironShield"] },
      { type: "general", name: "Ridge Supplies", x: 6, y: 7, shopItems: ["potion", "greaterPotion"] },
      { type: "inn", name: "Ledgeside Lodge", x: 13, y: 7, shopItems: [] },
    ],
  },
  {
    id: "bogtown_city", name: "Bogtown", chunkX: 1, chunkY: 3, tileX: 10, tileY: 7,
    mapData: BOGTOWN_INTERIOR, spawnX: 10, spawnY: 13,
    shops: [
      { type: "magic", name: "Swamp Remedies", x: 3, y: 4, shopItems: ["potion", "ether", "greaterPotion"] },
      { type: "general", name: "Bog Trader", x: 16, y: 4, shopItems: ["potion", "ether"] },
      { type: "weapon", name: "Marshblade Smith", x: 3, y: 11, shopItems: ["shortSword", "longSword"] },
      { type: "inn", name: "Murky Rest", x: 16, y: 11, shopItems: [] },
    ],
  },
  {
    id: "thornvale_city", name: "Thornvale", chunkX: 4, chunkY: 3, tileX: 10, tileY: 7,
    mapData: THORNVALE_INTERIOR, spawnX: 10, spawnY: 13,
    shops: [
      { type: "weapon", name: "Briar Arsenal", x: 5, y: 3, shopItems: ["longSword", "greatSword"] },
      { type: "armor", name: "Thornguard Armory", x: 14, y: 3, shopItems: ["chainMail", "plateArmor", "ironShield"] },
      { type: "general", name: "Thornvale Goods", x: 5, y: 10, shopItems: ["potion", "ether", "greaterPotion", "chimaeraWing"] },
      { type: "inn", name: "Vine & Rest", x: 14, y: 10, shopItems: [] },
    ],
  },
  {
    id: "ashfall_city", name: "Ashfall", chunkX: 6, chunkY: 4, tileX: 10, tileY: 7,
    mapData: ASHFALL_INTERIOR, spawnX: 10, spawnY: 13,
    shops: [
      { type: "weapon", name: "Ember Forge", x: 4, y: 4, shopItems: ["greatSword", "longSword"] },
      { type: "armor", name: "Cindershield Armory", x: 15, y: 4, shopItems: ["plateArmor", "towerShield"] },
      { type: "general", name: "Ashfall Provisions", x: 7, y: 7, shopItems: ["greaterPotion", "ether"] },
      { type: "inn", name: "Obsidian Hearth", x: 12, y: 7, shopItems: [] },
      { type: "magic", name: "Flamecaller's Den", x: 4, y: 11, shopItems: ["potion", "ether", "greaterPotion"] },
      { type: "general", name: "Soot & Ore", x: 15, y: 11, shopItems: ["potion", "greaterPotion", "dungeonKey"] },
    ],
  },
  {
    id: "dunerest_city", name: "Dunerest", chunkX: 8, chunkY: 4, tileX: 10, tileY: 7,
    mapData: DUNEREST_INTERIOR, spawnX: 10, spawnY: 13,
    shops: [
      { type: "weapon", name: "Sandsteel Arms", x: 3, y: 3, shopItems: ["shortSword", "longSword"] },
      { type: "armor", name: "Dune Outfitter", x: 16, y: 3, shopItems: ["leatherArmor", "chainMail"] },
      { type: "general", name: "Oasis Supplies", x: 3, y: 11, shopItems: ["potion", "greaterPotion"] },
      { type: "inn", name: "Mirage Inn", x: 16, y: 11, shopItems: [] },
    ],
  },
  {
    id: "ridgewatch_city", name: "Ridgewatch", chunkX: 9, chunkY: 6, tileX: 10, tileY: 7,
    mapData: RIDGEWATCH_INTERIOR, spawnX: 10, spawnY: 13,
    shops: [
      { type: "weapon", name: "Summit Forge", x: 4, y: 3, shopItems: ["longSword", "greatSword"] },
      { type: "armor", name: "Ridgeguard Armory", x: 15, y: 3, shopItems: ["chainMail", "plateArmor", "ironShield"] },
      { type: "general", name: "Ridgewatch Goods", x: 4, y: 11, shopItems: ["greaterPotion", "ether", "dungeonKey"] },
      { type: "inn", name: "Eagle's Perch Inn", x: 15, y: 11, shopItems: [] },
    ],
  },
  {
    id: "shadowfen_city", name: "Shadowfen", chunkX: 3, chunkY: 7, tileX: 10, tileY: 7,
    mapData: SHADOWFEN_INTERIOR, spawnX: 10, spawnY: 13,
    shops: [
      { type: "magic", name: "Fen Apothecary", x: 5, y: 3, shopItems: ["potion", "ether"] },
      { type: "weapon", name: "Shadowblade Smithy", x: 14, y: 3, shopItems: ["shortSword", "longSword"] },
      { type: "general", name: "Shadowfen Trader", x: 5, y: 11, shopItems: ["potion", "ether"] },
      { type: "inn", name: "Fog Lantern Inn", x: 14, y: 11, shopItems: [] },
    ],
  },
];

/** Inn costs per city — increasing with city progression/difficulty. */
export const INN_COSTS: Record<string, number> = {
  willowdale_city:  10,
  deeproot_city:    10,
  bogtown_city:     15,
  ironhold_city:    20,
  sandport_city:    20,
  frostheim_city:   25,
  thornvale_city:   25,
  canyonwatch_city: 30,
  dunerest_city:    35,
  ashfall_city:     40,
  ridgewatch_city:  45,
  shadowfen_city:   50,
};

/** Get the inn cost for a city (defaults to 10g if unknown). */
export function getInnCost(cityId: string): number {
  return INN_COSTS[cityId] ?? 10;
}

export function getCity(id: string): CityData | undefined {
  return CITIES.find((c) => c.id === id);
}

export function getCityForTown(chunkX: number, chunkY: number, tileX: number, tileY: number): CityData | undefined {
  return CITIES.find((c) => c.chunkX === chunkX && c.chunkY === chunkY && c.tileX === tileX && c.tileY === tileY);
}

export function getCityShopAt(city: CityData, x: number, y: number): CityShopData | undefined {
  return city.shops.find((s) => s.x === x && s.y === y);
}

/**
 * Find a shop accessible from an adjacent carpet tile.
 * When the player is on a Carpet tile, look at the 4 neighbours for a shop.
 * When the player is on any tile, look at the 4 neighbours for a carpet that
 * leads to a shop.
 */
export function getCityShopNearby(city: CityData, x: number, y: number): CityShopData | undefined {
  // Direct match first
  const direct = getCityShopAt(city, x, y);
  if (direct) return direct;
  // If player is on a carpet, check adjacent tiles for a shop
  const terrain = city.mapData[y]?.[x];
  if (terrain === Terrain.Carpet || terrain === Terrain.ShopFloor) {
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    for (const [dx, dy] of dirs) {
      const shop = getCityShopAt(city, x + dx, y + dy);
      if (shop) return shop;
    }
  }
  // If player is adjacent to a carpet that leads to a shop
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    const adj = city.mapData[ny]?.[nx];
    if (adj === Terrain.Carpet) {
      const shop = getCityShopAt(city, nx, ny);
      if (shop) return shop;
      // Also check the tile beyond the carpet
      for (const [dx2, dy2] of dirs) {
        const shop2 = getCityShopAt(city, nx + dx2, ny + dy2);
        if (shop2) return shop2;
      }
    }
  }
  return undefined;
}

/**
 * Get the dominant biome terrain surrounding a town tile.
 * Used to colour the town icon with the local biome instead of always purple.
 */
export function getTownBiome(chunkX: number, chunkY: number, tileX: number, tileY: number): Terrain {
  const chunk = getChunk(chunkX, chunkY);
  if (!chunk) return Terrain.Grass;
  const counts: Record<number, number> = {};
  const biomes = [Terrain.Grass, Terrain.Forest, Terrain.Sand, Terrain.Tundra, Terrain.Swamp, Terrain.DeepForest, Terrain.Canyon];
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = tileX + dx;
      const ny = tileY + dy;
      if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT) {
        const t = chunk.mapData[ny][nx];
        if (biomes.includes(t)) {
          counts[t] = (counts[t] ?? 0) + 1;
        }
      }
    }
  }
  let best = Terrain.Grass;
  let bestCount = 0;
  for (const [t, c] of Object.entries(counts)) {
    if (c > bestCount) { bestCount = c; best = Number(t) as Terrain; }
  }
  return best;
}

export const CHESTS: ChestData[] = [
  { id: "crypt_flame", itemId: "flameBlade", x: 18, y: 1, location: { type: "dungeon", dungeonId: "heartlands_dungeon" } },
  { id: "crypt_guardian", itemId: "cryptGuardian", x: 9, y: 7, location: { type: "dungeon", dungeonId: "heartlands_dungeon" } },
  { id: "crypt_frost", itemId: "frostfang", x: 17, y: 13, location: { type: "dungeon", dungeonId: "heartlands_dungeon" } },
  { id: "forest_shadow", itemId: "shadowCloak", x: 3, y: 13, location: { type: "overworld", chunkX: 4, chunkY: 1 } },
  { id: "frost_blade_chest", itemId: "frostBrand", x: 17, y: 1, location: { type: "dungeon", dungeonId: "frost_cavern" } },
  { id: "frost_pelt_chest", itemId: "tundraPelt", x: 16, y: 13, location: { type: "dungeon", dungeonId: "frost_cavern" } },
  { id: "frost_aegis_chest", itemId: "glacialAegis", x: 9, y: 7, location: { type: "dungeon", dungeonId: "frost_cavern" } },
  { id: "forge_core_chest", itemId: "magmaCore", x: 18, y: 1, location: { type: "dungeon", dungeonId: "volcanic_forge" } },
  { id: "forge_shield_chest", itemId: "volcanicShield", x: 9, y: 7, location: { type: "dungeon", dungeonId: "volcanic_forge" } },
  { id: "forge_ember_chest", itemId: "emberBlade", x: 17, y: 13, location: { type: "dungeon", dungeonId: "volcanic_forge" } },
  { id: "swamp_mantle_chest", itemId: "swampMantle", x: 5, y: 3, location: { type: "overworld", chunkX: 0, chunkY: 4 } },
  { id: "canyon_bow_chest", itemId: "canyonBow", x: 5, y: 3, location: { type: "overworld", chunkX: 8, chunkY: 6 } },
];

export function getChestAt(
  x: number, y: number,
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

export function getDungeonAt(cx: number, cy: number, x: number, y: number): DungeonData | undefined {
  return DUNGEONS.find((d) => d.entranceChunkX === cx && d.entranceChunkY === cy && d.entranceTileX === x && d.entranceTileY === y);
}

export function getDungeon(id: string): DungeonData | undefined {
  return DUNGEONS.find((d) => d.id === id);
}

// prettier-ignore
const CHUNK_0_0: Terrain[][] = [
  [ 2,13, 2,13,13,13, 2,13,13, 8, 8,13,13, 2,13,13,13,13,13,13],
  [13,13, 0, 2, 2,13,13, 0,13, 8, 8,13, 0, 2, 2, 2,13, 2,13,13],
  [13, 0,13,13, 0, 2,13,13,13, 8, 8,13,13, 0, 0,13,13,13,13,13],
  [ 2, 2,13,13, 0, 2,13,13,13, 8, 8,13,13,13,13, 0,13, 0, 0,13],
  [ 2,13,13,13, 0, 2,13,13,13, 8, 8,13, 0, 2,13, 0, 0,13,13, 2],
  [13, 0,13,13,13,13,13,13,13, 8, 8,13,13, 0, 0,13, 2, 2,13,13],
  [13,13,13,13,13,13,13,13,13, 8, 8,13,13,13,13,13,13,13,13,13],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [13,13,13,13,13,13,13,13,13, 8, 8,13,13,13,13,13,13,13,13,13],
  [13,13,13,13,13,13,13, 0,13, 8, 8,13, 0,13,13,13,13,13,13,13],
  [13,13,13,13,13,13, 2,13,13, 8, 8,13,13,13,13,13,13,13, 2,13],
  [13, 2,13,13,13,13, 0,13,13, 8, 8,13, 2,13,13,13,13,13,13, 2],
  [13, 0,13,13,13,13,13, 0,13, 8, 8,13,13,13,13, 0,13,13,13,13],
  [ 2,13, 2, 2,13,13,13,13,13, 8, 8,13, 2,13,13,13, 2,13, 2,13],
  [ 2,13, 2, 2,13, 2, 2,13,13, 8, 8,13, 2,13, 2, 2,13,13,13,13],
];

// prettier-ignore
const CHUNK_1_0: Terrain[][] = [
  [ 2, 2, 2,13, 2, 2,13, 2,13, 8, 8,13,13,13,13, 2, 2,13, 2, 2],
  [13, 2,13, 2,13, 0,13,13,13, 8, 8,13,13, 2, 0, 2, 2,13, 2,13],
  [ 2,13, 0,13,13, 0,13, 0,13, 8, 8,13,13,13,13,13,13, 2, 2,13],
  [ 2, 2,13,13,13,13,13,13,13, 8, 8,13,13,13,13,13, 2,13,13, 2],
  [ 2,13, 0, 2,13, 0,13,13,13, 8, 8,13,13,13,13, 0,13,13, 2,13],
  [13,13,13,13,13,13,13, 2,13, 8, 8,13,13,13,13,13,13,13,13,13],
  [13,13,13,13,13,13,13,13,13, 8, 8,13,13,13,13,13,13,13,13,13],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 5, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [13,13,13,13,13,13,13,13,13, 8, 8,13,13,13,13,13,13,13,13,13],
  [13,13, 2,13, 0,13, 2,13,13, 8, 8,13,13,13,13,13,13, 0, 0,13],
  [ 2, 2,13,13, 2,13,13,13,13, 8, 8,13,13,13,13,13, 2, 0, 0, 2],
  [ 2, 0,13, 2,13,13,13,13,13, 8, 8,13,13,13,13, 0,13,13,13,13],
  [13,13,13,13,13, 0,13,13,13, 8, 8,13,13, 2,13,13,13, 0,13,13],
  [ 2,13, 2,13, 2, 2, 0,13,13, 8, 8,13, 2, 0,13, 0,13, 2, 2, 2],
  [ 2,13, 2,13,13, 2,13, 2,13, 8, 8,13, 2,13,13, 2, 2,13,13, 2],
];

// prettier-ignore
const CHUNK_2_0: Terrain[][] = [
  [ 2,13,13,13,13, 2, 2, 2,13, 8, 8,13, 2, 2, 2, 2, 2, 2, 2, 2],
  [ 2,13,13,13,13,13, 2, 2,13, 8, 8,13,13,13,13,13, 2,13, 0, 2],
  [ 2,13,13,13,13,13,13,13,13, 8, 8,13, 0, 0, 0, 0, 0,13, 2, 2],
  [13, 0, 0,13, 0,13,13,13,13, 8, 8,13,13,13,13,13,13,13,13, 2],
  [ 2,13,13,13,13, 2,13,13,13, 8, 8,13,13,13, 0, 0,13,13,13, 2],
  [13, 2,13,13,13,13,13, 0,13, 8, 8,13, 2,13, 6,13,13,13,13,13],
  [13,13,13,13,13,13,13,13,13, 8, 8,13,13,13,13,13,13,13,13,13],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [13,13,13,13,13,13,13,13,13, 8, 8,13,13,13,13,13,13,13,13,13],
  [13, 2,13, 2,13,13, 0,13,13, 8, 8,13,13,13, 0,13,13, 0, 0,13],
  [ 2,13,13, 2,13,13,13,13,13, 8, 8,13, 0, 0,13,13,13, 0, 2, 2],
  [ 2,13,13,13,13,13,13,13,13, 8, 8,13, 0,13,13,13, 0,13, 0, 2],
  [ 2, 2,13, 0,13,13, 0, 2,13, 8, 8,13, 2, 2,13,13, 2,13, 0, 2],
  [ 2,13,13,13, 2, 2, 2, 2,13, 8, 8,13, 2,13, 2, 2, 2,13, 2,13],
  [13, 2, 2, 2, 2,13, 2, 2,13, 8, 8,13,13, 2, 2, 2, 2, 2,13, 2],
];

// prettier-ignore
const CHUNK_3_0: Terrain[][] = [
  [ 2, 2,13,13,13,13, 2, 2,13, 8, 8,13, 2,13, 2,13, 2, 2,13, 2],
  [ 2,13,13, 2, 2,13,13, 0,13, 8, 8,13, 0,13,13,13,13, 0,13,13],
  [ 2, 2, 0, 0,13,13,13,13,13, 8, 8,13,13,13,13,13,13,13,13,13],
  [13, 2,13,13, 0,13,13,13,13, 8, 8,13, 0, 3, 3, 3,13, 2,13,13],
  [13, 2,13,13,13,13,13, 0,13, 8, 8,13, 0, 3, 3, 3,13,13, 2, 2],
  [13,13,13,13,13, 0,13, 2,13, 8, 8,13,13, 3, 3, 3,13,13, 2,13],
  [13,13,13,13,13,13,13,13,13, 8, 8,13,13,13,13,13,13,13,13,13],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [13,13,13,13,13,13,13,13,13, 8, 8,13,13,13,13,13,13,13,13,13],
  [13,13,13,13, 0, 0,13,13,13, 8, 8,13, 0,13,13, 0,13,13, 0,13],
  [ 2, 2, 0, 2,13, 2,13,13,13, 8, 8,13, 0,13,13, 2,13,13, 0, 2],
  [ 2, 2,13, 0, 0,13,13,13,13, 8, 8,13,13,13, 0,13,13, 2,13,13],
  [13,13,13,13,13,13,13,13,13, 8, 8,13, 0, 0,13,13,13, 2, 2,13],
  [13,13,13, 0,13,13, 2,13,13, 8, 8,13, 2,13,13,13, 0,13,13, 2],
  [ 2,13, 2, 2, 2, 2, 2,13,13, 8, 8,13, 2, 2,13,13, 2, 2, 2, 2],
];

// prettier-ignore
const CHUNK_4_0: Terrain[][] = [
  [ 2, 2, 2, 0, 2, 0, 2, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 2],
  [ 0, 1, 2, 0, 0, 0, 0, 2, 0, 8, 8, 0, 2, 2, 0, 0, 0, 0, 0, 2],
  [ 2, 2, 0, 0, 1, 0, 0, 0, 0, 8, 8, 0, 0, 0, 1, 0, 0, 2, 0, 2],
  [ 2, 2, 2, 0, 0, 1, 1, 0, 0, 8, 8, 0, 1, 1, 0, 0, 0, 0, 0, 2],
  [ 0, 1, 0, 1, 0, 2, 1, 0, 0, 8, 8, 0, 0, 1, 0, 0, 0, 0, 0, 2],
  [ 0, 1, 0, 0, 1, 0, 0, 1, 0, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [ 0, 2, 0, 2, 1, 0, 0, 2, 0, 8, 8, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  [ 0, 2, 0, 0, 0, 2, 0, 0, 0, 8, 8, 0, 1, 1, 0, 0, 0, 0, 0, 0],
  [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 1, 0, 2, 2],
  [ 2, 1, 2, 0, 0, 0, 0, 0, 0, 8, 8, 0, 1, 0, 0, 0, 0, 0, 0, 2],
  [ 2, 2, 0, 2, 0, 0, 1, 1, 0, 8, 8, 0, 2, 1, 1, 0, 1, 0, 2, 2],
  [ 0, 0, 0, 0, 0, 2, 2, 2, 0, 8, 8, 0, 2, 0, 2, 0, 0, 2, 0, 2],
];

// prettier-ignore
const CHUNK_5_0: Terrain[][] = [
  [ 2, 0, 2, 2, 0, 2, 2, 0, 0, 8, 8, 0, 2, 2, 0, 0, 2, 2, 2, 0],
  [ 0, 0, 2, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0, 1, 2, 0, 0, 2, 0, 2],
  [ 0, 1, 1, 0, 1, 1, 0, 0, 0, 8, 8, 0, 2, 0, 0, 0, 1, 0, 1, 0],
  [ 0, 0, 1, 0, 0, 1, 2, 0, 0, 8, 8, 0, 0, 0, 2, 0, 1, 1, 1, 0],
  [ 0, 0, 2, 0, 2, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0, 1, 0, 2],
  [ 0, 0, 1, 0, 0, 0, 0, 0, 0, 8, 8, 0, 1, 0, 0, 0, 1, 0, 2, 0],
  [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [ 0, 1, 0, 2, 0, 3, 3, 3, 0, 8, 8, 0, 1, 1, 0, 2, 1, 1, 0, 0],
  [ 2, 1, 0, 1, 1, 3, 3, 3, 0, 8, 8, 0, 0, 2, 0, 0, 0, 0, 0, 2],
  [ 2, 0, 1, 0, 1, 3, 3, 3, 0, 8, 8, 0, 0, 2, 0, 0, 0, 0, 1, 2],
  [ 2, 1, 1, 0, 1, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 1, 0, 0, 0, 2],
  [ 2, 1, 1, 0, 1, 1, 2, 0, 0, 8, 8, 0, 0, 0, 0, 1, 0, 0, 2, 2],
  [ 0, 2, 2, 2, 2, 2, 2, 2, 0, 8, 8, 0, 0, 2, 0, 0, 2, 0, 2, 0],
];

// prettier-ignore
const CHUNK_6_0: Terrain[][] = [
  [ 2, 2, 2, 2, 0, 0, 0, 0, 0, 8, 8, 0, 0, 2, 0, 2, 2, 0, 0, 2],
  [ 2, 0, 2, 0, 1, 2, 0, 1, 0, 8, 8, 0, 0, 0, 0, 2, 1, 0, 0, 0],
  [ 2, 2, 0, 0, 0, 0, 2, 1, 0, 8, 8, 0, 1, 0, 0, 2, 0, 0, 0, 2],
  [ 2, 0, 2, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 2, 0, 0, 2, 0],
  [ 0, 0, 0, 2, 0, 1, 2, 1, 0, 8, 8, 0, 0, 0, 1, 0, 1, 0, 0, 0],
  [ 0, 2, 1, 1, 0, 0, 0, 1, 0, 8, 8, 0, 0, 0, 1, 0, 0, 0, 2, 0],
  [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [ 0, 0, 0, 0, 3, 3, 3, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0, 0, 2, 0],
  [ 2, 2, 0, 0, 3, 3, 3, 0, 0, 8, 8, 0, 0, 0, 2, 0, 0, 0, 0, 2],
  [ 2, 0, 0, 0, 3, 3, 3, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 2],
  [ 2, 0, 0, 0, 0, 1, 0, 0, 0, 8, 8, 0, 2, 1, 0, 0, 0, 0, 1, 2],
  [ 2, 0, 0, 2, 2, 2, 0, 1, 0, 8, 8, 0, 1, 0, 2, 0, 0, 2, 0, 2],
  [ 0, 2, 2, 2, 2, 2, 0, 2, 0, 8, 8, 0, 0, 0, 0, 0, 2, 0, 2, 2],
];

// prettier-ignore
const CHUNK_7_0: Terrain[][] = [
  [13,13, 2, 2, 2, 2, 2,13,13, 8, 8,13, 2,13, 2,13, 2,13, 2,13],
  [ 2, 2, 0, 2, 2, 2, 2,13,13, 8, 8,13, 2, 2,13, 2, 2,13,13,13],
  [13, 2,13,13,13,13,13, 0,13, 8, 8,13,13, 2, 0,13,13,13, 0,13],
  [13, 2,13,13,13, 2,13,13,13, 8, 8,13, 2,13,13, 2,13, 0, 0, 2],
  [13, 2,13,13,13,13,13, 2,13, 8, 8,13,13, 0,13,13,13,13,13, 2],
  [13,13, 0,13, 0, 2, 0, 2,13, 8, 8,13, 0,13,13,13,13,13, 2,13],
  [13,13,13,13,13,13,13,13,13, 8, 8,13,13,13,13,13,13,13,13,13],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [13,13,13,13,13,13,13,13,13, 8, 8,13,13,13,13,13,13,13,13,13],
  [13,13,13,13, 2,13, 0,13,13, 8, 8,13, 0,13,13,13,13, 0, 2,13],
  [ 2, 2,13,13, 0,13,13, 0,13, 8, 8,13,13,13,13, 2,13,13,13,13],
  [ 2,13,13, 0,13,13, 2,13,13, 8, 8,13,13, 0, 0,13,13,13, 2, 2],
  [ 2,13,13,13,13,13,13, 2,13, 8, 8,13, 2,13,13,13,13,13,13, 2],
  [ 2,13,13, 2,13,13,13,13,13, 8, 8,13,13, 0, 2,13,13, 2, 2,13],
  [ 2, 2, 2, 2,13, 2, 2, 2,13, 8, 8,13, 2, 2, 2,13,13,13,13,13],
];

// prettier-ignore
const CHUNK_8_0: Terrain[][] = [
  [13, 2, 2, 2, 2, 2, 2,13,13, 8, 8,13, 2,13, 2, 2,13,13,13,13],
  [ 2, 0,13,13, 2,13, 2, 2,13, 8, 8,13,13,13,13, 2, 2, 2, 2, 2],
  [13, 0, 0, 0,13,13,13,13,13, 8, 8,13,13,13,13,13, 2, 2,13, 2],
  [ 2,13,13,13, 0,13,13,13,13, 8, 8,13,13,13,13,13,13, 2, 2, 2],
  [13,13,13,13,13, 0,13,13,13, 8, 8,13,13,13, 2,13, 2,13, 2, 2],
  [13,13, 0,13,13,13, 0,13,13, 8, 8,13,13, 0, 2,13,13,13,13,13],
  [13,13,13,13,13,13,13,13,13, 8, 8,13,13,13,13,13,13,13,13,13],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [13,13,13,13,13,13,13,13,13, 8, 8,13,13,13,13,13,13,13,13,13],
  [13, 0,13, 2,13, 2, 0,13,13, 8, 8,13, 0,13,13,13,13,13,13,13],
  [ 2, 0,13, 0,13,13,13,13,13, 8, 8,13,13, 0,13,13,13,13,13, 2],
  [ 2, 2,13, 0,13, 0, 2, 2,13, 8, 8,13,13,13,13,13,13,13, 0,13],
  [ 2,13,13,13,13,13,13, 0,13, 8, 8,13,13,13,13,13,13,13,13, 2],
  [ 2, 0,13, 0, 0, 2, 2, 2,13, 8, 8,13, 0, 2, 2,13,13,13, 0,13],
  [ 2,13,13,13,13,13, 2,13,13, 8, 8,13, 2,13, 2, 2,13, 2,13,13],
];

// prettier-ignore
const CHUNK_9_0: Terrain[][] = [
  [ 2,13,13, 2, 2,13, 2,13,13, 8, 8,13,13,13,13,13,13, 2, 2, 2],
  [ 2,13,13, 0,13,13,13,13,13, 8, 8,13, 0,13,13,13, 0,13, 0, 2],
  [ 2,13, 2,13,13,13, 0,13,13, 8, 8,13,13, 0,13,13,13,13,13,13],
  [13,13, 0,13, 0,13, 2,13,13, 8, 8,13, 3, 3, 3,13,13, 0, 0, 2],
  [13,13,13,13, 0,13,13,13,13, 8, 8,13, 3, 3, 3,13,13,13,13, 2],
  [13, 2, 0,13,13,13, 0, 2,13, 8, 8,13, 3, 3, 3,13,13, 2,13,13],
  [13,13,13,13,13,13,13,13,13, 8, 8,13,13,13,13,13,13,13,13,13],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [13,13,13,13,13,13,13,13,13, 8, 8,13,13,13,13,13,13,13,13,13],
  [13, 0,13,13,13, 2,13, 2,13, 8, 8,13,13,13,13,13,13, 2,13,13],
  [ 2, 2,13,13, 0, 0,13,13,13, 8, 8,13,13,13,13, 0,13, 0, 2, 2],
  [ 2, 0,13, 2,13, 0,13,13,13, 8, 8,13,13, 0,13, 0,13,13,13, 2],
  [ 2, 0, 0,13,13,13,13,13,13, 8, 8,13, 2, 0,13, 0,13,13, 2,13],
  [13,13, 2,13,13, 0,13, 2,13, 8, 8,13, 0,13,13, 0,13, 2,13, 2],
  [13,13, 2,13, 2, 2,13, 2,13, 8, 8,13,13, 2,13,13, 2, 2,13, 2],
];

// prettier-ignore
const CHUNK_0_1: Terrain[][] = [
  [ 2,13,13, 2,13, 2,13, 2,13, 8, 8,13, 2, 2,13, 2, 2, 2, 2, 2],
  [13, 0, 2,13,13,13, 2, 0,13, 8, 8,13,13, 0,13, 2, 0,13, 0,13],
  [ 2,13,13,13,13, 2,13,13,13, 8, 8,13,13, 0,13, 0, 0,13, 2, 2],
  [ 2, 2,13,13,13,13,13,13,13, 8, 8,13, 3, 3, 3,13, 0,13, 2, 2],
  [ 2,13, 0,13,13, 0, 0,13,13, 8, 8,13, 3, 3, 3,13,13, 2, 2,13],
  [13, 2,13,13,13,13,13,13,13, 8, 8,13, 3, 3, 3,13,13, 2, 2,13],
  [13,13,13,13,13,13,13,13,13, 8, 8,13,13,13,13,13,13,13,13,13],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [13,13,13,13,13,13,13,13,13, 8, 8,13,13,13,13,13,13,13,13,13],
  [13,13,13, 2, 2,13,13, 0,13, 8, 8,13,13,13,13,13, 2,13,13,13],
  [13,13,13,13,13, 2,13, 0,13, 8, 8,13,13,13, 0,13,13, 0, 2,13],
  [ 2, 2, 0, 0, 0, 2,13,13,13, 8, 8,13,13,13,13,13,13, 2, 0, 2],
  [ 2, 0,13, 0,13,13,13,13,13, 8, 8,13,13, 0,13,13,13, 0, 2,13],
  [13,13, 2, 2, 2,13,13, 2,13, 8, 8,13,13, 2,13, 2, 2, 0,13, 2],
  [13,13, 2,13,13, 2,13, 2,13, 8, 8,13,13,13, 2,13,13, 2, 2,13],
];

// prettier-ignore
const CHUNK_1_1: Terrain[][] = [
  [15, 2,15, 2, 2, 2, 2,15,15, 8, 8,15,15, 2, 2, 2, 2, 2,15, 2],
  [15,15,15, 1, 1, 2,15, 2,15, 8, 8,15, 2,15,15, 2, 1,15,15,15],
  [15, 1,15,15, 1,15,15,15,15, 8, 8,15, 1,15,15,15,15,15, 2, 2],
  [15,15,15,15,15, 2,15, 2,15, 8, 8,15,15,15, 2,15,15,15, 1, 2],
  [ 2,15, 2,15,15,15, 2,15,15, 8, 8,15, 2,15, 1,15,15,15, 2, 2],
  [15,15,15,15,15,15,15, 1,15, 8, 8,15,15, 2,15, 1,15,15, 2,15],
  [15,15,15,15,15,15,15,15,15, 8, 8,15,15,15,15,15,15,15,15,15],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [15,15,15,15,15,15,15,15,15, 8, 8,15,15,15,15,15,15,15,15,15],
  [15,15,15,15, 1,15,15,15,15, 8, 8,15, 1,15,15, 1,15,15, 2,15],
  [15, 2,15,15,15,15,15,15,15, 8, 8,15,15,15,15, 1,15,15,15,15],
  [15,15,15, 1,15, 2,15,15,15, 8, 8,15,15, 1, 1,15,15,15,15, 2],
  [ 2, 1, 2,15, 1, 2,15,15,15, 8, 8,15,15,15, 1,15,15,15, 2, 2],
  [ 2, 2,15, 2,15,15,15,15,15, 8, 8,15,15,15, 2, 1, 2, 1, 1, 2],
  [15, 2, 2,15, 2,15, 2,15,15, 8, 8,15, 2, 2, 2, 2,15,15,15, 2],
];

// prettier-ignore
const CHUNK_2_1: Terrain[][] = [
  [15,15,15,15, 2,15,15, 2,15, 8, 8,15,15, 2, 2,15, 2, 2, 2, 2],
  [ 2, 2, 1, 2,15, 1, 2, 2,15, 8, 8,15,15,15,15,15, 1, 2, 1,15],
  [ 2, 2,15,15,15, 2,15,15,15, 8, 8,15,15,15, 1,15,15,15,15,15],
  [ 2,15,15,15,15,15, 1,15,15, 8, 8,15, 1,15,15,15,15, 1,15,15],
  [15,15,15, 1,15, 2,15,15,15, 8, 8,15,15,15,15,15,15,15, 1, 2],
  [15, 2, 2,15,15,15, 2,15,15, 8, 8,15,15,15, 1, 2,15,15, 1,15],
  [15,15,15,15,15,15,15,15,15, 8, 8,15,15,15,15,15,15,15,15,15],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 5, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [15,15,15,15,15,15,15,15,15, 8, 8,15,15,15,15,15,15,15,15,15],
  [15, 2,15,15,15, 1, 1,15,15, 8, 8,15,15, 1,15,15,15, 1, 2,15],
  [15, 1, 2, 1,15,15, 2,15,15, 8, 8,15,15, 1, 1,15,15,15, 2,15],
  [ 2, 2,15,15,15,15,15,15,15, 8, 8,15, 2,15,15, 1,15,15, 2,15],
  [ 2, 2,15,15, 1, 1,15,15,15, 8, 8,15,15,15,15,15, 1,15, 2,15],
  [15,15,15,15,15,15,15,15,15, 8, 8,15,15, 2,15,15,15, 2,15,15],
  [ 2,15,15, 2, 2,15,15, 2,15, 8, 8,15, 2, 2,15,15, 2, 2, 2,15],
];

// prettier-ignore
const CHUNK_3_1: Terrain[][] = [
  [ 2, 2, 2, 2, 2, 2, 2, 2, 8, 8, 8, 8, 2, 2, 2, 2, 2, 2, 2, 2],
  [ 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [ 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2],
  [ 2, 2, 2, 2, 2, 2, 2, 0, 0, 1, 1, 0, 0, 2, 2, 2, 2, 2, 2, 2],
  [ 2, 2, 2, 2, 2, 2, 0, 0, 8, 0, 0, 8, 0, 0, 2, 2, 2, 2, 2, 2],
  [ 0, 2, 2, 2, 2, 0, 0, 1, 8, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0],
  [ 0, 2, 2, 2, 0, 0, 1, 6, 8, 0, 0, 8, 0, 0, 1, 0, 0, 0, 0, 0],
  [ 0, 2, 2, 2, 0, 0, 1, 1, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 0],
  [ 0, 2, 2, 2, 0, 0, 1, 0, 8, 0, 0, 8, 0, 0, 1, 0, 0, 0, 0, 0],
  [ 0, 2, 2, 2, 2, 0, 0, 0, 8, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0],
  [ 2, 2, 2, 2, 2, 2, 0, 0, 8, 0, 0, 8, 0, 0, 2, 2, 2, 2, 2, 2],
  [ 2, 2, 2, 2, 2, 2, 2, 0, 8, 1, 1, 8, 0, 2, 2, 2, 2, 2, 2, 2],
  [ 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2],
  [ 2, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2],
  [ 2, 2, 2, 2, 2, 2, 2, 2, 8, 8, 8, 8, 2, 2, 2, 2, 2, 2, 2, 2],
];

// prettier-ignore
const CHUNK_4_1: Terrain[][] = [
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [ 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1],
  [ 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1],
  [ 1, 0, 0, 1, 0, 0, 0, 0, 8, 0, 0, 8, 0, 0, 0, 0, 1, 0, 0, 1],
  [ 1, 0, 1, 1, 0, 0, 0, 8, 8, 0, 0, 8, 8, 0, 0, 0, 1, 1, 0, 1],
  [ 0, 0, 0, 1, 0, 0, 8, 8, 0, 1, 1, 0, 8, 8, 0, 0, 1, 0, 0, 0],
  [ 0, 0, 1, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0, 1, 0, 0],
  [ 0, 8, 8, 8, 8, 8, 0, 0, 0, 0, 7, 0, 0, 0, 8, 8, 8, 8, 8, 0],
  [ 0, 0, 1, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0, 1, 0, 0],
  [ 0, 0, 0, 1, 0, 0, 8, 8, 0, 1, 1, 0, 8, 8, 0, 0, 1, 0, 0, 0],
  [ 1, 0, 1, 1, 0, 0, 0, 8, 8, 0, 0, 8, 8, 0, 0, 0, 1, 1, 0, 1],
  [ 1, 0, 0, 1, 0, 0, 0, 0, 8, 0, 0, 8, 0, 0, 0, 0, 1, 0, 0, 1],
  [ 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1],
  [ 1, 1, 0,12, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1],
];

// prettier-ignore
const CHUNK_5_1: Terrain[][] = [
  [ 2, 2, 2, 2, 2, 2, 2, 2, 8, 8, 8, 8, 2, 2, 2, 2, 2, 2, 2, 2],
  [ 2, 2, 1, 1, 2, 2, 2, 1, 0, 0, 0, 1, 2, 2, 2, 1, 1, 2, 2, 2],
  [ 2, 1, 1, 0, 0, 2, 1, 0, 0, 1, 1, 0, 0, 1, 2, 0, 0, 1, 1, 2],
  [ 2, 1, 0, 0, 0, 0, 0, 0, 8, 0, 0, 8, 0, 0, 0, 0, 0, 0, 1, 2],
  [ 2, 0, 0, 1, 0, 0, 0, 0, 8, 0, 0, 8, 0, 0, 0, 0, 1, 0, 0, 2],
  [ 0, 0, 0, 1, 0, 0, 0, 8, 8, 1, 1, 8, 8, 0, 0, 0, 1, 0, 0, 0],
  [ 0, 0, 1, 0, 0, 1, 8, 8, 0, 0, 0, 0, 8, 8, 1, 0, 0, 1, 0, 0],
  [ 0, 8, 8, 8, 8, 8, 8, 0, 0, 1, 1, 0, 0, 8, 8, 8, 8, 8, 0, 0],
  [ 0, 0, 1, 0, 0, 1, 8, 8, 0, 0, 0, 0, 8, 8, 1, 0, 0, 1, 0, 0],
  [ 0, 0, 0, 1, 0, 0, 0, 8, 8, 1, 1, 8, 8, 0, 0, 0, 1, 0, 0, 0],
  [ 2, 0, 0, 1, 0, 0, 0, 0, 8, 0, 0, 8, 0, 0, 0, 0, 1, 0, 0, 2],
  [ 2, 1, 0, 0, 0, 0, 0, 0, 8, 0, 0, 8, 0, 0, 0, 0, 0, 0, 1, 2],
  [ 2, 1, 1, 0, 0, 2, 1, 0, 0, 1, 1, 0, 0, 1, 2, 0, 0, 1, 1, 2],
  [ 2, 2, 1, 1, 2, 2, 2, 1, 0, 0, 0, 1, 2, 2, 2, 1, 1, 2, 2, 2],
  [ 2, 2, 2, 2, 2, 2, 2, 2, 8, 8, 8, 8, 2, 2, 2, 2, 2, 2, 2, 2],
];

// prettier-ignore
const CHUNK_6_1: Terrain[][] = [
  [ 2, 2, 2,17,17, 2,17, 2,17, 8, 8,17,17,17, 2,17, 2,17, 2,17],
  [ 2, 2,17, 2,17, 4,17, 4,17, 8, 8,17, 2, 2,17, 2,17,17, 4, 2],
  [ 2, 2,17, 4,17, 4,17,17,17, 8, 8,17, 4,17,17,17,17,17,17,17],
  [17, 2,17, 4,17,17,17,17,17, 8, 8,17,17, 4, 4,17,17,17,17,17],
  [17, 2,17, 4,17,17,17,17,17, 8, 8,17,17,17, 2,17,17, 2, 2,17],
  [17, 2,17,17, 4, 2,17,17,17, 8, 8,17, 4,17,17,17,17,17, 4,17],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [17, 4,17, 4,17, 2,17, 2,17, 8, 8,17,17,17,17,17,17, 4, 4,17],
  [ 2, 4,17,17,17,17,17,17,17, 8, 8,17, 4,17,17,17,17,17, 4, 2],
  [ 2, 2,17,17,17, 4, 4,17,17, 8, 8,17, 4,17, 2,17,17, 2,17,17],
  [ 2, 2,17,17, 2,17, 4, 4,17, 8, 8,17,17,17,17,17,17,17,17, 2],
  [ 2,17, 2, 2, 4,17,17, 4,17, 8, 8,17,17, 2, 4, 4,17,17, 4, 2],
  [ 2, 2,17, 2, 2,17, 2, 2,17, 8, 8,17, 2, 2,17, 2,17,17,17,17],
];

// prettier-ignore
const CHUNK_7_1: Terrain[][] = [
  [ 2,17,17,17,17,17,17,17,17, 8, 8,17, 2,17, 2,17, 2, 2,17, 2],
  [ 2, 4, 2, 4, 2,17, 2, 4,17, 8, 8,17, 4, 2,17,17,17,17,17, 2],
  [ 2, 2,17,17,17,17,17,17,17, 8, 8,17,17,17, 4, 4,17,17,17,17],
  [ 2, 2,17,17,17,17,17,17,17, 8, 8,17,17, 3, 3, 3, 4, 2,17,17],
  [17,17,17, 2, 4,17,17, 4,17, 8, 8,17, 4, 3, 3, 3,17,17,17,17],
  [17,17,17,17, 4,17, 4,17,17, 8, 8,17,17, 3, 3, 3,17,17, 2,17],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [17,17,17, 4, 4,17,17,17,17, 8, 8,17, 4, 4, 2,17,17,17,17,17],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17, 4,17,17,17],
  [17, 2,17,17, 2, 4,17,17,17, 8, 8,17, 4,17,17,17,17,17, 4, 2],
  [ 2,17,17, 2,17, 2,17,17,17, 8, 8,17,17, 2,17,17,17,17, 4, 2],
  [17, 4, 2,17, 4, 2, 2, 2,17, 8, 8,17, 4,17,17,17, 4, 2, 2,17],
  [17, 2,17,17,17, 2,17,17,17, 8, 8,17, 2, 2, 2, 2, 2, 2, 2,17],
];

// prettier-ignore
const CHUNK_8_1: Terrain[][] = [
  [15,15, 2, 2,15, 2, 2,15,15, 8, 8,15,15,15, 2, 2, 2, 2, 2,15],
  [ 2,15,15,15,15,15,15,15,15, 8, 8,15, 2, 1,15, 2, 1, 1, 1,15],
  [ 2,15,15,15,15, 1, 1,15,15, 8, 8,15, 1,15,15,15, 1, 1, 2, 2],
  [15,15, 2,15,15, 2,15,15,15, 8, 8,15, 1,15, 2,15, 1,15, 2, 2],
  [ 2, 1,15,15,15, 1, 1,15,15, 8, 8,15,15, 2,15,15, 1,15, 2, 2],
  [15, 2,15,15,15, 2,15,15,15, 8, 8,15, 2,15,15,15,15, 1, 1,15],
  [15,15,15,15,15,15,15,15,15, 8, 8,15,15,15,15,15,15,15,15,15],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [15,15,15,15,15,15,15,15,15, 8, 8,15,15,15,15,15,15,15,15,15],
  [15, 1,15,15, 1,15,15, 1,15, 8, 8,15,15,15,15,15,15,15,15,15],
  [15, 2, 2,15,15,15,15,15,15, 8, 8,15,15,15,15,15,15,15,15,15],
  [15, 2,15,15, 2, 2,15,15,15, 8, 8,15,15,15,15,15,15,15,15, 2],
  [ 2, 1,15, 1, 2,15, 1,15,15, 8, 8,15,15,15,15, 1,15,15,15,15],
  [ 2, 2, 2,15,15, 2,15, 2,15, 8, 8,15,15,15, 2, 2, 1, 1, 1,15],
  [ 2,15,15, 2,15, 2, 2,15,15, 8, 8,15,15, 2,15, 2, 2, 2,15,15],
];

// prettier-ignore
const CHUNK_9_1: Terrain[][] = [
  [13, 2,13,13,13, 2, 2, 2,13, 8, 8,13, 2, 2,13, 2, 2, 2,13,13],
  [ 2, 0, 0,13, 2,13,13,13,13, 8, 8,13, 2,13,13, 0, 2, 2,13,13],
  [ 2,13, 0,13,13,13,13,13,13, 8, 8,13, 0, 0,13,13,13, 0,13, 2],
  [ 2,13,13, 0,13, 0,13,13,13, 8, 8,13,13,13,13,13, 0,13, 2, 2],
  [ 2, 2,13, 0,13,13,13, 0,13, 8, 8,13, 0, 0, 0, 0,13,13,13, 2],
  [13,13, 0,13,13,13,13,13,13, 8, 8,13,13,13, 0, 0, 0,13,13,13],
  [13,13,13,13,13,13,13,13,13, 8, 8,13,13,13,13,13,13,13,13,13],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [13,13,13,13,13,13,13,13,13, 8, 8,13,13,13,13,13,13,13,13,13],
  [13,13,13,13, 0,13,13,13,13, 8, 8,13, 2, 2,13,13, 2,13, 2,13],
  [13, 2,13,13,13,13, 0,13,13, 8, 8,13,13,13,13,13,13,13, 0, 2],
  [ 2, 2,13,13,13,13,13,13,13, 8, 8,13, 2,13, 0,13,13,13,13,13],
  [13,13, 0,13, 0,13,13,13,13, 8, 8,13,13,13,13,13,13,13, 2, 2],
  [13, 2,13,13,13,13,13,13,13, 8, 8,13, 2,13, 0, 2, 2,13, 0,13],
  [ 2,13,13, 2,13, 2, 2, 2,13, 8, 8,13,13, 2,13,13,13,13, 2, 2],
];

// prettier-ignore
const CHUNK_0_2: Terrain[][] = [
  [ 2,17, 2, 2, 2,17,17, 2,17, 8, 8,17, 2,17, 2,17,17,17,17,17],
  [ 2,17,17, 2,17,17, 2,17,17, 8, 8,17, 4, 2, 4,17,17, 4, 4, 2],
  [ 2,17,17,17, 4,17, 2,17,17, 8, 8,17,17, 4,17, 4, 4,17,17, 2],
  [ 2,17,17,17, 4, 2,17, 4,17, 8, 8,17,17, 2, 4, 4,17,17, 2,17],
  [ 2, 4,17, 2, 2,17, 4,17,17, 8, 8,17,17, 2,17,17, 2,17, 2,17],
  [17,17,17, 4,17,17,17, 4,17, 8, 8,17, 4,17,17,17, 4, 4,17,17],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [17,17, 4,17,17,17, 2, 2,17, 8, 8,17,17,17,17,17,17, 2,17,17],
  [ 2, 2,17,17,17, 2, 2,17,17, 8, 8,17, 4, 4,17,17,17,17,17, 2],
  [ 2, 4,17, 2,17,17,17, 4,17, 8, 8,17, 4,17, 2, 4,17,17, 2,17],
  [ 2, 2,17,17,17, 2,17,17,17, 8, 8,17,17, 4, 4,17,17,17,17,17],
  [17, 4,17,17,17, 2, 2, 4,17, 8, 8,17, 4, 2,17,17,17, 2, 2, 2],
  [ 2, 2, 2,17, 2,17, 2, 2,17, 8, 8,17, 2, 2, 2,17, 2, 2,17,17],
];

// prettier-ignore
const CHUNK_1_2: Terrain[][] = [
  [ 2, 2, 2, 2, 2, 2, 2, 2,15, 8, 8,15,15,15, 2, 2, 2,15,15,15],
  [15,15,15,15,15, 2,15, 1,15, 8, 8,15, 2, 1, 1, 2, 2,15,15,15],
  [ 2,15,15, 1, 1,15,15,15,15, 8, 8,15,15, 2,15, 2, 2,15, 2, 2],
  [15,15,15,15,15,15, 1,15,15, 8, 8,15,15,15, 1,15,15, 2,15,15],
  [15, 2,15,15,15, 2,15,15,15, 8, 8,15,15,15, 2,15,15, 2,15,15],
  [15,15, 2,15,15,15,15,15,15, 8, 8,15,15,15,15,15, 1,15,15,15],
  [15,15,15,15,15,15,15,15,15, 8, 8,15,15,15,15,15,15,15,15,15],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [15,15,15,15,15,15,15,15,15, 8, 8,15,15,15,15,15,15,15,15,15],
  [15,15,15, 2,15,15, 2, 1,15, 8, 8,15,15,15, 1, 1,15,15, 2,15],
  [ 2, 2, 1,15,15, 1,15,15,15, 8, 8,15, 2,15,15, 1,15,15,15, 2],
  [15,15,15,15,15, 1,15,15,15, 8, 8,15,15,15,15,15,15, 1, 2, 2],
  [ 2,15,15, 2,15,15,15,15,15, 8, 8,15, 2, 1, 1,15,15,15, 2,15],
  [ 2,15,15,15,15,15,15,15,15, 8, 8,15,15, 1,15, 2,15, 1, 1,15],
  [ 2, 2,15,15, 2,15,15, 2,15, 8, 8,15,15, 2, 2,15, 2, 2, 2,15],
];

// prettier-ignore
const CHUNK_2_2: Terrain[][] = [
  [ 1, 2, 2, 2, 2, 2, 2, 2, 1, 8, 8, 1, 1, 2, 1, 2, 1, 1, 2, 2],
  [ 2, 1, 1, 0, 2, 0, 2, 1, 1, 8, 8, 1, 2, 0, 1, 1, 2, 0, 2, 1],
  [ 1, 1, 1, 2, 1, 2, 0, 0, 1, 8, 8, 1, 1, 1, 1, 1, 2, 0, 1, 2],
  [ 2, 2, 0, 1, 1, 1, 0, 2, 1, 8, 8, 1, 2, 2, 1, 1, 1, 1, 1, 2],
  [ 1, 0, 1, 1, 1, 0, 1, 1, 1, 8, 8, 1, 1, 1, 1, 0, 2, 1, 1, 2],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 2, 1, 1, 1, 2, 1],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [ 1, 2, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 0, 1, 1],
  [ 2, 1, 1, 0, 2, 1, 0, 1, 1, 8, 8, 1, 1, 1, 0, 1, 2, 1, 2, 2],
  [ 2, 1, 0, 1, 1, 0, 2, 1, 1, 8, 8, 1, 1, 1, 0, 1, 1, 1, 0, 1],
  [ 1, 2, 1, 0, 1, 1, 1, 1, 1, 8, 8, 1, 0, 1, 0, 1, 1, 1, 0, 2],
  [ 2, 1, 2, 1, 1, 0, 1, 2, 1, 8, 8, 1, 2, 0, 2, 1, 2, 1, 1, 2],
  [ 2, 1, 2, 1, 2, 1, 2, 1, 1, 8, 8, 1, 2, 2, 1, 2, 1, 1, 2, 1],
];

// prettier-ignore
const CHUNK_3_2: Terrain[][] = [
  [ 2, 2, 2, 2, 2, 2, 2, 2, 8, 8, 8, 8, 2, 2, 2, 2, 2, 2, 2, 2],
  [ 2, 0, 0, 0, 1, 0, 0, 0, 8, 0, 0, 8, 0, 0, 1, 0, 0, 0, 0, 2],
  [ 2, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 2],
  [ 2, 0, 0, 1, 0, 0, 0, 8, 8, 0, 0, 8, 8, 0, 0, 0, 1, 0, 0, 2],
  [ 0, 0, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0],
  [ 0, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0],
  [ 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0],
  [ 0, 8, 8, 8, 8, 5, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 0],
  [ 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0],
  [ 0, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0],
  [ 0, 0, 1, 0, 0, 0, 8, 8, 0, 0, 0, 0, 8, 8, 0, 0, 0, 1, 0, 2],
  [ 2, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0, 8, 8, 0, 0, 0, 0, 0, 0, 2],
  [ 2, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 2],
  [ 2, 0, 0, 0, 1, 0, 0, 0, 8, 0, 0, 8, 0, 0, 1, 0, 0, 0, 0, 2],
  [ 2, 2, 2, 2, 2, 2, 2, 2, 8, 8, 8, 8, 2, 2, 2, 2, 2, 2, 2, 2],
];

// prettier-ignore
const CHUNK_4_2: Terrain[][] = [
  [ 2, 2, 2, 2, 2, 2, 3, 3, 8, 8, 8, 8, 3, 2, 2, 2, 2, 2, 2, 2],
  [ 2, 1, 1, 0, 0, 0, 3, 3, 4, 4, 4, 4, 3, 0, 0, 1, 1, 1, 2, 2],
  [ 2, 1, 5, 8, 0, 1, 0, 3, 4, 4, 4, 4, 3, 0, 1, 1, 6, 1, 1, 2],
  [ 2, 0, 8, 0, 0, 1, 0, 0, 3, 4, 4, 3, 0, 0, 0, 8, 8, 0, 0, 2],
  [ 0, 0, 8, 0, 1, 1, 0, 0, 0, 3, 3, 0, 0, 1, 0, 0, 8, 0, 0, 0],
  [ 0, 0, 8, 8, 8, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 8, 0, 0, 0],
  [ 0, 0, 0, 0, 8, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0, 0],
  [ 0, 0, 0, 0, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 0, 0, 0],
  [ 0, 0, 1, 0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
  [ 0, 1, 1, 0, 0, 0, 0, 0, 8, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 0],
  [ 0, 1, 0, 0, 0, 8, 8, 8, 8, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0],
  [ 2, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 2],
  [ 2, 0, 0, 1, 1, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 1, 0, 0, 0, 2],
  [ 2, 2, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 2, 2],
  [ 2, 2, 2, 2, 1, 1, 2, 2, 0, 0, 0, 0, 2, 2, 1, 1, 2, 2, 2, 2],
];

// prettier-ignore
const CHUNK_5_2: Terrain[][] = [
  [ 2, 2, 4, 4, 4, 4, 4, 4, 8, 8, 8, 8, 4, 4, 4, 4, 4, 4, 2, 2],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 8, 4, 4, 8, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 4, 4, 4, 4, 0, 3, 0, 4, 8, 4, 4, 8, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 4, 4, 4, 0, 3, 3, 0, 4, 8, 4, 4, 8, 4, 4, 0, 3, 0, 4, 4, 4],
  [ 4, 4, 4, 0, 3, 0, 0, 8, 8, 4, 4, 8, 8, 0, 3, 3, 0, 4, 4, 4],
  [ 0, 0, 4, 4, 0, 0, 8, 8, 4, 4, 4, 4, 8, 8, 0, 3, 0, 4, 4, 4],
  [ 0, 0, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 5, 8, 4, 0, 0, 4, 4, 4],
  [ 0, 8, 8, 8, 8, 8, 4, 4, 4, 4, 4, 4, 8, 8, 8, 8, 8, 4, 4, 4],
  [ 0, 0, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 8, 4, 4, 4, 4, 4, 4, 4],
  [ 0, 0, 4, 4, 4, 4, 8, 8, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4],
  [ 4, 4, 4, 0, 3, 0, 4, 8, 8, 4, 4, 8, 4, 4, 0, 3, 0, 4, 4, 4],
  [ 4, 4, 0, 3, 3, 0, 4, 4, 8, 4, 4, 8, 4, 0, 3, 3, 0, 4, 4, 4],
  [ 4, 4, 0, 3, 0, 0, 4, 4, 8, 4, 4, 8, 4, 0, 0, 3, 0, 4, 4, 4],
  [ 4, 4, 4, 0, 0, 4, 4, 4, 8, 4, 4, 8, 4, 4, 0, 0, 4, 4, 4, 4],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4],
];

// prettier-ignore
const CHUNK_6_2: Terrain[][] = [
  [ 2, 4, 2, 2, 4, 4, 2, 2, 4, 8, 8, 4, 2, 2, 2, 2, 2, 4, 2, 2],
  [ 4, 4, 4, 4, 4, 2, 2, 4, 4, 8, 8, 4, 4, 4, 2, 2, 0, 0, 4, 2],
  [ 2, 0, 4, 4, 4, 4, 4, 0, 4, 8, 8, 4, 4, 4, 4, 0, 2, 4, 4, 2],
  [ 2, 2, 4, 0, 2, 4, 0, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 2, 4, 2],
  [ 2, 2, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 2, 4],
  [ 4, 2, 0, 0, 4, 4, 2, 4, 4, 8, 8, 4, 2, 0, 4, 4, 2, 4, 4, 4],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 4, 4, 0, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 2, 4],
  [ 2, 0, 4, 0, 4, 2, 2, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 2, 2],
  [ 2, 4, 4, 0, 0, 4, 0, 4, 4, 8, 8, 4, 0, 4, 4, 4, 4, 4, 2, 2],
  [ 2, 4, 0, 2, 4, 4, 2, 4, 4, 8, 8, 4, 4, 2, 4, 4, 4, 0, 4, 2],
  [ 4, 4, 0, 4, 4, 0, 2, 4, 4, 8, 8, 4, 2, 4, 2, 2, 4, 4, 4, 2],
  [ 2, 2, 4, 2, 2, 4, 4, 4, 4, 8, 8, 4, 2, 4, 2, 4, 4, 4, 2, 2],
];

// prettier-ignore
const CHUNK_7_2: Terrain[][] = [
  [ 2, 2, 4, 4, 2, 4, 2, 4, 4, 8, 8, 4, 2, 2, 2, 2, 4, 4, 4, 2],
  [ 4, 0, 4, 4, 2, 4, 0, 4, 4, 8, 8, 4, 2, 2, 4, 4, 4, 4, 2, 4],
  [ 2, 4, 4, 4, 4, 4, 2, 4, 4, 8, 8, 4, 2, 4, 4, 4, 4, 4, 4, 4],
  [ 4, 4, 4, 4, 4, 4, 0, 0, 4, 8, 8, 4, 0, 4, 4, 0, 4, 0, 2, 4],
  [ 4, 4, 0, 4, 2, 4, 4, 0, 4, 8, 8, 4, 0, 0, 4, 4, 4, 0, 0, 2],
  [ 4, 4, 2, 0, 4, 4, 4, 4, 4, 8, 8, 4, 4, 0, 4, 4, 4, 4, 2, 4],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 5, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 4, 4, 0, 0, 3, 3, 3, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 2, 2, 4, 4, 3, 3, 3, 4, 4, 8, 8, 4, 4, 4, 2, 4, 2, 2, 2, 2],
  [ 4, 0, 4, 2, 3, 3, 3, 2, 4, 8, 8, 4, 4, 0, 4, 2, 2, 4, 2, 4],
  [ 4, 2, 4, 0, 4, 4, 0, 0, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 2],
  [ 4, 2, 4, 2, 2, 4, 4, 4, 4, 8, 8, 4, 4, 2, 2, 0, 4, 4, 2, 2],
  [ 2, 4, 4, 4, 2, 2, 2, 4, 4, 8, 8, 4, 4, 2, 2, 2, 4, 4, 2, 4],
];

// prettier-ignore
const CHUNK_8_2: Terrain[][] = [
  [17, 2,17, 2, 2, 2, 2,17,17, 8, 8,17, 2, 2, 2,17, 2, 2,17, 2],
  [ 2, 2, 2, 2,17,17, 4,17,17, 8, 8,17,17, 2, 4, 2, 4,17, 2,17],
  [17,17,17, 4,17,17,17,17,17, 8, 8,17,17,17,17,17, 4, 4, 4, 2],
  [ 2,17, 4,17,17,17,17,17,17, 8, 8,17,17,17,17,17, 4,17,17, 2],
  [ 2, 2,17,17,17, 4, 2, 2,17, 8, 8,17,17, 2,17,17, 2,17,17,17],
  [17,17, 4,17,17, 4, 4, 2,17, 8, 8,17, 4,17,17,17, 2,17,17,17],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [17,17,17, 2,17,17,17,17,17, 8, 8,17,17,17,17,17, 4,17, 2,17],
  [17, 2, 2,17,17,17, 4,17,17, 8, 8,17,17, 2,17, 2,17,17, 2, 2],
  [ 2,17,17,17,17,17,17, 4,17, 8, 8,17,17,17,17,17,17, 4,17, 2],
  [17, 4,17,17,17,17, 4,17,17, 8, 8,17, 2, 4, 4,17, 4,17, 2,17],
  [ 2, 2,17,17,17,17, 2, 4,17, 8, 8,17,17,17,17, 4,17, 2, 2, 2],
  [17,17, 2, 2, 2,17,17, 2,17, 8, 8,17,17, 2,17, 2, 2,17, 2, 2],
];

// prettier-ignore
const CHUNK_9_2: Terrain[][] = [
  [17, 2,17, 2,17, 2, 2,17,17, 8, 8,17,17,17, 2, 2, 2,17, 2,17],
  [17, 4,17,17,17,17, 4,17,17, 8, 8,17,17,17,17, 2,17,17, 2,17],
  [ 2, 2,17,17,17, 4,17,17,17, 8, 8,17,17, 4,17,17, 4, 2, 4, 2],
  [ 2, 4,17,17,17,17, 4,17,17, 8, 8,17,17,17,17,17,17,17,17, 2],
  [17, 2,17,17,17,17, 4, 2,17, 8, 8,17,17,17,17,17,17, 4,17, 2],
  [17, 2,17,17,17,17,17,17,17, 8, 8,17,17, 2,17, 4,17, 4,17,17],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [17,17,17,17,17, 2,17, 2,17, 8, 8,17,17, 4, 2,17,17,17, 2,17],
  [17,17,17,17, 4,17,17,17,17, 8, 8,17,17,17, 2,17,17,17, 2,17],
  [ 2, 2,17,17, 4,17,17, 2,17, 8, 8,17, 2,17,17, 4,17, 4,17,17],
  [ 2,17,17,17,17,17, 4,17,17, 8, 8,17, 4,17,17,17, 2,17,17,17],
  [ 2,17, 4,17, 2,17,17,17,17, 8, 8,17, 2, 4, 2, 2,17,17, 2, 2],
  [ 2,17,17, 2, 2, 2, 2,17,17, 8, 8,17, 2,17, 2, 2, 2,17, 2,17],
];

// prettier-ignore
const CHUNK_0_3: Terrain[][] = [
  [14, 3,14,14,14, 3, 3,14,14, 8, 8,14,14,14,14,14, 3,14,14,14],
  [14, 3,14, 3, 0, 0,14,14,14, 8, 8,14,14,14,14,14,14,14,14, 3],
  [ 3,14, 0, 0,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14, 3],
  [14, 3,14,14,14,14,14,14,14, 8, 8,14, 0,14, 3,14,14,14, 0,14],
  [ 3,14, 0, 3, 0,14,14,14,14, 8, 8,14, 0, 3, 0,14,14,14,14,14],
  [14, 3,14, 0,14, 3, 0, 0,14, 8, 8,14,14,14, 0, 3, 3, 3, 3,14],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [14, 0,14, 3,14, 0, 0, 0,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [ 3, 0,14, 3, 0,14, 3, 3,14, 8, 8,14,14,14,14,14,14, 0, 3,14],
  [14,14,14,14, 0,14,14,14,14, 8, 8,14, 0,14,14,14, 0,14,14,14],
  [14,14, 3,14,14,14,14, 0,14, 8, 8,14,14,14, 0, 3,14,14, 3,14],
  [14,14,14,14, 0, 3,14, 0,14, 8, 8,14,14, 0,14,14,14,14,14, 3],
  [ 3,14, 3, 3, 3, 3, 3, 3,14, 8, 8,14, 3, 3,14,14,14,14,14,14],
];

// prettier-ignore
const CHUNK_1_3: Terrain[][] = [
  [14, 3,14, 3, 3, 3, 3,14,14, 8, 8,14, 3, 3, 3, 3,14,14, 3, 3],
  [ 3,14,14, 0, 0, 0, 3,14,14, 8, 8,14, 3,14,14, 3, 3,14,14,14],
  [ 3,14,14, 0, 3, 3, 0, 0,14, 8, 8,14,14,14,14, 0,14,14, 3, 3],
  [ 3, 3, 3,14,14, 3,14,14,14, 8, 8,14,14,14, 3, 3, 3,14,14, 3],
  [ 3,14,14,14, 0, 0,14,14,14, 8, 8,14,14,14, 3, 3, 3, 0,14, 3],
  [14,14, 0,14,14, 0,14,14,14, 8, 8,14,14, 3, 3, 3, 3, 3,14,14],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 5, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [14, 3,14,14,14,14,14, 0,14, 8, 8,14, 3, 0, 0, 3,14,14, 3,14],
  [ 3,14,14, 3, 0,14,14,14,14, 8, 8,14, 0,14,14,14,14,14,14, 3],
  [14,14, 0,14,14,14,14,14,14, 8, 8,14,14, 0, 3,14,14,14,14,14],
  [14,14, 0,14,14,14, 0, 3,14, 8, 8,14,14, 0,14,14, 3,14,14, 3],
  [ 3,14, 3, 3, 3,14, 3, 3,14, 8, 8,14, 3,14, 3,14,14,14,14, 3],
  [ 3, 3,14, 3, 3,14, 3, 3,14, 8, 8,14, 3,14, 3, 3,14, 3, 3, 3],
];

// prettier-ignore
const CHUNK_2_3: Terrain[][] = [
  [ 1, 1, 1, 2, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 2, 2, 2, 2, 1, 1],
  [ 2, 0, 1, 2, 1, 0, 1, 0, 1, 8, 8, 1, 2, 0, 1, 2, 1, 1, 0, 2],
  [ 2, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 2, 2, 0, 1, 1, 1, 1],
  [ 1, 1, 1, 2, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 0, 1, 1, 0, 0, 1],
  [ 2, 0, 0, 1, 1, 1, 2, 1, 1, 8, 8, 1, 1, 1, 1, 1, 0, 1, 2, 2],
  [ 1, 2, 1, 1, 1, 1, 2, 1, 1, 8, 8, 1, 1, 0, 0, 0, 0, 1, 2, 1],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [ 1, 2, 0, 1, 1, 0, 0, 1, 1, 8, 8, 1, 1, 1, 1, 1, 0, 1, 2, 1],
  [ 2, 1, 1, 1, 1, 1, 2, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 0, 2, 1, 1, 1, 1, 0, 1],
  [ 2, 0, 1, 2, 1, 2, 2, 1, 1, 8, 8, 1, 2, 1, 1, 1, 1, 1, 0, 1],
  [ 1, 1, 1, 1, 1, 2, 1, 1, 1, 8, 8, 1, 2, 2, 0, 0, 2, 0, 1, 2],
  [ 1, 2, 1, 1, 2, 1, 2, 1, 1, 8, 8, 1, 2, 2, 1, 2, 1, 2, 2, 2],
];

// prettier-ignore
const CHUNK_3_3: Terrain[][] = [
  [ 2, 2, 2, 2, 2, 2, 2, 2, 8, 8, 8, 8, 2, 2, 2, 2, 2, 2, 2, 2],
  [ 2, 0, 0, 3, 0, 0, 3, 0, 8, 0, 0, 8, 0, 3, 0, 0, 3, 0, 0, 2],
  [ 2, 0, 3, 3, 0, 0, 0, 0, 8, 0, 0, 8, 0, 0, 0, 3, 3, 0, 0, 2],
  [ 2, 0, 0, 3, 0, 0, 0, 8, 8, 0, 0, 8, 8, 0, 0, 0, 3, 0, 0, 2],
  [ 2, 0, 0, 0, 0, 3, 8, 8, 0, 0, 0, 0, 8, 8, 3, 0, 0, 0, 0, 0],
  [ 0, 0, 3, 0, 0, 8, 8, 0, 0, 3, 3, 0, 0, 8, 8, 0, 0, 3, 0, 0],
  [ 0, 0, 0, 0, 8, 8, 0, 0, 3, 3, 3, 3, 0, 0, 8, 8, 0, 0, 0, 0],
  [ 0, 0, 3, 8, 8, 0, 0, 3, 3, 0, 0, 3, 3, 0, 0, 8, 8, 8, 8, 0],
  [ 0, 0, 0, 0, 8, 8, 0, 0, 3, 3, 3, 3, 0, 0, 8, 8, 0, 0, 0, 0],
  [ 0, 0, 3, 0, 0, 8, 8, 0, 0, 3, 3, 0, 0, 8, 8, 0, 0, 3, 0, 0],
  [ 2, 0, 0, 0, 0, 3, 8, 8, 0, 0, 0, 0, 8, 8, 3, 0, 0, 0, 0, 2],
  [ 2, 0, 0, 3, 0, 0, 0, 8, 8, 0, 0, 8, 8, 0, 0, 0, 3, 0, 0, 2],
  [ 2, 0, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 3, 0, 0, 2],
  [ 2, 0, 0, 3, 0, 0, 3, 0, 0, 0, 0, 0, 0, 3, 0, 0, 3, 0, 0, 2],
  [ 2, 2, 2, 2, 2, 2, 2, 2, 8, 8, 8, 8, 2, 2, 2, 2, 2, 2, 2, 2],
];

// prettier-ignore
const CHUNK_4_3: Terrain[][] = [
  [ 1, 1, 1, 1, 1, 2, 2, 2, 0, 0, 0, 0, 2, 2, 1, 1, 1, 1, 1, 1],
  [ 1, 0, 0, 0, 1, 1, 0, 0, 8, 0, 0, 8, 0, 0, 1, 1, 0, 0, 0, 1],
  [ 1, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0, 1],
  [ 1, 0, 0, 1, 0, 0, 0, 8, 8, 0, 0, 8, 8, 0, 0, 0, 1, 0, 0, 1],
  [ 1, 0, 1, 1, 0, 0, 8, 8, 0, 0, 0, 0, 8, 8, 0, 0, 1, 1, 0, 1],
  [ 0, 0, 0, 0, 0, 8, 8, 0, 0, 1, 1, 0, 0, 8, 8, 0, 0, 0, 0, 0],
  [ 0, 0, 1, 0, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 0, 1, 0, 0],
  [ 0, 8, 8, 8, 8, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 8, 8, 8, 8, 0],
  [ 0, 0, 1, 0, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 0, 1, 0, 0],
  [ 0, 0, 0, 0, 0, 8, 8, 0, 0, 1, 1, 0, 0, 8, 8, 0, 0, 0, 0, 0],
  [ 1, 0, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 8, 8, 0, 0, 0, 0, 0, 1],
  [ 1, 0, 0, 1, 0, 0, 0, 8, 8, 0, 0, 8, 8, 0, 0, 0, 1, 0, 0, 1],
  [ 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1],
  [ 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1],
];

// prettier-ignore
const CHUNK_5_3: Terrain[][] = [
  [ 2, 2, 2, 2, 4, 4, 4, 4, 8, 8, 8, 8, 4, 4, 4, 4, 2, 2, 2, 2],
  [ 2, 4, 4, 4, 4, 4, 4, 4, 8, 4, 4, 8, 4, 4, 4, 4, 4, 4, 4, 2],
  [ 2, 4, 4, 2, 4, 4, 4, 4, 8, 4, 4, 8, 4, 4, 4, 2, 4, 4, 4, 2],
  [ 2, 4, 2, 2, 4, 4, 4, 8, 8, 4, 4, 8, 8, 4, 4, 2, 2, 4, 4, 2],
  [ 2, 4, 4, 2, 4, 4, 8, 8, 0, 0, 0, 0, 8, 8, 4, 4, 2, 4, 4, 2],
  [ 0, 0, 4, 4, 4, 8, 8, 0, 0, 0, 0, 0, 0, 8, 8, 4, 4, 4, 4, 0],
  [ 0, 0, 4, 4, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 4, 4, 2, 0],
  [ 0, 8, 8, 8, 8, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0, 8, 8, 2, 2, 0],
  [ 0, 0, 4, 4, 8, 8, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 4, 4, 2, 0],
  [ 0, 0, 4, 4, 4, 8, 8, 0, 0, 0, 0, 0, 0, 8, 8, 4, 4, 4, 4, 0],
  [ 2, 4, 4, 2, 4, 4, 8, 8, 0, 0, 0, 0, 8, 8, 4, 4, 2, 4, 4, 2],
  [ 2, 4, 2, 2, 4, 4, 4, 8, 8, 4, 4, 8, 8, 4, 4, 2, 2, 4, 4, 2],
  [ 2, 4, 4, 2, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 2, 4, 4, 4, 2],
  [ 2, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 2],
  [ 2, 2, 2, 2, 2, 2, 2, 2, 8, 8, 8, 8, 2, 2, 2, 2, 2, 2, 2, 2],
];

// prettier-ignore
const CHUNK_6_3: Terrain[][] = [
  [17,16,16,17,16,16,16,16,17, 8, 8,17,17,16,17,17,17,16,17,17],
  [17,17,17, 4,17,16,16,17,17, 8, 8,17,17,17,17,16,16,17,16,16],
  [16, 4,17, 4, 4,17,16,17,17, 8, 8,17,17,17,17,17, 4,17,16,16],
  [16, 4,17, 4,17,17, 4,16,17, 8, 8,17,17,17,17,16, 4,17,17,17],
  [16,17,17,17, 4,17,17,17,17, 8, 8,17,17,17,17,17,17,17, 4,16],
  [17,16,17, 4,17,17, 4,17,17, 8, 8,17,17,17,17, 4,17, 4,17,17],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [17,17,17,17,17,17,17, 4,17, 8, 8,17,16,17,17,17,17,17,17,17],
  [17,16,17,17,17,17,17,16,17, 8, 8,17, 4,17,17,17,17,17,17,16],
  [17,17,16, 4,16,17,17,17,17, 8, 8,17, 4,17, 4,17,17,17,17,16],
  [16,17, 4,17,17,16,17, 4,17, 8, 8,17,17,17,17,17,17,17,16,16],
  [17,16,16,16,17,17,17,16,17, 8, 8,17,17,17,17, 4,17,16,16,17],
  [16,16,16,17,17,16,16,17,17, 8, 8,17,17,16,17,17,17,16,17,16],
];

// prettier-ignore
const CHUNK_7_3: Terrain[][] = [
  [ 4, 4, 2, 2, 2, 4, 2, 4, 4, 8, 8, 4, 4, 2, 2, 4, 2, 2, 4, 2],
  [ 4, 0, 0, 2, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 2, 4, 2],
  [ 4, 2, 4, 4, 2, 4, 4, 2, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 2, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 2, 2, 4, 4, 4, 4, 4, 2],
  [ 4, 4, 4, 4, 2, 0, 0, 4, 4, 8, 8, 4, 4, 4, 4, 2, 2, 4, 4, 2],
  [ 4, 0, 4, 0, 2, 4, 2, 4, 4, 8, 8, 4, 4, 2, 4, 4, 4, 4, 0, 4],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 4, 4, 4, 2, 4, 0, 4, 0, 4, 8, 8, 4, 4, 4, 2, 4, 0, 4, 2, 4],
  [ 4, 0, 0, 4, 4, 0, 0, 0, 4, 8, 8, 4, 0, 0, 4, 0, 4, 0, 2, 2],
  [ 2, 0, 4, 4, 0, 4, 2, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 2, 4],
  [ 4, 4, 4, 4, 4, 0, 0, 4, 4, 8, 8, 4, 4, 4, 0, 0, 4, 2, 0, 4],
  [ 2, 4, 4, 2, 4, 2, 0, 2, 4, 8, 8, 4, 0, 4, 4, 4, 4, 4, 4, 2],
  [ 2, 2, 2, 2, 2, 4, 4, 4, 4, 8, 8, 4, 4, 2, 4, 2, 2, 2, 4, 2],
];

// prettier-ignore
const CHUNK_8_3: Terrain[][] = [
  [ 2, 4, 2, 4, 4, 2, 2, 2, 4, 8, 8, 4, 2, 4, 2, 2, 4, 4, 4, 4],
  [ 4, 2, 4, 4, 2, 4, 4, 2, 4, 8, 8, 4, 4, 2, 2, 4, 4, 0, 4, 2],
  [ 4, 0, 4, 4, 4, 4, 4, 0, 4, 8, 8, 4, 4, 4, 2, 0, 4, 4, 0, 2],
  [ 2, 4, 4, 4, 4, 4, 4, 2, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 0, 2],
  [ 2, 0, 4, 4, 0, 4, 0, 4, 4, 8, 8, 4, 2, 4, 0, 4, 4, 4, 4, 2],
  [ 4, 4, 4, 4, 2, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 2, 4],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 4, 4, 4, 4, 0, 0, 4, 4, 4, 8, 8, 4, 0, 4, 4, 4, 4, 0, 2, 4],
  [ 2, 4, 4, 2, 4, 4, 0, 4, 4, 8, 8, 4, 2, 4, 4, 4, 4, 0, 4, 2],
  [ 2, 0, 4, 4, 4, 4, 0, 4, 4, 8, 8, 4, 4, 4, 4, 2, 0, 4, 4, 4],
  [ 2, 4, 4, 4, 0, 4, 0, 4, 4, 8, 8, 4, 2, 0, 0, 4, 0, 2, 4, 2],
  [ 2, 2, 0, 2, 4, 2, 4, 4, 4, 8, 8, 4, 4, 2, 4, 2, 2, 2, 2, 4],
  [ 2, 4, 2, 4, 4, 2, 2, 2, 4, 8, 8, 4, 4, 4, 2, 4, 2, 4, 4, 4],
];

// prettier-ignore
const CHUNK_9_3: Terrain[][] = [
  [ 2,17,17, 2,17,17, 2,17,17, 8, 8,17,17,17,17,17,17,17, 2, 2],
  [ 2, 4,17, 4, 2,17,17,17,17, 8, 8,17, 2,17,17,17, 4,17, 4, 2],
  [17,17,17, 4,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17, 2],
  [17, 4, 2,17,17,17, 4,17,17, 8, 8,17,17,17, 4,17,17, 2,17, 2],
  [17,17,17,17,17,17, 4,17,17, 8, 8,17,17, 2, 2,17,17,17, 2,17],
  [17, 2,17,17,17,17, 2, 2,17, 8, 8,17,17,17,17,17,17,17, 4,17],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [17, 4,17,17,17,17,17, 2,17, 8, 8,17,17, 4, 2, 2,17,17,17,17],
  [ 2, 2,17, 4,17,17,17, 4,17, 8, 8,17,17,17, 4,17,17,17, 2, 2],
  [ 2,17,17,17,17, 2,17,17,17, 8, 8,17,17,17,17, 4,17, 4, 2, 2],
  [ 2, 4,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17, 4,17, 2,17],
  [ 2,17,17, 2,17,17,17, 4,17, 8, 8,17,17,17,17, 4,17, 2,17, 2],
  [ 2, 2, 2, 2,17, 2,17, 2,17, 8, 8,17, 2,17, 2, 2, 2,17,17, 2],
];

// prettier-ignore
const CHUNK_0_4: Terrain[][] = [
  [ 3, 3,14, 3,14, 3,14, 3,14, 8, 8,14, 3,14, 3, 3, 3,14,14,14],
  [14,14,14,14,14, 0,14,14,14, 8, 8,14,14,14,14,14,14, 3,14,14],
  [14, 3,14, 3,14,14,14,14,14, 8, 8,14,14, 0,14,14, 3,14,14, 3],
  [14,14,14,14,14,12,14,14,14, 8, 8,14, 3,14,14,14,14,14,14,14],
  [ 3, 3,14,14, 3,14,14, 0,14, 8, 8,14,14, 3, 3, 0, 0,14,14, 3],
  [14,14,14, 3,14,14,14,14,14, 8, 8,14,14,14,14,14,14, 3, 0,14],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [14, 0, 0,14,14,14,14,14,14, 8, 8,14, 0,14,14, 0,14,14, 0,14],
  [ 3, 3, 0,14,14,14, 3,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [14,14,14, 0,14, 3,14, 0,14, 8, 8,14,14,14, 0,14,14, 3, 3,14],
  [ 3,14,14, 0,14,14,14,14,14, 8, 8,14,14,14, 3,14, 0,14,14,14],
  [ 3,14, 3,14, 3, 3,14, 3,14, 8, 8,14,14, 0,14, 3, 3,14,14,14],
  [14, 3,14,14,14,14, 3, 3,14, 8, 8,14, 3, 3, 3,14,14,14, 3, 3],
];

// prettier-ignore
const CHUNK_1_4: Terrain[][] = [
  [ 3, 3, 3, 3, 3, 3,14, 3,14, 8, 8,14, 3, 3,14,14, 3, 3,14, 3],
  [ 3, 3, 0,14, 3, 3,14, 3,14, 8, 8,14, 0,14, 3, 3,14, 0, 3,14],
  [14,14,14,14, 3, 3, 0,14,14, 8, 8,14,14,14, 3, 3,14,14, 0,14],
  [ 3,14,14,14, 0, 0, 0, 3,14, 8, 8,14,14, 0,14, 0,14,14, 3, 3],
  [ 3, 3,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14, 0,14, 3],
  [14, 0, 0,14,14,14,14, 0,14, 8, 8,14,14,14,14,14, 0,14,14,14],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [14,14, 0,14, 0,14,14,14,14, 8, 8,14, 0,14, 3,14, 3, 0, 3,14],
  [14,14,14, 0,14,14, 0,14,14, 8, 8,14, 0,14, 0,14,14,14, 3, 3],
  [14, 3, 0,14,14,14,14,14,14, 8, 8,14, 0,14,14, 0,14,14,14,14],
  [ 3,14,14, 3,14,14, 0, 3,14, 8, 8,14,14, 0,14,14, 3,14,14,14],
  [ 3,14, 0, 3,14, 0, 3,14,14, 8, 8,14, 3,14, 3,14, 3,14,14,14],
  [ 3, 3,14,14, 3,14,14, 3,14, 8, 8,14,14, 3,14, 3,14, 3,14, 3],
];

// prettier-ignore
const CHUNK_2_4: Terrain[][] = [
  [ 2, 2, 1, 1, 2, 2, 2, 2, 1, 8, 8, 1, 2, 2, 2, 2, 1, 2, 1, 2],
  [ 1, 2, 0, 1, 2, 1, 1, 2, 1, 8, 8, 1, 1, 1, 1, 1, 1, 2, 0, 1],
  [ 2, 1, 1, 1, 1, 1, 1, 2, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 2, 1],
  [ 2, 2, 1, 0, 1, 2, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 2, 0, 1],
  [ 2, 1, 2, 1, 2, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 2, 2],
  [ 1, 2, 1, 0, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 0, 1, 1, 1, 1, 1],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [ 1, 1, 0, 1, 1, 0, 1, 0, 1, 8, 8, 1, 1, 1, 0, 0, 2, 0, 2, 1],
  [ 2, 1, 1, 0, 1, 2, 0, 1, 1, 8, 8, 1, 1, 1, 1, 2, 1, 1, 2, 2],
  [ 1, 1, 0, 1, 1, 2, 1, 0, 1, 8, 8, 1, 2, 0, 1, 0, 2, 2, 0, 1],
  [ 1, 1, 2, 1, 0, 1, 2, 1, 1, 8, 8, 1, 1, 1, 1, 0, 1, 1, 1, 1],
  [ 1, 2, 0, 1, 1, 2, 1, 2, 1, 8, 8, 1, 0, 1, 1, 0, 2, 2, 1, 2],
  [ 2, 1, 1, 2, 2, 1, 1, 2, 1, 8, 8, 1, 1, 2, 2, 1, 2, 2, 2, 1],
];

// prettier-ignore
const CHUNK_3_4: Terrain[][] = [
  [ 1, 2, 2, 2, 2, 2, 2, 1, 1, 8, 8, 1, 1, 2, 1, 2, 2, 2, 1, 2],
  [ 2, 1, 1, 1, 0, 1, 1, 1, 1, 8, 8, 1, 2, 1, 2, 1, 1, 2, 1, 2],
  [ 2, 2, 1, 1, 1, 1, 0, 1, 1, 8, 8, 1, 0, 1, 0, 1, 2, 1, 2, 2],
  [ 2, 1, 1, 1, 0, 0, 1, 1, 1, 8, 8, 1, 1, 1, 2, 1, 1, 1, 2, 1],
  [ 1, 1, 2, 1, 1, 0, 1, 1, 1, 8, 8, 1, 0, 0, 2, 1, 0, 1, 1, 2],
  [ 1, 0, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 0, 1, 2, 1],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [ 1, 0, 1, 1, 1, 0, 1, 1, 1, 8, 8, 1, 0, 0, 0, 1, 1, 1, 2, 1],
  [ 1, 0, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 0, 1, 1, 0, 1, 1, 2],
  [ 2, 1, 1, 1, 0, 1, 1, 0, 1, 8, 8, 1, 1, 1, 0, 2, 2, 0, 1, 2],
  [ 1, 1, 1, 2, 2, 1, 1, 1, 1, 8, 8, 1, 0, 1, 1, 1, 1, 0, 2, 1],
  [ 2, 1, 1, 2, 1, 1, 0, 2, 1, 8, 8, 1, 2, 1, 1, 1, 1, 1, 2, 2],
  [ 2, 2, 2, 2, 2, 2, 1, 1, 1, 8, 8, 1, 1, 1, 2, 2, 2, 2, 2, 2],
];

// prettier-ignore
const CHUNK_4_4: Terrain[][] = [
  [15,15, 2, 2, 2, 2, 2, 2,15, 8, 8,15, 2, 2, 2,15,15, 2, 2, 2],
  [ 2, 1, 2,15,15, 1, 1,15,15, 8, 8,15,15,15,15,15,15,15, 2,15],
  [ 2,15,15,15, 1,15,15, 2,15, 8, 8,15, 1,15, 2,15,15, 1,15,15],
  [ 2,15,15, 1, 1,15,15, 2,15, 8, 8,15,15, 2,15,15,15,15,15,15],
  [15,15,15,15,15, 1, 1,15,15, 8, 8,15,15,15,15, 1,15,15, 2,15],
  [15,15,15, 1,15,15,15, 1,15, 8, 8,15,15, 2, 2,15,15,15,15,15],
  [15,15,15,15,15,15,15,15,15, 8, 8,15,15,15,15,15,15,15,15,15],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [15,15,15,15,15,15,15,15,15, 8, 8,15,15,15,15,15,15,15,15,15],
  [15, 1,15, 1,15,15,15, 1,15, 8, 8,15, 2, 1,15,15, 1,15, 1,15],
  [ 2,15, 1,15,15,15,15,15,15, 8, 8,15,15,15, 1, 2, 1,15,15, 2],
  [15,15,15,15,15,15,15, 1,15, 8, 8,15,15, 1,15,15, 1, 2, 2, 2],
  [15,15,15, 2, 2,15,15,15,15, 8, 8,15,15,15,15,15,15,15,15, 2],
  [15, 2,15,15,15,15,15, 2,15, 8, 8,15, 2, 2, 2, 1,15, 2,15, 2],
  [ 2, 2,15,15,15, 2,15,15,15, 8, 8,15,15,15,15,15,15,15,15, 2],
];

// prettier-ignore
const CHUNK_5_4: Terrain[][] = [
  [ 2, 2, 4, 2, 2, 2, 2, 4, 4, 8, 8, 4, 4, 4, 2, 2, 4, 2, 4, 2],
  [ 2, 4, 4, 4, 4, 4, 0, 2, 4, 8, 8, 4, 0, 4, 4, 2, 4, 0, 4, 4],
  [ 4, 2, 0, 4, 0, 2, 2, 4, 4, 8, 8, 4, 2, 0, 4, 4, 4, 4, 2, 2],
  [ 4, 4, 4, 0, 4, 2, 4, 2, 4, 8, 8, 4, 4, 4, 0, 2, 4, 4, 4, 2],
  [ 2, 2, 2, 4, 4, 4, 2, 0, 4, 8, 8, 4, 4, 4, 0, 4, 0, 4, 4, 2],
  [ 4, 2, 4, 4, 4, 0, 4, 0, 4, 8, 8, 4, 4, 4, 4, 2, 4, 4, 2, 4],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 4, 2, 4, 0, 4, 4, 4, 4, 4, 8, 8, 4, 2, 0, 4, 4, 4, 4, 2, 4],
  [ 2, 0, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 0, 2],
  [ 2, 4, 0, 4, 4, 4, 4, 2, 4, 8, 8, 4, 0, 4, 4, 4, 0, 2, 4, 2],
  [ 4, 2, 0, 0, 4, 4, 4, 4, 4, 8, 8, 4, 4, 2, 4, 4, 4, 0, 2, 4],
  [ 4, 4, 2, 4, 2, 4, 4, 0, 4, 8, 8, 4, 4, 4, 2, 0, 2, 2, 4, 2],
  [ 2, 2, 4, 2, 2, 2, 2, 2, 4, 8, 8, 4, 2, 2, 2, 2, 4, 2, 2, 2],
];

// prettier-ignore
const CHUNK_6_4: Terrain[][] = [
  [17,17,16,16,16,16,17,16,17, 8, 8,17,17,17,17,16,16,16,16,16],
  [16,17,17, 4,17,16,17,17,17, 8, 8,17, 4,17,17,17,17, 4,16,16],
  [17,17,17,17,17, 4,17,17,17, 8, 8,17,17,17,17,17,16,17,17,17],
  [17,16,17, 4,17,17,17,17,17, 8, 8,17,17,17,17,17,16,17,17,16],
  [16,17, 4,17,17,17, 4,16,17, 8, 8,17, 4,17,17,17, 4,17,17,16],
  [17,17,17, 4,17, 4,17,17,17, 8, 8,17,16, 4,17,17, 4,17,16,17],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 5, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [17, 4,17, 4,17,17,17,17,17, 8, 8,17,17, 4,16,16,16,16,17,17],
  [16,17,17,17,17,17, 4,17,17, 8, 8,17, 4,16,16,16,16, 4,16,16],
  [17,17,17,17, 4,16,17,16,17, 8, 8,17,17,16,16,16,16,17,17,16],
  [16,17,17,17, 4, 4, 4,17,17, 8, 8,17,17,17, 4,17,17, 4, 4,16],
  [17,17,17,17,16,17,16,17,17, 8, 8,17, 4,17,17,17,16,17,17,16],
  [17,17,17,17,16,17,17,17,17, 8, 8,17,17,16,16,16,16,16,16,16],
];

// prettier-ignore
const CHUNK_7_4: Terrain[][] = [
  [16,16,16,16,16,17,17,17,17, 8, 8,17,17,16,17,17,17,16,17,16],
  [17,16,17, 4,17,17, 4,17,17, 8, 8,17, 4, 4,17,17, 4,16,17,17],
  [16,17,16,17,17,16,17,17,17, 8, 8,17,17,17,17,17,17, 4, 4,16],
  [17,16,17,17,17,17, 4,16,17, 8, 8,17, 4, 4,17,17,17,17, 4,16],
  [16,17,16, 4, 4,17,17,17,17, 8, 8,17, 4,17,17,17,16,17,17,16],
  [17,17,17,17,17,17,17, 4,17, 8, 8,17,17,16,17,17,17,17, 4,17],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [17,16, 4,17,16,17,17,17,17, 8, 8,17,17,17,17,16,17,17,17,17],
  [16,17,17,17,17,17,17,17,17, 8, 8,17,17,17,16,17,17,16,16,17],
  [17,17,17,17,17,17,16,17,17, 8, 8,17,17,17, 4, 4,17,17,17,17],
  [16,17,17, 4,17, 4,17,17,17, 8, 8,17, 4,17,17, 4,16,17,17,16],
  [16,16,17,17,16,17, 4,16,17, 8, 8,17,17,17, 4, 4,16,17,17,17],
  [16,17,17,17,16,16,16,17,17, 8, 8,17,16,17,16,17,16,17,17,16],
];

// prettier-ignore
const CHUNK_8_4: Terrain[][] = [
  [ 4, 2, 4, 4, 2, 4, 2, 2, 4, 8, 8, 4, 4, 2, 4, 4, 2, 2, 2, 4],
  [ 4, 2, 2, 2, 4, 4, 0, 4, 4, 8, 8, 4, 4, 4, 2, 4, 4, 0, 2, 2],
  [ 4, 0, 4, 4, 0, 4, 4, 4, 4, 8, 8, 4, 0, 4, 4, 2, 4, 4, 4, 2],
  [ 2, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 2, 4, 4],
  [ 2, 4, 4, 4, 4, 2, 2, 4, 4, 8, 8, 4, 0, 4, 4, 4, 0, 4, 2, 2],
  [ 4, 2, 2, 0, 0, 0, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 0, 2, 4],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 5, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 4, 4, 4, 4, 4, 0, 4, 4, 4, 8, 8, 4, 4, 4, 0, 4, 4, 2, 4, 4],
  [ 2, 4, 4, 4, 4, 2, 4, 0, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 2],
  [ 2, 4, 4, 4, 4, 4, 0, 0, 4, 8, 8, 4, 4, 4, 4, 0, 0, 4, 4, 2],
  [ 2, 2, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 2, 4, 4, 4, 4, 2],
  [ 4, 4, 4, 2, 4, 4, 2, 4, 4, 8, 8, 4, 0, 4, 2, 4, 2, 0, 0, 2],
  [ 4, 4, 4, 4, 4, 4, 2, 4, 4, 8, 8, 4, 2, 2, 4, 4, 4, 2, 4, 2],
];

// prettier-ignore
const CHUNK_9_4: Terrain[][] = [
  [ 4, 2, 2, 2, 4, 2, 2, 2, 4, 8, 8, 4, 4, 2, 2, 4, 2, 4, 4, 2],
  [ 2, 2, 2, 4, 4, 0, 4, 2, 4, 8, 8, 4, 0, 4, 4, 4, 2, 4, 4, 2],
  [ 2, 4, 0, 4, 0, 4, 4, 4, 4, 8, 8, 4, 0, 0, 4, 4, 4, 4, 4, 2],
  [ 4, 2, 4, 4, 0, 4, 4, 4, 4, 8, 8, 4, 4, 0, 2, 4, 4, 4, 2, 2],
  [ 2, 4, 4, 2, 0, 4, 0, 4, 4, 8, 8, 4, 2, 2, 0, 4, 4, 4, 4, 2],
  [ 4, 2, 2, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 0, 4, 4, 4, 4, 4],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 4, 4, 4, 4, 4, 4, 4, 2, 4, 8, 8, 4, 0, 0, 4, 4, 4, 4, 2, 4],
  [ 4, 4, 4, 4, 4, 4, 0, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 2, 0, 4],
  [ 2, 0, 4, 4, 4, 4, 2, 4, 4, 8, 8, 4, 0, 4, 0, 4, 0, 4, 2, 4],
  [ 4, 4, 0, 4, 4, 0, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 0, 4, 4],
  [ 2, 4, 0, 4, 4, 4, 2, 4, 4, 8, 8, 4, 2, 4, 0, 4, 4, 2, 2, 2],
  [ 2, 2, 4, 2, 2, 2, 4, 2, 4, 8, 8, 4, 2, 2, 2, 4, 4, 4, 4, 4],
];

// prettier-ignore
const CHUNK_0_5: Terrain[][] = [
  [14,14, 3, 3,14,14,14,14,14, 8, 8,14, 3, 3,14,14, 3,14, 3, 3],
  [ 3,14, 0, 0, 3, 3, 3,14,14, 8, 8,14,14,14,14, 3,14, 3,14,14],
  [ 3, 3, 0,14,14,14,14,14,14, 8, 8,14,14,14, 0,14,14, 0,14, 3],
  [ 3,14, 0,14,14, 0, 3, 0,14, 8, 8,14, 0,14,14,14,14,14, 0,14],
  [ 3,14,14,14,14,14, 0,14,14, 8, 8,14,14, 3,14, 0,14,14, 3, 3],
  [14,14,14, 0,14,14, 0, 3,14, 8, 8,14,14,14,14,14, 0, 0,14,14],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [14, 3,14,14,14,14, 0,14,14, 8, 8,14,14,14,14, 0,14,14, 3,14],
  [ 3,14,14,14,14,14,14,14,14, 8, 8,14, 3,14,14,14,14,14,14,14],
  [ 3,14, 0,14,14,14,14,14,14, 8, 8,14, 0, 3,14,14,14,14, 3, 3],
  [14,14,14,14,14,14,14, 0,14, 8, 8,14, 3,14,14,14,14, 0, 0,14],
  [14, 3,14,14,14,14, 3,14,14, 8, 8,14,14,14,14, 3, 3, 3, 0, 3],
  [ 3,14,14,14,14, 3,14,14,14, 8, 8,14,14,14,14, 3,14, 3, 3, 3],
];

// prettier-ignore
const CHUNK_1_5: Terrain[][] = [
  [ 2, 2, 1, 2, 2, 1, 1, 2, 1, 8, 8, 1, 1, 1, 2, 2, 2, 2, 1, 1],
  [ 2, 1, 2, 1, 1, 1, 1, 0, 1, 8, 8, 1, 1, 1, 2, 1, 1, 2, 2, 1],
  [ 2, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 2],
  [ 1, 2, 0, 1, 2, 1, 0, 2, 1, 8, 8, 1, 1, 1, 1, 1, 0, 0, 2, 1],
  [ 1, 2, 1, 1, 1, 2, 1, 1, 1, 8, 8, 1, 1, 0, 1, 1, 2, 1, 1, 1],
  [ 1, 2, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 0, 1, 1, 1, 1, 1, 1],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [ 1, 1, 2, 2, 1, 2, 1, 0, 1, 8, 8, 1, 1, 2, 1, 0, 0, 1, 2, 1],
  [ 2, 2, 2, 1, 0, 1, 1, 0, 1, 8, 8, 1, 1, 1, 1, 2, 1, 0, 1, 1],
  [ 1, 1, 1, 1, 1, 0, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 0, 1, 1, 1],
  [ 1, 2, 1, 1, 1, 1, 2, 2, 1, 8, 8, 1, 1, 1, 0, 1, 1, 2, 2, 1],
  [ 2, 2, 1, 2, 2, 2, 1, 2, 1, 8, 8, 1, 1, 0, 1, 0, 2, 2, 1, 1],
  [ 1, 1, 1, 2, 1, 2, 1, 1, 1, 8, 8, 1, 1, 2, 2, 1, 2, 2, 2, 1],
];

// prettier-ignore
const CHUNK_2_5: Terrain[][] = [
  [ 1, 2, 2, 2, 2, 1, 2, 1, 1, 8, 8, 1, 2, 1, 1, 2, 2, 1, 2, 2],
  [ 2, 0, 2, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 2, 1, 2, 1, 1, 2],
  [ 1, 0, 1, 0, 1, 2, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 0, 2, 2, 1],
  [ 1, 0, 1, 1, 0, 1, 1, 1, 1, 8, 8, 1, 1, 0, 1, 1, 1, 0, 0, 2],
  [ 2, 1, 0, 1, 1, 1, 0, 1, 1, 8, 8, 1, 0, 0, 1, 1, 1, 1, 2, 1],
  [ 1, 2, 1, 2, 1, 1, 1, 0, 1, 8, 8, 1, 0, 1, 2, 1, 1, 1, 2, 1],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [ 1, 1, 1, 0, 1, 1, 0, 1, 1, 8, 8, 1, 0, 1, 1, 0, 1, 1, 2, 1],
  [ 2, 1, 0, 1, 2, 1, 0, 1, 1, 8, 8, 1, 1, 1, 0, 1, 2, 2, 1, 2],
  [ 2, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 0, 0, 1, 1, 0, 1, 1],
  [ 2, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 0, 1, 1, 0, 1, 1, 1, 2],
  [ 2, 0, 2, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 0, 1, 1, 2],
  [ 2, 2, 2, 2, 1, 2, 2, 2, 1, 8, 8, 1, 1, 2, 1, 2, 1, 2, 2, 1],
];

// prettier-ignore
const CHUNK_3_5: Terrain[][] = [
  [ 2,15, 2,15,15, 2,15, 2,15, 8, 8,15,15, 2, 2, 2, 2, 2, 2, 2],
  [ 2,15,15,15,15,15,15,15,15, 8, 8,15,15, 1, 1,15, 1,15,15,15],
  [15, 2, 2,15, 1,15,15,15,15, 8, 8,15, 2, 2,15,15,15, 1, 2,15],
  [ 2, 2,15,15, 1,15,15,15,15, 8, 8,15,15,15,15,15,15,15,15,15],
  [15,15,15, 1, 2,15,15,15,15, 8, 8,15, 2,15, 1,15, 1,15, 2,15],
  [15, 2, 1,15,15, 1,15,15,15, 8, 8,15,15,15,15, 1, 1,15,15,15],
  [15,15,15,15,15,15,15,15,15, 8, 8,15,15,15,15,15,15,15,15,15],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [15,15,15,15,15,15,15,15,15, 8, 8,15,15,15,15,15,15,15,15,15],
  [15, 2,15,15,15,15,15,15,15, 8, 8,15,15,15,15,15,15,15,15,15],
  [15,15,15,15,15,15, 1,15,15, 8, 8,15,15,15, 1,15,15, 2, 2, 2],
  [ 2, 1, 1, 2,15,15,15,15,15, 8, 8,15,15,15,15,15, 1, 2,15,15],
  [ 2,15,15,15,15, 1,15,15,15, 8, 8,15,15, 2,15, 2, 1,15,15, 2],
  [ 2, 2, 1,15,15, 1,15, 1,15, 8, 8,15, 1, 2, 2, 1,15,15,15,15],
  [15,15, 2,15,15,15,15,15,15, 8, 8,15, 2, 2, 2, 2, 2, 2, 2, 2],
];

// prettier-ignore
const CHUNK_4_5: Terrain[][] = [
  [15, 2,15, 2, 2,15,15, 2,15, 8, 8,15, 2, 2, 2,15,15, 2, 2, 2],
  [ 2, 2,15,15, 2,15, 2,15,15, 8, 8,15, 2, 2, 1, 1,15, 2, 1,15],
  [ 2,15,15, 1, 1,15,15,15,15, 8, 8,15,15, 1, 1,15,15,15, 1, 2],
  [15,15, 2, 2, 1,15,15, 2,15, 8, 8,15, 2,15,15,15, 1,15,15,15],
  [ 2, 2,15,15, 2,15, 1, 1,15, 8, 8,15,15,15,15,15, 1,15, 2,15],
  [15,15,15,15,15,15,15,15,15, 8, 8,15,15, 1,15,15,15,15, 2,15],
  [15,15,15,15,15,15,15,15,15, 8, 8,15,15,15,15,15,15,15,15,15],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [15,15,15,15,15,15,15,15,15, 8, 8,15,15,15,15,15,15,15,15,15],
  [15,15, 1, 1, 2,15, 1,15,15, 8, 8,15,15, 1,15, 2,15,15,15,15],
  [ 2,15, 1,15,15,15,15,15,15, 8, 8,15,15, 1,15,15, 1,15, 2, 2],
  [ 2,15,15, 1,15, 1, 1,15,15, 8, 8,15, 1, 1,15,15,15,15, 1,15],
  [ 2,15,15,15, 1, 1,15, 1,15, 8, 8,15,15,15,15,15,15,15, 2,15],
  [15,15, 1,15, 2,15, 1, 2,15, 8, 8,15, 1,15,15, 1, 2,15, 2, 2],
  [15, 2, 2, 2, 2, 2, 2, 2,15, 8, 8,15, 2,15,15,15, 2,15,15,15],
];

// prettier-ignore
const CHUNK_5_5: Terrain[][] = [
  [ 2, 2,17, 2, 2, 2,17,17,17, 8, 8,17, 2,17,17,17,17,17,17, 2],
  [17,17, 2, 2, 4, 2, 2,17,17, 8, 8,17,17, 2, 2,17,17,17,17, 2],
  [ 2,17, 2,17,17, 4,17, 4,17, 8, 8,17,17,17, 2, 4, 4, 4,17,17],
  [17,17,17,17, 4,17,17, 4,17, 8, 8,17,17,17,17, 2, 4,17, 4,17],
  [ 2, 2,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17, 4,17,17],
  [17, 4,17,17,17,17,17,17,17, 8, 8,17,17, 4,17,17, 4,17,17,17],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17, 2, 4,17,17, 2,17],
  [ 2, 2,17,17,17,17, 4, 4,17, 8, 8,17, 2,17,17,17, 4, 4, 2, 2],
  [17, 4,17, 4,17,17,17,17,17, 8, 8,17,17,17, 4, 2,17,17, 4, 2],
  [17,17,17,17,17, 4,17,17,17, 8, 8,17,17,17,17,17,17,17, 4, 2],
  [ 2,17, 2,17, 2, 2, 2,17,17, 8, 8,17,17,17, 2,17,17,17,17, 2],
  [ 2,17, 2,17, 2, 2,17, 2,17, 8, 8,17,17,17, 2,17, 2,17, 2, 2],
];

// prettier-ignore
const CHUNK_6_5: Terrain[][] = [
  [ 2, 2, 2,17, 2,17,17, 2,17, 8, 8,17,17,17, 2, 2,17,17, 2, 2],
  [17,17,17, 2,17,17, 2, 2,17, 8, 8,17,17,17, 4, 2,17,17,17, 2],
  [ 2,17, 4, 4, 2,17, 2,17,17, 8, 8,17,17,17, 4, 4,17, 4, 4,17],
  [17,17,17,17,17,17, 4,17,17, 8, 8,17,17, 2,17,17,17,17, 2,17],
  [17, 4,17, 4,17,17, 2, 4,17, 8, 8,17,17,17,17,17,17, 2,17,17],
  [17,17, 4,17,17,17, 4,17,17, 8, 8,17,17,17, 6, 4,17,17,17,17],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [17,17, 2,17, 4,17,17,17,17, 8, 8,17, 4,17,17,17,17,17,17,17],
  [17, 2,17,17, 2,17,17, 4,17, 8, 8,17,17, 4,17, 4,17,17,17, 2],
  [ 2,17, 2,17,17, 4,17,17,17, 8, 8,17,17,17,17,17,17, 2, 2, 2],
  [ 2,17, 4, 4,17,17, 4,17,17, 8, 8,17,17,17,17,17, 4,17, 2,17],
  [ 2,17,17, 2,17,17,17, 4,17, 8, 8,17, 4,17, 4,17,17,17,17,17],
  [17, 2,17,17,17, 2, 2, 2,17, 8, 8,17,17,17,17, 2,17,17,17, 2],
];

// prettier-ignore
const CHUNK_7_5: Terrain[][] = [
  [17,17,17,16,17,16,17,16,17, 8, 8,17,16,16,17,16,16,17,16,16],
  [16,16,17,17,16,16,17,17,17, 8, 8,17,17,16,16, 4,17,16, 4,16],
  [17,17, 4,17,17, 4,17, 4,17, 8, 8,17, 4,17,17,17,17,17,16,17],
  [17,16,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17, 4,17,16],
  [16,16,17,17, 4, 4, 4,17,17, 8, 8,17, 4,17,17,16,17,17,16,17],
  [17,17,17,17, 4,17, 4,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,16,17,17,17,16,17],
  [16,17,17, 4,17,17,17, 4,17, 8, 8,17,17,17,17,17,17, 4,16,16],
  [17,16,17,17,17, 4,17,17,17, 8, 8,17, 4,17,17,16,17,17,17,17],
  [17,17,17,17,17, 4,17,17,17, 8, 8,17,16, 4,17,17,17,17,17,17],
  [16,17,17,16,17,16,17,17,17, 8, 8,17,16,16,17,17,17,17, 4,16],
  [16,16,16,16,17,16,17,17,17, 8, 8,17,16,16,17,17,16,17,17,16],
];

// prettier-ignore
const CHUNK_8_5: Terrain[][] = [
  [ 4, 2, 4, 4, 2, 2, 2, 4, 4, 8, 8, 4, 2, 2, 2, 2, 2, 2, 2, 4],
  [ 4, 4, 4, 2, 4, 4, 2, 2, 4, 8, 8, 4, 2, 4, 2, 2, 4, 0, 2, 2],
  [ 4, 2, 0, 4, 4, 4, 4, 2, 4, 8, 8, 4, 4, 0, 4, 4, 4, 2, 4, 2],
  [ 4, 2, 4, 4, 4, 4, 2, 4, 4, 8, 8, 4, 4, 4, 4, 2, 4, 4, 4, 2],
  [ 2, 0, 4, 4, 0, 4, 4, 4, 4, 8, 8, 4, 4, 0, 4, 4, 4, 2, 4, 2],
  [ 4, 2, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 2, 4, 0, 4, 4, 2, 4],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 4, 2, 4, 0, 4, 4, 0, 4, 4, 8, 8, 4, 4, 2, 4, 4, 4, 4, 2, 4],
  [ 2, 4, 0, 4, 4, 4, 2, 4, 4, 8, 8, 4, 4, 4, 0, 4, 4, 4, 4, 2],
  [ 4, 0, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 0, 4, 0, 4, 4, 0, 0, 2],
  [ 2, 4, 2, 4, 4, 2, 4, 0, 4, 8, 8, 4, 4, 4, 4, 0, 4, 4, 0, 2],
  [ 4, 4, 4, 2, 4, 2, 4, 4, 4, 8, 8, 4, 0, 4, 2, 4, 0, 2, 2, 4],
  [ 4, 4, 2, 2, 4, 4, 4, 2, 4, 8, 8, 4, 4, 2, 2, 2, 2, 4, 2, 4],
];

// prettier-ignore
const CHUNK_9_5: Terrain[][] = [
  [ 4, 4, 2, 4, 4, 2, 4, 2, 4, 8, 8, 4, 2, 4, 4, 4, 2, 2, 2, 2],
  [ 4, 2, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 2, 4, 4, 2, 0, 2],
  [ 2, 2, 4, 4, 4, 4, 4, 2, 4, 8, 8, 4, 4, 0, 4, 2, 4, 2, 4, 4],
  [ 2, 4, 4, 4, 2, 4, 4, 2, 4, 8, 8, 4, 4, 4, 4, 0, 0, 4, 2, 2],
  [ 2, 4, 4, 4, 2, 0, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 2, 4, 2, 2],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 0, 4],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 4, 2, 4, 4, 4, 0, 4, 2, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 4, 2, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 2, 4, 4, 4, 4, 2],
  [ 2, 2, 0, 4, 0, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 0, 4, 4, 4],
  [ 4, 4, 0, 4, 0, 4, 2, 4, 4, 8, 8, 4, 2, 4, 0, 0, 4, 4, 2, 2],
  [ 2, 0, 4, 0, 4, 2, 4, 4, 4, 8, 8, 4, 0, 4, 4, 2, 4, 2, 4, 4],
  [ 2, 4, 4, 4, 4, 2, 2, 4, 4, 8, 8, 4, 2, 4, 2, 4, 4, 4, 2, 2],
];

// prettier-ignore
const CHUNK_0_6: Terrain[][] = [
  [ 1, 2, 2, 2, 2, 2, 1, 2, 1, 8, 8, 1, 2, 2, 1, 2, 1, 2, 1, 2],
  [ 2, 2, 1, 2, 1, 2, 0, 1, 1, 8, 8, 1, 1, 2, 1, 2, 1, 2, 0, 2],
  [ 1, 2, 1, 1, 0, 1, 1, 0, 1, 8, 8, 1, 0, 1, 0, 1, 1, 2, 1, 1],
  [ 2, 2, 2, 1, 2, 1, 0, 1, 1, 8, 8, 1, 1, 1, 0, 1, 1, 1, 1, 2],
  [ 2, 1, 0, 2, 1, 1, 1, 2, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 2],
  [ 1, 1, 1, 1, 1, 1, 1, 2, 1, 8, 8, 1, 0, 1, 1, 1, 2, 1, 0, 1],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [ 1, 2, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 2, 1, 1, 1, 1],
  [ 1, 1, 1, 1, 0, 1, 1, 0, 1, 8, 8, 1, 1, 1, 1, 1, 2, 1, 2, 1],
  [ 2, 0, 1, 2, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 0, 1, 1, 2, 1],
  [ 2, 0, 1, 0, 1, 0, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 2, 1, 2, 2],
  [ 2, 2, 1, 1, 1, 2, 1, 1, 1, 8, 8, 1, 2, 2, 2, 2, 2, 2, 2, 1],
  [ 2, 1, 2, 1, 2, 1, 1, 1, 1, 8, 8, 1, 1, 2, 2, 1, 2, 1, 2, 1],
];

// prettier-ignore
const CHUNK_1_6: Terrain[][] = [
  [ 1, 2, 2, 1, 2, 1, 2, 2, 1, 8, 8, 1, 1, 2, 2, 1, 2, 2, 2, 1],
  [ 1, 1, 1, 1, 2, 0, 1, 1, 1, 8, 8, 1, 2, 2, 0, 2, 0, 2, 1, 1],
  [ 1, 2, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 0, 1, 1, 1, 1, 2, 2],
  [ 2, 1, 2, 0, 1, 2, 1, 1, 1, 8, 8, 1, 0, 1, 1, 1, 1, 2, 1, 2],
  [ 1, 0, 1, 1, 0, 1, 1, 1, 1, 8, 8, 1, 1, 0, 1, 1, 0, 1, 1, 2],
  [ 1, 2, 0, 0, 1, 1, 2, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 0, 1],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [ 1, 2, 1, 1, 3, 3, 3, 1, 1, 8, 8, 1, 2, 0, 1, 1, 1, 1, 2, 1],
  [ 1, 1, 1, 1, 3, 3, 3, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 2, 1, 1],
  [ 2, 1, 2, 2, 3, 3, 3, 1, 1, 8, 8, 1, 1, 1, 0, 1, 1, 0, 1, 2],
  [ 1, 1, 1, 1, 1, 1, 0, 1, 1, 8, 8, 1, 0, 1, 0, 1, 1, 1, 2, 1],
  [ 2, 0, 1, 1, 1, 1, 2, 1, 1, 8, 8, 1, 0, 1, 2, 1, 0, 1, 1, 1],
  [ 2, 2, 2, 2, 1, 2, 1, 2, 1, 8, 8, 1, 2, 2, 2, 1, 1, 1, 2, 2],
];

// prettier-ignore
const CHUNK_2_6: Terrain[][] = [
  [14,14,14, 3, 3, 3, 3, 3,14, 8, 8,14, 3, 3, 3, 3,14,14,14, 3],
  [ 3,14,14,14,14,14,14, 3,14, 8, 8,14,14,14,14, 3, 3, 3,14, 3],
  [ 3,14, 3,14,14,14,14,14,14, 8, 8,14,14,14, 0,14, 0, 0,14, 3],
  [14,14,14,14,14,14,14, 0,14, 8, 8,14,14,14,14,14, 0,14,14, 3],
  [14, 3,14,14, 0,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [14, 0, 0, 0, 0,14,14,14,14, 8, 8,14,14,14,14,14,14,14, 3,14],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [14, 0, 0,14,14,14,14, 3,14, 8, 8,14,14, 3,14, 0, 0,14, 0,14],
  [ 3,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14, 0,14, 3],
  [ 3,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14, 3],
  [ 3,14,14,14,14,14, 0,14,14, 8, 8,14, 0,14,14, 0,14,14,14, 3],
  [ 3,14, 0, 0, 3,14,14, 3,14, 8, 8,14,14,14,14, 3,14,14, 0, 3],
  [ 3, 3, 3, 3,14, 3,14,14,14, 8, 8,14, 3,14, 3, 3, 3, 3, 3, 3],
];

// prettier-ignore
const CHUNK_3_6: Terrain[][] = [
  [ 2, 2, 2, 2,15,15,15, 2,15, 8, 8,15, 2, 2, 2,15, 2,15,15,15],
  [ 2,15, 2, 2, 1, 1,15,15,15, 8, 8,15,15,15,15,15, 2, 2, 1, 2],
  [15,15,15,15,15,15,15, 2,15, 8, 8,15,15, 2,15,15,15, 1, 2, 2],
  [15,15,15,15, 1,15,15,15,15, 8, 8,15,15, 1,15,15,15, 2,15, 2],
  [15,15,15,15,15, 2,15,15,15, 8, 8,15, 2,15, 1,15,15,15,15, 2],
  [15,15,15, 2, 1, 1,15, 1,15, 8, 8,15,15,15, 2,15,15,15,15,15],
  [15,15,15,15,15,15,15,15,15, 8, 8,15,15,15,15,15,15,15,15,15],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [15,15,15,15,15,15,15,15,15, 8, 8,15,15,15,15,15,15,15,15,15],
  [15,15,15,15,15,15, 1, 2,15, 8, 8,15,15,15,15,15,15, 1,15,15],
  [ 2,15, 1,15,15, 1,15, 2,15, 8, 8,15,15, 1, 1,15,15,15, 2,15],
  [ 2,15, 1, 1,15,15, 1,15,15, 8, 8,15, 1,15,15,15,15,15,15,15],
  [ 2, 1,15,15,15,15,15,15,15, 8, 8,15, 1,15,15,15, 2,15,15, 2],
  [ 2, 2, 2, 2,15, 1, 2, 2,15, 8, 8,15, 1,15,15,15,15,15, 2, 2],
  [ 2, 2,15, 2, 2, 2,15, 2,15, 8, 8,15, 2, 2,15, 2,15,15,15,15],
];

// prettier-ignore
const CHUNK_4_6: Terrain[][] = [
  [17,17, 2,17,17, 2, 2,17,17, 8, 8,17,17, 2,17, 2, 2,17,17,17],
  [ 2,17,17,17,17, 2,17,17,17, 8, 8,17, 2, 2, 2, 2, 4, 2,17,17],
  [ 2,17,17,17,17, 4,17,17,17, 8, 8,17,17,17,17,17, 4,17, 2, 2],
  [17,17,17,17, 2, 4, 4, 2,17, 8, 8,17,17, 4,17,17, 4,17,17, 2],
  [ 2, 2,17,17,17, 4, 4,17,17, 8, 8,17,17,17,17, 4, 4, 4, 4,17],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17, 4,17],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [17, 2,17,17, 4, 2,17,17,17, 8, 8,17, 2, 4, 4, 4,17,17, 4,17],
  [ 2, 2,17, 4,17, 2, 2,17,17, 8, 8,17, 2,17,17,17,17,17,17,17],
  [ 2, 2, 2,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17, 4,17, 2],
  [ 2,17,17,17,17, 2,17,17,17, 8, 8,17,17, 2,17, 4,17,17, 2,17],
  [17, 2,17, 4, 2,17,17, 2,17, 8, 8,17,17, 2, 2,17, 2, 4,17,17],
  [17,17, 2,17,17,17,17,17,17, 8, 8,17, 2,17,17, 2, 2,17, 2, 2],
];

// prettier-ignore
const CHUNK_5_6: Terrain[][] = [
  [ 2,17,17, 2, 2, 2,17, 2,17, 8, 8,17,17, 2,17, 2, 2,17, 2,17],
  [17,17,17,17,17, 2,17, 4,17, 8, 8,17, 2, 2,17,17,17, 4,17, 2],
  [ 2, 4,17,17,17,17, 4,17,17, 8, 8,17, 4,17, 4, 2,17,17, 2, 2],
  [17,17,17,17,17, 4, 4, 2,17, 8, 8,17,17,17, 4,17,17,17,17,17],
  [17, 4,17, 4,17, 4,17,17,17, 8, 8,17,17,17,17, 2,17, 4,17, 2],
  [17,17, 2,17, 4,17,17,17,17, 8, 8,17,17,17,17, 4,17, 2, 4,17],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [17, 2,17, 4,17, 4,17,17,17, 8, 8,17, 2,17,17, 2,17, 2, 4,17],
  [17, 2, 4,17,17, 2,17, 4,17, 8, 8,17,17,17,17,17,17, 4,17,17],
  [17,17,17,17,17,17, 4,17,17, 8, 8,17, 4,17,17, 4,17, 4, 2,17],
  [ 2,17,17, 2,17,17,17, 2,17, 8, 8,17,17,17,17, 4,17,17,17, 2],
  [ 2,17,17,17,17, 2,17,17,17, 8, 8,17, 2,17,17, 4, 4, 2, 2, 2],
  [17, 2,17, 2,17, 2, 2,17,17, 8, 8,17,17, 2,17,17, 2,17, 2,17],
];

// prettier-ignore
const CHUNK_6_6: Terrain[][] = [
  [ 4, 2, 2, 2, 4, 4, 4, 2, 4, 8, 8, 4, 2, 4, 2, 4, 2, 2, 4, 4],
  [ 2, 2, 2, 0, 2, 2, 2, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 2, 2],
  [ 4, 4, 4, 4, 4, 4, 0, 4, 4, 8, 8, 4, 4, 0, 4, 4, 4, 2, 4, 2],
  [ 2, 2, 4, 2, 0, 4, 4, 4, 4, 8, 8, 4, 4, 4, 3, 3, 3, 4, 0, 4],
  [ 2, 4, 4, 4, 2, 4, 4, 4, 4, 8, 8, 4, 4, 4, 3, 3, 3, 4, 2, 4],
  [ 4, 2, 4, 2, 4, 2, 4, 0, 4, 8, 8, 4, 4, 4, 3, 3, 3, 4, 2, 4],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 4, 2, 4, 2, 4, 0, 4, 4, 4, 8, 8, 4, 4, 0, 4, 4, 4, 4, 4, 4],
  [ 2, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 0, 0, 4, 4, 4, 4, 4, 2],
  [ 4, 2, 4, 4, 4, 2, 0, 4, 4, 8, 8, 4, 4, 0, 4, 4, 4, 4, 4, 2],
  [ 2, 4, 4, 0, 4, 2, 4, 0, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 2],
  [ 4, 4, 4, 4, 4, 2, 2, 4, 4, 8, 8, 4, 2, 0, 4, 4, 2, 4, 4, 2],
  [ 4, 4, 4, 4, 2, 2, 2, 4, 4, 8, 8, 4, 2, 2, 2, 2, 2, 2, 4, 4],
];

// prettier-ignore
const CHUNK_7_6: Terrain[][] = [
  [ 2, 4, 2, 2, 2, 2, 4, 2, 4, 8, 8, 4, 2, 2, 2, 2, 4, 4, 4, 2],
  [ 2, 4, 2, 0, 2, 2, 4, 2, 4, 8, 8, 4, 4, 2, 4, 0, 2, 4, 2, 4],
  [ 2, 4, 4, 2, 4, 0, 2, 2, 4, 8, 8, 4, 4, 4, 4, 4, 0, 0, 4, 2],
  [ 4, 4, 4, 4, 4, 2, 4, 4, 4, 8, 8, 4, 0, 2, 4, 2, 4, 2, 2, 2],
  [ 2, 2, 2, 4, 4, 4, 4, 4, 4, 8, 8, 4, 2, 4, 4, 4, 4, 4, 4, 2],
  [ 4, 2, 4, 4, 0, 4, 0, 4, 4, 8, 8, 4, 0, 4, 0, 4, 4, 4, 4, 4],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 0, 4, 4, 4, 0, 2, 2, 4],
  [ 4, 4, 0, 4, 4, 0, 2, 4, 4, 8, 8, 4, 4, 0, 0, 4, 4, 4, 2, 2],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 2, 4, 4, 4, 4, 4, 4, 4],
  [ 4, 2, 4, 4, 0, 4, 4, 4, 4, 8, 8, 4, 0, 4, 4, 4, 4, 4, 4, 2],
  [ 2, 4, 2, 4, 2, 4, 4, 2, 4, 8, 8, 4, 2, 4, 4, 2, 4, 2, 0, 2],
  [ 2, 2, 2, 4, 2, 2, 2, 4, 4, 8, 8, 4, 2, 2, 2, 2, 2, 4, 4, 2],
];

// prettier-ignore
const CHUNK_8_6: Terrain[][] = [
  [ 2, 2, 2, 2, 2, 4, 4, 2, 4, 8, 8, 4, 4, 4, 4, 2, 4, 2, 2, 2],
  [ 2, 4, 2, 2, 4, 4, 4, 4, 4, 8, 8, 4, 2, 4, 4, 0, 4, 2, 2, 2],
  [ 4, 2, 4, 4, 4, 0, 4, 4, 4, 8, 8, 4, 4, 4, 4, 2, 4, 4, 4, 2],
  [ 2, 2, 4, 4, 4,12, 4, 4, 4, 8, 8, 4, 4, 0, 4, 4, 2, 4, 2, 2],
  [ 2, 4, 0, 4, 4, 4, 2, 4, 4, 8, 8, 4, 2, 0, 2, 0, 4, 0, 4, 2],
  [ 4, 0, 4, 0, 0, 4, 2, 4, 4, 8, 8, 4, 0, 0, 0, 4, 0, 0, 0, 4],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 4, 2, 2, 4, 4, 4, 4, 0, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 0, 4],
  [ 2, 4, 0, 4, 4, 4, 4, 0, 4, 8, 8, 4, 4, 0, 4, 4, 4, 4, 4, 2],
  [ 2, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 2, 4, 4, 2],
  [ 4, 4, 4, 4, 0, 4, 0, 4, 4, 8, 8, 4, 2, 4, 4, 4, 4, 4, 4, 2],
  [ 2, 4, 4, 4, 4, 0, 2, 2, 4, 8, 8, 4, 2, 4, 2, 0, 4, 0, 4, 4],
  [ 2, 4, 2, 2, 2, 4, 4, 2, 4, 8, 8, 4, 2, 4, 4, 4, 2, 2, 2, 2],
];

// prettier-ignore
const CHUNK_9_6: Terrain[][] = [
  [ 2,17, 2, 2, 2,17, 2, 2,17, 8, 8,17,17,17, 2,17,17,17, 2, 2],
  [ 2,17,17, 2, 4,17, 2,17,17, 8, 8,17,17, 2,17,17, 2, 4,17, 2],
  [ 2, 2,17,17,17,17,17, 2,17, 8, 8,17,17,17,17,17, 4,17, 4,17],
  [17,17,17,17,17,17, 4,17,17, 8, 8,17,17, 2, 4,17, 4, 4, 2, 2],
  [17,17,17,17,17, 4, 4,17,17, 8, 8,17,17,17, 2,17,17,17, 2, 2],
  [17, 2,17, 4,17,17,17, 4,17, 8, 8,17,17,17,17, 4,17,17, 2,17],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 5, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [17,17,17,17,17, 4, 4,17,17, 8, 8,17,17,17,17,17, 2, 4,17,17],
  [17,17,17, 4,17, 4,17,17,17, 8, 8,17, 2,17,17,17,17,17, 4, 2],
  [ 2,17,17, 4,17,17,17, 4,17, 8, 8,17, 2,17,17,17,17,17,17,17],
  [17, 2,17,17,17,17,17,17,17, 8, 8,17,17, 4,17, 4,17,17,17, 2],
  [17,17, 2, 2,17,17, 2, 2,17, 8, 8,17, 4,17, 2,17, 2, 2, 2,17],
  [17, 2,17, 2,17,17,17,17,17, 8, 8,17,17,17, 2, 2, 2, 2,17, 2],
];

// prettier-ignore
const CHUNK_0_7: Terrain[][] = [
  [ 2, 2, 2, 2, 1, 2, 1, 1, 1, 8, 8, 1, 1, 2, 2, 1, 1, 2, 2, 2],
  [ 1, 2, 1, 0, 2, 1, 1, 0, 1, 8, 8, 1, 2, 0, 2, 2, 0, 1, 1, 2],
  [ 2, 1, 1, 1, 1, 1, 1, 0, 1, 8, 8, 1, 1, 1, 2, 2, 0, 1, 1, 1],
  [ 1, 1, 1, 0, 0, 0, 1, 0, 1, 8, 8, 1, 1, 1, 1, 1, 1, 2, 0, 1],
  [ 1, 1, 1, 1, 1, 1, 1, 0, 1, 8, 8, 1, 1, 2, 1, 0, 1, 1, 0, 2],
  [ 1, 1, 1, 0, 1, 1, 1, 1, 1, 8, 8, 1, 0, 1, 1, 1, 1, 1, 1, 1],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [ 1, 1, 0, 2, 2, 2, 0, 1, 1, 8, 8, 1, 0, 1, 1, 1, 0, 2, 0, 1],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 0, 1, 1, 1, 1, 1, 2, 2],
  [ 2, 1, 0, 0, 0, 2, 1, 1, 1, 8, 8, 1, 0, 0, 1, 1, 2, 1, 2, 2],
  [ 2, 2, 1, 1, 1, 2, 1, 0, 1, 8, 8, 1, 0, 1, 1, 1, 1, 1, 1, 2],
  [ 2, 1, 0, 1, 1, 1, 1, 0, 1, 8, 8, 1, 1, 2, 2, 1, 1, 2, 1, 2],
  [ 1, 1, 2, 2, 2, 2, 2, 1, 1, 8, 8, 1, 1, 2, 1, 2, 2, 1, 1, 1],
];

// prettier-ignore
const CHUNK_1_7: Terrain[][] = [
  [ 1, 1, 2, 2, 1, 1, 2, 2, 1, 8, 8, 1, 1, 2, 2, 1, 1, 2, 1, 2],
  [ 2, 1, 2, 2, 1, 1, 1, 0, 1, 8, 8, 1, 2, 1, 1, 2, 2, 1, 1, 1],
  [ 1, 1, 1, 1, 2, 0, 0, 1, 1, 8, 8, 1, 1, 1, 1, 0, 1, 1, 0, 2],
  [ 2, 2, 1, 1, 1, 0, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 2, 1, 2],
  [ 2, 1, 0, 1, 1, 1, 0, 2, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 2],
  [ 1, 1, 1, 1, 1, 1, 0, 0, 1, 8, 8, 1, 2, 1, 0, 0, 0, 1, 1, 1],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [ 1, 1, 1, 1, 0, 1, 1, 1, 1, 8, 8, 1, 0, 2, 2, 1, 2, 0, 2, 1],
  [ 2, 1, 1, 2, 1, 1, 1, 2, 1, 8, 8, 1, 2, 1, 1, 1, 1, 0, 1, 2],
  [ 1, 0, 1, 1, 1, 0, 1, 1, 1, 8, 8, 1, 0, 0, 1, 1, 1, 1, 2, 2],
  [ 2, 1, 1, 1, 1, 1, 2, 1, 1, 8, 8, 1, 1, 1, 2, 1, 0, 1, 1, 2],
  [ 1, 0, 1, 1, 1, 1, 1, 0, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [ 1, 1, 1, 1, 1, 2, 1, 2, 1, 8, 8, 1, 1, 2, 1, 1, 2, 2, 2, 1],
];

// prettier-ignore
const CHUNK_2_7: Terrain[][] = [
  [14,14,14, 3, 3, 3, 3, 3,14, 8, 8,14, 3, 3, 3, 3, 3, 3,14, 3],
  [14,14,14,14, 3,14,14,14,14, 8, 8,14, 3,14,14,14, 0,14,14, 3],
  [14,14, 3, 0,14,14,14, 0,14, 8, 8,14, 3,14,14,14,14, 0, 3,14],
  [ 3, 0,14,14, 0,14,14, 0,14, 8, 8,14,14,14,14,14,14, 0, 3,14],
  [ 3, 3, 0,14,14,14,14,14,14, 8, 8,14, 0,14,14,14,14,14,14, 3],
  [14, 3,14,14, 3,14,14,14,14, 8, 8,14,14,14,14,14,14, 3,14,14],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [14,14, 3,14,14,14,14, 3,14, 8, 8,14,14,14,14,14,14, 3,14,14],
  [ 3,14,14, 3,14,14,14,14,14, 8, 8,14,14,14,14,14, 0,14, 3, 3],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14, 3,14,14, 0,14, 3,14],
  [ 3, 3,14, 0,14,14, 3, 0,14, 8, 8,14, 3,14, 0,14, 3,14,14, 3],
  [14, 3,14,14,14, 3, 0,14,14, 8, 8,14,14, 3, 0, 3, 3,14, 0, 3],
  [14, 3,14,14, 3,14, 3, 3,14, 8, 8,14,14, 3,14, 3, 3, 3,14, 3],
];

// prettier-ignore
const CHUNK_3_7: Terrain[][] = [
  [ 3,14,14,14, 3, 3,14, 3,14, 8, 8,14,14, 3, 3, 3, 3, 3,14,14],
  [14, 0, 3,14,14, 3,14,14,14, 8, 8,14,14,14, 3, 0,14, 3, 3, 3],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14, 0,14,14, 3],
  [ 3,14,14, 3,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [ 3,14,14, 0, 0, 0, 3,14,14, 8, 8,14,14,14,14,14,14,14,14, 3],
  [14, 0, 0,14, 3,14,14, 3,14, 8, 8,14,14, 0, 3,14,14, 0,14,14],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 5, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [14,14,14,14,14, 0,14,14,14, 8, 8,14,14,14,14,14, 3,14,14,14],
  [ 3,14,14,14,14,14,14, 0,14, 8, 8,14,14, 0,14,14, 3, 0,14,14],
  [ 3, 3,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14, 3, 3],
  [ 3,14,14,14,14, 3, 0, 3,14, 8, 8,14, 3,14,14, 3,14,14, 3,14],
  [ 3, 3,14,14, 3,14,14, 3,14, 8, 8,14, 3,14, 3,14, 3,14, 3, 3],
];

// prettier-ignore
const CHUNK_4_7: Terrain[][] = [
  [14, 3, 3,14,14, 3,14, 3,14, 8, 8,14, 3,14, 3,14,14, 3, 3,14],
  [14,14,14, 3,14,14,14,14,14, 8, 8,14, 0,14,14,14,14,14,14, 3],
  [ 3, 3, 0,14, 0, 0,14, 0,14, 8, 8,14,14, 0,14,14,14,14, 0,14],
  [ 3, 3,14,14,14,14,14,14,14, 8, 8,14, 3, 0,14,14,14, 3,14,14],
  [14, 0,14, 3,14,14, 3,14,14, 8, 8,14, 3, 0,14,14,14,14,14,14],
  [14,14, 0,14,14, 3, 3,14,14, 8, 8,14,14,14, 0,14,14,14, 3,14],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [14,14, 0, 0,14,14, 0, 0,14, 8, 8,14,14, 0,14, 0,14,14,14,14],
  [14,14,14,14, 0,14,14,14,14, 8, 8,14,14,14,14,14, 0,14, 0, 3],
  [14,14,14, 0,14,14,14, 0,14, 8, 8,14, 0,14,14, 0, 3, 0, 3, 3],
  [14,14,14,14,14, 0,14, 0,14, 8, 8,14,14,14,14,14, 0,14,14,14],
  [14, 3,14, 3,14, 3, 3, 3,14, 8, 8,14, 3,14, 3,14,14, 0, 3, 3],
  [14,14, 3,14,14,14,14,14,14, 8, 8,14,14, 3,14,14, 3, 3, 3,14],
];

// prettier-ignore
const CHUNK_5_7: Terrain[][] = [
  [ 4, 4, 4, 2, 4, 2, 4, 2, 4, 8, 8, 4, 4, 2, 4, 2, 4, 4, 2, 2],
  [ 4, 4, 4, 4, 4, 4, 2, 4, 4, 8, 8, 4, 0, 0, 4, 4, 4, 0, 4, 2],
  [ 4, 2, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 0, 4, 2, 4, 4],
  [ 2, 4, 4, 4, 4, 0, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 0, 2, 2],
  [ 2, 4, 4, 4, 4, 0, 0, 4, 4, 8, 8, 4, 4, 2, 4, 4, 4, 4, 4, 2],
  [ 4, 4, 4, 4, 4, 4, 2, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 0, 4, 4],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 4, 2, 4, 2, 4, 3, 3, 3, 4, 8, 8, 4, 2, 4, 4, 4, 2, 4, 0, 4],
  [ 2, 0, 4, 4, 0, 3, 3, 3, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 2, 0, 4, 4, 4, 3, 3, 3, 4, 8, 8, 4, 4, 4, 0, 4, 2, 4, 0, 2],
  [ 4, 0, 2, 4, 4, 0, 4, 0, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 0, 2],
  [ 2, 2, 2, 2, 4, 4, 4, 4, 4, 8, 8, 4, 0, 0, 4, 0, 2, 4, 4, 4],
  [ 4, 2, 4, 2, 4, 2, 2, 2, 4, 8, 8, 4, 2, 4, 4, 2, 2, 2, 2, 2],
];

// prettier-ignore
const CHUNK_6_7: Terrain[][] = [
  [ 4, 2, 2, 2, 4, 2, 4, 4, 4, 8, 8, 4, 2, 2, 4, 2, 2, 4, 2, 4],
  [ 2, 2, 0, 2, 2, 4, 4, 4, 4, 8, 8, 4, 2, 2, 2, 4, 2, 2, 4, 2],
  [ 4, 4, 4, 4, 2, 4, 4, 0, 4, 8, 8, 4, 4, 4, 0, 4, 4, 2, 4, 4],
  [ 2, 0, 0, 4, 4, 4, 4, 4, 4, 8, 8, 4, 0, 0, 4, 0, 4, 4, 2, 2],
  [ 2, 4, 0, 0, 4, 4, 2, 4, 4, 8, 8, 4, 4, 4, 4, 4, 0, 0, 4, 2],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 2, 4, 2, 2, 4],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 4, 2, 4, 4, 4, 0, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 4, 4, 4, 4, 4, 4, 0, 0, 4, 8, 8, 4, 0, 4, 4, 4, 4, 0, 0, 2],
  [ 2, 2, 4, 4, 0, 2, 0, 4, 4, 8, 8, 4, 4, 4, 4, 2, 4, 2, 4, 2],
  [ 2, 2, 4, 4, 0, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 2, 2, 4, 4, 2],
  [ 2, 0, 2, 2, 0, 2, 0, 4, 4, 8, 8, 4, 2, 4, 2, 4, 0, 4, 4, 4],
  [ 4, 2, 2, 2, 2, 2, 4, 4, 4, 8, 8, 4, 2, 2, 2, 4, 4, 4, 4, 4],
];

// prettier-ignore
const CHUNK_7_7: Terrain[][] = [
  [ 2, 2, 2, 2, 2, 2,17,17,17, 8, 8,17, 2,17, 2,17,17, 2,17,17],
  [17,17, 2,17, 2, 4,17, 4,17, 8, 8,17, 2, 2,17, 2,17,17, 2, 2],
  [ 2, 2, 4,17, 2,17, 2, 4,17, 8, 8,17,17,17,17, 2,17, 4, 2,17],
  [17,17,17,17, 4,17,17,17,17, 8, 8,17,17,17,17, 4,17, 4, 4,17],
  [ 2,17,17,17,17, 2,17,17,17, 8, 8,17,17,17,17,17,17,17, 2, 2],
  [17, 4,17,17,17, 4,17,17,17, 8, 8,17, 2, 4,17, 4,17,17, 2,17],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [17, 4,17,17,17, 4,17,17,17, 8, 8,17, 3, 3, 3,17,17,17, 4,17],
  [17,17,17, 4, 4,17, 2,17,17, 8, 8,17, 3, 3, 3,17,17,17,17,17],
  [17, 2, 4,17,17,17,17,17,17, 8, 8,17, 3, 3, 3,17,17,17, 4, 2],
  [17, 2,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [ 2, 4,17, 2, 4, 2, 4, 2,17, 8, 8,17, 2, 4,17, 2,17,17, 2, 2],
  [17, 2,17,17, 2,17, 2, 2,17, 8, 8,17, 2,17, 2,17, 2,17,17, 2],
];

// prettier-ignore
const CHUNK_8_7: Terrain[][] = [
  [17,17, 2,17, 2,17, 2,17,17, 8, 8,17, 2, 2, 2,17,17,17,17, 2],
  [17, 2, 2,17,17,17,17,17,17, 8, 8,17, 2,17, 2,17,17,17, 4, 2],
  [ 2,17,17, 4,17, 2,17,17,17, 8, 8,17,17, 2,17,17,17,17, 4, 2],
  [17,17, 4, 4,17,17,17,17,17, 8, 8,17, 4,17,17, 4, 2,17,17, 2],
  [ 2, 2, 4, 4,17,17,17,17,17, 8, 8,17, 4,17,17,17, 4,17, 2, 2],
  [17,17,17,17,17,17,17, 2,17, 8, 8,17, 4,17, 4,17,17,17,17,17],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [17, 4,17, 4, 4, 4,17, 4,17, 8, 8,17,17,17,17,17, 2, 4, 2,17],
  [17, 2,17,17, 4,17,17, 4,17, 8, 8,17, 2,17,17,17,17,17, 2,17],
  [ 2, 2, 2,17,17,17,17,17,17, 8, 8,17,17, 2,17,17,17, 4,17,17],
  [17, 2,17, 2, 4, 2,17,17,17, 8, 8,17, 2,17,17, 4,17,17, 2, 2],
  [17, 2, 2, 2,17,17, 2, 4,17, 8, 8,17, 4, 4,17, 2, 4, 2, 2, 2],
  [17, 2,17,17, 2, 2,17, 2,17, 8, 8,17,17, 2,17, 2, 2, 2, 2, 2],
];

// prettier-ignore
const CHUNK_9_7: Terrain[][] = [
  [17, 2,17, 2, 2, 2, 2, 2,17, 8, 8,17,17, 2,17, 2,17, 2, 2,17],
  [17, 2, 2, 4,17,17, 2,17,17, 8, 8,17,17,17, 2,17,17,17, 2,17],
  [ 2,17, 4,17,17,17,17,17,17, 8, 8,17,17,17, 4, 2,17,17,17, 2],
  [ 2, 2,17, 4,17,17,17, 2,17, 8, 8,17,17,17,17,17, 2,17,17, 2],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17, 4,17, 2,17,17,17, 2],
  [17, 2,17, 4,17,17,17,17,17, 8, 8,17,17, 2, 4, 4,17,17,17,17],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [17,17,17, 2,17, 4,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [17, 4, 2,17, 4,17, 2, 2,17, 8, 8,17,17, 2,17,17,17,17, 4, 2],
  [17,17, 4,17,17, 2, 4,17,17, 8, 8,17,17,17,17, 2,17,17,17,17],
  [17, 2,17,17,17,17, 4,17,17, 8, 8,17,17, 2,17, 4, 2,17, 4, 2],
  [ 2, 2, 2, 2, 2, 2, 2,17,17, 8, 8,17, 2,17,17,17,17,17, 2, 2],
  [ 2,17,17,17, 2, 2,17, 2,17, 8, 8,17, 2, 2,17,17, 2, 2,17,17],
];

// prettier-ignore
const CHUNK_0_8: Terrain[][] = [
  [ 1, 2, 1, 1, 2, 1, 1, 2, 1, 8, 8, 1, 2, 1, 1, 1, 1, 2, 2, 1],
  [ 2, 1, 1, 2, 1, 2, 1, 1, 1, 8, 8, 1, 1, 1, 2, 1, 0, 2, 1, 2],
  [ 1, 1, 0, 1, 1, 1, 1, 1, 1, 8, 8, 1, 0, 1, 0, 1, 1, 1, 0, 1],
  [ 1, 1, 0, 1, 1, 0, 0, 1, 1, 8, 8, 1, 1, 2, 1, 0, 1, 1, 1, 1],
  [ 2, 1, 0, 1, 1, 0, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 2, 1, 1, 2],
  [ 1, 1, 2, 2, 1, 0, 1, 1, 1, 8, 8, 1, 0, 1, 1, 1, 1, 1, 1, 1],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [ 1, 2, 1, 1, 0, 1, 0, 0, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [ 2, 0, 1, 2, 1, 1, 0, 1, 1, 8, 8, 1, 1, 0, 1, 1, 1, 0, 2, 1],
  [ 1, 1, 1, 1, 2, 1, 0, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 2, 1],
  [ 2, 1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 1, 1, 1, 1, 1, 1, 1, 1, 2],
  [ 2, 2, 0, 0, 0, 1, 1, 1, 1, 8, 8, 1, 1, 2, 0, 1, 1, 1, 0, 2],
  [ 1, 1, 2, 2, 2, 1, 1, 2, 1, 8, 8, 1, 2, 2, 1, 1, 2, 1, 1, 2],
];

// prettier-ignore
const CHUNK_1_8: Terrain[][] = [
  [14, 3, 3, 3, 3, 3,14,14,14, 8, 8,14, 3, 3, 3,14, 3,14,14,14],
  [14, 3,14,14,14,14,14, 3,14, 8, 8,14, 3, 3,14,14,14, 3, 3, 3],
  [14, 3,14,14,14, 0, 0,14,14, 8, 8,14,14,14,14,14,14,14, 3, 3],
  [14, 3,14, 0,14,14,14, 0,14, 8, 8,14,14,14,14,14,14,14, 3,14],
  [ 3,14, 3, 0, 0, 0, 0, 3,14, 8, 8,14, 0, 0,14,14,14,14, 3, 3],
  [14,14,14, 0,14,14,14, 3,14, 8, 8,14,14,14,14,14,14, 3, 3,14],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [14, 3,14,14,14,14, 0,14,14, 8, 8,14,14,14, 0,14,14,14,14,14],
  [ 3,14,14, 0, 0, 3,14,14,14, 8, 8,14, 0,14,14, 0,14,14,14,14],
  [ 3, 0,14,14,14,14,14, 3,14, 8, 8,14, 0,14,14,14, 0,14, 3,14],
  [ 3, 3, 0,14,14, 0,14, 3,14, 8, 8,14, 3, 0, 0, 3,14,14,14, 3],
  [14,14, 3,14,14, 0, 3,14,14, 8, 8,14,14,14, 0,14,14, 3,14,14],
  [14,14,14, 3, 3, 3,14, 3,14, 8, 8,14,14,14, 3, 3, 3, 3,14, 3],
];

// prettier-ignore
const CHUNK_2_8: Terrain[][] = [
  [14,14, 3,14,14, 3, 3, 3,14, 8, 8,14,14, 3, 3, 3, 3, 3, 3,14],
  [14,14,14, 3,14,14, 3, 3,14, 8, 8,14,14,14,14, 3,14, 3,14, 3],
  [14, 0,14,14, 0, 3, 0, 3,14, 8, 8,14,14,14,14,14, 3,14,14, 3],
  [ 3, 3,14,14,14, 3,14, 3,14, 8, 8,14,14,14,14,14,14,14, 3, 3],
  [ 3,14, 0,14,14,14,14,14,14, 8, 8,14,14,14,14, 0, 3, 0,14, 3],
  [14,14,14, 3, 0, 0,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [14,14,14, 0,14,14,14,14,14, 8, 8,14, 0,14,14,14,14, 0,14,14],
  [14,14,14,14,14, 0,14,14,14, 8, 8,14,14, 0,14,14,14, 0, 3,14],
  [ 3,14,14,14,14, 0,14, 0,14, 8, 8,14,14,14, 0,14,14, 0,14, 3],
  [14,14, 0, 0,14,14, 0, 0,14, 8, 8,14, 0, 0,14,14,14,14,14,14],
  [ 3, 3, 3,14,14, 3,14, 3,14, 8, 8,14,14,14, 0, 3,14, 3, 3,14],
  [ 3, 3,14, 3, 3,14, 3, 3,14, 8, 8,14, 3, 3, 3,14, 3, 3,14, 3],
];

// prettier-ignore
const CHUNK_3_8: Terrain[][] = [
  [ 3,14, 3,14, 3,14, 3,14,14, 8, 8,14, 3,14, 3, 3,14, 3,14,14],
  [14, 0,14,14,14,14, 3,14,14, 8, 8,14, 3,14,14, 0,14,14,14, 3],
  [ 3, 3,14, 0, 3,14,14,14,14, 8, 8,14, 3, 0,14,14,14,14, 3, 3],
  [ 3, 3,14, 3, 3, 0,14,14,14, 8, 8,14,14, 0,14,14,14,14,14, 3],
  [14, 3, 0, 3, 3,14, 0, 3,14, 8, 8,14,14,14, 0,14,14,14,14, 3],
  [14, 3,14,14,14,14,14, 3,14, 8, 8,14,14,14,14,14,14, 3,14,14],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [14, 0,14,14,14,14,14,14,14, 8, 8,14,14,14, 0,14,14, 3, 0,14],
  [ 3, 3,14, 0,14, 3,14,14,14, 8, 8,14,14,14, 0,14,14,14,14,14],
  [ 3, 0,14,14,14, 0,14,14,14, 8, 8,14,14, 3,14,14,14,14, 0,14],
  [ 3, 3,14,14,14,14,14,14,14, 8, 8,14,14,14, 0,14,14,14,14,14],
  [ 3,14,14,14, 3,14,14, 3,14, 8, 8,14, 3, 3,14, 3,14, 0, 3,14],
  [14, 3,14, 3, 3,14, 3, 3,14, 8, 8,14, 3, 3, 3,14, 3, 3,14,14],
];

// prettier-ignore
const CHUNK_4_8: Terrain[][] = [
  [14, 3,14,14, 3, 3, 3, 3,14, 8, 8,14, 3, 3, 3,14,14, 3,14, 3],
  [ 3,14,14, 0,14,14, 0, 3,14, 8, 8,14,14, 0, 0, 3,14,14, 0,14],
  [14, 3,14,14,14, 0, 3,14,14, 8, 8,14,14,14,14,14,14,14, 0,14],
  [ 3, 0,14,14, 0,14, 0,14,14, 8, 8,14,14,14,14,14, 3,14, 3,14],
  [14,14,14,14,14,14, 3,14,14, 8, 8,14, 0,14, 0, 0,14,14, 0,14],
  [14, 3,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14, 3,14],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [14,14,14,14,14,14,14,14,14, 8, 8,14,14,14,14,14,14,14,14,14],
  [14,14,14,14,14,14,14,14,14, 8, 8,14, 3, 3,14, 3,14, 0,14,14],
  [ 3, 3,14,14,14,14,14,14,14, 8, 8,14, 0,14,14,14,14,14, 0,14],
  [ 3, 3, 3,14,14, 0,14,14,14, 8, 8,14,14,14,14,14, 3, 0,14,14],
  [14,14, 0,14,14,14, 0,14,14, 8, 8,14,14,14,14,14,14,14,14, 3],
  [ 3, 3,14,14, 3, 3,14, 3,14, 8, 8,14,14,14, 3,14, 3,14,14, 3],
  [14,14,14, 3,14, 3,14, 3,14, 8, 8,14,14, 3, 3, 3,14,14, 3, 3],
];

// prettier-ignore
const CHUNK_5_8: Terrain[][] = [
  [ 2, 2, 2, 2, 2, 2, 2, 2, 4, 8, 8, 4, 4, 4, 2, 2, 2, 4, 2, 2],
  [ 4, 4, 2, 4, 0, 2, 2, 4, 4, 8, 8, 4, 0, 4, 4, 4, 4, 0, 0, 4],
  [ 4, 0, 4, 4, 0, 4, 4, 4, 4, 8, 8, 4, 4, 0, 4, 4, 4, 4, 4, 4],
  [ 4, 0, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 0, 4, 0, 4, 4, 4, 2],
  [ 2, 2, 4, 4, 4, 4, 2, 2, 4, 8, 8, 4, 4, 4, 0, 4, 4, 4, 0, 2],
  [ 4, 4, 4, 4, 0, 4, 4, 2, 4, 8, 8, 4, 4, 2, 4, 2, 4, 4, 4, 4],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 4, 0, 4, 4, 4, 4, 0, 4, 4, 8, 8, 4, 4, 2, 0, 4, 4, 4, 2, 4],
  [ 2, 4, 0, 4, 4, 4, 4, 4, 4, 8, 8, 4, 2, 4, 4, 2, 4, 4, 4, 4],
  [ 4, 4, 4, 4, 0, 2, 0, 4, 4, 8, 8, 4, 4, 4, 4, 0, 4, 2, 4, 4],
  [ 4, 4, 0, 4, 4, 4, 4, 2, 4, 8, 8, 4, 4, 0, 4, 4, 0, 4, 4, 2],
  [ 2, 2, 4, 4, 2, 2, 4, 4, 4, 8, 8, 4, 4, 4, 0, 4, 4, 2, 0, 2],
  [ 2, 4, 2, 2, 4, 2, 4, 2, 4, 8, 8, 4, 4, 4, 2, 2, 4, 2, 2, 2],
];

// prettier-ignore
const CHUNK_6_8: Terrain[][] = [
  [ 2, 2, 2, 2, 2, 2, 2, 2, 4, 8, 8, 4, 4, 4, 4, 2, 4, 2, 2, 4],
  [ 2, 2, 4, 4, 2, 4, 0, 2, 4, 8, 8, 4, 2, 0, 4, 0, 0, 4, 4, 2],
  [ 2, 2, 4, 4, 4, 0, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 0, 2, 4],
  [ 2, 4, 4, 4, 4, 0, 4, 4, 4, 8, 8, 4, 2, 4, 4, 2, 4, 4, 4, 2],
  [ 4, 4, 0, 4, 4, 0, 0, 0, 4, 8, 8, 4, 4, 0, 4, 2, 4, 4, 4, 2],
  [ 4, 0, 2, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 0, 4, 4, 4, 2, 4],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 4, 0, 4, 4, 4, 0, 0, 4, 4, 8, 8, 4, 4, 4, 4, 4, 2, 4, 4, 4],
  [ 2, 4, 4, 4, 4, 0, 4, 4, 4, 8, 8, 4, 0, 4, 4, 0, 2, 2, 2, 2],
  [ 4, 4, 4, 2, 4, 4, 0, 4, 4, 8, 8, 4, 0, 4, 2, 4, 4, 0, 2, 2],
  [ 4, 2, 4, 0, 0, 4, 4, 4, 4, 8, 8, 4, 4, 0, 4, 4, 4, 2, 0, 2],
  [ 2, 2, 4, 4, 4, 2, 2, 4, 4, 8, 8, 4, 2, 0, 0, 4, 2, 4, 4, 2],
  [ 4, 2, 2, 4, 4, 4, 4, 2, 4, 8, 8, 4, 2, 4, 4, 4, 2, 4, 2, 4],
];

// prettier-ignore
const CHUNK_7_8: Terrain[][] = [
  [ 2, 4, 4, 2, 2, 4, 2, 2, 4, 8, 8, 4, 4, 2, 2, 4, 2, 2, 2, 4],
  [ 4, 0, 4, 0, 4, 4, 0, 4, 4, 8, 8, 4, 4, 4, 0, 4, 2, 2, 0, 4],
  [ 4, 0, 0, 0, 4, 0, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 0, 4, 4, 4],
  [ 4, 4, 4, 4, 2, 0, 4, 4, 4, 8, 8, 4, 0, 4, 2, 4, 4, 4, 4, 2],
  [ 4, 4, 4, 0, 0, 4, 4, 0, 4, 8, 8, 4, 4, 4, 4, 0, 0, 4, 2, 2],
  [ 4, 4, 4, 4, 4, 4, 4, 2, 4, 8, 8, 4, 4, 4, 0, 0, 4, 4, 0, 4],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [ 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  [ 4, 2, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 2, 4, 4, 4, 2, 4, 2, 4],
  [ 2, 2, 4, 4, 4, 4, 4, 4, 4, 8, 8, 4, 2, 4, 0, 4, 4, 0, 4, 4],
  [ 2, 4, 4, 4, 4, 4, 2, 0, 4, 8, 8, 4, 4, 4, 4, 4, 4, 0, 4, 4],
  [ 4, 4, 4, 4, 2, 4, 4, 4, 4, 8, 8, 4, 4, 4, 4, 4, 0, 4, 2, 4],
  [ 2, 4, 4, 2, 4, 4, 4, 2, 4, 8, 8, 4, 2, 4, 4, 4, 4, 0, 2, 4],
  [ 4, 2, 2, 2, 2, 4, 4, 2, 4, 8, 8, 4, 4, 2, 4, 2, 2, 2, 4, 4],
];

// prettier-ignore
const CHUNK_8_8: Terrain[][] = [
  [17, 2,17,17,17,17,17, 2,17, 8, 8,17,17,17, 2, 2, 2,17, 2,17],
  [ 2,17, 2,17,17, 4,17, 4,17, 8, 8,17,17,17, 2,17,17,17,17,17],
  [17, 2,17,17, 2,17, 4,17,17, 8, 8,17,17,17,17, 4,17, 4, 2, 2],
  [17, 2, 2,17,17,17, 4, 2,17, 8, 8,17,17,17, 2, 4,17,17, 2, 2],
  [ 2,17,17, 4,17,17,17,17,17, 8, 8,17, 4,17,17,17,17,17, 4, 2],
  [17, 4,17,17,17,17, 2, 4,17, 8, 8,17,17,17,17,17, 2,17,17,17],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17, 2,17,17,17,17, 2,17],
  [17,17,17,17, 4,17,17, 4,17, 8, 8,17,17,17,17, 2,17, 4,17, 2],
  [ 2,17, 4,17,17, 4,17, 4,17, 8, 8,17, 4,17,17, 2,17,17,17, 2],
  [17,17, 4,17, 4,17, 4, 4,17, 8, 8,17,17,17,17,17, 4,17,17, 2],
  [ 2,17, 4,17, 4, 2,17,17,17, 8, 8,17,17,17,17,17,17,17, 4, 2],
  [ 2, 2, 2,17,17, 2, 2,17,17, 8, 8,17, 2,17,17,17, 2,17, 2,17],
];

// prettier-ignore
const CHUNK_9_8: Terrain[][] = [
  [17,17,17, 2, 2,17,17,17,17, 8, 8,17,17,17,17, 2, 2,17, 2,17],
  [17, 2, 4, 2, 2,17,17,17,17, 8, 8,17, 2,17, 2,17,17, 2, 2,17],
  [ 2,17,17,17,17, 4,17,17,17, 8, 8,17,17,17, 2,17,17, 2, 2, 2],
  [ 2, 2,17,17, 2,17,17,17,17, 8, 8,17, 4,17, 4, 2,17,17,17, 2],
  [ 2,17, 4,17, 2,17, 2,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [17, 2, 4, 4,17,17,17, 4,17, 8, 8,17, 4, 2,17,17, 2, 4,17,17],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [ 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17,17,17,17,17,17,17],
  [17,17,17,17,17,17,17,17,17, 8, 8,17,17,17, 4,17,17,17, 4,17],
  [17, 2,17,17, 2,17,17,17,17, 8, 8,17,17,17,17, 4, 4,17, 2,17],
  [17, 4, 4,17,17, 4,17,17,17, 8, 8,17,17, 4,17,17,17,17,17, 2],
  [17,17,17,17,17, 2,17,17,17, 8, 8,17,17,17,17,17,17,17, 2,17],
  [ 2, 2, 4,17,17, 4, 2,17,17, 8, 8,17,17,17,17, 4, 2, 2,17, 2],
  [17,17,17,17,17,17, 2, 2,17, 8, 8,17,17,17, 2,17, 2, 2, 2,17],
];

export const WORLD_CHUNKS: WorldChunk[][] = [
  // Row 0
  [
    { name: "Frozen Reach", mapData: CHUNK_0_0, towns: [], bosses: [] },
    { name: "Frozen Vale", mapData: CHUNK_1_0, towns: [{ name: "Frostheim", x: 10, y: 7, hasShop: true, shopItems: ["potion", "ether", "greaterPotion", "chainMail", "ironShield"] }], bosses: [] },
    { name: "Frozen Hollow", mapData: CHUNK_2_0, towns: [], bosses: [] },
    { name: "Frozen Expanse", mapData: CHUNK_3_0, towns: [], bosses: [{ name: "Frost Giant", monsterId: "frostGiant", x: 10, y: 7 }] },
    { name: "Highland Ridge", mapData: CHUNK_4_0, towns: [], bosses: [] },
    { name: "Highland Crossing", mapData: CHUNK_5_0, towns: [], bosses: [] },
    { name: "Highland Wilds", mapData: CHUNK_6_0, towns: [], bosses: [] },
    { name: "Frozen Flats", mapData: CHUNK_7_0, towns: [], bosses: [] },
    { name: "Frozen Passage", mapData: CHUNK_8_0, towns: [], bosses: [] },
    { name: "Frozen Frontier", mapData: CHUNK_9_0, towns: [], bosses: [] },
  ],
  // Row 1
  [
    { name: "Frozen Frontier", mapData: CHUNK_0_1, towns: [], bosses: [] },
    { name: "Ancient Reach", mapData: CHUNK_1_1, towns: [], bosses: [] },
    { name: "Ancient Vale", mapData: CHUNK_2_1, towns: [{ name: "Deeproot", x: 10, y: 7, hasShop: true, shopItems: ["potion", "ether", "shortSword", "leatherArmor", "woodenShield"] }], bosses: [] },
    { name: "Mountain Peak", mapData: CHUNK_3_1, towns: [], bosses: [] },
    { name: "Northern Forest", mapData: CHUNK_4_1, towns: [], bosses: [{ name: "Cave Troll", monsterId: "troll", x: 10, y: 7 }] },
    { name: "Misty Highlands", mapData: CHUNK_5_1, towns: [], bosses: [] },
    { name: "Rocky Crossing", mapData: CHUNK_6_1, towns: [], bosses: [] },
    { name: "Rocky Wilds", mapData: CHUNK_7_1, towns: [], bosses: [] },
    { name: "Ancient Flats", mapData: CHUNK_8_1, towns: [], bosses: [] },
    { name: "Frozen Passage", mapData: CHUNK_9_1, towns: [], bosses: [] },
  ],
  // Row 2
  [
    { name: "Rocky Passage", mapData: CHUNK_0_2, towns: [], bosses: [] },
    { name: "Ancient Frontier", mapData: CHUNK_1_2, towns: [], bosses: [] },
    { name: "Woodland Reach", mapData: CHUNK_2_2, towns: [], bosses: [] },
    { name: "Western Plains", mapData: CHUNK_3_2, towns: [{ name: "Ironhold", x: 5, y: 7, hasShop: true, shopItems: ["greaterPotion", "ether", "greatSword", "plateArmor", "towerShield", "chimaeraWing"] }], bosses: [] },
    { name: "Heartlands", mapData: CHUNK_4_2, towns: [{ name: "Willowdale", x: 2, y: 2, hasShop: true, shopItems: ["potion", "ether", "shortSword", "leatherArmor", "woodenShield", "dungeonKey"] }], bosses: [] },
    { name: "Eastern Desert", mapData: CHUNK_5_2, towns: [{ name: "Sandport", x: 12, y: 6, hasShop: true, shopItems: ["potion", "greaterPotion", "longSword", "chainMail", "ironShield", "chimaeraWing"] }], bosses: [] },
    { name: "Arid Ridge", mapData: CHUNK_6_2, towns: [], bosses: [] },
    { name: "Arid Crossing", mapData: CHUNK_7_2, towns: [{ name: "Canyonwatch", x: 10, y: 7, hasShop: true, shopItems: ["potion", "greaterPotion", "longSword", "ironShield"] }], bosses: [] },
    { name: "Rocky Wilds", mapData: CHUNK_8_2, towns: [], bosses: [] },
    { name: "Rocky Flats", mapData: CHUNK_9_2, towns: [], bosses: [] },
  ],
  // Row 3
  [
    { name: "Murky Flats", mapData: CHUNK_0_3, towns: [], bosses: [] },
    { name: "Murky Passage", mapData: CHUNK_1_3, towns: [{ name: "Bogtown", x: 10, y: 7, hasShop: true, shopItems: ["potion", "ether", "greaterPotion"] }], bosses: [] },
    { name: "Woodland Frontier", mapData: CHUNK_2_3, towns: [], bosses: [] },
    { name: "Marshlands", mapData: CHUNK_3_3, towns: [], bosses: [] },
    { name: "Southern Forest", mapData: CHUNK_4_3, towns: [{ name: "Thornvale", x: 10, y: 7, hasShop: true, shopItems: ["potion", "ether", "greaterPotion", "longSword", "chainMail", "ironShield", "chimaeraWing"] }], bosses: [] },
    { name: "Dragon's Domain", mapData: CHUNK_5_3, towns: [], bosses: [{ name: "Young Red Dragon", monsterId: "dragon", x: 10, y: 7 }] },
    { name: "Scorched Expanse", mapData: CHUNK_6_3, towns: [], bosses: [] },
    { name: "Arid Ridge", mapData: CHUNK_7_3, towns: [], bosses: [] },
    { name: "Arid Crossing", mapData: CHUNK_8_3, towns: [], bosses: [] },
    { name: "Rocky Wilds", mapData: CHUNK_9_3, towns: [], bosses: [] },
  ],
  // Row 4
  [
    { name: "Murky Wilds", mapData: CHUNK_0_4, towns: [], bosses: [{ name: "Swamp Hydra", monsterId: "swampHydra", x: 10, y: 7 }] },
    { name: "Murky Flats", mapData: CHUNK_1_4, towns: [], bosses: [] },
    { name: "Woodland Passage", mapData: CHUNK_2_4, towns: [], bosses: [] },
    { name: "Woodland Frontier", mapData: CHUNK_3_4, towns: [], bosses: [] },
    { name: "Ancient Reach", mapData: CHUNK_4_4, towns: [], bosses: [] },
    { name: "Arid Vale", mapData: CHUNK_5_4, towns: [], bosses: [] },
    { name: "Scorched Hollow", mapData: CHUNK_6_4, towns: [{ name: "Ashfall", x: 10, y: 7, hasShop: true, shopItems: ["greaterPotion", "ether", "greatSword", "plateArmor", "towerShield"] }], bosses: [] },
    { name: "Scorched Expanse", mapData: CHUNK_7_4, towns: [], bosses: [] },
    { name: "Arid Ridge", mapData: CHUNK_8_4, towns: [{ name: "Dunerest", x: 10, y: 7, hasShop: true, shopItems: ["potion", "greaterPotion", "longSword", "chainMail"] }], bosses: [] },
    { name: "Arid Crossing", mapData: CHUNK_9_4, towns: [], bosses: [] },
  ],
  // Row 5
  [
    { name: "Murky Crossing", mapData: CHUNK_0_5, towns: [], bosses: [] },
    { name: "Woodland Wilds", mapData: CHUNK_1_5, towns: [], bosses: [] },
    { name: "Woodland Flats", mapData: CHUNK_2_5, towns: [], bosses: [] },
    { name: "Ancient Passage", mapData: CHUNK_3_5, towns: [], bosses: [] },
    { name: "Ancient Frontier", mapData: CHUNK_4_5, towns: [], bosses: [] },
    { name: "Rocky Reach", mapData: CHUNK_5_5, towns: [], bosses: [] },
    { name: "Rocky Vale", mapData: CHUNK_6_5, towns: [], bosses: [] },
    { name: "Scorched Hollow", mapData: CHUNK_7_5, towns: [], bosses: [{ name: "Volcanic Wyrm", monsterId: "volcanicWyrm", x: 10, y: 7 }] },
    { name: "Arid Expanse", mapData: CHUNK_8_5, towns: [], bosses: [] },
    { name: "Arid Ridge", mapData: CHUNK_9_5, towns: [], bosses: [] },
  ],
  // Row 6
  [
    { name: "Woodland Ridge", mapData: CHUNK_0_6, towns: [], bosses: [] },
    { name: "Woodland Crossing", mapData: CHUNK_1_6, towns: [], bosses: [] },
    { name: "Murky Wilds", mapData: CHUNK_2_6, towns: [], bosses: [] },
    { name: "Ancient Flats", mapData: CHUNK_3_6, towns: [], bosses: [] },
    { name: "Rocky Passage", mapData: CHUNK_4_6, towns: [], bosses: [] },
    { name: "Rocky Frontier", mapData: CHUNK_5_6, towns: [], bosses: [] },
    { name: "Arid Reach", mapData: CHUNK_6_6, towns: [], bosses: [] },
    { name: "Arid Vale", mapData: CHUNK_7_6, towns: [], bosses: [] },
    { name: "Arid Hollow", mapData: CHUNK_8_6, towns: [], bosses: [] },
    { name: "Rocky Expanse", mapData: CHUNK_9_6, towns: [{ name: "Ridgewatch", x: 10, y: 7, hasShop: true, shopItems: ["greaterPotion", "longSword", "chainMail", "ironShield"] }], bosses: [] },
  ],
  // Row 7
  [
    { name: "Woodland Expanse", mapData: CHUNK_0_7, towns: [], bosses: [] },
    { name: "Woodland Ridge", mapData: CHUNK_1_7, towns: [], bosses: [] },
    { name: "Murky Crossing", mapData: CHUNK_2_7, towns: [], bosses: [] },
    { name: "Murky Wilds", mapData: CHUNK_3_7, towns: [{ name: "Shadowfen", x: 10, y: 7, hasShop: true, shopItems: ["potion", "ether", "shortSword"] }], bosses: [] },
    { name: "Murky Flats", mapData: CHUNK_4_7, towns: [], bosses: [] },
    { name: "Arid Passage", mapData: CHUNK_5_7, towns: [], bosses: [] },
    { name: "Arid Frontier", mapData: CHUNK_6_7, towns: [], bosses: [] },
    { name: "Rocky Reach", mapData: CHUNK_7_7, towns: [], bosses: [] },
    { name: "Rocky Vale", mapData: CHUNK_8_7, towns: [], bosses: [] },
    { name: "Rocky Hollow", mapData: CHUNK_9_7, towns: [], bosses: [{ name: "Canyon Drake", monsterId: "canyonDrake", x: 10, y: 7 }] },
  ],
  // Row 8
  [
    { name: "Woodland Hollow", mapData: CHUNK_0_8, towns: [], bosses: [] },
    { name: "Murky Expanse", mapData: CHUNK_1_8, towns: [], bosses: [] },
    { name: "Murky Ridge", mapData: CHUNK_2_8, towns: [], bosses: [] },
    { name: "Murky Crossing", mapData: CHUNK_3_8, towns: [], bosses: [] },
    { name: "Murky Wilds", mapData: CHUNK_4_8, towns: [], bosses: [] },
    { name: "Arid Flats", mapData: CHUNK_5_8, towns: [], bosses: [] },
    { name: "Arid Passage", mapData: CHUNK_6_8, towns: [], bosses: [] },
    { name: "Arid Frontier", mapData: CHUNK_7_8, towns: [], bosses: [] },
    { name: "Rocky Reach", mapData: CHUNK_8_8, towns: [], bosses: [] },
    { name: "Rocky Vale", mapData: CHUNK_9_8, towns: [], bosses: [] },
  ],
];

export function getChunk(cx: number, cy: number): WorldChunk | undefined {
  if (cx < 0 || cx >= WORLD_WIDTH || cy < 0 || cy >= WORLD_HEIGHT) return undefined;
  return WORLD_CHUNKS[cy][cx];
}

export function getTerrainAt(cx: number, cy: number, x: number, y: number): Terrain | undefined {
  const chunk = getChunk(cx, cy);
  if (!chunk) return undefined;
  if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return undefined;
  return chunk.mapData[y][x];
}

export function getAllTowns(): Array<TownData & { chunkX: number; chunkY: number }> {
  const result: Array<TownData & { chunkX: number; chunkY: number }> = [];
  for (let cy = 0; cy < WORLD_HEIGHT; cy++) {
    for (let cx = 0; cx < WORLD_WIDTH; cx++) {
      for (const town of WORLD_CHUNKS[cy][cx].towns) {
        result.push({ ...town, chunkX: cx, chunkY: cy });
      }
    }
  }
  return result;
}

export function getAllBosses(): Array<BossData & { chunkX: number; chunkY: number }> {
  const result: Array<BossData & { chunkX: number; chunkY: number }> = [];
  for (let cy = 0; cy < WORLD_HEIGHT; cy++) {
    for (let cx = 0; cx < WORLD_WIDTH; cx++) {
      for (const boss of WORLD_CHUNKS[cy][cx].bosses) {
        result.push({ ...boss, chunkX: cx, chunkY: cy });
      }
    }
  }
  return result;
}

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
  "Frozen Reach": 0xb0bec5,
  "Frozen Vale": 0xb0bec5,
  "Frozen Hollow": 0xb0bec5,
  "Frozen Expanse": 0xb0bec5,
  "Highland Ridge": 0x795548,
  "Highland Crossing": 0x795548,
  "Highland Wilds": 0x795548,
  "Frozen Flats": 0xb0bec5,
  "Frozen Passage": 0xb0bec5,
  "Frozen Frontier": 0xb0bec5,
  "Ancient Reach": 0x1b5e20,
  "Ancient Vale": 0x1b5e20,
  "Rocky Crossing": 0xa1887f,
  "Rocky Wilds": 0xa1887f,
  "Ancient Flats": 0x1b5e20,
  "Rocky Passage": 0xa1887f,
  "Ancient Frontier": 0x1b5e20,
  "Woodland Reach": 0x2e7d32,
  "Arid Ridge": 0xfdd835,
  "Arid Crossing": 0xfdd835,
  "Rocky Flats": 0xa1887f,
  "Murky Flats": 0x558b2f,
  "Murky Passage": 0x558b2f,
  "Woodland Frontier": 0x2e7d32,
  "Scorched Expanse": 0xbf360c,
  "Murky Wilds": 0x558b2f,
  "Woodland Passage": 0x2e7d32,
  "Arid Vale": 0xfdd835,
  "Scorched Hollow": 0xbf360c,
  "Murky Crossing": 0x558b2f,
  "Woodland Wilds": 0x2e7d32,
  "Woodland Flats": 0x2e7d32,
  "Ancient Passage": 0x1b5e20,
  "Rocky Reach": 0xa1887f,
  "Rocky Vale": 0xa1887f,
  "Arid Expanse": 0xfdd835,
  "Woodland Ridge": 0x2e7d32,
  "Woodland Crossing": 0x2e7d32,
  "Rocky Frontier": 0xa1887f,
  "Arid Reach": 0xfdd835,
  "Arid Hollow": 0xfdd835,
  "Rocky Expanse": 0xa1887f,
  "Woodland Expanse": 0x2e7d32,
  "Arid Passage": 0xfdd835,
  "Arid Frontier": 0xfdd835,
  "Rocky Hollow": 0xa1887f,
  "Woodland Hollow": 0x2e7d32,
  "Murky Expanse": 0x558b2f,
  "Murky Ridge": 0x558b2f,
  "Arid Flats": 0xfdd835,
};

// ─── Road Diversification ─────────────────────────────────────────
// Post-processes chunk map data at module load to vary road patterns.

/** Find the most common non-special terrain in a chunk (used to fill removed roads). */
function dominantFill(md: Terrain[][]): Terrain {
  const counts = new Map<Terrain, number>();
  for (const row of md) {
    for (const t of row) {
      if (t === Terrain.Path || isSpecialTerrain(t)) continue;
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  let best = Terrain.Grass;
  let bestCount = 0;
  for (const [t, c] of counts) {
    if (c > bestCount) { best = t; bestCount = c; }
  }
  return best;
}

/** Set a tile to Path if it isn't special terrain. */
function setPath(md: Terrain[][], y: number, x: number): void {
  if (y < 0 || y >= md.length || x < 0 || x >= md[0].length) return;
  if (!isSpecialTerrain(md[y][x])) md[y][x] = Terrain.Path;
}

/** Replace path tile with fill terrain if it currently is a path. */
function clearPath(md: Terrain[][], y: number, x: number, fill: Terrain): void {
  if (y < 0 || y >= md.length || x < 0 || x >= md[0].length) return;
  if (md[y][x] === Terrain.Path) md[y][x] = fill;
}

function diversifyRoads(): void {
  for (let cy = 0; cy < WORLD_HEIGHT; cy++) {
    for (let cx = 0; cx < WORLD_WIDTH; cx++) {
      const chunk = WORLD_CHUNKS[cy][cx];
      const md = chunk.mapData;
      const H = md.length;
      const W = md[0].length;
      const fill = dominantFill(md);

      const isTop = cy === 0;
      const isBot = cy === WORLD_HEIGHT - 1;
      const isLeft = cx === 0;
      const isRight = cx === WORLD_WIDTH - 1;

      // ── Edge chunks: remove the arm that goes off-map ──
      if (isTop) {
        for (let y = 0; y < 7; y++) { clearPath(md, y, 9, fill); clearPath(md, y, 10, fill); }
      }
      if (isBot) {
        for (let y = 8; y < H; y++) { clearPath(md, y, 9, fill); clearPath(md, y, 10, fill); }
      }
      if (isLeft) {
        for (let x = 0; x < 9; x++) clearPath(md, 7, x, fill);
      }
      if (isRight) {
        for (let x = 11; x < W; x++) clearPath(md, 7, x, fill);
      }

      // ── Interior variety for empty chunks (no towns/bosses) ──
      if (chunk.towns.length > 0 || chunk.bosses.length > 0) continue;

      const seed = (cx * 31 + cy * 17 + cx * cy * 7) % 7;
      switch (seed) {
        case 0: // Keep straight cross (no change)
          break;

        case 1: { // Wide plaza at intersection (5×5 clear area)
          for (let y = 5; y <= 9; y++) {
            for (let x = 7; x <= 12; x++) setPath(md, y, x);
          }
          break;
        }

        case 2: { // Winding horizontal — road snakes through rows 5-9
          // Clear the straight horizontal (except at intersection cols)
          for (let x = 1; x < W - 1; x++) {
            if (x >= 8 && x <= 11) continue;
            clearPath(md, 7, x, fill);
          }
          const rowWind = [7, 6, 6, 5, 6, 7, 8, 9, 8, /* 9,10 junction */ 7, 7, 8, 9, 9, 8, 7, 6, 6, 7, 7];
          for (let x = 0; x < W; x++) {
            const wy = rowWind[x];
            setPath(md, wy, x);
            // Connect winding row to the fixed junction row
            if (x >= 8 && x <= 11) {
              for (let y = Math.min(wy, 7); y <= Math.max(wy, 7); y++) setPath(md, y, x);
            }
          }
          break;
        }

        case 3: { // Winding vertical — road snakes through cols 7-12
          for (let y = 1; y < H - 1; y++) {
            if (y >= 6 && y <= 8) continue;
            clearPath(md, y, 9, fill);
            clearPath(md, y, 10, fill);
          }
          const colWind = [9, 10, 11, 11, 10, 9, /* 6-8 junction */ 9, 9, 9, 8, 8, 9, 10, 10, 9];
          for (let y = 0; y < H; y++) {
            const wx = colWind[y];
            setPath(md, y, wx);
            setPath(md, y, wx + 1);
            if (y >= 6 && y <= 8) {
              for (let x = Math.min(wx, 9); x <= Math.max(wx + 1, 10); x++) setPath(md, y, x);
            }
          }
          break;
        }

        case 4: { // Side branches — short dead-end roads
          // Branch NW from vertical at y=3
          for (let x = 6; x <= 9; x++) setPath(md, 3, x);
          // Branch SE from vertical at y=11
          for (let x = 10; x <= 14; x++) setPath(md, 11, x);
          // Branch N from horizontal at x=4
          for (let y = 4; y <= 7; y++) setPath(md, y, 4);
          // Branch S from horizontal at x=15
          for (let y = 7; y <= 11; y++) setPath(md, y, 15);
          break;
        }

        case 5: { // Roundabout — circular clearing at the intersection
          const cx2 = 9.5, cy2 = 7;
          for (let y = 4; y <= 10; y++) {
            for (let x = 6; x <= 13; x++) {
              const dx = x - cx2, dy = y - cy2;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist >= 2.2 && dist <= 3.8) setPath(md, y, x);
            }
          }
          break;
        }

        case 6: { // Diagonal offset — road shifts by 2 tiles in each quadrant
          // NW quadrant: vertical shifted left
          for (let y = 0; y < 7; y++) {
            clearPath(md, y, 9, fill);
            clearPath(md, y, 10, fill);
            setPath(md, y, 7);
            setPath(md, y, 8);
          }
          // Connect shifted vertical to junction
          for (let x = 7; x <= 10; x++) { setPath(md, 6, x); setPath(md, 7, x); }
          // SE quadrant: vertical shifted right
          for (let y = 8; y < H; y++) {
            clearPath(md, y, 9, fill);
            clearPath(md, y, 10, fill);
            setPath(md, y, 11);
            setPath(md, y, 12);
          }
          for (let x = 9; x <= 12; x++) { setPath(md, 7, x); setPath(md, 8, x); }
          break;
        }
      }
    }
  }
}

// ─── Minor Treasure Placement ─────────────────────────────────────
// Scatter small blue sparkle treasures across overworld chunks on walkable tiles.

/** Deterministic pseudo-random number based on seed. */
function seededRand(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

/** Sparkle positions stored as overlay — terrain data is never modified. */
export const SPARKLE_POSITIONS: Set<string> = new Set();

/** Check if a tile has a sparkle overlay. */
export function hasSparkleAt(cx: number, cy: number, x: number, y: number): boolean {
  return SPARKLE_POSITIONS.has(`${cx},${cy},${x},${y}`);
}

function placeMinorTreasures(): void {
  const rng = seededRand(42);
  for (let cy = 0; cy < WORLD_HEIGHT; cy++) {
    for (let cx = 0; cx < WORLD_WIDTH; cx++) {
      const chunk = WORLD_CHUNKS[cy][cx];
      const md = chunk.mapData;
      // Place 1-3 minor treasures per chunk on walkable non-special tiles
      const count = 1 + Math.floor(rng() * 3);
      let placed = 0;
      let attempts = 0;
      while (placed < count && attempts < 60) {
        attempts++;
        const tx = Math.floor(rng() * MAP_WIDTH);
        const ty = Math.floor(rng() * MAP_HEIGHT);
        const t = md[ty][tx];
        // Only place on walkable, non-special, non-path tiles
        if (isWalkable(t) && !isSpecialTerrain(t) && t !== Terrain.Path) {
          SPARKLE_POSITIONS.add(`${cx},${cy},${tx},${ty}`);
          placed++;
        }
      }
    }
  }
}

// ─── Biome Decorations ──────────────────────────────────────────
// Scatter themed decoration tiles on overworld biome terrains.

/** Map from biome terrain to the decoration terrain to scatter. */
const BIOME_DECORATION_MAP: Partial<Record<Terrain, Terrain>> = {
  [Terrain.Grass]: Terrain.Flower,
  [Terrain.Sand]: Terrain.Cactus,
  [Terrain.Volcanic]: Terrain.Geyser,  // placed on adjacent walkable tiles
  [Terrain.Swamp]: Terrain.Mushroom,
};

function placeBiomeDecorations(): void {
  const rng = seededRand(7777);
  for (let cy = 0; cy < WORLD_HEIGHT; cy++) {
    for (let cx = 0; cx < WORLD_WIDTH; cx++) {
      const chunk = WORLD_CHUNKS[cy][cx];
      const md = chunk.mapData;
      // Count biome tiles to determine dominant biome(s)
      for (let ty = 0; ty < MAP_HEIGHT; ty++) {
        for (let tx = 0; tx < MAP_WIDTH; tx++) {
          const t = md[ty][tx];
          const deco = BIOME_DECORATION_MAP[t];
          if (!deco) continue;
          // Sparse placement: ~4% chance per matching tile
          if (rng() > 0.04) continue;
          // For Volcanic: place on a walkable neighbour rather than the tile itself
          if (t === Terrain.Volcanic) {
            const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
            for (const [dx, dy] of dirs) {
              const nx = tx + dx, ny = ty + dy;
              if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT) {
                const nt = md[ny][nx];
                if (isWalkable(nt) && !isSpecialTerrain(nt) && nt !== Terrain.Path) {
                  md[ny][nx] = deco;
                  break;
                }
              }
            }
          } else {
            // Don't place flowers on grass tiles adjacent to sand/desert
            if (t === Terrain.Grass && deco === Terrain.Flower) {
              let nearSand = false;
              for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
                const nx = tx + dx, ny = ty + dy;
                if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT) {
                  const nt = md[ny][nx];
                  if (nt === Terrain.Sand || nt === Terrain.Cactus) { nearSand = true; break; }
                }
              }
              if (nearSand) continue;
            }
            md[ty][tx] = deco;
          }
        }
      }
    }
  }
}

// Execute at module load
diversifyRoads();
placeBiomeDecorations();
placeMinorTreasures();
