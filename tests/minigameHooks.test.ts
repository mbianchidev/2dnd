import { describe, expect, it } from "vitest";
import { getAchievement } from "../src/data/achievements";
import { MINIGAME_ACTIVITY_FEATURES } from "../src/data/featureDiscovery";
import { Terrain } from "../src/data/map";
import { getAchievementProgress, markWorldEventAsDebug, reconcileAchievements } from "../src/systems/achievements";
import { createCodex, replayCodexUnlocks } from "../src/systems/codex";
import { getEscapeMenuEntries, isFeatureAvailable, reconcileFeatureDiscovery } from "../src/systems/featureDiscovery";
import { discoverMinigameVenue, startMinigame } from "../src/systems/minigames";
import { TimePeriod } from "../src/systems/daynight";
import { WeatherType } from "../src/systems/weather";
import { forceWorldEvent, resolveWorldEventChoice } from "../src/systems/worldEvents";
import { playerAt, startRequest } from "./helpers/minigames";
import type { WorldEventContext } from "../src/systems/worldEvents";

describe("activity consumers never become campaign authority", () => {
  it("reveals only discovered activities, with no empty menu or hidden activity gap", () => {
    const player = playerAt("willowdaleRange");
    const codex = createCodex();
    expect(getEscapeMenuEntries(player).some((entry) => entry.action === "minigames")).toBe(false);
    discoverMinigameVenue(player.progression.minigames, "willowdaleRange");
    reconcileFeatureDiscovery(player, codex);
    expect(getEscapeMenuEntries(player).filter((entry) => entry.action === "minigames")).toHaveLength(1);
    expect(isFeatureAvailable(player, "minigames")).toBe(true);
    expect(isFeatureAvailable(player, MINIGAME_ACTIVITY_FEATURES.archery)).toBe(true);
    expect(isFeatureAvailable(player, MINIGAME_ACTIVITY_FEATURES.regatta)).toBe(false);
    const quests = structuredClone(player.progression.quests);
    player.progression.discoveredFeatureIds = [];
    expect(startMinigame(player, startRequest(player, "willowdaleRange")).ok).toBe(true);
    expect(player.progression.quests).toEqual(quests);
  });

  it("does not reveal a natural activity from a debug pending session", () => {
    const player = playerAt("willowdaleRange");
    const codex = createCodex();
    startMinigame(player, startRequest(player, "willowdaleRange", { debug: true }));
    reconcileFeatureDiscovery(player, codex);
    expect(isFeatureAvailable(player, "minigameArchery")).toBe(false);
    expect(player.progression.minigames.discoveredVenueIds).toEqual([]);
  });

  it("derives medals and cosmetic titles only from paid natural statistics, not boards or debug history", () => {
    const player = playerAt("willowdaleRange");
    const codex = createCodex();
    const context = { player, codex, defeatedBosses: new Set<string>() };
    player.progression.minigames.practiceBests["record:willowdaleRange:archeryV1:friendly"] = { score: 100, sessionSequence: 1 };
    expect(getAchievementProgress(getAchievement("steadyHand"), context).complete).toBe(false);
    for (const activity of ["crownAndBones", "archery", "regatta"] as const) {
      player.progression.minigames.statistics[activity] = { attempts: 1, completions: 1, medals: 1 };
    }
    const quests = structuredClone(player.progression.quests);
    const gold = player.gold;
    const result = reconcileAchievements(context);
    expect(result.newlyUnlocked).toEqual(expect.arrayContaining([
      "crownKeeper", "steadyHand", "harborChampion", "festivalTriathlete",
    ]));
    expect(result.titleUnlocks).toEqual(expect.arrayContaining([
      "crownKeeper", "steadyHand", "harborChampion", "festivalLaureate",
    ]));
    expect(reconcileAchievements(context).newlyUnlocked).toEqual([]);
    expect(player.progression.quests).toEqual(quests);
    expect(player.gold).toBe(gold);
    const records = structuredClone(player.progression.minigames);
    player.progression.achievements.earned = [];
    player.progression.achievements.unlockedTitleIds = [];
    expect(player.progression.minigames).toEqual(records);
  });

  it("recovers activity lore idempotently from paid completions without replaying rewards", () => {
    const player = playerAt("willowdaleRange");
    const codex = createCodex();
    player.progression.minigames.statistics.archery = { attempts: 2, completions: 1, medals: 0 };
    const gold = player.gold;
    const minigames = structuredClone(player.progression.minigames);
    replayCodexUnlocks(codex, player);
    expect(codex.unlockedEntryIds).toContain("historyArrowFair");
    expect(replayCodexUnlocks(codex, player).unlockedIds).toEqual([]);
    expect(player.gold).toBe(gold);
    expect(player.progression.minigames).toEqual(minigames);
  });
});

describe("optional festival invitations", () => {
  it.each([false, true])("keeps campaign and economy unchanged when invitation debug=%s", (debug) => {
    const player = playerAt("willowdaleRange");
    player.position.inCity = false;
    player.position.cityId = "";
    const codex = createCodex();
    const context: WorldEventContext = {
      location: { chunkX: 4, chunkY: 2, x: 3, y: 3, areaName: "Heartlands", terrain: Terrain.Grass },
      level: 1, timeStep: 45, period: TimePeriod.Day, weather: WeatherType.Clear,
      quests: player.progression.quests, defeatedBosses: new Set<string>(), social: player.progression.social,
    };
    const pending = forceWorldEvent(player.progression.worldEvents, "festivalInvitation", context);
    if (debug) markWorldEventAsDebug(player, pending.instanceId);
    const quests = structuredClone(player.progression.quests);
    const social = structuredClone(player.progression.social);
    const gold = player.gold;
    const result = resolveWorldEventChoice(player, codex, new Set(), "readInvitation");
    expect(result.resolved).toBe(true);
    expect(player.gold).toBe(gold);
    expect(player.progression.quests).toEqual(quests);
    expect(player.progression.social).toEqual(social);
    expect(player.progression.minigames.pending).toBeNull();
    expect(player.progression.minigames.discoveredVenueIds).toEqual(debug ? [] : [
      "willowInnTable", "willowdaleRange", "sandportRegatta",
    ]);
  });
});
