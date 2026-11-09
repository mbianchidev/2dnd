import type * as Phaser from "phaser";
import { ALL_MONSTERS } from "../data/monsters";
import { getMonsterTextureKey } from "../data/monsterFamilies";
import { createMonsterArt, type MonsterArtPose } from "../systems/monsterArt";
import { createPixelTexture } from "./pixelTexture";

export const MONSTER_ART_FRAMES: Readonly<Record<string, MonsterArtPose>> = {
  idle: "idle", "idle-1": "blink", attack: "ready", "attack-1": "strike",
  cast: "cast", damage: "hurt", faint: "fallen",
};

export function generateMonsterTextures(scene: Phaser.Scene): void {
  for (const monster of ALL_MONSTERS) {
    const prefix = getMonsterTextureKey(monster).slice(0, -4);
    for (const [frame, pose] of Object.entries(MONSTER_ART_FRAMES)) {
      const key = `${prefix}${frame}`;
      if (!scene.textures.exists(key)) createPixelTexture(scene, key, createMonsterArt(monster, pose), 2);
    }
  }
}
