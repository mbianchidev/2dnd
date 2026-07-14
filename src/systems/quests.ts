/**
 * Persistent quest progression and invariant-safe quest operations.
 *
 * This module intentionally has no Phaser dependencies. Scenes consume the
 * structured updates returned by these functions.
 */

import { getItem } from "../data/items";
import {
  FROST_SILK_QUEST_ID,
  IRON_DISPATCH_QUEST_ID,
  MAIN_QUEST_ID,
  QUEST_ACCESS_RULES,
  QUEST_DANGER_RULES,
  QUEST_IDS,
  QUEST_ITEM_IDS,
  QUEST_NPCS,
  QUESTS,
  createInitialQuestLog,
  getQuestDefinition,
} from "../data/quests";
import { awardXP } from "./player";
import type { PlayerState } from "./player";
import {
  allRewards,
  createDefaultProgress,
  normalizeQuestLog,
  objectiveRequired,
} from "./questState";
import type {
  QuestDefinition,
  QuestId,
  QuestLogState,
  QuestObjectiveDefinition,
  QuestProgress,
  QuestRewardDefinition,
  QuestStatus,
} from "../data/quests";

export { normalizeQuestLog } from "./questState";

export type QuestUpdateType =
  | "objective"
  | "stage"
  | "quest"
  | "item"
  | "reward";

export interface QuestUpdate {
  type: QuestUpdateType;
  questId: QuestId;
  message: string;
}

export interface QuestProcessResult {
  changed: boolean;
  updates: QuestUpdate[];
}

export interface QuestNpcInteraction {
  kind: "objective" | "start";
  questId: QuestId;
  npcId: string;
  objectiveId?: string;
  speaker: string;
  pages: string[];
}

export interface QuestAccessTarget {
  type: "city" | "dungeon";
  id: string;
}

export interface QuestAccessDecision {
  allowed: boolean;
  ruleId?: string;
  message?: string;
}

export type QuestDangerContext =
  | { type: "city"; id: string }
  | { type: "dungeon"; id: string }
  | { type: "chunk"; x: number; y: number };

export interface QuestDangerState {
  id: string;
  warning: string;
  encounterRateMultiplier: number;
  effectiveLevelOffset: number;
  seen: boolean;
}

export interface QuestJournalObjective {
  id: string;
  description: string;
  current: number;
  required: number;
  complete: boolean;
  optional: boolean;
}

export interface QuestJournalEntry {
  id: QuestId;
  title: string;
  kind: "main" | "side";
  status: QuestStatus;
  stageTitle: string;
  summary: string;
  objectives: QuestJournalObjective[];
}

function ensureQuestLog(player: PlayerState): QuestLogState {
  if (!player.progression.quests) {
    player.progression.quests = createInitialQuestLog();
  }
  return player.progression.quests;
}

export function getQuestProgress(
  player: PlayerState,
  questId: QuestId,
): QuestProgress {
  return ensureQuestLog(player).quests[questId];
}

function objectiveComplete(
  progress: QuestProgress,
  objective: QuestObjectiveDefinition,
): boolean {
  return (progress.objectives[objective.id] ?? 0) >= objectiveRequired(objective);
}

function prerequisitesComplete(
  progress: QuestProgress,
  objective: QuestObjectiveDefinition,
): boolean {
  return (objective.prerequisites ?? []).every(
    (objectiveId) => (progress.objectives[objectiveId] ?? 0) > 0,
  );
}

function getCurrentStage(
  quest: QuestDefinition,
  progress: QuestProgress,
) {
  return quest.stages[Math.min(progress.stage, quest.stages.length - 1)];
}

function hasInventoryItem(player: PlayerState, itemId: string): boolean {
  return player.inventory.some((item) => item.id === itemId);
}

function addItem(
  player: PlayerState,
  itemId: string,
  quantity: number,
  unique: boolean,
): void {
  const item = getItem(itemId);
  if (!item) throw new Error(`[quests] Unknown reward item ${itemId}`);
  if (unique && hasInventoryItem(player, itemId)) return;
  const count = unique ? 1 : Math.max(1, quantity);
  for (let index = 0; index < count; index++) {
    player.inventory.push(item);
  }
}

function removeItems(player: PlayerState, itemIds: string[]): void {
  const ids = new Set(itemIds);
  player.inventory = player.inventory.filter((item) => !ids.has(item.id));
}

function optionalObjectiveComplete(
  progress: QuestProgress,
  objectiveId: string | undefined,
): boolean {
  return objectiveId === undefined || (progress.objectives[objectiveId] ?? 0) > 0;
}

function applyRewards(
  player: PlayerState,
  quest: QuestDefinition,
  progress: QuestProgress,
  rewards: QuestRewardDefinition[],
  updates: QuestUpdate[],
): boolean {
  let changed = false;
  for (const reward of rewards) {
    if (progress.claimedRewards.includes(reward.id)) continue;
    if (!optionalObjectiveComplete(progress, reward.optionalObjectiveId)) continue;

    if (reward.type === "gold") {
      player.gold += reward.amount;
    } else if (reward.type === "xp") {
      awardXP(player, reward.amount);
    } else {
      addItem(
        player,
        reward.itemId,
        reward.quantity ?? 1,
        reward.unique ?? false,
      );
    }

    progress.claimedRewards.push(reward.id);
    updates.push({
      type: reward.type === "item" ? "item" : "reward",
      questId: quest.id,
      message: reward.message,
    });
    changed = true;
  }
  return changed;
}

function completeObjective(
  quest: QuestDefinition,
  progress: QuestProgress,
  objective: QuestObjectiveDefinition,
  increment: number,
  updates: QuestUpdate[],
): boolean {
  const required = objectiveRequired(objective);
  const current = progress.objectives[objective.id] ?? 0;
  const next = Math.min(required, current + increment);
  if (next <= current) return false;

  progress.objectives[objective.id] = next;
  const suffix = required > 1 ? ` (${next}/${required})` : "";
  updates.push({
    type: "objective",
    questId: quest.id,
    message: `${objective.description}${suffix}`,
  });
  return true;
}

function stageReady(
  progress: QuestProgress,
  objectives: QuestObjectiveDefinition[],
): boolean {
  return objectives.every((objective) => objectiveComplete(progress, objective));
}

function advanceReadyStages(
  player: PlayerState,
  quest: QuestDefinition,
  progress: QuestProgress,
  updates: QuestUpdate[],
): boolean {
  let changed = false;

  while (progress.status === "active") {
    const stage = getCurrentStage(quest, progress);
    if (!stageReady(progress, stage.objectives)) break;

    if (stage.consumeItemIds?.length) {
      removeItems(player, stage.consumeItemIds);
    }
    changed = applyRewards(
      player,
      quest,
      progress,
      stage.rewards ?? [],
      updates,
    ) || changed;

    if (progress.stage >= quest.stages.length - 1) {
      progress.status = "completed";
      changed = true;
      updates.push({
        type: "quest",
        questId: quest.id,
        message: `Quest completed: ${quest.title}`,
      });
      changed = applyRewards(
        player,
        quest,
        progress,
        quest.completionRewards ?? [],
        updates,
      ) || changed;
      break;
    }

    progress.stage++;
    changed = true;
    const nextStage = getCurrentStage(quest, progress);
    updates.push({
      type: "stage",
      questId: quest.id,
      message: `${quest.title}: ${nextStage.title}`,
    });
  }

  return changed;
}

function reconcileBossObjectives(
  quest: QuestDefinition,
  progress: QuestProgress,
  defeatedBosses: Set<string>,
  updates: QuestUpdate[],
): boolean {
  if (progress.status === "inactive") return false;
  let changed = false;

  const currentStage = getCurrentStage(quest, progress);
  for (const objective of currentStage.objectives) {
    if (
      objective.type === "defeat"
      && defeatedBosses.has(objective.targetId)
      && !objectiveComplete(progress, objective)
    ) {
      changed = completeObjective(
        quest,
        progress,
        objective,
        objectiveRequired(objective),
        updates,
      ) || changed;
    }
  }

  for (const objective of quest.optionalObjectives ?? []) {
    if (
      progress.stage >= objective.unlockStage
      && defeatedBosses.has(objective.targetId)
      && !objectiveComplete(progress, objective)
    ) {
      changed = completeObjective(
        quest,
        progress,
        objective,
        objectiveRequired(objective),
        updates,
      ) || changed;
    }
  }

  return changed;
}

function applyHistoricalRewards(
  player: PlayerState,
  quest: QuestDefinition,
  progress: QuestProgress,
  updates: QuestUpdate[],
): boolean {
  if (progress.status === "inactive") return false;
  let changed = applyRewards(
    player,
    quest,
    progress,
    quest.startRewards ?? [],
    updates,
  );

  const completedStageCount = progress.status === "completed"
    ? quest.stages.length
    : progress.stage;
  for (let index = 0; index < completedStageCount; index++) {
    changed = applyRewards(
      player,
      quest,
      progress,
      quest.stages[index].rewards ?? [],
      updates,
    ) || changed;
  }

  if (progress.status === "completed") {
    changed = applyRewards(
      player,
      quest,
      progress,
      quest.completionRewards ?? [],
      updates,
    ) || changed;
  }
  return changed;
}

function repairQuestItems(player: PlayerState): boolean {
  const log = ensureQuestLog(player);
  let changed = false;
  const main = log.quests[MAIN_QUEST_ID];
  const dispatch = log.quests[IRON_DISPATCH_QUEST_ID];
  const frostSilk = log.quests[FROST_SILK_QUEST_ID];

  if (
    (main.status === "completed" || main.stage > 0)
    && !hasInventoryItem(player, QUEST_ITEM_IDS.covenantSigil)
  ) {
    addItem(player, QUEST_ITEM_IDS.covenantSigil, 1, true);
    changed = true;
  }
  if (
    main.status === "completed"
    && !hasInventoryItem(player, QUEST_ITEM_IDS.shadowSteed)
  ) {
    addItem(player, QUEST_ITEM_IDS.shadowSteed, 1, true);
    changed = true;
  }

  if (
    dispatch.status === "active"
    && dispatch.stage === 0
    && !hasInventoryItem(player, QUEST_ITEM_IDS.sealedDispatch)
  ) {
    addItem(player, QUEST_ITEM_IDS.sealedDispatch, 1, true);
    changed = true;
  }
  if (
    (dispatch.status === "completed" || dispatch.stage > 0)
    && hasInventoryItem(player, QUEST_ITEM_IDS.sealedDispatch)
  ) {
    removeItems(player, [QUEST_ITEM_IDS.sealedDispatch]);
    changed = true;
  }

  if (
    frostSilk.status === "active"
    && frostSilk.stage === 1
    && !hasInventoryItem(player, QUEST_ITEM_IDS.frostSilkBundle)
  ) {
    addItem(player, QUEST_ITEM_IDS.frostSilkBundle, 1, true);
    changed = true;
  }
  if (
    frostSilk.status === "completed"
    && hasInventoryItem(player, QUEST_ITEM_IDS.frostSilkBundle)
  ) {
    removeItems(player, [QUEST_ITEM_IDS.frostSilkBundle]);
    changed = true;
  }

  return changed;
}

/**
 * Reconcile quest state after loading, entering Overworld, or changing stages.
 * Boss kills are authoritative because defeated bosses cannot be fought again.
 */
export function reconcileQuestState(
  player: PlayerState,
  defeatedBosses: Set<string>,
): QuestProcessResult {
  ensureQuestLog(player);
  const updates: QuestUpdate[] = [];
  let changed = false;

  for (const quest of QUESTS) {
    const progress = getQuestProgress(player, quest.id);
    changed = applyHistoricalRewards(
      player,
      quest,
      progress,
      updates,
    ) || changed;
    changed = reconcileBossObjectives(
      quest,
      progress,
      defeatedBosses,
      updates,
    ) || changed;
    changed = advanceReadyStages(
      player,
      quest,
      progress,
      updates,
    ) || changed;
  }

  changed = repairQuestItems(player) || changed;
  return { changed, updates };
}

function getNpcName(npcId: string): string {
  return QUEST_NPCS.find((npc) => npc.id === npcId)?.name ?? "Quest Giver";
}

function questAvailable(
  player: PlayerState,
  quest: QuestDefinition,
): boolean {
  if (quest.unlockMainStage === undefined) return true;
  const main = getQuestProgress(player, MAIN_QUEST_ID);
  return main.status === "completed" || main.stage >= quest.unlockMainStage;
}

function findActiveNpcObjective(
  player: PlayerState,
  quest: QuestDefinition,
  npcId: string,
): QuestNpcInteraction | null {
  const progress = getQuestProgress(player, quest.id);
  if (progress.status !== "active") return null;

  const objective = getCurrentStage(quest, progress).objectives.find(
    (candidate) =>
      candidate.type === "talk"
      && candidate.targetId === npcId
      && !objectiveComplete(progress, candidate)
      && prerequisitesComplete(progress, candidate),
  );
  if (!objective) return null;

  return {
    kind: "objective",
    questId: quest.id,
    npcId,
    objectiveId: objective.id,
    speaker: getNpcName(npcId),
    pages: objective.dialogue ?? [objective.description],
  };
}

/** Return the highest-priority quest interaction available for an NPC. */
export function getNpcQuestInteraction(
  player: PlayerState,
  npcId: string,
): QuestNpcInteraction | null {
  const mainInteraction = findActiveNpcObjective(
    player,
    getQuestDefinition(MAIN_QUEST_ID),
    npcId,
  );
  if (mainInteraction) return mainInteraction;

  for (const quest of QUESTS) {
    if (quest.kind !== "side") continue;
    const interaction = findActiveNpcObjective(player, quest, npcId);
    if (interaction) return interaction;
  }

  for (const quest of QUESTS) {
    if (
      quest.kind === "side"
      && quest.startNpcId === npcId
      && getQuestProgress(player, quest.id).status === "inactive"
      && questAvailable(player, quest)
    ) {
      return {
        kind: "start",
        questId: quest.id,
        npcId,
        speaker: getNpcName(npcId),
        pages: quest.startDialogue ?? [`Started ${quest.title}.`],
      };
    }
  }

  return null;
}

function startQuest(
  player: PlayerState,
  quest: QuestDefinition,
  updates: QuestUpdate[],
): boolean {
  const progress = getQuestProgress(player, quest.id);
  if (progress.status !== "inactive") return false;
  progress.status = "active";
  progress.stage = 0;
  progress.objectives = {};
  updates.push({
    type: "quest",
    questId: quest.id,
    message: `Quest started: ${quest.title}`,
  });
  return applyRewards(
    player,
    quest,
    progress,
    quest.startRewards ?? [],
    updates,
  ) || true;
}

/** Apply a quest interaction only after its final dialogue page is acknowledged. */
export function completeNpcQuestInteraction(
  player: PlayerState,
  defeatedBosses: Set<string>,
  interaction: QuestNpcInteraction,
): QuestProcessResult {
  const quest = getQuestDefinition(interaction.questId);
  const progress = getQuestProgress(player, quest.id);
  const updates: QuestUpdate[] = [];
  let changed = false;

  if (interaction.kind === "start") {
    if (
      quest.startNpcId === interaction.npcId
      && questAvailable(player, quest)
    ) {
      changed = startQuest(player, quest, updates);
    }
  } else if (progress.status === "active" && interaction.objectiveId) {
    const objective = getCurrentStage(quest, progress).objectives.find(
      (candidate) =>
        candidate.id === interaction.objectiveId
        && candidate.type === "talk"
        && candidate.targetId === interaction.npcId
        && prerequisitesComplete(progress, candidate),
    );
    if (objective) {
      changed = completeObjective(
        quest,
        progress,
        objective,
        objectiveRequired(objective),
        updates,
      );
      changed = advanceReadyStages(
        player,
        quest,
        progress,
        updates,
      ) || changed;
    }
  }

  if (changed) {
    const reconciled = reconcileQuestState(player, defeatedBosses);
    updates.push(...reconciled.updates);
    changed = reconciled.changed || changed;
  }
  return { changed, updates };
}

function recordDefeatForQuest(
  player: PlayerState,
  quest: QuestDefinition,
  monsterId: string,
  updates: QuestUpdate[],
): boolean {
  const progress = getQuestProgress(player, quest.id);
  if (progress.status !== "active") return false;
  let changed = false;

  for (const objective of getCurrentStage(quest, progress).objectives) {
    if (
      objective.type === "defeat"
      && objective.targetId === monsterId
      && prerequisitesComplete(progress, objective)
    ) {
      changed = completeObjective(
        quest,
        progress,
        objective,
        1,
        updates,
      ) || changed;
    }
  }

  for (const objective of quest.optionalObjectives ?? []) {
    if (
      progress.stage >= objective.unlockStage
      && objective.targetId === monsterId
    ) {
      changed = completeObjective(
        quest,
        progress,
        objective,
        1,
        updates,
      ) || changed;
    }
  }

  changed = advanceReadyStages(
    player,
    quest,
    progress,
    updates,
  ) || changed;
  return changed;
}

/** Record a successful battle victory for every active quest. */
export function recordMonsterDefeat(
  player: PlayerState,
  defeatedBosses: Set<string>,
  monsterId: string,
): QuestProcessResult {
  const updates: QuestUpdate[] = [];
  let changed = false;
  for (const quest of QUESTS) {
    changed = recordDefeatForQuest(
      player,
      quest,
      monsterId,
      updates,
    ) || changed;
  }

  const reconciled = reconcileQuestState(player, defeatedBosses);
  updates.push(...reconciled.updates);
  return {
    changed: changed || reconciled.changed,
    updates,
  };
}

/** Evaluate a hard city or dungeon quest gate. */
export function getQuestAccessDecision(
  player: PlayerState,
  target: QuestAccessTarget,
): QuestAccessDecision {
  const rule = QUEST_ACCESS_RULES.find(
    (candidate) =>
      candidate.type === target.type && candidate.targetId === target.id,
  );
  if (!rule) return { allowed: true };

  const progress = getQuestProgress(player, MAIN_QUEST_ID);
  if (progress.status === "completed" || progress.stage > rule.minimumMainStage) {
    return { allowed: true, ruleId: rule.id };
  }
  if (progress.status !== "active" || progress.stage < rule.minimumMainStage) {
    return {
      allowed: false,
      ruleId: rule.id,
      message: rule.blockedMessage,
    };
  }

  const objectivesMet = (rule.requiredObjectiveIds ?? []).every(
    (objectiveId) => (progress.objectives[objectiveId] ?? 0) > 0,
  );
  return objectivesMet
    ? { allowed: true, ruleId: rule.id }
    : {
      allowed: false,
      ruleId: rule.id,
      message: rule.blockedMessage,
    };
}

function dangerMatches(
  context: QuestDangerContext,
  rule: (typeof QUEST_DANGER_RULES)[number],
): boolean {
  if (context.type === "city") return rule.cityIds.includes(context.id);
  if (context.type === "dungeon") return rule.dungeonIds.includes(context.id);
  return rule.chunks.some(
    (chunk) => chunk.x === context.x && chunk.y === context.y,
  );
}

/** Return active soft-gate modifiers for a location. */
export function getQuestDangerState(
  player: PlayerState,
  context: QuestDangerContext,
): QuestDangerState | null {
  const progress = getQuestProgress(player, MAIN_QUEST_ID);
  if (progress.status === "completed") return null;

  const rule = QUEST_DANGER_RULES.find(
    (candidate) =>
      progress.stage < candidate.untilMainStage
      && dangerMatches(context, candidate),
  );
  if (!rule) return null;

  return {
    id: rule.id,
    warning: rule.warning,
    encounterRateMultiplier: rule.encounterRateMultiplier,
    effectiveLevelOffset: rule.effectiveLevelOffset,
    seen: ensureQuestLog(player).seenWarnings.includes(rule.id),
  };
}

export function markQuestWarningSeen(
  player: PlayerState,
  warningId: string,
): boolean {
  const log = ensureQuestLog(player);
  if (
    !QUEST_DANGER_RULES.some((rule) => rule.id === warningId)
    || log.seenWarnings.includes(warningId)
  ) {
    return false;
  }
  log.seenWarnings.push(warningId);
  return true;
}

/** Build render-ready journal entries without exposing mutable definitions. */
export function buildQuestJournal(player: PlayerState): QuestJournalEntry[] {
  return QUESTS
    .filter((quest) => getQuestProgress(player, quest.id).status !== "inactive")
    .map((quest) => {
      const progress = getQuestProgress(player, quest.id);
      const stage = getCurrentStage(quest, progress);
      const currentObjectives = progress.status === "completed"
        ? []
        : stage.objectives;
      const optionalObjectives = (quest.optionalObjectives ?? []).filter(
        (objective) =>
          progress.status === "completed"
          || progress.stage >= objective.unlockStage,
      );
      const objectives = [
        ...currentObjectives.map((objective) => ({
          id: objective.id,
          description: objective.description,
          current: progress.objectives[objective.id] ?? 0,
          required: objectiveRequired(objective),
          complete: objectiveComplete(progress, objective),
          optional: false,
        })),
        ...optionalObjectives.map((objective) => ({
          id: objective.id,
          description: objective.description,
          current: progress.objectives[objective.id] ?? 0,
          required: objectiveRequired(objective),
          complete: objectiveComplete(progress, objective),
          optional: true,
        })),
      ];
      return {
        id: quest.id,
        title: quest.title,
        kind: quest.kind,
        status: progress.status,
        stageTitle: progress.status === "completed" ? "Completed" : stage.title,
        summary: progress.status === "completed" ? quest.summary : stage.summary,
        objectives,
      };
    });
}

export function getQuestMarkerForNpc(
  player: PlayerState,
  npcId: string,
): "available" | "active" | null {
  const interaction = getNpcQuestInteraction(player, npcId);
  if (!interaction) return null;
  return interaction.kind === "start" ? "available" : "active";
}

export function isQuestId(value: string): value is QuestId {
  return QUEST_IDS.some((questId) => questId === value);
}

export function startQuestForDebug(
  player: PlayerState,
  defeatedBosses: Set<string>,
  questId: QuestId,
): QuestProcessResult {
  const quest = getQuestDefinition(questId);
  const updates: QuestUpdate[] = [];
  const changed = startQuest(player, quest, updates);
  const reconciled = reconcileQuestState(player, defeatedBosses);
  updates.push(...reconciled.updates);
  return { changed: changed || reconciled.changed, updates };
}

export function setQuestStageForDebug(
  player: PlayerState,
  defeatedBosses: Set<string>,
  questId: QuestId,
  stage: number,
): QuestProcessResult {
  const quest = getQuestDefinition(questId);
  const progress = getQuestProgress(player, questId);
  const nextStage = Math.min(Math.max(stage, 0), quest.stages.length - 1);
  progress.status = "active";
  progress.stage = nextStage;

  const optionalIds = new Set(
    (quest.optionalObjectives ?? []).map((objective) => objective.id),
  );
  const retainedOptionalProgress = Object.fromEntries(
    Object.entries(progress.objectives).filter(([objectiveId]) =>
      optionalIds.has(objectiveId)
    ),
  );
  progress.objectives = retainedOptionalProgress;
  for (let index = 0; index < nextStage; index++) {
    for (const objective of quest.stages[index].objectives) {
      progress.objectives[objective.id] = objectiveRequired(objective);
    }
  }

  const updates: QuestUpdate[] = [{
    type: "stage",
    questId,
    message: `${quest.title}: ${quest.stages[nextStage].title}`,
  }];
  const reconciled = reconcileQuestState(player, defeatedBosses);
  updates.push(...reconciled.updates);
  return { changed: true, updates };
}

export function setQuestStatusForDebug(
  player: PlayerState,
  defeatedBosses: Set<string>,
  questId: QuestId,
  status: QuestStatus,
): QuestProcessResult {
  if (status === "completed") {
    return completeQuestForDebug(player, defeatedBosses, questId);
  }
  const progress = getQuestProgress(player, questId);
  progress.status = status;
  if (status === "inactive") {
    progress.stage = 0;
    progress.objectives = {};
  }
  const reconciled = reconcileQuestState(player, defeatedBosses);
  return {
    changed: true,
    updates: [{
      type: "quest",
      questId,
      message: `${getQuestDefinition(questId).title}: ${status}`,
    }, ...reconciled.updates],
  };
}

export function advanceQuestForDebug(
  player: PlayerState,
  defeatedBosses: Set<string>,
  questId: QuestId,
): QuestProcessResult {
  const quest = getQuestDefinition(questId);
  const progress = getQuestProgress(player, questId);
  if (progress.status === "inactive") {
    progress.status = "active";
  }
  if (progress.status === "completed") {
    return { changed: false, updates: [] };
  }
  for (const objective of getCurrentStage(quest, progress).objectives) {
    progress.objectives[objective.id] = objectiveRequired(objective);
  }
  const updates: QuestUpdate[] = [];
  const changed = advanceReadyStages(player, quest, progress, updates);
  const reconciled = reconcileQuestState(player, defeatedBosses);
  updates.push(...reconciled.updates);
  return { changed: changed || reconciled.changed, updates };
}

export function resetQuestForDebug(
  player: PlayerState,
  questId: QuestId,
): QuestProcessResult {
  const progress = getQuestProgress(player, questId);
  const claimedRewards = [...progress.claimedRewards];
  ensureQuestLog(player).quests[questId] = {
    ...createDefaultProgress(questId),
    claimedRewards,
  };
  repairQuestItems(player);
  return {
    changed: true,
    updates: [{
      type: "quest",
      questId,
      message: `Reset ${getQuestDefinition(questId).title}.`,
    }],
  };
}

export function completeQuestForDebug(
  player: PlayerState,
  defeatedBosses: Set<string>,
  questId: QuestId,
): QuestProcessResult {
  const quest = getQuestDefinition(questId);
  const progress = getQuestProgress(player, questId);
  progress.status = "active";
  progress.stage = quest.stages.length - 1;
  for (const stage of quest.stages) {
    for (const objective of stage.objectives) {
      progress.objectives[objective.id] = objectiveRequired(objective);
    }
  }

  const updates: QuestUpdate[] = [];
  const changed = advanceReadyStages(player, quest, progress, updates);
  const reconciled = reconcileQuestState(player, defeatedBosses);
  updates.push(...reconciled.updates);
  return { changed: changed || reconciled.changed, updates };
}

export function formatQuestStates(player: PlayerState): string[] {
  return QUESTS.map((quest) => {
    const progress = getQuestProgress(player, quest.id);
    const stage = quest.stages[Math.min(progress.stage, quest.stages.length - 1)];
    return `${quest.id}: ${progress.status}, stage ${progress.stage} (${stage.title})`;
  });
}
