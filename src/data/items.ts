/**
 * Item definitions for the game.
 */

import { Element } from "./elements";
import type {
  GatheringDiscipline,
  GatheringRarity,
  RecipeInputContract,
} from "./gathering";

export type WeaponSpriteType = "sword" | "staff" | "dagger" | "bow" | "mace" | "axe" | "fist";
export type ConsumableTargetType = "self" | "single_ally";

export interface Item {
  id: string;
  name: string;
  description: string;
  type:
    | "consumable"
    | "weapon"
    | "armor"
    | "shield"
    | "key"
    | "mount"
    | "crafting";
  cost: number;
  effect: number; // healing amount, attack bonus, AC bonus, etc.
  twoHanded?: boolean; // weapons only — cannot equip a shield with a two-handed weapon
  light?: boolean; // weapons only — can be used for Two-Weapon Fighting (dual wield)
  finesse?: boolean; // weapons only — can use DEX instead of STR for attack and damage
  /** Visual weapon type for sprite rendering (weapons only). */
  weaponSprite?: WeaponSpriteType;
  levelReq?: number; // minimum player level to purchase
  mountId?: string; // for type "mount" — references a MountData id
  /** Elemental damage type for weapons. */
  element?: Element;
  /** Whether the consumable cures status effects tied to its ID. */
  cureEffects?: boolean;
  /** Passive bonus to nearby dungeon-trap detection checks. */
  trapDetectionBonus?: number;
  /** Passive bonus to dungeon-trap disarm checks. */
  trapDisarmBonus?: number;
  /** Battle target scope for consumables; defaults to self. */
  targetType?: ConsumableTargetType;
  /** Whether this consumable restores MP instead of HP. */
  restoresMp?: boolean;
  /** Searchable canonical tags for inventory and future recipe selection. */
  tags?: readonly string[];
  /** Stable material identity consumed by future crafting recipes (#56). */
  material?: {
    readonly resourceId: string;
    readonly discipline: GatheringDiscipline;
    readonly rarity: GatheringRarity;
    readonly recipeInput: RecipeInputContract;
  };
}

export const ITEMS: Item[] = [
  {
    id: "potion",
    name: "Healing Potion",
    description: "Restores 20 HP",
    type: "consumable",
    cost: 15,
    effect: 20,
    targetType: "single_ally",
  },
  {
    id: "ether",
    name: "Ether",
    description: "Restores 10 MP",
    type: "consumable",
    cost: 25,
    effect: 10,
    targetType: "single_ally",
  },
  {
    id: "greaterPotion",
    name: "Greater Healing Potion",
    description: "Restores 50 HP",
    type: "consumable",
    cost: 50,
    effect: 50,
    levelReq: 5,
    targetType: "single_ally",
  },
  {
    id: "antidote",
    name: "Antidote",
    description: "Cures poison",
    type: "consumable",
    cost: 20,
    effect: 0,
    cureEffects: true,
    targetType: "single_ally",
  },
  {
    id: "burnSalve",
    name: "Burn Salve",
    description: "Cures burns",
    type: "consumable",
    cost: 20,
    effect: 0,
    cureEffects: true,
    targetType: "single_ally",
  },
  {
    id: "thawingTonic",
    name: "Thawing Tonic",
    description: "Cures freezing",
    type: "consumable",
    cost: 25,
    effect: 0,
    cureEffects: true,
    targetType: "single_ally",
  },
  {
    id: "paralysisRemedy",
    name: "Paralysis Remedy",
    description: "Cures paralysis",
    type: "consumable",
    cost: 30,
    effect: 0,
    cureEffects: true,
    targetType: "single_ally",
  },
  {
    id: "smellingSalts",
    name: "Smelling Salts",
    description: "Cures sleep and fear",
    type: "consumable",
    cost: 15,
    effect: 0,
    cureEffects: true,
    targetType: "single_ally",
  },
  {
    id: "trailRations",
    name: "Trail Rations",
    description: "Restores 12 HP",
    type: "consumable",
    cost: 12,
    effect: 12,
    targetType: "single_ally",
    tags: ["food", "exploration", "cooking"],
  },
  {
    id: "aetherTea",
    name: "Aether Tea",
    description: "Restores 15 MP",
    type: "consumable",
    cost: 36,
    effect: 15,
    targetType: "single_ally",
    restoresMp: true,
    tags: ["tea", "arcane", "medicine"],
  },
  // --- Class starting weapons (cost 0, given at character creation) ---
  {
    id: "startSword",
    name: "Longsword",
    description: "+1 attack, standard issue",
    type: "weapon",
    cost: 0,
    effect: 1,
    weaponSprite: "sword",
  },
  {
    id: "startBow",
    name: "Shortbow",
    description: "+1 attack, simple ranged",
    type: "weapon",
    cost: 0,
    effect: 1,
    twoHanded: true,
    weaponSprite: "bow",
  },
  {
    id: "startStaff",
    name: "Quarterstaff",
    description: "+1 attack, arcane focus",
    type: "weapon",
    cost: 0,
    effect: 1,
    weaponSprite: "staff",
  },
  {
    id: "startDagger",
    name: "Dagger",
    description: "+1 attack, light and concealable",
    type: "weapon",
    cost: 0,
    effect: 1,
    light: true,
    finesse: true,
    weaponSprite: "dagger",
  },
  {
    id: "startMace",
    name: "Mace",
    description: "+1 attack, blessed weapon",
    type: "weapon",
    cost: 0,
    effect: 1,
    weaponSprite: "mace",
  },
  {
    id: "startAxe",
    name: "Handaxe",
    description: "+1 attack, brutal and simple",
    type: "weapon",
    cost: 0,
    effect: 1,
    light: true,
    weaponSprite: "axe",
  },
  {
    id: "startRapier",
    name: "Rapier",
    description: "+1 attack, elegant and swift",
    type: "weapon",
    cost: 0,
    effect: 1,
    finesse: true,
    weaponSprite: "sword",
  },
  // --- Shop weapons ---
  {
    id: "chimaeraWing",
    name: "Chimaera Wing",
    description: "Teleport to a known town",
    type: "consumable",
    cost: 75,
    effect: 0,
  },
  {
    id: "shortSword",
    name: "Short Sword",
    description: "+2 attack damage",
    type: "weapon",
    cost: 30,
    effect: 2,
    light: true,
    finesse: true,
    weaponSprite: "sword",
  },
  {
    id: "longSword",
    name: "Long Sword",
    description: "+4 attack damage",
    type: "weapon",
    cost: 80,
    effect: 4,
    weaponSprite: "sword",
    levelReq: 3,
  },
  {
    id: "greatSword",
    name: "Great Sword",
    description: "+7 attack damage (two-handed)",
    type: "weapon",
    cost: 200,
    effect: 7,
    twoHanded: true,
    weaponSprite: "sword",
    levelReq: 5,
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
    levelReq: 3,
  },
  {
    id: "plateArmor",
    name: "Plate Armor",
    description: "+6 AC",
    type: "armor",
    cost: 250,
    effect: 6,
    levelReq: 5,
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
    levelReq: 3,
  },
  {
    id: "towerShield",
    name: "Tower Shield",
    description: "+3 AC",
    type: "shield",
    cost: 150,
    effect: 3,
    levelReq: 5,
  },
  {
    id: "dungeonKey",
    name: "Dungeon Key",
    description: "Opens the sealed dungeon entrance",
    type: "key",
    cost: 100,
    effect: 0,
  },
  // --- Quest items and rewards ---
  {
    id: "covenantSigil",
    name: "Covenant Sigil",
    description: "Records the renewed oaths of the twelve cities",
    type: "key",
    cost: 0,
    effect: 0,
  },
  {
    id: "sealedDispatch",
    name: "Ironhold's Sealed Dispatch",
    description: "A sealed message addressed to Sandport's harbormaster",
    type: "key",
    cost: 0,
    effect: 0,
  },
  {
    id: "frostSilkBundle",
    name: "Frost Silk Bundle",
    description: "Enchanted spider silk gathered for Seer Yrsa",
    type: "key",
    cost: 0,
    effect: 0,
  },
  {
    id: "mountShadowSteed",
    name: "Shadow Steed",
    description: "A covenant-bonded mount that moves like the wind",
    type: "mount",
    cost: 0,
    effect: 0,
    mountId: "shadowSteed",
  },
  {
    id: "trapKit",
    name: "Trap Kit",
    description: "+3 to dungeon trap detection and disarming",
    type: "key",
    cost: 75,
    effect: 0,
    trapDetectionBonus: 3,
    trapDisarmBonus: 3,
  },
  // --- Gathering resources and future crafting inputs ---
  {
    id: "brookTrout",
    name: "Brook Trout",
    description: "A common freshwater fish suited to simple meals",
    type: "crafting",
    cost: 6,
    effect: 0,
    tags: ["fish", "freshwater", "cooking"],
    material: {
      resourceId: "brookTrout",
      discipline: "fishing",
      rarity: "common",
      recipeInput: {
        materialId: "brookTrout",
        categories: ["fish"],
        tier: 1,
        tags: ["freshwater", "protein", "cooking"],
      },
    },
  },
  {
    id: "silverfin",
    name: "Silverfin",
    description: "A bright-scaled fish valued by cooks and alchemists",
    type: "crafting",
    cost: 12,
    effect: 0,
    tags: ["fish", "freshwater", "silver", "cooking"],
    material: {
      resourceId: "silverfin",
      discipline: "fishing",
      rarity: "uncommon",
      recipeInput: {
        materialId: "silverfin",
        categories: ["fish"],
        tier: 2,
        tags: ["freshwater", "silver", "cooking"],
      },
    },
  },
  {
    id: "stormEel",
    name: "Storm Eel",
    description: "A charged eel found when rough weather stirs deep water",
    type: "crafting",
    cost: 26,
    effect: 0,
    tags: ["fish", "storm", "conductive"],
    material: {
      resourceId: "stormEel",
      discipline: "fishing",
      rarity: "rare",
      recipeInput: {
        materialId: "stormEel",
        categories: ["fish"],
        tier: 3,
        tags: ["storm", "conductive", "cooking"],
      },
    },
  },
  {
    id: "moonKoi",
    name: "Moon Koi",
    description: "A rare night fish whose scales retain a pale lunar glow",
    type: "crafting",
    cost: 40,
    effect: 0,
    tags: ["fish", "lunar", "arcane", "relic"],
    material: {
      resourceId: "moonKoi",
      discipline: "fishing",
      rarity: "epic",
      recipeInput: {
        materialId: "moonKoi",
        categories: ["fish", "relic"],
        tier: 4,
        tags: ["night", "lunar", "arcane"],
      },
    },
  },
  {
    id: "ironOre",
    name: "Iron Ore",
    description: "Unrefined iron for future weapons, armor, and tools",
    type: "crafting",
    cost: 8,
    effect: 0,
    tags: ["ore", "metal", "weapon", "armor"],
    material: {
      resourceId: "ironOre",
      discipline: "mining",
      rarity: "common",
      recipeInput: {
        materialId: "ironOre",
        categories: ["ore"],
        tier: 1,
        tags: ["metal", "weapon", "armor"],
      },
    },
  },
  {
    id: "copperOre",
    name: "Copper Ore",
    description: "A workable conductive ore for future tools and fittings",
    type: "crafting",
    cost: 6,
    effect: 0,
    tags: ["ore", "metal", "conductive", "tool"],
    material: {
      resourceId: "copperOre",
      discipline: "mining",
      rarity: "common",
      recipeInput: {
        materialId: "copperOre",
        categories: ["ore"],
        tier: 1,
        tags: ["metal", "conductive", "tool"],
      },
    },
  },
  {
    id: "moonstoneGem",
    name: "Moonstone Gem",
    description: "A cool gem with a shifting inner light",
    type: "crafting",
    cost: 30,
    effect: 0,
    tags: ["gem", "lunar", "jewelry", "arcane"],
    material: {
      resourceId: "moonstoneGem",
      discipline: "mining",
      rarity: "rare",
      recipeInput: {
        materialId: "moonstoneGem",
        categories: ["gem"],
        tier: 3,
        tags: ["lunar", "jewelry", "arcane"],
      },
    },
  },
  {
    id: "runicShard",
    name: "Runic Shard",
    description: "A guarded stone fragment still humming with old wards",
    type: "crafting",
    cost: 44,
    effect: 0,
    tags: ["gem", "relic", "rune", "ward"],
    material: {
      resourceId: "runicShard",
      discipline: "mining",
      rarity: "epic",
      recipeInput: {
        materialId: "runicShard",
        categories: ["gem", "relic"],
        tier: 4,
        tags: ["rune", "ward", "arcane"],
      },
    },
  },
  {
    id: "wildHerbs",
    name: "Wild Herbs",
    description: "Useful leaves and stems gathered from healthy growth",
    type: "crafting",
    cost: 5,
    effect: 0,
    tags: ["herb", "medicine", "tea", "potion"],
    material: {
      resourceId: "wildHerbs",
      discipline: "foraging",
      rarity: "common",
      recipeInput: {
        materialId: "wildHerbs",
        categories: ["herb"],
        tier: 1,
        tags: ["medicine", "tea", "potion"],
      },
    },
  },
  {
    id: "redcapMushroom",
    name: "Redcap Mushroom",
    description: "A potent fungus used carefully in tonics and toxins",
    type: "crafting",
    cost: 10,
    effect: 0,
    tags: ["herb", "plant", "fungus", "potion", "poison"],
    material: {
      resourceId: "redcapMushroom",
      discipline: "foraging",
      rarity: "uncommon",
      recipeInput: {
        materialId: "redcapMushroom",
        categories: ["herb", "plant"],
        tier: 2,
        tags: ["fungus", "potion", "poison"],
      },
    },
  },
  {
    id: "frostbloom",
    name: "Frostbloom",
    description: "A resilient flower that stores winter's chill",
    type: "crafting",
    cost: 24,
    effect: 0,
    tags: ["herb", "plant", "cold", "medicine", "ward"],
    material: {
      resourceId: "frostbloom",
      discipline: "foraging",
      rarity: "rare",
      recipeInput: {
        materialId: "frostbloom",
        categories: ["herb", "plant"],
        tier: 3,
        tags: ["cold", "medicine", "ward"],
      },
    },
  },
  {
    id: "sunleaf",
    name: "Sunleaf",
    description: "A warm desert leaf prized for restorative mixtures",
    type: "crafting",
    cost: 24,
    effect: 0,
    tags: ["herb", "plant", "desert", "radiant", "medicine"],
    material: {
      resourceId: "sunleaf",
      discipline: "foraging",
      rarity: "rare",
      recipeInput: {
        materialId: "sunleaf",
        categories: ["herb", "plant"],
        tier: 3,
        tags: ["desert", "radiant", "medicine"],
      },
    },
  },
  {
    id: "elderBark",
    name: "Elder Bark",
    description: "Ancient living wood protected by a hostile forest spirit",
    type: "crafting",
    cost: 42,
    effect: 0,
    tags: ["wood", "relic", "ancient", "focus", "ward"],
    material: {
      resourceId: "elderBark",
      discipline: "foraging",
      rarity: "epic",
      recipeInput: {
        materialId: "elderBark",
        categories: ["wood", "relic"],
        tier: 4,
        tags: ["ancient", "focus", "ward"],
      },
    },
  },
  // --- Crafted equipment variants ---
  {
      id: "frostWardMail",
      name: "Frost Ward Mail",
      description: "+5 AC, winter wards set into fitted links",
      type: "armor",
      cost: 0,
      effect: 5,
      tags: ["crafted", "armor", "frost", "ward"],
  },
  {
      id: "stormforgedBlade",
      name: "Stormforged Blade",
      description: "+6 attack, lightning held in tempered steel",
      type: "weapon",
      cost: 0,
      effect: 6,
      weaponSprite: "sword",
      element: Element.Lightning,
      tags: ["crafted", "weapon", "storm", "conductive"],
  },
  {
      id: "runicAegis",
      name: "Runic Aegis",
      description: "+5 AC, moonstone-bound runic ward",
      type: "shield",
      cost: 0,
      effect: 5,
      tags: ["crafted", "shield", "rune", "ward"],
  },
  {
      id: "elderwoodFocus",
      name: "Elderwood Focus",
      description: "+6 attack, living wood channels pure force",
      type: "weapon",
      cost: 0,
      effect: 6,
      weaponSprite: "staff",
      element: Element.Force,
      tags: ["crafted", "weapon", "wood", "arcane"],
  },
  // --- Mount items (sold in stables) ---
  {
    id: "mountDonkey",
    name: "Donkey",
    description: "A sturdy pack animal. Slightly faster travel.",
    type: "mount",
    cost: 75,
    effect: 0,
    mountId: "donkey",
  },
  {
    id: "mountHorse",
    name: "Horse",
    description: "A reliable steed. Faster overland travel.",
    type: "mount",
    cost: 200,
    effect: 0,
    mountId: "horse",
  },
  {
    id: "mountWarHorse",
    name: "War Horse",
    description: "A powerful warhorse. Very fast travel.",
    type: "mount",
    cost: 500,
    effect: 0,
    mountId: "warHorse",
  },
  // --- Treasure chest unique items (not sold in shops) ---
  {
    id: "flameBlade",
    name: "Flame Blade",
    description: "+6 attack, blazing edge",
    type: "weapon",
    cost: 0,
    effect: 6,
    weaponSprite: "sword",
    element: Element.Fire,
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
    light: true,
    finesse: true,
    weaponSprite: "dagger",
    element: Element.Ice,
  },
  // --- Treasure items from expanded biome dungeons and overworld ---
  {
    id: "frostBrand",
    name: "Frost Brand",
    description: "+7 attack, ice-forged blade",
    type: "weapon",
    cost: 0,
    effect: 7,
    weaponSprite: "sword",
    element: Element.Ice,
  },
  {
    id: "tundraPelt",
    name: "Tundra Pelt",
    description: "+3 AC, thick winter hide",
    type: "armor",
    cost: 0,
    effect: 3,
  },
  {
    id: "glacialAegis",
    name: "Glacial Aegis",
    description: "+5 AC, frozen crystalline shield",
    type: "shield",
    cost: 0,
    effect: 5,
  },
  {
    id: "magmaCore",
    name: "Magma Core Mace",
    description: "+8 attack, molten heart",
    type: "weapon",
    cost: 0,
    effect: 8,
    weaponSprite: "mace",
    element: Element.Fire,
  },
  {
    id: "volcanicShield",
    name: "Volcanic Shield",
    description: "+6 AC, heat-tempered basalt",
    type: "shield",
    cost: 0,
    effect: 6,
  },
  {
    id: "emberBlade",
    name: "Ember Blade",
    description: "+6 attack, smoldering edge",
    type: "weapon",
    cost: 0,
    effect: 6,
    weaponSprite: "sword",
    element: Element.Fire,
  },
  {
    id: "swampMantle",
    name: "Swamp Mantle",
    description: "+4 AC, enchanted vine weave",
    type: "armor",
    cost: 0,
    effect: 4,
  },
  {
    id: "canyonBow",
    name: "Canyon Bow",
    description: "+5 attack, carved stone limbs (two-handed)",
    type: "weapon",
    cost: 0,
    effect: 5,
    twoHanded: true,
    weaponSprite: "bow",
  },
  {
    id: "dawnforgedBlade",
    name: "Dawnforged Blade",
    description: "+9 attack, radiant edge restored beneath Ashfall",
    type: "weapon",
    cost: 0,
    effect: 9,
    weaponSprite: "sword",
    element: Element.Radiant,
  },
  {
    id: "saltfin",
    name: "Saltfin",
    description: "A firm sea fish used for durable voyage rations.",
    type: "crafting",
    cost: 18,
    effect: 0,
    tags: ["sea", "fish", "cooking"],
    material: {
      resourceId: "saltfin",
      discipline: "fishing",
      rarity: "common",
      recipeInput: {
        materialId: "saltfin",
        categories: ["fish"],
        tier: 1,
        tags: ["sea", "protein", "cooking"],
      },
    },
  },
  {
    id: "oceanPearl",
    name: "Ocean Pearl",
    description: "A luminous pearl prized by navigators and shipwrights.",
    type: "crafting",
    cost: 44,
    effect: 0,
    tags: ["sea", "gem", "navigation"],
    material: {
      resourceId: "oceanPearl",
      discipline: "fishing",
      rarity: "rare",
      recipeInput: {
        materialId: "oceanPearl",
        categories: ["gem", "relic"],
        tier: 3,
        tags: ["sea", "navigation", "luminous"],
      },
    },
  },
  {
    id: "krakenInk",
    name: "Kraken Ink",
    description: "Abyssal pigment that holds routes against wind and spray.",
    type: "crafting",
    cost: 44,
    effect: 0,
    tags: ["sea", "relic", "navigation"],
    material: {
      resourceId: "krakenInk",
      discipline: "fishing",
      rarity: "epic",
      recipeInput: {
        materialId: "krakenInk",
        categories: ["relic"],
        tier: 4,
        tags: ["sea", "navigation", "abyssal"],
      },
    },
  },
  {
    id: "navigationSupplies",
    name: "Navigation Supplies",
    description: "Preserved food, line, wax, and marked coastal charts.",
    type: "crafting",
    cost: 0,
    effect: 0,
    tags: ["crafted", "sea", "navigation"],
  },
  {
    id: "reinforcedHullKit",
    name: "Reinforced Hull Kit",
    description: "A shipwright kit for installing the Reinforced Hull upgrade.",
    type: "crafting",
    cost: 0,
    effect: 0,
    tags: ["crafted", "sea", "boatUpgrade"],
  },
  {
    id: "krakenHeart",
    name: "Kraken Heart",
    description: "A legendary trophy from the Deepwake Kraken.",
    type: "key",
    cost: 0,
    effect: 0,
    tags: ["boss", "sea", "legendary"],
  },
];

/** Look up an item by ID. */
export function getItem(id: string): Item | undefined {
  return ITEMS.find((item) => item.id === id);
}

/** Resolve canonical battle targeting, including inventory copies from old saves. */
export function getItemTargetType(item: Item): ConsumableTargetType {
  return getItem(item.id)?.targetType ?? item.targetType ?? "self";
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

/**
 * Calculate the sell value of an item (typically 50% of purchase cost).
 * Returns 0 for non-sellable items (treasures, quest items).
 */
export function getSellValue(item: Item): number {
  // Non-sellable items: treasures (cost=0), dungeon key (quest item)
  if (item.cost === 0 || item.id === "dungeonKey") {
    return 0;
  }
  // Standard sell price: 50% of cost
  return Math.max(1, Math.floor(item.cost * 0.5));
}

/**
 * Check if an item can be sold.
 * Returns false for treasures (cost=0) and quest items (dungeon key).
 */
export function canSellItem(item: Item): boolean {
  return getSellValue(item) > 0;
}
