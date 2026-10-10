import { describe, expect, it } from "vitest";
import {
  DEITY_IDS,
  DEVOTION_SOURCE_DEFINITIONS,
  DEVOTION_QUEST_IDS,
  TEMPLES,
  type DeityId,
} from "../src/data/devotion";
import { QUESTS, MAIN_QUEST_ID, type QuestNpcId } from "../src/data/quests";
import { getWorldEventDefinition, WORLD_EVENT_DEFINITIONS } from "../src/data/worldEvents";
import { createPlayer, type PlayerState } from "../src/systems/player";
import { createCodex, replayCodexUnlocks, unlockCodexFromSignal } from "../src/systems/codex";
import { buildCampaignEndingSummary, shouldShowCampaignEpilogue } from "../src/systems/cutscenes";
import {
  completeNpcQuestInteraction,
  getNpcQuestInteraction,
  getQuestAccessDecision,
  isQuestCompleted,
  reconcileQuestState,
  recordMonsterDefeats,
  startQuestById,
} from "../src/systems/quests";
import { setQuestState } from "../src/systems/questDebug";
import { applyDevotionSource } from "../src/systems/devotion";
import { forceWorldEvent, resolveWorldEventChoice, type WorldEventContext } from "../src/systems/worldEvents";
import { Terrain } from "../src/data/map";
import { TimePeriod } from "../src/systems/daynight";
import { WeatherType } from "../src/systems/weather";
import { getAchievement, TITLES } from "../src/data/achievements";
import { markWorldEventAsDebug, reconcileAchievements } from "../src/systems/achievements";
import { executeDevotionDebugCommand } from "../src/systems/devotionDebug";
import { deriveAvailableFeatureIds } from "../src/systems/featureDiscovery";

function hero(deityId: DeityId | null = null): PlayerState {
  const player = createPlayer("Integration fixture", {
    strength: 10, dexterity: 10, constitution: 10,
    intelligence: 10, wisdom: 10, charisma: 10,
  });
  player.progression.devotion.deityId = deityId;
  return player;
}

function context(player: PlayerState): WorldEventContext {
  return {
    location: { chunkX: 4, chunkY: 2, x: 4, y: 4, areaName: "Heartlands", terrain: Terrain.Grass },
    level: player.level, timeStep: 90, period: TimePeriod.Day, weather: WeatherType.Clear,
    quests: player.progression.quests, defeatedBosses: new Set(), social: player.progression.social,
  };
}

describe("optional devotion content and authority isolation", () => {
  it("validates every source against its owning content and bounded canonical deltas", () => {
    for (const source of DEVOTION_SOURCE_DEFINITIONS) {
      expect(Object.keys(source.deltas).sort()).toEqual([...DEITY_IDS].sort());
      Object.values(source.deltas).forEach((delta) => {
        expect(Number.isInteger(delta)).toBe(true);
        expect(Math.abs(delta)).toBeLessThanOrEqual(14);
      });
      const trigger = source.trigger;
      if (trigger.type === "questCompletion") expect(QUESTS[trigger.questId]).toBeDefined();
      if (trigger.type === "worldEventOutcome") {
        const event = getWorldEventDefinition(trigger.eventId)!;
        expect(event).toBeDefined();
        const outcomes = event.choices.flatMap((choice) =>
          choice.type === "resolve" ? [choice.outcome]
            : choice.type === "skill" ? [choice.success, choice.failure]
            : [choice.victory, choice.fled, choice.defeat]);
        expect(outcomes.some((outcome) => outcome.id === trigger.outcomeId)).toBe(true);
      }
    }
  });

  it.each([null, ...DEITY_IDS])("completes the entire canonical campaign for %s without a devotion prerequisite", (deityId) => {
    const player = hero(deityId);
    const bosses = new Set<string>();
    for (const stage of QUESTS[MAIN_QUEST_ID].stages) {
      for (const objective of stage.objectives) {
        if (objective.type === "defeat") {
          bosses.add(objective.targetId);
          recordMonsterDefeats(player, bosses, [objective.targetId]);
        } else {
          const interaction = getNpcQuestInteraction(player, objective.targetId as QuestNpcId);
          expect(interaction?.questId).toBe(MAIN_QUEST_ID);
          completeNpcQuestInteraction(player, bosses, interaction!);
        }
      }
    }
    expect(isQuestCompleted(player.progression.quests, MAIN_QUEST_ID)).toBe(true);
    expect(shouldShowCampaignEpilogue(player)).toBe(true);
    expect(player.progression.devotion.deityId).toBe(deityId);
    const before = structuredClone(player);
    const summary = buildCampaignEndingSummary(player, bosses, createCodex());
    expect(summary.devotion).toContain(deityId ? "reminder" : "no affiliation");
    reconcileQuestState(player, bosses);
    expect(player).toEqual(before);
  });

  it.each(DEVOTION_QUEST_IDS)("keeps %s optional, accessible to all, and reward/source idempotent", (questId) => {
    const player = hero("selquor");
    const main = structuredClone(player.progression.quests.quests[MAIN_QUEST_ID]);
    expect(startQuestById(player, new Set(), questId).changed).toBe(true);
    for (const stage of QUESTS[questId].stages) {
      for (const objective of stage.objectives) {
        const interaction = {
          kind: "objective" as const, questId, npcId: objective.targetId as QuestNpcId,
          objectiveId: objective.id, speaker: "Mock keeper", pages: objective.dialogue!,
        };
        completeNpcQuestInteraction(player, new Set(), interaction);
      }
    }
    expect(isQuestCompleted(player.progression.quests, questId)).toBe(true);
    expect(player.progression.devotion.score).toBeGreaterThan(0);
    expect(player.progression.quests.quests[MAIN_QUEST_ID]).toEqual(main);
    const before = structuredClone(player);
    reconcileQuestState(player, new Set());
    startQuestById(player, new Set(), questId);
    expect(player).toEqual(before);
  });

  it("does not award devotion for debug completion, reset or quest replay", () => {
    const player = hero("orivane");
    setQuestState(player, "mendTheSpan", "completed");
    setQuestState(player, "mendTheSpan", "locked");
    setQuestState(player, "mendTheSpan", "completed");
    expect(player.progression.devotion.score).toBe(0);
    expect(player.progression.devotion.appliedSourceIds.filter((id) => id === "spanMended"))
      .toHaveLength(1);
    expect(applyDevotionSource(player, "spanMended").changed).toBe(false);
  });

  it("records event conflicts and social effects independently and only once", () => {
    const player = hero("selquor");
    player.progression.devotion.score = 20;
    const codex = createCodex();
    const questSnapshot = structuredClone(player.progression.quests);
    forceWorldEvent(player.progression.worldEvents, "fallenEchoGlass", context(player));
    const result = resolveWorldEventChoice(player, codex, new Set(), "claimEchoGlass");
    expect(result.devotionEffects[0].delta).toBe(-12);
    expect(player.progression.devotion.score).toBe(8);
    expect(player.progression.social.alignment.goodEvil).toBe(-3);
    expect(player.progression.quests).toEqual(questSnapshot);
    forceWorldEvent(player.progression.worldEvents, "fallenEchoGlass", context(player));
    resolveWorldEventChoice(player, codex, new Set(), "claimEchoGlass");
    expect(player.progression.devotion.score).toBe(8);
    expect(player.progression.devotion.appliedSourceIds.filter((id) => id === "echoRecordTaken"))
      .toHaveLength(1);
  });

  it("does not turn forced debug events into natural devotion or blessings", () => {
    const player = hero("tessune");
    forceWorldEvent(player.progression.worldEvents, "turningShoalBeacon", context(player));
    markWorldEventAsDebug(player, player.progression.worldEvents.pending!.instanceId);
    const result = resolveWorldEventChoice(player, createCodex(), new Set(), "shareShoalBeacon");
    expect(result.devotionEffects[0].delta).toBe(0);
    expect(player.progression.devotion.score).toBe(0);
    expect(player.activeEffects).toEqual([]);
    expect(player.progression.devotion.debugSourceIds).toContain("shoalBeaconShared");
  });

  it("uses Codex and achievements only as consumers and keeps titles cosmetic", () => {
    const player = hero("orivane");
    const codex = createCodex();
    const before = structuredClone(player);
    unlockCodexFromSignal(codex, { type: "devotionAffiliation", deityId: "orivane" });
    expect(player).toEqual(before);
    expect(codex.unlockedEntryIds).toContain("devotionOrivane");
    player.progression.devotion.visitedTempleIds = TEMPLES.slice(0, 3).map((entry) => entry.id);
    player.progression.devotion.score = 50;
    const devotionBefore = structuredClone(player.progression.devotion);
    const socialBefore = structuredClone(player.progression.social);
    reconcileAchievements({ player, codex, defeatedBosses: new Set() });
    replayCodexUnlocks(codex, player);
    expect(player.progression.devotion).toEqual(devotionBefore);
    expect(player.progression.social).toEqual(socialBefore);
    expect(player.progression.achievements.unlockedTitleIds).toContain("threadkeeper");
    expect(TITLES.find((title) => title.id === "threadkeeper")?.achievementId)
      .toBe("steadfastDevotion");
    expect(getAchievement("constellationVisitor").criteria).toMatchObject({ threshold: 3 });
    const baseAccess = getQuestAccessDecision(hero(), { type: "city", id: "ashfall_city" });
    expect(getQuestAccessDecision(player, { type: "city", id: "ashfall_city" })).toEqual(baseAccess);
  });

  it("reveals the profile only after an authoritative temple visit, not lore or debug sources", () => {
    const player = hero();
    const codex = createCodex();
    expect(deriveAvailableFeatureIds(player, codex)).not.toContain("devotionProfile");
    unlockCodexFromSignal(codex, { type: "devotionTemple", templeId: "willowdaleSpan" });
    executeDevotionDebugCommand(player, "source covenantReturned");
    executeDevotionDebugCommand(player, "near willowdaleSpan");
    expect(player.progression.devotion.visitedTempleIds).toEqual([]);
    expect(player.activeEffects).toEqual([]);
    expect(deriveAvailableFeatureIds(player, codex)).not.toContain("devotionProfile");
    player.progression.devotion.visitedTempleIds.push("willowdaleSpan");
    expect(deriveAvailableFeatureIds(player, codex)).toContain("devotionProfile");
    expect(WORLD_EVENT_DEFINITIONS.find((event) => event.id === "turningShoalBeacon")
      ?.eligibility.terrains).toEqual([Terrain.Water]);
  });
});
