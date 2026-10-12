import * as Phaser from "phaser";
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { subscribeOverlayReflow } from "../src/managers/layout";

vi.mock("phaser", () => ({
  Scene: class {},
  Scenes: { Events: { POST_UPDATE: "postupdate", SHUTDOWN: "shutdown" } },
  Scale: { Events: { RESIZE: "resize" } },
}));

function context(): {
  scene: Phaser.Scene;
  events: EventEmitter;
  scale: EventEmitter;
  pointer: { isDown: boolean };
} {
  const events = new EventEmitter();
  const scale = new EventEmitter();
  const pointer = { isDown: false };
  const scene = Object.assign(new Phaser.Scene(), {
    events, scale, input: { activePointer: pointer },
  });
  return { scene, events, scale, pointer };
}

describe("owned overlay reflow", () => {
  it("ignores a callback already captured by the current frame after disposal", () => {
    const { scene, events, scale } = context();
    const render = vi.fn();
    let dispose = (): void => {};
    events.on("postupdate", () => dispose());
    dispose = subscribeOverlayReflow(scene, render);
    scale.emit("resize");
    events.emit("postupdate");
    expect(render).not.toHaveBeenCalled();
  });

  it("cannot requeue a disposed callback while a pointer is held", () => {
    const { scene, events, scale, pointer } = context();
    const render = vi.fn();
    let dispose = (): void => {};
    pointer.isDown = true;
    events.on("postupdate", () => dispose());
    dispose = subscribeOverlayReflow(scene, render);
    scale.emit("resize");
    events.emit("postupdate");
    pointer.isDown = false;
    events.emit("postupdate");
    expect(render).not.toHaveBeenCalled();
  });

  it("coalesces live requests and removes resize listeners on shutdown", () => {
    const { scene, events, scale } = context();
    const render = vi.fn();
    subscribeOverlayReflow(scene, render);
    scale.emit("resize");
    scale.emit("resize");
    scale.emit("resize");
    events.emit("postupdate");
    expect(render).toHaveBeenCalledTimes(1);
    events.emit("shutdown");
    scale.emit("resize");
    events.emit("postupdate");
    expect(render).toHaveBeenCalledTimes(1);
  });
});
