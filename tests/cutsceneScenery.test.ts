import { describe, expect, it, vi } from "vitest";
import { CUTSCENE_PALETTES, CUTSCENE_SCENERY } from "../src/data/cutsceneScenery";
import {
  BOSS_CUTSCENES, CUTSCENE_IDS, getCutsceneDefinition,
} from "../src/data/cutscenes";
import { buildCutsceneScenery } from "../src/systems/cutsceneScenery";
import type { CutsceneBackdrop } from "../src/data/cutscenes";
import type { SceneryPrimitive } from "../src/systems/cutsceneScenery";

function geometry(primitives: readonly SceneryPrimitive[]): string {
  return JSON.stringify(primitives.map(({ color: _color, alpha: _alpha, ...shape }) => shape));
}

describe("illustrated cutscene scenery", () => {
  it("covers every stable story and boss cutscene without a generic fallback", () => {
    expect(Object.keys(CUTSCENE_SCENERY).sort()).toEqual([...CUTSCENE_IDS].sort());
    expect(new Set(Object.values(CUTSCENE_SCENERY).map((scene) => scene.landmark)).size)
      .toBe(CUTSCENE_IDS.length);
    for (const id of CUTSCENE_IDS) {
      expect(getCutsceneDefinition(id).steps.every((step) => step.presentation !== undefined), id).toBe(true);
    }
  });

  it("gives every first frame different geometry, not only different colors or actor sprites", () => {
    const pictures = CUTSCENE_IDS.map((id) => {
      const step = getCutsceneDefinition(id).steps[0]!;
      return geometry(buildCutsceneScenery(id, step.presentation?.backdrop ?? "stars").primitives);
    });
    expect(new Set(pictures).size).toBe(CUTSCENE_IDS.length);
  });

  it("illustrates every step with colored sky/depth/setting/foreground within one bounded render plan", () => {
    for (const id of CUTSCENE_IDS) {
      for (const step of getCutsceneDefinition(id).steps) {
        const plan = buildCutsceneScenery(id, step.presentation?.backdrop ?? "stars");
        expect(plan.primitives.length, id).toBeGreaterThan(60);
        expect(plan.primitives.length, id).toBeLessThanOrEqual(512);
        expect(new Set(plan.primitives.map((shape) => shape.color)).size, id).toBeGreaterThanOrEqual(8);
        expect(new Set(plan.primitives.map((shape) => shape.layer)).size, id).toBe(5);
        expect(plan.primitives.filter((shape) => shape.layer === "landmark").length, id)
          .toBeGreaterThanOrEqual(6);
        for (const shape of plan.primitives) {
          expect(shape.alpha).toBeGreaterThan(0);
          expect(shape.alpha).toBeLessThanOrEqual(1);
          expect(shape.color).toBeGreaterThanOrEqual(0);
          expect(shape.color).toBeLessThanOrEqual(0xffffff);
          if (shape.kind === "polygon") {
            expect(shape.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
          } else {
            expect(Number.isFinite(shape.x) && Number.isFinite(shape.y)).toBe(true);
            expect(shape.width).toBeGreaterThan(0);
            expect(shape.height).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("changes boss aftermath scenery structurally, rather than only removing the boss", () => {
    for (const { pre, post } of Object.values(BOSS_CUTSCENES)) {
      const before = buildCutsceneScenery(pre, getCutsceneDefinition(pre).steps[0]!.presentation!.backdrop);
      const after = buildCutsceneScenery(post, getCutsceneDefinition(post).steps[0]!.presentation!.backdrop);
      expect(CUTSCENE_SCENERY[pre].structure).toBe(CUTSCENE_SCENERY[post].structure);
      expect(geometry(before.primitives)).not.toBe(geometry(after.primitives));
    }
  });

  it("places the Kraken at sea and keeps indoor ice/forge scenes distinct from outdoor arenas", () => {
    expect(getCutsceneDefinition("boss.kraken.pre").steps[0]!.presentation!.backdrop).toBe("sea");
    expect(getCutsceneDefinition("boss.kraken.post").steps[0]!.presentation!.backdrop).toBe("sea");
    expect(CUTSCENE_SCENERY["boss.frostWarden.pre"].interior).toBe(true);
    expect(CUTSCENE_SCENERY["boss.frostGiant.pre"].interior).toBe(false);
    expect(CUTSCENE_SCENERY["boss.infernoForgemaster.pre"].interior).toBe(true);
    expect(CUTSCENE_SCENERY["boss.dragon.pre"].interior).toBe(false);
  });

  it("rebuilds the same picture on replay without using gameplay RNG or changing shared definitions", () => {
    const before = JSON.stringify([CUTSCENE_SCENERY, CUTSCENE_PALETTES]);
    const random = vi.spyOn(Math, "random");
    try {
      for (const id of CUTSCENE_IDS) {
        const backdrop: CutsceneBackdrop = getCutsceneDefinition(id).steps[0]!.presentation?.backdrop ?? "stars";
        expect(buildCutsceneScenery(id, backdrop)).toEqual(buildCutsceneScenery(id, backdrop));
      }
      expect(random).not.toHaveBeenCalled();
      expect(JSON.stringify([CUTSCENE_SCENERY, CUTSCENE_PALETTES])).toBe(before);
    } finally {
      random.mockRestore();
    }
  });
});
