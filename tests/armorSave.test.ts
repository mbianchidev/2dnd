// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { getArmorPhysicalProfile, getItem } from "../src/data/items";
import { PhysicalDamageType } from "../src/data/damageTypes";
import { getMonster } from "../src/data/monsters";
import { createCodex, discoverPhysical, recordDefeat } from "../src/systems/codex";
import { heroItemsMatch, isSerializedHeroItem, normalizeSerializedHeroItem } from "../src/systems/heroItemState";
import {
  createCurrentSaveData, loadGame, normalizeSaveData, saveGame, SAVE_VERSION,
} from "../src/systems/save";
import { importSaveSlot, saveGameToSlot } from "../src/systems/saveSlots";
import { createPlayer } from "../src/systems/player";
import { applyMinigameAction, startMinigame } from "../src/systems/minigames";
import { playerAt, requestFor, startRequest } from "./helpers/minigames";

const { Bludgeoning, Slashing, Piercing } = PhysicalDamageType;

function fixture() {
  return createPlayer("Armor save fixture", {
    strength: 12, dexterity: 12, constitution: 12,
    intelligence: 12, wisdom: 12, charisma: 12,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("schema-v24 armor ownership", () => {
  it("preserves custom resistance metadata, append order and exact same-ID equipped armor", () => {
    const player = fixture();
    const first = {
      ...getItem("chainMail")!, id: "mockCustomArmor",
      physicalResistances: [Piercing], effect: 2.5,
      tags: ["mock", "first"],
    };
    const second = { ...first, physicalResistances: [Bludgeoning] };
    player.inventory.push(first, second);
    player.equippedArmor = second;
    const before = structuredClone(player.inventory);
    expect(heroItemsMatch(first, second)).toBe(false);
    expect(saveGame(player, new Set(), createCodex(), player.appearanceId).ok).toBe(true);
    const saved = loadGame()!;
    expect(saved.version).toBe(SAVE_VERSION);
    expect(saved.player.inventory).toEqual(before);
    expect(saved.player.equippedArmor).toBe(saved.player.inventory[saved.player.inventory.length - 1]);
    expect(getArmorPhysicalProfile(saved.player.equippedArmor)).toEqual({ resistances: [Bludgeoning] });
  });

  it("migrates v23 armor without rewriting it or rerolling exact pending activities and discoveries", () => {
    const player = playerAt("willowdaleRange");
    const oldArmor = { ...getItem("chainMail")! };
    delete oldArmor.physicalResistances;
    player.inventory.push(oldArmor);
    player.equippedArmor = oldArmor;
    startMinigame(player, startRequest(player, "willowdaleRange"));
    applyMinigameAction(player, requestFor(player, { type: "aimTo", aim: 40 }));
    applyMinigameAction(player, requestFor(player, { type: "fire" }));
    const codex = createCodex();
    const monster = getMonster("skeleton")!;
    recordDefeat(codex, monster, true, []);
    discoverPhysical(codex, monster, { damageType: Piercing, bodyPartId: "head" });
    const raw = createCurrentSaveData(player, new Set(["troll"]), codex, player.appearanceId, 45);
    raw.version = 23;
    const before = structuredClone(player);
    const random = vi.spyOn(Math, "random");
    random.mockClear();
    const restored = normalizeSaveData(structuredClone(raw))!;
    expect(restored.version).toBe(SAVE_VERSION);
    expect(restored.player.inventory).toEqual(before.inventory);
    expect(restored.player.equippedArmor).toBe(restored.player.inventory[restored.player.inventory.length - 1]);
    expect(restored.player.equippedArmor?.physicalResistances).toBeUndefined();
    expect(getArmorPhysicalProfile(restored.player.equippedArmor)).toEqual({ resistances: [Slashing] });
    expect(restored.player.gold).toBe(before.gold);
    expect(restored.player.classProgression).toEqual(before.classProgression);
    expect(restored.player.progression.minigames).toEqual(before.progression.minigames);
    expect(restored.player.progression.devotion).toEqual(before.progression.devotion);
    expect(restored.codex.entries[monster.id]!.discoveredPhysical).toEqual([
      { damageType: Piercing, bodyPartId: "head" },
    ]);
    expect(random).not.toHaveBeenCalled();
  });

  it.each([
    null, "slashing", ["laser"], [Piercing, Piercing], [Bludgeoning, Slashing, Piercing, Slashing], [1],
  ])("rejects malformed custom armor defenses without silently deleting ownership: %j", (physicalResistances) => {
    const custom = {
      ...getItem("chainMail")!, id: "mockInvalidArmor", physicalResistances,
    };
    expect(isSerializedHeroItem(custom)).toBe(false);
    expect(normalizeSerializedHeroItem(custom)).toBeNull();
    const player = fixture();
    const codex = createCodex();
    expect(saveGameToSlot("manual-1", player, new Set(), codex, player.appearanceId).ok).toBe(true);
    const bytes = localStorage.getItem("2dnd_save_slot_manual-1");
    const save = createCurrentSaveData(player, new Set(), codex, player.appearanceId, 0);
    const invalid: unknown = {
      ...save,
      player: { ...save.player, inventory: [custom], equippedArmor: custom },
    };
    expect(normalizeSaveData(invalid)).toBeNull();
    const result = importSaveSlot("manual-1", JSON.stringify({
      format: "2dnd-save-slot", formatVersion: 1, name: "Invalid fixture", save: invalid,
    }));
    expect(result.ok).toBe(false);
    expect(localStorage.getItem("2dnd_save_slot_manual-1")).toBe(bytes);
  });

  it("restricts resistance metadata to armor and repairs malformed known gear through the normal item guard", () => {
    expect(isSerializedHeroItem({ ...getItem("potion")!, physicalResistances: [Piercing] })).toBe(false);
    expect(isSerializedHeroItem({ ...getItem("startSword")!, physicalResistances: [Piercing] })).toBe(false);
    expect(normalizeSerializedHeroItem({ ...getItem("chainMail")!, physicalResistances: ["laser"] }))
      .toEqual(getItem("chainMail"));
    const empty = { ...getItem("chainMail")!, physicalResistances: [] };
    expect(normalizeSerializedHeroItem(empty)).toEqual(empty);
    expect(getArmorPhysicalProfile(empty)).toEqual({ resistances: [] });
  });
});
