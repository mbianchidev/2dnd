import { ContentRegistry } from '../../contentRegistry'
import type { StatBlock } from '../../types'
import { HERO_ID } from '../../data/actors'

export class GameState {
  heroId = HERO_ID
  heroStats: StatBlock

  constructor() {
    const hero = ContentRegistry.actor(this.heroId)
    this.heroStats = { ...hero.stats }
  }

  resetHero(): void {
    const hero = ContentRegistry.actor(this.heroId)
    this.heroStats = { ...hero.stats }
  }
}

export const gameState = new GameState()
