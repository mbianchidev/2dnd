import type * as Phaser from "phaser";
import { getNpcColors, getNpcTemplate } from "../data/npcs";
import { getAccessibilityPreferences } from "../systems/accessibility";
import { getOrCreateNpcTexture } from "./npcTextures";

export function drawArcheryTarget(scene: Phaser.Scene, container: Phaser.GameObjects.Container): void {
  const graphics = scene.add.graphics();
  const contrast = getAccessibilityPreferences().highContrast;
  graphics.fillStyle(contrast ? 0xffffff : 0x795548);
  graphics.fillRect(8, 20, 3, 11).fillRect(21, 20, 3, 11).fillRect(8, 26, 16, 3);
  graphics.fillStyle(contrast ? 0xffffff : 0x5d4037).fillCircle(16, 12, 12);
  graphics.fillStyle(0xf5e6c8).fillCircle(16, 12, 10);
  graphics.fillStyle(contrast ? 0x000000 : 0xb53b37).fillCircle(16, 12, 7);
  graphics.fillStyle(0xf5e6c8).fillCircle(16, 12, 4);
  graphics.fillStyle(contrast ? 0x000000 : 0xc08a32).fillRect(15, 11, 2, 2);
  container.add(graphics);
}

export function drawDicePlayer(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  cityId: string,
): void {
  const template = getNpcTemplate("male_stout");
  if (!template) throw new Error("[minigames] Missing dice-player NPC template.");
  const colors = getNpcColors(cityId, 1000);
  const texture = getOrCreateNpcTexture(
    scene, template, colors.skinColor, colors.hairColor, colors.dressColor,
  );
  const player = scene.add.sprite(16, 21, texture).setOrigin(0.5, 1).setScale(0.65);
  player.setData("minigamePropPart", "dicePlayer");
  const table = scene.add.graphics();
  table.fillStyle(0x4e342e).fillRect(4, 20, 24, 6).fillRect(6, 26, 3, 6).fillRect(23, 26, 3, 6);
  table.fillStyle(0xa97845).fillRect(3, 18, 26, 6);
  table.fillStyle(colors.skinColor).fillRect(10, 16, 4, 4).fillRect(20, 16, 4, 4);
  table.fillStyle(0xfff0c0).fillRect(10, 21, 5, 5).fillRect(18, 20, 5, 5);
  table.fillStyle(0x1a1a2e).fillRect(11, 22, 1, 1).fillRect(13, 24, 1, 1)
    .fillRect(19, 21, 1, 1).fillRect(21, 21, 1, 1).fillRect(19, 23, 1, 1).fillRect(21, 23, 1, 1);
  container.add([player, table]);
}
