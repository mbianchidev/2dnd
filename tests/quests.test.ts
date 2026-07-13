import { describe, expect, it } from "vitest";
import {
  MAIN_QUEST_ID,
  QUEST_ENTRANCE_BLOCKS,
  QUEST_IDS,
  QUESTS,
  SIDE_QUEST_ID,
  type QuestStatus,
} from "../src/data/quests";
import { CITIES, DUNGEONS, getCity, getDungeon, isWalkable } from "../src/data/map";
import { CITY_NPCS } from "../src/data/npcs";
import { getItem } from "../src/data/items";
import { getMonster } from "../src/data/monsters";
import { createPlayer, type PlayerState } from "../src/systems/player";
import {
  advanceQuest,
  createQuestLog,
  getBlockedQuestEntrance,
  getQuestCompletionActions,
  getQuestJournalEntries,
  isQuestCompleted,
  normalizeQuestLog,
  replayQuestCompletionActions,
  resolveQuestNpcInteraction,
  setQuestState,
} from "../src/systems/quests";

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

describe("quest progression", () => {
  it("starts the main quest and keeps the sidequest locked", () => {
    const log = createQuestLog();

    expect(log[MAIN_QUEST_ID]).toEqual({
      status: "active",
      stage: 0,
      rewardGranted: false,
    });
    expect(log[SIDE_QUEST_ID]).toEqual({
      status: "locked",
      stage: 0,
      rewardGranted: false,
    });
  });

  it("advances The Ashen Road through NPC reports and persisted boss defeats", () => {
    const player = createTestPlayer();
    const defeatedBosses = new Set<string>();

    const started = resolveQuestNpcInteraction(player, defeatedBosses, "elderRowan");
    expect(started.changed).toBe(true);
    expect(player.progression.quests[MAIN_QUEST_ID].stage).toBe(1);

    const waitingForCrypt = resolveQuestNpcInteraction(player, defeatedBosses, "elderRowan");
    expect(waitingForCrypt.changed).toBe(false);
    expect(player.progression.quests[MAIN_QUEST_ID].stage).toBe(1);

    defeatedBosses.add("cryptLich");
    const sealRecovered = resolveQuestNpcInteraction(player, defeatedBosses, "elderRowan");
    expect(sealRecovered.changed).toBe(true);
    expect(player.progression.quests[MAIN_QUEST_ID].stage).toBe(2);

    const roadOpened = resolveQuestNpcInteraction(player, defeatedBosses, "wardenIlyra");
    expect(roadOpened.changed).toBe(true);
    expect(player.progression.quests[MAIN_QUEST_ID].stage).toBe(3);

    defeatedBosses.add("infernoForgemaster");
    const goldBeforeReward = player.gold;
    const completed = resolveQuestNpcInteraction(player, defeatedBosses, "magisterSol");
    expect(completed.completed).toBe(true);
    expect(player.progression.quests[MAIN_QUEST_ID].status).toBe("completed");
    expect(isQuestCompleted(player.progression.quests, MAIN_QUEST_ID)).toBe(true);
    expect(player.gold).toBe(goldBeforeReward + QUESTS[MAIN_QUEST_ID].reward.gold);
    expect(player.inventory.filter((item) => item.id === "dawnforgedBlade")).toHaveLength(1);
  });

  it("does not grant completion rewards more than once", () => {
    const player = createTestPlayer();
    const defeatedBosses = new Set(["cryptLich", "infernoForgemaster"]);
    setQuestState(player, MAIN_QUEST_ID, 3);

    resolveQuestNpcInteraction(player, defeatedBosses, "magisterSol");
    const goldAfterFirstReward = player.gold;
    const inventoryAfterFirstReward = player.inventory.length;

    const repeated = resolveQuestNpcInteraction(player, defeatedBosses, "magisterSol");
    expect(repeated.changed).toBe(false);
    expect(player.gold).toBe(goldAfterFirstReward);
    expect(player.inventory).toHaveLength(inventoryAfterFirstReward);

    setQuestState(player, MAIN_QUEST_ID, "active");
    setQuestState(player, MAIN_QUEST_ID, "completed");
    expect(player.gold).toBe(goldAfterFirstReward);
    expect(player.inventory).toHaveLength(inventoryAfterFirstReward);
  });

  it("runs Warden's Dispatch as an optional multi-stage sidequest", () => {
    const player = createTestPlayer();
    const defeatedBosses = new Set<string>();
    setQuestState(player, MAIN_QUEST_ID, 3);

    const accepted = resolveQuestNpcInteraction(player, defeatedBosses, "wardenIlyra");
    expect(accepted.questId).toBe(SIDE_QUEST_ID);
    expect(player.progression.quests[SIDE_QUEST_ID]).toMatchObject({
      status: "active",
      stage: 0,
    });

    const delivered = resolveQuestNpcInteraction(player, defeatedBosses, "elderRowan");
    expect(delivered.questId).toBe(SIDE_QUEST_ID);
    expect(player.progression.quests[SIDE_QUEST_ID].stage).toBe(1);

    const goldBeforeReward = player.gold;
    const completed = resolveQuestNpcInteraction(player, defeatedBosses, "wardenIlyra");
    expect(completed.completed).toBe(true);
    expect(player.progression.quests[SIDE_QUEST_ID].status).toBe("completed");
    expect(player.gold).toBe(goldBeforeReward + QUESTS[SIDE_QUEST_ID].reward.gold);
    expect(player.inventory.filter((item) => item.id === "greaterPotion")).toHaveLength(2);
  });

  it("gates Ashfall and the Volcanic Forge until Warden Ilyra opens the road", () => {
    const player = createTestPlayer();

    expect(getBlockedQuestEntrance(player, {
      type: "city",
      targetId: "ashfall_city",
      chunkX: 6,
      chunkY: 4,
      tileX: 10,
      tileY: 7,
    })?.id).toBe("ashfallRoad");
    expect(getBlockedQuestEntrance(player, {
      type: "dungeon",
      targetId: "volcanic_forge",
      chunkX: 6,
      chunkY: 5,
      tileX: 14,
      tileY: 5,
    })?.id).toBe("volcanicForgeRoad");

    setQuestState(player, MAIN_QUEST_ID, 3);

    expect(getBlockedQuestEntrance(player, {
      type: "city",
      targetId: "ashfall_city",
      chunkX: 6,
      chunkY: 4,
      tileX: 10,
      tileY: 7,
    })).toBeUndefined();
    expect(getBlockedQuestEntrance(player, {
      type: "dungeon",
      targetId: "volcanic_forge",
      chunkX: 6,
      chunkY: 5,
      tileX: 14,
      tileY: 5,
    })).toBeUndefined();
  });

  it("supports deterministic debug advancing and exact state changes", () => {
    const player = createTestPlayer();

    expect(advanceQuest(player, MAIN_QUEST_ID).changed).toBe(true);
    expect(player.progression.quests[MAIN_QUEST_ID].stage).toBe(1);

    expect(setQuestState(player, MAIN_QUEST_ID, 3).changed).toBe(true);
    expect(player.progression.quests[MAIN_QUEST_ID]).toMatchObject({
      status: "active",
      stage: 3,
    });

    expect(setQuestState(player, MAIN_QUEST_ID, "completed").completed).toBe(true);
    const goldAfterCompletion = player.gold;
    expect(setQuestState(player, MAIN_QUEST_ID, "completed").changed).toBe(false);
    expect(player.gold).toBe(goldAfterCompletion);
  });

  it("exposes replay-safe completion actions with stable idempotency keys", () => {
    const player = createTestPlayer();
    expect(getQuestCompletionActions(player.progression.quests)).toEqual([]);

    setQuestState(player, MAIN_QUEST_ID, "completed");
    expect(getQuestCompletionActions(player.progression.quests)).toEqual([
      {
        questId: MAIN_QUEST_ID,
        id: "world.ashenRoadRestored",
        type: "worldState",
        targetId: "ashfallRestored",
      },
    ]);
    expect(getQuestCompletionActions(
      player.progression.quests,
      "recruitCompanion",
    )).toEqual([]);

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
      "world.ashenRoadRestored",
      "world.ashenRoadRestored",
    ]);
  });
});

describe("quest persistence normalization", () => {
  it("uses safe defaults when quest data is missing", () => {
    expect(normalizeQuestLog(undefined)).toEqual(createQuestLog());
  });

  it("preserves valid progress and repairs malformed stages, statuses, and rewards", () => {
    const normalized = normalizeQuestLog({
      [MAIN_QUEST_ID]: {
        status: "active",
        stage: 999,
        rewardGranted: "invalid",
      },
      [SIDE_QUEST_ID]: {
        status: "completed",
        stage: -20,
        rewardGranted: false,
      },
      unknownQuest: {
        status: "active",
        stage: 1,
        rewardGranted: false,
      },
    });

    expect(normalized[MAIN_QUEST_ID]).toEqual({
      status: "active",
      stage: QUESTS[MAIN_QUEST_ID].stages.length - 1,
      rewardGranted: false,
    });
    expect(normalized[SIDE_QUEST_ID]).toEqual({
      status: "completed",
      stage: QUESTS[SIDE_QUEST_ID].stages.length - 1,
      rewardGranted: true,
    });
    expect(Object.keys(normalized)).toEqual(QUEST_IDS);
  });

  it("keeps debug-set locked and active statuses across normalization", () => {
    const statuses: QuestStatus[] = ["locked", "active"];
    for (const status of statuses) {
      const normalized = normalizeQuestLog({
        [MAIN_QUEST_ID]: { status, stage: 1, rewardGranted: true },
      });
      expect(normalized[MAIN_QUEST_ID].status).toBe(status);
      expect(normalized[MAIN_QUEST_ID].rewardGranted).toBe(true);
    }
  });

  it("shows active and completed quests in the journal without revealing locked sidequests", () => {
    const player = createTestPlayer();
    expect(getQuestJournalEntries(player)).toHaveLength(1);

    setQuestState(player, SIDE_QUEST_ID, "active");
    expect(getQuestJournalEntries(player).map((entry) => entry.id)).toEqual(QUEST_IDS);
  });
});

describe("quest data integrity", () => {
  it("references valid NPCs, bosses, rewards, cities, and dungeons", () => {
    const placedQuestNpcs = new Set(
      Object.values(CITY_NPCS)
        .flat()
        .map((npc) => npc.questNpcId)
        .filter((id): id is NonNullable<typeof id> => id !== undefined),
    );

    for (const quest of Object.values(QUESTS)) {
      for (const stage of quest.stages) {
        if (stage.npcId) expect(placedQuestNpcs.has(stage.npcId)).toBe(true);
        if (stage.bossId) expect(getMonster(stage.bossId)).toBeDefined();
      }
      for (const itemId of quest.reward.itemIds) {
        expect(getItem(itemId)).toBeDefined();
      }
    }

    for (const block of QUEST_ENTRANCE_BLOCKS) {
      if (block.type === "city") {
        const city = getCity(block.targetId);
        expect(city).toBeDefined();
        expect(CITIES).toContain(city);
        expect([city!.chunkX, city!.chunkY, city!.tileX, city!.tileY]).toEqual([
          block.chunkX,
          block.chunkY,
          block.tileX,
          block.tileY,
        ]);
      } else {
        const dungeon = getDungeon(block.targetId);
        expect(dungeon).toBeDefined();
        expect(DUNGEONS).toContain(dungeon);
        expect([
          dungeon!.entranceChunkX,
          dungeon!.entranceChunkY,
          dungeon!.entranceTileX,
          dungeon!.entranceTileY,
        ]).toEqual([block.chunkX, block.chunkY, block.tileX, block.tileY]);
      }
    }
  });

  it("uses unique stable completion action IDs", () => {
    const actionIds = Object.values(QUESTS).flatMap((quest) =>
      (quest.completionActions ?? []).map((action) => action.id)
    );
    expect(new Set(actionIds).size).toBe(actionIds.length);

    for (const quest of Object.values(QUESTS)) {
      for (const action of quest.completionActions ?? []) {
        expect(action.id).toMatch(/^[a-z][a-zA-Z0-9.]*$/);
        expect(action.type).toBeTruthy();
        expect(action.targetId).toBeTruthy();
      }
    }
  });

  it("places every quest NPC on a unique walkable primary-city tile", () => {
    for (const city of CITIES) {
      const questNpcs = (CITY_NPCS[city.id] ?? []).filter((npc) => npc.questNpcId);
      const positions = new Set<string>();
      for (const npc of questNpcs) {
        expect(isWalkable(city.mapData[npc.y][npc.x])).toBe(true);
        const key = `${npc.x},${npc.y}`;
        expect(positions.has(key)).toBe(false);
        positions.add(key);
      }
    }
  });
});
