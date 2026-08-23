// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  SAVE_VERSION,
  deleteSave,
  getSaveSummary,
  hasSave,
  loadGame,
  saveGame,
} from "../src/systems/save";
import { createPlayer, type PlayerState } from "../src/systems/player";
import { createCodex, recordDefeat } from "../src/systems/codex";
import { createWeatherState, WeatherType } from "../src/systems/weather";
import {
  IRON_DISPATCH_QUEST_ID,
  MAIN_QUEST_ID,
  QUEST_IDS,
  RECRUIT_GUARDIAN_QUEST_ID,
  RECRUIT_MYSTIC_QUEST_ID,
  RECRUIT_SCOUT_QUEST_ID,
} from "../src/data/quests";
import { LEGACY_TRAP_SEED } from "../src/data/traps";
import {
  applyPartyDefeat,
  recruitCompanion,
  synchronizeCompanionRecruitment,
} from "../src/systems/party";
import { getItem } from "../src/data/items";
import { setQuestState } from "../src/systems/questDebug";
import { CAMPAIGN_EPILOGUE_CUTSCENE_ID } from "../src/data/cutscenes";
import { getCity, getDungeon } from "../src/data/map";
import { Terrain } from "../src/data/mapTypes";
import { getMonster } from "../src/data/monsters";
import { shouldShowCampaignEpilogue } from "../src/systems/cutscenes";
import { TimePeriod } from "../src/systems/daynight";
import { applySocialMutation } from "../src/systems/reputation";
import {
  equipAchievementTitle,
  reconcileAchievements,
  recordAchievementEvent,
} from "../src/systems/achievements";
import {
  createGatheringState,
  movePlayerNearGatheringNode,
  startGathering,
} from "../src/systems/gathering";
import { createCraftingState } from "../src/systems/craftingState";

describe("save system - PlayerState composition migration", () => {
  beforeEach(() => {
    deleteSave();
  });

  afterEach(() => {
    deleteSave();
  });

  it.each([
    ["invalid JSON", "{"],
    ["an incomplete player record", JSON.stringify({
      version: 8,
      player: {},
    })],
  ])("rejects %s without exposing a broken Continue option", (_label, raw) => {
    localStorage.setItem("2dnd_save", raw);

    expect(loadGame()).toBeNull();
    expect(hasSave()).toBe(false);
    expect(getSaveSummary()).toBeNull();
  });

  it("saves PlayerState with nested position and progression", () => {
    const player = createPlayer("TestHero", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });

    // Modify some position fields
    player.position.x = 5;
    player.position.y = 7;
    player.position.chunkX = 2;
    player.position.chunkY = 3;
    player.position.inDungeon = true;
    player.position.dungeonId = "heartlands_dungeon";
    
    // Modify some progression fields
    player.progression.openedChests.push("chest1", "chest2");
    player.progression.collectedTreasures.push("2,3,5,7");
    player.progression.exploredTiles["2,3,5,7"] = true;
    player.progression.quests.quests[MAIN_QUEST_ID].stage = 2;
    player.progression.quests.quests[MAIN_QUEST_ID].objectives = {
      speakElowen: 1,
      ironholdOath: 1,
    };
    player.progression.quests.seenWarnings.push("frostRouteDanger");
    player.progression.skillChecks["shop:city:willowdale_city:0:0"] = {
      ability: "charisma",
      naturalRoll: 15,
      modifier: 1,
      total: 16,
      dc: 12,
      success: true,
      optionId: "persuade",
    };
    player.progression.trapSeed = 424242;
    player.progression.trapStates["heartlands:0:5,5:spikePit"] = "detected";
    player.progression.trapGuidance = true;
    player.progression.tutorial.completed = true;
    player.progression.seenCutsceneIds.push(
      CAMPAIGN_EPILOGUE_CUTSCENE_ID,
    );
    player.progression.pendingCutsceneIds.push("campaign.opening");
    player.progression.worldEvents.seed = 987654;
    player.progression.worldEvents.rollCounter = 12;
    player.progression.worldEvents.triggerCount = 1;
    player.progression.worldEvents.cooldownRemaining = 8;
    player.progression.worldEvents.pending = {
      instanceId: "goblinRoadAmbush:1",
      eventId: "goblinRoadAmbush",
      phase: "battle",
      selectedChoiceId: "fightAmbush",
      location: {
        chunkX: 2,
        chunkY: 3,
        x: 5,
        y: 7,
        areaName: "Western Plains",
        terrain: Terrain.Grass,
      },
      timeStep: 100,
      period: TimePeriod.Day,
      weather: WeatherType.Clear,
    };
    player.progression.gathering = createGatheringState(620014);
    player.progression.gathering.sequence = 4;
    player.progression.gathering.discoveredNodeIds = [
      "g:fishing:overworld:2,3:0:6,7",
    ];
    player.progression.gathering.discoveredResourceIds = ["brookTrout"];
    player.progression.gathering.nodeStates[
      "g:fishing:overworld:2,3:0:6,7"
    ] = {
      attempts: 2,
      cooldownRemaining: 6,
    };
    player.progression.gathering.stats.fishing = {
      attempts: 2,
      successes: 1,
      failures: 1,
      rareFinds: 0,
      bestScore: 85,
    };
    applySocialMutation(player, {
      sourceId: "test:save-roundtrip",
      cause: "Save test",
      alignment: { goodEvil: 30 },
      reputation: [
        { kind: "town", targetId: "willowdale_city", delta: 20 },
        { kind: "faction", targetId: "roadwardens", delta: 50 },
      ],
    });
    
    const bestiary = createCodex();
    const weatherState = createWeatherState();
    
    saveGame(player, new Set(), bestiary, "knight", 100, weatherState);
    
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.position.x).toBe(5);
    expect(loaded!.player.position.y).toBe(7);
    expect(loaded!.player.position.chunkX).toBe(2);
    expect(loaded!.player.position.chunkY).toBe(3);
    expect(loaded!.player.position.inDungeon).toBe(true);
    expect(loaded!.player.position.dungeonId).toBe("heartlands_dungeon");
    expect(loaded!.player.progression.openedChests).toEqual(["chest1", "chest2"]);
    expect(loaded!.player.progression.collectedTreasures).toEqual(["2,3,5,7"]);
    expect(loaded!.player.progression.exploredTiles["2,3,5,7"]).toBe(true);
    expect(
      loaded!.player.progression.quests.quests[MAIN_QUEST_ID].stage,
    ).toBe(2);
    expect(
      loaded!.player.progression.quests.quests[MAIN_QUEST_ID].objectives,
    ).toMatchObject({
      speakElowen: 1,
      ironholdOath: 1,
    });
    expect(loaded!.player.progression.quests.seenWarnings).toEqual([
      "frostRouteDanger",
    ]);
    expect(loaded!.version).toBe(SAVE_VERSION);
    expect(loaded!.player.progression.skillChecks["shop:city:willowdale_city:0:0"]).toEqual({
      ability: "charisma",
      naturalRoll: 15,
      modifier: 1,
      total: 16,
      dc: 12,
      success: true,
      optionId: "persuade",
    });
    expect(loaded!.player.progression.trapSeed).toBe(424242);
    expect(loaded!.player.progression.trapStates).toEqual({
      "heartlands:0:5,5:spikePit": "detected",
    });
    expect(loaded!.player.progression.trapGuidance).toBe(true);
    expect(loaded!.player.progression.tutorial).toEqual({ completed: true });
    expect(loaded!.player.progression.seenCutsceneIds).toEqual([
      CAMPAIGN_EPILOGUE_CUTSCENE_ID,
    ]);
    expect(loaded!.player.progression.pendingCutsceneIds).toEqual([
      "campaign.opening",
    ]);
    expect(loaded!.player.progression.worldEvents).toMatchObject({
      seed: 987654,
      rollCounter: 12,
      triggerCount: 1,
      cooldownRemaining: 8,
      pending: {
        instanceId: "goblinRoadAmbush:1",
        eventId: "goblinRoadAmbush",
        phase: "battle",
        selectedChoiceId: "fightAmbush",
      },
    });
    expect(loaded!.player.progression.gathering).toMatchObject({
      seed: 620014,
      sequence: 4,
      discoveredNodeIds: ["g:fishing:overworld:2,3:0:6,7"],
      discoveredResourceIds: ["brookTrout"],
      nodeStates: {
        "g:fishing:overworld:2,3:0:6,7": {
          attempts: 2,
          cooldownRemaining: 6,
        },
      },
      stats: {
        fishing: {
          attempts: 2,
          successes: 1,
          failures: 1,
          rareFinds: 0,
          bestScore: 85,
        },
      },
    });
    expect(loaded!.player.progression.social).toMatchObject({
      alignment: { lawChaos: -50, goodEvil: 30 },
      townReputation: { willowdale_city: 20 },
      factionReputation: { roadwardens: 50 },
      appliedSourceIds: ["test:save-roundtrip"],
    });
  });

  it("migrates schema-v10 saves to default world event state", () => {
    const player = createPlayer("LegacyEventHero", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });

    const progression = player.progression as unknown as Record<string, unknown>;
    delete progression["worldEvents"];
    localStorage.setItem("2dnd_save", JSON.stringify({
      version: 10,
      player,
      defeatedBosses: [],
      codex: createCodex(),
      appearanceId: "knight",
      timestamp: Date.now(),
      timeStep: 0,
      weatherState: createWeatherState(),
    }));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(SAVE_VERSION);
    expect(loaded!.player.progression.worldEvents).toMatchObject({
      rollCounter: 0,
      triggerCount: 0,
      cooldownRemaining: 0,
      pending: null,
      resolvedOutcomeIds: [],
      claimedRewardIds: [],
      repeatCounters: {},
      log: [],
    });
  });

  it("migrates schema-v13 saves to default schema-v14 gathering state", () => {
    const player = createPlayer("LegacyGatherer", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });

    delete (player.progression as unknown as Record<string, unknown>)["gathering"];
    localStorage.setItem("2dnd_save", JSON.stringify({
      version: 13,
      player,
      defeatedBosses: [],
      codex: createCodex(),
      appearanceId: "knight",
      timestamp: Date.now(),
      timeStep: 0,
      weatherState: createWeatherState(),
    }));

    const loaded = loadGame()!;
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.player.progression.gathering).toMatchObject({
      sequence: 0,
      nodeStates: {},
      discoveredNodeIds: [],
      discoveredResourceIds: [],
      claimedOutcomeIds: [],
      pending: null,
      history: [],
    });
  });

  it("migrates schema-v14 saves to default schema-v15 crafting state", () => {
    const player = createPlayer("LegacyCrafter", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    delete (player.progression as Partial<PlayerState["progression"]>).crafting;
    localStorage.setItem("2dnd_save", JSON.stringify({
      version: 14,
      player,
      defeatedBosses: [],
      codex: createCodex(),
      appearanceId: "knight",
      timestamp: 1,
    }));

    const loaded = loadGame()!;

    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.player.progression.crafting).toEqual(createCraftingState());
    expect(loaded.player.progression.gathering.seed)
      .toBe(player.progression.gathering.seed);
  });

  it("repairs malformed schema-v15 crafting state without disturbing equipment", () => {
    const player = createPlayer("CorruptCrafter", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    const equippedWeaponId = player.equippedWeapon!.id;
    player.progression.crafting = {
      knownRecipeIds: ["fieldPotion", "fieldPotion", "unknown"] as never,
      appliedDiscoveryIds: ["city:ironhold_city", "", "city:ironhold_city"],
      appliedTransactionIds: ["tx:1", "tx:1", ""],
      statistics: {
        totalCrafts: -10,
        equipmentUpgrades: 2,
        recipeCraftCounts: {
          fieldPotion: 3,
          unknown: 7,
        } as never,
      },
      recentHistory: [{
        sequence: 5,
        recipeId: "fieldPotion",
        actorId: "hero",
        quantity: 1,
        outputItemId: "potion",
        outputQuantity: 1,
        debug: false,
      }, {
        sequence: -2,
        recipeId: "unknown",
        actorId: "hero",
        quantity: 0,
        outputItemId: "",
        outputQuantity: 0,
        debug: false,
      } as never],
      nextSequence: -4,
    };
    localStorage.setItem("2dnd_save", JSON.stringify({
      version: 15,
      player,
      defeatedBosses: [],
      codex: createCodex(),
      appearanceId: "knight",
      timestamp: 1,
    }));

    const loaded = loadGame()!;

    expect(loaded.player.progression.crafting.knownRecipeIds).toEqual(
      expect.arrayContaining(["fieldPotion", "antidotePoultice", "trailRations"]),
    );
    expect(loaded.player.progression.crafting.statistics).toMatchObject({
      totalCrafts: 0,
      equipmentUpgrades: 2,
      recipeCraftCounts: { fieldPotion: 3 },
    });
    expect(loaded.player.progression.crafting.appliedTransactionIds).toEqual([
      "tx:1",
    ]);
    expect(loaded.player.progression.crafting.nextSequence).toBe(6);
    expect(loaded.player.equippedWeapon).toBe(
      loaded.player.inventory.find((item) => item.id === equippedWeaponId),
    );
  });

  it("repairs malformed schema-v14 gathering state and clears seed-coupled data", () => {
    const player = createPlayer("CorruptGatherer", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    (player.progression as unknown as Record<string, unknown>)["gathering"] = {
      seed: "bad",
      sequence: -4,
      nodeStates: {
        "g:fishing:overworld:4,2:0:3,4": {
          attempts: 2,
          cooldownRemaining: 5,
        },
      },
      discoveredNodeIds: ["g:fishing:overworld:4,2:0:3,4"],
      discoveredResourceIds: ["brookTrout", "unknown"],
      claimedOutcomeIds: ["claim", "claim"],
      stats: {
        fishing: {
          attempts: 2,
          successes: 1,
          failures: 1,
          rareFinds: 0,
          bestScore: 400,
        },
      },
      pending: {
        instanceId: "bad",
        discipline: "fishing",
      },
      history: [],
    };
    localStorage.setItem("2dnd_save", JSON.stringify({
      version: 14,
      player,
      defeatedBosses: [],
      codex: createCodex(),
      appearanceId: "knight",
      timestamp: Date.now(),
      timeStep: 0,
      weatherState: createWeatherState(),
    }));

    const gathering = loadGame()!.player.progression.gathering;
    expect(gathering.nodeStates).toEqual({});
    expect(gathering.discoveredNodeIds).toEqual([]);
    expect(gathering.discoveredResourceIds).toEqual(["brookTrout"]);
    expect(gathering.pending).toBeNull();
    expect(gathering.stats.fishing.bestScore).toBe(100);
  });

  it("round-trips a pending gathering minigame without rerolling it", () => {
    const player = createPlayer("PendingGatherer", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    const node = movePlayerNearGatheringNode(player, "fishing");
    expect(node).toBeDefined();
    const pending = startGathering(player, node!, {
      timeStep: 0,
      weather: WeatherType.Clear,
      reducedMotion: true,
    });
    saveGame(
      player,
      new Set(),
      createCodex(),
      player.appearanceId,
      0,
      createWeatherState(),
    );

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.progression.gathering.pending).toEqual(pending);
  });

  it("migrates schema-v11 saves to Chaotic Neutral without replaying historical social rewards", () => {
    const player = createPlayer("LegacySocialHero", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    player.progression.quests.quests[IRON_DISPATCH_QUEST_ID] = {
      status: "completed",
      stage: 1,
      objectives: {},
      claimedRewards: ["dispatch.xp"],
    };
    delete (player.progression as unknown as Record<string, unknown>)["social"];
    localStorage.setItem("2dnd_save", JSON.stringify({
      version: 11,
      player,
      defeatedBosses: [],
      codex: createCodex(),
      appearanceId: "knight",
      timestamp: Date.now(),
      timeStep: 0,
      weatherState: createWeatherState(),
    }));

    const loaded = loadGame()!;
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.player.progression.social.alignment).toEqual({
      lawChaos: -50,
      goodEvil: 0,
    });
    expect(loaded.player.progression.social.townReputation).toEqual({});
    expect(loaded.player.progression.social.factionReputation).toEqual({});
    expect(loaded.player.progression.social.history).toEqual([]);
    expect(loaded.player.progression.social.appliedSourceIds).toContain(
      "quest:ironboundDispatch:reward:dispatch.routeStanding",
    );
    expect(
      loaded.player.progression.quests.quests[IRON_DISPATCH_QUEST_ID]
        .claimedRewards,
    ).toEqual(["dispatch.xp"]);
  });

  it("normalizes corrupt schema-v12 social state", () => {
    const player = createPlayer("CorruptSocialHero", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    (player.progression as unknown as Record<string, unknown>)["social"] = {
      alignment: { lawChaos: 999, goodEvil: "bad" },
      townReputation: { willowdale_city: -999, unknown: 20 },
      factionReputation: { roadwardens: 999, unknown: 20 },
      appliedSourceIds: ["kept", "kept", null],
      history: [
        { sourceId: "kept", cause: "Known", summary: "Valid" },
        { sourceId: "unknown", cause: "Dropped", summary: "Invalid" },
      ],
    };
    localStorage.setItem("2dnd_save", JSON.stringify({
      version: 12,
      player,
      defeatedBosses: [],
      codex: createCodex(),
      appearanceId: "knight",
      timestamp: Date.now(),
      timeStep: 0,
      weatherState: createWeatherState(),
    }));

    const loaded = loadGame()!;
    expect(loaded.player.progression.social).toEqual({
      alignment: { lawChaos: 100, goodEvil: 0 },
      townReputation: { willowdale_city: -100 },
      factionReputation: { roadwardens: 100 },
      appliedSourceIds: ["kept"],
      history: [{ sourceId: "kept", cause: "Known", summary: "Valid" }],
    });
  });

  it("round-trips schema-v13 achievement counters, rewards, titles, and notices", () => {
    const player = createPlayer("AchievementSaveHero", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    player.progression.quests.quests[MAIN_QUEST_ID].status = "completed";
    recordAchievementEvent(player, {
      type: "battleResolved",
      sourceId: "battle:1:slime",
      outcome: "victory",
      oneHitDefeats: 1,
      debug: false,
    });
    reconcileAchievements({
      player,
      defeatedBosses: new Set([
        "cryptLich",
        "frostWarden",
        "infernoForgemaster",
      ]),
      codex: createCodex(),
    }, {
      sourceId: "test:save-achievements",
      unlockedAt: 1234,
    });
    equipAchievementTitle(player, "covenantRoadwarden");

    saveGame(
      player,
      new Set(["cryptLich", "frostWarden", "infernoForgemaster"]),
      createCodex(),
      player.appearanceId,
      0,
      createWeatherState(),
    );
    const loaded = loadGame()!;
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.player.progression.achievements.counters).toMatchObject({
      battleWins: 1,
      oneHitDefeats: 1,
      defeatCount: 0,
    });
    expect(loaded.player.progression.achievements.earned.map(
      (record) => record.id,
    )).toContain("twelvefoldCovenantComplete");
    expect(loaded.player.progression.achievements.unlockedTitleIds)
      .toContain("covenantRoadwarden");
    expect(loaded.player.progression.achievements.equippedTitleId)
      .toBe("covenantRoadwarden");
    expect(loaded.player.progression.achievements.pendingNotificationIds)
      .toContain("twelvefoldCovenantComplete");
  });

  it("migrates schema-v12 achievements with silent reconciliation and unknown defeat history", () => {
    const player = createPlayer("LegacyAchievementHero", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    player.progression.discoveredCities.push(
      "willowdale_city",
      "ironhold_city",
      "deeproot_city",
      "frostheim_city",
      "thornvale_city",
      "sandport_city",
    );
    delete (player.progression as unknown as Record<string, unknown>)[
      "achievements"
    ];
    localStorage.setItem("2dnd_save", JSON.stringify({
      version: 12,
      player,
      defeatedBosses: [],
      codex: createCodex(),
      appearanceId: "knight",
      timestamp: 9876,
      timeStep: 0,
      weatherState: createWeatherState(),
    }));

    const loaded = loadGame()!;
    expect(loaded.player.progression.achievements.defeatTrackingComplete)
      .toBe(false);
    expect(loaded.player.progression.achievements.earned).toContainEqual(
      expect.objectContaining({
        id: "sixCities",
        unlockedAt: 9876,
        sourceId: `migration:v12:v${SAVE_VERSION}`,
      }),
    );
    expect(loaded.player.progression.achievements.pendingNotificationIds)
      .toEqual([]);
  });

  it("repairs corrupt schema-v13 achievement IDs, counters, titles, and cross-fields", () => {
    const player = createPlayer("CorruptAchievementHero", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    (player.progression as unknown as Record<string, unknown>)["achievements"] = {
      earned: [
        {
          id: "twelvefoldCovenantComplete",
          unlockedAt: 100,
          order: 8,
          sourceId: "kept",
          debug: false,
        },
        {
          id: "twelvefoldCovenantComplete",
          unlockedAt: 200,
          order: 9,
          sourceId: "duplicate",
        },
        { id: "unknown", unlockedAt: 1, order: 1 },
      ],
      counters: {
        battleWins: -5,
        oneHitDefeats: 2,
        defeatCount: "bad",
        battleSequence: 4,
      },
      processedEventIds: ["event", "event", 7],
      pendingNotificationIds: [
        "twelvefoldCovenantComplete",
        "unknown",
      ],
      unlockedTitleIds: [
        "covenantRoadwarden",
        "unbroken",
        "unknown",
      ],
      equippedTitleId: "unbroken",
      debugSuppressedIds: ["sixCities", "unknown"],
      defeatTrackingComplete: true,
      debugPendingBattle: "bad",
    };
    localStorage.setItem("2dnd_save", JSON.stringify({
      version: 13,
      player,
      defeatedBosses: [],
      codex: createCodex(),
      appearanceId: "knight",
      timestamp: Date.now(),
      timeStep: 0,
      weatherState: createWeatherState(),
    }));

    const loaded = loadGame()!;
    const state = loaded.player.progression.achievements;
    expect(state.earned.map((record) => record.id)).toEqual([
      "twelvefoldCovenantComplete",
      "singleStroke",
    ]);
    expect(state.earned[0]?.order).toBe(1);
    expect(state.counters).toMatchObject({
      battleWins: 0,
      oneHitDefeats: 2,
      defeatCount: 0,
      battleSequence: 4,
    });
    expect(state.processedEventIds).toEqual(["event"]);
    expect(state.pendingNotificationIds).toEqual([
      "twelvefoldCovenantComplete",
    ]);
    expect(state.unlockedTitleIds).toEqual([
      "covenantRoadwarden",
      "oneStroke",
    ]);
    expect(state.equippedTitleId).toBe("");
    expect(state.debugSuppressedIds).toEqual(["sixCities"]);
    expect(state.debugPendingBattle).toBe(false);
  });

  it("repairs corrupt world event state without retaining an invalid pending event", () => {
    const player = createPlayer("CorruptEventHero", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    player.progression.worldEvents = {
      seed: -1,
      rollCounter: -4,
      triggerCount: 2,
      cooldownRemaining: 4000,
      stepsSinceLastEvent: 1,
      pending: {
        instanceId: "unknown:2",
        eventId: "unknown",
        phase: "battle",
        selectedChoiceId: "bad",
        location: {
          chunkX: 99,
          chunkY: 99,
          x: 99,
          y: 99,
          areaName: "",
          terrain: 999,
        },
        timeStep: 0,
        period: "Day",
        weather: "Clear",
      },
      resolvedOutcomeIds: ["valid", "valid"],
      claimedRewardIds: ["claim"],
      repeatCounters: { moonlitShrine: 9 },
      log: [],
    } as unknown as PlayerState["progression"]["worldEvents"];
    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.progression.worldEvents.pending).toBeNull();
    expect(loaded!.player.progression.worldEvents.rollCounter).toBe(0);
    expect(loaded!.player.progression.worldEvents.cooldownRemaining).toBe(1000);
    expect(loaded!.player.progression.worldEvents.resolvedOutcomeIds).toEqual([
      "valid",
    ]);
    expect(loaded!.player.progression.worldEvents.repeatCounters).toEqual({
      moonlitShrine: 1,
    });
  });

  it("round-trips schema-v10 knowledge unlocks", () => {
    const player = createPlayer("LoreHero", {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    });
    const codex = createCodex();
    codex.unlockedEntryIds.push("willowdale", "twelvefoldCovenant");

    saveGame(
      player,
      new Set(),
      codex,
      player.appearanceId,
      0,
      createWeatherState(),
    );

    expect(loadGame()!.codex.unlockedEntryIds).toEqual([
      "willowdale",
      "twelvefoldCovenant",
      player.equippedWeapon!.id,
    ]);
  });

  it("migrates legacy monster-only schema-v9 Codex data without loss", () => {
    const player = createPlayer("LegacyLoreHero", {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    });
    const codex = createCodex();
    recordDefeat(codex, getMonster("slime")!, true, ["potion"]);
    saveGame(
      player,
      new Set(),
      codex,
      player.appearanceId,
      0,
      createWeatherState(),
    );
    const raw = JSON.parse(localStorage.getItem("2dnd_save")!) as {
      version: number;
      codex: { unlockedEntryIds?: unknown };
    };
    raw.version = 9;
    delete raw.codex.unlockedEntryIds;
    localStorage.setItem("2dnd_save", JSON.stringify(raw));

    const loaded = loadGame();

    expect(loaded!.version).toBe(SAVE_VERSION);
    expect(loaded!.codex.entries.slime).toMatchObject({
      timesDefeated: 1,
      acDiscovered: true,
      itemsDropped: ["potion"],
    });
    expect(loaded!.codex.unlockedEntryIds).toContain(
      player.equippedWeapon!.id,
    );
  });

  it("repairs malformed and duplicate schema-v10 knowledge IDs", () => {
    const player = createPlayer("CorruptLoreHero", {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    });
    saveGame(
      player,
      new Set(),
      createCodex(),
      player.appearanceId,
      0,
      createWeatherState(),
    );
    const raw = JSON.parse(localStorage.getItem("2dnd_save")!) as {
      codex: { unlockedEntryIds: unknown[] };
    };
    raw.codex.unlockedEntryIds = [
      "willowdale",
      "willowdale",
      "unknownLore",
      42,
      null,
    ];
    localStorage.setItem("2dnd_save", JSON.stringify(raw));

    const loaded = loadGame();

    expect(loaded!.codex.unlockedEntryIds).toEqual([
      "willowdale",
      player.equippedWeapon!.id,
    ]);
  });

  it("preserves the applied defeat recovery after save and reload", () => {
    const player = createPlayer("RecoveredHero", {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    });
    player.gold = 101;
    player.xp = 50;
    player.hp = 0;
    player.activeEffects.push({
      id: "poison",
      remainingTurns: 2,
      source: "Save test",
    });

    const result = applyPartyDefeat(player, ["party:hero"]);
    saveGame(
      player,
      new Set(),
      createCodex(),
      player.appearanceId,
      72,
      createWeatherState(),
    );
    const loaded = loadGame();

    expect(result.goldLost).toBe(31);
    expect(result.actors[0]?.xpLost).toBe(50);
    expect(loaded).not.toBeNull();
    expect(loaded!.player.gold).toBe(70);
    expect(loaded!.player.xp).toBe(0);
    expect(loaded!.player.hp).toBe(
      Math.max(1, Math.floor(loaded!.player.maxHp / 2)),
    );
    expect(loaded!.player.activeEffects).toEqual([]);
    expect(loaded!.player.position).toMatchObject({
      x: 2,
      y: 2,
      chunkX: 4,
      chunkY: 2,
      inDungeon: false,
      inCity: false,
    });
  });

  it.each([
    {
      label: "overworld",
      configure: (player: ReturnType<typeof createPlayer>) => {
        player.position.x = 3;
        player.position.y = 3;
        player.position.chunkX = 4;
        player.position.chunkY = 2;
      },
    },
    {
      label: "city",
      configure: (player: ReturnType<typeof createPlayer>) => {
        const city = getCity("willowdale_city")!;
        player.position.inCity = true;
        player.position.cityId = city.id;
        player.position.cityChunkIndex = 0;
        player.position.x = city.spawnX;
        player.position.y = city.spawnY;
      },
    },
    {
      label: "dungeon",
      configure: (player: ReturnType<typeof createPlayer>) => {
        const dungeon = getDungeon("heartlands_dungeon")!;
        player.position.inDungeon = true;
        player.position.dungeonId = dungeon.id;
        player.position.dungeonLevel = 0;
        player.position.x = dungeon.spawnX;
        player.position.y = dungeon.spawnY;
      },
    },
  ])("round-trips a valid $label save boundary", ({ configure }) => {
    const player = createPlayer("BoundaryHero", {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    });
    configure(player);
    const expectedPosition = { ...player.position };

    saveGame(
      player,
      new Set(["cryptLich"]),
      createCodex(),
      player.appearanceId,
      197,
      createWeatherState(),
    );
    const loaded = loadGame();

    expect(loaded).not.toBeNull();
    expect(loaded!.player.position).toEqual(expectedPosition);
    expect(loaded!.defeatedBosses).toEqual(["cryptLich"]);
    expect(loaded!.timeStep).toBe(197);
  });

  it("round-trips the state persisted immediately after a battle return", () => {
    const player = createPlayer("BattleReturnHero", {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    });
    player.hp -= 4;
    player.gold += 85;
    player.progression.quests.seenWarnings.push("frostRouteDanger");
    player.activeEffects = [];
    const codex = createCodex();
    codex.entries.slime = {
      monsterId: "slime",
      name: "Slime",
      color: 0x44cc44,
      isBoss: false,
      timesDefeated: 2,
      acDiscovered: true,
      ac: 8,
      hp: 6,
      xpReward: 10,
      goldReward: 5,
      itemsDropped: [],
      discoveredElements: [],
    };

    saveGame(
      player,
      new Set(["cryptLich"]),
      codex,
      player.appearanceId,
      88,
      createWeatherState(),
    );
    const loaded = loadGame();

    expect(loaded).not.toBeNull();
    expect(loaded!.player.hp).toBe(player.hp);
    expect(loaded!.player.gold).toBe(player.gold);
    expect(loaded!.player.activeEffects).toEqual([]);
    expect(loaded!.player.progression.quests.seenWarnings).toContain(
      "frostRouteDanger",
    );
    expect(loaded!.codex.entries.slime?.timesDefeated).toBe(2);
  });

  it("recovers a completed but unseen campaign ending after reload", () => {
    const player = createPlayer("RecoveryHero", {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    });
    const defeatedBosses = new Set([
      "cryptLich",
      "frostWarden",
      "infernoForgemaster",
    ]);
    setQuestState(player, MAIN_QUEST_ID, "completed", defeatedBosses);

    saveGame(
      player,
      defeatedBosses,
      createCodex(),
      player.appearanceId,
      45,
      createWeatherState(),
    );
    const raw = JSON.parse(localStorage.getItem("2dnd_save")!);
    raw.version = 7;
    delete raw.player.progression.pendingCutsceneIds;
    localStorage.setItem("2dnd_save", JSON.stringify(raw));
    const loaded = loadGame();

    expect(loaded).not.toBeNull();
    expect(loaded!.player.progression.seenCutsceneIds).toEqual([]);
    expect(loaded!.player.progression.pendingCutsceneIds).toEqual([
      CAMPAIGN_EPILOGUE_CUTSCENE_ID,
    ]);
    expect(shouldShowCampaignEpilogue(loaded!.player)).toBe(true);
  });

  it("normalizes malformed pending cutscene IDs and removes seen entries", () => {
    const player = createPlayer("PendingHero", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    saveGame(
      player,
      new Set(),
      createCodex(),
      player.appearanceId,
      0,
      createWeatherState(),
    );
    const raw = JSON.parse(localStorage.getItem("2dnd_save")!);
    raw.player.progression.seenCutsceneIds = ["campaign.opening"];
    raw.player.progression.pendingCutsceneIds = [
      "campaign.opening",
      CAMPAIGN_EPILOGUE_CUTSCENE_ID,
      "unknown.cutscene",
      CAMPAIGN_EPILOGUE_CUTSCENE_ID,
      42,
    ];
    localStorage.setItem("2dnd_save", JSON.stringify(raw));

    const loaded = loadGame();

    expect(loaded).not.toBeNull();
    expect(loaded!.player.progression.pendingCutsceneIds).toEqual([
      CAMPAIGN_EPILOGUE_CUTSCENE_ID,
    ]);
  });

  it("migrates schema-v8 saves with missing tutorial progress", () => {
    const player = createPlayer("TutorialMigrationHero", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    saveGame(
      player,
      new Set(),
      createCodex(),
      player.appearanceId,
      0,
      createWeatherState(),
    );
    const raw = JSON.parse(localStorage.getItem("2dnd_save")!);
    raw.version = 8;
    delete raw.player.progression.tutorial;
    localStorage.setItem("2dnd_save", JSON.stringify(raw));

    const loaded = loadGame();

    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(SAVE_VERSION);
    expect(loaded!.player.progression.tutorial).toEqual({ completed: true });
  });

  it("treats missing schema-v9 tutorial progress as malformed current data", () => {
    const player = createPlayer("SchemaNineHero", {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    });
    saveGame(
      player,
      new Set(),
      createCodex(),
      player.appearanceId,
      0,
      createWeatherState(),
    );
    const raw = JSON.parse(localStorage.getItem("2dnd_save")!) as {
      version: number;
      player: { progression: { tutorial?: unknown } };
    };
    raw.version = 9;
    delete raw.player.progression.tutorial;
    localStorage.setItem("2dnd_save", JSON.stringify(raw));

    expect(loadGame()!.player.progression.tutorial).toEqual({
      completed: false,
    });
  });

  it("normalizes malformed and unknown seen cutscene IDs", () => {
    const player = createPlayer("CutsceneHero", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    saveGame(
      player,
      new Set(),
      createCodex(),
      player.appearanceId,
      0,
      createWeatherState(),
    );
    const raw = JSON.parse(localStorage.getItem("2dnd_save")!);
    raw.player.progression.seenCutsceneIds = [
      CAMPAIGN_EPILOGUE_CUTSCENE_ID,
      "unknown.cutscene",
      CAMPAIGN_EPILOGUE_CUTSCENE_ID,
      42,
    ];
    localStorage.setItem("2dnd_save", JSON.stringify(raw));

    const loaded = loadGame();

    expect(loaded).not.toBeNull();
    expect(loaded!.player.progression.seenCutsceneIds).toEqual([
      CAMPAIGN_EPILOGUE_CUTSCENE_ID,
    ]);
    expect(loaded!.version).toBe(SAVE_VERSION);
  });

  it("migrates old flat structure to new nested structure on load", () => {
    // Simulate an old save format with flat structure
    const oldSaveData = {
      version: 1,
      player: {
        name: "OldHero",
        level: 5,
        xp: 500,
        hp: 50,
        maxHp: 60,
        mp: 20,
        maxMp: 25,
        stats: {
          strength: 12,
          dexterity: 10,
          constitution: 14,
          intelligence: 10,
          wisdom: 10,
          charisma: 8,
        },
        pendingStatPoints: 0,
        gold: 100,
        inventory: [],
        knownSpells: ["shortRest"],
        knownAbilities: [],
        knownTalents: [],
        equippedWeapon: null,
        equippedArmor: null,
        equippedShield: null,
        appearanceId: "knight",
        // Old flat structure
        x: 8,
        y: 9,
        chunkX: 3,
        chunkY: 4,
        inDungeon: true,
        dungeonId: "heartlands_dungeon",
        inCity: false,
        cityId: "",
        openedChests: ["oldChest1", "oldChest2"],
        collectedTreasures: ["3,4,8,9"],
        exploredTiles: { "3,4,8,9": true },
        lastTownX: 2,
        lastTownY: 2,
        lastTownChunkX: 4,
        lastTownChunkY: 2,
        bankBalance: 0,
        lastBankDay: 0,
        mountId: "",
        shortRestsRemaining: 2,
        pendingLevelUps: 0,
      },
      defeatedBosses: [],
      bestiary: createCodex(),
      appearanceId: "knight",
      timestamp: Date.now(),
      timeStep: 50,
      weatherState: createWeatherState(),
    };
    
    // Save the old format directly to localStorage
    localStorage.setItem("2dnd_save", JSON.stringify(oldSaveData));
    
    // Load should migrate to new format
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.progression.seenCutsceneIds).toEqual([]);
    
    // Check that position fields are now nested
    expect(loaded!.player.position).toBeDefined();
    expect(loaded!.player.position.x).toBe(8);
    expect(loaded!.player.position.y).toBe(9);
    expect(loaded!.player.position.chunkX).toBe(3);
    expect(loaded!.player.position.chunkY).toBe(4);
    expect(loaded!.player.position.inDungeon).toBe(true);
    expect(loaded!.player.position.dungeonId).toBe("heartlands_dungeon");
    expect(loaded!.player.position.inCity).toBe(false);
    expect(loaded!.player.position.cityId).toBe("");
    
    // Check that progression fields are now nested
    expect(loaded!.player.progression).toBeDefined();
    expect(loaded!.player.progression.openedChests).toEqual(["oldChest1", "oldChest2"]);
    expect(loaded!.player.progression.collectedTreasures).toEqual(["3,4,8,9"]);
    expect(loaded!.player.progression.exploredTiles["3,4,8,9"]).toBe(true);
    expect(loaded!.player.progression.quests.quests[MAIN_QUEST_ID]).toEqual({
      status: "active",
      stage: 0,
      objectives: {},
      claimedRewards: [],
    });
    expect(loaded!.player.progression.skillChecks).toEqual({});
    expect(loaded!.player.progression.quests.seenWarnings).toEqual([]);
    expect(loaded!.player.progression.trapSeed).toBe(LEGACY_TRAP_SEED);
    expect(loaded!.player.progression.trapStates).toEqual({});
    expect(loaded!.player.progression.trapGuidance).toBe(false);
    
    // Check that old flat fields are removed
    const playerRecord = loaded!.player as unknown as Record<string, unknown>;
    expect(playerRecord["x"]).toBeUndefined();
    expect(playerRecord["y"]).toBeUndefined();
    expect(playerRecord["chunkX"]).toBeUndefined();
    expect(playerRecord["chunkY"]).toBeUndefined();
    expect(playerRecord["inDungeon"]).toBeUndefined();
    expect(playerRecord["dungeonId"]).toBeUndefined();
    expect(playerRecord["inCity"]).toBeUndefined();
    expect(playerRecord["cityId"]).toBeUndefined();
    expect(playerRecord["openedChests"]).toBeUndefined();
    expect(playerRecord["collectedTreasures"]).toBeUndefined();
    expect(playerRecord["exploredTiles"]).toBeUndefined();
  });

  it("handles missing position fields in old saves with defaults", () => {
    const oldSaveData = {
      version: 1,
      player: {
        name: "MinimalHero",
        level: 1,
        xp: 0,
        hp: 30,
        maxHp: 30,
        mp: 10,
        maxMp: 10,
        stats: {
          strength: 10,
          dexterity: 10,
          constitution: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10,
        },
        pendingStatPoints: 0,
        gold: 50,
        inventory: [],
        knownSpells: [],
        knownAbilities: [],
        knownTalents: [],
        equippedWeapon: null,
        equippedArmor: null,
        equippedShield: null,
        appearanceId: "knight",
        // No position or progression fields at all
        lastTownX: 2,
        lastTownY: 2,
        lastTownChunkX: 4,
        lastTownChunkY: 2,
        bankBalance: 0,
        lastBankDay: 0,
        mountId: "",
        shortRestsRemaining: 2,
        pendingLevelUps: 0,
      },
      defeatedBosses: [],
      bestiary: createCodex(),
      appearanceId: "knight",
      timestamp: Date.now(),
    };
    
    localStorage.setItem("2dnd_save", JSON.stringify(oldSaveData));
    
    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    
    // Should use default values
    expect(loaded!.player.position.x).toBe(3);
    expect(loaded!.player.position.y).toBe(3);
    expect(loaded!.player.position.chunkX).toBe(4);
    expect(loaded!.player.position.chunkY).toBe(2);
    expect(loaded!.player.position.inDungeon).toBe(false);
    expect(loaded!.player.position.dungeonId).toBe("");
    expect(loaded!.player.position.inCity).toBe(false);
    expect(loaded!.player.position.cityId).toBe("");
    
    expect(loaded!.player.progression.openedChests).toEqual([]);
    expect(loaded!.player.progression.collectedTreasures).toEqual([]);
    expect(loaded!.player.progression.exploredTiles).toEqual({});
    expect(
      loaded!.player.progression.quests.quests[IRON_DISPATCH_QUEST_ID].status,
    ).toBe("locked");
    expect(loaded!.player.progression.skillChecks).toEqual({});
    expect(loaded!.player.progression.trapSeed).toBe(LEGACY_TRAP_SEED);
    expect(loaded!.player.progression.trapStates).toEqual({});
    expect(loaded!.player.progression.trapGuidance).toBe(false);
  });

  it("clears unknown locations and restores a safe overworld position", () => {
    const player = createPlayer("LostHero", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    player.position = {
      x: 999,
      y: 999,
      chunkX: 999,
      chunkY: 999,
      inDungeon: true,
      dungeonId: "missing_dungeon",
      dungeonLevel: 99,
      inCity: true,
      cityId: "missing_city",
      cityChunkIndex: 99,
    };

    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.position).toEqual({
      x: 3,
      y: 3,
      chunkX: 4,
      chunkY: 2,
      inDungeon: false,
      dungeonId: "",
      dungeonLevel: 0,
      inCity: false,
      cityId: "",
      cityChunkIndex: 0,
    });
  });

  it("clamps dungeon levels and moves blocked positions to the level spawn", () => {
    const player = createPlayer("DeepHero", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    player.position.inDungeon = true;
    player.position.dungeonId = "heartlands_dungeon";
    player.position.dungeonLevel = 99;
    player.position.x = 0;
    player.position.y = 0;

    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.position.dungeonLevel).toBe(1);
    expect(loaded!.player.position.x).toBe(1);
    expect(loaded!.player.position.y).toBe(13);
  });

  it("clamps city chunks and moves blocked positions to the district spawn", () => {
    const player = createPlayer("CityHero", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    player.position.inCity = true;
    player.position.cityId = "willowdale_city";
    player.position.cityChunkIndex = 99;
    player.position.x = 0;
    player.position.y = 0;

    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.position.cityChunkIndex).toBe(1);
    expect(loaded!.player.position.x).toBe(10);
    expect(loaded!.player.position.y).toBe(1);
  });

  it("persists and normalizes active status effects", () => {
    const player = createPlayer("StatusHero", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    player.activeEffects = [
      { id: "poison", remainingTurns: 2, source: "Slime" },
    ];
    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const raw = localStorage.getItem("2dnd_save");
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!) as {
      player: { activeEffects: unknown[] };
    };
    stored.player.activeEffects = [
      ...stored.player.activeEffects,
      { id: "poison", remainingTurns: 5, source: "Spider" },
      { id: "burn", remainingTurns: "invalid" },
      { id: "unknown", remainingTurns: 3 },
    ];
    localStorage.setItem("2dnd_save", JSON.stringify(stored));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.activeEffects).toEqual([
      { id: "poison", remainingTurns: 5, source: "Spider" },
      { id: "burn", remainingTurns: 3, source: "unknown" },
    ]);
  });

  it("normalizes malformed quest state without resetting valid progress", () => {
    const player = createPlayer("QuestSaver", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    player.progression.quests.quests[MAIN_QUEST_ID].stage = 2;
    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const raw = localStorage.getItem("2dnd_save");
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!) as {
      player: {
        progression: {
          quests: Record<string, unknown>;
        };
      };
    };
    stored.player.progression.quests = {
      ashenRoad: {
        status: "active",
        stage: 2,
        rewardGranted: false,
      },
      wardensDispatch: {
        status: "completed",
        stage: "invalid",
        rewardGranted: false,
      },
      unknownQuest: {
        status: "active",
        stage: 1,
      },
    };
    localStorage.setItem("2dnd_save", JSON.stringify(stored));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.progression.quests.quests[MAIN_QUEST_ID]).toEqual({
      status: "active",
      stage: 1,
      objectives: {
        speakElowen: 1,
      },
      claimedRewards: [],
    });
    expect(
      loaded!.player.progression.quests.quests[IRON_DISPATCH_QUEST_ID],
    ).toMatchObject({
      status: "completed",
      stage: 1,
      objectives: {
        deliverToSable: 1,
        reportToBrann: 1,
      },
    });
    expect(
      loaded!.player.progression.quests.quests[IRON_DISPATCH_QUEST_ID]
        .claimedRewards,
    ).toHaveLength(5);
    expect(Object.keys(loaded!.player.progression.quests.quests)).toEqual(
      QUEST_IDS,
    );
  });

  it("adds missing skill-check progression to older saves", () => {
    const player = createPlayer("LegacyChecks", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const raw = localStorage.getItem("2dnd_save");
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!) as {
      version: number;
      player: { progression: Record<string, unknown> };
    };
    stored.version = 2;
    delete stored.player.progression["skillChecks"];
    localStorage.setItem("2dnd_save", JSON.stringify(stored));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(SAVE_VERSION);
    expect(loaded!.player.progression.skillChecks).toEqual({});
    expect(
      loaded!.player.progression.quests.quests[MAIN_QUEST_ID].status,
    ).toBe("active");
  });

  it("adds quest progression to schema-v3 skill-check saves", () => {
    const player = createPlayer("V3SkillHero", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    player.progression.skillChecks["npc:willowdale:rumor"] = {
      ability: "wisdom",
      naturalRoll: 14,
      modifier: 1,
      total: 15,
      dc: 13,
      success: true,
    };
    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const raw = localStorage.getItem("2dnd_save");
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!) as {
      version: number;
      player: { progression: Record<string, unknown> };
    };
    stored.version = 3;
    delete stored.player.progression["quests"];
    delete stored.player.progression["trapSeed"];
    delete stored.player.progression["trapStates"];
    delete stored.player.progression["trapGuidance"];
    localStorage.setItem("2dnd_save", JSON.stringify(stored));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(SAVE_VERSION);
    expect(loaded!.player.progression.quests.quests[MAIN_QUEST_ID]).toEqual({
      status: "active",
      stage: 0,
      objectives: {},
      claimedRewards: [],
    });
    expect(loaded!.player.progression.skillChecks["npc:willowdale:rumor"]).toEqual({
      ability: "wisdom",
      naturalRoll: 14,
      modifier: 1,
      total: 15,
      dc: 13,
      success: true,
    });
    expect(loaded!.player.progression.trapSeed).toBe(LEGACY_TRAP_SEED);
    expect(loaded!.player.progression.trapStates).toEqual({});
    expect(loaded!.player.progression.trapGuidance).toBe(false);
  });
  it("repairs valid skill-check totals and discards malformed records", () => {
    const player = createPlayer("CheckRepair", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const raw = localStorage.getItem("2dnd_save");
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!) as {
      player: { progression: Record<string, unknown> };
    };
    stored.player.progression["skillChecks"] = {
      valid: {
        ability: "wisdom",
        naturalRoll: 15,
        modifier: 2,
        total: -99,
        dc: 14,
        success: false,
        optionId: " search ",
      },
      invalidAbility: {
        ability: "strength",
        naturalRoll: 10,
        modifier: 0,
        total: 10,
        dc: 10,
        success: true,
      },
      invalidRoll: {
        ability: "dexterity",
        naturalRoll: 21,
        modifier: 0,
        total: 21,
        dc: 10,
        success: true,
      },
      invalidModifier: {
        ability: "charisma",
        naturalRoll: 12,
        modifier: "2",
        total: 14,
        dc: 12,
        success: true,
      },
    };
    localStorage.setItem("2dnd_save", JSON.stringify(stored));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.progression.skillChecks).toEqual({
      valid: {
        ability: "wisdom",
        naturalRoll: 15,
        modifier: 2,
        total: 17,
        dc: 14,
        success: true,
        optionId: "search",
      },
    });
    expect(
      loaded!.player.progression.quests.quests[MAIN_QUEST_ID].status,
    ).toBe("active");
  });

  it("adds trap progression to schema-v4 quest saves", () => {
    const player = createPlayer("V4QuestHero", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    player.progression.quests.quests[MAIN_QUEST_ID].stage = 2;
    player.progression.skillChecks["npc:willowdale:rumor"] = {
      ability: "wisdom",
      naturalRoll: 14,
      modifier: 1,
      total: 15,
      dc: 13,
      success: true,
    };
    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const raw = localStorage.getItem("2dnd_save");
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!) as {
      version: number;
      player: { progression: Record<string, unknown> };
    };
    stored.version = 4;
    delete stored.player.progression["trapSeed"];
    delete stored.player.progression["trapStates"];
    delete stored.player.progression["trapGuidance"];
    localStorage.setItem("2dnd_save", JSON.stringify(stored));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(SAVE_VERSION);
    expect(
      loaded!.player.progression.quests.quests[MAIN_QUEST_ID].stage,
    ).toBe(2);
    expect(loaded!.player.progression.skillChecks["npc:willowdale:rumor"])
      .toBeDefined();
    expect(loaded!.player.progression.trapSeed).toBe(LEGACY_TRAP_SEED);
    expect(loaded!.player.progression.trapStates).toEqual({});
    expect(loaded!.player.progression.trapGuidance).toBe(false);
  });

  it("preserves valid trap progression and filters invalid states", () => {
    const player = createPlayer("ValidTrap", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    player.progression.trapSeed = 424242;
    player.progression.trapStates = {
      detectedTrap: "detected",
      triggeredTrap: "triggered",
    };
    player.progression.trapGuidance = true;
    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const raw = localStorage.getItem("2dnd_save");
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!) as {
      player: { progression: Record<string, unknown> };
    };
    stored.player.progression["trapStates"] = {
      detectedTrap: "detected",
      triggeredTrap: "triggered",
      unknownTrap: "unknown",
      numericTrap: 4,
    };
    localStorage.setItem("2dnd_save", JSON.stringify(stored));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.progression.trapSeed).toBe(424242);
    expect(loaded!.player.progression.trapStates).toEqual({
      detectedTrap: "detected",
      triggeredTrap: "triggered",
    });
    expect(loaded!.player.progression.trapGuidance).toBe(true);
  });

  it("clears trap states when a malformed seed is replaced", () => {
    const player = createPlayer("CorruptTrap", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const raw = localStorage.getItem("2dnd_save");
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!) as {
      player: { progression: Record<string, unknown> };
    };
    stored.player.progression["trapSeed"] = -10;
    stored.player.progression["trapStates"] = {
      staleTrap: "disarmed",
    };
    stored.player.progression["trapGuidance"] = "yes";
    localStorage.setItem("2dnd_save", JSON.stringify(stored));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.progression.trapSeed).toBe(LEGACY_TRAP_SEED);
    expect(loaded!.player.progression.trapStates).toEqual({});
    expect(loaded!.player.progression.trapGuidance).toBe(false);
  });

  it("migrates rejected interim trap records and guidance item into v5 fields", () => {
    const player = createPlayer("InterimTrap", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const raw = localStorage.getItem("2dnd_save");
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!) as {
      version: number;
      player: {
        inventory: unknown[];
        progression: Record<string, unknown>;
      };
    };
    stored.version = 3;
    delete stored.player.progression["trapSeed"];
    delete stored.player.progression["trapStates"];
    delete stored.player.progression["trapGuidance"];
    stored.player.progression["skillChecks"] = {
      "trap:layout": {
        ability: "wisdom",
        naturalRoll: 2,
        modifier: 0,
        total: 2,
        dc: 1,
        success: true,
        optionId: "layout:424242",
      },
      "trap:legacyDetected": {
        ability: "intelligence",
        naturalRoll: 20,
        modifier: 3,
        total: 23,
        dc: 13,
        success: true,
        optionId: "detect",
      },
      "trap:legacyTriggered": {
        ability: "dexterity",
        naturalRoll: 1,
        modifier: 2,
        total: 3,
        dc: 12,
        success: false,
        optionId: "triggered:disarm",
      },
      "npc:willowdale:rumor": {
        ability: "wisdom",
        naturalRoll: 14,
        modifier: 1,
        total: 15,
        dc: 13,
        success: true,
      },
    };
    stored.player.inventory.push({
      id: "adventurerTrapNotes",
      name: "Adventurer's Trap Notes",
      description: "Legacy guidance",
      type: "key",
      cost: 0,
      effect: 0,
      trapDetectionBonus: 2,
      trapDisarmBonus: 1,
    });
    localStorage.setItem("2dnd_save", JSON.stringify(stored));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(SAVE_VERSION);
    expect(loaded!.player.progression.trapSeed).toBe(424242);
    expect(loaded!.player.progression.trapStates).toEqual({
      legacyDetected: "detected",
      legacyTriggered: "triggered",
    });
    expect(loaded!.player.progression.trapGuidance).toBe(true);
    expect(
      loaded!.player.inventory.some(
        (item) => item.id === "adventurerTrapNotes",
      ),
    ).toBe(false);
    expect(loaded!.player.progression.skillChecks).toEqual({
      "npc:willowdale:rumor": {
        ability: "wisdom",
        naturalRoll: 14,
        modifier: 1,
        total: 15,
        dc: 13,
        success: true,
      },
    });
  });

  it("round-trips party state and persisted gambits in schema v7", () => {
    const player = createPlayer("PartySave", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    const guardian = recruitCompanion(player, "guardian").companion!;
    guardian.controlMode = "gambit";
    guardian.gambits.push({
      id: "heal-lowest",
      rank: 1,
      enabled: true,
      subject: { kind: "anyPartyMember" },
      condition: {
        kind: "resource",
        resource: "hp",
        scale: "percent",
        comparison: "<",
        value: 50,
      },
      action: { kind: "spell", spellId: "cureWounds" },
      target: { kind: "matchedSubject" },
    });
    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(SAVE_VERSION);
    expect(loaded!.player.party.activeCompanionIds).toEqual(["guardian"]);
    expect(loaded!.player.party.companions[0]!.controlMode).toBe("gambit");
    expect(loaded!.player.party.companions[0]!.gambits).toEqual(
      guardian.gambits,
    );
    expect(
      loaded!.player.party.companions[0]!.equippedWeapon,
    ).toBe(
      loaded!.player.party.companions[0]!.inventory.find(
        (item) => item.id === guardian.equippedWeapon?.id,
      ),
    );
  });

  it("replays completed flat recruitment quests after party normalization", () => {
    const player = createPlayer("RecruitMigration", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const stored = JSON.parse(localStorage.getItem("2dnd_save")!) as {
      version: number;
      player: {
        progression: Record<string, unknown>;
        party?: unknown;
      };
    };
    stored.version = 5;
    stored.player.progression["quests"] = {
      ashenRoad: {
        status: "active",
        stage: 0,
        rewardGranted: false,
      },
      wardensDispatch: {
        status: "locked",
        stage: 0,
        rewardGranted: false,
      },
      recruitGuardian: {
        status: "completed",
        stage: 2,
        rewardGranted: true,
      },
      recruitScout: {
        status: "locked",
        stage: 0,
        rewardGranted: false,
      },
      recruitMystic: {
        status: "locked",
        stage: 0,
        rewardGranted: false,
      },
    };
    delete stored.player.party;
    localStorage.setItem("2dnd_save", JSON.stringify(stored));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(
      loaded!.player.progression.quests.quests[
        RECRUIT_GUARDIAN_QUEST_ID
      ].status,
    ).toBe("completed");
    expect(loaded!.player.party.companions.map((companion) =>
      companion.id
    )).toEqual(["guardian"]);
    expect(loaded!.player.party.activeCompanionIds).toEqual(["guardian"]);
  });

  it("replays all completed recruitment quests once after corrupt party normalization", () => {
    const player = createPlayer("RecruitReplay", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    for (const questId of [
      RECRUIT_GUARDIAN_QUEST_ID,
      RECRUIT_SCOUT_QUEST_ID,
      RECRUIT_MYSTIC_QUEST_ID,
    ] as const) {
      setQuestState(player, questId, "completed");
    }
    const guardian = recruitCompanion(player, "guardian").companion!;
    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );

    const stored = JSON.parse(localStorage.getItem("2dnd_save")!) as {
      player: { party: Record<string, unknown> };
    };
    stored.player.party = {
      companions: [
        guardian,
        guardian,
        { id: "unknownCompanion" },
      ],
      activeCompanionIds: [
        "guardian",
        "guardian",
        "scout",
        "unknownCompanion",
      ],
    };
    localStorage.setItem("2dnd_save", JSON.stringify(stored));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.party.companions.map((companion) =>
      companion.id
    )).toEqual(["guardian", "scout", "mystic"]);
    expect(loaded!.player.party.activeCompanionIds).toEqual([
      "guardian",
      "scout",
      "mystic",
    ]);
    expect(synchronizeCompanionRecruitment(loaded!.player)).toHaveLength(0);

    const reloaded = loadGame();
    expect(reloaded!.player.party.companions.map((companion) =>
      companion.id
    )).toEqual(["guardian", "scout", "mystic"]);
  });

  it("adds an empty party to schema-v5 saves without changing prior domains", () => {
    const player = createPlayer("V5PartyMigration", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    player.progression.quests.quests[MAIN_QUEST_ID].stage = 2;
    player.progression.skillChecks["npc:test"] = {
      ability: "wisdom",
      naturalRoll: 12,
      modifier: 1,
      total: 13,
      dc: 10,
      success: true,
    };
    player.progression.trapSeed = 777;
    player.progression.trapStates.testTrap = "disarmed";
    player.progression.trapGuidance = true;
    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );
    const stored = JSON.parse(localStorage.getItem("2dnd_save")!) as {
      version: number;
      player: Record<string, unknown>;
    };
    stored.version = 5;
    delete stored.player["party"];
    localStorage.setItem("2dnd_save", JSON.stringify(stored));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(SAVE_VERSION);
    expect(loaded!.player.party).toEqual({
      companions: [],
      activeCompanionIds: [],
    });
    expect(
      loaded!.player.progression.quests.quests[MAIN_QUEST_ID].stage,
    ).toBe(2);
    expect(loaded!.player.progression.skillChecks["npc:test"]).toBeDefined();
    expect(loaded!.player.progression.trapSeed).toBe(777);
    expect(loaded!.player.progression.trapStates.testTrap).toBe("disarmed");
    expect(loaded!.player.progression.trapGuidance).toBe(true);
  });

  it("repairs malformed party state and removes unknown nested IDs", () => {
    const player = createPlayer("CorruptParty", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    const guardian = recruitCompanion(player, "guardian").companion!;
    saveGame(
      player,
      new Set(),
      createCodex(),
      "knight",
      0,
      createWeatherState(),
    );
    const stored = JSON.parse(localStorage.getItem("2dnd_save")!) as {
      player: { party: Record<string, unknown> };
    };
    stored.player.party = {
      companions: [
        {
          ...guardian,
          hp: 9999,
          mp: -20,
          controlMode: "invalid",
          inventory: [
            { ...getItem("potion")! },
            { id: "unknownItem" },
          ],
          knownSpells: ["cureWounds", "unknownSpell"],
          knownAbilities: ["layOnHands", "unknownAbility"],
          knownTalents: ["toughness", "unknownTalent"],
          equippedWeapon: { id: "startSword" },
          activeEffects: [
            { id: "poison", remainingTurns: 2, source: "Slime" },
            { id: "unknown", remainingTurns: 99, source: "Bad" },
          ],
          gambits: [
            {
              id: "valid",
              rank: 8,
              enabled: true,
              subject: { kind: "self" },
              condition: { kind: "state", state: "alive" },
              action: { kind: "defend" },
              target: { kind: "self" },
            },
            {
              id: "bad",
              rank: 1,
              enabled: true,
              subject: { kind: "self" },
              condition: { kind: "state", state: "alive" },
              action: { kind: "spell", spellId: "unknownSpell" },
              target: { kind: "self" },
            },
          ],
        },
        guardian,
        { id: "unknownCompanion" },
      ],
      activeCompanionIds: [
        "guardian",
        "guardian",
        "unknownCompanion",
        "scout",
      ],
    };
    localStorage.setItem("2dnd_save", JSON.stringify(stored));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.party.companions).toHaveLength(1);
    const repaired = loaded!.player.party.companions[0]!;
    expect(repaired.hp).toBe(repaired.maxHp);
    expect(repaired.mp).toBe(0);
    expect(repaired.controlMode).toBe("manual");
    expect(repaired.inventory.map((item) => item.id)).toEqual(["potion"]);
    expect(repaired.knownSpells).toEqual(["cureWounds"]);
    expect(repaired.knownAbilities).toEqual(["layOnHands"]);
    expect(repaired.knownTalents).toEqual(["toughness"]);
    expect(repaired.activeEffects).toEqual([
      { id: "poison", remainingTurns: 2, source: "Slime" },
    ]);
    expect(repaired.gambits).toHaveLength(1);
    expect(repaired.gambits[0]!.rank).toBe(1);
    expect(loaded!.player.party.activeCompanionIds).toEqual(["guardian"]);
  });
});
