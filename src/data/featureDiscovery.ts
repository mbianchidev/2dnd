import type { CodexKnowledgeCategory } from "./codexKnowledge";
import type { CraftingCategory } from "./crafting";
import type { GatheringDiscipline } from "./gathering";

export const FEATURE_IDS = [
  "map",
  "equipment",
  "inventory",
  "tips",
  "settings",
  "shops",
  "questJournal",
  "chronicle",
  "party",
  "partyGambits",
  "codex",
  "codexMonsters",
  "codexLocation",
  "codexItem",
  "codexCharacter",
  "codexFaction",
  "codexHistory",
  "achievements",
  "crafting",
  "craftingConsumable",
  "craftingBattle",
  "craftingExploration",
  "craftingEquipment",
  "craftingSpecial",
  "gathering",
  "gatheringFishing",
  "gatheringMining",
  "gatheringForaging",
  "worldEvents",
  "socialProfile",
  "mounts",
  "nauticalHarbors",
  "nauticalRoutes",
  "nauticalBoat",
] as const;

export type FeatureId = (typeof FEATURE_IDS)[number];

export type FeatureOwner =
  | "escapeMenu"
  | "partyTab"
  | "chronicle"
  | "codexTab"
  | "craftingCategory"
  | "gatheringDiscipline"
  | "shortcut"
  | "touchAction"
  | "gamepadAction"
  | "contextPrompt"
  | "worldMap"
  | "tutorial";

export interface FeatureDefinition {
  id: FeatureId;
  label: string;
  description: string;
  prerequisite?: string;
  owners: readonly FeatureOwner[];
  testId: string;
  alwaysAvailable?: boolean;
}

const ALWAYS_AVAILABLE_FEATURE_IDS = [
  "map",
  "equipment",
  "inventory",
  "tips",
  "settings",
  "shops",
] as const satisfies readonly FeatureId[];

export const ALWAYS_AVAILABLE_FEATURES: ReadonlySet<FeatureId> = new Set(
  ALWAYS_AVAILABLE_FEATURE_IDS,
);

export const FEATURE_DEFINITIONS: readonly FeatureDefinition[] = [
  {
    id: "map",
    label: "Map",
    description: "World and city navigation maps.",
    owners: ["shortcut", "escapeMenu", "worldMap", "tutorial"],
    testId: "feature-map",
    alwaysAvailable: true,
  },
  {
    id: "equipment",
    label: "Equipment",
    description: "Hero gear, abilities, spells, and usable items.",
    owners: ["shortcut", "escapeMenu", "tutorial"],
    testId: "feature-equipment",
    alwaysAvailable: true,
  },
  {
    id: "inventory",
    label: "Inventory",
    description: "Owned items and essential item management.",
    owners: ["escapeMenu", "partyTab", "tutorial"],
    testId: "feature-inventory",
    alwaysAvailable: true,
  },
  {
    id: "tips",
    label: "Tips",
    description: "Context-aware help and tutorial replay.",
    owners: ["escapeMenu", "shortcut", "touchAction", "gamepadAction", "tutorial"],
    testId: "feature-tips",
    alwaysAvailable: true,
  },
  {
    id: "settings",
    label: "Settings",
    description: "Audio, accessibility, and control presentation.",
    owners: ["escapeMenu"],
    testId: "feature-settings",
    alwaysAvailable: true,
  },
  {
    id: "shops",
    label: "Shops",
    description: "Contextual town services and purchases.",
    owners: ["contextPrompt"],
    testId: "feature-shops",
    alwaysAvailable: true,
  },
  {
    id: "questJournal",
    label: "Quest Journal",
    description: "Accepted and completed quest objectives.",
    prerequisite: "Accept a quest.",
    owners: ["escapeMenu", "shortcut", "tutorial"],
    testId: "feature-quest-journal",
  },
  {
    id: "chronicle",
    label: "Chronicle",
    description: "Replay discovered story scenes and review world events.",
    prerequisite: "Experience a story scene or World Event.",
    owners: ["escapeMenu", "tutorial"],
    testId: "feature-chronicle",
  },
  {
    id: "party",
    label: "Party",
    description: "Companion order, status, equipment, and transfers.",
    prerequisite: "Recruit a companion.",
    owners: ["escapeMenu", "partyTab", "shortcut", "touchAction", "tutorial"],
    testId: "feature-party",
  },
  {
    id: "partyGambits",
    label: "Gambits",
    description: "Ranked companion automation rules.",
    prerequisite: "Recruit a companion.",
    owners: ["partyTab", "tutorial"],
    testId: "feature-party-gambits",
  },
  {
    id: "codex",
    label: "Codex",
    description: "Discovered monsters and world knowledge.",
    prerequisite: "Discover a Codex entry.",
    owners: ["escapeMenu", "shortcut", "tutorial"],
    testId: "feature-codex",
  },
  ...([
    ["codexMonsters", "Monsters", "Defeat or study a monster."],
    ["codexLocation", "Locations", "Discover location lore."],
    ["codexItem", "Items", "Discover item lore."],
    ["codexCharacter", "People", "Discover character lore."],
    ["codexFaction", "Factions", "Discover faction lore."],
    ["codexHistory", "History", "Discover historical lore."],
  ] as const).map(([id, label, prerequisite]): FeatureDefinition => ({
    id,
    label,
    description: `${label} Codex category.`,
    prerequisite,
    owners: ["codexTab"],
    testId: `feature-${id.replace(/[A-Z]/g, (value) => `-${value.toLowerCase()}`)}`,
  })),
  {
    id: "achievements",
    label: "Achievements",
    description: "Natural milestones, progress, points, and cosmetic titles.",
    prerequisite: "Earn an achievement through normal play.",
    owners: ["escapeMenu", "shortcut", "tutorial"],
    testId: "feature-achievements",
  },
  {
    id: "crafting",
    label: "Crafting",
    description: "Known recipes and deterministic crafting.",
    prerequisite: "Learn a non-starting recipe.",
    owners: ["escapeMenu", "shortcut", "partyTab", "tutorial"],
    testId: "feature-crafting",
  },
  ...([
    ["craftingConsumable", "Consumables"],
    ["craftingBattle", "Battle"],
    ["craftingExploration", "Exploration"],
    ["craftingEquipment", "Equipment"],
    ["craftingSpecial", "Special"],
  ] as const).map(([id, label]): FeatureDefinition => ({
    id,
    label,
    description: `${label} crafting recipes.`,
    prerequisite: `Learn a ${label.toLowerCase()} recipe.`,
    owners: ["craftingCategory"],
    testId: `feature-${id.replace(/[A-Z]/g, (value) => `-${value.toLowerCase()}`)}`,
  })),
  {
    id: "gathering",
    label: "Gathering",
    description: "Gathering actions, materials, and records.",
    prerequisite: "Discover or attempt a gathering discipline.",
    owners: ["escapeMenu", "shortcut", "contextPrompt", "tutorial"],
    testId: "feature-gathering",
  },
  ...([
    ["gatheringFishing", "Fishing"],
    ["gatheringMining", "Mining"],
    ["gatheringForaging", "Foraging"],
  ] as const).map(([id, label]): FeatureDefinition => ({
    id,
    label,
    description: `${label} actions and records.`,
    prerequisite: `Discover a ${label.toLowerCase()} node.`,
    owners: ["gatheringDiscipline", "contextPrompt", "tutorial"],
    testId: `feature-${id.replace(/[A-Z]/g, (value) => `-${value.toLowerCase()}`)}`,
  })),
  {
    id: "worldEvents",
    label: "World Events",
    description: "Presented and resolved World Event history.",
    prerequisite: "Encounter a World Event.",
    owners: ["chronicle", "tutorial"],
    testId: "feature-world-events",
  },
  {
    id: "socialProfile",
    label: "Social",
    description: "Alignment and established reputation relationships.",
    prerequisite: "Cause a non-default alignment or reputation change.",
    owners: ["partyTab", "tutorial"],
    testId: "feature-social-profile",
  },
  {
    id: "mounts",
    label: "Mounts",
    description: "Mount selection and mount or dismount controls.",
    prerequisite: "Own a mount.",
    owners: ["shortcut", "contextPrompt", "tutorial"],
    testId: "feature-mounts",
  },
  {
    id: "nauticalHarbors",
    label: "Harbors",
    description: "Known ports and harbor information.",
    prerequisite: "Discover a port.",
    owners: ["worldMap", "contextPrompt", "tutorial"],
    testId: "feature-nautical-harbors",
  },
  {
    id: "nauticalRoutes",
    label: "Merchant Routes",
    description: "Known paid sea routes.",
    prerequisite: "Discover a merchant route.",
    owners: ["worldMap", "contextPrompt", "tutorial"],
    testId: "feature-nautical-routes",
  },
  {
    id: "nauticalBoat",
    label: "Sailing",
    description: "Boat ownership, condition, upgrades, and free sailing.",
    prerequisite: "Acquire a boat.",
    owners: ["worldMap", "contextPrompt", "tutorial"],
    testId: "feature-nautical-boat",
  },
];

export const FEATURE_DEFINITION_BY_ID = new Map(
  FEATURE_DEFINITIONS.map((definition) => [definition.id, definition]),
);

export const CODEX_CATEGORY_FEATURES: Readonly<Record<
  "monsters" | CodexKnowledgeCategory,
  FeatureId
>> = {
  monsters: "codexMonsters",
  location: "codexLocation",
  item: "codexItem",
  character: "codexCharacter",
  faction: "codexFaction",
  history: "codexHistory",
};

export const CRAFTING_CATEGORY_FEATURES: Readonly<Record<
  CraftingCategory,
  FeatureId
>> = {
  consumable: "craftingConsumable",
  battle: "craftingBattle",
  exploration: "craftingExploration",
  equipment: "craftingEquipment",
  special: "craftingSpecial",
};

export const GATHERING_DISCIPLINE_FEATURES: Readonly<Record<
  GatheringDiscipline,
  FeatureId
>> = {
  fishing: "gatheringFishing",
  mining: "gatheringMining",
  foraging: "gatheringForaging",
};

export function isFeatureId(value: unknown): value is FeatureId {
  return typeof value === "string"
    && (FEATURE_IDS as readonly string[]).includes(value);
}
