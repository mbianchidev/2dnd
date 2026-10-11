// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SemanticInputRuntime } from "../src/managers/input";
import { closeTextEntry, openMobileTextInput } from "../src/managers/textEntry";
import { gamePreferences } from "../src/systems/accessibility";
import { inputSource } from "../src/systems/input";

describe("semantic runtime focus and modal ownership", () => {
  let runtime: SemanticInputRuntime | undefined;
  let originalGamepads: PropertyDescriptor | undefined;
  let frame: FrameRequestCallback | null;
  let rightPressed: boolean;
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
    frame = null;
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
    runtime = new SemanticInputRuntime({
      canvas,
      scale: { refresh: vi.fn() },
      scene: { getScenes: () => [{ scene: { key: "OverworldScene" } }] },
    });
    runtime.start();
  });

  afterEach(() => {
    runtime?.destroy();
    closeTextEntry();
    window.removeEventListener("keydown", recordKey);
    window.removeEventListener("keyup", recordKey);
    vi.restoreAllMocks();
    if (originalGamepads) Object.defineProperty(navigator, "getGamepads", originalGamepads);
    else Reflect.deleteProperty(navigator, "getGamepads");
    document.body.replaceChildren();
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
});
