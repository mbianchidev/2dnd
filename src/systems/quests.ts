/**
 * Pure quest progression, persistence normalization, rewards, and interactions.
 */

import {
  MAIN_QUEST_ID,
  QUEST_ENTRANCE_BLOCKS,
  QUEST_IDS,
  QUEST_NPCS,
  QUESTS,
  SIDE_QUEST_ID,
} from "../data/quests";
import { getItem } from "../data/items";
import { debugLog } from "../config";
import type {
  QuestEntranceBlockDefinition,
  QuestEntranceLocation,
  QuestCompletionActionDefinition,
  QuestId,
  QuestLogState,
  QuestNpcId,
  QuestProgress,
  QuestStatus,
} from "../data/quests";
import type { PlayerState } from "./player";

export interface QuestActionResult {
  changed: boolean;
  completed: boolean;
  questId?: QuestId;
  speakerName: string;
  line: string;
  rewardText?: string;
}

export interface QuestJournalEntry {
  id: QuestId;
  name: string;
  type: "main" | "side";
  status: QuestStatus;
  stageTitle: string;
  objective: string;
  reward: string;
}

export interface QuestCompletionAction extends QuestCompletionActionDefinition {
  questId: QuestId;
}

export type QuestCompletionActionHandler = (action: QuestCompletionAction) => void;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isQuestStatus(value: unknown): value is QuestStatus {
  return value === "locked" || value === "active" || value === "completed";
}

function createResult(
  speakerName: string,
  line: string,
  questId?: QuestId,
  changed = false,
  completed = false,
  rewardText?: string,
): QuestActionResult {
  return {
    changed,
    completed,
    questId,
    speakerName,
    line,
    rewardText,
  };
}

function rewardLabel(questId: QuestId): string {
  const reward = QUESTS[questId].reward;
  const itemNames = reward.itemIds
    .map((itemId) => getItem(itemId)?.name ?? itemId)
    .join(", ");
  return itemNames ? `${reward.gold} gold, ${itemNames}` : `${reward.gold} gold`;
}

/** Create the canonical starting quest log. */
export function createQuestLog(): QuestLogState {
  return {
    [MAIN_QUEST_ID]: {
      status: "active",
      stage: 0,
      rewardGranted: false,
    },
    [SIDE_QUEST_ID]: {
      status: "locked",
      stage: 0,
      rewardGranted: false,
    },
  };
}

/** Normalize loaded quest data, dropping unknown quests and repairing invalid fields. */
export function normalizeQuestLog(value: unknown): QuestLogState {
  const defaults = createQuestLog();
  if (!isRecord(value)) return defaults;

  const normalized = createQuestLog();
  for (const questId of QUEST_IDS) {
    const rawProgress = value[questId];
    if (!isRecord(rawProgress)) continue;

    const defaultProgress = defaults[questId];
    const status = isQuestStatus(rawProgress["status"])
      ? rawProgress["status"]
      : defaultProgress.status;
    const maxStage = QUESTS[questId].stages.length - 1;
    const rawStage = rawProgress["stage"];
    const stage = status === "completed"
      ? maxStage
      : typeof rawStage === "number" && Number.isInteger(rawStage)
        ? Math.min(Math.max(rawStage, 0), maxStage)
        : defaultProgress.stage;
    const rewardGranted = status === "completed"
      || rawProgress["rewardGranted"] === true;

    normalized[questId] = {
      status,
      stage: status === "locked" ? 0 : stage,
      rewardGranted,
    };
  }

  return normalized;
}

/** Return whether a quest has reached a stage, treating completion as fully reached. */
export function hasReachedQuestStage(
  questLog: QuestLogState,
  questId: QuestId,
  requiredStage: number,
): boolean {
  const progress = questLog[questId];
  return progress.status === "completed"
    || (progress.status === "active" && progress.stage >= requiredStage);
}

/** Return whether a quest has reached its completed state. */
export function isQuestCompleted(
  questLog: QuestLogState,
  questId: QuestId,
): boolean {
  return questLog[questId].status === "completed";
}

/**
 * Return completion actions for all completed quests.
 *
 * Actions are intentionally replayable. Consumers use `id` as an idempotency
 * key or apply their own unique target state (for example, recruited IDs).
 */
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

/** Replay completed-quest actions through an idempotent consumer callback. */
export function replayQuestCompletionActions(
  questLog: QuestLogState,
  handler: QuestCompletionActionHandler,
  actionType?: string,
): void {
  for (const action of getQuestCompletionActions(questLog, actionType)) {
    handler(action);
  }
}

function grantQuestReward(player: PlayerState, questId: QuestId): string | undefined {
  const progress = player.progression.quests[questId];
  if (progress.rewardGranted) return undefined;

  const reward = QUESTS[questId].reward;
  player.gold += reward.gold;
  for (const itemId of reward.itemIds) {
    const item = getItem(itemId);
    if (!item) {
      debugLog(`[quest] Missing reward item "${itemId}" for ${questId}`);
      continue;
    }
    if (item.type !== "consumable" && player.inventory.some((owned) => owned.id === item.id)) {
      continue;
    }
    player.inventory.push({ ...item });
  }
  progress.rewardGranted = true;
  return rewardLabel(questId);
}

function completeQuest(player: PlayerState, questId: QuestId): QuestActionResult {
  const quest = QUESTS[questId];
  const progress = player.progression.quests[questId];
  if (progress.status === "completed") {
    return createResult(
      quest.name,
      `${quest.name} is already complete.`,
      questId,
    );
  }

  const rewardText = grantQuestReward(player, questId);
  progress.status = "completed";
  progress.stage = quest.stages.length - 1;
  progress.rewardGranted = true;
  return createResult(
    quest.name,
    quest.outcome,
    questId,
    true,
    true,
    rewardText,
  );
}

/** Advance a quest one debug/test step, completing it after its final stage. */
export function advanceQuest(player: PlayerState, questId: QuestId): QuestActionResult {
  const quest = QUESTS[questId];
  const progress = player.progression.quests[questId];

  if (progress.status === "completed") {
    return createResult(quest.name, `${quest.name} is already complete.`, questId);
  }
  if (progress.status === "locked") {
    progress.status = "active";
    progress.stage = 0;
    return createResult(quest.name, `Started ${quest.name}.`, questId, true);
  }
  if (progress.stage < quest.stages.length - 1) {
    progress.stage++;
    return createResult(
      quest.name,
      `Advanced to ${quest.stages[progress.stage].title}.`,
      questId,
      true,
    );
  }
  return completeQuest(player, questId);
}

/** Set an exact quest stage/status for deterministic debug scenarios. */
export function setQuestState(
  player: PlayerState,
  questId: QuestId,
  target: number | QuestStatus,
): QuestActionResult {
  const quest = QUESTS[questId];
  const progress = player.progression.quests[questId];

  if (target === "completed") return completeQuest(player, questId);

  const previous: QuestProgress = { ...progress };
  if (typeof target === "number") {
    progress.status = "active";
    progress.stage = Math.min(Math.max(Math.trunc(target), 0), quest.stages.length - 1);
  } else {
    progress.status = target;
    if (target === "locked") progress.stage = 0;
    else progress.stage = Math.min(Math.max(progress.stage, 0), quest.stages.length - 1);
  }

  const changed = previous.status !== progress.status || previous.stage !== progress.stage;
  return createResult(
    quest.name,
    changed
      ? `${quest.name} set to ${progress.status} stage ${progress.stage}.`
      : `${quest.name} was already ${progress.status} stage ${progress.stage}.`,
    questId,
    changed,
  );
}

/** Return the active road/city/dungeon entrance block for a location, if any. */
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
    && !hasReachedQuestStage(
      player.progression.quests,
      block.requiredQuestId,
      block.requiredStage,
    )
  );
}

/** Return a blocked entrance at an overworld tile for rendering. */
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
    && !hasReachedQuestStage(
      player.progression.quests,
      block.requiredQuestId,
      block.requiredStage,
    )
  );
}

/** Build entries shown by the quest journal. Locked quests remain hidden. */
export function getQuestJournalEntries(player: PlayerState): QuestJournalEntry[] {
  const entries: QuestJournalEntry[] = [];
  for (const questId of QUEST_IDS) {
    const quest = QUESTS[questId];
    const progress = player.progression.quests[questId];
    if (progress.status === "locked") continue;

    const stage = quest.stages[progress.stage];
    entries.push({
      id: questId,
      name: quest.name,
      type: quest.type,
      status: progress.status,
      stageTitle: progress.status === "completed" ? "Completed" : stage.title,
      objective: progress.status === "completed" ? quest.outcome : stage.objective,
      reward: rewardLabel(questId),
    });
  }
  return entries;
}

/** Resolve all quest roles attached to a named NPC in deterministic priority order. */
export function resolveQuestNpcInteraction(
  player: PlayerState,
  defeatedBosses: ReadonlySet<string>,
  npcId: QuestNpcId,
): QuestActionResult {
  const main = player.progression.quests[MAIN_QUEST_ID];
  const side = player.progression.quests[SIDE_QUEST_ID];
  const speaker = QUEST_NPCS[npcId].name;

  if (npcId === "elderRowan") {
    if (main.status === "active" && main.stage === 0) {
      main.stage = 1;
      return createResult(
        speaker,
        "The Crypt Lich holds the seal that once guarded the eastern road. Bring it back to me.",
        MAIN_QUEST_ID,
        true,
      );
    }
    if (main.status === "active" && main.stage === 1) {
      if (!defeatedBosses.has("cryptLich")) {
        return createResult(
          speaker,
          "The Heartlands Crypt lies east of Willowdale. Its lich still guards the road seal.",
          MAIN_QUEST_ID,
        );
      }
      main.stage = 2;
      return createResult(
        speaker,
        "The seal answers you. Take it to Warden Ilyra in Sandport and ask her to open the road.",
        MAIN_QUEST_ID,
        true,
      );
    }
    if (side.status === "active" && side.stage === 0) {
      side.stage = 1;
      return createResult(
        speaker,
        "I have Ilyra's warning. Tell her Willowdale will send riders before the barricades fall.",
        SIDE_QUEST_ID,
        true,
      );
    }
    return createResult(
      speaker,
      main.status === "completed"
        ? "The road is bright with travellers again. You gave these lands a future."
        : "Follow the road east, but heed the wardens and the old seals.",
    );
  }

  if (npcId === "wardenIlyra") {
    if (main.status === "active" && main.stage === 2) {
      main.stage = 3;
      return createResult(
        speaker,
        "Rowan's seal is true. The Ashfall and forge barricades are open; end the fire below.",
        MAIN_QUEST_ID,
        true,
      );
    }
    if (
      side.status === "locked"
      && hasReachedQuestStage(player.progression.quests, MAIN_QUEST_ID, 3)
    ) {
      side.status = "active";
      side.stage = 0;
      return createResult(
        speaker,
        "One more task: carry my warning to Elder Rowan before merchants flood the reopened road.",
        SIDE_QUEST_ID,
        true,
      );
    }
    if (side.status === "active" && side.stage === 1) {
      const result = completeQuest(player, SIDE_QUEST_ID);
      return {
        ...result,
        speakerName: speaker,
        line: "Good. Our patrols will meet Willowdale's at dawn. Take this for the miles you spared us.",
      };
    }
    if (side.status === "active") {
      return createResult(
        speaker,
        "Elder Rowan must receive that dispatch before the eastern traffic resumes.",
        SIDE_QUEST_ID,
      );
    }
    return createResult(
      speaker,
      main.status === "completed"
        ? "Ashfall's road is holding. The caravans speak your name at every watchfire."
        : "The eastern barricades stay shut without Rowan's road seal.",
    );
  }

  if (main.status === "active" && main.stage === 3) {
    if (!defeatedBosses.has("infernoForgemaster")) {
      return createResult(
        speaker,
        "The Inferno Forgemaster still poisons the mountain. The Volcanic Forge lies south.",
        MAIN_QUEST_ID,
      );
    }
    const result = completeQuest(player, MAIN_QUEST_ID);
    return {
      ...result,
      speakerName: speaker,
      line: "The forge burns clean. Carry the Dawnforged Blade as proof that Ashfall chose a new path.",
    };
  }

  return createResult(
    speaker,
    main.status === "completed"
      ? "Listen: no screams in the bellows, only honest flame. That is your victory."
      : "Ashfall waits behind the wardens' barricades, and something old stirs below it.",
  );
}
