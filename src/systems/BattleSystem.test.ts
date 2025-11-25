import { describe, it, expect, beforeEach } from 'vitest'

import { BattleSystem } from './BattleSystem'
import type { ActorData, MonsterData } from '../types'

const mockHero: ActorData = {
  id: 'hero',
  name: 'Hero',
  stats: {
    maxHp: 30,
    hp: 30,
    maxMp: 10,
    mp: 10,
    attack: 10,
    defense: 5,
    speed: 8,
  },
  skills: ['basic_attack'],
}

const mockSlime: MonsterData = {
  id: 'slime_1',
  name: 'Slime',
  level: 1,
  stats: {
    maxHp: 10,
    hp: 10,
    attack: 5,
    defense: 2,
    speed: 3,
  },
  skills: ['basic_attack'],
  experienceReward: 5,
  goldReward: 3,
}

describe('BattleSystem', () => {
  let battleSystem: BattleSystem

  beforeEach(() => {
    battleSystem = new BattleSystem([{ ...mockHero, stats: { ...mockHero.stats } }], [{ ...mockSlime, stats: { ...mockSlime.stats } }])
  })

  describe('initialization', () => {
    it('should initialize with party and enemies', () => {
      expect(battleSystem.getParty()).toHaveLength(1)
      expect(battleSystem.getEnemies()).toHaveLength(1)
    })

    it('should not mutate original actor data', () => {
      const originalHp = mockHero.stats.hp
      battleSystem.executePlayerAction({
        type: 'attack',
        actorId: 'hero',
        targetIds: ['slime_1'],
      })
      expect(mockHero.stats.hp).toBe(originalHp)
    })
  })

  describe('victory/defeat detection', () => {
    it('should detect victory when all enemies are defeated', () => {
      const enemies = battleSystem.getEnemies()
      enemies[0].stats.hp = 0
      expect(battleSystem.isVictory()).toBe(true)
    })

    it('should detect defeat when all party members are down', () => {
      const party = battleSystem.getParty()
      party[0].stats.hp = 0
      expect(battleSystem.isDefeat()).toBe(true)
    })

    it('should not detect victory if enemies remain', () => {
      expect(battleSystem.isVictory()).toBe(false)
    })
  })

  describe('attack action', () => {
    it('should deal damage to target', () => {
      const result = battleSystem.executePlayerAction({
        type: 'attack',
        actorId: 'hero',
        targetIds: ['slime_1'],
      })

      const enemy = battleSystem.getEnemies()[0]
      // Either hit for damage or missed
      if (!result.missed) {
        expect(enemy.stats.hp).toBeLessThan(mockSlime.stats.hp)
      }
    })

    it('should not reduce HP below 0', () => {
      // Attack many times to ensure death
      for (let i = 0; i < 10; i++) {
        battleSystem.executePlayerAction({
          type: 'attack',
          actorId: 'hero',
          targetIds: ['slime_1'],
        })
      }

      const enemy = battleSystem.getEnemies()[0]
      expect(enemy.stats.hp).toBeGreaterThanOrEqual(0)
    })
  })

  describe('defend action', () => {
    it('should set defending status', () => {
      const result = battleSystem.executePlayerAction({
        type: 'defend',
        actorId: 'hero',
      })

      expect(result.message).toContain('defending')
    })
  })

  describe('flee attempt', () => {
    it('should return boolean for flee attempt', () => {
      const result = battleSystem.attemptFlee()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('rewards calculation', () => {
    it('should calculate experience and gold from defeated enemies', () => {
      const enemies = battleSystem.getEnemies()
      enemies[0].stats.hp = 0

      const rewards = battleSystem.getRewards()
      expect(rewards.experience).toBeGreaterThan(0)
      expect(rewards.gold).toBeGreaterThanOrEqual(0)
    })

    it('should return zero rewards if no enemies defeated', () => {
      const rewards = battleSystem.getRewards()
      expect(rewards.experience).toBe(0)
    })
  })

  describe('enemy AI', () => {
    it('should generate actions for all alive enemies', () => {
      const actions = battleSystem.getEnemyActions()
      expect(actions).toHaveLength(1) // One slime
    })

    it('should target alive party members', () => {
      const actions = battleSystem.getEnemyActions()
      // Should have attacked the hero
      expect(actions[0].message).toContain('Slime')
    })
  })
})
