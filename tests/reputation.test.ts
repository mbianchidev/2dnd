import { describe, expect, it } from "vitest";
import {
  REPUTATION_TIERS,
  SOCIAL_HISTORY_LIMIT,
} from "../src/data/reputation";
import { Terrain } from "../src/data/mapTypes";
import { createCodex, isCodexKnowledgeUnlocked } from "../src/systems/codex";
import { buildCampaignEndingSummary } from "../src/systems/cutscenes";
import { createPlayer } from "../src/systems/player";
import {
  applySocialMutation,
  combineShopAdjustments,
  executeSocialDebugCommand,
  getAlignmentName,
  getNpcSocialReaction,
  getReputationTier,
  normalizeSocialState,
} from "../src/systems/reputation";
import { attemptTrapDisarm } from "../src/systems/traps";
import {
  forceWorldEvent,
  isWorldEventEligible,
  resolveWorldEventChoice,
} from "../src/systems/worldEvents";
import { getWorldEventDefinition } from "../src/data/worldEvents";
import { TimePeriod } from "../src/systems/daynight";
import { WeatherType } from "../src/systems/weather";
import type { DungeonTrap } from "../src/data/traps";
import { IRON_DISPATCH_QUEST_ID } from "../src/data/quests";
import { setQuestState } from "../src/systems/questDebug";

const BASE_STATS = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

function createTestPlayer() {
  return createPlayer("Social Tester", BASE_STATS);
}

describe("alignment and reputation", () => {
  it("starts every new player as Chaotic Neutral exactly", () => {
    const player = createTestPlayer();
    expect(player.progression.social.alignment).toEqual({
      lawChaos: -50,
      goodEvil: 0,
    });
    expect(getAlignmentName(player.progression.social.alignment))
      .toBe("Chaotic Neutral");
  });

  it.each([
    [-25, 25, "Chaotic Good"],
    [-24, 24, "True Neutral"],
    [25, 25, "Lawful Good"],
    [25, -25, "Lawful Evil"],
    [0, -25, "Neutral Evil"],
    [-25, -25, "Chaotic Evil"],
  ] as const)(
    "classifies law/chaos %s and good/evil %s as %s",
    (lawChaos, goodEvil, expected) => {
      expect(getAlignmentName({ lawChaos, goodEvil })).toBe(expected);
    },
  );

  it("uses deterministic reputation tiers at every boundary", () => {
    for (const tier of REPUTATION_TIERS) {
      expect(getReputationTier(tier.minimum).id).toBe(tier.id);
    }
    expect(getReputationTier(1000).id).toBe("exalted");
    expect(getReputationTier(-1000).id).toBe("hostile");
  });

  it("clamps scores, applies a stable source once, and bounds cause history", () => {
    const player = createTestPlayer();
    const first = applySocialMutation(player, {
      sourceId: "test:clamp",
      cause: "Boundary test",
      alignment: { lawChaos: 500, goodEvil: -500 },
      reputation: [{
        kind: "town",
        targetId: "willowdale_city",
        delta: 500,
      }],
    });
    const replay = applySocialMutation(player, {
      sourceId: "test:clamp",
      cause: "Boundary test",
      alignment: { lawChaos: -500 },
    });
    expect(first.changed).toBe(true);
    expect(replay.changed).toBe(false);
    expect(player.progression.social.alignment).toEqual({
      lawChaos: 100,
      goodEvil: -100,
    });
    expect(player.progression.social.townReputation.willowdale_city).toBe(100);

    for (let index = 0; index < SOCIAL_HISTORY_LIMIT + 5; index++) {
      applySocialMutation(player, {
        sourceId: `test:history:${index}`,
        cause: `Cause ${index}`,
        alignment: { lawChaos: -1 },
      });
    }
    expect(player.progression.social.history).toHaveLength(SOCIAL_HISTORY_LIMIT);
    expect(player.progression.social.history[0]?.sourceId).toBe("test:history:5");
  });

  it("normalizes malformed IDs, duplicates, scores, and history", () => {
    const normalized = normalizeSocialState({
      alignment: { lawChaos: -999, goodEvil: "bad" },
      townReputation: { willowdale_city: 500, unknown: 20 },
      factionReputation: { roadwardens: -500, unknown: 20 },
      appliedSourceIds: ["valid", "valid", 7],
      history: [
        { sourceId: "valid", cause: "Kept", summary: "Valid" },
        { sourceId: "missing", cause: "Dropped", summary: "Invalid" },
      ],
    });
    expect(normalized.alignment).toEqual({ lawChaos: -100, goodEvil: 0 });
    expect(normalized.townReputation).toEqual({ willowdale_city: 100 });
    expect(normalized.factionReputation).toEqual({ roadwardens: -100 });
    expect(normalized.appliedSourceIds).toEqual(["valid"]);
    expect(normalized.history).toHaveLength(1);
  });

  it("composes negotiation and reputation pricing with safe clamps", () => {
    expect(combineShopAdjustments(0.15, 0.1)).toBe(0.25);
    expect(combineShopAdjustments(0.3, 0.2)).toBe(0.35);
    expect(combineShopAdjustments(0, -0.5)).toBe(-0.25);
  });

  it("varies NPC reactions without changing quest authority", () => {
    const player = createTestPlayer();
    const before = structuredClone(player.progression.quests);
    applySocialMutation(player, {
      sourceId: "test:npc",
      cause: "Town aid",
      reputation: [{
        kind: "town",
        targetId: "willowdale_city",
        delta: 60,
      }],
    });

    expect(getNpcSocialReaction(player, "willowdale_city"))
      .toContain("immediate welcome");
    expect(player.progression.quests).toEqual(before);
  });

  it("applies quest dialogue outcomes once through canonical quest APIs", () => {
    const player = createTestPlayer();
    setQuestState(player, IRON_DISPATCH_QUEST_ID, "completed", new Set());
    const firstAlignment = { ...player.progression.social.alignment };
    const firstTown = player.progression.social.townReputation.ironhold_city;
    setQuestState(player, IRON_DISPATCH_QUEST_ID, "completed", new Set());
    expect(player.progression.social.alignment).toEqual(firstAlignment);
    expect(firstTown).toBe(25);
    expect(player.progression.social.townReputation.ironhold_city).toBe(25);
    expect(player.progression.social.appliedSourceIds.filter((sourceId) =>
      sourceId === "quest:ironboundDispatch:reward:dispatch.routeStanding"
    )).toHaveLength(1);
  });

  it("consumes world-event hooks idempotently for good, evil, lawful, and chaotic choices", () => {
    const goodPlayer = createTestPlayer();
    const goodCodex = createCodex();
    const context = {
      location: {
        chunkX: 4,
        chunkY: 2,
        x: 4,
        y: 4,
        areaName: "Heartlands",
        terrain: Terrain.Grass,
      },
      level: 3,
      timeStep: 90,
      period: TimePeriod.Day,
      weather: WeatherType.Clear,
      quests: goodPlayer.progression.quests,
      defeatedBosses: new Set<string>(),
      social: goodPlayer.progression.social,
    };
    forceWorldEvent(goodPlayer.progression.worldEvents, "abandonedSupplyCart", context);
    const good = resolveWorldEventChoice(
      goodPlayer,
      goodCodex,
      new Set(),
      "markCart",
    );
    expect(good.socialEffects.some((effect) => effect.changed)).toBe(true);
    expect(goodPlayer.progression.social.alignment.goodEvil).toBe(4);
    expect(goodPlayer.progression.social.factionReputation.roadwardens).toBe(5);

    const evilPlayer = createTestPlayer();
    forceWorldEvent(evilPlayer.progression.worldEvents, "abandonedSupplyCart", {
      ...context,
      quests: evilPlayer.progression.quests,
      social: evilPlayer.progression.social,
    });
    resolveWorldEventChoice(evilPlayer, createCodex(), new Set(), "searchCart");
    expect(evilPlayer.progression.social.alignment.goodEvil).toBe(-4);

    const lawfulPlayer = createTestPlayer();
    forceWorldEvent(lawfulPlayer.progression.worldEvents, "moonlitShrine", {
      ...context,
      period: TimePeriod.Night,
      quests: lawfulPlayer.progression.quests,
      social: lawfulPlayer.progression.social,
    });
    resolveWorldEventChoice(lawfulPlayer, createCodex(), new Set(), "leaveShrine");
    expect(lawfulPlayer.progression.social.alignment.lawChaos).toBe(-48);

    const chaoticPlayer = createTestPlayer();
    forceWorldEvent(chaoticPlayer.progression.worldEvents, "moonlitShrine", {
      ...context,
      period: TimePeriod.Night,
      quests: chaoticPlayer.progression.quests,
      social: chaoticPlayer.progression.social,
    });
    resolveWorldEventChoice(
      chaoticPlayer,
      createCodex(),
      new Set(),
      "studyRunes",
      () => 20,
    );
    expect(chaoticPlayer.progression.social.alignment.lawChaos).toBe(-52);
  });

  it("gates only the optional council event at a reputation threshold", () => {
    const player = createTestPlayer();
    const event = getWorldEventDefinition("roadwardenCouncil")!;
    const context = {
      location: {
        chunkX: 4,
        chunkY: 2,
        x: 4,
        y: 4,
        areaName: "Heartlands",
        terrain: Terrain.Path,
      },
      level: 3,
      timeStep: 90,
      period: TimePeriod.Day,
      weather: WeatherType.Clear,
      quests: player.progression.quests,
      defeatedBosses: new Set<string>(),
      social: player.progression.social,
    };
    expect(isWorldEventEligible(event, player.progression.worldEvents, context))
      .toBe(false);
    applySocialMutation(player, {
      sourceId: "test:council",
      cause: "Road service",
      reputation: [{
        kind: "faction",
        targetId: "roadwardens",
        delta: 15,
      }],
    });
    expect(isWorldEventEligible(event, player.progression.worldEvents, context))
      .toBe(true);
    forceWorldEvent(player.progression.worldEvents, event.id, context);
    resolveWorldEventChoice(
      player,
      createCodex(),
      new Set(),
      "acceptCharter",
    );
    expect(player.progression.social.alignment).toEqual({
      lawChaos: -42,
      goodEvil: 4,
    });
  });

  it("applies a selected trap decision once", () => {
    const player = createTestPlayer();
    const trap: DungeonTrap = {
      id: "test:trap",
      dungeonId: "heartlands_dungeon",
      level: 0,
      type: "spikePit",
      x: 4,
      y: 4,
      detectionDC: 10,
      disarmDC: 10,
      rewardXp: 20,
      protectsTreasure: false,
    };
    player.progression.trapStates[trap.id] = "detected";
    const result = attemptTrapDisarm(player, trap, 20);
    expect(result.success).toBe(true);
    expect(result.socialSummary).toContain("Law/Chaos +1");
    expect(player.progression.social.appliedSourceIds)
      .toContain("trap:test:trap:disarm");
  });

  it("unlocks Codex faction milestones and keeps achievement hooks runtime-only", () => {
    const player = createTestPlayer();
    const codex = createCodex();
    const result = applySocialMutation(player, {
      sourceId: "test:milestone",
      cause: "Warden service",
      reputation: [{
        kind: "faction",
        targetId: "heartlandsWardens",
        delta: 50,
      }],
    }, codex);
    expect(isCodexKnowledgeUnlocked(codex, "heartlandsWardens")).toBe(true);
    expect(result.achievementHooks).toEqual([{
      type: "reputationTierReached",
      targetKind: "faction",
      targetId: "heartlandsWardens",
      tier: "trusted",
      sourceId: "test:milestone",
    }]);
    expect(JSON.stringify(player.progression.social))
      .not.toContain("reputationTierReached");
  });

  it("supports validated debug list, set, adjust, and explain operations", () => {
    const player = createTestPlayer();
    expect(executeSocialDebugCommand(
      player,
      "alignment",
      "set goodEvil 30",
    ).changed).toBe(true);
    expect(getAlignmentName(player.progression.social.alignment))
      .toBe("Chaotic Good");
    expect(executeSocialDebugCommand(
      player,
      "reputation",
      "adjust town willowdale_city 20",
    ).changed).toBe(true);
    expect(executeSocialDebugCommand(
      player,
      "reputation",
      "set faction unknown 20",
    ).lines[0]).toContain("Usage:");
    expect(executeSocialDebugCommand(player, "alignment", "explain").lines)
      .toContainEqual(expect.stringContaining("Chaotic Good"));
  });

  it("varies the epilogue presentation without mutating campaign state", () => {
    const player = createTestPlayer();
    const before = structuredClone(player.progression.quests);
    const summary = buildCampaignEndingSummary(player, new Set(), createCodex());
    expect(summary.alignment).toBe("Chaotic Neutral");
    expect(summary.epilogueVariant).toContain("freely chosen");
    expect(player.progression.quests).toEqual(before);
  });
});
