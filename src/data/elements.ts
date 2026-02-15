/**
 * Elemental damage types, resistances, weaknesses, and immunities.
 *
 * Resistances halve incoming damage of that element.
 * Weaknesses double incoming damage of that element.
 * Immunities negate incoming damage of that element entirely.
 */

/** Damage element types used by spells, abilities, weapons, and monster attacks. */
export enum Element {
  Fire = "fire",
  Ice = "ice",
  Lightning = "lightning",
  Poison = "poison",
  Necrotic = "necrotic",
  Radiant = "radiant",
  Thunder = "thunder",
  Force = "force",
  Psychic = "psychic",
}

/** Elemental profile for a monster, item, or ability. */
export interface ElementalProfile {
  resistances?: Element[];
  weaknesses?: Element[];
  immunities?: Element[];
}

/**
 * Apply elemental damage modifier based on a target's elemental profile.
 *
 * Returns the modified damage and a label describing the interaction.
 * - Immunity: damage → 0
 * - Resistance: damage → floor(damage / 2)
 * - Weakness: damage → damage * 2
 * - Neutral: damage unchanged
 */
export function applyElementalModifier(
  baseDamage: number,
  attackElement: Element | undefined,
  target: ElementalProfile | undefined,
): { damage: number; label: string } {
  if (!attackElement || !target) {
    return { damage: baseDamage, label: "" };
  }

  if (target.immunities?.includes(attackElement)) {
    return { damage: 0, label: "immune" };
  }
  if (target.weaknesses?.includes(attackElement)) {
    return { damage: baseDamage * 2, label: "weak" };
  }
  if (target.resistances?.includes(attackElement)) {
    return { damage: Math.floor(baseDamage / 2), label: "resistant" };
  }

  return { damage: baseDamage, label: "" };
}

/** Human-readable element name for display. */
export function elementDisplayName(element: Element): string {
  return element.charAt(0).toUpperCase() + element.slice(1);
}
