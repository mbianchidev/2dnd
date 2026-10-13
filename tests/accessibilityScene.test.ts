// @vitest-environment happy-dom

import * as Phaser from "phaser";
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  gamePreferences,
  installSceneAccessibility,
} from "../src/systems/accessibility";

vi.mock("phaser", () => ({
  Scene: class {},
  GameObjects: { Text: class {} },
}));
vi.mock("../src/managers/layout", () => ({
  installSceneLayoutAudit: vi.fn(),
}));

function context(): {
  scene: Phaser.Scene;
  events: EventEmitter;
  canvas: HTMLCanvasElement;
  text: Phaser.GameObjects.Text;
} {
  const events = new EventEmitter();
  const canvas = document.createElement("canvas");
  const style = { fontSize: "12px", stroke: "#123456", strokeThickness: 1 };
  const text = Object.assign(new Phaser.GameObjects.Text(
    new Phaser.Scene(), 0, 0, "Fixture", {},
  ), {
    style,
    width: 100,
    height: 20,
    scaleX: 1,
    scaleY: 1,
    getData: vi.fn(() => undefined),
    setFontSize: vi.fn((size: number) => {
      style.fontSize = `${size}px`;
      return text;
    }),
    setStroke: vi.fn((stroke: string, thickness: number) => {
      style.stroke = stroke;
      style.strokeThickness = thickness;
      return text;
    }),
  });
  const scene = Object.assign(new Phaser.Scene(), {
    game: { canvas },
    events,
    children: { list: [text] },
    tweens: { getTweens: () => [] },
    add: { text: vi.fn(() => text) },
  });
  return { scene, events, canvas, text };
}

describe("scene accessibility performance", () => {
  beforeEach(() => {
    localStorage.clear();
    gamePreferences.reload();
  });

  afterEach(() => {
    gamePreferences.reload();
  });

  it("does not mutate settled canvas preferences or text styles on every frame", () => {
    const { scene, events, canvas, text } = context();
    installSceneAccessibility(scene, vi.fn());
    const observer = new MutationObserver(() => {});
    observer.observe(canvas, { attributes: true });
    const fontCalls = vi.mocked(text.setFontSize).mock.calls.length;
    const strokeCalls = vi.mocked(text.setStroke).mock.calls.length;

    for (let frame = 0; frame < 120; frame++) events.emit("postupdate", frame);

    expect(observer.takeRecords()).toHaveLength(0);
    expect(text.setFontSize).toHaveBeenCalledTimes(fontCalls);
    expect(text.setStroke).toHaveBeenCalledTimes(strokeCalls);
    observer.disconnect();
    events.emit("shutdown");
  });

  it("applies live preferences once and preserves their original text baseline", () => {
    const { scene, events, canvas, text } = context();
    installSceneAccessibility(scene, vi.fn());
    gamePreferences.cycleTextScale();
    gamePreferences.setHighContrast(true);
    expect(text.style.fontSize).toBe("15px");
    expect(text.style.stroke).toBe("#000000");
    expect(canvas.dataset.textScale).toBe("1.25");
    expect(canvas.dataset.highContrast).toBe("true");

    const fontCalls = vi.mocked(text.setFontSize).mock.calls.length;
    const strokeCalls = vi.mocked(text.setStroke).mock.calls.length;
    for (let frame = 0; frame < 20; frame++) events.emit("postupdate", frame);
    expect(text.setFontSize).toHaveBeenCalledTimes(fontCalls);
    expect(text.setStroke).toHaveBeenCalledTimes(strokeCalls);

    gamePreferences.setHighContrast(false);
    gamePreferences.cycleTextScale();
    gamePreferences.cycleTextScale();
    expect(text.style.fontSize).toBe("12px");
    expect(text.style.stroke).toBe("#123456");
    events.emit("shutdown");
  });

  it("restores the factory and stops preference updates when the scene shuts down", () => {
    const { scene, events, canvas } = context();
    const originalAddText = scene.add.text;
    installSceneAccessibility(scene, vi.fn());
    events.emit("shutdown");
    expect(scene.add.text).toBe(originalAddText);
    const originalScale = canvas.dataset.textScale;
    gamePreferences.cycleTextScale();
    events.emit("postupdate", 1);
    expect(canvas.dataset.textScale).toBe(originalScale);
  });
});
