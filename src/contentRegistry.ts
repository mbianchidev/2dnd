import { getActor } from './data/actors'
import { getMonster } from './data/monsters'
import { getSkill } from './data/skills'
import type { ActorData, MonsterData, Skill } from './types'

export const ContentRegistry = {
  actor(id: string): ActorData {
    return getActor(id)
  },
  monster(id: string): MonsterData {
    return getMonster(id)
  },
  skill(id: string): Skill {
    return getSkill(id)
  },
}
