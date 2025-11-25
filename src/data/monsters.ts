import type { MonsterData } from '../types'

export const monsters: Record<string, MonsterData> = {
  slime: {
    id: 'slime',
    name: 'Slime',
    level: 1,
    stats: {
      maxHp: 8,
      hp: 8,
      attack: 4,
      defense: 2,
      speed: 3,
    },
    skills: ['basic_attack'],
    experienceReward: 3,
    goldReward: { dice: 'd6', count: 1, modifier: 1 },
    dropTable: [{ itemId: 'slime_jelly', chance: 0.3 }],
    behavior: 'aggressive',
    spriteKey: 'monster_slime',
  },

  goblin: {
    id: 'goblin',
    name: 'Goblin',
    level: 2,
    stats: {
      maxHp: 12,
      hp: 12,
      attack: 6,
      defense: 3,
      speed: 5,
    },
    skills: ['basic_attack', 'goblin_slash'],
    experienceReward: 8,
    goldReward: { dice: 'd6', count: 2, modifier: 2 },
    dropTable: [
      { itemId: 'herb', chance: 0.2 },
      { itemId: 'rusty_dagger', chance: 0.1 },
    ],
    behavior: 'aggressive',
    spriteKey: 'monster_goblin',
  },

  skeleton: {
    id: 'skeleton',
    name: 'Skeleton',
    level: 3,
    stats: {
      maxHp: 15,
      hp: 15,
      attack: 8,
      defense: 4,
      speed: 4,
    },
    skills: ['basic_attack', 'bone_throw'],
    experienceReward: 12,
    goldReward: { dice: 'd8', count: 1, modifier: 3 },
    dropTable: [{ itemId: 'bone', chance: 0.4 }],
    behavior: 'aggressive',
    spriteKey: 'monster_skeleton',
  },

  giant_spider: {
    id: 'giant_spider',
    name: 'Giant Spider',
    level: 4,
    stats: {
      maxHp: 20,
      hp: 20,
      attack: 7,
      defense: 3,
      speed: 8,
    },
    skills: ['basic_attack', 'web_spit', 'venomous_bite'],
    experienceReward: 18,
    goldReward: { dice: 'd6', count: 2 },
    dropTable: [
      { itemId: 'spider_silk', chance: 0.35 },
      { itemId: 'antidote', chance: 0.15 },
    ],
    behavior: 'aggressive',
    spriteKey: 'monster_spider',
  },

  orc: {
    id: 'orc',
    name: 'Orc',
    level: 5,
    stats: {
      maxHp: 35,
      hp: 35,
      attack: 12,
      defense: 6,
      speed: 4,
    },
    skills: ['basic_attack', 'power_strike', 'war_cry'],
    experienceReward: 25,
    goldReward: { dice: 'd10', count: 2, modifier: 5 },
    dropTable: [
      { itemId: 'orc_tusk', chance: 0.25 },
      { itemId: 'iron_axe', chance: 0.08 },
    ],
    behavior: 'aggressive',
    spriteKey: 'monster_orc',
  },

  // Mini-boss
  goblin_chief: {
    id: 'goblin_chief',
    name: 'Goblin Chief',
    level: 5,
    stats: {
      maxHp: 50,
      hp: 50,
      attack: 10,
      defense: 5,
      speed: 6,
    },
    skills: ['basic_attack', 'power_strike', 'call_minions'],
    experienceReward: 50,
    goldReward: { dice: 'd20', count: 2, modifier: 10 },
    dropTable: [{ itemId: 'chief_crown', chance: 1.0 }],
    behavior: 'scripted',
    isBoss: true,
    spriteKey: 'monster_goblin_chief',
  },
}

export function getMonster(id: string): MonsterData {
  const monster = monsters[id]
  if (!monster) {
    throw new Error(`Monster not found: ${id}`)
  }
  // Return a deep copy to allow independent state per battle
  return {
    ...monster,
    stats: { ...monster.stats },
    skills: [...monster.skills],
    dropTable: monster.dropTable?.map((d) => ({ ...d })),
  }
}

export function getMonstersByLevel(minLevel: number, maxLevel: number): MonsterData[] {
  return Object.values(monsters).filter((m) => m.level >= minLevel && m.level <= maxLevel)
}

export function getRandomMonster(minLevel: number, maxLevel: number): MonsterData | null {
  const eligible = getMonstersByLevel(minLevel, maxLevel)
  if (eligible.length === 0) return null
  const index = Math.floor(Math.random() * eligible.length)
  return getMonster(eligible[index].id)
}
