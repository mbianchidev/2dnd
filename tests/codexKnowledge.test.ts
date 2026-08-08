import { describe, expect, it } from "vitest";
import {
  CODEX_KNOWLEDGE_CATEGORIES,
  CODEX_KNOWLEDGE_ENTRIES,
  CODEX_READABLES,
  getAdjacentCodexReadable,
} from "../src/data/codexKnowledge";
import { CITIES, DUNGEONS } from "../src/data/map";
import { ITEMS } from "../src/data/items";
import { CUTSCENE_IDS } from "../src/data/cutscenes";
import { QUESTS, QUEST_NPCS } from "../src/data/quests";
import {
  createCodex,
  getCodexKnowledgeList,
  isCodexKnowledgeUnlocked,
  normalizeCodexData,
  replayCodexUnlocks,
  unlockCodexFromFutureSignal,
  unlockCodexFromSignal,
} from "../src/systems/codex";
import { createPlayer } from "../src/systems/player";

function createTestPlayer() {
  return createPlayer("LoreTester", {
    strength: 15,
    dexterity: 14,
    constitution: 13,
    intelligence: 12,
    wisdom: 10,
    charisma: 8,
  });
}

describe("Codex knowledge data", () => {
  it("uses unique stable camelCase IDs and every category", () => {
    const ids = CODEX_KNOWLEDGE_ENTRIES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-z][a-zA-Z0-9]*$/.test(id))).toBe(true);
    expect(new Set(CODEX_KNOWLEDGE_ENTRIES.map((entry) => entry.category)))
      .toEqual(new Set(CODEX_KNOWLEDGE_CATEGORIES));
  });

  it("covers every canonical city, dungeon, item, and quest NPC", () => {
    const locationTargets = new Set(
      CODEX_KNOWLEDGE_ENTRIES.flatMap((entry) =>
        entry.sources
          .filter((source) => source.type === "location")
          .map((source) => source.targetId)
      ),
    );
    expect(locationTargets).toEqual(new Set([
      ...CITIES.map((city) => city.id),
      ...DUNGEONS.map((dungeon) => dungeon.id),
    ]));

    const itemTargets = new Set(
      CODEX_KNOWLEDGE_ENTRIES.flatMap((entry) =>
        entry.sources
          .filter((source) => source.type === "itemAcquired")
          .map((source) => source.itemId)
      ),
    );
    expect(itemTargets).toEqual(new Set(ITEMS.map((item) => item.id)));

    const npcTargets = new Set(
      CODEX_KNOWLEDGE_ENTRIES.flatMap((entry) =>
        entry.sources
          .filter((source) => source.type === "npcDialogue")
          .map((source) => source.npcId)
      ),
    );
    expect(npcTargets).toEqual(new Set(Object.keys(QUEST_NPCS)));
  });

  it("references canonical quest stages and cutscenes", () => {
    const cutsceneIds = new Set<string>(CUTSCENE_IDS);
    for (const entry of CODEX_KNOWLEDGE_ENTRIES) {
      expect(entry.name.trim()).not.toBe("");
      expect(entry.summary.trim()).not.toBe("");
      expect(entry.details.length).toBeGreaterThan(0);
      expect(entry.sources.length).toBeGreaterThan(0);
      for (const source of entry.sources) {
        if (source.type === "cutscene") {
          expect(cutsceneIds.has(source.cutsceneId)).toBe(true);
        }
        if (source.type === "questStage") {
          expect(
            QUESTS[source.questId].stages.some(
              (stage) => stage.id === source.stageId,
            ),
          ).toBe(true);
        }
      }
    }
  });

  it("maps readable interactions to stable city terrain", () => {
    for (const readable of CODEX_READABLES) {
      const city = CITIES.find((candidate) => candidate.id === readable.cityId);
      expect(city).toBeDefined();
      const mapData = readable.cityChunkIndex === 0
        ? city!.mapData
        : city!.chunks![readable.cityChunkIndex - 1]!.mapData;
      expect(mapData[readable.y]?.[readable.x]).toBe(readable.terrain);
      expect(getAdjacentCodexReadable(
        readable.cityId,
        readable.cityChunkIndex,
        readable.x,
        readable.y + 1,
      )?.id).toBe(readable.id);
    }
  });
});

describe("Codex knowledge unlocks", () => {
  it("unlocks each real trigger type idempotently", () => {
    const codex = createCodex();
    const signals = [
      { type: "location", locationKind: "city", targetId: "willowdale_city" },
      { type: "itemAcquired", itemId: "covenantSigil" },
      { type: "npcDialogue", npcId: "willowdaleArchivist" },
      {
        type: "questStage",
        questId: "twelvefoldCovenant",
        stageId: "sunRoad",
      },
      { type: "questCompletion", questId: "ironboundDispatch" },
      { type: "cutscene", cutsceneId: "boss.cryptLich.post" },
      { type: "readable", readableId: "willowdaleFoundingVolume" },
    ] as const;

    for (const signal of signals) {
      expect(unlockCodexFromSignal(codex, signal).unlockedIds.length)
        .toBeGreaterThan(0);
      expect(unlockCodexFromSignal(codex, signal).unlockedIds).toEqual([]);
    }
  });

  it("unlocks reputation milestones without mutating quest state", () => {
    const codex = createCodex();
    const player = createTestPlayer();
    const before = structuredClone(player.progression.quests);

    expect(unlockCodexFromFutureSignal(codex, {
      type: "worldEvent",
      eventId: "futureStorm",
    }).unlockedIds).toEqual([]);
    expect(unlockCodexFromFutureSignal(codex, {
      type: "reputationMilestone",
      factionId: "heartlandsWardens",
      milestoneId: "trusted",
    }).unlockedIds).toEqual(["heartlandsWardens"]);
    expect(unlockCodexFromFutureSignal(codex, {
      type: "reputationMilestone",
      factionId: "heartlandsWardens",
      milestoneId: "trusted",
    }).unlockedIds).toEqual([]);
    expect(player.progression.quests).toEqual(before);
  });

  it("replays durable location, item, cutscene, and quest evidence", () => {
    const codex = createCodex();
    const player = createTestPlayer();
    player.progression.discoveredCities = ["willowdale_city"];
    player.progression.exploredTiles["d:heartlands_dungeon,1,1"] = true;
    player.inventory.push(ITEMS.find((item) => item.id === "covenantSigil")!);
    player.progression.seenCutsceneIds.push("campaign.opening");
    player.progression.quests.quests.ironboundDispatch = {
      status: "completed",
      stage: 1,
      objectives: {},
      claimedRewards: [],
    };

    const result = replayCodexUnlocks(codex, player);

    expect(result.unlockedIds.length).toBeGreaterThan(0);
    expect(isCodexKnowledgeUnlocked(codex, "willowdale")).toBe(true);
    expect(isCodexKnowledgeUnlocked(codex, "heartlandsCrypt")).toBe(true);
    expect(isCodexKnowledgeUnlocked(codex, "covenantSigil")).toBe(true);
    expect(isCodexKnowledgeUnlocked(codex, "twelvefoldCovenant")).toBe(true);
    expect(isCodexKnowledgeUnlocked(codex, "theIronRoute")).toBe(true);
    expect(replayCodexUnlocks(codex, player).unlockedIds).toEqual([]);
  });

  it("normalizes malformed and duplicate IDs without losing monster data", () => {
    const normalized = normalizeCodexData({
      entries: {
        slime: {
          timesDefeated: 3,
          acDiscovered: true,
          itemsDropped: ["potion", "potion", "unknown"],
          discoveredElements: ["fire", "fire", "invalid"],
        },
      },
      unlockedEntryIds: [
        "willowdale",
        "willowdale",
        "unknownEntry",
        12,
      ],
    });

    expect(normalized.unlockedEntryIds).toEqual(["willowdale"]);
    expect(normalized.entries.slime.timesDefeated).toBe(3);
    expect(normalized.entries.slime.acDiscovered).toBe(true);
    expect(normalized.entries.slime.itemsDropped).toEqual(["potion"]);
    expect(normalized.entries.slime.discoveredElements).toEqual(["fire"]);
  });
});

describe("Codex knowledge queries", () => {
  it("filters, searches, sorts, and groups deterministically", () => {
    const codex = createCodex();
    unlockCodexFromSignal(codex, {
      type: "location",
      locationKind: "city",
      targetId: "willowdale_city",
    });

    const locations = getCodexKnowledgeList(codex, {
      category: "location",
      search: "bells",
      sort: "name",
    });
    expect(locations.map((entry) => entry.id)).toEqual(["willowdale"]);

    const grouped = getCodexKnowledgeList(codex, {
      category: "location",
      sort: "category",
      groupDiscovered: true,
    });
    expect(grouped[0]?.id).toBe("willowdale");

    const sourceSorted = getCodexKnowledgeList(codex, {
      category: "history",
      sort: "source",
    });
    expect(sourceSorted.map((entry) => entry.id)).toEqual(
      getCodexKnowledgeList(codex, {
        category: "history",
        sort: "source",
      }).map((entry) => entry.id),
    );
  });
});
