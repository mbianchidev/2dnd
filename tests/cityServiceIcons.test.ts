import { describe, expect, it, vi } from "vitest";
import { CITIES, getCityChunk, getCityChunkCount } from "../src/data/cities";
import { createCityServiceSignArt } from "../src/systems/cityServiceIcons";
import { getCityServiceId, getVisibleCityServiceDescriptions } from "../src/systems/cityServices";

function luminance(color: number): number {
  const channel = (shift: number): number => {
    const value = ((color >> shift) & 255) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
}

describe("city service pictograms", () => {
  it("uses a distinct readable silhouette for every real service without gameplay RNG", () => {
    const random = vi.spyOn(Math, "random").mockImplementation(() => { throw new Error("Shared RNG used."); });
    try {
      const icons = new Map<string, Uint8ClampedArray>();
      for (const city of CITIES) {
        for (let index = 0; index < getCityChunkCount(city); index++) {
          for (const shop of getCityChunk(city, index)!.shops) {
            const id = getCityServiceId(shop);
            if (icons.has(id)) continue;
            const art = createCityServiceSignArt(id);
            expect([art.width, art.height]).toEqual([24, 24]);
            for (const background of [0x253d3b, 0x000000]) {
              const backgroundLuminance = luminance(background);
              let visiblePixels = 0;
              for (let offset = 0; offset < art.pixels.length; offset += 4) {
                if (art.pixels[offset + 3] !== 255) continue;
                const color = (art.pixels[offset]! << 16) | (art.pixels[offset + 1]! << 8) | art.pixels[offset + 2]!;
                const light = luminance(color);
                const contrast = (Math.max(light, backgroundLuminance) + 0.05)
                  / (Math.min(light, backgroundLuminance) + 0.05);
                if (contrast >= 3) visiblePixels += 1;
              }
              expect(visiblePixels, `${id}:${background.toString(16)}`).toBeGreaterThan(20);
            }
            icons.set(id, art.pixels);
          }
        }
      }
      expect([...icons.keys()].sort()).toEqual(
        ["armor", "bank", "general", "inn", "magic", "shipwright", "stable", "weapon"].sort(),
      );
      expect(new Set([...icons.values()].map((pixels) => Array.from(pixels).join(","))).size).toBe(icons.size);
    } finally { random.mockRestore(); }
  });

  it("describes only explored services for the existing accessible minimap", () => {
    const shops = CITIES.find((city) => city.id === "willowdale_city")!.shops;
    const selected = shops[0]!;
    const descriptions = getVisibleCityServiceDescriptions(shops, (x, y) => x === selected.x && y === selected.y);
    expect(descriptions).toEqual([
      `WEAPONS: ${selected.name} at tile ${selected.x + 1}, ${selected.y + 1}`,
    ]);
  });
});
