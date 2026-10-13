import { Element } from "./elements";
import { Terrain } from "./mapTypes";
import { MONSTER_PHYSICAL_PROFILES } from "./anatomy";
import type { Monster } from "./monsterTypes";
import type { Item } from "./items";
import type { GatheringResourceDefinition } from "./gathering";
import type { CraftingRecipe } from "./crafting";
import type { WorldEventDefinition } from "./worldEvents";
import type { CodexKnowledgeEntry } from "./codexKnowledge";

export const ECHO_CRYSTAL_RESOURCE: GatheringResourceDefinition = {
  id: "echoCrystal", itemId: "echoCrystal", discipline: "mining", rarity: "epic",
  recipeInput: { materialId: "echoCrystal", categories: ["gem", "relic"], tier: 4, tags: ["echo", "arcane"] },
};

export const NEW_GAME_PLUS_ITEMS: readonly Item[] = [
  {
    id: "echoCrystal", name: "Echo Crystal",
    description: "A crystal left by a covenant echo; an epic canonical crafting material.",
    type: "crafting", cost: 40, effect: 0,
    material: { resourceId: ECHO_CRYSTAL_RESOURCE.id, discipline: "mining", rarity: "epic",
      recipeInput: ECHO_CRYSTAL_RESOURCE.recipeInput },
  },
  {
    id: "echoDawnforgedBlade", name: "Echo Dawnforged Blade",
    description: "A covenant blade tempered with an echo crystal. +9 attack, Force.",
    type: "weapon", cost: 0, effect: 9, weaponSprite: "sword",
    physicalDamageType: "slashing", element: Element.Force,
  },
];

export const NEW_GAME_PLUS_RECIPE: CraftingRecipe = {
  id: "echoDawnforgedBlade", name: "Echo Dawnforged Blade", category: "equipment",
  ingredients: [
    { id: "blade", label: "Dawnforged Blade", quantity: 1, match: { kind: "item", itemId: "dawnforgedBlade" } },
    { id: "crystals", label: "Echo Crystal", quantity: 3, match: { kind: "material", materialIds: ["echoCrystal"] } },
  ],
  outputItemId: "echoDawnforgedBlade", outputQuantity: 1, goldCost: 120, station: "forge", maxBatch: 1,
  upgrade: { inputItemId: "dawnforgedBlade", outputItemId: "echoDawnforgedBlade" },
  unlockSources: [{ type: "item", itemId: "echoCrystal" }],
  preview: {
    summary: "Temper the carried covenant blade without duplicating its equipped owner.",
    benefit: "An optional Force alternative, not a campaign key.",
    sourceHint: "Acquire an Echo Crystal in New Game+.",
  },
};

export const NEW_GAME_PLUS_MONSTERS: readonly Monster[] = [
  {
    id: "echoSlime", name: "Echo Slime", family: "slime", variantOf: "slime",
    size: "medium", physicalProfile: MONSTER_PHYSICAL_PROFILES.soft,
    minimumNewGamePlusCycle: 1, encounterWeight: 1, affinity: Element.Force,
    hp: 25, ac: 11, attackBonus: 4, damageCount: 1, damageDie: 6,
    physicalDamageType: "bludgeoning", xpReward: 80, goldReward: 15, isBoss: false, color: 0x75c9e8,
    drops: [{ itemId: "echoCrystal", chance: 0.25 }],
    abilities: [{ name: "Folded Ripple", chance: 0.25, damageCount: 2, damageDie: 4,
      type: "damage", element: Element.Force }],
    elementalProfile: { resistances: [Element.Force], weaknesses: [Element.Thunder] },
  },
  {
    id: "covenantEcho", name: "Covenant Echo", family: "construct", size: "large", anatomy: "humanoid",
    minimumNewGamePlusCycle: 1, encounterWeight: 1, affinity: Element.Force,
    hp: 180, ac: 16, attackBonus: 8, damageCount: 3, damageDie: 6,
    physicalDamageType: "bludgeoning", xpReward: 750, goldReward: 150, isBoss: false, color: 0x6aa8d4,
    abilities: [
      { name: "Remembered Oath", chance: 0.3, damageCount: 3, damageDie: 8, type: "damage", element: Element.Force },
      { name: "Renewed Shape", chance: 0.15, damageCount: 2, damageDie: 8, type: "heal" },
    ],
    elementalProfile: { resistances: [Element.Force], weaknesses: [Element.Thunder] },
  },
];

export const NEW_GAME_PLUS_WORLD_EVENTS: readonly WorldEventDefinition[] = [
  {
    id: "echoTrail", family: "discovery", title: "A Road Remembered", source: "Covenant echoes",
    prompt: "A blue reflection folds around a stone. Its remembered road is not a shortcut through the covenant.",
    weight: 4, cooldownSteps: 20, maxRepeats: 2,
    eligibility: { minimumNewGamePlusCycle: 1, terrains: [Terrain.Grass, Terrain.Forest, Terrain.Water] },
    choices: [
      { id: "listen", label: "Listen to the reflection", detail: "Gather one Echo Crystal; no quest is completed.",
        type: "resolve", outcome: { id: "echoHeard", summary: "The reflection leaves an Echo Crystal.",
          rewards: [{ id: "echoCrystal", type: "item", itemId: "echoCrystal", quantity: 1 }] } },
      { id: "leave", label: "Leave the reflection", detail: "Continue without a reward.",
        type: "resolve", outcome: { id: "echoLeft", summary: "The remembered road closes gently." } },
    ],
  },
  {
    id: "covenantEchoTrial", family: "ambush", title: "The Unfinished Reflection", source: "Post-game challenge",
    prompt: "An original covenant echo offers a voluntary trial. It is not a keystone or another ending.",
    weight: 4, cooldownSteps: 40, maxRepeats: 1,
    eligibility: { minimumNewGamePlusCycle: 1, terrains: [Terrain.Grass, Terrain.Forest],
      questConditions: [{ questId: "twelvefoldCovenant", statuses: ["completed"] }] },
    choices: [
      { id: "challenge", label: "Challenge the echo", detail: "Optional elite battle through normal party rules; fleeing is allowed.",
        type: "battle", monsterId: "covenantEcho",
        victory: { id: "echoTrialWon", summary: "The echo yields three crystals, once in this cycle.",
          rewards: [{ id: "trialCrystals", type: "item", itemId: "echoCrystal", quantity: 3 }] },
        fled: { id: "echoTrialFled", summary: "The trial closes without a crystal." },
        defeat: { id: "echoTrialLost", summary: "The trial ends; normal town recovery remains authoritative." } },
      { id: "decline", label: "Decline the trial", detail: "No cost; the canonical ending remains complete.",
        type: "resolve", outcome: { id: "echoTrialDeclined", summary: "The echo bows and lets the road continue." } },
    ],
  },
];

export const NEW_GAME_PLUS_LORE: readonly CodexKnowledgeEntry[] = [
  {
    id: "historyCovenantEchoes", category: "history", name: "The Remembered Road",
    summary: "A new world may echo an old oath, but each covenant must still be restored.",
    details: ["Echoes are optional reflections, not proof of quest completion.",
      "A completed source remains in its protected manual snapshot. New roads belong to an independent cycle.",
      "Crystals can temper a carried blade; knowledge and titles never open a campaign gate."],
    tags: ["new game plus", "echo", "covenant"], sortOrder: 950,
    sources: [{ type: "worldEvent", eventId: "echoTrail", label: "A Road Remembered", hint: "Listen to a New Game+ echo." }],
  },
];
