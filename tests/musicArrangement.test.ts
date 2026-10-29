import { describe, expect, it, vi } from "vitest";
import {
  BATTLE_PROFILE,
  BIOME_PROFILES,
  DEFEAT_PROFILE,
  DUNGEON_PROFILES,
  ENDING_PROFILE,
  TITLE_PROFILE,
} from "../src/data/music";
import {
  buildMusicBar,
  buildMusicPhrase,
  getMusicPressure,
  type MusicContext,
} from "../src/systems/music";
import { WeatherType } from "../src/systems/weather";

const DAY: MusicContext = {
  kind: "biome",
  isNight: false,
  weather: WeatherType.Clear,
  pressure: 0,
};

describe("procedural music arrangement", () => {
  it("preserves the recognizable opening motif before developing it", () => {
    const profile = BIOME_PROFILES.Rolling;
    const opening = [0, 1, 2, 3].flatMap((bar) =>
      buildMusicBar(profile, bar, DAY).notes
        .filter((note) => note.instrument === "lead")
        .map((note) => note.frequency),
    );
    expect(opening).toEqual(buildMusicPhrase(profile, false));
    const signatures = [0, 4, 8, 12].map((bar) =>
      JSON.stringify(buildMusicBar(profile, bar, DAY)),
    );
    expect(new Set(signatures).size).toBe(4);
    expect([0, 4, 8, 12].map((bar) => buildMusicBar(profile, bar, DAY).section))
      .toEqual(["statement", "answer", "breath", "lift"]);
    expect(buildMusicBar(profile, 20, DAY).notes).not.toEqual(buildMusicBar(profile, 4, DAY).notes);
  });

  it("creates a quieter night arrangement, not just transposed pitches", () => {
    const profile = BIOME_PROFILES.Rolling;
    const day = buildMusicBar(profile, 12, DAY);
    const night = buildMusicBar(profile, 12, { ...DAY, isNight: true });
    expect(night.notes.length).toBeLessThan(day.notes.length);
    expect(night.notes.filter((note) => note.instrument === "kick")).toEqual([]);
    expect(night.notes.filter((note) => note.instrument === "lead")[0]?.volume)
      .toBeLessThan(day.notes.filter((note) => note.instrument === "lead")[0]!.volume);
    expect(night.notes.filter((note) => note.instrument === "lead")[0]?.frequency)
      .not.toBe(day.notes.filter((note) => note.instrument === "lead")[0]?.frequency);
  });

  it("responds to weather and party danger without changing the score tempo", () => {
    const profile = BIOME_PROFILES.Sea;
    const calm = buildMusicBar(profile, 0, DAY);
    const storm = buildMusicBar(profile, 0, { ...DAY, weather: WeatherType.Storm });
    const percussionCount = (bar: ReturnType<typeof buildMusicBar>): number =>
      bar.notes.filter((note) => note.instrument === "kick" || note.instrument === "hat").length;
    expect(percussionCount(storm)).toBeGreaterThan(percussionCount(calm));
    const combat = { ...DAY, kind: "battle" } as const;
    const steady = buildMusicBar(BATTLE_PROFILE, 0, combat);
    const danger = buildMusicBar(BATTLE_PROFILE, 0, { ...combat, pressure: 0.9 });
    expect(danger.notes.length).toBeGreaterThan(steady.notes.length);
    expect(danger.beats).toBe(steady.beats);
    expect(buildMusicBar(BATTLE_PROFILE, 0, { ...combat, pressure: 0.65 }).notes.length)
      .toBeGreaterThan(buildMusicBar(BATTLE_PROFILE, 0, { ...combat, pressure: 0.64 }).notes.length);
    expect(profile.bpm).toBe(76);
  });

  it("keeps solemn result themes free of combat drums even during a storm", () => {
    for (const [kind, profile] of [
      ["defeat", DEFEAT_PROFILE],
      ["ending", ENDING_PROFILE],
      ["title", TITLE_PROFILE],
    ] as const) {
      for (let bar = 0; bar < 16; bar++) {
        expect(buildMusicBar(profile, bar, {
          ...DAY, kind, pressure: 1, weather: WeatherType.Storm,
        }).notes.some((note) => note.instrument === "kick" || note.instrument === "hat"))
          .toBe(false);
      }
    }
  });

  it("bounds synthesis work, frequencies, envelopes and positions for every score", () => {
    const profiles = [
      ...Object.values(BIOME_PROFILES),
      ...Object.values(DUNGEON_PROFILES),
      BATTLE_PROFILE, TITLE_PROFILE, ENDING_PROFILE, DEFEAT_PROFILE,
    ];
    for (const profile of profiles) {
      for (const isNight of [false, true]) {
        for (let index = 0; index < 64; index++) {
          const bar = buildMusicBar(profile, index, {
            ...DAY, kind: "boss", isNight, pressure: 1, weather: WeatherType.Storm,
          });
          expect(bar.beats).toBe(4);
          expect(bar.notes.length).toBeLessThanOrEqual(32);
          for (const note of bar.notes) {
            expect(note.frequency).toBeGreaterThan(0);
            expect(Number.isFinite(note.frequency)).toBe(true);
            expect(note.volume).toBeGreaterThan(0);
            expect(note.volume).toBeLessThanOrEqual(0.18);
            expect(note.offsetBeats).toBeGreaterThanOrEqual(0);
            expect(note.offsetBeats).toBeLessThan(4);
            expect(note.durationBeats).toBeGreaterThan(0);
            expect(note.durationBeats).toBeLessThanOrEqual(4);
          }
        }
      }
    }
  });

  it("is deterministic and neither mutates definitions nor consumes gameplay RNG", () => {
    const profile = BIOME_PROFILES.Woodland;
    const before = JSON.stringify(profile);
    const random = vi.spyOn(Math, "random");
    try {
      for (let bar = 0; bar < 32; bar++) {
        expect(buildMusicBar(profile, bar, DAY)).toEqual(buildMusicBar(profile, bar, DAY));
      }
      expect(random).not.toHaveBeenCalled();
      expect(JSON.stringify(profile)).toBe(before);
    } finally {
      random.mockRestore();
    }
  });

  it("derives battle pressure from the whole party, including knocked-out allies", () => {
    expect(getMusicPressure([])).toBe(0);
    expect(getMusicPressure([{ currentHp: 30, maxHp: 30 }])).toBe(0);
    expect(getMusicPressure([{ currentHp: 3, maxHp: 30 }])).toBeCloseTo(0.9);
    expect(getMusicPressure([
      { currentHp: 30, maxHp: 30 }, { currentHp: 0, maxHp: 30 },
    ])).toBe(0.5);
    expect(getMusicPressure([{ currentHp: 0, maxHp: 30 }])).toBe(1);
  });
});
