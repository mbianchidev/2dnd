// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import {
  FEATURE_DEFINITIONS,
  FEATURE_IDS,
} from "../src/data/featureDiscovery";
import { CRAFTING_RECIPES, getDefaultCraftingRecipeIds } from "../src/data/crafting";
import { CODEX_KNOWLEDGE_ENTRIES } from "../src/data/codexKnowledge";
import { ACHIEVEMENTS } from "../src/data/achievements";
import { getItem } from "../src/data/items";
import { createCodex, recordDefeat, unlockCodexEntries } from "../src/systems/codex";
import {
  acknowledgeFeatureReveal,
  clampFeatureSelection,
  executeFeatureDiscoveryDebugCommand,
  getAvailableFeatureIds,
  getCodexDiscoveryCategories,
  getCraftingDiscoveryCategories,
  getEscapeMenuEntries,
  getGatheringDiscoveryDisciplines,
  getPartyDiscoveryPages,
  isFeatureAvailable,
  reconcileFeatureDiscovery,
  revealFeature,
  suppressCurrentlyAvailableFeatures,
} from "../src/systems/featureDiscovery";
import { createPlayer } from "../src/systems/player";
import { recruitCompanion } from "../src/systems/party";
import { getMonster } from "../src/data/monsters";
import { deleteSave, loadGame } from "../src/systems/save";
import { Terrain } from "../src/data/mapTypes";
import { TimePeriod } from "../src/systems/daynight";
import { WeatherType } from "../src/systems/weather";

const BASE_STATS = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

function createContext() {
  return {
    player: createPlayer("Discovery Tester", BASE_STATS),
    codex: createCodex(),
  };
}

describe("feature discovery registry", () => {
  beforeEach(() => deleteSave());

  it("has stable unique definitions, test IDs, and valid owners", () => {
    expect(FEATURE_DEFINITIONS.map((definition) => definition.id))
      .toEqual(FEATURE_IDS);
    expect(new Set(FEATURE_IDS).size).toBe(FEATURE_IDS.length);
    expect(new Set(FEATURE_DEFINITIONS.map((definition) => definition.testId)).size)
      .toBe(FEATURE_DEFINITIONS.length);
    expect(FEATURE_DEFINITIONS.every((definition) =>
      definition.label.length > 0
      && definition.description.length > 0
      && definition.owners.length > 0
    )).toBe(true);
  });

  it("starts with a minimal safe menu and inventory-only shared overlay", () => {
    const { player } = createContext();

    expect(getEscapeMenuEntries(player).map((entry) => entry.action)).toEqual([
      "resume",
      "inventory",
      "tips",
      "settings",
      "quit",
    ]);
    expect(getPartyDiscoveryPages(player)).toEqual(["items"]);
    expect(isFeatureAvailable(player, "inventory")).toBe(true);
    expect(isFeatureAvailable(player, "party")).toBe(false);
  });

  it("reconciles authoritative systems without making discovery authoritative", () => {
    const { player, codex } = createContext();
    const quest = Object.values(player.progression.quests.quests)[0]!;
    quest.status = "active";
    recruitCompanion(player, "guardian");
    player.progression.seenCutsceneIds.push("campaign.opening");
    recordDefeat(codex, getMonster("slime")!, true, []);
    const locationEntry = CODEX_KNOWLEDGE_ENTRIES.find(
      (entry) => entry.category === "location",
    )!;
    unlockCodexEntries(codex, [locationEntry.id]);
    player.progression.achievements.earned.push({
      id: ACHIEVEMENTS[0]!.id,
      unlockedAt: 1,
      order: 1,
      sourceId: "test:natural",
      debug: false,
    });
    const nonDefaultRecipe = CRAFTING_RECIPES.find(
      (recipe) => !getDefaultCraftingRecipeIds().includes(recipe.id),
    )!;
    player.progression.crafting.knownRecipeIds.push(nonDefaultRecipe.id);
    player.progression.gathering.stats.fishing.attempts = 1;
    player.progression.worldEvents.log.push({
      instanceId: "testEvent:1",
      eventId: "testEvent",
      family: "discovery",
      title: "Test Event",
      source: "Test",
      location: {
        chunkX: 4,
        chunkY: 2,
        x: 3,
        y: 3,
        terrain: Terrain.Grass,
        areaName: "Heartlands",
      },
      timeStep: 1,
      period: TimePeriod.Day,
      weather: WeatherType.Clear,
      choiceId: "observe",
      outcomeId: "safe",
      outcome: "Observed",
    });
    player.progression.social.history.push({
      sourceId: "quest:test",
      cause: "Helped",
      summary: "Good +1",
    });
    const mount = getItem("mountDonkey");
    expect(mount).toBeDefined();
    player.inventory.push(mount!);
    player.progression.nautical.discoveredPortIds.push("sandportHarbor");
    player.progression.nautical.discoveredRouteIds.push("sandportTidehavenRun");

    const result = reconcileFeatureDiscovery(player, codex);

    expect(result.newlyDiscovered).toEqual(expect.arrayContaining([
      "questJournal",
      "chronicle",
      "party",
      "partyGambits",
      "codex",
      "codexMonsters",
      "codexLocation",
      "achievements",
      "crafting",
      "gathering",
      "gatheringFishing",
      "worldEvents",
      "socialProfile",
      "mounts",
      "nauticalHarbors",
      "nauticalRoutes",
    ]));
    expect(quest.status).toBe("active");
    expect(player.party.companions).toHaveLength(1);
  });

  it("reveals category-specific tabs only when matching content exists", () => {
    const { player, codex } = createContext();
    recordDefeat(codex, getMonster("slime")!, true, []);
    const factionEntry = CODEX_KNOWLEDGE_ENTRIES.find(
      (entry) => entry.category === "faction",
    )!;
    unlockCodexEntries(codex, [factionEntry.id]);
    const equipmentRecipe = CRAFTING_RECIPES.find(
      (recipe) => recipe.category === "equipment"
        && !getDefaultCraftingRecipeIds().includes(recipe.id),
    )!;
    player.progression.crafting.knownRecipeIds.push(equipmentRecipe.id);
    player.progression.gathering.stats.mining.attempts = 1;

    reconcileFeatureDiscovery(player, codex);

    expect(getCodexDiscoveryCategories(player)).toEqual([
      "monsters",
      "faction",
    ]);
    expect(getCraftingDiscoveryCategories(player)).toContain("equipment");
    expect(getGatheringDiscoveryDisciplines(player)).toEqual(["mining"]);
  });

  it("keeps a revealed feature visible after transient evidence is emptied", () => {
    const { player, codex } = createContext();
    recruitCompanion(player, "guardian");
    reconcileFeatureDiscovery(player, codex);
    player.party.companions = [];
    player.party.activeCompanionIds = [];

    reconcileFeatureDiscovery(player, codex);

    expect(isFeatureAvailable(player, "party")).toBe(true);
    expect(getPartyDiscoveryPages(player)).toEqual([
      "status",
      "items",
      "gambits",
    ]);
  });

  it("queues reveal feedback once and acknowledges it idempotently", () => {
    const { player, codex } = createContext();
    recruitCompanion(player, "guardian");

    reconcileFeatureDiscovery(player, codex);
    reconcileFeatureDiscovery(player, codex);

    expect(player.progression.pendingFeatureRevealIds).toEqual([
      "questJournal",
      "party",
      "partyGambits",
    ]);
    acknowledgeFeatureReveal(player, "party");
    acknowledgeFeatureReveal(player, "party");
    expect(player.progression.pendingFeatureRevealIds).toEqual([
      "questJournal",
      "partyGambits",
    ]);
  });

  it("marks explicit debug reveals and suppresses unrelated debug evidence", () => {
    const { player, codex } = createContext();
    expect(executeFeatureDiscoveryDebugCommand(
      player,
      "reveal achievements",
    ).changed).toBe(true);
    expect(player.progression.debugDiscoveredFeatureIds).toEqual([
      "achievements",
    ]);
    expect(executeFeatureDiscoveryDebugCommand(
      player,
      "hide achievements",
    ).changed).toBe(true);
    expect(isFeatureAvailable(player, "achievements")).toBe(false);

    recruitCompanion(player, "guardian");
    suppressCurrentlyAvailableFeatures(player, codex);
    reconcileFeatureDiscovery(player, codex);
    expect(isFeatureAvailable(player, "party")).toBe(false);
    expect(player.progression.debugSuppressedFeatureIds).toContain("party");
  });

  it("clamps focus indexes when filtered entry counts shrink", () => {
    expect(clampFeatureSelection(5, 3)).toBe(2);
    expect(clampFeatureSelection(-2, 3)).toBe(0);
    expect(clampFeatureSelection(4, 0)).toBe(0);
  });

  it("does not let manual discovery mutate authoritative systems", () => {
    const { player } = createContext();
    const quest = Object.values(player.progression.quests.quests).find(
      (entry) => entry.status === "locked",
    )!;
    expect(quest.status).toBe("locked");

    expect(revealFeature(player, "questJournal")).toBe(true);

    expect(quest.status).toBe("locked");
  });

  it("does not expose parent surfaces without a discovered child category", () => {
    const { player } = createContext();
    revealFeature(player, "codex", { debug: true });
    revealFeature(player, "crafting", { debug: true });
    revealFeature(player, "gathering", { debug: true });

    expect(isFeatureAvailable(player, "codex")).toBe(false);
    expect(isFeatureAvailable(player, "crafting")).toBe(false);
    expect(isFeatureAvailable(player, "gathering")).toBe(false);

    revealFeature(player, "codexMonsters", { debug: true });
    revealFeature(player, "craftingEquipment", { debug: true });
    revealFeature(player, "gatheringFishing", { debug: true });

    expect(isFeatureAvailable(player, "codex")).toBe(true);
    expect(isFeatureAvailable(player, "crafting")).toBe(true);
    expect(isFeatureAvailable(player, "gathering")).toBe(true);
  });

  it("migrates mature v16 evidence silently and repairs malformed IDs", () => {
    const { player, codex } = createContext();
    recruitCompanion(player, "guardian");
    const rawPlayer = player as unknown as {
      progression: Record<string, unknown>;
    };
    rawPlayer.progression.discoveredFeatureIds = [
      "questJournal",
      "questJournal",
      "unknown",
    ];
    rawPlayer.progression.pendingFeatureRevealIds = [
      "unknown",
      "questJournal",
    ];
    rawPlayer.progression.debugDiscoveredFeatureIds = ["unknown"];
    rawPlayer.progression.debugSuppressedFeatureIds = ["unknown"];
    localStorage.setItem("2dnd_save", JSON.stringify({
      version: 16,
      player,
      defeatedBosses: [],
      codex,
      appearanceId: player.appearanceId,
      timestamp: 1,
      timeStep: 0,
    }));

    const loaded = loadGame();

    expect(loaded?.version).toBe(17);
    expect(loaded?.player.progression.discoveredFeatureIds).toEqual(
      expect.arrayContaining(["questJournal", "party", "partyGambits"]),
    );
    expect(loaded?.player.progression.pendingFeatureRevealIds).toEqual([]);
    expect(loaded?.player.progression.debugDiscoveredFeatureIds).toEqual([]);
    expect(loaded?.player.progression.debugSuppressedFeatureIds).toEqual([]);
    expect(getAvailableFeatureIds(loaded!.player)).toContain("inventory");
  });
});
