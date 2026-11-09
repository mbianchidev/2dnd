import * as Phaser from "phaser";
import { PLAYER_CLASSES, type PlayerClass } from "../systems/classes";
import { SKIN_COLOR_OPTIONS } from "../systems/appearance";
import { NPC_TEMPLATES } from "../data/npcs";
import { MOUNTS } from "../data/mounts";
import { BOATS } from "../data/nautical";
import type { WeaponSpriteType } from "../data/items";
import { PixelSurface, shadePixelColor as shade } from "../systems/pixelArt";
import { createHumanoidArt } from "../systems/humanoidArt";
import { generateTrapTextures } from "./trapTextures";
import { generateMonsterTextures } from "./monsterTextures";
import { generateTerrainTextures } from "./terrainTextures";
import { createPixelTexture } from "./pixelTexture";
import { generateInteriorTextures } from "./interiorTextures";

/** Boot owns static procedural assets; live equipment art uses cleanup-safe hero leases. */
export function generateAllTextures(scene: Phaser.Scene): void {
  generateTerrainTextures(scene);
  generateInteriorTextures(scene);
  generatePlayerTextureWithColors(scene, "player", 0x567998, 0xd6a079, 0x47505b);
  for (const profile of PLAYER_CLASSES) {
    generatePlayerTextureWithColors(scene, `player_${profile.id}`, profile.bodyColor,
      SKIN_COLOR_OPTIONS[0].color, profile.legColor, profile.weaponSprite, profile.clothingStyle);
  }
  generateMountTextures(scene);
  generateBoatTextures(scene);
  generateMonsterTextures(scene);
  generateUITextures(scene);
  for (const template of NPC_TEMPLATES) {
    createPixelTexture(scene, `npc_${template.id}`, createHumanoidArt({
      bodyColor: template.bodyColor, skinColor: 0xd6a079, legColor: 0x625443,
      hairColor: 0x544337, hairStyle: template.ageGroup === "female" ? 3 : 1,
      clothingStyle: template.id.startsWith("guard") ? "heavy" : "leather",
    }));
  }
  generateTrapTextures(scene);
}

export function generatePlayerTextureWithColors(
  scene: Phaser.Scene, key: string, bodyColor: number, skinColor: number, legColor: number,
  weaponSprite: WeaponSpriteType = "sword", clothingStyle: PlayerClass["clothingStyle"] = "heavy",
  hasShield = false,
): void {
  generatePlayerTextureWithHair(scene, key, bodyColor, skinColor, legColor, 1, 0x57432f,
    weaponSprite, clothingStyle, hasShield);
}

export function generatePlayerTextureWithHair(
  scene: Phaser.Scene, key: string, bodyColor: number, skinColor: number, legColor: number,
  hairStyle: number, hairColor: number, weaponSprite: WeaponSpriteType = "sword",
  clothingStyle: PlayerClass["clothingStyle"] = "heavy", hasShield = false,
): void {
  createPixelTexture(scene, key, createHumanoidArt({
    bodyColor, skinColor, legColor, hairStyle, hairColor,
    clothingStyle, weapon: weaponSprite, shield: hasShield,
  }));
}

function generateMountTextures(scene: Phaser.Scene): void {
  const colors: Readonly<Record<string, number>> = {
    donkey: 0x9d9180, horse: 0xa77b52, warHorse: 0x665447, shadowSteed: 0x625975,
  };
  for (const mount of MOUNTS) {
    for (const back of [false, true]) {
      const art = new PixelSurface(32, 32);
      const color = colors[mount.id] ?? 0xa77b52;
      art.volume(14, 20, 11, 6, color);
      for (const x of [7, 12, 20, 24]) {
        art.line(x, 22, x - 1, 29, shade(color, -25), 2);
        art.rect(x - 2, 29, 4, 2, 0x363c3d);
      }
      if (!back) {
        art.volume(25, 13, 4, 8, color);
        art.volume(26, 8, 4, 3, color);
        art.rect(28, 10, 3, 3, shade(color, 27));
        art.pixel(26, 7, 0x252d31);
        art.line(23, 6, 22, mount.id === "donkey" ? 0 : 3, color, 2);
        art.line(27, 6, 28, mount.id === "donkey" ? 0 : 3, color, 2);
        art.line(21, 9, 20, 17, 0x453b33, 3);
        art.line(4, 17, 1, 25, 0x453b33, 2);
      } else {
        art.line(15, 14, 16, 28, 0x453b33, 2);
        art.volume(16, 10, 5, 5, shade(color, -15));
      }
      art.rect(10, 15, 10, 5, 0x695943);
      art.line(10, 15, 18, 15, 0xd3b67b);
      createPixelTexture(scene, `${back ? "mount_back" : "mount"}_${mount.id}`, art);
    }
  }
}

function generateBoatTextures(scene: Phaser.Scene): void {
  for (const boat of BOATS) {
    const art = new PixelSurface(32, 32);
    art.ellipse(16, 27, 14, 3, 0x80b9bc);
    art.polygon([{ x: 2, y: 19 }, { x: 28, y: 19 }, { x: 25, y: 27 }, { x: 8, y: 28 }], 0x3e3d34);
    art.polygon([{ x: 4, y: 19 }, { x: 27, y: 19 }, { x: 23, y: 25 }, { x: 8, y: 26 }], 0xaa7849);
    art.line(5, 21, 24, 21, 0xd5b67a);
    art.line(16, 2, 16, 22, 0x6a5138, 2);
    art.polygon([{ x: 18, y: 3 }, { x: 29, y: 16 }, { x: 18, y: 17 }], boat.id === "stormcutter" ? 0x8db9cc : 0xeee1b5);
    art.line(19, 5, 26, 15, 0xc9bb91);
    art.line(18, 17, 28, 17, 0x7d7052);
    art.pixel(12, 22, 0x665037);
    createPixelTexture(scene, `boat_${boat.id}`, art);
  }
}

function animalArt(id: string): PixelSurface {
  const art = new PixelSurface(16, 14);
  const color = id === "frog" ? 0x77974f : id === "lizard" ? 0xb7844c
    : id === "cat" || id === "mouse" ? 0x92908b : id === "dog" ? 0xa58257 : 0xd8d6bd;
  art.volume(7, 8, 5, 3, color);
  art.volume(12, 5, 3, 3, color);
  art.line(3, 9, 3, 12, shade(color, -32), 2);
  art.line(10, 9, 10, 12, shade(color, -32), 2);
  art.pixel(13, 4, 0x29323a);
  art.rect(14, 6, 2, 1, 0x746249);
  art.line(2, 7, 0, 4, shade(color, -28), 2);
  if (id === "chicken") {
    art.rect(11, 1, 3, 2, 0xbb5750);
    art.rect(14, 5, 2, 1, 0xd6a359);
    art.line(4, 8, 8, 6, 0xaaa88d);
  } else if (id === "sheep") {
    for (const x of [3, 6, 9]) art.volume(x, 6, 2, 3, color, 0x96998c);
  } else if (id === "cow") {
    art.rect(4, 5, 3, 3, 0x8e6e4e);
    art.rect(8, 8, 3, 2, 0x8e6e4e);
    art.line(11, 3, 10, 1, 0xd5cba5);
    art.line(14, 3, 15, 1, 0xd5cba5);
  } else if (id === "cat" || id === "dog") {
    art.line(10, 3, 10, 1, shade(color, -20), 2);
    art.line(14, 3, 15, 1, shade(color, -20), 2);
  } else if (id === "mouse") art.volume(11, 2, 2, 2, 0xb9a296);
  else if (id === "frog") {
    art.volume(4, 4, 2, 2, color);
    art.pixel(4, 3, 0x29323a);
    art.line(2, 9, 0, 12, shade(color, -25), 2);
  } else art.line(3, 8, 0, 11, shade(color, -25), 2);
  return art;
}

function generateUITextures(scene: Phaser.Scene): void {
  for (const [key, width, height, color] of [
    ["panel", 400, 200, 0x202c37], ["button", 160, 36, 0x334351], ["buttonHover", 160, 36, 0x4a5b67],
  ] as const) {
    const graphics = scene.add.graphics();
    graphics.fillStyle(color, 0.96).fillRect(0, 0, width, height);
    graphics.lineStyle(2, 0xc4ad7c).strokeRect(1, 1, width - 2, height - 2);
    graphics.lineStyle(1, 0x665e50).strokeRect(4, 4, width - 8, height - 8);
    graphics.generateTexture(key, width, height);
    graphics.destroy();
  }
  for (const [key, width, height, color] of [
    ["rain", 3, 14, 0x9cbed2], ["snow", 8, 8, 0xeaeadd], ["sand", 5, 5, 0xcbb385],
    ["storm", 4, 18, 0xa6becf], ["fog", 20, 20, 0xb5c8c4],
    ["butterfly", 7, 7, 0xbcafca], ["snake", 8, 4, 0x97794e],
    ["smoke", 10, 10, 0xacae9b], ["mosquito", 7, 4, 0x7b8e83],
  ] as const) {
    const art = new PixelSurface(width, height);
    if (key === "rain" || key === "storm") art.line(0, 0, width - 1, height - 1, color);
    else art.ellipse(width / 2, height / 2, Math.max(1, width / 2 - 1), Math.max(1, height / 2 - 1), color, key === "fog" ? 110 : 230);
    createPixelTexture(scene, `particle_${key}`, art);
  }
  for (const animal of ["chicken", "cat", "mouse", "frog", "dog", "cow", "sheep", "lizard"]) {
    createPixelTexture(scene, `sprite_${animal}`, animalArt(animal));
  }
}
