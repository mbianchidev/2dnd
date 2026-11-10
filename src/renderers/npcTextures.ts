import type * as Phaser from "phaser";
import type { NpcTemplate } from "../data/npcs";
import { createNpcArt } from "../systems/npcArt";
import { createPixelTexture } from "./pixelTexture";

/** NPC and story actors share the same outlined faces, clothing and separate skin palette. */
export function getOrCreateNpcTexture(
  scene: Phaser.Scene,
  template: NpcTemplate,
  skinColor: number,
  hairColor: number,
  dressColor: number,
): string {
  const key = `npc_${template.id}_${skinColor.toString(16)}_${hairColor.toString(16)}_${dressColor.toString(16)}`;
  if (scene.textures.exists(key)) return key;
  const visual = { template, skinColor, hairColor, dressColor };
  createPixelTexture(scene, key, createNpcArt(visual));
  for (const [suffix, pose] of [
    ["idle_0", "standard"], ["idle_1", "blink"], ["walk_0", "strideLeft"], ["walk_1", "strideRight"],
  ] as const) {
    createPixelTexture(scene, `${key}_${suffix}`, createNpcArt(visual, pose));
  }
  return key;
}
