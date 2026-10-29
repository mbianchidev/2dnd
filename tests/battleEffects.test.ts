import { describe, expect, it, vi } from "vitest";
import { getBattleImpactFrame, type BattleImpactKind } from "../src/systems/battleEffects";

const KINDS: readonly BattleImpactKind[] = ["strike", "spell", "ability", "heal", "guard"];

describe("resolved battle impact geometry", () => {
  it("uses deterministic bounded geometry without gameplay randomness", () => {
    const random = vi.spyOn(Math, "random");
    try {
      for (const kind of KINDS) {
        for (const critical of [false, true]) {
          for (const direction of [-1, 1] as const) {
            for (const progress of [0, 0.1, 0.5, 0.9, 1]) {
              const options = { kind, critical, direction };
              const frame = getBattleImpactFrame(options, progress);
              expect(frame).toEqual(getBattleImpactFrame(options, progress));
              expect(frame.pixels).toHaveLength(8);
              expect(frame.strokes.length).toBeLessThanOrEqual(6);
              for (const pixel of frame.pixels) {
                expect(Number.isInteger(pixel.x) && Number.isInteger(pixel.y)).toBe(true);
                expect(Math.abs(pixel.x)).toBeLessThanOrEqual(48);
                expect(Math.abs(pixel.y)).toBeLessThanOrEqual(48);
                expect(pixel.alpha).toBeGreaterThanOrEqual(0);
                expect(pixel.alpha).toBeLessThanOrEqual(1);
              }
            }
          }
        }
      }
      expect(random).not.toHaveBeenCalled();
    } finally {
      random.mockRestore();
    }
  });

  it("distinguishes attack direction, critical strikes, healing and guard silhouettes", () => {
    const strike = { kind: "strike", direction: 1, critical: false } as const;
    const right = getBattleImpactFrame(strike, 0.4);
    const left = getBattleImpactFrame({ ...strike, direction: -1 }, 0.4);
    expect(left.strokes[0]!.x2).toBe(-right.strokes[0]!.x2);
    expect(getBattleImpactFrame({ ...strike, critical: true }, 0.4).strokes)
      .toHaveLength(6);
    expect(getBattleImpactFrame({ ...strike, kind: "heal" }, 0.4).strokes)
      .toHaveLength(2);
    expect(getBattleImpactFrame({ ...strike, kind: "guard" }, 0.4).strokes)
      .toHaveLength(4);
  });

  it("fades every primitive completely and rejects non-finite motion", () => {
    for (const kind of KINDS) {
      const options = { kind, direction: 1, critical: true } as const;
      const frame = getBattleImpactFrame(options, 1);
      expect([...frame.pixels, ...frame.strokes].every((shape) => shape.alpha === 0)).toBe(true);
      expect(() => getBattleImpactFrame(options, Number.NaN)).toThrow(RangeError);
    }
  });
});
