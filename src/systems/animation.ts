/**
 * Phaser-free animation contracts shared by world and battle presentation.
 */

export type ActorAnimationState =
  | "idle"
  | "walk"
  | "attack"
  | "cast"
  | "ability"
  | "item"
  | "defend"
  | "damage"
  | "victory"
  | "faint"
  | "flee";

export type ActorAnimationRole =
  | "hero"
  | "companion"
  | "monster"
  | "boss"
  | "mount"
  | "cutscene";

export type PresentationActionKind =
  | "walk"
  | "attack"
  | "spell"
  | "ability"
  | "item"
  | "defend"
  | "flee";

export interface PresentationActorRef {
  readonly id: string;
  readonly role: ActorAnimationRole;
  readonly textureFamilyId: string;
}

export interface AnimationStateFacts {
  readonly alive: boolean;
  readonly knockedOut: boolean;
  readonly defending: boolean;
  readonly moving: boolean;
  readonly action?: PresentationActionKind;
  readonly outcome?:
    | "none"
    | "success"
    | "miss"
    | "damage"
    | "victory"
    | "faint"
    | "flee";
}

interface AnimationTimingDefinition {
  readonly delayMs: number;
  readonly durationMs: number;
  readonly holdMs: number;
}

export interface AnimationTiming extends AnimationTimingDefinition {
  readonly totalMs: number;
  readonly immediate: boolean;
  readonly reducedMotion: boolean;
}

const ACTOR_ANIMATION_TIMINGS = {
  idle: { delayMs: 0, durationMs: 600, holdMs: 0 },
  walk: { delayMs: 0, durationMs: 180, holdMs: 0 },
  attack: { delayMs: 0, durationMs: 260, holdMs: 80 },
  cast: { delayMs: 0, durationMs: 360, holdMs: 100 },
  ability: { delayMs: 0, durationMs: 320, holdMs: 100 },
  item: { delayMs: 0, durationMs: 240, holdMs: 80 },
  defend: { delayMs: 0, durationMs: 180, holdMs: 120 },
  damage: { delayMs: 0, durationMs: 180, holdMs: 80 },
  victory: { delayMs: 0, durationMs: 500, holdMs: 300 },
  faint: { delayMs: 0, durationMs: 420, holdMs: 0 },
  flee: { delayMs: 0, durationMs: 360, holdMs: 0 },
} as const satisfies Readonly<
  Record<ActorAnimationState, AnimationTimingDefinition>
>;

export interface ActorTextureFamily {
  /** Stable ID suitable for future actor and monster-family metadata. */
  readonly id: string;
  readonly role: ActorAnimationRole;
  /** Explicit texture keys avoid coupling this contract to a naming scheme. */
  readonly frames: Readonly<
    Partial<
      Record<
        ActorAnimationState,
        readonly {
          readonly textureKey: string;
          readonly durationMs?: number;
        }[]
      >
    >
  >;
  readonly fallbackTextureKey: string;
}

export interface ActorTextureResolution {
  readonly familyId: string;
  readonly state: ActorAnimationState;
  readonly requestedFrameIndex: number;
  readonly resolvedFrameIndex: number | null;
  readonly textureKey: string | null;
  readonly source:
    | "requested-frame"
    | "state-frame-fallback"
    | "family-fallback"
    | "missing";
  readonly usedFallback: boolean;
}

/**
 * Maps requested stable IDs to actors in request order. Duplicate requested IDs
 * are returned once, missing IDs are ignored, and the first actor for a
 * duplicated actor ID is authoritative.
 */
export function mapPresentationTargets<TActor extends PresentationActorRef>(
  actors: readonly TActor[],
  targetIds: readonly string[],
): TActor[] {
  const actorsById = new Map<string, TActor>();
  for (const actor of actors) {
    if (!actorsById.has(actor.id)) actorsById.set(actor.id, actor);
  }

  const seenIds = new Set<string>();
  const targets: TActor[] = [];
  for (const id of targetIds) {
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const actor = actorsById.get(id);
    if (actor !== undefined) targets.push(actor);
  }
  return targets;
}

/**
 * Selects one visual state from immutable actor, action, and outcome facts.
 * Terminal and reaction outcomes take precedence over the initiating action.
 */
export function selectActorAnimationState(
  facts: AnimationStateFacts,
): ActorAnimationState {
  if (!facts.alive || facts.knockedOut || facts.outcome === "faint") {
    return "faint";
  }
  if (facts.outcome === "damage") return "damage";
  if (facts.outcome === "victory") return "victory";
  if (facts.outcome === "flee") return "flee";

  switch (facts.action) {
    case "walk":
      return "walk";
    case "attack":
      return "attack";
    case "spell":
      return "cast";
    case "ability":
      return "ability";
    case "item":
      return "item";
    case "defend":
      return "defend";
    case "flee":
      return "flee";
    case undefined:
      break;
  }

  if (facts.defending) return "defend";
  if (facts.moving) return "walk";
  return "idle";
}

export function resolveAnimationTiming(
  state: ActorAnimationState,
  reducedMotion: boolean,
): AnimationTiming {
  if (reducedMotion) {
    return {
      delayMs: 0,
      durationMs: 0,
      holdMs: 0,
      totalMs: 0,
      immediate: true,
      reducedMotion: true,
    };
  }

  const definition = ACTOR_ANIMATION_TIMINGS[state];
  const delayMs = toMilliseconds(definition.delayMs);
  const durationMs = toMilliseconds(definition.durationMs);
  const holdMs = toMilliseconds(definition.holdMs);
  const totalMs = delayMs + durationMs + holdMs;
  return {
    delayMs,
    durationMs,
    holdMs,
    totalMs,
    immediate: totalMs === 0,
    reducedMotion: false,
  };
}

/**
 * Resolves only texture keys confirmed by the caller. A missing requested frame
 * falls back to the first existing frame for the state, then to the family's
 * explicit fallback texture.
 */
export function resolveActorTextureFrame(
  family: ActorTextureFamily,
  state: ActorAnimationState,
  frameIndex: number,
  textureExists: (textureKey: string) => boolean,
): ActorTextureResolution {
  const frames = family.frames[state] ?? [];
  const normalizedFrameIndex = Number.isInteger(frameIndex)
    && frameIndex >= 0
    ? frameIndex
    : 0;
  const requestedFrame = frames[normalizedFrameIndex];

  if (
    requestedFrame !== undefined
    && textureExists(requestedFrame.textureKey)
  ) {
    return {
      familyId: family.id,
      state,
      requestedFrameIndex: normalizedFrameIndex,
      resolvedFrameIndex: normalizedFrameIndex,
      textureKey: requestedFrame.textureKey,
      source: "requested-frame",
      usedFallback: false,
    };
  }

  const fallbackFrameIndex = frames.findIndex((frame) =>
    textureExists(frame.textureKey)
  );
  if (fallbackFrameIndex >= 0) {
    return {
      familyId: family.id,
      state,
      requestedFrameIndex: normalizedFrameIndex,
      resolvedFrameIndex: fallbackFrameIndex,
      textureKey: frames[fallbackFrameIndex]?.textureKey ?? null,
      source: "state-frame-fallback",
      usedFallback: true,
    };
  }

  if (textureExists(family.fallbackTextureKey)) {
    return {
      familyId: family.id,
      state,
      requestedFrameIndex: normalizedFrameIndex,
      resolvedFrameIndex: null,
      textureKey: family.fallbackTextureKey,
      source: "family-fallback",
      usedFallback: true,
    };
  }

  return {
    familyId: family.id,
    state,
    requestedFrameIndex: normalizedFrameIndex,
    resolvedFrameIndex: null,
    textureKey: null,
    source: "missing",
    usedFallback: true,
  };
}

/**
 * Creates a terminal completion/cancellation gate with idempotent cleanup.
 */
export class OncePresentation {
  private lifecycleStatus: "pending" | "completed" | "cancelled" = "pending";
  private hasCleanedUp = false;

  public constructor(
    private readonly callbacks: {
      readonly onComplete: () => void;
      readonly onCancel?: () => void;
      readonly cleanup?: () => void;
    },
  ) {}

  public get status(): "pending" | "completed" | "cancelled" {
    return this.lifecycleStatus;
  }

  public get cleanedUp(): boolean {
    return this.hasCleanedUp;
  }

  public complete(): boolean {
    if (this.lifecycleStatus !== "pending") return false;
    this.lifecycleStatus = "completed";
    try {
      this.callbacks.onComplete();
    } finally {
      this.cleanup();
    }
    return true;
  }

  public cancel(): boolean {
    if (this.lifecycleStatus !== "pending") return false;
    this.lifecycleStatus = "cancelled";
    try {
      this.callbacks.onCancel?.();
    } finally {
      this.cleanup();
    }
    return true;
  }

  public cleanup(): boolean {
    if (this.hasCleanedUp) return false;
    this.hasCleanedUp = true;
    this.callbacks.cleanup?.();
    return true;
  }
}

function toMilliseconds(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value);
}
