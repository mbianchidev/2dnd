import * as Phaser from "phaser";
import type { CityChunk } from "../data/mapTypes";
import { TILE_SIZE } from "../config";
import type { PlayerState } from "../systems/player";
import { createOverlayContainer } from "../utils/ui";
import { getInteriorPropTexture } from "./interiorTextures";

export class InteriorRenderer {
  private container: Phaser.GameObjects.Container | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.clear());
  }

  render(player: PlayerState, room: CityChunk, interact: (id: string) => void): void {
    this.clear();
    if (!room.interior) return;
    this.container = createOverlayContainer(this.scene, "interior-props", 9, {
      x: 0, y: 0, width: 640, height: 480,
    });
    const lights = this.scene.add.graphics();
    for (const prop of room.interior.props) {
      const x = prop.x * TILE_SIZE + TILE_SIZE / 2;
      const y = prop.y * TILE_SIZE + TILE_SIZE / 2;
      if (prop.kind === "hearth") {
        lights.fillStyle(0xe3ac68, 0.1).fillEllipse(x, y + 8, 150, 100);
        lights.fillStyle(0xf4cb88, 0.08).fillEllipse(x, y + 8, 100, 64);
      }
    }
    this.container.add(lights);
    for (const prop of room.interior.props) {
      const sprite = this.scene.add.sprite(
        prop.x * TILE_SIZE + TILE_SIZE / 2, prop.y * TILE_SIZE + TILE_SIZE / 2,
        getInteriorPropTexture(prop.kind, player.progression.collectedTreasures.includes(prop.id)),
      );
      sprite.setData("layoutId", prop.id);
      if (prop.reward || prop.kind === "counter") {
        sprite.setInteractive({ useHandCursor: true }).on("pointerdown", () => interact(prop.id));
      }
      this.container.add(sprite);
    }
  }

  clear(): void {
    this.container?.destroy(true);
    this.container = null;
  }
}
