import type * as Phaser from "phaser";
import { buildCutsceneScenery } from "../systems/cutsceneScenery";
import { drawCutsceneScenery } from "./cutsceneBackdrop";

/** Original world art remains visible behind title and character-creation panels. */
export function createCreationBackdrop(scene: Phaser.Scene): void {
  const background = scene.add.graphics().setName("creation-world-backdrop").setDepth(-10);
  drawCutsceneScenery(background, buildCutsceneScenery("campaign.opening", "heartlands"), 0.72);
}
