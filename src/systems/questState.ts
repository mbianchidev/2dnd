import {
  FROST_SILK_QUEST_ID,
  IRON_DISPATCH_QUEST_ID,
  MAIN_QUEST_ID,
  QUEST_DANGER_RULES,
  QUEST_IDS,
  QUESTS,
  RECRUIT_GUARDIAN_QUEST_ID,
  RECRUIT_MYSTIC_QUEST_ID,
  RECRUIT_SCOUT_QUEST_ID,
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
  return value === "locked" || value === "active" || value === "completed";
}

function defaultStatus(questId: QuestId): QuestStatus {
  return questId === MAIN_QUEST_ID ? "active" : "locked";
}

export function objectiveRequired(
  objective: QuestObjectiveDefinition,
): number {
  return Math.max(1, objective.required ?? 1);
}

function allObjectives(
  quest: QuestDefinition,
): Array<QuestObjectiveDefinition | QuestOptionalObjectiveDefinition> {
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

export function createDefaultProgress(questId: QuestId): QuestProgress {
  return {
    status: defaultStatus(questId),
    stage: 0,
    objectives: {},
    claimedRewards: [],
  };
}

export function createQuestLog(): QuestLogState {
  return {
    quests: {
      [MAIN_QUEST_ID]: createDefaultProgress(MAIN_QUEST_ID),
      [IRON_DISPATCH_QUEST_ID]: createDefaultProgress(
        IRON_DISPATCH_QUEST_ID,
      ),
      [FROST_SILK_QUEST_ID]: createDefaultProgress(FROST_SILK_QUEST_ID),
      [RECRUIT_GUARDIAN_QUEST_ID]: createDefaultProgress(
        RECRUIT_GUARDIAN_QUEST_ID,
      ),
      [RECRUIT_SCOUT_QUEST_ID]: createDefaultProgress(
        RECRUIT_SCOUT_QUEST_ID,
      ),
      [RECRUIT_MYSTIC_QUEST_ID]: createDefaultProgress(
        RECRUIT_MYSTIC_QUEST_ID,
      ),
    },
    seenWarnings: [],
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
  const savedObjectives = isRecord(value["objectives"])
    ? value["objectives"]
    : {};
  const objectives: Record<string, number> = {};

  for (const objective of allObjectives(quest)) {
    const count = readInteger(savedObjectives[objective.id], 0);
    if (count > 0) {
      objectives[objective.id] = Math.min(
        count,
        objectiveRequired(objective),
      );
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

  const knownRewardIds = new Set(
    allRewards(quest).map((reward) => reward.id),
  );
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
    stage: status === "locked" ? 0 : stage,
    objectives: status === "locked" ? {} : objectives,
    claimedRewards,
  };
}

function claimedRewardIds(questId: QuestId): string[] {
  return allRewards(QUESTS[questId]).map((reward) => reward.id);
}

function migrateLegacyQuestLog(value: Record<string, unknown>): QuestLogState {
  const migrated = createQuestLog();
  const legacyMain = value["ashenRoad"];
  if (isRecord(legacyMain)) {
    const legacyStatus = isQuestStatus(legacyMain["status"])
      ? legacyMain["status"]
      : "active";
    migrated.quests[MAIN_QUEST_ID] = normalizeQuestProgress(
      legacyStatus === "completed"
        ? {
          status: "completed",
          claimedRewards: claimedRewardIds(MAIN_QUEST_ID),
        }
        : {
          status: legacyStatus,
          stage: readInteger(legacyMain["stage"], 0) > 0 ? 1 : 0,
        },
      QUESTS[MAIN_QUEST_ID],
    );
  }

  const legacySide = value["wardensDispatch"];
  if (isRecord(legacySide) && legacySide["status"] === "completed") {
    migrated.quests[IRON_DISPATCH_QUEST_ID] = normalizeQuestProgress({
      status: "completed",
      claimedRewards: claimedRewardIds(IRON_DISPATCH_QUEST_ID),
    }, QUESTS[IRON_DISPATCH_QUEST_ID]);
  }

  for (const questId of [
    RECRUIT_GUARDIAN_QUEST_ID,
    RECRUIT_SCOUT_QUEST_ID,
    RECRUIT_MYSTIC_QUEST_ID,
  ] as const) {
    const legacyRecruitment = value[questId];
    if (isRecord(legacyRecruitment)) {
      migrated.quests[questId] = normalizeQuestProgress(
        legacyRecruitment,
        QUESTS[questId],
      );
    }
  }
  return migrated;
}

/** Normalize untrusted quest data and migrate legacy flat quest shapes. */
export function normalizeQuestLog(value: unknown): QuestLogState {
  if (!isRecord(value)) return createQuestLog();
  if (
    "ashenRoad" in value
    || "wardensDispatch" in value
    || RECRUIT_GUARDIAN_QUEST_ID in value
    || RECRUIT_SCOUT_QUEST_ID in value
    || RECRUIT_MYSTIC_QUEST_ID in value
  ) {
    return migrateLegacyQuestLog(value);
  }

  const nestedQuestRecord = isRecord(value["quests"])
    ? value["quests"]
    : null;
  const questRecord: Record<string, unknown> = nestedQuestRecord ?? value;
  const normalized = createQuestLog();
  for (const questId of QUEST_IDS) {
    normalized.quests[questId] = normalizeQuestProgress(
      questRecord[questId],
      QUESTS[questId],
    );
  }

  const knownWarnings = new Set(QUEST_DANGER_RULES.map((rule) => rule.id));
  normalized.seenWarnings = nestedQuestRecord && Array.isArray(
    value["seenWarnings"],
  )
    ? [...new Set(
      value["seenWarnings"].filter(
        (warningId): warningId is string =>
          typeof warningId === "string" && knownWarnings.has(warningId),
      ),
    )]
    : [];
  return normalized;
}
