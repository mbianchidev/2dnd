import type { Monster } from "../data/monsters";
import { getMonsterTextureKey } from "../data/monsterFamilies";
import type {
  ActorAnimationRole,
  ActorAnimationState,
  ActorTextureFamily,
} from "../systems/animation";

const FRAME_STATES: readonly ActorAnimationState[] = [
  "idle",
  "walk",
  "attack",
  "cast",
  "ability",
  "item",
  "defend",
  "damage",
  "victory",
  "faint",
  "flee",
];

export interface ActorTextureFamilyOptions {
  readonly id: string;
  readonly role: ActorAnimationRole;
  readonly fallbackTextureKey: string;
  readonly framePrefix?: string;
  readonly frameCount?: number;
}

export function createActorTextureFamily(
  options: ActorTextureFamilyOptions,
): ActorTextureFamily {
  const framePrefix = options.framePrefix ?? options.fallbackTextureKey;
  const frameCount = Math.max(1, Math.floor(options.frameCount ?? 2));
  const frames: ActorTextureFamily["frames"] = Object.fromEntries(
    FRAME_STATES.map((state) => [
      state,
      Array.from({ length: frameCount }, (_, frameIndex) => ({
        textureKey: `${framePrefix}_${state}_${frameIndex}`,
      })),
    ]),
  );
  return {
    id: options.id,
    role: options.role,
    frames,
    fallbackTextureKey: options.fallbackTextureKey,
  };
}

export function resolveMonsterTextureFamily(
  monster: Monster,
  textureExists: (textureKey: string) => boolean,
): ActorTextureFamily {
  const role: ActorAnimationRole = monster.isBoss ? "boss" : "monster";
  const fallbackTextureKey = getMonsterTextureKey(monster);
  const framePrefix = fallbackTextureKey.endsWith("-idle")
    ? fallbackTextureKey.slice(0, -"-idle".length)
    : fallbackTextureKey;
  const family = createActorTextureFamily({
    id: `monster.${monster.family}`,
    role,
    fallbackTextureKey,
    framePrefix,
  });
  return {
    ...family,
    frames: Object.fromEntries(FRAME_STATES.map((state) => [
      state,
      [
        { textureKey: `${framePrefix}-${state}` },
        { textureKey: `${framePrefix}-${state}-1` },
      ],
    ])),
    fallbackTextureKey: textureExists(fallbackTextureKey)
      ? fallbackTextureKey
      : monster.isBoss ? "monster_boss" : "monster",
  };
}
