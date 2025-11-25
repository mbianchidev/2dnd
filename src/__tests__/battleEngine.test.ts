import { describe, expect, it } from 'vitest'
import { BattleEngine } from '../core/battle/BattleEngine'
import { ContentRegistry } from '../contentRegistry'
import { HERO_ID } from '../data/actors'

describe('ContentRegistry', () => {
  it('returns known content', () => {
    expect(ContentRegistry.actor(HERO_ID).name).toBe('Hero')
    expect(ContentRegistry.monster('slime').name).toBe('Blue Slime')
    expect(ContentRegistry.skill('basic_attack').name).toBe('Attack')
  })
})

describe('BattleEngine', () => {
  it('hero defeats slime with basic attacks', () => {
    const engine = new BattleEngine(HERO_ID, 'slime')

    // Simulate turns until battle ends (player acting each time)
    let guard = 0
    while (!engine.isBattleOver() && guard++ < 10) {
      engine.playerAttack()
    }

    expect(engine.isBattleOver()).toBe(true)
    expect(engine.winner).toBe('player')
    expect(engine.hero.stats.hp).toBeGreaterThan(0)
    expect(engine.enemy.stats.hp).toBe(0)
    expect(engine.log.length).toBeGreaterThan(0)
  })
})
