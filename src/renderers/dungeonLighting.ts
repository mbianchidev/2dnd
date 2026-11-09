import * as Phaser from "phaser";
import { Terrain, isWalkable } from "../data/map";
import { TILE_SIZE } from "../config";
import { artNoise } from "../systems/pixelArt";

export class DungeonLightingRenderer {
  private graphics: Phaser.GameObjects.Graphics | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.clear());
  }

  render(map: Terrain[][], level: number, isExplored: (x: number, y: number) => boolean): void {
    if (!this.graphics) this.graphics = this.scene.add.graphics().setDepth(6);
    const graphics = this.graphics.clear();
    let count = 0;
    for (let y = 0; y < map.length && count < 12; y++) {
      for (let x = 0; x < map[y]!.length && count < 12; x++) {
        if (map[y]![x] !== Terrain.DungeonWall || !isExplored(x, y) || artNoise(x, y, level) % 7 !== 0) continue;
        const floorY = y + 1;
        const floor = map[floorY]?.[x];
        if (floor === undefined || !isWalkable(floor) || !isExplored(x, floorY)) continue;
        const px = x * TILE_SIZE + 16;
        const py = y * TILE_SIZE + 28;
        graphics.fillStyle(0xe8bd78, 0.12).fillEllipse(px, py + 14, 54, 33);
        graphics.fillStyle(0xf4cb86, 0.13).fillEllipse(px, py + 8, 32, 24);
        graphics.fillStyle(0x514131).fillRect(px - 1, py - 6, 3, 10);
        graphics.fillStyle(0xc98149).fillRect(px - 3, py - 10, 7, 5);
        graphics.fillStyle(0xf2d18d).fillRect(px - 1, py - 13, 3, 8);
        count++;
      }
    }
  }

  clear(): void {
    this.graphics?.destroy();
    this.graphics = null;
  }
}
