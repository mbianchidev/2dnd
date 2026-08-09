import { Terrain } from "./mapTypes";
import { TimePeriod } from "../systems/daynight";
import { WeatherType } from "../systems/weather";

export const GATHERING_DISCIPLINES = [
  "fishing",
  "mining",
  "foraging",
] as const;

export type GatheringDiscipline = (typeof GATHERING_DISCIPLINES)[number];

export const GATHERING_RARITIES = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
] as const;

export type GatheringRarity = (typeof GATHERING_RARITIES)[number];

export const MATERIAL_CATEGORIES = [
  "fish",
  "ore",
  "gem",
  "herb",
  "plant",
  "wood",
  "relic",
] as const;

export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

export interface RecipeInputContract {
  readonly materialId: string;
  readonly categories: readonly MaterialCategory[];
  readonly tier: 1 | 2 | 3 | 4 | 5;
  readonly tags: readonly string[];
}

export interface GatheringResourceDefinition {
  readonly id: string;
  readonly discipline: GatheringDiscipline;
  readonly itemId: string;
  readonly rarity: GatheringRarity;
  readonly recipeInput: RecipeInputContract;
  readonly hiddenUntilFound?: boolean;
}

export interface GatheringOutcomeDefinition {
  readonly id: string;
  readonly resourceId: string;
  readonly weight: number;
  readonly quantity: readonly [number, number];
  readonly periods?: readonly TimePeriod[];
  readonly weather?: readonly WeatherType[];
  readonly terrain?: readonly Terrain[];
  readonly biomeTags?: readonly string[];
  readonly battleMonsterId?: string;
}

export interface GatheringTableDefinition {
  readonly id: string;
  readonly discipline: GatheringDiscipline;
  readonly outcomes: readonly GatheringOutcomeDefinition[];
}

export interface GatheringDisciplineDefinition {
  readonly id: GatheringDiscipline;
  readonly name: string;
  readonly actionLabel: string;
  readonly prompt: string;
  readonly targetTerrains: readonly Terrain[];
  readonly allowsCurrentTile: boolean;
  readonly tableId: string;
  readonly baseCooldownSteps: number;
  readonly depletedCooldownSteps: number;
  readonly attemptsBeforeDepletion: number;
}

export const GATHERING_RESOURCES: readonly GatheringResourceDefinition[] = [
  {
    id: "brookTrout",
    discipline: "fishing",
    itemId: "brookTrout",
    rarity: "common",
    recipeInput: {
      materialId: "brookTrout",
      categories: ["fish"],
      tier: 1,
      tags: ["freshwater", "protein", "cooking"],
    },
  },
  {
    id: "silverfin",
    discipline: "fishing",
    itemId: "silverfin",
    rarity: "uncommon",
    recipeInput: {
      materialId: "silverfin",
      categories: ["fish"],
      tier: 2,
      tags: ["freshwater", "silver", "cooking"],
    },
  },
  {
    id: "stormEel",
    discipline: "fishing",
    itemId: "stormEel",
    rarity: "rare",
    recipeInput: {
      materialId: "stormEel",
      categories: ["fish"],
      tier: 3,
      tags: ["storm", "conductive", "cooking"],
    },
    hiddenUntilFound: true,
  },
  {
    id: "moonKoi",
    discipline: "fishing",
    itemId: "moonKoi",
    rarity: "epic",
    recipeInput: {
      materialId: "moonKoi",
      categories: ["fish", "relic"],
      tier: 4,
      tags: ["night", "lunar", "arcane"],
    },
    hiddenUntilFound: true,
  },
  {
    id: "ironOre",
    discipline: "mining",
    itemId: "ironOre",
    rarity: "common",
    recipeInput: {
      materialId: "ironOre",
      categories: ["ore"],
      tier: 1,
      tags: ["metal", "weapon", "armor"],
    },
  },
  {
    id: "copperOre",
    discipline: "mining",
    itemId: "copperOre",
    rarity: "common",
    recipeInput: {
      materialId: "copperOre",
      categories: ["ore"],
      tier: 1,
      tags: ["metal", "conductive", "tool"],
    },
  },
  {
    id: "moonstoneGem",
    discipline: "mining",
    itemId: "moonstoneGem",
    rarity: "rare",
    recipeInput: {
      materialId: "moonstoneGem",
      categories: ["gem"],
      tier: 3,
      tags: ["lunar", "jewelry", "arcane"],
    },
    hiddenUntilFound: true,
  },
  {
    id: "runicShard",
    discipline: "mining",
    itemId: "runicShard",
    rarity: "epic",
    recipeInput: {
      materialId: "runicShard",
      categories: ["gem", "relic"],
      tier: 4,
      tags: ["rune", "ward", "arcane"],
    },
    hiddenUntilFound: true,
  },
  {
    id: "wildHerbs",
    discipline: "foraging",
    itemId: "wildHerbs",
    rarity: "common",
    recipeInput: {
      materialId: "wildHerbs",
      categories: ["herb"],
      tier: 1,
      tags: ["medicine", "tea", "potion"],
    },
  },
  {
    id: "redcapMushroom",
    discipline: "foraging",
    itemId: "redcapMushroom",
    rarity: "uncommon",
    recipeInput: {
      materialId: "redcapMushroom",
      categories: ["herb", "plant"],
      tier: 2,
      tags: ["fungus", "potion", "poison"],
    },
  },
  {
    id: "frostbloom",
    discipline: "foraging",
    itemId: "frostbloom",
    rarity: "rare",
    recipeInput: {
      materialId: "frostbloom",
      categories: ["herb", "plant"],
      tier: 3,
      tags: ["cold", "medicine", "ward"],
    },
    hiddenUntilFound: true,
  },
  {
    id: "sunleaf",
    discipline: "foraging",
    itemId: "sunleaf",
    rarity: "rare",
    recipeInput: {
      materialId: "sunleaf",
      categories: ["herb", "plant"],
      tier: 3,
      tags: ["desert", "radiant", "medicine"],
    },
    hiddenUntilFound: true,
  },
  {
    id: "elderBark",
    discipline: "foraging",
    itemId: "elderBark",
    rarity: "epic",
    recipeInput: {
      materialId: "elderBark",
      categories: ["wood", "relic"],
      tier: 4,
      tags: ["ancient", "focus", "ward"],
    },
    hiddenUntilFound: true,
  },
] as const;

export const GATHERING_TABLES: readonly GatheringTableDefinition[] = [
  {
    id: "freshwaterCatch",
    discipline: "fishing",
    outcomes: [
      { id: "catchBrookTrout", resourceId: "brookTrout", weight: 58, quantity: [1, 2] },
      { id: "catchSilverfin", resourceId: "silverfin", weight: 28, quantity: [1, 1] },
      {
        id: "catchStormEel",
        resourceId: "stormEel",
        weight: 9,
        quantity: [1, 1],
        weather: [WeatherType.Rain, WeatherType.Storm],
        battleMonsterId: "bogCreeper",
      },
      {
        id: "catchMoonKoi",
        resourceId: "moonKoi",
        weight: 5,
        quantity: [1, 1],
        periods: [TimePeriod.Dusk, TimePeriod.Night],
      },
    ],
  },
  {
    id: "stoneVein",
    discipline: "mining",
    outcomes: [
      { id: "mineIronOre", resourceId: "ironOre", weight: 50, quantity: [1, 3] },
      { id: "mineCopperOre", resourceId: "copperOre", weight: 35, quantity: [1, 2] },
      {
        id: "mineMoonstone",
        resourceId: "moonstoneGem",
        weight: 12,
        quantity: [1, 1],
        terrain: [Terrain.Mountain, Terrain.Canyon, Terrain.DungeonWall],
      },
      {
        id: "wakeRunicMimic",
        resourceId: "runicShard",
        weight: 3,
        quantity: [1, 1],
        terrain: [Terrain.DungeonWall],
        battleMonsterId: "runicMimic",
      },
    ],
  },
  {
    id: "wildGrowth",
    discipline: "foraging",
    outcomes: [
      { id: "gatherWildHerbs", resourceId: "wildHerbs", weight: 52, quantity: [1, 3] },
      {
        id: "gatherRedcap",
        resourceId: "redcapMushroom",
        weight: 25,
        quantity: [1, 2],
        terrain: [Terrain.Swamp, Terrain.Mushroom, Terrain.DeepForest],
      },
      {
        id: "gatherFrostbloom",
        resourceId: "frostbloom",
        weight: 10,
        quantity: [1, 1],
        terrain: [Terrain.Tundra],
        weather: [WeatherType.Clear, WeatherType.Snow, WeatherType.Fog],
      },
      {
        id: "gatherSunleaf",
        resourceId: "sunleaf",
        weight: 10,
        quantity: [1, 1],
        terrain: [Terrain.Cactus, Terrain.Flower, Terrain.CropField],
        periods: [TimePeriod.Dawn, TimePeriod.Day],
      },
      {
        id: "rouseElderRoot",
        resourceId: "elderBark",
        weight: 3,
        quantity: [1, 1],
        terrain: [Terrain.DeepForest],
        battleMonsterId: "darkTreant",
      },
    ],
  },
] as const;

export const GATHERING_DEFINITIONS: Readonly<
  Record<GatheringDiscipline, GatheringDisciplineDefinition>
> = {
  fishing: {
    id: "fishing",
    name: "Fishing",
    actionLabel: "Cast line",
    prompt: "Fish",
    targetTerrains: [Terrain.Water, Terrain.River],
    allowsCurrentTile: false,
    tableId: "freshwaterCatch",
    baseCooldownSteps: 8,
    depletedCooldownSteps: 18,
    attemptsBeforeDepletion: 3,
  },
  mining: {
    id: "mining",
    name: "Mining",
    actionLabel: "Inspect vein",
    prompt: "Mine",
    targetTerrains: [
      Terrain.Mountain,
      Terrain.Canyon,
      Terrain.Volcanic,
      Terrain.Geyser,
      Terrain.DungeonWall,
    ],
    allowsCurrentTile: false,
    tableId: "stoneVein",
    baseCooldownSteps: 10,
    depletedCooldownSteps: 22,
    attemptsBeforeDepletion: 3,
  },
  foraging: {
    id: "foraging",
    name: "Foraging",
    actionLabel: "Search growth",
    prompt: "Forage",
    targetTerrains: [
      Terrain.Forest,
      Terrain.DeepForest,
      Terrain.Swamp,
      Terrain.Tundra,
      Terrain.Flower,
      Terrain.Cactus,
      Terrain.Mushroom,
      Terrain.CropField,
    ],
    allowsCurrentTile: true,
    tableId: "wildGrowth",
    baseCooldownSteps: 7,
    depletedCooldownSteps: 16,
    attemptsBeforeDepletion: 4,
  },
};

export function getGatheringResource(
  resourceId: string,
): GatheringResourceDefinition | undefined {
  return GATHERING_RESOURCES.find((resource) => resource.id === resourceId);
}

export function getGatheringTable(
  tableId: string,
): GatheringTableDefinition | undefined {
  return GATHERING_TABLES.find((table) => table.id === tableId);
}

export function getGatheringOutcome(
  outcomeId: string,
): GatheringOutcomeDefinition | undefined {
  return GATHERING_TABLES
    .flatMap((table) => table.outcomes)
    .find((outcome) => outcome.id === outcomeId);
}
