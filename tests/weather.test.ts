import { describe, it, expect } from "vitest";
import {
  WeatherType,
  TimeOfDay,
  createWeatherState,
  rollWeather,
  updateWeather,
  getDominantTerrain,
  getTimeOfDay,
  getWeatherAccuracyPenalty,
  getWeatherEncounterMult,
  WEATHER_COMBAT_MODIFIERS,
  WEATHER_INFO,
} from "../src/systems/weather";
import { Terrain } from "../src/data/map";

describe("weather system", () => {
  describe("createWeatherState", () => {
    it("creates default state with clear weather and daytime", () => {
      const state = createWeatherState();
      expect(state.current).toBe(WeatherType.Clear);
      expect(state.timeOfDay).toBe(TimeOfDay.Day);
      expect(state.stepsSinceChange).toBe(0);
    });
  });

  describe("rollWeather", () => {
    it("returns a valid weather type for grass terrain", () => {
      const validWeathers = new Set(Object.values(WeatherType));
      for (let i = 0; i < 50; i++) {
        const weather = rollWeather(Terrain.Grass, TimeOfDay.Day);
        expect(validWeathers.has(weather)).toBe(true);
      }
    });

    it("returns a valid weather type for sand terrain", () => {
      const validWeathers = new Set(Object.values(WeatherType));
      for (let i = 0; i < 50; i++) {
        const weather = rollWeather(Terrain.Sand, TimeOfDay.Day);
        expect(validWeathers.has(weather)).toBe(true);
      }
    });

    it("returns a valid weather type for mountain terrain", () => {
      const validWeathers = new Set(Object.values(WeatherType));
      for (let i = 0; i < 50; i++) {
        const weather = rollWeather(Terrain.Mountain, TimeOfDay.Night);
        expect(validWeathers.has(weather)).toBe(true);
      }
    });

    it("produces sandstorm more often in desert during the day", () => {
      let sandstormCountDay = 0;
      let sandstormCountNight = 0;
      const trials = 1000;
      for (let i = 0; i < trials; i++) {
        if (rollWeather(Terrain.Sand, TimeOfDay.Day) === WeatherType.Sandstorm) sandstormCountDay++;
        if (rollWeather(Terrain.Sand, TimeOfDay.Night) === WeatherType.Sandstorm) sandstormCountNight++;
      }
      // Sandstorm should be more common during the day in desert
      expect(sandstormCountDay).toBeGreaterThan(sandstormCountNight);
    });

    it("uses deterministic rng when provided", () => {
      // rng that always returns 0 should give the first entry
      const weather = rollWeather(Terrain.Grass, TimeOfDay.Day, () => 0);
      expect(weather).toBe(WeatherType.Clear);
    });

    it("handles unknown terrain by using default weights", () => {
      const weather = rollWeather(Terrain.Town, TimeOfDay.Day);
      const validWeathers = new Set(Object.values(WeatherType));
      expect(validWeathers.has(weather)).toBe(true);
    });
  });

  describe("getDominantTerrain", () => {
    it("returns the most common terrain in a chunk", () => {
      const mapData: Terrain[][] = [
        [Terrain.Sand, Terrain.Sand, Terrain.Sand],
        [Terrain.Sand, Terrain.Grass, Terrain.Sand],
        [Terrain.Sand, Terrain.Sand, Terrain.Sand],
      ];
      expect(getDominantTerrain(mapData)).toBe(Terrain.Sand);
    });

    it("ignores path and town tiles", () => {
      const mapData: Terrain[][] = [
        [Terrain.Path, Terrain.Path, Terrain.Path],
        [Terrain.Forest, Terrain.Forest, Terrain.Town],
        [Terrain.Forest, Terrain.Path, Terrain.Forest],
      ];
      expect(getDominantTerrain(mapData)).toBe(Terrain.Forest);
    });

    it("defaults to Grass for empty-ish maps", () => {
      const mapData: Terrain[][] = [
        [Terrain.Path, Terrain.Town, Terrain.Path],
      ];
      expect(getDominantTerrain(mapData)).toBe(Terrain.Grass);
    });
  });

  describe("getTimeOfDay", () => {
    it("cycles through different times of day", () => {
      const seenTimes = new Set<TimeOfDay>();
      for (let step = 0; step < 500; step += 10) {
        seenTimes.add(getTimeOfDay(step));
      }
      expect(seenTimes.size).toBeGreaterThanOrEqual(3);
      expect(seenTimes.has(TimeOfDay.Day)).toBe(true);
      expect(seenTimes.has(TimeOfDay.Night)).toBe(true);
    });
  });

  describe("updateWeather", () => {
    it("does not change weather before minimum steps", () => {
      const state = createWeatherState();
      const changed = updateWeather(state, Terrain.Grass, 10);
      expect(changed).toBe(false);
      expect(state.current).toBe(WeatherType.Clear);
    });

    it("can change weather after enough steps with high rng", () => {
      const state = createWeatherState();
      state.stepsSinceChange = 31; // past minimum
      // Start with Rain so Clear (the most likely pick) counts as a change
      state.current = WeatherType.Rain;
      // rng=0.1 is under WEATHER_CHANGE_CHANCE (0.25) so change triggers,
      // and with forest biome it picks the first weighted entry (Clear).
      const changed = updateWeather(state, Terrain.Forest, 100, () => 0.1);
      expect(changed).toBe(true);
      expect(state.current).toBe(WeatherType.Clear);
    });

    it("updates time of day based on total steps", () => {
      const state = createWeatherState();
      updateWeather(state, Terrain.Grass, 0);
      const time0 = state.timeOfDay;
      updateWeather(state, Terrain.Grass, 100);
      const time100 = state.timeOfDay;
      // Different step counts should potentially yield different times
      expect(typeof time0).toBe("string");
      expect(typeof time100).toBe("string");
    });
  });

  describe("combat modifiers", () => {
    it("clear weather has no accuracy penalty", () => {
      expect(getWeatherAccuracyPenalty(WeatherType.Clear)).toBe(0);
    });

    it("rain has a small accuracy penalty", () => {
      expect(getWeatherAccuracyPenalty(WeatherType.Rain)).toBe(1);
    });

    it("fog has the highest accuracy penalty", () => {
      expect(getWeatherAccuracyPenalty(WeatherType.Fog)).toBe(3);
    });

    it("storm has accuracy penalty of 2", () => {
      expect(getWeatherAccuracyPenalty(WeatherType.Storm)).toBe(2);
    });

    it("sandstorm has accuracy penalty of 2", () => {
      expect(getWeatherAccuracyPenalty(WeatherType.Sandstorm)).toBe(2);
    });

    it("all weather types have defined combat modifiers", () => {
      for (const w of Object.values(WeatherType)) {
        expect(WEATHER_COMBAT_MODIFIERS[w]).toBeDefined();
        expect(typeof WEATHER_COMBAT_MODIFIERS[w].accuracyPenalty).toBe("number");
        expect(typeof WEATHER_COMBAT_MODIFIERS[w].encounterRateMult).toBe("number");
      }
    });

    it("fog increases encounter rate", () => {
      expect(getWeatherEncounterMult(WeatherType.Fog)).toBeGreaterThan(1.0);
    });

    it("snow reduces encounter rate", () => {
      expect(getWeatherEncounterMult(WeatherType.Snow)).toBeLessThan(1.0);
    });
  });

  describe("weather info", () => {
    it("all weather types have display info", () => {
      for (const w of Object.values(WeatherType)) {
        const info = WEATHER_INFO[w];
        expect(info).toBeDefined();
        expect(info.label).toBeTruthy();
        expect(info.icon).toBeTruthy();
      }
    });
  });
});
