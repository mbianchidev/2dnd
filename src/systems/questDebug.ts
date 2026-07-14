import { QUEST_IDS, QUESTS } from "../data/quests";
import {
  getQuestProgress,
  getQuestStageIndex,
  reconcileQuestState,
} from "./quests";
import { objectiveRequired } from "./questState";
import type {
  QuestId,
  QuestStatus,
} from "../data/quests";
import type { PlayerState } from "./player";
import type { QuestUpdate } from "./quests";

export interface QuestActionResult {
  changed: boolean;
  completed: boolean;
  questId: QuestId;
  line: string;
  rewardText?: string;
}

function createResult(
  player: PlayerState,
  questId: QuestId,
  changed: boolean,
  updates: QuestUpdate[],
  line: string,
): QuestActionResult {
  const rewardText = updates
    .filter((update) => update.type === "reward" || update.type === "item")
    .map((update) => update.message)
    .join(" ");
  return {
    changed,
    completed: getQuestProgress(player, questId).status === "completed",
    questId,
    line,
    rewardText: rewardText || undefined,
  };
}

/** Complete every required objective in the current stage. */
export function advanceQuest(
  player: PlayerState,
  questId: QuestId,
  defeatedBosses: ReadonlySet<string> = new Set<string>(),
): QuestActionResult {
  const quest = QUESTS[questId];
  const progress = getQuestProgress(player, questId);
  if (progress.status === "completed") {
    return createResult(
      player,
      questId,
      false,
      [],
      `${quest.name} is already complete.`,
    );
  }

  if (progress.status === "locked") {
    progress.status = "active";
    progress.stage = 0;
    progress.objectives = {};
    const reconciled = reconcileQuestState(player, defeatedBosses);
    return createResult(
      player,
      questId,
      true,
      reconciled.updates,
      `Started ${quest.name}.`,
    );
  }

  const stage = quest.stages[progress.stage];
  for (const objective of stage.objectives) {
    progress.objectives[objective.id] = objectiveRequired(objective);
  }
  const reconciled = reconcileQuestState(player, defeatedBosses);
  const updatedProgress = getQuestProgress(player, questId);
  return createResult(
    player,
    questId,
    true,
    reconciled.updates,
    updatedProgress.status === "completed"
      ? quest.outcome
      : `Advanced to ${quest.stages[updatedProgress.stage].title}.`,
  );
}

/** Set an exact quest stage or status for deterministic debug scenarios. */
export function setQuestState(
  player: PlayerState,
  questId: QuestId,
  target: number | QuestStatus,
  defeatedBosses: ReadonlySet<string> = new Set<string>(),
): QuestActionResult {
  const quest = QUESTS[questId];
  const progress = getQuestProgress(player, questId);
  const previous = JSON.stringify(progress);

  if (typeof target === "number") {
    progress.status = "active";
    progress.stage = Math.min(
      Math.max(Math.trunc(target), 0),
      quest.stages.length - 1,
    );
    progress.objectives = {};
    for (let index = 0; index < progress.stage; index++) {
      for (const objective of quest.stages[index].objectives) {
        progress.objectives[objective.id] = objectiveRequired(objective);
      }
    }
  } else if (target === "locked") {
    progress.status = "locked";
    progress.stage = 0;
    progress.objectives = {};
  } else if (target === "active") {
    progress.status = "active";
  } else {
    progress.status = "completed";
    progress.stage = quest.stages.length - 1;
    for (const stage of quest.stages) {
      for (const objective of stage.objectives) {
        progress.objectives[objective.id] = objectiveRequired(objective);
      }
    }
  }

  const reconciled = reconcileQuestState(player, defeatedBosses);
  const changed = previous !== JSON.stringify(progress) || reconciled.changed;
  return createResult(
    player,
    questId,
    changed,
    reconciled.updates,
    changed
      ? `${quest.name} set to ${progress.status} stage ${progress.stage}.`
      : `${quest.name} was already ${progress.status} stage ${progress.stage}.`,
  );
}

export function setQuestStageById(
  player: PlayerState,
  questId: QuestId,
  stageId: string,
  defeatedBosses: ReadonlySet<string> = new Set<string>(),
): QuestActionResult | undefined {
  const stage = getQuestStageIndex(questId, stageId);
  return stage === undefined
    ? undefined
    : setQuestState(player, questId, stage, defeatedBosses);
}

export function formatQuestStates(player: PlayerState): string[] {
  return QUEST_IDS.map((questId) => {
    const quest = QUESTS[questId];
    const progress = getQuestProgress(player, questId);
    const stage = quest.stages[progress.stage];
    return `${questId}: ${progress.status} ${progress.stage}/${quest.stages.length - 1} (${stage.id}: ${stage.title})`;
  });
}
