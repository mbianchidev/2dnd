// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SemanticInputRuntime } from "../src/managers/input";
import { closeTextEntry, openMobileTextInput } from "../src/managers/textEntry";
import { gamePreferences } from "../src/systems/accessibility";

describe("semantic runtime focus and modal ownership", () => {
  let runtime: SemanticInputRuntime | undefined;
  let originalGamepads: PropertyDescriptor | undefined;
  let frame: FrameRequestCallback | null;
  let rightPressed: boolean;
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
    document.body.innerHTML = '<div id="game-inner"><canvas></canvas></div><div id="debug-state">OVERWORLD</div>';
    const canvas = document.querySelector("canvas");
    if (!canvas) throw new Error("Missing mock input canvas");
    emitted.length = 0;
    runtime = undefined;
    rightPressed = false;
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
          pressed: index === 15 && rightPressed,
        })),
      }],
    });
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    window.addEventListener("keydown", recordKey);
    window.addEventListener("keyup", recordKey);
    runtime = new SemanticInputRuntime({
      canvas, scene: { getScenes: () => [{ scene: { key: "OverworldScene" } }] },
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
});
