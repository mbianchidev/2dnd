import type * as Phaser from "phaser";
import type { NpcTemplate } from "../data/npcs";
import { createHumanoidArt } from "../systems/humanoidArt";
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
  const guard = template.id.startsWith("guard");
  createPixelTexture(scene, key, createHumanoidArt({
    bodyColor: dressColor, skinColor, legColor: 0x625443, hairColor,
    hairStyle: template.ageGroup === "female" ? 3 : 1,
    clothingStyle: guard ? "heavy" : template.ageGroup === "female" ? "vestment" : "leather",
    weapon: guard ? "sword" : undefined,
  }));
  for (const [suffix, pose] of [
    ["idle_0", "standard"], ["idle_1", "blink"], ["walk_0", "strideLeft"], ["walk_1", "strideRight"],
  ] as const) {
    createPixelTexture(scene, `${key}_${suffix}`, createHumanoidArt({
      bodyColor: dressColor, skinColor, legColor: 0x625443, hairColor,
      hairStyle: template.ageGroup === "female" ? 3 : 1,
      clothingStyle: guard ? "heavy" : template.ageGroup === "female" ? "vestment" : "leather",
      weapon: guard ? "sword" : undefined, pose,
    }));
  }
  return key;
}
