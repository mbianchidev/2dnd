import {
  BOATS,
  MERCHANT_ROUTES,
  SEA_DAY_MONSTERS,
  SEA_NIGHT_MONSTERS,
  getBoat,
  getBoatUpgrade,
  getContinentAt,
  getMerchantRoute,
  getSeaZone,
  getSeaZoneAt,
  isContinentId,
  isMerchantRouteId,
} from "../data/nautical";
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  Terrain,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  isWalkable,
} from "../data/map";
import type {
  BoatId,
  CardinalHeading,
  MerchantRouteId,
  PortId,
  RouteSafety,
  SeaDepth,
  SeaMonsterId,
  SeaZoneId,
} from "../data/nautical";
import type { SkillCheckRecord } from "../data/skillChecks";
import type { QuestId } from "../data/quests";
import { getEffectiveEncounterRate } from "../managers/encounter";
import { getEncounterMultiplier, getTimePeriod, isNightTime } from "./daynight";
import { applyNonlethalDamage, resolveSkillCheck } from "./skillChecks";
import { WeatherType, getWeatherEncounterMultiplier } from "./weather";
import type { PlayerPosition, PlayerStats } from "./player";
import {
  NAUTICAL_ID_HISTORY_LIMIT,
  NAUTICAL_SEA_TILE_LIMIT,
  SEA_HAZARDS,
  applyPortGeography,
  findBoat,
  getSeaHazard,
} from "./nauticalState";
import type {
  BoatState,
  NauticalState,
  PendingMerchantRoute,
  PendingSeaEncounter,
  PendingSeaHazard,
  SeaHazardDefinition,
} from "./nauticalState";

export * from "./nauticalState";
export * from "./nauticalOwnership";

export function getActiveBoatState(state: NauticalState): BoatState | undefined {
  return findBoat(state);
}

export function canSailTo(
  state: NauticalState,
  chunkX: number,
  chunkY: number,
  tileX: number,
  tileY: number,
): boolean {
  const boat = findBoat(state);
  const sea = getSeaZoneAt(chunkX, chunkY, tileX, tileY);
  return state.sailing
    && !!boat
    && boat.condition > 0
    && !!sea
    && (sea.depth === "shallow" || getBoat(boat.id).deepWaterCapable);
}

export interface NavigationCheck {
  ok: boolean;
  reason?: string;
  target?: PlayerPosition;
  seaLocation?: {
    zoneId: SeaZoneId;
    depth: SeaDepth;
  };
}

export type TerrainLookup = (
  chunkX: number,
  chunkY: number,
  tileX: number,
  tileY: number,
) => Terrain | undefined;

export type NauticalBlockingPredicate = (position: PlayerPosition) => boolean;

export interface NavigationResult extends NavigationCheck {
  position: PlayerPosition;
}

export interface MerchantRouteWallet {
  gold: number;
}

export interface MerchantRouteExecutionResult {
  ok: boolean;
  idempotent: boolean;
  reason?: string;
  pending: PendingMerchantRoute | null;
}

export interface MerchantRouteResolutionResult {
  ok: boolean;
  idempotent: boolean;
  reason?: string;
  destinationPortId?: PortId;
  conditionLost: number;
}

export interface WeightedSeaMonster {
  monsterId: SeaMonsterId;
  weight: number;
}

export interface SeaEncounterContext {
  zoneId: SeaZoneId;
  depth: SeaDepth;
  timeStep: number;
  weather: WeatherType;
  boat: BoatState;
  routeSafety?: RouteSafety;
}

export interface PrepareSeaEncounterInput extends SeaEncounterContext {
  state: NauticalState;
  stepId: string;
  rateRoll: number;
  selectionRoll: number;
  position: Pick<PlayerPosition, "chunkX" | "chunkY" | "x" | "y">;
}

export interface PrepareSeaHazardInput {
  state: NauticalState;
  stepId: string;
  seed: number;
  zoneId: SeaZoneId;
  depth: SeaDepth;
  timeStep: number;
  weather: WeatherType;
  routeSafety?: RouteSafety;
}

export interface SeaHazardTraveler {
  hp: number;
  maxHp: number;
  stats: PlayerStats;
}

export interface SeaHazardResolution {
  ok: boolean;
  idempotent: boolean;
  reason?: string;
  check?: SkillCheckRecord;
  hpLost: number;
  conditionLost: number;
}

export type SeaEncounterOutcome = "victory" | "fled" | "defeat";

const SEA_MONSTER_WEIGHTS: Record<SeaMonsterId, number> = {
  reefSlime: 6,
  razorfin: 5,
  seaSerpent: 2,
  coralCrab: 4,
  moonJelly: 5,
  drownedSailor: 4,
  abyssalEel: 2,
  nightSerpent: 3,
};

const HAZARD_CHANCE: Record<WeatherType, number> = {
  [WeatherType.Clear]: 0,
  [WeatherType.Rain]: 0.06,
  [WeatherType.Snow]: 0.07,
  [WeatherType.Sandstorm]: 0.09,
  [WeatherType.Storm]: 0.14,
  [WeatherType.Fog]: 0.08,
};

const ROUTE_SAFETY_MULTIPLIER: Record<RouteSafety, number> = {
  guarded: 0.75,
  standard: 1,
  dangerous: 1.25,
};

function boundedPush(list: string[], value: string): void {
  if (!list.includes(value)) list.push(value);
  if (list.length > NAUTICAL_ID_HISTORY_LIMIT) {
    list.splice(0, list.length - NAUTICAL_ID_HISTORY_LIMIT);
  }
}

function conditionLossMultiplier(boat: BoatState): number {
  return boat.upgradeIds.reduce(
    (multiplier, id) => multiplier * getBoatUpgrade(id).conditionLossMultiplier,
    1,
  );
}

function encounterUpgradeMultiplier(boat: BoatState): number {
  return boat.upgradeIds.reduce(
    (multiplier, id) => multiplier * getBoatUpgrade(id).encounterMultiplier,
    1,
  );
}

function boatHazardResistance(boat: BoatState): number {
  return boat.upgradeIds.reduce(
    (resistance, id) => resistance + getBoatUpgrade(id).hazardResistance,
    getBoat(boat.id).hazardResistance,
  );
}

export function discoverPort(state: NauticalState, portId: PortId): boolean {
  const discovered = state.discoveredPortIds.includes(portId);
  applyPortGeography(state, portId, !discovered);
  return !discovered;
}

export function discoverSeaTile(
  state: NauticalState,
  zoneId: SeaZoneId,
  chunkX: number,
  chunkY: number,
  tileX: number,
  tileY: number,
): boolean {
  const key = seaFogKey(zoneId, chunkX, chunkY, tileX, tileY);
  if (state.discoveredSeaTiles.includes(key)) return false;
  state.discoveredSeaTiles.push(key);
  if (state.discoveredSeaTiles.length > NAUTICAL_SEA_TILE_LIMIT) {
    state.discoveredSeaTiles.splice(
      0,
      state.discoveredSeaTiles.length - NAUTICAL_SEA_TILE_LIMIT,
    );
  }
  state.stats.tilesDiscovered += 1;
  const continent = getContinentAt(chunkX, chunkY);
  if (
    continent &&
    isContinentId(continent.id) &&
    !state.discoveredContinentIds.includes(continent.id)
  ) {
    state.discoveredContinentIds.push(continent.id);
  }
  return true;
}

function offsetPosition(
  position: PlayerPosition,
  heading: CardinalHeading,
): PlayerPosition | undefined {
  let chunkX = position.chunkX;
  let chunkY = position.chunkY;
  let x = position.x;
  let y = position.y;
  if (heading === "north") y -= 1;
  if (heading === "east") x += 1;
  if (heading === "south") y += 1;
  if (heading === "west") x -= 1;
  if (x < 0) {
    chunkX -= 1;
    x = MAP_WIDTH - 1;
  } else if (x >= MAP_WIDTH) {
    chunkX += 1;
    x = 0;
  }
  if (y < 0) {
    chunkY -= 1;
    y = MAP_HEIGHT - 1;
  } else if (y >= MAP_HEIGHT) {
    chunkY += 1;
    y = 0;
  }
  if (
    chunkX < 0 ||
    chunkX >= WORLD_WIDTH ||
    chunkY < 0 ||
    chunkY >= WORLD_HEIGHT
  ) {
    return undefined;
  }
  return {
    ...position,
    chunkX,
    chunkY,
    x,
    y,
    inCity: false,
    cityId: "",
    cityChunkIndex: 0,
    inDungeon: false,
    dungeonId: "",
    dungeonLevel: 0,
  };
}

export function canEmbark(
  state: NauticalState,
  position: PlayerPosition,
  heading: CardinalHeading,
  terrainAt: TerrainLookup,
  isBlocked: NauticalBlockingPredicate,
): NavigationCheck {
  const boat = findBoat(state);
  if (!boat) return { ok: false, reason: "No active boat is owned." };
  if (boat.condition <= 0) {
    return { ok: false, reason: "The active boat needs repairs." };
  }
  if (state.sailing || position.inCity || position.inDungeon) {
    return { ok: false, reason: "Embarkation is not available here." };
  }
  if (
    state.pendingMerchantRoute ||
    state.pendingHazard ||
    state.pendingEncounter
  ) {
    return { ok: false, reason: "A nautical event is still pending." };
  }
  const currentTerrain = terrainAt(
    position.chunkX,
    position.chunkY,
    position.x,
    position.y,
  );
  if (currentTerrain === undefined || currentTerrain === Terrain.Water) {
    return { ok: false, reason: "Embarkation requires a land approach." };
  }
  const target = offsetPosition(position, heading);
  if (!target) return { ok: false, reason: "The world edge blocks sailing." };
  if (isBlocked(target)) {
    return { ok: false, reason: "The water approach is blocked." };
  }
  if (
    terrainAt(target.chunkX, target.chunkY, target.x, target.y) !==
    Terrain.Water
  ) {
    return { ok: false, reason: "There is no navigable water ahead." };
  }
  const seaLocation = getSeaZoneAt(
    target.chunkX,
    target.chunkY,
    target.x,
    target.y,
  );
  if (!seaLocation)
    return { ok: false, reason: "The sea location is invalid." };
  if (seaLocation.depth === "deep" && !getBoat(boat.id).deepWaterCapable) {
    return { ok: false, reason: "This boat cannot enter deep water." };
  }
  return { ok: true, target, seaLocation };
}

export function embark(
  state: NauticalState,
  position: PlayerPosition,
  heading: CardinalHeading,
  terrainAt: TerrainLookup,
  isBlocked: NauticalBlockingPredicate,
): NavigationResult {
  const check = canEmbark(state, position, heading, terrainAt, isBlocked);
  if (!check.ok || !check.target || !check.seaLocation) {
    return { ...check, position };
  }
  state.sailing = true;
  state.heading = heading;
  discoverSeaTile(
    state,
    check.seaLocation.zoneId,
    check.target.chunkX,
    check.target.chunkY,
    check.target.x,
    check.target.y,
  );
  return { ...check, position: check.target };
}

export function canDisembark(
  state: NauticalState,
  position: PlayerPosition,
  heading: CardinalHeading,
  terrainAt: TerrainLookup,
  isBlocked: NauticalBlockingPredicate,
): NavigationCheck {
  if (!state.sailing || !findBoat(state)) {
    return { ok: false, reason: "The party is not sailing." };
  }
  if (
    state.pendingMerchantRoute ||
    state.pendingHazard ||
    state.pendingEncounter
  ) {
    return { ok: false, reason: "A nautical event is still pending." };
  }
  if (
    terrainAt(position.chunkX, position.chunkY, position.x, position.y) !==
    Terrain.Water
  ) {
    return { ok: false, reason: "Disembarkation must begin on water." };
  }
  const target = offsetPosition(position, heading);
  if (!target) return { ok: false, reason: "The world edge blocks landing." };
  const targetTerrain = terrainAt(
    target.chunkX,
    target.chunkY,
    target.x,
    target.y,
  );
  if (
    targetTerrain === undefined ||
    targetTerrain === Terrain.Water ||
    !isWalkable(targetTerrain)
  ) {
    return { ok: false, reason: "There is no safe landing ahead." };
  }
  if (isBlocked(target)) {
    return { ok: false, reason: "The landing tile is blocked." };
  }
  return { ok: true, target };
}

export function disembark(
  state: NauticalState,
  position: PlayerPosition,
  heading: CardinalHeading,
  terrainAt: TerrainLookup,
  isBlocked: NauticalBlockingPredicate,
): NavigationResult {
  const check = canDisembark(state, position, heading, terrainAt, isBlocked);
  if (!check.ok || !check.target) return { ...check, position };
  state.sailing = false;
  state.heading = heading;
  return { ...check, position: check.target };
}

export function executeMerchantRoute(
  state: NauticalState,
  wallet: MerchantRouteWallet,
  routeId: MerchantRouteId,
  currentPortId: PortId,
  instanceId: string,
  isQuestCompleted: (questId: QuestId) => boolean = () => false,
): MerchantRouteExecutionResult {
  const normalizedInstanceId = instanceId.trim().slice(0, 120);
  if (!normalizedInstanceId) {
    return {
      ok: false,
      idempotent: false,
      reason: "A stable route instance ID is required.",
      pending: state.pendingMerchantRoute,
    };
  }
  if (state.resolvedMerchantRouteIds.includes(normalizedInstanceId)) {
    return { ok: true, idempotent: true, pending: null };
  }
  if (state.pendingMerchantRoute?.instanceId === normalizedInstanceId) {
    return {
      ok: true,
      idempotent: true,
      pending: state.pendingMerchantRoute,
    };
  }
  const route = getMerchantRoute(routeId);
  const destinationPortId = route.portIds.find(
    (portId) => portId !== currentPortId,
  );
  const boat = findBoat(state);
  const routeBoat = boat && boat.condition > 0 ? boat : undefined;
  if (!state.discoveredRouteIds.includes(routeId)) {
    return {
      ok: false,
      idempotent: false,
      reason: "The merchant route has not been discovered.",
      pending: state.pendingMerchantRoute,
    };
  }
  if (!route.portIds.includes(currentPortId) || !destinationPortId) {
    return {
      ok: false,
      idempotent: false,
      reason: "The current port is not on this route.",
      pending: state.pendingMerchantRoute,
    };
  }
  if (state.sailing) {
    return {
      ok: false,
      idempotent: false,
      reason: "Nautical travel is already active or the selected boat needs repairs.",
      pending: state.pendingMerchantRoute,
    };
  }
  if (state.pendingHazard || state.pendingEncounter) {
    return {
      ok: false,
      idempotent: false,
      reason: "A nautical event is still pending.",
      pending: state.pendingMerchantRoute,
    };
  }
  if (route.questGate && !isQuestCompleted(route.questGate.questId)) {
    return {
      ok: false,
      idempotent: false,
      reason: "The route's quest gate is not satisfied.",
      pending: state.pendingMerchantRoute,
    };
  }
  if (!Number.isFinite(wallet.gold) || wallet.gold < route.fee) {
    return {
      ok: false,
      idempotent: false,
      reason: "There is not enough gold for the route fee.",
      pending: state.pendingMerchantRoute,
    };
  }

  const pending: PendingMerchantRoute = {
    instanceId: normalizedInstanceId,
    routeId,
    fromPortId: currentPortId,
    toPortId: destinationPortId,
    boatId: routeBoat?.id ?? null,
    feePaid: route.fee,
    safety: route.safety,
    distance: route.distance,
  };
  wallet.gold -= route.fee;
  state.stats.routeFeesPaid += route.fee;
  state.pendingMerchantRoute = pending;
  state.sailing = true;
  return { ok: true, idempotent: false, pending };
}

export function resolvePendingMerchantRoute(
  state: NauticalState,
  instanceId: string,
): MerchantRouteResolutionResult {
  const normalizedInstanceId = instanceId.trim().slice(0, 120);
  if (state.resolvedMerchantRouteIds.includes(normalizedInstanceId)) {
    return {
      ok: true,
      idempotent: true,
      conditionLost: 0,
    };
  }
  const pending = state.pendingMerchantRoute;
  if (!pending || pending.instanceId !== normalizedInstanceId) {
    return {
      ok: false,
      idempotent: false,
      reason: "No matching merchant route is pending.",
      conditionLost: 0,
    };
  }
  if (state.pendingHazard || state.pendingEncounter) {
    return {
      ok: false,
      idempotent: false,
      reason: "The route cannot finish while a nautical event is pending.",
      conditionLost: 0,
    };
  }
  const boat = pending.boatId ? findBoat(state, pending.boatId) : undefined;
  const safetyLoss =
    pending.safety === "dangerous" ? 2 : pending.safety === "standard" ? 1 : 0;
  const conditionLost = boat
    ? Math.min(
      boat.condition,
      Math.max(
        0,
        Math.round(
          (pending.distance / 12 + safetyLoss) * conditionLossMultiplier(boat),
        ),
      ),
    )
    : 0;
  if (boat) boat.condition -= conditionLost;
  state.pendingMerchantRoute = null;
  state.sailing = false;
  boundedPush(state.resolvedMerchantRouteIds, normalizedInstanceId);
  state.stats.routesCompleted += 1;
  state.stats.distanceSailed += pending.distance;
  state.stats.conditionLost += conditionLost;
  discoverPort(state, pending.toPortId);
  return {
    ok: true,
    idempotent: false,
    destinationPortId: pending.toPortId,
    conditionLost,
  };
}

export function seaFogKey(
  zoneId: SeaZoneId,
  chunkX: number,
  chunkY: number,
  tileX: number,
  tileY: number,
): string {
  if (
    chunkX < 0 ||
    chunkX >= WORLD_WIDTH ||
    chunkY < 0 ||
    chunkY >= WORLD_HEIGHT ||
    tileX < 0 ||
    tileX >= MAP_WIDTH ||
    tileY < 0 ||
    tileY >= MAP_HEIGHT ||
    ![chunkX, chunkY, tileX, tileY].every(Number.isInteger)
  ) {
    throw new Error("[nautical] Invalid sea fog coordinates");
  }
  if (getSeaZoneAt(chunkX, chunkY, tileX, tileY)?.zoneId !== zoneId) {
    throw new Error("[nautical] Sea fog zone does not match the coordinates");
  }
  return `s:${zoneId},${chunkX},${chunkY},${tileX},${tileY}`;
}

export function getSeaEncounterRate(context: SeaEncounterContext): number {
  const baseRate = context.depth === "deep" ? 0.095 : 0.065;
  const boat = getBoat(context.boat.id);
  const routeMultiplier = context.routeSafety
    ? ROUTE_SAFETY_MULTIPLIER[context.routeSafety]
    : 1;
  return getEffectiveEncounterRate(
    baseRate,
    getEncounterMultiplier(context.timeStep),
    getWeatherEncounterMultiplier(context.weather),
    getSeaZone(context.zoneId).encounterMultiplier,
    boat.encounterMultiplier,
    encounterUpgradeMultiplier(context.boat),
    routeMultiplier,
  );
}

export function getSeaEncounterPool(
  timeStep: number,
  zoneId: SeaZoneId,
  depth: SeaDepth,
): WeightedSeaMonster[] {
  const ids: readonly SeaMonsterId[] = isNightTime(timeStep)
    ? SEA_NIGHT_MONSTERS
    : SEA_DAY_MONSTERS;
  return ids.map((monsterId) => {
    let weight = SEA_MONSTER_WEIGHTS[monsterId];
    if (
      depth === "deep" &&
      (monsterId === "seaSerpent" ||
        monsterId === "abyssalEel" ||
        monsterId === "nightSerpent")
    ) {
      weight *= 2;
    }
    if (
      zoneId === "frostwakeSea" &&
      (monsterId === "moonJelly" || monsterId === "drownedSailor")
    ) {
      weight *= 1.5;
    }
    if (
      zoneId === "emberwakeSea" &&
      (monsterId === "razorfin" || monsterId === "nightSerpent")
    ) {
      weight *= 1.5;
    }
    return { monsterId, weight };
  });
}

export function selectWeightedSeaMonster(
  pool: readonly WeightedSeaMonster[],
  randomValue: number,
): SeaMonsterId | undefined {
  if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
    throw new Error("[nautical] Invalid weighted encounter roll");
  }
  const totalWeight = pool.reduce(
    (total, entry) => total + Math.max(0, entry.weight),
    0,
  );
  if (totalWeight <= 0) return undefined;
  let threshold = randomValue * totalWeight;
  for (const entry of pool) {
    threshold -= Math.max(0, entry.weight);
    if (threshold < 0) return entry.monsterId;
  }
  return pool[pool.length - 1]?.monsterId;
}

export function prepareSeaEncounter(
  input: PrepareSeaEncounterInput,
): PendingSeaEncounter | null {
  const { state, stepId } = input;
  const normalizedStepId = stepId.trim().slice(0, 120);
  if (!normalizedStepId || !state.sailing) return null;
  if (state.pendingEncounter?.stepId === normalizedStepId) {
    return state.pendingEncounter;
  }
  if (
    state.pendingEncounter ||
    state.pendingHazard ||
    state.processedEncounterStepIds.includes(normalizedStepId)
  ) {
    return null;
  }
  if (
    !Number.isFinite(input.rateRoll) ||
    input.rateRoll < 0 ||
    input.rateRoll >= 1
  ) {
    throw new Error("[nautical] Invalid encounter-rate roll");
  }
  const seaLocation = getSeaZoneAt(
    input.position.chunkX,
    input.position.chunkY,
    input.position.x,
    input.position.y,
  );
  if (
    !seaLocation ||
    seaLocation.zoneId !== input.zoneId ||
    seaLocation.depth !== input.depth
  ) {
    throw new Error(
      "[nautical] Encounter location does not match its sea zone",
    );
  }
  boundedPush(state.processedEncounterStepIds, normalizedStepId);
  if (input.rateRoll >= getSeaEncounterRate(input)) return null;
  const monsterId = selectWeightedSeaMonster(
    getSeaEncounterPool(input.timeStep, input.zoneId, input.depth),
    input.selectionRoll,
  );
  if (!monsterId) return null;
  const boat = findBoat(state);
  if (!boat) return null;
  state.pendingEncounter = {
    instanceId: `enc:${normalizedStepId}`.slice(0, 120),
    stepId: normalizedStepId,
    monsterId,
    boatId: boat.id,
    zoneId: input.zoneId,
    depth: input.depth,
    chunkX: input.position.chunkX,
    chunkY: input.position.chunkY,
    tileX: input.position.x,
    tileY: input.position.y,
  };
  return state.pendingEncounter;
}

export function resolvePendingSeaEncounter(
  state: NauticalState,
  instanceId: string,
  outcome: SeaEncounterOutcome,
): boolean {
  const normalizedInstanceId = instanceId.trim().slice(0, 120);
  if (state.resolvedEncounterIds.includes(normalizedInstanceId)) return false;
  if (state.pendingEncounter?.instanceId !== normalizedInstanceId) return false;
  state.pendingEncounter = null;
  boundedPush(state.resolvedEncounterIds, normalizedInstanceId);
  if (outcome === "victory") state.stats.encountersWon += 1;
  if (outcome === "fled") state.stats.encountersFled += 1;
  if (outcome === "defeat") state.stats.encountersLost += 1;
  return true;
}

function deterministicUnit(seed: number, key: string): number {
  let hash = (seed ^ 0x9e3779b9) >>> 0;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4_294_967_296;
}

function weightedHazard(
  hazards: readonly SeaHazardDefinition[],
  randomValue: number,
): SeaHazardDefinition | undefined {
  const total = hazards.reduce((sum, hazard) => sum + hazard.weight, 0);
  if (total <= 0) return undefined;
  let threshold = randomValue * total;
  for (const hazard of hazards) {
    threshold -= hazard.weight;
    if (threshold < 0) return hazard;
  }
  return hazards[hazards.length - 1];
}

export function prepareSeaHazard(
  input: PrepareSeaHazardInput,
): PendingSeaHazard | null {
  const { state } = input;
  const stepId = input.stepId.trim().slice(0, 120);
  if (!Number.isSafeInteger(input.seed)) {
    throw new Error("[nautical] A stable integer hazard seed is required");
  }
  if (!stepId || !state.sailing) return null;
  if (state.pendingHazard?.stepId === stepId) return state.pendingHazard;
  if (
    state.pendingHazard ||
    state.pendingEncounter ||
    state.processedHazardStepIds.includes(stepId)
  ) {
    return null;
  }
  const boat = findBoat(state);
  if (!boat || boat.condition <= 0) return null;
  boundedPush(state.processedHazardStepIds, stepId);
  state.stats.seaSteps += 1;
  const resistance = boatHazardResistance(boat);
  const nightMultiplier = getTimePeriod(input.timeStep) === "Night" ? 1.15 : 1;
  const chance = Math.min(
    0.3,
    HAZARD_CHANCE[input.weather] *
      getSeaZone(input.zoneId).hazardMultiplier *
      (input.depth === "deep" ? 1.2 : 1) *
      ROUTE_SAFETY_MULTIPLIER[input.routeSafety ?? "standard"] *
      nightMultiplier *
      Math.max(0.5, 1 - resistance * 0.05),
  );
  const chanceRoll = deterministicUnit(
    input.seed,
    `${stepId}:chance:${input.zoneId}:${input.weather}`,
  );
  if (chanceRoll >= chance) return null;
  const eligible = SEA_HAZARDS.filter(
    (hazard) =>
      hazard.weather.includes(input.weather) &&
      hazard.depths.includes(input.depth) &&
      (!hazard.zoneIds || hazard.zoneIds.includes(input.zoneId)),
  );
  const hazard = weightedHazard(
    eligible,
    deterministicUnit(input.seed, `${stepId}:hazard`),
  );
  if (!hazard) return null;
  const routeModifier =
    input.routeSafety === "dangerous"
      ? 2
      : input.routeSafety === "guarded"
        ? -1
        : 0;
  const depthModifier = input.depth === "deep" ? 1 : 0;
  const dc = Math.max(
    1,
    hazard.baseDc + routeModifier + depthModifier - resistance,
  );
  const damageMultiplier =
    ROUTE_SAFETY_MULTIPLIER[input.routeSafety ?? "standard"] *
    (input.depth === "deep" ? 1.2 : 1);
  state.pendingHazard = {
    instanceId: `haz:${stepId}`.slice(0, 120),
    stepId,
    hazardId: hazard.id,
    boatId: boat.id,
    zoneId: input.zoneId,
    depth: input.depth,
    weather: input.weather,
    naturalRoll:
      1 + Math.floor(deterministicUnit(input.seed, `${stepId}:check`) * 20),
    dc,
    damage: Math.max(0, Math.round(hazard.baseDamage * damageMultiplier)),
    conditionDamage: Math.max(
      0,
      Math.round(
        hazard.baseConditionDamage *
          damageMultiplier *
          conditionLossMultiplier(boat),
      ),
    ),
  };
  return state.pendingHazard;
}

export function resolvePendingSeaHazard(
  state: NauticalState,
  traveler: SeaHazardTraveler,
  instanceId: string,
): SeaHazardResolution {
  const normalizedInstanceId = instanceId.trim().slice(0, 120);
  if (state.resolvedHazardIds.includes(normalizedInstanceId)) {
    return {
      ok: true,
      idempotent: true,
      hpLost: 0,
      conditionLost: 0,
    };
  }
  const pending = state.pendingHazard;
  if (!pending || pending.instanceId !== normalizedInstanceId) {
    return {
      ok: false,
      idempotent: false,
      reason: "No matching sea hazard is pending.",
      hpLost: 0,
      conditionLost: 0,
    };
  }
  const boat = findBoat(state, pending.boatId);
  if (!boat) {
    return {
      ok: false,
      idempotent: false,
      reason: "The hazard's boat is unavailable.",
      hpLost: 0,
      conditionLost: 0,
    };
  }
  const hazard = getSeaHazard(pending.hazardId);
  const check = resolveSkillCheck(
    traveler.stats,
    hazard.ability,
    pending.dc,
    pending.naturalRoll,
  );
  const previousHp = traveler.hp;
  const hpLost = check.success
    ? 0
    : Math.max(
        0,
        previousHp - applyNonlethalDamage(previousHp, pending.damage),
      );
  traveler.hp = Math.max(1, Math.min(traveler.maxHp, previousHp - hpLost));
  const conditionLost = check.success
    ? 0
    : Math.min(boat.condition, pending.conditionDamage);
  boat.condition -= conditionLost;
  state.pendingHazard = null;
  boundedPush(state.resolvedHazardIds, normalizedInstanceId);
  state.stats.hazardsFaced += 1;
  if (check.success) state.stats.hazardsAvoided += 1;
  state.stats.conditionLost += conditionLost;
  if (boat.condition <= 0) state.sailing = false;
  return {
    ok: true,
    idempotent: false,
    check,
    hpLost,
    conditionLost,
  };
}

export function getRouteDestination(
  routeId: MerchantRouteId,
  currentPortId: PortId,
): PortId | undefined {
  const route = getMerchantRoute(routeId);
  return route.portIds.includes(currentPortId)
    ? route.portIds.find((portId) => portId !== currentPortId)
    : undefined;
}

export function getBoatCatalog(): typeof BOATS {
  return BOATS;
}
