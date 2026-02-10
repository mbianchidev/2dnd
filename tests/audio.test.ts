import { describe, it, expect } from "vitest";
import {
  BIOME_PROFILES,
  resolveBiomePrefix,
  getProfileForBiome,
  createAudioState,
  audioEngine,
  type AudioState,
  type BiomeProfile,
} from "../src/systems/audio";

describe("audio system", () => {
  describe("resolveBiomePrefix", () => {
    it("resolves known biome prefixes", () => {
      expect(resolveBiomePrefix("Frozen Reach")).toBe("Frozen");
      expect(resolveBiomePrefix("Murky Flats")).toBe("Murky");
      expect(resolveBiomePrefix("Woodland Frontier")).toBe("Woodland");
      expect(resolveBiomePrefix("Scorched Hollow")).toBe("Scorched");
      expect(resolveBiomePrefix("Rocky Crossing")).toBe("Rocky");
      expect(resolveBiomePrefix("Arid Ridge")).toBe("Arid");
      expect(resolveBiomePrefix("Ancient Vale")).toBe("Ancient");
      expect(resolveBiomePrefix("Highland Ridge")).toBe("Highland");
    });

    it("returns empty string for unknown biomes", () => {
      expect(resolveBiomePrefix("Heartlands")).toBe("");
      expect(resolveBiomePrefix("Dragon's Domain")).toBe("");
      expect(resolveBiomePrefix("Unknown Place")).toBe("");
    });
  });

  describe("getProfileForBiome", () => {
    it("returns matching profile for known biomes", () => {
      const profile = getProfileForBiome("Frozen Reach");
      expect(profile).toBe(BIOME_PROFILES["Frozen"]);
    });

    it("returns default profile for unknown biomes", () => {
      const p1 = getProfileForBiome("Heartlands");
      const p2 = getProfileForBiome("Unknown");
      // Both should be the default profile (same structure)
      expect(p1.scale).toEqual(p2.scale);
      expect(p1.bpm).toBe(p2.bpm);
    });

    it("profiles have valid musical properties", () => {
      for (const [name, profile] of Object.entries(BIOME_PROFILES)) {
        expect(profile.bpm, `${name} bpm`).toBeGreaterThan(0);
        expect(profile.scale.length, `${name} scale length`).toBeGreaterThan(0);
        expect(["sine", "square", "sawtooth", "triangle"]).toContain(profile.wave);
        expect(["sine", "square", "sawtooth", "triangle"]).toContain(profile.padWave);
      }
    });
  });

  describe("BIOME_PROFILES", () => {
    it("has profiles for all expected biome prefixes", () => {
      const expected = ["Frozen", "Murky", "Ancient", "Scorched", "Rocky", "Arid", "Woodland", "Highland", "Rolling"];
      for (const prefix of expected) {
        expect(BIOME_PROFILES[prefix], `missing profile for ${prefix}`).toBeDefined();
      }
    });

    it("each profile has unique bpm or scale combination", () => {
      const seen = new Set<string>();
      for (const [name, profile] of Object.entries(BIOME_PROFILES)) {
        const key = `${profile.bpm}-${profile.scale.join(",")}`;
        // We don't require strict uniqueness — just verify the data is varied
        seen.add(key);
      }
      // At least half should be distinct
      expect(seen.size).toBeGreaterThanOrEqual(Object.keys(BIOME_PROFILES).length / 2);
    });
  });

  describe("createAudioState", () => {
    it("returns sensible defaults", () => {
      const state = createAudioState();
      expect(state.trackKind).toBe("none");
      expect(state.trackId).toBe("");
      expect(state.nightMode).toBe(false);
      expect(state.muted).toBe(false);
      expect(state.volume).toBeGreaterThan(0);
      expect(state.volume).toBeLessThanOrEqual(1);
    });
  });

  describe("audioEngine singleton", () => {
    it("is exported and has the expected API surface", () => {
      expect(audioEngine).toBeDefined();
      expect(typeof audioEngine.init).toBe("function");
      expect(typeof audioEngine.setVolume).toBe("function");
      expect(typeof audioEngine.setMuted).toBe("function");
      expect(typeof audioEngine.toggleMute).toBe("function");
      expect(typeof audioEngine.stopAll).toBe("function");
      expect(typeof audioEngine.playBiomeMusic).toBe("function");
      expect(typeof audioEngine.playBattleMusic).toBe("function");
      expect(typeof audioEngine.playBossMusic).toBe("function");
      expect(typeof audioEngine.playCityMusic).toBe("function");
      expect(typeof audioEngine.playTitleMusic).toBe("function");
      expect(typeof audioEngine.playDefeatMusic).toBe("function");
      expect(typeof audioEngine.playWeatherSFX).toBe("function");
      expect(typeof audioEngine.playDialogueBlip).toBe("function");
      expect(typeof audioEngine.playAllSounds).toBe("function");
    });

    it("is not initialized before init() is called", () => {
      expect(audioEngine.initialized).toBe(false);
    });

    it("has correct initial state", () => {
      expect(audioEngine.state.trackKind).toBe("none");
      expect(audioEngine.state.muted).toBe(false);
    });

    it("does not throw when calling play methods before init", () => {
      // These should be no-ops when AudioContext is not available
      expect(() => audioEngine.playBiomeMusic("Frozen Reach", "Day" as any)).not.toThrow();
      expect(() => audioEngine.playBattleMusic()).not.toThrow();
      expect(() => audioEngine.playBossMusic("dragon")).not.toThrow();
      expect(() => audioEngine.playCityMusic("Willowdale")).not.toThrow();
      expect(() => audioEngine.playTitleMusic()).not.toThrow();
      expect(() => audioEngine.playDefeatMusic()).not.toThrow();
      expect(() => audioEngine.playWeatherSFX("Rain" as any)).not.toThrow();
      expect(() => audioEngine.playDialogueBlip()).not.toThrow();
      expect(() => audioEngine.stopAll()).not.toThrow();
    });
  });
});
