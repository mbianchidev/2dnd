import type * as Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import type { CutsceneSceneryPlan } from "../systems/cutsceneScenery";

export const CUTSCENE_RESULT_DIM = 0.62;

/** One scene-owned Graphics buffer; no extra objects, listeners, textures or per-frame work. */
export function drawCutsceneScenery(
  graphics: Phaser.GameObjects.Graphics,
  plan: CutsceneSceneryPlan,
  dim = 0,
): void {
  graphics.clear();
  for (const shape of plan.primitives) {
    graphics.fillStyle(shape.color, shape.alpha);
    if (shape.kind === "polygon") {
      if (shape.points.length < 3) throw new Error("[cutscene] A scenery polygon needs three points.");
      graphics.beginPath();
      for (let index = 0; index < shape.points.length; index++) {
        const point = shape.points[index];
        if (index === 0) graphics.moveTo(point.x, point.y);
        else graphics.lineTo(point.x, point.y);
      }
      graphics.closePath();
      graphics.fillPath();
    } else if (shape.kind === "rect") {
      graphics.fillRect(shape.x, shape.y, shape.width, shape.height);
    } else {
      graphics.fillEllipse(shape.x, shape.y, shape.width, shape.height);
    }
  }
  if (dim > 0) graphics.fillStyle(0x000000, dim).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
}
