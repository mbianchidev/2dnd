// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getItem } from "../src/data/items";
import { createCodex } from "../src/systems/codex";
import { createPlayer } from "../src/systems/player";
import {
  SAVE_VERSION,
  createCurrentSaveData,
  decodeStoredSave,
  deleteAllSaveSlots,
  loadGame,
  saveGame,
  type SaveData,
} from "../src/systems/save";
import {
  importSaveSlot,
  listSaveSlots,
  saveGameToSlot,
} from "../src/systems/saveSlots";
import {
  SAVE_SLOT_IDS,
  SAVE_SLOT_MIGRATION_KEY,
  getSaveSlotBackupKey,
  getSaveSlotNameKey,
  getSaveSlotStagingKey,
  getSaveSlotStorageKey,
} from "../src/systems/saveStorage";
import { createWeatherState } from "../src/systems/weather";

const STATS = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

function createCampaign(name = "Validation Hero"): SaveData {
  const player = createPlayer(name, STATS);
  return createCurrentSaveData(
    player,
    new Set(),
    createCodex(),
    player.appearanceId,
    12,
    createWeatherState(),
  );
}

function storageSnapshot(): Array<[string, string | null]> {
  const keys = [
    ...SAVE_SLOT_IDS.flatMap((slotId) => [
      getSaveSlotStorageKey(slotId),
      getSaveSlotBackupKey(slotId),
      getSaveSlotStagingKey(slotId),
      getSaveSlotNameKey(slotId),
    ]),
    SAVE_SLOT_MIGRATION_KEY,
    "2dnd_preferences",
    "2dnd_inventory_prefs",
  ];
  return keys.map((key) => [key, localStorage.getItem(key)]);
}

describe("campaign core validation", () => {
  beforeEach(() => {
    deleteAllSaveSlots();
  });

  afterEach(() => {
    deleteAllSaveSlots();
  });

  it("rejects an inventory-only player instead of creating a broken Continue option", () => {
    expect(decodeStoredSave(JSON.stringify({
      version: SAVE_VERSION,
      player: { inventory: [] },
    }))).toBeNull();
  });

  it.each([
    ["name", undefined],
    ["name", 42],
    ["name", "   "],
    ["level", "invalid"],
    ["level", 0],
    ["level", 1.5],
    ["level", 21],
    ["stats", undefined],
    ["stats", null],
    ["stats", { ...STATS, strength: "strong" }],
    ["stats", { ...STATS, dexterity: 0 }],
    ["hp", undefined],
    ["hp", -1],
    ["hp", Number.NaN],
    ["maxHp", 0],
    ["mp", "full"],
    ["mp", -1],
    ["maxMp", -1],
    ["xp", "many"],
    ["gold", -1],
    ["knownSpells", null],
    ["knownSpells", [42]],
    ["inventory", null],
  ])("rejects an unusable %s value (%j)", (field, value) => {
    const data = createCampaign();
    const malformed = {
      ...data,
      player: { ...data.player, [field]: value },
    };

    expect(decodeStoredSave(JSON.stringify(malformed))).toBeNull();
  });

  it("rejects resources above their saved capacity", () => {
    const data = createCampaign();
    expect(decodeStoredSave(JSON.stringify({
      ...data,
      player: { ...data.player, hp: data.player.maxHp + 1 },
    }))).toBeNull();
    expect(decodeStoredSave(JSON.stringify({
      ...data,
      player: { ...data.player, mp: data.player.maxMp + 1 },
    }))).toBeNull();
  });

  it("preserves usable zero resources without rerolling the campaign", () => {
    const data = createCampaign();
    data.player.hp = 0;
    data.player.mp = 0;
    data.player.maxMp = 0;
    data.player.xp = 0;
    data.player.gold = 0;

    expect(decodeStoredSave(JSON.stringify(data))).toMatchObject({
      player: { hp: 0, mp: 0, maxMp: 0, xp: 0, gold: 0 },
    });
  });

  it.each([undefined, null, -1, 1.5, "invalid", Number.NaN, Infinity])(
    "normalizes invalid playtime (%j) without changing hero authority",
    (playtimeSeconds) => {
      const data = createCampaign();
      expect(decodeStoredSave(JSON.stringify({
        ...data,
        playtimeSeconds,
      }))).toMatchObject({
        playtimeSeconds: 0,
        player: {
          name: data.player.name,
          hp: data.player.hp,
          stats: data.player.stats,
        },
      });
    },
  );

  it("normalizes hero item metadata and relinks owned equipment without mutating definitions", () => {
    const data = createCampaign();
    const weapon = getItem("startSword");
    const potion = getItem("potion");
    if (!weapon || !potion) throw new Error("Missing canonical fixture items");
    const canonicalWeapon = structuredClone(weapon);
    const canonicalPotion = structuredClone(potion);
    const normalized = decodeStoredSave(JSON.stringify({
      ...data,
      player: {
        ...data.player,
        inventory: [
          { ...weapon, effect: 999, name: 42 },
          { ...potion, name: null, tags: [42], material: "invalid" },
          { id: "unknownItem" },
        ],
        equippedWeapon: { id: weapon.id, effect: 999 },
        equippedShield: { id: "unownedShield" },
      },
    }));

    expect(normalized?.player.inventory).toEqual([canonicalWeapon, canonicalPotion]);
    expect(normalized?.player.equippedWeapon).toBe(normalized?.player.inventory[0]);
    expect(normalized?.player.equippedShield).toBeNull();
    expect(weapon).toEqual(canonicalWeapon);
    expect(potion).toEqual(canonicalPotion);
  });

  it.each(["legacy document", "slot export"])(
    "refuses a malformed %s without changing any persisted bytes",
    (format) => {
      const current = createCampaign("Safe Hero");
      expect(saveGame(
        current.player,
        new Set(),
        current.codex,
        current.appearanceId,
      ).ok).toBe(true);
      for (const slotId of SAVE_SLOT_IDS) {
        if (slotId === "autosave") continue;
        expect(saveGameToSlot(
          slotId,
          current.player,
          new Set(),
          current.codex,
          current.appearanceId,
        ).ok).toBe(true);
      }
      localStorage.setItem("2dnd_preferences", '{"mock":"preferences"}');
      localStorage.setItem("2dnd_inventory_prefs", '{"mock":"inventory"}');
      const before = storageSnapshot();
      const invalid = {
        ...current,
        player: { ...current.player, stats: null },
      };
      const document = format === "slot export"
        ? { format: "2dnd-save-slot", formatVersion: 1, save: invalid }
        : invalid;

      expect(importSaveSlot(
        "manual-1",
        JSON.stringify(document),
        true,
      )).toMatchObject({ ok: false, code: "invalid-import" });
      expect(storageSnapshot()).toEqual(before);
      expect(loadGame("manual-1")?.player.name).toBe("Safe Hero");
    },
  );

  it("recovers an unusable core from backup and preserves every other slot byte", () => {
    const data = createCampaign("Recovered Hero");
    expect(saveGameToSlot(
      "manual-1",
      data.player,
      new Set(),
      data.codex,
      data.appearanceId,
    ).ok).toBe(true);
    data.player.gold += 10;
    expect(saveGameToSlot(
      "manual-1",
      data.player,
      new Set(),
      data.codex,
      data.appearanceId,
      0,
      undefined,
      { overwrite: true },
    ).ok).toBe(true);
    const backup = localStorage.getItem(getSaveSlotBackupKey("manual-1"));
    const other = createCampaign("Other Hero");
    expect(saveGameToSlot(
      "manual-2",
      other.player,
      new Set(),
      other.codex,
      other.appearanceId,
    ).ok).toBe(true);
    localStorage.setItem(getSaveSlotStorageKey("manual-1"), JSON.stringify({
      ...data,
      player: { ...data.player, stats: null },
    }));
    const untouched = storageSnapshot().filter(
      ([key]) => !key.startsWith(getSaveSlotStorageKey("manual-1")),
    );

    expect(listSaveSlots().find(
      (slot) => slot.slotId === "manual-1",
    )).toMatchObject({ state: "valid", recovered: true });
    expect(localStorage.getItem(getSaveSlotStorageKey("manual-1"))).toBe(backup);
    expect(storageSnapshot().filter(
      ([key]) => !key.startsWith(getSaveSlotStorageKey("manual-1")),
    )).toEqual(untouched);
  });
});
