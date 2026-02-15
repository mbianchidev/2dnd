/**
 * Status effects system for combat and overworld.
 * Manages application, removal, ticking, and stacking of effects
 * on both players and monsters.
 */

import { rollD20, abilityModifier } from "./dice";
import type { PlayerStats } from "./player";

// ── Status Effect Types ────────────────────────────────────────

/** All supported status effect IDs. */
export type StatusEffectId =
  | "poison"
  | "burn"
  | "freeze"
  | "paralysis"
  | "stunned"
  | "frightened"
  | "slow"
  | "prone"
  | "asleep"
  | "confused"
  | "enraged"
  | "haste"
  | "rage"
  | "sneakStance";

/** Classification of effect behavior. */
export type StatusEffectCategory = "debuff" | "buff";

/** How the effect is removed. */
export type RemovalMethod = "duration" | "save" | "cure" | "manual";

/** Definition of a status effect template. */
export interface StatusEffectDef {
  id: StatusEffectId;
  name: string;
  description: string;
  category: StatusEffectCategory;
  /** Default duration in turns (0 = until manually removed). */
  defaultDuration: number;
  /** Damage per tick (0 = no tick damage). */
  tickDamage: number;
  /** Die type for tick damage (0 = flat damage from tickDamage). */
  tickDie: number;
  /** Accuracy penalty applied to attack rolls while active. */
  accuracyPenalty: number;
  /** AC modifier while active (positive = bonus, negative = penalty). */
  acModifier: number;
  /** Damage modifier while active (positive = bonus, negative = penalty). */
  damageModifier: number;
  /** If true, the affected entity skips their turn. */
  skipsTurn: boolean;
  /** Stat used for saving throw to resist/end the effect. */
  saveStat: keyof PlayerStats;
  /** DC for the saving throw. */
  saveDC: number;
  /** Which methods can remove this effect. */
  removalMethods: RemovalMethod[];
  /** Item ID that cures this effect (if any). */
  cureItemId?: string;
}

/** An active status effect instance on a combatant. */
export interface ActiveStatusEffect {
  id: StatusEffectId;
  remainingTurns: number;
  /** Source of the effect (e.g., "monster", "self", ability name). */
  source: string;
}

// ── Status Effect Definitions ──────────────────────────────────

export const STATUS_EFFECT_DEFS: StatusEffectDef[] = [
  {
    id: "poison", name: "Poisoned", description: "Taking damage each turn, disadvantage on attacks",
    category: "debuff", defaultDuration: 3, tickDamage: 2, tickDie: 4,
    accuracyPenalty: -2, acModifier: 0, damageModifier: 0, skipsTurn: false,
    saveStat: "constitution", saveDC: 12,
    removalMethods: ["duration", "save", "cure"], cureItemId: "antidote",
  },
  {
    id: "burn", name: "Burning", description: "Taking fire damage each turn",
    category: "debuff", defaultDuration: 3, tickDamage: 3, tickDie: 4,
    accuracyPenalty: 0, acModifier: 0, damageModifier: 0, skipsTurn: false,
    saveStat: "dexterity", saveDC: 11,
    removalMethods: ["duration", "save", "cure"], cureItemId: "burnSalve",
  },
  {
    id: "freeze", name: "Frozen", description: "Slowed and vulnerable, may skip turn",
    category: "debuff", defaultDuration: 2, tickDamage: 0, tickDie: 0,
    accuracyPenalty: -3, acModifier: -2, damageModifier: 0, skipsTurn: false,
    saveStat: "constitution", saveDC: 12,
    removalMethods: ["duration", "save", "cure"], cureItemId: "thawingTonic",
  },
  {
    id: "paralysis", name: "Paralyzed", description: "Cannot move or act",
    category: "debuff", defaultDuration: 2, tickDamage: 0, tickDie: 0,
    accuracyPenalty: 0, acModifier: -4, damageModifier: 0, skipsTurn: true,
    saveStat: "constitution", saveDC: 13,
    removalMethods: ["duration", "save", "cure"], cureItemId: "paralysisRemedy",
  },
  {
    id: "stunned", name: "Stunned", description: "Cannot act for one turn",
    category: "debuff", defaultDuration: 1, tickDamage: 0, tickDie: 0,
    accuracyPenalty: 0, acModifier: -2, damageModifier: 0, skipsTurn: true,
    saveStat: "constitution", saveDC: 12,
    removalMethods: ["duration", "save"],
  },
  {
    id: "frightened", name: "Frightened", description: "Disadvantage on attacks and ability checks",
    category: "debuff", defaultDuration: 2, tickDamage: 0, tickDie: 0,
    accuracyPenalty: -3, acModifier: 0, damageModifier: -2, skipsTurn: false,
    saveStat: "wisdom", saveDC: 12,
    removalMethods: ["duration", "save", "cure"], cureItemId: "smellingSalts",
  },
  {
    id: "slow", name: "Slowed", description: "Reduced accuracy and damage",
    category: "debuff", defaultDuration: 3, tickDamage: 0, tickDie: 0,
    accuracyPenalty: -2, acModifier: 0, damageModifier: -2, skipsTurn: false,
    saveStat: "wisdom", saveDC: 11,
    removalMethods: ["duration", "save"],
  },
  {
    id: "prone", name: "Prone", description: "Knocked down, disadvantage on attacks",
    category: "debuff", defaultDuration: 1, tickDamage: 0, tickDie: 0,
    accuracyPenalty: -4, acModifier: -2, damageModifier: 0, skipsTurn: false,
    saveStat: "strength", saveDC: 10,
    removalMethods: ["duration"],
  },
  {
    id: "asleep", name: "Asleep", description: "Unconscious until damaged or saved",
    category: "debuff", defaultDuration: 3, tickDamage: 0, tickDie: 0,
    accuracyPenalty: 0, acModifier: -4, damageModifier: 0, skipsTurn: true,
    saveStat: "wisdom", saveDC: 13,
    removalMethods: ["duration", "save", "cure"], cureItemId: "smellingSalts",
  },
  {
    id: "confused", name: "Confused", description: "May attack self or skip turn",
    category: "debuff", defaultDuration: 2, tickDamage: 0, tickDie: 0,
    accuracyPenalty: -3, acModifier: 0, damageModifier: 0, skipsTurn: false,
    saveStat: "wisdom", saveDC: 12,
    removalMethods: ["duration", "save"],
  },
  // ── Buffs ──────────────────────────────────────────────────────
  {
    id: "enraged", name: "Enraged", description: "Increased damage but reduced AC",
    category: "buff", defaultDuration: 3, tickDamage: 0, tickDie: 0,
    accuracyPenalty: 0, acModifier: -2, damageModifier: 3, skipsTurn: false,
    saveStat: "constitution", saveDC: 0,
    removalMethods: ["duration"],
  },
  {
    id: "haste", name: "Haste", description: "Increased accuracy and AC",
    category: "buff", defaultDuration: 3, tickDamage: 0, tickDie: 0,
    accuracyPenalty: 2, acModifier: 2, damageModifier: 0, skipsTurn: false,
    saveStat: "dexterity", saveDC: 0,
    removalMethods: ["duration"],
  },
  {
    id: "rage", name: "Raging", description: "Berserker fury: +3 damage, resistance to pain",
    category: "buff", defaultDuration: 5, tickDamage: 0, tickDie: 0,
    accuracyPenalty: 0, acModifier: 0, damageModifier: 3, skipsTurn: false,
    saveStat: "strength", saveDC: 0,
    removalMethods: ["duration", "manual"],
  },
  {
    id: "sneakStance", name: "Sneak Stance", description: "+2 AC, next attack deals bonus damage",
    category: "buff", defaultDuration: 2, tickDamage: 0, tickDie: 0,
    accuracyPenalty: 0, acModifier: 2, damageModifier: 0, skipsTurn: false,
    saveStat: "dexterity", saveDC: 0,
    removalMethods: ["duration", "manual"],
  },
];

/** Look up a status effect definition by ID. */
export function getStatusEffectDef(id: StatusEffectId): StatusEffectDef | undefined {
  return STATUS_EFFECT_DEFS.find((e) => e.id === id);
}

// ── Status Effect Operations ───────────────────────────────────

/**
 * Apply a status effect to a list of active effects.
 * If the effect is already active, refreshes the duration (does not stack).
 * Returns a message describing what happened.
 */
export function applyStatusEffect(
  effects: ActiveStatusEffect[],
  effectId: StatusEffectId,
  source: string,
  durationOverride?: number
): { applied: boolean; message: string } {
  const def = getStatusEffectDef(effectId);
  if (!def) {
    return { applied: false, message: `Unknown effect: ${effectId}` };
  }

  const existing = effects.find((e) => e.id === effectId);
  const duration = durationOverride ?? def.defaultDuration;

  if (existing) {
    // Refresh duration if new is longer
    if (duration > existing.remainingTurns) {
      existing.remainingTurns = duration;
      existing.source = source;
      return { applied: true, message: `${def.name} refreshed! (${duration} turns)` };
    }
    return { applied: false, message: `Already ${def.name}!` };
  }

  effects.push({ id: effectId, remainingTurns: duration, source });
  return { applied: true, message: `${def.name}! (${duration} turns)` };
}

/**
 * Remove a status effect by ID.
 * Returns true if removed.
 */
export function removeStatusEffect(
  effects: ActiveStatusEffect[],
  effectId: StatusEffectId
): boolean {
  const idx = effects.findIndex((e) => e.id === effectId);
  if (idx === -1) return false;
  effects.splice(idx, 1);
  return true;
}

/**
 * Remove all status effects that can be cured by a given item ID.
 * Returns the names of effects that were cured.
 */
export function cureWithItem(
  effects: ActiveStatusEffect[],
  itemId: string
): string[] {
  const cured: string[] = [];
  for (let i = effects.length - 1; i >= 0; i--) {
    const def = getStatusEffectDef(effects[i].id);
    if (def && def.cureItemId === itemId && def.removalMethods.includes("cure")) {
      cured.push(def.name);
      effects.splice(i, 1);
    }
  }
  return cured;
}

/** Check if the combatant has a specific active effect. */
export function hasEffect(effects: ActiveStatusEffect[], effectId: StatusEffectId): boolean {
  return effects.some((e) => e.id === effectId);
}

/**
 * Calculate the total accuracy modifier from all active status effects.
 */
export function getEffectAccuracyModifier(effects: ActiveStatusEffect[]): number {
  let total = 0;
  for (const effect of effects) {
    const def = getStatusEffectDef(effect.id);
    if (def) total += def.accuracyPenalty;
  }
  return total;
}

/**
 * Calculate the total AC modifier from all active status effects.
 */
export function getEffectACModifier(effects: ActiveStatusEffect[]): number {
  let total = 0;
  for (const effect of effects) {
    const def = getStatusEffectDef(effect.id);
    if (def) total += def.acModifier;
  }
  return total;
}

/**
 * Calculate the total damage modifier from all active status effects.
 */
export function getEffectDamageModifier(effects: ActiveStatusEffect[]): number {
  let total = 0;
  for (const effect of effects) {
    const def = getStatusEffectDef(effect.id);
    if (def) total += def.damageModifier;
  }
  return total;
}

/**
 * Check if any active effect causes the combatant to skip their turn.
 */
export function mustSkipTurn(effects: ActiveStatusEffect[]): boolean {
  return effects.some((e) => {
    const def = getStatusEffectDef(e.id);
    return def?.skipsTurn === true;
  });
}

/**
 * Process start-of-turn effects: tick damage and saving throws.
 * Returns messages and total tick damage dealt.
 */
export function processStartOfTurn(
  effects: ActiveStatusEffect[],
  stats: PlayerStats,
): { messages: string[]; tickDamage: number } {
  const messages: string[] = [];
  let totalTickDamage = 0;

  for (let i = effects.length - 1; i >= 0; i--) {
    const effect = effects[i];
    const def = getStatusEffectDef(effect.id);
    if (!def) continue;

    // Apply tick damage
    if (def.tickDamage > 0) {
      const dmg = def.tickDie > 0
        ? Math.max(1, Math.floor(Math.random() * def.tickDie) + 1)
        : def.tickDamage;
      totalTickDamage += dmg;
      messages.push(`${def.name} deals ${dmg} damage!`);
    }

    // Attempt saving throw to end debuffs early
    if (def.category === "debuff" && def.saveDC > 0 && def.removalMethods.includes("save")) {
      const saveMod = abilityModifier(stats[def.saveStat]);
      const saveRoll = rollD20(saveMod);
      if (saveRoll.total >= def.saveDC) {
        messages.push(`Saved vs ${def.name}! (rolled ${saveRoll.total} vs DC ${def.saveDC})`);
        effects.splice(i, 1);
        continue;
      }
    }

    // Decrement duration
    effect.remainingTurns--;
    if (effect.remainingTurns <= 0) {
      messages.push(`${def.name} wore off.`);
      effects.splice(i, 1);
    }
  }

  return { messages, tickDamage: totalTickDamage };
}

/**
 * Clear all active effects (e.g., at end of combat).
 */
export function clearAllEffects(effects: ActiveStatusEffect[]): void {
  effects.length = 0;
}

/**
 * Clear only debuff effects (keep buffs).
 */
export function clearDebuffs(effects: ActiveStatusEffect[]): void {
  for (let i = effects.length - 1; i >= 0; i--) {
    const def = getStatusEffectDef(effects[i].id);
    if (def && def.category === "debuff") {
      effects.splice(i, 1);
    }
  }
}

/** Get a summary of all active effects (for display). */
export function getActiveEffectNames(effects: ActiveStatusEffect[]): string[] {
  return effects.map((e) => {
    const def = getStatusEffectDef(e.id);
    return def ? `${def.name} (${e.remainingTurns}t)` : e.id;
  });
}
