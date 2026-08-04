// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";
import {
  CUTSCENE_ACCESSIBILITY_STORAGE_KEY,
  CutsceneAccessibilityStore,
  normalizeCutsceneAccessibilityPreferences,
} from "../src/systems/accessibility";

describe("cutscene accessibility preferences", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("normalizes malformed values to safe defaults", () => {
    expect(normalizeCutsceneAccessibilityPreferences({
      reducedMotion: "yes",
      textScale: 4,
      advanceMode: "instant",
    })).toMatchObject({
      textScale: 1,
      advanceMode: "manual",
    });
  });

  it("persists reduced motion, text scale, and advance mode", () => {
    const store = new CutsceneAccessibilityStore();

    store.setReducedMotion(true);
    store.cycleTextScale();
    store.setAdvanceMode("automatic");

    const saved = JSON.parse(
      localStorage.getItem(CUTSCENE_ACCESSIBILITY_STORAGE_KEY)!,
    );
    expect(saved).toEqual({
      reducedMotion: true,
      textScale: 1.25,
      advanceMode: "automatic",
    });

    const reloaded = new CutsceneAccessibilityStore();
    expect(reloaded.get()).toEqual(saved);
  });
});
