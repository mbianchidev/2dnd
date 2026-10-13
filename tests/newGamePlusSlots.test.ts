// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  copyCompletedSnapshot, createNewGamePlusSlot, inspectCampaignSlot, prepareNewGamePlus,
} from "../src/systems/newGamePlusSlots";
import { decodeStoredSave } from "../src/systems/save";
import { createCompletedCampaign } from "./helpers/campaign";

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

function seedSource() {
  const source = JSON.stringify(createCompletedCampaign());
  localStorage.setItem("2dnd_save_slot_manual-1", source);
  localStorage.setItem("2dnd_save_slot_manual-1:backup", source);
  localStorage.setItem("2dnd_save_slot_manual-1:name", "Completed fixture");
  return ["2dnd_save_slot_manual-1", "2dnd_save_slot_manual-1:backup",
    "2dnd_save_slot_manual-1:staging", "2dnd_save_slot_manual-1:name"]
    .map((key) => localStorage.getItem(key));
}

function sourceBytes() {
  return ["2dnd_save_slot_manual-1", "2dnd_save_slot_manual-1:backup",
    "2dnd_save_slot_manual-1:staging", "2dnd_save_slot_manual-1:name"]
    .map((key) => localStorage.getItem(key));
}

describe("protected NG+ source transactions", () => {
  it("does not confuse another valid lineage with a repeated creation receipt", () => {
    const bytes = seedSource();
    const prepared = prepareNewGamePlus("manual-1", "manual-2", "lineage-fixture", false, 1000);
    if (!prepared.ok) throw new Error(prepared.message);
    expect(createNewGamePlusSlot(prepared.request).ok).toBe(true);
    const child = decodeStoredSave(localStorage.getItem("2dnd_save_slot_manual-2")!);
    if (!child?.player.newGamePlus) throw new Error("Missing canonical child");
    child.player.newGamePlus.cycle = 2;
    child.player.newGamePlus.parentCycle = 1;
    const unrelated = JSON.stringify(child);
    localStorage.setItem("2dnd_save_slot_manual-2", unrelated);
    expect(createNewGamePlusSlot(prepared.request)).toMatchObject({ ok: false, code: "occupied" });
    expect(localStorage.getItem("2dnd_save_slot_manual-2")).toBe(unrelated);
    expect(sourceBytes()).toEqual(bytes);
  });

  it("surfaces a naming warning while retaining the created child and immutable source", () => {
    const bytes = seedSource();
    const prepared = prepareNewGamePlus("manual-1", "manual-2", "name-warning-fixture", false, 1000);
    if (!prepared.ok) throw new Error(prepared.message);
    const original = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => {
      if (key === "2dnd_save_slot_manual-2:name") throw new DOMException("Mock quota", "QuotaExceededError");
      original(key, value);
    });
    expect(createNewGamePlusSlot(prepared.request)).toMatchObject({
      ok: true, warning: expect.stringContaining("naming failed"),
    });
    const child = localStorage.getItem("2dnd_save_slot_manual-2");
    expect(decodeStoredSave(child!)?.player.newGamePlus?.cycle).toBe(1);
    expect(createNewGamePlusSlot(prepared.request).ok).toBe(true);
    expect(localStorage.getItem("2dnd_save_slot_manual-2")).toBe(child);
    expect(sourceBytes()).toEqual(bytes);
  });

  it("writes only the destination and keeps a played child intact on duplicate commit", () => {
    const bytes = seedSource();
    const prepared = prepareNewGamePlus("manual-1", "manual-2", "slot-fixture", false, 1000);
    if (!prepared.ok) throw new Error(prepared.message);
    expect(sourceBytes()).toEqual(bytes);
    const committed = createNewGamePlusSlot(prepared.request);
    expect(committed.ok).toBe(true);
    expect(sourceBytes()).toEqual(bytes);
    const child = decodeStoredSave(localStorage.getItem("2dnd_save_slot_manual-2")!);
    if (!child) throw new Error("Child is not valid");
    child.player.gold += 77;
    const played = JSON.stringify(child);
    localStorage.setItem("2dnd_save_slot_manual-2", played);
    expect(createNewGamePlusSlot(prepared.request).ok).toBe(true);
    expect(localStorage.getItem("2dnd_save_slot_manual-2")).toBe(played);
    expect(sourceBytes()).toEqual(bytes);
  });

  it.each(["source", "target", "name"])("rejects stale %s bytes before writing", (kind) => {
    seedSource();
    const prepared = prepareNewGamePlus("manual-1", "manual-2", "stale-fixture", false, 1000);
    if (!prepared.ok) throw new Error(prepared.message);
    if (kind === "source") localStorage.setItem("2dnd_save_slot_manual-1:staging", "{changed");
    if (kind === "name") localStorage.setItem("2dnd_save_slot_manual-1:name", "Renamed fixture");
    if (kind === "target") localStorage.setItem("2dnd_save_slot_manual-2:backup", "{occupied");
    const bytes = sourceBytes();
    const target = localStorage.getItem("2dnd_save_slot_manual-2");
    expect(createNewGamePlusSlot(prepared.request).ok).toBe(false);
    expect(sourceBytes()).toEqual(bytes);
    expect(localStorage.getItem("2dnd_save_slot_manual-2")).toBe(target);
  });

  it.each(["2dnd_save_slot_manual-2:staging", "2dnd_save_slot_manual-2"])(
    "preserves every source byte when %s fails", (failKey) => {
      const bytes = seedSource();
      const prepared = prepareNewGamePlus("manual-1", "manual-2", "quota-fixture", false, 1000);
      if (!prepared.ok) throw new Error(prepared.message);
      const original = localStorage.setItem.bind(localStorage);
      vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => {
        if (key === failKey) throw new DOMException("Mock quota", "QuotaExceededError");
        original(key, value);
      });
      expect(createNewGamePlusSlot(prepared.request)).toMatchObject({ ok: false, code: "quota" });
      expect(sourceBytes()).toEqual(bytes);
      expect(localStorage.getItem("2dnd_save_slot_manual-2")).toBeNull();
    },
  );

  it("reads a valid backup without repairing the selected source", () => {
    seedSource();
    localStorage.setItem("2dnd_save_slot_manual-1", "{broken");
    const before = sourceBytes();
    const prepared = prepareNewGamePlus("manual-1", "manual-2", "backup-fixture", false, 1000);
    if (!prepared.ok) throw new Error(prepared.message);
    expect(createNewGamePlusSlot(prepared.request).ok).toBe(true);
    expect(sourceBytes()).toEqual(before);
  });

  it("requires explicit snapshot-first selection and preserves completed Autosave until activation", () => {
    const raw = JSON.stringify(createCompletedCampaign());
    localStorage.setItem("2dnd_save", raw);
    const source = inspectCampaignSlot("autosave");
    const target = inspectCampaignSlot("manual-1");
    if (!source.ok || !target.ok) throw new Error("Cannot inspect test fixture");
    expect(copyCompletedSnapshot("manual-1", source.inspection.token, target.inspection.token, false).ok).toBe(true);
    expect(localStorage.getItem("2dnd_save")).toBe(raw);
    expect(copyCompletedSnapshot("manual-1", source.inspection.token, target.inspection.token, false).ok).toBe(true);
    const snapshot = localStorage.getItem("2dnd_save_slot_manual-1");
    const prepared = prepareNewGamePlus("manual-1", "manual-2", "snapshot-fixture", false, 1000);
    if (!prepared.ok) throw new Error(prepared.message);
    expect(createNewGamePlusSlot(prepared.request).ok).toBe(true);
    expect(localStorage.getItem("2dnd_save_slot_manual-1")).toBe(snapshot);
    expect(localStorage.getItem("2dnd_save")).toBe(raw);
    expect(prepareNewGamePlus("manual-1", "manual-1", "same").ok).toBe(false);
  });
});
