import {
  DEVOTION_DOMAINS,
  DEVOTION_HISTORY_LIMIT,
  DEVOTION_SCORE_MAX,
  DEVOTION_SOURCE_DEFINITIONS,
  DEVOTION_TIERS,
  getDeity,
  getDevotionSource,
  isDevotionSourceId,
  type DeityId,
  type DevotionDomainId,
  type DevotionSourceId,
  type DevotionTierId,
} from "../data/devotion";
import type { PlayerState } from "./player";
import type { DevotionCause, DevotionState } from "./devotionState";
import type { QuestLogState } from "../data/quests";

const debugMutations = new WeakSet<PlayerState>();

export interface DevotionMutationResult {
  readonly changed: boolean;
  readonly delta: number;
  readonly message: string;
}

export interface DevotionRequirement {
  readonly deityId?: DeityId;
  readonly domainId?: DevotionDomainId;
  readonly minimumScore?: number;
  readonly minimumTier?: DevotionTierId;
  readonly requireAffiliation?: boolean;
}

export interface DevotionQualification {
  readonly eligible: boolean;
  readonly deityId: DeityId | null;
  readonly domainIds: readonly DevotionDomainId[];
  readonly score: number;
  readonly tierId: DevotionTierId | null;
  readonly reasons: readonly string[];
}

export function getDevotionTier(score: number): (typeof DEVOTION_TIERS)[number] {
  const bounded = Number.isFinite(score)
    ? Math.min(DEVOTION_SCORE_MAX, Math.max(0, Math.trunc(score))) : 0;
  return [...DEVOTION_TIERS].reverse().find((tier) => bounded >= tier.minimum)!;
}

export function getDevotionProgress(state: DevotionState): {
  tier: (typeof DEVOTION_TIERS)[number] | null;
  nextTier: (typeof DEVOTION_TIERS)[number] | null;
  current: number;
  target: number;
} {
  if (!state.deityId) return { tier: null, nextTier: null, current: 0, target: 0 };
  const tier = getDevotionTier(state.score);
  const nextTier = DEVOTION_TIERS.find((entry) => entry.minimum > state.score) ?? null;
  return {
    tier,
    nextTier,
    current: state.score - tier.minimum,
    target: (nextTier?.minimum ?? DEVOTION_SCORE_MAX) - tier.minimum,
  };
}

export function appendDevotionCause(state: DevotionState, cause: DevotionCause): void {
  state.history.push(cause);
  if (state.history.length > DEVOTION_HISTORY_LIMIT) {
    state.history.splice(0, state.history.length - DEVOTION_HISTORY_LIMIT);
  }
}

/** Only canonical, once-per-campaign sources can change devotion. */
export function applyDevotionSource(
  player: PlayerState,
  sourceId: string,
  options: { debug?: boolean } = {},
): DevotionMutationResult {
  if (!isDevotionSourceId(sourceId)) {
    throw new Error(`[devotion] Unknown devotion source: ${sourceId}`);
  }
  const state = player.progression.devotion;
  if (state.appliedSourceIds.includes(sourceId)) {
    return { changed: false, delta: 0, message: "This devotion cause is already recorded." };
  }
  const source = getDevotionSource(sourceId);
  const debug = options.debug === true
    || player.progression.achievements.debugMutationActive
    || debugMutations.has(player);
  const before = state.score;
  const requested = state.deityId && !debug ? source.deltas[state.deityId] : 0;
  state.score = state.deityId
    ? Math.min(DEVOTION_SCORE_MAX, Math.max(0, before + requested)) : 0;
  state.appliedSourceIds.push(sourceId);
  if (debug) state.debugSourceIds.push(sourceId);
  const delta = state.score - before;
  appendDevotionCause(state, {
    sourceId, deityId: state.deityId, delta, score: state.score, debug,
  });
  const context = debug ? "debug cause; no devotion awarded"
    : state.deityId ? `${delta >= 0 ? "+" : ""}${delta} devotion (${state.score}/${DEVOTION_SCORE_MAX})`
    : "unaffiliated; no devotion awarded";
  return { changed: true, delta, message: `${source.cause}: ${context}.` };
}

export function withDevotionDebugMutation<T>(player: PlayerState, mutation: () => T): T {
  const alreadyActive = debugMutations.has(player);
  debugMutations.add(player);
  try {
    return mutation();
  } finally {
    if (!alreadyActive) debugMutations.delete(player);
  }
}

/** A read-only extension point; callers cannot use lore or social labels as authority. */
export function getDevotionQualification(
  player: PlayerState,
  requirement: DevotionRequirement,
): DevotionQualification {
  const state = player.progression.devotion;
  const deity = state.deityId ? getDeity(state.deityId) : null;
  const tier = deity ? getDevotionTier(state.score) : null;
  const reasons: string[] = [];
  const minimumScore = requirement.minimumScore ?? 0;
  if (!Number.isInteger(minimumScore) || minimumScore < 0 || minimumScore > DEVOTION_SCORE_MAX) {
    throw new Error("[devotion] A prerequisite score must be an integer from 0 to 100");
  }
  if (requirement.requireAffiliation && !deity) reasons.push("Choose an affiliation.");
  if (requirement.deityId && requirement.deityId !== state.deityId) {
    reasons.push(`Follow ${getDeity(requirement.deityId).name}.`);
  }
  if (requirement.domainId && !deity?.domainIds.includes(requirement.domainId)) {
    reasons.push(`Follow a figure with the ${DEVOTION_DOMAINS.find(
      (domain) => domain.id === requirement.domainId,
    )!.name} domain.`);
  }
  if (state.score < minimumScore) reasons.push(`Reach ${minimumScore} devotion.`);
  if (requirement.minimumTier) {
    const minimum = DEVOTION_TIERS.find((entry) => entry.id === requirement.minimumTier)!;
    if (!tier || tier.minimum < minimum.minimum) reasons.push(`Reach ${minimum.name} devotion.`);
  }
  return {
    eligible: reasons.length === 0,
    deityId: state.deityId,
    domainIds: deity?.domainIds ?? [],
    score: state.score,
    tierId: tier?.id ?? null,
    reasons,
  };
}

export function meetsDevotionRequirement(
  player: PlayerState,
  requirement: DevotionRequirement,
): boolean {
  return getDevotionQualification(player, requirement).eligible;
}

export function recordDevotionQuestCompletion(
  player: PlayerState,
  questId: string,
): readonly DevotionMutationResult[] {
  return DEVOTION_SOURCE_DEFINITIONS.filter((source) =>
    source.trigger.type === "questCompletion" && source.trigger.questId === questId
  ).map((source) => applyDevotionSource(player, source.id));
}

export function recordDevotionWorldEventOutcome(
  player: PlayerState,
  eventId: string,
  outcomeId: string,
  debug = false,
): readonly DevotionMutationResult[] {
  return DEVOTION_SOURCE_DEFINITIONS.filter((source) =>
    source.trigger.type === "worldEventOutcome"
    && source.trigger.eventId === eventId && source.trigger.outcomeId === outcomeId
  ).map((source) => applyDevotionSource(player, source.id, { debug }));
}

/** Mark exact historical evidence consumed, without awarding or inferring past devotion. */
export function consumeHistoricalDevotionSources(
  state: DevotionState,
  quests: QuestLogState,
  eventLog: readonly { eventId: string; outcomeId: string }[],
): void {
  for (const source of DEVOTION_SOURCE_DEFINITIONS) {
    const trigger = source.trigger;
    const known = trigger.type === "questCompletion"
      ? quests.quests[trigger.questId]?.status === "completed"
      : trigger.type === "worldEventOutcome" && eventLog.some((entry) =>
        entry.eventId === trigger.eventId && entry.outcomeId === trigger.outcomeId);
    if (known && !state.appliedSourceIds.includes(source.id)) {
      state.appliedSourceIds.push(source.id);
    }
  }
}

export function describeDevotionCause(cause: DevotionCause): string {
  if (isDevotionSourceId(cause.sourceId)) {
    const definition = getDevotionSource(cause.sourceId);
    const result = cause.debug ? "[DEBUG] no points"
      : cause.deityId ? `${cause.delta >= 0 ? "+" : ""}${cause.delta}; ${cause.score}/100`
      : "unaffiliated; no points";
    return `${definition.cause} (${result})`;
  }
  return `Chose ${cause.deityId ? getDeity(cause.deityId).name : "no affiliation"}.`;
}

export function getDevotionEndingText(player: PlayerState): string {
  const state = player.progression.devotion;
  return state.deityId
    ? `${getDeity(state.deityId).ending} ${getDevotionTier(state.score).name}: ${state.score}/100 devotion.`
    : "Your road remains your own. The Unfinished Constellation asks no affiliation of the hero who restored the covenant.";
}

export function getDevotionSourceIdsForQuest(questId: string): readonly DevotionSourceId[] {
  return DEVOTION_SOURCE_DEFINITIONS.filter((source) =>
    source.trigger.type === "questCompletion" && source.trigger.questId === questId
  ).map((source) => source.id);
}
