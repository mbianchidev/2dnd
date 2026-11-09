import { describe, expect, it } from "vitest";
import { Terrain } from "../src/data/mapTypes";
import { createMinimapPlan, getMinimapBounds } from "../src/systems/minimap";

describe("exploration minimap", () => {
  it("never exposes terrain or markers behind fog", () => {
    const a = Array.from({ length: 15 }, () => Array<Terrain>(20).fill(Terrain.Grass));
    const b = structuredClone(a);
    b[7]![11] = Terrain.Chest;
    b[6]![10] = Terrain.DungeonBoss;
    const explored = (x: number, y: number): boolean => x === 10 && y === 7;
    const first = createMinimapPlan(a, 10, 7, explored);
    const second = createMinimapPlan(b, 10, 7, explored);
    expect(second).toEqual(first);
    expect(second.description).not.toMatch(/treasure|boss/);
    expect(second.cells.every((cell) => cell.dx * cell.dx + cell.dy * cell.dy <= 25)).toBe(true);
    expect(second.cells).toHaveLength(81);
  });

  it("shows nearby known dungeon stairs, doors, books and the exact centered player location", () => {
    const map = Array.from({ length: 15 }, () => Array<Terrain>(20).fill(Terrain.DungeonFloor));
    map[6]![10] = Terrain.DungeonStairs;
    map[7]![12] = Terrain.CityGate;
    const plan = createMinimapPlan(map, 10, 7, () => true, new Map([["9,7", "book"]]));
    expect(plan.cells.find((cell) => cell.dx === 0 && cell.dy === -1)?.marker).toBe("stairs");
    expect(plan.cells.find((cell) => cell.dx === -1 && cell.dy === 0)?.marker).toBe("book");
    expect(plan.description).toContain("Tile 11, 8");
    expect(plan.description).toContain("stairs");
    expect(plan.description).toContain("door");
  });

  it("fits supported viewports and moves away from the hero at the upper-right map edge", () => {
    for (const viewport of [{ x: 0, y: 0, width: 640, height: 528 }, { x: 0, y: 0, width: 320, height: 240 }]) {
      const bounds = getMinimapBounds(viewport, 10, 7);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
      expect(getMinimapBounds(viewport, 18, 2).x).toBe(8);
    }
  });
});
