import { describe, expect, it, vi } from "vitest";
import { Element } from "../src/data/elements";
import { getActionEffectColor, getBattleTrailFrame } from "../src/systems/battleChoreography";

describe("resolved attack choreography", () => {
  it("has distinct, bounded deterministic blade, arrow, spell and healing travel without RNG", () => {
    const rng = vi.spyOn(Math, "random");
    const signatures = new Set<string>();
    for (const kind of ["melee", "ranged", "spell", "heal"] as const) {
      const frame = getBattleTrailFrame(kind, { x: 80, y: 250 }, { x: 400, y: 230 }, 0.5);
      expect(frame).toEqual(getBattleTrailFrame(kind, { x: 80, y: 250 }, { x: 400, y: 230 }, 0.5));
      expect(frame.strokes).toHaveLength(7);
      for (const stroke of frame.strokes) {
        for (const point of [stroke.from, stroke.to]) {
          expect(point.x).toBeGreaterThanOrEqual(0);
          expect(point.x).toBeLessThanOrEqual(640);
          expect(point.y).toBeGreaterThanOrEqual(0);
          expect(point.y).toBeLessThanOrEqual(528);
        }
      }
      signatures.add(JSON.stringify(frame));
    }
    expect(signatures.size).toBe(4);
    expect(rng).not.toHaveBeenCalled();
    rng.mockRestore();
  });

  it("uses all nine canonical element colors and finishes with no remaining stroke opacity", () => {
    expect(new Set(Object.values(Element).map(getActionEffectColor)).size).toBe(9);
    expect(getBattleTrailFrame("spell", { x: 40, y: 100 }, { x: 300, y: 200 }, 1).head)
      .toEqual({ x: 300, y: 200 });
    expect(getBattleTrailFrame("melee", { x: 40, y: 100 }, { x: 300, y: 200 }, 1)
      .strokes.every((stroke) => stroke.alpha === 0)).toBe(true);
  });
});
