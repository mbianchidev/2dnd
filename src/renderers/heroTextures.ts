import type * as Phaser from "phaser";
import type { HeroFacing, HeroPose, HeroVisualDescriptor } from "../systems/heroVisuals";
import { getHeroVisualTextureKey } from "../systems/heroVisuals";
import { createHeroArt, type CharacterArtPose } from "../systems/humanoidArt";
import type { ActorAnimationState } from "../systems/animation";
import { createPixelTexture } from "./pixelTexture";

export interface HeroTextureLease {
  readonly key: string;
  readonly reused: boolean;
  release(): void;
}

interface HeroTextureCacheEntry {
  references: number;
}

export class HeroTextureLeaseRegistry {
  private readonly entries = new Map<string, HeroTextureCacheEntry>();

  acquire(key: string, exists: () => boolean, generate: () => void, remove: () => void): HeroTextureLease {
    const existing = this.entries.get(key);
    const reused = existing !== undefined || exists();
    if (!reused) generate();
    const entry = existing ?? { references: 0 };
    entry.references += 1;
    this.entries.set(key, entry);
    let released = false;
    return {
      key, reused,
      release: () => {
        if (released) return;
        released = true;
        entry.references -= 1;
        if (entry.references > 0) return;
        this.entries.delete(key);
        if (exists()) remove();
      },
    };
  }

  get size(): number { return this.entries.size; }
}

export const HERO_FRAME_POSES: Readonly<Partial<Record<ActorAnimationState, readonly CharacterArtPose[]>>> = {
  idle: ["standard", "blink"], walk: ["strideLeft", "strideRight"],
  attack: ["ready", "strike"], cast: ["ready", "cast"], ability: ["ready", "strike"],
  item: ["ready", "cast"], defend: ["ready", "ready"], damage: ["hurt", "hurt"],
  victory: ["ready", "cast"], faint: ["fallen", "fallen"], flee: ["strideLeft", "strideRight"],
};

const textureRegistries = new WeakMap<Phaser.Textures.TextureManager, HeroTextureLeaseRegistry>();

export function acquireHeroTexture(
  scene: Phaser.Scene,
  descriptor: HeroVisualDescriptor,
  facing: HeroFacing = "front",
  pose: HeroPose = "standard",
  highContrast = false,
): HeroTextureLease {
  const key = getHeroVisualTextureKey(descriptor, facing, pose, highContrast);
  let registry = textureRegistries.get(scene.textures);
  if (!registry) {
    registry = new HeroTextureLeaseRegistry();
    textureRegistries.set(scene.textures, registry);
  }
  const frames = pose === "standard" ? Object.entries(HERO_FRAME_POSES).flatMap(([state, poses]) =>
    poses.map((framePose, index) => ({ key: `${key}_${state}_${index}`, pose: framePose }))) : [];
  return registry.acquire(key, () => scene.textures.exists(key), () => {
    createPixelTexture(scene, key, createHeroArt(descriptor, facing, pose));
    for (const frame of frames) createPixelTexture(scene, frame.key, createHeroArt(descriptor, facing, frame.pose));
  }, () => {
    for (const frame of frames) if (scene.textures.exists(frame.key)) scene.textures.remove(frame.key);
    scene.textures.remove(key);
  });
}
