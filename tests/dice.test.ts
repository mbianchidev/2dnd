import { describe, it, expect } from "vitest";
import {
  rollDie,
  rollDice,
  rollDiceDetailed,
  rollD20,
  rollWithAdvantage,
  abilityModifier,
} from "../src/utils/dice";

describe("dice utilities", () => {
  describe("rollDie", () => {
    it("returns a value between 1 and the number of sides", () => {
      for (let i = 0; i < 100; i++) {
        const result = rollDie(20);
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(20);
      }
    });

    it("works for all standard die types", () => {
      const dieTypes = [4, 6, 8, 10, 12, 20, 100] as const;
      for (const sides of dieTypes) {
        const result = rollDie(sides);
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(sides);
      }
    });
  });

  describe("rollDice", () => {
    it("returns total of multiple dice", () => {
      for (let i = 0; i < 50; i++) {
        const result = rollDice(2, 6);
        expect(result).toBeGreaterThanOrEqual(2);
        expect(result).toBeLessThanOrEqual(12);
      }
    });

    it("returns exactly the die value for 1 die", () => {
      for (let i = 0; i < 50; i++) {
        const result = rollDice(1, 4);
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(4);
      }
    });
  });

  describe("rollDiceDetailed", () => {
    it("returns individual rolls and correct total", () => {
      const result = rollDiceDetailed(3, 6);
      expect(result.rolls).toHaveLength(3);
      expect(result.total).toBe(
        result.rolls.reduce((a, b) => a + b, 0)
      );
      for (const r of result.rolls) {
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(6);
      }
    });
  });

  describe("rollD20", () => {
    it("returns roll, modifier, and total", () => {
      const result = rollD20(3);
      expect(result.roll).toBeGreaterThanOrEqual(1);
      expect(result.roll).toBeLessThanOrEqual(20);
      expect(result.modifier).toBe(3);
      expect(result.total).toBe(result.roll + 3);
    });

    it("works with no modifier", () => {
      const result = rollD20();
      expect(result.modifier).toBe(0);
      expect(result.total).toBe(result.roll);
    });
  });

  describe("rollWithAdvantage", () => {
    it("takes the higher of two rolls", () => {
      for (let i = 0; i < 50; i++) {
        const result = rollWithAdvantage(2);
        expect(result.chosen).toBe(Math.max(result.roll1, result.roll2));
        expect(result.total).toBe(result.chosen + 2);
      }
    });
  });

  describe("abilityModifier", () => {
    it("calculates correct D&D 5e modifiers", () => {
      expect(abilityModifier(10)).toBe(0);
      expect(abilityModifier(11)).toBe(0);
      expect(abilityModifier(12)).toBe(1);
      expect(abilityModifier(14)).toBe(2);
      expect(abilityModifier(8)).toBe(-1);
      expect(abilityModifier(6)).toBe(-2);
      expect(abilityModifier(20)).toBe(5);
      expect(abilityModifier(1)).toBe(-5);
    });
  });
});
