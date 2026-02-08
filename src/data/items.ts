/**
 * Item definitions for the game.
 */

export interface Item {
  id: string;
  name: string;
  description: string;
  type: "consumable" | "weapon" | "armor" | "shield" | "key";
  cost: number;
  effect: number; // healing amount, attack bonus, AC bonus, etc.
  twoHanded?: boolean; // weapons only — cannot equip a shield with a two-handed weapon
}

export const ITEMS: Item[] = [
  {
    id: "potion",
    name: "Healing Potion",
    description: "Restores 20 HP",
    type: "consumable",
    cost: 15,
    effect: 20,
  },
  {
    id: "ether",
    name: "Ether",
    description: "Restores 10 MP",
    type: "consumable",
    cost: 25,
    effect: 10,
  },
  {
    id: "greaterPotion",
    name: "Greater Healing Potion",
    description: "Restores 50 HP",
    type: "consumable",
    cost: 50,
    effect: 50,
  },
  {
    id: "shortSword",
    name: "Short Sword",
    description: "+2 attack damage",
    type: "weapon",
    cost: 30,
    effect: 2,
  },
  {
    id: "longSword",
    name: "Long Sword",
    description: "+4 attack damage",
    type: "weapon",
    cost: 80,
    effect: 4,
  },
  {
    id: "greatSword",
    name: "Great Sword",
    description: "+7 attack damage (two-handed)",
    type: "weapon",
    cost: 200,
    effect: 7,
    twoHanded: true,
  },
  {
    id: "leatherArmor",
    name: "Leather Armor",
    description: "+2 AC",
    type: "armor",
    cost: 25,
    effect: 2,
  },
  {
    id: "chainMail",
    name: "Chain Mail",
    description: "+4 AC",
    type: "armor",
    cost: 75,
    effect: 4,
  },
  {
    id: "plateArmor",
    name: "Plate Armor",
    description: "+6 AC",
    type: "armor",
    cost: 250,
    effect: 6,
  },
  {
    id: "woodenShield",
    name: "Wooden Shield",
    description: "+1 AC",
    type: "shield",
    cost: 20,
    effect: 1,
  },
  {
    id: "ironShield",
    name: "Iron Shield",
    description: "+2 AC",
    type: "shield",
    cost: 60,
    effect: 2,
  },
  {
    id: "towerShield",
    name: "Tower Shield",
    description: "+3 AC",
    type: "shield",
    cost: 150,
    effect: 3,
  },
  {
    id: "dungeonKey",
    name: "Dungeon Key",
    description: "Opens the sealed dungeon entrance",
    type: "key",
    cost: 100,
    effect: 0,
  },
  // --- Treasure chest unique items (not sold in shops) ---
  {
    id: "flameBlade",
    name: "Flame Blade",
    description: "+6 attack, blazing edge",
    type: "weapon",
    cost: 0,
    effect: 6,
  },
  {
    id: "shadowCloak",
    name: "Shadow Cloak",
    description: "+5 AC, woven from darkness",
    type: "armor",
    cost: 0,
    effect: 5,
  },
  {
    id: "cryptGuardian",
    name: "Crypt Guardian Shield",
    description: "+8 AC, ancient relic",
    type: "shield",
    cost: 0,
    effect: 8,
  },
  {
    id: "frostfang",
    name: "Frostfang Dagger",
    description: "+5 attack, icy bite",
    type: "weapon",
    cost: 0,
    effect: 5,
  },
];

/** Look up an item by ID. */
export function getItem(id: string): Item | undefined {
  return ITEMS.find((item) => item.id === id);
}

/** Get all items available in shops (global fallback). Excludes treasure-only items. */
export function getShopItems(): Item[] {
  return ITEMS.filter((item) => item.cost > 0);
}

/** Get shop items for a specific town by looking up its shopItems list. */
export function getShopItemsForTown(shopItemIds: string[]): Item[] {
  return shopItemIds
    .map((id) => getItem(id))
    .filter((item): item is Item => item !== undefined);
}
