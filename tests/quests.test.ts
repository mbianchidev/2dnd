import { describe, expect, it } from "vitest";
import {
  FROST_SILK_QUEST_ID,
  IRON_DISPATCH_QUEST_ID,
  MAIN_QUEST_ID,
  QUEST_ACCESS_RULES,
  QUEST_DANGER_RULES,
  QUEST_ITEM_IDS,
  QUEST_NPC_IDS,
  QUEST_NPCS,
  QUESTS,
} from "../src/data/quests";
import { getItem } from "../src/data/items";
import { CITIES, DUNGEONS } from "../src/data/map";
import { ALL_MONSTERS } from "../src/data/monsters";
import { getMount } from "../src/data/mounts";
import { createPlayer, type PlayerState } from "../src/systems/player";
import {
  completeNpcQuestInteraction,
  completeQuestForDebug,
  getNpcQuestInteraction,
  getQuestAccessDecision,
  getQuestDangerState,
  getQuestProgress,
  recordMonsterDefeat,
  reconcileQuestState,
  setQuestStageForDebug,
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

function completeNpcInteraction(
  player: PlayerState,
  defeatedBosses: Set<string>,
  npcId: string,
): void {
  const interaction = getNpcQuestInteraction(player, npcId);
  expect(interaction).not.toBeNull();
  completeNpcQuestInteraction(player, defeatedBosses, interaction!);
}

describe("quest progression", () => {
  it("starts the main quest and advances through the Heartlands chapter", () => {
    const player = createTestPlayer();
    const defeatedBosses = new Set<string>();

    expect(getQuestProgress(player, MAIN_QUEST_ID)).toMatchObject({
      status: "active",
      stage: 0,
    });

    completeNpcInteraction(player, defeatedBosses, QUEST_NPC_IDS.willowdale);
    expect(getQuestProgress(player, MAIN_QUEST_ID).stage).toBe(1);
    expect(player.inventory.filter((item) => item.id === QUEST_ITEM_IDS.covenantSigil)).toHaveLength(1);

    expect(getQuestAccessDecision(player, {
      type: "dungeon",
      id: "heartlands_dungeon",
    }).allowed).toBe(false);

    completeNpcInteraction(player, defeatedBosses, QUEST_NPC_IDS.ironhold);
    completeNpcInteraction(player, defeatedBosses, QUEST_NPC_IDS.deeproot);
    expect(getQuestAccessDecision(player, {
      type: "dungeon",
      id: "heartlands_dungeon",
    }).allowed).toBe(true);

    defeatedBosses.add("cryptLich");
    recordMonsterDefeat(player, defeatedBosses, "cryptLich");
    expect(getQuestProgress(player, MAIN_QUEST_ID).stage).toBe(2);
  });

  it("reconciles bosses defeated before their objective activates", () => {
    const player = createTestPlayer();
    const defeatedBosses = new Set(["cryptLich"]);

    completeNpcInteraction(player, defeatedBosses, QUEST_NPC_IDS.willowdale);
    reconcileQuestState(player, defeatedBosses);
    completeNpcInteraction(player, defeatedBosses, QUEST_NPC_IDS.ironhold);
    completeNpcInteraction(player, defeatedBosses, QUEST_NPC_IDS.deeproot);

    expect(getQuestProgress(player, MAIN_QUEST_ID).stage).toBe(2);
  });

  it("does not duplicate durable final rewards", () => {
    const player = createTestPlayer();
    const defeatedBosses = new Set<string>();

    completeQuestForDebug(player, defeatedBosses, MAIN_QUEST_ID);
    completeQuestForDebug(player, defeatedBosses, MAIN_QUEST_ID);

    expect(getQuestProgress(player, MAIN_QUEST_ID).status).toBe("completed");
    expect(player.inventory.filter((item) => item.id === QUEST_ITEM_IDS.shadowSteed)).toHaveLength(1);
  });
});

describe("quest sidequests", () => {
  it("handles the dispatch delivery and return without duplicating items", () => {
    const player = createTestPlayer();
    const defeatedBosses = new Set<string>();

    completeNpcInteraction(player, defeatedBosses, QUEST_NPC_IDS.willowdale);
    completeNpcInteraction(player, defeatedBosses, QUEST_NPC_IDS.ironhold);
    completeNpcInteraction(player, defeatedBosses, QUEST_NPC_IDS.ironhold);

    expect(getQuestProgress(player, IRON_DISPATCH_QUEST_ID).status).toBe("active");
    expect(player.inventory.filter((item) => item.id === QUEST_ITEM_IDS.sealedDispatch)).toHaveLength(1);

    completeNpcInteraction(player, defeatedBosses, QUEST_NPC_IDS.sandport);
    expect(getQuestProgress(player, IRON_DISPATCH_QUEST_ID).stage).toBe(1);
    expect(player.inventory.some((item) => item.id === QUEST_ITEM_IDS.sealedDispatch)).toBe(false);

    completeNpcInteraction(player, defeatedBosses, QUEST_NPC_IDS.ironhold);
    expect(getQuestProgress(player, IRON_DISPATCH_QUEST_ID).status).toBe("completed");
    expect(player.inventory.filter((item) => item.id === "dungeonKey")).toHaveLength(1);
  });

  it("counts Frost Spider victories only after the hunt starts", () => {
    const player = createTestPlayer();
    const defeatedBosses = new Set<string>();

    recordMonsterDefeat(player, defeatedBosses, "frostSpider");
    expect(getQuestProgress(player, FROST_SILK_QUEST_ID).objectives.frostSpiders ?? 0).toBe(0);

    setQuestStageForDebug(player, defeatedBosses, MAIN_QUEST_ID, 2);
    completeNpcInteraction(player, defeatedBosses, QUEST_NPC_IDS.frostheim);
    completeNpcInteraction(player, defeatedBosses, QUEST_NPC_IDS.frostheim);

    recordMonsterDefeat(player, defeatedBosses, "frostSpider");
    recordMonsterDefeat(player, defeatedBosses, "frostSpider");
    recordMonsterDefeat(player, defeatedBosses, "frostSpider");
    recordMonsterDefeat(player, defeatedBosses, "frostSpider");

    expect(getQuestProgress(player, FROST_SILK_QUEST_ID).stage).toBe(1);
    expect(player.inventory.filter((item) => item.id === QUEST_ITEM_IDS.frostSilkBundle)).toHaveLength(1);

    completeNpcInteraction(player, defeatedBosses, QUEST_NPC_IDS.frostheim);
    expect(getQuestProgress(player, FROST_SILK_QUEST_ID).status).toBe("completed");
    expect(player.inventory.some((item) => item.id === QUEST_ITEM_IDS.frostSilkBundle)).toBe(false);
  });
});

describe("quest access and danger", () => {
  it("unlocks Canyonwatch only after the Sandport objective", () => {
    const player = createTestPlayer();
    const defeatedBosses = new Set<string>();

    setQuestStageForDebug(player, defeatedBosses, MAIN_QUEST_ID, 3);
    expect(getQuestAccessDecision(player, {
      type: "city",
      id: "canyonwatch_city",
    }).allowed).toBe(false);

    completeNpcInteraction(player, defeatedBosses, QUEST_NPC_IDS.sandport);
    expect(getQuestAccessDecision(player, {
      type: "city",
      id: "canyonwatch_city",
    }).allowed).toBe(true);
  });

  it("applies and clears soft danger modifiers by main-quest chapter", () => {
    const player = createTestPlayer();
    const defeatedBosses = new Set<string>();

    expect(getQuestDangerState(player, {
      type: "dungeon",
      id: "frost_cavern",
    })).toMatchObject({
      encounterRateMultiplier: 1.5,
      effectiveLevelOffset: 4,
    });

    setQuestStageForDebug(player, defeatedBosses, MAIN_QUEST_ID, 2);
    expect(getQuestDangerState(player, {
      type: "dungeon",
      id: "frost_cavern",
    })).toBeNull();
  });
});

describe("quest data integrity", () => {
  it("covers all 12 cities in the seven-stage main quest", () => {
    const mainQuest = QUESTS.find((quest) => quest.id === MAIN_QUEST_ID);
    expect(mainQuest).toBeDefined();
    expect(mainQuest!.stages).toHaveLength(7);
    expect(new Set(QUEST_NPCS.map((npc) => npc.cityId))).toEqual(
      new Set(CITIES.map((city) => city.id)),
    );
  });

  it("references valid NPCs, monsters, rewards, cities, and dungeons", () => {
    const npcIds = new Set(QUEST_NPCS.map((npc) => npc.id));
    const monsterIds = new Set(ALL_MONSTERS.map((monster) => monster.id));
    const cityIds = new Set(CITIES.map((city) => city.id));
    const dungeonIds = new Set(DUNGEONS.map((dungeon) => dungeon.id));

    for (const quest of QUESTS) {
      if (quest.startNpcId) expect(npcIds.has(quest.startNpcId)).toBe(true);
      const objectives = [
        ...quest.stages.flatMap((stage) => stage.objectives),
        ...(quest.optionalObjectives ?? []),
      ];
      for (const objective of objectives) {
        if (objective.type === "talk") {
          expect(npcIds.has(objective.targetId)).toBe(true);
        } else if (objective.type === "defeat") {
          expect(monsterIds.has(objective.targetId)).toBe(true);
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

    for (const rule of QUEST_ACCESS_RULES) {
      expect(
        rule.type === "city"
          ? cityIds.has(rule.targetId)
          : dungeonIds.has(rule.targetId),
      ).toBe(true);
    }
    for (const rule of QUEST_DANGER_RULES) {
      expect(rule.cityIds.every((cityId) => cityIds.has(cityId))).toBe(true);
      expect(rule.dungeonIds.every((dungeonId) => dungeonIds.has(dungeonId))).toBe(true);
    }
  });

  it("links the unique Shadow Steed reward to the existing mount", () => {
    const rewardItem = getItem(QUEST_ITEM_IDS.shadowSteed);
    expect(rewardItem).toMatchObject({
      type: "mount",
      mountId: "shadowSteed",
      cost: 0,
    });
    expect(getMount(rewardItem!.mountId!)).toBeDefined();
  });
});
