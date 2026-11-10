// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { GamePreferencesStore, normalizeGamePreferences } from "../src/systems/accessibility";

describe("Battle portrait vitals preferences", () => {
  beforeEach(() => localStorage.clear());

  it("migrates older preference documents to expanded portrait vitals without changing dice or audio", () => {
    for (const version of [1, 2, 3]) {
      const preferences = normalizeGamePreferences({
        version, audio: { masterVolume: 0.4, muted: true },
        dice: { frequency: "important", speed: "instant" },
        accessibility: { highContrast: true, textScale: 1.5 },
      });
      expect(preferences.version).toBe(4);
      expect(preferences.battleHud).toEqual({ vitals: "expanded" });
      expect(preferences.dice).toEqual({ frequency: "important", speed: "instant" });
      expect(preferences.audio).toMatchObject({ masterVolume: 0.4, muted: true });
    }
    expect(normalizeGamePreferences({ battleHud: { vitals: "hidden" } }).battleHud).toEqual({ vitals: "expanded" });
  });

  it("persists the full/compact toggle through the shared store without writing a campaign save", () => {
    localStorage.setItem("2dnd_save", "synthetic untouched campaign");
    const store = new GamePreferencesStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.toggleBattleVitals();
    expect(store.getBattleHud().vitals).toBe("compact");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(new GamePreferencesStore().getBattleHud().vitals).toBe("compact");
    expect(localStorage.getItem("2dnd_save")).toBe("synthetic untouched campaign");
    store.toggleBattleVitals();
    expect(store.getBattleHud().vitals).toBe("expanded");
  });
});
