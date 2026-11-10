import { describe, expect, it, vi } from "vitest";
import { CITIES } from "../src/data/cities";
import { WORLD_CITY_ART } from "../src/data/worldCityArt";
import { createWorldCityArt, getWorldCityArtTiles } from "../src/systems/worldCityArt";
import { getChunk } from "../src/data/chunks";
import { Terrain } from "../src/data/mapTypes";

describe("distinct multi-tile world city landmarks", () => {
  it("covers every canonical city with an original multi-tile silhouette, not palette swaps", () => {
    expect(Object.keys(WORLD_CITY_ART).sort()).toEqual(CITIES.map(({ id }) => id).sort());
    const colors = new Set<string>();
    const silhouettes = new Set<string>();
    for (const city of CITIES) {
      const profile = WORLD_CITY_ART[city.id]!;
      const art = createWorldCityArt(profile);
      expect(art.width, city.id).toBeGreaterThan(32);
      expect(art.height, city.id).toBeGreaterThan(32);
      expect(art.width % 32).toBe(0);
      expect(art.height % 32).toBe(0);
      colors.add([...art.pixels].join(","));
      silhouettes.add([...art.pixels].filter((_value, index) => index % 4 === 3).join(","));
    }
    expect(colors.size).toBe(CITIES.length);
    expect(silhouettes.size).toBe(CITIES.length);
  });

  it("shows nothing before the real gate is explored and paints only explored footprint cells", () => {
    const city = CITIES.find(({ id }) => id === "willowdale_city")!;
    expect(getWorldCityArtTiles(city, () => false)).toEqual([]);
    expect(getWorldCityArtTiles(city, (x, y) => x === city.tileX && y === city.tileY))
      .toEqual([expect.objectContaining({ x: city.tileX, y: city.tileY })]);
    const tiles = getWorldCityArtTiles(city, () => true);
    expect(tiles.length).toBeGreaterThan(1);
    expect(new Set(tiles.map(({ x, y }) => `${x},${y}`)).size).toBe(tiles.length);
    expect(tiles.every(({ x, y }) => x >= 0 && x < 20 && y >= 0 && y < 15)).toBe(true);
  });

  it("keeps all gate coordinates, terrain, routes and island water unchanged without consuming RNG", () => {
    const before = JSON.stringify(CITIES);
    const random = vi.spyOn(Math, "random").mockImplementation(() => { throw new Error("Shared RNG used."); });
    try {
      for (const city of CITIES) {
        expect(createWorldCityArt(WORLD_CITY_ART[city.id]!).pixels)
          .toEqual(createWorldCityArt(WORLD_CITY_ART[city.id]!).pixels);
        const tiles = getWorldCityArtTiles(city, () => true);
        expect(tiles.some(({ x, y }) => x === city.tileX && y === city.tileY)).toBe(true);
        expect(getChunk(city.chunkX, city.chunkY)!.mapData[city.tileY]![city.tileX])
          .toBe(city.id === "starfall_atoll" ? Terrain.Water : Terrain.Town);
      }
      expect(JSON.stringify(CITIES)).toBe(before);
    } finally { random.mockRestore(); }
  });
});
