import type { SkillData } from '../types'

export const skills: Record<string, SkillData> = {
  // ==========================================================================
  // BASIC SKILLS (Available to all)
  // ==========================================================================
  basic_attack: {
    id: 'basic_attack',
    name: 'Attack',
    description: 'A basic physical attack.',
    type: 'physical',
    mpCost: 0,
    targetType: 'single_enemy',
    damageType: 'physical',
    power: 100, // 100% of attack stat
    accuracy: 95,
    criticalChance: 5,
    animation: 'slash',
  },

  defend: {
    id: 'defend',
    name: 'Defend',
    description: 'Take a defensive stance, reducing damage taken this turn by 50%.',
    type: 'support',
    mpCost: 0,
    targetType: 'self',
    damageType: 'none',
    effects: [
      {
        type: 'stat_mod',
        statMod: { stat: 'defense', modifier: 100, duration: 1 }, // +100% defense for 1 turn
      },
    ],
    animation: 'guard',
  },

  // ==========================================================================
  // PHYSICAL SKILLS
  // ==========================================================================
  power_strike: {
    id: 'power_strike',
    name: 'Power Strike',
    description: 'A powerful overhead slash. Deals 150% damage.',
    type: 'physical',
    mpCost: 4,
    targetType: 'single_enemy',
    damageType: 'physical',
    power: 150,
    accuracy: 90,
    criticalChance: 10,
    animation: 'heavy_slash',
  },

  double_slash: {
    id: 'double_slash',
    name: 'Double Slash',
    description: 'Strike twice in quick succession. Each hit deals 60% damage.',
    type: 'physical',
    mpCost: 6,
    targetType: 'single_enemy',
    damageType: 'physical',
    power: { dice: 'd6', count: 2, modifier: 0 }, // Roll damage twice
    accuracy: 85,
    criticalChance: 8,
    animation: 'double_slash',
  },

  whirlwind: {
    id: 'whirlwind',
    name: 'Whirlwind',
    description: 'Spin attack hitting all enemies for 80% damage.',
    type: 'physical',
    mpCost: 8,
    targetType: 'all_enemies',
    damageType: 'physical',
    power: 80,
    accuracy: 85,
    criticalChance: 5,
    animation: 'spin_attack',
  },

  // ==========================================================================
  // MAGICAL SKILLS
  // ==========================================================================
  fire_bolt: {
    id: 'fire_bolt',
    name: 'Fire Bolt',
    description: 'Launch a bolt of fire at an enemy.',
    type: 'magical',
    mpCost: 5,
    targetType: 'single_enemy',
    damageType: 'fire',
    power: 120,
    accuracy: 95,
    criticalChance: 5,
    animation: 'fire',
  },

  ice_shard: {
    id: 'ice_shard',
    name: 'Ice Shard',
    description: 'Hurl a shard of ice. May slow the target.',
    type: 'magical',
    mpCost: 5,
    targetType: 'single_enemy',
    damageType: 'ice',
    power: 100,
    accuracy: 95,
    criticalChance: 5,
    effects: [{ type: 'status', status: { type: 'speed_down', duration: 3, chance: 30 } }],
    animation: 'ice',
  },

  lightning: {
    id: 'lightning',
    name: 'Lightning',
    description: 'Call down a bolt of lightning.',
    type: 'magical',
    mpCost: 8,
    targetType: 'single_enemy',
    damageType: 'lightning',
    power: 140,
    accuracy: 90,
    criticalChance: 10,
    animation: 'lightning',
  },

  fireball: {
    id: 'fireball',
    name: 'Fireball',
    description: 'Explosive fire magic hitting all enemies.',
    type: 'magical',
    mpCost: 12,
    targetType: 'all_enemies',
    damageType: 'fire',
    power: 100,
    accuracy: 90,
    criticalChance: 5,
    animation: 'explosion',
  },

  // ==========================================================================
  // SUPPORT SKILLS
  // ==========================================================================
  heal: {
    id: 'heal',
    name: 'Heal',
    description: 'Restore HP to an ally.',
    type: 'support',
    mpCost: 6,
    targetType: 'single_ally',
    damageType: 'none',
    effects: [{ type: 'heal', value: { dice: 'd8', count: 2, modifier: 5 } }],
    animation: 'heal',
  },

  cure: {
    id: 'cure',
    name: 'Cure',
    description: 'Remove poison and other ailments from an ally.',
    type: 'support',
    mpCost: 4,
    targetType: 'single_ally',
    damageType: 'none',
    effects: [{ type: 'status', status: { type: 'poison', duration: 0, chance: 100 } }], // duration 0 = remove
    animation: 'purify',
  },

  protect: {
    id: 'protect',
    name: 'Protect',
    description: "Boost an ally's defense for 3 turns.",
    type: 'support',
    mpCost: 5,
    targetType: 'single_ally',
    damageType: 'none',
    effects: [{ type: 'stat_mod', statMod: { stat: 'defense', modifier: 50, duration: 3 } }],
    animation: 'buff',
  },

  haste: {
    id: 'haste',
    name: 'Haste',
    description: "Boost an ally's speed for 3 turns.",
    type: 'support',
    mpCost: 5,
    targetType: 'single_ally',
    damageType: 'none',
    effects: [{ type: 'stat_mod', statMod: { stat: 'speed', modifier: 50, duration: 3 } }],
    animation: 'buff',
  },

  // ==========================================================================
  // MONSTER SKILLS
  // ==========================================================================
  goblin_slash: {
    id: 'goblin_slash',
    name: 'Goblin Slash',
    description: 'A crude but effective slash.',
    type: 'physical',
    mpCost: 0,
    targetType: 'single_enemy',
    damageType: 'physical',
    power: 110,
    accuracy: 85,
    criticalChance: 5,
    animation: 'slash',
  },

  bone_throw: {
    id: 'bone_throw',
    name: 'Bone Throw',
    description: 'Throws a bone at the target.',
    type: 'physical',
    mpCost: 0,
    targetType: 'single_enemy',
    damageType: 'physical',
    power: 90,
    accuracy: 90,
    criticalChance: 3,
    animation: 'throw',
  },

  web_spit: {
    id: 'web_spit',
    name: 'Web Spit',
    description: 'Spits sticky web. May slow the target.',
    type: 'special',
    mpCost: 0,
    targetType: 'single_enemy',
    damageType: 'none',
    power: 50,
    accuracy: 80,
    effects: [{ type: 'status', status: { type: 'speed_down', duration: 2, chance: 60 } }],
    animation: 'web',
  },

  venomous_bite: {
    id: 'venomous_bite',
    name: 'Venomous Bite',
    description: 'A poisonous bite that may inflict poison.',
    type: 'physical',
    mpCost: 0,
    targetType: 'single_enemy',
    damageType: 'physical',
    power: 100,
    accuracy: 85,
    criticalChance: 5,
    effects: [{ type: 'status', status: { type: 'poison', duration: 5, chance: 40 } }],
    animation: 'bite',
  },

  war_cry: {
    id: 'war_cry',
    name: 'War Cry',
    description: 'A terrifying battle cry that boosts attack.',
    type: 'support',
    mpCost: 0,
    targetType: 'self',
    damageType: 'none',
    effects: [{ type: 'stat_mod', statMod: { stat: 'attack', modifier: 30, duration: 3 } }],
    animation: 'roar',
  },

  call_minions: {
    id: 'call_minions',
    name: 'Call Minions',
    description: 'Summon goblin reinforcements.',
    type: 'special',
    mpCost: 0,
    targetType: 'self',
    damageType: 'none',
    // Special handling in battle system to spawn additional enemies
    animation: 'summon',
  },
}

export function getSkill(id: string): SkillData {
  const skill = skills[id]
  if (!skill) {
    throw new Error(`Skill not found: ${id}`)
  }
  return skill
}

export function getSkillsByType(type: SkillData['type']): SkillData[] {
  return Object.values(skills).filter((skill) => skill.type === type)
}

export function getPlayerSkills(): SkillData[] {
  // Return skills that are meant for player characters (exclude monster-only skills)
  const monsterOnlySkills = ['goblin_slash', 'bone_throw', 'web_spit', 'venomous_bite', 'war_cry', 'call_minions']
  return Object.values(skills).filter((skill) => !monsterOnlySkills.includes(skill.id))
}
