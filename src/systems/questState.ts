import {
  MAIN_QUEST_ID,
  QUEST_DANGER_RULES,
  QUESTS,
  createInitialQuestLog,
} from "../data/quests";
import type {
  QuestDefinition,
  QuestId,
  QuestLogState,
  QuestObjectiveDefinition,
  QuestOptionalObjectiveDefinition,
  QuestProgress,
  QuestRewardDefinition,
  QuestStatus,
} from "../data/quests";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) ? value : fallback;
}

function isQuestStatus(value: unknown): value is QuestStatus {
  return value === "inactive" || value === "active" || value === "completed";
}

export function objectiveRequired(
  objective: QuestObjectiveDefinition,
): number {
  return Math.max(1, objective.required ?? 1);
}

function allObjectives(quest: QuestDefinition): Array<
  QuestObjectiveDefinition | QuestOptionalObjectiveDefinition
> {
  return [
    ...quest.stages.flatMap((stage) => stage.objectives),
    ...(quest.optionalObjectives ?? []),
  ];
}

export function allRewards(
  quest: QuestDefinition,
): QuestRewardDefinition[] {
  return [
    ...(quest.startRewards ?? []),
    ...quest.stages.flatMap((stage) => stage.rewards ?? []),
    ...(quest.completionRewards ?? []),
  ];
}

function defaultStatus(questId: QuestId): QuestStatus {
  return questId === MAIN_QUEST_ID ? "active" : "inactive";
}

export function createDefaultProgress(questId: QuestId): QuestProgress {
  return {
    status: defaultStatus(questId),
    stage: 0,
    objectives: {},
    claimedRewards: [],
  };
}

function normalizeQuestProgress(
  value: unknown,
  quest: QuestDefinition,
): QuestProgress {
  const fallback = createDefaultProgress(quest.id);
  if (!isRecord(value)) return fallback;

  const status = isQuestStatus(value["status"])
    ? value["status"]
    : fallback.status;
  const finalStage = quest.stages.length - 1;
  const requestedStage = readInteger(value["stage"], 0);
  const stage = status === "completed"
    ? finalStage
    : Math.min(Math.max(requestedStage, 0), finalStage);

  const objectives: Record<string, number> = {};
  const objectiveRecord = isRecord(value["objectives"])
    ? value["objectives"]
    : {};
  for (const objective of allObjectives(quest)) {
    const required = objectiveRequired(objective);
    const count = readInteger(objectiveRecord[objective.id], 0);
    if (count > 0) {
      objectives[objective.id] = Math.min(Math.max(count, 0), required);
    }
  }

  const completedStageCount = status === "completed"
    ? quest.stages.length
    : stage;
  for (let index = 0; index < completedStageCount; index++) {
    for (const objective of quest.stages[index].objectives) {
      objectives[objective.id] = objectiveRequired(objective);
    }
  }

  const knownRewardIds = new Set(allRewards(quest).map((reward) => reward.id));
  const claimedRewards = Array.isArray(value["claimedRewards"])
    ? [...new Set(
      value["claimedRewards"].filter(
        (rewardId): rewardId is string =>
          typeof rewardId === "string" && knownRewardIds.has(rewardId),
      ),
    )]
    : [];

  return {
    status,
    stage,
    objectives: status === "inactive" ? {} : objectives,
    claimedRewards,
  };
}

/** Normalize untrusted quest save data while retaining only known IDs. */
export function normalizeQuestLog(value: unknown): QuestLogState {
  const defaults = createInitialQuestLog();
  if (!isRecord(value)) return defaults;

  const questRecord = isRecord(value["quests"]) ? value["quests"] : {};
  const quests = { ...defaults.quests };
  for (const quest of QUESTS) {
    quests[quest.id] = normalizeQuestProgress(questRecord[quest.id], quest);
  }

  const knownWarnings = new Set(QUEST_DANGER_RULES.map((rule) => rule.id));
  const seenWarnings = Array.isArray(value["seenWarnings"])
    ? [...new Set(
      value["seenWarnings"].filter(
        (warningId): warningId is string =>
          typeof warningId === "string" && knownWarnings.has(warningId),
      ),
    )]
    : [];

  return { quests, seenWarnings };
}
