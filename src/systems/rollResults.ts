export type D20Selection = "normal" | "advantage" | "disadvantage";

/** Exact runtime-only evidence captured by the resolver, never a new roll. */
export interface ResolvedD20Roll {
  readonly naturalRolls: readonly number[];
  readonly selectedIndex: number;
  readonly selection: D20Selection;
  readonly naturalRoll: number;
  readonly modifier: number;
  readonly total: number;
}

/** Exact component faces; arithmetic retains finite legacy-item fractions. */
export interface ResolvedDiceComponents {
  readonly sides: number;
  readonly naturalRolls: readonly number[];
  readonly modifier: number;
  readonly total: number;
}

export interface ResolvedRollModifier {
  readonly label: string;
  readonly value: number;
}

export interface ResolvedEffectAdjustment {
  readonly label: string;
  readonly amount: number;
}

/** Rolled arithmetic, resolved effect, and actual HP change are separate evidence. */
export interface ResolvedEffectRoll {
  readonly roll?: ResolvedDiceComponents;
  readonly modifiers: readonly ResolvedRollModifier[];
  readonly adjustments: readonly ResolvedEffectAdjustment[];
  readonly amount: number;
  readonly application?: {
    readonly amount: number;
    readonly limit?: string;
  };
  readonly criticalDice?: boolean;
  readonly shared?: boolean;
}

function validateNumbers(
  naturalRolls: readonly number[],
  sides: number,
  modifier: number,
  total: number,
  integerArithmetic: boolean,
): void {
  if (
    naturalRolls.length === 0
    || naturalRolls.some((roll) => (
      !Number.isInteger(roll) || roll < 1 || roll > sides
    ))
  ) {
    throw new Error("[rollResults] Invalid exact natural dice.");
  }
  const validArithmetic = integerArithmetic ? Number.isInteger : Number.isFinite;
  if (!validArithmetic(modifier) || !validArithmetic(total)) {
    throw new Error("[rollResults] Invalid resolved modifier or total.");
  }
}

/** Freeze a copy without selecting dice, adding modifiers, or resolving an outcome. */
export function snapshotD20Roll(result: ResolvedD20Roll): ResolvedD20Roll {
  validateNumbers(result.naturalRolls, 20, result.modifier, result.total, true);
  if (
    !Number.isInteger(result.selectedIndex)
    || result.selectedIndex < 0
    || result.selectedIndex >= result.naturalRolls.length
    || result.naturalRoll !== result.naturalRolls[result.selectedIndex]
  ) {
    throw new Error("[rollResults] Invalid selected natural die.");
  }
  if (
    (result.selection === "normal" && result.naturalRolls.length !== 1)
    || (result.selection !== "normal" && result.naturalRolls.length !== 2)
  ) {
    throw new Error("[rollResults] Invalid d20 selection evidence.");
  }
  return Object.freeze({
    naturalRolls: Object.freeze([...result.naturalRolls]),
    selectedIndex: result.selectedIndex,
    selection: result.selection,
    naturalRoll: result.naturalRoll,
    modifier: result.modifier,
    total: result.total,
  });
}

export function snapshotDiceComponents(
  result: ResolvedDiceComponents,
): ResolvedDiceComponents {
  if (!Number.isInteger(result.sides) || result.sides < 2) {
    throw new Error("[rollResults] Invalid exact die size.");
  }
  validateNumbers(
    result.naturalRolls, result.sides, result.modifier, result.total, false,
  );
  return Object.freeze({
    sides: result.sides,
    naturalRolls: Object.freeze([...result.naturalRolls]),
    modifier: result.modifier,
    total: result.total,
  });
}

export function snapshotEffectRoll(result: ResolvedEffectRoll): ResolvedEffectRoll {
  if (
    !Number.isFinite(result.amount)
    || result.modifiers.some((modifier) => !Number.isFinite(modifier.value))
    || result.adjustments.some((adjustment) => !Number.isFinite(adjustment.amount))
    || (result.application && !Number.isFinite(result.application.amount))
  ) {
    throw new Error("[rollResults] Invalid resolved effect evidence.");
  }
  return Object.freeze({
    ...(result.roll ? { roll: snapshotDiceComponents(result.roll) } : {}),
    modifiers: Object.freeze(result.modifiers.map((modifier) => Object.freeze({
      label: modifier.label, value: modifier.value,
    }))),
    adjustments: Object.freeze(result.adjustments.map((adjustment) => Object.freeze({
      label: adjustment.label, amount: adjustment.amount,
    }))),
    amount: result.amount,
    ...(result.application ? {
      application: Object.freeze({
        amount: result.application.amount,
        ...(result.application.limit ? { limit: result.application.limit } : {}),
      }),
    } : {}),
    ...(result.criticalDice ? { criticalDice: true } : {}),
    ...(result.shared ? { shared: true } : {}),
  });
}
