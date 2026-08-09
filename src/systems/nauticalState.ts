import {
  MERCHANT_ROUTES,
  PORTS,
  getBoat,
  getIsland,
  getMerchantRoute,
  getPort,
  getSeaZoneAt,
  isBoatCosmeticId,
  isBoatId,
  isBoatUpgradeId,
  isContinentId,
  isIslandId,
  isMerchantRouteId,
  isPortId,
  isSeaMonsterId,
  isSeaZoneId,
} from "../data/nautical";
import { MAP_HEIGHT, MAP_WIDTH, WORLD_HEIGHT, WORLD_WIDTH } from "../data/map";
import type {
  BoatCosmeticId,
  BoatId,
  BoatUpgradeId,
  CardinalHeading,
  ContinentId,
  IslandId,
  MerchantRouteId,
  PortId,
  RouteSafety,
  SeaDepth,
  SeaMonsterId,
  SeaZoneId,
} from "../data/nautical";
import type { SkillCheckAbility } from "../data/skillChecks";
import { WeatherType } from "./weather";

export const NAUTICAL_ID_HISTORY_LIMIT = 120;
export const NAUTICAL_SEA_TILE_LIMIT = 5_000;

export interface BoatState {
  id: BoatId;
  condition: number;
  upgradeIds: BoatUpgradeId[];
  cosmeticId: BoatCosmeticId;
}

export interface PendingMerchantRoute {
  instanceId: string;
  routeId: MerchantRouteId;
  fromPortId: PortId;
  toPortId: PortId;
  boatId: BoatId | null;
  feePaid: number;
  safety: RouteSafety;
  distance: number;
}

export type SeaHazardId =
  "squall" | "rogueWave" | "fogBank" | "iceFloes" | "sandShoal";

export interface SeaHazardDefinition {
  id: SeaHazardId;
  name: string;
  ability: SkillCheckAbility;
  baseDc: number;
  baseDamage: number;
  baseConditionDamage: number;
  weight: number;
  weather: readonly WeatherType[];
  depths: readonly SeaDepth[];
  zoneIds?: readonly SeaZoneId[];
}

export const SEA_HAZARDS: readonly SeaHazardDefinition[] = [
  {
    id: "squall",
    name: "Sudden Squall",
    ability: "dexterity",
    baseDc: 11,
    baseDamage: 6,
    baseConditionDamage: 7,
    weight: 5,
    weather: [WeatherType.Rain, WeatherType.Storm],
    depths: ["shallow", "deep"],
  },
  {
    id: "rogueWave",
    name: "Rogue Wave",
    ability: "dexterity",
    baseDc: 14,
    baseDamage: 10,
    baseConditionDamage: 12,
    weight: 3,
    weather: [WeatherType.Storm],
    depths: ["deep"],
  },
  {
    id: "fogBank",
    name: "Blinding Fog Bank",
    ability: "wisdom",
    baseDc: 12,
    baseDamage: 3,
    baseConditionDamage: 4,
    weight: 5,
    weather: [WeatherType.Fog],
    depths: ["shallow", "deep"],
  },
  {
    id: "iceFloes",
    name: "Drifting Ice Floes",
    ability: "intelligence",
    baseDc: 13,
    baseDamage: 8,
    baseConditionDamage: 10,
    weight: 4,
    weather: [WeatherType.Snow],
    depths: ["shallow", "deep"],
    zoneIds: ["frostwakeSea"],
  },
  {
    id: "sandShoal",
    name: "Shifting Sand Shoal",
    ability: "wisdom",
    baseDc: 12,
    baseDamage: 5,
    baseConditionDamage: 8,
    weight: 4,
    weather: [WeatherType.Sandstorm],
    depths: ["shallow"],
    zoneIds: ["covenantStrait", "emberwakeSea"],
  },
];

export interface PendingSeaHazard {
  instanceId: string;
  stepId: string;
  hazardId: SeaHazardId;
  boatId: BoatId;
  zoneId: SeaZoneId;
  depth: SeaDepth;
  weather: WeatherType;
  naturalRoll: number;
  dc: number;
  damage: number;
  conditionDamage: number;
}

export interface PendingSeaEncounter {
  instanceId: string;
  stepId: string;
  monsterId: SeaMonsterId;
  boatId: BoatId;
  zoneId: SeaZoneId;
  depth: SeaDepth;
  chunkX: number;
  chunkY: number;
  tileX: number;
  tileY: number;
}

export interface NauticalStatistics {
  seaSteps: number;
  tilesDiscovered: number;
  portsDiscovered: number;
  routesCompleted: number;
  routeFeesPaid: number;
  distanceSailed: number;
  hazardsFaced: number;
  hazardsAvoided: number;
  encountersWon: number;
  encountersFled: number;
  encountersLost: number;
  conditionLost: number;
}

export interface NauticalState {
  ownedBoats: BoatState[];
  activeBoatId: BoatId | null;
  sailing: boolean;
  heading: CardinalHeading;
  discoveredPortIds: PortId[];
  discoveredRouteIds: MerchantRouteId[];
  discoveredIslandIds: IslandId[];
  discoveredContinentIds: ContinentId[];
  discoveredSeaTiles: string[];
  pendingMerchantRoute: PendingMerchantRoute | null;
  pendingHazard: PendingSeaHazard | null;
  pendingEncounter: PendingSeaEncounter | null;
  processedHazardStepIds: string[];
  processedEncounterStepIds: string[];
  resolvedMerchantRouteIds: string[];
  resolvedHazardIds: string[];
  resolvedEncounterIds: string[];
  stats: NauticalStatistics;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback = minimum,
): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value))
    return fallback;
  return Math.min(maximum, Math.max(minimum, value));
}

function uniqueFiltered<T extends string>(
  value: unknown,
  guard: (candidate: unknown) => candidate is T,
  limit = NAUTICAL_ID_HISTORY_LIMIT,
): T[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(guard))].slice(-limit);
}

function uniqueTextIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.flatMap((entry): string[] =>
        typeof entry === "string" && entry.trim().length > 0
          ? [entry.trim().slice(0, 120)]
          : [],
      ),
    ),
  ].slice(-NAUTICAL_ID_HISTORY_LIMIT);
}

function isHeading(value: unknown): value is CardinalHeading {
  return (
    value === "north" ||
    value === "east" ||
    value === "south" ||
    value === "west"
  );
}

function isDepth(value: unknown): value is SeaDepth {
  return value === "shallow" || value === "deep";
}

function isWeatherType(value: unknown): value is WeatherType {
  return (
    typeof value === "string" &&
    (Object.values(WeatherType) as string[]).includes(value)
  );
}

function isSeaHazardId(value: unknown): value is SeaHazardId {
  return (
    typeof value === "string" &&
    SEA_HAZARDS.some((hazard) => hazard.id === value)
  );
}

export function getSeaHazard(id: SeaHazardId): SeaHazardDefinition {
  return SEA_HAZARDS.find((hazard) => hazard.id === id) as SeaHazardDefinition;
}

export function findBoat(
  state: NauticalState,
  boatId: BoatId | null = state.activeBoatId,
): BoatState | undefined {
  return boatId
    ? state.ownedBoats.find((boat) => boat.id === boatId)
    : undefined;
}

function normalizeBoat(value: unknown): BoatState | undefined {
  if (!isRecord(value) || !isBoatId(value["id"])) return undefined;
  const boatId = value["id"];
  const definition = getBoat(boatId);
  const upgradeIds = uniqueFiltered(
    value["upgradeIds"],
    isBoatUpgradeId,
  ).filter((id) => definition.allowedUpgradeIds.includes(id));
  return {
    id: boatId,
    condition: clampInteger(
      value["condition"],
      0,
      100,
      definition.baseCondition,
    ),
    upgradeIds,
    cosmeticId: isBoatCosmeticId(value["cosmeticId"])
      ? value["cosmeticId"]
      : "naturalTimber",
  };
}

function normalizeStatistics(value: unknown): NauticalStatistics {
  const source = isRecord(value) ? value : {};
  return {
    seaSteps: clampInteger(source["seaSteps"], 0, 1_000_000),
    tilesDiscovered: clampInteger(source["tilesDiscovered"], 0, 1_000_000),
    portsDiscovered: clampInteger(source["portsDiscovered"], 0, PORTS.length),
    routesCompleted: clampInteger(source["routesCompleted"], 0, 1_000_000),
    routeFeesPaid: clampInteger(source["routeFeesPaid"], 0, 1_000_000_000),
    distanceSailed: clampInteger(source["distanceSailed"], 0, 1_000_000_000),
    hazardsFaced: clampInteger(source["hazardsFaced"], 0, 1_000_000),
    hazardsAvoided: clampInteger(source["hazardsAvoided"], 0, 1_000_000),
    encountersWon: clampInteger(source["encountersWon"], 0, 1_000_000),
    encountersFled: clampInteger(source["encountersFled"], 0, 1_000_000),
    encountersLost: clampInteger(source["encountersLost"], 0, 1_000_000),
    conditionLost: clampInteger(source["conditionLost"], 0, 1_000_000),
  };
}

export function applyPortGeography(
  state: NauticalState,
  portId: PortId,
  countDiscovery: boolean,
): void {
  const port = getPort(portId);
  if (!state.discoveredPortIds.includes(portId)) {
    state.discoveredPortIds.push(portId);
    if (countDiscovery) state.stats.portsDiscovered += 1;
  }
  if (
    port.continentId &&
    !state.discoveredContinentIds.includes(port.continentId)
  ) {
    state.discoveredContinentIds.push(port.continentId);
  }
  if (port.islandId && !state.discoveredIslandIds.includes(port.islandId)) {
    state.discoveredIslandIds.push(port.islandId);
    const island = getIsland(port.islandId);
    if (!state.discoveredContinentIds.includes(island.continentId)) {
      state.discoveredContinentIds.push(island.continentId);
    }
  }
  for (const route of MERCHANT_ROUTES) {
    if (
      (route.portIds as readonly PortId[]).includes(portId) &&
      !state.discoveredRouteIds.includes(route.id)
    ) {
      state.discoveredRouteIds.push(route.id);
    }
  }
}

function normalizePendingRoute(
  value: unknown,
  state: NauticalState,
): PendingMerchantRoute | null {
  if (
    !isRecord(value) ||
    typeof value["instanceId"] !== "string" ||
    value["instanceId"].trim().length === 0 ||
    !isMerchantRouteId(value["routeId"]) ||
    !isPortId(value["fromPortId"]) ||
    !isPortId(value["toPortId"]) ||
    !(value["boatId"] === null || isBoatId(value["boatId"]))
  ) {
    return null;
  }
  const routeId = value["routeId"];
  const route = getMerchantRoute(routeId);
  const endpoints = route.portIds as readonly PortId[];
  const validDirection =
    endpoints.includes(value["fromPortId"]) &&
    endpoints.includes(value["toPortId"]) &&
    value["fromPortId"] !== value["toPortId"];
  if (
    !validDirection ||
    (value["boatId"] !== null && value["boatId"] !== state.activeBoatId) ||
    !state.discoveredRouteIds.includes(routeId)
  ) {
    return null;
  }
  return {
    instanceId: value["instanceId"].trim().slice(0, 120),
    routeId,
    fromPortId: value["fromPortId"],
    toPortId: value["toPortId"],
    boatId: value["boatId"],
    feePaid: route.fee,
    safety: route.safety,
    distance: route.distance,
  };
}

function normalizePendingHazard(
  value: unknown,
  state: NauticalState,
): PendingSeaHazard | null {
  if (
    !isRecord(value) ||
    typeof value["instanceId"] !== "string" ||
    typeof value["stepId"] !== "string" ||
    !isSeaHazardId(value["hazardId"]) ||
    !isBoatId(value["boatId"]) ||
    value["boatId"] !== state.activeBoatId ||
    !isSeaZoneId(value["zoneId"]) ||
    !isDepth(value["depth"]) ||
    !isWeatherType(value["weather"])
  ) {
    return null;
  }
  const definition = getSeaHazard(value["hazardId"]);
  if (
    !definition.weather.includes(value["weather"]) ||
    !definition.depths.includes(value["depth"]) ||
    (definition.zoneIds && !definition.zoneIds.includes(value["zoneId"]))
  ) {
    return null;
  }
  return {
    instanceId: value["instanceId"].trim().slice(0, 120),
    stepId: value["stepId"].trim().slice(0, 120),
    hazardId: definition.id,
    boatId: value["boatId"],
    zoneId: value["zoneId"],
    depth: value["depth"],
    weather: value["weather"],
    naturalRoll: clampInteger(value["naturalRoll"], 1, 20, 10),
    dc: clampInteger(value["dc"], 1, 40, definition.baseDc),
    damage: clampInteger(value["damage"], 0, 999, definition.baseDamage),
    conditionDamage: clampInteger(
      value["conditionDamage"],
      0,
      100,
      definition.baseConditionDamage,
    ),
  };
}

function normalizePendingEncounter(
  value: unknown,
  state: NauticalState,
): PendingSeaEncounter | null {
  if (
    !isRecord(value) ||
    typeof value["instanceId"] !== "string" ||
    typeof value["stepId"] !== "string" ||
    !isSeaMonsterId(value["monsterId"]) ||
    !isBoatId(value["boatId"]) ||
    value["boatId"] !== state.activeBoatId ||
    !isSeaZoneId(value["zoneId"]) ||
    !isDepth(value["depth"])
  ) {
    return null;
  }
  const chunkX = clampInteger(value["chunkX"], 0, WORLD_WIDTH - 1, -1);
  const chunkY = clampInteger(value["chunkY"], 0, WORLD_HEIGHT - 1, -1);
  const tileX = clampInteger(value["tileX"], 0, MAP_WIDTH - 1, -1);
  const tileY = clampInteger(value["tileY"], 0, MAP_HEIGHT - 1, -1);
  if (chunkX < 0 || chunkY < 0 || tileX < 0 || tileY < 0) return null;
  return {
    instanceId: value["instanceId"].trim().slice(0, 120),
    stepId: value["stepId"].trim().slice(0, 120),
    monsterId: value["monsterId"],
    boatId: value["boatId"],
    zoneId: value["zoneId"],
    depth: value["depth"],
    chunkX,
    chunkY,
    tileX,
    tileY,
  };
}

export function createNauticalState(): NauticalState {
  return {
    ownedBoats: [],
    activeBoatId: null,
    sailing: false,
    heading: "north",
    discoveredPortIds: [],
    discoveredRouteIds: [],
    discoveredIslandIds: [],
    discoveredContinentIds: [],
    discoveredSeaTiles: [],
    pendingMerchantRoute: null,
    pendingHazard: null,
    pendingEncounter: null,
    processedHazardStepIds: [],
    processedEncounterStepIds: [],
    resolvedMerchantRouteIds: [],
    resolvedHazardIds: [],
    resolvedEncounterIds: [],
    stats: normalizeStatistics(undefined),
  };
}

export function normalizeNauticalState(
  value: unknown,
  sourceVersion: number,
): NauticalState {
  if (sourceVersion < 15 || !isRecord(value)) return createNauticalState();
  const state = createNauticalState();
  const boats = Array.isArray(value["ownedBoats"])
    ? value["ownedBoats"].flatMap((candidate): BoatState[] => {
        const boat = normalizeBoat(candidate);
        return boat ? [boat] : [];
      })
    : [];
  for (const boat of boats) {
    if (!state.ownedBoats.some((owned) => owned.id === boat.id)) {
      state.ownedBoats.push(boat);
    }
  }
  state.activeBoatId =
    isBoatId(value["activeBoatId"]) &&
    state.ownedBoats.some((boat) => boat.id === value["activeBoatId"])
      ? value["activeBoatId"]
      : (state.ownedBoats[0]?.id ?? null);
  state.heading = isHeading(value["heading"]) ? value["heading"] : "north";
  state.discoveredPortIds = uniqueFiltered(
    value["discoveredPortIds"],
    isPortId,
  );
  state.discoveredRouteIds = uniqueFiltered(
    value["discoveredRouteIds"],
    isMerchantRouteId,
  );
  state.discoveredIslandIds = uniqueFiltered(
    value["discoveredIslandIds"],
    isIslandId,
  );
  state.discoveredContinentIds = uniqueFiltered(
    value["discoveredContinentIds"],
    isContinentId,
  );
  state.discoveredSeaTiles = Array.isArray(value["discoveredSeaTiles"])
    ? [
        ...new Set(
          value["discoveredSeaTiles"].filter(
            (candidate): candidate is string =>
              typeof candidate === "string" && isValidSeaFogKey(candidate),
          ),
        ),
      ].slice(-NAUTICAL_SEA_TILE_LIMIT)
    : [];
  state.processedHazardStepIds = uniqueTextIds(value["processedHazardStepIds"]);
  state.processedEncounterStepIds = uniqueTextIds(
    value["processedEncounterStepIds"],
  );
  state.resolvedMerchantRouteIds = uniqueTextIds(
    value["resolvedMerchantRouteIds"],
  );
  state.resolvedHazardIds = uniqueTextIds(value["resolvedHazardIds"]);
  state.resolvedEncounterIds = uniqueTextIds(value["resolvedEncounterIds"]);
  state.stats = normalizeStatistics(value["stats"]);

  for (const portId of [...state.discoveredPortIds]) {
    applyPortGeography(state, portId, false);
  }
  for (const islandId of state.discoveredIslandIds) {
    const continentId = getIsland(islandId).continentId;
    if (!state.discoveredContinentIds.includes(continentId)) {
      state.discoveredContinentIds.push(continentId);
    }
    state.stats.portsDiscovered = state.discoveredPortIds.length;
    state.stats.tilesDiscovered = Math.max(
      state.stats.tilesDiscovered,
      state.discoveredSeaTiles.length,
    );
    state.stats.hazardsAvoided = Math.min(
      state.stats.hazardsAvoided,
      state.stats.hazardsFaced,
    );
  }

  state.pendingMerchantRoute = normalizePendingRoute(
    value["pendingMerchantRoute"],
    state,
  );
  const activeBoat = findBoat(state);
  if (!activeBoat || activeBoat.condition <= 0) {
    state.sailing = state.pendingMerchantRoute !== null;
    state.pendingHazard = null;
    state.pendingEncounter = null;
    return state;
  }

  state.pendingHazard = normalizePendingHazard(value["pendingHazard"], state);
  state.pendingEncounter = state.pendingHazard
    ? null
    : normalizePendingEncounter(value["pendingEncounter"], state);
  state.sailing =
    state.pendingMerchantRoute !== null ||
    state.pendingHazard !== null ||
    state.pendingEncounter !== null ||
    value["sailing"] === true;
  return state;
}

function isValidSeaFogKey(value: string): boolean {
  const match = /^s:([a-zA-Z0-9]+),(\d+),(\d+),(\d+),(\d+)$/.exec(value);
  if (!match || !isSeaZoneId(match[1])) return false;
  const coordinates = match.slice(2).map(Number);
  const inBounds =
    coordinates[0] >= 0 &&
    coordinates[0] < WORLD_WIDTH &&
    coordinates[1] >= 0 &&
    coordinates[1] < WORLD_HEIGHT &&
    coordinates[2] >= 0 &&
    coordinates[2] < MAP_WIDTH &&
    coordinates[3] >= 0 &&
    coordinates[3] < MAP_HEIGHT;
  return (
    inBounds &&
    getSeaZoneAt(coordinates[0], coordinates[1], coordinates[2], coordinates[3])
      ?.zoneId === match[1]
  );
}
