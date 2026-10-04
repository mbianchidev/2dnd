import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SAVE_VERSION, createCurrentSaveData, deleteAllSaveSlots,
  loadGame, normalizeSaveData, saveGame,
} from "../src/systems/save";
import { createCodex } from "../src/systems/codex";
import {
  exportSaveSlot, importSaveSlot, listSaveSlots, saveGameToSlot,
} from "../src/systems/saveSlots";
import { getSaveSlotStorageKey } from "../src/systems/saveStorage";
import { createWeatherState } from "../src/systems/weather";
import {
  getCampaignDifficultyEligibility, getCampaignDifficultyRules,
  normalizeCampaignDifficulty,
} from "../src/systems/difficulty";
import { applyPartyDefeat } from "../src/systems/party";
import { gamePreferences } from "../src/systems/accessibility";
import { TUTORIAL_STEPS } from "../src/data/tutorial";
import { createTutorialTipContext, getTutorialStepSummary, getUnlockedTips } from "../src/systems/tutorial";
import { DIFFICULTY_MODE_CASES, createDifficultyPlayer } from "./difficultyFixtures";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  deleteAllSaveSlots();
});
afterEach(() => {
  deleteAllSaveSlots();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe.each(DIFFICULTY_MODE_CASES)("$name save ownership", ({ selection }) => {
  it("adapts Tutorial and Tips to the selected profile without mutating progress", () => {
    const player = createDifficultyPlayer(selection);
    const before = JSON.stringify(player.difficulty);
    const step = TUTORIAL_STEPS.find((entry) => entry.id === "combat")!;
    expect(getTutorialStepSummary(step, player)).toContain(
      selection.profileId === "custom" ? "Custom" : selection.profileId[0]!.toUpperCase() + selection.profileId.slice(1),
    );
    const tips = getUnlockedTips(createTutorialTipContext(player));
    expect(tips.some((tip) => tip.id === "controls.difficulty")).toBe(true);
    for (const tip of tips) {
      if (tip.unlock.type === "difficulty") expect(tip.unlock.profileIds).toContain(selection.profileId);
    }
    expect(tips.some((tip) => tip.id === "combat.storyRules")).toBe(selection.profileId === "story");
    expect(tips.some((tip) => tip.id === "combat.customRules")).toBe(selection.profileId === "custom");
    expect(JSON.stringify(player.difficulty)).toBe(before);
    expect(player.progression.tutorial.completed).toBe(false);
  });

  it("round-trips canonical selections without storing any derived scaling layer", () => {
    const player = createDifficultyPlayer(selection);
    expect(saveGame(player, new Set(), createCodex(), player.appearanceId).ok).toBe(true);
    const raw: unknown = JSON.parse(localStorage.getItem("2dnd_save")!);
    if (!isRecord(raw) || !isRecord(raw.player) || !isRecord(raw.player.difficulty)) {
      throw new Error("Expected a stored canonical difficulty document");
    }
    expect(raw.version).toBe(SAVE_VERSION);
    expect(Object.keys(raw.player.difficulty).sort()).toEqual([
      "changeCount", "history", "initialProfileId", "selection",
    ]);
    const loaded = loadGame()!;
    expect(loaded.player.difficulty).toEqual(player.difficulty);
    expect(getCampaignDifficultyRules(loaded.player)).toEqual(getCampaignDifficultyRules(player));
    saveGame(loaded.player, new Set(), loaded.codex, loaded.player.appearanceId);
    expect(loadGame()!.player.difficulty.changeCount).toBe(0);
  });

  it("exposes truthful slot metadata and leaves manual-source bytes unchanged", () => {
    const player = createDifficultyPlayer(selection);
    expect(saveGameToSlot("manual-1", player, new Set(), createCodex(), player.appearanceId).ok)
      .toBe(true);
    const source = localStorage.getItem(getSaveSlotStorageKey("manual-1"));
    const metadata = listSaveSlots().find((slot) => slot.slotId === "manual-1")!.metadata!;
    expect(metadata.difficultyProfileId).toBe(selection.profileId);
    expect(metadata.difficultyChangeCount).toBe(0);
    expect(metadata.difficultyChallengeProfile)
      .toBe(getCampaignDifficultyEligibility(player).challengeProfile);
    const loaded = loadGame("manual-1")!;
    saveGame(loaded.player, new Set(), loaded.codex, loaded.player.appearanceId);
    expect(localStorage.getItem(getSaveSlotStorageKey("manual-1"))).toBe(source);
    const exported = exportSaveSlot("manual-1");
    if (!exported.ok) throw new Error(exported.message);
    expect(importSaveSlot("manual-2", exported.json).ok).toBe(true);
    expect(loadGame("manual-2")!.player.difficulty).toEqual(player.difficulty);
    expect(localStorage.getItem(getSaveSlotStorageKey("manual-1"))).toBe(source);
  });

  it("does not reapply defeat penalties during reload or snapshot recovery", () => {
    const player = createDifficultyPlayer(selection);
    player.hp = 0;
    player.xp = 399;
    player.gold = 101;
    const receipt = applyPartyDefeat(player, ["party:hero"]);
    saveGame(player, new Set(), createCodex(), player.appearanceId);
    for (let reload = 0; reload < 3; reload += 1) {
      const loaded = loadGame()!;
      expect(loaded.player.gold).toBe(receipt.goldAfter);
      expect(loaded.player.xp).toBe(receipt.actors[0]!.xpAfter);
      expect(loaded.player.hp).toBe(receipt.actors[0]!.restoredHp);
      saveGame(loaded.player, new Set(), loaded.codex, loaded.player.appearanceId);
    }
  });

  it("keeps presentation and input preferences outside campaign and eligibility", () => {
    const player = createDifficultyPlayer(selection);
    saveGame(player, new Set(), createCodex(), player.appearanceId);
    const bytes = localStorage.getItem("2dnd_save");
    const eligibility = getCampaignDifficultyEligibility(player);
    const preferences = gamePreferences.get();
    gamePreferences.setReducedMotion(!preferences.accessibility.reducedMotion);
    gamePreferences.setHighContrast(!preferences.accessibility.highContrast);
    gamePreferences.cycleTextScale();
    gamePreferences.cyclePromptSource();
    gamePreferences.setControlHandedness("left");
    expect(localStorage.getItem("2dnd_save")).toBe(bytes);
    expect(getCampaignDifficultyEligibility(player)).toEqual(eligibility);
    expect(getCampaignDifficultyRules(player)).toEqual(getCampaignDifficultyRules(loadGame()!.player));
    gamePreferences.setReducedMotion(preferences.accessibility.reducedMotion);
    gamePreferences.setHighContrast(preferences.accessibility.highContrast);
    gamePreferences.setControlHandedness(preferences.controls.handedness);
    while (gamePreferences.getAccessibility().textScale !== preferences.accessibility.textScale) {
      gamePreferences.cycleTextScale();
    }
    while (gamePreferences.getControls().promptSource !== preferences.controls.promptSource) {
      gamePreferences.cyclePromptSource();
    }
  });
});

it("repairs unknown modern rules, malformed Custom values and false continuity conservatively", () => {
  const player = createDifficultyPlayer({ profileId: "legendary" });
  const valid = createCurrentSaveData(player, new Set(), createCodex(), "knight", 0, createWeatherState());
  const raw = {
    ...valid,
    player: {
      ...player,
      difficulty: {
        selection: { profileId: "custom", overrides: {
          enemyHpPercent: 999, enemyDamagePercent: -1,
          skillCheckAssistance: Infinity, pricePercent: 1,
          timedRoundDurationSeconds: 2, enemyAiPolicy: "impossible",
          unknownGate: false,
        } },
        initialProfileId: "legendary", changeCount: 0, history: [],
      },
    },
  };
  const loaded = normalizeSaveData(raw)!;
  expect(loaded).not.toBeNull();
  expect(loaded.player.difficulty.selection).toEqual({
    profileId: "custom", overrides: {
      enemyHpPercent: 200, enemyDamagePercent: 50, pricePercent: 75,
    },
  });
  expect(loaded.player.difficulty.changeCount).toBeGreaterThanOrEqual(1);
  expect(getCampaignDifficultyEligibility(loaded.player).challengeProfile).toBeNull();
  expect(loaded.player.progression.quests).toEqual(player.progression.quests);
  expect(loaded.player.progression.social).toEqual(player.progression.social);
});

it("migrates v18 completed campaigns to Standard without replaying claimed rewards", () => {
  const player = createDifficultyPlayer({ profileId: "legendary" });
  player.progression.quests.quests.twelvefoldCovenant.status = "completed";
  player.progression.quests.quests.twelvefoldCovenant.claimedRewards = ["main.completionGold"];
  const raw = {
    ...createCurrentSaveData(player, new Set(), createCodex(), "knight", 0),
    version: 18,
  };
  const gold = player.gold;
  const loaded = normalizeSaveData(raw)!;
  expect(loaded.player.difficulty).toEqual(normalizeCampaignDifficulty(undefined, 18));
  expect(loaded.player.gold).toBe(gold);
  expect(loaded.player.progression.quests.quests.twelvefoldCovenant.claimedRewards)
    .toContain("main.completionGold");
  expect(getCampaignDifficultyEligibility(loaded.player).challengeProfile).toBeNull();
});
