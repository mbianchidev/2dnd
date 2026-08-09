import {
  GATHERING_DISCIPLINES,
  GATHERING_RARITIES,
  getGatheringOutcome,
  getGatheringResource,
  type GatheringDiscipline,
  type GatheringRarity,
} from "../data/gathering";
import { Terrain } from "../data/mapTypes";
import {
  GATHERING_HISTORY_LIMIT,
  LEGACY_GATHERING_SEED,
  createGatheringState,
  type GatheringDirection,
  type GatheringGameState,
  type GatheringHistoryEntry,
  type GatheringLocation,
  type GatheringState,
  type PendingGathering,
} from "./gathering";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

function uniqueStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((entry): entry is string => typeof entry === "string"))]
    : [];
}

function isDiscipline(value: unknown): value is GatheringDiscipline {
  return typeof value === "string"
    && (GATHERING_DISCIPLINES as readonly string[]).includes(value);
}

function isRarity(value: unknown): value is GatheringRarity {
  return typeof value === "string"
    && (GATHERING_RARITIES as readonly string[]).includes(value);
}

function isDirection(value: unknown): value is GatheringDirection {
  return value === "up" || value === "right" || value === "down" || value === "left";
}

function normalizePattern(value: unknown): GatheringDirection[] {
  return Array.isArray(value) ? value.filter(isDirection).slice(0, 8) : [];
}

function normalizeGame(
  value: unknown,
  discipline: GatheringDiscipline,
): GatheringGameState | undefined {
  if (!isRecord(value) || value["kind"] !== discipline) return undefined;
  if (discipline === "fishing") {
    const pattern = normalizePattern(value["tensionPattern"]);
    if (pattern.length === 0) return undefined;
    const phases = ["waiting", "bite", "tension", "complete"] as const;
    const phase = phases.find((candidate) => candidate === value["phase"]);
    if (!phase) return undefined;
    return {
      kind: "fishing",
      phase,
      biteAt: Math.max(1, Math.min(6, nonNegativeInteger(value["biteAt"]))),
      waitTicks: Math.min(8, nonNegativeInteger(value["waitTicks"])),
      tensionPattern: pattern,
      patternIndex: Math.min(pattern.length, nonNegativeInteger(value["patternIndex"])),
      score: Math.min(100, nonNegativeInteger(value["score"])),
      failed: value["failed"] === true,
    };
  }
  if (discipline === "mining") {
    const pattern = normalizePattern(value["pattern"]);
    const selected = isDirection(value["selected"]) ? value["selected"] : "up";
    if (pattern.length === 0) return undefined;
    return {
      kind: "mining",
      phase: value["phase"] === "complete" ? "complete" : "striking",
      pattern,
      patternIndex: Math.min(pattern.length, nonNegativeInteger(value["patternIndex"])),
      selected,
      score: Math.min(100, nonNegativeInteger(value["score"])),
    };
  }
  const pattern = normalizePattern(value["pattern"]);
  if (pattern.length === 0) return undefined;
  return {
    kind: "foraging",
    phase: value["phase"] === "select"
      ? "select"
      : value["phase"] === "complete"
        ? "complete"
        : "reveal",
    pattern,
    revealIndex: Math.min(pattern.length, nonNegativeInteger(value["revealIndex"])),
    patternIndex: Math.min(pattern.length, nonNegativeInteger(value["patternIndex"])),
    score: Math.min(100, nonNegativeInteger(value["score"])),
  };
}

function normalizeLocation(value: unknown): GatheringLocation | undefined {
  if (!isRecord(value)) return undefined;
  const context = value["context"];
  const terrain = value["terrain"];
  if (
    (context !== "overworld" && context !== "city" && context !== "dungeon")
    || typeof terrain !== "number"
    || !Number.isInteger(terrain)
    || Terrain[terrain] === undefined
  ) {
    return undefined;
  }
  const coordinates = [
    value["playerX"],
    value["playerY"],
    value["targetX"],
    value["targetY"],
    value["sublevel"],
  ];
  if (!coordinates.every((entry) => typeof entry === "number" && Number.isInteger(entry))) {
    return undefined;
  }
  return {
    context,
    contextId: typeof value["contextId"] === "string" ? value["contextId"] : "",
    sublevel: Math.max(0, value["sublevel"] as number),
    playerX: value["playerX"] as number,
    playerY: value["playerY"] as number,
    targetX: value["targetX"] as number,
    targetY: value["targetY"] as number,
    terrain: terrain as Terrain,
    biome: typeof value["biome"] === "string" ? value["biome"].slice(0, 80) : "",
  };
}

function normalizePending(value: unknown): PendingGathering | null {
  if (!isRecord(value) || !isDiscipline(value["discipline"])) return null;
  const discipline = value["discipline"];
  const outcome = typeof value["outcomeId"] === "string"
    ? getGatheringOutcome(value["outcomeId"])
    : undefined;
  const resource = typeof value["resourceId"] === "string"
    ? getGatheringResource(value["resourceId"])
    : undefined;
  const location = normalizeLocation(value["location"]);
  const game = normalizeGame(value["game"], discipline);
  if (
    !outcome
    || !resource
    || outcome.resourceId !== resource.id
    || resource.discipline !== discipline
    || !location
    || !game
  ) {
    return null;
  }
  const phase = value["phase"] === "battle" ? "battle" : "playing";
  if (phase === "battle" && !outcome.battleMonsterId) return null;
  return {
    instanceId: typeof value["instanceId"] === "string" ? value["instanceId"] : "",
    nodeId: typeof value["nodeId"] === "string" ? value["nodeId"] : "",
    discipline,
    outcomeId: outcome.id,
    resourceId: resource.id,
    quantity: Math.max(1, Math.min(5, nonNegativeInteger(value["quantity"]))),
    rarity: resource.rarity,
    phase,
    reducedMotion: value["reducedMotion"] === true,
    debug: value["debug"] === true,
    location,
    game,
  };
}

export function normalizeGatheringState(
  value: unknown,
  sourceVersion: number,
): GatheringState {
  if (sourceVersion < 14 || !isRecord(value)) return createGatheringState();
  const seedValid = typeof value["seed"] === "number"
    && Number.isSafeInteger(value["seed"])
    && value["seed"] > 0;
  const state = createGatheringState(
    seedValid ? value["seed"] as number : LEGACY_GATHERING_SEED,
  );
  state.sequence = nonNegativeInteger(value["sequence"]);
  if (seedValid && isRecord(value["nodeStates"])) {
    for (const [nodeId, raw] of Object.entries(value["nodeStates"])) {
      if (!isRecord(raw) || !nodeId.startsWith("g:")) continue;
      state.nodeStates[nodeId] = {
        attempts: nonNegativeInteger(raw["attempts"]),
        cooldownRemaining: Math.min(999, nonNegativeInteger(raw["cooldownRemaining"])),
      };
    }
  }
  state.discoveredNodeIds = seedValid
    ? uniqueStrings(value["discoveredNodeIds"]).filter((id) => id.startsWith("g:")).slice(-500)
    : [];
  state.discoveredResourceIds = uniqueStrings(value["discoveredResourceIds"])
    .filter((id) => getGatheringResource(id) !== undefined);
  state.claimedOutcomeIds = uniqueStrings(value["claimedOutcomeIds"]).slice(-500);
  const rawStats = isRecord(value["stats"]) ? value["stats"] : {};
  for (const discipline of GATHERING_DISCIPLINES) {
    const raw = isRecord(rawStats[discipline]) ? rawStats[discipline] : {};
    state.stats[discipline] = {
      attempts: nonNegativeInteger(raw["attempts"]),
      successes: nonNegativeInteger(raw["successes"]),
      failures: nonNegativeInteger(raw["failures"]),
      rareFinds: nonNegativeInteger(raw["rareFinds"]),
      bestScore: Math.min(100, nonNegativeInteger(raw["bestScore"])),
    };
  }
  state.pending = seedValid ? normalizePending(value["pending"]) : null;
  state.history = Array.isArray(value["history"])
    ? value["history"].flatMap((entry): GatheringHistoryEntry[] => {
      if (!isRecord(entry) || !isDiscipline(entry["discipline"])) return [];
      if (
        typeof entry["resourceId"] !== "string"
        || !getGatheringResource(entry["resourceId"])
        || typeof entry["outcomeId"] !== "string"
        || !getGatheringOutcome(entry["outcomeId"])
        || !isRarity(entry["rarity"])
      ) {
        return [];
      }
      return [{
        instanceId: typeof entry["instanceId"] === "string" ? entry["instanceId"] : "",
        nodeId: typeof entry["nodeId"] === "string" ? entry["nodeId"] : "",
        discipline: entry["discipline"],
        resourceId: entry["resourceId"],
        outcomeId: entry["outcomeId"],
        quantity: Math.max(0, Math.min(5, nonNegativeInteger(entry["quantity"]))),
        rarity: entry["rarity"],
        success: entry["success"] === true,
      }];
    }).slice(-GATHERING_HISTORY_LIMIT)
    : [];
  return state;
}
