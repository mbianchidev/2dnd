import * as Phaser from "phaser";
import { TRAP_TYPES, type TrapType } from "../data/traps";
import { TILE_SIZE } from "../config";

function drawTrapTexture(
  graphics: Phaser.GameObjects.Graphics,
  type: TrapType,
): void {
  switch (type) {
    case "spikePit":
      graphics.fillStyle(0x171717, 0.9);
      graphics.fillEllipse(16, 20, 24, 12);
      graphics.fillStyle(0xb0bec5, 1);
      graphics.fillTriangle(8, 22, 12, 10, 15, 22);
      graphics.fillTriangle(14, 22, 18, 8, 21, 22);
      graphics.fillTriangle(20, 22, 24, 12, 27, 22);
      break;
    case "poisonDarts":
      graphics.fillStyle(0x263238, 0.85);
      graphics.fillRect(3, 6, 6, 20);
      graphics.fillStyle(0x7cb342, 1);
      for (let y = 9; y <= 23; y += 7) {
        graphics.fillCircle(6, y, 2);
        graphics.fillTriangle(9, y, 25, y - 2, 25, y + 2);
      }
      break;
    case "fallingRocks":
      graphics.fillStyle(0x795548, 0.95);
      graphics.fillCircle(10, 11, 6);
      graphics.fillCircle(20, 9, 7);
      graphics.fillCircle(16, 21, 8);
      graphics.lineStyle(2, 0x3e2723, 1);
      graphics.lineBetween(4, 28, 12, 22);
      graphics.lineBetween(20, 23, 28, 29);
      break;
    case "alarm":
      graphics.lineStyle(2, 0xffca28, 1);
      graphics.lineBetween(3, 24, 29, 8);
      graphics.strokeCircle(16, 16, 8);
      graphics.strokeCircle(16, 16, 12);
      graphics.fillStyle(0xff5252, 1);
      graphics.fillCircle(16, 16, 3);
      break;
    case "hiddenFloor":
      graphics.lineStyle(2, 0x8d6e63, 0.9);
      graphics.strokeRect(5, 5, 22, 22);
      graphics.lineBetween(5, 5, 27, 27);
      graphics.lineBetween(27, 5, 5, 27);
      graphics.fillStyle(0x3e2723, 0.5);
      graphics.fillRect(12, 12, 8, 8);
      break;
    case "necroticRune":
      graphics.lineStyle(3, 0xab47bc, 1);
      graphics.strokeCircle(16, 16, 11);
      graphics.lineBetween(16, 4, 10, 25);
      graphics.lineBetween(16, 4, 23, 25);
      graphics.lineBetween(9, 14, 24, 14);
      graphics.fillStyle(0x6a1b9a, 0.8);
      graphics.fillCircle(16, 16, 4);
      break;
    case "frostBurst":
      graphics.lineStyle(2, 0x80deea, 1);
      graphics.lineBetween(16, 3, 16, 29);
      graphics.lineBetween(3, 16, 29, 16);
      graphics.lineBetween(7, 7, 25, 25);
      graphics.lineBetween(25, 7, 7, 25);
      graphics.fillStyle(0xe0f7fa, 1);
      graphics.fillCircle(16, 16, 4);
      break;
    case "flameJet":
      graphics.fillStyle(0x424242, 0.9);
      graphics.fillRect(5, 23, 22, 5);
      graphics.fillStyle(0xff6f00, 1);
      graphics.fillTriangle(8, 23, 13, 6, 17, 23);
      graphics.fillStyle(0xffd54f, 1);
      graphics.fillTriangle(14, 23, 19, 3, 24, 23);
      break;
  }
}

/** Generate transparent overlay textures for all dungeon trap cues. */
export function generateTrapTextures(scene: Phaser.Scene): void {
  for (const type of TRAP_TYPES) {
    const graphics = scene.add.graphics();
    drawTrapTexture(graphics, type);
    graphics.generateTexture(`trap_${type}`, TILE_SIZE, TILE_SIZE);
    graphics.destroy();
  }
}
