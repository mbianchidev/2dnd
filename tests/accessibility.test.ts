// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GAME_PREFERENCES_STORAGE_KEY,
  GamePreferencesStore,
  LEGACY_AUDIO_PREFERENCES_STORAGE_KEY,
  LEGACY_CUTSCENE_ACCESSIBILITY_STORAGE_KEY,
  gamePreferences,
  getMotionDuration,
  normalizeGamePreferences,
} from "../src/systems/accessibility";

describe("shared game preferences", () => {
  beforeEach(() => {
    localStorage.clear();
    gamePreferences.reload();
  });

  afterEach(() => {
    gamePreferences.setReducedMotion(false);
  });

  it("normalizes malformed audio and accessibility values", () => {
    expect(normalizeGamePreferences({
      audio: {
        masterVolume: 4,
        musicVolume: -2,
        sfxVolume: "loud",
        dialogVolume: Number.NaN,
        muted: "yes",
      },
      accessibility: {
        reducedMotion: "yes",
        textScale: 4,
        highContrast: "yes",
        advanceMode: "instant",
      },
    })).toEqual({
      version: 1,
      audio: {
        masterVolume: 1,
        musicVolume: 0,
        sfxVolume: 0.4,
        dialogVolume: 0.5,
        muted: false,
      },
      accessibility: {
        reducedMotion: false,
        textScale: 1,
        highContrast: false,
        advanceMode: "manual",
      },
    });
  });

  it("persists audio and accessibility in one preference document", () => {
    const store = new GamePreferencesStore();

    store.setAudio({ masterVolume: 0.75, muted: true });
    store.cycleTextScale();
    store.setHighContrast(true);
    store.setReducedMotion(true);
    store.setAdvanceMode("automatic");

    const saved = JSON.parse(
      localStorage.getItem(GAME_PREFERENCES_STORAGE_KEY)!,
    );
    expect(saved).toEqual({
      version: 1,
      audio: {
        masterVolume: 0.75,
        musicVolume: 0.6,
        sfxVolume: 0.4,
        dialogVolume: 0.5,
        muted: true,
      },
      accessibility: {
        reducedMotion: true,
        textScale: 1.25,
        highContrast: true,
        advanceMode: "automatic",
      },
    });
    expect(new GamePreferencesStore().get()).toEqual(saved);
  });

  it("migrates legacy audio and cutscene settings into the shared key", () => {
    localStorage.setItem(LEGACY_AUDIO_PREFERENCES_STORAGE_KEY, JSON.stringify({
      masterVolume: 0.7,
      musicVolume: 0.5,
      sfxVolume: 0.3,
      dialogVolume: 0.2,
      muted: true,
    }));
    localStorage.setItem(
      LEGACY_CUTSCENE_ACCESSIBILITY_STORAGE_KEY,
      JSON.stringify({
        reducedMotion: true,
        textScale: 1.5,
        advanceMode: "automatic",
      }),
    );

    const store = new GamePreferencesStore();

    expect(store.getAudio()).toMatchObject({
      masterVolume: 0.7,
      muted: true,
    });
    expect(store.getAccessibility()).toEqual({
      reducedMotion: true,
      textScale: 1.5,
      highContrast: false,
      advanceMode: "automatic",
    });
    expect(localStorage.getItem(GAME_PREFERENCES_STORAGE_KEY)).not.toBeNull();
    expect(localStorage.getItem(LEGACY_AUDIO_PREFERENCES_STORAGE_KEY)).toBeNull();
    expect(
      localStorage.getItem(LEGACY_CUTSCENE_ACCESSIBILITY_STORAGE_KEY),
    ).toBeNull();
  });

  it("notifies subscribers immediately without changing campaign saves", () => {
    const store = new GamePreferencesStore();
    const listener = vi.fn();
    const campaignSave = JSON.stringify({ player: { name: "Test Hero" } });
    localStorage.setItem("2dnd_save", campaignSave);
    const unsubscribe = store.subscribe(listener);

    store.setHighContrast(true);
    unsubscribe();
    store.setHighContrast(false);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0].accessibility.highContrast).toBe(true);
    expect(localStorage.getItem("2dnd_save")).toBe(campaignSave);
  });

  it("exposes reduced motion through the shared duration accessor", () => {
    gamePreferences.setReducedMotion(false);
    expect(getMotionDuration(300)).toBe(300);

    gamePreferences.setReducedMotion(true);
    expect(getMotionDuration(300)).toBe(0);
  });
});
