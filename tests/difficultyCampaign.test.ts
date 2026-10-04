import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMonster } from "../src/data/monsters";
import { createSoloEncounter } from "../src/data/monsterGroups";
import { DUNGEONS } from "../src/data/dungeons";
import {
  MAIN_QUEST_ID, QUESTS, QUEST_NPCS,
  type QuestNpcId,
} from "../src/data/quests";
import { createCodex } from "../src/systems/codex";
import { getAchievement } from "../src/data/achievements";
import {
  beginAchievementDebugMutation,
  endAchievementDebugMutation,
  getAchievementProgress,
  reconcileAchievements,
} from "../src/systems/achievements";
import {
  getCampaignDifficultyEligibility,
  getCampaignDifficultyRules,
  scaleReward,
} from "../src/systems/difficulty";
import { playerAttack } from "../src/systems/combat";
import {
  createBattleResult, createGroupCombatants, createHeroCombatant, resolveBattleRewards,
} from "../src/systems/groupCombat";
import { distributePartyVictory } from "../src/systems/party";
import {
  completeNpcQuestInteraction, getNpcQuestInteraction, getQuestAccessDecision,
  getQuestProgress, isQuestCompleted, reconcileQuestState, recordMonsterDefeats,
} from "../src/systems/quests";
import {
  shouldLaunchCampaignEpilogueAfterQuestUpdate, shouldShowCampaignEpilogue,
} from "../src/systems/cutscenes";
import type { QuestNpcInteraction } from "../src/systems/quests";
import { applySocialMutation, combineShopAdjustments } from "../src/systems/reputation";
import {
  forceWorldEvent, getWorldEventChance, resolveWorldEventChoice,
  type WorldEventContext,
} from "../src/systems/worldEvents";
import { Terrain } from "../src/data/map";
import { TimePeriod } from "../src/systems/daynight";
import { WeatherType } from "../src/systems/weather";
import { DIFFICULTY_MODE_CASES, createDifficultyPlayer } from "./difficultyFixtures";

beforeEach(() => vi.spyOn(Math, "random").mockReturnValue(0.95));
afterEach(() => vi.restoreAllMocks());

describe.each(DIFFICULTY_MODE_CASES)("$name campaign and outcomes", ({ selection }) => {
  it("completes all seven chapters, twelve cities and scaled keystone bosses through real quest APIs", () => {
    const player = createDifficultyPlayer(selection);
    player.gold = player.xp = 0;
    const rules = getCampaignDifficultyRules(player);
    const defeatedBosses = new Set<string>();
    const visitedCities = new Set<string>();
    const bossRewards = { xp: 0, gold: 0 };
    let finalInteraction: QuestNpcInteraction | null = null;
    const quest = QUESTS[MAIN_QUEST_ID];
    for (const stage of quest.stages) {
      for (const objective of stage.objectives) {
        if (objective.type === "talk") {
          const npc = Object.values(QUEST_NPCS).find((entry) => entry.id === objective.targetId)!;
          expect(npc).toBeDefined();
          expect(getQuestAccessDecision(player, { type: "city", id: npc.cityId }).allowed).toBe(true);
          visitedCities.add(npc.cityId);
          for (let attempt = 0; attempt < 5; attempt += 1) {
            if ((getQuestProgress(player, MAIN_QUEST_ID).objectives[objective.id] ?? 0)
                >= (objective.required ?? 1)) break;
            const interaction = getNpcQuestInteraction(player, npc.id);
            expect(interaction).not.toBeNull();
            if (objective.id === "returnToElowen") finalInteraction = interaction;
            const result = completeNpcQuestInteraction(player, defeatedBosses, interaction!);
            expect(result.changed).toBe(true);
          }
          expect(getQuestProgress(player, MAIN_QUEST_ID).objectives[objective.id]).toBe(1);
        } else {
          const monster = getMonster(objective.targetId)!;
          const dungeon = DUNGEONS.find((entry) => entry.bossId === monster.id)!;
          expect(getQuestAccessDecision(player, { type: "dungeon", id: dungeon.id }).allowed).toBe(true);
          const encounter = createSoloEncounter(monster);
          const enemy = createGroupCombatants(encounter, rules)[0]!;
          for (let round = 0; enemy.currentHp > 0 && round < 500; round += 1) {
            const attack = playerAttack(player, enemy.monster);
            expect(attack.hit).toBe(true);
            enemy.currentHp = Math.max(0, enemy.currentHp - attack.damage);
          }
          expect(enemy.currentHp).toBe(0);
          enemy.isAlive = false;
          const rewards = resolveBattleRewards(encounter, undefined, rules);
          bossRewards.xp += rewards.xp;
          bossRewards.gold += rewards.gold;
          distributePartyVictory(player, createBattleResult(
            "victory", [createHeroCombatant(player)], [enemy], rewards,
          ));
          defeatedBosses.add(monster.id);
          recordMonsterDefeats(player, defeatedBosses, [monster.id]);
          if (monster.id === "infernoForgemaster") {
            expect(isQuestCompleted(player.progression.quests, MAIN_QUEST_ID)).toBe(false);
          }
        }
      }
    }
    expect(visitedCities.size).toBe(12);
    expect(defeatedBosses).toEqual(new Set(["cryptLich", "frostWarden", "infernoForgemaster"]));
    expect(isQuestCompleted(player.progression.quests, MAIN_QUEST_ID)).toBe(true);
    expect(shouldShowCampaignEpilogue(player)).toBe(true);
    expect(shouldLaunchCampaignEpilogueAfterQuestUpdate(false, player)).toBe(true);
    const rewards = [
      ...quest.stages.flatMap((stage) => stage.rewards ?? []),
      ...(quest.completionRewards ?? []),
    ].filter((reward) => reward.optionalObjectiveId === undefined);
    const expectedGold = rewards.reduce((sum, reward) =>
      sum + (reward.type === "gold" ? scaleReward(reward.amount, "gold", rules) : 0),
    bossRewards.gold);
    const expectedXp = rewards.reduce((sum, reward) =>
      sum + (reward.type === "xp" ? scaleReward(reward.amount, "xp", rules) : 0),
    bossRewards.xp);
    expect(player.gold).toBe(expectedGold);
    expect(player.xp).toBe(expectedXp);
    const receipt = JSON.stringify({
      gold: player.gold, xp: player.xp, inventory: player.inventory,
      social: player.progression.social,
    });
    expect(finalInteraction).not.toBeNull();
    completeNpcQuestInteraction(player, defeatedBosses, finalInteraction!);
    reconcileQuestState(player, defeatedBosses);
    reconcileQuestState(player, defeatedBosses);
    expect(JSON.stringify({
      gold: player.gold, xp: player.xp, inventory: player.inventory,
      social: player.progression.social,
    })).toBe(receipt);

    const context = { player, defeatedBosses, codex: createCodex() };
    const achievements = reconcileAchievements(context);
    expect(achievements.newlyUnlocked).toContain("twelvefoldCovenantComplete");
    expect(getAchievementProgress(getAchievement("veteranCovenant"), context).complete)
      .toBe(selection.profileId === "veteran" || selection.profileId === "legendary");
    expect(getAchievementProgress(getAchievement("legendaryCovenant"), context).complete)
      .toBe(selection.profileId === "legendary");
    expect(reconcileAchievements(context).newlyUnlocked).toEqual([]);
  });

  it("keeps canonical early hubs accessible and respects every hard gate", () => {
    const player = createDifficultyPlayer(selection);
    expect(getQuestAccessDecision(player, { type: "city", id: "sandport_city" }).allowed).toBe(true);
    expect(getQuestAccessDecision(player, { type: "dungeon", id: "heartlands_dungeon" }).allowed).toBe(true);
    for (const target of [
      { type: "city" as const, id: "canyonwatch_city" },
      { type: "city" as const, id: "ashfall_city" },
      { type: "dungeon" as const, id: "volcano_dungeon" },
    ]) {
      const baseline = createDifficultyPlayer({ profileId: "standard" });
      expect(getQuestAccessDecision(player, target)).toEqual(getQuestAccessDecision(baseline, target));
    }
    expect(player.progression.quests.quests[MAIN_QUEST_ID].stage).toBe(0);
  });

  it("scales a saved event reward once, preserves check assistance and cannot reroll it", () => {
    const player = createDifficultyPlayer(selection);
    player.xp = 0;
    const codex = createCodex();
    const context: WorldEventContext = {
      location: { chunkX: 4, chunkY: 2, x: 4, y: 4, areaName: "Heartlands", terrain: Terrain.Grass },
      level: 3, timeStep: 300, period: TimePeriod.Night, weather: WeatherType.Clear,
      quests: player.progression.quests, defeatedBosses: new Set(), social: player.progression.social,
    };
    forceWorldEvent(player.progression.worldEvents, "moonlitShrine", context);
    const pending = player.progression.worldEvents.pending!;
    const resolved = resolveWorldEventChoice(player, codex, new Set(), "studyRunes", () => 20);
    const rules = getCampaignDifficultyRules(player);
    expect(resolved.resolved).toBe(true);
    expect(player.xp).toBe(scaleReward(90, "xp", rules));
    expect(player.progression.skillChecks[`worldEvent:${pending.instanceId}:studyRunes`]?.modifier)
      .toBe(rules.skillCheckAssistance);
    expect(player.progression.social.alignment.lawChaos).toBe(-52);
    const receipt = JSON.stringify({ xp: player.xp, social: player.progression.social });
    player.progression.worldEvents.pending = pending;
    expect(resolveWorldEventChoice(player, codex, new Set(), "studyRunes", () => {
      throw new Error("A stored fixed check must not reroll");
    }).resolved).toBe(false);
    expect(JSON.stringify({ xp: player.xp, social: player.progression.social })).toBe(receipt);
    expect(getWorldEventChance({ ...context, weather: WeatherType.Storm })).toBeLessThanOrEqual(0.08);
  });

  it("leaves hazard injury nonlethal and social/source caps unchanged", () => {
    const player = createDifficultyPlayer(selection);
    player.hp = 1;
    const context: WorldEventContext = {
      location: { chunkX: 4, chunkY: 2, x: 4, y: 4, areaName: "Heartlands", terrain: Terrain.Grass },
      level: 3, timeStep: 100, period: TimePeriod.Day, weather: WeatherType.Storm,
      quests: player.progression.quests, defeatedBosses: new Set(), social: player.progression.social,
    };
    forceWorldEvent(player.progression.worldEvents, "stormWashedCrossing", context);
    resolveWorldEventChoice(player, createCodex(), new Set(), "crossQuickly", () => 1);
    expect(player.hp).toBe(1);
    const request = {
      sourceId: "mode:meaningfulChoice", cause: "Fictional covenant choice",
      alignment: { lawChaos: 500, goodEvil: -500 },
      reputation: [{ kind: "faction" as const, targetId: "roadwardens", delta: 500 }],
    };
    expect(applySocialMutation(player, request).changed).toBe(true);
    expect(player.progression.social.alignment).toEqual({ lawChaos: 100, goodEvil: -100 });
    expect(applySocialMutation(player, request).changed).toBe(false);
    expect(combineShopAdjustments(0.3, 0.3)).toBe(0.35);
    expect(combineShopAdjustments(-0.3, -0.3)).toBe(-0.25);
  });

  it("excludes debug-assisted preset completion without revoking general or prior achievements", () => {
    const player = createDifficultyPlayer(selection);
    beginAchievementDebugMutation(player);
    endAchievementDebugMutation(player);
    player.progression.quests.quests[MAIN_QUEST_ID].status = "completed";
    const context = { player, defeatedBosses: new Set<string>(), codex: createCodex() };
    const unlocked = reconcileAchievements(context);
    expect(unlocked.newlyUnlocked).toContain("twelvefoldCovenantComplete");
    expect(unlocked.newlyUnlocked).not.toContain("veteranCovenant");
    expect(unlocked.newlyUnlocked).not.toContain("legendaryCovenant");
    expect(getCampaignDifficultyEligibility(player).challengeProfile).toBeNull();
    expect(player.difficulty.changeCount).toBe(0);
  });
});

it("retains every named quest NPC ID used by the difficulty campaign trace", () => {
  const ids: readonly QuestNpcId[] = Object.values(QUEST_NPCS).map((npc) => npc.id);
  expect(new Set(ids).size).toBe(ids.length);
});
