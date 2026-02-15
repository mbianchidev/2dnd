/**
 * Dungeon interior map data.
 * Extracted from map.ts for better code organization.
 *
 * Each dungeon has multiple levels connected by DungeonStairs tiles.
 * Level 0 is the entrance level; deeper levels contain the dungeon boss.
 */

import { Terrain } from "./mapTypes";
import type { DungeonData } from "./mapTypes";

const dW = Terrain.DungeonWall;
const dF = Terrain.DungeonFloor;
const dE = Terrain.DungeonExit;
const dC = Terrain.Chest;
const dS = Terrain.DungeonStairs;
const dB = Terrain.DungeonBoss;

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

// Level 1 entry is at (1,1) — stairs down at (1,1) on level 0 replaced below
HEARTLANDS_CRYPT_INTERIOR[1][1] = dS;

// prettier-ignore
const HEARTLANDS_CRYPT_LEVEL2: Terrain[][] = [
  [dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW],
  [dW,dF,dF,dF,dF,dF,dW,dF,dF,dF,dF,dF,dF,dW,dF,dF,dF,dF,dF,dW],
  [dW,dF,dW,dW,dW,dF,dW,dF,dW,dW,dW,dW,dF,dW,dF,dW,dW,dW,dF,dW],
  [dW,dF,dF,dF,dW,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dW,dF,dW],
  [dW,dW,dW,dF,dW,dW,dW,dW,dF,dW,dW,dW,dW,dW,dW,dW,dF,dW,dF,dW],
  [dW,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dW],
  [dW,dF,dW,dW,dW,dW,dF,dW,dW,dW,dW,dW,dW,dW,dF,dW,dW,dW,dF,dW],
  [dW,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dW],
  [dW,dW,dF,dW,dW,dW,dF,dW,dW,dW,dW,dW,dW,dF,dW,dW,dF,dW,dW,dW],
  [dW,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dW],
  [dW,dF,dW,dW,dW,dW,dF,dW,dW,dW,dW,dW,dW,dF,dW,dW,dW,dW,dF,dW],
  [dW,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dW],
  [dW,dF,dW,dW,dW,dF,dW,dW,dW,dF,dF,dW,dW,dW,dF,dW,dW,dW,dF,dW],
  [dW,dS,dF,dF,dF,dF,dF,dF,dF,dF,dB,dF,dF,dF,dF,dF,dF,dF,dF,dW],
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

FROST_CAVERN_INTERIOR[1][1] = dS;

// prettier-ignore
const FROST_CAVERN_LEVEL2: Terrain[][] = [
  [dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW],
  [dW,dF,dF,dF,dF,dW,dF,dF,dF,dF,dF,dF,dF,dW,dF,dF,dF,dF,dF,dW],
  [dW,dF,dW,dW,dF,dW,dF,dW,dW,dW,dW,dW,dF,dW,dF,dW,dW,dW,dF,dW],
  [dW,dF,dF,dW,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dW],
  [dW,dW,dF,dW,dW,dW,dW,dW,dW,dF,dW,dW,dW,dW,dW,dW,dF,dW,dW,dW],
  [dW,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dW],
  [dW,dF,dW,dW,dW,dF,dW,dW,dW,dW,dW,dW,dW,dF,dW,dW,dW,dW,dF,dW],
  [dW,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dW],
  [dW,dW,dF,dW,dW,dF,dW,dW,dW,dF,dW,dW,dW,dF,dW,dW,dF,dW,dW,dW],
  [dW,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dW],
  [dW,dF,dW,dW,dW,dW,dF,dW,dW,dW,dW,dW,dF,dW,dW,dW,dW,dW,dF,dW],
  [dW,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dW],
  [dW,dF,dW,dW,dW,dF,dW,dW,dW,dF,dF,dW,dW,dW,dF,dW,dW,dW,dF,dW],
  [dW,dS,dF,dF,dF,dF,dF,dF,dF,dF,dB,dF,dF,dF,dF,dF,dF,dF,dF,dW],
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

VOLCANIC_FORGE_INTERIOR[1][1] = dS;

// prettier-ignore
const VOLCANIC_FORGE_LEVEL2: Terrain[][] = [
  [dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW],
  [dW,dF,dF,dF,dF,dF,dW,dF,dF,dF,dF,dF,dW,dF,dF,dF,dF,dF,dF,dW],
  [dW,dF,dW,dW,dW,dF,dW,dF,dW,dW,dW,dF,dW,dF,dW,dW,dW,dW,dF,dW],
  [dW,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dW],
  [dW,dW,dW,dF,dW,dW,dW,dW,dF,dW,dW,dW,dW,dW,dF,dW,dW,dW,dW,dW],
  [dW,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dW],
  [dW,dF,dW,dW,dW,dF,dW,dW,dW,dW,dW,dW,dW,dF,dW,dW,dW,dW,dF,dW],
  [dW,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dW],
  [dW,dW,dF,dW,dW,dW,dF,dW,dW,dF,dW,dW,dW,dF,dW,dW,dF,dW,dW,dW],
  [dW,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dW],
  [dW,dF,dW,dW,dW,dF,dW,dW,dW,dW,dW,dW,dF,dW,dW,dW,dF,dW,dW,dW],
  [dW,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dF,dW],
  [dW,dF,dW,dW,dW,dF,dW,dW,dF,dF,dF,dF,dW,dW,dF,dW,dW,dW,dF,dW],
  [dW,dS,dF,dF,dF,dF,dF,dF,dF,dF,dB,dF,dF,dF,dF,dF,dF,dF,dF,dW],
  [dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW,dW],
];

export const DUNGEONS: DungeonData[] = [
  {
    id: "heartlands_dungeon", name: "Heartlands Crypt",
    entranceChunkX: 4, entranceChunkY: 2, entranceTileX: 16, entranceTileY: 2,
    mapData: HEARTLANDS_CRYPT_INTERIOR, spawnX: 1, spawnY: 13,
    bossId: "cryptLich",
    levels: [{ mapData: HEARTLANDS_CRYPT_LEVEL2, spawnX: 1, spawnY: 13 }],
  },
  {
    id: "frost_cavern", name: "Frost Cavern",
    entranceChunkX: 2, entranceChunkY: 0, entranceTileX: 14, entranceTileY: 5,
    mapData: FROST_CAVERN_INTERIOR, spawnX: 1, spawnY: 13,
    bossId: "frostWarden",
    levels: [{ mapData: FROST_CAVERN_LEVEL2, spawnX: 1, spawnY: 13 }],
  },
  {
    id: "volcanic_forge", name: "Volcanic Forge",
    entranceChunkX: 6, entranceChunkY: 5, entranceTileX: 14, entranceTileY: 5,
    mapData: VOLCANIC_FORGE_INTERIOR, spawnX: 1, spawnY: 13,
    bossId: "infernoForgemaster",
    levels: [{ mapData: VOLCANIC_FORGE_LEVEL2, spawnX: 1, spawnY: 13 }],
  },
];
