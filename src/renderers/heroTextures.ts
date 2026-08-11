import * as Phaser from "phaser";
import { TILE_SIZE } from "../config";
import type {
  HeroEquipmentVisualFamily,
  HeroEquipmentVisualLayer,
  HeroFacing,
  HeroPose,
  HeroVisualDescriptor,
} from "../systems/heroVisuals";
import { getHeroVisualTextureKey } from "../systems/heroVisuals";

export interface HeroTextureLease {
  readonly key: string;
  readonly reused: boolean;
  release(): void;
}

interface HeroTextureCacheEntry {
  references: number;
}

export class HeroTextureLeaseRegistry {
  private readonly entries = new Map<string, HeroTextureCacheEntry>();

  acquire(
    key: string,
    exists: () => boolean,
    generate: () => void,
    remove: () => void,
  ): HeroTextureLease {
    const existing = this.entries.get(key);
    const reused = existing !== undefined || exists();
    if (!reused) {
      generate();
    }
    const entry = existing ?? { references: 0 };
    entry.references += 1;
    this.entries.set(key, entry);
    let released = false;
    return {
      key,
      reused,
      release: () => {
        if (released) return;
        released = true;
        entry.references -= 1;
        if (entry.references > 0) return;
        this.entries.delete(key);
        if (exists()) remove();
      },
    };
  }

  get size(): number {
    return this.entries.size;
  }
}

const textureRegistries = new WeakMap<
Phaser.Textures.TextureManager,
HeroTextureLeaseRegistry
>();

function shade(color: number, amount: number): number {
  const red = Math.max(0, Math.min(255, ((color >> 16) & 0xff) + amount));
  const green = Math.max(0, Math.min(255, ((color >> 8) & 0xff) + amount));
  const blue = Math.max(0, Math.min(255, (color & 0xff) + amount));
  return (red << 16) | (green << 8) | blue;
}

function bodyWidth(descriptor: HeroVisualDescriptor): number {
  if (descriptor.bodyBuild === "light") return 14;
  if (descriptor.bodyBuild === "broad") return 18;
  return 16;
}

function drawClothing(
  graphics: Phaser.GameObjects.Graphics,
  descriptor: HeroVisualDescriptor,
  bodyX: number,
  width: number,
): void {
  const darker = shade(descriptor.bodyColor, -40);
  const lighter = shade(descriptor.bodyColor, 50);
  switch (descriptor.clothingStyle) {
    case "heavy":
      graphics.fillStyle(lighter, 1);
      graphics.fillRect(bodyX - 2, 10, 4, 5);
      graphics.fillRect(bodyX + width - 2, 10, 4, 5);
      graphics.fillStyle(darker, 1);
      graphics.fillRect(12, 14, 8, 2);
      graphics.fillRect(14, 10, 4, 2);
      break;
    case "robe":
      graphics.fillStyle(darker, 1);
      graphics.fillRect(bodyX - 2, 12, 3, 16);
      graphics.fillRect(bodyX + width - 1, 12, 3, 16);
      graphics.fillStyle(lighter, 1);
      graphics.fillRect(13, 10, 6, 1);
      graphics.fillRect(10, 25, 12, 2);
      break;
    case "leather":
      graphics.fillStyle(darker, 1);
      graphics.fillRect(10, 12, 2, 10);
      graphics.fillRect(20, 12, 2, 10);
      graphics.fillStyle(lighter, 1);
      graphics.fillRect(12, 22, 8, 2);
      break;
    case "vestment":
      graphics.fillStyle(lighter, 1);
      graphics.fillRect(13, 10, 2, 14);
      graphics.fillRect(17, 10, 2, 14);
      graphics.fillStyle(0xffd700, 1);
      graphics.fillRect(14, 12, 4, 4);
      break;
    case "bare":
      graphics.fillStyle(darker, 1);
      graphics.fillRect(10, 11, 12, 1);
      graphics.fillRect(11, 12, 2, 8);
      graphics.fillRect(19, 12, 2, 8);
      break;
    case "wrap":
      graphics.fillStyle(darker, 1);
      graphics.fillRect(10, 20, 12, 3);
      graphics.fillStyle(lighter, 1);
      graphics.fillRect(8, 14, 2, 6);
      graphics.fillRect(22, 14, 2, 6);
      break;
    case "performer":
      graphics.fillStyle(lighter, 1);
      graphics.fillRect(bodyX - 2, 10, 3, 14);
      graphics.fillStyle(darker, 1);
      graphics.fillRect(12, 22, 8, 2);
      graphics.fillStyle(0xffd700, 1);
      graphics.fillRect(13, 10, 6, 1);
      break;
  }
}

function drawBackLayer(
  graphics: Phaser.GameObjects.Graphics,
  layer: HeroEquipmentVisualLayer,
  facing: HeroFacing,
): void {
  graphics.fillStyle(layer.primaryColor, 1);
  if (layer.family === "cloak") {
    graphics.fillTriangle(8, 11, 24, 11, facing === "back" ? 26 : 29, 29);
    graphics.fillStyle(layer.accentColor, 1).fillRect(14, 10, 4, 3);
  } else if (layer.family === "pelt") {
    graphics.fillRect(7, 11, 18, 16);
    graphics.fillStyle(layer.accentColor, 1);
    graphics.fillRect(7, 13, 3, 3);
    graphics.fillRect(22, 18, 3, 3);
    graphics.fillRect(12, 24, 3, 3);
  }
}

function drawArmorLayer(
  graphics: Phaser.GameObjects.Graphics,
  layer: HeroEquipmentVisualLayer,
): void {
  graphics.fillStyle(layer.primaryColor, 0.96);
  if (layer.family === "plate") {
    graphics.fillRect(8, 10, 16, 15);
    graphics.fillStyle(layer.accentColor, 1);
    graphics.fillRect(6, 10, 4, 6);
    graphics.fillRect(22, 10, 4, 6);
    graphics.fillRect(14, 11, 4, 13);
  } else if (layer.family === "mail") {
    graphics.fillRect(8, 10, 16, 16);
    graphics.fillStyle(layer.accentColor, 1);
    for (let y = 12; y < 25; y += 4) {
      for (let x = 10 + (y % 8 === 0 ? 2 : 0); x < 23; x += 4) {
        graphics.fillRect(x, y, 2, 2);
      }
    }
  } else if (layer.family === "leather") {
    graphics.fillRect(9, 10, 14, 15);
    graphics.fillStyle(layer.accentColor, 1);
    graphics.fillRect(11, 11, 2, 12);
    graphics.fillRect(19, 11, 2, 12);
    graphics.fillRect(12, 21, 8, 2);
  } else {
    graphics.fillRect(8, 10, 16, 16);
    graphics.fillStyle(layer.accentColor, 1);
    graphics.fillRect(10, 12, 12, 2);
    graphics.fillRect(10, 20, 12, 2);
  }
}

function drawHair(
  graphics: Phaser.GameObjects.Graphics,
  descriptor: HeroVisualDescriptor,
  facing: HeroFacing,
): void {
  const { hairStyle, hairColor, skinColor } = descriptor.appearance;
  if (facing === "back" && hairStyle === 0) {
    graphics.fillStyle(shade(skinColor, -70), 1).fillRect(11, 2, 10, 6);
    return;
  }
  if (hairStyle === 0) return;
  graphics.fillStyle(hairColor, 1);
  if (hairStyle === 1) {
    graphics.fillRect(facing === "side" ? 12 : 11, 2, facing === "side" ? 8 : 10, 4);
  } else if (hairStyle === 2) {
    graphics.fillRect(facing === "side" ? 11 : 10, 1, facing === "side" ? 9 : 12, 5);
    graphics.fillRect(facing === "side" ? 10 : 9, 4, 4, 6);
    if (facing !== "side") graphics.fillRect(19, 4, 4, 6);
  } else {
    graphics.fillRect(facing === "side" ? 11 : 10, 1, facing === "side" ? 9 : 12, 5);
    graphics.fillRect(facing === "side" ? 10 : 8, 3, 5, 14);
    if (facing !== "side") graphics.fillRect(19, 3, 5, 14);
  }
}

function drawWeapon(
  graphics: Phaser.GameObjects.Graphics,
  layer: HeroEquipmentVisualLayer,
  side: "left" | "right",
): void {
  const x = side === "left" ? 3 : 27;
  const direction = side === "left" ? -1 : 1;
  graphics.fillStyle(layer.primaryColor, 1);
  switch (layer.family as HeroEquipmentVisualFamily) {
    case "staff":
      graphics.fillRect(x, 4, 2, 22);
      graphics.fillStyle(layer.accentColor, 1).fillCircle(x + 1, 4, 3);
      break;
    case "dagger":
      graphics.fillRect(x, 14, 2, 10);
      graphics.fillStyle(layer.accentColor, 1).fillRect(x - 1, 22, 4, 2);
      break;
    case "bow":
      graphics.fillRect(x, 5, 2, 20);
      graphics.fillStyle(layer.accentColor, 1)
        .fillRect(x + direction * 2, 7, 1, 16);
      break;
    case "mace":
      graphics.fillRect(x, 12, 2, 14);
      graphics.fillStyle(layer.accentColor, 1).fillRect(x - 2, 8, 6, 6);
      break;
    case "axe":
      graphics.fillRect(x, 6, 2, 18);
      graphics.fillStyle(layer.accentColor, 1)
        .fillRect(side === "left" ? x : x - 3, 6, 5, 8);
      break;
    case "fist":
      graphics.fillRect(side === "left" ? 1 : 25, 16, 6, 6);
      graphics.fillStyle(layer.accentColor, 1)
        .fillRect(side === "left" ? 1 : 25, 18, 6, 1);
      break;
    default:
      graphics.fillRect(x, 6, 3, 18);
      graphics.fillStyle(layer.accentColor, 1).fillRect(x - 2, 20, 7, 3);
      break;
  }
}

function drawShield(
  graphics: Phaser.GameObjects.Graphics,
  layer: HeroEquipmentVisualLayer,
): void {
  const width = layer.family === "towerShield" ? 8 : 6;
  const height = layer.family === "towerShield" ? 14 : 10;
  graphics.fillStyle(layer.primaryColor, 1).fillRect(1, 11, width, height);
  graphics.fillStyle(layer.accentColor, 1).fillRect(2, 12, width - 2, height - 2);
  graphics.fillStyle(0xffd54f, 1);
  if (
    layer.family === "runicShield"
    || layer.family === "crystalShield"
    || layer.family === "volcanicShield"
  ) {
    graphics.fillCircle(1 + width / 2, 11 + height / 2, 2);
  } else {
    graphics.fillRect(3, 14, 2, Math.max(4, height - 6));
    graphics.fillRect(2, 16, Math.max(4, width - 2), 2);
  }
}

function drawHeroTexture(
  scene: Phaser.Scene,
  key: string,
  descriptor: HeroVisualDescriptor,
  facing: HeroFacing,
  pose: HeroPose,
  highContrast: boolean,
): void {
  const graphics = scene.add.graphics();
  const width = bodyWidth(descriptor);
  const bodyX = Math.floor((TILE_SIZE - width) / 2);
  const layers = descriptor.equipmentLayers;
  const backLayer = layers.find((layer) => layer.slot === "back");
  if (backLayer) drawBackLayer(graphics, backLayer, facing);

  const shield = layers.find((layer) => layer.slot === "shield");
  if (facing === "side" && shield) drawShield(graphics, shield);

  if (highContrast) {
    graphics.fillStyle(0x000000, 1);
    graphics.fillRect(bodyX - 1, 9, width + 2, 18);
    graphics.fillCircle(16, 8, 7);
  }

  graphics.fillStyle(
    facing === "back" ? shade(descriptor.bodyColor, -35) : descriptor.bodyColor,
    1,
  );
  graphics.fillRect(bodyX, 10, width, 16);
  drawClothing(graphics, descriptor, bodyX, width);
  const armorLayer = layers.find((layer) => layer.slot === "body");
  if (armorLayer) drawArmorLayer(graphics, armorLayer);

  graphics.fillStyle(descriptor.appearance.skinColor, 1);
  if (facing === "side") {
    graphics.fillRect(13, 2, 6, 12);
    graphics.fillCircle(16, 8, 5);
    graphics.fillRect(21, 7, 2, 3);
    graphics.fillStyle(0x222222, 1).fillRect(19, 6, 2, 2);
  } else {
    graphics.fillCircle(16, 8, 6);
    if (facing === "front") {
      graphics.fillStyle(0x222222, 1);
      graphics.fillRect(13, 7, 1, 1);
      graphics.fillRect(18, 7, 1, 1);
    }
  }
  drawHair(graphics, descriptor, facing);

  graphics.fillStyle(descriptor.legColor, 1);
  if (pose === "mounted") {
    graphics.fillRect(12, 24, 6, 5);
  } else if (facing === "side") {
    graphics.fillRect(11, 26, 5, 6);
    graphics.fillRect(16, 26, 5, 6);
  } else {
    graphics.fillRect(9, 26, 5, 6);
    graphics.fillRect(18, 26, 5, 6);
  }

  const mainHand = layers.find((layer) => layer.slot === "mainHand");
  const offHand = layers.find((layer) => layer.slot === "offHand");
  if (mainHand && facing !== "back") drawWeapon(graphics, mainHand, "right");
  if (offHand && facing !== "back") drawWeapon(graphics, offHand, "left");
  if (shield && facing !== "back" && facing !== "side") drawShield(graphics, shield);

  graphics.generateTexture(key, TILE_SIZE, TILE_SIZE);
  graphics.destroy();
}

export function acquireHeroTexture(
  scene: Phaser.Scene,
  descriptor: HeroVisualDescriptor,
  facing: HeroFacing = "front",
  pose: HeroPose = "standard",
  highContrast = false,
): HeroTextureLease {
  const key = getHeroVisualTextureKey(descriptor, facing, pose, highContrast);
  let registry = textureRegistries.get(scene.textures);
  if (!registry) {
    registry = new HeroTextureLeaseRegistry();
    textureRegistries.set(scene.textures, registry);
  }
  return registry.acquire(
    key,
    () => scene.textures.exists(key),
    () => drawHeroTexture(scene, key, descriptor, facing, pose, highContrast),
    () => scene.textures.remove(key),
  );
}
