import * as Phaser from "phaser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CutsceneRenderer } from "../src/renderers/cutscene";
import { createPlayer } from "../src/systems/player";
import { gamePreferences } from "../src/systems/accessibility";
import type { CutsceneStep } from "../src/data/cutscenes";

const harness = vi.hoisted(() => {
  class Object {
    active = true;
    x = 0;
    y = 0;
    list: Object[] = [];
    clearCount = 0;
    add(children: Object | Object[]): this { this.list.push(...(Array.isArray(children) ? children : [children])); return this; }
    removeAll(destroy: boolean): this {
      if (destroy) for (const child of this.list) child.destroy();
      this.list = [];
      return this;
    }
    destroy(_children = true): void { if (this.active) { this.active = false; this.removeAll(true); } }
    setDepth(_depth: number): this { return this; }
    setAlpha(_alpha: number): this { return this; }
    setOrigin(_x: number, _y?: number): this { return this; }
    setScale(_scale: number): this { return this; }
    setPosition(x: number, y: number): this { this.x = x; this.y = y; return this; }
    setStrokeStyle(_width: number, _color: number): this { return this; }
    clear(): this { this.clearCount++; return this; }
    fillStyle(_color: number, _alpha: number): this { return this; }
    fillRect(_x: number, _y: number, _width: number, _height: number): this { return this; }
    fillEllipse(_x: number, _y: number, _width: number, _height: number): this { return this; }
    beginPath(): this { return this; }
    moveTo(_x: number, _y: number): this { return this; }
    lineTo(_x: number, _y: number): this { return this; }
    closePath(): this { return this; }
    fillPath(): this { return this; }
  }
  class Timer {
    readonly remove = vi.fn();
    constructor(readonly callback: () => void) {}
  }
  class Scene {
    readonly graphics: Object[] = [];
    readonly timers: Timer[] = [];
    readonly add = {
      graphics: (): Object => { const object = new Object(); this.graphics.push(object); return object; },
      container: (_x: number, _y: number, children: Object[] = []): Object => new Object().add(children),
      rectangle: (): Object => new Object(),
      text: (): Object => new Object(),
    };
    readonly time = {
      delayedCall: (_duration: number, callback: () => void): Timer => {
        const timer = new Timer(callback);
        this.timers.push(timer);
        return timer;
      },
    };
  }
  const directors: ActorDirector[] = [];
  class ActorDirector {
    readonly state = "idle";
    readonly cleanup = vi.fn();
    constructor() { directors.push(this); }
  }
  return { Object, Scene, ActorDirector, directors };
});

vi.mock("phaser", () => ({ Scene: harness.Scene, GameObjects: { Sprite: harness.Object } }));
vi.mock("../src/managers/actorAnimation", () => ({ ActorAnimationDirector: harness.ActorDirector }));

const STEP: CutsceneStep = {
  type: "narration", text: "Synthetic renderer fixture.",
  presentation: { backdrop: "heartlands", actors: [], effect: "none" },
};

beforeEach(() => {
  harness.directors.length = 0;
  gamePreferences.setReducedMotion(true);
});

function createRenderer(): {
  renderer: CutsceneRenderer;
  scene: Phaser.Scene & InstanceType<typeof harness.Scene>;
} {
  const scene = Object.assign(new Phaser.Scene(), new harness.Scene());
  const player = createPlayer("Renderer Fixture", {
    strength: 12, dexterity: 12, constitution: 12,
    intelligence: 10, wisdom: 10, charisma: 10,
  });
  return { scene, renderer: new CutsceneRenderer(scene, player, "campaign.opening") };
}

describe("cutscene scenery and presentation ownership", () => {
  it("reuses the existing backdrop buffer across steps and redraws only after reset", () => {
    const { renderer, scene } = createRenderer();
    renderer.present(STEP, 0, vi.fn());
    renderer.present(STEP, 1, vi.fn());
    expect(scene.graphics).toHaveLength(1);
    expect(scene.graphics[0]!.clearCount).toBe(1);
    renderer.reset();
    renderer.present(STEP, 0, vi.fn());
    expect(scene.graphics).toHaveLength(1);
    expect(scene.graphics[0]!.clearCount).toBe(2);
    renderer.cleanup();
  });

  it("rejects a stale readiness callback after step replacement or shutdown", () => {
    const { renderer, scene } = createRenderer();
    const first = vi.fn();
    const second = vi.fn();
    renderer.present(STEP, 0, first);
    renderer.present(STEP, 1, second);
    scene.timers[0]!.callback();
    expect(first).not.toHaveBeenCalled();
    renderer.cleanup();
    scene.timers[1]!.callback();
    expect(second).not.toHaveBeenCalled();
    expect(scene.graphics[0]!.active).toBe(false);
  });

  it("releases the previous animation owner on reset and the current owner exactly once on cleanup", () => {
    const { renderer } = createRenderer();
    renderer.reset();
    expect(harness.directors).toHaveLength(2);
    expect(harness.directors[0]!.cleanup).toHaveBeenCalledTimes(1);
    renderer.cleanup();
    renderer.cleanup();
    renderer.reset();
    expect(harness.directors[1]!.cleanup).toHaveBeenCalledTimes(1);
    expect(harness.directors).toHaveLength(2);
  });
});
