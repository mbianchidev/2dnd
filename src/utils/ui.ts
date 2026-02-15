/**
 * Shared UI helper functions for overlay panels.
 * Eliminates duplicated dim-background + bordered-panel patterns
 * used across overlay.ts, dialogue.ts, and scene files.
 */

import Phaser from "phaser";

/** Standard panel background color. */
export const PANEL_BG_COLOR = 0x1a1a2e;
/** Standard gold border color. */
export const BORDER_GOLD = 0xffd700;
/** Alternate warm border color. */
export const BORDER_WARM = 0xc0a060;

interface PanelLayout {
  w: number;
  h: number;
  panelW: number;
  panelH: number;
  px: number;
  py: number;
}

/** Calculate centered panel dimensions relative to the camera viewport. */
export function calcPanelLayout(
  scene: Phaser.Scene,
  panelW: number,
  panelH: number,
  offsetY = 0,
): PanelLayout {
  const w = scene.cameras.main.width;
  const h = scene.cameras.main.height;
  return {
    w,
    h,
    panelW,
    panelH,
    px: Math.floor((w - panelW) / 2),
    py: Math.floor((h - panelH) / 2) + offsetY,
  };
}

/** Create a full-screen dim overlay graphics object. */
export function createDimGraphics(
  scene: Phaser.Scene,
  w: number,
  h: number,
  alpha = 0.6,
): Phaser.GameObjects.Graphics {
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, alpha);
  dim.fillRect(0, 0, w, h);
  return dim;
}

/** Create a bordered panel background graphics object. */
export function createPanelGraphics(
  scene: Phaser.Scene,
  px: number,
  py: number,
  panelW: number,
  panelH: number,
  bgAlpha = 0.95,
  borderColor = BORDER_GOLD,
): Phaser.GameObjects.Graphics {
  const bg = scene.add.graphics();
  bg.fillStyle(PANEL_BG_COLOR, bgAlpha);
  bg.fillRect(px, py, panelW, panelH);
  bg.lineStyle(2, borderColor, 1);
  bg.strokeRect(px, py, panelW, panelH);
  return bg;
}
