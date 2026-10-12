// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SemanticInputRuntime } from "../src/managers/input";
import { closeTextEntry, openMobileTextInput } from "../src/managers/textEntry";
import { gamePreferences } from "../src/systems/accessibility";
import { inputSource } from "../src/systems/input";
import type { DesktopApi } from "../electron/contracts";

describe("semantic runtime focus and modal ownership", () => {
  let runtime: SemanticInputRuntime | undefined;
  let originalGamepads: PropertyDescriptor | undefined;
  let originalDesktop: PropertyDescriptor | undefined;
  let frame: FrameRequestCallback | null;
  let rightPressed: boolean;
  let game: ConstructorParameters<typeof SemanticInputRuntime>[0];
  let resize: (() => void) | undefined;
  const postStepListeners = new Set<() => void>();
  const sceneListeners = new Map<"shutdown" | "destroy", Set<() => void>>();
  const pressedButtons = new Set<number>();
  const emitted: string[] = [];
  const recordKey = (event: KeyboardEvent): void => {
    if (event.code === "KeyD") emitted.push(event.type);
  };

  function advance(timestamp: number): void {
    const next = frame;
    if (!next) throw new Error("Input runtime did not schedule its next frame");
    frame = null;
    next(timestamp);
  }

  beforeEach(() => {
    originalDesktop = Object.getOwnPropertyDescriptor(window, "desktop");
    localStorage.clear();
    gamePreferences.reload();
    inputSource.set("keyboard");
    document.body.innerHTML = '<div id="game-inner"><canvas></canvas></div><div id="debug-state">OVERWORLD</div>';
    const canvas = document.querySelector("canvas");
    if (!canvas) throw new Error("Missing mock input canvas");
    emitted.length = 0;
    runtime = undefined;
    rightPressed = false;
    pressedButtons.clear();
    postStepListeners.clear();
    sceneListeners.clear();
    frame = null;
    resize = undefined;
    vi.stubGlobal("ResizeObserver", class implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resize = () => callback([], this);
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frame = callback;
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    originalGamepads = Object.getOwnPropertyDescriptor(navigator, "getGamepads");
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [{
        index: 0, mapping: "standard", connected: true,
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, (_value, index) => ({
          pressed: index === 15 && rightPressed || pressedButtons.has(index),
        })),
      }],
    });
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    window.addEventListener("keydown", recordKey);
    window.addEventListener("keyup", recordKey);
    const sceneEvents = {
      on: (event: "shutdown" | "destroy", listener: () => void): void => {
        const listeners = sceneListeners.get(event) ?? new Set<() => void>();
        listeners.add(listener);
        sceneListeners.set(event, listeners);
      },
      off: (event: "shutdown" | "destroy", listener: () => void): void => {
        sceneListeners.get(event)?.delete(listener);
      },
    };
    game = {
      canvas,
      events: {
        once: (_event, listener) => { postStepListeners.add(listener); },
        off: (_event, listener) => { postStepListeners.delete(listener); },
      },
      scale: { getParentBounds: vi.fn(() => true), refresh: vi.fn() },
      scene: { getScenes: () => [{
        scene: { key: "OverworldScene" },
        events: sceneEvents,
      }] },
    };
    runtime = new SemanticInputRuntime(game);
    runtime.start();
  });

  afterEach(() => {
    runtime?.destroy();
    closeTextEntry();
    vi.useRealTimers();
    window.removeEventListener("keydown", recordKey);
    window.removeEventListener("keyup", recordKey);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (originalGamepads) Object.defineProperty(navigator, "getGamepads", originalGamepads);
    else Reflect.deleteProperty(navigator, "getGamepads");
    if (originalDesktop) Object.defineProperty(window, "desktop", originalDesktop);
    else Reflect.deleteProperty(window, "desktop");
    document.body.replaceChildren();
  });

  it("does not create mobile controls in native desktop even with saved On and touch prompts", () => {
    runtime?.destroy();
    const desktop: DesktopApi = {
      getState: async () => ({ appVersion: "mock", isFullscreen: false, logPath: "mock.log", platform: "other" }),
      toggleFullscreen: async () => false,
      quitApp: vi.fn(), reportError: vi.fn(), onFullscreenChanged: () => () => {},
    };
    Object.defineProperty(window, "desktop", { configurable: true, value: desktop });
    gamePreferences.cycleTouchControls();
    for (let index = 0; index < 5 && gamePreferences.getControls().promptSource !== "touch"; index += 1) {
      gamePreferences.cyclePromptSource();
    }
    runtime = new SemanticInputRuntime(game);
    runtime.start();
    expect(gamePreferences.getControls().touchControls).toBe("on");
    expect(document.getElementById("touch-controls")).toBeNull();
    expect(game.canvas.dataset.touchControls).toBe("false");
    expect(game.canvas.dataset.promptSource).toBe("pointer");
  });

  it("lets focused text keep physical keydowns while releasing held gameplay keys on keyup", () => {
    openMobileTextInput("Mock text", "", 20, vi.fn());
    const input = document.querySelector<HTMLInputElement>("#mobile-text-input input");
    if (!input) throw new Error("Missing focused text fixture");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "d", code: "KeyD", bubbles: true }));
    expect(emitted).toEqual([]);
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "d", code: "KeyD", bubbles: true }));
    expect(emitted).toEqual(["keyup"]);
    expect(document.activeElement).toBe(input);
  });

  it("reads the resized canvas host before refreshing FIT geometry", () => {
    expect(resize).toBeDefined();
    resize?.();
    const parentBounds = vi.mocked(game.scale.getParentBounds);
    const refresh = vi.mocked(game.scale.refresh);
    expect(parentBounds).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(parentBounds.mock.invocationCallOrder[0]).toBeLessThan(refresh.mock.invocationCallOrder[0]!);
  });

  it("releases held game keys and does not reacquire controller input while blurred", () => {
    rightPressed = true;
    advance(100);
    expect(emitted).toEqual(["keydown"]);
    window.dispatchEvent(new Event("blur"));
    expect(emitted).toEqual(["keydown", "keyup"]);
    advance(500);
    advance(900);
    expect(emitted).toEqual(["keydown", "keyup"]);
    rightPressed = false;
    window.dispatchEvent(new Event("focus"));
    advance(1000);
    rightPressed = true;
    advance(1100);
    expect(emitted).toEqual(["keydown", "keyup", "keydown"]);
  });

  it("keeps hidden-page input inert even if a focus event arrives", () => {
    rightPressed = true;
    advance(100);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    advance(500);
    expect(emitted).toEqual(["keydown", "keyup"]);
  });

  it("routes controller input through a scene-owned minigame context and restores exploration afterward", () => {
    const scene = game.scene.getScenes(true)[0];
    if (!scene) throw new Error("Missing context override scene");
    const data = new Map<string, unknown>([["semanticInputContext", "minigame"]]);
    vi.spyOn(game.scene, "getScenes").mockReturnValue([{
      ...scene, data: { get: (key: string): unknown => data.get(key) },
    }]);
    const dispatch = vi.spyOn(window, "dispatchEvent");
    rightPressed = true;
    advance(100);
    const keys = (): string[] => dispatch.mock.calls.flatMap(([event]) =>
      event instanceof KeyboardEvent && event.type === "keydown" ? [event.code] : []
    );
    expect(keys()).toContain("ArrowRight");
    expect(keys()).not.toContain("KeyD");
    rightPressed = false;
    advance(200);
    data.delete("semanticInputContext");
    advance(300);
    rightPressed = true;
    advance(400);
    expect(keys()).toContain("KeyD");
  });

  it("routes achievement selection, paging, title confirmation and search through shared list controls", () => {
    document.getElementById("debug-state")!.textContent = "OVERWORLD [ACHIEVEMENTS 1/50]";
    const dispatch = vi.spyOn(window, "dispatchEvent");
    const press = (button: number, timestamp: number): void => {
      pressedButtons.add(button);
      advance(timestamp);
      pressedButtons.delete(button);
      advance(timestamp + 50);
    };
    press(13, 100);
    press(15, 200);
    press(0, 300);
    press(2, 400);
    const keys = dispatch.mock.calls.flatMap(([event]) =>
      event instanceof KeyboardEvent && event.type === "keydown" ? [event.code] : []
    );
    expect(keys).toEqual(["ArrowDown", "PageDown", "Enter", "Slash"]);
    expect(emitted).toEqual([]);
  });

  it("releases an already-held game key before routing repeats into text entry", () => {
    rightPressed = true;
    advance(100);
    openMobileTextInput("Mock search", "", 20, vi.fn());
    advance(500);
    expect(emitted).toEqual(["keydown", "keyup"]);
    expect(document.getElementById("controller-keyboard")).not.toBeNull();
    advance(900);
    expect(emitted).toEqual(["keydown", "keyup"]);
  });

  it("keeps shared touch confirm/cancel outside the inert game wrapper", () => {
    const game = document.getElementById("game-inner");
    if (!game) throw new Error("Missing mock game wrapper");
    game.id = "game-wrapper";
    openMobileTextInput("Mock touch name", "", 20, vi.fn());
    const controls = document.getElementById("touch-controls");
    expect(controls?.parentElement).toBe(document.body);
    expect(game.inert).toBe(true);
    expect(controls?.closest("[inert]")).toBeNull();
  });

  it("prioritizes controller text entry over the dice log and restores log controls afterward", () => {
    advance(100);
    const dice = document.createElement("section");
    dice.id = "dice-presentation";
    const button = document.createElement("button");
    const click = vi.fn();
    button.addEventListener("click", click);
    dice.append(button);
    document.body.append(dice);
    button.focus();
    const commit = vi.fn();
    openMobileTextInput("Mock dice-log search", "", 20, commit);
    pressedButtons.add(0);
    advance(200);
    expect(document.querySelector<HTMLInputElement>("#mobile-text-input input")?.value)
      .toBe("q");
    expect(commit).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
    pressedButtons.delete(0);
    advance(250);
    pressedButtons.add(9);
    advance(300);
    expect(commit).toHaveBeenCalledExactlyOnceWith("q");
    expect(document.getElementById("mobile-text-input")).toBeNull();
    expect(document.activeElement).toBe(button);
    pressedButtons.delete(9);
    advance(350);
    pressedButtons.add(0);
    advance(400);
    expect(click).toHaveBeenCalledTimes(1);
    expect(emitted).toEqual([]);
    expect(postStepListeners.size).toBe(0);
  });

  it("dispatches the canonical dice-skip button only outside text entry and releases its key", () => {
    const dispatch = vi.spyOn(window, "dispatchEvent");
    const skipEvents = (): string[] => dispatch.mock.calls.flatMap(([event]) =>
      event instanceof KeyboardEvent && event.code === "KeyZ" ? [event.type] : []
    );
    advance(100);
    const commit = vi.fn();
    openMobileTextInput("Mock modal", "", 20, commit);
    pressedButtons.add(10);
    advance(200);
    expect(skipEvents()).toEqual([]);
    expect(commit).not.toHaveBeenCalled();
    closeTextEntry();
    pressedButtons.delete(10);
    advance(250);
    pressedButtons.add(10);
    advance(300);
    expect(skipEvents()).toEqual(["keydown"]);
    window.dispatchEvent(new Event("blur"));
    expect(skipEvents()).toEqual(["keydown", "keyup"]);
    advance(500);
    expect(skipEvents()).toEqual(["keydown", "keyup"]);
  });

  it("keeps a discrete touch pulse through one Phaser poll, not a zero-delay keyup", () => {
    advance(100);
    vi.useFakeTimers();
    const dispatch = vi.spyOn(window, "dispatchEvent");
    const confirmEvents = (): string[] => dispatch.mock.calls.flatMap(([event]) =>
      event instanceof KeyboardEvent && event.code === "Space" ? [event.type] : []
    );
    const confirm = document.querySelector<HTMLButtonElement>('#touch-controls [data-action="confirm"]');
    if (!confirm) throw new Error("Missing touch confirm");
    confirm.click();
    expect(confirmEvents()).toEqual(["keydown"]);
    vi.runAllTimers();
    expect(confirmEvents()).toEqual(["keydown"]);
    expect(postStepListeners.size).toBe(1);
    for (const listener of [...postStepListeners]) listener();
    expect(confirmEvents()).toEqual(["keydown", "keyup"]);
    expect(postStepListeners.size).toBe(0);
    for (const listener of [...postStepListeners]) listener();
    expect(confirmEvents()).toEqual(["keydown", "keyup"]);
  });

  it.each(["blur", "visibility", "context", "disconnect", "sceneShutdown", "sceneDestroy", "destroy"] as const)(
    "cancels pending touch-pulse release once on %s without leaving held input",
    (reason) => {
      advance(100);
      const dispatch = vi.spyOn(window, "dispatchEvent");
      const confirmEvents = (): string[] => dispatch.mock.calls.flatMap(([event]) =>
        event instanceof KeyboardEvent && event.code === "Space" ? [event.type] : []
      );
      document.querySelector<HTMLButtonElement>('#touch-controls [data-action="confirm"]')!.click();
      const stale = [...postStepListeners];
      expect(confirmEvents()).toEqual(["keydown"]);
      if (reason === "blur") window.dispatchEvent(new Event("blur"));
      else if (reason === "visibility") {
        vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
        document.dispatchEvent(new Event("visibilitychange"));
      } else if (reason === "context") {
        document.getElementById("debug-state")!.textContent = "OVERWORLD [GATHERING:fishing]";
        advance(200);
      } else if (reason === "disconnect") {
        window.dispatchEvent(new Event("gamepaddisconnected"));
      } else if (reason === "sceneShutdown" || reason === "sceneDestroy") {
        for (const listener of [...sceneListeners.get(reason === "sceneShutdown" ? "shutdown" : "destroy")!]) {
          listener();
        }
        expect([...sceneListeners.values()].every((listeners) => listeners.size === 0)).toBe(true);
      } else runtime?.destroy();
      expect(confirmEvents()).toEqual(["keydown", "keyup"]);
      expect(postStepListeners.size).toBe(0);
      for (const listener of stale) listener();
      expect(confirmEvents()).toEqual(["keydown", "keyup"]);
    },
  );

  it("does not release another controller owner's confirm when a touch pulse settles", () => {
    advance(100);
    const dispatch = vi.spyOn(window, "dispatchEvent");
    const confirmEvents = (): string[] => dispatch.mock.calls.flatMap(([event]) =>
      event instanceof KeyboardEvent && event.code === "Space" ? [event.type] : []
    );
    pressedButtons.add(0);
    advance(200);
    vi.spyOn(performance, "now").mockReturnValue(400);
    document.querySelector<HTMLButtonElement>('#touch-controls [data-action="confirm"]')!.click();
    expect(postStepListeners.size).toBe(1);
    for (const listener of [...postStepListeners]) listener();
    expect(confirmEvents()).toEqual(["keydown"]);
    pressedButtons.delete(0);
    advance(500);
    expect(confirmEvents()).toEqual(["keydown", "keyup"]);
  });

  it("delivers each successive touch press to one frame poll and activates keyup exactly once", () => {
    advance(100);
    let justDown = false;
    let activations = 0;
    const dispatch = window.dispatchEvent.bind(window);
    const emitted = vi.spyOn(window, "dispatchEvent").mockImplementation((event) => {
      if (event instanceof KeyboardEvent && event.code === "Space") {
        justDown = event.type === "keydown";
        if (event.type === "keyup") activations += 1;
      }
      return dispatch(event);
    });
    const confirm = document.querySelector<HTMLButtonElement>('#touch-controls [data-action="confirm"]')!;
    for (const timestamp of [200, 400]) {
      vi.spyOn(performance, "now").mockReturnValue(timestamp);
      confirm.click();
      expect(justDown).toBe(true);
      justDown = false;
      for (const listener of [...postStepListeners]) listener();
      expect(justDown).toBe(false);
      expect(postStepListeners.size).toBe(0);
    }
    expect(activations).toBe(2);
    expect(emitted.mock.calls.flatMap(([event]) =>
      event instanceof KeyboardEvent && event.code === "Space" ? [event.type] : []
    )).toEqual(["keydown", "keyup", "keydown", "keyup"]);
  });

  it("never delivers an aborted pulse into a replacement scene or settles its new pulse", () => {
    advance(100);
    const dispatch = vi.spyOn(window, "dispatchEvent");
    const confirmEvents = (): string[] => dispatch.mock.calls.flatMap(([event]) =>
      event instanceof KeyboardEvent && event.code === "Space" ? [event.type] : []
    );
    const confirm = document.querySelector<HTMLButtonElement>('#touch-controls [data-action="confirm"]')!;
    confirm.click();
    const stale = [...postStepListeners][0]!;
    for (const listener of [...sceneListeners.get("shutdown")!]) listener();
    expect(confirmEvents()).toEqual(["keydown", "keyup"]);
    expect(postStepListeners.size).toBe(0);
    const replacement = new Set<() => void>();
    vi.spyOn(game.scene, "getScenes").mockReturnValue([{
      scene: { key: "BattleScene" },
      events: {
        on: (_event, listener) => { replacement.add(listener); },
        off: (_event, listener) => { replacement.delete(listener); },
      },
    }]);
    dispatch.mockClear();
    vi.spyOn(performance, "now").mockReturnValue(400);
    confirm.click();
    expect(confirmEvents()).toEqual(["keydown"]);
    expect(postStepListeners.size).toBe(1);
    stale();
    expect(confirmEvents()).toEqual(["keydown"]);
    expect(postStepListeners.size).toBe(1);
    for (const listener of [...postStepListeners]) listener();
    expect(confirmEvents()).toEqual(["keydown", "keyup"]);
    expect(postStepListeners.size).toBe(0);
  });
});
