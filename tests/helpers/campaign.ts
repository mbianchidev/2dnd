import { MAIN_QUEST_ID, QUESTS, QUEST_NPCS } from "../../src/data/quests";
import { createPlayer, awardXP, xpForLevel } from "../../src/systems/player";
import { createCodex } from "../../src/systems/codex";
import { createCurrentSaveData } from "../../src/systems/save";
import {
  completeNpcQuestInteraction, getNpcQuestInteraction, recordMonsterDefeats,
} from "../../src/systems/quests";
import { commitHeroLevelUp, prepareHeroLevelUp } from "../../src/systems/classProgression";
import { createHeroProgressionContext } from "../../src/systems/classProgressionContext";
import type { BaseClassId } from "../../src/data/classProgression";
import type { PlayerState } from "../../src/systems/player";
import type { SaveData } from "../../src/systems/save";

export function completeCampaignThroughOwners(player: PlayerState, bosses: Set<string>): void {
  for (const stage of QUESTS[MAIN_QUEST_ID].stages) {
    for (const objective of stage.objectives) {
      if (objective.type === "defeat") {
        bosses.add(objective.targetId);
        recordMonsterDefeats(player, bosses, [objective.targetId]);
      } else {
        const npcId = Object.values(QUEST_NPCS).find((npc) => npc.id === objective.targetId)?.id;
        if (!npcId) throw new Error(`Missing canonical NPC ${objective.targetId}`);
        const interaction = getNpcQuestInteraction(player, npcId);
        if (!interaction) throw new Error(`Missing real interaction ${objective.id}`);
        completeNpcQuestInteraction(player, bosses, interaction);
      }
    }
  }
}

/** Synthetic completed source; every rank/reward comes from a canonical owner, not a completion flag. */
export function createCompletedCampaign(classId: BaseClassId = "knight", level = 1): SaveData {
  const player = createPlayer("Cycle fixture", {
    strength: 15, dexterity: 14, constitution: 13,
    intelligence: 12, wisdom: 10, charisma: 8,
  }, classId);
  const bosses = new Set<string>();
  completeCampaignThroughOwners(player, bosses);
  if (level > 1) {
    awardXP(player, Math.max(0, xpForLevel(level) - player.xp));
    const context = createHeroProgressionContext(() => player);
    while (player.level < level) {
      const prepared = prepareHeroLevelUp(player, () => 0.5);
      if (!prepared.ok) throw new Error(prepared.message);
      const result = commitHeroLevelUp(player, { trackId: classId, expectedTotalLevel: player.level }, context);
      if (!result.ok) throw new Error(result.message);
    }
  }
  return createCurrentSaveData(player, bosses, createCodex(), player.appearanceId, 500);
}
