import type * as Phaser from "phaser";
import type { CompanionState } from "../systems/party";
import { resolveHeroVisualDescriptor } from "../systems/heroVisuals";
import type { HeroFacing } from "../systems/heroVisuals";
import { createHeroArt } from "../systems/humanoidArt";
import { HERO_FRAME_POSES } from "./heroTextures";
import { createPixelTexture } from "./pixelTexture";

export function getCompanionTextureKey(companionId: string): string {
  return `companion_${companionId}`;
}

export function getCompanionFacingTextureKey(companionId: string, facing: HeroFacing): string {
  const key = getCompanionTextureKey(companionId);
  return facing === "front" ? key : `${key}_${facing}`;
}

export function generateCompanionTexture(scene: Phaser.Scene, companion: CompanionState): string {
  const key = getCompanionTextureKey(companion.id);
  const descriptor = resolveHeroVisualDescriptor(companion);
  for (const facing of ["front", "back", "side"] as const) {
    const prefix = getCompanionFacingTextureKey(companion.id, facing);
    if (scene.textures.exists(prefix)) scene.textures.remove(prefix);
    createPixelTexture(scene, prefix, createHeroArt(descriptor, facing, "standard"));
    const states = facing === "front" ? Object.entries(HERO_FRAME_POSES)
      : [["walk", ["strideLeft", "strideRight"] as const]] as const;
    for (const [state, poses] of states) {
      for (const [index, pose] of poses.entries()) {
        const frameKey = `${prefix}_${state}_${index}`;
        if (scene.textures.exists(frameKey)) scene.textures.remove(frameKey);
        createPixelTexture(scene, frameKey, createHeroArt(descriptor, facing, pose));
      }
    }
  }
  return key;
}
