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

  // ── Knight talents (Fighter) ──────────────────────────────────
  {
    id: "improvedCritical", name: "Improved Critical",
    description: "+1 attack, +1 damage — expanded crit training",
    levelRequired: 4,
    attackBonus: 1, damageBonus: 1,
    classRestriction: ["knight"],
  },
  {
    id: "indomitable", name: "Indomitable",
    description: "+10 max HP, +1 AC — unyielding resolve",
    levelRequired: 9,
    maxHpBonus: 10, acBonus: 1,
    classRestriction: ["knight"],
  },
  {
    id: "superiorDefense", name: "Superior Defense",
    description: "+2 AC — mastery of defensive combat",
    levelRequired: 13,
    acBonus: 2,
    classRestriction: ["knight"],
  },

  // ── Ranger talents ────────────────────────────────────────────
  {
    id: "favoredFoe", name: "Favored Foe",
    description: "+2 damage — exploit prey weakness",
    levelRequired: 4,
    damageBonus: 2,
    classRestriction: ["ranger"],
  },
  {
    id: "naturalExplorer", name: "Natural Explorer",
    description: "+5 max HP, +5 max MP — wilderness endurance",
    levelRequired: 8,
    maxHpBonus: 5, maxMpBonus: 5,
    classRestriction: ["ranger"],
  },
  {
    id: "foeSlayer", name: "Foe Slayer",
    description: "+2 attack, +1 damage — pinnacle hunter",
    levelRequired: 13,
    attackBonus: 2, damageBonus: 1,
    classRestriction: ["ranger"],
  },

  // ── Mage talents ──────────────────────────────────────────────
  {
    id: "arcaneWard", name: "Arcane Ward",
    description: "+5 max MP — reserve of arcane energy",
    levelRequired: 4,
    maxMpBonus: 5,
    classRestriction: ["mage"],
  },
  {
    id: "spellMastery", name: "Spell Mastery",
    description: "+2 attack — focused spell precision",
    levelRequired: 8,
    attackBonus: 2,
    classRestriction: ["mage"],
  },
  {
    id: "overchannel", name: "Overchannel",
    description: "+3 damage — push spells beyond limits",
    levelRequired: 13,
    damageBonus: 3,
    classRestriction: ["mage"],
  },

  // ── Rogue talents ─────────────────────────────────────────────
  {
    id: "cunningAction", name: "Cunning Action",
    description: "+1 AC — dash, dodge, and disengage in combat",
    levelRequired: 4,
    acBonus: 1,
    classRestriction: ["rogue"],
  },
  {
    id: "uncannyDodge", name: "Uncanny Dodge",
    description: "+1 AC, +5 max HP — instinctive evasion",
    levelRequired: 8,
    acBonus: 1, maxHpBonus: 5,
    classRestriction: ["rogue"],
  },
  {
    id: "elusive", name: "Elusive",
    description: "+2 AC — impossible to pin down",
    levelRequired: 13,
    acBonus: 2,
    classRestriction: ["rogue"],
  },

  // ── Paladin talents ───────────────────────────────────────────
  {
    id: "divineHealth", name: "Divine Health",
    description: "+10 max HP — sacred constitution",
    levelRequired: 4,
    maxHpBonus: 10,
    classRestriction: ["paladin"],
  },
  {
    id: "auraOfProtection", name: "Aura of Protection",
    description: "+1 AC, +5 max HP — divine protective aura",
    levelRequired: 8,
    acBonus: 1, maxHpBonus: 5,
    classRestriction: ["paladin"],
  },
  {
    id: "improvedSmite", name: "Improved Smite",
    description: "+3 damage — infuse every strike with radiance",
    levelRequired: 13,
    damageBonus: 3,
    classRestriction: ["paladin"],
  },

  // ── Warlock talents ───────────────────────────────────────────
  {
    id: "eldritchInvocation", name: "Eldritch Invocation",
    description: "+1 attack, +1 damage — pact boon mastery",
    levelRequired: 4,
    attackBonus: 1, damageBonus: 1,
    classRestriction: ["warlock"],
  },
  {
    id: "darkOnesBlessing", name: "Dark One's Blessing",
    description: "+10 max HP — patron's vitality gift",
    levelRequired: 8,
    maxHpBonus: 10,
    classRestriction: ["warlock"],
  },
  {
    id: "mysticArcanum", name: "Mystic Arcanum",
    description: "+3 damage, +5 max MP — access higher patron power",
    levelRequired: 13,
    damageBonus: 3, maxMpBonus: 5,
    classRestriction: ["warlock"],
  },

  // ── Cleric talents ────────────────────────────────────────────
  {
    id: "channelDivinity", name: "Channel Divinity",
    description: "+5 max MP, +1 attack — divine power channel",
    levelRequired: 4,
    maxMpBonus: 5, attackBonus: 1,
    classRestriction: ["cleric"],
  },
  {
    id: "blessedHealer", name: "Blessed Healer",
    description: "+10 max HP — divine endurance",
    levelRequired: 8,
    maxHpBonus: 10,
    classRestriction: ["cleric"],
  },
  {
    id: "divineIntervention", name: "Divine Intervention",
    description: "+2 attack, +1 AC — godly favor",
    levelRequired: 13,
    attackBonus: 2, acBonus: 1,
    classRestriction: ["cleric"],
  },

  // ── Barbarian talents ─────────────────────────────────────────
  {
    id: "ragePower", name: "Rage Power",
    description: "+2 damage — fury-fueled strikes",
    levelRequired: 4,
    damageBonus: 2,
    classRestriction: ["barbarian"],
  },
  {
    id: "dangerSense", name: "Danger Sense",
    description: "+1 AC, +5 max HP — primal threat detection",
    levelRequired: 8,
    acBonus: 1, maxHpBonus: 5,
    classRestriction: ["barbarian"],
  },
  {
    id: "brutalCritical", name: "Brutal Critical",
    description: "+3 damage — devastating critical blows",
    levelRequired: 13,
    damageBonus: 3,
    classRestriction: ["barbarian"],
  },

  // ── Monk talents ──────────────────────────────────────────────
  {
    id: "deflectMissiles", name: "Deflect Missiles",
    description: "+1 AC — catch and redirect projectiles",
    levelRequired: 4,
    acBonus: 1,
    classRestriction: ["monk"],
  },
  {
    id: "monkEvasion", name: "Evasion",
    description: "+1 AC, +5 max HP — dodge area attacks",
    levelRequired: 8,
    acBonus: 1, maxHpBonus: 5,
    classRestriction: ["monk"],
  },
  {
    id: "diamondSoul", name: "Diamond Soul",
    description: "+2 AC — proficiency in resisting all effects",
    levelRequired: 13,
    acBonus: 2,
    classRestriction: ["monk"],
  },

  // ── Bard talents ──────────────────────────────────────────────
  {
    id: "songOfRest", name: "Song of Rest",
    description: "+5 max HP, +5 max MP — soothing melodies",
    levelRequired: 4,
    maxHpBonus: 5, maxMpBonus: 5,
    classRestriction: ["bard"],
  },
  {
    id: "countercharm", name: "Countercharm",
    description: "+1 AC, +1 attack — magical counter-melody",
    levelRequired: 8,
    acBonus: 1, attackBonus: 1,
    classRestriction: ["bard"],
  },
  {
    id: "superiorInspiration", name: "Superior Inspiration",
    description: "+2 attack, +2 damage — inspiring mastery",
    levelRequired: 13,
    attackBonus: 2, damageBonus: 2,
    classRestriction: ["bard"],
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
