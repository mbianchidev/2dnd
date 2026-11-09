import type * as Phaser from "phaser";
import { getHeroVisualTextureKey } from "../systems/heroVisuals";
import { createHeroPortraitArt, createMonsterPortraitArt, createNpcPortraitArt } from "../systems/portraitArt";
import type { CutscenePortrait } from "../systems/cutscenePortraits";
import { HeroTextureLeaseRegistry, type HeroTextureLease } from "./heroTextures";
import { createPixelTexture } from "./pixelTexture";

const registries = new WeakMap<Phaser.Textures.TextureManager, HeroTextureLeaseRegistry>();

export function acquirePortraitTexture(scene: Phaser.Scene, portrait: CutscenePortrait): HeroTextureLease {
  const key = portrait.kind === "hero" ? `portrait-${getHeroVisualTextureKey(portrait.visual, "front")}`
    : portrait.kind === "monster" ? `portrait-monster-${portrait.monster.id}`
      : `portrait-npc-${portrait.visual.template.id}-${portrait.visual.skinColor}-${portrait.visual.hairColor}-${portrait.visual.dressColor}`;
  let registry = registries.get(scene.textures);
  if (!registry) {
    registry = new HeroTextureLeaseRegistry();
    registries.set(scene.textures, registry);
  }
  return registry.acquire(key, () => scene.textures.exists(key), () => {
    const art = portrait.kind === "hero" ? createHeroPortraitArt(portrait.visual)
      : portrait.kind === "npc" ? createNpcPortraitArt(portrait.visual) : createMonsterPortraitArt(portrait.monster);
    createPixelTexture(scene, key, art);
  }, () => scene.textures.remove(key));
}
