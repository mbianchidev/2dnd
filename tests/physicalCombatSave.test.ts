// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { PhysicalDamageType } from "../src/data/damageTypes";
import { getMonster } from "../src/data/monsters";
import { getItem } from "../src/data/items";
import { createPlayer } from "../src/systems/player";
import {
  createCodex, discoverPhysical, getObservedPhysicalLines,
  normalizeCodexData, recordDefeat,
} from "../src/systems/codex";
import { getBodyTargetChoices } from "../src/systems/physicalCombat";
import {
  createCurrentSaveData, deleteSave, loadGame, normalizeSaveData, saveGame, SAVE_VERSION,
} from "../src/systems/save";
import { isSerializedHeroItem, heroItemsMatch } from "../src/systems/heroItemState";
import { applyMinigameAction, startMinigame } from "../src/systems/minigames";
import { prepareHeroLevelUp } from "../src/systems/classProgression";
import { awardXP, xpForLevel } from "../src/systems/player";
import { playerAt, requestFor, startRequest } from "./helpers/minigames";

const { Bludgeoning, Slashing, Piercing } = PhysicalDamageType;

function createFixture() {
  const player = createPlayer("Physical save fixture", {
    strength: 14, dexterity: 12, constitution: 12,
    intelligence: 10, wisdom: 10, charisma: 10,
  });
  const monster = getMonster("skeleton")!;
  const codex = createCodex();
  recordDefeat(codex, monster, true, ["ether"]);
  return { player, monster, codex };
}

afterEach(() => {
  vi.restoreAllMocks();
  deleteSave();
  localStorage.clear();
});

describe("physical defense discovery", () => {
  it("records whole and local observations independently and idempotently", () => {
    const { monster, codex } = createFixture();
    discoverPhysical(codex, monster, { damageType: Bludgeoning });
    discoverPhysical(codex, monster, { damageType: Piercing, bodyPartId: "head" });
    discoverPhysical(codex, monster, { damageType: Piercing, bodyPartId: "head" });
    expect(codex.entries[monster.id]!.discoveredPhysical).toEqual([
      { damageType: Bludgeoning }, { damageType: Piercing, bodyPartId: "head" },
    ]);
    expect(getObservedPhysicalLines(monster, codex.entries[monster.id]!.discoveredPhysical)).toEqual([
      "- Whole target: Weak to Bludgeoning", "- Head: Weak to Piercing",
    ]);
    const previews = getBodyTargetChoices(monster, Piercing, codex.entries[monster.id]!.discoveredPhysical);
    expect(previews.find((choice) => choice.id === "whole")!.description).toContain("Defense unknown");
    expect(previews.find((choice) => choice.id === "head")!.description).toContain("Weakness x2");
    expect(previews.find((choice) => choice.id === "legs")!.description).toContain("Defense unknown");
  });

  it("drops malformed, unknown, duplicate, neutral and mismatched part observations", () => {
    const { monster, codex } = createFixture();
    const raw: unknown = {
      ...codex, entries: {
        [monster.id]: {
          ...codex.entries[monster.id],
          discoveredPhysical: [
            null, "piercing", { damageType: "laser" },
            { damageType: Bludgeoning }, { damageType: Bludgeoning },
            { damageType: Slashing },
            { damageType: Piercing, bodyPartId: "wings" },
            { damageType: Piercing, bodyPartId: 7 },
            { damageType: Piercing, bodyPartId: "head" },
          ],
        },
      },
    };
    expect(normalizeCodexData(raw).entries[monster.id]!.discoveredPhysical).toEqual([
      { damageType: Bludgeoning }, { damageType: Piercing, bodyPartId: "head" },
    ]);
  });
});

describe("schema-v23 physical combat compatibility", () => {
  it.each([false, true])(
    "migrates v22 activity saves while retaining physical-preview observations: %s",
    (hasPhysicalPreview) => {
      const player = playerAt("willowdaleRange");
      const monster = getMonster("skeleton")!;
      const codex = createCodex();
      recordDefeat(codex, monster, true, ["ether"]);
      if (hasPhysicalPreview) discoverPhysical(codex, monster, {
        damageType: Piercing, bodyPartId: "head",
      });
      const custom = {
        ...getItem("startSword")!, id: "mockIntegratedWeapon",
        physicalDamageType: Bludgeoning, effect: 2.5,
      };
      player.inventory.push(custom);
      player.equippedWeapon = custom;
      awardXP(player, xpForLevel(2));
      expect(prepareHeroLevelUp(player, () => 0.5).ok).toBe(true);
      expect(startMinigame(player, startRequest(player, "willowdaleRange")).ok).toBe(true);
      applyMinigameAction(player, requestFor(player, { type: "aimTo", aim: 40 }));
      applyMinigameAction(player, requestFor(player, { type: "fire" }));
      const raw = createCurrentSaveData(player, new Set(["troll"]), codex, player.appearanceId, 45);
      raw.version = 22;
      if (!hasPhysicalPreview) {
        Reflect.deleteProperty(raw.codex.entries[monster.id]!, "discoveredPhysical");
      }
      const before = structuredClone(player);
      const random = vi.spyOn(Math, "random");
      random.mockClear();
      const migrated = normalizeSaveData(structuredClone(raw))!;
      expect(migrated.version).toBe(23);
      expect(migrated.player.progression.minigames).toEqual(before.progression.minigames);
      expect(migrated.player.gold).toBe(before.gold);
      expect(migrated.player.classProgression).toEqual(before.classProgression);
      expect(migrated.player.progression.quests).toEqual(before.progression.quests);
      expect(migrated.player.inventory).toEqual(before.inventory);
      expect(migrated.player.equippedWeapon)
        .toBe(migrated.player.inventory.find((item) => item.id === custom.id));
      expect(migrated.codex.entries[monster.id]!.discoveredPhysical).toEqual(
        hasPhysicalPreview ? [{ damageType: Piercing, bodyPartId: "head" }] : [],
      );
      expect(migrated.defeatedBosses).toEqual(["troll"]);
      expect(random).not.toHaveBeenCalled();
    },
  );

  it("round-trips observations and typed custom weapons while keeping exact equipment ownership", () => {
    const { player, monster, codex } = createFixture();
    const custom = {
      ...getItem("startSword")!, id: "mockWeightedSabre",
      physicalDamageType: Bludgeoning, effect: 2.5, tags: ["mock"],
    };
    player.inventory.push(custom);
    player.equippedWeapon = custom;
    discoverPhysical(codex, monster, { damageType: Bludgeoning });
    expect(saveGame(player, new Set(), codex, player.appearanceId).ok).toBe(true);
    const saved = loadGame();
    expect(saved?.version).toBe(SAVE_VERSION);
    expect(saved?.version).toBe(23);
    expect(saved?.codex.entries[monster.id]!.discoveredPhysical).toEqual([{ damageType: Bludgeoning }]);
    const restored = saved!.player.inventory.find((item) => item.id === custom.id)!;
    expect(restored).toEqual(custom);
    expect(saved!.player.equippedWeapon).toBe(restored);
  });

  it("migrates v21 without fabricating observations or rewriting old weapon metadata", () => {
    const { player, codex, monster } = createFixture();
    const legacy = { ...getItem("startSword")! };
    delete legacy.physicalDamageType;
    player.inventory = [legacy];
    player.equippedWeapon = legacy;
    const raw = createCurrentSaveData(player, new Set(["troll"]), codex, player.appearanceId, 0);
    raw.version = 21;
    raw.codex.entries[monster.id]!.discoveredPhysical = [{ damageType: Bludgeoning }];
    const migrated = normalizeSaveData(structuredClone(raw))!;
    expect(migrated.version).toBe(23);
    expect(migrated.codex.entries[monster.id]!.discoveredPhysical).toEqual([]);
    expect(migrated.codex.entries[monster.id]!.timesDefeated).toBe(1);
    expect(migrated.codex.entries[monster.id]!.itemsDropped).toEqual(["ether"]);
    expect(migrated.defeatedBosses).toEqual(["troll"]);
    expect(migrated.player.inventory).toEqual([legacy]);
    expect(migrated.player.equippedWeapon).toBe(migrated.player.inventory[0]);
    expect(migrated.player.stats).toEqual(player.stats);
    expect(migrated.player.classProgression).toEqual(player.classProgression);
    expect(migrated.player.progression.devotion).toEqual(player.progression.devotion);
  });

  it("validates weapon-only physical metadata and includes it in exact-object matching", () => {
    const weapon = { ...getItem("startSword")!, id: "mockPhysicalWeapon" };
    expect(isSerializedHeroItem({ ...weapon, physicalDamageType: "laser" })).toBe(false);
    expect(isSerializedHeroItem({ ...getItem("potion")!, physicalDamageType: Bludgeoning })).toBe(false);
    expect(isSerializedHeroItem({ ...weapon, physicalDamageType: Piercing })).toBe(true);
    expect(heroItemsMatch(weapon, { ...weapon, physicalDamageType: Piercing })).toBe(false);
  });
});
