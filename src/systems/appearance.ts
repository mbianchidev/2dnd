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
    spells: [
      "fireBolt", "cureWounds", "thunderwave", "healingWord",
      "fireball", "greaterHeal", "iceStorm", "heal",
      "chainLightning", "meteorSwarm",
    ],
    abilities: ["shieldBash", "powerAttack", "secondWind", "championStrike"],
  },
  {
    id: "ranger", label: "Ranger",
    bodyColor: 0x2e7d32, skinColor: 0xffccbc, legColor: 0x1b5e20,
    statBoosts: { dexterity: 2, wisdom: 1 },
    spells: [
      "fireBolt", "cureWounds", "magicMissile", "healingWord",
      "fireball", "lightningBolt", "greaterHeal", "massHealingWord",
      "heal", "regenerate",
    ],
    abilities: ["aimedShot", "huntersMark", "naturesRemedy", "deadeye"],
  },
  {
    id: "mage", label: "Mage",
    bodyColor: 0x6a1b9a, skinColor: 0xffccbc, legColor: 0x4a148c,
    statBoosts: { intelligence: 2, wisdom: 1 },
    spells: [
      "fireBolt", "magicMissile", "thunderwave", "healingWord",
      "fireball", "lightningBolt", "iceStorm", "coneOfCold",
      "chainLightning", "disintegrate", "heal", "meteorSwarm",
    ],
    abilities: [],
  },
  {
    id: "rogue", label: "Rogue",
    bodyColor: 0x37474f, skinColor: 0xffccbc, legColor: 0x263238,
    statBoosts: { dexterity: 2, charisma: 1 },
    spells: [
      "fireBolt", "magicMissile", "cureWounds", "thunderwave",
      "healingWord", "lightningBolt", "iceStorm", "coneOfCold",
      "chainLightning", "disintegrate",
    ],
    abilities: ["sneakAttack", "cunningStrike", "shadowStep", "assassinate"],
  },
  {
    id: "paladin", label: "Paladin",
    bodyColor: 0xffd600, skinColor: 0xffccbc, legColor: 0xc0a060,
    statBoosts: { strength: 1, charisma: 2 },
    spells: [
      "fireBolt", "cureWounds", "thunderwave", "healingWord",
      "fireball", "greaterHeal", "massHealingWord", "heal",
      "regenerate", "powerWordHeal",
    ],
    abilities: ["smite", "layOnHands", "holyStrike", "greaterSmite"],
  },
  {
    id: "warlock", label: "Warlock",
    bodyColor: 0xb71c1c, skinColor: 0xd7ccc8, legColor: 0x880e4f,
    statBoosts: { charisma: 2, intelligence: 1 },
    spells: [
      "fireBolt", "magicMissile", "cureWounds", "thunderwave",
      "fireball", "lightningBolt", "greaterHeal", "coneOfCold",
      "disintegrate", "meteorSwarm",
    ],
    abilities: [],
  },
  {
    id: "cleric", label: "Cleric",
    bodyColor: 0xeeeeee, skinColor: 0x8d6e63, legColor: 0xbdbdbd,
    statBoosts: { wisdom: 2, constitution: 1 },
    spells: [
      "fireBolt", "cureWounds", "healingWord", "thunderwave",
      "greaterHeal", "iceStorm", "massHealingWord", "heal",
      "regenerate", "powerWordHeal",
    ],
    abilities: [],
  },
  {
    id: "barbarian", label: "Barbarian",
    bodyColor: 0x795548, skinColor: 0xa1887f, legColor: 0x4e342e,
    statBoosts: { strength: 2, constitution: 1 },
    spells: [
      "fireBolt", "cureWounds", "thunderwave", "fireball",
      "healingWord", "lightningBolt", "iceStorm", "greaterHeal",
      "chainLightning", "meteorSwarm",
    ],
    abilities: ["recklessStrike", "rage", "endure", "titansBlow"],
  },
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
