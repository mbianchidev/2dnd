import {
  ACHIEVEMENTS,
  TITLES,
  getAchievement,
  getTitle,
  isAchievementId,
  isTitleId,
  type AchievementCategory,
  type AchievementCounterKey,
  type AchievementDefinition,
  type AchievementId,
  type TitleId,
} from "../data/achievements";
import { DUNGEONS } from "../data/dungeons";
import { MONSTER_FAMILIES } from "../data/monsterFamilies";
import { WORLD_EVENT_DEFINITIONS } from "../data/worldEvents";
import {
  getCodexFamilyProgressList,
  type CodexData,
} from "./codex";
import type { PlayerState } from "./player";
import {
  getReputationScore,
  getReputationTier,
  type SocialAchievementHook,
} from "./reputation";
import { getQuestStageIndex, isQuestCompleted } from "./quests";

const PROCESSED_EVENT_LIMIT = 200;

export interface AchievementEarnedRecord {
  id: AchievementId;
  unlockedAt: number;
  order: number;
  sourceId: string;
  debug: boolean;
}

export interface AchievementEventCounters {
  battleWins: number;
  oneHitDefeats: number;
  defeatCount: number;
  battleSequence: number;
}

export interface AchievementState {
  earned: AchievementEarnedRecord[];
  counters: AchievementEventCounters;
  processedEventIds: string[];
  pendingNotificationIds: AchievementId[];
  unlockedTitleIds: TitleId[];
  equippedTitleId: TitleId | "";
  defeatTrackingComplete: boolean;
  debugSuppressedIds: AchievementId[];
  debugPendingBattle: boolean;
  debugWorldEventInstanceIds: string[];
  debugMutationActive: boolean;
}

export interface AchievementContext {
  player: PlayerState;
  defeatedBosses: ReadonlySet<string>;
  codex: CodexData;
}

export interface AchievementProgress {
  current: number;
  target: number;
  complete: boolean;
}

export interface AchievementUnlockResult {
  newlyUnlocked: AchievementId[];
  titleUnlocks: TitleId[];
}

export type AchievementSort = "category" | "name" | "progress" | "completed";
export type AchievementVisibility = "all" | "completed" | "locked";

export interface AchievementQuery {
  category?: AchievementCategory;
  visibility?: AchievementVisibility;
  search?: string;
  sort?: AchievementSort;
}

export interface AchievementListEntry {
  definition: AchievementDefinition;
  progress: AchievementProgress;
  earned?: AchievementEarnedRecord;
}

export type AchievementEvent =
  | {
    type: "battleResolved";
    sourceId: string;
    outcome: "victory" | "defeat" | "fled";
    oneHitDefeats: number;
    debug: boolean;
  }
  | {
    type: "worldEventResolved";
    sourceId: string;
    debug: boolean;
  };

export function createAchievementState(
  defeatTrackingComplete = true,
): AchievementState {
  return {
    earned: [],
    counters: {
      battleWins: 0,
      oneHitDefeats: 0,
      defeatCount: 0,
      battleSequence: 0,
    },
    processedEventIds: [],
    pendingNotificationIds: [],
    unlockedTitleIds: [],
    equippedTitleId: "",
    defeatTrackingComplete,
    debugSuppressedIds: [],
    debugPendingBattle: false,
    debugWorldEventInstanceIds: [],
    debugMutationActive: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonNegativeInteger(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

function normalizeEarned(value: unknown): AchievementEarnedRecord[] {
  if (!Array.isArray(value)) return [];
  const records: AchievementEarnedRecord[] = [];
  const seen = new Set<AchievementId>();
  for (const candidate of value) {
    if (!isRecord(candidate) || !isAchievementId(candidate["id"])) continue;
    const id = candidate["id"];
    if (seen.has(id)) continue;
    const sourceId = typeof candidate["sourceId"] === "string"
      && candidate["sourceId"].trim().length > 0
      ? candidate["sourceId"].trim()
      : `recovered:${id}`;
    seen.add(id);
    records.push({
      id,
      unlockedAt: nonNegativeInteger(candidate["unlockedAt"]),
      order: nonNegativeInteger(candidate["order"]),
      sourceId,
      debug: candidate["debug"] === true,
    });
  }
  return records
    .sort((a, b) => a.order - b.order || a.unlockedAt - b.unlockedAt)
    .map((record, index) => ({ ...record, order: index + 1 }));
}

function normalizeStringIds<T extends string>(
  value: unknown,
  guard: (candidate: unknown) => candidate is T,
): T[] {
  return Array.isArray(value)
    ? [...new Set(value.filter(guard))]
    : [];
}

export function normalizeAchievementState(
  value: unknown,
  sourceVersion: number,
): AchievementState {
  if (!isRecord(value)) return createAchievementState(false);
  const counters = isRecord(value["counters"]) ? value["counters"] : {};
  const earned = normalizeEarned(value["earned"]);
  const earnedIds = new Set(earned.map((record) => record.id));
  const state: AchievementState = {
    earned,
    counters: {
      battleWins: nonNegativeInteger(counters["battleWins"]),
      oneHitDefeats: nonNegativeInteger(counters["oneHitDefeats"]),
      defeatCount: nonNegativeInteger(counters["defeatCount"]),
      battleSequence: nonNegativeInteger(counters["battleSequence"]),
    },
    processedEventIds: Array.isArray(value["processedEventIds"])
      ? [...new Set(value["processedEventIds"].filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0,
      ).map((entry) => entry.trim()))].slice(-PROCESSED_EVENT_LIMIT)
      : [],
    pendingNotificationIds: normalizeStringIds(
      value["pendingNotificationIds"],
      isAchievementId,
    ).filter((id) => earnedIds.has(id)),
    unlockedTitleIds: normalizeStringIds(
      value["unlockedTitleIds"],
      isTitleId,
    ),
    equippedTitleId: isTitleId(value["equippedTitleId"])
      ? value["equippedTitleId"]
      : "",
    defeatTrackingComplete: sourceVersion >= 13
      && value["defeatTrackingComplete"] === true,
    debugSuppressedIds: normalizeStringIds(
      value["debugSuppressedIds"],
      isAchievementId,
    ).filter((id) => !earnedIds.has(id)),
    debugPendingBattle: value["debugPendingBattle"] === true,
    debugWorldEventInstanceIds: Array.isArray(
      value["debugWorldEventInstanceIds"],
    )
      ? [...new Set(value["debugWorldEventInstanceIds"].filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0,
      ).map((entry) => entry.trim()))]
      : [],
    debugMutationActive: false,
  };

  const earnedTitles = new Set<TitleId>();
  for (const record of state.earned) {
    if (record.debug) continue;
    const titleId = getAchievement(record.id).rewardTitleId;
    if (titleId) earnedTitles.add(titleId);
  }
  state.unlockedTitleIds = [
    ...new Set([...state.unlockedTitleIds, ...earnedTitles]),
  ].filter((titleId) => earnedTitles.has(titleId));
  if (
    state.equippedTitleId
    && !state.unlockedTitleIds.includes(state.equippedTitleId)
  ) {
    state.equippedTitleId = "";
  }
  return state;
}

function countExploredOverworldChunks(player: PlayerState): number {
  const chunks = new Set<string>();
  for (const key of Object.keys(player.progression.exploredTiles)) {
    if (key.startsWith("c:") || key.startsWith("d:")) continue;
    const parts = key.split(",");
    if (parts.length !== 4) continue;
    const chunkX = Number(parts[0]);
    const chunkY = Number(parts[1]);
    if (
      Number.isInteger(chunkX)
      && Number.isInteger(chunkY)
      && chunkX >= 0
      && chunkX < 10
      && chunkY >= 0
      && chunkY < 9
    ) {
      chunks.add(`${chunkX},${chunkY}`);
    }
  }
  return chunks.size;
}

function countReputationTargetsAtTier(
  player: PlayerState,
  definition: Extract<
    AchievementDefinition["criteria"],
    { type: "reputationTargetsAtTier" }
  >,
): number {
  const targets = definition.targetKind === "town"
    ? Object.keys(player.progression.social.townReputation)
    : Object.keys(player.progression.social.factionReputation);
  const targetTierIndex = [
    "hostile",
    "wary",
    "neutral",
    "friendly",
    "trusted",
    "exalted",
  ].indexOf(definition.tier);
  return targets.filter((targetId) => {
    const score = getReputationScore(
      player.progression.social,
      definition.targetKind,
      targetId,
    );
    const tierIndex = [
      "hostile",
      "wary",
      "neutral",
      "friendly",
      "trusted",
      "exalted",
    ].indexOf(getReputationTier(score).id);
    return tierIndex >= targetTierIndex;
  }).length;
}

export function getAchievementProgress(
  definition: AchievementDefinition,
  context: AchievementContext,
): AchievementProgress {
  const { player, defeatedBosses, codex } = context;
  const criteria = definition.criteria;
  let current = 0;
  let target = 1;

  switch (criteria.type) {
    case "questStageCompleted": {
      const progress = player.progression.quests.quests[criteria.questId];
      const stageIndex = getQuestStageIndex(criteria.questId, criteria.stageId);
      current = stageIndex !== undefined
          && (progress.status === "completed" || progress.stage > stageIndex)
        ? 1
        : 0;
      break;
    }
    case "questCompleted":
      current = isQuestCompleted(player.progression.quests, criteria.questId)
        ? 1
        : 0;
      break;
    case "bossDefeated":
      current = defeatedBosses.has(criteria.bossId) ? 1 : 0;
      break;
    case "allDungeonsCompleted":
      target = DUNGEONS.length;
      current = DUNGEONS.filter((dungeon) =>
        dungeon.bossId !== undefined && defeatedBosses.has(dungeon.bossId)
      ).length;
      break;
    case "counter":
      target = criteria.threshold;
      current = player.progression.achievements.counters[criteria.counter];
      break;
    case "noDefeatCampaign":
      current = player.progression.achievements.defeatTrackingComplete
          && player.progression.achievements.counters.defeatCount === 0
          && isQuestCompleted(player.progression.quests, "twelvefoldCovenant")
        ? 1
        : 0;
      break;
    case "successfulSkillChecks":
      target = criteria.threshold;
      current = Object.values(player.progression.skillChecks).filter(
        (record) =>
          record.success && (!criteria.ability || record.ability === criteria.ability),
      ).length;
      break;
    case "trapStateCount":
      target = criteria.threshold;
      current = Object.values(player.progression.trapStates).filter(
        (state) => state === criteria.state,
      ).length;
      break;
    case "discoveredCities":
      target = criteria.threshold;
      current = new Set(player.progression.discoveredCities).size;
      break;
    case "exploredOverworldChunks":
      target = criteria.threshold;
      current = countExploredOverworldChunks(player);
      break;
    case "codexMonstersDiscovered":
      target = criteria.threshold;
      current = Object.keys(codex.entries).length;
      break;
    case "codexFamiliesCompleted":
      target = criteria.threshold;
      current = getCodexFamilyProgressList(codex).filter(
        (family) => family.complete,
      ).length;
      break;
    case "companionsRecruited":
      target = criteria.threshold;
      current = new Set(player.party.companions.map((companion) => companion.id)).size;
      break;
    case "gambitCompanions":
      target = criteria.threshold;
      current = player.party.companions.filter((companion) =>
        companion.gambits.some((rule) => rule.enabled)
      ).length;
      break;
    case "worldEventsResolved":
      target = criteria.threshold;
      current = criteria.unique
        ? Object.values(player.progression.worldEvents.repeatCounters).filter(
          (count) => count > 0,
        ).length
        : Object.values(player.progression.worldEvents.repeatCounters).reduce(
          (sum, count) => sum + count,
          0,
        );
      break;
    case "alignmentAxis":
      target = criteria.minimum;
      current = Math.max(0, player.progression.social.alignment[criteria.axis]);
      break;
    case "reputationTargetsAtTier":
      target = criteria.threshold;
      current = countReputationTargetsAtTier(player, criteria);
      break;
    case "inventoryUniqueItems":
      target = criteria.threshold;
      current = new Set(player.inventory.map((item) => item.id)).size;
      break;
    case "fullyEquipped":
      current = player.equippedWeapon
          && player.equippedArmor
          && (player.equippedShield || player.equippedOffHand)
        ? 1
        : 0;
      break;
    case "gatheringSuccesses":
      target = criteria.threshold;
      current = criteria.discipline
        ? player.progression.gathering.stats[criteria.discipline].successes
        : Object.values(player.progression.gathering.stats).reduce(
          (sum, stats) => sum + stats.successes,
          0,
        );
      break;
    case "gatheringRareFinds":
      target = criteria.threshold;
      current = Object.values(player.progression.gathering.stats).reduce(
        (sum, stats) => sum + stats.rareFinds,
        0,
      );
      break;
    case "gatheringDisciplinesMastered":
      target = 3;
      current = Object.values(player.progression.gathering.stats).filter(
        (stats) => stats.successes >= criteria.successesPerDiscipline,
      ).length;
      break;
  }

  return {
    current: Math.min(Math.max(0, current), target),
    target,
    complete: current >= target,
  };
}

export function isAchievementEarned(
  state: AchievementState,
  achievementId: AchievementId,
): boolean {
  return state.earned.some((record) => record.id === achievementId);
}

function unlockAchievement(
  player: PlayerState,
  achievementId: AchievementId,
  sourceId: string,
  unlockedAt: number,
  notify: boolean,
  debug: boolean,
): TitleId | undefined {
  const state = player.progression.achievements;
  if (isAchievementEarned(state, achievementId)) return undefined;
  state.earned.push({
    id: achievementId,
    unlockedAt: Math.max(0, Math.floor(unlockedAt)),
    order: state.earned.length + 1,
    sourceId,
    debug,
  });
  state.debugSuppressedIds = state.debugSuppressedIds.filter(
    (id) => id !== achievementId,
  );
  if (debug) return undefined;
  if (notify && !state.pendingNotificationIds.includes(achievementId)) {
    state.pendingNotificationIds.push(achievementId);
  }
  const titleId = getAchievement(achievementId).rewardTitleId;
  if (titleId && !state.unlockedTitleIds.includes(titleId)) {
    state.unlockedTitleIds.push(titleId);
    return titleId;
  }
  return undefined;
}

export function reconcileAchievements(
  context: AchievementContext,
  options: {
    sourceId?: string;
    unlockedAt?: number;
    notify?: boolean;
  } = {},
): AchievementUnlockResult {
  const newlyUnlocked: AchievementId[] = [];
  const titleUnlocks: TitleId[] = [];
  const state = context.player.progression.achievements;
  for (const definition of ACHIEVEMENTS) {
    if (
      isAchievementEarned(state, definition.id)
      || state.debugSuppressedIds.includes(definition.id)
      || !getAchievementProgress(definition, context).complete
    ) {
      continue;
    }
    const titleId = unlockAchievement(
      context.player,
      definition.id,
      options.sourceId ?? `reconcile:${definition.id}`,
      options.unlockedAt ?? Date.now(),
      options.notify ?? true,
      false,
    );
    newlyUnlocked.push(definition.id);
    if (titleId) titleUnlocks.push(titleId);
  }
  return { newlyUnlocked, titleUnlocks };
}

export function recordAchievementEvent(
  player: PlayerState,
  event: AchievementEvent,
): boolean {
  const state = player.progression.achievements;
  if (event.debug || state.processedEventIds.includes(event.sourceId)) return false;
  state.processedEventIds.push(event.sourceId);
  if (state.processedEventIds.length > PROCESSED_EVENT_LIMIT) {
    state.processedEventIds.splice(
      0,
      state.processedEventIds.length - PROCESSED_EVENT_LIMIT,
    );
  }
  if (event.type === "battleResolved") {
    if (event.outcome === "victory") state.counters.battleWins += 1;
    if (event.outcome === "defeat") state.counters.defeatCount += 1;
    state.counters.oneHitDefeats += Math.max(
      0,
      Math.floor(event.oneHitDefeats),
    );
  }
  return true;
}

export function isOneHitDefeat(
  hpBefore: number,
  maxHp: number,
  damage: number,
): boolean {
  return Number.isFinite(hpBefore)
    && Number.isFinite(maxHp)
    && Number.isFinite(damage)
    && maxHp > 0
    && hpBefore === maxHp
    && damage >= hpBefore;
}

export function nextBattleAchievementSourceId(
  player: PlayerState,
  encounterId: string,
): string {
  const state = player.progression.achievements;
  state.counters.battleSequence += 1;
  return `battle:${state.counters.battleSequence}:${encounterId}`;
}

export function consumeSocialAchievementHooks(
  player: PlayerState,
  hooks: readonly SocialAchievementHook[],
  options: { notify?: boolean; unlockedAt?: number } = {},
): AchievementUnlockResult {
  const newlyUnlocked: AchievementId[] = [];
  const titleUnlocks: TitleId[] = [];
  for (const hook of hooks) {
    if (
      player.progression.achievements.debugMutationActive
      || hook.sourceId.startsWith("debug:")
    ) {
      continue;
    }
    for (const definition of ACHIEVEMENTS) {
      const criteria = definition.criteria;
      const relevant = hook.type === "alignmentChanged"
        ? criteria.type === "alignmentAxis"
        : criteria.type === "reputationTargetsAtTier";
      if (
        !relevant
        || isAchievementEarned(player.progression.achievements, definition.id)
        || player.progression.achievements.debugSuppressedIds.includes(
          definition.id,
        )
      ) {
        continue;
      }
      let complete = false;
      if (criteria.type === "alignmentAxis") {
        complete = player.progression.social.alignment[criteria.axis]
          >= criteria.minimum;
      } else if (criteria.type === "reputationTargetsAtTier") {
        complete = countReputationTargetsAtTier(player, criteria)
          >= criteria.threshold;
      }
      if (!complete) continue;
      const titleId = unlockAchievement(
        player,
        definition.id,
        `social:${hook.sourceId}:${definition.id}`,
        options.unlockedAt ?? Date.now(),
        options.notify ?? true,
        false,
      );
      newlyUnlocked.push(definition.id);
      if (titleId) titleUnlocks.push(titleId);
    }
  }
  return { newlyUnlocked, titleUnlocks };
}

export function suppressCurrentlyMetAchievements(
  context: AchievementContext,
): AchievementId[] {
  const state = context.player.progression.achievements;
  const suppressed: AchievementId[] = [];
  for (const definition of ACHIEVEMENTS) {
    if (
      !isAchievementEarned(state, definition.id)
      && !state.debugSuppressedIds.includes(definition.id)
      && getAchievementProgress(definition, context).complete
    ) {
      state.debugSuppressedIds.push(definition.id);
      suppressed.push(definition.id);
    }
  }
  return suppressed;
}

export function markNextBattleAsDebug(player: PlayerState): void {
  player.progression.achievements.debugPendingBattle = true;
}

export function beginAchievementDebugMutation(player: PlayerState): void {
  player.progression.achievements.debugMutationActive = true;
}

export function endAchievementDebugMutation(player: PlayerState): void {
  player.progression.achievements.debugMutationActive = false;
}

export function consumeNextBattleDebugFlag(player: PlayerState): boolean {
  const debug = player.progression.achievements.debugPendingBattle;
  player.progression.achievements.debugPendingBattle = false;
  return debug;
}

export function markWorldEventAsDebug(
  player: PlayerState,
  instanceId: string,
): void {
  const ids = player.progression.achievements.debugWorldEventInstanceIds;
  if (!ids.includes(instanceId)) ids.push(instanceId);
}

export function isWorldEventMarkedDebug(
  player: PlayerState,
  instanceId: string,
): boolean {
  return player.progression.achievements.debugWorldEventInstanceIds.includes(
    instanceId,
  );
}

export function consumeWorldEventDebugFlag(
  player: PlayerState,
  instanceId: string,
): boolean {
  const ids = player.progression.achievements.debugWorldEventInstanceIds;
  const debug = ids.includes(instanceId);
  if (debug) {
    player.progression.achievements.debugWorldEventInstanceIds = ids.filter(
      (id) => id !== instanceId,
    );
  }
  return debug;
}

export function equipAchievementTitle(
  player: PlayerState,
  titleId: TitleId | "",
): { changed: boolean; message: string } {
  const state = player.progression.achievements;
  if (titleId === "") {
    const changed = state.equippedTitleId !== "";
    state.equippedTitleId = "";
    return {
      changed,
      message: changed ? "Title cleared." : "No title is equipped.",
    };
  }
  if (!state.unlockedTitleIds.includes(titleId)) {
    return { changed: false, message: "That title is still locked." };
  }
  if (state.equippedTitleId === titleId) {
    return { changed: false, message: `${getTitle(titleId).name} is already equipped.` };
  }
  state.equippedTitleId = titleId;
  return { changed: true, message: `Equipped title: ${getTitle(titleId).name}.` };
}

export function getEquippedTitleName(player: PlayerState): string {
  return player.progression.achievements.equippedTitleId
    ? getTitle(player.progression.achievements.equippedTitleId).name
    : "";
}

export function acknowledgeAchievementNotification(
  player: PlayerState,
  achievementId: AchievementId,
): boolean {
  const before = player.progression.achievements.pendingNotificationIds.length;
  player.progression.achievements.pendingNotificationIds =
    player.progression.achievements.pendingNotificationIds.filter(
      (id) => id !== achievementId,
    );
  return player.progression.achievements.pendingNotificationIds.length !== before;
}

export function getAchievementSummary(player: PlayerState): {
  earned: number;
  total: number;
  points: number;
  totalPoints: number;
} {
  const naturalIds = new Set(
    player.progression.achievements.earned
      .filter((record) => !record.debug)
      .map((record) => record.id),
  );
  return {
    earned: naturalIds.size,
    total: ACHIEVEMENTS.length,
    points: ACHIEVEMENTS.reduce(
      (sum, definition) =>
        sum + (naturalIds.has(definition.id) ? definition.points : 0),
      0,
    ),
    totalPoints: ACHIEVEMENTS.reduce(
      (sum, definition) => sum + definition.points,
      0,
    ),
  };
}

export function getAchievementList(
  context: AchievementContext,
  query: AchievementQuery = {},
): AchievementListEntry[] {
  const search = query.search?.trim().toLowerCase() ?? "";
  const earnedById = new Map(
    context.player.progression.achievements.earned.map(
      (record) => [record.id, record],
    ),
  );
  const entries = ACHIEVEMENTS
    .filter((definition) => !query.category || definition.category === query.category)
    .map((definition): AchievementListEntry => ({
      definition,
      progress: getAchievementProgress(definition, context),
      earned: earnedById.get(definition.id),
    }))
    .filter((entry) => {
      if (query.visibility === "completed" && !entry.earned) return false;
      if (query.visibility === "locked" && entry.earned) return false;
      if (!search) return true;
      if (entry.definition.hidden && !entry.earned) return false;
      return `${entry.definition.name} ${entry.definition.description}`
        .toLowerCase()
        .includes(search);
    });

  const sort = query.sort ?? "category";
  return entries.sort((a, b) => {
    if (sort === "name") {
      return a.definition.name.localeCompare(b.definition.name);
    }
    if (sort === "progress") {
      const aRatio = a.progress.current / a.progress.target;
      const bRatio = b.progress.current / b.progress.target;
      return bRatio - aRatio || a.definition.name.localeCompare(b.definition.name);
    }
    if (sort === "completed") {
      return Number(Boolean(b.earned)) - Number(Boolean(a.earned))
        || (b.earned?.order ?? 0) - (a.earned?.order ?? 0)
        || a.definition.name.localeCompare(b.definition.name);
    }
    const categoryDifference = ACHIEVEMENTS.findIndex(
      (definition) => definition.id === a.definition.id,
    ) - ACHIEVEMENTS.findIndex(
      (definition) => definition.id === b.definition.id,
    );
    return categoryDifference;
  });
}

export function executeAchievementDebugCommand(
  context: AchievementContext,
  args: string,
): { changed: boolean; lines: readonly string[] } {
  const parts = args.trim().split(/\s+/).filter(Boolean);
  const action = parts[0]?.toLowerCase() ?? "list";
  if (action === "list") {
    return {
      changed: false,
      lines: ACHIEVEMENTS.map((definition) => {
        const record = context.player.progression.achievements.earned.find(
          (entry) => entry.id === definition.id,
        );
        return `${definition.id}: ${record ? record.debug ? "debug" : "earned" : "locked"}`;
      }),
    };
  }
  if (action === "explain") {
    const id = parts[1];
    if (!isAchievementId(id)) {
      return {
        changed: false,
        lines: ["Usage: /achievement explain <achievementId>"],
      };
    }
    const definition = getAchievement(id);
    const progress = getAchievementProgress(definition, context);
    return {
      changed: false,
      lines: [
        `${id}: ${definition.name}`,
        `${progress.current}/${progress.target} ${progress.complete ? "complete" : "incomplete"}`,
        `Source: ${definition.source.authoritativeState}`,
      ],
    };
  }
  if (action === "progress") {
    const incomplete = getAchievementList(context, {
      visibility: "locked",
      sort: "progress",
    }).slice(0, 10);
    return {
      changed: false,
      lines: incomplete.map((entry) =>
        `${entry.definition.id}: ${entry.progress.current}/${entry.progress.target}`
      ),
    };
  }
  if (action === "unlock") {
    const id = parts[1];
    if (!isAchievementId(id)) {
      return {
        changed: false,
        lines: ["Usage: /achievement unlock <achievementId>"],
      };
    }
    const alreadyEarned = isAchievementEarned(
      context.player.progression.achievements,
      id,
    );
    unlockAchievement(
      context.player,
      id,
      `debug:achievement:unlock:${id}`,
      Date.now(),
      false,
      true,
    );
    suppressCurrentlyMetAchievements(context);
    return {
      changed: !alreadyEarned,
      lines: [
        alreadyEarned
          ? `${id} is already unlocked.`
          : `${id} debug-unlocked without points or title rewards.`,
      ],
    };
  }
  if (action === "reset") {
    const defeatTrackingComplete =
      context.player.progression.achievements.defeatTrackingComplete;
    context.player.progression.achievements = createAchievementState(
      defeatTrackingComplete,
    );
    suppressCurrentlyMetAchievements(context);
    return {
      changed: true,
      lines: ["Achievement state reset. Authoritative game state was not changed."],
    };
  }
  return {
    changed: false,
    lines: ["Usage: /achievement <list|unlock|reset|progress|explain> [achievementId]"],
  };
}

export const ACHIEVEMENT_DEFINITION_COUNTS = {
  achievements: ACHIEVEMENTS.length,
  titles: TITLES.length,
  monsterFamilies: MONSTER_FAMILIES.length,
  worldEvents: WORLD_EVENT_DEFINITIONS.length,
} as const;

export type { AchievementId, TitleId };
