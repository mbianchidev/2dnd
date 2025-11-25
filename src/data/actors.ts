import type { ActorData } from '../types'

export const HERO_ID = 'hero'

export const actors: Record<string, ActorData> = {
  [HERO_ID]: {
    id: HERO_ID,
    name: 'Hero',
    stats: {
      maxHp: 20,
      hp: 20,
      attack: 6,
      defense: 3,
      speed: 5,
    },
    skills: ['basic_attack'],
  },
}

export function getActor(id: string): ActorData {
  const actor = actors[id]
  if (!actor) {
    throw new Error(`Actor not found: ${id}`)
  }
  return actor
}
