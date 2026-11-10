/**
 * Shared UI helper functions for overlay panels.
 * Eliminates duplicated dim-background + bordered-panel patterns
 * used across overlay.ts, dialogue.ts, and scene files.
 */

import * as Phaser from "phaser";
import {
  registerLayoutGroup,
  updateLayoutGroupViewport,
} from "../managers/layout";
import { centeredRect, type LayoutInsets } from "../systems/layout";
import { UI_COLORS } from "../systems/uiTheme";

/** Standard panel background color. */
export const PANEL_BG_COLOR = UI_COLORS.panel;
/** Standard gold border color. */
export const BORDER_GOLD = UI_COLORS.gold;
/** Alternate warm border color. */
export const BORDER_WARM = UI_COLORS.border;

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
  safeArea: Partial<LayoutInsets> = {},
): PanelLayout {
  const w = scene.cameras.main.width;
  const h = scene.cameras.main.height;
  const panel = centeredRect(
    { x: 0, y: 0, width: w, height: h },
    { width: panelW, height: panelH },
    safeArea,
  );
  return {
    w,
    h,
    panelW: panel.width,
    panelH: panel.height,
    px: panel.x,
    py: panel.y + offsetY,
  };
}

/** Create a modal container and register its content bounds for debug/test audits. */
export function createOverlayContainer(
  scene: Phaser.Scene,
  id: string,
  depth: number,
  viewport?: { x: number; y: number; width: number; height: number },
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0).setDepth(depth);
  registerLayoutGroup(scene, id, container, viewport);
  return container;
}

/** Update an overlay audit viewport after responsive panel bounds are measured. */
export function setOverlayViewport(
  scene: Phaser.Scene,
  id: string,
  viewport: { x: number; y: number; width: number; height: number },
): void {
  updateLayoutGroupViewport(scene, id, viewport);
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
  borderColor: number = BORDER_GOLD,
): Phaser.GameObjects.Graphics {
  const bg = scene.add.graphics();
  paintPanel(bg, px, py, panelW, panelH, bgAlpha, borderColor);
  return bg;
}

export function paintPanel(
  graphics: Phaser.GameObjects.Graphics, x: number, y: number, width: number, height: number,
  alpha = 0.94, borderColor: number = BORDER_GOLD,
): void {
  graphics.fillStyle(PANEL_BG_COLOR, alpha).fillRect(x, y, width, height);
  graphics.lineStyle(1, borderColor, 0.95).strokeRect(x, y, width, height);
  if (width < 24 || height < 24) return;
  graphics.lineStyle(1, UI_COLORS.border, 0.18).strokeRect(x + 3, y + 3, width - 6, height - 6);
  graphics.fillStyle(borderColor, 0.95);
  for (const cornerX of [x, x + width - 5]) {
    for (const cornerY of [y, y + height - 2]) graphics.fillRect(cornerX, cornerY, 5, 2);
  }
}

/** Scene-owned polite status region; the owner removes it when its modal closes. */
export function createStatusAnnouncer(id: string): HTMLDivElement {
  const region = document.createElement("div");
  region.id = id;
  region.setAttribute("role", "status");
  region.setAttribute("aria-live", "polite");
  region.setAttribute("aria-atomic", "true");
  Object.assign(region.style, {
    position: "fixed", width: "1px", height: "1px",
    overflow: "hidden", clipPath: "inset(50%)",
  });
  document.body.append(region);
  return region;
}
