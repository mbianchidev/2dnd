/**
 * Combat status effect definitions and lifecycle operations.
 */

import { abilityModifier, rollD20, rollDie } from "./dice";
import type { DieType } from "./dice";
import type { PlayerStats } from "./player";

export const STATUS_EFFECT_IDS = [
  "poison",
  "burn",
  "freeze",
  "paralysis",
  "stunned",
  "frightened",
  "slow",
  "prone",
  "asleep",
  "confused",
  "enraged",
  "haste",
  "inspired",
  "rage",
  "sneakStance",
] as const;

export type StatusEffectId = (typeof STATUS_EFFECT_IDS)[number];
export type StatusEffectCategory = "debuff" | "buff";
export type RemovalMethod = "duration" | "save" | "cure" | "manual";

export interface StatusEffectDef {
  id: StatusEffectId;
  name: string;
  description: string;
  category: StatusEffectCategory;
  /** Number of affected turns; zero lasts until manually removed. */
  defaultDuration: number;
  /** Flat damage added to each start-of-turn damage roll. */
  tickDamage: number;
  tickDie: DieType;
  accuracyModifier: number;
  attackDisadvantage: boolean;
  acModifier: number;
  damageModifier: number;
  skipsTurn: boolean;
  saveStat: keyof PlayerStats;
  saveDC: number;
  removalMethods: RemovalMethod[];
  cureItemId?: string;
}

export interface ActiveStatusEffect {
  id: StatusEffectId;
  remainingTurns: number;
  source: string;
}

export interface StatusTurnStartResult {
  messages: string[];
  tickDamage: number;
  skipTurn: boolean;
}

export interface StatusTurnEndResult {
  messages: string[];
}

export const STATUS_EFFECT_DEFS: StatusEffectDef[] = [
  {
    id: "poison", name: "Poisoned",
    description: "Takes damage each turn and attacks with disadvantage",
    category: "debuff", defaultDuration: 3, tickDamage: 2, tickDie: 4,
    accuracyModifier: 0, attackDisadvantage: true,
    acModifier: 0, damageModifier: 0, skipsTurn: false,
    saveStat: "constitution", saveDC: 12,
    removalMethods: ["duration", "save", "cure"], cureItemId: "antidote",
  },
  {
    id: "burn", name: "Burning",
    description: "Takes fire damage each turn",
    category: "debuff", defaultDuration: 3, tickDamage: 3, tickDie: 4,
    accuracyModifier: 0, attackDisadvantage: false,
    acModifier: 0, damageModifier: 0, skipsTurn: false,
    saveStat: "dexterity", saveDC: 11,
    removalMethods: ["duration", "save", "cure"], cureItemId: "burnSalve",
  },
  {
    id: "freeze", name: "Frozen",
    description: "Suffers reduced accuracy and AC",
    category: "debuff", defaultDuration: 2, tickDamage: 0, tickDie: 0,
    accuracyModifier: -3, attackDisadvantage: false,
    acModifier: -2, damageModifier: 0, skipsTurn: false,
    saveStat: "constitution", saveDC: 12,
    removalMethods: ["duration", "save", "cure"], cureItemId: "thawingTonic",
  },
  {
    id: "paralysis", name: "Paralyzed",
    description: "Cannot act and suffers reduced AC",
    category: "debuff", defaultDuration: 2, tickDamage: 0, tickDie: 0,
    accuracyModifier: 0, attackDisadvantage: false,
    acModifier: -4, damageModifier: 0, skipsTurn: true,
    saveStat: "constitution", saveDC: 13,
    removalMethods: ["duration", "save", "cure"], cureItemId: "paralysisRemedy",
  },
  {
    id: "stunned", name: "Stunned",
    description: "Cannot act for one turn",
    category: "debuff", defaultDuration: 1, tickDamage: 0, tickDie: 0,
    accuracyModifier: 0, attackDisadvantage: false,
    acModifier: -2, damageModifier: 0, skipsTurn: true,
    saveStat: "constitution", saveDC: 12,
    removalMethods: ["duration", "save"],
  },
  {
    id: "frightened", name: "Frightened",
    description: "Attacks with disadvantage and deals less damage",
    category: "debuff", defaultDuration: 2, tickDamage: 0, tickDie: 0,
    accuracyModifier: 0, attackDisadvantage: true,
    acModifier: 0, damageModifier: -2, skipsTurn: false,
    saveStat: "wisdom", saveDC: 12,
    removalMethods: ["duration", "save", "cure"], cureItemId: "smellingSalts",
  },
  {
    id: "slow", name: "Slowed",
    description: "Suffers reduced accuracy and damage",
    category: "debuff", defaultDuration: 3, tickDamage: 0, tickDie: 0,
    accuracyModifier: -2, attackDisadvantage: false,
    acModifier: 0, damageModifier: -2, skipsTurn: false,
    saveStat: "wisdom", saveDC: 11,
    removalMethods: ["duration", "save"],
  },
  {
    id: "prone", name: "Prone",
    description: "Attacks with disadvantage and suffers reduced AC",
    category: "debuff", defaultDuration: 1, tickDamage: 0, tickDie: 0,
    accuracyModifier: 0, attackDisadvantage: true,
    acModifier: -2, damageModifier: 0, skipsTurn: false,
    saveStat: "strength", saveDC: 10,
    removalMethods: ["duration"],
  },
  {
    id: "asleep", name: "Asleep",
    description: "Cannot act until saved or the effect expires",
    category: "debuff", defaultDuration: 3, tickDamage: 0, tickDie: 0,
    accuracyModifier: 0, attackDisadvantage: false,
    acModifier: -4, damageModifier: 0, skipsTurn: true,
    saveStat: "wisdom", saveDC: 13,
    removalMethods: ["duration", "save", "cure"], cureItemId: "smellingSalts",
  },
  {
    id: "confused", name: "Confused",
    description: "Suffers reduced attack accuracy",
    category: "debuff", defaultDuration: 2, tickDamage: 0, tickDie: 0,
    accuracyModifier: -3, attackDisadvantage: false,
    acModifier: 0, damageModifier: 0, skipsTurn: false,
    saveStat: "wisdom", saveDC: 12,
    removalMethods: ["duration", "save"],
  },
  {
    id: "enraged", name: "Enraged",
    description: "Deals more damage but suffers reduced AC",
    category: "buff", defaultDuration: 3, tickDamage: 0, tickDie: 0,
    accuracyModifier: 0, attackDisadvantage: false,
    acModifier: -2, damageModifier: 3, skipsTurn: false,
    saveStat: "constitution", saveDC: 0,
    removalMethods: ["duration"],
  },
  {
    id: "haste", name: "Hasted",
    description: "Gains increased accuracy and AC",
    category: "buff", defaultDuration: 3, tickDamage: 0, tickDie: 0,
    accuracyModifier: 2, attackDisadvantage: false,
    acModifier: 2, damageModifier: 0, skipsTurn: false,
    saveStat: "dexterity", saveDC: 0,
    removalMethods: ["duration"],
  },
  {
    id: "inspired", name: "Inspired",
    description: "Gains increased accuracy and damage",
    category: "buff", defaultDuration: 3, tickDamage: 0, tickDie: 0,
    accuracyModifier: 1, attackDisadvantage: false,
    acModifier: 0, damageModifier: 2, skipsTurn: false,
    saveStat: "charisma", saveDC: 0,
    removalMethods: ["duration"],
  },
  {
    id: "rage", name: "Raging",
    description: "Deals 3 additional damage",
    category: "buff", defaultDuration: 5, tickDamage: 0, tickDie: 0,
    accuracyModifier: 0, attackDisadvantage: false,
    acModifier: 0, damageModifier: 3, skipsTurn: false,
    saveStat: "strength", saveDC: 0,
    removalMethods: ["duration", "manual"],
  },
  {
    id: "sneakStance", name: "Sneak Stance",
    description: "Gains 2 AC while active",
    category: "buff", defaultDuration: 2, tickDamage: 0, tickDie: 0,
    accuracyModifier: 0, attackDisadvantage: false,
    acModifier: 2, damageModifier: 0, skipsTurn: false,
    saveStat: "dexterity", saveDC: 0,
    removalMethods: ["duration", "manual"],
  },
];

const STATUS_EFFECT_MAP = new Map(
  STATUS_EFFECT_DEFS.map((effect) => [effect.id, effect]),
);

export function isStatusEffectId(value: unknown): value is StatusEffectId {
  return typeof value === "string"
    && STATUS_EFFECT_IDS.includes(value as StatusEffectId);
}

export function getStatusEffectDef(
  id: StatusEffectId,
): StatusEffectDef | undefined {
  return STATUS_EFFECT_MAP.get(id);
}

/** Apply a new effect or refresh an existing effect to the longer duration. */
export function applyStatusEffect(
  effects: ActiveStatusEffect[],
  effectId: StatusEffectId,
  source: string,
  durationOverride?: number,
): { applied: boolean; message: string } {
  const definition = getStatusEffectDef(effectId);
  if (!definition) {
    return { applied: false, message: `Unknown effect: ${effectId}` };
  }
  const duration = durationOverride ?? definition.defaultDuration;
  if (!Number.isInteger(duration) || duration < 0) {
    return { applied: false, message: `Invalid duration for ${definition.name}.` };
  }

  const existing = effects.find((effect) => effect.id === effectId);
  if (existing) {
    if (duration > existing.remainingTurns) {
      existing.remainingTurns = duration;
      existing.source = source;
      return {
        applied: true,
        message: `${definition.name} refreshed! (${duration} turns)`,
      };
    }
    return { applied: false, message: `Already ${definition.name}!` };
  }

  effects.push({ id: effectId, remainingTurns: duration, source });
  const durationText = duration > 0 ? ` (${duration} turns)` : "";
  return { applied: true, message: `${definition.name}!${durationText}` };
}

export function removeStatusEffect(
  effects: ActiveStatusEffect[],
  effectId: StatusEffectId,
): boolean {
  const index = effects.findIndex((effect) => effect.id === effectId);
  if (index < 0) return false;
  effects.splice(index, 1);
  return true;
}

export function cureWithItem(
  effects: ActiveStatusEffect[],
  itemId: string,
): string[] {
  const cured: string[] = [];
  for (let index = effects.length - 1; index >= 0; index--) {
    const definition = getStatusEffectDef(effects[index].id);
    if (
      definition?.cureItemId === itemId
      && definition.removalMethods.includes("cure")
    ) {
      cured.push(definition.name);
      effects.splice(index, 1);
    }
  }
  return cured;
}

export function hasEffect(
  effects: ActiveStatusEffect[],
  effectId: StatusEffectId,
): boolean {
  return effects.some((effect) => effect.id === effectId);
}

export function getEffectAccuracyModifier(
  effects: ActiveStatusEffect[],
): number {
  return effects.reduce(
    (total, effect) =>
      total + (getStatusEffectDef(effect.id)?.accuracyModifier ?? 0),
    0,
  );
}

export function hasAttackDisadvantage(
  effects: ActiveStatusEffect[],
): boolean {
  return effects.some(
    (effect) => getStatusEffectDef(effect.id)?.attackDisadvantage === true,
  );
}

export function getEffectACModifier(
  effects: ActiveStatusEffect[],
): number {
  return effects.reduce(
    (total, effect) =>
      total + (getStatusEffectDef(effect.id)?.acModifier ?? 0),
    0,
  );
}

export function getEffectDamageModifier(
  effects: ActiveStatusEffect[],
): number {
  return effects.reduce(
    (total, effect) =>
      total + (getStatusEffectDef(effect.id)?.damageModifier ?? 0),
    0,
  );
}

export function mustSkipTurn(effects: ActiveStatusEffect[]): boolean {
  return effects.some(
    (effect) => getStatusEffectDef(effect.id)?.skipsTurn === true,
  );
}

/** Apply tick damage and saving throws before an actor takes a turn. */
export function processStartOfTurn(
  effects: ActiveStatusEffect[],
  stats: PlayerStats,
): StatusTurnStartResult {
  const messages: string[] = [];
  let tickDamage = 0;

  for (let index = effects.length - 1; index >= 0; index--) {
    const effect = effects[index];
    const definition = getStatusEffectDef(effect.id);
    if (!definition) continue;

    if (definition.tickDamage > 0 || definition.tickDie > 0) {
      const damage = definition.tickDamage
        + (definition.tickDie > 0 ? rollDie(definition.tickDie) : 0);
      tickDamage += damage;
      messages.push(`${definition.name} deals ${damage} damage!`);
    }

    if (
      definition.category === "debuff"
      && definition.saveDC > 0
      && definition.removalMethods.includes("save")
    ) {
      const modifier = abilityModifier(stats[definition.saveStat]);
      const savingThrow = rollD20(modifier);
      if (savingThrow.total >= definition.saveDC) {
        messages.push(
          `Saved vs ${definition.name}! (${savingThrow.total} vs DC ${definition.saveDC})`,
        );
        effects.splice(index, 1);
      }
    }
  }

  return {
    messages,
    tickDamage,
    skipTurn: mustSkipTurn(effects),
  };
}

/** Decrement durations after an actor finishes or skips their turn. */
export function processEndOfTurn(
  effects: ActiveStatusEffect[],
): StatusTurnEndResult {
  const messages: string[] = [];
  for (let index = effects.length - 1; index >= 0; index--) {
    const effect = effects[index];
    if (effect.remainingTurns === 0) continue;
    effect.remainingTurns--;
    if (effect.remainingTurns <= 0) {
      const name = getStatusEffectDef(effect.id)?.name ?? effect.id;
      messages.push(`${name} wore off.`);
      effects.splice(index, 1);
    }
  }
  return { messages };
}

export function clearAllEffects(effects: ActiveStatusEffect[]): void {
  effects.length = 0;
}

export function clearDebuffs(effects: ActiveStatusEffect[]): void {
  for (let index = effects.length - 1; index >= 0; index--) {
    if (getStatusEffectDef(effects[index].id)?.category === "debuff") {
      effects.splice(index, 1);
    }
  }
}

export function getActiveEffectNames(
  effects: ActiveStatusEffect[],
): string[] {
  return effects.map((effect) => {
    const name = getStatusEffectDef(effect.id)?.name ?? effect.id;
    return effect.remainingTurns > 0
      ? `${name} (${effect.remainingTurns}t)`
      : name;
  });
}

/** Sanitize effects restored from save data. */
export function normalizeActiveEffects(value: unknown): ActiveStatusEffect[] {
  if (!Array.isArray(value)) return [];
  const normalized = new Map<StatusEffectId, ActiveStatusEffect>();

  for (const candidate of value) {
    if (typeof candidate !== "object" || candidate === null) continue;
    const record = candidate as Record<string, unknown>;
    if (!isStatusEffectId(record["id"])) continue;
    const definition = getStatusEffectDef(record["id"]);
    if (!definition) continue;
    const remainingTurns = Number.isInteger(record["remainingTurns"])
      && (record["remainingTurns"] as number) >= 0
      ? record["remainingTurns"] as number
      : definition.defaultDuration;
    const source = typeof record["source"] === "string"
      ? record["source"]
      : "unknown";
    const existing = normalized.get(record["id"]);
    if (!existing || remainingTurns > existing.remainingTurns) {
      normalized.set(record["id"], {
        id: record["id"],
        remainingTurns,
        source,
      });
    }
  }

  return [...normalized.values()];
}
