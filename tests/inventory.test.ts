// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import { getItem, type Item } from "../src/data/items";
import {
  INVENTORY_PREFERENCES_STORAGE_KEY,
  InventoryPreferenceStore,
  getInventoryCategory,
  getItemTransferRestriction,
  getItemRarity,
  moveInventorySelection,
  normalizeInventoryPreferences,
  selectInventoryItems,
  type InventoryPreferences,
} from "../src/systems/inventory";
import { createPlayer, type PlayerStats } from "../src/systems/player";

const stats: PlayerStats = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

function item(id: string): Item {
  return { ...getItem(id)! };
}

function preferences(
  overrides: Partial<InventoryPreferences> = {},
): InventoryPreferences {
  return {
    sortMode: "recent",
    filter: "all",
    search: "",
    ...overrides,
  };
}

describe("inventory selectors", () => {
  it("sorts stable immutable views without changing ownership or equipment links", () => {
    const player = createPlayer("Hero", stats);
    const originalOrder = player.inventory.map((entry) => entry.id);
    const equippedWeapon = player.equippedWeapon;
    player.inventory.push(
      item("potion"),
      item("dungeonKey"),
      item("flameBlade"),
      item("potion"),
    );

    const selected = selectInventoryItems(
      player.inventory,
      preferences({ sortMode: "name" }),
    );

    expect(selected.map((entry) => entry.item.name)).toEqual(
      [...selected.map((entry) => entry.item.name)].sort(),
    );
    expect(player.inventory.slice(0, originalOrder.length).map((entry) => entry.id))
      .toEqual(originalOrder);
    expect(player.equippedWeapon).toBe(equippedWeapon);
    expect(selected.filter((entry) => entry.item.id === "potion"))
      .toHaveLength(2);
  });

  it("supports type, value, rarity, recent, and name orderings", () => {
    const inventory = [
      item("potion"),
      item("plateArmor"),
      item("dungeonKey"),
      item("flameBlade"),
    ];

    expect(selectInventoryItems(
      inventory,
      preferences({ sortMode: "type" }),
    ).map((entry) => entry.item.id)).toEqual([
      "flameBlade",
      "plateArmor",
      "potion",
      "dungeonKey",
    ]);
    expect(selectInventoryItems(
      inventory,
      preferences({ sortMode: "value" }),
    )[0]!.item.id).toBe("plateArmor");
    expect(selectInventoryItems(
      inventory,
      preferences({ sortMode: "rarity" }),
    )[0]!.item.id).toBe("flameBlade");
    expect(selectInventoryItems(
      inventory,
      preferences({ sortMode: "recent" }),
    )[0]!.item.id).toBe("flameBlade");
    expect(selectInventoryItems(
      inventory,
      preferences({ sortMode: "name" }),
    ).map((entry) => entry.item.name)).toEqual([
      "Dungeon Key",
      "Flame Blade",
      "Healing Potion",
      "Plate Armor",
    ]);
  });

  it("filters every roadmap category and searches metadata", () => {
    const crafting: Item = {
      id: "futureOre",
      name: "Future Ore",
      description: "A future crafting material",
      type: "crafting",
      cost: 5,
      effect: 0,
    };
    const inventory = [
      item("potion"),
      item("plateArmor"),
      item("dungeonKey"),
      item("mountHorse"),
      crafting,
    ];

    expect(selectInventoryItems(
      inventory,
      preferences({ filter: "equipment" }),
    ).map((entry) => entry.item.id)).toEqual(["plateArmor"]);
    expect(selectInventoryItems(
      inventory,
      preferences({ filter: "consumable" }),
    ).map((entry) => entry.item.id)).toEqual(["potion"]);
    expect(selectInventoryItems(
      inventory,
      preferences({ filter: "quest" }),
    ).map((entry) => entry.item.id)).toEqual(["mountHorse", "dungeonKey"]);
    expect(selectInventoryItems(
      inventory,
      preferences({ filter: "crafting" }),
    ).map((entry) => entry.item.id)).toEqual(["futureOre"]);
    expect(selectInventoryItems(
      inventory,
      preferences({ search: "healing" }),
    ).map((entry) => entry.item.id)).toEqual(["potion"]);
  });

  it("classifies categories, rarity, and bounded selection deterministically", () => {
    expect(getInventoryCategory(item("plateArmor"))).toBe("equipment");
    expect(getInventoryCategory(item("mountHorse"))).toBe("quest");
    expect(getItemRarity(item("flameBlade"))).toBe("epic");
    expect(getItemRarity(item("covenantSigil"))).toBe("legendary");

    const entries = selectInventoryItems(
      [item("potion"), item("ether"), item("plateArmor")],
      preferences({ sortMode: "name" }),
    );
    expect(moveInventorySelection(entries, null, 1)).toBe(
      entries[1]!.inventoryIndex,
    );
    expect(moveInventorySelection(entries, entries[2]!.inventoryIndex, 1)).toBe(
      entries[2]!.inventoryIndex,
    );
  });

  it("reports equipped, key-item, and mount transfer restrictions by ownership", () => {
    const player = createPlayer("Hero", stats);
    const equippedWeapon = player.equippedWeapon!;
    const duplicateWeapon = { ...equippedWeapon };
    const keyItem = item("dungeonKey");
    const mount = item("mountHorse");

    expect(getItemTransferRestriction(player, equippedWeapon)).toContain(
      "currently equipped",
    );
    expect(getItemTransferRestriction(player, duplicateWeapon)).toBeNull();
    expect(getItemTransferRestriction(player, keyItem)).toContain(
      "remain with the hero",
    );
    expect(getItemTransferRestriction(player, mount)).toContain(
      "remain with the hero",
    );
  });
});

describe("inventory preferences", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("normalizes malformed values", () => {
    expect(normalizeInventoryPreferences({
      sortMode: "power",
      filter: "junk",
      search: 42,
    })).toEqual({
      sortMode: "recent",
      filter: "all",
      search: "",
    });
  });

  it("persists presentation separately from save ownership", () => {
    const store = new InventoryPreferenceStore();
    store.setSortMode("rarity");
    store.setFilter("equipment");
    store.setSearch("blade");

    expect(JSON.parse(
      localStorage.getItem(INVENTORY_PREFERENCES_STORAGE_KEY)!,
    )).toEqual({
      sortMode: "rarity",
      filter: "equipment",
      search: "blade",
    });
    expect(localStorage.getItem("2dnd_save")).toBeNull();
    expect(new InventoryPreferenceStore().get()).toEqual(store.get());
  });
});
