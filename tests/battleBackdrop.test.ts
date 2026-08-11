import { describe, expect, it } from "vitest";
import {
  BATTLE_BACKDROP_LAYER_IDS,
  BATTLE_DEPTH,
  getBattleBackdropLayout,
  getBattleDepthOrder,
  normalizeBattleBiome,
} from "../src/renderers/battleDepth";

describe("Battle backdrop depth contract", () => {
  it("keeps every rendering band strictly ordered", () => {
    const depths = getBattleDepthOrder();
    expect(new Set(depths).size).toBe(depths.length);
    for (let index = 1; index < depths.length; index += 1) {
      expect(depths[index]).toBeGreaterThan(depths[index - 1]!);
    }
  });

  it("places scenery, actors, effects, weather, and UI in intentional bands", () => {
    expect(BATTLE_DEPTH.celestial).toBeGreaterThan(BATTLE_DEPTH.farSky);
    expect(BATTLE_DEPTH.distantScenery).toBeGreaterThan(BATTLE_DEPTH.clouds);
    expect(BATTLE_DEPTH.foregroundProps).toBeLessThan(BATTLE_DEPTH.actorShadows);
    expect(BATTLE_DEPTH.backActors).toBeLessThan(BATTLE_DEPTH.frontActors);
    expect(BATTLE_DEPTH.actionParticles).toBeLessThan(BATTLE_DEPTH.frontWeather);
    expect(BATTLE_DEPTH.frontWeather).toBeLessThan(BATTLE_DEPTH.uiBackdrop);
    expect(BATTLE_DEPTH.uiOverlay).toBeLessThan(BATTLE_DEPTH.inspection);
  });

  it("defines every inspected backdrop container in the shared contract", () => {
    expect(BATTLE_BACKDROP_LAYER_IDS).toEqual([
      "farSky",
      "stars",
      "celestial",
      "rearWeather",
      "clouds",
      "distantScenery",
      "ground",
      "midgroundProps",
      "foregroundProps",
      "actorShadows",
    ]);
    for (const id of BATTLE_BACKDROP_LAYER_IDS) {
      expect(BATTLE_DEPTH[id]).toBeTypeOf("number");
    }
  });
});

describe("Battle backdrop environment normalization", () => {
  it.each([
    ["grass", "grass"],
    ["deep forest", "deep_forest"],
    ["Sandport desert", "sand"],
    ["frost cavern", "tundra"],
    ["marsh island", "swamp"],
    ["volcanic forge", "volcanic"],
    ["red canyon", "canyon"],
    ["heartlands dungeon", "dungeon"],
    ["Tidehaven city", "city"],
    ["deep ocean", "sea"],
  ] as const)("normalizes %s to %s", (input, expected) => {
    expect(normalizeBattleBiome(input)).toBe(expected);
  });

  it("keeps celestial and star drawing above the visible horizon", () => {
    for (const [width, height] of [
      [640, 528],
      [528, 640],
      [1280, 720],
    ] as const) {
      const layout = getBattleBackdropLayout(width, height);
      expect(layout.skyBottom).toBeLessThanOrEqual(layout.groundTop);
      expect(layout.horizonY).toBeLessThan(layout.groundTop);
      expect(layout.actorBaseline).toBeGreaterThan(layout.groundTop);
      expect(layout.groundTop).toBeLessThan(height);
    }
  });
});
