import { describe, expect, it } from "vitest";
import {
  MAX_ENCOUNTER_RATE,
  getEffectiveEncounterRate,
} from "../src/managers/encounter";

describe("encounter rates", () => {
  it("caps stacked terrain, time, weather, and mount modifiers at 15%", () => {
    expect(getEffectiveEncounterRate(0.2, 1.5, 1.3, 1)).toBe(
      MAX_ENCOUNTER_RATE,
    );
  });

  it("preserves rates below the cap and rejects negative rates", () => {
    expect(getEffectiveEncounterRate(0.04, 1.25, 1.1, 0.5)).toBeCloseTo(
      0.0275,
    );
    expect(getEffectiveEncounterRate(-0.1, 1, 1, 1)).toBe(0);
  });
});
