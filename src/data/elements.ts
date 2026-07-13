/**
 * Elemental damage types, resistances, weaknesses, and immunities.
 */

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

export interface ElementalProfile {
  resistances?: Element[];
  weaknesses?: Element[];
  immunities?: Element[];
}

export type ElementalInteraction = "" | "immune" | "weak" | "resistant";

export interface ElementalDamageResult {
  damage: number;
  interaction: ElementalInteraction;
}

/** Apply a target's elemental profile to incoming damage. */
export function applyElementalModifier(
  baseDamage: number,
  attackElement: Element | undefined,
  target: ElementalProfile | undefined,
): ElementalDamageResult {
  if (!attackElement || !target) {
    return { damage: baseDamage, interaction: "" };
  }
  if (target.immunities?.includes(attackElement)) {
    return { damage: 0, interaction: "immune" };
  }
  if (target.weaknesses?.includes(attackElement)) {
    return { damage: baseDamage * 2, interaction: "weak" };
  }
  if (target.resistances?.includes(attackElement)) {
    return { damage: Math.floor(baseDamage / 2), interaction: "resistant" };
  }
  return { damage: baseDamage, interaction: "" };
}

/** Return whether a runtime value is a supported element. */
export function isElement(value: unknown): value is Element {
  return Object.values(Element).includes(value as Element);
}

/** Human-readable element name for display. */
export function elementDisplayName(element: Element): string {
  return element.charAt(0).toUpperCase() + element.slice(1);
}
