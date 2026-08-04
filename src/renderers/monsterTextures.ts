import * as Phaser from "phaser";
import { ALL_MONSTERS, type Monster } from "../data/monsters";
import {
  getMonsterPalette,
  getMonsterTextureKey,
  type MonsterPalette,
  type MonsterVisualForm,
} from "../data/monsterFamilies";

interface MonsterCanvas {
  width: number;
  height: number;
  centerX: number;
  groundY: number;
  scale: number;
}

export function generateMonsterTextures(scene: Phaser.Scene): void {
  for (const monster of ALL_MONSTERS) {
    generateMonsterTexture(scene, monster);
  }
}

function generateMonsterTexture(
  scene: Phaser.Scene,
  monster: Monster,
): void {
  const form: MonsterVisualForm = monster.isBoss ? "boss" : "normal";
  const width = form === "boss" ? 128 : 96;
  const height = form === "boss" ? 112 : 88;
  const canvas: MonsterCanvas = {
    width,
    height,
    centerX: width / 2,
    groundY: form === "boss" ? height - 3 : height - 8,
    scale: 1,
  };
  const palette = getMonsterPalette(monster);
  const gfx = scene.add.graphics();

  drawFamilySilhouette(gfx, monster, palette, canvas);
  if (monster.isBoss) {
    drawBossAdornment(gfx, monster, palette, canvas);
  }
  drawFace(gfx, monster, palette, canvas);

  gfx.generateTexture(getMonsterTextureKey(monster), width, height);
  gfx.destroy();
}

function drawFamilySilhouette(
  gfx: Phaser.GameObjects.Graphics,
  monster: Monster,
  palette: MonsterPalette,
  canvas: MonsterCanvas,
): void {
  switch (monster.family) {
    case "slime":
      drawSlime(gfx, palette, canvas);
      break;
    case "raider":
      drawRaider(gfx, palette, canvas);
      break;
    case "skeletal":
      drawSkeletal(gfx, palette, canvas);
      break;
    case "lupine":
      drawLupine(gfx, palette, canvas);
      break;
    case "spectral":
      drawSpectral(gfx, palette, canvas);
      break;
    case "colossus":
      drawColossus(gfx, palette, canvas);
      break;
    case "drake":
      drawDrake(gfx, palette, canvas);
      break;
    case "chimaera":
      drawChimaera(gfx, palette, canvas);
      break;
    case "construct":
      drawConstruct(gfx, palette, canvas);
      break;
    case "stalker":
      drawStalker(gfx, palette, canvas);
      break;
    case "fey":
      drawFey(gfx, palette, canvas);
      break;
    case "flora":
      drawFlora(gfx, palette, canvas);
      break;
    case "mimic":
      drawMimic(gfx, palette, canvas);
      break;
    case "elemental":
      drawElemental(gfx, palette, canvas);
      break;
  }
}

function drawSlime(
  gfx: Phaser.GameObjects.Graphics,
  palette: MonsterPalette,
  { centerX: cx, groundY: gy, scale: s }: MonsterCanvas,
): void {
  gfx.fillStyle(palette.outline, 1);
  gfx.fillEllipse(cx, gy - 24 * s, 64 * s, 48 * s);
  gfx.fillTriangle(cx - 34 * s, gy - 20 * s, cx - 18 * s, gy, cx - 4 * s, gy - 15 * s);
  gfx.fillTriangle(cx + 34 * s, gy - 20 * s, cx + 18 * s, gy, cx + 4 * s, gy - 15 * s);
  gfx.fillStyle(palette.primary, 1);
  gfx.fillEllipse(cx, gy - 25 * s, 56 * s, 41 * s);
  gfx.fillStyle(palette.secondary, 0.9);
  gfx.fillEllipse(cx - 13 * s, gy - 37 * s, 18 * s, 9 * s);
}

function drawRaider(
  gfx: Phaser.GameObjects.Graphics,
  palette: MonsterPalette,
  { centerX: cx, groundY: gy, scale: s }: MonsterCanvas,
): void {
  gfx.fillStyle(palette.outline, 1);
  gfx.fillRect(cx - 22 * s, gy - 48 * s, 44 * s, 42 * s);
  gfx.fillCircle(cx, gy - 57 * s, 20 * s);
  gfx.fillTriangle(cx - 13 * s, gy - 70 * s, cx - 31 * s, gy - 62 * s, cx - 13 * s, gy - 54 * s);
  gfx.fillTriangle(cx + 13 * s, gy - 70 * s, cx + 31 * s, gy - 62 * s, cx + 13 * s, gy - 54 * s);
  gfx.fillStyle(palette.primary, 1);
  gfx.fillRect(cx - 18 * s, gy - 45 * s, 36 * s, 37 * s);
  gfx.fillCircle(cx, gy - 57 * s, 16 * s);
  gfx.fillStyle(palette.secondary, 1);
  gfx.fillRect(cx - 25 * s, gy - 43 * s, 8 * s, 34 * s);
  gfx.fillRect(cx + 17 * s, gy - 43 * s, 8 * s, 34 * s);
  gfx.fillStyle(palette.detail, 1);
  gfx.fillRect(cx + 26 * s, gy - 49 * s, 4 * s, 42 * s);
  gfx.fillTriangle(cx + 20 * s, gy - 52 * s, cx + 36 * s, gy - 52 * s, cx + 28 * s, gy - 67 * s);
}

function drawSkeletal(
  gfx: Phaser.GameObjects.Graphics,
  palette: MonsterPalette,
  { centerX: cx, groundY: gy, scale: s }: MonsterCanvas,
): void {
  gfx.fillStyle(palette.outline, 1);
  gfx.fillCircle(cx, gy - 61 * s, 20 * s);
  gfx.fillRect(cx - 8 * s, gy - 48 * s, 16 * s, 40 * s);
  gfx.fillStyle(palette.primary, 1);
  gfx.fillCircle(cx, gy - 61 * s, 16 * s);
  gfx.fillRect(cx - 4 * s, gy - 47 * s, 8 * s, 33 * s);
  for (let offset = -15; offset <= 15; offset += 10) {
    gfx.fillRect(cx + offset * s, gy - 43 * s, 7 * s, 4 * s);
  }
  gfx.fillRect(cx - 18 * s, gy - 32 * s, 36 * s, 4 * s);
  gfx.fillRect(cx - 15 * s, gy - 28 * s, 4 * s, 25 * s);
  gfx.fillRect(cx + 11 * s, gy - 28 * s, 4 * s, 25 * s);
  gfx.fillStyle(palette.secondary, 1);
  gfx.fillRect(cx - 13 * s, gy - 17 * s, 26 * s, 5 * s);
}

function drawLupine(
  gfx: Phaser.GameObjects.Graphics,
  palette: MonsterPalette,
  { centerX: cx, groundY: gy, scale: s }: MonsterCanvas,
): void {
  gfx.fillStyle(palette.outline, 1);
  gfx.fillEllipse(cx - 5 * s, gy - 27 * s, 64 * s, 33 * s);
  gfx.fillCircle(cx + 27 * s, gy - 39 * s, 19 * s);
  gfx.fillTriangle(cx + 16 * s, gy - 52 * s, cx + 20 * s, gy - 72 * s, cx + 30 * s, gy - 50 * s);
  gfx.fillTriangle(cx + 30 * s, gy - 51 * s, cx + 40 * s, gy - 68 * s, cx + 43 * s, gy - 45 * s);
  gfx.fillTriangle(cx - 36 * s, gy - 28 * s, cx - 55 * s, gy - 48 * s, cx - 43 * s, gy - 14 * s);
  gfx.fillStyle(palette.primary, 1);
  gfx.fillEllipse(cx - 5 * s, gy - 28 * s, 56 * s, 27 * s);
  gfx.fillCircle(cx + 27 * s, gy - 39 * s, 15 * s);
  gfx.fillStyle(palette.secondary, 1);
  gfx.fillTriangle(cx - 13 * s, gy - 37 * s, cx + 4 * s, gy - 49 * s, cx + 15 * s, gy - 31 * s);
  gfx.fillRect(cx - 25 * s, gy - 18 * s, 8 * s, 18 * s);
  gfx.fillRect(cx + 10 * s, gy - 18 * s, 8 * s, 18 * s);
}

function drawSpectral(
  gfx: Phaser.GameObjects.Graphics,
  palette: MonsterPalette,
  { centerX: cx, groundY: gy, scale: s }: MonsterCanvas,
): void {
  gfx.fillStyle(palette.outline, 0.95);
  gfx.fillCircle(cx, gy - 59 * s, 22 * s);
  gfx.fillTriangle(cx - 24 * s, gy - 57 * s, cx - 34 * s, gy - 5 * s, cx, gy - 24 * s);
  gfx.fillTriangle(cx + 24 * s, gy - 57 * s, cx + 34 * s, gy - 5 * s, cx, gy - 24 * s);
  gfx.fillStyle(palette.primary, 0.88);
  gfx.fillCircle(cx, gy - 59 * s, 17 * s);
  gfx.fillTriangle(cx - 19 * s, gy - 55 * s, cx - 25 * s, gy - 12 * s, cx, gy - 28 * s);
  gfx.fillTriangle(cx + 19 * s, gy - 55 * s, cx + 25 * s, gy - 12 * s, cx, gy - 28 * s);
  gfx.fillStyle(palette.secondary, 0.75);
  gfx.fillCircle(cx - 17 * s, gy - 32 * s, 7 * s);
  gfx.fillCircle(cx + 17 * s, gy - 32 * s, 7 * s);
}

function drawColossus(
  gfx: Phaser.GameObjects.Graphics,
  palette: MonsterPalette,
  { centerX: cx, groundY: gy, scale: s }: MonsterCanvas,
): void {
  gfx.fillStyle(palette.outline, 1);
  gfx.fillCircle(cx, gy - 61 * s, 20 * s);
  gfx.fillEllipse(cx, gy - 31 * s, 70 * s, 55 * s);
  gfx.fillRect(cx - 43 * s, gy - 45 * s, 18 * s, 39 * s);
  gfx.fillRect(cx + 25 * s, gy - 45 * s, 18 * s, 39 * s);
  gfx.fillStyle(palette.primary, 1);
  gfx.fillCircle(cx, gy - 61 * s, 15 * s);
  gfx.fillEllipse(cx, gy - 32 * s, 61 * s, 47 * s);
  gfx.fillStyle(palette.secondary, 1);
  gfx.fillRect(cx - 29 * s, gy - 28 * s, 58 * s, 10 * s);
  gfx.fillRect(cx - 28 * s, gy - 13 * s, 18 * s, 13 * s);
  gfx.fillRect(cx + 10 * s, gy - 13 * s, 18 * s, 13 * s);
}

function drawDrake(
  gfx: Phaser.GameObjects.Graphics,
  palette: MonsterPalette,
  { centerX: cx, groundY: gy, scale: s }: MonsterCanvas,
): void {
  gfx.fillStyle(palette.outline, 1);
  gfx.fillTriangle(cx - 7 * s, gy - 42 * s, cx - 46 * s, gy - 69 * s, cx - 34 * s, gy - 18 * s);
  gfx.fillTriangle(cx + 7 * s, gy - 42 * s, cx + 46 * s, gy - 69 * s, cx + 34 * s, gy - 18 * s);
  gfx.fillEllipse(cx, gy - 31 * s, 48 * s, 49 * s);
  gfx.fillCircle(cx, gy - 61 * s, 19 * s);
  gfx.fillStyle(palette.primary, 1);
  gfx.fillTriangle(cx - 8 * s, gy - 40 * s, cx - 39 * s, gy - 62 * s, cx - 29 * s, gy - 23 * s);
  gfx.fillTriangle(cx + 8 * s, gy - 40 * s, cx + 39 * s, gy - 62 * s, cx + 29 * s, gy - 23 * s);
  gfx.fillEllipse(cx, gy - 31 * s, 41 * s, 42 * s);
  gfx.fillCircle(cx, gy - 61 * s, 15 * s);
  gfx.fillStyle(palette.secondary, 1);
  for (let offset = -12; offset <= 12; offset += 8) {
    gfx.fillTriangle(cx + offset * s, gy - 46 * s, cx + (offset + 4) * s, gy - 57 * s, cx + (offset + 8) * s, gy - 46 * s);
  }
}

function drawChimaera(
  gfx: Phaser.GameObjects.Graphics,
  palette: MonsterPalette,
  { centerX: cx, groundY: gy, scale: s }: MonsterCanvas,
): void {
  gfx.fillStyle(palette.outline, 1);
  gfx.fillEllipse(cx, gy - 27 * s, 68 * s, 38 * s);
  for (const offset of [-24, 0, 24]) {
    gfx.fillRect(cx + offset * s - 5 * s, gy - 56 * s, 10 * s, 31 * s);
    gfx.fillCircle(cx + offset * s, gy - 61 * s, 14 * s);
  }
  gfx.fillStyle(palette.primary, 1);
  gfx.fillEllipse(cx, gy - 27 * s, 60 * s, 31 * s);
  for (const offset of [-24, 0, 24]) {
    gfx.fillRect(cx + offset * s - 3 * s, gy - 55 * s, 6 * s, 27 * s);
    gfx.fillCircle(cx + offset * s, gy - 61 * s, 10 * s);
  }
  gfx.fillStyle(palette.secondary, 1);
  gfx.fillTriangle(cx - 33 * s, gy - 28 * s, cx - 52 * s, gy - 48 * s, cx - 43 * s, gy - 15 * s);
}

function drawConstruct(
  gfx: Phaser.GameObjects.Graphics,
  palette: MonsterPalette,
  { centerX: cx, groundY: gy, scale: s }: MonsterCanvas,
): void {
  gfx.fillStyle(palette.outline, 1);
  gfx.fillRect(cx - 27 * s, gy - 56 * s, 54 * s, 49 * s);
  gfx.fillRect(cx - 19 * s, gy - 75 * s, 38 * s, 24 * s);
  gfx.fillRect(cx - 40 * s, gy - 51 * s, 14 * s, 40 * s);
  gfx.fillRect(cx + 26 * s, gy - 51 * s, 14 * s, 40 * s);
  gfx.fillStyle(palette.primary, 1);
  gfx.fillRect(cx - 22 * s, gy - 52 * s, 44 * s, 42 * s);
  gfx.fillRect(cx - 15 * s, gy - 71 * s, 30 * s, 18 * s);
  gfx.fillStyle(palette.secondary, 1);
  gfx.fillRect(cx - 17 * s, gy - 45 * s, 34 * s, 11 * s);
  gfx.fillStyle(palette.detail, 1);
  gfx.fillCircle(cx, gy - 28 * s, 6 * s);
}

function drawStalker(
  gfx: Phaser.GameObjects.Graphics,
  palette: MonsterPalette,
  { centerX: cx, groundY: gy, scale: s }: MonsterCanvas,
): void {
  gfx.lineStyle(7 * s, palette.outline, 1);
  for (const direction of [-1, 1]) {
    gfx.lineBetween(cx + direction * 10 * s, gy - 26 * s, cx + direction * 40 * s, gy - 49 * s);
    gfx.lineBetween(cx + direction * 12 * s, gy - 22 * s, cx + direction * 45 * s, gy - 17 * s);
    gfx.lineBetween(cx + direction * 9 * s, gy - 16 * s, cx + direction * 34 * s, gy);
  }
  gfx.fillStyle(palette.outline, 1);
  gfx.fillEllipse(cx, gy - 25 * s, 51 * s, 38 * s);
  gfx.fillStyle(palette.primary, 1);
  gfx.fillEllipse(cx, gy - 25 * s, 43 * s, 30 * s);
  gfx.fillStyle(palette.secondary, 1);
  gfx.fillEllipse(cx, gy - 32 * s, 24 * s, 11 * s);
}

function drawFey(
  gfx: Phaser.GameObjects.Graphics,
  palette: MonsterPalette,
  { centerX: cx, groundY: gy, scale: s }: MonsterCanvas,
): void {
  gfx.fillStyle(palette.outline, 0.9);
  gfx.fillTriangle(cx - 9 * s, gy - 41 * s, cx - 44 * s, gy - 68 * s, cx - 35 * s, gy - 18 * s);
  gfx.fillTriangle(cx + 9 * s, gy - 41 * s, cx + 44 * s, gy - 68 * s, cx + 35 * s, gy - 18 * s);
  gfx.fillCircle(cx, gy - 45 * s, 24 * s);
  gfx.fillStyle(palette.primary, 0.95);
  gfx.fillTriangle(cx - 10 * s, gy - 42 * s, cx - 36 * s, gy - 59 * s, cx - 29 * s, gy - 25 * s);
  gfx.fillTriangle(cx + 10 * s, gy - 42 * s, cx + 36 * s, gy - 59 * s, cx + 29 * s, gy - 25 * s);
  gfx.fillCircle(cx, gy - 45 * s, 19 * s);
  gfx.fillStyle(palette.detail, 0.8);
  gfx.fillCircle(cx, gy - 45 * s, 8 * s);
}

function drawFlora(
  gfx: Phaser.GameObjects.Graphics,
  palette: MonsterPalette,
  { centerX: cx, groundY: gy, scale: s }: MonsterCanvas,
): void {
  gfx.fillStyle(palette.outline, 1);
  gfx.fillRect(cx - 17 * s, gy - 58 * s, 34 * s, 53 * s);
  gfx.fillCircle(cx - 21 * s, gy - 63 * s, 22 * s);
  gfx.fillCircle(cx + 21 * s, gy - 63 * s, 22 * s);
  gfx.fillCircle(cx, gy - 76 * s, 24 * s);
  gfx.fillTriangle(cx - 12 * s, gy - 12 * s, cx - 40 * s, gy, cx - 18 * s, gy - 31 * s);
  gfx.fillTriangle(cx + 12 * s, gy - 12 * s, cx + 40 * s, gy, cx + 18 * s, gy - 31 * s);
  gfx.fillStyle(palette.primary, 1);
  gfx.fillRect(cx - 12 * s, gy - 56 * s, 24 * s, 49 * s);
  gfx.fillCircle(cx - 19 * s, gy - 62 * s, 17 * s);
  gfx.fillCircle(cx + 19 * s, gy - 62 * s, 17 * s);
  gfx.fillCircle(cx, gy - 74 * s, 19 * s);
  gfx.fillStyle(palette.secondary, 1);
  gfx.fillRect(cx - 5 * s, gy - 56 * s, 10 * s, 49 * s);
}

function drawMimic(
  gfx: Phaser.GameObjects.Graphics,
  palette: MonsterPalette,
  { centerX: cx, groundY: gy, scale: s }: MonsterCanvas,
): void {
  gfx.fillStyle(palette.outline, 1);
  gfx.fillRect(cx - 37 * s, gy - 49 * s, 74 * s, 43 * s);
  gfx.fillRect(cx - 39 * s, gy - 66 * s, 78 * s, 20 * s);
  gfx.fillStyle(palette.primary, 1);
  gfx.fillRect(cx - 32 * s, gy - 44 * s, 64 * s, 34 * s);
  gfx.fillRect(cx - 34 * s, gy - 61 * s, 68 * s, 13 * s);
  gfx.fillStyle(palette.secondary, 1);
  gfx.fillRect(cx - 34 * s, gy - 47 * s, 68 * s, 8 * s);
  gfx.fillStyle(palette.detail, 1);
  gfx.fillRect(cx - 5 * s, gy - 39 * s, 10 * s, 16 * s);
  for (let offset = -24; offset <= 24; offset += 12) {
    gfx.fillTriangle(cx + offset * s, gy - 47 * s, cx + (offset + 6) * s, gy - 47 * s, cx + (offset + 3) * s, gy - 35 * s);
  }
}

function drawElemental(
  gfx: Phaser.GameObjects.Graphics,
  palette: MonsterPalette,
  { centerX: cx, groundY: gy, scale: s }: MonsterCanvas,
): void {
  gfx.fillStyle(palette.outline, 0.95);
  gfx.fillTriangle(cx, gy - 80 * s, cx - 35 * s, gy - 26 * s, cx - 12 * s, gy - 31 * s);
  gfx.fillTriangle(cx, gy - 80 * s, cx + 35 * s, gy - 26 * s, cx + 12 * s, gy - 31 * s);
  gfx.fillTriangle(cx - 28 * s, gy - 34 * s, cx - 12 * s, gy, cx, gy - 31 * s);
  gfx.fillTriangle(cx + 28 * s, gy - 34 * s, cx + 12 * s, gy, cx, gy - 31 * s);
  gfx.fillStyle(palette.primary, 0.95);
  gfx.fillTriangle(cx, gy - 72 * s, cx - 27 * s, gy - 28 * s, cx, gy - 35 * s);
  gfx.fillTriangle(cx, gy - 72 * s, cx + 27 * s, gy - 28 * s, cx, gy - 35 * s);
  gfx.fillStyle(palette.secondary, 0.85);
  gfx.fillTriangle(cx, gy - 62 * s, cx - 14 * s, gy - 34 * s, cx + 14 * s, gy - 34 * s);
}

function drawBossAdornment(
  gfx: Phaser.GameObjects.Graphics,
  monster: Monster,
  palette: MonsterPalette,
  { centerX: cx, groundY: gy, scale: s }: MonsterCanvas,
): void {
  gfx.fillStyle(palette.detail, 1);
  switch (monster.family) {
    case "skeletal":
      gfx.fillTriangle(cx - 28 * s, gy - 78 * s, cx - 18 * s, gy - 97 * s, cx - 8 * s, gy - 76 * s);
      gfx.fillTriangle(cx - 8 * s, gy - 78 * s, cx, gy - 105 * s, cx + 8 * s, gy - 78 * s);
      gfx.fillTriangle(cx + 8 * s, gy - 76 * s, cx + 18 * s, gy - 97 * s, cx + 28 * s, gy - 78 * s);
      break;
    case "spectral":
      gfx.lineStyle(4 * s, palette.detail, 0.9);
      gfx.strokeCircle(cx, gy - 65 * s, 29 * s);
      gfx.fillCircle(cx - 30 * s, gy - 38 * s, 5 * s);
      gfx.fillCircle(cx + 30 * s, gy - 38 * s, 5 * s);
      break;
    case "construct":
      gfx.fillTriangle(cx - 29 * s, gy - 67 * s, cx - 18 * s, gy - 91 * s, cx - 8 * s, gy - 67 * s);
      gfx.fillTriangle(cx + 8 * s, gy - 67 * s, cx + 18 * s, gy - 91 * s, cx + 29 * s, gy - 67 * s);
      gfx.lineStyle(3 * s, palette.detail, 1);
      gfx.strokeRect(cx - 30 * s, gy - 62 * s, 60 * s, 58 * s);
      break;
    case "drake":
      gfx.fillTriangle(cx - 17 * s, gy - 78 * s, cx - 28 * s, gy - 103 * s, cx - 8 * s, gy - 82 * s);
      gfx.fillTriangle(cx + 17 * s, gy - 78 * s, cx + 28 * s, gy - 103 * s, cx + 8 * s, gy - 82 * s);
      break;
    case "chimaera":
      gfx.lineStyle(4 * s, palette.detail, 1);
      gfx.lineBetween(cx - 36 * s, gy - 57 * s, cx - 52 * s, gy - 86 * s);
      gfx.lineBetween(cx + 36 * s, gy - 57 * s, cx + 52 * s, gy - 86 * s);
      break;
    case "colossus":
      gfx.fillRect(cx - 41 * s, gy - 52 * s, 12 * s, 50 * s);
      gfx.fillRect(cx + 29 * s, gy - 52 * s, 12 * s, 50 * s);
      break;
    default:
      gfx.lineStyle(4 * s, palette.detail, 1);
      gfx.strokeCircle(cx, gy - 46 * s, 36 * s);
      break;
  }
}

function drawFace(
  gfx: Phaser.GameObjects.Graphics,
  monster: Monster,
  palette: MonsterPalette,
  { centerX: cx, groundY: gy, scale: s }: MonsterCanvas,
): void {
  if (monster.family === "mimic") return;
  const faceY = monster.family === "stalker"
    ? gy - 28 * s
    : monster.family === "lupine"
      ? gy - 42 * s
      : gy - 59 * s;
  const eyeOffset = monster.family === "chimaera" ? 24 * s : 8 * s;
  gfx.fillStyle(palette.outline, 1);
  gfx.fillCircle(cx - eyeOffset, faceY, 4 * s);
  gfx.fillCircle(cx + eyeOffset, faceY, 4 * s);
  gfx.fillStyle(palette.detail, 1);
  gfx.fillCircle(cx - eyeOffset, faceY, 2 * s);
  gfx.fillCircle(cx + eyeOffset, faceY, 2 * s);
}
