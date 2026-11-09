import { createHeroArt } from "./humanoidArt";
import { createNpcArt } from "./npcArt";
import { PixelSurface } from "./pixelArt";
import type { HeroVisualDescriptor } from "./heroVisuals";
import type { NpcVisualDescriptor } from "./npcVisuals";
import { createMonsterArt } from "./monsterArt";
import type { Monster } from "../data/monsters";

function createBust(source: PixelSurface): PixelSurface {
  const art = new PixelSurface(48, 48);
  for (let y = 0; y < 48; y++) {
    for (let x = 0; x < 48; x++) {
      const index = (Math.floor(y / 2) * source.width + 4 + Math.floor(x / 2)) * 4;
      const alpha = source.pixels[index + 3]!;
      if (alpha > 0) art.pixel(x, y,
        (source.pixels[index]! << 16) | (source.pixels[index + 1]! << 8) | source.pixels[index + 2]!, alpha);
    }
  }
  return art;
}

export function createHeroPortraitArt(descriptor: HeroVisualDescriptor): PixelSurface {
  return createBust(createHeroArt(descriptor, "front", "standard"));
}

export function createNpcPortraitArt(visual: NpcVisualDescriptor): PixelSurface {
  return createBust(createNpcArt(visual));
}

export function createMonsterPortraitArt(monster: Monster): PixelSurface {
  const source = createMonsterArt(monster);
  const art = new PixelSurface(48, 48);
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const index = (y * source.width + x) * 4;
      if (source.pixels[index + 3]) art.pixel(x, y + 2,
        (source.pixels[index]! << 16) | (source.pixels[index + 1]! << 8) | source.pixels[index + 2]!);
    }
  }
  return art;
}
