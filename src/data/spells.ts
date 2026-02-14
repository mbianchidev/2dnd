/**
 * Spell definitions with level requirements for unlocking.
 */

import type { DieType } from "../utils/dice";

export interface Spell {
  id: string;
  name: string;
  description: string;
  mpCost: number;
  levelRequired: number;
  damageCount: number; // number of dice
  damageDie: DieType; // die type
  type: "damage" | "heal" | "utility";
}

export const SPELLS: Spell[] = [
  {
    id: "fireBolt",
    name: "Fire Bolt",
    description: "Hurl a bolt of fire at a foe",
    mpCost: 2,
    levelRequired: 1,
    damageCount: 1,
    damageDie: 10,
    type: "damage",
  },
  {
    id: "eldritchBlast",
    name: "Eldritch Blast",
    description: "A beam of crackling eldritch energy",
    mpCost: 2,
    levelRequired: 1,
    damageCount: 1,
    damageDie: 10,
    type: "damage",
  },
  {
    id: "sacredFlame",
    name: "Sacred Flame",
    description: "Radiant flame descends on a foe",
    mpCost: 2,
    levelRequired: 1,
    damageCount: 1,
    damageDie: 8,
    type: "damage",
  },
  {
    id: "cureWounds",
    name: "Cure Wounds",
    description: "Heal wounds with divine magic",
    mpCost: 3,
    levelRequired: 2,
    damageCount: 1,
    damageDie: 8,
    type: "heal",
  },
  {
    id: "magicMissile",
    name: "Magic Missile",
    description: "Three darts of magical force",
    mpCost: 3,
    levelRequired: 3,
    damageCount: 3,
    damageDie: 4,
    type: "damage",
  },
  {
    id: "thunderwave",
    name: "Thunderwave",
    description: "A wave of thunderous force",
    mpCost: 4,
    levelRequired: 4,
    damageCount: 2,
    damageDie: 8,
    type: "damage",
  },
  {
    id: "hexCurse",
    name: "Hex",
    description: "Curse a foe, dealing necrotic damage",
    mpCost: 3,
    levelRequired: 3,
    damageCount: 2,
    damageDie: 6,
    type: "damage",
  },
  {
    id: "healingWord",
    name: "Healing Word",
    description: "Quick healing incantation",
    mpCost: 4,
    levelRequired: 5,
    damageCount: 2,
    damageDie: 8,
    type: "heal",
  },
  {
    id: "spiritGuardians",
    name: "Spirit Guardians",
    description: "Spectral spirits swirl and strike nearby foes",
    mpCost: 7,
    levelRequired: 7,
    damageCount: 3,
    damageDie: 8,
    type: "damage",
  },
  {
    id: "fireball",
    name: "Fireball",
    description: "A bright streak explodes into flame",
    mpCost: 7,
    levelRequired: 7,
    damageCount: 8,
    damageDie: 6,
    type: "damage",
  },
  {
    id: "hungerOfHadar",
    name: "Hunger of Hadar",
    description: "A sphere of blackness and bitter cold",
    mpCost: 7,
    levelRequired: 7,
    damageCount: 4,
    damageDie: 6,
    type: "damage",
  },
  {
    id: "greaterHeal",
    name: "Greater Heal",
    description: "Powerful restorative magic",
    mpCost: 8,
    levelRequired: 9,
    damageCount: 4,
    damageDie: 8,
    type: "heal",
  },
  {
    id: "arcaneRecovery",
    name: "Arcane Recovery",
    description: "Channel arcane energy to restore vitality",
    mpCost: 6,
    levelRequired: 9,
    damageCount: 3,
    damageDie: 8,
    type: "heal",
  },
  {
    id: "lightningBolt",
    name: "Lightning Bolt",
    description: "A stroke of lightning in a line",
    mpCost: 7,
    levelRequired: 10,
    damageCount: 8,
    damageDie: 6,
    type: "damage",
  },
  {
    id: "iceStorm",
    name: "Ice Storm",
    description: "Hail and freezing rain pound the area",
    mpCost: 9,
    levelRequired: 11,
    damageCount: 2,
    damageDie: 8,
    type: "damage",
  },
  {
    id: "massHealingWord",
    name: "Mass Healing Word",
    description: "Healing energy washes over allies",
    mpCost: 8,
    levelRequired: 12,
    damageCount: 3,
    damageDie: 8,
    type: "heal",
  },
  {
    id: "coneOfCold",
    name: "Cone of Cold",
    description: "A blast of cold air erupts from your hands",
    mpCost: 10,
    levelRequired: 13,
    damageCount: 8,
    damageDie: 8,
    type: "damage",
  },
  {
    id: "heal",
    name: "Heal",
    description: "A surge of positive energy cures wounds",
    mpCost: 12,
    levelRequired: 14,
    damageCount: 7,
    damageDie: 10,
    type: "heal",
  },
  {
    id: "chainLightning",
    name: "Chain Lightning",
    description: "Lightning arcs between targets",
    mpCost: 12,
    levelRequired: 15,
    damageCount: 10,
    damageDie: 8,
    type: "damage",
  },
  {
    id: "disintegrate",
    name: "Disintegrate",
    description: "A thin green ray reduces the target to dust",
    mpCost: 14,
    levelRequired: 16,
    damageCount: 10,
    damageDie: 6,
    type: "damage",
  },
  {
    id: "regenerate",
    name: "Regenerate",
    description: "Touch restores body and spirit",
    mpCost: 14,
    levelRequired: 17,
    damageCount: 4,
    damageDie: 8,
    type: "heal",
  },
  {
    id: "meteorSwarm",
    name: "Meteor Swarm",
    description: "Blazing orbs of fire plummet from the sky",
    mpCost: 20,
    levelRequired: 19,
    damageCount: 24,
    damageDie: 6,
    type: "damage",
  },
  {
    id: "powerWordHeal",
    name: "Power Word Heal",
    description: "A word of power restores all vitality",
    mpCost: 18,
    levelRequired: 20,
    damageCount: 10,
    damageDie: 10,
    type: "heal",
  },
  // ── Bard-exclusive spells ─────────────────────────────────────
  {
    id: "viciousMockery",
    name: "Vicious Mockery",
    description: "A string of insults laced with subtle enchantment",
    mpCost: 2,
    levelRequired: 1,
    damageCount: 1,
    damageDie: 6,
    type: "damage",
  },
  {
    id: "dissonantWhispers",
    name: "Dissonant Whispers",
    description: "A discordant melody that wracks the target with pain",
    mpCost: 4,
    levelRequired: 3,
    damageCount: 3,
    damageDie: 6,
    type: "damage",
  },
  {
    id: "hypnoticPattern",
    name: "Hypnotic Pattern",
    description: "A mesmerizing pattern of light that sears the mind",
    mpCost: 8,
    levelRequired: 9,
    damageCount: 4,
    damageDie: 8,
    type: "damage",
  },

  // ── Utility (all classes) ─────────────────────────────────────
  {
    id: "shortRest",
    name: "Short Rest",
    description: "Take a quick rest to recover 50% HP and MP",
    mpCost: 0,
    levelRequired: 1,
    damageCount: 0,
    damageDie: 4,
    type: "utility",
  },

  // ── Utility (casters only) ────────────────────────────────────
  {
    id: "teleport",
    name: "Teleport",
    description: "Instantly travel to a known town",
    mpCost: 8,
    levelRequired: 5,
    damageCount: 0,
    damageDie: 4,
    type: "utility",
  },
];

/** Look up a spell by ID. */
export function getSpell(id: string): Spell | undefined {
  return SPELLS.find((s) => s.id === id);
}

/** Get all spells available at a given player level. */
export function getAvailableSpells(level: number): Spell[] {
  return SPELLS.filter((s) => s.levelRequired <= level);
}
