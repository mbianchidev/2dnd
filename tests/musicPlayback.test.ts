import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BATTLE_PROFILE, BIOME_PROFILES } from "../src/data/music";
import { ProceduralMusicPlayer } from "../src/systems/musicPlayback";
import { WeatherType } from "../src/systems/weather";
import { MockAudioContext } from "./helpers/audioContext";
import type { MusicContext } from "../src/systems/music";

const DAY: MusicContext = {
  kind: "biome", isNight: false, weather: WeatherType.Clear, pressure: 0,
};
let player: ProceduralMusicPlayer;
let context: MockAudioContext;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("AudioContext", MockAudioContext);
  const nativeContext = new AudioContext();
  context = MockAudioContext.instances[MockAudioContext.instances.length - 1]!;
  player = new ProceduralMusicPlayer(
    nativeContext, nativeContext.createGain(), nativeContext.createBuffer(1, 64, 64),
  );
});

afterEach(() => {
  player.destroy();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("audio-clock music playback", () => {
  it("schedules exact beat times ahead of the audio clock instead of playing on timer ticks", () => {
    player.play(BIOME_PROFILES.Rolling, DAY);
    vi.advanceTimersByTime(2700);
    const lead = context.started.filter((note) => note.wave === "sine" && note.frequency > 300);
    const first = lead[0]!;
    expect(first.time).toBeCloseTo(0.02);
    const nextBeat = context.started.find((note) =>
      Math.abs(note.time - (0.02 + 60 / BIOME_PROFILES.Rolling.bpm)) < 0.00001,
    );
    expect(nextBeat).toBeDefined();
    expect(player.snapshot.scheduling).toBe(true);
    expect(player.snapshot.bar).toBeGreaterThanOrEqual(1);
  });

  it("disconnects ended voices and keeps graph size bounded over a long session", () => {
    player.play(BATTLE_PROFILE, { ...DAY, kind: "boss", pressure: 1 });
    for (let second = 0; second < 180; second++) {
      vi.advanceTimersByTime(1000);
      expect(player.snapshot.activeVoices).toBeLessThanOrEqual(24);
      expect(player.snapshot.activeTracks).toBe(1);
    }
    player.stop();
    expect(player.snapshot).toMatchObject({ activeVoices: 0, activeTracks: 0, scheduling: false });
    expect(context.nodes.slice(1).every((node) => node.disconnect.mock.calls.length === 1)).toBe(true);
    expect(context.started.every((note) => note.source.onended === null)).toBe(true);
  });

  it("overlaps two independently gained tracks, then removes the outgoing track", () => {
    player.play(BIOME_PROFILES.Rolling, DAY);
    const firstSources = context.started.map((note) => note.source);
    player.play(BIOME_PROFILES.Arid, DAY);
    expect(player.snapshot.activeTracks).toBe(2);
    vi.advanceTimersByTime(700);
    expect(player.snapshot.activeTracks).toBe(1);
    expect(firstSources.every((source) => source.disconnect.mock.calls.length === 1)).toBe(true);
  });

  it("cancels every stale crossfade and future voice after rapid track changes or stop", () => {
    for (const profile of Object.values(BIOME_PROFILES)) {
      player.play(profile, DAY);
      expect(player.snapshot.activeTracks).toBeLessThanOrEqual(2);
    }
    player.playVictory();
    expect(player.snapshot.scheduling).toBe(false);
    player.stop();
    const noteCount = context.started.length;
    vi.advanceTimersByTime(5000);
    expect(context.started).toHaveLength(noteCount);
    expect(player.snapshot.activeTracks).toBe(0);
    expect(context.nodes.slice(1).every((node) => node.disconnect.mock.calls.length === 1)).toBe(true);
  });

  it("skips a stalled clock without synthesizing missed beats in a burst", () => {
    player.play(BATTLE_PROFILE, { ...DAY, kind: "battle" });
    const before = context.started.length;
    context.clockOffset = 120;
    vi.advanceTimersByTime(25);
    expect(context.started.length - before).toBeLessThanOrEqual(8);
    expect(context.started.slice(before).every((note) => note.time >= context.currentTime - 0.025)).toBe(true);
  });

  it("adapts weather and pressure at the next bar without restarting the musical clock", () => {
    player.play(BATTLE_PROFILE, { ...DAY, kind: "battle" });
    vi.advanceTimersByTime(2000);
    const bar = player.snapshot.bar;
    player.setPressure(0.9);
    player.setWeather(WeatherType.Storm);
    expect(player.snapshot).toMatchObject({ bar, pressure: 0.9, weather: WeatherType.Storm });
    vi.advanceTimersByTime(2000);
    expect(player.snapshot.bar).toBeGreaterThan(bar);
    expect(player.snapshot.activeTracks).toBe(1);
  });

  it("stops scheduling on suspension/hidden pages and safely resumes or closes", () => {
    player.play(BATTLE_PROFILE, { ...DAY, kind: "battle" });
    context.setState("suspended");
    const count = context.started.length;
    vi.advanceTimersByTime(1000);
    expect(context.started).toHaveLength(count);
    expect(player.snapshot.scheduling).toBe(false);
    context.setState("running");
    expect(player.snapshot.scheduling).toBe(true);
    player.setPaused(true);
    expect(player.snapshot.activeVoices).toBe(0);
    vi.advanceTimersByTime(3000);
    player.setPaused(false);
    expect(player.snapshot.activeTracks).toBe(1);
    expect(player.snapshot.scheduling).toBe(true);
    context.setState("closed");
    expect(player.snapshot).toMatchObject({ activeVoices: 0, activeTracks: 0, scheduling: false });
  });
});
