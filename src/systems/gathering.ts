import {
  GATHERING_DEFINITIONS,
  GATHERING_DISCIPLINES,
  GATHERING_RARITIES,
  getGatheringOutcome,
  getGatheringResource,
  getGatheringTable,
  type GatheringDiscipline,
  type GatheringOutcomeDefinition,
  type GatheringRarity,
} from "../data/gathering";
import { getItem } from "../data/items";
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  Terrain,
  getChunk,
  getCity,
  getCityChunkMap,
  getDungeon,
  getDungeonLevelMap,
  isWalkable,
} from "../data/map";
import { createSoloEncounter, type MonsterEncounter } from "../data/monsterGroups";
import { getMonster } from "../data/monsters";
import { TimePeriod, getTimePeriod } from "./daynight";
import type { PlayerPosition, PlayerState } from "./player";
import type { WeatherType } from "./weather";

export const GATHERING_HISTORY_LIMIT = 40;
export const LEGACY_GATHERING_SEED = 0x2d0d0062;

export type GatheringDirection = "up" | "right" | "down" | "left";
export type GatheringAction =
  | { type: "tick" }
  | { type: "confirm" }
  | { type: "direction"; direction: GatheringDirection };

export interface GatheringLocation {
  context: "overworld" | "city" | "dungeon";
  contextId: string;
  sublevel: number;
  playerX: number;
  playerY: number;
  targetX: number;
  targetY: number;
  terrain: Terrain;
  biome: string;
}

export interface GatheringNode {
  id: string;
  discipline: GatheringDiscipline;
  location: GatheringLocation;
}

export interface GatheringNodeState {
  attempts: number;
  cooldownRemaining: number;
}

export interface FishingGameState {
  kind: "fishing";
  phase: "waiting" | "bite" | "tension" | "complete";
  biteAt: number;
  waitTicks: number;
  tensionPattern: GatheringDirection[];
  patternIndex: number;
  score: number;
  failed: boolean;
}

export interface MiningGameState {
  kind: "mining";
  phase: "striking" | "complete";
  pattern: GatheringDirection[];
  patternIndex: number;
  selected: GatheringDirection;
  score: number;
}

export interface ForagingGameState {
  kind: "foraging";
  phase: "reveal" | "select" | "complete";
  pattern: GatheringDirection[];
  revealIndex: number;
  patternIndex: number;
  score: number;
}

export type GatheringGameState =
  | FishingGameState
  | MiningGameState
  | ForagingGameState;

export interface PendingGathering {
  instanceId: string;
  nodeId: string;
  discipline: GatheringDiscipline;
  outcomeId: string;
  resourceId: string;
  quantity: number;
  rarity: GatheringRarity;
  phase: "playing" | "battle";
  reducedMotion: boolean;
  debug: boolean;
  location: GatheringLocation;
  game: GatheringGameState;
}

export interface GatheringDisciplineStats {
  attempts: number;
  successes: number;
  failures: number;
  rareFinds: number;
  bestScore: number;
}

export interface GatheringHistoryEntry {
  instanceId: string;
  nodeId: string;
  discipline: GatheringDiscipline;
  resourceId: string;
  outcomeId: string;
  quantity: number;
  rarity: GatheringRarity;
  success: boolean;
}

export interface GatheringState {
  seed: number;
  sequence: number;
  nodeStates: Record<string, GatheringNodeState>;
  discoveredNodeIds: string[];
  discoveredResourceIds: string[];
  claimedOutcomeIds: string[];
  stats: Record<GatheringDiscipline, GatheringDisciplineStats>;
  pending: PendingGathering | null;
  history: GatheringHistoryEntry[];
}

export interface GatheringStartContext {
  timeStep: number;
  weather: WeatherType;
  reducedMotion: boolean;
}

export interface GatheringResolution {
  resolved: boolean;
  success: boolean;
  score: number;
  itemId?: string;
  resourceId?: string;
  quantity: number;
  rarity?: GatheringRarity;
  battle?: MonsterEncounter;
  message: string;
}

function emptyStats(): GatheringDisciplineStats {
  return {
    attempts: 0,
    successes: 0,
    failures: 0,
    rareFinds: 0,
    bestScore: 0,
  };
}

export function createGatheringState(seed = createGatheringSeed()): GatheringState {
  return {
    seed,
    sequence: 0,
    nodeStates: {},
    discoveredNodeIds: [],
    discoveredResourceIds: [],
    claimedOutcomeIds: [],
    stats: {
      fishing: emptyStats(),
      mining: emptyStats(),
      foraging: emptyStats(),
    },
    pending: null,
    history: [],
  };
}

export function createGatheringSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) || LEGACY_GATHERING_SEED;
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function seededUnit(seed: number, salt: string): number {
  let value = (seed ^ hash(salt)) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 0x1_0000_0000;
}

function getResolvedMap(
  position: PlayerPosition,
): { map: Terrain[][]; context: GatheringLocation["context"]; contextId: string; sublevel: number; biome: string } | undefined {
  if (position.inDungeon) {
    const dungeon = getDungeon(position.dungeonId);
    if (!dungeon) return undefined;
    return {
      map: getDungeonLevelMap(dungeon, position.dungeonLevel),
      context: "dungeon",
      contextId: dungeon.id,
      sublevel: position.dungeonLevel,
      biome: dungeon.name,
    };
  }
  if (position.inCity) {
    const city = getCity(position.cityId);
    const map = city ? getCityChunkMap(city, position.cityChunkIndex) : undefined;
    if (!city || !map) return undefined;
    return {
      map,
      context: "city",
      contextId: city.id,
      sublevel: position.cityChunkIndex,
      biome: city.name,
    };
  }
  const chunk = getChunk(position.chunkX, position.chunkY);
  if (!chunk) return undefined;
  return {
    map: chunk.mapData,
    context: "overworld",
    contextId: `${position.chunkX},${position.chunkY}`,
    sublevel: 0,
    biome: chunk.name,
  };
}

const TARGET_OFFSETS: readonly {
  x: number;
  y: number;
}[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
] as const;

function makeNodeId(
  discipline: GatheringDiscipline,
  location: GatheringLocation,
): string {
  return [
    "g",
    discipline,
    location.context,
    location.contextId,
    location.sublevel,
    `${location.targetX},${location.targetY}`,
  ].join(":");
}

export function findGatheringNodes(player: PlayerState): GatheringNode[] {
  const resolved = getResolvedMap(player.position);
  if (!resolved) return [];
  const playerTerrain = resolved.map[player.position.y]?.[player.position.x];
  if (playerTerrain === undefined || !isWalkable(playerTerrain)) return [];
  const nodes: GatheringNode[] = [];
  for (const discipline of GATHERING_DISCIPLINES) {
    const definition = GATHERING_DEFINITIONS[discipline];
    const offsets = definition.allowsCurrentTile
      ? [{ x: 0, y: 0 }, ...TARGET_OFFSETS]
      : TARGET_OFFSETS;
    for (const offset of offsets) {
      const targetX = player.position.x + offset.x;
      const targetY = player.position.y + offset.y;
      if (
        targetX < 0
        || targetX >= MAP_WIDTH
        || targetY < 0
        || targetY >= MAP_HEIGHT
      ) {
        continue;
      }
      const terrain = resolved.map[targetY]?.[targetX];
      if (terrain === undefined || !definition.targetTerrains.includes(terrain)) continue;
      const location: GatheringLocation = {
        context: resolved.context,
        contextId: resolved.contextId,
        sublevel: resolved.sublevel,
        playerX: player.position.x,
        playerY: player.position.y,
        targetX,
        targetY,
        terrain,
        biome: resolved.biome,
      };
      nodes.push({
        id: makeNodeId(discipline, location),
        discipline,
        location,
      });
    }
  }
  return nodes.sort((left, right) => {
    const leftCurrent = left.location.targetX === player.position.x
      && left.location.targetY === player.position.y;
    const rightCurrent = right.location.targetX === player.position.x
      && right.location.targetY === player.position.y;
    return Number(rightCurrent) - Number(leftCurrent);
  });
}

export function getAvailableGatheringNode(
  player: PlayerState,
): { node?: GatheringNode; cooldown?: GatheringNode; remainingSteps?: number } {
  const nodes = findGatheringNodes(player);
  for (const node of nodes) {
    const remaining = player.progression.gathering.nodeStates[node.id]?.cooldownRemaining ?? 0;
    if (remaining <= 0) return { node };
  }
  const cooldown = nodes[0];
  return cooldown
    ? {
      cooldown,
      remainingSteps:
        player.progression.gathering.nodeStates[cooldown.id]?.cooldownRemaining ?? 0,
    }
    : {};
}

function matchesOutcome(
  outcome: GatheringOutcomeDefinition,
  node: GatheringNode,
  context: GatheringStartContext,
): boolean {
  if (outcome.periods && !outcome.periods.includes(getTimePeriod(context.timeStep))) {
    return false;
  }
  if (outcome.weather && !outcome.weather.includes(context.weather)) return false;
  if (outcome.terrain && !outcome.terrain.includes(node.location.terrain)) return false;
  if (
    outcome.biomeTags
    && !outcome.biomeTags.some((tag) =>
      node.location.biome.toLocaleLowerCase().includes(tag.toLocaleLowerCase())
    )
  ) {
    return false;
  }
  return true;
}

function chooseOutcome(
  state: GatheringState,
  node: GatheringNode,
  context: GatheringStartContext,
  instanceId: string,
): GatheringOutcomeDefinition {
  const table = getGatheringTable(GATHERING_DEFINITIONS[node.discipline].tableId);
  if (!table) throw new Error(`[gathering] Missing table for ${node.discipline}`);
  const eligible = table.outcomes.filter((outcome) =>
    matchesOutcome(outcome, node, context)
  );
  const candidates = eligible.length > 0 ? eligible : table.outcomes.slice(0, 1);
  const weights = candidates.map((outcome) =>
    getGatheringOutcomeWeight(outcome, node, context)
  );
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = seededUnit(state.seed, `${instanceId}:outcome`) * totalWeight;
  for (let index = 0; index < candidates.length; index += 1) {
    roll -= weights[index]!;
    if (roll < 0) return candidates[index]!;
  }
  return candidates[candidates.length - 1]!;
}

export function getGatheringOutcomeWeight(
  outcome: GatheringOutcomeDefinition,
  node: GatheringNode,
  context: GatheringStartContext,
): number {
  let multiplier = 1;
  const period = getTimePeriod(context.timeStep);
  if (
    node.discipline === "fishing"
    && (context.weather === "Rain" || context.weather === "Storm")
  ) {
    multiplier *= outcome.resourceId === "stormEel" ? 1.4 : 0.95;
  }
  if (
    node.discipline === "fishing"
    && (period === TimePeriod.Dusk || period === TimePeriod.Night)
    && outcome.resourceId === "moonKoi"
  ) {
    multiplier *= 1.35;
  }
  if (
    node.discipline === "mining"
    && (
      node.location.context === "dungeon"
      || /mountain|canyon|forge|crypt|cavern/i.test(node.location.biome)
    )
    && (outcome.resourceId === "moonstoneGem" || outcome.resourceId === "runicShard")
  ) {
    multiplier *= 1.25;
  }
  if (
    node.discipline === "foraging"
    && (context.weather === "Rain" || context.weather === "Fog")
    && outcome.resourceId === "redcapMushroom"
  ) {
    multiplier *= 1.3;
  }
  if (
    node.discipline === "foraging"
    && period === TimePeriod.Dawn
    && (outcome.resourceId === "wildHerbs" || outcome.resourceId === "sunleaf")
  ) {
    multiplier *= 1.15;
  }
  return outcome.weight * multiplier;
}

function randomDirection(seed: number, salt: string): GatheringDirection {
  const directions: readonly GatheringDirection[] = ["up", "right", "down", "left"];
  return directions[Math.floor(seededUnit(seed, salt) * directions.length)]!;
}

function createPattern(
  seed: number,
  instanceId: string,
  length: number,
): GatheringDirection[] {
  return Array.from({ length }, (_, index) =>
    randomDirection(seed, `${instanceId}:pattern:${index}`)
  );
}

function createGame(
  state: GatheringState,
  discipline: GatheringDiscipline,
  instanceId: string,
): GatheringGameState {
  const talentBonus = 0;
  if (discipline === "fishing") {
    return {
      kind: "fishing",
      phase: "waiting",
      biteAt: 2 + Math.floor(seededUnit(state.seed, `${instanceId}:bite`) * 3),
      waitTicks: 0,
      tensionPattern: createPattern(state.seed, instanceId, 4 + talentBonus),
      patternIndex: 0,
      score: 0,
      failed: false,
    };
  }
  if (discipline === "mining") {
    return {
      kind: "mining",
      phase: "striking",
      pattern: createPattern(state.seed, instanceId, 4 + talentBonus),
      patternIndex: 0,
      selected: "up",
      score: 0,
    };
  }
  return {
    kind: "foraging",
    phase: "reveal",
    pattern: createPattern(state.seed, instanceId, 4 + talentBonus),
    revealIndex: 0,
    patternIndex: 0,
    score: 0,
  };
}

export function startGathering(
  player: PlayerState,
  node: GatheringNode,
  context: GatheringStartContext,
): PendingGathering {
  const state = player.progression.gathering;
  if (state.pending) throw new Error("[gathering] An activity is already pending");
  const cooldown = state.nodeStates[node.id]?.cooldownRemaining ?? 0;
  if (cooldown > 0) {
    throw new Error(`[gathering] Node recovers in ${cooldown} steps`);
  }
  state.sequence += 1;
  const instanceId = `${node.id}:${state.sequence}`;
  const outcome = chooseOutcome(state, node, context, instanceId);
  const resource = getGatheringResource(outcome.resourceId);
  if (!resource) throw new Error(`[gathering] Unknown resource ${outcome.resourceId}`);
  const quantitySpan = outcome.quantity[1] - outcome.quantity[0] + 1;
  const quantity = outcome.quantity[0]
    + Math.floor(seededUnit(state.seed, `${instanceId}:quantity`) * quantitySpan);
  const pending: PendingGathering = {
    instanceId,
    nodeId: node.id,
    discipline: node.discipline,
    outcomeId: outcome.id,
    resourceId: resource.id,
    quantity,
    rarity: resource.rarity,
    phase: "playing",
    reducedMotion: context.reducedMotion,
    debug: false,
    location: node.location,
    game: createGame(state, node.discipline, instanceId),
  };
  state.pending = pending;
  if (!state.discoveredNodeIds.includes(node.id)) state.discoveredNodeIds.push(node.id);
  state.stats[node.discipline].attempts += 1;
  return pending;
}

function completeGame(game: GatheringGameState): void {
  game.phase = "complete";
}

export function applyGatheringAction(
  pending: PendingGathering,
  action: GatheringAction,
): GatheringGameState {
  const game = pending.game;
  if (game.phase === "complete") return game;
  if (game.kind === "fishing") {
    if (game.phase === "waiting") {
      if (action.type !== "tick" && !(pending.reducedMotion && action.type === "confirm")) {
        return game;
      }
      game.waitTicks += 1;
      if (game.waitTicks >= game.biteAt) game.phase = "bite";
      return game;
    }
    if (game.phase === "bite") {
      if (action.type === "confirm") {
        game.phase = "tension";
        game.score = 40;
      } else if (action.type === "tick" && !pending.reducedMotion) {
        game.failed = true;
        completeGame(game);
      }
      return game;
    }
    if (game.phase === "tension" && action.type === "direction") {
      if (action.direction === game.tensionPattern[game.patternIndex]) {
        game.score += 15;
      } else {
        game.score = Math.max(0, game.score - 20);
      }
      game.patternIndex += 1;
      if (game.patternIndex >= game.tensionPattern.length) completeGame(game);
    }
    return game;
  }
  if (game.kind === "mining") {
    if (action.type === "direction") {
      game.selected = action.direction;
      return game;
    }
    if (action.type === "confirm") {
      if (game.selected === game.pattern[game.patternIndex]) game.score += 25;
      else game.score = Math.max(0, game.score - 10);
      game.patternIndex += 1;
      if (game.patternIndex >= game.pattern.length) completeGame(game);
    }
    return game;
  }
  if (game.phase === "reveal") {
    if (action.type !== "tick" && !(pending.reducedMotion && action.type === "confirm")) {
      return game;
    }
    game.revealIndex += 1;
    if (game.revealIndex >= game.pattern.length) game.phase = "select";
    return game;
  }
  if (game.phase === "select" && action.type === "direction") {
    if (action.direction === game.pattern[game.patternIndex]) game.score += 25;
    else game.score = Math.max(0, game.score - 15);
    game.patternIndex += 1;
    if (game.patternIndex >= game.pattern.length) completeGame(game);
  }
  return game;
}

export function isGatheringGameComplete(game: GatheringGameState): boolean {
  return game.phase === "complete";
}

export function getGatheringScore(game: GatheringGameState): number {
  return Math.min(100, Math.max(0, game.score));
}

function isRare(rarity: GatheringRarity): boolean {
  return rarity === "rare" || rarity === "epic" || rarity === "legendary";
}

function appendHistory(
  state: GatheringState,
  pending: PendingGathering,
  success: boolean,
  quantity: number,
): void {
  state.history.push({
    instanceId: pending.instanceId,
    nodeId: pending.nodeId,
    discipline: pending.discipline,
    resourceId: pending.resourceId,
    outcomeId: pending.outcomeId,
    quantity,
    rarity: pending.rarity,
    success,
  });
  if (state.history.length > GATHERING_HISTORY_LIMIT) {
    state.history.splice(0, state.history.length - GATHERING_HISTORY_LIMIT);
  }
}

function applyNodeCooldown(state: GatheringState, pending: PendingGathering): void {
  const definition = GATHERING_DEFINITIONS[pending.discipline];
  const current = state.nodeStates[pending.nodeId] ?? {
    attempts: 0,
    cooldownRemaining: 0,
  };
  current.attempts += 1;
  const depleted = current.attempts % definition.attemptsBeforeDepletion === 0;
  current.cooldownRemaining = depleted
    ? definition.depletedCooldownSteps
    : definition.baseCooldownSteps;
  state.nodeStates[pending.nodeId] = current;
}

export function resolveGatheringGame(player: PlayerState): GatheringResolution {
  const state = player.progression.gathering;
  const pending = state.pending;
  if (!pending || pending.phase !== "playing" || !isGatheringGameComplete(pending.game)) {
    return {
      resolved: false,
      success: false,
      score: 0,
      quantity: 0,
      message: "Gathering is not ready to resolve.",
    };
  }
  const score = getGatheringScore(pending.game);
  const success = score >= 50
    && !(pending.game.kind === "fishing" && pending.game.failed);
  const stats = state.stats[pending.discipline];
  stats.bestScore = Math.max(stats.bestScore, score);
  applyNodeCooldown(state, pending);
  if (!success) {
    stats.failures += 1;
    appendHistory(state, pending, false, 0);
    state.pending = null;
    return {
      resolved: true,
      success: false,
      score,
      quantity: 0,
      message: `${GATHERING_DEFINITIONS[pending.discipline].name} attempt failed.`,
    };
  }
  const outcome = getGatheringOutcome(pending.outcomeId);
  if (outcome?.battleMonsterId) {
    const monster = getMonster(outcome.battleMonsterId);
    if (!monster) throw new Error(`[gathering] Unknown battle monster ${outcome.battleMonsterId}`);
    pending.phase = "battle";
    const encounter = createSoloEncounter(monster);
    return {
      resolved: true,
      success: true,
      score,
      quantity: 0,
      rarity: pending.rarity,
      battle: {
        ...encounter,
        id: `gathering:${pending.instanceId}`,
        name: `Gathering: ${encounter.name}`,
      },
      message: `${monster.name} bursts from the gathering site!`,
    };
  }
  return claimGatheringReward(player, true);
}

export function claimGatheringReward(
  player: PlayerState,
  battleVictory: boolean,
): GatheringResolution {
  const state = player.progression.gathering;
  const pending = state.pending;
  if (!pending || (pending.phase === "battle" && !battleVictory)) {
    if (pending?.phase === "battle") {
      state.stats[pending.discipline].failures += 1;
      appendHistory(state, pending, false, 0);
      state.pending = null;
    }
    return {
      resolved: pending !== null,
      success: false,
      score: pending ? getGatheringScore(pending.game) : 0,
      quantity: 0,
      message: pending ? "The rare find escaped." : "No gathering reward is pending.",
    };
  }
  if (state.claimedOutcomeIds.includes(pending.instanceId)) {
    state.pending = null;
    return {
      resolved: false,
      success: false,
      score: getGatheringScore(pending.game),
      quantity: 0,
      message: "This gathering reward was already claimed.",
    };
  }
  const resource = getGatheringResource(pending.resourceId);
  const item = resource ? getItem(resource.itemId) : undefined;
  if (!resource || !item) throw new Error(`[gathering] Missing item for ${pending.resourceId}`);
  for (let index = 0; index < pending.quantity; index += 1) {
    player.inventory.push({ ...item });
  }
  state.claimedOutcomeIds.push(pending.instanceId);
  if (!state.discoveredResourceIds.includes(resource.id)) {
    state.discoveredResourceIds.push(resource.id);
  }
  const stats = state.stats[pending.discipline];
  stats.successes += 1;
  if (isRare(resource.rarity)) stats.rareFinds += 1;
  appendHistory(state, pending, true, pending.quantity);
  const result: GatheringResolution = {
    resolved: true,
    success: true,
    score: getGatheringScore(pending.game),
    itemId: item.id,
    resourceId: resource.id,
    quantity: pending.quantity,
    rarity: resource.rarity,
    message: `Gathered ${pending.quantity}x ${item.name}.`,
  };
  state.pending = null;
  return result;
}

export function tickGatheringCooldowns(player: PlayerState): void {
  for (const nodeState of Object.values(player.progression.gathering.nodeStates)) {
    nodeState.cooldownRemaining = Math.max(0, nodeState.cooldownRemaining - 1);
  }
}

export function resetGatheringState(
  player: PlayerState,
  seed?: number,
): void {
  player.progression.gathering = createGatheringState(seed);
}

export function getGatheringStatusLines(player: PlayerState): string[] {
  const state = player.progression.gathering;
  const lines = GATHERING_DISCIPLINES.map((discipline) => {
    const stats = state.stats[discipline];
    return `${GATHERING_DEFINITIONS[discipline].name}: ${stats.successes}/${stats.attempts} successes, ${stats.rareFinds} rare, best ${stats.bestScore}`;
  });
  lines.push(`Resources discovered: ${state.discoveredResourceIds.length}`);
  return lines;
}

const UNSAFE_APPROACH_TERRAINS = new Set<Terrain>([
  Terrain.Town,
  Terrain.Dungeon,
  Terrain.Boss,
  Terrain.Chest,
  Terrain.MinorTreasure,
  Terrain.CityExit,
  Terrain.CityGate,
  Terrain.DungeonExit,
  Terrain.DungeonStairs,
  Terrain.DungeonBoss,
]);

export function movePlayerNearGatheringNode(
  player: PlayerState,
  discipline: GatheringDiscipline,
): GatheringNode | undefined {
  const originalPosition = { ...player.position };
  const scanCurrentMap = (): GatheringNode | undefined => {
    const resolved = getResolvedMap(player.position);
    if (!resolved) return undefined;
    for (let y = 0; y < MAP_HEIGHT; y += 1) {
      for (let x = 0; x < MAP_WIDTH; x += 1) {
        const terrain = resolved.map[y]?.[x];
        if (
          terrain === undefined
          || !isWalkable(terrain)
          || UNSAFE_APPROACH_TERRAINS.has(terrain)
        ) {
          continue;
        }
        player.position.x = x;
        player.position.y = y;
        const node = findGatheringNodes(player).find(
          (candidate) => candidate.discipline === discipline,
        );
        if (node) return node;
      }
    }
    return undefined;
  };

  let node = scanCurrentMap();
  if (!node && !originalPosition.inCity && !originalPosition.inDungeon) {
    for (let chunkY = 0; chunkY < WORLD_HEIGHT && !node; chunkY += 1) {
      for (let chunkX = 0; chunkX < WORLD_WIDTH && !node; chunkX += 1) {
        if (!getChunk(chunkX, chunkY)) continue;
        player.position.chunkX = chunkX;
        player.position.chunkY = chunkY;
        player.position.x = 0;
        player.position.y = 0;
        node = scanCurrentMap();
      }
    }
  }
  if (!node) {
    Object.assign(player.position, originalPosition);
    return undefined;
  }
  player.progression.gathering.nodeStates[node.id] = {
    attempts: 0,
    cooldownRemaining: 0,
  };
  return node;
}
