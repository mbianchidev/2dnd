import { describe, expect, it, vi } from "vitest";

vi.mock("phaser", () => ({
  Cameras: {
    Scene2D: {
      Events: {
        FADE_IN_COMPLETE: "camerafadeincomplete",
        FADE_OUT_COMPLETE: "camerafadeoutcomplete",
      },
    },
  },
}));

import type * as Phaser from "phaser";
import { SceneTransitionManager } from "../src/managers/sceneTransition";

interface TimerHarness {
  delay: number;
  callback: () => void;
  removed: boolean;
  remove(dispatchCallback?: boolean): void;
}

interface CameraHarness {
  resetFX(): CameraHarness;
  setVisible(value: boolean): CameraHarness;
  setAlpha(value?: number): CameraHarness;
  once(event: string, callback: () => void): CameraHarness;
  off(event: string, callback: () => void): CameraHarness;
  fadeIn(
    duration: number,
    red?: number,
    green?: number,
    blue?: number,
  ): CameraHarness;
  fadeOut(
    duration: number,
    red?: number,
    green?: number,
    blue?: number,
  ): CameraHarness;
}

interface TransitionHarness {
  scene: Phaser.Scene;
  camera: CameraHarness;
  timers: TimerHarness[];
  operations: string[];
  emit(event: string): void;
}

function createHarness(): TransitionHarness {
  const operations: string[] = [];
  const listeners = new Map<string, () => void>();
  const timers: TimerHarness[] = [];
  const camera: CameraHarness = {
    resetFX: vi.fn(() => {
      operations.push("resetFX");
      return camera;
    }),
    setVisible: vi.fn((value: boolean) => {
      operations.push(`visible:${value}`);
      return camera;
    }),
    setAlpha: vi.fn((value = 1) => {
      operations.push(`alpha:${value}`);
      return camera;
    }),
    once: vi.fn((event: string, callback: () => void) => {
      operations.push(`once:${event}`);
      listeners.set(event, callback);
      return camera;
    }),
    off: vi.fn((event: string, callback: () => void) => {
      operations.push(`off:${event}`);
      if (listeners.get(event) === callback) listeners.delete(event);
      return camera;
    }),
    fadeIn: vi.fn((duration: number) => {
      operations.push(`fadeIn:${duration}`);
      return camera;
    }),
    fadeOut: vi.fn((duration: number) => {
      operations.push(`fadeOut:${duration}`);
      return camera;
    }),
  };
  const scene = {
    cameras: { main: camera },
    sys: { settings: { key: "TransitionTestScene" } },
    time: {
      delayedCall: vi.fn((delay: number, callback: () => void) => {
        const timer: TimerHarness = {
          delay,
          callback,
          removed: false,
          remove: vi.fn((dispatchCallback = false) => {
            operations.push(`removeTimer:${dispatchCallback}`);
            timer.removed = true;
          }),
        };
        timers.push(timer);
        operations.push(`timer:${delay}`);
        return timer;
      }),
    },
  } as unknown as Phaser.Scene;

  return {
    scene,
    camera,
    timers,
    operations,
    emit: (event: string): void => {
      const callback = listeners.get(event);
      listeners.delete(event);
      callback?.();
    },
  };
}

describe("SceneTransitionManager", () => {
  it("prepares a visible camera and cancels stale timers before fading in", () => {
    const harness = createHarness();
    const manager = new SceneTransitionManager(harness.scene);
    const queued = vi.fn();

    expect(manager.startAfter(100, queued, "stale transition")).toBe(true);
    const staleTimer = harness.timers[0];

    manager.prepare(300);

    expect(staleTimer?.removed).toBe(true);
    expect(manager.isPending).toBe(false);
    expect(harness.operations).toEqual([
      "resetFX",
      "visible:true",
      "alpha:1",
      "timer:100",
      "removeTimer:false",
      "resetFX",
      "visible:true",
      "alpha:1",
      "once:camerafadeincomplete",
      "timer:550",
      "fadeIn:300",
    ]);

    const watchdog = harness.timers[1];
    harness.emit("camerafadeincomplete");

    expect(watchdog?.removed).toBe(true);
    expect(harness.camera.resetFX).toHaveBeenCalledTimes(3);

    watchdog?.callback();

    expect(harness.camera.resetFX).toHaveBeenCalledTimes(3);
    expect(queued).not.toHaveBeenCalled();
  });

  it("starts a fade handoff once and restores the camera before queuing the scene", () => {
    const harness = createHarness();
    const manager = new SceneTransitionManager(harness.scene);
    const startScene = vi.fn(() => {
      expect(harness.operations[harness.operations.length - 1]).toBe("alpha:1");
    });

    expect(manager.startWithFade(startScene, {
      duration: 500,
      label: "battle return",
    })).toBe(true);
    expect(manager.startWithFade(startScene, {
      duration: 500,
      label: "duplicate battle return",
    })).toBe(false);
    expect(harness.operations.indexOf("once:camerafadeoutcomplete"))
      .toBeLessThan(harness.operations.indexOf("fadeOut:500"));
    expect(startScene).not.toHaveBeenCalled();

    const watchdog = harness.timers[0];
    harness.emit("camerafadeoutcomplete");

    expect(startScene).toHaveBeenCalledTimes(1);
    expect(watchdog?.removed).toBe(true);

    watchdog?.callback();
    harness.emit("camerafadeoutcomplete");

    expect(startScene).toHaveBeenCalledTimes(1);
  });

  it("uses the watchdog to recover a missing fade event exactly once", () => {
    const harness = createHarness();
    const manager = new SceneTransitionManager(harness.scene);
    const startScene = vi.fn();

    manager.startWithFade(startScene, {
      duration: 400,
      label: "watchdog transition",
    });
    const watchdog = harness.timers[0];

    expect(watchdog?.delay).toBe(650);
    watchdog?.callback();

    expect(startScene).toHaveBeenCalledTimes(1);
    expect(harness.camera.off).toHaveBeenCalledWith(
      "camerafadeoutcomplete",
      expect.any(Function),
    );
    expect(harness.camera.resetFX).toHaveBeenCalledTimes(2);

    harness.emit("camerafadeoutcomplete");
    watchdog?.callback();

    expect(startScene).toHaveBeenCalledTimes(1);
  });

  it("keeps a queued scene handoff locked until the scene prepares again", () => {
    const harness = createHarness();
    const manager = new SceneTransitionManager(harness.scene);
    const restartScene = vi.fn();

    expect(manager.startImmediately(restartScene, "area change")).toBe(true);

    expect(restartScene).toHaveBeenCalledTimes(1);
    expect(manager.isPending).toBe(true);
    expect(manager.startImmediately(restartScene, "duplicate area change"))
      .toBe(false);

    manager.prepare();

    expect(manager.isPending).toBe(false);
  });

  it("keeps same-scene input locked until both rest fades finish", () => {
    const harness = createHarness();
    const manager = new SceneTransitionManager(harness.scene);
    const atBlack = vi.fn();

    expect(manager.fadeOutAndIn(atBlack, {
      duration: 800,
      label: "inn rest",
    })).toBe(true);
    expect(manager.isPending).toBe(true);

    harness.emit("camerafadeoutcomplete");

    expect(atBlack).toHaveBeenCalledTimes(1);
    expect(manager.isPending).toBe(true);
    expect(harness.camera.fadeIn).toHaveBeenCalledWith(800, 0, 0, 0);
    expect(manager.startImmediately(vi.fn(), "duplicate rest")).toBe(false);

    harness.emit("camerafadeincomplete");

    expect(manager.isPending).toBe(false);
    expect(harness.camera.resetFX).toHaveBeenCalledTimes(3);
  });
});
