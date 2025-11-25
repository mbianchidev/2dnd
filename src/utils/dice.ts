import type { DiceRoll, RollResult, DieType } from '../types'

/**
 * Roll a single die
 */
export function rollDie(die: DieType): number {
  const sides = parseInt(die.substring(1))
  return Math.floor(Math.random() * sides) + 1
}

/**
 * Roll multiple dice with optional modifier
 */
export function rollDice(roll: DiceRoll): RollResult {
  const sides = parseInt(roll.dice.substring(1))
  const rolls: number[] = []

  for (let i = 0; i < roll.count; i++) {
    rolls.push(Math.floor(Math.random() * sides) + 1)
  }

  const total = rolls.reduce((sum, r) => sum + r, 0) + (roll.modifier || 0)

  return {
    rolls,
    total,
    critical: roll.dice === 'd20' && rolls.some((r) => r === 20),
    fumble: roll.dice === 'd20' && rolls.some((r) => r === 1),
  }
}

/**
 * Roll a d20 for ability checks, attack rolls, saving throws
 */
export function rollD20(modifier = 0): RollResult {
  return rollDice({ dice: 'd20', count: 1, modifier })
}

/**
 * Roll with advantage (take higher of two d20s)
 */
export function rollAdvantage(modifier = 0): RollResult {
  const roll1 = rollDie('d20')
  const roll2 = rollDie('d20')
  const chosen = Math.max(roll1, roll2)

  return {
    rolls: [roll1, roll2],
    total: chosen + modifier,
    critical: chosen === 20,
    fumble: chosen === 1,
  }
}

/**
 * Roll with disadvantage (take lower of two d20s)
 */
export function rollDisadvantage(modifier = 0): RollResult {
  const roll1 = rollDie('d20')
  const roll2 = rollDie('d20')
  const chosen = Math.min(roll1, roll2)

  return {
    rolls: [roll1, roll2],
    total: chosen + modifier,
    critical: chosen === 20,
    fumble: chosen === 1,
  }
}

/**
 * Parse a dice string like "2d6+3" into a DiceRoll object
 */
export function parseDiceString(diceStr: string): DiceRoll {
  const match = diceStr.match(/(\d+)d(\d+)([+-]\d+)?/)
  if (!match) {
    throw new Error(`Invalid dice string: ${diceStr}`)
  }

  const count = parseInt(match[1])
  const die = `d${match[2]}` as DieType
  const modifier = match[3] ? parseInt(match[3]) : 0

  return { dice: die, count, modifier }
}

/**
 * Format a DiceRoll object as a string
 */
export function formatDiceRoll(roll: DiceRoll): string {
  let str = `${roll.count}${roll.dice}`
  if (roll.modifier) {
    str += roll.modifier > 0 ? `+${roll.modifier}` : roll.modifier.toString()
  }
  return str
}
