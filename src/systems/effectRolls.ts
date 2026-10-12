import { elementDisplayName, type Element, type ElementalInteraction } from "../data/elements";
import { physicalDamageTypeName, type DamageInteraction, type PhysicalDamageType } from "../data/damageTypes";
import { rollDiceDetailed, type DieType } from "./dice";
import {
  snapshotEffectRoll,
  type ResolvedEffectRoll,
  type ResolvedRollModifier,
} from "./rollResults";

/** Resolves the existing dice call once, retaining its faces and arithmetic. */
export function rollEffectDice(
  count: number,
  sides: DieType,
  modifiers: readonly ResolvedRollModifier[] = [],
  options: { minimum?: number; criticalDice?: boolean; shared?: boolean } = {},
): ResolvedEffectRoll {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`[effectRolls] Invalid effect dice count ${count}`);
  }
  const dice = rollDiceDetailed(count, sides);
  const modifier = modifiers.reduce((total, entry) => total + entry.value, 0);
  const total = dice.total + modifier;
  const amount = options.minimum === undefined ? total : Math.max(options.minimum, total);
  return snapshotEffectRoll({
    ...(dice.rolls.length > 0 ? {
      roll: { sides, naturalRolls: dice.rolls, modifier, total },
    } : {}),
    modifiers,
    adjustments: amount === total ? [] : [{ label: `Minimum ${options.minimum}`, amount }],
    amount,
    criticalDice: options.criticalDice,
    shared: options.shared,
  });
}

/** Records a mechanics-owned adjustment without applying or recalculating it. */
export function captureEffectAdjustment(
  result: ResolvedEffectRoll,
  label: string,
  amount: number,
): ResolvedEffectRoll {
  return snapshotEffectRoll({
    ...result,
    amount,
    application: undefined,
    adjustments: [...result.adjustments, { label, amount }],
  });
}

export function captureElementalEffect(
  result: ResolvedEffectRoll,
  amount: number,
  element: Element | undefined,
  interaction: ElementalInteraction,
): ResolvedEffectRoll {
  if (!element || !interaction) return result;
  const operation = interaction === "weak" ? "weakness x2"
    : interaction === "resistant" ? "resistance /2 (floor)" : "immunity";
  return captureEffectAdjustment(result, `${elementDisplayName(element)} ${operation}`, amount);
}

export function capturePhysicalEffect(
  result: ResolvedEffectRoll,
  amount: number,
  type: PhysicalDamageType | undefined,
  interaction: DamageInteraction,
  scope?: string,
): ResolvedEffectRoll {
  if (!type || !interaction) return result;
  const operation = interaction === "weak" ? "weakness x2"
    : interaction === "resistant" ? "resistance /2 (floor)" : "immunity";
  return captureEffectAdjustment(
    result, `${scope ? `${scope}: ` : ""}${physicalDamageTypeName(type)} ${operation}`, amount,
  );
}

/** Capture the actual delta immediately beside its owning HP mutation. */
export function captureEffectApplication(
  result: ResolvedEffectRoll,
  amount: number,
  limit?: string,
): ResolvedEffectRoll {
  return snapshotEffectRoll({
    ...result,
    application: {
      amount,
      ...(limit && amount !== result.amount ? { limit } : {}),
    },
  });
}

export function captureDamageApplication<T extends { readonly damageRoll?: ResolvedEffectRoll }>(
  result: T,
  amount: number,
): T {
  return result.damageRoll
    ? {
      ...result,
      damageRoll: captureEffectApplication(
        result.damageRoll, amount, result.damageRoll.amount < 0 ? "Maximum HP" : "Overkill",
      ),
    }
    : result;
}
