import {
  PROGRESSION_PROFILES,
  type HeroProgressionContext,
  type ProgressionTrackProfile,
  type ProgressionWorldRequirement,
} from "../data/classProgression";
import { getCity, getDungeon } from "../data/map";
import { isQuestCompleted } from "./quests";
import { getAlignmentName, getReputationScore } from "./reputation";
import type { CombatActorState, PlayerState } from "./player";

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
        if (player !== actor) return false;
        switch (requirement.type) {
          case "questCompleted":
            return isQuestCompleted(player.progression.quests, requirement.questId);
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
            return getAlignmentName(player.progression.social.alignment) === requirement.alignment;
          case "alignmentAxis":
            return player.progression.social.alignment[requirement.axis] >= requirement.minimum;
          case "reputation":
            return getReputationScore(player.progression.social, requirement.kind, requirement.targetId)
              >= requirement.minimum;
        }
      },
    },
  };
}
