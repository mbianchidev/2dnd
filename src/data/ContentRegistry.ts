import { actors, getActor } from './actors'
import { monsters, getMonster } from './monsters'
import { items, getItem } from './items'
import { skills, getSkill } from './skills'
import { quests, getQuest } from './quests'

/**
 * ContentRegistry - centralized access and validation for all game data
 */
export class ContentRegistry {
  private static instance: ContentRegistry

  private constructor() {
    // Validate all data on initialization
    this.validateData()
  }

  static getInstance(): ContentRegistry {
    if (!ContentRegistry.instance) {
      ContentRegistry.instance = new ContentRegistry()
    }
    return ContentRegistry.instance
  }

  // Actors
  getActor(id: string) {
    return getActor(id)
  }

  getAllActors() {
    return Object.values(actors)
  }

  hasActor(id: string): boolean {
    return id in actors
  }

  // Monsters
  getMonster(id: string) {
    return getMonster(id)
  }

  getAllMonsters() {
    return Object.values(monsters)
  }

  hasMonster(id: string): boolean {
    return id in monsters
  }

  // Items
  getItem(id: string) {
    return getItem(id)
  }

  getAllItems() {
    return Object.values(items)
  }

  hasItem(id: string): boolean {
    return id in items
  }

  // Skills
  getSkill(id: string) {
    return getSkill(id)
  }

  getAllSkills() {
    return Object.values(skills)
  }

  hasSkill(id: string): boolean {
    return id in skills
  }

  // Quests
  getQuest(id: string) {
    return getQuest(id)
  }

  getAllQuests() {
    return Object.values(quests)
  }

  hasQuest(id: string): boolean {
    return id in quests
  }

  /**
   * Validate all game data for consistency
   */
  private validateData(): void {
    const errors: string[] = []

    // Validate monster skills exist
    for (const monster of Object.values(monsters)) {
      for (const skillId of monster.skills) {
        if (!(skillId in skills)) {
          errors.push(`Monster "${monster.id}" references unknown skill "${skillId}"`)
        }
      }
    }

    // Validate actor skills exist
    for (const actor of Object.values(actors)) {
      for (const skillId of actor.skills) {
        if (!(skillId in skills)) {
          errors.push(`Actor "${actor.id}" references unknown skill "${skillId}"`)
        }
      }
    }

    // Validate monster drop items exist
    for (const monster of Object.values(monsters)) {
      if (monster.dropTable) {
        for (const drop of monster.dropTable) {
          if (!(drop.itemId in items)) {
            errors.push(`Monster "${monster.id}" drops unknown item "${drop.itemId}"`)
          }
        }
      }
    }

    // Validate quest items exist
    for (const quest of Object.values(quests)) {
      if (quest.rewards.items) {
        for (const reward of quest.rewards.items) {
          if (!(reward.itemId in items)) {
            errors.push(`Quest "${quest.id}" rewards unknown item "${reward.itemId}"`)
          }
        }
      }

      // Validate objective targets
      for (const objective of quest.objectives) {
        if (objective.type === 'defeat' && objective.targetId) {
          if (!(objective.targetId in monsters)) {
            errors.push(`Quest "${quest.id}" objective targets unknown monster "${objective.targetId}"`)
          }
        }
        if (objective.type === 'collect' && objective.targetId) {
          if (!(objective.targetId in items)) {
            errors.push(`Quest "${quest.id}" objective targets unknown item "${objective.targetId}"`)
          }
        }
      }

      // Validate prerequisite quests exist
      if (quest.prerequisiteQuests) {
        for (const prereqId of quest.prerequisiteQuests) {
          if (!(prereqId in quests)) {
            errors.push(`Quest "${quest.id}" has unknown prerequisite quest "${prereqId}"`)
          }
        }
      }
    }

    if (errors.length > 0) {
      console.error('Content validation errors:')
      errors.forEach((e) => console.error(`  - ${e}`))

      if (import.meta.env.DEV) {
        // In development, throw to catch issues early
        throw new Error(`Content validation failed with ${errors.length} error(s)`)
      }
    }
  }
}

// Export singleton instance
export const registry = ContentRegistry.getInstance()
