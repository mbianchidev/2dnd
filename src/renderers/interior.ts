import * as Phaser from "phaser";
import type { CityChunk } from "../data/mapTypes";
import { TILE_SIZE } from "../config";
import type { PlayerState } from "../systems/player";
import { createOverlayContainer } from "../utils/ui";
import { getInteriorPropTexture } from "./interiorTextures";

export class InteriorRenderer {
  private container: Phaser.GameObjects.Container | null = null;
  private lifecycleBound = false;

  constructor(private readonly scene: Phaser.Scene) {}

  render(player: PlayerState, room: CityChunk, interact: (id: string) => void): void {
    this.clear();
    if (!room.interior) return;
    if (!this.lifecycleBound) {
      this.lifecycleBound = true;
      this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.clear());
    }
    this.container = createOverlayContainer(this.scene, "interior-props", 9, {
      x: 0, y: 0, width: 640, height: 480,
    });
    const lights = this.scene.add.graphics();
    for (const prop of room.interior.props) {
      const x = (prop.x + (prop.width ?? 1) / 2) * TILE_SIZE;
      const y = (prop.y + (prop.height ?? 1) / 2) * TILE_SIZE;
      if (prop.kind === "hearth") {
        lights.fillStyle(0xe3ac68, 0.1).fillEllipse(x, y + 8, 150, 100);
        lights.fillStyle(0xf4cb88, 0.08).fillEllipse(x, y + 8, 100, 64);
      }
    }
    this.container.add(lights);
    for (const prop of room.interior.props) {
      const sprite = this.scene.add.sprite(
        (prop.x + (prop.width ?? 1) / 2) * TILE_SIZE, (prop.y + (prop.height ?? 1) / 2) * TILE_SIZE,
        getInteriorPropTexture(prop.kind, player.progression.collectedTreasures.includes(prop.id)),
      ).setDisplaySize((prop.width ?? 1) * TILE_SIZE, (prop.height ?? 1) * TILE_SIZE);
      sprite.setData("layoutId", prop.id);
      sprite.setData("label", prop.label);
      sprite.setData("layoutBounds", {
        x: prop.x * TILE_SIZE, y: prop.y * TILE_SIZE,
        width: (prop.width ?? 1) * TILE_SIZE, height: (prop.height ?? 1) * TILE_SIZE,
      });
      if (prop.reward || prop.kind === "counter") {
        sprite.setInteractive({ useHandCursor: prop.kind === "counter" }).on("pointerdown", () => interact(prop.id));
      }
      this.container.add(sprite);
    }
  }

  clear(): void {
    this.container?.destroy(true);
    this.container = null;
  }
}
