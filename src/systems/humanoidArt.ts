import type { HeroFacing, HeroPose, HeroVisualDescriptor } from "./heroVisuals";
import type { WeaponSpriteType } from "../data/items";
import type { PlayerClass } from "./classes";
import { PixelSurface, shadePixelColor as shade } from "./pixelArt";
import type { AppearanceAccessory, BodyBuild } from "./appearance";

export const CHARACTER_ART_WIDTH = 32;
export const CHARACTER_ART_HEIGHT = 40;
export type CharacterArtPose = HeroPose | "ready" | "strike" | "cast" | "hurt" | "fallen" | "blink";

export interface HumanoidArtOptions {
  readonly bodyColor: number;
  readonly skinColor: number;
  readonly legColor: number;
  readonly hairColor: number;
  readonly hairStyle: number;
  readonly clothingStyle: PlayerClass["clothingStyle"];
  readonly classId?: string;
  readonly weapon?: WeaponSpriteType;
  readonly shield?: boolean;
  readonly facing?: HeroFacing;
  readonly pose?: CharacterArtPose;
  readonly broad?: boolean;
  readonly bodyBuild?: BodyBuild;
  readonly eyeColor?: number;
  readonly facialHair?: number;
  readonly accentColor?: number;
  readonly accessory?: AppearanceAccessory;
  readonly headwear?: boolean;
}

function drawWeapon(art: PixelSurface, family: string, color: number, accent: number, pose: CharacterArtPose, left = false): void {
  const x = left ? 3 : 27;
  const raised = pose === "ready" || pose === "cast";
  if (pose === "strike") {
    art.line(19, 20, 31, 12, color, 2);
    art.line(22, 20, 26, 23, accent, 2);
    return;
  }
  const top = raised ? 5 : 13;
  if (family === "bow") {
    art.line(x, top, x + 2, top + 5, accent, 2);
    art.line(x + 2, top + 5, x + 2, top + 15, accent, 2);
    art.line(x + 2, top + 15, x, top + 21, accent, 2);
    art.line(x, top, x, top + 21, 0xd8caa3);
  } else if (family === "staff") {
    art.line(x, top + 3, x, 34, color, 2);
    art.volume(x, top + 1, 3, 3, accent, 0x30323c);
    art.pixel(x - 1, top, 0xe9e9b7);
  } else if (family === "fist") {
    art.volume(x - 2, top + 13, 3, 3, accent);
  } else if (family === "axe" || family === "mace") {
    art.line(x, top + 3, x, 34, color, 2);
    if (family === "mace") art.volume(x, top + 3, 3, 4, accent);
    else art.polygon([{ x: x - 4, y: top }, { x: x + 3, y: top + 2 },
      { x: x + 4, y: top + 9 }, { x: x - 3, y: top + 7 }], accent);
  } else {
    const length = family === "dagger" ? 9 : 18;
    art.line(x, top, x, top + length, 0x283039, 3);
    art.line(x + 1, top, x + 1, top + length - 3, color);
    art.line(x - 2, top + length - 2, x + 3, top + length - 2, accent, 2);
    art.rect(x, top + length, 2, 3, 0x65513c);
  }
}

function drawShield(art: PixelSurface, primary: number, accent: number): void {
  art.polygon([{ x: 1, y: 19 }, { x: 10, y: 17 }, { x: 10, y: 29 }, { x: 6, y: 33 }, { x: 1, y: 28 }], 0x29323a);
  art.polygon([{ x: 2, y: 20 }, { x: 8, y: 19 }, { x: 8, y: 28 }, { x: 5, y: 31 }, { x: 2, y: 27 }], primary);
  art.line(5, 20, 5, 29, accent);
  art.line(3, 24, 7, 24, accent);
  art.pixel(3, 21, 0xdad9bf);
}

export function createHumanoidArt(options: HumanoidArtOptions): PixelSurface {
  const art = new PixelSurface(CHARACTER_ART_WIDTH, CHARACTER_ART_HEIGHT);
  const facing = options.facing ?? "front";
  const pose = options.pose ?? "standard";
  const outline = 0x283039;
  const body = options.bodyColor;
  const skin = options.skinColor;
  const accent = options.accentColor ?? 0xe5c781;
  const side = facing === "side";
  const broad = options.bodyBuild === "broad" || options.broad;
  const light = options.bodyBuild === "light";
  const left = broad ? 7 : side ? 11 : light ? 10 : 9;
  const right = broad ? 24 : side ? 21 : light ? 21 : 22;
  const stride = pose === "strideLeft" ? -2 : pose === "strideRight" ? 2 : 0;
  const cloak = options.clothingStyle === "robe" || options.clothingStyle === "vestment" || options.clothingStyle === "performer";
  if (cloak) {
    art.polygon([{ x: left - 1, y: 16 }, { x: right + 1, y: 16 },
      { x: right + 3 + stride, y: 34 }, { x: left - 2 - stride, y: 34 }], outline);
    art.polygon([{ x: left, y: 17 }, { x: right, y: 17 },
      { x: right + 1 + stride, y: 33 }, { x: left - stride, y: 33 }], shade(body, -32));
    art.line(left + 2, 20, left + 1 - stride, 31, shade(body, 15));
  }
  art.rect(10, 28 + stride, 5, pose === "mounted" ? 5 : 10, outline);
  art.rect(18, 28 - stride, 5, pose === "mounted" ? 5 : 10, outline);
  art.rect(11, 28 + stride, 3, 7, options.legColor);
  art.rect(19, 28 - stride, 3, 7, shade(options.legColor, -15));
  art.rect(9, 35 + stride, 6, 3, 0x473d34);
  art.rect(18, 35 - stride, 6, 3, 0x473d34);
  art.line(10, 35 + stride, 13, 35 + stride, 0xa8956b);
  art.line(19, 35 - stride, 22, 35 - stride, 0xa8956b);
  art.polygon([{ x: left, y: 16 }, { x: right, y: 16 }, { x: right + 1, y: 22 },
    { x: right - 2, y: 29 }, { x: left + 2, y: 29 }, { x: left - 1, y: 22 }], outline);
  art.polygon([{ x: left + 1, y: 17 }, { x: right - 1, y: 17 }, { x: right, y: 22 },
    { x: right - 3, y: 28 }, { x: left + 3, y: 28 }, { x: left, y: 22 }], body);
  art.line(left + 2, 18, left + 3, 25, shade(body, 38), 2);
  const armTop = pose === "cast" ? 14 : pose === "ready" ? 16 : 18;
  const handY = pose === "cast" ? 14 : armTop + 9;
  art.rect(left - 3, armTop + stride, 4, 9, outline);
  art.rect(right, armTop - stride, 4, 9, outline);
  art.rect(left - 2, armTop + 1 + stride, 3, 6, shade(body, -12));
  art.rect(right, armTop + 1 - stride, 3, 6, shade(body, 15));
  art.volume(left - 1, handY + stride, 2, 2, skin, outline);
  art.volume(right + 1, handY - stride, 2, 2, skin, outline);
  art.rect(left + 1, 26, right - left - 1, 2, 0x69513d);
  art.rect(15, 26, 3, 2, accent);
  if (options.clothingStyle === "heavy") {
    art.volume(left, 18, 4, 3, shade(body, 40), outline);
    art.volume(right, 18, 4, 3, shade(body, 20), outline);
    art.rect(13, 18, 7, 6, shade(body, 26));
    art.line(14, 18, 18, 18, 0xd3dbd4);
    art.rect(15, 20, 2, 4, 0xdac183);
  } else if (options.clothingStyle === "vestment") {
    art.line(13, 18, 13, 29, 0xdfd4aa, 2);
    art.line(19, 18, 19, 29, 0xdfd4aa, 2);
    art.rect(15, 20, 3, 3, 0xe5c477);
  } else if (options.clothingStyle === "bare") {
    art.rect(12, 18, 9, 8, skin);
    art.line(13, 22, 19, 22, shade(skin, -32));
    art.line(11, 18, 21, 27, 0x7a6146, 2);
  } else if (options.clothingStyle === "leather") {
    art.line(12, 18, 20, 25, 0xcbad75, 2);
    art.rect(19, 25, 3, 4, 0x493d33);
  } else if (options.clothingStyle === "wrap") {
    art.line(11, 19, 21, 26, shade(body, 54), 2);
    art.line(11, 23, 21, 19, shade(body, 35));
  }
  art.volume(side ? 17 : 16, 10, side ? 5 : 6, 7, skin, outline);
  art.rect(side ? 20 : 10, 10, 2, 3, shade(skin, -10));
  if (side) art.rect(22, 10, 2, 3, skin);
  if (facing !== "back") {
    if (pose === "blink") {
      art.line(side ? 19 : 12, 10, side ? 21 : 14, 10, outline);
      if (!side) art.line(18, 10, 20, 10, outline);
    } else {
      art.rect(side ? 19 : 12, 9, 2, 3, 0xf0e4c8);
      art.pixel(side ? 20 : 13, 10, options.eyeColor ?? outline);
      if (!side) {
        art.rect(18, 9, 2, 3, 0xf0e4c8);
        art.pixel(18, 10, options.eyeColor ?? outline);
      }
    }
    art.pixel(side ? 22 : 16, 12, shade(skin, -40));
    art.line(side ? 19 : 14, 14, side ? 21 : 17, 14, 0x80594e);
  }
  if ((options.hairStyle > 0 && options.hairStyle < 4) || facing === "back") {
    const hair = options.hairStyle === 0 ? shade(skin, -24) : options.hairColor;
    art.polygon([{ x: side ? 12 : 9, y: 7 }, { x: 12, y: 3 }, { x: 20, y: 3 },
      { x: 23, y: 7 }, { x: 21, y: facing === "back" ? 14 : 8 },
      { x: 17, y: 6 }, { x: 13, y: 9 }], hair);
    art.line(12, 4, 18, 4, shade(hair, 33));
    if (options.hairStyle > 1) art.rect(9, 7, 3, options.hairStyle === 3 ? 13 : 6, shade(hair, -16));
    if (options.hairStyle === 3 && !side) art.rect(21, 7, 3, 13, hair);
  }
  const hair = options.hairColor;
  if (options.hairStyle === 4) {
    for (const [x, y] of [[10, 7], [13, 4], [18, 4], [22, 7]]) art.volume(x!, y!, 3, 3, hair, shade(hair, -25));
  } else if (options.hairStyle === 5) {
    art.rect(10, 4, 13, 4, hair);
    for (const x of [9, 22]) for (let y = 8; y < 22; y += 3) {
      art.rect(x, y, 3, 3, shade(hair, y % 2 ? 18 : -16));
      art.pixel(x + 1, y + 2, accent);
    }
  } else if (options.hairStyle === 6) {
    art.rect(10, 4, 13, 4, hair);
    art.rect(side ? 10 : 22, 8, 4, 12, shade(hair, -12));
    art.rect(side ? 9 : 22, 8, 5, 2, accent);
  } else if (options.hairStyle === 7) {
    art.rect(14, 1, 5, 7, hair);
    art.rect(15, 0, 3, 2, shade(hair, 29));
    art.rect(14, 7, 4, 2, shade(hair, -20));
  } else if (options.hairStyle === 8) {
    art.rect(11, 4, 11, 3, hair);
    art.line(12, 4, 20, 4, shade(hair, 26));
  }
  if (facing !== "back" && options.facialHair) {
    const x = side ? 18 : 12;
    if (options.facialHair === 2) {
      art.polygon([{ x, y: 13 }, { x: x + 8, y: 13 }, { x: x + 6, y: 19 }, { x: x + 2, y: 18 }], hair);
      art.line(x + 1, 15, x + 6, 15, shade(hair, 25));
    } else if (options.facialHair === 3) {
      art.rect(x, 13, 8, 2, hair);
      art.pixel(x - 1, 14, hair);
    } else {
      for (let index = 0; index < 5; index++) art.pixel(x + index * 2, 15 + index % 2, shade(hair, 20));
    }
  }
  if (facing !== "back" && options.accessory === "spectacles") {
    for (const x of side ? [18] : [11, 18]) {
      art.rect(x, 8, 5, 5, accent);
      art.rect(x + 1, 9, 3, 3, 0x9caeaa);
      art.pixel(x + 2, 10, options.eyeColor ?? outline);
    }
    if (!side) art.rect(15, 9, 3, 1, accent);
  } else if (facing !== "back" && options.accessory === "earring") {
    art.rect(side ? 12 : 22, 12, 2, 3, accent);
  }
  if (options.headwear !== false && options.classId === "wizard") {
    art.polygon([{ x: 8, y: 7 }, { x: 16, y: 0 }, { x: 22, y: 7 }], shade(body, -20));
    art.rect(7, 7, 18, 2, body);
    art.rect(12, 5, 7, 1, 0xdac183);
  } else if (options.headwear !== false && (options.classId === "warlock" || options.classId === "rogue")) {
    art.line(9, 6, 12, 2, shade(body, -16), 2);
    art.line(12, 2, 20, 2, body, 2);
    art.line(21, 3, 23, 8, shade(body, -26), 2);
  } else if (options.headwear !== false && (options.classId === "ranger" || options.classId === "bard")) {
    art.rect(9, 4, 13, 3, shade(body, -20));
    art.line(21, 4, 25, 0, 0xdcc79d, 2);
  } else if (options.headwear !== false && options.classId === "monk") {
    art.rect(10, 6, 13, 2, 0xe5c581);
    art.line(21, 7, 26, 12, body, 2);
  }
  if (options.weapon && facing !== "back") drawWeapon(art, options.weapon, 0xc8d2cc, 0xd6b77b, pose);
  if (options.shield && facing !== "back") drawShield(art, 0x7c8d91, 0xe4c98d);
  if (pose === "hurt") art.rect(10, 22, 13, 1, 0xeac0ac);
  return pose === "fallen" ? collapseCharacterArt(art) : art;
}

function collapseCharacterArt(art: PixelSurface): PixelSurface {
  const fallen = new PixelSurface(32, 40);
  for (let y = 0; y < 40; y++) {
    for (let x = 0; x < 32; x++) {
      const index = (y * 32 + x) * 4;
      if (art.pixels[index + 3]) fallen.pixel(Math.round(1 + y * 0.75), 26 + Math.round(x * 0.35),
        (art.pixels[index]! << 16) | (art.pixels[index + 1]! << 8) | art.pixels[index + 2]!);
    }
  }
  return fallen;
}

export function createHeroArt(descriptor: HeroVisualDescriptor, facing: HeroFacing, pose: CharacterArtPose): PixelSurface {
  if (pose === "fallen") return collapseCharacterArt(createHeroArt(descriptor, facing, "hurt"));
  const body = createHumanoidArt({
    bodyColor: descriptor.bodyColor, legColor: descriptor.legColor,
    skinColor: descriptor.appearance.skinColor, hairColor: descriptor.appearance.hairColor,
    hairStyle: descriptor.appearance.hairStyle, clothingStyle: descriptor.clothingStyle,
    classId: descriptor.classId, facing, pose, bodyBuild: descriptor.bodyBuild,
    eyeColor: descriptor.appearance.eyeColor, facialHair: descriptor.appearance.facialHair,
    accentColor: descriptor.appearance.accentColor, accessory: descriptor.appearance.accessory,
    headwear: descriptor.appearance.headwear,
  });
  const art = new PixelSurface(32, 40);
  const back = descriptor.equipmentLayers.find((layer) => layer.slot === "back");
  if (back) {
    art.polygon([{ x: 7, y: 16 }, { x: 24, y: 16 }, { x: 28, y: 34 }, { x: 4, y: 34 }], back.primaryColor);
    art.line(8, 18, 6, 31, back.accentColor, 2);
    art.line(23, 18, 26, 31, back.accentColor, 2);
  }
  for (let y = 0; y < 40; y++) {
    for (let x = 0; x < 32; x++) {
      const index = (y * 32 + x) * 4;
      if (body.pixels[index + 3]) art.pixel(x, y,
        (body.pixels[index]! << 16) | (body.pixels[index + 1]! << 8) | body.pixels[index + 2]!);
    }
  }
  for (const layer of descriptor.equipmentLayers) {
    if (layer.slot === "body") {
      art.rect(12, 18, 9, 7, layer.primaryColor);
      art.line(12, 18, 19, 18, layer.accentColor);
      if (layer.family === "mail") {
        for (let y = 20; y < 25; y += 2) for (let x = 13; x < 21; x += 3) art.pixel(x, y, layer.accentColor);
      } else art.line(16, 19, 16, 24, layer.accentColor);
    } else if (layer.slot === "back" && facing === "back") {
      art.polygon([{ x: 10, y: 17 }, { x: 22, y: 17 }, { x: 24, y: 33 }, { x: 8, y: 33 }], layer.primaryColor);
      art.line(13, 18, 11, 31, layer.accentColor);
    } else if (layer.slot === "mainHand" && facing !== "back") {
      drawWeapon(art, layer.family, layer.primaryColor, layer.accentColor, pose);
    } else if (layer.slot === "offHand" && facing !== "back") {
      drawWeapon(art, layer.family, layer.primaryColor, layer.accentColor, pose, true);
    } else if (layer.slot === "shield" && facing !== "back") drawShield(art, layer.primaryColor, layer.accentColor);
  }
  return art;
}
