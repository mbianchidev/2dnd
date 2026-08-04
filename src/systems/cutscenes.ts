import {
  CAMPAIGN_BOSS_IDS,
  CAMPAIGN_EPILOGUE_CUTSCENE_ID,
  CUTSCENE_IDS,
  CUTSCENE_TRIGGERS,
  getCutsceneDefinition,
  isCutsceneId,
  type CutsceneDefinition,
  type CutsceneEvent,
  type CutsceneId,
  type CutsceneTriggerCondition,
} from "../data/cutscenes";
import { CITIES } from "../data/map";
import { getBoss } from "../data/monsters";
import {
  MAIN_QUEST_ID,
  QUEST_IDS,
  QUESTS,
  type QuestId,
  type QuestProgress,
} from "../data/quests";
import { getPlayerClass } from "./classes";
import { isQuestCompleted } from "./quests";
import type { CodexData } from "./codex";
import type {
  PlayerProgression,
  PlayerState,
} from "./player";

export interface CampaignEndingSummary {
  hero: string;
  party: string[];
  rewards: string[];
  optionalBonuses: string[];
  campaignBosses: string[];
  discoveredCities: {
    current: number;
    total: number;
  };
  codexEntries: number;
  pendingProgression: string[];
}

export interface CutsceneTriggerSnapshot {
  readonly satisfiedTriggerIds: ReadonlySet<string>;
}

function resolveQuestId(value: string): QuestId | undefined {
  return QUEST_IDS.find((questId) => questId === value);
}

function getQuestContext(
  player: PlayerState,
  questIdValue: string,
): {
  questId: QuestId;
  progress: QuestProgress;
} | undefined {
  const questId = resolveQuestId(questIdValue);
  if (!questId) return undefined;
  return {
    questId,
    progress: player.progression.quests.quests[questId],
  };
}

function hasReachedStage(
  player: PlayerState,
  questIdValue: string,
  stageId: string,
): boolean {
  const context = getQuestContext(player, questIdValue);
  if (!context || context.progress.status === "locked") return false;
  const stageIndex = QUESTS[context.questId].stages.findIndex(
    (stage) => stage.id === stageId,
  );
  if (stageIndex < 0) return false;
  return context.progress.status === "completed"
    || context.progress.stage >= stageIndex;
}

function triggerConditionSatisfied(
  condition: CutsceneTriggerCondition,
  player: PlayerState,
  defeatedBosses: ReadonlySet<string>,
): boolean {
  if (condition.type === "event") return false;
  if (condition.type === "bossDefeated") {
    return defeatedBosses.has(condition.bossId);
  }
  if (condition.type === "dungeonEntered") {
    return player.position.inDungeon
      && player.position.dungeonId === condition.dungeonId;
  }
  if (condition.type === "companionRecruited") {
    return player.party.companions.some(
      (companion) => companion.id === condition.companionId,
    );
  }
  if (condition.type === "questStage") {
    return hasReachedStage(
      player,
      condition.questId,
      condition.stageId,
    );
  }
  if (condition.type === "questCompleted") {
    const context = getQuestContext(player, condition.questId);
    return context?.progress.status === "completed";
  }
  if (condition.type === "questObjective") {
    const context = getQuestContext(player, condition.questId);
    return (context?.progress.objectives[condition.objectiveId] ?? 0) > 0;
  }

  const context = getQuestContext(player, condition.questId);
  if (!context || !hasReachedStage(
    player,
    condition.questId,
    condition.stageId,
  )) {
    return false;
  }
  const stageIndex = QUESTS[context.questId].stages.findIndex(
    (stage) => stage.id === condition.stageId,
  );
  if (
    context.progress.status === "completed"
    || context.progress.stage > stageIndex
  ) {
    return true;
  }
  return (condition.objectiveIds ?? []).every(
    (objectiveId) => (context.progress.objectives[objectiveId] ?? 0) > 0,
  );
}

export function captureCutsceneTriggerSnapshot(
  player: PlayerState,
  defeatedBosses: ReadonlySet<string>,
): CutsceneTriggerSnapshot {
  const satisfiedTriggerIds = new Set<string>();
  for (const trigger of CUTSCENE_TRIGGERS) {
    if (
      trigger.condition.type !== "event"
      && triggerConditionSatisfied(
        trigger.condition,
        player,
        defeatedBosses,
      )
    ) {
      satisfiedTriggerIds.add(trigger.id);
    }
  }
  return { satisfiedTriggerIds };
}

function uniqueCutsceneIds(ids: readonly CutsceneId[]): CutsceneId[] {
  return [...new Set(ids)];
}

export function collectNewlyTriggeredCutsceneIds(
  before: CutsceneTriggerSnapshot,
  after: CutsceneTriggerSnapshot,
): CutsceneId[] {
  return uniqueCutsceneIds(
    CUTSCENE_TRIGGERS
      .filter((trigger) =>
        trigger.condition.type !== "event"
        && after.satisfiedTriggerIds.has(trigger.id)
        && !before.satisfiedTriggerIds.has(trigger.id)
      )
      .map((trigger, index) => ({ trigger, index }))
      .sort((left, right) =>
        left.trigger.priority - right.trigger.priority
        || left.index - right.index
      )
      .map(({ trigger }) => trigger.cutsceneId),
  );
}

export function getEventCutsceneIds(event: CutsceneEvent): CutsceneId[] {
  return uniqueCutsceneIds(
    CUTSCENE_TRIGGERS
      .filter((trigger) => {
        const condition = trigger.condition;
        if (
          condition.type !== "event"
          || condition.event !== event.type
        ) {
          return false;
        }
        if (event.type === "bossPre") {
          return condition.targetId === event.bossId;
        }
        return condition.targetId === undefined;
      })
      .map((trigger, index) => ({ trigger, index }))
      .sort((left, right) =>
        left.trigger.priority - right.trigger.priority
        || left.index - right.index
      )
      .map(({ trigger }) => trigger.cutsceneId),
  );
}

export function getNewGameCutsceneIds(
  player: PlayerState,
  defeatedBosses: ReadonlySet<string>,
): CutsceneId[] {
  const emptySnapshot: CutsceneTriggerSnapshot = {
    satisfiedTriggerIds: new Set(),
  };
  return uniqueCutsceneIds([
    ...getEventCutsceneIds({ type: "newGame" }),
    ...collectNewlyTriggeredCutsceneIds(
      emptySnapshot,
      captureCutsceneTriggerSnapshot(player, defeatedBosses),
    ),
  ]);
}

export function normalizeSeenCutsceneIds(value: unknown): CutsceneId[] {
  if (!Array.isArray(value)) return [];
  const normalized: CutsceneId[] = [];
  for (const entry of value) {
    if (!isCutsceneId(entry) || normalized.includes(entry)) continue;
    normalized.push(entry);
  }
  return normalized;
}

export function normalizePendingCutsceneIds(
  value: unknown,
  seenCutsceneIds: readonly CutsceneId[] = [],
): CutsceneId[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set(seenCutsceneIds);
  const normalized: CutsceneId[] = [];
  for (const entry of value) {
    if (
      !isCutsceneId(entry)
      || seen.has(entry)
      || normalized.includes(entry)
    ) {
      continue;
    }
    normalized.push(entry);
  }
  return normalized;
}

export function hasSeenCutscene(
  progression: Pick<PlayerProgression, "seenCutsceneIds">,
  cutsceneId: CutsceneId,
): boolean {
  return progression.seenCutsceneIds.includes(cutsceneId);
}

export function markCutsceneSeen(
  progression: Pick<PlayerProgression, "seenCutsceneIds">,
  cutsceneId: CutsceneId,
): boolean {
  if (hasSeenCutscene(progression, cutsceneId)) return false;
  progression.seenCutsceneIds.push(cutsceneId);
  return true;
}

export function queueCutscenes(
  progression: Pick<
  PlayerProgression,
  "pendingCutsceneIds" | "seenCutsceneIds"
  >,
  cutsceneIds: readonly CutsceneId[],
): CutsceneId[] {
  const queued: CutsceneId[] = [];
  for (const cutsceneId of cutsceneIds) {
    if (
      progression.seenCutsceneIds.includes(cutsceneId)
      || progression.pendingCutsceneIds.includes(cutsceneId)
    ) {
      continue;
    }
    progression.pendingCutsceneIds.push(cutsceneId);
    queued.push(cutsceneId);
  }
  return queued;
}

export function completeCutscene(
  progression: Pick<
  PlayerProgression,
  "pendingCutsceneIds" | "seenCutsceneIds"
  >,
  cutsceneId: CutsceneId,
): boolean {
  const pendingCount = progression.pendingCutsceneIds.length;
  progression.pendingCutsceneIds = progression.pendingCutsceneIds.filter(
    (pendingId) => pendingId !== cutsceneId,
  );
  return markCutsceneSeen(progression, cutsceneId)
    || progression.pendingCutsceneIds.length !== pendingCount;
}

export function getNextPendingCutscene(
  progression: Pick<PlayerProgression, "pendingCutsceneIds">,
): CutsceneId | undefined {
  return progression.pendingCutsceneIds[0];
}

export function shouldShowCampaignEpilogue(player: PlayerState): boolean {
  return isQuestCompleted(
    player.progression.quests,
    MAIN_QUEST_ID,
  ) && !hasSeenCutscene(
    player.progression,
    CAMPAIGN_EPILOGUE_CUTSCENE_ID,
  );
}

export function ensureLegacyCampaignEpilogueQueued(
  player: PlayerState,
): boolean {
  if (!shouldShowCampaignEpilogue(player)) return false;
  return queueCutscenes(
    player.progression,
    [CAMPAIGN_EPILOGUE_CUTSCENE_ID],
  ).length > 0;
}

export function shouldLaunchCampaignEpilogueAfterQuestUpdate(
  wasCompleted: boolean,
  player: PlayerState,
): boolean {
  return !wasCompleted && shouldShowCampaignEpilogue(player);
}

export function canReplayCampaignEpilogue(player: PlayerState): boolean {
  return isQuestCompleted(
    player.progression.quests,
    MAIN_QUEST_ID,
  ) && hasSeenCutscene(
    player.progression,
    CAMPAIGN_EPILOGUE_CUTSCENE_ID,
  );
}

export function getChronicleCutscenes(
  progression: Pick<PlayerProgression, "seenCutsceneIds">,
): readonly CutsceneDefinition<CutsceneId>[] {
  const seen = new Set(progression.seenCutsceneIds);
  return CUTSCENE_IDS
    .filter((cutsceneId) => seen.has(cutsceneId))
    .map(getCutsceneDefinition)
    .filter((definition) => definition.chronicle !== false);
}

function formatPartyMember(
  member: Pick<PlayerState, "appearanceId" | "level" | "name">,
): string {
  return `${member.name} - Lv.${member.level} ${getPlayerClass(member.appearanceId).label}`;
}

export function buildCampaignEndingSummary(
  player: PlayerState,
  defeatedBosses: ReadonlySet<string>,
  codex: CodexData,
): CampaignEndingSummary {
  const progress = player.progression.quests.quests[MAIN_QUEST_ID];
  const claimedRewards = new Set(progress.claimedRewards);
  const rewards = QUESTS[MAIN_QUEST_ID].completionRewards ?? [];
  const pendingProgression: string[] = [];
  if (player.pendingLevelUps > 0) {
    pendingProgression.push(
      `${player.name} has ${player.pendingLevelUps} level up${player.pendingLevelUps === 1 ? "" : "s"} ready at the next rest.`,
    );
  }
  if (player.pendingStatPoints > 0) {
    pendingProgression.push(
      `${player.name} has ${player.pendingStatPoints} ability point${player.pendingStatPoints === 1 ? "" : "s"} to allocate.`,
    );
  }

  return {
    hero: formatPartyMember(player),
    party: [
      formatPartyMember(player),
      ...player.party.companions.map(formatPartyMember),
    ],
    rewards: rewards
      .filter((reward) =>
        reward.optionalObjectiveId === undefined
        && claimedRewards.has(reward.id)
      )
      .map((reward) => reward.message),
    optionalBonuses: rewards
      .filter((reward) =>
        reward.optionalObjectiveId !== undefined
        && claimedRewards.has(reward.id)
      )
      .map((reward) => reward.message),
    campaignBosses: CAMPAIGN_BOSS_IDS
      .filter((bossId) => defeatedBosses.has(bossId))
      .map((bossId) => getBoss(bossId)?.name ?? bossId),
    discoveredCities: {
      current: new Set(player.progression.discoveredCities).size,
      total: CITIES.length,
    },
    codexEntries: Object.keys(codex.entries).length,
    pendingProgression,
  };
}
