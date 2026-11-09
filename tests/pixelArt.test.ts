import { describe, expect, it, vi } from "vitest";
import { artNoise, getPixelArtGroundOrigin, PixelSurface, shadePixelColor } from "../src/systems/pixelArt";

describe("procedural pixel-art raster", () => {
  it("clips organic silhouettes without filling their transparent corners", () => {
    const art = new PixelSurface(32, 32);
    art.volume(16, 18, 11, 10, 0x458844);
    expect(art.pixels[3]).toBe(0);
    const occupied = Array.from(art.pixels).filter((value, index) => index % 4 === 3 && value > 0).length;
    expect(occupied).toBeGreaterThan(250);
    expect(occupied).toBeLessThan(500);
    expect(new Set(Array.from({ length: 32 * 32 }, (_, index) =>
      [...art.pixels.slice(index * 4, index * 4 + 3)].join(","))).size).toBeGreaterThan(4);
  });

  it("renders repeatable clipped polygons, lines and textures without gameplay RNG", () => {
    const rng = vi.spyOn(Math, "random");
    const draw = (): PixelSurface => {
      const art = new PixelSurface(32, 32);
      art.polygon([{ x: -4, y: 3 }, { x: 16, y: 0 }, { x: 35, y: 28 }], 0x805c43);
      art.line(-5, 4, 40, 20, 0xd3b277, 2);
      art.texture(0x805c43, 19);
      return art;
    };
    expect(draw().pixels).toEqual(draw().pixels);
    expect(rng).not.toHaveBeenCalled();
    rng.mockRestore();
    expect(artNoise(32, 12, 19)).toBe(artNoise(32, 12, 19));
    expect(artNoise(32, 12, 19)).not.toBe(artNoise(31, 12, 19));
    expect(shadePixelColor(0xff00fe, 20)).toBe(0xff14ff);
  });

  it.each([[0, 32], [32, -1], [2.5, 8], [513, 8]])("rejects invalid dimensions %s x %s", (width, height) => {
    expect(() => new PixelSurface(width, height)).toThrow(/dimensions/);
  });

  it("anchors the last visible pixel edge rather than transparent frame padding", () => {
    const art = new PixelSurface(8, 10);
    art.rect(2, 1, 4, 6, 0x458844);
    expect(getPixelArtGroundOrigin(art)).toBe(0.7);
    art.pixel(7, 9, 0xffffff);
    expect(getPixelArtGroundOrigin(art)).toBe(1);
    expect(() => getPixelArtGroundOrigin(new PixelSurface(4, 4))).toThrow(/empty/);
  });
});
