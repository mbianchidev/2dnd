/**
 * Martial / physical abilities for non-caster classes.
 * These work like spells but use STR or DEX for the attack roll.
 */

import type { DieType } from "../utils/dice";

export interface Ability {
  id: string;
  name: string;
  description: string;
  mpCost: number;
  levelRequired: number;
  damageCount: number;
  damageDie: DieType;
  type: "damage" | "heal" | "utility";
  /** Which stat drives the attack roll. */
  statKey: "strength" | "dexterity";
}

export const ABILITIES: Ability[] = [
  // ── Knight (STR) ─────────────────────────────────────────────
  {
    id: "shieldBash", name: "Shield Bash",
    description: "Slam your shield into the foe",
    mpCost: 2, levelRequired: 1, damageCount: 1, damageDie: 8,
    type: "damage", statKey: "strength",
  },
  {
    id: "powerAttack", name: "Power Attack",
    description: "A devastating overhead strike",
    mpCost: 5, levelRequired: 5, damageCount: 2, damageDie: 10,
    type: "damage", statKey: "strength",
  },
  {
    id: "secondWind", name: "Second Wind",
    description: "Catch your breath and recover",
    mpCost: 6, levelRequired: 9, damageCount: 3, damageDie: 8,
    type: "heal", statKey: "strength",
  },
  {
    id: "championStrike", name: "Champion Strike",
    description: "A blow worthy of legends",
    mpCost: 12, levelRequired: 15, damageCount: 4, damageDie: 10,
    type: "damage", statKey: "strength",
  },

  // ── Ranger (DEX) ─────────────────────────────────────────────
  {
    id: "aimedShot", name: "Aimed Shot",
    description: "Take careful aim at a weak point",
    mpCost: 2, levelRequired: 1, damageCount: 1, damageDie: 10,
    type: "damage", statKey: "dexterity",
  },
  {
    id: "huntersMark", name: "Hunter's Mark",
    description: "Mark the prey for extra damage",
    mpCost: 5, levelRequired: 5, damageCount: 2, damageDie: 8,
    type: "damage", statKey: "dexterity",
  },
  {
    id: "naturesRemedy", name: "Nature's Remedy",
    description: "Use herbs to mend wounds",
    mpCost: 6, levelRequired: 9, damageCount: 3, damageDie: 6,
    type: "heal", statKey: "dexterity",
  },
  {
    id: "deadeye", name: "Deadeye",
    description: "An arrow that never misses its mark",
    mpCost: 12, levelRequired: 15, damageCount: 5, damageDie: 8,
    type: "damage", statKey: "dexterity",
  },

  // ── Rogue (DEX) ──────────────────────────────────────────────
  {
    id: "sneakAttack", name: "Sneak Attack",
    description: "Strike from the shadows",
    mpCost: 2, levelRequired: 1, damageCount: 2, damageDie: 6,
    type: "damage", statKey: "dexterity",
  },
  {
    id: "cunningStrike", name: "Cunning Strike",
    description: "Exploit an opening in their defense",
    mpCost: 5, levelRequired: 5, damageCount: 3, damageDie: 6,
    type: "damage", statKey: "dexterity",
  },
  {
    id: "shadowStep", name: "Shadow Step",
    description: "Vanish and recover in the shadows",
    mpCost: 6, levelRequired: 9, damageCount: 2, damageDie: 8,
    type: "heal", statKey: "dexterity",
  },
  {
    id: "assassinate", name: "Assassinate",
    description: "A lethal strike to a vital point",
    mpCost: 12, levelRequired: 15, damageCount: 6, damageDie: 6,
    type: "damage", statKey: "dexterity",
  },

  // ── Paladin (STR) ────────────────────────────────────────────
  {
    id: "smite", name: "Divine Smite",
    description: "Channel radiant energy into your strike",
    mpCost: 2, levelRequired: 1, damageCount: 1, damageDie: 8,
    type: "damage", statKey: "strength",
  },
  {
    id: "layOnHands", name: "Lay on Hands",
    description: "Heal with divine touch",
    mpCost: 4, levelRequired: 4, damageCount: 3, damageDie: 8,
    type: "heal", statKey: "strength",
  },
  {
    id: "holyStrike", name: "Holy Strike",
    description: "A blazing blow of righteous fury",
    mpCost: 7, levelRequired: 9, damageCount: 3, damageDie: 8,
    type: "damage", statKey: "strength",
  },
  {
    id: "greaterSmite", name: "Greater Smite",
    description: "Unleash the full wrath of your deity",
    mpCost: 12, levelRequired: 15, damageCount: 5, damageDie: 8,
    type: "damage", statKey: "strength",
  },

  // ── Barbarian (STR) ──────────────────────────────────────────
  {
    id: "recklessStrike", name: "Reckless Strike",
    description: "Throw caution to the wind",
    mpCost: 2, levelRequired: 1, damageCount: 2, damageDie: 6,
    type: "damage", statKey: "strength",
  },
  {
    id: "rage", name: "Rage",
    description: "Enter a berserker fury",
    mpCost: 5, levelRequired: 5, damageCount: 3, damageDie: 8,
    type: "damage", statKey: "strength",
  },
  {
    id: "endure", name: "Endure",
    description: "Shrug off pain through sheer will",
    mpCost: 6, levelRequired: 9, damageCount: 3, damageDie: 8,
    type: "heal", statKey: "strength",
  },
  {
    id: "titansBlow", name: "Titan's Blow",
    description: "A strike that shakes the earth",
    mpCost: 12, levelRequired: 15, damageCount: 5, damageDie: 10,
    type: "damage", statKey: "strength",
  },

  // ── Fast Travel (all classes) ────────────────────────────────
  {
    id: "fastTravel", name: "Fast Travel",
    description: "Travel instantly to a known town",
    mpCost: 5, levelRequired: 5, damageCount: 0, damageDie: 4,
    type: "utility", statKey: "dexterity",
  },
];

/** Look up an ability by ID. */
export function getAbility(id: string): Ability | undefined {
  return ABILITIES.find((a) => a.id === id);
}
