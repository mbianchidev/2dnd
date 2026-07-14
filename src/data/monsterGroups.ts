/**
 * Data-driven multi-monster encounter templates and balanced generation.
 */

import { getMonster } from "./monsters";
import type { Monster } from "./monsters";

export type FormationPosition = "front" | "back";

export interface GroupMember {
  monsterId: string;
  position: FormationPosition;
}

export type GroupSynergyType =
  | "pack_tactics"
  | "shield_wall"
  | "war_cry"
  | "healer_support"
  | "elemental_combo";

export interface GroupSynergy {
  type: GroupSynergyType;
  description: string;
  acBonus?: number;
  attackBonus?: number;
  damageBonus?: number;
  /** The synergy ends once this many members have been defeated. */
  breakThreshold: number;
}

export interface MonsterGroupTemplate {
  id: string;
  name: string;
  members: GroupMember[];
  synergy?: GroupSynergy;
  minPlayerLevel: number;
  biomes?: string[];
  encounterWeight: number;
  surpriseRound?: boolean;
}

export interface MonsterEncounterMember {
  monster: Monster;
  position: FormationPosition;
}

export interface MonsterEncounter {
  id: string;
  name: string;
  members: MonsterEncounterMember[];
  synergy?: GroupSynergy;
  isGroup: boolean;
  surpriseRound?: boolean;
}

export const MONSTER_GROUP_TEMPLATES: MonsterGroupTemplate[] = [
  {
    id: "slimeSwarm",
    name: "Slime Swarm",
    members: [
      { monsterId: "slime", position: "front" },
      { monsterId: "slime", position: "front" },
      { monsterId: "magmaSlime", position: "back" },
    ],
    synergy: {
      type: "elemental_combo",
      description: "Mixed slime elements add 1 damage to attacks.",
      damageBonus: 1,
      breakThreshold: 2,
    },
    minPlayerLevel: 2,
    biomes: ["grass", "volcanic", "dungeon", "volcanic_forge"],
    encounterWeight: 5,
  },
  {
    id: "goblinRaidingParty",
    name: "Goblin Raiding Party",
    members: [
      { monsterId: "goblin", position: "front" },
      { monsterId: "goblin", position: "front" },
      { monsterId: "orc", position: "back" },
    ],
    synergy: {
      type: "pack_tactics",
      description: "Coordinated attacks grant +2 attack while the group holds.",
      attackBonus: 2,
      breakThreshold: 2,
    },
    minPlayerLevel: 4,
    biomes: ["grass", "forest", "deep_forest", "canyon"],
    encounterWeight: 4,
  },
  {
    id: "wolfPack",
    name: "Wolf Pack",
    members: [
      { monsterId: "wolf", position: "front" },
      { monsterId: "wolf", position: "front" },
      { monsterId: "wolf", position: "front" },
    ],
    synergy: {
      type: "pack_tactics",
      description: "The pack gains +1 attack and AC while at least two remain.",
      attackBonus: 1,
      acBonus: 1,
      breakThreshold: 2,
    },
    minPlayerLevel: 5,
    biomes: ["grass", "forest", "deep_forest", "tundra", "night"],
    encounterWeight: 4,
  },
  {
    id: "undeadProcession",
    name: "Undead Procession",
    members: [
      { monsterId: "skeleton", position: "front" },
      { monsterId: "skeleton", position: "front" },
      { monsterId: "wraith", position: "back" },
    ],
    synergy: {
      type: "healer_support",
      description: "The rear support restores the most wounded undead.",
      breakThreshold: 2,
    },
    minPlayerLevel: 7,
    biomes: ["night", "dungeon", "heartlands_dungeon"],
    encounterWeight: 3,
  },
  {
    id: "cryptGuard",
    name: "Crypt Guard",
    members: [
      { monsterId: "cryptSkeleton", position: "front" },
      { monsterId: "cryptSkeleton", position: "front" },
      { monsterId: "tombWraith", position: "back" },
    ],
    synergy: {
      type: "shield_wall",
      description: "The front row gains +2 AC while guarded from behind.",
      acBonus: 2,
      breakThreshold: 2,
    },
    minPlayerLevel: 7,
    biomes: ["dungeon", "heartlands_dungeon"],
    encounterWeight: 4,
  },
  {
    id: "elementalConvergence",
    name: "Elemental Convergence",
    members: [
      { monsterId: "iceElemental", position: "front" },
      { monsterId: "cinderWraith", position: "back" },
    ],
    synergy: {
      type: "elemental_combo",
      description: "Opposing elements add 2 damage to every attack.",
      damageBonus: 2,
      breakThreshold: 1,
    },
    minPlayerLevel: 8,
    biomes: ["dungeon", "frost_cavern", "volcanic_forge"],
    encounterWeight: 2,
  },
  {
    id: "orcWarband",
    name: "Orc Warband",
    members: [
      { monsterId: "orc", position: "front" },
      { monsterId: "orc", position: "front" },
      { monsterId: "goblin", position: "back" },
    ],
    synergy: {
      type: "war_cry",
      description: "A fallen ally grants each survivor +2 on its next attack.",
      breakThreshold: 3,
    },
    minPlayerLevel: 7,
    biomes: ["grass", "canyon", "sand"],
    encounterWeight: 2,
  },
  {
    id: "dungeonAmbush",
    name: "Dungeon Ambush",
    members: [
      { monsterId: "shadow", position: "front" },
      { monsterId: "shadow", position: "front" },
      { monsterId: "mimic", position: "back" },
    ],
    synergy: {
      type: "pack_tactics",
      description: "The ambushers gain +1 attack while coordinated.",
      attackBonus: 1,
      breakThreshold: 2,
    },
    minPlayerLevel: 9,
    biomes: ["dungeon"],
    encounterWeight: 2,
    surpriseRound: true,
  },
  {
    id: "forestNightPatrol",
    name: "Forest Night Patrol",
    members: [
      { monsterId: "darkTreent", position: "front" },
      { monsterId: "gloomSprite", position: "back" },
      { monsterId: "gloomSprite", position: "back" },
    ],
    synergy: {
      type: "healer_support",
      description: "Bark magic restores the most wounded patrol member.",
      breakThreshold: 2,
    },
    minPlayerLevel: 8,
    biomes: ["deep_forest", "forest", "Woodland"],
    encounterWeight: 2,
  },
];

/** Map an XP reward to the issue-defined difficulty rating. */
export function getMonsterDifficultyRating(xpReward: number): number {
  if (xpReward <= 50) return 1;
  if (xpReward <= 100) return 2;
  if (xpReward <= 200) return 3;
  if (xpReward <= 500) return 4;
  if (xpReward <= 1000) return 5;
  return 6;
}

/** Soft difficulty budget for a player level. */
export function getGroupBudget(playerLevel: number): number {
  return Math.max(0, playerLevel) * 3;
}

/** Sum the difficulty ratings of every member in a template. */
export function getGroupDifficulty(template: MonsterGroupTemplate): number {
  return template.members.reduce((total, member) => {
    const monster = getMonster(member.monsterId);
    return total + (monster ? getMonsterDifficultyRating(monster.xpReward) : Infinity);
  }, 0);
}

/** Group chance rises by 5% per level after level one and caps at 50%. */
export function getGroupEncounterChance(playerLevel: number): number {
  return Math.max(0, Math.min(0.5, (playerLevel - 1) * 0.05));
}

export function rollEncounterType(
  playerLevel: number,
  random: () => number = Math.random,
): "solo" | "group" {
  if (playerLevel <= 1) return "solo";
  return random() < getGroupEncounterChance(playerLevel) ? "group" : "solo";
}

function cloneMonster(monster: Monster): Monster {
  return {
    ...monster,
    drops: monster.drops?.map((drop) => ({ ...drop })),
    abilities: monster.abilities?.map((ability) => ({ ...ability })),
    elementalProfile: monster.elementalProfile
      ? {
          resistances: monster.elementalProfile.resistances?.slice(),
          weaknesses: monster.elementalProfile.weaknesses?.slice(),
          immunities: monster.elementalProfile.immunities?.slice(),
        }
      : undefined,
  };
}

/** Wrap a boss, debug spawn, or ordinary monster in the group-aware contract. */
export function createSoloEncounter(monster: Monster): MonsterEncounter {
  return {
    id: `solo:${monster.id}`,
    name: monster.name,
    members: [{ monster: cloneMonster(monster), position: "front" }],
    isGroup: false,
  };
}

export function getMonsterGroupTemplate(
  id: string,
): MonsterGroupTemplate | undefined {
  return MONSTER_GROUP_TEMPLATES.find((template) => template.id === id);
}

/** Resolve a template to copied monster data. Invalid templates are rejected. */
export function createGroupEncounter(
  template: MonsterGroupTemplate,
): MonsterEncounter | undefined {
  const members: MonsterEncounterMember[] = [];
  for (const member of template.members) {
    const monster = getMonster(member.monsterId);
    if (!monster) return undefined;
    members.push({
      monster: cloneMonster(monster),
      position: member.position,
    });
  }

  return {
    id: template.id,
    name: template.name,
    members,
    synergy: template.synergy ? { ...template.synergy } : undefined,
    isGroup: true,
    surpriseRound: template.surpriseRound,
  };
}

function matchesEnvironment(
  template: MonsterGroupTemplate,
  environments: string[],
): boolean {
  if (!template.biomes || template.biomes.length === 0) return true;
  const normalizedEnvironments = environments
    .map((environment) => environment.trim().toLowerCase())
    .filter(Boolean);
  if (normalizedEnvironments.length === 0) return false;

  return template.biomes.some((biome) => {
    const normalizedBiome = biome.toLowerCase();
    return normalizedEnvironments.some(
      (environment) =>
        environment === normalizedBiome
        || environment.includes(normalizedBiome)
        || normalizedBiome.includes(environment),
    );
  });
}

/** Return templates that are level-, biome-, and budget-safe. */
export function getEligibleMonsterGroups(
  playerLevel: number,
  environments: string[] = [],
): MonsterGroupTemplate[] {
  const budget = getGroupBudget(playerLevel);
  return MONSTER_GROUP_TEMPLATES.filter(
    (template) =>
      playerLevel >= template.minPlayerLevel
      && getGroupDifficulty(template) <= budget
      && matchesEnvironment(template, environments),
  );
}

/** Select a weighted eligible group. */
export function getRandomGroupEncounter(
  playerLevel: number,
  environments: string[] = [],
  random: () => number = Math.random,
): MonsterEncounter | undefined {
  const eligible = getEligibleMonsterGroups(playerLevel, environments);
  const totalWeight = eligible.reduce(
    (total, template) => total + Math.max(0, template.encounterWeight),
    0,
  );
  if (totalWeight <= 0) return undefined;

  let pick = Math.max(0, Math.min(0.999999, random())) * totalWeight;
  for (const template of eligible) {
    pick -= Math.max(0, template.encounterWeight);
    if (pick < 0) return createGroupEncounter(template);
  }
  return createGroupEncounter(eligible[eligible.length - 1]!);
}

/** Replace an already-selected solo encounter only when a valid group rolls. */
export function createRandomEncounter(
  soloMonster: Monster,
  playerLevel: number,
  environments: string[] = [],
  random: () => number = Math.random,
): MonsterEncounter {
  if (rollEncounterType(playerLevel, random) === "group") {
    const group = getRandomGroupEncounter(playerLevel, environments, random);
    if (group) return group;
  }
  return createSoloEncounter(soloMonster);
}
