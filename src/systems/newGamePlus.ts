import {
  MAX_NEW_GAME_PLUS_CYCLE, NEW_GAME_PLUS_LIFETIME_REWARD_IDS,
  NEW_GAME_PLUS_POLICY_VERSION, NEW_GAME_PLUS_RESET_ITEM_IDS,
} from "../data/newGamePlus";
import { MAIN_QUEST_ID } from "../data/quests";
import { CUTSCENE_IDS } from "../data/cutscenes";
import { createQuestLog, isQuestCompleted } from "./quests";
import { getNewGameCutsceneIds, queueCutscenes } from "./cutscenes";
import { createWorldEventState } from "./worldEvents";
import { createGatheringState } from "./gathering";
import { createNauticalState } from "./nauticalState";
import { createSocialState } from "./reputation";
import { createWeatherState } from "./weather";
import { getEarnedPendingLevels } from "./classProgression";
import { bindPartyProgression } from "./party";
import { normalizeSaveData, SAVE_VERSION, type SaveData } from "./save";
import {
  isNewGamePlusRequestId, newGamePlusSeed, type NewGamePlusState,
} from "./newGamePlusState";

export type NewGamePlusBuildResult =
  | { ok: true; data: SaveData }
  | { ok: false; message: string };

/** Construct a deterministic detached cycle; no source writes, rewards, rest or gameplay RNG. */
export function buildNewGamePlus(
  source: SaveData,
  requestId: string,
  createdAt: number,
  sourceFingerprint: string,
): NewGamePlusBuildResult {
  if (!isQuestCompleted(source.player.progression.quests, MAIN_QUEST_ID)) {
    return { ok: false, message: "Complete the Twelvefold Covenant through Elowen before starting New Game+." };
  }
  if (!isNewGamePlusRequestId(requestId) || !Number.isSafeInteger(createdAt) || createdAt < 0
    || !/^[0-9a-f]{8}$/.test(sourceFingerprint)) {
    return { ok: false, message: "Invalid New Game+ creation identity." };
  }
  const parentCycle = source.player.newGamePlus?.cycle ?? 0;
  if (parentCycle >= MAX_NEW_GAME_PLUS_CYCLE) {
    return { ok: false, message: `The supported cycle limit is ${MAX_NEW_GAME_PLUS_CYCLE}.` };
  }
  const data = structuredClone(source);
  const player = data.player;
  const old = player.progression;
  const lifetimeRewardIds = new Set(player.newGamePlus?.lifetimeRewardIds ?? []);
  for (const id of NEW_GAME_PLUS_LIFETIME_REWARD_IDS) {
    const separator = id.indexOf("/");
    const questId = id.slice(0, separator);
    const progress = Object.entries(old.quests.quests).find(([key]) => key === questId)?.[1];
    if (progress?.claimedRewards.includes(id.slice(separator + 1))) lifetimeRewardIds.add(id);
  }
  const state: NewGamePlusState = {
    cycle: parentCycle + 1, parentCycle, cycleId: `ng:${requestId}`, requestId,
    sourceFingerprint, createdAt, policyVersion: NEW_GAME_PLUS_POLICY_VERSION,
    lifetimeRewardIds: [...lifetimeRewardIds],
    debug: player.newGamePlus?.debug === true || old.achievements.debugSuppressedIds.length > 0
      || (player.classProgression.debugTrackIds?.length ?? 0) > 0,
  };
  player.newGamePlus = state;
  player.inventory = player.inventory.filter((item) => !NEW_GAME_PLUS_RESET_ITEM_IDS.includes(item.id));
  player.hp = player.maxHp;
  player.mp = player.maxMp;
  player.activeEffects = [];
  player.shortRestsRemaining = 2;
  player.mountId = "";
  player.position = {
    x: 3, y: 3, chunkX: 4, chunkY: 2, inDungeon: false, dungeonId: "",
    dungeonLevel: 0, inCity: false, cityId: "", cityChunkIndex: 0,
  };
  player.lastTownX = 2;
  player.lastTownY = 2;
  player.lastTownChunkX = 4;
  player.lastTownChunkY = 2;
  player.lastBankDay = 0;
  const gathering = createGatheringState(newGamePlusSeed(`${state.cycleId}:gathering`));
  Object.assign(gathering, {
    sequence: old.gathering.sequence, discoveredResourceIds: old.gathering.discoveredResourceIds,
    claimedOutcomeIds: old.gathering.claimedOutcomeIds, stats: old.gathering.stats, history: old.gathering.history,
  });
  const nautical = createNauticalState();
  nautical.ownedBoats = old.nautical.ownedBoats;
  nautical.activeBoatId = old.nautical.activeBoatId;
  const social = createSocialState();
  social.alignment = old.social.alignment;
  old.achievements.pendingNotificationIds = [];
  old.achievements.debugPendingBattle = false;
  old.achievements.debugWorldEventInstanceIds = [];
  old.achievements.debugMutationActive = false;
  old.minigames.pending = null;
  old.minigames.settledSequence = old.minigames.sequence;
  player.progression = {
    openedChests: [], collectedTreasures: [], exploredTiles: {}, discoveredCities: [],
    quests: createQuestLog(), seenCutsceneIds: [], pendingCutsceneIds: [], skillChecks: {},
    trapSeed: newGamePlusSeed(`${state.cycleId}:traps`), trapStates: {},
    trapGuidance: old.trapGuidance, tutorial: old.tutorial,
    worldEvents: createWorldEventState(newGamePlusSeed(`${state.cycleId}:events`)),
    social, devotion: old.devotion, achievements: old.achievements,
    gathering, crafting: old.crafting, nautical, minigames: old.minigames,
    discoveredFeatureIds: old.discoveredFeatureIds, pendingFeatureRevealIds: [],
    debugDiscoveredFeatureIds: old.debugDiscoveredFeatureIds, debugSuppressedFeatureIds: old.debugSuppressedFeatureIds,
  };
  for (const companion of player.party.companions) {
    companion.hp = companion.maxHp;
    companion.mp = companion.maxMp;
    companion.activeEffects = [];
    companion.dialogueCursor = 0;
    const joiningId = CUTSCENE_IDS.find((id) => id === `campaign.companion.${companion.id}`);
    if (joiningId) player.progression.seenCutsceneIds.push(joiningId);
  }
  bindPartyProgression(player);
  player.pendingLevelUps = getEarnedPendingLevels(player);
  for (const companion of player.party.companions) {
    companion.pendingLevelUps = getEarnedPendingLevels(companion);
  }
  data.version = SAVE_VERSION;
  data.defeatedBosses = [];
  data.timeStep = 0;
  data.weatherState = createWeatherState();
  data.playtimeSeconds = 0;
  data.timestamp = createdAt;
  queueCutscenes(player.progression, getNewGameCutsceneIds(player, new Set()));
  const normalized = normalizeSaveData(data);
  return normalized ? { ok: true, data: normalized }
    : { ok: false, message: "New Game+ state failed validation. The completed source is unchanged." };
}
