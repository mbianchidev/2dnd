import * as Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { audioEngine } from "../systems/audio";

import type {
  CutsceneActorCue,
  CutsceneBackdrop,
  CutsceneCameraCue,
  CutsceneEffect,
  CutscenePresentation,
  CutsceneStep,
} from "../data/cutscenes";
import type { CutscenePresentationAdapter } from "../managers/cutscene";
import type { PlayerState } from "../systems/player";
import { getAccessibilityPreferences } from "../systems/accessibility";
import { createActorTextureFamily } from "./actorTextures";
import { ActorAnimationDirector } from "../managers/actorAnimation";
import {
  describeHeroVisual,
  resolveHeroVisualDescriptor,
  type HeroFacing,
  type HeroVisualDescriptor,
} from "../systems/heroVisuals";
import {
  acquireHeroTexture,
  type HeroTextureLease,
} from "./heroTextures";

interface RenderedActor {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.GameObject;
  label: Phaser.GameObjects.Text;
  textureKey: string;
  heroSprite?: Phaser.GameObjects.Sprite;
  heroTextureLease?: HeroTextureLease;
}

const ACTOR_X: Record<CutsceneActorCue["slot"], number> = {
  farLeft: 70,
  left: 180,
  center: 320,
  right: 460,
  farRight: 570,
};

const BACKDROP_COLORS: Record<CutsceneBackdrop, number> = {
  heartlands: 0x314735,
  stars: 0x0b1026,
  forest: 0x17382b,
  city: 0x343447,
  canyon: 0x5e3c2c,
  desert: 0x6b4a28,
  marsh: 0x243d36,
  frost: 0x273e5c,
  mountain: 0x3a3540,
  crypt: 0x1d2028,
  forge: 0x3e241e,
};

function actorColor(id: string): number {
  let hash = 0;
  for (const char of id) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  const colors = [0x6b8bc4, 0xc4875d, 0x7eb07a, 0xa884c3, 0xd1b65c];
  return colors[Math.abs(hash) % colors.length];
}

function displayName(actor: CutsceneActorCue, player: PlayerState): string {
  return actor.label.replace("{hero}", player.name);
}

export class CutsceneRenderer implements CutscenePresentationAdapter {
  private readonly root: Phaser.GameObjects.Container;
  private readonly worldRoot: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly effects: Phaser.GameObjects.Container;
  private readonly actorsLayer: Phaser.GameObjects.Container;
  private readonly textLayer: Phaser.GameObjects.Container;
  private readonly fade: Phaser.GameObjects.Rectangle;
  private readonly actors = new Map<string, RenderedActor>();
  private readonly actorAnimations: ActorAnimationDirector;
  private readonly pendingEntranceIds = new Set<string>();
  private readonly timers: Phaser.Time.TimerEvent[] = [];
  private readonly tweens: Phaser.Tweens.Tween[] = [];
  private currentBackdrop: CutsceneBackdrop | null = null;
  private lastEvent = "idle";
  private heroInspection = "";
  private readonly heroDescriptor: HeroVisualDescriptor;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: PlayerState,
    heroDescriptor?: HeroVisualDescriptor,
  ) {
    this.heroDescriptor = heroDescriptor ?? resolveHeroVisualDescriptor(player);
    this.background = scene.add.graphics();
    this.effects = scene.add.container(0, 0);
    this.actorsLayer = scene.add.container(0, 0);
    this.textLayer = scene.add.container(0, 0);
    this.fade = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000)
      .setOrigin(0)
      .setAlpha(0);
    this.worldRoot = scene.add.container(0, 0, [
      this.background,
      this.effects,
      this.actorsLayer,
    ]);
    this.root = scene.add.container(0, 0, [
      this.worldRoot,
      this.textLayer,
      this.fade,
    ]).setDepth(100);
    this.actorAnimations = new ActorAnimationDirector(scene);
  }

  get debugState(): string {
    return this.lastEvent === "idle"
      ? this.actorAnimations.state
      : this.lastEvent;
  }

  get heroInspectionReport(): string {
    return this.heroInspection;
  }

  present(step: CutsceneStep, index: number, onReady: () => void): void {
    this.clearTransientPresentation();
    const presentation: CutscenePresentation = step.presentation ?? {
      backdrop: "stars",
      actors: [],
      camera: { focus: "center" },
      effect: "none",
    };
    this.drawBackdrop(presentation.backdrop);
    const effect = presentation.effect ?? "none";
    this.lastEvent = `step-${index}:${effect}`
      + ((presentation.actors ?? []).some(isBossPlacement) ? ":boss" : "")
      + (getAccessibilityPreferences().reducedMotion ? ":immediate" : "");
    this.syncActors(presentation.actors ?? [], effect);
    this.applyCamera(presentation.camera ?? { focus: "center" });
    this.applyEffect(effect);
    this.presentActorStates(presentation.actors ?? [], effect);
    this.drawText(step);
    if (presentation.audioCue) {
      audioEngine.playCutsceneCue(presentation.audioCue);
    }

    const transitionMs = getAccessibilityPreferences().reducedMotion ? 0 : 260;
    if (transitionMs > 0) {
      this.fade.setAlpha(0.75);
      this.trackTween(this.scene.tweens.add({
        targets: this.fade,
        alpha: 0,
        duration: transitionMs,
      }));
    } else {
      this.fade.setAlpha(0);
    }
    this.trackTimer(this.scene.time.delayedCall(transitionMs, onReady));
  }

  reset(): void {
    this.clearTransientPresentation();
    this.actorAnimations.cleanup();
    this.worldRoot.setPosition(0, 0).setScale(1);
  }

  cleanup(): void {
    this.clearTransientPresentation();
    this.root.destroy(true);
    for (const actor of this.actors.values()) {
      actor.heroTextureLease?.release();
    }
    this.actors.clear();
  }

  private clearTransientPresentation(): void {
    for (const timer of this.timers.splice(0)) {
      timer.remove(false);
    }
    for (const tween of this.tweens.splice(0)) {
      tween.stop();
      tween.remove();
    }
    this.pendingEntranceIds.clear();
    this.effects.removeAll(true);
    this.textLayer.removeAll(true);
  }

  private trackTimer(timer: Phaser.Time.TimerEvent): void {
    this.timers.push(timer);
  }

  private trackTween(tween: Phaser.Tweens.Tween): void {
    this.tweens.push(tween);
  }

  private drawBackdrop(backdrop: CutsceneBackdrop): void {
    if (backdrop === this.currentBackdrop) {
      return;
    }
    this.currentBackdrop = backdrop;
    const color = BACKDROP_COLORS[backdrop];
    this.background.clear();
    this.background.fillStyle(color, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.background.fillStyle(0x000000, 0.18)
      .fillRect(0, GAME_HEIGHT * 0.58, GAME_WIDTH, GAME_HEIGHT * 0.42);

    if (backdrop === "stars") {
      this.background.fillStyle(0xf5edc8, 0.8);
      for (let index = 0; index < 36; index += 1) {
        const x = (index * 83 + 29) % GAME_WIDTH;
        const y = (index * 47 + 17) % 235;
        this.background.fillCircle(x, y, index % 5 === 0 ? 2 : 1);
      }
    } else if (["forest", "marsh", "heartlands"].includes(backdrop)) {
      this.background.fillStyle(0x101c18, 1);
      for (let x = 0; x < GAME_WIDTH; x += 52) {
        this.background.fillTriangle(x, 270, x + 26, 145, x + 52, 270);
      }
    } else if (backdrop === "city") {
      this.background.fillStyle(0x191923, 1);
      for (let x = 0; x < GAME_WIDTH; x += 88) {
        const height = 55 + (x % 3) * 18;
        this.background.fillRect(x, 270 - height, 70, height);
      }
    } else if (["mountain", "frost", "canyon"].includes(backdrop)) {
      this.background.fillStyle(0x17171e, 0.9);
      this.background.fillTriangle(0, 285, 190, 85, 360, 285);
      this.background.fillTriangle(230, 285, 455, 55, 640, 285);
    } else if (["crypt", "forge"].includes(backdrop)) {
      this.background.fillStyle(0x0e0f13, 0.8);
      for (let x = 42; x < GAME_WIDTH; x += 110) {
        this.background.fillRect(x, 110, 32, 175);
        this.background.fillCircle(x + 16, 110, 16);
      }
    } else {
      this.background.fillStyle(0x241b16, 0.45);
      this.background.fillCircle(90, 70, 42);
      this.background.fillCircle(530, 78, 34);
    }
  }

  private syncActors(
    placements: readonly CutsceneActorCue[],
    effect: CutsceneEffect,
  ): void {
    const activeIds = new Set(placements.map((placement) => placement.id));
    for (const [id, actor] of this.actors) {
      if (!activeIds.has(id)) {
        this.actorAnimations.unbind(id);
        actor.container.destroy(true);
        actor.heroTextureLease?.release();
        this.actors.delete(id);
      }
    }

    for (const placement of placements) {
      const existingActor = this.actors.get(placement.id);
      const actor = existingActor ?? this.createActor(placement);
      const targetX = ACTOR_X[placement.slot];
      const targetY = 292;
      actor.label.setText(displayName(placement, this.player));
      this.updateActorVisual(placement, actor);
      actor.container.setAlpha(1).setScale(placement.scale ?? 1);
      if (!existingActor) {
        actor.container.setPosition(targetX, targetY);
        this.bindActorAnimation(placement, actor);
      }
      const entranceX = placement.entrance === "left"
        ? -100
        : placement.entrance === "right"
          ? GAME_WIDTH + 100
          : targetX;
      if (
        !existingActor
        && !getAccessibilityPreferences().reducedMotion
        && placement.entrance
      ) {
        this.pendingEntranceIds.add(placement.id);
        actor.container.setPosition(entranceX, targetY).setAlpha(0);
        this.trackTween(this.scene.tweens.add({
          targets: actor.container,
          x: targetX,
          alpha: 1,
          duration: 320,
          ease: "Sine.Out",
          onComplete: () => {
            this.pendingEntranceIds.delete(placement.id);
            actor.container.setPosition(targetX, targetY).setAlpha(1);
            this.actorAnimations.refreshBase(placement.id);
            this.presentActorState(placement, effect);
          },
        }));
      } else {
        actor.container.setPosition(targetX, targetY);
      }
      if (existingActor) this.actorAnimations.refreshBase(placement.id);
      if (isBossPlacement(placement)) {
        this.drawBossPresence(placement, targetX, targetY);
      }
    }
  }

  private createActor(placement: CutsceneActorCue): RenderedActor {
    const heroFacing = getHeroFacing(placement);
    const heroTextureLease = placement.role === "hero"
      ? acquireHeroTexture(
        this.scene,
        this.heroDescriptor,
        heroFacing,
        "standard",
        getAccessibilityPreferences().highContrast,
      )
      : undefined;
    const heroSprite = heroTextureLease
      ? this.scene.add.sprite(0, 12, heroTextureLease.key)
        .setOrigin(0.5, 1)
        .setScale(3)
      : undefined;
    const body = heroSprite ?? this.createGenericActorBody(placement);
    const label = this.scene.add.text(0, 20, "", {
      fontSize: "12px",
      color: "#ffffff",
      backgroundColor: "#000000aa",
      padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 0);
    const container = this.scene.add.container(0, 0, [body, label]);
    this.actorsLayer.add(container);
    const rendered: RenderedActor = {
      container,
      body,
      label,
      textureKey: heroTextureLease?.key ?? `cutscene.actor.${placement.id}`,
      heroSprite,
      heroTextureLease,
    };
    this.actors.set(placement.id, rendered);
    this.updateActorVisual(placement, rendered);
    return rendered;
  }

  private createGenericActorBody(
    placement: CutsceneActorCue,
  ): Phaser.GameObjects.Graphics {
    const body = this.scene.add.graphics();
    const color = placement.role === "hero"
      ? actorColor(placement.id)
      : placement.color;
    body.fillStyle(color, 1);
    body.fillCircle(0, -86, 21);
    body.fillRoundedRect(-30, -64, 60, 76, 12);
    body.fillStyle(0xe6d2b5, 1);
    body.fillCircle(-7, -90, 3);
    body.fillCircle(7, -90, 3);
    return body;
  }

  private updateActorVisual(
    placement: CutsceneActorCue,
    actor: RenderedActor,
  ): void {
    if (placement.role !== "hero" || !actor.heroSprite) return;
    const facing = getHeroFacing(placement);
    const nextLease = acquireHeroTexture(
      this.scene,
      this.heroDescriptor,
      facing,
      "standard",
      getAccessibilityPreferences().highContrast,
    );
    actor.heroSprite.setTexture(nextLease.key);
    actor.heroSprite.setFlipX(
      facing === "side"
      && (placement.slot === "right" || placement.slot === "farRight"),
    );
    actor.heroTextureLease?.release();
    actor.heroTextureLease = nextLease;
    actor.textureKey = nextLease.key;
    const fallbacks = this.heroDescriptor.equipmentLayers
      .filter((layer) => layer.fallbackUsed)
      .map((layer) => `${layer.slot}:${layer.itemId}`)
      .join(",") || "none";
    this.heroInspection = `actor=${placement.id}`
      + ` descriptor=${describeHeroVisual(this.heroDescriptor)}`
      + ` texture=${nextLease.key}`
      + ` fallback=${fallbacks}`;
  }

  private bindActorAnimation(
    placement: CutsceneActorCue,
    actor: RenderedActor,
  ): void {
    const role = isBossPlacement(placement) ? "boss" : "cutscene";
    this.actorAnimations.bind({
      id: placement.id,
      role,
      target: actor.container,
      textureFamily: createActorTextureFamily({
        id: `cutscene.${placement.id}`,
        role,
        fallbackTextureKey: actor.textureKey,
        framePrefix: `cutscene_${placement.id}`,
      }),
    });
  }

  private presentActorStates(
    placements: readonly CutsceneActorCue[],
    effect: CutsceneEffect,
  ): void {
    for (const placement of placements) {
      if (this.pendingEntranceIds.has(placement.id)) continue;
      this.presentActorState(placement, effect);
    }
  }

  private presentActorState(
    placement: CutsceneActorCue,
    effect: CutsceneEffect,
  ): void {
    if (!this.actors.has(placement.id)) return;
    const state = effect === "shake"
      ? "ability"
      : effect === "flash" || effect === "runes"
        ? "cast"
        : isBossPlacement(placement)
          ? "attack"
          : "idle";
    if (state === "idle") return;
    const started = this.actorAnimations.play(placement.id, state, {
      direction: placement.slot === "farLeft" || placement.slot === "left"
        ? 1
        : -1,
    });
    if (started) this.lastEvent += `:${placement.id}:${state}`;
  }

  private drawBossPresence(
    placement: CutsceneActorCue,
    x: number,
    y: number,
  ): void {
    const ring = this.scene.add.circle(
      x,
      y - 54,
      46 * (placement.scale ?? 1),
      0x000000,
      0,
    ).setStrokeStyle(3, 0xffcf5a, 0.8);
    const label = this.scene.add.text(x, y - 132, "BOSS", {
      fontSize: "11px",
      color: "#ffffff",
      backgroundColor: "#5b1010",
      fontStyle: "bold",
      padding: { x: 5, y: 2 },
    }).setOrigin(0.5);
    this.effects.add([ring, label]);
    if (!getAccessibilityPreferences().reducedMotion) {
      this.trackTween(this.scene.tweens.add({
        targets: ring,
        scale: 1.12,
        alpha: 0.35,
        duration: 520,
        yoyo: true,
        repeat: -1,
      }));
    }
  }

  private applyCamera(camera: CutsceneCameraCue): void {
    if (getAccessibilityPreferences().reducedMotion) {
      this.worldRoot.setPosition(0, 0).setScale(1);
      return;
    }
    const targetX = GAME_WIDTH / 2 - ACTOR_X[camera.focus];
    this.trackTween(this.scene.tweens.add({
      targets: this.worldRoot,
      x: targetX,
      scale: camera.zoom ?? 1,
      duration: camera.durationMs ?? 280,
      ease: "Sine.InOut",
    }));
  }

  private applyEffect(effect: CutsceneEffect): void {
    if (effect === "none" || getAccessibilityPreferences().reducedMotion) {
      return;
    }
    if (effect === "shake") {
      this.trackTween(this.scene.tweens.add({
        targets: this.worldRoot,
        x: { from: -4, to: 4 },
        y: { from: 2, to: -2 },
        duration: 45,
        repeat: 5,
        yoyo: true,
        onComplete: () => this.worldRoot.setPosition(0, 0),
      }));
      return;
    }
    if (effect === "flash") {
      const flash = this.scene.add.rectangle(
        0,
        0,
        GAME_WIDTH,
        GAME_HEIGHT,
        0xffffff,
      ).setOrigin(0).setAlpha(0.65);
      this.effects.add(flash);
      this.trackTween(this.scene.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 450,
      }));
      return;
    }
    const color = effect === "embers"
      ? 0xff7335
      : effect === "snow"
        ? 0xeaf7ff
        : effect === "mist"
          ? 0x80ba55
          : effect === "runes"
            ? 0x74b8ff
            : effect === "leaves"
              ? 0x79b45b
              : effect === "sand"
                ? 0xd6b36a
                : 0xb69cff;
    for (let index = 0; index < 24; index += 1) {
      const particle = this.scene.add.circle(
        (index * 71 + 20) % GAME_WIDTH,
        (index * 43 + 15) % 280,
        effect === "snow" ? 2 : 3,
        color,
        0.7,
      );
      this.effects.add(particle);
      this.trackTween(this.scene.tweens.add({
        targets: particle,
        y: particle.y + (effect === "embers" ? -70 : 70),
        alpha: 0,
        duration: 900 + index * 18,
      }));
    }
  }

  private drawText(step: CutsceneStep): void {
    const preferences = getAccessibilityPreferences();
    const speaker = step.type === "dialogue"
      ? step.speaker
      : step.type === "narration"
        ? step.heading
        : step.type === "summary"
          ? step.heading
          : "Credits";
    const text = (step.type === "credits"
      ? step.lines.join("\n")
      : step.type === "summary"
        ? step.heading
        : step.text).split("{hero}").join(this.player.name);
    const panel = this.scene.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT - 76,
      GAME_WIDTH - 36,
      132,
      0x080a10,
      0.92,
    ).setStrokeStyle(2, 0xc9a84c);
    this.textLayer.add(panel);
    if (speaker) {
      const speakerText = this.scene.add.text(38, GAME_HEIGHT - 134, speaker, {
        fontSize: "15px",
        color: "#ffdd66",
        fontStyle: "bold",
      });
      this.textLayer.add(speakerText);
    }
    const body = this.scene.add.text(38, GAME_HEIGHT - 108, text, {
      fontSize: "14px",
      color: "#f4f1e8",
      wordWrap: { width: GAME_WIDTH - 76 },
      lineSpacing: 4,
    });
    this.textLayer.add(body);
    const hint = this.scene.add.text(
      GAME_WIDTH - 38,
      GAME_HEIGHT - 24,
      preferences.advanceMode === "automatic"
        ? "Automatic  |  Esc skip"
        : "Space / Enter / click  |  Esc skip",
      {
        fontSize: "10px",
        color: "#a9adba",
      },
    ).setOrigin(1, 0.5);
    this.textLayer.add(hint);
  }
}

function isBossPlacement(placement: CutsceneActorCue): boolean {
  return placement.role === "boss";
}

function getHeroFacing(placement: CutsceneActorCue): HeroFacing {
  return placement.slot === "center" ? "front" : "side";
}
