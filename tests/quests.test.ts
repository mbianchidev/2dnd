import { describe, expect, it } from "vitest";
import {
  FROST_SILK_QUEST_ID,
  IRON_DISPATCH_QUEST_ID,
  MAIN_QUEST_ID,
  QUEST_DANGER_RULES,
  QUEST_ENTRANCE_BLOCKS,
  QUEST_IDS,
  QUEST_ITEM_IDS,
  QUEST_NPCS,
  QUESTS,
} from "../src/data/quests";
import {
  CITIES,
  DUNGEONS,
  getCity,
  getDungeon,
  isWalkable,
} from "../src/data/map";
import { CITY_NPCS } from "../src/data/npcs";
import { getItem } from "../src/data/items";
import { getMonster } from "../src/data/monsters";
import { getMount } from "../src/data/mounts";
import { createPlayer, type PlayerState } from "../src/systems/player";
import {
  completeNpcQuestInteraction,
  createQuestLog,
  getNpcQuestInteraction,
  getQuestAccessDecision,
  getQuestCompletionActions,
  getQuestDangerState,
  getQuestJournalEntries,
  getQuestMarkerForNpc,
  getQuestProgress,
  getQuestStageIndex,
  isQuestCompleted,
  markQuestWarningSeen,
  normalizeQuestLog,
  reconcileQuestState,
  recordMonsterDefeats,
  replayQuestCompletionActions,
} from "../src/systems/quests";
import {
  advanceQuest,
  setQuestStageById,
  setQuestState,
} from "../src/systems/questDebug";

function createTestPlayer(): PlayerState {
  return createPlayer("QuestHero", {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10,
  });
}

function interact(
  player: PlayerState,
  defeatedBosses: ReadonlySet<string>,
  npcId: keyof typeof QUEST_NPCS,
): void {
  const interaction = getNpcQuestInteraction(player, npcId);
  expect(interaction).not.toBeNull();
  completeNpcQuestInteraction(player, defeatedBosses, interaction!);
}

describe("Twelvefold Covenant progression", () => {
  it("starts the main quest and keeps both sidequests locked", () => {
    const log = createQuestLog();

    expect(log.quests[MAIN_QUEST_ID]).toEqual({
      status: "active",
      stage: 0,
      objectives: {},
      claimedRewards: [],
    });
    expect(log.quests[IRON_DISPATCH_QUEST_ID].status).toBe("locked");
    expect(log.quests[FROST_SILK_QUEST_ID].status).toBe("locked");
    expect(log.seenWarnings).toEqual([]);
  });

  it("advances through Willowdale and the Heartlands chapter", () => {
    const player = createTestPlayer();
    const defeatedBosses = new Set<string>();

    interact(player, defeatedBosses, "willowdaleArchivist");
    expect(getQuestProgress(player, MAIN_QUEST_ID).stage).toBe(1);
    expect(player.inventory.some((item) =>
      item.id === QUEST_ITEM_IDS.covenantSigil
    )).toBe(true);

    interact(player, defeatedBosses, "ironholdWarden");
    interact(player, defeatedBosses, "deeprootRootspeaker");
    expect(getQuestProgress(player, MAIN_QUEST_ID).stage).toBe(1);
    expect(getQuestAccessDecision(player, {
      type: "dungeon",
      id: "heartlands_dungeon",
    }).allowed).toBe(true);

    defeatedBosses.add("cryptLich");
    reconcileQuestState(player, defeatedBosses);
    expect(getQuestProgress(player, MAIN_QUEST_ID).stage).toBe(2);
  });

  it("reconciles bosses defeated before their chapter activates", () => {
    const player = createTestPlayer();
    const defeatedBosses = new Set(["cryptLich", "frostWarden"]);

    setQuestState(player, MAIN_QUEST_ID, 2, defeatedBosses);
    interact(player, defeatedBosses, "frostheimSeer");
    interact(player, defeatedBosses, "thornvaleGreenwarden");

    expect(getQuestProgress(player, MAIN_QUEST_ID).stage).toBe(3);
  });

  it("completes the final forge with durable, idempotent rewards", () => {
    const player = createTestPlayer();
    const defeatedBosses = new Set([
      "cryptLich",
      "frostWarden",
      "swampHydra",
      "dragon",
      "infernoForgemaster",
    ]);
    setQuestState(player, MAIN_QUEST_ID, 6, defeatedBosses);
    const goldBefore = player.gold;
    const xpBefore = player.xp;

    interact(player, defeatedBosses, "willowdaleArchivist");

    expect(isQuestCompleted(
      player.progression.quests,
      MAIN_QUEST_ID,
    )).toBe(true);
    expect(player.gold).toBe(goldBefore + 1300);
    expect(player.xp).toBe(xpBefore + 2500);
    expect(player.inventory.filter((item) =>
      item.id === "dawnforgedBlade"
    )).toHaveLength(1);
    expect(player.inventory.filter((item) =>
      item.id === QUEST_ITEM_IDS.shadowSteed
    )).toHaveLength(1);

    const inventoryCount = player.inventory.length;
    const goldAfter = player.gold;
    const xpAfter = player.xp;
    reconcileQuestState(player, defeatedBosses);
    reconcileQuestState(player, defeatedBosses);
    expect(player.inventory).toHaveLength(inventoryCount);
    expect(player.gold).toBe(goldAfter);
    expect(player.xp).toBe(xpAfter);
  });

  it("freezes optional bonuses after the final turn-in", () => {
    const player = createTestPlayer();
    const defeatedBosses = new Set(["infernoForgemaster"]);
    setQuestState(player, MAIN_QUEST_ID, 6, defeatedBosses);
    interact(player, defeatedBosses, "willowdaleArchivist");
    const goldAfterCompletion = player.gold;
    const xpAfterCompletion = player.xp;

    defeatedBosses.add("swampHydra");
    defeatedBosses.add("dragon");
    recordMonsterDefeats(player, defeatedBosses, ["swampHydra", "dragon"]);

    expect(player.gold).toBe(goldAfterCompletion);
    expect(player.xp).toBe(xpAfterCompletion);
    expect(getQuestProgress(
      player,
      MAIN_QUEST_ID,
    ).objectives.swampHydra).toBeUndefined();
  });
});

describe("Covenant sidequests", () => {
  it("delivers Ironhold's dispatch without duplicating its quest item", () => {
    const player = createTestPlayer();
    const defeatedBosses = new Set<string>();
    setQuestState(player, MAIN_QUEST_ID, 1, defeatedBosses);

    interact(player, defeatedBosses, "ironholdWarden");
    interact(player, defeatedBosses, "ironholdWarden");
    expect(getQuestProgress(
      player,
      IRON_DISPATCH_QUEST_ID,
    ).status).toBe("active");
    expect(player.inventory.filter((item) =>
      item.id === QUEST_ITEM_IDS.sealedDispatch
    )).toHaveLength(1);

    interact(player, defeatedBosses, "sandportHarbormaster");
    expect(player.inventory.some((item) =>
      item.id === QUEST_ITEM_IDS.sealedDispatch
    )).toBe(false);
    interact(player, defeatedBosses, "ironholdWarden");

    expect(getQuestProgress(
      player,
      IRON_DISPATCH_QUEST_ID,
    ).status).toBe("completed");
    expect(player.inventory.some((item) => item.id === "dungeonKey")).toBe(true);
  });

  it("counts duplicate Frost Spider combatants in one group victory", () => {
    const player = createTestPlayer();
    const defeatedBosses = new Set<string>();
    setQuestState(player, MAIN_QUEST_ID, 2, defeatedBosses);

    interact(player, defeatedBosses, "frostheimSeer");
    interact(player, defeatedBosses, "frostheimSeer");
    const result = recordMonsterDefeats(
      player,
      defeatedBosses,
      ["frostSpider", "frostSpider", "frostSpider"],
    );

    expect(result.changed).toBe(true);
    expect(getQuestProgress(
      player,
      FROST_SILK_QUEST_ID,
    ).objectives.frostSpiders).toBe(3);
    expect(getQuestProgress(player, FROST_SILK_QUEST_ID).stage).toBe(1);
    expect(player.inventory.some((item) =>
      item.id === QUEST_ITEM_IDS.frostSilkBundle
    )).toBe(true);

    interact(player, defeatedBosses, "frostheimSeer");
    expect(getQuestProgress(
      player,
      FROST_SILK_QUEST_ID,
    ).status).toBe("completed");
    expect(player.inventory.some((item) =>
      item.id === QUEST_ITEM_IDS.frostSilkBundle
    )).toBe(false);
  });
});

describe("quest access and danger", () => {
  it("gates Canyonwatch, Ashfall, and the Forge without blocking early hubs", () => {
    const player = createTestPlayer();
    const defeatedBosses = new Set<string>();

    expect(getQuestAccessDecision(player, {
      type: "city",
      id: "sandport_city",
    }).allowed).toBe(true);
    expect(getQuestAccessDecision(player, {
      type: "dungeon",
      id: "heartlands_dungeon",
    }).allowed).toBe(true);

    setQuestState(player, MAIN_QUEST_ID, 3, defeatedBosses);
    expect(getQuestAccessDecision(player, {
      type: "city",
      id: "canyonwatch_city",
    }).allowed).toBe(false);
    interact(player, defeatedBosses, "sandportHarbormaster");
    expect(getQuestAccessDecision(player, {
      type: "city",
      id: "canyonwatch_city",
    }).allowed).toBe(true);

    setQuestState(player, MAIN_QUEST_ID, 4, defeatedBosses);
    expect(getQuestAccessDecision(player, {
      type: "city",
      id: "ashfall_city",
    }).allowed).toBe(false);
    setQuestState(player, MAIN_QUEST_ID, 5, defeatedBosses);
    expect(getQuestAccessDecision(player, {
      type: "city",
      id: "ashfall_city",
    }).allowed).toBe(true);
    expect(getQuestAccessDecision(player, {
      type: "dungeon",
      id: "volcanic_forge",
    }).allowed).toBe(false);
    setQuestState(player, MAIN_QUEST_ID, 6, defeatedBosses);
    expect(getQuestAccessDecision(player, {
      type: "dungeon",
      id: "volcanic_forge",
    }).allowed).toBe(true);
  });

  it("applies and persists soft danger warnings by chapter", () => {
    const player = createTestPlayer();
    const danger = getQuestDangerState(player, {
      type: "city",
      id: "frostheim_city",
    });

    expect(danger).toMatchObject({
      id: "frostRouteDanger",
      encounterRateMultiplier: 1.5,
      effectiveLevelOffset: 4,
      seen: false,
    });
    expect(markQuestWarningSeen(player, danger!.id)).toBe(true);
    expect(getQuestDangerState(player, {
      type: "city",
      id: "frostheim_city",
    })?.seen).toBe(true);

    setQuestState(player, MAIN_QUEST_ID, 2);
    expect(getQuestDangerState(player, {
      type: "city",
      id: "frostheim_city",
    })).toBeNull();
  });
});

describe("quest presentation data and debug helpers", () => {
  it("shows actionable markers and detailed journal objectives", () => {
    const player = createTestPlayer();
    expect(getQuestMarkerForNpc(
      player,
      "willowdaleArchivist",
    )).toBe("active");
    expect(getQuestMarkerForNpc(player, "ironholdWarden")).toBeNull();

    const entries = getQuestJournalEntries(player);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: MAIN_QUEST_ID,
      stageTitle: "The First Seal",
    });
    expect(entries[0].objectives[0]).toMatchObject({
      id: "speakElowen",
      current: 0,
      required: 1,
      complete: false,
    });
  });

  it("resolves stable stages and supports exact debug mutation", () => {
    const player = createTestPlayer();
    expect(getQuestStageIndex(MAIN_QUEST_ID, "ashenWatch")).toBe(5);
    expect(getQuestStageIndex(MAIN_QUEST_ID, "missing")).toBeUndefined();

    expect(setQuestStageById(
      player,
      MAIN_QUEST_ID,
      "sunRoad",
    )?.changed).toBe(true);
    expect(getQuestProgress(player, MAIN_QUEST_ID).stage).toBe(3);
    expect(advanceQuest(player, MAIN_QUEST_ID).changed).toBe(true);
  });

  it("exposes replay-safe completion actions", () => {
    const player = createTestPlayer();
    setQuestState(player, MAIN_QUEST_ID, "completed");

    expect(getQuestCompletionActions(player.progression.quests)).toEqual([
      {
        questId: MAIN_QUEST_ID,
        id: "world.twelvefoldCovenantRestored",
        type: "worldState",
        targetId: "twelvefoldCovenantRestored",
      },
    ]);
    const replayed: string[] = [];
    replayQuestCompletionActions(
      player.progression.quests,
      (action) => replayed.push(action.id),
    );
    replayQuestCompletionActions(
      player.progression.quests,
      (action) => replayed.push(action.id),
    );
    expect(replayed).toEqual([
      "world.twelvefoldCovenantRestored",
      "world.twelvefoldCovenantRestored",
    ]);
  });
});

describe("quest persistence normalization", () => {
  it("normalizes nested v5 counters, rewards, and warnings", () => {
    const normalized = normalizeQuestLog({
      quests: {
        [MAIN_QUEST_ID]: {
          status: "active",
          stage: 999,
          objectives: {
            speakElowen: 9,
            unknownObjective: 5,
          },
          claimedRewards: ["main.covenantSigil", "unknownReward"],
        },
      },
      seenWarnings: ["frostRouteDanger", "unknownWarning"],
    });

    expect(normalized.quests[MAIN_QUEST_ID].stage).toBe(6);
    expect(normalized.quests[MAIN_QUEST_ID].objectives).not.toHaveProperty(
      "unknownObjective",
    );
    expect(normalized.quests[MAIN_QUEST_ID].claimedRewards).toEqual([
      "main.covenantSigil",
    ]);
    expect(normalized.seenWarnings).toEqual(["frostRouteDanger"]);
  });

  it("migrates completed flat v4 quests without new reward windfalls", () => {
    const normalized = normalizeQuestLog({
      ashenRoad: {
        status: "completed",
        stage: 3,
        rewardGranted: true,
      },
      wardensDispatch: {
        status: "completed",
        stage: 1,
        rewardGranted: true,
      },
    });

    expect(normalized.quests[MAIN_QUEST_ID].status).toBe("completed");
    expect(normalized.quests[MAIN_QUEST_ID].claimedRewards).toHaveLength(
      QUESTS[MAIN_QUEST_ID].completionRewards!.length
      + QUESTS[MAIN_QUEST_ID].stages.flatMap(
        (stage) => stage.rewards ?? [],
      ).length,
    );
    expect(normalized.quests[IRON_DISPATCH_QUEST_ID].status).toBe(
      "completed",
    );
    expect(normalized.quests[FROST_SILK_QUEST_ID].status).toBe("locked");
  });
});

describe("quest data integrity", () => {
  it("covers all 12 cities in seven main chapters", () => {
    const main = QUESTS[MAIN_QUEST_ID];
    const mainNpcIds = new Set(
      main.stages.flatMap((stage) =>
        stage.objectives
          .filter((objective) => objective.type === "talk")
          .map((objective) => objective.targetId)
      ),
    );

    expect(main.stages).toHaveLength(7);
    expect(mainNpcIds).toEqual(new Set(Object.keys(QUEST_NPCS)));
  });

  it("references valid NPCs, monsters, rewards, cities, and dungeons", () => {
    const placedQuestNpcs = new Set(
      Object.values(CITY_NPCS)
        .flat()
        .map((npc) => npc.questNpcId)
        .filter((id): id is NonNullable<typeof id> => id !== undefined),
    );

    for (const [npcId, npc] of Object.entries(QUEST_NPCS)) {
      expect(getCity(npc.cityId)).toBeDefined();
      expect(placedQuestNpcs.has(npcId as keyof typeof QUEST_NPCS)).toBe(true);
    }

    for (const questId of QUEST_IDS) {
      const quest = QUESTS[questId];
      const objectives = [
        ...quest.stages.flatMap((stage) => stage.objectives),
        ...(quest.optionalObjectives ?? []),
      ];
      for (const objective of objectives) {
        if (objective.type === "talk") {
          expect(QUEST_NPCS).toHaveProperty(objective.targetId);
        } else {
          expect(getMonster(objective.targetId)).toBeDefined();
        }
      }
      const rewards = [
        ...(quest.startRewards ?? []),
        ...quest.stages.flatMap((stage) => stage.rewards ?? []),
        ...(quest.completionRewards ?? []),
      ];
      for (const reward of rewards) {
        if (reward.type === "item") {
          expect(getItem(reward.itemId)).toBeDefined();
        }
      }
    }

    for (const block of QUEST_ENTRANCE_BLOCKS) {
      const target = block.type === "city"
        ? getCity(block.targetId)
        : getDungeon(block.targetId);
      expect(target).toBeDefined();
      if (block.type === "city") {
        const city = getCity(block.targetId)!;
        expect([city.chunkX, city.chunkY, city.tileX, city.tileY]).toEqual([
          block.chunkX,
          block.chunkY,
          block.tileX,
          block.tileY,
        ]);
      } else {
        const dungeon = getDungeon(block.targetId)!;
        expect([
          dungeon.entranceChunkX,
          dungeon.entranceChunkY,
          dungeon.entranceTileX,
          dungeon.entranceTileY,
        ]).toEqual([
          block.chunkX,
          block.chunkY,
          block.tileX,
          block.tileY,
        ]);
      }
    }
    expect(CITIES).toHaveLength(12);
    expect(DUNGEONS).toHaveLength(3);
    expect(QUEST_DANGER_RULES.length).toBeGreaterThan(0);
  });

  it("uses unique stable IDs and places quest NPCs on walkable tiles", () => {
    const objectiveIds = new Set<string>();
    const rewardIds = new Set<string>();
    const actionIds = new Set<string>();

    for (const questId of QUEST_IDS) {
      const quest = QUESTS[questId];
      expect(quest.id).toBe(questId);
      const stageIds = quest.stages.map((stage) => stage.id);
      expect(new Set(stageIds).size).toBe(stageIds.length);
      for (const stageId of stageIds) {
        expect(stageId).toMatch(/^[a-z][a-zA-Z0-9]*$/);
      }
      for (const objective of [
        ...quest.stages.flatMap((stage) => stage.objectives),
        ...(quest.optionalObjectives ?? []),
      ]) {
        expect(objectiveIds.has(objective.id)).toBe(false);
        objectiveIds.add(objective.id);
      }
      for (const reward of [
        ...(quest.startRewards ?? []),
        ...quest.stages.flatMap((stage) => stage.rewards ?? []),
        ...(quest.completionRewards ?? []),
      ]) {
        expect(rewardIds.has(reward.id)).toBe(false);
        rewardIds.add(reward.id);
      }
      for (const action of quest.completionActions ?? []) {
        expect(actionIds.has(action.id)).toBe(false);
        actionIds.add(action.id);
      }
    }

    for (const city of CITIES) {
      const questNpcs = (CITY_NPCS[city.id] ?? []).filter(
        (npc) => npc.questNpcId,
      );
      for (const npc of questNpcs) {
        expect(isWalkable(city.mapData[npc.y][npc.x])).toBe(true);
      }
    }
  });

  it("links the Shadow Steed quest item to the existing mount", () => {
    const rewardItem = getItem(QUEST_ITEM_IDS.shadowSteed);
    expect(rewardItem).toMatchObject({
      type: "mount",
      mountId: "shadowSteed",
    });
    expect(getMount(rewardItem!.mountId!)).toBeDefined();
  });
});
