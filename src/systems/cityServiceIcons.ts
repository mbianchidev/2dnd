import { createBattleActionIcon } from "./battleHud";
import type { CityServiceId } from "./cityServices";
import { createMenuIconArt } from "./menuIcons";
import { PixelSurface } from "./pixelArt";

/** Original service silhouettes share the existing sword, shield, potion and inventory art. */
export function createCityServiceSignArt(id: CityServiceId): PixelSurface {
  const art = new PixelSurface(24, 24);
  const reused = id === "weapon" ? createBattleActionIcon("attack")
    : id === "armor" ? createBattleActionIcon("defend")
      : id === "magic" ? createBattleActionIcon("items")
        : id === "general" ? createMenuIconArt("inventory") : undefined;
  if (reused) {
    const dx = (art.width - reused.width) / 2;
    const dy = (art.height - reused.height) / 2;
    for (let y = 0; y < reused.height; y++) {
      for (let x = 0; x < reused.width; x++) {
        const offset = (y * reused.width + x) * 4;
        const color = (reused.pixels[offset]! << 16) | (reused.pixels[offset + 1]! << 8) | reused.pixels[offset + 2]!;
        art.pixel(x + dx, y + dy, color, reused.pixels[offset + 3]!);
      }
    }
    return art;
  }

  const light = 0xf3e7bc;
  const gold = 0xe7bd79;
  const blue = 0xa2d7dd;
  switch (id) {
    case "inn":
      art.rect(4, 8, 3, 11, light);
      art.rect(7, 12, 13, 5, gold);
      art.rect(8, 9, 5, 4, light);
      art.rect(7, 17, 14, 2, light);
      art.rect(18, 12, 3, 8, light);
      break;
    case "bank":
      art.polygon([{ x: 3, y: 8 }, { x: 12, y: 3 }, { x: 21, y: 8 }], light);
      art.rect(4, 9, 16, 2, gold);
      for (const x of [5, 10, 15, 19]) art.rect(x, 11, 2, 7, light);
      art.rect(3, 18, 18, 2, gold);
      break;
    case "stable":
      art.polygon([
        { x: 5, y: 20 }, { x: 6, y: 13 }, { x: 6, y: 9 }, { x: 9, y: 4 },
        { x: 10, y: 7 }, { x: 14, y: 7 }, { x: 16, y: 4 }, { x: 18, y: 9 },
        { x: 19, y: 12 }, { x: 21, y: 14 }, { x: 20, y: 17 }, { x: 16, y: 17 },
        { x: 13, y: 14 }, { x: 12, y: 20 },
      ], light);
      art.line(7, 9, 7, 17, gold, 2);
      art.rect(16, 10, 2, 2, 0x253d3b);
      break;
    case "shipwright":
      art.rect(11, 4, 2, 12, light);
      art.polygon([{ x: 10, y: 5 }, { x: 5, y: 14 }, { x: 10, y: 14 }], light);
      art.polygon([{ x: 14, y: 7 }, { x: 19, y: 14 }, { x: 14, y: 14 }], blue);
      art.polygon([{ x: 3, y: 16 }, { x: 21, y: 16 }, { x: 18, y: 20 }, { x: 6, y: 20 }], gold);
      art.rect(4, 21, 16, 1, blue);
      break;
    case "weapon":
    case "armor":
    case "magic":
    case "general":
      throw new Error(`[city] Missing reused icon for ${id}.`);
  }
  return art;
}
