import { describe, it, expect } from "vitest";
import {
  TimePeriod,
  CYCLE_LENGTH,
  getTimePeriod,
  getEncounterMultiplier,
  isNightTime,
  PERIOD_TINT,
  PERIOD_LABEL,
} from "../src/systems/daynight";
import { NIGHT_MONSTERS, getNightEncounter, MONSTERS } from "../src/data/monsters";

describe("day/night cycle", () => {
  describe("getTimePeriod", () => {
    it("returns Dawn at step 0", () => {
      expect(getTimePeriod(0)).toBe(TimePeriod.Dawn);
    });

    it("returns Day at step 45", () => {
      expect(getTimePeriod(45)).toBe(TimePeriod.Day);
    });

    it("returns Dusk at step 220", () => {
      expect(getTimePeriod(220)).toBe(TimePeriod.Dusk);
    });

    it("returns Night at step 265", () => {
      expect(getTimePeriod(265)).toBe(TimePeriod.Night);
    });

    it("wraps around at CYCLE_LENGTH", () => {
      expect(getTimePeriod(CYCLE_LENGTH)).toBe(getTimePeriod(0));
      expect(getTimePeriod(CYCLE_LENGTH + 45)).toBe(getTimePeriod(45));
    });

    it("handles negative steps via modulo", () => {
      expect(getTimePeriod(-1)).toBe(getTimePeriod(CYCLE_LENGTH - 1));
    });

    it("covers all four periods over a full cycle", () => {
      const periods = new Set<TimePeriod>();
      for (let i = 0; i < CYCLE_LENGTH; i++) {
        periods.add(getTimePeriod(i));
      }
      expect(periods.size).toBe(4);
      expect(periods.has(TimePeriod.Dawn)).toBe(true);
      expect(periods.has(TimePeriod.Day)).toBe(true);
      expect(periods.has(TimePeriod.Dusk)).toBe(true);
      expect(periods.has(TimePeriod.Night)).toBe(true);
    });
  });

  describe("getEncounterMultiplier", () => {
    it("returns 1.0 during Day", () => {
      expect(getEncounterMultiplier(45)).toBe(1.0);
    });

    it("returns 1.0 during Dawn", () => {
      expect(getEncounterMultiplier(0)).toBe(1.0);
    });

    it("returns 1.25 during Dusk", () => {
      expect(getEncounterMultiplier(220)).toBe(1.25);
    });

    it("returns 1.5 during Night", () => {
      expect(getEncounterMultiplier(265)).toBe(1.5);
    });
  });

  describe("isNightTime", () => {
    it("returns false during Dawn", () => {
      expect(isNightTime(0)).toBe(false);
    });

    it("returns false during Day", () => {
      expect(isNightTime(100)).toBe(false);
    });

    it("returns true during Dusk", () => {
      expect(isNightTime(220)).toBe(true);
    });

    it("returns true during Night", () => {
      expect(isNightTime(300)).toBe(true);
    });
  });

  describe("period display data", () => {
    it("has a tint for every period", () => {
      for (const period of Object.values(TimePeriod)) {
        expect(PERIOD_TINT[period]).toBeDefined();
        expect(typeof PERIOD_TINT[period]).toBe("number");
      }
    });

    it("has a label for every period", () => {
      for (const period of Object.values(TimePeriod)) {
        expect(PERIOD_LABEL[period]).toBeDefined();
        expect(PERIOD_LABEL[period].length).toBeGreaterThan(0);
      }
    });

    it("Day tint is white (no tint)", () => {
      expect(PERIOD_TINT[TimePeriod.Day]).toBe(0xffffff);
    });
  });
});

describe("night monsters", () => {
  it("has night-exclusive monsters", () => {
    expect(NIGHT_MONSTERS.length).toBeGreaterThanOrEqual(3);
  });

  it("night monsters are not bosses", () => {
    for (const m of NIGHT_MONSTERS) {
      expect(m.isBoss).toBe(false);
    }
  });

  it("night monsters have valid stats", () => {
    for (const m of NIGHT_MONSTERS) {
      expect(m.hp).toBeGreaterThan(0);
      expect(m.ac).toBeGreaterThan(0);
      expect(m.xpReward).toBeGreaterThan(0);
      expect(m.name.length).toBeGreaterThan(0);
    }
  });

  it("night monsters are distinct from regular overworld monsters", () => {
    const overworldIds = new Set(MONSTERS.filter((m) => !m.isBoss).map((m) => m.id));
    for (const m of NIGHT_MONSTERS) {
      expect(overworldIds.has(m.id)).toBe(false);
    }
  });

  it("getNightEncounter returns a non-boss monster copy", () => {
    for (let i = 0; i < 20; i++) {
      const m = getNightEncounter(5);
      expect(m.isBoss).toBe(false);
      expect(NIGHT_MONSTERS.some((nm) => nm.id === m.id)).toBe(true);
    }
  });

  it("getNightEncounter returns a copy", () => {
    const m1 = getNightEncounter(1);
    const m2 = getNightEncounter(1);
    m1.hp = 0;
    expect(m2.hp).toBeGreaterThan(0);
  });
});
