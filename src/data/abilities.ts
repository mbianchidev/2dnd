/**
 * Martial / physical abilities for non-caster classes.
 * These work like spells but use STR or DEX for the attack roll.
 */

import type { DieType } from "../systems/dice";

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
  statKey: "strength" | "dexterity" | "wisdom" | "charisma";
  /** If true, this ability is a bonus action and does not end the turn. */
  bonusAction?: boolean;
}

export const ABILITIES: Ability[] = [
  // ── Knight / Fighter (STR) ────────────────────────────────────
  {
    id: "shieldBash", name: "Shield Bash",
    description: "Slam your shield into the foe, stunning them",
    mpCost: 2, levelRequired: 1, damageCount: 1, damageDie: 8,
    type: "damage", statKey: "strength",
  },
  {
    id: "actionSurge", name: "Action Surge",
    description: "Push beyond your limits for a devastating strike",
    mpCost: 5, levelRequired: 5, damageCount: 2, damageDie: 10,
    type: "damage", statKey: "strength",
  },
  {
    id: "secondWind", name: "Second Wind",
    description: "Catch your breath and recover in combat",
    mpCost: 6, levelRequired: 9, damageCount: 3, damageDie: 8,
    type: "heal", statKey: "strength",
  },
  {
    id: "championStrike", name: "Champion Strike",
    description: "A legendary blow that cleaves through armor",
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
    description: "Mark your prey for extra damage",
    mpCost: 5, levelRequired: 5, damageCount: 2, damageDie: 8,
    type: "damage", statKey: "dexterity",
  },
  {
    id: "naturesRemedy", name: "Nature's Remedy",
    description: "Use herbal knowledge to mend wounds",
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
    description: "Strike from the shadows for devastating damage",
    mpCost: 2, levelRequired: 1, damageCount: 2, damageDie: 6,
    type: "damage", statKey: "dexterity",
  },
  {
    id: "cunningStrike", name: "Cunning Strike",
    description: "Exploit an opening with lightning reflexes",
    mpCost: 5, levelRequired: 5, damageCount: 3, damageDie: 6,
    type: "damage", statKey: "dexterity",
  },
  {
    id: "shadowStep", name: "Shadow Step",
    description: "Vanish into darkness and recover",
    mpCost: 6, levelRequired: 9, damageCount: 2, damageDie: 8,
    type: "heal", statKey: "dexterity",
  },
  {
    id: "assassinate", name: "Assassinate",
    description: "A lethal strike to a vital point — pure lethality",
    mpCost: 12, levelRequired: 15, damageCount: 6, damageDie: 6,
    type: "damage", statKey: "dexterity",
  },

  // ── Paladin (STR) ────────────────────────────────────────────
  {
    id: "smite", name: "Divine Smite",
    description: "Channel radiant energy into your weapon strike",
    mpCost: 2, levelRequired: 1, damageCount: 1, damageDie: 8,
    type: "damage", statKey: "strength",
  },
  {
    id: "layOnHands", name: "Lay on Hands",
    description: "Heal with a blessed divine touch",
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
    description: "Unleash the full wrath of your oath",
    mpCost: 12, levelRequired: 15, damageCount: 5, damageDie: 8,
    type: "damage", statKey: "strength",
  },

  // ── Barbarian (STR) ──────────────────────────────────────────
  {
    id: "recklessStrike", name: "Reckless Attack",
    description: "Throw caution to the wind for a wild strike",
    mpCost: 2, levelRequired: 1, damageCount: 2, damageDie: 6,
    type: "damage", statKey: "strength",
  },
  {
    id: "enrage", name: "Enrage",
    description: "Channel fury to recover health through sheer rage (bonus action)",
    mpCost: 3, levelRequired: 3, damageCount: 2, damageDie: 6,
    type: "heal", statKey: "strength",
    bonusAction: true,
  },
  {
    id: "rage", name: "Rage",
    description: "Enter a berserker fury, dealing massive damage",
    mpCost: 5, levelRequired: 5, damageCount: 3, damageDie: 8,
    type: "damage", statKey: "strength",
  },
  {
    id: "endure", name: "Relentless Endurance",
    description: "Shrug off pain through sheer primal will",
    mpCost: 6, levelRequired: 9, damageCount: 3, damageDie: 8,
    type: "heal", statKey: "strength",
  },
  {
    id: "titansBlow", name: "Titan's Blow",
    description: "A strike that shakes the earth itself",
    mpCost: 12, levelRequired: 15, damageCount: 5, damageDie: 10,
    type: "damage", statKey: "strength",
  },

  // ── Monk (DEX / WIS) ─────────────────────────────────────────
  {
    id: "flurryOfBlows", name: "Flurry of Blows",
    description: "Unleash a rapid series of unarmed strikes",
    mpCost: 2, levelRequired: 1, damageCount: 2, damageDie: 6,
    type: "damage", statKey: "dexterity",
  },
  {
    id: "kiStrike", name: "Ki Strike",
    description: "Channel ki energy into a powerful blow",
    mpCost: 5, levelRequired: 5, damageCount: 3, damageDie: 6,
    type: "damage", statKey: "dexterity",
  },
  {
    id: "patientDefense", name: "Patient Defense",
    description: "Focus your ki to mend body and spirit",
    mpCost: 6, levelRequired: 9, damageCount: 3, damageDie: 6,
    type: "heal", statKey: "wisdom",
  },
  {
    id: "stunningStrike", name: "Stunning Strike",
    description: "Strike a pressure point with devastating precision",
    mpCost: 10, levelRequired: 15, damageCount: 5, damageDie: 8,
    type: "damage", statKey: "dexterity",
  },

  // ── Bard (CHA) ────────────────────────────────────────────────
  {
    id: "bardicInspiration", name: "Bardic Inspiration",
    description: "Inspire yourself with a rousing melody, restoring vigor",
    mpCost: 2, levelRequired: 1, damageCount: 1, damageDie: 8,
    type: "heal", statKey: "charisma",
    bonusAction: true,
  },
  {
    id: "cuttingWords", name: "Cutting Words",
    description: "Hurl a magically laced insult that wounds body and pride",
    mpCost: 5, levelRequired: 5, damageCount: 2, damageDie: 8,
    type: "damage", statKey: "charisma",
  },

  // ── Fast Travel (all classes) ────────────────────────────────
  {
    id: "fastTravel", name: "Fast Travel",
    description: "Travel instantly to a known town",
    mpCost: 5, levelRequired: 5, damageCount: 0, damageDie: 0,
    type: "utility", statKey: "dexterity",
  },
];

/** Look up an ability by ID. */
export function getAbility(id: string): Ability | undefined {
  return ABILITIES.find((a) => a.id === id);
}
