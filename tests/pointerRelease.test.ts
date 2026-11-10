import * as Phaser from "phaser";
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { bindPointerRelease } from "../src/utils/ui";

vi.mock("phaser", async () => {
  const { EventEmitter: Emitter } = await import("node:events");
  return {
    Scene: class {},
    GameObjects: {
      GameObject: class extends Emitter {
        active = true;
        input = { enabled: true };
        constructor(readonly scene: Phaser.Scene) { super(); }
      },
      Events: { DESTROY: "destroy" },
    },
    Scenes: { Events: { SHUTDOWN: "shutdown" } },
    Core: { Events: { BLUR: "blur", HIDDEN: "hidden" } },
  };
});

function fixture(): {
  target: Phaser.GameObjects.GameObject;
  events: EventEmitter;
  gameEvents: EventEmitter;
} {
  const events = new EventEmitter();
  const gameEvents = new EventEmitter();
  const scene = Object.assign(new Phaser.Scene(), { events, game: { events: gameEvents } });
  return { target: new Phaser.GameObjects.GameObject(scene, "control"), events, gameEvents };
}

describe("owned pointer-release actions", () => {
  it("ignores an opening release and consumes only its own matching press once", () => {
    const { target } = fixture();
    const activate = vi.fn();
    const dispose = bindPointerRelease(target, activate);
    target.emit("pointerup", { id: 1 });
    expect(activate).not.toHaveBeenCalled();
    target.emit("pointerdown", { id: 1 });
    target.emit("pointerup", { id: 2 });
    expect(activate).not.toHaveBeenCalled();
    target.emit("pointerup", { id: 1 });
    target.emit("pointerup", { id: 1 });
    expect(activate).toHaveBeenCalledOnce();
    dispose();
  });

  it("cancels releases outside the control, on blur and while hidden without disabling later clicks", () => {
    const { target, gameEvents } = fixture();
    const activate = vi.fn();
    const dispose = bindPointerRelease(target, activate);
    target.emit("pointerdown", { id: 1 });
    target.emit("pointerupoutside", { id: 1 });
    target.emit("pointerup", { id: 1 });
    for (const event of ["blur", "hidden"]) {
      target.emit("pointerdown", { id: 1 });
      gameEvents.emit(event);
      target.emit("pointerup", { id: 1 });
    }
    expect(activate).not.toHaveBeenCalled();
    target.emit("pointerdown", { id: 1 });
    target.emit("pointerup", { id: 1 });
    expect(activate).toHaveBeenCalledOnce();
    dispose();
  });

  it("does not activate a control disabled after its press", () => {
    const { target } = fixture();
    const activate = vi.fn();
    const dispose = bindPointerRelease(target, activate);
    target.emit("pointerdown", { id: 1 });
    if (!target.input) throw new Error("Missing fixture input.");
    target.input.enabled = false;
    target.emit("pointerup", { id: 1 });
    target.input.enabled = true;
    target.emit("pointerup", { id: 1 });
    expect(activate).not.toHaveBeenCalled();
    dispose();
  });

  it("removes all owned listeners on replacement/shutdown and rejects a captured stale callback", () => {
    for (const boundary of ["destroy", "shutdown"]) {
      const { target, events, gameEvents } = fixture();
      const activate = vi.fn();
      const dispose = bindPointerRelease(target, activate);
      target.emit("pointerdown", { id: 1 });
      const staleRelease = target.listeners("pointerup")[0];
      (boundary === "destroy" ? target : events).emit(boundary);
      staleRelease?.({ id: 1 });
      expect(activate).not.toHaveBeenCalled();
      expect(target.listenerCount("pointerdown")).toBe(0);
      expect(target.listenerCount("pointerup")).toBe(0);
      expect(target.listenerCount("pointerupoutside")).toBe(0);
      expect(gameEvents.listenerCount("blur")).toBe(0);
      expect(gameEvents.listenerCount("hidden")).toBe(0);
      expect(events.listenerCount("shutdown")).toBe(0);
      dispose();
    }
  });
});
