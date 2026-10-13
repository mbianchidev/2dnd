// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { MAIN_QUEST_ID } from "../src/data/quests";
import { decodeStoredSave, SAVE_VERSION } from "../src/systems/save";
import { buildNewGamePlus } from "../src/systems/newGamePlus";
import { createCompletedCampaign } from "./helpers/campaign";
import { SaveSlotStorageAdapter, getSaveSlotBackupKey, getSaveSlotStorageKey } from "../src/systems/saveStorage";

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe("independent New Game+ campaigns", () => {
  it("resets world authority without modifying the completed source or ownership graph", () => {
    const source = createCompletedCampaign();
    const before = structuredClone(source);
    const random = vi.spyOn(Math, "random");
    random.mockClear();
    const result = buildNewGamePlus(source, "fixture-one", 1000, "1234abcd");
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.message);
    const child = result.data;
    expect(source).toEqual(before);
    expect(random).not.toHaveBeenCalled();
    expect(child.version).toBe(SAVE_VERSION);
    expect(child.player.newGamePlus?.cycle).toBe(1);
    expect(child.player.progression.quests.quests[MAIN_QUEST_ID].status).toBe("active");
    expect(child.player.progression.quests.quests[MAIN_QUEST_ID].stage).toBe(0);
    expect(child.defeatedBosses).toEqual([]);
    expect(child.player.progression.openedChests).toEqual([]);
    expect(child.player.progression.exploredTiles).toEqual({});
    expect(child.player.progression.pendingCutsceneIds).toContain("campaign.opening");
    expect(child.player.gold).toBe(source.player.gold);
    expect(child.player.equippedWeapon).toBe(child.player.inventory[0]);
    expect(child.player.equippedWeapon).not.toBe(source.player.equippedWeapon);
    child.player.inventory[0]!.name = "Child only";
    expect(source.player.inventory[0]!.name).not.toBe("Child only");
    const decoded = decodeStoredSave(JSON.stringify(child));
    expect(decoded?.player.newGamePlus).toEqual(child.player.newGamePlus);
  });

  it("rejects a boss-only campaign and reproduces the same child for the same creation input", () => {
    const source = createCompletedCampaign();
    const incomplete = structuredClone(source);
    incomplete.player.progression.quests.quests[MAIN_QUEST_ID].status = "active";
    expect(buildNewGamePlus(incomplete, "fixture-one", 1000, "1234abcd").ok).toBe(false);
    expect(buildNewGamePlus(source, "fixture-one", 1000, "1234abcd"))
      .toEqual(buildNewGamePlus(source, "fixture-one", 1000, "1234abcd"));
  });

  it("inspects a recoverable source without writing its primary or recovery copies", () => {
    const storage = {
      getItem: vi.fn((key: string) => localStorage.getItem(key)),
      setItem: vi.fn((key: string, value: string) => localStorage.setItem(key, value)),
      removeItem: vi.fn((key: string) => localStorage.removeItem(key)),
    };
    const raw = JSON.stringify(createCompletedCampaign());
    localStorage.setItem(getSaveSlotStorageKey("manual-1"), "{broken");
    localStorage.setItem(getSaveSlotBackupKey("manual-1"), raw);
    const result = new SaveSlotStorageAdapter(storage).inspect("manual-1", decodeStoredSave);
    expect(result).toMatchObject({ ok: true, source: "backup" });
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
    expect(localStorage.getItem(getSaveSlotStorageKey("manual-1"))).toBe("{broken");
    expect(localStorage.getItem(getSaveSlotBackupKey("manual-1"))).toBe(raw);
  });
});
