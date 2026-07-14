import { describe, expect, it } from "vitest";
import {
  COMPANION_DEFINITIONS,
  COMPANION_IDS,
  getCompanionDefinition,
} from "../src/data/companions";
import { getItem } from "../src/data/items";
import { getPlayerClass } from "../src/systems/classes";
import { calculatePointsSpent } from "../src/systems/player";

describe("companion definitions", () => {
  it("defines the three stable companion IDs exactly once", () => {
    expect(COMPANION_IDS).toEqual(["guardian", "scout", "mystic"]);
    expect(COMPANION_DEFINITIONS.map((definition) => definition.id)).toEqual(
      COMPANION_IDS,
    );
  });

  it("uses valid classes and 27-point-buy base stats", () => {
    for (const definition of COMPANION_DEFINITIONS) {
      expect(getPlayerClass(definition.classId).id).toBe(definition.classId);
      expect(calculatePointsSpent(definition.baseStats)).toBe(27);
    }
  });

  it("uses valid independent loadout item IDs and ascending tiers", () => {
    for (const definition of COMPANION_DEFINITIONS) {
      expect(definition.loadouts.map((loadout) => loadout.minLevel)).toEqual(
        [1, 5, 9, 13, 17],
      );
      for (const loadout of definition.loadouts) {
        for (const itemId of loadout.itemIds) {
          expect(getItem(itemId), `${definition.id}:${itemId}`).toBeDefined();
        }
        for (const equippedId of [
          loadout.equippedWeaponId,
          loadout.equippedArmorId,
          loadout.equippedShieldId,
        ]) {
          if (equippedId) expect(loadout.itemIds).toContain(equippedId);
        }
      }
    }
  });

  it("looks up definitions without exposing an unknown companion", () => {
    expect(getCompanionDefinition("guardian")?.name).toBeTruthy();
    expect(getCompanionDefinition("unknown")).toBeUndefined();
  });
});
