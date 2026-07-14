/**
 * Pure quest progression, normalization, rewards, interactions, and world rules.
 */

import { getItem } from "../data/items";
import {
  FROST_SILK_QUEST_ID,
  IRON_DISPATCH_QUEST_ID,
  MAIN_QUEST_ID,
  QUEST_DANGER_RULES,
  QUEST_ENTRANCE_BLOCKS,
  QUEST_IDS,
  QUEST_ITEM_IDS,
  QUEST_NPCS,
  QUESTS,
} from "../data/quests";
import { awardXP } from "./player";
import {
  createQuestLog,
  normalizeQuestLog,
  objectiveRequired,
} from "./questState";
import type {
  QuestCompletionActionDefinition,
  QuestDefinition,
  QuestEntranceBlockDefinition,
  QuestEntranceLocation,
  QuestId,
  QuestLogState,
  QuestNpcId,
  QuestObjectiveDefinition,
  QuestProgress,
  QuestRewardDefinition,
  QuestStatus,
} from "../data/quests";
import type { PlayerState } from "./player";

export { createQuestLog, normalizeQuestLog, objectiveRequired };

export type QuestUpdateType =
  | "objective"
  | "stage"
  | "quest"
  | "item"
  | "reward"
  | "warning";

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
  npcId: QuestNpcId;
  objectiveId?: string;
  speaker: string;
  pages: string[];
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
  name: string;
  type: "main" | "side";
  status: QuestStatus;
  stageTitle: string;
  summary: string;
  objectives: QuestJournalObjective[];
}

export interface QuestCompletionAction extends QuestCompletionActionDefinition {
  questId: QuestId;
}

export type QuestCompletionActionHandler = (
  action: QuestCompletionAction,
) => void;

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

function ensureQuestLog(player: PlayerState): QuestLogState {
  if (!player.progression.quests?.quests) {
    player.progression.quests = normalizeQuestLog(
      player.progression.quests,
    );
  }
  return player.progression.quests;
}

export function getQuestProgress(
  player: PlayerState,
  questId: QuestId,
): QuestProgress {
  return ensureQuestLog(player).quests[questId];
}

function getCurrentStage(
  quest: QuestDefinition,
  progress: QuestProgress,
) {
  return quest.stages[Math.min(progress.stage, quest.stages.length - 1)];
}

function objectiveComplete(
  progress: QuestProgress,
  objective: QuestObjectiveDefinition,
): boolean {
  return (progress.objectives[objective.id] ?? 0)
    >= objectiveRequired(objective);
}

function prerequisitesComplete(
  progress: QuestProgress,
  objective: QuestObjectiveDefinition,
): boolean {
  return (objective.prerequisites ?? []).every(
    (objectiveId) => (progress.objectives[objectiveId] ?? 0) > 0,
  );
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
    player.inventory.push({ ...item });
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
  return objectiveId === undefined
    || (progress.objectives[objectiveId] ?? 0) > 0;
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
    if (!optionalObjectiveComplete(progress, reward.optionalObjectiveId)) {
      continue;
    }

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

function advanceReadyStages(
  player: PlayerState,
  quest: QuestDefinition,
  progress: QuestProgress,
  updates: QuestUpdate[],
): boolean {
  let changed = false;
  while (progress.status === "active") {
    const stage = getCurrentStage(quest, progress);
    if (!stage.objectives.every((objective) =>
      objectiveComplete(progress, objective)
    )) {
      break;
    }

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
      updates.push({
        type: "quest",
        questId: quest.id,
        message: `Quest completed: ${quest.name}`,
      });
      changed = applyRewards(
        player,
        quest,
        progress,
        quest.completionRewards ?? [],
        updates,
      ) || true;
      break;
    }

    progress.stage++;
    updates.push({
      type: "stage",
      questId: quest.id,
      message: `${quest.name}: ${getCurrentStage(quest, progress).title}`,
    });
    changed = true;
  }
  return changed;
}

function reconcileBossObjectives(
  quest: QuestDefinition,
  progress: QuestProgress,
  defeatedBosses: ReadonlySet<string>,
  updates: QuestUpdate[],
): boolean {
  if (progress.status !== "active") return false;
  let changed = false;
  for (const objective of getCurrentStage(quest, progress).objectives) {
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
  if (progress.status === "locked") return false;
  let changed = applyRewards(
    player,
    quest,
    progress,
    quest.startRewards ?? [],
    updates,
  );
  const completedStages = progress.status === "completed"
    ? quest.stages.length
    : progress.stage;
  for (let index = 0; index < completedStages; index++) {
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
  const main = getQuestProgress(player, MAIN_QUEST_ID);
  const dispatch = getQuestProgress(player, IRON_DISPATCH_QUEST_ID);
  const frostSilk = getQuestProgress(player, FROST_SILK_QUEST_ID);
  let changed = false;

  if (
    main.status === "active"
    && main.stage > 0
    && !hasInventoryItem(player, QUEST_ITEM_IDS.covenantSigil)
  ) {
    addItem(player, QUEST_ITEM_IDS.covenantSigil, 1, true);
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
 * Reconcile rewards and durable boss objectives after load or quest mutations.
 */
export function reconcileQuestState(
  player: PlayerState,
  defeatedBosses: ReadonlySet<string>,
): QuestProcessResult {
  ensureQuestLog(player);
  const updates: QuestUpdate[] = [];
  let changed = false;

  for (const questId of QUEST_IDS) {
    const quest = QUESTS[questId];
    const progress = getQuestProgress(player, questId);
    changed = applyHistoricalRewards(
      player,
      quest,
      progress,
      updates,
    ) || changed;

    while (progress.status === "active") {
      const bossChanged = reconcileBossObjectives(
        quest,
        progress,
        defeatedBosses,
        updates,
      );
      const stageChanged = advanceReadyStages(
        player,
        quest,
        progress,
        updates,
      );
      changed = bossChanged || stageChanged || changed;
      if (!bossChanged && !stageChanged) break;
    }
  }

  changed = repairQuestItems(player) || changed;
  return { changed, updates };
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
  npcId: QuestNpcId,
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
    speaker: QUEST_NPCS[npcId].name,
    pages: objective.dialogue ?? [objective.description],
  };
}

/** Return the highest-priority quest interaction available for a named NPC. */
export function getNpcQuestInteraction(
  player: PlayerState,
  npcId: QuestNpcId,
): QuestNpcInteraction | null {
  const mainInteraction = findActiveNpcObjective(
    player,
    QUESTS[MAIN_QUEST_ID],
    npcId,
  );
  if (mainInteraction) return mainInteraction;

  for (const questId of QUEST_IDS) {
    const quest = QUESTS[questId];
    if (quest.type !== "side") continue;
    const interaction = findActiveNpcObjective(player, quest, npcId);
    if (interaction) return interaction;
  }

  for (const questId of QUEST_IDS) {
    const quest = QUESTS[questId];
    if (
      quest.type === "side"
      && quest.startNpcId === npcId
      && getQuestProgress(player, questId).status === "locked"
      && questAvailable(player, quest)
    ) {
      return {
        kind: "start",
        questId,
        npcId,
        speaker: QUEST_NPCS[npcId].name,
        pages: quest.startDialogue ?? [`Started ${quest.name}.`],
      };
    }
  }
  return null;
}

export function getQuestNpcIdleDialogue(
  npcId: QuestNpcId,
): { speaker: string; line: string } {
  return {
    speaker: QUEST_NPCS[npcId].name,
    line: QUEST_NPCS[npcId].idleDialogue,
  };
}

function startQuest(
  player: PlayerState,
  quest: QuestDefinition,
  updates: QuestUpdate[],
): boolean {
  const progress = getQuestProgress(player, quest.id);
  if (progress.status !== "locked") return false;
  progress.status = "active";
  progress.stage = 0;
  progress.objectives = {};
  updates.push({
    type: "quest",
    questId: quest.id,
    message: `Quest started: ${quest.name}`,
  });
  return applyRewards(
    player,
    quest,
    progress,
    quest.startRewards ?? [],
    updates,
  ) || true;
}

/** Apply an NPC interaction after its final dialogue page is acknowledged. */
export function completeNpcQuestInteraction(
  player: PlayerState,
  defeatedBosses: ReadonlySet<string>,
  interaction: QuestNpcInteraction,
): QuestProcessResult {
  const quest = QUESTS[interaction.questId];
  const progress = getQuestProgress(player, quest.id);
  const updates: QuestUpdate[] = [];
  let changed = false;

  if (interaction.kind === "start") {
    if (
      quest.startNpcId === interaction.npcId
      && questAvailable(player, quest)
    ) {
      changed = startQuest(player, quest, updates);
      for (const objective of getCurrentStage(quest, progress).objectives) {
        if (
          objective.type === "talk"
          && objective.targetId === interaction.npcId
          && prerequisitesComplete(progress, objective)
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
  return changed;
}

/** Record every defeated combatant, preserving duplicate monster IDs. */
export function recordMonsterDefeats(
  player: PlayerState,
  defeatedBosses: ReadonlySet<string>,
  monsterIds: readonly string[],
): QuestProcessResult {
  const updates: QuestUpdate[] = [];
  let changed = false;
  for (const monsterId of monsterIds) {
    for (const questId of QUEST_IDS) {
      changed = recordDefeatForQuest(
        player,
        QUESTS[questId],
        monsterId,
        updates,
      ) || changed;
    }
  }

  const reconciled = reconcileQuestState(player, defeatedBosses);
  updates.push(...reconciled.updates);
  return {
    changed: changed || reconciled.changed,
    updates,
  };
}

export function recordMonsterDefeat(
  player: PlayerState,
  defeatedBosses: ReadonlySet<string>,
  monsterId: string,
): QuestProcessResult {
  return recordMonsterDefeats(player, defeatedBosses, [monsterId]);
}

/** Return whether a quest has reached a stage, including completed quests. */
export function hasReachedQuestStage(
  questLog: QuestLogState,
  questId: QuestId,
  requiredStage: number,
): boolean {
  const progress = questLog.quests[questId];
  return progress.status === "completed"
    || (progress.status === "active" && progress.stage >= requiredStage);
}

export function isQuestCompleted(
  questLog: QuestLogState,
  questId: QuestId,
): boolean {
  return questLog.quests[questId].status === "completed";
}

export function getQuestCompletionActions(
  questLog: QuestLogState,
  actionType?: string,
): QuestCompletionAction[] {
  const actions: QuestCompletionAction[] = [];
  for (const questId of QUEST_IDS) {
    if (!isQuestCompleted(questLog, questId)) continue;
    for (const action of QUESTS[questId].completionActions ?? []) {
      if (actionType && action.type !== actionType) continue;
      actions.push({ questId, ...action });
    }
  }
  return actions;
}

export function replayQuestCompletionActions(
  questLog: QuestLogState,
  handler: QuestCompletionActionHandler,
  actionType?: string,
): void {
  for (const action of getQuestCompletionActions(questLog, actionType)) {
    handler(action);
  }
}

function blockRequirementsMet(
  player: PlayerState,
  block: QuestEntranceBlockDefinition,
): boolean {
  const progress = getQuestProgress(player, block.requiredQuestId);
  if (progress.status === "completed") return true;
  if (progress.status !== "active" || progress.stage < block.requiredStage) {
    return false;
  }
  if (progress.stage > block.requiredStage) return true;
  return (block.requiredObjectiveIds ?? []).every(
    (objectiveId) => (progress.objectives[objectiveId] ?? 0) > 0,
  );
}

export function getQuestAccessDecision(
  player: PlayerState,
  target: QuestAccessTarget,
): QuestAccessDecision {
  const block = QUEST_ENTRANCE_BLOCKS.find(
    (candidate) =>
      candidate.type === target.type && candidate.targetId === target.id,
  );
  if (!block || blockRequirementsMet(player, block)) {
    return { allowed: true, ruleId: block?.id };
  }
  return {
    allowed: false,
    ruleId: block.id,
    message: block.blockedMessage,
  };
}

export function getBlockedQuestEntrance(
  player: PlayerState,
  location: QuestEntranceLocation,
): QuestEntranceBlockDefinition | undefined {
  return QUEST_ENTRANCE_BLOCKS.find((block) =>
    block.type === location.type
    && block.targetId === location.targetId
    && block.chunkX === location.chunkX
    && block.chunkY === location.chunkY
    && block.tileX === location.tileX
    && block.tileY === location.tileY
    && !blockRequirementsMet(player, block)
  );
}

export function getBlockedQuestEntranceAt(
  player: PlayerState,
  chunkX: number,
  chunkY: number,
  tileX: number,
  tileY: number,
): QuestEntranceBlockDefinition | undefined {
  return QUEST_ENTRANCE_BLOCKS.find((block) =>
    block.chunkX === chunkX
    && block.chunkY === chunkY
    && block.tileX === tileX
    && block.tileY === tileY
    && !blockRequirementsMet(player, block)
  );
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

export function getQuestJournalEntries(
  player: PlayerState,
): QuestJournalEntry[] {
  return QUEST_IDS
    .filter((questId) =>
      getQuestProgress(player, questId).status !== "locked"
    )
    .map((questId) => {
      const quest = QUESTS[questId];
      const progress = getQuestProgress(player, questId);
      const stage = getCurrentStage(quest, progress);
      const currentObjectives = progress.status === "completed"
        ? []
        : stage.objectives;
      const optionalObjectives = progress.status === "completed"
        ? []
        : (quest.optionalObjectives ?? []).filter(
          (objective) => progress.stage >= objective.unlockStage,
        );
      return {
        id: questId,
        name: quest.name,
        type: quest.type,
        status: progress.status,
        stageTitle: progress.status === "completed"
          ? "Completed"
          : stage.title,
        summary: progress.status === "completed"
          ? quest.outcome
          : stage.summary,
        objectives: [
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
        ],
      };
    });
}

export function getQuestMarkerForNpc(
  player: PlayerState,
  npcId: QuestNpcId,
): "available" | "active" | null {
  const interaction = getNpcQuestInteraction(player, npcId);
  if (!interaction) return null;
  return interaction.kind === "start" ? "available" : "active";
}

export function getQuestStageIndex(
  questId: QuestId,
  stageId: string,
): number | undefined {
  const index = QUESTS[questId].stages.findIndex(
    (stage) => stage.id === stageId,
  );
  return index >= 0 ? index : undefined;
}

export function isQuestId(value: string): value is QuestId {
  return QUEST_IDS.some((questId) => questId === value);
}
