/**
 * Dungeon interior map data.
 * Extracted from map.ts for better code organization.
 */

import { Terrain } from "./mapTypes";
import type { DungeonData } from "./mapTypes";

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
