import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { audioEngine } from "../src/systems/audio";
import { TimePeriod } from "../src/systems/daynight";
import { WeatherType } from "../src/systems/weather";
import { TRAP_TYPES } from "../src/data/traps";
import { MockAudioContext } from "./helpers/audioContext";

let context: MockAudioContext;

beforeAll(() => {
  vi.useFakeTimers();
  vi.stubGlobal("AudioContext", MockAudioContext);
  const random = vi.spyOn(Math, "random");
  audioEngine.init();
  expect(random).not.toHaveBeenCalled();
  random.mockRestore();
  context = MockAudioContext.instances[MockAudioContext.instances.length - 1]!;
});

afterEach(() => audioEngine.stopAll());
afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("procedural audio resource ownership", () => {
  it("reuses one noise buffer and does not restart an unchanged weather overlay", () => {
    const buffers = context.buffers.length;
    audioEngine.playWeatherSFX(WeatherType.Rain);
    const nodes = context.nodes.length;
    for (let index = 0; index < 30; index++) audioEngine.playWeatherSFX(WeatherType.Rain);
    expect(context.nodes).toHaveLength(nodes);
    for (const weather of [
      WeatherType.Snow, WeatherType.Sandstorm, WeatherType.Storm, WeatherType.Fog, WeatherType.Clear,
    ]) audioEngine.playWeatherSFX(weather);
    expect(context.buffers).toHaveLength(buffers);
    expect(buffers).toBe(1);
  });

  it("disconnects ambient loops and in-flight thunder exactly once", () => {
    const offset = context.nodes.length;
    audioEngine.playWeatherSFX(WeatherType.Storm);
    audioEngine.playWeatherSFX(WeatherType.Clear);
    audioEngine.stopAll();
    vi.advanceTimersByTime(10_000);
    expect(context.nodes.slice(offset).every((node) => node.disconnect.mock.calls.length === 1)).toBe(true);
  });

  it("keeps music playing while unchanged weather is refreshed and pressure is updated", () => {
    audioEngine.playBattleMusic();
    audioEngine.setBattleMusicPressure([{ currentHp: 3, maxHp: 30 }]);
    vi.advanceTimersByTime(2000);
    const bar = audioEngine.musicPlaybackState!.bar;
    audioEngine.playWeatherSFX(WeatherType.Storm);
    expect(audioEngine.musicPlaybackState).toMatchObject({
      bar, pressure: 0.9, weather: WeatherType.Storm,
    });
    audioEngine.playBiomeMusic("Heartlands", TimePeriod.Day);
    expect(audioEngine.musicPlaybackState!.pressure).toBe(0);
  });

  it("never consumes gameplay RNG for ambience, trap noise, dialogue or campfire variation", () => {
    const random = vi.spyOn(Math, "random");
    try {
      for (const weather of Object.values(WeatherType)) audioEngine.playWeatherSFX(weather);
      for (const type of TRAP_TYPES) audioEngine.playTrapSFX(type);
      audioEngine.playDialogueBlips("Synthetic fixture dialogue with no character data.");
      audioEngine.playCampfireSFX();
      vi.advanceTimersByTime(2000);
      expect(random).not.toHaveBeenCalled();
    } finally {
      random.mockRestore();
    }
  });

  it("releases every trap oscillator, noise source and envelope after playback", () => {
    const offset = context.nodes.length;
    for (const type of TRAP_TYPES) audioEngine.playTrapSFX(type);
    vi.advanceTimersByTime(3000);
    expect(context.nodes.slice(offset).every((node) => node.disconnect.mock.calls.length === 1)).toBe(true);
    expect(context.buffers).toHaveLength(1);
  });

  it("keeps outdoor ambience out of title/ending and dungeon arrangements", () => {
    audioEngine.playWeatherSFX(WeatherType.Snow);
    audioEngine.playDungeonMusic("heartlands_dungeon");
    expect(audioEngine.musicPlaybackState!.weather).toBe(WeatherType.Clear);
    audioEngine.playWeatherSFX(WeatherType.Storm);
    audioEngine.playTitleMusic();
    expect(audioEngine.musicPlaybackState!.weather).toBe(WeatherType.Clear);
    audioEngine.playWeatherSFX(WeatherType.Rain);
    audioEngine.playEndingMusic();
    expect(audioEngine.musicPlaybackState!.weather).toBe(WeatherType.Clear);
  });
});
