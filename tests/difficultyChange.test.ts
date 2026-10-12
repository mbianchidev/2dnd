import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDifficultyProfile } from "../src/data/difficulty";
import {
  DIFFICULTY_HISTORY_LIMIT,
  changeCampaignDifficulty,
  getCampaignDifficultyEligibility,
  normalizeCampaignDifficulty,
  type DifficultyChangeContext,
} from "../src/systems/difficulty";
import { createCodex } from "../src/systems/codex";
import {
  deleteAllSaveSlots, loadGame, saveGame,
} from "../src/systems/save";
import { saveGameToSlot } from "../src/systems/saveSlots";
import { getSaveSlotStorageKey } from "../src/systems/saveStorage";
import { forceWorldEvent } from "../src/systems/worldEvents";
import { Terrain } from "../src/data/map";
import { TimePeriod } from "../src/systems/daynight";
import { WeatherType } from "../src/systems/weather";
import { startGathering } from "../src/systems/gathering";
import { discoverPort, executeMerchantRoute, acquireBoat, prepareSeaEncounter, prepareSeaHazard } from "../src/systems/nautical";
import { DIFFICULTY_MODE_CASES, createDifficultyPlayer } from "./difficultyFixtures";

const SAFE: DifficultyChangeContext = {
  phase: "exploration", inputAccepted: true, confirmed: true, timeStep: 100,
};

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  deleteAllSaveSlots();
});
afterEach(() => {
  deleteAllSaveSlots();
  vi.restoreAllMocks();
});

describe.each(DIFFICULTY_MODE_CASES)("$name mid-campaign transaction", ({ selection }) => {
  it("requires confirmation and accepted exploration input without spending resources", () => {
    const player = createDifficultyPlayer(selection);
    const persist = vi.fn(() => ({ ok: true, message: "saved" }));
    const before = JSON.stringify(player);
    const target = selection.profileId === "story" ? { profileId: "standard" } : { profileId: "story" };
    for (const context of [
      { ...SAFE, confirmed: false },
      { ...SAFE, inputAccepted: false },
      ...(["battle", "cutscene", "transition", "interaction"] as const).map((phase) => ({ ...SAFE, phase })),
      { ...SAFE, timeStep: -1 },
    ]) {
      expect(changeCampaignDifficulty(player, target, context, persist).ok).toBe(false);
      expect(JSON.stringify(player)).toBe(before);
    }
    expect(persist).not.toHaveBeenCalled();
  });

  it("logs one canonical cause and autosaves once without replaying any campaign outcome", () => {
    const player = createDifficultyPlayer(selection);
    const codex = createCodex();
    const target = selection.profileId === "story"
      ? { profileId: "standard" as const } : { profileId: "story" as const };
    const source = JSON.stringify({
      gold: player.gold, xp: player.xp, hp: player.hp, mp: player.mp,
      progression: player.progression, inventory: player.inventory, party: player.party,
    });
    const persist = vi.fn(() => saveGame(player, new Set(), codex, player.appearanceId));
    const result = changeCampaignDifficulty(player, target, SAFE, persist);
    expect(result).toMatchObject({ ok: true, changed: true });
    expect(persist).toHaveBeenCalledOnce();
    expect(player.difficulty.changeCount).toBe(1);
    expect(player.difficulty.initialProfileId).toBe(selection.profileId);
    expect(player.difficulty.history).toEqual([{
      sequence: 1, timeStep: 100, cause: "playerConfirmed",
      from: selection, to: target,
    }]);
    expect(JSON.stringify({
      gold: player.gold, xp: player.xp, hp: player.hp, mp: player.mp,
      progression: player.progression, inventory: player.inventory, party: player.party,
    })).toBe(source);
    expect(loadGame()!.player.difficulty).toEqual(player.difficulty);
    expect(getCampaignDifficultyEligibility(player).challengeProfile).toBeNull();
  });

  it("does not count repeated saves or an unchanged selection as another change", () => {
    const player = createDifficultyPlayer(selection);
    const previous = player.difficulty;
    const persist = vi.fn(() => ({ ok: true, message: "saved" }));
    expect(changeCampaignDifficulty(player, selection, SAFE, persist))
      .toMatchObject({ ok: true, changed: false });
    expect(player.difficulty).toBe(previous);
    expect(persist).not.toHaveBeenCalled();
    saveGame(player, new Set(), createCodex(), player.appearanceId);
    saveGame(player, new Set(), createCodex(), player.appearanceId);
    expect(loadGame()!.player.difficulty.changeCount).toBe(0);
  });

  it("rolls back the exact live metadata if autosave fails or unexpectedly throws", () => {
    const player = createDifficultyPlayer(selection);
    const target = selection.profileId === "legendary" ? { profileId: "story" } : { profileId: "legendary" };
    const previous = player.difficulty;
    const before = JSON.stringify(player);
    const rejected = changeCampaignDifficulty(player, target, SAFE, () => ({
      ok: false, message: "Storage is full.",
    }));
    expect(rejected).toMatchObject({ ok: false, changed: false });
    expect(rejected.message).toContain("autosave failed");
    expect(player.difficulty).toBe(previous);
    expect(JSON.stringify(player)).toBe(before);
    expect(() => changeCampaignDifficulty(player, target, SAFE, () => {
      throw new Error("Unexpected storage adapter error");
    })).toThrow("Unexpected storage adapter error");
    expect(player.difficulty).toBe(previous);
    expect(JSON.stringify(player)).toBe(before);
  });

  it("rejects invalid Custom input and cannot bypass bounds through mid-run editing", () => {
    const player = createDifficultyPlayer(selection);
    const before = JSON.stringify(player);
    const persist = vi.fn(() => ({ ok: true, message: "saved" }));
    expect(changeCampaignDifficulty(player, {
      profileId: "custom", overrides: { enemyHpPercent: 1000, pricePercent: -10 },
    }, SAFE, persist).ok).toBe(false);
    expect(persist).not.toHaveBeenCalled();
    expect(JSON.stringify(player)).toBe(before);
  });
});

describe("pending authoritative outcomes block profile changes", () => {
  it("blocks queued cutscenes and pending World Events", () => {
    const player = createDifficultyPlayer({ profileId: "standard" });
    const persist = vi.fn(() => ({ ok: true, message: "saved" }));
    player.progression.pendingCutsceneIds.push("campaign.opening");
    expect(changeCampaignDifficulty(player, { profileId: "story" }, SAFE, persist).message)
      .toContain("queued story");
    player.progression.pendingCutsceneIds = [];
    forceWorldEvent(player.progression.worldEvents, "abandonedSupplyCart", {
      location: { chunkX: 4, chunkY: 2, x: 4, y: 4, areaName: "Heartlands", terrain: Terrain.Grass },
      level: 3, timeStep: 100, period: TimePeriod.Day, weather: WeatherType.Clear,
      quests: player.progression.quests, defeatedBosses: new Set(), social: player.progression.social,
    });
    const pending = player.progression.worldEvents.pending;
    expect(changeCampaignDifficulty(player, { profileId: "story" }, SAFE, persist).message)
      .toContain("World Event");
    expect(player.progression.worldEvents.pending).toBe(pending);
    expect(persist).not.toHaveBeenCalled();
  });

  it("blocks selected gathering rewards and patterns before presentation or guard resolution", () => {
    const player = createDifficultyPlayer({ profileId: "standard" });
    startGathering(player, {
      id: "g:mining:overworld:test:0:4,3", discipline: "mining",
      location: {
        context: "overworld", contextId: "test", sublevel: 0, playerX: 3, playerY: 3,
        targetX: 4, targetY: 3, terrain: Terrain.Mountain, biome: "Mountain Reach",
      },
    }, { timeStep: 100, weather: WeatherType.Clear, reducedMotion: true });
    const pending = JSON.stringify(player.progression.gathering.pending);
    const persist = vi.fn(() => ({ ok: true, message: "saved" }));
    expect(changeCampaignDifficulty(player, { profileId: "story" }, SAFE, persist).message)
      .toContain("gathering");
    expect(JSON.stringify(player.progression.gathering.pending)).toBe(pending);
    expect(persist).not.toHaveBeenCalled();
  });

  it("blocks pending merchant, hazard and encounter receipts without rerating or rerolling them", () => {
    const player = createDifficultyPlayer({ profileId: "standard" });
    const nautical = player.progression.nautical;
    const persist = vi.fn(() => ({ ok: true, message: "saved" }));
    discoverPort(nautical, "sandportHarbor");
    executeMerchantRoute(nautical, player, "sandportTidehavenRun", "sandportHarbor", "change:route");
    expect(changeCampaignDifficulty(player, { profileId: "story" }, SAFE, persist).message).toContain("sea");
    nautical.pendingMerchantRoute = null;
    const boat = acquireBoat(nautical, "stormcutter").boat;
    nautical.sailing = true;
    prepareSeaEncounter({
      state: nautical, boat, stepId: "change:encounter", rateRoll: 0, selectionRoll: 0,
      zoneId: "covenantStrait", depth: "shallow", timeStep: 100, weather: WeatherType.Clear,
      position: { chunkX: 4, chunkY: 2, x: 6, y: 1 },
    });
    expect(nautical.pendingEncounter).not.toBeNull();
    expect(changeCampaignDifficulty(player, { profileId: "story" }, SAFE, persist).message).toContain("sea");
    nautical.pendingEncounter = null;
    for (let seed = 1; seed < 1000 && !nautical.pendingHazard; seed += 1) {
      prepareSeaHazard({
        state: nautical, stepId: `change:hazard:${seed}`, seed, zoneId: "southreachDeep",
        depth: "deep", timeStep: 300, weather: WeatherType.Storm,
      });
    }
    expect(nautical.pendingHazard).not.toBeNull();
    const pending = JSON.stringify(nautical.pendingHazard);
    expect(changeCampaignDifficulty(player, { profileId: "story" }, SAFE, persist).message).toContain("sea");
    expect(JSON.stringify(nautical.pendingHazard)).toBe(pending);
    expect(persist).not.toHaveBeenCalled();
  });
});

it("cannot regain preset credit through equivalent Custom/preset round trips or history truncation", () => {
  const player = createDifficultyPlayer({ profileId: "legendary" });
  const custom = { profileId: "custom" as const, overrides: getDifficultyProfile("legendary").modifiers };
  const persist = (): { ok: true; message: string } => ({ ok: true, message: "saved" });
  for (let index = 0; index < 42; index += 1) {
    expect(changeCampaignDifficulty(player, index % 2 === 0 ? custom : { profileId: "legendary" },
      { ...SAFE, timeStep: index }, persist).changed).toBe(true);
  }
  expect(player.difficulty.changeCount).toBe(42);
  expect(player.difficulty.history).toHaveLength(DIFFICULTY_HISTORY_LIMIT);
  expect(getCampaignDifficultyEligibility(player).challengeProfile).toBeNull();
  const loaded = normalizeCampaignDifficulty(JSON.parse(JSON.stringify(player.difficulty)));
  expect(loaded.changeCount).toBe(42);
  expect(loaded.selection.profileId).toBe("legendary");
});

it("only updates autosave; a manual source and prior earned achievements remain unchanged", () => {
  const player = createDifficultyPlayer({ profileId: "legendary" });
  player.progression.achievements.earned.push({
    id: "legendaryCovenant", unlockedAt: 1, order: 1, sourceId: "natural:completion", debug: false,
  });
  const codex = createCodex();
  saveGameToSlot("manual-1", player, new Set(), codex, player.appearanceId);
  const source = localStorage.getItem(getSaveSlotStorageKey("manual-1"));
  expect(changeCampaignDifficulty(player, { profileId: "story" }, SAFE,
    () => saveGame(player, new Set(), codex, player.appearanceId)).ok).toBe(true);
  expect(localStorage.getItem(getSaveSlotStorageKey("manual-1"))).toBe(source);
  expect(player.progression.achievements.earned[0]!.id).toBe("legendaryCovenant");
  expect(loadGame("manual-1")!.player.difficulty.selection.profileId).toBe("legendary");
  expect(loadGame()!.player.difficulty.selection.profileId).toBe("story");
});
