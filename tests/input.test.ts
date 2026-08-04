import { describe, expect, it } from "vitest";
import {
  InputContextStack,
  SemanticInputState,
  STANDARD_GAMEPAD_BINDINGS,
  isRepeatableAction,
  mapKeyboardCode,
  normalizeAnalogAxis,
  resolveGamepadAction,
} from "../src/systems/input";

describe("semantic input mappings", () => {
  it("resolves the same physical direction by active context", () => {
    expect(mapKeyboardCode("KeyW", "exploration")).toBe("moveUp");
    expect(mapKeyboardCode("KeyW", "battle")).toBe("navigateUp");
    expect(mapKeyboardCode("ArrowLeft", "inventory")).toBe("navigateLeft");
    expect(mapKeyboardCode("Space", "exploration")).toBe("interact");
    expect(mapKeyboardCode("Space", "cutscene")).toBe("confirm");
  });

  it("keeps debug keys outside production semantic mappings", () => {
    expect(mapKeyboardCode("KeyG", "exploration")).toBeUndefined();
    expect(mapKeyboardCode("KeyH", "battle")).toBeUndefined();
    expect(mapKeyboardCode("KeyO", "inventory")).toBeUndefined();
  });

  it("normalizes analog axes around a configurable dead zone", () => {
    expect(normalizeAnalogAxis(0.2)).toBe(0);
    expect(normalizeAnalogAxis(-0.24)).toBe(0);
    expect(normalizeAnalogAxis(1)).toBe(1);
    expect(normalizeAnalogAxis(-1)).toBe(-1);
    expect(normalizeAnalogAxis(0.62)).toBeCloseTo(0.5);
    expect(normalizeAnalogAxis(Number.NaN)).toBe(0);
  });

  it("uses standard gamepad bindings with exploration movement fallback", () => {
    const up = STANDARD_GAMEPAD_BINDINGS.find(
      (binding) => binding.button === 12,
    );
    expect(up).toBeDefined();
    expect(resolveGamepadAction(up!, "exploration")).toBe("moveUp");
    expect(resolveGamepadAction(up!, "battle")).toBe("navigateUp");
    expect(STANDARD_GAMEPAD_BINDINGS.find(
      (binding) => binding.button === 0,
    )?.action).toBe("confirm");
  });

  it("marks only held navigation actions as repeatable", () => {
    expect(isRepeatableAction("moveLeft")).toBe(true);
    expect(isRepeatableAction("navigateDown")).toBe(true);
    expect(isRepeatableAction("confirm")).toBe(false);
    expect(isRepeatableAction("openMenu")).toBe(false);
  });
});

describe("semantic input state", () => {
  it("suppresses duplicate actions across simultaneous sources", () => {
    const state = new SemanticInputState(300, 100, 50);
    expect(state.press("keyboard:Space", "confirm", "keyboard", 100)).toEqual({
      action: "confirm",
      source: "keyboard",
      timestamp: 100,
      repeated: false,
    });
    expect(state.press("gamepad:0", "confirm", "gamepad", 120)).toBeNull();
    expect(state.pulse("confirm", "touch", 151)?.source).toBe("touch");
  });

  it("debounces held tokens and emits deterministic repeats", () => {
    const state = new SemanticInputState(300, 100, 0);
    expect(state.press("gamepad:left", "moveLeft", "gamepad", 0)).not.toBeNull();
    expect(state.press("gamepad:left", "moveLeft", "gamepad", 1)).toBeNull();
    expect(state.update(299)).toEqual([]);
    expect(state.update(300)).toEqual([{
      action: "moveLeft",
      source: "gamepad",
      timestamp: 300,
      repeated: true,
    }]);
    expect(state.update(399)).toEqual([]);
    expect(state.update(400)).toHaveLength(1);
  });

  it("switches source and clears disconnected or blurred inputs", () => {
    const state = new SemanticInputState(300, 100, 0);
    state.press("keyboard:KeyW", "moveUp", "keyboard", 0);
    expect(state.source).toBe("keyboard");
    state.press("gamepad:axis", "moveLeft", "gamepad", 10);
    expect(state.source).toBe("gamepad");
    state.clearSource("gamepad");
    expect(state.update(400).map((event) => event.action)).toEqual(["moveUp"]);
    state.clear();
    expect(state.update(800)).toEqual([]);
  });

  it("releases only tokens owned by a disconnected gamepad", () => {
    const state = new SemanticInputState(300, 100, 0);
    state.press("gamepad:0:button:12", "moveUp", "gamepad", 0);
    state.press("gamepad:1:button:15", "moveRight", "gamepad", 0);

    expect(state.releaseMatching("gamepad:0:")).toEqual(["moveUp"]);
    expect(state.update(300).map((event) => event.action)).toEqual([
      "moveRight",
    ]);
  });
});

describe("input context priority", () => {
  it("selects the highest active context and falls back safely", () => {
    let overlayOpen = false;
    let inventoryOpen = false;
    const stack = new InputContextStack();
    stack.register({
      id: "overlay",
      context: "overlay",
      priority: 10,
      enabled: () => overlayOpen,
    });
    stack.register({
      id: "inventory",
      context: "inventory",
      priority: 20,
      enabled: () => inventoryOpen,
    });

    expect(stack.resolve("exploration")).toBe("exploration");
    overlayOpen = true;
    expect(stack.resolve("exploration")).toBe("overlay");
    inventoryOpen = true;
    expect(stack.resolve("exploration")).toBe("inventory");
    inventoryOpen = false;
    expect(stack.resolve("exploration")).toBe("overlay");
  });
});
