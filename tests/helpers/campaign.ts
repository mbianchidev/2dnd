import { MAIN_QUEST_ID, QUESTS, QUEST_NPCS } from "../../src/data/quests";
import { createPlayer, awardXP, xpForLevel } from "../../src/systems/player";
import { createCodex } from "../../src/systems/codex";
import { createCurrentSaveData } from "../../src/systems/save";
import {
  completeNpcQuestInteraction, getNpcQuestInteraction, recordMonsterDefeats,
} from "../../src/systems/quests";
import { commitHeroLevelUp, prepareHeroLevelUp } from "../../src/systems/classProgression";
import { createHeroProgressionContext } from "../../src/systems/classProgressionContext";
import { buildNewGamePlus } from "../../src/systems/newGamePlus";
import { acquireBoat } from "../../src/systems/nauticalOwnership";
import { getIsland } from "../../src/data/nautical";
import { getNauticalMoveTarget } from "../../src/systems/nauticalNavigation";
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

/** Synthetic voyage starts one real sailing step away; dock entry and reload use production controls. */
export function createIslandVoyage(ng = true): { source: SaveData; voyage: SaveData } {
  const source = createCompletedCampaign();
  source.player.progression.tutorial.completed = true;
  let voyage = structuredClone(source);
  if (ng) {
    const built = buildNewGamePlus(source, "starfall-voyage-fixture", 1000, "1234abcd");
    if (!built.ok) throw new Error(built.message);
    voyage = built.data;
  }
  acquireBoat(voyage.player.progression.nautical, "reedSkiff").boat.condition = 47;
  voyage.player.progression.nautical.sailing = true;
  const dock = getIsland("starfallAtoll").dock;
  if (!dock) throw new Error("Missing canonical secret-island dock");
  Object.assign(voyage.player.position, {
    inCity: false, cityId: "", cityChunkIndex: 0, inDungeon: false, dungeonId: "", dungeonLevel: 0,
    chunkX: dock.chunkX, chunkY: dock.chunkY, x: dock.tileX, y: dock.tileY,
  });
  const approach = getNauticalMoveTarget(voyage.player.position, "north");
  if (!approach) throw new Error("Missing canonical island approach");
  voyage.player.position = approach;
  return { source, voyage };
}
