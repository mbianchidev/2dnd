import {
  CAMPAIGN_BOSS_IDS,
  CAMPAIGN_EPILOGUE_CUTSCENE_ID,
  isCutsceneId,
  type CutsceneId,
} from "../data/cutscenes";
import { CITIES } from "../data/map";
import { getBoss } from "../data/monsters";
import {
  MAIN_QUEST_ID,
  QUESTS,
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

export function normalizeSeenCutsceneIds(value: unknown): CutsceneId[] {
  if (!Array.isArray(value)) return [];
  const normalized: CutsceneId[] = [];
  for (const entry of value) {
    if (!isCutsceneId(entry) || normalized.includes(entry)) continue;
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

export function shouldShowCampaignEpilogue(player: PlayerState): boolean {
  return isQuestCompleted(
    player.progression.quests,
    MAIN_QUEST_ID,
  ) && !hasSeenCutscene(
    player.progression,
    CAMPAIGN_EPILOGUE_CUTSCENE_ID,
  );
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
