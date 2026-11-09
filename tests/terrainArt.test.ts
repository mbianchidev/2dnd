import { describe, expect, it, vi } from "vitest";
import { Terrain } from "../src/data/mapTypes";
import { createTerrainArt, getTerrainArtKey, getTerrainArtSpec } from "../src/systems/terrainArt";

describe("contextual exploration art", () => {
  it("joins water and rivers and gives only exposed shores an irregular bank", () => {
    const map = [[Terrain.Grass, Terrain.Water, Terrain.Grass],
      [Terrain.Grass, Terrain.Water, Terrain.River], [Terrain.Grass, Terrain.Water, Terrain.Grass]];
    const spec = getTerrainArtSpec(map, 1, 1);
    expect(spec.edges).toBe(8);
    const art = createTerrainArt(spec);
    const shoreLengths = Array.from({ length: 32 }, (_, y) =>
      Array.from({ length: 8 }, (_, x) => art.pixels[(y * 32 + x) * 4]!).filter((red) => red > 80).length);
    expect(new Set(shoreLengths).size).toBeGreaterThan(2);
  });

  it("keeps every terrain distinct, bounded, repeatable and RNG-independent", () => {
    const rng = vi.spyOn(Math, "random");
    const signatures = new Set<string>();
    for (const terrain of Object.values(Terrain).filter((value): value is Terrain => typeof value === "number")) {
      const spec = getTerrainArtSpec([[terrain]], 0, 0);
      const art = createTerrainArt(spec);
      expect(art.pixels).toHaveLength(32 * 32 * 4);
      expect(art.pixels).toEqual(createTerrainArt(spec).pixels);
      expect(getTerrainArtKey(spec)).toMatch(/^terrain-/);
      signatures.add(Buffer.from(art.pixels).toString("base64"));
    }
    expect(signatures.size).toBeGreaterThanOrEqual(37);
    expect(rng).not.toHaveBeenCalled();
    rng.mockRestore();
  });

  it("does not mutate maps and preserves snowy mountain approaches", () => {
    const map = [[Terrain.Tundra, Terrain.Mountain, Terrain.Tundra]];
    const before = structuredClone(map);
    const spec = getTerrainArtSpec(map, 1, 0);
    expect(spec.ground).toBe(Terrain.Tundra);
    createTerrainArt(spec);
    expect(map).toEqual(before);
  });
});
