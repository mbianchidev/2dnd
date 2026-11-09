import type * as Phaser from "phaser";
import type { InteriorPropKind } from "../data/mapTypes";
import { PixelSurface } from "../systems/pixelArt";
import { createPixelTexture } from "./pixelTexture";

const PROP_KINDS: readonly InteriorPropKind[] = [
  "bookshelf", "book", "sack", "pantry", "table", "bed", "hearth", "counter", "rack", "plant", "rug",
];

export function getInteriorPropTexture(kind: InteriorPropKind, searched = false): string {
  return `interior-${kind}${searched ? "-searched" : ""}`;
}

export function generateInteriorTextures(scene: Phaser.Scene): void {
  for (const kind of PROP_KINDS) {
    for (const searched of [false, true]) {
      const art = new PixelSurface(32, 32);
      if (kind === "bookshelf" || kind === "pantry" || kind === "rack") {
        art.rect(3, 3, 27, 27, 0x413a32);
        art.rect(4, 4, 24, 24, 0x825f40);
        for (let row = 0; row < 3; row++) {
          art.rect(4, 10 + row * 8, 24, 2, 0xd2ad76);
          for (let column = 0; column < 5; column++) {
            const color = [0x789281, 0xaa715d, 0xa5a7ac, 0xbeab71, 0x8b7c9c][column]!;
            if (kind === "pantry") art.volume(7 + column * 4, 7 + row * 8, 2, 2, color);
            else if (kind === "rack") {
              art.line(7 + column * 4, 5 + row * 8, 7 + column * 4, 10 + row * 8, 0xb8c4bf);
              art.rect(6 + column * 4, 9 + row * 8, 3, 1, 0xd2ad76);
            } else {
              art.rect(5 + column * 4, 4 + row * 8, 3, 6, color);
              art.pixel(6 + column * 4, 5 + row * 8, 0xdfcea0);
            }
          }
        }
      } else if (kind === "table" || kind === "counter" || kind === "book") {
        art.rect(5, 23, 3, 7, 0x604d37);
        art.rect(25, 23, 3, 7, 0x604d37);
        art.polygon([{ x: 2, y: 10 }, { x: 28, y: 10 }, { x: 30, y: 22 }, { x: 4, y: 24 }], 0x594333);
        art.polygon([{ x: 2, y: 9 }, { x: 28, y: 9 }, { x: 29, y: 19 }, { x: 3, y: 21 }], 0xbe945d);
        art.line(5, 11, 24, 11, 0xd8b981);
        art.line(5, 16, 26, 16, 0x987245);
        if (kind === "book") {
          art.polygon([{ x: 8, y: 10 }, { x: 16, y: 12 }, { x: 24, y: 10 },
            { x: 23, y: 17 }, { x: 16, y: 19 }, { x: 8, y: 17 }], 0xf0dfb6);
          art.line(16, 12, 16, 18, 0x9e8058);
          art.line(10, 13, 14, 14, 0x9e8058);
          art.line(18, 14, 22, 13, 0x9e8058);
        } else if (kind === "counter") {
          art.volume(21, 12, 3, 3, 0xc9b478);
          art.rect(8, 11, 6, 5, 0xe5d4a5);
        }
      } else if (kind === "bed") {
        art.rect(3, 3, 26, 27, 0x70543b);
        art.rect(5, 5, 22, 22, 0xa6b4a8);
        art.rect(6, 6, 20, 6, 0xe3ddbe);
        art.rect(6, 13, 20, 13, 0x92768f);
        art.line(7, 15, 25, 15, 0xb7a2b1);
        art.line(8, 14, 8, 25, 0xc2aec0);
      } else if (kind === "hearth") {
        art.rect(4, 4, 24, 25, 0x7c7567);
        art.rect(7, 10, 18, 17, 0x353632);
        art.rect(2, 27, 28, 3, 0xb5a78c);
        art.line(9, 24, 23, 24, 0x9b7149, 3);
        art.polygon([{ x: 10, y: 25 }, { x: 12, y: 17 }, { x: 16, y: 12 },
          { x: 20, y: 19 }, { x: 24, y: 25 }], 0xcf854c);
        art.volume(16, 22, 4, 5, 0xf1c57c, 0xcf854c);
      } else if (kind === "sack") {
        art.volume(16, 20, 9, 10, searched ? 0x8d8066 : 0xb9a077);
        art.rect(12, 7, 8, 5, 0xb9a077);
        art.line(12, 12, 20, 12, 0x63513b, 2);
        art.line(15, 14, 13, 24, 0xd4bb89);
        art.line(19, 16, 22, 24, 0x8e7652);
      } else if (kind === "plant") {
        art.volume(16, 25, 6, 4, 0xb18a62);
        art.line(16, 23, 16, 10, 0x53734b, 2);
        for (const [x, y] of [[10, 17], [22, 15], [12, 10], [19, 8]]) art.volume(x!, y!, 4, 2, 0x7f9759);
      } else {
        art.polygon([{ x: 2, y: 8 }, { x: 29, y: 8 }, { x: 30, y: 27 }, { x: 3, y: 27 }], 0x96745c);
        art.rect(5, 11, 22, 13, 0x667d76);
        art.line(5, 12, 26, 12, 0xd0bd88);
        art.line(5, 22, 26, 22, 0xd0bd88);
      }
      if (!searched && (kind === "book" || kind === "pantry" || kind === "sack")) {
        art.line(26, 2, 26, 7, 0xf2dda0);
        art.line(24, 4, 28, 4, 0xf2dda0);
      }
      createPixelTexture(scene, getInteriorPropTexture(kind, searched), art);
    }
  }
}
