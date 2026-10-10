import {
  DEVOTION_HISTORY_LIMIT,
  DEVOTION_SAVE_VERSION,
  DEVOTION_SCORE_MAX,
  isDeityId,
  isDevotionSourceId,
  isTempleId,
  getDevotionSource,
  type DeityId,
  type DevotionSourceId,
  type TempleId,
} from "../data/devotion";

export interface DevotionCause {
  sourceId: string;
  deityId: DeityId | null;
  delta: number;
  score: number;
  debug: boolean;
}

export interface DevotionState {
  deityId: DeityId | null;
  score: number;
  appliedSourceIds: DevotionSourceId[];
  visitedTempleIds: TempleId[];
  debugSourceIds: DevotionSourceId[];
  affiliationChanges: number;
  history: DevotionCause[];
}

export function createDevotionState(): DevotionState {
  return {
    deityId: null,
    score: 0,
    appliedSourceIds: [],
    visitedTempleIds: [],
    debugSourceIds: [],
    affiliationChanges: 0,
    history: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function integer(value: unknown, minimum: number, maximum: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, Math.trunc(value)))
    : 0;
}

function isAffiliationCause(
  sourceId: string,
  deityId: DeityId | null,
  changes: number,
): boolean {
  const match = /^affiliation:(\d+):(orivane|selquor|tessune|none)$/.exec(sourceId);
  if (!match) return false;
  const sequence = Number(match[1]);
  return sequence > 0 && sequence <= changes
    && match[2] === (deityId ?? "none");
}

/** Validate authority only; never reconstruct devotion scores from historical choices. */
export function normalizeDevotionState(
  value: unknown,
  sourceVersion = DEVOTION_SAVE_VERSION,
): DevotionState {
  if (sourceVersion < DEVOTION_SAVE_VERSION || !isRecord(value)) {
    return createDevotionState();
  }
  const deityId = isDeityId(value["deityId"]) ? value["deityId"] : null;
  const appliedSourceIds = Array.isArray(value["appliedSourceIds"])
    ? [...new Set(value["appliedSourceIds"].filter(isDevotionSourceId))]
    : [];
  const applied = new Set(appliedSourceIds);
  const state: DevotionState = {
    deityId,
    score: deityId ? integer(value["score"], 0, DEVOTION_SCORE_MAX) : 0,
    appliedSourceIds,
    visitedTempleIds: Array.isArray(value["visitedTempleIds"])
      ? [...new Set(value["visitedTempleIds"].filter(isTempleId))]
      : [],
    debugSourceIds: Array.isArray(value["debugSourceIds"])
      ? [...new Set(value["debugSourceIds"].filter(isDevotionSourceId))]
        .filter((id) => applied.has(id))
      : [],
    affiliationChanges: integer(value["affiliationChanges"], 0, 1_000_000),
    history: [],
  };
  const seen = new Set<string>();
  if (Array.isArray(value["history"])) {
    for (const candidate of value["history"]) {
      if (!isRecord(candidate)) continue;
      const sourceId = candidate["sourceId"];
      const causeDeity = isDeityId(candidate["deityId"])
        ? candidate["deityId"] : null;
      if (
        typeof sourceId !== "string" || seen.has(sourceId)
        || (!(isDevotionSourceId(sourceId) && applied.has(sourceId))
          && !isAffiliationCause(sourceId, causeDeity, state.affiliationChanges))
      ) {
        continue;
      }
      const debug = isDevotionSourceId(sourceId)
        && state.debugSourceIds.includes(sourceId);
      const score = causeDeity ? integer(candidate["score"], 0, DEVOTION_SCORE_MAX) : 0;
      const delta = debug ? 0
        : isDevotionSourceId(sourceId) && !causeDeity ? 0
        : candidate["delta"];
      if (typeof delta !== "number" || !Number.isInteger(delta)
        || score - delta < 0 || score - delta > DEVOTION_SCORE_MAX) continue;
      if (isDevotionSourceId(sourceId) && causeDeity && !debug) {
        const requested = getDevotionSource(sourceId).deltas[causeDeity];
        if (requested >= 0 ? delta < 0 || delta > requested : delta > 0 || delta < requested) continue;
      }
      seen.add(sourceId);
      state.history.push({
        sourceId,
        deityId: causeDeity,
        delta,
        score,
        debug,
      });
    }
  }
  state.history = state.history.slice(-DEVOTION_HISTORY_LIMIT);
  return state;
}
