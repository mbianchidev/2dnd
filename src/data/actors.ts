import type { ActorData } from '../types'

export const HERO_ID = 'hero'

export const actors: Record<string, ActorData> = {
  [HERO_ID]: {
    id: HERO_ID,
    name: 'Hero',
    stats: {
      maxHp: 30,
      hp: 30,
      maxMp: 10,
      mp: 10,
      attack: 8,
      defense: 5,
      speed: 6,
      magic: 4,
      magicDefense: 4,
      luck: 5,
    },
    attributes: {
      strength: 12,
      dexterity: 10,
      constitution: 12,
      intelligence: 8,
      wisdom: 10,
      charisma: 10,
    },
    skills: ['basic_attack', 'power_strike'],
    spriteKey: 'hero',
    portrait: 'hero_portrait',
  },
}

export function getActor(id: string): ActorData {
  const actor = actors[id]
  if (!actor) {
    throw new Error(`Actor not found: ${id}`)
  }
  return { ...actor, stats: { ...actor.stats } } // Return a copy to avoid mutation
}

export function createActorInstance(id: string): ActorData {
  return getActor(id)
}
