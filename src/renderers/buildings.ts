import type * as Phaser from "phaser";
import { shadePixelColor as shade } from "../systems/pixelArt";

export interface BuildingArtBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly doorX: number;
}

/** A shared pitched roof, shaded facade and lit windows, not an opaque rectangular lid. */
export function drawBuildingExterior(graphics: Phaser.GameObjects.Graphics, bounds: BuildingArtBounds, roof: number): void {
  const { x, y, width: w, height: h, doorX } = bounds;
  const fill = (color: number, points: readonly { x: number; y: number }[]): void => {
    graphics.fillStyle(color).beginPath().moveTo(points[0]!.x, points[0]!.y);
    for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
    graphics.closePath().fillPath();
  };
  const eave = y + h - 38;
  const peak = Math.max(0, y - 6);
  graphics.fillStyle(0x726957).fillRect(x + 3, eave, w - 6, 38);
  graphics.fillStyle(0xd0bf98).fillRect(x + 4, eave, w - 11, 34);
  graphics.fillStyle(0xe5d3a5).fillRect(x + 5, eave + 2, 3, 31);
  graphics.fillStyle(0xa5906d);
  for (let row = 0; row < 6; row++) {
    for (let column = 0; column < Math.floor(w / 15); column++) {
      graphics.fillRect(x + 9 + column * 15 + row % 2 * 5, eave + 4 + row * 5, 8, 1);
    }
  }
  fill(shade(roof, -39), [
    { x: x - 2, y: eave + 1 }, { x: x + 6, y: peak + 28 },
    { x: x + w * 0.5, y: peak }, { x: x + w - 5, y: peak + 28 },
    { x: x + w + 2, y: eave + 1 },
  ]);
  fill(roof, [
    { x, y: eave - 2 }, { x: x + 8, y: peak + 28 },
    { x: x + w * 0.5, y: peak + 2 }, { x: x + w - 8, y: peak + 28 },
    { x: x + w - 1, y: eave - 2 },
  ]);
  for (let row = peak + 6; row < eave - 2; row += 5) {
    const inset = row < peak + 28 ? Math.ceil((1 - (row - peak) / 28) * w / 2 + 8)
      : Math.max(3, Math.ceil((eave - row) * 0.15));
    graphics.fillStyle(shade(roof, -17)).fillRect(x + inset, row, w - inset * 2, 1);
    graphics.fillStyle(shade(roof, 22));
    for (let column = x + inset + ((row / 5) % 2) * 5; column < x + w - inset - 5; column += 10) {
      graphics.fillRect(column, row - 2, 6, 1);
    }
  }
  graphics.fillStyle(shade(roof, 35)).fillRect(x + w * 0.5 - 2, peak + 2, 4, Math.max(0, eave - peak - 6));
  graphics.fillStyle(0x504a3d).fillRect(doorX - 9, eave + 4, 18, 34);
  graphics.fillStyle(0xa07649).fillRect(doorX - 7, eave + 6, 14, 32);
  graphics.fillStyle(0xe5c98c).fillRect(doorX + 3, eave + 22, 2, 2);
  for (const windowX of [x + 15, x + w - 23]) {
    graphics.fillStyle(0x77674f).fillRect(windowX - 2, eave + 5, 12, 10);
    graphics.fillStyle(0xc7be8b).fillRect(windowX, eave + 6, 8, 7);
    graphics.fillStyle(0x877453).fillRect(windowX + 3, eave + 6, 1, 7);
    graphics.fillRect(windowX, eave + 9, 8, 1);
  }
}
