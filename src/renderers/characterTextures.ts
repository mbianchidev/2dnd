import * as Phaser from "phaser";
import type { CompanionState } from "../systems/party";
import {
  getActiveWeaponSprite,
  getPlayerClass,
} from "../systems/classes";
import { generatePlayerTextureWithHair } from "./textures";
import { createHumanoidArt } from "../systems/humanoidArt";
import { createPixelTexture } from "./pixelTexture";

export function getCompanionTextureKey(companionId: string): string {
  return `companion_${companionId}`;
}

export function generateCompanionTexture(
  scene: Phaser.Scene,
  companion: CompanionState,
): string {
  const key = getCompanionTextureKey(companion.id);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const playerClass = getPlayerClass(companion.appearanceId);
  generatePlayerTextureWithHair(
    scene,
    key,
    playerClass.bodyColor,
    companion.customAppearance.skinColor,
    playerClass.legColor,
    companion.customAppearance.hairStyle,
    companion.customAppearance.hairColor,
    getActiveWeaponSprite(
      companion.appearanceId,
      companion.equippedWeapon,
    ),
    playerClass.clothingStyle,
    !!companion.equippedShield
      && !companion.equippedWeapon?.twoHanded
      && !companion.equippedOffHand,
  );
  for (const [index, pose] of ["strideLeft", "strideRight"].entries()) {
    const frameKey = `${key}_walk_${index}`;
    if (scene.textures.exists(frameKey)) scene.textures.remove(frameKey);
    createPixelTexture(scene, frameKey, createHumanoidArt({
      bodyColor: playerClass.bodyColor, legColor: playerClass.legColor,
      skinColor: companion.customAppearance.skinColor, hairColor: companion.customAppearance.hairColor,
      hairStyle: companion.customAppearance.hairStyle, clothingStyle: playerClass.clothingStyle,
      classId: playerClass.id, pose: pose === "strideLeft" ? "strideLeft" : "strideRight",
      weapon: getActiveWeaponSprite(companion.appearanceId, companion.equippedWeapon),
    }));
  }
  return key;
}
