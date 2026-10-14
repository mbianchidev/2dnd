import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BIOME_PROFILES,
  CITY_OVERRIDES,
  DUNGEON_PROFILES,
  DEFAULT_PROFILE,
} from "../src/data/music";
import { CITIES, DUNGEONS, WORLD_CHUNKS } from "../src/data/map";
import {
  buildMusicPhrase,
  getProfileForBiome,
  getProfileForCity,
  getProfileForDungeon,
  resolveBiomePrefix,
} from "../src/systems/music";
import { audioEngine } from "../src/systems/audio";
import { TimePeriod } from "../src/systems/daynight";

describe("area music definitions", () => {
  it("covers every world chunk, including named regions outside the regular biome prefixes", () => {
    for (const chunk of WORLD_CHUNKS.flat()) {
      expect(resolveBiomePrefix(chunk.name), chunk.name).not.toBe("");
      expect(getProfileForBiome(chunk.name), chunk.name).not.toBe(DEFAULT_PROFILE);
    }
    expect(resolveBiomePrefix("Eastern Desert")).toBe("Arid");
    expect(resolveBiomePrefix("Marshlands")).toBe("Murky");
    expect(resolveBiomePrefix("Dragon's Domain")).toBe("Scorched");
    expect(resolveBiomePrefix("Unknown Place")).toBe("");
    expect(getProfileForBiome("Unknown Place")).toBe(DEFAULT_PROFILE);
  });

  it("gives each biome its own deterministic melody, not only a different tempo", () => {
    const profiles = Object.values(BIOME_PROFILES);
    const phrases = profiles.map((profile) => buildMusicPhrase(profile, false));
    expect(new Set(phrases.map((phrase) => JSON.stringify(phrase))).size).toBe(profiles.length);
    for (const [index, profile] of profiles.entries()) {
      expect(phrases[index]).toHaveLength(16);
      expect(buildMusicPhrase(profile, false)).toEqual(phrases[index]);
      expect(buildMusicPhrase(profile, true)).not.toEqual(phrases[index]);
      expect(profile.motif?.every((degree) => Number.isInteger(degree) && degree >= 0)).toBe(true);
    }
  });

  it("covers all city and island interiors with distinct scores", () => {
    const signatures = new Set<string>();
    for (const city of CITIES) {
      expect(CITY_OVERRIDES[city.name], city.name).toBeDefined();
      const profile = getProfileForCity(city.name);
      signatures.add(JSON.stringify([profile.bpm, profile.wave, buildMusicPhrase(profile, false)]));
    }
    expect(signatures.size).toBe(CITIES.length);
  });

  it("gives every dungeon a distinct theme that does not fall back to its entrance biome", () => {
    const phrases = new Set<string>();
    for (const dungeon of DUNGEONS) {
      const profile = getProfileForDungeon(dungeon.id);
      expect(profile, dungeon.id).toBe(DUNGEON_PROFILES[dungeon.id]);
      phrases.add(JSON.stringify(buildMusicPhrase(profile, false)));
    }
    expect(phrases.size).toBe(DUNGEONS.length);
  });

  it("never consumes gameplay RNG or changes shared profiles when building day and night phrases", () => {
    const before = JSON.stringify([BIOME_PROFILES, CITY_OVERRIDES, DUNGEON_PROFILES]);
    const random = vi.spyOn(Math, "random");
    try {
      for (const profile of [...Object.values(BIOME_PROFILES), ...Object.values(DUNGEON_PROFILES)]) {
        expect(buildMusicPhrase(profile, false).every(Number.isFinite)).toBe(true);
        expect(buildMusicPhrase(profile, true).every(Number.isFinite)).toBe(true);
      }
      expect(random).not.toHaveBeenCalled();
      expect(JSON.stringify([BIOME_PROFILES, CITY_OVERRIDES, DUNGEON_PROFILES])).toBe(before);
    } finally {
      random.mockRestore();
    }
  });
});

describe("area music playback selection", () => {
  afterEach(() => {
    audioEngine.stopAll();
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("preserves a playing area track, switches interiors and restores day/night exploration", () => {
    vi.useFakeTimers();
    const notes: Array<{ frequency: number; wave: string }> = [];
    vi.stubGlobal("AudioContext", class {
      readonly destination = {};
      readonly sampleRate = 16;
      readonly currentTime = 0;
      readonly state = "running";

      createGain() {
        return {
          gain: {
            value: 0,
            setValueAtTime: vi.fn(),
            linearRampToValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
        };
      }

      createOscillator() {
        const oscillator = {
          type: "sine",
          frequency: {
            value: 0,
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
          connect: vi.fn(),
          start: vi.fn((): void => {
            notes.push({ frequency: oscillator.frequency.value, wave: oscillator.type });
          }),
          stop: vi.fn(),
        };
        return oscillator;
      }

      createBuffer() {
        return { getChannelData: () => new Float32Array(this.sampleRate) };
      }
    });
    audioEngine.init();
    audioEngine.playBiomeMusic("Heartlands", TimePeriod.Day);
    expect(audioEngine.state).toMatchObject({
      trackKind: "biome", trackId: "Rolling_day", nightMode: false,
    });
    vi.advanceTimersByTime(1000);
    expect(notes[0]).toEqual({
      frequency: buildMusicPhrase(BIOME_PROFILES.Rolling, false)[0], wave: "sine",
    });
    const schedule = vi.spyOn(globalThis, "setTimeout");
    audioEngine.playBiomeMusic("Western Plains", TimePeriod.Day);
    expect(schedule).not.toHaveBeenCalled();
    let noteOffset = notes.length;
    audioEngine.playCityMusic("Willowdale", TimePeriod.Day);
    expect(audioEngine.state).toMatchObject({
      trackKind: "city", trackId: "Willowdale_day", nightMode: false,
    });
    vi.advanceTimersByTime(1000);
    expect(notes[noteOffset]).toEqual({
      frequency: buildMusicPhrase(getProfileForCity("Willowdale"), false)[0], wave: "sine",
    });
    schedule.mockClear();
    audioEngine.playCityMusic("Willowdale", TimePeriod.Day);
    expect(schedule).not.toHaveBeenCalled();
    noteOffset = notes.length;
    audioEngine.playCityMusic("Willowdale", TimePeriod.Night);
    expect(audioEngine.state).toMatchObject({
      trackKind: "city", trackId: "Willowdale_night", nightMode: true,
    });
    vi.advanceTimersByTime(1000);
    expect(notes[noteOffset]).toEqual({
      frequency: buildMusicPhrase(getProfileForCity("Willowdale"), true)[0], wave: "sine",
    });
    noteOffset = notes.length;
    audioEngine.playDungeonMusic("heartlands_dungeon");
    expect(audioEngine.state).toMatchObject({
      trackKind: "dungeon", trackId: "heartlands_dungeon", nightMode: false,
    });
    vi.advanceTimersByTime(1000);
    expect(notes[noteOffset]).toEqual({
      frequency: buildMusicPhrase(DUNGEON_PROFILES.heartlands_dungeon, false)[0], wave: "triangle",
    });
    schedule.mockClear();
    audioEngine.playDungeonMusic("heartlands_dungeon");
    expect(schedule).not.toHaveBeenCalled();
    audioEngine.playDungeonMusic("frost_cavern");
    expect(audioEngine.state.trackId).toBe("frost_cavern");
    audioEngine.playSailingMusic(TimePeriod.Dusk);
    expect(audioEngine.state).toMatchObject({
      trackKind: "biome", trackId: "Sea_night", nightMode: true,
    });
    audioEngine.playBattleMusic();
    expect(audioEngine.state.trackKind).toBe("battle");
    audioEngine.playBiomeMusic("Eastern Desert", TimePeriod.Night);
    expect(audioEngine.state).toMatchObject({
      trackKind: "biome", trackId: "Arid_night", nightMode: true,
    });
    schedule.mockRestore();
  });
});
