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

/** Non-d20 components are displayable only when the resolver exposes them. */
export interface ResolvedDiceComponents {
  readonly sides: number;
  readonly naturalRolls: readonly number[];
  readonly modifier: number;
  readonly total: number;
}

function validateNumbers(
  naturalRolls: readonly number[],
  sides: number,
  modifier: number,
  total: number,
): void {
  if (
    naturalRolls.length === 0
    || naturalRolls.some((roll) => (
      !Number.isInteger(roll) || roll < 1 || roll > sides
    ))
  ) {
    throw new Error("[rollResults] Invalid exact natural dice.");
  }
  if (!Number.isInteger(modifier) || !Number.isInteger(total)) {
    throw new Error("[rollResults] Invalid resolved modifier or total.");
  }
}

/** Freeze a copy without selecting dice, adding modifiers, or resolving an outcome. */
export function snapshotD20Roll(result: ResolvedD20Roll): ResolvedD20Roll {
  validateNumbers(result.naturalRolls, 20, result.modifier, result.total);
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
    result.naturalRolls, result.sides, result.modifier, result.total,
  );
  return Object.freeze({
    sides: result.sides,
    naturalRolls: Object.freeze([...result.naturalRolls]),
    modifier: result.modifier,
    total: result.total,
  });
}
