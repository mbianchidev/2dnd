import type { Skill } from '../types'

export const skills: Record<string, Skill> = {
  basic_attack: {
    id: 'basic_attack',
    name: 'Attack',
    description: 'A basic physical strike.',
    power: 1,
  },
}

export function getSkill(id: string): Skill {
  const skill = skills[id]
  if (!skill) {
    throw new Error(`Skill not found: ${id}`)
  }
  return skill
}
