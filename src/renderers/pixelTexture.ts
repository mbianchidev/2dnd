import type * as Phaser from "phaser";
import type { PixelSurface } from "../systems/pixelArt";

export function createPixelTexture(
  scene: Phaser.Scene,
  key: string,
  art: PixelSurface,
  scale = 1,
): void {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, art.width * scale, art.height * scale);
  if (!texture) throw new Error(`[art] Cannot create procedural texture ${key}.`);
  const image = texture.context.createImageData(art.width * scale, art.height * scale);
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const source = (Math.floor(y / scale) * art.width + Math.floor(x / scale)) * 4;
      const target = (y * image.width + x) * 4;
      image.data[target] = art.pixels[source]!;
      image.data[target + 1] = art.pixels[source + 1]!;
      image.data[target + 2] = art.pixels[source + 2]!;
      image.data[target + 3] = art.pixels[source + 3]!;
    }
  }
  texture.context.putImageData(image, 0, 0);
  texture.refresh();
}
