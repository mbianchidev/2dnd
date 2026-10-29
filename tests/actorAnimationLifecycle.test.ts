import * as Phaser from "phaser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActorAnimationDirector } from "../src/managers/actorAnimation";
import { WorldPresentationDirector } from "../src/managers/worldPresentation";
import { gamePreferences } from "../src/systems/accessibility";

const harness = vi.hoisted(() => {
  interface TweenOptions {
    targets: object;
    y?: number;
    scaleY?: number;
    repeat?: number;
    onComplete?: () => void;
  }
  class Tween {
    stopped = false;
    removed = false;
    constructor(readonly options: TweenOptions) {}
    stop(): this { this.stopped = true; return this; }
    remove(): this { this.removed = true; return this; }
  }
  class Timer {
    removed = false;
    constructor(readonly callback: () => void) {}
    remove(_dispatch: boolean): void { this.removed = true; }
  }
  class Sprite {
    active = true;
    x = 16;
    y = 16;
    scaleX = 1;
    scaleY = 1;
    alpha = 1;
    angle = 0;
    visible = true;
    texture = { key: "hero-front" };
    setPosition(x: number, y: number): this { this.x = x; this.y = y; return this; }
    setScale(x: number, y = x): this { this.scaleX = x; this.scaleY = y; return this; }
    setAlpha(alpha: number): this { this.alpha = alpha; return this; }
    setAngle(angle: number): this { this.angle = angle; return this; }
    setVisible(visible: boolean): this { this.visible = visible; return this; }
    setY(y: number): this { this.y = y; return this; }
    setTexture(key: string): this { this.texture.key = key; return this; }
  }
  class Scene {
    readonly createdTweens: Tween[] = [];
    readonly timers: Timer[] = [];
    readonly textures = { exists: (_key: string) => true };
    readonly tweens = {
      add: (options: TweenOptions): Tween => {
        const tween = new Tween(options);
        this.createdTweens.push(tween);
        return tween;
      },
    };
    readonly time = {
      delayedCall: (_duration: number, callback: () => void): Timer => {
        const timer = new Timer(callback);
        this.timers.push(timer);
        return timer;
      },
    };
  }
  return { Sprite, Scene };
});

vi.mock("phaser", () => ({
  GameObjects: { Sprite: harness.Sprite },
  Scene: harness.Scene,
}));

beforeEach(() => {
  gamePreferences.setReducedMotion(false);
});

function createActor(): {
  director: ActorAnimationDirector;
  scene: InstanceType<typeof harness.Scene>;
  sprite: InstanceType<typeof harness.Sprite>;
} {
  const scene = Object.assign(new Phaser.Scene(), new harness.Scene());
  const sprite = Object.assign(new Phaser.GameObjects.Sprite(scene, 16, 16, "hero-front"), new harness.Sprite());
  const director = new ActorAnimationDirector(scene);
  director.bind({
    id: "hero",
    role: "hero",
    target: sprite,
    textureFamily: { id: "hero", role: "hero", fallbackTextureKey: "hero-front", frames: {} },
  });
  return { director, scene, sprite };
}

describe("actor presentation ownership", () => {
  it("removes idle tweens when unbinding an actor", () => {
    const { director, scene } = createActor();
    director.unbind("hero");
    expect(scene.createdTweens.every((tween) => tween.stopped && tween.removed)).toBe(true);
    director.cleanup();
  });

  it("does not recreate an unchanged idle animation on each state reconciliation", () => {
    const { director, scene } = createActor();
    director.setPersistentState("hero", "idle");
    director.setPersistentState("hero", "idle");
    expect(scene.createdTweens).toHaveLength(1);
    director.cleanup();
  });

  it("settles an active action immediately when reduced motion changes live", () => {
    const { director, scene } = createActor();
    const onComplete = vi.fn();
    director.play("hero", "attack", { onComplete });
    gamePreferences.setReducedMotion(true);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(director.isBusy).toBe(false);
    expect(scene.createdTweens.every((tween) => tween.stopped && tween.removed)).toBe(true);
    for (const timer of scene.timers) timer.callback();
    expect(onComplete).toHaveBeenCalledTimes(1);
    director.cleanup();
  });

  it("keeps external movement and facing authoritative during interrupted walking", () => {
    const scene = Object.assign(new Phaser.Scene(), new harness.Scene());
    const sprite = Object.assign(new Phaser.GameObjects.Sprite(scene, 16, 16, "hero-front"), new harness.Sprite());
    const world = new WorldPresentationDirector(scene);
    world.bindPlayer(sprite, "knight");
    sprite.setTexture("hero-back");
    world.presentPlayerStep(1);
    sprite.setPosition(48, 80);
    world.completePlayerStep();
    world.presentPlayerStep(1);
    expect({ x: sprite.x, y: sprite.y, texture: sprite.texture.key })
      .toEqual({ x: 48, y: 80, texture: "hero-back" });
    const idle = scene.createdTweens.filter((tween) => tween.options.repeat === -1);
    expect(idle.every((tween) => tween.options.y === undefined)).toBe(true);
    world.cleanup();
  });

  it("never revives idle motion after cancellation or scene cleanup", () => {
    const { director, scene } = createActor();
    const onComplete = vi.fn();
    director.play("hero", "attack", { onComplete });
    director.unbind("hero");
    const timerCount = scene.timers.length;
    scene.createdTweens[1]!.options.onComplete!();
    expect(scene.timers).toHaveLength(timerCount);
    for (const timer of scene.timers) timer.callback();
    expect(onComplete).not.toHaveBeenCalled();
    expect(scene.createdTweens.every((tween) => tween.stopped && tween.removed)).toBe(true);
    director.cleanup();
    const count = scene.createdTweens.length;
    gamePreferences.setReducedMotion(true);
    gamePreferences.setReducedMotion(false);
    expect(scene.createdTweens).toHaveLength(count);
  });

  it("preserves a replacement action started by the previous completion callback", () => {
    const { director, scene } = createActor();
    const complete = vi.fn(() => director.play("hero", "cast"));
    director.play("hero", "attack", { onComplete: complete });
    scene.createdTweens[1]!.options.onComplete!();
    scene.timers[1]!.callback();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(director.isBusy).toBe(true);
    expect(director.state).toBe("hero:cast");
    scene.timers[0]!.callback();
    expect(director.isBusy).toBe(true);
    director.cleanup();
  });
});
