import { describe, expect, it, vi } from "vitest";
import { createDiceThrowMotion } from "../src/systems/diceMotion";

describe("presentation-only physical dice motion", () => {
  it("travels, tumbles and bounces visibly without consuming RNG", () => {
    const random = vi.spyOn(Math, "random");
    const motion = createDiceThrowMotion(2, 640, 320, 1);
    expect(motion).toHaveLength(2);
    for (const die of motion) {
      expect(Math.abs(die.frames[0]!.x)).toBeGreaterThan(die.size);
      expect(Math.abs(die.frames[0]!.rotation)).toBeGreaterThanOrEqual(360);
      expect(Math.abs(die.frames[0]!.tilt)).toBeGreaterThan(45);
      expect(Math.abs(die.frames[0]!.yaw)).toBeGreaterThan(90);
      const heights = die.frames.map((frame) => frame.y);
      expect(heights.some((height, index) => index > 0 && height < heights[index - 1]!)).toBe(true);
      expect(die.frames[die.frames.length - 1]).toMatchObject({
        x: 0, y: 0, rotation: 0, tilt: 0, yaw: 0, scaleX: 1, scaleY: 1, offset: 1,
      });
    }
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });

  it.each([
    [1, 640, 320, 1],
    [2, 320, 180, 1.5],
    [9, 640, 300, 1.25],
    [25, 390, 180, 1.5],
  ] as const)("keeps %i settled dice and their throw paths in the measured viewport", (count, width, height, scale) => {
    const motion = createDiceThrowMotion(count, width, height, scale);
    for (const die of motion) {
      expect(die.x).toBeGreaterThanOrEqual(0);
      expect(die.y).toBeGreaterThanOrEqual(0);
      expect(die.x + die.size).toBeLessThanOrEqual(width);
      expect(die.y + die.size).toBeLessThanOrEqual(height);
      for (const frame of die.frames) {
        expect(die.x + frame.x).toBeGreaterThanOrEqual(0);
        expect(die.y + frame.y).toBeGreaterThanOrEqual(0);
        expect(die.x + frame.x + die.size).toBeLessThanOrEqual(width);
        expect(die.y + frame.y + die.size).toBeLessThanOrEqual(height);
      }
    }
    for (const [index, die] of motion.entries()) {
      for (const other of motion.slice(index + 1)) {
        const separated = die.x + die.size <= other.x
          || other.x + other.size <= die.x
          || die.y + die.size <= other.y
          || other.y + other.size <= die.y;
        expect(separated).toBe(true);
      }
    }
  });

  it("contains only frozen visual values, not outcomes, actors or completion callbacks", () => {
    const first = createDiceThrowMotion(3, 640, 320, 1);
    expect(createDiceThrowMotion(3, 640, 320, 1)).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first[0])).toBe(true);
    expect(Object.isFrozen(first[0]?.frames[0])).toBe(true);
    expect(JSON.stringify(first)).not.toMatch(/natural|rollResult|actor|damage|reward|callback|complete/i);
  });

  it("rejects invalid motion input rather than deriving another outcome", () => {
    expect(createDiceThrowMotion(0, 640, 320, 1)).toEqual([]);
    for (const count of [-1, 1.5, NaN, Infinity]) {
      expect(() => createDiceThrowMotion(count, 640, 320, 1)).toThrow(/dice count/);
    }
    expect(() => createDiceThrowMotion(2, 0, 320, 1)).toThrow(/viewport/);
    expect(() => createDiceThrowMotion(2, 640, NaN, 1)).toThrow(/viewport/);
  });
});
