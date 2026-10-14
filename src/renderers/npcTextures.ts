import type * as Phaser from "phaser";
import { TILE_SIZE } from "../config";
import type { NpcTemplate } from "../data/npcs";

/** Shared cached multicolor NPC art; never tint skin, hair and clothes as one shape. */
export function getOrCreateNpcTexture(
  scene: Phaser.Scene,
  template: NpcTemplate,
  skinColor: number,
  hairColor: number,
  dressColor: number,
): string {
  const key = `npc_${template.id}_${skinColor.toString(16)}_${hairColor.toString(16)}_${dressColor.toString(16)}`;
  if (scene.textures.exists(key)) return key;
  const size = TILE_SIZE;
  const graphics = scene.add.graphics();
  const child = template.ageGroup === "child";
  const bodyWidth = child ? 10 : 14;
  const bodyHeight = child ? 10 : 14;
  const headRadius = child ? 5 : 6;
  const legWidth = child ? 3 : 4;
  const legHeight = child ? 4 : 5;
  const x = Math.floor((size - bodyWidth) / 2);
  const y = child ? 14 : 10;
  graphics.fillStyle(dressColor, 1).fillRect(x, y, bodyWidth, bodyHeight);
  graphics.fillStyle(skinColor, 1).fillCircle(size / 2, y - headRadius + 2, headRadius);
  graphics.fillStyle(hairColor, 1);
  if (child) {
    graphics.fillRect(size / 2 - headRadius + 1, y - headRadius * 2 + 3, headRadius * 2 - 2, 3);
  } else if (template.ageGroup === "female") {
    graphics.fillRect(size / 2 - headRadius, y - headRadius * 2 + 2, headRadius * 2, 4);
    graphics.fillRect(size / 2 - headRadius, y - headRadius + 4, 2, headRadius);
    graphics.fillRect(size / 2 + headRadius - 2, y - headRadius + 4, 2, headRadius);
  } else {
    graphics.fillRect(size / 2 - headRadius + 1, y - headRadius * 2 + 2, headRadius * 2 - 2, 4);
  }
  graphics.fillStyle(0x111111, 1);
  graphics.fillRect(size / 2 - 2, y - headRadius + 3, 1, 1);
  graphics.fillRect(size / 2 + 2, y - headRadius + 3, 1, 1);
  graphics.fillStyle(0x6d4c41, 1);
  graphics.fillRect(x + 1, y + bodyHeight, legWidth, legHeight);
  graphics.fillRect(x + bodyWidth - legWidth - 1, y + bodyHeight, legWidth, legHeight);
  graphics.generateTexture(key, size, size);
  graphics.destroy();
  return key;
}
