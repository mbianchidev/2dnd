import type { MonsterData } from '../types'

export const monsters: Record<string, MonsterData> = {
  slime: {
    id: 'slime',
    name: 'Blue Slime',
    stats: {
      maxHp: 10,
      hp: 10,
      attack: 4,
      defense: 1,
      speed: 3,
    },
    skills: ['basic_attack'],
    xpReward: 5,
    goldReward: 3,
  },
}

export function getMonster(id: string): MonsterData {
  const monster = monsters[id]
  if (!monster) {
    throw new Error(`Monster not found: ${id}`)
  }
  return monster
}
