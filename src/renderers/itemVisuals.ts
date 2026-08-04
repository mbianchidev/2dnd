import * as Phaser from "phaser";
import type { Item } from "../data/items";
import {
  getItemRarity,
  type ItemRarity,
} from "../systems/inventory";

const RARITY_COLORS: Record<ItemRarity, number> = {
  common: 0xb8c0cc,
  uncommon: 0x72d47e,
  rare: 0x6aa8ff,
  epic: 0xc27aff,
  legendary: 0xffc857,
};

export function getItemRarityColor(item: Item): number {
  return RARITY_COLORS[getItemRarity(item)];
}

export function createItemVisual(
  scene: Phaser.Scene,
  item: Item,
  x: number,
  y: number,
  size = 22,
): Phaser.GameObjects.Graphics {
  const graphics = scene.add.graphics();
  const color = getItemRarityColor(item);
  const centerX = x + size / 2;
  const centerY = y + size / 2;
  graphics.fillStyle(0x111827, 0.95);
  graphics.fillRoundedRect(x, y, size, size, 3);
  graphics.lineStyle(1, color, 1);
  graphics.strokeRoundedRect(x, y, size, size, 3);

  graphics.fillStyle(color, 1);
  graphics.lineStyle(2, color, 1);
  if (item.type === "weapon") {
    graphics.lineBetween(x + 5, y + size - 5, x + size - 5, y + 5);
    graphics.lineBetween(x + 5, y + size - 8, x + 8, y + size - 5);
  } else if (item.type === "armor") {
    graphics.fillTriangle(
      centerX,
      y + 4,
      x + 5,
      y + 9,
      x + size - 5,
      y + 9,
    );
    graphics.fillRect(x + 6, y + 9, size - 12, size - 14);
  } else if (item.type === "shield") {
    graphics.fillTriangle(
      centerX,
      y + size - 4,
      x + 5,
      y + 6,
      x + size - 5,
      y + 6,
    );
  } else if (item.type === "consumable") {
    graphics.fillRect(centerX - 3, y + 4, 6, 4);
    graphics.fillRoundedRect(centerX - 6, y + 8, 12, 10, 3);
  } else if (item.type === "key") {
    graphics.strokeCircle(x + 7, centerY - 2, 4);
    graphics.lineBetween(x + 10, centerY + 1, x + size - 4, y + size - 5);
    graphics.lineBetween(x + size - 8, y + size - 7, x + size - 5, y + size - 10);
  } else if (item.type === "mount") {
    graphics.fillCircle(centerX - 2, centerY, 6);
    graphics.fillTriangle(
      centerX - 5,
      y + 6,
      centerX - 1,
      y + 2,
      centerX + 1,
      y + 7,
    );
    graphics.fillRect(centerX + 3, centerY - 2, 5, 3);
  } else {
    graphics.fillRect(centerX - 6, centerY - 2, 12, 4);
    graphics.fillRect(centerX - 2, centerY - 6, 4, 12);
  }
  return graphics;
}
