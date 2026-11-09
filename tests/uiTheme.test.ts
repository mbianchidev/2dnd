import { describe, expect, it, vi } from "vitest";
import { getGameTextStyle, UI_COLORS, UI_CSS, UI_FONT_BODY, UI_FONT_DISPLAY } from "../src/systems/uiTheme";
import { createMenuIconArt, type MenuIconId } from "../src/systems/menuIcons";
import { PixelSceneryGraphics } from "../src/renderers/pixelScenery";
import { CUTSCENE_PALETTES } from "../src/data/cutsceneScenery";
import { WORLD_ART_COLORS } from "../src/systems/terrainArt";
import { Terrain } from "../src/data/mapTypes";

describe("shared menu art direction", () => {
  it("uses readable body type and serif headings before measurement, without mutating caller styles", () => {
    const body = { fontFamily: "monospace", fontSize: "13px", color: "#ffffff", backgroundColor: "#2a2a4e" };
    expect(getGameTextStyle(body)).toEqual({ ...body, fontFamily: UI_FONT_BODY, backgroundColor: UI_CSS.raised });
    expect(body.backgroundColor).toBe("#2a2a4e");
    expect(getGameTextStyle({ fontSize: "24px" }).fontFamily).toBe(UI_FONT_DISPLAY);
    expect(getGameTextStyle({ fontFamily: "monospace", fontSize: "16px" }).fontFamily).toBe(UI_FONT_DISPLAY);
    expect(getGameTextStyle({ backgroundColor: "#4a3f6b" }).backgroundColor).toBe(UI_CSS.selected);
    expect(getGameTextStyle({ fontFamily: "Specialty", fontSize: "12px" }).fontFamily).toBe("Specialty");
  });

  it("gives every menu action a non-empty, distinct original icon without gameplay RNG", () => {
    const ids: readonly MenuIconId[] = [
      "resume", "inventory", "party", "questJournal", "chronicle", "codex", "achievements",
      "gathering", "crafting", "minigames", "devotion", "tips", "save", "settings", "quit",
      "newGame", "newGamePlus", "continue", "saveSlots", "map", "equipment",
    ];
    const random = vi.spyOn(Math, "random").mockImplementation(() => { throw new Error("Shared RNG used."); });
    try {
      const icons = ids.map((id) => {
        const art = createMenuIconArt(id);
        expect(art.pixels.filter((_value, index) => index % 4 === 3 && art.pixels[index] !== 0).length, id)
          .toBeGreaterThan(10);
        return [...art.pixels].join(",");
      });
      expect(new Set(icons).size).toBe(ids.length);
    } finally { random.mockRestore(); }
  });

  it("keeps menu text and selection legible against their darkest and lightest surfaces", () => {
    const luminance = (color: number): number => {
      const channels = [16, 8, 0].map((shift) => {
        const channel = ((color >> shift) & 255) / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
    };
    for (const foreground of [UI_COLORS.text, UI_COLORS.gold, UI_COLORS.muted]) {
      for (const background of [UI_COLORS.panel, UI_COLORS.raised, UI_COLORS.selected]) {
        expect((luminance(foreground) + 0.05) / (luminance(background) + 0.05)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe("coherent scene raster treatment", () => {
  it("uses the world palette in both scene environments instead of unrelated ground colors", () => {
    expect(CUTSCENE_PALETTES.heartlands.ground).toBe(WORLD_ART_COLORS[Terrain.Grass]);
    expect(CUTSCENE_PALETTES.forest.ground).toBe(WORLD_ART_COLORS[Terrain.Forest]);
    expect(CUTSCENE_PALETTES.frost.ground).toBe(WORLD_ART_COLORS[Terrain.Tundra]);
    expect(CUTSCENE_PALETTES.sea.ground).toBe(WORLD_ART_COLORS[Terrain.Water]);
  });

  it("paints curves, diagonals and filled polygons solely as integer grid rectangles", () => {
    const rectangles: number[][] = [];
    const graphics = { fillStyle: vi.fn(), fillRect: (x: number, y: number, w: number, h: number): void => {
      rectangles.push([x, y, w, h]);
    } };
    const raster = new PixelSceneryGraphics(graphics);
    raster.fillStyle(0x123456).fillEllipse(20.3, 10.1, 21, 14);
    raster.fillTriangle(-5, 6, 25.2, 36, 1, 40);
    raster.lineStyle(1, 0xffffff).lineBetween(1.3, 2.7, 17.1, 19.9);
    expect(rectangles.length).toBeGreaterThan(20);
    expect(rectangles.every((rectangle) => rectangle.every((coordinate) => coordinate % 2 === 0))).toBe(true);
    expect(rectangles.every(([, , width, height]) => width! > 0 && height! > 0)).toBe(true);
    expect(() => new PixelSceneryGraphics(graphics, 0)).toThrow("Pixel size");
  });
});
