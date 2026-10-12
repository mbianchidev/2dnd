// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { PRESTIGE_PATHS } from "../src/data/prestige";
import { PRESTIGE_ABILITIES, PRESTIGE_SPELLS, PRESTIGE_TALENTS } from "../src/data/prestigeActions";
import {
  commitHeroLevelUp, getTrackLevel, prepareHeroLevelUp, prepareNextHeroLevelUp,
} from "../src/systems/classProgression";
import { createHeroProgressionContext } from "../src/systems/classProgressionContext";
import { executePrestigeDebugCommand, executeProgressionDebugCommand } from "../src/systems/classProgressionDebug";
import { createCodex, replayCodexUnlocks } from "../src/systems/codex";
import { getAchievementProgress, reconcileAchievements } from "../src/systems/achievements";
import { getAchievement } from "../src/data/achievements";
import { getItem, type Item } from "../src/data/items";
import { normalizeHeroProgressionState } from "../src/systems/classProgressionState";
import { createCurrentSaveData, loadGame, normalizeSaveData, saveGame, SAVE_VERSION } from "../src/systems/save";
import { exportSaveSlot, importSaveSlot, saveGameToSlot } from "../src/systems/saveSlots";
import { createWeatherState } from "../src/systems/weather";
import { awardXP, xpForLevel } from "../src/systems/player";
import { advancePrestige, prestigeFixture } from "./helpers/prestige";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

function documentFor(hero: ReturnType<typeof prestigeFixture>, version = SAVE_VERSION) {
  return JSON.parse(JSON.stringify({
    ...createCurrentSaveData(hero, new Set(), createCodex(), hero.appearanceId, 0, createWeatherState()),
    version,
  })) as unknown;
}

describe.each(PRESTIGE_PATHS.map((path) => [path.pathId] as const))("%s save authority", (id) => {
  it("round-trips all ranks and frozen credits without gains, requalification or rerolls", () => {
    const hero = prestigeFixture(id);
    for (let rank = 1; rank <= 5; rank++) {
      advancePrestige(hero, id);
      hero.progression.social.factionReputation = {};
      hero.progression.discoveredCities = [];
      hero.progression.social.alignment = { lawChaos: 100, goodEvil: -100 };
      const before = structuredClone(hero);
      const random = vi.spyOn(Math, "random");
      random.mockClear();
      const normalized = normalizeSaveData(documentFor(hero));
      expect(normalized).not.toBeNull();
      if (!normalized) throw new Error("Valid prestige save rejected");
      for (const key of ["classProgression", "level", "xp", "hp", "mp", "maxHp", "maxMp",
        "stats", "knownSpells", "knownAbilities", "knownTalents", "inventory"] as const) {
        expect(normalized.player[key]).toEqual(before[key]);
      }
      expect(normalized.player.equippedWeapon).toBe(normalized.player.inventory[0]);
      expect(random).not.toHaveBeenCalled();
    }
    awardXP(hero, xpForLevel(12) - hero.xp);
    prepareHeroLevelUp(hero, () => 0.35);
    const pending = hero.classProgression.pendingLevel;
    const normalized = normalizeSaveData(documentFor(hero));
    if (!normalized) throw new Error("Pending prestige save rejected");
    expect(normalized.player.classProgression.pendingLevel).toEqual(pending);
    expect(prepareNextHeroLevelUp(normalized.player, () => 0.9)).toEqual({ ok: true, pending });
    const before = structuredClone(normalized.player);
    const result = commitHeroLevelUp(normalized.player,
      { trackId: "knight", expectedTotalLevel: 11 },
      createHeroProgressionContext(() => normalized.player));
    expect(result.ok).toBe(true);
    expect(normalized.player.maxHp).toBeGreaterThan(before.maxHp);
    expect(normalized.player.classProgression.trackLevels).toEqual(before.classProgression.trackLevels);
  });
});

describe("prestige migration and corruption", () => {
  it("keeps schema19 non-prestige ownership/resources and ignores unshipped prestige flags", () => {
    const hero = prestigeFixture("prismScribe");
    const before = structuredClone(hero);
    hero.classProgression.trackLevels["prestige:prismScribe"] = 3;
    hero.classProgression.debugTrackIds = ["prestige:prismScribe"];
    hero.knownSpells.push("prismNeedle");
    const normalized = normalizeSaveData(documentFor(hero, 19));
    expect(normalized?.player.classProgression.trackLevels).toEqual({});
    expect(normalized?.player.classProgression.debugTrackIds).toEqual([]);
    expect(normalized?.player.knownSpells).toEqual(before.knownSpells);
    expect(normalized?.player.maxHp).toBe(before.maxHp);
    expect(normalized?.player.maxMp).toBe(before.maxMp);
    expect(normalized?.player.xp).toBe(before.xp);
    expect(normalized?.player.classProgression.classLevels).toEqual(before.classProgression.classLevels);
  });

  it.each([
    { "prestige:unknown": 1 }, { "prestige:prismScribe": -1 }, { "prestige:prismScribe": 1.5 },
    { "prestige:prismScribe": 6 }, { "prestige:prismScribe": "1" },
    { prismScribe: 1 }, { "prestige:prismScribe": null },
  ])("rejects irreparable path ownership %j rather than inventing gains", (trackLevels) => {
    const hero = prestigeFixture("prismScribe");
    const raw = { ...hero, classProgression: { ...hero.classProgression, trackLevels } };
    expect(normalizeHeroProgressionState(raw, SAVE_VERSION)).toBeNull();
  });

  it("rejects overcap ranks and cannot recover path actions from corrupt legacy/deferred grants", () => {
    const hero = prestigeFixture("prismScribe");
    hero.classProgression.classLevels = { wizard: 20 };
    hero.level = 20;
    hero.classProgression.trackLevels = { "prestige:prismScribe": 1 };
    expect(normalizeHeroProgressionState(hero, SAVE_VERSION)).toBeNull();
    hero.classProgression.classLevels = { wizard: 6 };
    hero.classProgression.trackLevels = {};
    hero.level = 6;
    const grants = {
      spells: PRESTIGE_SPELLS.map((entry) => entry.id),
      abilities: PRESTIGE_ABILITIES.map((entry) => entry.id),
      talents: PRESTIGE_TALENTS.map((entry) => entry.id),
    };
    hero.classProgression.legacyGrants = structuredClone(grants);
    hero.classProgression.deferredLegacyGrants = structuredClone(grants);
    hero.knownSpells.push(...grants.spells);
    hero.knownAbilities.push(...grants.abilities);
    hero.knownTalents.push(...grants.talents);
    const beforeHp = hero.maxHp;
    const normalized = normalizeHeroProgressionState(hero, SAVE_VERSION);
    expect(normalized?.classProgression.legacyGrants).toEqual({ spells: [], abilities: [], talents: [] });
    expect(normalized?.classProgression.deferredLegacyGrants).toBeUndefined();
    for (const spell of grants.spells) expect(normalized?.knownSpells).not.toContain(spell);
    for (const talent of grants.talents) expect(normalized?.knownTalents).not.toContain(talent);
    expect(normalized?.maxHp).toBe(beforeHp);
  });

  it("retains actual legacy deferred bonuses until one owned atomic rank, never load/preview", () => {
    const hero = prestigeFixture("prismScribe");
    hero.knownTalents = hero.knownTalents.filter((id) => id !== "toughness");
    hero.maxHp -= 5;
    hero.hp = hero.maxHp;
    hero.classProgression.deferredLegacyGrants = { spells: [], abilities: [], talents: ["toughness"] };
    const normalized = normalizeHeroProgressionState(hero, SAVE_VERSION);
    if (!normalized) throw new Error("Deferred fixture rejected");
    Object.assign(hero, normalized);
    expect(hero.knownTalents).not.toContain("toughness");
    const before = hero.maxHp;
    advancePrestige(hero, "prismScribe");
    expect(hero.maxHp - before).toBe(6 + 5);
    expect(hero.knownTalents.filter((id) => id === "toughness")).toHaveLength(1);
    expect(hero.classProgression.deferredLegacyGrants).toBeUndefined();
    const reloaded = normalizeHeroProgressionState(hero, SAVE_VERSION);
    expect(reloaded?.maxHp).toBe(hero.maxHp);
  });

  it("repairs bounded debug IDs and recovers a malformed primary without touching another slot", () => {
    const hero = prestigeFixture("roadglassBulwark");
    advancePrestige(hero, "roadglassBulwark");
    const normalized = normalizeHeroProgressionState({
      ...hero,
      classProgression: {
        ...hero.classProgression,
        debugTrackIds: ["prestige:roadglassBulwark", "prestige:roadglassBulwark", "prestige:unknown", 4],
      },
    }, SAVE_VERSION);
    expect(normalized?.classProgression.debugTrackIds).toEqual(["prestige:roadglassBulwark"]);
    const codex = createCodex();
    expect(saveGame(hero, new Set(), codex, hero.appearanceId).ok).toBe(true);
    expect(saveGameToSlot("manual-1", hero, new Set(), codex, hero.appearanceId).ok).toBe(true);
    const source = localStorage.getItem("2dnd_save_slot_manual-1");
    const gold = hero.gold;
    hero.gold++;
    expect(saveGame(hero, new Set(), codex, hero.appearanceId).ok).toBe(true);
    hero.classProgression.trackLevels = { "prestige:unknown": 1 };
    localStorage.setItem("2dnd_save", JSON.stringify(documentFor(hero)));
    const recovered = loadGame();
    expect(recovered?.player.classProgression.trackLevels).toEqual({ "prestige:roadglassBulwark": 1 });
    expect(recovered?.player.gold).toBe(gold);
    expect(localStorage.getItem("2dnd_save_slot_manual-1")).toBe(source);
  });

  it("preserves custom duplicate equipment links, manual source isolation and validated imports", () => {
    const hero = prestigeFixture("roadglassBulwark");
    advancePrestige(hero, "roadglassBulwark");
    const base = getItem("longSword") ?? hero.equippedWeapon;
    if (!base) throw new Error("Missing custom equipment fixture");
    const first: Item = { ...base, id: "mockRoadglassBlade", name: "Mock first blade", tags: ["first"] };
    const second: Item = { ...base, id: "mockRoadglassBlade", name: "Mock second blade", tags: ["second"] };
    hero.inventory.push(first, second);
    hero.equippedWeapon = second;
    const codex = createCodex();
    expect(saveGameToSlot("manual-1", hero, new Set(), codex, hero.appearanceId).ok).toBe(true);
    const source = localStorage.getItem("2dnd_save_slot_manual-1");
    const loaded = loadGame("manual-1");
    if (!loaded) throw new Error("Missing manual prestige snapshot");
    expect(loaded.player.equippedWeapon).toBe(loaded.player.inventory[loaded.player.inventory.length - 1]);
    expect(loaded.player.equippedWeapon?.name).toBe(second.name);
    expect(saveGame(loaded.player, new Set(), loaded.codex, hero.appearanceId).ok).toBe(true);
    expect(localStorage.getItem("2dnd_save_slot_manual-1")).toBe(source);
    const exported = exportSaveSlot("manual-1");
    if (!exported.ok) throw new Error(exported.message);
    expect(importSaveSlot("manual-2", exported.json).ok).toBe(true);
    expect(loadGame("manual-2")?.player.classProgression.trackLevels).toEqual(hero.classProgression.trackLevels);
  });
});

describe("natural prestige consumers and debug isolation", () => {
  it("derives lore and cosmetics without using them as entry authority", () => {
    const hero = prestigeFixture("rootwakeKeeper");
    const codex = createCodex();
    advancePrestige(hero, "rootwakeKeeper");
    expect(replayCodexUnlocks(codex, hero).unlockedIds).toContain("historyPrestigeRootwakeKeeper");
    expect(replayCodexUnlocks(codex, hero).unlockedIds).toEqual([]);
    const context = { player: hero, defeatedBosses: new Set<string>(), codex };
    expect(getAchievementProgress(getAchievement("prestigeInitiate"), context).complete).toBe(true);
    for (let rank = 2; rank <= 5; rank++) advancePrestige(hero, "rootwakeKeeper");
    reconcileAchievements(context, { sourceId: "mock:natural-prestige", unlockedAt: 100, notify: false });
    expect(hero.progression.achievements.unlockedTitleIds).toContain("pathkeeper");
    codex.unlockedEntryIds = [];
    hero.progression.achievements.earned = [];
    expect(getTrackLevel(hero, "prestige:rootwakeKeeper")).toBe(5);
  });

  it("inspection is pure and debug ranks cannot earn natural mastery even after later natural levels", () => {
    const hero = prestigeFixture("rootwakeKeeper");
    const before = structuredClone(hero);
    const random = vi.spyOn(Math, "random");
    random.mockClear();
    for (const command of ["list", "status", "explain rootwakeKeeper", "preview rootwakeKeeper"]) {
      expect(executePrestigeDebugCommand(hero, command).length).toBeGreaterThan(0);
    }
    expect(hero).toEqual(before);
    expect(random).not.toHaveBeenCalled();
    expect(executeProgressionDebugCommand(hero, "level prestige:rootwakeKeeper", true).changed).toBe(true);
    expect(hero.classProgression.debugTrackIds).toEqual(["prestige:rootwakeKeeper"]);
    for (let rank = 2; rank <= 5; rank++) advancePrestige(hero, "rootwakeKeeper");
    const context = { player: hero, defeatedBosses: new Set<string>(), codex: createCodex() };
    expect(getAchievementProgress(getAchievement("prestigeMaster"), context).complete).toBe(false);
    const normalized = normalizeHeroProgressionState(hero, SAVE_VERSION);
    expect(normalized?.classProgression.debugTrackIds).toEqual(["prestige:rootwakeKeeper"]);
  });
});
