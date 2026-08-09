import {
  WORLD_EVENT_DEFINITIONS,
  WORLD_EVENT_TRIGGER_RULES,
  getWorldEventDefinition,
  type WorldEventBattleChoice,
  type WorldEventChoiceDefinition,
  type WorldEventDefinition,
  type WorldEventOutcomeDefinition,
} from "../data/worldEvents";
import { getItem } from "../data/items";
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "../data/map";
import { Terrain } from "../data/mapTypes";
import { QUEST_IDS, type QuestId } from "../data/quests";
import { TimePeriod } from "./daynight";
import { WeatherType } from "./weather";
import { awardXP, type PlayerState } from "./player";
import { applyNonlethalDamage, rollSkillCheck } from "./skillChecks";
import {
  getQuestProgress,
  startQuestById,
  type QuestUpdate,
} from "./quests";
import {
  unlockCodexFromFutureSignal,
  type CodexData,
  type CodexUnlockResult,
} from "./codex";
import { getMonster } from "../data/monsters";
import { createSoloEncounter, type MonsterEncounter } from "../data/monsterGroups";
import type { BattleOutcome } from "./groupCombat";
import {
  applySocialMutation,
  getAlignmentName,
  getReputationScore,
  type SocialMutationResult,
  type SocialState,
} from "./reputation";
import {
  consumeSocialAchievementHooks,
  consumeWorldEventDebugFlag,
  reconcileAchievements,
  recordAchievementEvent,
} from "./achievements";
import { discoverCraftingRecipes } from "./crafting";

export const WORLD_EVENT_LOG_LIMIT = 40;
export const LEGACY_WORLD_EVENT_SEED = 0x2d0d0069;

export interface WorldEventLocation {
  chunkX: number;
  chunkY: number;
  x: number;
  y: number;
  areaName: string;
  terrain: Terrain;
}

export interface PendingWorldEvent {
  instanceId: string;
  eventId: string;
  phase: "choice" | "battle";
  selectedChoiceId?: string;
  location: WorldEventLocation;
  timeStep: number;
  period: TimePeriod;
  weather: WeatherType;
}

export interface WorldEventLogEntry {
  instanceId: string;
  eventId: string;
  family: WorldEventDefinition["family"];
  title: string;
  source: string;
  location: WorldEventLocation;
  timeStep: number;
  period: TimePeriod;
  weather: WeatherType;
  choiceId: string;
  outcomeId: string;
  outcome: string;
}

export interface WorldEventState {
  seed: number;
  rollCounter: number;
  triggerCount: number;
  cooldownRemaining: number;
  stepsSinceLastEvent: number;
  pending: PendingWorldEvent | null;
  resolvedOutcomeIds: string[];
  claimedRewardIds: string[];
  repeatCounters: Record<string, number>;
  log: WorldEventLogEntry[];
}

export interface WorldEventContext {
  location: WorldEventLocation;
  level: number;
  timeStep: number;
  period: TimePeriod;
  weather: WeatherType;
  quests: PlayerState["progression"]["quests"];
  defeatedBosses: ReadonlySet<string>;
  social: SocialState;
}

export interface WorldEventTriggerResult {
  triggered: boolean;
  pending?: PendingWorldEvent;
  chance: number;
  eligibleEventIds: readonly string[];
}

export interface WorldEventResolution {
  resolved: boolean;
  summary: string;
  questUpdates: readonly QuestUpdate[];
  codexUnlocks: CodexUnlockResult;
  socialEffects: readonly SocialMutationResult[];
}

export type OverworldStepTrigger =
  | "worldEvent"
  | "treasure"
  | "skillCheck"
  | "encounter"
  | "none";

export interface OverworldStepTriggerCallbacks {
  worldEvent(): boolean;
  treasure(): boolean;
  skillCheck(): boolean;
  encounter(): boolean;
}

/**
 * Resolve mutually exclusive post-movement flows after transitions, entrances,
 * traps, interactions, and queued cutscenes have already short-circuited.
 */
export function resolveOverworldStepTrigger(
  callbacks: OverworldStepTriggerCallbacks,
): OverworldStepTrigger {
  if (callbacks.worldEvent()) return "worldEvent";
  if (callbacks.treasure()) return "treasure";
  if (callbacks.skillCheck()) return "skillCheck";
  if (callbacks.encounter()) return "encounter";
  return "none";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= 0;
}

function isTerrain(value: unknown): value is Terrain {
  return typeof value === "number"
    && Number.isInteger(value)
    && Terrain[value] !== undefined;
}

function isTimePeriod(value: unknown): value is TimePeriod {
  return Object.values(TimePeriod).includes(value as TimePeriod);
}

function isWeatherType(value: unknown): value is WeatherType {
  return Object.values(WeatherType).includes(value as WeatherType);
}

function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) || LEGACY_WORLD_EVENT_SEED;
}

export function createWorldEventState(seed = randomSeed()): WorldEventState {
  return {
    seed: Number.isSafeInteger(seed) && seed > 0
      ? seed
      : LEGACY_WORLD_EVENT_SEED,
    rollCounter: 0,
    triggerCount: 0,
    cooldownRemaining: 0,
    stepsSinceLastEvent: 0,
    pending: null,
    resolvedOutcomeIds: [],
    claimedRewardIds: [],
    repeatCounters: {},
    log: [],
  };
}

function seededFraction(seed: number, counter: number, salt: number): number {
  let value = (seed ^ Math.imul(counter + 1, 0x9e3779b1) ^ salt) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 0x100000000;
}

function questConditionMatches(
  context: WorldEventContext,
  condition: NonNullable<
    WorldEventDefinition["eligibility"]["questConditions"]
  >[number],
): boolean {
  const progress = context.quests.quests[condition.questId];
  if (!progress) return false;
  if (condition.statuses && !condition.statuses.includes(progress.status)) {
    return false;
  }
  if (condition.minStage !== undefined && progress.stage < condition.minStage) {
    return false;
  }
  if (condition.maxStage !== undefined && progress.stage > condition.maxStage) {
    return false;
  }
  return true;
}

export function isWorldEventEligible(
  event: WorldEventDefinition,
  state: WorldEventState,
  context: WorldEventContext,
): boolean {
  const eligibility = event.eligibility;
  const repeats = state.repeatCounters[event.id] ?? 0;
  if (event.maxRepeats !== undefined && repeats >= event.maxRepeats) return false;
  if (
    eligibility.terrains
    && !eligibility.terrains.includes(context.location.terrain)
  ) {
    return false;
  }
  if (
    eligibility.alignmentNames
    && !eligibility.alignmentNames.includes(getAlignmentName(context.social.alignment))
  ) {
    return false;
  }
  if (
    eligibility.reputationConditions
    && !eligibility.reputationConditions.every((condition) => {
      const score = getReputationScore(
        context.social,
        condition.kind,
        condition.targetId,
      );
      return score >= condition.minimum
        && (condition.maximum === undefined || score <= condition.maximum);
    })
  ) {
    return false;
  }
  if (
    eligibility.areaPrefixes
    && !eligibility.areaPrefixes.some((prefix) =>
      context.location.areaName.startsWith(prefix)
    )
  ) {
    return false;
  }
  if (eligibility.periods && !eligibility.periods.includes(context.period)) {
    return false;
  }
  if (eligibility.weather && !eligibility.weather.includes(context.weather)) {
    return false;
  }
  if (eligibility.minLevel !== undefined && context.level < eligibility.minLevel) {
    return false;
  }
  if (eligibility.maxLevel !== undefined && context.level > eligibility.maxLevel) {
    return false;
  }
  if (
    eligibility.questConditions
    && !eligibility.questConditions.every((condition) =>
      questConditionMatches(context, condition)
    )
  ) {
    return false;
  }
  if (
    eligibility.requiredDefeatedBossIds
    && !eligibility.requiredDefeatedBossIds.every((bossId) =>
      context.defeatedBosses.has(bossId)
    )
  ) {
    return false;
  }
  if (
    eligibility.excludedDefeatedBossIds?.some((bossId) =>
      context.defeatedBosses.has(bossId)
    )
  ) {
    return false;
  }
  return true;
}

export function getWorldEventChance(context: WorldEventContext): number {
  const periodMultiplier =
    WORLD_EVENT_TRIGGER_RULES.periodMultipliers[context.period];
  const weatherMultiplier =
    WORLD_EVENT_TRIGGER_RULES.weatherMultipliers[context.weather];
  return Math.min(
    WORLD_EVENT_TRIGGER_RULES.maxChance,
    WORLD_EVENT_TRIGGER_RULES.baseChance
      * periodMultiplier
      * weatherMultiplier,
  );
}

function chooseWeightedEvent(
  events: readonly WorldEventDefinition[],
  roll: number,
): WorldEventDefinition | undefined {
  const totalWeight = events.reduce((sum, event) => sum + event.weight, 0);
  if (totalWeight <= 0) return undefined;
  let threshold = roll * totalWeight;
  for (const event of events) {
    threshold -= event.weight;
    if (threshold < 0) return event;
  }
  return events[events.length - 1];
}

function createPendingEvent(
  state: WorldEventState,
  event: WorldEventDefinition,
  context: WorldEventContext,
): PendingWorldEvent {
  state.triggerCount++;
  const pending: PendingWorldEvent = {
    instanceId: `${event.id}:${state.triggerCount}`,
    eventId: event.id,
    phase: "choice",
    location: { ...context.location },
    timeStep: context.timeStep,
    period: context.period,
    weather: context.weather,
  };
  state.pending = pending;
  state.cooldownRemaining = event.cooldownSteps;
  state.stepsSinceLastEvent = 0;
  return pending;
}

export function rollWorldEvent(
  state: WorldEventState,
  context: WorldEventContext,
): WorldEventTriggerResult {
  if (state.pending) {
    return {
      triggered: false,
      chance: 0,
      eligibleEventIds: [],
    };
  }

  state.rollCounter++;
  state.stepsSinceLastEvent++;
  if (state.cooldownRemaining > 0) {
    state.cooldownRemaining--;
    return {
      triggered: false,
      chance: 0,
      eligibleEventIds: [],
    };
  }

  const eligible = WORLD_EVENT_DEFINITIONS.filter((event) =>
    isWorldEventEligible(event, state, context)
  );
  const chance = getWorldEventChance(context);
  const eligibleEventIds = eligible.map((event) => event.id);
  if (
    eligible.length === 0
    || seededFraction(state.seed, state.rollCounter, 0x69) >= chance
  ) {
    return { triggered: false, chance, eligibleEventIds };
  }

  const selected = chooseWeightedEvent(
    eligible,
    seededFraction(state.seed, state.rollCounter, 0x70617468),
  );
  if (!selected) return { triggered: false, chance, eligibleEventIds };
  return {
    triggered: true,
    pending: createPendingEvent(state, selected, context),
    chance,
    eligibleEventIds,
  };
}

export function forceWorldEvent(
  state: WorldEventState,
  eventId: string,
  context: WorldEventContext,
): PendingWorldEvent {
  const event = getWorldEventDefinition(eventId);
  if (!event) throw new Error(`[worldEvents] Unknown event ${eventId}`);
  if (state.pending) {
    throw new Error(
      `[worldEvents] Cannot force ${eventId} while ${state.pending.eventId} is pending`,
    );
  }
  return createPendingEvent(state, event, context);
}

function getPendingDefinition(
  state: WorldEventState,
): { pending: PendingWorldEvent; event: WorldEventDefinition } {
  const pending = state.pending;
  if (!pending) throw new Error("[worldEvents] No pending event");
  const event = getWorldEventDefinition(pending.eventId);
  if (!event) throw new Error(`[worldEvents] Unknown pending event ${pending.eventId}`);
  return { pending, event };
}

function getChoice(
  event: WorldEventDefinition,
  choiceId: string,
): WorldEventChoiceDefinition {
  const choice = event.choices.find((candidate) => candidate.id === choiceId);
  if (!choice) {
    throw new Error(`[worldEvents] Unknown choice ${choiceId} for ${event.id}`);
  }
  return choice;
}

function applyReward(
  player: PlayerState,
  state: WorldEventState,
  instanceId: string,
  reward: NonNullable<WorldEventOutcomeDefinition["rewards"]>[number],
): void {
  const claimId = `${instanceId}:${reward.id}`;
  if (state.claimedRewardIds.includes(claimId)) return;
  if (reward.type === "gold") {
    if (!Number.isInteger(reward.amount) || (reward.amount ?? 0) < 0) {
      throw new Error(`[worldEvents] Invalid gold reward ${reward.id}`);
    }
    player.gold += reward.amount ?? 0;
  } else if (reward.type === "xp") {
    if (!Number.isInteger(reward.amount) || (reward.amount ?? 0) < 0) {
      throw new Error(`[worldEvents] Invalid XP reward ${reward.id}`);
    }
    awardXP(player, reward.amount ?? 0);
  } else {
    const item = reward.itemId ? getItem(reward.itemId) : undefined;
    if (!item) {
      throw new Error(`[worldEvents] Unknown item reward ${reward.itemId ?? ""}`);
    }
    const quantity = Math.max(1, reward.quantity ?? 1);
    for (let index = 0; index < quantity; index++) {
      player.inventory.push({ ...item });
    }
    discoverCraftingRecipes(player, {
      type: "item",
      itemId: item.id,
    });
  }
  state.claimedRewardIds.push(claimId);
}

function appendLog(
  state: WorldEventState,
  event: WorldEventDefinition,
  pending: PendingWorldEvent,
  choiceId: string,
  outcome: WorldEventOutcomeDefinition,
): void {
  state.log.push({
    instanceId: pending.instanceId,
    eventId: event.id,
    family: event.family,
    title: event.title,
    source: event.source,
    location: { ...pending.location },
    timeStep: pending.timeStep,
    period: pending.period,
    weather: pending.weather,
    choiceId,
    outcomeId: outcome.id,
    outcome: outcome.summary,
  });
  if (state.log.length > WORLD_EVENT_LOG_LIMIT) {
    state.log.splice(0, state.log.length - WORLD_EVENT_LOG_LIMIT);
  }
}

function completeOutcome(
  player: PlayerState,
  codex: CodexData,
  defeatedBosses: ReadonlySet<string>,
  state: WorldEventState,
  event: WorldEventDefinition,
  pending: PendingWorldEvent,
  choiceId: string,
  outcome: WorldEventOutcomeDefinition,
): WorldEventResolution {
  const resolutionId = `${pending.instanceId}:${outcome.id}`;
  if (state.resolvedOutcomeIds.includes(resolutionId)) {
    return {
      resolved: false,
      summary: outcome.summary,
      questUpdates: [],
      codexUnlocks: { unlockedIds: [], entries: [] },
      socialEffects: [],
    };
  }

  for (const reward of outcome.rewards ?? []) {
    applyReward(player, state, pending.instanceId, reward);
  }
  if (outcome.nonlethalDamage) {
    player.hp = applyNonlethalDamage(player.hp, outcome.nonlethalDamage);
  }

  const questUpdates: QuestUpdate[] = [];
  if (outcome.startQuestId) {
    const questResult = startQuestById(
      player,
      defeatedBosses,
      outcome.startQuestId,
    );
    questUpdates.push(...questResult.updates);
  }

  const codexUnlocks = unlockCodexFromFutureSignal(codex, {
    type: "worldEvent",
    eventId: event.id,
  });
  const socialEffects = (outcome.futureHooks ?? []).map((hook) =>
    applySocialMutation(player, {
      sourceId: `worldEvent:${pending.instanceId}:${outcome.id}:${hook.type}:${hook.type === "alignment" ? hook.axis : hook.factionId}:${hook.reasonId}`,
      cause: `${event.title}: ${outcome.summary}`,
      ...(hook.type === "alignment"
        ? { alignment: { [hook.axis]: hook.delta } }
        : {
          reputation: [{
            kind: "faction" as const,
            targetId: hook.factionId,
            delta: hook.delta,
          }],
        }),
    }, codex)
  );
  for (const effect of socialEffects) {
    consumeSocialAchievementHooks(player, effect.achievementHooks);
  }
  const socialCodexIds = socialEffects.flatMap(
    (effect) => effect.codexUnlocks.unlockedIds,
  );
  const socialCodexEntries = socialEffects.flatMap(
    (effect) => effect.codexUnlocks.entries,
  );
  state.resolvedOutcomeIds.push(resolutionId);
  state.repeatCounters[event.id] = (state.repeatCounters[event.id] ?? 0) + 1;
  appendLog(state, event, pending, choiceId, outcome);
  state.pending = null;
  const debug = consumeWorldEventDebugFlag(player, pending.instanceId);
  recordAchievementEvent(player, {
    type: "worldEventResolved",
    sourceId: `worldEvent:${resolutionId}`,
    debug,
  });
  if (!debug) {
    reconcileAchievements({
      player,
      defeatedBosses,
      codex,
    }, {
      sourceId: `worldEvent:${resolutionId}`,
    });
  }
  return {
    resolved: true,
    summary: outcome.summary,
    questUpdates,
    codexUnlocks: {
      unlockedIds: [...new Set([
        ...codexUnlocks.unlockedIds,
        ...socialCodexIds,
      ])],
      entries: [...new Map([
        ...codexUnlocks.entries,
        ...socialCodexEntries,
      ].map((entry) => [entry.id, entry])).values()],
    },
    socialEffects,
  };
}

export function resolveWorldEventChoice(
  player: PlayerState,
  codex: CodexData,
  defeatedBosses: ReadonlySet<string>,
  choiceId: string,
  roller?: () => number,
): WorldEventResolution {
  const state = player.progression.worldEvents;
  const { pending, event } = getPendingDefinition(state);
  if (pending.phase !== "choice") {
    throw new Error(`[worldEvents] ${event.id} is awaiting battle resolution`);
  }
  const choice = getChoice(event, choiceId);
  if (choice.type === "battle") {
    throw new Error(`[worldEvents] Battle choice ${choiceId} must be prepared`);
  }

  if (choice.type === "resolve") {
    return completeOutcome(
      player,
      codex,
      defeatedBosses,
      state,
      event,
      pending,
      choice.id,
      choice.outcome,
    );
  }

  const checkId = `worldEvent:${pending.instanceId}:${choice.id}`;
  const result = player.progression.skillChecks[checkId]
    ?? rollSkillCheck(
      player.stats,
      choice.ability,
      choice.dc,
      {
        optionId: choice.id,
        ...(roller ? { roller } : {}),
      },
    );
  player.progression.skillChecks[checkId] = result;
  return completeOutcome(
    player,
    codex,
    defeatedBosses,
    state,
    event,
    pending,
    choice.id,
    result.success ? choice.success : choice.failure,
  );
}

export function prepareWorldEventBattle(
  player: PlayerState,
  choiceId: string,
): MonsterEncounter {
  const state = player.progression.worldEvents;
  const { pending, event } = getPendingDefinition(state);
  if (pending.phase === "battle") {
    if (pending.selectedChoiceId !== choiceId) {
      throw new Error(`[worldEvents] ${event.id} already has a different battle choice`);
    }
  } else {
    const choice = getChoice(event, choiceId);
    if (choice.type !== "battle") {
      throw new Error(`[worldEvents] Choice ${choiceId} is not a battle`);
    }
    pending.phase = "battle";
    pending.selectedChoiceId = choice.id;
  }
  return getPendingWorldEventEncounter(player);
}

function getPendingBattleChoice(
  state: WorldEventState,
): {
  pending: PendingWorldEvent;
  event: WorldEventDefinition;
  choice: WorldEventBattleChoice;
} {
  const { pending, event } = getPendingDefinition(state);
  if (pending.phase !== "battle" || !pending.selectedChoiceId) {
    throw new Error(`[worldEvents] ${event.id} is not awaiting a battle`);
  }
  const choice = getChoice(event, pending.selectedChoiceId);
  if (choice.type !== "battle") {
    throw new Error(`[worldEvents] Pending choice ${choice.id} is not a battle`);
  }
  return { pending, event, choice };
}

export function getPendingWorldEventEncounter(
  player: PlayerState,
): MonsterEncounter {
  const { choice } = getPendingBattleChoice(player.progression.worldEvents);
  const monster = getMonster(choice.monsterId);
  if (!monster) {
    throw new Error(`[worldEvents] Unknown battle monster ${choice.monsterId}`);
  }
  const encounter = createSoloEncounter(monster);
  return {
    ...encounter,
    id: `worldEvent:${player.progression.worldEvents.pending!.instanceId}`,
    name: `Event: ${encounter.name}`,
  };
}

export function resolveWorldEventBattle(
  player: PlayerState,
  codex: CodexData,
  defeatedBosses: ReadonlySet<string>,
  battleOutcome: BattleOutcome,
): WorldEventResolution {
  const state = player.progression.worldEvents;
  const { pending, event, choice } = getPendingBattleChoice(state);
  const outcome = battleOutcome === "victory"
    ? choice.victory
    : battleOutcome === "fled"
      ? choice.fled
      : choice.defeat;
  return completeOutcome(
    player,
    codex,
    defeatedBosses,
    state,
    event,
    pending,
    choice.id,
    outcome,
  );
}

function normalizeLocation(value: unknown): WorldEventLocation | undefined {
  if (!isRecord(value)) return undefined;
  const chunkX = value["chunkX"];
  const chunkY = value["chunkY"];
  const x = value["x"];
  const y = value["y"];
  const areaName = value["areaName"];
  const terrain = value["terrain"];
  if (
    !isNonNegativeInteger(chunkX)
    || chunkX >= WORLD_WIDTH
    || !isNonNegativeInteger(chunkY)
    || chunkY >= WORLD_HEIGHT
    || !isNonNegativeInteger(x)
    || x >= MAP_WIDTH
    || !isNonNegativeInteger(y)
    || y >= MAP_HEIGHT
    || typeof areaName !== "string"
    || !areaName.trim()
    || !isTerrain(terrain)
  ) {
    return undefined;
  }
  return { chunkX, chunkY, x, y, areaName: areaName.trim(), terrain };
}

function getInstanceCounter(
  instanceId: string,
  eventId: string,
): number | undefined {
  const prefix = `${eventId}:`;
  if (!instanceId.startsWith(prefix)) return undefined;
  const counter = Number(instanceId.slice(prefix.length));
  return Number.isSafeInteger(counter) && counter > 0 ? counter : undefined;
}

function normalizePending(value: unknown): PendingWorldEvent | null {
  if (!isRecord(value)) return null;
  const eventId = value["eventId"];
  const instanceId = value["instanceId"];
  const phase = value["phase"];
  const selectedChoiceId = value["selectedChoiceId"];
  const location = normalizeLocation(value["location"]);
  const timeStep = value["timeStep"];
  const period = value["period"];
  const weather = value["weather"];
  const event = typeof eventId === "string"
    ? getWorldEventDefinition(eventId)
    : undefined;
  if (
    !event
    || typeof instanceId !== "string"
    || getInstanceCounter(instanceId, event.id) === undefined
    || (phase !== "choice" && phase !== "battle")
    || !location
    || !isNonNegativeInteger(timeStep)
    || !isTimePeriod(period)
    || !isWeatherType(weather)
  ) {
    return null;
  }
  if (phase === "battle") {
    if (typeof selectedChoiceId !== "string") return null;
    const choice = event.choices.find((candidate) =>
      candidate.id === selectedChoiceId
    );
    if (choice?.type !== "battle") return null;
  }
  return {
    instanceId,
    eventId: event.id,
    phase,
    ...(typeof selectedChoiceId === "string" ? { selectedChoiceId } : {}),
    location,
    timeStep,
    period,
    weather,
  };
}

function normalizeLog(value: unknown): WorldEventLogEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: WorldEventLogEntry[] = [];
  for (const candidate of value.slice(-WORLD_EVENT_LOG_LIMIT)) {
    if (!isRecord(candidate)) continue;
    const eventId = candidate["eventId"];
    const event = typeof eventId === "string"
      ? getWorldEventDefinition(eventId)
      : undefined;
    const location = normalizeLocation(candidate["location"]);
    if (
      !event
      || typeof candidate["instanceId"] !== "string"
      || getInstanceCounter(candidate["instanceId"], event.id) === undefined
      || !location
      || !isNonNegativeInteger(candidate["timeStep"])
      || !isTimePeriod(candidate["period"])
      || !isWeatherType(candidate["weather"])
      || typeof candidate["choiceId"] !== "string"
      || typeof candidate["outcomeId"] !== "string"
      || typeof candidate["outcome"] !== "string"
    ) {
      continue;
    }
    entries.push({
      instanceId: candidate["instanceId"],
      eventId: event.id,
      family: event.family,
      title: event.title,
      source: event.source,
      location,
      timeStep: candidate["timeStep"],
      period: candidate["period"],
      weather: candidate["weather"],
      choiceId: candidate["choiceId"],
      outcomeId: candidate["outcomeId"],
      outcome: candidate["outcome"],
    });
  }
  return entries;
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((entry): entry is string =>
      typeof entry === "string" && entry.length > 0 && entry.length <= 160
    ))]
    : [];
}

export function normalizeWorldEventState(value: unknown): WorldEventState {
  if (!isRecord(value)) return createWorldEventState(LEGACY_WORLD_EVENT_SEED);
  const validSeed = typeof value["seed"] === "number"
    && Number.isSafeInteger(value["seed"])
    && value["seed"] > 0;
  const state = createWorldEventState(
    validSeed ? value["seed"] as number : LEGACY_WORLD_EVENT_SEED,
  );
  state.rollCounter = isNonNegativeInteger(value["rollCounter"])
    ? value["rollCounter"]
    : 0;
  state.triggerCount = isNonNegativeInteger(value["triggerCount"])
    ? value["triggerCount"]
    : 0;
  state.cooldownRemaining = isNonNegativeInteger(value["cooldownRemaining"])
    ? Math.min(value["cooldownRemaining"], 1000)
    : 0;
  state.stepsSinceLastEvent = isNonNegativeInteger(value["stepsSinceLastEvent"])
    ? Math.min(value["stepsSinceLastEvent"], 1000000)
    : 0;
  state.resolvedOutcomeIds = normalizeStringArray(value["resolvedOutcomeIds"]);
  state.claimedRewardIds = normalizeStringArray(value["claimedRewardIds"]);
  if (isRecord(value["repeatCounters"])) {
    for (const event of WORLD_EVENT_DEFINITIONS) {
      const count = value["repeatCounters"][event.id];
      if (isNonNegativeInteger(count)) {
        state.repeatCounters[event.id] = event.maxRepeats === undefined
          ? Math.min(count, 1000000)
          : Math.min(count, event.maxRepeats);
      }
    }
  }
  state.log = normalizeLog(value["log"]);
  state.pending = validSeed ? normalizePending(value["pending"]) : null;
  const retainedCounters = [
    ...state.log.map((entry) =>
      getInstanceCounter(entry.instanceId, entry.eventId) ?? 0
    ),
    state.pending
      ? getInstanceCounter(state.pending.instanceId, state.pending.eventId) ?? 0
      : 0,
  ];
  state.triggerCount = Math.max(state.triggerCount, ...retainedCounters);
  if (
    state.pending
    && state.log.some((entry) => entry.instanceId === state.pending!.instanceId)
  ) {
    state.pending = null;
  }
  return state;
}

export function resetWorldEventState(
  player: PlayerState,
  seed = player.progression.worldEvents.seed,
): void {
  player.progression.worldEvents = createWorldEventState(seed);
}

export function getWorldEventQuestIds(): readonly QuestId[] {
  return QUEST_IDS;
}
