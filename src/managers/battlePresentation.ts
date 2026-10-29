import * as Phaser from "phaser";
import { audioEngine } from "../systems/audio";
import {
  selectActorAnimationState,
  type ActorAnimationRole,
  type ActorTextureFamily,
  type PresentationActionKind,
} from "../systems/animation";
import {
  getAccessibilityPreferences,
  isReducedMotionEnabled,
} from "../systems/accessibility";
import type {
  BattleCombatantState,
  BattleCombatantId,
} from "../systems/groupCombat";
import {
  ActorAnimationDirector,
  type ActorAnimationBinding,
} from "./actorAnimation";
import { BATTLE_DEPTH } from "../renderers/battleDepth";
import { BattleImpactRenderer } from "../renderers/battleEffects";
import type { BattleImpactKind } from "../systems/battleEffects";

export interface BattlePresentationTarget {
  readonly targetId: BattleCombatantId;
  readonly hit: boolean;
  readonly damage: number;
  readonly healing: number;
}

export interface BattleActionPresentation {
  readonly actorId: BattleCombatantId;
  readonly kind: PresentationActionKind;
  readonly targets: readonly BattlePresentationTarget[];
  readonly critical?: boolean;
  readonly successful?: boolean;
}

export interface BattleActorPresentationBinding {
  readonly id: BattleCombatantId;
  readonly role: ActorAnimationRole;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly textureFamily: ActorTextureFamily;
}

export class BattlePresentationDirector {
  private readonly actors: ActorAnimationDirector;
  private readonly impacts: BattleImpactRenderer;
  private readonly roles = new Map<BattleCombatantId, ActorAnimationRole>();
  private readonly sprites = new Map<
    BattleCombatantId,
    Phaser.GameObjects.Sprite
  >();
  private readonly transientObjects = new Set<Phaser.GameObjects.GameObject>();
  private readonly transientTweens = new Set<Phaser.Tweens.Tween>();
  private readonly transientTimers = new Set<Phaser.Time.TimerEvent>();
  private readonly faintedActors = new Set<BattleCombatantId>();
  private readonly eventHistory: string[] = [];
  private lastEvent = "idle";

  public constructor(private readonly scene: Phaser.Scene) {
    this.actors = new ActorAnimationDirector(scene);
    this.impacts = new BattleImpactRenderer(scene);
  }

  public registerActor(binding: BattleActorPresentationBinding): void {
    const animationBinding: ActorAnimationBinding = {
      id: binding.id,
      role: binding.role,
      target: binding.sprite,
      textureFamily: binding.textureFamily,
    };
    this.roles.set(binding.id, binding.role);
    this.sprites.set(binding.id, binding.sprite);
    this.actors.bind(animationBinding);
  }

  public get debugState(): string {
    if (this.eventHistory.length > 0) {
      return `${this.eventHistory.join(">")} | Impacts: ${this.impacts.activeCount} [${this.impacts.debugState}]`;
    }
    return this.lastEvent === "idle" ? this.actors.state : this.lastEvent;
  }

  public get isBusy(): boolean {
    return this.actors.isBusy
      || (!isReducedMotionEnabled()
        && (this.transientTweens.size > 0 || this.transientTimers.size > 0 || this.impacts.activeCount > 0));
  }

  public presentAction(presentation: BattleActionPresentation): void {
    const role = this.roles.get(presentation.actorId);
    const direction: -1 | 1 = role === "monster" || role === "boss" ? -1 : 1;
    const actorState = selectActorAnimationState({
      alive: true,
      knockedOut: false,
      defending: presentation.kind === "defend",
      moving: false,
      action: presentation.kind,
      outcome: presentation.kind === "flee" && presentation.successful
        ? "flee"
        : "success",
    });
    this.recordEvent(
      `${presentation.actorId}:${actorState}:${presentation.kind}`
      + (isReducedMotionEnabled() ? ":immediate" : ""),
    );
    this.playActionAudio(presentation);
    this.actors.play(presentation.actorId, actorState, {
      direction,
      persistent: presentation.kind === "flee"
        && presentation.successful === true,
    });

    if (presentation.kind === "defend") {
      this.spawnCue(presentation.actorId, "[DEFEND]", 0x80c8ff);
      this.spawnImpact(presentation.actorId, "guard", direction, false);
      return;
    }
    if (presentation.kind === "flee") {
      this.spawnCue(
        presentation.actorId,
        presentation.successful ? "[ESCAPED]" : "[BLOCKED]",
        presentation.successful ? 0x9be38c : 0xffc26b,
      );
      return;
    }

    for (const target of presentation.targets) {
      if (target.damage > 0 && target.hit) {
        this.actors.play(target.targetId, "damage", {
          direction: direction === 1 ? -1 : 1,
        });
        this.spawnCue(
          target.targetId,
          presentation.critical
            ? `[CRIT -${target.damage}]`
            : `[HIT -${target.damage}]`,
          presentation.critical ? 0xffdf5d : 0xff8a80,
        );
      } else if (target.healing > 0) {
        this.spawnCue(target.targetId, `[HEAL +${target.healing}]`, 0x8ff0a4);
      } else if (!target.hit) {
        this.spawnCue(target.targetId, "[MISS]", 0xffffff);
      } else {
        this.spawnCue(target.targetId, "[EFFECT]", 0xb69cff);
      }
      if (target.hit || target.healing > 0) {
        const kind: BattleImpactKind = target.healing > 0 || presentation.kind === "item" ? "heal"
          : presentation.kind === "attack" ? "strike"
            : presentation.kind === "ability" ? "ability" : "spell";
        this.spawnImpact(
          target.targetId, kind, direction, presentation.critical === true && target.damage > 0,
        );
      }
    }
  }

  public presentFaint(actorId: BattleCombatantId, delayMs = 100): void {
    if (this.faintedActors.has(actorId)) return;
    this.faintedActors.add(actorId);
    const timer = this.scene.time.delayedCall(
      isReducedMotionEnabled() ? 0 : delayMs,
      () => {
        this.transientTimers.delete(timer);
        this.recordEvent(
          `${actorId}:faint`
          + (isReducedMotionEnabled() ? ":immediate" : ""),
        );
        this.actors.play(actorId, "faint", {
          direction: this.isEnemy(actorId) ? 1 : -1,
          persistent: true,
        });
        this.spawnCue(actorId, "[FAINT]", 0xd7d7d7);
        if (audioEngine.initialized) audioEngine.playFaintSFX();
      },
    );
    this.transientTimers.add(timer);
  }

  public presentVictory(combatantIds: readonly BattleCombatantId[]): void {
    for (const combatantId of combatantIds) {
      if (this.faintedActors.has(combatantId)) continue;
      this.actors.play(combatantId, "victory", {
        direction: this.isEnemy(combatantId) ? -1 : 1,
      });
    }
    this.recordEvent(`${combatantIds.join(",")}:victory`);
  }

  public syncCombatants(combatants: readonly BattleCombatantState[]): void {
    for (const combatant of combatants) {
      if (!this.actors.has(combatant.id)) continue;
      if (!combatant.isAlive || combatant.isKnockedOut) {
        this.presentFaint(combatant.id, 0);
      } else {
        this.actors.setPersistentState(
          combatant.id,
          combatant.isDefending ? "defend" : "idle",
        );
      }
    }
  }

  public cleanup(): void {
    this.impacts.destroy();
    for (const timer of this.transientTimers) timer.remove(false);
    for (const tween of this.transientTweens) {
      tween.stop();
      tween.remove();
    }
    for (const object of this.transientObjects) object.destroy();
    this.transientTimers.clear();
    this.transientTweens.clear();
    this.transientObjects.clear();
    this.faintedActors.clear();
    this.eventHistory.length = 0;
    this.roles.clear();
    this.sprites.clear();
    this.actors.cleanup();
    this.lastEvent = "clean";
  }

  private spawnCue(
    actorId: BattleCombatantId,
    label: string,
    color: number,
  ): void {
    const sprite = this.getActorSprite(actorId);
    if (!sprite) return;
    const preferences = getAccessibilityPreferences();
    const text = this.scene.add.text(sprite.x, sprite.y - 34, label, {
      fontSize: "10px",
      fontFamily: "monospace",
      fontStyle: "bold",
      color: preferences.highContrast ? "#ffffff" : `#${color.toString(16).padStart(6, "0")}`,
      backgroundColor: preferences.highContrast ? "#000000" : "#080a10cc",
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(BATTLE_DEPTH.actionParticles);
    this.transientObjects.add(text);
    if (isReducedMotionEnabled()) {
      const timer = this.scene.time.delayedCall(260, () => {
        this.transientTimers.delete(timer);
        this.transientObjects.delete(text);
        text.destroy();
      });
      this.transientTimers.add(timer);
      return;
    }
    const tween = this.scene.tweens.add({
      targets: text,
      y: text.y - 18,
      alpha: 0,
      duration: 520,
      onComplete: () => {
        this.transientTweens.delete(tween);
        this.transientObjects.delete(text);
        text.destroy();
      },
    });
    this.transientTweens.add(tween);
  }

  private spawnImpact(
    actorId: BattleCombatantId,
    kind: BattleImpactKind,
    direction: -1 | 1,
    critical: boolean,
  ): void {
    const sprite = this.getActorSprite(actorId);
    if (!sprite) return;
    this.impacts.show(actorId, sprite.x, sprite.y, { kind, direction, critical });
  }

  private playActionAudio(presentation: BattleActionPresentation): void {
    if (!audioEngine.initialized) return;
    if (presentation.kind === "attack") {
      if (presentation.critical) audioEngine.playCriticalHitSFX();
      else if (presentation.targets.some((target) => target.hit)) {
        audioEngine.playAttackSFX();
      } else {
        audioEngine.playMissSFX();
      }
    } else if (presentation.kind === "spell") {
      audioEngine.playSpellSFX();
    } else if (presentation.kind === "ability") {
      audioEngine.playAbilitySFX();
    } else if (presentation.kind === "item") {
      audioEngine.playPotionSFX();
    } else if (presentation.kind === "defend") {
      audioEngine.playDefendSFX();
    } else if (presentation.kind === "flee") {
      audioEngine.playFleeSFX();
    }
  }

  private getActorSprite(
    actorId: BattleCombatantId,
  ): Phaser.GameObjects.Sprite | undefined {
    const sprite = this.sprites.get(actorId);
    return sprite?.active ? sprite : undefined;
  }

  private isEnemy(actorId: BattleCombatantId): boolean {
    const role = this.roles.get(actorId);
    return role === "monster" || role === "boss";
  }

  private recordEvent(event: string): void {
    this.lastEvent = event;
    this.eventHistory.push(event);
    if (this.eventHistory.length > 8) this.eventHistory.shift();
  }
}
