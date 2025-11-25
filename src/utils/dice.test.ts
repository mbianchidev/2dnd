import { describe, it, expect } from 'vitest'

import { rollDice, rollD20, parseDiceString, formatDiceRoll } from '../utils/dice'

describe('Dice System', () => {
  describe('rollDice', () => {
    it('should roll the correct number of dice', () => {
      const result = rollDice({ dice: 'd6', count: 3 })
      expect(result.rolls).toHaveLength(3)
    })

    it('should respect dice bounds', () => {
      for (let i = 0; i < 100; i++) {
        const result = rollDice({ dice: 'd6', count: 1 })
        expect(result.rolls[0]).toBeGreaterThanOrEqual(1)
        expect(result.rolls[0]).toBeLessThanOrEqual(6)
      }
    })

    it('should apply modifiers correctly', () => {
      const result = rollDice({ dice: 'd6', count: 2, modifier: 5 })
      const expectedMin = 2 + 5 // 2 ones + modifier
      const expectedMax = 12 + 5 // 2 sixes + modifier
      expect(result.total).toBeGreaterThanOrEqual(expectedMin)
      expect(result.total).toBeLessThanOrEqual(expectedMax)
    })

    it('should detect critical hits on d20', () => {
      // Run many rolls to eventually hit a 20
      let foundCritical = false
      for (let i = 0; i < 1000 && !foundCritical; i++) {
        const result = rollDice({ dice: 'd20', count: 1 })
        if (result.rolls[0] === 20) {
          expect(result.critical).toBe(true)
          foundCritical = true
        }
      }
    })
  })

  describe('rollD20', () => {
    it('should return a single d20 roll', () => {
      const result = rollD20()
      expect(result.rolls).toHaveLength(1)
      expect(result.rolls[0]).toBeGreaterThanOrEqual(1)
      expect(result.rolls[0]).toBeLessThanOrEqual(20)
    })

    it('should apply modifier', () => {
      const result = rollD20(5)
      expect(result.total).toBe(result.rolls[0] + 5)
    })
  })

  describe('parseDiceString', () => {
    it('should parse simple dice notation', () => {
      const result = parseDiceString('2d6')
      expect(result).toEqual({ dice: 'd6', count: 2, modifier: 0 })
    })

    it('should parse dice with positive modifier', () => {
      const result = parseDiceString('1d20+5')
      expect(result).toEqual({ dice: 'd20', count: 1, modifier: 5 })
    })

    it('should parse dice with negative modifier', () => {
      const result = parseDiceString('3d8-2')
      expect(result).toEqual({ dice: 'd8', count: 3, modifier: -2 })
    })

    it('should throw on invalid notation', () => {
      expect(() => parseDiceString('invalid')).toThrow()
    })
  })

  describe('formatDiceRoll', () => {
    it('should format simple rolls', () => {
      expect(formatDiceRoll({ dice: 'd6', count: 2 })).toBe('2d6')
    })

    it('should format rolls with positive modifier', () => {
      expect(formatDiceRoll({ dice: 'd20', count: 1, modifier: 3 })).toBe('1d20+3')
    })

    it('should format rolls with negative modifier', () => {
      expect(formatDiceRoll({ dice: 'd8', count: 2, modifier: -1 })).toBe('2d8-1')
    })
  })
})
