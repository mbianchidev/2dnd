// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import {
  GamePreferencesStore,
  normalizeGamePreferences,
} from "../src/systems/accessibility";
import { createCodex } from "../src/systems/codex";
import {
  InventoryPreferenceStore,
  normalizeInventoryPreferences,
} from "../src/systems/inventory";
import { createPlayer } from "../src/systems/player";
import {
  SAVE_VERSION,
  deleteAllSaveSlots,
  deleteSave,
  hasSave,
  loadGame,
  saveGame,
} from "../src/systems/save";
import {
  copySaveSlot,
  exportSaveSlot,
  importSaveSlot,
  listSaveSlots,
  renameSaveSlot,
  saveGameToSlot,
} from "../src/systems/saveSlots";
import { SAVE_SLOT_IDS } from "../src/systems/saveStorage";

function withDeniedStorage(operation: () => void): void {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  if (!descriptor) throw new Error("Test storage descriptor is missing");
  const error = new Error("Mock browser storage is blocked");
  error.name = "SecurityError";
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get: () => { throw error; },
  });
  try {
    operation();
  } finally {
    Object.defineProperty(globalThis, "localStorage", descriptor);
  }
}

describe("unavailable browser storage", () => {
  beforeEach(() => {
    deleteAllSaveSlots();
    document.getElementById("save-storage-alert")?.remove();
  });

  it("reports save and management failures instead of throwing from the storage getter", () => {
    const player = createPlayer("Offline Hero", {
      strength: 10, dexterity: 10, constitution: 10,
      intelligence: 10, wisdom: 10, charisma: 10,
    });
    const codex = createCodex();

    withDeniedStorage(() => {
      expect(saveGame(
        player,
        new Set(),
        codex,
        player.appearanceId,
      )).toMatchObject({ ok: false, code: "unavailable" });
      expect(document.getElementById("save-storage-alert")?.textContent)
        .toContain("storage is unavailable");
      expect(saveGameToSlot(
        "manual-1",
        player,
        new Set(),
        codex,
        player.appearanceId,
      )).toMatchObject({ ok: false, code: "unavailable" });
      expect(deleteSave("manual-1")).toMatchObject({
        ok: false,
        code: "unavailable",
      });
      expect(renameSaveSlot("manual-1", "Offline")).toMatchObject({
        ok: false,
        code: "unavailable",
      });
      expect(copySaveSlot("manual-1", "manual-2").ok).toBe(false);
      expect(exportSaveSlot("manual-1").ok).toBe(false);
      expect(importSaveSlot("manual-1", JSON.stringify({
        version: SAVE_VERSION,
        player,
      }))).toMatchObject({ ok: false, code: "unavailable" });
    });
  });

  it("keeps title reads usable and lists each slot as unavailable", () => {
    withDeniedStorage(() => {
      expect(loadGame()).toBeNull();
      expect(hasSave()).toBe(false);
      expect(listSaveSlots()).toEqual(SAVE_SLOT_IDS.map((slotId) =>
        expect.objectContaining({ slotId, state: "unavailable" })
      ));
    });
  });

  it("keeps audio/accessibility preferences usable in memory without touching campaigns", () => {
    localStorage.setItem("2dnd_save", "mock campaign bytes");
    localStorage.setItem("2dnd_preferences", "mock preference bytes");

    withDeniedStorage(() => {
      const store = new GamePreferencesStore();
      expect(store.get()).toEqual(normalizeGamePreferences(undefined));
      store.setReducedMotion(true);
      store.setAudio({ muted: true });
      expect(store.getAccessibility().reducedMotion).toBe(true);
      expect(store.getAudio().muted).toBe(true);
      store.reload();
      expect(store.get()).toEqual(normalizeGamePreferences(undefined));
    });

    expect(localStorage.getItem("2dnd_save")).toBe("mock campaign bytes");
    expect(localStorage.getItem("2dnd_preferences")).toBe("mock preference bytes");
  });

  it("keeps inventory preferences usable in memory when the storage getter is denied", () => {
    localStorage.setItem("2dnd_inventory_prefs", "mock inventory preference bytes");

    withDeniedStorage(() => {
      const store = new InventoryPreferenceStore();
      expect(store.get()).toEqual(normalizeInventoryPreferences(undefined));
      store.setSearch("blade");
      store.setSortMode("name");
      expect(store.get()).toMatchObject({ search: "blade", sortMode: "name" });
      store.reload();
      expect(store.get()).toEqual(normalizeInventoryPreferences(undefined));
    });

    expect(localStorage.getItem("2dnd_inventory_prefs"))
      .toBe("mock inventory preference bytes");
  });
});
