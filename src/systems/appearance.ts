/**
 * Player appearance & class customization.
 * Each appearance doubles as a class with stat boosts, spell list, and abilities.
 */

import type { PlayerStats } from "./player";

export interface PlayerAppearance {
  id: string;
  label: string;
  bodyColor: number;
  skinColor: number;
  legColor: number;
  /** Stat bonuses applied on top of rolled stats. */
  statBoosts: Partial<PlayerStats>;
  /** The primary ability stat used for to-hit calculations. */
  primaryStat: keyof PlayerStats;
  /** Spell IDs this class can learn (order doesn't matter — unlocked by level). */
  spells: string[];
  /** Martial ability IDs for non-caster classes (empty for casters). */
  abilities: string[];
}

/** Classes that rely on spells rather than martial abilities. */
export const CASTER_CLASSES = ["mage", "warlock", "cleric"];

export function isCasterClass(appearanceId: string): boolean {
  return CASTER_CLASSES.includes(appearanceId);
}

export const PLAYER_APPEARANCES: PlayerAppearance[] = [
  {
    id: "knight", label: "Knight",
    bodyColor: 0x3f51b5, skinColor: 0xffccbc, legColor: 0x1a237e,
    statBoosts: { strength: 2, constitution: 1 },
    primaryStat: "strength",
    spells: [
      "shortRest",
      "fireBolt", "cureWounds", "thunderwave", "healingWord",
      "fireball", "greaterHeal", "iceStorm", "heal",
      "chainLightning", "meteorSwarm",
    ],
    abilities: ["shieldBash", "powerAttack", "secondWind", "championStrike", "fastTravel"],
  },
  {
    id: "ranger", label: "Ranger",
    bodyColor: 0x2e7d32, skinColor: 0xffccbc, legColor: 0x1b5e20,
    statBoosts: { dexterity: 2, wisdom: 1 },
    primaryStat: "dexterity",
    spells: [
      "shortRest",
      "fireBolt", "cureWounds", "magicMissile", "healingWord",
      "fireball", "lightningBolt", "greaterHeal", "massHealingWord",
      "heal", "regenerate",
    ],
    abilities: ["aimedShot", "huntersMark", "naturesRemedy", "deadeye", "fastTravel"],
  },
  {
    id: "mage", label: "Mage",
    bodyColor: 0x6a1b9a, skinColor: 0xffccbc, legColor: 0x4a148c,
    statBoosts: { intelligence: 2, wisdom: 1 },
    primaryStat: "intelligence",
    spells: [
      "shortRest",
      "fireBolt", "magicMissile", "thunderwave", "healingWord", "teleport",
      "fireball", "lightningBolt", "iceStorm", "coneOfCold",
      "chainLightning", "disintegrate", "heal", "meteorSwarm",
    ],
    abilities: ["fastTravel"],
  },
  {
    id: "rogue", label: "Rogue",
    bodyColor: 0x37474f, skinColor: 0xffccbc, legColor: 0x263238,
    statBoosts: { dexterity: 2, charisma: 1 },
    primaryStat: "dexterity",
    spells: [
      "shortRest",
      "fireBolt", "magicMissile", "cureWounds", "thunderwave",
      "healingWord", "lightningBolt", "iceStorm", "coneOfCold",
      "chainLightning", "disintegrate",
    ],
    abilities: ["sneakAttack", "cunningStrike", "shadowStep", "assassinate", "fastTravel"],
  },
  {
    id: "paladin", label: "Paladin",
    bodyColor: 0xffd600, skinColor: 0xffccbc, legColor: 0xc0a060,
    statBoosts: { strength: 1, charisma: 2 },
    primaryStat: "charisma",
    spells: [
      "shortRest",
      "fireBolt", "cureWounds", "thunderwave", "healingWord",
      "fireball", "greaterHeal", "massHealingWord", "heal",
      "regenerate", "powerWordHeal",
    ],
    abilities: ["smite", "layOnHands", "holyStrike", "greaterSmite", "fastTravel"],
  },
  {
    id: "warlock", label: "Warlock",
    bodyColor: 0xb71c1c, skinColor: 0xd7ccc8, legColor: 0x880e4f,
    statBoosts: { charisma: 2, intelligence: 1 },
    primaryStat: "charisma",
    spells: [
      "shortRest",
      "fireBolt", "magicMissile", "cureWounds", "thunderwave", "teleport",
      "fireball", "lightningBolt", "greaterHeal", "coneOfCold",
      "disintegrate", "meteorSwarm",
    ],
    abilities: ["fastTravel"],
  },
  {
    id: "cleric", label: "Cleric",
    bodyColor: 0xeeeeee, skinColor: 0x8d6e63, legColor: 0xbdbdbd,
    statBoosts: { wisdom: 2, constitution: 1 },
    primaryStat: "wisdom",
    spells: [
      "shortRest",
      "fireBolt", "cureWounds", "healingWord", "thunderwave", "teleport",
      "greaterHeal", "iceStorm", "massHealingWord", "heal",
      "regenerate", "powerWordHeal",
    ],
    abilities: ["fastTravel"],
  },
  {
    id: "barbarian", label: "Barbarian",
    bodyColor: 0x795548, skinColor: 0xa1887f, legColor: 0x4e342e,
    statBoosts: { strength: 2, constitution: 1 },
    primaryStat: "strength",
    spells: [
      "shortRest",
      "fireBolt", "cureWounds", "thunderwave", "fireball",
      "healingWord", "lightningBolt", "iceStorm", "greaterHeal",
      "chainLightning", "meteorSwarm",
    ],
    abilities: ["recklessStrike", "rage", "endure", "titansBlow", "fastTravel"],
  },
];

/** Custom appearance overrides (skin color, hair). */
export interface CustomAppearance {
  skinColor: number;
  hairStyle: number; // 0=bald, 1=short, 2=medium, 3=long
  hairColor: number;
}

export const SKIN_COLOR_OPTIONS: { label: string; color: number }[] = [
  { label: "Light", color: 0xffccbc },
  { label: "Tan", color: 0xd7a97c },
  { label: "Medium", color: 0xc68642 },
  { label: "Dark", color: 0x8d6e63 },
  { label: "Deep", color: 0x5d4037 },
];

export const HAIR_STYLE_OPTIONS: { label: string; id: number }[] = [
  { label: "Bald", id: 0 },
  { label: "Short", id: 1 },
  { label: "Medium", id: 2 },
  { label: "Long", id: 3 },
];

export const HAIR_COLOR_OPTIONS: { label: string; color: number }[] = [
  { label: "Black", color: 0x1a1a1a },
  { label: "Brown", color: 0x5d4037 },
  { label: "Blonde", color: 0xffd54f },
  { label: "Red", color: 0xb71c1c },
  { label: "White", color: 0xeeeeee },
  { label: "Blue", color: 0x1565c0 },
];

export function getAppearance(id: string): PlayerAppearance {
  return PLAYER_APPEARANCES.find((a) => a.id === id) ?? PLAYER_APPEARANCES[0];
}

/** Get the spell IDs available for a class. */
export function getClassSpells(appearanceId: string): string[] {
  return getAppearance(appearanceId).spells;
}

/** Get the ability IDs available for a class. */
export function getClassAbilities(appearanceId: string): string[] {
  return getAppearance(appearanceId).abilities;
}
