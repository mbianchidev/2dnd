export type BattleImpactKind = "strike" | "spell" | "ability" | "heal" | "guard";

export interface BattleImpactOptions {
  readonly kind: BattleImpactKind;
  readonly direction: -1 | 1;
  readonly critical: boolean;
}

interface ImpactPixel {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly alpha: number;
}

interface ImpactStroke {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly width: number;
  readonly alpha: number;
}

export interface BattleImpactFrame {
  readonly pixels: readonly ImpactPixel[];
  readonly strokes: readonly ImpactStroke[];
}

const DIRECTIONS = [
  [1, 0], [0.7, 0.7], [0, 1], [-0.7, 0.7],
  [-1, 0], [-0.7, -0.7], [0, -1], [0.7, -0.7],
] as const;

/** Bounded pixel-art geometry from resolved outcomes, without actors, RNG or callbacks. */
export function getBattleImpactFrame(
  options: BattleImpactOptions,
  progress: number,
): BattleImpactFrame {
  if (!Number.isFinite(progress)) throw new RangeError("Battle impact progress must be finite.");
  const t = Math.max(0, Math.min(1, progress));
  const spread = 1 - (1 - t) ** 3;
  const alpha = 1 - t;
  const radius = 5 + spread * (options.critical ? 36 : 24);
  const pixels = DIRECTIONS.map(([dx, dy], index): ImpactPixel => ({
    x: Math.round(options.kind === "heal" ? dx * 14 : dx * radius),
    y: Math.round(options.kind === "heal"
      ? -8 - spread * 30 + (index % 3) * 7
      : dy * radius * 0.7 + (options.kind === "strike" ? t * t * 10 : 0)),
    size: index % 2 === 0 ? 3 : 2,
    alpha,
  }));
  const strokes: ImpactStroke[] = [];
  if (options.kind === "strike") {
    const tip = -22 + spread * 44;
    for (const offset of options.critical ? [-5, 5] : [0]) {
      strokes.push({
        x1: Math.round((tip - 14) * options.direction), y1: Math.round(-tip + 14 + offset),
        x2: Math.round(tip * options.direction), y2: Math.round(-tip + offset),
        width: options.critical ? 4 : 3, alpha,
      });
    }
  } else if (options.kind === "heal") {
    strokes.push(
      { x1: -7, y1: -spread * 14, x2: 7, y2: -spread * 14, width: 3, alpha },
      { x1: 0, y1: -7 - spread * 14, x2: 0, y2: 7 - spread * 14, width: 3, alpha },
    );
  }
  if (options.kind === "spell" || options.kind === "guard" || options.critical) {
    const r = options.kind === "guard" ? 16 + spread * 5 : radius;
    const corners = [[0, -r], [r, 0], [0, r], [-r, 0], [0, -r]] as const;
    for (let index = 0; index < 4; index++) {
      strokes.push({
        x1: Math.round(corners[index][0]), y1: Math.round(corners[index][1]),
        x2: Math.round(corners[index + 1][0]), y2: Math.round(corners[index + 1][1]),
        width: options.kind === "guard" ? 3 : 2, alpha: alpha * 0.8,
      });
    }
  }
  return { pixels, strokes };
}
