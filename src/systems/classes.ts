/**
 * Player class definitions.
 * Each class has stat boosts, spell/ability lists, hit die, primary stat,
 * and default visual properties (body/leg colors, clothing style).
 */

import type { PlayerStats } from "./player";

export interface PlayerClass {
  id: string;
  label: string;
  /** Short class description shown during character creation. */
  description: string;
  /** Playstyle hint shown during class selection. */
  playstyle: string;
  /** Default body color for this class's sprite. */
  bodyColor: number;
  /** Default skin color for this class's sprite (overridden by custom appearance). */
  skinColor: number;
  /** Default leg color for this class's sprite. */
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
  /** Default weapon type drawn on the class sprite. */
  weaponSprite: "sword" | "staff" | "dagger" | "bow" | "mace" | "axe" | "fist";
  /** Item ID of the starting weapon given at character creation. */
  startingWeaponId: string;
  /** Class clothing style for distinct sprite appearance. */
  clothingStyle: "heavy" | "robe" | "leather" | "vestment" | "bare" | "wrap" | "performer";
  /** D&D 5e starting gold: number of d4 to roll, multiplied by 10. */
  startingGoldDice: number;
}

/** Classes that rely primarily on spells rather than martial abilities. */
export const CASTER_CLASSES = ["wizard", "sorcerer", "warlock", "cleric", "bard"];

export function isCasterClass(classId: string): boolean {
  return CASTER_CLASSES.includes(classId);
}

export const PLAYER_CLASSES: PlayerClass[] = [
  {
    id: "knight", label: "Knight",
    description: "A stalwart warrior clad in heavy armor, master of sword and shield.",
    playstyle: "Tank / Melee DPS",
    bodyColor: 0x3f51b5, skinColor: 0xffccbc, legColor: 0x1a237e,
    statBoosts: { strength: 2, constitution: 1 },
    primaryStat: "strength",
    hitDie: 10,
    spells: [],
    abilities: ["shieldBash", "actionSurge", "secondWind", "championStrike", "fastTravel", "evac", "shortRest"],
    weaponSprite: "sword",
    startingWeaponId: "startSword",
    clothingStyle: "heavy",
    startingGoldDice: 5,
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
      "huntersMark", "goodberry", "cureWounds",
      "spikeGrowth",
      "swiftQuiver",
    ],
    abilities: ["aimedShot", "huntersMark", "naturesRemedy", "deadeye", "fastTravel", "evac", "shortRest"],
    weaponSprite: "bow",
    startingWeaponId: "startBow",
    clothingStyle: "leather",
    startingGoldDice: 5,
  },
  {
    id: "wizard", label: "Wizard",
    description: "A scholarly arcanist who masters arcane magic through study and intellect.",
    playstyle: "Ranged Magic DPS / Control",
    bodyColor: 0x283593, skinColor: 0xffccbc, legColor: 0x1a237e,
    statBoosts: { intelligence: 2, wisdom: 1 },
    primaryStat: "intelligence",
    hitDie: 6,
    spells: [
      "fireBolt", "rayOfFrost",
      "magicMissile", "thunderwave",
      "scorchingRay",
      "fireball", "lightningBolt",
      "iceStorm",
      "coneOfCold",
      "chainLightning", "disintegrate",
      "meteorSwarm", "powerWordKill",
      "teleport",
    ],
    abilities: ["evac", "shortRest"],
    weaponSprite: "staff",
    startingWeaponId: "startStaff",
    clothingStyle: "robe",
    startingGoldDice: 4,
  },
  {
    id: "sorcerer", label: "Sorcerer",
    description: "A natural-born wielder of chaotic arcane power, fueled by innate magic.",
    playstyle: "Ranged Magic DPS / Burst",
    bodyColor: 0xc62828, skinColor: 0xffd8cc, legColor: 0x8e0000,
    statBoosts: { charisma: 2, constitution: 1 },
    primaryStat: "charisma",
    hitDie: 6,
    spells: [
      "fireBolt", "shockingGrasp",
      "magicMissile", "thunderwave",
      "scorchingRay",
      "fireball", "lightningBolt",
      "coneOfCold",
      "chainLightning", "disintegrate",
      "meteorSwarm", "powerWordKill",
      "teleport",
    ],
    abilities: ["evac", "shortRest"],
    weaponSprite: "staff",
    startingWeaponId: "startStaff",
    clothingStyle: "robe",
    startingGoldDice: 3,
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
    abilities: ["sneakAttack", "sneakStance", "cunningStrike", "shadowStep", "assassinate", "fastTravel", "evac", "shortRest"],
    weaponSprite: "dagger",
    startingWeaponId: "startDagger",
    clothingStyle: "leather",
    startingGoldDice: 4,
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
      "wordOfRadiance", "cureWounds", "healingWord",
      "greaterHeal",
      "destructiveWave",
    ],
    abilities: ["smite", "layOnHands", "holyStrike", "greaterSmite", "evac", "shortRest"],
    weaponSprite: "sword",
    startingWeaponId: "startSword",
    clothingStyle: "heavy",
    startingGoldDice: 5,
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
      "eldritchBlast",
      "hexCurse", "hellishRebuke",
      "hungerOfHadar",
      "hypnoticPattern",
      "coneOfCold",
      "disintegrate",
      "powerWordKill",
      "teleport",
    ],
    abilities: ["evac", "shortRest"],
    weaponSprite: "staff",
    startingWeaponId: "startStaff",
    clothingStyle: "robe",
    startingGoldDice: 4,
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
      "sacredFlame", "tollTheDead",
      "cureWounds", "healingWord", "guidingBolt",
      "spiritualWeapon",
      "spiritGuardians",
      "flameStrike", "massCureWounds",
      "heal", "harm", "bladeBarrier",
      "regenerate", "massHeal",
      "teleport",
    ],
    abilities: ["evac", "shortRest"],
    weaponSprite: "mace",
    startingWeaponId: "startMace",
    clothingStyle: "vestment",
    startingGoldDice: 5,
  },
  {
    id: "druid", label: "Druid",
    description: "A guardian of nature who wields primal magic and fights with bestial ferocity.",
    playstyle: "Melee / Caster Hybrid",
    bodyColor: 0x33691e, skinColor: 0xd7ccc8, legColor: 0x1b5e20,
    statBoosts: { wisdom: 2, constitution: 1 },
    primaryStat: "wisdom",
    hitDie: 8,
    spells: [
      "produceFlame",
      "goodberry", "cureWounds", "healingWord", "thunderwave",
      "moonbeam", "spikeGrowth",
      "callLightning",
      "iceStorm",
      "heal", "sunbeam",
      "fireStorm", "regenerate",
      "teleport",
    ],
    abilities: ["thornWhip", "wildShape", "naturesWrath", "primalStrike", "evac", "shortRest"],
    weaponSprite: "staff",
    startingWeaponId: "startStaff",
    clothingStyle: "leather",
    startingGoldDice: 4,
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
    abilities: ["recklessStrike", "enrage", "rage", "endure", "titansBlow", "fastTravel", "evac", "shortRest"],
    weaponSprite: "axe",
    startingWeaponId: "startAxe",
    clothingStyle: "bare",
    startingGoldDice: 2,
  },
  {
    id: "monk", label: "Monk",
    description: "A disciplined martial artist who channels ki through unarmed combat.",
    playstyle: "Melee DPS / Skirmisher",
    bodyColor: 0xff8f00, skinColor: 0xffccbc, legColor: 0xe65100,
    statBoosts: { dexterity: 2, wisdom: 1 },
    primaryStat: "dexterity",
    hitDie: 8,
    spells: [],
    abilities: ["flurryOfBlows", "kiStrike", "patientDefense", "stunningStrike", "fastTravel", "evac", "shortRest"],
    weaponSprite: "fist",
    startingWeaponId: "startDagger",
    clothingStyle: "wrap",
    startingGoldDice: 5,
  },
  {
    id: "bard", label: "Bard",
    description: "A charismatic performer whose music weaves magic, inspiration, and cutting wit.",
    playstyle: "Support / Versatile Caster",
    bodyColor: 0x7b1fa2, skinColor: 0xffccbc, legColor: 0x4a148c,
    statBoosts: { charisma: 2, dexterity: 1 },
    primaryStat: "charisma",
    hitDie: 8,
    spells: [
      "viciousMockery",
      "cureWounds", "healingWord", "dissonantWhispers", "thunderwave",
      "shatter",
      "hypnoticPattern",
      "greaterHeal", "massCureWounds",
      "heal",
      "teleport",
    ],
    abilities: ["bardicInspiration", "cuttingWords", "evac", "shortRest"],
    weaponSprite: "sword",
    startingWeaponId: "startRapier",
    clothingStyle: "performer",
    startingGoldDice: 5,
  },
];

/** Look up a class definition by its ID. Falls back to Knight. */
export function getPlayerClass(classId: string): PlayerClass {
  return PLAYER_CLASSES.find((c) => c.id === classId) ?? PLAYER_CLASSES[0];
}

/** Get the spell IDs available for a class. */
export function getClassSpells(classId: string): string[] {
  return getPlayerClass(classId).spells;
}

/** Get the ability IDs available for a class. */
export function getClassAbilities(classId: string): string[] {
  return getPlayerClass(classId).abilities;
}

/** Determine the weapon sprite type for the player's current equipment. */
export function getActiveWeaponSprite(
  classId: string,
  equippedWeapon: { weaponSprite?: string } | null | undefined
): "sword" | "staff" | "dagger" | "bow" | "mace" | "axe" | "fist" {
  if (equippedWeapon?.weaponSprite) {
    return equippedWeapon.weaponSprite as "sword" | "staff" | "dagger" | "bow" | "mace" | "axe" | "fist";
  }
  return getPlayerClass(classId).weaponSprite;
}
