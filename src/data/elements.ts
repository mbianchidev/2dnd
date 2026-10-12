/**
 * Elemental damage types, resistances, weaknesses, and immunities.
 */

import { applyDamageProfile } from "./damageTypes";
import type { DamageInteraction, DamageProfile } from "./damageTypes";

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

export interface ElementalProfile extends DamageProfile<Element> {}

export type ElementalInteraction = DamageInteraction;

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
  return applyDamageProfile(baseDamage, attackElement, target);
}

/** Return whether a runtime value is a supported element. */
export function isElement(value: unknown): value is Element {
  return Object.values(Element).includes(value as Element);
}

/** Human-readable element name for display. */
export function elementDisplayName(element: Element): string {
  return element.charAt(0).toUpperCase() + element.slice(1);
}
