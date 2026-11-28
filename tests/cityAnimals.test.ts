import * as Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { TILE_SIZE } from "../src/config";
import { CITIES, getCityChunk } from "../src/data/cities";
import { isWalkable } from "../src/data/map";
import { CityRenderer } from "../src/renderers/city";

const harness = vi.hoisted(() => {
  class Sprite {
    constructor(readonly x: number, readonly y: number, readonly key: string) {}
    setScale(_scale: number): this { return this; }
    setDepth(_depth: number): this { return this; }
  }
  class Scene {
    readonly sprites: Sprite[] = [];
    readonly add = {
      sprite: (x: number, y: number, key: string): Sprite => {
        const sprite = new Sprite(x, y, key);
        this.sprites.push(sprite);
        return sprite;
      },
    };
    readonly time = { addEvent: (): object => ({}) };
    readonly tweens = { add: (): void => {} };
  }
  return { Scene };
});

vi.mock("phaser", () => ({ Scene: harness.Scene }));

describe("city animals", () => {
  it("keeps animal spawns outside the new solid shop facades", () => {
    for (const city of CITIES) {
      const scene = Object.assign(new Phaser.Scene(), new harness.Scene());
      const chunk = getCityChunk(city, 0)!;
      new CityRenderer(scene).spawnCityAnimals(city, chunk.mapData, 0, () => true);
      for (const sprite of scene.sprites) {
        const x = Math.floor(sprite.x / TILE_SIZE);
        const y = Math.floor(sprite.y / TILE_SIZE);
        const insideShop = chunk.buildings?.some((building) =>
          building.kind === "shop" && x >= building.x && x < building.x + building.width
          && y >= building.y && y < building.y + building.height);
        if (insideShop) expect(isWalkable(chunk.mapData[y]![x]!), `${city.id}:${sprite.key}:${x},${y}`).toBe(true);
      }
    }
  });
});
