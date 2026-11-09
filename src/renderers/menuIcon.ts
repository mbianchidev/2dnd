import type * as Phaser from "phaser";
import { createMenuIconArt, type MenuIconId } from "../systems/menuIcons";
import { createPixelTexture } from "./pixelTexture";

export function createMenuIcon(scene: Phaser.Scene, id: MenuIconId, x = 0, y = 0): Phaser.GameObjects.Image {
  const key = `menu-icon-${id}`;
  if (!scene.textures.exists(key)) createPixelTexture(scene, key, createMenuIconArt(id));
  return scene.add.image(x, y, key);
}
