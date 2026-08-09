import type { MaterialCategory } from "./gathering";
import type { QuestId } from "./quests";

export const CRAFTING_CATEGORIES = [
  "consumable",
  "battle",
  "exploration",
  "equipment",
  "special",
] as const;

export type CraftingCategory = (typeof CRAFTING_CATEGORIES)[number];

export const CRAFTING_STATIONS = ["forge"] as const;

export type CraftingStation = (typeof CRAFTING_STATIONS)[number];

export const CRAFTING_RECIPE_IDS = [
  "fieldPotion",
  "antidotePoultice",
  "battleSalves",
  "trailRations",
  "aetherTea",
  "greaterPotion",
  "trapKit",
  "temperedLongSword",
  "reinforcedChainMail",
  "ironboundShield",
  "frostWardArmor",
  "stormforgedBlade",
  "runicAegis",
  "elderwoodFocus",
] as const;

export type CraftingRecipeId = (typeof CRAFTING_RECIPE_IDS)[number];

export interface ItemIngredientMatch {
  readonly kind: "item";
  readonly itemId: string;
}

export interface MaterialIngredientMatch {
  readonly kind: "material";
  readonly materialIds?: readonly string[];
  readonly categories?: readonly MaterialCategory[];
  readonly minimumTier?: 1 | 2 | 3 | 4 | 5;
  readonly tags?: readonly string[];
}

export type CraftingIngredientMatch =
  | ItemIngredientMatch
  | MaterialIngredientMatch;

export interface CraftingIngredient {
  readonly id: string;
  readonly label: string;
  readonly quantity: number;
  readonly match: CraftingIngredientMatch;
}

export type CraftingUnlockSource =
  | { readonly type: "default" }
  | { readonly type: "city"; readonly cityId: string }
  | { readonly type: "quest"; readonly questId: QuestId }
  | {
    readonly type: "gathering";
    readonly discipline: "fishing" | "mining" | "foraging";
    readonly successes: number;
  }
  | { readonly type: "codex"; readonly entryId: string }
  | {
    readonly type: "worldEvent";
    readonly eventId: string;
    readonly outcomeId: string;
  }
  | { readonly type: "item"; readonly itemId: string }
  | { readonly type: "shop"; readonly shopId: string }
  | { readonly type: "npc"; readonly npcId: string }
  | { readonly type: "readable"; readonly readableId: string };

export interface CraftingRecipePreview {
  readonly summary: string;
  readonly benefit: string;
  readonly sourceHint: string;
}

export interface CraftingUpgrade {
  readonly inputItemId: string;
  readonly outputItemId: string;
}

export interface CraftingRecipe {
  readonly id: CraftingRecipeId;
  readonly name: string;
  readonly category: CraftingCategory;
  readonly ingredients: readonly CraftingIngredient[];
  readonly outputItemId: string;
  readonly outputQuantity: number;
  readonly goldCost?: number;
  readonly station?: CraftingStation;
  readonly upgrade?: CraftingUpgrade;
  readonly maxBatch?: number;
  readonly unlockSources: readonly CraftingUnlockSource[];
  readonly preview: CraftingRecipePreview;
}

export const CRAFTING_RECIPES: readonly CraftingRecipe[] = [
  {
    id: "fieldPotion",
    name: "Field Potion",
    category: "consumable",
    ingredients: [{
      id: "medicinalHerbs",
      label: "Medicinal herb",
      quantity: 2,
      match: {
        kind: "material",
        categories: ["herb", "plant"],
        minimumTier: 1,
        tags: ["medicine"],
      },
    }],
    outputItemId: "potion",
    outputQuantity: 1,
    goldCost: 3,
    maxBatch: 20,
    unlockSources: [{ type: "default" }],
    preview: {
      summary: "Brew a reliable healing draught from medicinal plants.",
      benefit: "Restores 20 HP to one ally.",
      sourceHint: "Known at the start of the journey.",
    },
  },
  {
    id: "antidotePoultice",
    name: "Antidote Poultice",
    category: "battle",
    ingredients: [
      {
        id: "wildHerbs",
        label: "Wild Herbs",
        quantity: 1,
        match: { kind: "material", materialIds: ["wildHerbs"] },
      },
      {
        id: "redcap",
        label: "Redcap Mushroom",
        quantity: 1,
        match: { kind: "material", materialIds: ["redcapMushroom"] },
      },
    ],
    outputItemId: "antidote",
    outputQuantity: 2,
    goldCost: 12,
    maxBatch: 10,
    unlockSources: [{ type: "default" }],
    preview: {
      summary: "Balance a toxic fungus with common medicinal leaves.",
      benefit: "Creates two poison cures.",
      sourceHint: "Known at the start of the journey.",
    },
  },
  {
    id: "battleSalves",
    name: "Battle Salves",
    category: "battle",
    ingredients: [
      {
        id: "medicine",
        label: "Medicinal herb",
        quantity: 2,
        match: {
          kind: "material",
          categories: ["herb", "plant"],
          minimumTier: 1,
          tags: ["medicine"],
        },
      },
      {
        id: "copper",
        label: "Copper Ore",
        quantity: 1,
        match: { kind: "material", materialIds: ["copperOre"] },
      },
    ],
    outputItemId: "burnSalve",
    outputQuantity: 2,
    goldCost: 12,
    maxBatch: 10,
    unlockSources: [
      { type: "shop", shopId: "willowdale_city:0:general:3,11" },
      { type: "npc", npcId: "bogtownApothecary" },
    ],
    preview: {
      summary: "Seal cooling medicine in thin copper tins.",
      benefit: "Creates two burn cures for battle.",
      sourceHint: "Ask an apothecary or inspect Willowdale's general supplies.",
    },
  },
  {
    id: "trailRations",
    name: "Trail Rations",
    category: "exploration",
    ingredients: [
      {
        id: "fish",
        label: "Fresh fish",
        quantity: 1,
        match: {
          kind: "material",
          categories: ["fish"],
          minimumTier: 1,
          tags: ["cooking"],
        },
      },
      {
        id: "plant",
        label: "Edible plant",
        quantity: 1,
        match: {
          kind: "material",
          categories: ["herb", "plant"],
          minimumTier: 1,
        },
      },
    ],
    outputItemId: "trailRations",
    outputQuantity: 2,
    goldCost: 7,
    maxBatch: 20,
    unlockSources: [{ type: "default" }],
    preview: {
      summary: "Prepare portable food for long routes and dungeon delves.",
      benefit: "Creates two compact 12 HP restoratives.",
      sourceHint: "Known at the start of the journey.",
    },
  },
  {
    id: "aetherTea",
    name: "Aether Tea",
    category: "consumable",
    ingredients: [
      {
        id: "silverfin",
        label: "Silverfin",
        quantity: 1,
        match: { kind: "material", materialIds: ["silverfin"] },
      },
      {
        id: "arcanePlant",
        label: "Arcane plant",
        quantity: 1,
        match: {
          kind: "material",
          categories: ["herb", "plant"],
          minimumTier: 2,
          tags: ["medicine"],
        },
      },
    ],
    outputItemId: "aetherTea",
    outputQuantity: 1,
    goldCost: 8,
    maxBatch: 10,
    unlockSources: [
      { type: "gathering", discipline: "fishing", successes: 3 },
      { type: "codex", entryId: "rootspeakers" },
    ],
    preview: {
      summary: "Steep silver scales with a potent medicinal plant.",
      benefit: "Restores 15 MP to one ally.",
      sourceHint: "Improve at fishing or study Rootspeaker lore.",
    },
  },
  {
    id: "greaterPotion",
    name: "Greater Healing Potion",
    category: "consumable",
    ingredients: [
      {
        id: "potion",
        label: "Healing Potion",
        quantity: 1,
        match: { kind: "item", itemId: "potion" },
      },
      {
        id: "rareMedicine",
        label: "Potent medicinal plant",
        quantity: 1,
        match: {
          kind: "material",
          categories: ["herb", "plant"],
          minimumTier: 3,
          tags: ["medicine"],
        },
      },
    ],
    outputItemId: "greaterPotion",
    outputQuantity: 1,
    goldCost: 12,
    maxBatch: 10,
    unlockSources: [
      { type: "gathering", discipline: "foraging", successes: 3 },
      { type: "city", cityId: "bogtown_city" },
    ],
    preview: {
      summary: "Concentrate a normal potion with a rare restorative plant.",
      benefit: "Restores 50 HP to one ally.",
      sourceHint: "Practice foraging or visit Bogtown.",
    },
  },
  {
    id: "trapKit",
    name: "Trap Kit",
    category: "exploration",
    ingredients: [
      {
        id: "copper",
        label: "Copper Ore",
        quantity: 2,
        match: { kind: "material", materialIds: ["copperOre"] },
      },
      {
        id: "iron",
        label: "Iron Ore",
        quantity: 1,
        match: { kind: "material", materialIds: ["ironOre"] },
      },
    ],
    outputItemId: "trapKit",
    outputQuantity: 1,
    goldCost: 27,
    maxBatch: 3,
    unlockSources: [
      { type: "city", cityId: "ironhold_city" },
      { type: "item", itemId: "trapKit" },
    ],
    preview: {
      summary: "Shape picks, probes, and wire cutters for dungeon hazards.",
      benefit: "+3 to trap detection and disarming while carried.",
      sourceHint: "Visit Ironhold or inspect an existing Trap Kit.",
    },
  },
  {
    id: "temperedLongSword",
    name: "Temper Short Sword",
    category: "equipment",
    ingredients: [
      {
        id: "baseWeapon",
        label: "Short Sword",
        quantity: 1,
        match: { kind: "item", itemId: "shortSword" },
      },
      {
        id: "iron",
        label: "Iron Ore",
        quantity: 3,
        match: { kind: "material", materialIds: ["ironOre"] },
      },
    ],
    outputItemId: "longSword",
    outputQuantity: 1,
    goldCost: 30,
    station: "forge",
    upgrade: { inputItemId: "shortSword", outputItemId: "longSword" },
    maxBatch: 1,
    unlockSources: [
      { type: "city", cityId: "ironhold_city" },
      { type: "quest", questId: "ironboundDispatch" },
    ],
    preview: {
      summary: "Reforge a short sword into a stronger balanced blade.",
      benefit: "Upgrades +2 attack to +4 and preserves its equipped slot.",
      sourceHint: "Learn Ironhold's forge methods.",
    },
  },
  {
    id: "reinforcedChainMail",
    name: "Reinforce Leather Armor",
    category: "equipment",
    ingredients: [
      {
        id: "baseArmor",
        label: "Leather Armor",
        quantity: 1,
        match: { kind: "item", itemId: "leatherArmor" },
      },
      {
        id: "iron",
        label: "Iron Ore",
        quantity: 4,
        match: { kind: "material", materialIds: ["ironOre"] },
      },
    ],
    outputItemId: "chainMail",
    outputQuantity: 1,
    goldCost: 25,
    station: "forge",
    upgrade: { inputItemId: "leatherArmor", outputItemId: "chainMail" },
    maxBatch: 1,
    unlockSources: [{ type: "city", cityId: "ironhold_city" }],
    preview: {
      summary: "Add fitted iron links over a leather foundation.",
      benefit: "Upgrades +2 AC to +4 and preserves its equipped slot.",
      sourceHint: "Learn Ironhold's forge methods.",
    },
  },
  {
    id: "ironboundShield",
    name: "Ironbind Wooden Shield",
    category: "equipment",
    ingredients: [
      {
        id: "baseShield",
        label: "Wooden Shield",
        quantity: 1,
        match: { kind: "item", itemId: "woodenShield" },
      },
      {
        id: "iron",
        label: "Iron Ore",
        quantity: 2,
        match: { kind: "material", materialIds: ["ironOre"] },
      },
      {
        id: "copper",
        label: "Copper Ore",
        quantity: 1,
        match: { kind: "material", materialIds: ["copperOre"] },
      },
    ],
    outputItemId: "ironShield",
    outputQuantity: 1,
    goldCost: 20,
    station: "forge",
    upgrade: { inputItemId: "woodenShield", outputItemId: "ironShield" },
    maxBatch: 1,
    unlockSources: [{ type: "city", cityId: "ironhold_city" }],
    preview: {
      summary: "Bind a wooden shield with iron and conductive copper rivets.",
      benefit: "Upgrades +1 AC to +2 and preserves its equipped slot.",
      sourceHint: "Learn Ironhold's forge methods.",
    },
  },
  {
    id: "frostWardArmor",
    name: "Frost Ward Mail",
    category: "special",
    ingredients: [
      {
        id: "baseArmor",
        label: "Chain Mail",
        quantity: 1,
        match: { kind: "item", itemId: "chainMail" },
      },
      {
        id: "frostbloom",
        label: "Frostbloom",
        quantity: 2,
        match: { kind: "material", materialIds: ["frostbloom"] },
      },
      {
        id: "gem",
        label: "Tier 3 gem",
        quantity: 1,
        match: {
          kind: "material",
          categories: ["gem"],
          minimumTier: 3,
        },
      },
    ],
    outputItemId: "frostWardMail",
    outputQuantity: 1,
    goldCost: 55,
    station: "forge",
    upgrade: { inputItemId: "chainMail", outputItemId: "frostWardMail" },
    maxBatch: 1,
    unlockSources: [
      { type: "quest", questId: "silkAgainstTheCold" },
      { type: "codex", entryId: "theWardCloths" },
    ],
    preview: {
      summary: "Set winter-bloom fibers and lunar stone into fitted mail.",
      benefit: "Creates rare +5 AC armor and preserves its equipped slot.",
      sourceHint: "Restore Frostheim's ward-cloths.",
    },
  },
  {
    id: "stormforgedBlade",
    name: "Stormforged Blade",
    category: "special",
    ingredients: [
      {
        id: "baseWeapon",
        label: "Long Sword",
        quantity: 1,
        match: { kind: "item", itemId: "longSword" },
      },
      {
        id: "stormEel",
        label: "Storm Eel",
        quantity: 1,
        match: { kind: "material", materialIds: ["stormEel"] },
      },
      {
        id: "gem",
        label: "Arcane gem",
        quantity: 1,
        match: {
          kind: "material",
          categories: ["gem"],
          minimumTier: 3,
          tags: ["arcane"],
        },
      },
    ],
    outputItemId: "stormforgedBlade",
    outputQuantity: 1,
    goldCost: 65,
    station: "forge",
    upgrade: { inputItemId: "longSword", outputItemId: "stormforgedBlade" },
    maxBatch: 1,
    unlockSources: [
      {
        type: "worldEvent",
        eventId: "stormWashedCrossing",
        outcomeId: "crossingCleared",
      },
      { type: "codex", entryId: "stormCrossings" },
    ],
    preview: {
      summary: "Quench a proven blade in captured storm charge.",
      benefit: "Creates an epic +6 Lightning weapon.",
      sourceHint: "Master a storm crossing or study its Codex record.",
    },
  },
  {
    id: "runicAegis",
    name: "Runic Aegis",
    category: "special",
    ingredients: [
      {
        id: "baseShield",
        label: "Iron Shield",
        quantity: 1,
        match: { kind: "item", itemId: "ironShield" },
      },
      {
        id: "runicShard",
        label: "Runic Shard",
        quantity: 1,
        match: { kind: "material", materialIds: ["runicShard"] },
      },
      {
        id: "moonstone",
        label: "Moonstone Gem",
        quantity: 1,
        match: { kind: "material", materialIds: ["moonstoneGem"] },
      },
    ],
    outputItemId: "runicAegis",
    outputQuantity: 1,
    goldCost: 80,
    station: "forge",
    upgrade: { inputItemId: "ironShield", outputItemId: "runicAegis" },
    maxBatch: 1,
    unlockSources: [
      { type: "codex", entryId: "chainsOfTheForgemaster" },
      { type: "readable", readableId: "dunerestFirstChoiceInscription" },
    ],
    preview: {
      summary: "Seat an old warding rune in a moonstone-bound shield.",
      benefit: "Creates an epic +5 AC shield.",
      sourceHint: "Study old forge chains or a First Choice inscription.",
    },
  },
  {
    id: "elderwoodFocus",
    name: "Elderwood Focus",
    category: "special",
    ingredients: [
      {
        id: "baseWeapon",
        label: "Quarterstaff",
        quantity: 1,
        match: { kind: "item", itemId: "startStaff" },
      },
      {
        id: "elderBark",
        label: "Elder Bark",
        quantity: 1,
        match: { kind: "material", materialIds: ["elderBark"] },
      },
      {
        id: "lunarRelic",
        label: "Lunar relic",
        quantity: 1,
        match: {
          kind: "material",
          categories: ["fish", "relic"],
          minimumTier: 4,
          tags: ["lunar"],
        },
      },
    ],
    outputItemId: "elderwoodFocus",
    outputQuantity: 1,
    goldCost: 70,
    station: "forge",
    upgrade: { inputItemId: "startStaff", outputItemId: "elderwoodFocus" },
    maxBatch: 1,
    unlockSources: [
      { type: "codex", entryId: "rootspeakers" },
      { type: "gathering", discipline: "foraging", successes: 5 },
    ],
    preview: {
      summary: "Join living elderwood and lunar essence around an arcane focus.",
      benefit: "Creates an epic +6 Force staff.",
      sourceHint: "Master foraging and study Rootspeaker lore.",
    },
  },
] as const;

const RECIPE_BY_ID = new Map<CraftingRecipeId, CraftingRecipe>(
  CRAFTING_RECIPES.map((recipe) => [recipe.id, recipe]),
);

export function isCraftingRecipeId(value: unknown): value is CraftingRecipeId {
  return typeof value === "string"
    && CRAFTING_RECIPE_IDS.some((recipeId) => recipeId === value);
}

export function isCraftingCategory(value: unknown): value is CraftingCategory {
  return typeof value === "string"
    && CRAFTING_CATEGORIES.some((category) => category === value);
}

export function isCraftingStation(value: unknown): value is CraftingStation {
  return typeof value === "string"
    && CRAFTING_STATIONS.some((station) => station === value);
}

export function getCraftingRecipe(
  recipeId: CraftingRecipeId,
): CraftingRecipe {
  return RECIPE_BY_ID.get(recipeId)!;
}

export function getDefaultCraftingRecipeIds(): CraftingRecipeId[] {
  return CRAFTING_RECIPES
    .filter((recipe) =>
      recipe.unlockSources.some((source) => source.type === "default")
    )
    .map((recipe) => recipe.id);
}
