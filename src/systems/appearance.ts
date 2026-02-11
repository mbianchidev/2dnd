/**
 * Player appearance & class customization.
 * Each appearance doubles as a class with stat boosts, spell list, and abilities.
 */

import type { PlayerStats } from "./player";

export interface PlayerAppearance {
  id: string;
  label: string;
  /** Short class description shown during character creation. */
  description: string;
  /** Playstyle hint shown during class selection. */
  playstyle: string;
  bodyColor: number;
  skinColor: number;
  legColor: number;
  /** Stat bonuses applied on top of rolled stats. */
  statBoosts: Partial<PlayerStats>;
  /** The primary ability stat used for to-hit calculations. */
  primaryStat: keyof PlayerStats;
  /** Hit die size (e.g. 12 = d12 for Barbarian, 6 = d6 for Mage). */
  hitDie: number;
  /** Spell IDs this class can learn (order doesn't matter — unlocked by level). */
  spells: string[];
  /** Martial ability IDs for non-caster classes (empty for casters). */
  abilities: string[];
  /** Weapon type drawn on the class sprite ("sword", "staff", "dagger", "bow", "mace", "axe"). */
  weaponSprite: "sword" | "staff" | "dagger" | "bow" | "mace" | "axe";
}

/** Classes that rely primarily on spells rather than martial abilities. */
export const CASTER_CLASSES = ["mage", "warlock", "cleric"];

export function isCasterClass(appearanceId: string): boolean {
  return CASTER_CLASSES.includes(appearanceId);
}

export const PLAYER_APPEARANCES: PlayerAppearance[] = [
  {
    id: "knight", label: "Knight",
    description: "A stalwart warrior clad in heavy armor, master of sword and shield.",
    playstyle: "Tank / Melee DPS",
    bodyColor: 0x3f51b5, skinColor: 0xffccbc, legColor: 0x1a237e,
    statBoosts: { strength: 2, constitution: 1 },
    primaryStat: "strength",
    hitDie: 10,
    spells: [
      "cureWounds", "healingWord",
      "greaterHeal", "heal",
    ],
    abilities: ["shieldBash", "actionSurge", "secondWind", "championStrike"],
    weaponSprite: "sword",
  },
  {
    id: "ranger", label: "Ranger",
    description: "A skilled hunter and tracker who wields nature magic and deadly aim.",
    playstyle: "Ranged DPS / Scout",
    bodyColor: 0x2e7d32, skinColor: 0xffccbc, legColor: 0x1b5e20,
    statBoosts: { dexterity: 2, wisdom: 1 },
    primaryStat: "dexterity",
    hitDie: 10,
    spells: [
      "cureWounds", "healingWord",
      "greaterHeal", "heal",
    ],
    abilities: ["aimedShot", "huntersMark", "naturesRemedy", "deadeye"],
    weaponSprite: "bow",
  },
  {
    id: "mage", label: "Mage",
    description: "A scholarly arcanist who commands devastating elemental magic.",
    playstyle: "Ranged Magic DPS",
    bodyColor: 0x6a1b9a, skinColor: 0xffccbc, legColor: 0x4a148c,
    statBoosts: { intelligence: 2, wisdom: 1 },
    primaryStat: "intelligence",
    hitDie: 6,
    spells: [
      "fireBolt", "magicMissile", "thunderwave",
      "fireball", "lightningBolt", "iceStorm", "coneOfCold",
      "chainLightning", "disintegrate", "meteorSwarm",
      "arcaneRecovery",
    ],
    abilities: [],
    weaponSprite: "staff",
  },
  {
    id: "rogue", label: "Rogue",
    description: "A cunning scoundrel who strikes from the shadows with lethal precision.",
    playstyle: "Burst DPS / Skirmisher",
    bodyColor: 0x37474f, skinColor: 0xffccbc, legColor: 0x263238,
    statBoosts: { dexterity: 2, charisma: 1 },
    primaryStat: "dexterity",
    hitDie: 8,
    spells: [],
    abilities: ["sneakAttack", "cunningStrike", "shadowStep", "assassinate"],
    weaponSprite: "dagger",
  },
  {
    id: "paladin", label: "Paladin",
    description: "A holy warrior who channels divine power to smite evil and heal allies.",
    playstyle: "Melee / Healer Hybrid",
    bodyColor: 0xffd600, skinColor: 0xffccbc, legColor: 0xc0a060,
    statBoosts: { strength: 1, charisma: 2 },
    primaryStat: "charisma",
    hitDie: 10,
    spells: [
      "cureWounds", "healingWord",
      "greaterHeal", "massHealingWord", "heal",
      "regenerate", "powerWordHeal",
    ],
    abilities: ["smite", "layOnHands", "holyStrike", "greaterSmite"],
    weaponSprite: "sword",
  },
  {
    id: "warlock", label: "Warlock",
    description: "An occultist bound to an otherworldly patron, wielding eldritch power.",
    playstyle: "Ranged Magic DPS / Hex",
    bodyColor: 0xb71c1c, skinColor: 0xd7ccc8, legColor: 0x880e4f,
    statBoosts: { charisma: 2, intelligence: 1 },
    primaryStat: "charisma",
    hitDie: 8,
    spells: [
      "eldritchBlast", "hexCurse",
      "fireball", "hungerOfHadar",
      "coneOfCold", "disintegrate", "meteorSwarm",
    ],
    abilities: [],
    weaponSprite: "staff",
  },
  {
    id: "cleric", label: "Cleric",
    description: "A divine servant who heals the faithful and punishes the wicked.",
    playstyle: "Healer / Support",
    bodyColor: 0xeeeeee, skinColor: 0x8d6e63, legColor: 0xbdbdbd,
    statBoosts: { wisdom: 2, constitution: 1 },
    primaryStat: "wisdom",
    hitDie: 8,
    spells: [
      "sacredFlame", "cureWounds", "healingWord",
      "spiritGuardians", "greaterHeal", "massHealingWord", "heal",
      "regenerate", "powerWordHeal",
    ],
    abilities: [],
    weaponSprite: "mace",
  },
  {
    id: "barbarian", label: "Barbarian",
    description: "A primal warrior fueled by rage, shrugging off blows that fell lesser fighters.",
    playstyle: "Melee DPS / Tank",
    bodyColor: 0x795548, skinColor: 0xa1887f, legColor: 0x4e342e,
    statBoosts: { strength: 2, constitution: 1 },
    primaryStat: "strength",
    hitDie: 12,
    spells: [],
    abilities: ["recklessStrike", "rage", "endure", "titansBlow"],
    weaponSprite: "axe",
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
