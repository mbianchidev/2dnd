/**
 * City interior map data and definitions.
 * Extracted from map.ts for better code organization.
 */

import { Terrain } from "./mapTypes";
import type { CityData, CityShopData, CityChunk } from "./mapTypes";

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
const cG = Terrain.CityGate;

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

// ─── City Districts (extra chunks for multi-chunk cities) ────────

// ── Willowdale Riverside — Peaceful riverside district with gardens ──
// prettier-ignore
const WILLOWDALE_RIVERSIDE: Terrain[][] = [
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cG,cW,cW,cW,cW,cW,cW,cW,cW,cW],
  [cW,cF,cF,cF,cF,cF,rV,rV,cF,cF,cF,cF,rV,rV,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,rV,rV,cF,fT,fT,cF,rV,rV,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,fT,fT,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,sF,sF,sF,cW,cF,pa,pa,pa,pa,pa,pa,cF,cW,sF,sF,sF,cW,cW],
  [cW,cW,sF,sF,sF,cW,cF,cF,cF,wL,pa,cF,cF,cF,cW,sF,sF,sF,cW,cW],
  [cW,cF,cF,cP,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cP,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,bR,cF,cF,pa,cF,bR,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,sT,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW],
];

// ── Ironhold Foundry — Industrial forge district with smelters ──
// prettier-ignore
const IRONHOLD_FOUNDRY: Terrain[][] = [
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cG,cW,cW,cW,cW,cW,cW,cW,cW,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cW,sF,sF,sF,cW,cF,cF,sT,cF,cF,cF,cW,sF,sF,sF,cW,cF,cW],
  [cW,cF,cW,sF,sF,sF,cW,cF,cF,cF,cF,cF,cF,cW,sF,sF,sF,cW,cF,cW],
  [cW,cF,cF,cF,cP,cF,cF,pa,pa,pa,pa,pa,pa,cF,cF,cP,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,bR,cF,pa,cF,bR,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,kR,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,kR,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,wL,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,bR,cF,cF,cF,cF,pa,cF,cF,cF,bR,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW],
];

// ── Sandport Docks — Bustling port district with warehouses ──
// prettier-ignore
const SANDPORT_DOCKS: Terrain[][] = [
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cG,cW,cW,cW,cW,cW,cW,cW,cW,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,bR,sF,sF,sF,bR,cF,cF,cF,sT,cF,cF,cF,cF,bR,sF,sF,sF,bR,cW],
  [cW,sF,sF,sF,sF,sF,cF,cF,cF,cF,cF,cF,cF,cF,sF,sF,sF,sF,sF,cW],
  [cW,cF,cF,cP,cF,cF,pa,pa,pa,pa,pa,pa,pa,pa,cF,cF,cP,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,bR,cF,cF,pa,cF,bR,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,wL,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,kR,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,kR,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,bR,cF,bR,cF,cF,pa,cF,bR,cF,bR,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW],
];

// ── Frostheim Ice Cellars — Underground frost storage and brewery ──
// prettier-ignore
const FROSTHEIM_CELLARS: Terrain[][] = [
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cG,cW,cW,cW,cW,cW,cW,cW,cW,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cW,sF,sF,sF,cW,cF,cF,cF,cF,cF,cF,cW,sF,sF,sF,cW,cF,cW],
  [cW,cF,cW,sF,sF,sF,cW,cF,cF,cF,cF,cF,cF,cW,sF,sF,sF,cW,cF,cW],
  [cW,cF,cF,cF,cP,cF,cF,pa,pa,pa,pa,pa,pa,cF,cF,cP,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,fT,fT,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,sT,cF,cF,cF,fT,fT,cF,cF,cF,sT,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,bR,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,bR,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,wL,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW],
];

// ── Deeproot Grove — Sacred forest clearing with ancient shrine ──
// prettier-ignore
const DEEPROOT_GROVE: Terrain[][] = [
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cG,cW,cW,cW,cW,cW,cW,cW,cW,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,tP,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,pa,pa,pa,pa,pa,pa,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,sF,sF,sF,cW,cF,cF,cF,cF,pa,cF,cF,cF,cW,sF,sF,sF,cW,cW],
  [cW,cW,sF,sF,sF,cW,cF,cF,cF,fT,fT,cF,cF,cF,cW,sF,sF,sF,cW,cW],
  [cW,cF,cF,cP,cF,cF,cF,cF,cF,fT,fT,cF,cF,cF,cF,cF,cP,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,bR,cF,cF,pa,cF,bR,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,kR,cF,cF,cF,cF,cF,cF,wL,pa,cF,cF,cF,cF,cF,kR,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW],
];

// ── Canyonwatch Outlook — Cliff-top watchtower and training grounds ──
// prettier-ignore
const CANYONWATCH_OUTLOOK: Terrain[][] = [
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cG,cW,cW,cW,cW,cW,cW,cW,cW,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,sT,cF,sT,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cW,sF,sF,sF,cW,pa,pa,pa,pa,pa,pa,pa,cW,sF,sF,sF,cW,cW],
  [cW,cF,cW,sF,sF,sF,cW,cF,cF,cF,pa,cF,cF,cF,cW,sF,sF,sF,cW,cW],
  [cW,cF,cF,cF,cP,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cP,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,wL,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,fN,fN,cF,cF,cF,pa,cF,cF,fN,fN,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,bR,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,bR,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW],
];

// ── Bogtown Stilts — Raised swamp quarter with herb gardens ──
// prettier-ignore
const BOGTOWN_STILTS: Terrain[][] = [
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cG,cW,cW,cW,cW,cW,cW,cW,cW,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,sF,sF,sF,cW,cF,cF,cF,sT,cF,cF,cF,cF,cW,sF,sF,sF,cW,cW],
  [cW,cW,sF,sF,sF,cW,cF,cF,cF,cF,cF,cF,cF,cF,cW,sF,sF,sF,cW,cW],
  [cW,cF,cF,cP,cF,cF,pa,pa,pa,pa,pa,pa,pa,pa,cF,cF,cP,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,kR,cF,cF,wL,pa,cF,cF,kR,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,bR,cF,cF,pa,cF,bR,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW],
];

// ── Thornvale Orchard — Walled farmland with crop fields and well ──
// prettier-ignore
const THORNVALE_ORCHARD: Terrain[][] = [
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cG,cW,cW,cW,cW,cW,cW,cW,cW,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,fN,cR,cR,cR,fN,cF,cF,cF,cF,cF,cF,fN,cR,cR,cR,fN,cF,cW],
  [cW,cF,fN,cR,cR,cR,fN,pa,pa,pa,pa,pa,pa,fN,cR,cR,cR,fN,cF,cW],
  [cW,cW,sF,sF,sF,cW,cF,cF,cF,cF,pa,cF,cF,cF,cW,sF,sF,sF,cW,cW],
  [cW,cW,sF,sF,sF,cW,cF,cF,cF,wL,pa,cF,cF,cF,cW,sF,sF,sF,cW,cW],
  [cW,cF,cF,cP,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cP,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,fT,fT,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,bR,cF,fT,fT,cF,bR,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW],
];

// ── Ashfall Crucible — Volcanic forge district with obsidian shrine ──
// prettier-ignore
const ASHFALL_CRUCIBLE: Terrain[][] = [
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cG,cW,cW,cW,cW,cW,cW,cW,cW,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,tP,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,sF,sF,sF,cW,cF,pa,pa,pa,pa,pa,pa,cF,cW,sF,sF,sF,cW,cW],
  [cW,cW,sF,sF,sF,cW,cF,cF,cF,cF,pa,cF,cF,cF,cW,sF,sF,sF,cW,cW],
  [cW,cF,cF,cP,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cP,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,fT,fT,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,bR,cF,fT,fT,cF,bR,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,kR,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,kR,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,wL,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW],
];

// ── Dunerest Oasis — Water garden sanctuary with merchant tents ──
// prettier-ignore
const DUNEREST_OASIS: Terrain[][] = [
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cG,cW,cW,cW,cW,cW,cW,cW,cW,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,bR,sF,sF,sF,bR,cF,cF,cF,fT,fT,cF,cF,cF,bR,sF,sF,sF,bR,cW],
  [cW,sF,sF,sF,sF,sF,cF,cF,cF,fT,fT,cF,cF,cF,sF,sF,sF,sF,sF,cW],
  [cW,cF,cF,cP,cF,cF,pa,pa,pa,pa,pa,pa,pa,pa,cF,cF,cP,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,sT,cF,cF,cF,cF,pa,cF,cF,cF,sT,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,wL,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,bR,cF,cF,pa,cF,bR,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW],
];

// ── Ridgewatch Garrison — Military barracks and armory ──
// prettier-ignore
const RIDGEWATCH_GARRISON: Terrain[][] = [
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cG,cW,cW,cW,cW,cW,cW,cW,cW,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,sT,cF,sT,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cW,sF,sF,sF,cW,pa,pa,pa,pa,pa,pa,pa,cW,sF,sF,sF,cW,cW],
  [cW,cF,cW,sF,sF,sF,cW,cF,cF,cF,pa,cF,cF,cF,cW,sF,sF,sF,cW,cW],
  [cW,cF,cF,cF,cP,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cP,cF,cF,cW],
  [cW,cF,cF,cF,cF,fN,fN,cF,cF,wL,pa,cF,cF,fN,fN,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,bR,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,bR,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW],
];

// ── Shadowfen Hollow — Misty swamp shrine with mysterious offerings ──
// prettier-ignore
const SHADOWFEN_HOLLOW: Terrain[][] = [
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cG,cW,cW,cW,cW,cW,cW,cW,cW,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cW,sF,sF,sF,cW,cF,tP,cF,cF,cW,sF,sF,sF,cW,cF,cF,cW],
  [cW,cF,cF,cW,sF,sF,sF,cW,cF,cF,cF,cF,cW,sF,sF,sF,cW,cF,cF,cW],
  [cW,cF,cF,cF,cF,cP,cF,cF,pa,pa,pa,pa,cF,cF,cP,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,sT,cF,cF,cF,wL,pa,cF,cF,cF,sT,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,bR,cF,cF,pa,cF,bR,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,pa,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cF,cW],
  [cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW,cW],
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
      { type: "stable", name: "Willowdale Stables", x: 10, y: 5, shopItems: ["mountDonkey", "mountHorse"] },
    ],
    chunks: [{
      name: "Riverside", mapData: WILLOWDALE_RIVERSIDE, spawnX: 10, spawnY: 1,
      shops: [
        { type: "general", name: "River Market", x: 3, y: 6, shopItems: ["potion", "ether"] },
        { type: "magic", name: "Willow Apothecary", x: 16, y: 6, shopItems: ["potion", "ether", "greaterPotion"] },
      ],
    }],
  },
  {
    id: "ironhold_city", name: "Ironhold", chunkX: 3, chunkY: 2, tileX: 5, tileY: 7,
    mapData: IRONHOLD_INTERIOR, spawnX: 10, spawnY: 13,
    shops: [
      { type: "weapon", name: "The Iron Anvil", x: 3, y: 2, shopItems: ["longSword", "greatSword"] },
      { type: "armor", name: "Fortress Armory", x: 16, y: 2, shopItems: ["chainMail", "plateArmor", "ironShield", "towerShield"] },
      { type: "general", name: "Ironhold Supply", x: 7, y: 5, shopItems: ["potion", "ether", "greaterPotion", "chimaeraWing"] },
      { type: "inn", name: "Anvil Rest", x: 12, y: 5, shopItems: [] },
      { type: "stable", name: "Ironhold Stables", x: 10, y: 10, shopItems: ["mountHorse", "mountWarHorse"] },
    ],
    chunks: [{
      name: "Foundry", mapData: IRONHOLD_FOUNDRY, spawnX: 10, spawnY: 1,
      shops: [
        { type: "weapon", name: "Master Forge", x: 4, y: 4, shopItems: ["greatSword", "longSword"] },
        { type: "armor", name: "Smelter Armory", x: 15, y: 4, shopItems: ["plateArmor", "towerShield"] },
      ],
    }],
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
      { type: "stable", name: "Sandport Stables", x: 10, y: 8, shopItems: ["mountDonkey", "mountHorse", "mountWarHorse"] },
    ],
    chunks: [{
      name: "Docks", mapData: SANDPORT_DOCKS, spawnX: 10, spawnY: 1,
      shops: [
        { type: "general", name: "Dockside Goods", x: 3, y: 4, shopItems: ["potion", "ether", "chimaeraWing"] },
        { type: "weapon", name: "Sailor's Arms", x: 16, y: 4, shopItems: ["shortSword", "longSword"] },
      ],
    }],
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
    chunks: [{
      name: "Ice Cellars", mapData: FROSTHEIM_CELLARS, spawnX: 10, spawnY: 1,
      shops: [
        { type: "general", name: "Cellar Stores", x: 4, y: 4, shopItems: ["potion", "greaterPotion"] },
        { type: "magic", name: "Frost Brewery", x: 15, y: 4, shopItems: ["ether", "greaterPotion"] },
      ],
    }],
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
    chunks: [{
      name: "Sacred Grove", mapData: DEEPROOT_GROVE, spawnX: 10, spawnY: 1,
      shops: [
        { type: "magic", name: "Grove Herbalist", x: 3, y: 6, shopItems: ["potion", "ether"] },
        { type: "general", name: "Forager's Cache", x: 16, y: 6, shopItems: ["potion", "ether"] },
      ],
    }],
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
    chunks: [{
      name: "Outlook", mapData: CANYONWATCH_OUTLOOK, spawnX: 10, spawnY: 1,
      shops: [
        { type: "weapon", name: "Watchtower Arms", x: 4, y: 5, shopItems: ["longSword", "greatSword"] },
        { type: "armor", name: "Lookout Outfitter", x: 16, y: 5, shopItems: ["chainMail", "ironShield"] },
      ],
    }],
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
    chunks: [{
      name: "Stilts Quarter", mapData: BOGTOWN_STILTS, spawnX: 10, spawnY: 1,
      shops: [
        { type: "magic", name: "Stilt Remedies", x: 3, y: 4, shopItems: ["potion", "ether", "greaterPotion"] },
        { type: "general", name: "Stilts Trader", x: 16, y: 4, shopItems: ["potion", "ether"] },
      ],
    }],
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
    chunks: [{
      name: "Orchard", mapData: THORNVALE_ORCHARD, spawnX: 10, spawnY: 1,
      shops: [
        { type: "general", name: "Orchard Goods", x: 3, y: 6, shopItems: ["potion", "ether"] },
        { type: "general", name: "Farmstead Supply", x: 16, y: 6, shopItems: ["potion", "greaterPotion"] },
      ],
    }],
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
    chunks: [{
      name: "Crucible", mapData: ASHFALL_CRUCIBLE, spawnX: 10, spawnY: 1,
      shops: [
        { type: "weapon", name: "Crucible Forge", x: 3, y: 5, shopItems: ["greatSword", "longSword"] },
        { type: "armor", name: "Obsidian Armory", x: 16, y: 5, shopItems: ["plateArmor", "towerShield"] },
      ],
    }],
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
    chunks: [{
      name: "Oasis Gardens", mapData: DUNEREST_OASIS, spawnX: 10, spawnY: 1,
      shops: [
        { type: "general", name: "Oasis Merchant", x: 3, y: 4, shopItems: ["potion", "greaterPotion", "chimaeraWing"] },
        { type: "magic", name: "Desert Sage", x: 16, y: 4, shopItems: ["ether", "greaterPotion"] },
      ],
    }],
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
    chunks: [{
      name: "Garrison", mapData: RIDGEWATCH_GARRISON, spawnX: 10, spawnY: 1,
      shops: [
        { type: "weapon", name: "Garrison Armory", x: 4, y: 5, shopItems: ["greatSword", "longSword"] },
        { type: "armor", name: "Guard Outfitter", x: 16, y: 5, shopItems: ["plateArmor", "ironShield"] },
      ],
    }],
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
    chunks: [{
      name: "Hollow", mapData: SHADOWFEN_HOLLOW, spawnX: 10, spawnY: 1,
      shops: [
        { type: "magic", name: "Hollow Apothecary", x: 5, y: 4, shopItems: ["potion", "ether", "greaterPotion"] },
        { type: "general", name: "Hollow Trader", x: 14, y: 4, shopItems: ["potion", "ether"] },
      ],
    }],
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

// ─── Multi-Chunk City Helpers ────────────────────────────────────

/** Get the total number of chunks in a city (primary + extra districts). */
export function getCityChunkCount(city: CityData): number {
  return 1 + (city.chunks?.length ?? 0);
}

/**
 * Get a specific city chunk by index.
 * Index 0 returns the primary chunk built from the city's top-level fields.
 * Index 1+ returns entries from the `chunks` array.
 */
export function getCityChunk(city: CityData, chunkIndex: number): CityChunk | undefined {
  if (chunkIndex === 0) {
    return {
      name: city.name,
      mapData: city.mapData,
      spawnX: city.spawnX,
      spawnY: city.spawnY,
      shops: city.shops,
    };
  }
  return city.chunks?.[chunkIndex - 1];
}

/**
 * Get the map data for a specific city chunk.
 * Falls back to the primary chunk if the index is out of range.
 */
export function getCityChunkMap(city: CityData, chunkIndex: number): Terrain[][] {
  const chunk = getCityChunk(city, chunkIndex);
  return chunk?.mapData ?? city.mapData;
}

/**
 * Get the spawn point for a specific city chunk.
 */
export function getCityChunkSpawn(city: CityData, chunkIndex: number): { x: number; y: number } {
  const chunk = getCityChunk(city, chunkIndex);
  return { x: chunk?.spawnX ?? city.spawnX, y: chunk?.spawnY ?? city.spawnY };
}

/**
 * Get shops in a specific city chunk.
 */
export function getCityChunkShops(city: CityData, chunkIndex: number): CityShopData[] {
  const chunk = getCityChunk(city, chunkIndex);
  return chunk?.shops ?? city.shops;
}

/**
 * Find a shop at a position within a specific city chunk.
 */
export function getCityChunkShopAt(city: CityData, chunkIndex: number, x: number, y: number): CityShopData | undefined {
  const shops = getCityChunkShops(city, chunkIndex);
  return shops.find((s) => s.x === x && s.y === y);
}

/**
 * Get all city chunk names for a city (used for city map display).
 */
export function getCityChunkNames(city: CityData): string[] {
  const names = [city.name];
  if (city.chunks) {
    for (const chunk of city.chunks) {
      names.push(chunk.name);
    }
  }
  return names;
}
