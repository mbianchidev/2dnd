import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  TITLES,
  getAchievement,
} from "../src/data/achievements";
import { DUNGEONS } from "../src/data/dungeons";
import { MONSTER_FAMILIES } from "../src/data/monsterFamilies";
import { ALL_MONSTERS, getMonster } from "../src/data/monsters";
import { QUESTS } from "../src/data/quests";
import { WORLD_EVENT_DEFINITIONS } from "../src/data/worldEvents";
import { getItem } from "../src/data/items";
import {
  acknowledgeAchievementNotification,
  createAchievementState,
  consumeSocialAchievementHooks,
  equipAchievementTitle,
  executeAchievementDebugCommand,
  getAchievementList,
  getAchievementProgress,
  getAchievementSummary,
  isOneHitDefeat,
  normalizeAchievementState,
  reconcileAchievements,
  recordAchievementEvent,
  suppressCurrentlyMetAchievements,
} from "../src/systems/achievements";
import { createCodex, recordDefeat } from "../src/systems/codex";
import { createPlayer } from "../src/systems/player";
import { recruitCompanion } from "../src/systems/party";
import { createDefaultGambitRule } from "../src/systems/gambits";
import { applySocialMutation } from "../src/systems/reputation";

const BASE_STATS = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

function createContext() {
  return {
    player: createPlayer("Achievement Tester", BASE_STATS),
    defeatedBosses: new Set<string>(),
    codex: createCodex(),
  };
}

describe("achievement definitions", () => {
  it("uses stable unique IDs, valid references, points, sources, and rewards", () => {
    const ids = ACHIEVEMENTS.map((definition) => definition.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(TITLES.map((title) => title.id)).size).toBe(TITLES.length);
    for (const definition of ACHIEVEMENTS) {
      expect(definition.id).toMatch(/^[a-z][a-zA-Z0-9]*$/);
      expect(ACHIEVEMENT_CATEGORIES).toContain(definition.category);
      expect(definition.points).toBeGreaterThan(0);
      expect(definition.source.authoritativeState.length).toBeGreaterThan(0);
      const criteria = definition.criteria;
      if (criteria.type === "questStageCompleted") {
        expect(QUESTS[criteria.questId].stages.some(
          (stage) => stage.id === criteria.stageId,
        )).toBe(true);
      }
      if (criteria.type === "questCompleted") {
        expect(QUESTS[criteria.questId]).toBeDefined();
      }
      if (criteria.type === "bossDefeated") {
        expect(getMonster(criteria.bossId)?.isBoss).toBe(true);
      }
      if (definition.rewardTitleId) {
        expect(TITLES.some(
          (title) =>
            title.id === definition.rewardTitleId
            && title.achievementId === definition.id,
        )).toBe(true);
      }
    }
    expect(
      getAchievement("bestiaryMaster").criteria,
    ).toMatchObject({ threshold: MONSTER_FAMILIES.length });
    expect(
      getAchievement("worldEventMaster").criteria,
    ).toMatchObject({ threshold: WORLD_EVENT_DEFINITIONS.length });
  });
});

describe("achievement progress and reconciliation", () => {
  it("derives natural crafting achievements without debug leakage", () => {
    const context = createContext();
    context.player.progression.crafting.statistics.totalCrafts = 1;
    context.player.progression.crafting.statistics.recipeCraftCounts = {
      fieldPotion: 1,
    };

    expect(
      getAchievementProgress(getAchievement("firstCraft"), context).complete,
    ).toBe(true);
    expect(reconcileAchievements(context).newlyUnlocked).toContain("firstCraft");

    const debugContext = createContext();
    debugContext.player.progression.crafting.recentHistory.push({
      sequence: 1,
      recipeId: "fieldPotion",
      actorId: "hero",
      quantity: 1,
      outputItemId: "potion",
      outputQuantity: 1,
      debug: true,
    });
    expect(
      getAchievementProgress(getAchievement("firstCraft"), debugContext).complete,
    ).toBe(false);
  });

  it("derives quest, boss, dungeon, exploration, Codex, party, and event progress", () => {
    const context = createContext();
    context.player.progression.quests.quests.twelvefoldCovenant.stage = 3;
    context.defeatedBosses.add("cryptLich");
    context.player.progression.discoveredCities.push(
      "willowdale_city",
      "ironhold_city",
      "deeproot_city",
      "frostheim_city",
      "thornvale_city",
      "sandport_city",
    );
    context.player.progression.skillChecks.secret = {
      ability: "wisdom",
      naturalRoll: 15,
      modifier: 3,
      total: 18,
      dc: 12,
      success: true,
    };
    context.player.progression.trapStates.first = "disarmed";
    context.player.progression.worldEvents.repeatCounters.moonlitShrine = 3;
    for (const monster of ALL_MONSTERS.filter(
      (entry) => entry.family === "slime",
    )) {
      recordDefeat(context.codex, monster, false, []);
    }

    expect(getAchievementProgress(
      getAchievement("winterWitnessComplete"),
      context,
    ).complete).toBe(true);
    expect(getAchievementProgress(
      getAchievement("threeDungeonsCleared"),
      context,
    )).toEqual({ current: 1, target: DUNGEONS.length, complete: false });
    expect(getAchievementProgress(
      getAchievement("sixCities"),
      context,
    ).complete).toBe(true);
    expect(getAchievementProgress(
      getAchievement("keenEye"),
      context,
    ).current).toBe(1);
    expect(getAchievementProgress(
      getAchievement("trapbreaker"),
      context,
    ).current).toBe(1);
    expect(getAchievementProgress(
      getAchievement("familyScholar"),
      context,
    ).complete).toBe(true);
    expect(getAchievementProgress(
      getAchievement("roadStories"),
      context,
    ).current).toBe(3);
  });

  it("derives complete dungeon, companion, gambit, inventory, and equipment milestones", () => {
    const context = createContext();
    for (const dungeon of DUNGEONS) {
      if (dungeon.bossId) context.defeatedBosses.add(dungeon.bossId);
    }
    for (const companionId of ["guardian", "scout", "mystic"] as const) {
      recruitCompanion(context.player, companionId);
      const companion = context.player.party.companions.find(
        (entry) => entry.id === companionId,
      )!;
      companion.gambits.push(createDefaultGambitRule(
        `${companionId}-achievement`,
        1,
      ));
    }
    const armor = getItem("leatherArmor")!;
    const shield = getItem("woodenShield")!;
    context.player.inventory.push(armor, shield);
    context.player.equippedArmor = armor;
    context.player.equippedShield = shield;
    for (const monster of ALL_MONSTERS.slice(0, 20)) {
      const item = monster.drops?.[0]
        ? getItem(monster.drops[0].itemId)
        : undefined;
      if (item) context.player.inventory.push({ ...item });
    }

    expect(getAchievementProgress(
      getAchievement("threeDungeonsCleared"),
      context,
    ).complete).toBe(true);
    expect(getAchievementProgress(
      getAchievement("fullFellowship"),
      context,
    ).complete).toBe(true);
    expect(getAchievementProgress(
      getAchievement("gambitMaster"),
      context,
    ).complete).toBe(true);
    expect(getAchievementProgress(
      getAchievement("fullyEquipped"),
      context,
    ).complete).toBe(true);
  });

  it("consumes natural social hooks and ignores debug social mutations", () => {
    const context = createContext();
    const natural = applySocialMutation(context.player, {
      sourceId: "test:social:natural",
      cause: "Kept a difficult promise",
      alignment: { goodEvil: 30 },
      reputation: [{
        kind: "town",
        targetId: "willowdale_city",
        delta: 60,
      }],
    });
    const naturalUnlocks = consumeSocialAchievementHooks(
      context.player,
      natural.achievementHooks,
    );
    expect(naturalUnlocks.newlyUnlocked).toEqual(
      expect.arrayContaining(["goodHeart", "trustedTown"]),
    );

    const debug = applySocialMutation(context.player, {
      sourceId: "debug:social:test",
      cause: "Debug reputation",
      reputation: [{
        kind: "faction",
        targetId: "roadwardens",
        delta: 100,
      }],
    });
    expect(consumeSocialAchievementHooks(
      context.player,
      debug.achievementHooks,
    ).newlyUnlocked).toEqual([]);
    expect(context.player.progression.achievements.earned.some(
      (record) => record.id === "exaltedFaction",
    )).toBe(false);
  });

  it("reconciles state achievements once and queues natural notifications", () => {
    const context = createContext();
    context.player.progression.discoveredCities.push(
      "willowdale_city",
      "ironhold_city",
      "deeproot_city",
      "frostheim_city",
      "thornvale_city",
      "sandport_city",
    );
    const first = reconcileAchievements(context, {
      sourceId: "test:reconcile",
      unlockedAt: 100,
    });
    const second = reconcileAchievements(context, {
      sourceId: "test:reconcile",
      unlockedAt: 200,
    });

    expect(first.newlyUnlocked).toContain("sixCities");
    expect(second.newlyUnlocked).toEqual([]);
    expect(context.player.progression.achievements.pendingNotificationIds)
      .toContain("sixCities");
    expect(acknowledgeAchievementNotification(
      context.player,
      "sixCities",
    )).toBe(true);
    expect(context.player.progression.achievements.pendingNotificationIds)
      .not.toContain("sixCities");
  });

  it("keeps hidden locked achievements secret until completion", () => {
    const context = createContext();
    const hidden = getAchievementList(context).find(
      (entry) => entry.definition.id === "singleStroke",
    );
    expect(hidden?.definition.hidden).toBe(true);
    expect(getAchievementList(context, { search: "Single Stroke" })).toEqual([]);

    recordAchievementEvent(context.player, {
      type: "battleResolved",
      sourceId: "battle:1:test",
      outcome: "victory",
      oneHitDefeats: 1,
      debug: false,
    });
    reconcileAchievements(context, { sourceId: "battle:1:test" });
    expect(getAchievementList(context, { search: "Single Stroke" })).toHaveLength(1);
  });

  it("processes battle events idempotently and tracks defeat history explicitly", () => {
    const context = createContext();
    const event = {
      type: "battleResolved" as const,
      sourceId: "battle:1:slime",
      outcome: "victory" as const,
      oneHitDefeats: 1,
      debug: false,
    };
    expect(recordAchievementEvent(context.player, event)).toBe(true);
    expect(recordAchievementEvent(context.player, event)).toBe(false);
    expect(context.player.progression.achievements.counters).toMatchObject({
      battleWins: 1,
      oneHitDefeats: 1,
      defeatCount: 0,
    });

    recordAchievementEvent(context.player, {
      ...event,
      sourceId: "battle:2:dragon",
      outcome: "defeat",
      oneHitDefeats: 0,
    });
    expect(context.player.progression.achievements.counters.defeatCount).toBe(1);
  });

  it("recognizes only full-health defeats as one-hit defeats", () => {
    expect(isOneHitDefeat(20, 20, 20)).toBe(true);
    expect(isOneHitDefeat(20, 20, 30)).toBe(true);
    expect(isOneHitDefeat(19, 20, 20)).toBe(false);
    expect(isOneHitDefeat(20, 20, 19)).toBe(false);
    expect(isOneHitDefeat(0, 0, 10)).toBe(false);
  });

  it("does not infer a no-defeat campaign from a migrated save", () => {
    const context = createContext();
    context.player.progression.achievements = createAchievementState(false);
    context.player.progression.quests.quests.twelvefoldCovenant.status = "completed";
    reconcileAchievements(context, {
      sourceId: "migration:v12:v13",
      notify: false,
    });
    expect(context.player.progression.achievements.earned.some(
      (record) => record.id === "unbrokenCovenant",
    )).toBe(false);

    context.player.progression.achievements.defeatTrackingComplete = true;
    reconcileAchievements(context, { sourceId: "ending:complete" });
    expect(context.player.progression.achievements.earned.some(
      (record) => record.id === "unbrokenCovenant",
    )).toBe(true);
  });

  it("normalizes unknown IDs, duplicates, counters, rewards, and equipped titles", () => {
    const normalized = normalizeAchievementState({
      earned: [
        {
          id: "twelvefoldCovenantComplete",
          unlockedAt: 12,
          order: 9,
          sourceId: "quest:test",
          debug: false,
        },
        {
          id: "twelvefoldCovenantComplete",
          unlockedAt: 20,
          order: 10,
          sourceId: "duplicate",
        },
        { id: "unknown", unlockedAt: 1 },
      ],
      counters: {
        battleWins: -10,
        oneHitDefeats: 2,
        defeatCount: "bad",
        battleSequence: 3,
      },
      pendingNotificationIds: [
        "twelvefoldCovenantComplete",
        "unknown",
      ],
      unlockedTitleIds: ["covenantRoadwarden", "unbroken", "unknown"],
      equippedTitleId: "unbroken",
      debugSuppressedIds: ["sixCities", "unknown"],
      defeatTrackingComplete: true,
    }, 13);

    expect(normalized.earned).toHaveLength(1);
    expect(normalized.earned[0]?.order).toBe(1);
    expect(normalized.counters).toMatchObject({
      battleWins: 0,
      oneHitDefeats: 2,
      defeatCount: 0,
      battleSequence: 3,
    });
    expect(normalized.pendingNotificationIds).toEqual([
      "twelvefoldCovenantComplete",
    ]);
    expect(normalized.unlockedTitleIds).toEqual(["covenantRoadwarden"]);
    expect(normalized.equippedTitleId).toBe("");
    expect(normalized.debugSuppressedIds).toEqual(["sixCities"]);
  });

  it("unlocks and equips cosmetic titles without changing gameplay authority", () => {
    const context = createContext();
    const questBefore = structuredClone(context.player.progression.quests);
    const statsBefore = structuredClone(context.player.stats);
    context.player.progression.quests.quests.twelvefoldCovenant.status = "completed";
    const result = reconcileAchievements(context, {
      sourceId: "quest:completion",
      notify: false,
    });
    expect(result.titleUnlocks).toContain("covenantRoadwarden");
    expect(equipAchievementTitle(
      context.player,
      "covenantRoadwarden",
    ).changed).toBe(true);
    expect(context.player.stats).toEqual(statsBefore);
    expect(context.player.progression.quests).toEqual({
      ...questBefore,
      quests: {
        ...questBefore.quests,
        twelvefoldCovenant: {
          ...questBefore.quests.twelvefoldCovenant,
          status: "completed",
        },
      },
    });
  });

  it("marks debug unlocks and suppressions outside natural points and rewards", () => {
    const context = createContext();
    context.player.progression.discoveredCities.push(
      "willowdale_city",
      "ironhold_city",
      "deeproot_city",
      "frostheim_city",
      "thornvale_city",
      "sandport_city",
    );
    expect(suppressCurrentlyMetAchievements(context)).toContain("sixCities");
    reconcileAchievements(context, { sourceId: "load" });
    expect(context.player.progression.achievements.earned.some(
      (record) => record.id === "sixCities",
    )).toBe(false);

    const debug = executeAchievementDebugCommand(
      context,
      "unlock twelvefoldCovenantComplete",
    );
    expect(debug.changed).toBe(true);
    expect(getAchievementSummary(context.player).points).toBe(0);
    expect(context.player.progression.achievements.unlockedTitleIds).toEqual([]);
  });
});
