/**
 * Overworld map data.
 * Each tile has a terrain type that affects encounters and traversal.
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
}

export interface TownData {
  name: string;
  x: number;
  y: number;
  hasShop: boolean;
}

export interface BossData {
  name: string;
  monsterId: string;
  x: number;
  y: number;
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
};

export const MAP_WIDTH = 20;
export const MAP_HEIGHT = 15;

// prettier-ignore
/** The overworld map grid (20x15). */
export const MAP_DATA: Terrain[][] = [
  [2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2],
  [2, 1, 1, 0, 0, 0, 3, 3, 4, 4, 4, 3, 3, 0, 0, 1, 1, 1, 2, 2],
  [2, 1, 5, 8, 0, 1, 0, 3, 4, 4, 4, 4, 3, 0, 1, 1, 6, 1, 1, 2],
  [2, 0, 8, 0, 0, 1, 0, 0, 3, 4, 4, 3, 0, 0, 0, 8, 8, 0, 0, 2],
  [0, 0, 8, 0, 1, 1, 0, 0, 0, 3, 3, 0, 0, 1, 0, 0, 8, 0, 0, 0],
  [0, 0, 8, 8, 8, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 8, 0, 0, 0],
  [0, 0, 0, 0, 8, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 5, 8, 0, 0, 0],
  [0, 0, 0, 0, 8, 8, 8, 8, 5, 8, 8, 8, 8, 8, 8, 8, 8, 0, 0, 0],
  [0, 0, 1, 0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
  [0, 1, 1, 0, 0, 0, 0, 0, 8, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 0],
  [0, 1, 0, 0, 7, 8, 8, 8, 8, 0, 0, 0, 1, 7, 1, 0, 0, 0, 1, 0],
  [2, 0, 0, 0, 0, 0, 0, 0, 8, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 2],
  [2, 0, 0, 1, 1, 0, 0, 0, 8, 8, 5, 0, 0, 0, 0, 1, 0, 0, 0, 2],
  [2, 2, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 2, 2],
  [2, 2, 2, 2, 1, 1, 2, 2, 0, 0, 0, 0, 2, 2, 1, 1, 2, 2, 2, 2],
];

/** Named towns on the map. */
export const TOWNS: TownData[] = [
  { name: "Willowdale", x: 2, y: 2, hasShop: true },
  { name: "Sandport", x: 8, y: 7, hasShop: true },
  { name: "Ironhold", x: 15, y: 6, hasShop: true },
  { name: "Thornvale", x: 10, y: 12, hasShop: true },
];

/** Fixed boss locations. */
export const BOSSES: BossData[] = [
  { name: "Cave Troll", monsterId: "troll", x: 4, y: 10 },
  { name: "Young Red Dragon", monsterId: "dragon", x: 13, y: 10 },
];

/** Check if a terrain is walkable. */
export function isWalkable(terrain: Terrain): boolean {
  return terrain !== Terrain.Water && terrain !== Terrain.Mountain;
}

/** Get terrain at map coordinates. Returns undefined if out of bounds. */
export function getTerrainAt(x: number, y: number): Terrain | undefined {
  if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return undefined;
  return MAP_DATA[y][x];
}
