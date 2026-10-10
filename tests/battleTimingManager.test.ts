// @vitest-environment happy-dom

import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as Phaser from "phaser";

const doubles = vi.hoisted(() => {
  class ObjectDouble {
    active = true;
    visible = true;
    alpha = 1;
    private readonly data = new Map<string, unknown>();
    private readonly listeners = new Map<string, Set<() => void>>();

    setData(id: string, value: unknown): this { this.data.set(id, value); return this; }
    getData(id: string): unknown { return this.data.get(id); }
    setDepth(_depth: number): this { return this; }
    on(event: string, listener: () => void): this {
      const listeners = this.listeners.get(event) ?? new Set();
      listeners.add(listener);
      this.listeners.set(event, listeners);
      return this;
    }
    once(event: string, listener: () => void): this {
      const once = (): void => { this.listeners.get(event)?.delete(once); listener(); };
      return this.on(event, once);
    }
    destroy(): void {
      this.active = false;
      for (const listener of [...(this.listeners.get("destroy") ?? [])]) listener();
      this.listeners.clear();
    }
  }

  class RectangleDouble {
    constructor(public x: number, public y: number, public width: number, public height: number) {}
    static Contains(): boolean { return true; }
  }

  class TextDouble extends ObjectDouble {
    input: { enabled: boolean; hitArea: RectangleDouble; hitAreaCallback?: () => boolean } | null = null;
    constructor(public x: number, public y: number, public text: string) { super(); }
    get width(): number { return Math.max(...this.text.split("\n").map((line) => line.length), 0) * 6 + 12; }
    get height(): number { return this.text.split("\n").length * 16 + 8; }
    get displayWidth(): number { return this.width; }
    get displayHeight(): number { return this.height; }
    setText(text: string): this { this.text = text; return this; }
    setVisible(visible: boolean): this { this.visible = visible; return this; }
    setPosition(x: number, y: number): this { this.x = x; this.y = y; return this; }
    setInteractive(): this {
      this.input = { enabled: true, hitArea: new RectangleDouble(0, 0, this.width, this.height) };
      return this;
    }
    getBounds() { return { x: this.x, y: this.y, width: this.width, height: this.height }; }
  }

  class ContainerDouble extends ObjectDouble {
    readonly list: unknown[] = [];
    add(objects: unknown[]): this { this.list.push(...objects); return this; }
  }
  return { TextDouble, ContainerDouble, RectangleDouble };
});

vi.mock("phaser", () => ({
  GameObjects: { Text: doubles.TextDouble, Events: { DESTROY: "destroy" } },
  Geom: { Rectangle: doubles.RectangleDouble },
  Scenes: { Events: {
    SHUTDOWN: "shutdown", PAUSE: "pause", RESUME: "resume", SLEEP: "sleep", WAKE: "wake",
  } },
}));

import { BattleTimingManager } from "../src/managers/battleTiming";
import { inputAvailability } from "../src/systems/input";
import type { BattleTimedDecision } from "../src/systems/battleTiming";

const owned: BattleTimingManager[] = [];

function fixture() {
  const events = new EventEmitter();
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const state = {
    actorId: "party:hero" as string | null,
    active: true, accepted: true, animation: false, transition: false,
  };
  const scene = {
    events,
    game: { canvas },
    scene: { isActive: () => state.active },
    add: {
      container: () => new doubles.ContainerDouble(),
      text: (x: number, y: number, text: string) => new doubles.TextDouble(x, y, text),
    },
  } as unknown as Phaser.Scene;
  let manager: BattleTimingManager;
  const timeout = vi.fn((decision: Readonly<BattleTimedDecision>) =>
    manager.clock.claimTimeout(decision.id)
  );
  manager = new BattleTimingManager(scene, {
    mode: "timed", durationSeconds: 15, timeoutAction: "defend",
  }, {
    controlledActorId: () => state.actorId,
    acceptsInput: () => state.accepted,
    animationActive: () => state.animation,
    transitionActive: () => state.transition,
    timeout,
  });
  owned.push(manager);
  manager.beginTurn("party:hero", "Mock Hero");
  manager.update(0);
  return { manager, timeout, events, canvas, state };
}

beforeEach(() => {
  inputAvailability.reset();
});

afterEach(() => {
  for (const manager of owned.splice(0)) manager.destroy();
  inputAvailability.reset();
  document.body.replaceChildren();
});

describe("scene-owned battle timing lifecycle", () => {
  it.each([
    ["pause", "resume"],
    ["sleep", "wake"],
  ])("freezes at one millisecond for %s and discards the %s boundary frame", (pause, resume) => {
    const { manager, events, state, timeout } = fixture();
    manager.update(14_999);
    state.active = false;
    events.emit(pause);
    expect(manager.clock.snapshot.pauseReasons).toContain("scene");
    expect(document.getElementById("battle-countdown-status")?.textContent).toContain("PAUSED");
    manager.update(100_000);
    expect(manager.clock.snapshot.decision?.remainingMs).toBe(1);
    expect(timeout).not.toHaveBeenCalled();
    state.active = true;
    events.emit(resume);
    manager.update(100_000);
    expect(manager.clock.snapshot.decision?.remainingMs).toBe(1);
    manager.update(1);
    manager.update(100_000);
    expect(timeout).toHaveBeenCalledOnce();
  });

  it("combines real input, animation, transition, and browser blockers without spending time", () => {
    const { manager, state, timeout } = fixture();
    manager.update(4_000);
    state.accepted = false;
    state.animation = true;
    state.transition = true;
    inputAvailability.update({ pageVisible: false, controllerRecovery: true, textEntryActive: true });
    manager.update(100_000);
    expect(manager.clock.snapshot.decision?.remainingMs).toBe(11_000);
    expect(manager.resumeIfPaused()).toBe(true);
    expect(inputAvailability.get().controllerRecovery).toBe(true);
    inputAvailability.update({ pageVisible: true, textEntryActive: false });
    state.accepted = true;
    state.transition = false;
    expect(manager.resumeIfPaused()).toBe(true);
    expect(inputAvailability.get().controllerRecovery).toBe(true);
    state.animation = false;
    expect(manager.resumeIfPaused()).toBe(true);
    expect(inputAvailability.get().controllerRecovery).toBe(false);
    manager.update(100_000);
    expect(manager.clock.snapshot.decision?.remainingMs).toBe(11_000);
    manager.update(11_000);
    expect(timeout).toHaveBeenCalledOnce();
  });

  it("consumes log-resume confirmation without resetting the budget or invoking timeout", () => {
    const { manager, timeout } = fixture();
    manager.update(3_000);
    manager.pauseForLogReading();
    manager.update(100_000);
    expect(manager.clock.snapshot.decision?.remainingMs).toBe(12_000);
    expect(manager.resumeIfPaused()).toBe(true);
    expect(manager.resumeIfPaused()).toBe(false);
    manager.update(100_000);
    expect(manager.clock.snapshot.decision?.remainingMs).toBe(12_000);
    expect(timeout).not.toHaveBeenCalled();
  });

  it("cancels a stale expired actor before dispatching an authoritative action", () => {
    const { manager, state, timeout } = fixture();
    manager.clock.advance(15_000);
    state.actorId = "party:companion:guardian";
    manager.update(0);
    expect(manager.clock.snapshot.decision).toBeNull();
    expect(timeout).not.toHaveBeenCalled();
  });

  it("removes listeners, accessible regions, attributes, and callbacks on shutdown exactly once", () => {
    const { manager, events, canvas, timeout } = fixture();
    expect(events.listenerCount("pause")).toBe(1);
    expect(document.getElementById("battle-countdown-status")).not.toBeNull();
    events.emit("shutdown");
    manager.destroy();
    manager.update(100_000);
    manager.beginTurn("party:hero", "Mock Hero");
    inputAvailability.update({ controllerRecovery: true });
    events.emit("resume");
    expect(manager.clock.snapshot.status).toBe("stopped");
    expect(events.listenerCount("pause")).toBe(0);
    expect(events.listenerCount("resume")).toBe(0);
    expect(events.listenerCount("sleep")).toBe(0);
    expect(events.listenerCount("wake")).toBe(0);
    expect(document.getElementById("battle-countdown-status")).toBeNull();
    expect(document.getElementById("battle-timing-announcement")).toBeNull();
    expect(canvas.dataset.battleTimingRemainingMs).toBeUndefined();
    expect(timeout).not.toHaveBeenCalled();
  });
});
