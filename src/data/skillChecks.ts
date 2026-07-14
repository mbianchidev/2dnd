import { Terrain, type CityShopData } from "./mapTypes";
import type { NpcInstance } from "./npcs";

export const SKILL_CHECK_ABILITIES = [
  "dexterity",
  "intelligence",
  "wisdom",
  "charisma",
] as const;

export type SkillCheckAbility = typeof SKILL_CHECK_ABILITIES[number];

export interface SkillCheckRecord {
  ability: SkillCheckAbility;
  naturalRoll: number;
  modifier: number;
  total: number;
  dc: number;
  success: boolean;
  optionId?: string;
}

export type SocialApproach = "persuade" | "bluff";

export interface ShopNegotiationOption {
  id: SocialApproach;
  label: string;
  description: string;
  dc: number;
  discount: number;
}

export const SHOP_NEGOTIATION_OPTIONS: ShopNegotiationOption[] = [
  {
    id: "persuade",
    label: "Persuade",
    description: "Ask for a fair adventurer's rate.",
    dc: 12,
    discount: 0.1,
  },
  {
    id: "bluff",
    label: "Bluff",
    description: "Claim a rival offered a much better price.",
    dc: 15,
    discount: 0.2,
  },
];

export function getShopNegotiationOption(
  id: string,
): ShopNegotiationOption | undefined {
  return SHOP_NEGOTIATION_OPTIONS.find((option) => option.id === id);
}

export function getCityShopSkillCheckId(
  cityId: string,
  chunkIndex: number,
  shop: Pick<CityShopData, "type" | "x" | "y">,
): string {
  if (
    !cityId
    || !Number.isInteger(chunkIndex)
    || !Number.isInteger(shop.x)
    || !Number.isInteger(shop.y)
  ) {
    throw new Error("[skillChecks] Invalid city shop identity");
  }
  return `shop:city:${cityId}:${chunkIndex}:${shop.type}:${shop.x},${shop.y}`;
}

export function getTownShopSkillCheckId(
  chunkX: number,
  chunkY: number,
  tileX: number,
  tileY: number,
): string {
  const coordinates = [chunkX, chunkY, tileX, tileY];
  if (!coordinates.every(Number.isInteger)) {
    throw new Error("[skillChecks] Invalid town shop identity");
  }
  return `shop:town:${coordinates.join(",")}`;
}

export interface NpcSkillChallenge {
  id: string;
  cityId: string;
  npc: Pick<NpcInstance, "templateId" | "x" | "y">;
  ability: "charisma";
  approach: SocialApproach;
  dc: number;
  successText: string;
  failureText: string;
  successGold: number;
  failureGoldLoss?: number;
}

export const NPC_SKILL_CHALLENGES: NpcSkillChallenge[] = [
  {
    id: "npc:ironhold:gateGuard",
    cityId: "ironhold_city",
    npc: { templateId: "guard_male", x: 9, y: 12 },
    ability: "charisma",
    approach: "persuade",
    dc: 12,
    successText: "The guard shares a bounty tip and your advance payment.",
    failureText: "The guard dismisses your request without another word.",
    successGold: 35,
  },
  {
    id: "npc:canyonwatch:oldProspector",
    cityId: "canyonwatch_city",
    npc: { templateId: "male_elder", x: 6, y: 10 },
    ability: "charisma",
    approach: "bluff",
    dc: 14,
    successText: "The prospector buys your tale and pays for the false map.",
    failureText: "The prospector spots the lie and charges you for his wasted time.",
    successGold: 45,
    failureGoldLoss: 10,
  },
  {
    id: "npc:ashfall:watchGuard",
    cityId: "ashfall_city",
    npc: { templateId: "guard_male", x: 9, y: 12 },
    ability: "charisma",
    approach: "persuade",
    dc: 15,
    successText: "The guard funds your expedition into the dangerous wastes.",
    failureText: "The guard refuses to spend city coin on an unproven traveler.",
    successGold: 60,
  },
];

export function getNpcSkillChallenge(
  cityId: string,
  npc: Pick<NpcInstance, "templateId" | "x" | "y">,
): NpcSkillChallenge | undefined {
  return NPC_SKILL_CHALLENGES.find((challenge) =>
    challenge.cityId === cityId
    && challenge.npc.templateId === npc.templateId
    && challenge.npc.x === npc.x
    && challenge.npc.y === npc.y
  );
}

export type SkillCheckEnvironment = "overworld" | "dungeon";

export interface ExplorationEventDefinition {
  id: string;
  environments: SkillCheckEnvironment[];
  terrains: Terrain[];
  ability: "wisdom" | "dexterity";
  dc: number;
  chance: number;
  successText: string;
  failureText: string;
  successGold?: number;
  failureDamage?: number;
  revealRadius?: number;
}

export const EXPLORATION_EVENTS: ExplorationEventDefinition[] = [
  {
    id: "hiddenTrail",
    environments: ["overworld"],
    terrains: [Terrain.Forest, Terrain.DeepForest],
    ability: "wisdom",
    dc: 12,
    chance: 0.035,
    successText: "You notice a hidden trail and recover an abandoned purse.",
    failureText: "The undergrowth looks ordinary, and the trail stays hidden.",
    successGold: 20,
    revealRadius: 4,
  },
  {
    id: "buriedCache",
    environments: ["overworld"],
    terrains: [Terrain.Sand, Terrain.Swamp, Terrain.Canyon],
    ability: "wisdom",
    dc: 13,
    chance: 0.025,
    successText: "Subtle markings lead you to a buried cache.",
    failureText: "You search the markings but cannot find what they indicate.",
    successGold: 25,
  },
  {
    id: "suddenSinkhole",
    environments: ["overworld"],
    terrains: [Terrain.Sand, Terrain.Swamp, Terrain.Canyon],
    ability: "dexterity",
    dc: 12,
    chance: 0.03,
    successText: "You spring clear before the ground gives way.",
    failureText: "The ground collapses and you wrench yourself free.",
    failureDamage: 6,
  },
  {
    id: "secretPassage",
    environments: ["dungeon"],
    terrains: [Terrain.DungeonFloor],
    ability: "wisdom",
    dc: 14,
    chance: 0.025,
    successText: "Scrape marks reveal a concealed passage and forgotten coins.",
    failureText: "The stonework gives up none of its secrets.",
    successGold: 30,
    revealRadius: 5,
  },
];
