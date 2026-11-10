import { describe, expect, it, vi } from "vitest";
import { CITIES, getCityChunk, getCityChunkCount } from "../src/data/cities";
import { Terrain } from "../src/data/mapTypes";
import { getCitySurfaceTerrainOverride, getWalkthroughRugTiles } from "../src/systems/citySurface";
import { createTerrainArt, getTerrainArtSpec } from "../src/systems/terrainArt";

describe("city multi-tile surface ownership", () => {
  it("uses bare ground beneath every facade cell, including real doors and roof corners", () => {
    const random = vi.spyOn(Math, "random").mockImplementation(() => { throw new Error("Shared RNG used."); });
    try {
      for (const city of CITIES) {
        for (let index = 0; index < getCityChunkCount(city); index++) {
          const chunk = getCityChunk(city, index)!;
          const before = JSON.stringify(chunk);
          for (const building of chunk.buildings ?? []) {
            for (let y = building.y; y < building.y + building.height; y++) {
              for (let x = building.x; x < building.x + building.width; x++) {
                expect(getCitySurfaceTerrainOverride(chunk, x, y), `${building.id}:${x},${y}`).toBe(Terrain.CityFloor);
                for (const ground of [Terrain.Grass, Terrain.Forest, Terrain.Tundra, Terrain.Sand]) {
                  const spec = { ...getTerrainArtSpec(chunk.mapData, x, y), ground, terrain: Terrain.CityFloor };
                  const art = createTerrainArt(spec);
                  expect(art.pixels.filter((_value, offset) => offset % 4 === 3 && art.pixels[offset] === 255))
                    .toHaveLength(32 * 32);
                }
              }
            }
          }
          expect(JSON.stringify(chunk)).toBe(before);
        }
      }
    } finally { random.mockRestore(); }
  });

  it("keeps furniture on wooden floors, windows on masonry and outer room cells hidden", () => {
    for (const city of CITIES) {
      for (const room of city.chunks?.filter((chunk) => chunk.interior) ?? []) {
        expect(getCitySurfaceTerrainOverride(room, 0, 0)).toBe("fog");
        for (const prop of room.interior!.props) {
          expect(getCitySurfaceTerrainOverride(room, prop.x, prop.y), prop.id)
            .toBe(prop.kind === "window" || prop.kind === "painting" ? undefined : Terrain.ShopFloor);
        }
      }
    }
  });

  it("decorates every separate walk-through floor without changing walkability or consuming RNG", () => {
    const random = vi.spyOn(Math, "random").mockImplementation(() => { throw new Error("Shared RNG used."); });
    try {
      const map = [
        [Terrain.ShopFloor, Terrain.ShopFloor, Terrain.CityWall, Terrain.ShopFloor],
        [Terrain.ShopFloor, Terrain.ShopFloor, Terrain.CityWall, Terrain.ShopFloor],
      ];
      const before = structuredClone(map);
      const rugs = getWalkthroughRugTiles(map);
      expect(rugs).toHaveLength(2);
      expect(rugs).toEqual(getWalkthroughRugTiles(map));
      expect(rugs.some(({ x }) => x < 2)).toBe(true);
      expect(rugs.some(({ x }) => x === 3)).toBe(true);
      expect(map).toEqual(before);
      for (const city of CITIES) {
        for (let index = 0; index < getCityChunkCount(city); index++) {
          const chunk = getCityChunk(city, index)!;
          if (chunk.interior) continue;
          const snapshot = JSON.stringify(chunk);
          const tiles = getWalkthroughRugTiles(chunk.mapData);
          for (const tile of tiles) expect(chunk.mapData[tile.y]![tile.x]).toBe(Terrain.ShopFloor);
          if (chunk.mapData.some((row) => row.includes(Terrain.ShopFloor))) expect(tiles.length).toBeGreaterThan(0);
          expect(JSON.stringify(chunk)).toBe(snapshot);
        }
      }
    } finally { random.mockRestore(); }
  });
});
