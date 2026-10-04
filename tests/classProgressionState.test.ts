// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { BASE_CLASS_IDS, BASE_CLASS_PROFILES } from "../src/data/classProgression";
import {
  commitHeroLevelUp, getTotalLevel, prepareHeroLevelUp, previewHeroLevelUp,
} from "../src/systems/classProgression";
import { normalizeHeroClassProgression } from "../src/systems/classProgressionState";
import {
  awardXP, createPlayer, processPendingLevelUps, xpForLevel,
} from "../src/systems/player";
import { loadGame, normalizeSaveData, saveGame, SAVE_VERSION } from "../src/systems/save";
import { createCodex } from "../src/systems/codex";
import { getItem } from "../src/data/items";

const stats = {
  strength: 15, dexterity: 15, constitution: 14,
  intelligence: 15, wisdom: 15, charisma: 15,
};

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("multiclass persistence", () => {
  it.each(BASE_CLASS_IDS)("migrates every level 1-20 %s hero without replay or loss", (id) => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const player = createPlayer("Legacy fixture", stats, id);
    for (let level = 1; level <= 20; level++) {
      if (level > 1) {
        awardXP(player, xpForLevel(level) - player.xp);
        processPendingLevelUps(player);
      }
      const legacy = JSON.parse(JSON.stringify(player)) as Record<string, unknown>;
      delete legacy["classProgression"];
      const expected = structuredClone(player);
      const random = vi.spyOn(Math, "random");
      random.mockClear();
      const normalized = normalizeSaveData({
        version: 18, player: legacy, codex: createCodex(),
        defeatedBosses: [], appearanceId: id, timestamp: 100,
      });
      if (!normalized) throw new Error("Legacy migration rejected");
      expect(normalized.player.classProgression.classLevels).toEqual({ [id]: level });
      expect(normalized.player.classProgression.startingClassId).toBe(id);
      for (const key of [
        "level", "xp", "hp", "maxHp", "mp", "maxMp", "stats",
        "pendingStatPoints", "pendingLevelUps", "knownSpells",
        "knownAbilities", "knownTalents", "inventory",
      ] as const) {
        expect(normalized.player[key]).toEqual(expected[key]);
      }
      expect(normalized.player.equippedWeapon).toBe(normalized.player.inventory[0]);
      expect(random).not.toHaveBeenCalled();
    }
  });

  it("preserves frozen previews and linked equipment across save/reload", () => {
    const player = createPlayer("Hybrid fixture", stats);
    const armor = { ...getItem("plateArmor")! };
    player.inventory.push(armor);
    player.equippedArmor = armor;
    awardXP(player, xpForLevel(4));
    prepareHeroLevelUp(player, () => 0.2);
    expect(commitHeroLevelUp(player, {
      trackId: "wizard", expectedTotalLevel: 1,
    }).ok).toBe(true);
    prepareHeroLevelUp(player, () => 0.8);
    const preview = previewHeroLevelUp(player, "paladin");
    const before = structuredClone(player.classProgression);
    expect(saveGame(player, new Set(), createCodex(), player.appearanceId).ok).toBe(true);
    const loaded = loadGame();
    if (!loaded) throw new Error("Cannot reload hybrid");
    expect(loaded.player.classProgression).toEqual(before);
    expect(previewHeroLevelUp(loaded.player, "paladin")).toEqual(preview);
    expect(loaded.player.equippedArmor).toBe(
      loaded.player.inventory.find((item) => item.id === armor.id),
    );
    expect(commitHeroLevelUp(loaded.player, {
      trackId: "paladin", expectedTotalLevel: 2,
    }).ok).toBe(true);
    const committed = structuredClone(loaded.player);
    expect(commitHeroLevelUp(loaded.player, {
      trackId: "paladin", expectedTotalLevel: 2,
    }).ok).toBe(false);
    expect(loaded.player).toEqual(committed);
  });

  it("retains canonical legacy exceptions without applying resource bonuses again", () => {
    const player = createPlayer("Legacy grants fixture", stats);
    player.knownSpells.push("meteorSwarm");
    player.knownAbilities.push("rage");
    player.knownTalents.push("arcaneWard");
    player.maxMp += 5;
    const raw = JSON.parse(JSON.stringify(player)) as Record<string, unknown>;
    delete raw["classProgression"];
    const normalized = normalizeSaveData({
      version: 18, player: raw, codex: createCodex(),
      defeatedBosses: [], appearanceId: "knight", timestamp: 100,
    });
    expect(normalized?.player.classProgression.legacyGrants).toEqual({
      spells: ["meteorSwarm"], abilities: ["rage"], talents: ["arcaneWard"],
    });
    expect(normalized?.player.maxMp).toBe(player.maxMp);
    const again = normalizeSaveData(structuredClone(normalized));
    expect(again?.player.knownSpells).toEqual(player.knownSpells);
    expect(again?.player.maxMp).toBe(player.maxMp);
  });

  it("normalizes canonical known actions without reapplying talents", () => {
    const player = createPlayer("Corrupt grants fixture", stats);
    awardXP(player, xpForLevel(4));
    processPendingLevelUps(player);
    const oldHp = player.maxHp;
    player.knownSpells = ["fireball", "unknown", "fireball"];
    player.knownAbilities = ["shieldBash", "unknown", "shieldBash"];
    player.knownTalents.push("toughness", "unknown");
    const normalized = normalizeSaveData({
      version: SAVE_VERSION, player, codex: createCodex(),
      defeatedBosses: [], appearanceId: player.appearanceId, timestamp: 100,
    });
    expect(normalized?.player.knownSpells).toEqual([]);
    expect(normalized?.player.knownAbilities.filter((id) => id === "shieldBash")).toHaveLength(1);
    expect(normalized?.player.knownTalents.filter((id) => id === "toughness")).toHaveLength(1);
    expect(normalized?.player.knownTalents).not.toContain("unknown");
    expect(normalized?.player.maxHp).toBe(oldHp);
  });

  it.each([
    { expectedTotalLevel: 0, resourceRoll: 0.5, constitution: 14, intelligence: 15 },
    { expectedTotalLevel: 1, resourceRoll: 1, constitution: 14, intelligence: 15 },
    { expectedTotalLevel: 1, resourceRoll: NaN, constitution: 14, intelligence: 15 },
    { expectedTotalLevel: 1, resourceRoll: 0.5, constitution: -1, intelligence: 15 },
  ])("discards a malformed receipt without consuming earned levels", (pendingLevel) => {
    const player = createPlayer("Receipt fixture", stats);
    awardXP(player, xpForLevel(2));
    Object.assign(player.classProgression, { pendingLevel });
    const normalized = normalizeSaveData({
      version: SAVE_VERSION, player, codex: createCodex(),
      defeatedBosses: [], appearanceId: player.appearanceId, timestamp: 100,
    });
    expect(normalized?.player.classProgression.pendingLevel).toBeNull();
    expect(normalized?.player.pendingLevelUps).toBe(1);
    expect(normalized?.player.maxHp).toBe(player.maxHp);
  });

  it("repairs inconsistent totals and bounded pending/ASI resources", () => {
    const player = createPlayer("Bounds fixture", stats);
    player.level = 999;
    player.classProgression.classLevels = { knight: 3, wizard: 2 };
    player.pendingLevelUps = 999;
    player.pendingStatPoints = 999;
    player.xp = xpForLevel(30);
    player.hp = 999;
    player.mp = -1;
    const normalized = normalizeSaveData({
      version: SAVE_VERSION, player, codex: createCodex(),
      defeatedBosses: [], appearanceId: player.appearanceId, timestamp: 100,
    });
    expect(normalized?.player.level).toBe(5);
    expect(normalized && getTotalLevel(normalized.player)).toBe(5);
    expect(normalized?.player.pendingLevelUps).toBe(15);
    expect(normalized?.player.pendingStatPoints).toBe(2);
    expect(normalized?.player.hp).toBe(player.maxHp);
    expect(normalized?.player.mp).toBe(0);
  });
});

describe("unknown class record normalization", () => {
  it.each([undefined, null, [], "invalid", { classLevels: {} }])(
    "recovers unusable ownership from legacy identity and level",
    (raw) => {
      expect(normalizeHeroClassProgression(raw, {
        appearanceId: "wizard", level: 12,
      }).classLevels).toEqual({ wizard: 12 });
    },
  );

  it("rejects unknown/non-integer ranks and trims ownership at 20", () => {
    const normalized = normalizeHeroClassProgression({
      startingClassId: "wizard",
      classLevels: { wizard: 2, knight: 50, cleric: 2.5, druid: -1, unknown: 8 },
      trackLevels: { "prestige:unknown": 5 },
    }, { appearanceId: "rogue", level: 3 });
    expect(normalized.startingClassId).toBe("wizard");
    expect(normalized.classLevels).toEqual({ wizard: 2, knight: 18 });
    expect(normalized.trackLevels).toEqual({});
    expect(normalized.pendingLevel).toBeNull();
  });

  it("preserves recognized earned tracks without live prerequisite checks", () => {
    const base = BASE_CLASS_PROFILES[0];
    const context = { profiles: [...BASE_CLASS_PROFILES, {
      ...base, id: "prestige:testPath" as const, kind: "prestige" as const, maxRank: 5,
    }] };
    const normalized = normalizeHeroClassProgression({
      startingClassId: "knight",
      classLevels: { knight: 7, wizard: 2 },
      trackLevels: { "prestige:testPath": 3 },
    }, { appearanceId: "barbarian", level: 1 }, context);
    expect(normalized.classLevels).toEqual({ knight: 7, wizard: 2 });
    expect(normalized.trackLevels).toEqual({ "prestige:testPath": 3 });
  });
});
