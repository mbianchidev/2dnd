// D&D dice rolling utilities

/**
 * Roll dice using D&D notation (e.g., "1d20", "2d6+3", "1d8-1")
 */
export function rollDice(notation: string): number {
  const regex = /(\d+)d(\d+)([+-]\d+)?/;
  const match = notation.match(regex);
  
  if (!match) {
    console.error('Invalid dice notation:', notation);
    return 0;
  }
  
  const numDice = parseInt(match[1]);
  const diceSize = parseInt(match[2]);
  const modifier = match[3] ? parseInt(match[3]) : 0;
  
  let total = modifier;
  for (let i = 0; i < numDice; i++) {
    total += Math.floor(Math.random() * diceSize) + 1;
  }
  
  return total;
}

/**
 * Roll a d20 for checks (attacks, saves, etc.)
 */
export function rollD20(): number {
  return rollDice('1d20');
}

/**
 * Calculate ability modifier from ability score
 */
export function getAbilityModifier(abilityScore: number): number {
  return Math.floor((abilityScore - 10) / 2);
}

/**
 * Calculate armor class based on dexterity and equipment
 */
export function calculateAC(dexterity: number, armorBonus: number = 10): number {
  return armorBonus + getAbilityModifier(dexterity);
}

/**
 * Calculate experience needed for next level
 */
export function experienceForLevel(level: number): number {
  // Simple progression: level * 1000
  return level * 1000;
}

/**
 * Calculate initiative (d20 + dexterity modifier)
 */
export function rollInitiative(dexterity: number): number {
  return rollD20() + getAbilityModifier(dexterity);
}
