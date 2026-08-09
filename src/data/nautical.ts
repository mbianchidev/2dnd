import {
  MAP_HEIGHT,
  MAP_WIDTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./mapTypes";
import type { QuestId } from "./quests";

export type CardinalHeading = "north" | "east" | "south" | "west";
export type SeaDepth = "shallow" | "deep";
export type RouteSafety = "guarded" | "standard" | "dangerous";

export interface ChunkCoordinate {
  chunkX: number;
  chunkY: number;
}

export interface NauticalCoordinate extends ChunkCoordinate {
  tileX: number;
  tileY: number;
}

export interface ContinentDefinition {
  id: string;
  name: string;
  chunks: readonly ChunkCoordinate[];
}

export interface SeaZoneDefinition {
  id: string;
  name: string;
  encounterMultiplier: number;
  hazardMultiplier: number;
  depths: readonly SeaDepth[];
}

export interface SeaLocation {
  zoneId: SeaZoneId;
  depth: SeaDepth;
}

export interface IslandDefinition {
  id: string;
  name: string;
  location: NauticalCoordinate;
  seaZoneId: SeaZoneId;
  continentId: ContinentId;
}

export interface PortDefinition {
  id: string;
  name: string;
  cityId: string;
  location: NauticalCoordinate;
  seaZoneId: SeaZoneId;
  continentId?: ContinentId;
  islandId?: IslandId;
}

export interface MerchantRouteQuestGate {
  questId: QuestId;
  requiresCompletion: true;
}

export interface MerchantRouteDefinition {
  id: string;
  name: string;
  portIds: readonly [PortId, PortId];
  fee: number;
  safety: RouteSafety;
  distance: number;
  questGate?: MerchantRouteQuestGate;
}

export interface BoatDefinition {
  id: string;
  name: string;
  price: number;
  baseCondition: number;
  deepWaterCapable: boolean;
  encounterMultiplier: number;
  hazardResistance: number;
  allowedUpgradeIds: readonly BoatUpgradeId[];
}

export interface BoatUpgradeDefinition {
  id: string;
  name: string;
  encounterMultiplier: number;
  hazardResistance: number;
  conditionLossMultiplier: number;
}

export interface BoatCosmeticDefinition {
  id: string;
  name: string;
}

function rectangularChunks(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): readonly ChunkCoordinate[] {
  const chunks: ChunkCoordinate[] = [];
  for (let chunkY = minY; chunkY <= maxY; chunkY += 1) {
    for (let chunkX = minX; chunkX <= maxX; chunkX += 1) {
      chunks.push({ chunkX, chunkY });
    }
  }
  return chunks;
}

export const CONTINENTS = [
  {
    id: "frostcrown",
    name: "Frostcrown",
    chunks: rectangularChunks(0, 9, 0, 1),
  },
  {
    id: "verdantCovenant",
    name: "Verdant Covenant",
    chunks: rectangularChunks(0, 4, 2, 5),
  },
  {
    id: "emberMarch",
    name: "Ember March",
    chunks: rectangularChunks(5, 9, 2, 5),
  },
  {
    id: "southreach",
    name: "Southreach",
    chunks: rectangularChunks(0, 9, 6, 8),
  },
] as const satisfies readonly ContinentDefinition[];

export type ContinentId = (typeof CONTINENTS)[number]["id"];

export const SEA_ZONES = [
  {
    id: "frostwakeSea",
    name: "Frostwake Sea",
    encounterMultiplier: 1.1,
    hazardMultiplier: 1.2,
    depths: ["shallow", "deep"],
  },
  {
    id: "westwindSea",
    name: "Westwind Sea",
    encounterMultiplier: 0.9,
    hazardMultiplier: 0.9,
    depths: ["shallow", "deep"],
  },
  {
    id: "covenantStrait",
    name: "Covenant Strait",
    encounterMultiplier: 0.8,
    hazardMultiplier: 0.75,
    depths: ["shallow"],
  },
  {
    id: "emberwakeSea",
    name: "Emberwake Sea",
    encounterMultiplier: 1.2,
    hazardMultiplier: 1.25,
    depths: ["shallow", "deep"],
  },
  {
    id: "southreachDeep",
    name: "Southreach Deep",
    encounterMultiplier: 1.3,
    hazardMultiplier: 1.35,
    depths: ["shallow", "deep"],
  },
] as const satisfies readonly SeaZoneDefinition[];

export type SeaZoneId = (typeof SEA_ZONES)[number]["id"];

export const ISLANDS = [
  {
    id: "tideglassIsle",
    name: "Tideglass Isle",
    location: { chunkX: 4, chunkY: 2, tileX: 6, tileY: 1 },
    seaZoneId: "covenantStrait",
    continentId: "verdantCovenant",
  },
  {
    id: "emberwakeCay",
    name: "Emberwake Cay",
    location: { chunkX: 5, chunkY: 2, tileX: 5, tileY: 3 },
    seaZoneId: "covenantStrait",
    continentId: "emberMarch",
  },
  {
    id: "starfallAtoll",
    name: "Starfall Atoll",
    location: { chunkX: 4, chunkY: 2, tileX: 12, tileY: 1 },
    seaZoneId: "covenantStrait",
    continentId: "verdantCovenant",
  },
  {
    id: "mistcoilIsle",
    name: "Mistcoil Isle",
    location: { chunkX: 5, chunkY: 2, tileX: 15, tileY: 3 },
    seaZoneId: "covenantStrait",
    continentId: "emberMarch",
  },
] as const satisfies readonly IslandDefinition[];

export type IslandId = (typeof ISLANDS)[number]["id"];

export const PORTS = [
  {
    id: "willowdalePort",
    name: "Willowdale River Quay",
    cityId: "willowdale_city",
    location: { chunkX: 4, chunkY: 2, tileX: 2, tileY: 2 },
    seaZoneId: "covenantStrait",
    continentId: "verdantCovenant",
  },
  {
    id: "sandportHarbor",
    name: "Sandport Harbor",
    cityId: "sandport_city",
    location: { chunkX: 5, chunkY: 2, tileX: 12, tileY: 6 },
    seaZoneId: "covenantStrait",
    continentId: "emberMarch",
  },
  {
    id: "frostheimPort",
    name: "Frostheim Icewharf",
    cityId: "frostheim_city",
    location: { chunkX: 1, chunkY: 0, tileX: 10, tileY: 7 },
    seaZoneId: "frostwakeSea",
    continentId: "frostcrown",
  },
  {
    id: "ridgewatchPort",
    name: "Ridgewatch Cliffport",
    cityId: "ridgewatch_city",
    location: { chunkX: 9, chunkY: 6, tileX: 10, tileY: 7 },
    seaZoneId: "emberwakeSea",
    continentId: "southreach",
  },
  {
    id: "tidehavenPort",
    name: "Tidehaven Free Port",
    cityId: "tidehaven_city",
    location: { chunkX: 4, chunkY: 2, tileX: 6, tileY: 0 },
    seaZoneId: "covenantStrait",
    islandId: "tideglassIsle",
  },
] as const satisfies readonly PortDefinition[];

export type PortId = (typeof PORTS)[number]["id"];

export const MERCHANT_ROUTES = [
  {
    id: "willowdaleSandportRun",
    name: "Covenant Grain Run",
    portIds: ["willowdalePort", "sandportHarbor"],
    fee: 45,
    safety: "guarded",
    distance: 8,
  },
  {
    id: "sandportTidehavenRun",
    name: "Tideglass Exchange",
    portIds: ["sandportHarbor", "tidehavenPort"],
    fee: 70,
    safety: "standard",
    distance: 12,
  },
  {
    id: "tidehavenFrostheimRun",
    name: "Silk and Ice Passage",
    portIds: ["tidehavenPort", "frostheimPort"],
    fee: 135,
    safety: "dangerous",
    distance: 28,
    questGate: {
      questId: "silkAgainstTheCold",
      requiresCompletion: true,
    },
  },
  {
    id: "frostheimRidgewatchRun",
    name: "Crown-to-Cliff Convoy",
    portIds: ["frostheimPort", "ridgewatchPort"],
    fee: 160,
    safety: "dangerous",
    distance: 34,
  },
  {
    id: "ridgewatchSandportRun",
    name: "Ember Coast Circuit",
    portIds: ["ridgewatchPort", "sandportHarbor"],
    fee: 110,
    safety: "standard",
    distance: 22,
    questGate: {
      questId: "ironboundDispatch",
      requiresCompletion: true,
    },
  },
] as const satisfies readonly MerchantRouteDefinition[];

export type MerchantRouteId = (typeof MERCHANT_ROUTES)[number]["id"];

export const BOAT_UPGRADES = [
  {
    id: "reinforcedHull",
    name: "Reinforced Hull",
    encounterMultiplier: 1,
    hazardResistance: 2,
    conditionLossMultiplier: 0.7,
  },
  {
    id: "stormSails",
    name: "Storm Sails",
    encounterMultiplier: 0.95,
    hazardResistance: 2,
    conditionLossMultiplier: 0.85,
  },
  {
    id: "navigatorCharts",
    name: "Navigator Charts",
    encounterMultiplier: 0.8,
    hazardResistance: 1,
    conditionLossMultiplier: 1,
  },
  {
    id: "quietRigging",
    name: "Quiet Rigging",
    encounterMultiplier: 0.85,
    hazardResistance: 0,
    conditionLossMultiplier: 1,
  },
] as const;

export type BoatUpgradeId = (typeof BOAT_UPGRADES)[number]["id"];

export const BOAT_COSMETICS = [
  { id: "naturalTimber", name: "Natural Timber" },
  { id: "covenantBlue", name: "Covenant Blue" },
  { id: "emberRed", name: "Ember Red" },
  { id: "frostSilver", name: "Frost Silver" },
] as const satisfies readonly BoatCosmeticDefinition[];

export type BoatCosmeticId = (typeof BOAT_COSMETICS)[number]["id"];

const ALL_UPGRADES = BOAT_UPGRADES.map((upgrade) => upgrade.id);

export const BOATS = [
  {
    id: "reedSkiff",
    name: "Reed Skiff",
    price: 250,
    baseCondition: 80,
    deepWaterCapable: false,
    encounterMultiplier: 1.1,
    hazardResistance: 0,
    allowedUpgradeIds: ["navigatorCharts", "quietRigging"],
  },
  {
    id: "merchantSloop",
    name: "Merchant Sloop",
    price: 900,
    baseCondition: 90,
    deepWaterCapable: true,
    encounterMultiplier: 1,
    hazardResistance: 1,
    allowedUpgradeIds: ALL_UPGRADES,
  },
  {
    id: "stormcutter",
    name: "Stormcutter",
    price: 1_800,
    baseCondition: 100,
    deepWaterCapable: true,
    encounterMultiplier: 0.85,
    hazardResistance: 3,
    allowedUpgradeIds: ALL_UPGRADES,
  },
] as const satisfies readonly BoatDefinition[];

export type BoatId = (typeof BOATS)[number]["id"];

export const SEA_DAY_MONSTERS = [
  "reefSlime",
  "razorfin",
  "seaSerpent",
  "coralCrab",
] as const;

export const SEA_NIGHT_MONSTERS = [
  "moonJelly",
  "drownedSailor",
  "abyssalEel",
  "nightSerpent",
] as const;

export type SeaMonsterId =
  | (typeof SEA_DAY_MONSTERS)[number]
  | (typeof SEA_NIGHT_MONSTERS)[number];

function isKnownId<T extends string>(
  value: unknown,
  definitions: readonly { id: T }[],
): value is T {
  return typeof value === "string"
    && definitions.some((definition) => definition.id === value);
}

export function isContinentId(value: unknown): value is ContinentId {
  return isKnownId(value, CONTINENTS);
}

export function isSeaZoneId(value: unknown): value is SeaZoneId {
  return isKnownId(value, SEA_ZONES);
}

export function isIslandId(value: unknown): value is IslandId {
  return isKnownId(value, ISLANDS);
}

export function isPortId(value: unknown): value is PortId {
  return isKnownId(value, PORTS);
}

export function isMerchantRouteId(value: unknown): value is MerchantRouteId {
  return isKnownId(value, MERCHANT_ROUTES);
}

export function isBoatId(value: unknown): value is BoatId {
  return isKnownId(value, BOATS);
}

export function isBoatUpgradeId(value: unknown): value is BoatUpgradeId {
  return isKnownId(value, BOAT_UPGRADES);
}

export function isBoatCosmeticId(value: unknown): value is BoatCosmeticId {
  return isKnownId(value, BOAT_COSMETICS);
}

export function isSeaMonsterId(value: unknown): value is SeaMonsterId {
  return typeof value === "string"
    && (
      (SEA_DAY_MONSTERS as readonly string[]).includes(value)
      || (SEA_NIGHT_MONSTERS as readonly string[]).includes(value)
    );
}

export function getContinent(id: ContinentId): ContinentDefinition {
  return CONTINENTS.find((continent) => continent.id === id) as ContinentDefinition;
}

export function getSeaZone(id: SeaZoneId): SeaZoneDefinition {
  return SEA_ZONES.find((zone) => zone.id === id) as SeaZoneDefinition;
}

export function getIsland(id: IslandId): IslandDefinition {
  return ISLANDS.find((island) => island.id === id) as IslandDefinition;
}

export function getPort(id: PortId): PortDefinition {
  return PORTS.find((port) => port.id === id) as PortDefinition;
}

export function getMerchantRoute(
  id: MerchantRouteId,
): MerchantRouteDefinition {
  return MERCHANT_ROUTES.find(
    (route) => route.id === id,
  ) as MerchantRouteDefinition;
}

export function getBoat(id: BoatId): BoatDefinition {
  return BOATS.find((boat) => boat.id === id) as BoatDefinition;
}

export function getBoatUpgrade(
  id: BoatUpgradeId,
): BoatUpgradeDefinition {
  return BOAT_UPGRADES.find(
    (upgrade) => upgrade.id === id,
  ) as BoatUpgradeDefinition;
}

export function getContinentAt(
  chunkX: number,
  chunkY: number,
): ContinentDefinition | undefined {
  if (
    !Number.isInteger(chunkX)
    || !Number.isInteger(chunkY)
    || chunkX < 0
    || chunkX >= WORLD_WIDTH
    || chunkY < 0
    || chunkY >= WORLD_HEIGHT
  ) {
    return undefined;
  }
  return CONTINENTS.find((continent) => continent.chunks.some(
    (chunk) => chunk.chunkX === chunkX && chunk.chunkY === chunkY,
  ));
}

export function getSeaZoneAt(
  chunkX: number,
  chunkY: number,
  tileX: number,
  tileY: number,
): SeaLocation | undefined {
  if (
    !Number.isInteger(chunkX)
    || !Number.isInteger(chunkY)
    || !Number.isInteger(tileX)
    || !Number.isInteger(tileY)
    || chunkX < 0
    || chunkX >= WORLD_WIDTH
    || chunkY < 0
    || chunkY >= WORLD_HEIGHT
    || tileX < 0
    || tileX >= MAP_WIDTH
    || tileY < 0
    || tileY >= MAP_HEIGHT
  ) {
    return undefined;
  }

  const worldX = chunkX * MAP_WIDTH + tileX;
  const worldY = chunkY * MAP_HEIGHT + tileY;
  if (worldY < 30) {
    return {
      zoneId: "frostwakeSea",
      depth: worldY < 20 ? "shallow" : "deep",
    };
  }
  if (worldY >= 105 && worldX >= 60 && worldX < 140) {
    return {
      zoneId: "southreachDeep",
      depth: worldY < 120 ? "shallow" : "deep",
    };
  }
  if (worldX < 60) {
    return {
      zoneId: "westwindSea",
      depth: worldX < 24 ? "shallow" : "deep",
    };
  }
  if (worldX >= 140) {
    return {
      zoneId: "emberwakeSea",
      depth: worldX < 175 ? "shallow" : "deep",
    };
  }
  return { zoneId: "covenantStrait", depth: "shallow" };
}

export function isIslandLandmarkAt(
  chunkX: number,
  chunkY: number,
  tileX: number,
  tileY: number,
): boolean {
  return (
    chunkX === 4
    && chunkY === 2
    && tileY === 1
    && (tileX === 6 || tileX === 7)
  );
}
