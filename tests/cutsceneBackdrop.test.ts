import * as Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { buildCutsceneScenery } from "../src/systems/cutsceneScenery";
import { CUTSCENE_RESULT_DIM, drawCutsceneScenery } from "../src/renderers/cutsceneBackdrop";

const harness = vi.hoisted(() => {
  class Graphics {
    readonly clear = vi.fn((): this => this);
    readonly fillStyle = vi.fn((): this => this);
    readonly fillRect = vi.fn((): this => this);
    readonly fillEllipse = vi.fn((): this => this);
    readonly beginPath = vi.fn((): this => this);
    readonly moveTo = vi.fn((): this => this);
    readonly lineTo = vi.fn((): this => this);
    readonly closePath = vi.fn((): this => this);
    readonly fillPath = vi.fn((): this => this);
  }
  return { Graphics, Scene: class {} };
});

vi.mock("phaser", () => ({
  Scene: harness.Scene,
  GameObjects: { Graphics: harness.Graphics },
}));

describe("cutscene scenery graphics adapter", () => {
  it("draws the complete plan into one existing buffer without changing its geometry", () => {
    const graphics = Object.assign(new Phaser.GameObjects.Graphics(new Phaser.Scene()), new harness.Graphics());
    const plan = buildCutsceneScenery("campaign.oath.sandport", "desert");
    const before = JSON.stringify(plan);
    drawCutsceneScenery(graphics, plan);
    expect(graphics.clear).toHaveBeenCalledTimes(1);
    expect(graphics.fillStyle).toHaveBeenCalledTimes(plan.primitives.length);
    expect(
      graphics.fillRect.mock.calls.length + graphics.fillEllipse.mock.calls.length + graphics.fillPath.mock.calls.length,
    ).toBe(plan.primitives.length);
    expect(JSON.stringify(plan)).toBe(before);
  });

  it("dims the ending artwork rather than replacing it with a flat background", () => {
    const graphics = Object.assign(new Phaser.GameObjects.Graphics(new Phaser.Scene()), new harness.Graphics());
    const plan = buildCutsceneScenery("campaign.twelvefoldCovenant.epilogue", "stars");
    drawCutsceneScenery(graphics, plan, CUTSCENE_RESULT_DIM);
    expect(graphics.fillStyle).toHaveBeenLastCalledWith(0x000000, CUTSCENE_RESULT_DIM);
    expect(graphics.fillRect).toHaveBeenLastCalledWith(0, 0, 640, 528);
    expect(graphics.fillPath.mock.calls.length).toBeGreaterThan(0);
    expect(graphics.fillStyle).toHaveBeenCalledTimes(plan.primitives.length + 1);
  });

  it("keeps normal ending copy readable even over the brightest possible scenery pixel", () => {
    const luminance = (color: number): number => {
      const channels = [16, 8, 0].map((shift) => {
        const value = ((color >> shift) & 255) / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const channel = Math.round(255 * (1 - CUTSCENE_RESULT_DIM));
    const brightestBackground = (channel << 16) | (channel << 8) | channel;
    for (const text of [0xeef0ff, 0xffe38a]) {
      expect((luminance(text) + 0.05) / (luminance(brightestBackground) + 0.05)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
