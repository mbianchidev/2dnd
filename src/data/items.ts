/**
 * Item definitions for the game.
 */

export interface Item {
  id: string;
  name: string;
  description: string;
  type: "consumable" | "weapon" | "armor" | "key";
  cost: number;
  effect: number; // healing amount, attack bonus, AC bonus, etc.
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
    description: "+7 attack damage",
    type: "weapon",
    cost: 200,
    effect: 7,
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
    id: "dungeonKey",
    name: "Dungeon Key",
    description: "Opens the sealed dungeon entrance",
    type: "key",
    cost: 100,
    effect: 0,
  },
];

/** Look up an item by ID. */
export function getItem(id: string): Item | undefined {
  return ITEMS.find((item) => item.id === id);
}

/** Get all items available in shops. */
export function getShopItems(): Item[] {
  return ITEMS.filter((item) => item.type !== "key" || item.id === "dungeonKey");
}
