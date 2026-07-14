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
  RECRUIT_GUARDIAN_QUEST_ID,
  RECRUIT_MYSTIC_QUEST_ID,
  RECRUIT_SCOUT_QUEST_ID,
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
import {
  synchronizeCompanionRecruitment,
} from "../src/systems/party";

const RECRUITMENT_CASES = [
  {
    questId: RECRUIT_GUARDIAN_QUEST_ID,
    npcId: "guardian",
    bossId: "troll",
    meetObjectiveId: "meetBram",
    oathObjectiveId: "sealGuardianOath",
    actionId: "companion.recruit.guardian",
  },
  {
    questId: RECRUIT_SCOUT_QUEST_ID,
    npcId: "scout",
    bossId: "canyonDrake",
    meetObjectiveId: "meetKaia",
    oathObjectiveId: "sealScoutOath",
    actionId: "companion.recruit.scout",
  },
  {
    questId: RECRUIT_MYSTIC_QUEST_ID,
    npcId: "mystic",
    bossId: "volcanicWyrm",
    meetObjectiveId: "meetSelene",
    oathObjectiveId: "sealMysticOath",
    actionId: "companion.recruit.mystic",
  },
] as const;

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
    expect(log.quests[RECRUIT_GUARDIAN_QUEST_ID].status).toBe("locked");
    expect(log.quests[RECRUIT_SCOUT_QUEST_ID].status).toBe("locked");
    expect(log.quests[RECRUIT_MYSTIC_QUEST_ID].status).toBe("locked");
    expect(log.seenWarnings).toEqual([]);
  });

  it.each(RECRUITMENT_CASES)(
    "runs the $npcId recruitment quest through trial, oath, and replay",
    ({
      questId,
      npcId,
      bossId,
      meetObjectiveId,
      oathObjectiveId,
      actionId,
    }) => {
    const player = createTestPlayer();
    const defeatedBosses = new Set<string>();

    const startInteraction = getNpcQuestInteraction(player, npcId);
    expect(startInteraction).toMatchObject({
      kind: "start",
      questId,
    });
    const started = completeNpcQuestInteraction(
      player,
      defeatedBosses,
      startInteraction!,
    );

    expect(started.changed).toBe(true);
    expect(getQuestProgress(player, questId)).toMatchObject({
      status: "active",
      stage: 1,
      objectives: { [meetObjectiveId]: 1 },
    });
    expect(getNpcQuestInteraction(player, npcId)).toBeNull();

    const waiting = reconcileQuestState(player, defeatedBosses);
    expect(waiting.changed).toBe(false);
    defeatedBosses.add(bossId);

    const passed = reconcileQuestState(player, defeatedBosses);
    expect(passed.changed).toBe(true);
    expect(getQuestProgress(player, questId).stage).toBe(2);

    const oathInteraction = getNpcQuestInteraction(player, npcId);
    expect(oathInteraction).toMatchObject({
      kind: "objective",
      questId,
      objectiveId: oathObjectiveId,
    });
    const completed = completeNpcQuestInteraction(
      player,
      defeatedBosses,
      oathInteraction!,
    );
    expect(completed.changed).toBe(true);
    expect(getQuestProgress(player, questId).status).toBe("completed");
    expect(getQuestCompletionActions(
      player.progression.quests,
      "recruitCompanion",
    )).toContainEqual({
      questId,
      id: actionId,
      type: "recruitCompanion",
      targetId: npcId,
    });

    expect(synchronizeCompanionRecruitment(player)).toHaveLength(1);
    expect(synchronizeCompanionRecruitment(player)).toHaveLength(0);
    expect(player.party.companions.map((companion) => companion.id)).toEqual(
      [npcId],
    );
  });

  it.each(RECRUITMENT_CASES)(
    "debug completion recruits $npcId exactly once through replay",
    ({ questId, npcId }) => {
      const player = createTestPlayer();

      const result = setQuestState(player, questId, "completed");

      expect(result.completed).toBe(true);
      expect(player.party.companions).toEqual([]);
      expect(synchronizeCompanionRecruitment(player)).toHaveLength(1);
      expect(synchronizeCompanionRecruitment(player)).toHaveLength(0);
      expect(player.party.companions.map((companion) => companion.id)).toEqual(
        [npcId],
      );
      expect(player.party.activeCompanionIds).toEqual([npcId]);
    },
  );

  it("keeps Covenant progress unchanged while starting recruitment", () => {
    const player = createTestPlayer();
    setQuestState(player, MAIN_QUEST_ID, 3);

    const interaction = getNpcQuestInteraction(player, "guardian");
    completeNpcQuestInteraction(player, new Set<string>(), interaction!);

    expect(getQuestProgress(player, MAIN_QUEST_ID)).toMatchObject({
      status: "active",
      stage: 3,
    });
    expect(getQuestProgress(player, RECRUIT_GUARDIAN_QUEST_ID).stage).toBe(1);
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
    expect(normalized.quests[RECRUIT_GUARDIAN_QUEST_ID].status).toBe("locked");
  });

  it("migrates flat recruitment progress into the nested quest log", () => {
    const normalized = normalizeQuestLog({
      ashenRoad: {
        status: "active",
        stage: 0,
        rewardGranted: false,
      },
      recruitGuardian: {
        status: "completed",
        stage: 2,
        rewardGranted: true,
      },
      recruitScout: {
        status: "active",
        stage: 1,
        rewardGranted: false,
      },
    });

    expect(
      normalized.quests[RECRUIT_GUARDIAN_QUEST_ID].status,
    ).toBe("completed");
    expect(
      normalized.quests[RECRUIT_SCOUT_QUEST_ID],
    ).toMatchObject({
      status: "active",
      stage: 1,
      objectives: { meetKaia: 1 },
    });
    expect(normalized.quests[RECRUIT_MYSTIC_QUEST_ID].status).toBe("locked");
  });

  it("keeps locked and active statuses across normalization", () => {
    for (const status of ["locked", "active"] as const) {
      const normalized = normalizeQuestLog({
        quests: {
          [MAIN_QUEST_ID]: {
            status,
            stage: 1,
            objectives: { speakElowen: 1 },
            claimedRewards: [],
          },
        },
      });
      expect(normalized.quests[MAIN_QUEST_ID].status).toBe(status);
    }
  });

  it("shows active and completed quests in the journal without revealing locked sidequests", () => {
    const player = createTestPlayer();
    expect(getQuestJournalEntries(player)).toHaveLength(1);

    setQuestState(player, IRON_DISPATCH_QUEST_ID, "active");
    expect(getQuestJournalEntries(player).map((entry) => entry.id)).toEqual([
      MAIN_QUEST_ID,
      IRON_DISPATCH_QUEST_ID,
    ]);
  });
});

describe("quest data integrity", () => {
  it("covers all 12 cities through named, substantive main-quest visits", () => {
    const main = QUESTS[MAIN_QUEST_ID];
    const talkObjectives = main.stages.flatMap((stage) =>
      stage.objectives.filter((objective) => objective.type === "talk")
    );
    const mainNpcIds = new Set(talkObjectives.map((objective) =>
      objective.targetId
    ));
    const cityNpcCounts = new Map<string, number>();
    for (const npcId of mainNpcIds) {
      const cityId = QUEST_NPCS[npcId as keyof typeof QUEST_NPCS].cityId;
      cityNpcCounts.set(cityId, (cityNpcCounts.get(cityId) ?? 0) + 1);
    }

    expect(main.stages).toHaveLength(7);
    expect(new Set(cityNpcCounts.keys())).toEqual(
      new Set(CITIES.map((city) => city.id)),
    );
    expect([...cityNpcCounts.values()]).toEqual(
      expect.arrayContaining(Array.from({ length: 12 }, () => 1)),
    );

    for (const objective of talkObjectives) {
      const npc = QUEST_NPCS[
        objective.targetId as keyof typeof QUEST_NPCS
      ];
      const city = getCity(npc.cityId)!;
      expect(objective.description).toContain(city.name);
      expect(objective.dialogue?.length).toBeGreaterThanOrEqual(2);
      for (const page of objective.dialogue ?? []) {
        expect(page.trim().length).toBeGreaterThanOrEqual(30);
      }
    }
  });

  it("keeps the canonical main stage and objective identities stable", () => {
    const main = QUESTS[MAIN_QUEST_ID];
    const objectives = main.stages.flatMap((stage) => stage.objectives);

    expect(main.stages.map((stage) => stage.id)).toEqual([
      "firstSeal",
      "stoneAndRoot",
      "winterWitness",
      "sunRoad",
      "marshCovenant",
      "ashenWatch",
      "lastForge",
    ]);
    expect(objectives.map((objective) =>
      [objective.id, objective.targetId]
    )).toEqual([
      ["speakElowen", "willowdaleArchivist"],
      ["ironholdOath", "ironholdWarden"],
      ["deeprootOath", "deeprootRootspeaker"],
      ["cryptLich", "cryptLich"],
      ["frostheimOath", "frostheimSeer"],
      ["thornvaleOath", "thornvaleGreenwarden"],
      ["frostWarden", "frostWarden"],
      ["sandportPass", "sandportHarbormaster"],
      ["canyonwatchOath", "canyonwatchMarshal"],
      ["dunerestOath", "dunerestLorekeeper"],
      ["bogtownOath", "bogtownApothecary"],
      ["shadowfenOath", "shadowfenFerryman"],
      ["ashfallOath", "ashfallSmith"],
      ["ridgewatchOath", "ridgewatchSentinel"],
      ["infernoForgemaster", "infernoForgemaster"],
      ["returnToElowen", "willowdaleArchivist"],
    ]);
  });

  it("articulates the third keystone in the final forge chapter", () => {
    const lastForge = QUESTS[MAIN_QUEST_ID].stages.find(
      (stage) => stage.id === "lastForge",
    )!;
    const forgemaster = lastForge.objectives.find(
      (objective) => objective.id === "infernoForgemaster",
    )!;

    expect(lastForge.summary.toLowerCase()).toContain("third keystone");
    expect(forgemaster.description.toLowerCase()).toContain("third keystone");
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

  it("uses unique stable IDs", () => {
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
  });

  it("reserves the three stable recruitment paths and actions", () => {
    expect(QUEST_IDS).toContain("recruitGuardian");
    expect(QUEST_IDS).toContain("recruitScout");
    expect(QUEST_IDS).toContain("recruitMystic");
    expect(QUESTS.recruitGuardian.stages.map((stage) => stage.id)).toEqual([
      "meetGuardian",
      "guardianTrial",
      "guardianOath",
    ]);
    expect(QUESTS.recruitScout.stages.map((stage) => stage.id)).toEqual([
      "meetScout",
      "scoutTrial",
      "scoutOath",
    ]);
    expect(QUESTS.recruitMystic.stages.map((stage) => stage.id)).toEqual([
      "meetMystic",
      "mysticTrial",
      "mysticOath",
    ]);
    expect(
      [
        QUESTS.recruitGuardian,
        QUESTS.recruitScout,
        QUESTS.recruitMystic,
      ].map((quest) => quest.completionActions?.[0]),
    ).toEqual([
      {
        id: "companion.recruit.guardian",
        type: "recruitCompanion",
        targetId: "guardian",
      },
      {
        id: "companion.recruit.scout",
        type: "recruitCompanion",
        targetId: "scout",
      },
      {
        id: "companion.recruit.mystic",
        type: "recruitCompanion",
        targetId: "mystic",
      },
    ]);
  });

  it("places every quest NPC on a unique walkable primary-city tile", () => {
    for (const city of CITIES) {
      const questNpcs = (CITY_NPCS[city.id] ?? []).filter(
        (npc) => npc.questNpcId,
      );
      const positions = new Set<string>();
      for (const npc of questNpcs) {
        expect(isWalkable(city.mapData[npc.y][npc.x])).toBe(true);
        const position = `${npc.x},${npc.y}`;
        expect(positions.has(position)).toBe(false);
        positions.add(position);
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
