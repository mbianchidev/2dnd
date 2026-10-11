import {
  PROGRESSION_PROFILES,
  type HeroProgressionContext,
  type ProgressionTrackProfile,
  type ProgressionWorldRequirement,
} from "../data/classProgression";
import { getCity, getDungeon } from "../data/map";
import { getQuestStageIndex, isQuestCompleted } from "./quests";
import { getAlignmentName, getReputationScore } from "./reputation";
import { isValidProgressionRequirement } from "./classProgression";
import type { CombatActorState, PlayerState } from "./player";

function isSocialScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= -100 && value <= 100;
}

/** Bind entry rules to a live owner; detached characters require a new owner binding. */
export function createHeroProgressionContext(
  getPlayer: () => PlayerState,
  profiles: readonly ProgressionTrackProfile[] = PROGRESSION_PROFILES,
): HeroProgressionContext {
  return {
    profiles,
    world: {
      matches(actor: CombatActorState, requirement: ProgressionWorldRequirement): boolean {
        const player = getPlayer();
        if (player !== actor || !isValidProgressionRequirement(requirement)) return false;
        switch (requirement.type) {
          case "questCompleted":
            return isQuestCompleted(player.progression.quests, requirement.questId);
          case "questStageCompleted": {
            const index = getQuestStageIndex(requirement.questId, requirement.stageId);
            const progress = player.progression.quests.quests[requirement.questId];
            return index !== undefined && (progress.status === "completed"
              || (progress.status === "active" && progress.stage > index));
          }
          case "cityDiscovered":
            return getCity(requirement.cityId) !== undefined
              && player.progression.discoveredCities.includes(requirement.cityId);
          case "city":
            return getCity(requirement.cityId) !== undefined && player.position.inCity
              && player.position.cityId === requirement.cityId && !player.position.inDungeon;
          case "dungeon":
            return getDungeon(requirement.dungeonId) !== undefined && player.position.inDungeon
              && player.position.dungeonId === requirement.dungeonId && !player.position.inCity
              && player.position.dungeonLevel >= (requirement.minimumLevel ?? 0);
          case "overworld":
            return !player.position.inCity && !player.position.inDungeon;
          case "alignment":
            return isSocialScore(player.progression.social.alignment.lawChaos)
              && isSocialScore(player.progression.social.alignment.goodEvil)
              && getAlignmentName(player.progression.social.alignment) === requirement.alignment;
          case "alignmentAxis": {
            const score = player.progression.social.alignment[requirement.axis];
            return isSocialScore(score) && score >= requirement.minimum && score <= (requirement.maximum ?? 100);
          }
          case "reputation": {
            const score = getReputationScore(player.progression.social, requirement.kind, requirement.targetId);
            return isSocialScore(score) && score >= requirement.minimum;
          }
        }
      },
      describeCurrent(actor: CombatActorState, requirement: ProgressionWorldRequirement): string {
        const player = getPlayer();
        if (player !== actor || !isValidProgressionRequirement(requirement)) return "owner unavailable";
        switch (requirement.type) {
          case "alignmentAxis": return String(player.progression.social.alignment[requirement.axis]);
          case "alignment": return getAlignmentName(player.progression.social.alignment);
          case "reputation":
            return String(getReputationScore(player.progression.social, requirement.kind, requirement.targetId));
          case "questCompleted":
          case "questStageCompleted":
            return player.progression.quests.quests[requirement.questId].status
              + ` (stage ${player.progression.quests.quests[requirement.questId].stage})`;
          case "cityDiscovered":
            return player.progression.discoveredCities.includes(requirement.cityId) ? "discovered" : "not discovered";
          case "city": return player.position.inCity ? player.position.cityId : "not in a city";
          case "dungeon":
            return player.position.inDungeon ? `${player.position.dungeonId} floor ${player.position.dungeonLevel}`
              : "not in a dungeon";
          case "overworld":
            return player.position.inCity || player.position.inDungeon ? "inside" : "overworld";
        }
      },
    },
  };
}
