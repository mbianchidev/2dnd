import { Element } from "../data/elements";
import type { PixelPoint } from "./pixelArt";

export type BattleTrailKind = "melee" | "ranged" | "spell" | "heal";
export interface BattleTrailStroke {
  readonly from: PixelPoint;
  readonly to: PixelPoint;
  readonly width: number;
  readonly alpha: number;
}
export interface BattleTrailFrame {
  readonly strokes: readonly BattleTrailStroke[];
  readonly head: PixelPoint;
  readonly radius: number;
}

export function getActionEffectColor(element?: Element): number {
  switch (element) {
    case Element.Fire: return 0xf3aa67;
    case Element.Ice: return 0xa1d5da;
    case Element.Lightning: return 0xf2d890;
    case Element.Poison: return 0xa8bf76;
    case Element.Necrotic: return 0xb393c7;
    case Element.Radiant: return 0xf7e4ac;
    case Element.Thunder: return 0xb0bbdc;
    case Element.Force: return 0x98c9df;
    case Element.Psychic: return 0xd6a3c3;
    case undefined: return 0xe0c89c;
  }
}

/** Resolved-action travel and blade arcs; geometry never decides a hit or consumes RNG. */
export function getBattleTrailFrame(
  kind: BattleTrailKind, start: PixelPoint, end: PixelPoint, progress: number,
): BattleTrailFrame {
  if (![start.x, start.y, end.x, end.y, progress].every(Number.isFinite)) {
    throw new Error("Battle trail coordinates and progress must be finite.");
  }
  const t = Math.max(0, Math.min(1, progress));
  const flight = Math.max(0, Math.min(1, (t - 0.12) / 0.65));
  const point = (phase: number): PixelPoint => {
    if (kind === "melee") {
      const angle = (-0.85 + phase * 1.55) * Math.PI;
      return { x: Math.round(end.x + Math.cos(angle) * 31), y: Math.round(end.y + Math.sin(angle) * 23) };
    }
    if (kind === "heal") {
      return { x: Math.round(end.x + Math.sin(phase * Math.PI * 3) * 14), y: Math.round(end.y + 20 - phase * 60) };
    }
    return {
      x: Math.round(start.x + (end.x - start.x) * phase),
      y: Math.round(start.y + (end.y - start.y) * phase - Math.sin(phase * Math.PI) * (kind === "ranged" ? 20 : 12)),
    };
  };
  const strokes: BattleTrailStroke[] = [];
  for (let i = 0; i < 7; i++) {
    const a = Math.max(0, flight - (7 - i) * 0.055);
    const b = Math.max(0, flight - (6 - i) * 0.055);
    strokes.push({
      from: point(a), to: point(b), width: kind === "melee" ? 3 : kind === "spell" ? 4 : 2,
      alpha: Math.max(0, (i + 1) / 7 * (t > 0.78 ? (1 - t) / 0.22 : 1)),
    });
  }
  return { strokes, head: point(flight), radius: kind === "spell" ? 4 : kind === "heal" ? 3 : 1 };
}
