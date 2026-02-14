/**
 * Passive talents that all classes unlock at certain levels.
 * One-time stat bonuses (HP/MP) are applied when unlocked.
 * Combat bonuses (attack, damage, AC) are calculated dynamically.
 */

export interface Talent {
  id: string;
  name: string;
  description: string;
  levelRequired: number;
  /** One-time max HP bonus applied on unlock. */
  maxHpBonus?: number;
  /** One-time max MP bonus applied on unlock. */
  maxMpBonus?: number;
  /** Dynamic: added to attack/spell rolls. */
  attackBonus?: number;
  /** Dynamic: added to all damage dealt. */
  damageBonus?: number;
  /** Dynamic: added to AC. */
  acBonus?: number;
  /** If set, only these class IDs can learn this talent. Empty = all classes. */
  classRestriction?: string[];
}

export const TALENTS: Talent[] = [
  {
    id: "toughness", name: "Toughness",
    description: "+5 max HP",
    levelRequired: 3,
    maxHpBonus: 5,
  },
  {
    id: "combatTraining", name: "Combat Training",
    description: "+1 to attack rolls",
    levelRequired: 6,
    attackBonus: 1,
  },
  {
    id: "resilience", name: "Resilience",
    description: "+10 max HP, +3 max MP",
    levelRequired: 10,
    maxHpBonus: 10, maxMpBonus: 3,
  },
  {
    id: "deadlyPrecision", name: "Deadly Precision",
    description: "+2 damage on attacks",
    levelRequired: 14,
    damageBonus: 2,
  },
  {
    id: "legendary", name: "Legendary",
    description: "+1 AC, +2 to attack rolls",
    levelRequired: 18,
    acBonus: 1, attackBonus: 2,
  },
  {
    id: "twoWeaponFighting", name: "Two-Weapon Fighting",
    description: "Add ability modifier to off-hand attack damage when dual wielding",
    levelRequired: 2,
    classRestriction: ["knight", "rogue", "bard", "monk"],
  },
];

/** Look up a talent by ID. */
export function getTalent(id: string): Talent | undefined {
  return TALENTS.find((t) => t.id === id);
}

/** Sum all attack bonuses from known talents. */
export function getTalentAttackBonus(knownTalents: string[]): number {
  return TALENTS
    .filter((t) => knownTalents.includes(t.id))
    .reduce((sum, t) => sum + (t.attackBonus ?? 0), 0);
}

/** Sum all damage bonuses from known talents. */
export function getTalentDamageBonus(knownTalents: string[]): number {
  return TALENTS
    .filter((t) => knownTalents.includes(t.id))
    .reduce((sum, t) => sum + (t.damageBonus ?? 0), 0);
}

/** Sum all AC bonuses from known talents. */
export function getTalentACBonus(knownTalents: string[]): number {
  return TALENTS
    .filter((t) => knownTalents.includes(t.id))
    .reduce((sum, t) => sum + (t.acBonus ?? 0), 0);
}
