/**
 * D&D-style dice rolling utilities.
 * Supports standard notation: d4, d6, d8, d10, d12, d20, d100
 */

export type DieType = 4 | 6 | 8 | 10 | 12 | 20 | 100;

/** Roll a single die of the given type (1 to sides inclusive). */
export function rollDie(sides: DieType): number {
  return Math.floor(Math.random() * sides) + 1;
}

/** Roll multiple dice and return the total. E.g. rollDice(2, 6) = 2d6. */
export function rollDice(count: number, sides: DieType): number {
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += rollDie(sides);
  }
  return total;
}

/** Roll multiple dice and return individual results. */
export function rollDiceDetailed(
  count: number,
  sides: DieType
): { rolls: number[]; total: number } {
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(rollDie(sides));
  }
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) };
}

/** D20 roll with modifier, returns { roll, modifier, total }. */
export function rollD20(modifier: number = 0) {
  const roll = rollDie(20);
  return { roll, modifier, total: roll + modifier };
}

/** Roll with advantage (roll 2d20, take higher) + modifier. */
export function rollWithAdvantage(modifier: number = 0) {
  const roll1 = rollDie(20);
  const roll2 = rollDie(20);
  const best = Math.max(roll1, roll2);
  return { roll1, roll2, chosen: best, modifier, total: best + modifier };
}

/** Calculate ability modifier from ability score (D&D 5e formula). */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}
