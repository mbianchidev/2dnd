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
  type: "damage" | "heal";
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
    id: "greaterHeal",
    name: "Greater Heal",
    description: "Powerful restorative magic",
    mpCost: 8,
    levelRequired: 9,
    damageCount: 4,
    damageDie: 8,
    type: "heal",
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
