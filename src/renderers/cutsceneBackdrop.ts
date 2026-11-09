import type * as Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import type { CutsceneSceneryPlan } from "../systems/cutsceneScenery";
import { PixelSceneryGraphics } from "./pixelScenery";

export const CUTSCENE_RESULT_DIM = 0.62;

/** One scene-owned Graphics buffer; no extra objects, listeners, textures or per-frame work. */
export function drawCutsceneScenery(
  graphics: Phaser.GameObjects.Graphics,
  plan: CutsceneSceneryPlan,
  dim = 0,
): void {
  graphics.clear();
  const raster = new PixelSceneryGraphics(graphics);
  for (const shape of plan.primitives) {
    raster.fillStyle(shape.color, shape.alpha);
    if (shape.kind === "polygon") {
      if (shape.points.length < 3) throw new Error("[cutscene] A scenery polygon needs three points.");
      raster.beginPath();
      for (let index = 0; index < shape.points.length; index++) {
        const point = shape.points[index];
        if (index === 0) raster.moveTo(point.x, point.y);
        else raster.lineTo(point.x, point.y);
      }
      raster.closePath();
      raster.fillPath();
    } else if (shape.kind === "rect") {
      raster.fillRect(shape.x, shape.y, shape.width, shape.height);
    } else {
      raster.fillEllipse(shape.x, shape.y, shape.width, shape.height);
    }
  }
  if (dim > 0) graphics.fillStyle(0x000000, dim).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
}
