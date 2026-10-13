// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { buildNewGamePlus } from "../src/systems/newGamePlus";
import { decodeStoredSave, normalizeSaveData, SAVE_VERSION } from "../src/systems/save";
import { importSaveSlot } from "../src/systems/saveSlots";
import { inspectCampaignSlot } from "../src/systems/newGamePlusSlots";
import { createCompletedCampaign } from "./helpers/campaign";
import { playerAt, startRequest, requestFor } from "./helpers/minigames";
import { startMinigame, applyMinigameAction } from "../src/systems/minigames";
import { createCurrentSaveData } from "../src/systems/save";
import { createCodex } from "../src/systems/codex";
import { acquireBoat } from "../src/systems/nauticalOwnership";
import { createMinigameState } from "../src/systems/minigameState";

afterEach(() => localStorage.clear());

describe("NG+ authority migration and corruption", () => {
  it.each([18, 19, 20, 21, 22, 23, 24, 25, 26])(
    "migrates schema %s to normal without invented cycles or resource grants", (version) => {
      const source = createCompletedCampaign("knight", 20);
      source.version = version;
      Reflect.deleteProperty(source.player, "newGamePlus");
      const loaded = normalizeSaveData(source);
      expect(loaded?.version).toBe(SAVE_VERSION);
      expect(loaded?.player.newGamePlus).toBeNull();
      expect(loaded?.player.maxHp).toBe(source.player.maxHp);
      expect(loaded?.player.maxMp).toBe(source.player.maxMp);
      expect(loaded?.player.gold).toBe(source.player.gold);
      expect(loaded?.player.progression.quests).toEqual(source.player.progression.quests);
      expect(loaded?.player.inventory).toEqual(source.player.inventory);
    },
  );

  it.each([
    ["cycle", 0], ["cycle", 100], ["cycle", 1.5], ["parentCycle", 4],
    ["cycleId", "unrelated"], ["requestId", "../invalid"],
    ["policyVersion", 2], ["sourceFingerprint", "not-a-receipt"],
    ["createdAt", -1], ["debug", "false"], ["lifetimeRewardIds", ["madeUp"]],
  ])("rejects malformed %s without changing source or import destination", (field, value) => {
    const built = buildNewGamePlus(createCompletedCampaign(), "malformed", 1000, "1234abcd");
    if (!built.ok) throw new Error(built.message);
    Reflect.set(built.data.player.newGamePlus!, field, value);
    localStorage.setItem("2dnd_save_slot_manual-2", "untouched destination bytes");
    expect(decodeStoredSave(JSON.stringify(built.data))).toBeNull();
    expect(importSaveSlot("manual-2", JSON.stringify(built.data)).ok).toBe(false);
    expect(localStorage.getItem("2dnd_save_slot_manual-2")).toBe("untouched destination bytes");
  });

  it("falls through missing modern authority to staging without any source-repair or migration write", () => {
    const built = buildNewGamePlus(createCompletedCampaign(), "recovery", 1000, "1234abcd");
    if (!built.ok) throw new Error(built.message);
    const valid = JSON.stringify(built.data);
    const invalid = structuredClone(built.data);
    Reflect.deleteProperty(invalid.player, "newGamePlus");
    const broken = JSON.stringify(invalid);
    localStorage.setItem("2dnd_save_slot_manual-1", broken);
    localStorage.setItem("2dnd_save_slot_manual-1:staging", valid);
    const result = inspectCampaignSlot("manual-1");
    expect(result.ok && result.inspection.data?.player.newGamePlus?.cycle).toBe(1);
    expect(localStorage.getItem("2dnd_save_slot_manual-1")).toBe(broken);
    expect(localStorage.getItem("2dnd_save_slot_manual-1:staging")).toBe(valid);
    expect(localStorage.getItem("2dnd_save_slots_migrated_v1")).toBeNull();
  });
});

describe("paid activity retirement at independent cycle creation", () => {
  it.each(["willowInnTable", "willowdaleRange", "sandportRegatta"] as const)(
    "retires exact %s pending play without refund, reward, reroll or hull restoration", (venueId) => {
      const completed = createCompletedCampaign("knight", 20);
      const player = completed.player;
      player.position = playerAt(venueId).position;
      player.progression.minigames = createMinigameState(167);
      if (venueId === "sandportRegatta") acquireBoat(player.progression.nautical, "merchantSloop");
      expect(startMinigame(player, startRequest(player, venueId)).ok).toBe(true);
      if (venueId === "sandportRegatta") {
        applyMinigameAction(player, requestFor(player, { type: "sail", heading: "east" }));
      }
      const source = createCurrentSaveData(player, new Set(completed.defeatedBosses),
        createCodex(), player.appearanceId, 0);
      expect(source.player.progression.minigames.pending).not.toBeNull();
      const before = structuredClone(source);
      const built = buildNewGamePlus(source, `retire-${venueId}`, 1000, "1234abcd");
      if (!built.ok) throw new Error(built.message);
      const child = built.data.player;
      expect(child.gold).toBe(before.player.gold);
      expect(child.progression.minigames).toEqual({
        ...before.player.progression.minigames, pending: null,
        settledSequence: before.player.progression.minigames.sequence,
      });
      expect(child.progression.nautical.ownedBoats).toEqual(before.player.progression.nautical.ownedBoats);
      expect(source).toEqual(before);
    },
  );
});
