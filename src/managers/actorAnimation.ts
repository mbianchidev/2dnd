import * as Phaser from "phaser";
import {
  OncePresentation,
  resolveActorTextureFrame,
  resolveAnimationTiming,
  type ActorAnimationRole,
  type ActorAnimationState,
  type ActorTextureFamily,
  type PresentationActorRef,
} from "../systems/animation";
import { isReducedMotionEnabled } from "../systems/accessibility";

type AnimationTarget =
  | Phaser.GameObjects.Sprite
  | Phaser.GameObjects.Container;

interface ActorSnapshot {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
  angle: number;
  visible: boolean;
}

interface ActiveActorAnimation {
  lifecycle: OncePresentation;
  tweens: Phaser.Tweens.Tween[];
  timers: Phaser.Time.TimerEvent[];
}

interface ActorRecord extends PresentationActorRef {
  target: AnimationTarget;
  textureFamily: ActorTextureFamily;
  snapshot: ActorSnapshot;
  currentState: ActorAnimationState;
  active?: ActiveActorAnimation;
  idleTween?: Phaser.Tweens.Tween;
}

export interface ActorAnimationBinding {
  readonly id: string;
  readonly role: ActorAnimationRole;
  readonly target: AnimationTarget;
  readonly textureFamily: ActorTextureFamily;
}

export interface ActorAnimationOptions {
  readonly direction?: -1 | 1;
  readonly persistent?: boolean;
  readonly frameIndex?: number;
  readonly restorePosition?: boolean;
  readonly onComplete?: () => void;
}

export class ActorAnimationDirector {
  private readonly actors = new Map<string, ActorRecord>();
  private isCleaningUp = false;
  private lastEvent = "idle";

  public constructor(private readonly scene: Phaser.Scene) {}

  public bind(binding: ActorAnimationBinding): void {
    this.unbind(binding.id);
    const record: ActorRecord = {
      id: binding.id,
      role: binding.role,
      textureFamilyId: binding.textureFamily.id,
      target: binding.target,
      textureFamily: binding.textureFamily,
      snapshot: captureSnapshot(binding.target),
      currentState: "idle",
    };
    this.actors.set(binding.id, record);
    this.applyTexture(record, "idle", 0);
    this.startIdle(record);
  }

  public unbind(actorId: string): void {
    const record = this.actors.get(actorId);
    if (!record) return;
    this.stopActor(record, false);
    this.actors.delete(actorId);
  }

  public has(actorId: string): boolean {
    return this.actors.has(actorId);
  }

  public get state(): string {
    return this.lastEvent;
  }

  public isAnimating(actorId: string): boolean {
    return this.actors.get(actorId)?.active?.lifecycle.status === "pending";
  }

  public refreshBase(actorId: string): void {
    const record = this.actors.get(actorId);
    if (!record || this.isAnimating(actorId)) return;
    record.snapshot = captureSnapshot(record.target);
  }

  public play(
    actorId: string,
    state: ActorAnimationState,
    options: ActorAnimationOptions = {},
  ): boolean {
    const record = this.actors.get(actorId);
    if (!record || !record.target.active) {
      options.onComplete?.();
      return false;
    }
    if (record.currentState === "faint" && state !== "faint") {
      options.onComplete?.();
      return false;
    }

    this.stopActor(record, true);
    this.stopIdle(record);
    restoreSnapshot(record.target, record.snapshot);
    record.currentState = state;
    this.lastEvent = `${actorId}:${state}`;
    this.applyTexture(record, state, options.frameIndex ?? 0);

    const timing = resolveAnimationTiming(state, isReducedMotionEnabled());
    const persistent = options.persistent === true
      || state === "faint"
      || state === "defend";
    const restorePosition = options.restorePosition !== false;
    const active: ActiveActorAnimation = {
      lifecycle: new OncePresentation({
        onComplete: () => options.onComplete?.(),
        cleanup: () => {
          for (const tween of active.tweens.splice(0)) {
            tween.stop();
            tween.remove();
          }
          for (const timer of active.timers.splice(0)) {
            timer.remove(false);
          }
          record.active = undefined;
          if (!persistent && !this.isCleaningUp && record.target.active) {
            if (restorePosition) {
              restoreSnapshot(record.target, record.snapshot);
            } else {
              restorePresentationSnapshot(record.target, record.snapshot);
              record.snapshot = captureSnapshot(record.target);
            }
            record.currentState = "idle";
            this.applyTexture(record, "idle", 0);
            this.startIdle(record);
          }
        },
      }),
      tweens: [],
      timers: [],
    };
    record.active = active;

    if (timing.immediate) {
      this.applyImmediatePose(record, state, options.direction ?? 1, persistent);
      active.lifecycle.complete();
      return true;
    }

    const tween = this.createStateTween(
      record,
      state,
      timing.durationMs,
      options.direction ?? 1,
      persistent,
      () => {
        if (timing.holdMs > 0) {
          active.timers.push(this.scene.time.delayedCall(
            timing.holdMs,
            () => active.lifecycle.complete(),
          ));
        } else {
          active.lifecycle.complete();
        }
      },
    );
    if (tween) active.tweens.push(tween);
    else active.lifecycle.complete();

    active.timers.push(this.scene.time.delayedCall(
      timing.totalMs + 120,
      () => active.lifecycle.complete(),
    ));
    return true;
  }

  public setPersistentState(
    actorId: string,
    state: "idle" | "defend" | "faint",
  ): void {
    const record = this.actors.get(actorId);
    if (!record || !record.target.active) return;
    if (state === "idle") {
      if (this.isAnimating(actorId)) return;
      this.stopActor(record, true);
      restoreSnapshot(record.target, record.snapshot);
      record.currentState = "idle";
      this.applyTexture(record, "idle", 0);
      this.startIdle(record);
      return;
    }
    if (record.currentState === state) return;
    this.play(actorId, state, { persistent: true });
  }

  public cleanup(): void {
    this.isCleaningUp = true;
    for (const record of this.actors.values()) {
      this.stopActor(record, false);
      this.stopIdle(record);
    }
    this.actors.clear();
    this.isCleaningUp = false;
    this.lastEvent = "clean";
  }

  private createStateTween(
    record: ActorRecord,
    state: ActorAnimationState,
    durationMs: number,
    direction: -1 | 1,
    persistent: boolean,
    onComplete: () => void,
  ): Phaser.Tweens.Tween | null {
    const target = record.target;
    const halfDuration = Math.max(1, Math.round(durationMs / 2));
    const common = {
      targets: target,
      ease: "Sine.InOut",
      onComplete,
    };

    switch (state) {
      case "idle":
        return null;
      case "walk":
        return this.scene.tweens.add({
          ...common,
          scaleY: record.snapshot.scaleY * 0.9,
          angle: 2 * direction,
          duration: halfDuration,
          yoyo: true,
        });
      case "attack":
        return this.scene.tweens.add({
          ...common,
          x: record.snapshot.x + 18 * direction,
          scaleX: record.snapshot.scaleX * 1.08,
          duration: halfDuration,
          yoyo: true,
        });
      case "cast":
        return this.scene.tweens.add({
          ...common,
          y: record.snapshot.y - 7,
          scaleX: record.snapshot.scaleX * 1.08,
          scaleY: record.snapshot.scaleY * 1.08,
          angle: -3 * direction,
          duration: halfDuration,
          yoyo: true,
        });
      case "ability":
        return this.scene.tweens.add({
          ...common,
          y: record.snapshot.y - 5,
          angle: 8 * direction,
          scaleX: record.snapshot.scaleX * 1.1,
          scaleY: record.snapshot.scaleY * 0.92,
          duration: halfDuration,
          yoyo: true,
        });
      case "item":
        return this.scene.tweens.add({
          ...common,
          y: record.snapshot.y - 10,
          scaleX: record.snapshot.scaleX * 1.05,
          scaleY: record.snapshot.scaleY * 1.05,
          duration: halfDuration,
          yoyo: true,
        });
      case "defend":
        return this.scene.tweens.add({
          ...common,
          scaleX: record.snapshot.scaleX * 1.1,
          scaleY: record.snapshot.scaleY * 0.9,
          duration: persistent ? durationMs : halfDuration,
          yoyo: !persistent,
        });
      case "damage":
        return this.scene.tweens.add({
          ...common,
          x: record.snapshot.x - 7 * direction,
          angle: -6 * direction,
          duration: Math.max(1, Math.round(durationMs / 6)),
          repeat: 2,
          yoyo: true,
        });
      case "victory":
        return this.scene.tweens.add({
          ...common,
          y: record.snapshot.y - 14,
          angle: 4 * direction,
          duration: halfDuration,
          yoyo: true,
        });
      case "faint":
        return this.scene.tweens.add({
          ...common,
          y: record.snapshot.y + 12,
          angle: 88 * direction,
          alpha: 0.28,
          duration: durationMs,
          ease: "Quad.In",
        });
      case "flee":
        return this.scene.tweens.add({
          ...common,
          x: record.snapshot.x - 70 * direction,
          alpha: persistent ? 0 : 0.45,
          duration: durationMs,
          ease: "Quad.In",
          yoyo: !persistent,
        });
    }
  }

  private applyImmediatePose(
    record: ActorRecord,
    state: ActorAnimationState,
    direction: -1 | 1,
    persistent: boolean,
  ): void {
    if (state === "faint") {
      record.target
        .setAngle(88 * direction)
        .setAlpha(0.35)
        .setY(record.snapshot.y + 8);
    } else if (state === "defend") {
      record.target.setScale(
        record.snapshot.scaleX * 1.08,
        record.snapshot.scaleY * 0.92,
      );
    } else if (state === "flee" && persistent) {
      record.target.setAlpha(0);
    }
  }

  private applyTexture(
    record: ActorRecord,
    state: ActorAnimationState,
    frameIndex: number,
  ): void {
    if (!(record.target instanceof Phaser.GameObjects.Sprite)) return;
    const resolution = resolveActorTextureFrame(
      record.textureFamily,
      state,
      frameIndex,
      (textureKey) => this.scene.textures.exists(textureKey),
    );
    if (resolution.textureKey) {
      record.target.setTexture(resolution.textureKey);
    }
  }

  private startIdle(record: ActorRecord): void {
    this.stopIdle(record);
    if (isReducedMotionEnabled() || !record.target.active) return;
    const timing = resolveAnimationTiming("idle", false);
    record.idleTween = this.scene.tweens.add({
      targets: record.target,
      y: record.snapshot.y - (record.role === "boss" ? 3 : 2),
      duration: timing.durationMs,
      ease: "Sine.InOut",
      yoyo: true,
      repeat: -1,
    });
  }

  private stopActor(record: ActorRecord, restore: boolean): void {
    record.active?.lifecycle.cancel();
    record.active = undefined;
    if (restore && record.target.active) {
      restoreSnapshot(record.target, record.snapshot);
    }
  }

  private stopIdle(record: ActorRecord): void {
    record.idleTween?.stop();
    record.idleTween?.remove();
    record.idleTween = undefined;
  }
}

function captureSnapshot(target: AnimationTarget): ActorSnapshot {
  return {
    x: target.x,
    y: target.y,
    scaleX: target.scaleX,
    scaleY: target.scaleY,
    alpha: target.alpha,
    angle: target.angle,
    visible: target.visible,
  };
}

function restoreSnapshot(
  target: AnimationTarget,
  snapshot: ActorSnapshot,
): void {
  target
    .setPosition(snapshot.x, snapshot.y)
    .setScale(snapshot.scaleX, snapshot.scaleY)
    .setAlpha(snapshot.alpha)
    .setAngle(snapshot.angle)
    .setVisible(snapshot.visible);
}

function restorePresentationSnapshot(
  target: AnimationTarget,
  snapshot: ActorSnapshot,
): void {
  target
    .setScale(snapshot.scaleX, snapshot.scaleY)
    .setAlpha(snapshot.alpha)
    .setAngle(snapshot.angle)
    .setVisible(snapshot.visible);
}
