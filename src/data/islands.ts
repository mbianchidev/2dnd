import { Terrain } from "./mapTypes";
import type { CityData, DungeonData } from "./mapTypes";

const W = Terrain.CityWall;
const F = Terrain.CityFloor;
const P = Terrain.CityPath;
const E = Terrain.CityExit;
const D = Terrain.Dungeon;
const S = Terrain.ShopFloor;
const G = Terrain.CityGate;

function createTidehavenMap(): Terrain[][] {
  return Array.from({ length: 15 }, (_, y) =>
    Array.from({ length: 20 }, (_, x) => {
      if (x === 10 && y === 14) return E;
      if (x === 10 && y === 1) return G;
      if (x === 0 || x === 19 || y === 0 || y === 14) return W;
      if (x === 10 && y === 2) return D;
      if (x === 10 || y === 7) return P;
      if (
        (x >= 2 && x <= 5 && y >= 3 && y <= 5)
        || (x >= 14 && x <= 17 && y >= 3 && y <= 5)
        || (x >= 2 && x <= 5 && y >= 9 && y <= 11)
        || (x >= 14 && x <= 17 && y >= 9 && y <= 11)
      ) {
        return S;
      }
      return F;
    }));
}

function createHarborQuarterMap(): Terrain[][] {
  return Array.from({ length: 15 }, (_, y) =>
    Array.from({ length: 20 }, (_, x) => {
      if (x === 10 && y === 13) return G;
      if (x === 0 || x === 19 || y === 0 || y === 14) return W;
      if (x === 10 || y === 7) return P;
      if (
        (x >= 2 && x <= 6 && y >= 3 && y <= 5)
        || (x >= 13 && x <= 17 && y >= 3 && y <= 5)
      ) {
        return S;
      }
      return F;
    }));
}

const DW = Terrain.DungeonWall;
const DF = Terrain.DungeonFloor;
const DE = Terrain.DungeonExit;
const DS = Terrain.DungeonStairs;
const DB = Terrain.DungeonBoss;
const C = Terrain.Chest;

function createGrottoLevel(
  exit: boolean,
  boss: boolean,
): Terrain[][] {
  return Array.from({ length: 15 }, (_, y) =>
    Array.from({ length: 20 }, (_, x) => {
      if (x === 0 || x === 19 || y === 0 || y === 14) return DW;
      if (exit && x === 1 && y === 13) return DE;
      if (x === 1 && y === (boss ? 13 : 1)) return DS;
      if (boss && x === 10 && y === 7) return DB;
      if (!boss && x === 17 && y === 2) return C;
      if (boss && x === 2 && y === 2) return C;
      if ((x === 5 || x === 14) && y > 2 && y < 12) return DW;
      return DF;
    }));
}

export const TIDEHAVEN_CITY: CityData = {
  id: "tidehaven_city",
  name: "Tidehaven",
  chunkX: 4,
  chunkY: 2,
  tileX: 6,
  tileY: 1,
  mapData: createTidehavenMap(),
  spawnX: 10,
  spawnY: 13,
  shops: [
    {
      type: "general",
      name: "Blueglass Chandlery",
      x: 3,
      y: 4,
      shopItems: [
        "potion",
        "ether",
        "navigationSupplies",
        "saltfin",
        "oceanPearl",
      ],
    },
    {
      type: "weapon",
      name: "Harpoon & Hook",
      x: 16,
      y: 4,
      shopItems: ["longSword", "canyonBow"],
    },
    {
      type: "inn",
      name: "The Lantern Wake",
      x: 3,
      y: 10,
      shopItems: [],
    },
    {
      type: "general",
      name: "Tidehaven Shipwright",
      x: 16,
      y: 10,
      shopItems: ["reinforcedHullKit"],
    },
  ],
  chunks: [{
    name: "Harbor Quarter",
    mapData: createHarborQuarterMap(),
    spawnX: 10,
    spawnY: 12,
    shops: [
      {
        type: "general",
        name: "Convoy Exchange",
        x: 4,
        y: 4,
        shopItems: ["navigationSupplies", "saltfin", "oceanPearl"],
      },
      {
        type: "inn",
        name: "Harbor Watchhouse",
        x: 15,
        y: 4,
        shopItems: [],
      },
    ],
  }],
  connections: [
    {
      fromChunkIndex: 0,
      fromX: 10,
      fromY: 1,
      toChunkIndex: 1,
      toX: 10,
      toY: 13,
    },
    {
      fromChunkIndex: 1,
      fromX: 10,
      fromY: 13,
      toChunkIndex: 0,
      toX: 10,
      toY: 1,
    },
  ],
};

export const TIDEGLASS_GROTTO: DungeonData = {
  id: "tideglass_grotto",
  name: "Tideglass Grotto",
  entranceChunkX: 4,
  entranceChunkY: 2,
  entranceTileX: 7,
  entranceTileY: 1,
  mapData: createGrottoLevel(true, false),
  spawnX: 1,
  spawnY: 13,
  levels: [{
    mapData: createGrottoLevel(false, true),
    spawnX: 1,
    spawnY: 13,
  }],
  bossId: "kraken",
  connections: [
    {
      fromLevel: 0,
      fromX: 1,
      fromY: 1,
      toLevel: 1,
      toX: 1,
      toY: 13,
    },
    {
      fromLevel: 1,
      fromX: 1,
      fromY: 13,
      toLevel: 0,
      toX: 1,
      toY: 1,
    },
  ],
  trapProfile: {
    types: ["spikePit", "poisonDarts", "alarm", "hiddenFloor", "frostBurst"],
    thematicType: "frostBurst",
    trapsPerLevel: 4,
    difficultyModifier: 2,
  },
};
