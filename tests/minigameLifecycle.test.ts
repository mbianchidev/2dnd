// @vitest-environment happy-dom

import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import type * as Phaser from "phaser";
import type { MinigamePanelAction, MinigamePanelContent } from "../src/renderers/minigames";

const presentation = vi.hoisted(() => ({
  render: vi.fn(),
  clear: vi.fn(),
  venueClear: vi.fn(),
}));

vi.mock("phaser", () => ({
  Scenes: { Events: { UPDATE: "update" } },
  Scale: { Events: { RESIZE: "resize" } },
  Core: { Events: { BLUR: "blur", FOCUS: "focus" } },
}));
vi.mock("../src/renderers/minigames", () => ({
  MinigamePanelRenderer: class {
    columns = 3;
    pageCount = 1;
    visibleActions: readonly MinigamePanelAction[] = [];

    render(content: MinigamePanelContent): void {
      this.visibleActions = content.actions.filter((action) => !action.disabled);
      this.columns = content.columns ?? 3;
      presentation.render(content);
    }

    hasTouchPad(): boolean { return false; }
    setSelected(_id: string): void {}
    refreshGame(): void {}
    clear(): void { presentation.clear(); }
  },
}));
vi.mock("../src/renderers/minigameVenues", () => ({
  MinigameVenueRenderer: class {
    render(): void {}
    updateVisibility(): void {}
    clear(): void { presentation.venueClear(); }
  },
}));

import { MinigameManager } from "../src/managers/minigames";
import { createCodex } from "../src/systems/codex";
import { gamePreferences } from "../src/systems/accessibility";
import { inputPromptSource } from "../src/systems/input";
import { startMinigame } from "../src/systems/minigames";
import { WeatherType } from "../src/systems/weather";
import { playerAt, startRequest } from "./helpers/minigames";
import type { MinigameManagerCallbacks } from "../src/managers/minigames";

function lifecycleScene(): {
  scene: Phaser.Scene;
  keyboard: EventEmitter;
  events: EventEmitter;
  scale: EventEmitter;
  gameEvents: EventEmitter;
  data: Map<string, unknown>;
  canvas: HTMLCanvasElement;
  time: { now: number };
} {
  const keyboard = Object.assign(new EventEmitter(), { resetKeys: vi.fn() });
  const events = new EventEmitter();
  const scale = new EventEmitter();
  const gameEvents = new EventEmitter();
  const data = new Map<string, unknown>([["semanticInputContext", "overlay"]]);
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  const time = { now: 0 };
  const scene = {
    input: { keyboard }, events, scale, time,
    game: { canvas, events: gameEvents },
    data: {
      get: (key: string): unknown => data.get(key),
      set: (key: string, value: unknown): void => { data.set(key, value); },
      remove: (key: string): void => { data.delete(key); },
    },
  } as unknown as Phaser.Scene;
  return { scene, keyboard, events, scale, gameEvents, data, canvas, time };
}

function callbacks(): MinigameManagerCallbacks {
  return {
    autoSave: vi.fn(() => ({ ok: true as const, message: "Fixture saved." })),
    updateHUD: vi.fn(),
    showMessage: vi.fn(),
    showCodexUnlocks: vi.fn(),
  };
}

function releaseKey(keyboard: EventEmitter, code: string): void {
  const key = code === "Enter" ? "Enter" : code === "Escape" ? "Escape" : code;
  keyboard.emit("keydown", new KeyboardEvent("keydown", { code, key }));
  keyboard.emit("keyup", new KeyboardEvent("keyup", { code, key }));
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  document.body.replaceChildren();
});

describe("scene-owned minigame lifecycle contracts", () => {
  it("releases every owned subscription/context without settling an interrupted paid session", () => {
    const fixture = lifecycleScene();
    const player = playerAt("willowdaleRange");
    const codex = createCodex();
    startMinigame(player, startRequest(player, "willowdaleRange"));
    const pending = structuredClone(player.progression.minigames.pending);
    const unsubscribePreferences = vi.fn();
    const unsubscribeSource = vi.fn();
    vi.spyOn(gamePreferences, "subscribe").mockReturnValue(unsubscribePreferences);
    vi.spyOn(inputPromptSource, "subscribe").mockReturnValue(unsubscribeSource);
    const manager = new MinigameManager(fixture.scene, callbacks());

    expect(manager.resumePending(player, codex, 45, WeatherType.Clear)).toBe(true);
    expect(fixture.data.get("semanticInputContext")).toBe("minigame");
    expect(fixture.keyboard.listenerCount("keydown")).toBe(1);
    expect(fixture.keyboard.listenerCount("keyup")).toBe(1);
    expect(fixture.events.listenerCount("update")).toBe(1);
    expect(fixture.scale.listenerCount("resize")).toBe(1);
    expect(fixture.gameEvents.listenerCount("blur")).toBe(1);
    expect(fixture.gameEvents.listenerCount("focus")).toBe(1);
    fixture.keyboard.emit("keydown", new KeyboardEvent("keydown", { code: "Enter", key: "Enter" }));
    const delayedRelease = fixture.keyboard.listeners("keyup")[0]!;

    manager.clear();
    delayedRelease(new KeyboardEvent("keyup", { code: "Enter", key: "Enter" }));
    expect(player.gold).toBe(995);
    expect(player.progression.minigames.pending).toEqual(pending);
    expect(fixture.data.get("semanticInputContext")).toBe("overlay");
    expect(fixture.keyboard.listenerCount("keydown")).toBe(0);
    expect(fixture.keyboard.listenerCount("keyup")).toBe(0);
    expect(fixture.events.listenerCount("update")).toBe(0);
    expect(fixture.scale.listenerCount("resize")).toBe(0);
    expect(fixture.gameEvents.listenerCount("blur")).toBe(0);
    expect(fixture.gameEvents.listenerCount("focus")).toBe(0);
    expect(unsubscribePreferences).toHaveBeenCalledTimes(1);
    expect(unsubscribeSource).toHaveBeenCalledTimes(1);
    expect(presentation.clear).toHaveBeenCalled();
    expect(presentation.venueClear).toHaveBeenCalledTimes(1);
    expect(document.getElementById("minigame-live-region")).toBeNull();
    expect(fixture.canvas.dataset["minigameInputOwned"]).toBeUndefined();
  });

  it("settles a confirmed abandonment once and restores the previous input owner after closing the receipt", () => {
    const fixture = lifecycleScene();
    const player = playerAt("willowdaleRange");
    startMinigame(player, startRequest(player, "willowdaleRange"));
    const cb = callbacks();
    const manager = new MinigameManager(fixture.scene, cb);
    manager.resumePending(player, createCodex(), 45, WeatherType.Clear);

    releaseKey(fixture.keyboard, "Escape");
    fixture.time.now = 100;
    releaseKey(fixture.keyboard, "ArrowRight");
    fixture.time.now = 200;
    releaseKey(fixture.keyboard, "ArrowRight");
    fixture.time.now = 300;
    releaseKey(fixture.keyboard, "Enter");
    expect(player.progression.minigames.pending?.receipt?.outcome).toBe("abandoned");
    expect(player.progression.minigames.pending?.receipt?.goldPaid).toBe(0);
    expect(player.gold).toBe(995);
    fixture.time.now = 500;
    releaseKey(fixture.keyboard, "Escape");
    releaseKey(fixture.keyboard, "Enter");

    expect(player.progression.minigames.pending).toBeNull();
    expect(player.progression.minigames.history).toHaveLength(1);
    expect(player.gold).toBe(995);
    expect(cb.autoSave).toHaveBeenCalledTimes(2);
    expect(manager.isOpen()).toBe(false);
    expect(fixture.data.get("semanticInputContext")).toBe("overlay");
    expect(fixture.keyboard.listenerCount("keyup")).toBe(0);
  });

  it("can reopen repeatedly without duplicate callbacks and does not disturb an unowned context", () => {
    const fixture = lifecycleScene();
    const manager = new MinigameManager(fixture.scene, callbacks());
    manager.close();
    expect(fixture.data.get("semanticInputContext")).toBe("overlay");
    const player = playerAt("willowdaleRange");
    startMinigame(player, startRequest(player, "willowdaleRange"));
    for (let index = 0; index < 5; index += 1) {
      manager.resumePending(player, createCodex(), 45, WeatherType.Clear);
      expect(fixture.keyboard.listenerCount("keydown")).toBe(1);
      manager.close();
      expect(fixture.keyboard.listenerCount("keydown")).toBe(0);
      expect(fixture.events.listenerCount("update")).toBe(0);
      expect(document.getElementById("minigame-live-region")).toBeNull();
    }
    expect(player.gold).toBe(995);
    expect(player.progression.minigames.pending?.phase).toBe("playing");
  });
});
