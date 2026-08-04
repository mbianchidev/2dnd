import type { Monster } from "../data/monsters";
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
  const familyId = readOptionalString(monster, "family")
    ?? readOptionalString(monster, "textureFamily")
    ?? (monster.isBoss ? "boss" : "monster");
  const role: ActorAnimationRole = monster.isBoss ? "boss" : "monster";
  const baseCandidates = monster.isBoss
    ? [
        `boss_${familyId}_base`,
        `monster_${familyId}_boss`,
        `monster_${familyId}_base`,
        "monster_boss",
      ]
    : [
        `monster_${familyId}_base`,
        `monster_${familyId}`,
        "monster",
      ];
  const fallbackTextureKey = baseCandidates.find(textureExists)
    ?? (monster.isBoss ? "monster_boss" : "monster");
  const framePrefix = fallbackTextureKey.endsWith("_base")
    ? fallbackTextureKey.slice(0, -"_base".length)
    : fallbackTextureKey;

  return createActorTextureFamily({
    id: `monster.${familyId}`,
    role,
    fallbackTextureKey,
    framePrefix,
  });
}

function readOptionalString(
  value: object,
  property: string,
): string | undefined {
  if (!(property in value)) return undefined;
  const candidate: unknown = Reflect.get(value, property);
  return typeof candidate === "string" && candidate.length > 0
    ? candidate
    : undefined;
}
