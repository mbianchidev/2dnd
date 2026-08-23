// @vitest-environment happy-dom

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createCodex } from "../src/systems/codex";
import { createPlayer, type PlayerState } from "../src/systems/player";
import {
  SAVE_VERSION,
  deleteAllSaveSlots,
  deleteSave,
  loadGame,
  saveGame,
} from "../src/systems/save";
import {
  copySaveSlot,
  exportSaveSlot,
  getSaveSlotStorageKey,
  importSaveSlot,
  listSaveSlots,
  renameSaveSlot,
  saveGameToSlot,
} from "../src/systems/saveSlots";
import {
  LEGACY_SAVE_STORAGE_KEY,
  SAVE_SLOT_MIGRATION_KEY,
  getSaveSlotBackupKey,
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

function createTestPlayer(name: string, classId = "knight"): PlayerState {
  return createPlayer(name, STATS, classId);
}

describe("multiple save slots", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T12:00:00Z"));
    deleteAllSaveSlots();
  });

  afterEach(() => {
    deleteAllSaveSlots();
    vi.useRealTimers();
  });

  it("migrates a legacy schema-v17 document into the verified autosave layout once", () => {
    const player = createTestPlayer("Legacy Hero");
    saveGame(player, new Set(), createCodex(), player.appearanceId);
    const current = JSON.parse(
      localStorage.getItem(LEGACY_SAVE_STORAGE_KEY)!,
    ) as Record<string, unknown>;
    current.version = 17;
    delete current.playtimeSeconds;
    const legacy = JSON.stringify(current);
    deleteAllSaveSlots();
    localStorage.setItem(LEGACY_SAVE_STORAGE_KEY, legacy);

    const slots = listSaveSlots();

    expect(slots[0]).toMatchObject({
      slotId: "autosave",
      state: "valid",
      metadata: {
        characterName: "Legacy Hero",
        schemaVersion: SAVE_VERSION,
        playtimeSeconds: 0,
      },
    });
    expect(localStorage.getItem(LEGACY_SAVE_STORAGE_KEY)).toBe(legacy);
    expect(localStorage.getItem(getSaveSlotBackupKey("autosave"))).toBe(legacy);
    expect(localStorage.getItem(SAVE_SLOT_MIGRATION_KEY)).toBe("verified");

    listSaveSlots();
    expect(localStorage.getItem(getSaveSlotBackupKey("autosave"))).toBe(legacy);
  });

  it("derives complete metadata and keeps manual snapshots isolated", () => {
    const player = createTestPlayer("Slot Hero", "wizard");
    player.position.inCity = true;
    player.position.cityId = "willowdale_city";
    player.gold = 10;
    expect(saveGame(
      player,
      new Set(),
      createCodex(),
      player.appearanceId,
      12,
      createWeatherState(),
    ).ok).toBe(true);
    vi.advanceTimersByTime(125_000);
    player.gold = 25;
    expect(saveGameToSlot(
      "manual-1",
      player,
      new Set(),
      createCodex(),
      player.appearanceId,
      12,
      createWeatherState(),
      { name: "Before the road" },
    ).ok).toBe(true);

    const slots = listSaveSlots();
    expect(slots.find((slot) => slot.slotId === "manual-1")).toMatchObject({
      state: "valid",
      displayName: "Before the road",
      metadata: {
        characterName: "Slot Hero",
        classId: "wizard",
        className: "Wizard",
        level: 1,
        location: "Willowdale",
        campaignStatus: "Prologue",
        schemaVersion: SAVE_VERSION,
        playtimeSeconds: 125,
      },
    });
    expect(loadGame("autosave")?.player.gold).toBe(10);
    expect(loadGame("manual-1")?.player.gold).toBe(25);
  });

  it("requires overwrite, then supports rename, copy, and isolated deletion", () => {
    const first = createTestPlayer("First");
    const second = createTestPlayer("Second");
    expect(saveGameToSlot(
      "manual-1",
      first,
      new Set(),
      createCodex(),
      first.appearanceId,
    ).ok).toBe(true);

    expect(saveGameToSlot(
      "manual-1",
      second,
      new Set(),
      createCodex(),
      second.appearanceId,
    )).toMatchObject({ ok: false, code: "occupied" });
    expect(saveGameToSlot(
      "manual-1",
      second,
      new Set(),
      createCodex(),
      second.appearanceId,
      0,
      undefined,
      { overwrite: true },
    ).ok).toBe(true);
    expect(renameSaveSlot("manual-1", "  Final keep  ")).toMatchObject({
      ok: true,
    });
    expect(copySaveSlot("manual-1", "manual-2")).toMatchObject({ ok: true });
    expect(deleteSave("manual-1")).toMatchObject({ ok: true });

    expect(listSaveSlots()).toEqual(expect.arrayContaining([
      expect.objectContaining({ slotId: "manual-1", state: "empty" }),
      expect.objectContaining({
        slotId: "manual-2",
        state: "valid",
        displayName: "Copy of Final keep",
      }),
    ]));
    expect(loadGame("manual-2")?.player.name).toBe("Second");
  });

  it("recovers one corrupt slot from backup without affecting another slot", () => {
    const first = createTestPlayer("First");
    const second = createTestPlayer("Second");
    const originalGold = first.gold;
    saveGameToSlot(
      "manual-1",
      first,
      new Set(),
      createCodex(),
      first.appearanceId,
    );
    first.gold = 99;
    saveGameToSlot(
      "manual-1",
      first,
      new Set(),
      createCodex(),
      first.appearanceId,
      0,
      undefined,
      { overwrite: true },
    );
    saveGameToSlot(
      "manual-2",
      second,
      new Set(),
      createCodex(),
      second.appearanceId,
    );
    localStorage.setItem(getSaveSlotStorageKey("manual-1"), "{broken");

    const slots = listSaveSlots();

    expect(slots.find((slot) => slot.slotId === "manual-1")).toMatchObject({
      state: "valid",
      recovered: true,
    });
    expect(loadGame("manual-1")?.player.gold).toBe(originalGold);
    expect(loadGame("manual-2")?.player.name).toBe("Second");
  });

  it("exports deterministically and validates imports through schema migration", () => {
    const player = createTestPlayer("Portable");
    saveGameToSlot(
      "manual-1",
      player,
      new Set(["cryptLich"]),
      createCodex(),
      player.appearanceId,
      42,
      createWeatherState(),
      { name: "Portable run" },
    );

    const first = exportSaveSlot("manual-1");
    const second = exportSaveSlot("manual-1");
    expect(first).toMatchObject({ ok: true, fileName: "2dnd-portable-run.json" });
    expect(second).toEqual(first);
    if (!first.ok) throw new Error(first.message);

    expect(importSaveSlot("manual-2", first.json)).toMatchObject({ ok: true });
    expect(loadGame("manual-2")).toMatchObject({
      version: SAVE_VERSION,
      player: { name: "Portable" },
      defeatedBosses: ["cryptLich"],
      timeStep: 42,
    });
    expect(importSaveSlot("manual-3", "{broken")).toMatchObject({
      ok: false,
      code: "invalid-import",
    });
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      "Save error",
    );

    const unsupported = JSON.parse(first.json) as {
      save: Record<string, unknown>;
    };
    unsupported.save.version = SAVE_VERSION + 1;
    expect(importSaveSlot("manual-3", JSON.stringify(unsupported))).toMatchObject({
      ok: false,
      code: "invalid-import",
    });
    expect(saveGame(
      player,
      new Set(),
      createCodex(),
      player.appearanceId,
    ).ok).toBe(true);
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it("reports an unrecoverable malformed slot without hiding valid campaigns", () => {
    const player = createTestPlayer("Safe");
    saveGameToSlot(
      "manual-2",
      player,
      new Set(),
      createCodex(),
      player.appearanceId,
    );
    localStorage.setItem(getSaveSlotStorageKey("manual-1"), "{broken");

    expect(listSaveSlots()).toEqual(expect.arrayContaining([
      expect.objectContaining({ slotId: "manual-1", state: "corrupt" }),
      expect.objectContaining({ slotId: "manual-2", state: "valid" }),
    ]));
  });
});
