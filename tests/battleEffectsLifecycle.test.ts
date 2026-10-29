import * as Phaser from "phaser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BattleImpactRenderer } from "../src/renderers/battleEffects";
import { gamePreferences } from "../src/systems/accessibility";

const harness = vi.hoisted(() => {
  class Graphics {
    readonly destroy = vi.fn();
    readonly clear = vi.fn((): this => this);
    readonly fillStyle = vi.fn((): this => this);
    setPosition(_x: number, _y: number): this { return this; }
    setDepth(_depth: number): this { return this; }
    setData(_key: string, _value: string): this { return this; }
    fillRect(_x: number, _y: number, _width: number, _height: number): this { return this; }
    lineStyle(_width: number, _color: number, _alpha: number): this { return this; }
    lineBetween(_x1: number, _y1: number, _x2: number, _y2: number): this { return this; }
  }
  interface TweenOptions {
    readonly onUpdate: () => void;
    readonly onComplete: () => void;
  }
  class Tween {
    readonly stop = vi.fn();
    readonly remove = vi.fn();
    constructor(readonly options: TweenOptions) {}
  }
  class Timer {
    readonly remove = vi.fn();
    constructor(readonly callback: () => void) {}
  }
  class Scene {
    readonly graphics: Graphics[] = [];
    readonly animations: Tween[] = [];
    readonly timers: Timer[] = [];
    readonly add = {
      graphics: (): Graphics => {
        const graphics = new Graphics();
        this.graphics.push(graphics);
        return graphics;
      },
    };
    readonly tweens = {
      add: (options: TweenOptions): Tween => {
        const tween = new Tween(options);
        this.animations.push(tween);
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
  return { Scene };
});

vi.mock("phaser", () => ({ Scene: harness.Scene }));

let scene: Phaser.Scene & InstanceType<typeof harness.Scene>;
let renderer: BattleImpactRenderer;
const STRIKE = { kind: "strike", critical: false, direction: 1 } as const;

beforeEach(() => {
  gamePreferences.setReducedMotion(false);
  scene = Object.assign(new Phaser.Scene(), new harness.Scene());
  renderer = new BattleImpactRenderer(scene);
});

afterEach(() => renderer.destroy());

describe("bounded battle impact ownership", () => {
  it("uses exactly one display object, tween and recovery timer per eight-pixel burst", () => {
    renderer.show("enemy:one", 200, 200, STRIKE);
    expect(scene.graphics).toHaveLength(1);
    expect(scene.animations).toHaveLength(1);
    expect(scene.timers).toHaveLength(1);
    expect(renderer.activeCount).toBe(1);
  });

  it("caps simultaneous effects and replaces the same actor without leaking visuals", () => {
    for (let index = 0; index < 20; index++) renderer.show(`actor:${index}`, 200, 200, STRIKE);
    expect(renderer.activeCount).toBe(8);
    expect(scene.graphics.slice(0, 12).every((graphics) => graphics.destroy.mock.calls.length === 1)).toBe(true);
    renderer.show("actor:19", 200, 200, STRIKE);
    expect(renderer.activeCount).toBe(8);
    expect(scene.graphics[19]!.destroy).toHaveBeenCalledTimes(1);
  });

  it("rejects stale updates, watchdogs and completions after replacement", () => {
    renderer.show("enemy:one", 200, 200, STRIKE);
    const old = scene.animations[0]!;
    renderer.show("enemy:one", 200, 200, STRIKE);
    const draws = scene.graphics[0]!.clear.mock.calls.length;
    old.options.onUpdate();
    old.options.onComplete();
    scene.timers[0]!.callback();
    expect(scene.graphics[0]!.clear).toHaveBeenCalledTimes(draws);
    expect(scene.graphics[0]!.destroy).toHaveBeenCalledTimes(1);
    expect(scene.graphics[1]!.destroy).not.toHaveBeenCalled();
    expect(renderer.activeCount).toBe(1);
    scene.timers[1]!.callback();
    scene.animations[1]!.options.onComplete();
    expect(scene.graphics[1]!.destroy).toHaveBeenCalledTimes(1);
    expect(renderer.activeCount).toBe(0);
  });

  it("removes all motion immediately for live reduced motion and retains no callbacks on shutdown", () => {
    renderer.show("enemy:one", 200, 200, STRIKE);
    gamePreferences.setReducedMotion(true);
    expect(renderer.activeCount).toBe(0);
    renderer.show("enemy:two", 200, 200, STRIKE);
    expect(scene.graphics).toHaveLength(1);
    renderer.destroy();
    gamePreferences.setReducedMotion(false);
    for (const animation of scene.animations) {
      animation.options.onUpdate();
      animation.options.onComplete();
    }
    for (const timer of scene.timers) timer.callback();
    expect(scene.graphics[0]!.destroy).toHaveBeenCalledTimes(1);
    expect(scene.animations[0]!.stop).toHaveBeenCalledTimes(1);
    expect(scene.timers[0]!.remove).toHaveBeenCalledTimes(1);
  });
});
