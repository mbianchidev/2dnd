import * as Phaser from "phaser";
import type { CompanionState } from "../systems/party";
import {
  getActiveWeaponSprite,
  getPlayerClass,
} from "../systems/classes";
import { generatePlayerTextureWithHair } from "./textures";

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
  return key;
}
