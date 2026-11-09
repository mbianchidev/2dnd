import type { Monster } from "../data/monsters";
import { getMonsterPalette, type MonsterPalette } from "../data/monsterFamilies";
import { artNoise, PixelSurface, shadePixelColor as shade } from "./pixelArt";

export type MonsterArtPose = "idle" | "blink" | "ready" | "strike" | "cast" | "hurt" | "fallen";

interface CreaturePainter {
  readonly art: PixelSurface;
  readonly palette: MonsterPalette;
  readonly x: number;
  readonly y: number;
  readonly attacking: boolean;
}

function eyes(painter: CreaturePainter, x: number, y: number, blink: boolean, wide = 5): void {
  const { art, palette } = painter;
  for (const offset of [-wide, wide]) {
    art.rect(x + offset - 2, y, 4, blink ? 1 : 3, palette.outline);
    if (!blink) {
      art.rect(x + offset - 1, y, 3, 2, 0xf2e8b1);
      art.pixel(x + offset, y + 1, palette.detail);
    }
    art.line(x + offset - 2, y - 1, x + offset + 1, y - 2, palette.outline);
  }
}

function claw(art: PixelSurface, x: number, y: number, color: number): void {
  art.volume(x, y - 2, 4, 3, color);
  for (let i = -1; i <= 1; i++) art.rect(x + i * 3, y, 2, 2, 0xe4d8ba);
}

function horn(art: PixelSurface, x: number, y: number, direction: number): void {
  art.line(x, y, x + direction * 3, y - 5, 0x493f36, 3);
  art.line(x + 1, y, x + direction * 3 + 1, y - 5, 0xd9c695, 2);
}

function humanoid(painter: CreaturePainter, skeletal: boolean, massive: boolean, blink: boolean): void {
  const { art, palette: p, x, y, attacking } = painter;
  const spread = massive ? 10 : 6;
  const body = skeletal ? 0xaaa28b : p.primary;
  const armY = attacking ? y - 21 : y - 12;
  for (const direction of [-1, 1]) {
    art.volume(x + direction * spread, y - 4, massive ? 5 : 3, 5, p.secondary, p.outline);
    claw(art, x + direction * spread, y, p.secondary);
    art.volume(x + direction * (spread + 5), armY, massive ? 5 : 3, massive ? 8 : 6, body, p.outline);
    art.volume(x + direction * (spread + 6), armY + 6, 3, 3, p.secondary, p.outline);
  }
  art.volume(x, y - 15, massive ? 12 : 8, massive ? 12 : 10, body, p.outline);
  art.rect(x - spread, y - 8, spread * 2, 3, p.secondary);
  art.rect(x - 1, y - 8, 3, 3, p.detail);
  art.volume(x, y - 29, massive ? 8 : 7, 7, body, p.outline);
  if (!skeletal) {
    horn(art, x - 6, y - 32, -1);
    horn(art, x + 6, y - 32, 1);
    art.volume(x, y - 24, 5, 3, shade(body, 12), p.outline);
    art.line(x - 3, y - 24, x + 3, y - 24, p.outline);
    art.rect(x - 4, y - 25, 2, 3, 0xe6d7ae);
    art.rect(x + 3, y - 25, 2, 3, 0xe6d7ae);
    art.line(x - 5, y - 20, x + 5, y - 11, 0x67513d, 3);
    art.line(x - spread - 9, armY - 8, x - spread - 9, armY + 9, 0xa38859, 2);
    art.volume(x - spread - 8, armY - 7, 4, 4, p.secondary, p.outline);
  } else {
    art.rect(x - 5, y - 28, 4, 3, p.outline);
    art.rect(x + 2, y - 28, 4, 3, p.outline);
    art.rect(x - 3, y - 22, 7, 3, 0xd8d1b1);
    for (let i = -2; i <= 2; i++) art.pixel(x + i * 2, y - 22, p.outline);
    for (let row = 0; row < 4; row++) {
      art.line(x - 6, y - 19 + row * 3, x + 6, y - 19 + row * 3, 0xd7cfac);
      art.pixel(x - 2, y - 18 + row * 3, p.outline);
      art.pixel(x + 2, y - 18 + row * 3, p.outline);
    }
    art.line(x + 13, y - 28, x + 13, y - 6, 0xd4d7c6, 2);
    art.line(x + 9, y - 9, x + 16, y - 9, p.detail);
  }
  if (!skeletal) eyes(painter, x, y - 30, blink, 4);
}

function wolf(painter: CreaturePainter, blink: boolean): void {
  const { art, palette: p, x, y, attacking } = painter;
  art.line(x + 12, y - 11, x + 20, y - 20, p.outline, 4);
  art.line(x + 12, y - 12, x + 20, y - 20, p.secondary, 2);
  for (const offset of [-9, 9]) {
    art.line(x + offset, y - 11, x + offset - (attacking ? 4 : 1), y - 1, p.outline, 4);
    art.line(x + offset, y - 11, x + offset - (attacking ? 4 : 1), y - 1, p.secondary, 2);
    claw(art, x + offset - (attacking ? 4 : 1), y, p.primary);
  }
  art.volume(x + 2, y - 14, 13, 7, p.primary, p.outline);
  art.volume(x - 8, y - 20, 7, 9, p.secondary, p.outline);
  art.volume(x - 13, y - 24, 6, 6, p.primary, p.outline);
  art.volume(x - 17, y - 21, 5, 3, shade(p.primary, 18), p.outline);
  horn(art, x - 16, y - 27, -1);
  horn(art, x - 10, y - 27, 1);
  art.pixel(x - 15, y - 24, blink ? p.outline : 0xf2dc8c);
  art.rect(x - 21, y - 22, 2, 2, p.outline);
  art.line(x - 19, y - 18, x - 13, y - 18, p.outline);
  art.rect(x - 18, y - 18, 2, 2, 0xe7dcc0);
  for (let i = 0; i < 10; i++) art.line(x - 4 + i * 2, y - 18, x - 6 + i * 2, y - 15, shade(p.primary, -23));
}

function wings(painter: CreaturePainter, feathered: boolean): void {
  const { art, palette: p, x, y, attacking } = painter;
  for (const direction of [-1, 1]) {
    const tipY = y - (attacking ? 36 : 30);
    const points = [{ x: x + direction * 5, y: y - 21 },
      { x: x + direction * 21, y: tipY }, { x: x + direction * 18, y: y - 12 },
      { x: x + direction * 12, y: y - 17 }];
    art.polygon(points, p.outline);
    art.polygon(points.map((point) => ({ x: point.x - direction, y: point.y + 1 })), p.secondary);
    for (let i = 0; i < 4; i++) {
      art.line(x + direction * 5, y - 21, x + direction * (12 + i * 2), tipY + 6 + i * 3,
        feathered ? shade(p.secondary, 30) : shade(p.primary, -15));
    }
  }
}

function dragon(painter: CreaturePainter, blink: boolean): void {
  const { art, palette: p, x, y, attacking } = painter;
  wings(painter, false);
  art.volume(x, y - 13, 11, 12, p.primary, p.outline);
  art.volume(x - 2, y - 11, 6, 8, p.secondary, p.outline);
  for (let row = 0; row < 4; row++) art.line(x - 6, y - 16 + row * 3, x + 2, y - 15 + row * 3, shade(p.secondary, -20));
  art.line(x + 8, y - 7, x + 20, y - 5, p.outline, 5);
  art.line(x + 8, y - 8, x + 20, y - 6, p.primary, 3);
  art.volume(x - 2, y - 27, 8, 7, p.primary, p.outline);
  art.volume(x - 9, y - 24, 7, 4, shade(p.primary, 14), p.outline);
  horn(art, x - 6, y - 31, -1);
  horn(art, x + 4, y - 32, 1);
  eyes(painter, x - 3, y - 28, blink, 3);
  art.line(x - 14, y - 22, x - 5, y - 22, p.outline);
  for (let i = 0; i < 4; i++) art.rect(x - 13 + i * 3, y - 22, 2, attacking ? 3 : 1, 0xe9dec0);
  for (let i = 0; i < 6; i++) art.pixel(x + 7 + i, y - 20 + i * 2, p.detail);
  claw(art, x - 8, y, p.primary);
  claw(art, x + 8, y, p.primary);
}

function manymaws(painter: CreaturePainter, blink: boolean, tentacles: boolean): void {
  const { art, palette: p, x, y, attacking } = painter;
  if (tentacles) {
    for (let i = 0; i < 8; i++) {
      const direction = i % 2 ? 1 : -1;
      const endX = x + direction * (10 + i);
      art.line(x, y - 12, endX, y - 4 - (i % 3) * 4, p.outline, 5);
      art.line(endX, y - 4 - (i % 3) * 4, endX + direction * 5, y - 10 - i * 2, p.primary, 3);
      art.line(x, y - 12, endX, y - 4 - (i % 3) * 4, p.primary, 3);
      for (let dot = 0; dot < 4; dot++) art.pixel(x + direction * (4 + dot * 3), y - 11 + dot, p.secondary);
    }
    art.volume(x, y - 24, 11, 14, p.primary, p.outline);
    eyes(painter, x, y - 20, blink, 7);
    art.volume(x, y - 14, 3, 3, p.outline, p.secondary);
    return;
  }
  art.volume(x + 2, y - 10, 15, 7, p.primary, p.outline);
  for (let i = -1; i <= 1; i++) {
    const headX = x + i * 11;
    const headY = y - 28 + (i === 0 ? -3 : 2);
    art.line(headX + 4, y - 12, headX, headY, p.outline, 6);
    art.line(headX + 4, y - 12, headX, headY, p.primary, 4);
    art.volume(headX, headY, 6, 5, i === 0 ? p.secondary : p.primary, p.outline);
    horn(art, headX + 2, headY - 4, 1);
    art.rect(headX - 4, headY + 2, 7, attacking ? 4 : 2, p.outline);
    for (let tooth = 0; tooth < 3; tooth++) art.pixel(headX - 3 + tooth * 2, headY + 2, 0xe5d7b6);
    art.pixel(headX - 3, headY - 1, blink ? p.outline : 0xecc681);
  }
  claw(art, x - 9, y, p.primary);
  claw(art, x + 12, y, p.primary);
}

function spider(painter: CreaturePainter, blink: boolean): void {
  const { art, palette: p, x, y, attacking } = painter;
  for (const direction of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const jointX = x + direction * (13 + i * 2);
      const jointY = y - 18 + i * 5 - (attacking ? 3 : 0);
      art.line(x + direction * 5, y - 14, jointX, jointY, p.outline, 3);
      art.line(jointX, jointY, jointX + direction * 2, jointY + 7, p.secondary, 2);
    }
  }
  art.volume(x + 3, y - 18, 9, 8, p.primary, p.outline);
  art.volume(x - 4, y - 11, 6, 5, p.secondary, p.outline);
  for (let i = 0; i < 5; i++) {
    art.pixel(x - 8 + i * 2, y - 13 + i % 2, blink ? p.outline : p.detail);
  }
  art.line(x - 6, y - 9, x - 9, y - 4, 0xe7dac2, 2);
  art.line(x - 2, y - 9, x, y - 4, 0xe7dac2, 2);
  art.line(x + 1, y - 23, x + 6, y - 14, shade(p.primary, 25), 2);
}

export function createMonsterArt(monster: Monster, pose: MonsterArtPose = "idle"): PixelSurface {
  const boss = monster.isBoss;
  const art = new PixelSurface(boss ? 64 : 48, boss ? 56 : 44);
  const palette = getMonsterPalette(monster);
  const x = art.width / 2;
  const y = art.height - 5 - (pose === "blink" ? 1 : 0);
  const painter = { art, palette, x, y, attacking: pose === "strike" || pose === "ready" };
  const blink = pose === "blink" || pose === "hurt" || pose === "fallen";
  const p = palette;
  switch (monster.family) {
    case "raider": humanoid(painter, false, false, blink); break;
    case "skeletal": humanoid(painter, true, false, blink); break;
    case "colossus": humanoid(painter, false, true, blink); break;
    case "lupine": wolf(painter, blink); break;
    case "drake": dragon(painter, blink); break;
    case "chimaera": manymaws(painter, blink, monster.id === "kraken"); break;
    case "stalker": spider(painter, blink); break;
    case "slime":
      art.volume(x, y - 8, 17, painter.attacking ? 15 : 11, p.primary, p.outline);
      art.volume(x - 10, y - 1, 7, 3, p.primary, p.outline);
      art.volume(x + 10, y - 1, 7, 3, p.primary, p.outline);
      eyes(painter, x, y - 11, blink);
      art.line(x - 4, y - 4, x + 4, y - 4, p.outline);
      art.rect(x - 9, y - 16, 4, 2, 0xdce1b4);
      break;
    case "construct":
      for (const direction of [-1, 1]) {
        art.volume(x + direction * 14, y - 19, 5, 8, p.secondary, p.outline);
        art.volume(x + direction * 14, y - 10, 5, 4, p.primary, p.outline);
        claw(art, x + direction * 7, y, p.secondary);
      }
      art.volume(x, y - 18, 11, 13, p.primary, p.outline);
      art.volume(x, y - 33, 7, 5, p.secondary, p.outline);
      eyes(painter, x, y - 33, blink, 3);
      art.volume(x, y - 18, 4, 5, p.detail, p.outline);
      for (const offset of [-7, 7]) art.line(x + offset, y - 27, x + offset, y - 9, shade(p.primary, 37));
      break;
    case "spectral":
    case "elemental":
      for (let i = 0; i < 7; i++) {
        const dx = (i - 3) * 4;
        art.volume(x + dx, y - 5 - Math.abs(dx) / 2, 4, 7 + i % 3, p.secondary, p.outline);
      }
      art.volume(x, y - 19, 12, 14, p.primary, p.outline);
      art.volume(x, y - 31, 7, 6, p.secondary, p.outline);
      eyes(painter, x, y - 29, blink, 4);
      for (let i = 0; i < 8; i++) {
        art.line(x - 8 + i * 2, y - 18, x - 7 + i * 2, y - 5 + i % 3, shade(p.primary, 22));
      }
      if (monster.family === "elemental") {
        for (let i = 0; i < 5; i++) art.line(x - 9 + i * 5, y - 29, x - 7 + i * 4, y - 39, p.detail, 2);
      }
      break;
    case "fey":
      wings(painter, true);
      art.volume(x, y - 20, 5, 9, p.primary, p.outline);
      art.volume(x, y - 31, 6, 5, p.secondary, p.outline);
      eyes(painter, x, y - 31, blink, 3);
      art.line(x - 3, y - 14, x - 7, y - 7, p.secondary, 2);
      art.line(x + 3, y - 14, x + 7, y - 7, p.secondary, 2);
      break;
    case "flora":
      for (let i = -2; i <= 2; i++) {
        art.line(x, y - 12, x + i * 8, y - Math.abs(i) * 3, p.outline, 4);
        art.line(x, y - 12, x + i * 8, y - Math.abs(i) * 3, p.primary, 2);
      }
      art.volume(x, y - 20, 10, 14, p.primary, p.outline);
      for (let i = 0; i < 7; i++) art.volume(x - 15 + i * 5, y - 30 - i % 3 * 3, 5, 5, p.secondary, p.outline);
      eyes(painter, x, y - 22, blink, 5);
      art.rect(x - 5, y - 14, 10, 3, p.outline);
      for (let i = 0; i < 5; i++) art.line(x - 7 + i * 3, y - 20, x - 5 + i * 3, y - 5, shade(p.primary, -25));
      break;
    case "mimic":
      art.rect(x - 16, y - 21, 33, 21, p.outline);
      art.rect(x - 15, y - 18, 30, 16, p.primary);
      art.rect(x - 16, y - 25, 33, 7, p.secondary);
      art.rect(x - 14, y - 18, 29, 9, p.outline);
      for (let i = 0; i < 10; i++) {
        art.rect(x - 13 + i * 3, y - 18, 2, i % 2 ? 4 : 3, 0xe8d6ae);
        art.pixel(x - 13 + i * 3, y - 10, 0xe8d6ae);
      }
      art.volume(x + 2, y - 8, 4, 7, 0xb75d6b);
      eyes(painter, x, y - 24, blink, 9);
      for (const offset of [-10, 10]) art.rect(x + offset, y - 26, 2, 24, p.detail);
      break;
  }
  if (boss) {
    for (let i = 0; i < 12; i++) {
      const xx = x - 13 + artNoise(i, 9) % 27;
      const yy = y - 19 + artNoise(9, i) % 14;
      art.rect(xx, yy, 2, 1, shade(p.primary, 35));
    }
    art.rect(x - 5, y - 36, 11, 2, p.detail);
    for (let i = -1; i <= 1; i++) art.rect(x + i * 4, y - 39, 2, 4, p.detail);
  }
  for (let yy = 0; yy < art.height; yy++) {
    for (let xx = 0; xx < art.width; xx++) {
      const index = (yy * art.width + xx) * 4;
      const color = (art.pixels[index]! << 16) | (art.pixels[index + 1]! << 8) | art.pixels[index + 2]!;
      if (art.pixels[index + 3] === 255 && color === p.primary && artNoise(xx, yy) % 29 === 0) {
        art.pixel(xx, yy, shade(color, artNoise(yy, xx) % 2 ? 9 : -9));
      }
    }
  }
  if (pose === "cast") {
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      art.rect(x + Math.round(Math.cos(angle) * 19), y - 22 + Math.round(Math.sin(angle) * 13), 2, 2, p.detail);
    }
  }
  if (pose === "fallen") {
    const fallen = new PixelSurface(art.width, art.height);
    for (let yy = 0; yy < art.height; yy++) {
      for (let xx = 0; xx < art.width; xx++) {
        const index = (yy * art.width + xx) * 4;
        if (art.pixels[index + 3]) fallen.pixel(xx, Math.round(y - 7 + (yy - y + 7) * 0.32),
          (art.pixels[index]! << 16) | (art.pixels[index + 1]! << 8) | art.pixels[index + 2]!);
      }
    }
    return fallen;
  }
  return art;
}
