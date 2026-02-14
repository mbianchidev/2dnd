import { describe, it, expect } from "vitest";
import {
  WeatherType,
  createWeatherState,
  rollWeather,
  advanceWeather,
  changeZoneWeather,
  getWeatherAccuracyPenalty,
  getWeatherEncounterMultiplier,
  getMonsterWeatherBoost,
  WEATHER_TINT,
  WEATHER_LABEL,
} from "../src/systems/weather";

describe("weather system", () => {
  describe("createWeatherState", () => {
    it("starts with Clear weather", () => {
      const state = createWeatherState();
      expect(state.current).toBe(WeatherType.Clear);
    });

    it("has a positive stepsUntilChange", () => {
      const state = createWeatherState();
      expect(state.stepsUntilChange).toBeGreaterThan(0);
    });
  });

  describe("rollWeather", () => {
    it("returns a valid WeatherType for known biomes", () => {
      const validTypes = Object.values(WeatherType);
      for (let i = 0; i < 50; i++) {
        const weather = rollWeather("Eastern Desert", 30);
        expect(validTypes).toContain(weather);
      }
    });

    it("returns a valid WeatherType for unknown biomes", () => {
      const validTypes = Object.values(WeatherType);
      for (let i = 0; i < 20; i++) {
        const weather = rollWeather("Unknown Biome", 0);
        expect(validTypes).toContain(weather);
      }
    });

    it("can produce Sandstorm in Eastern Desert", () => {
      let foundSandstorm = false;
      for (let i = 0; i < 200; i++) {
        if (rollWeather("Eastern Desert", 30) === WeatherType.Sandstorm) {
          foundSandstorm = true;
          break;
        }
      }
      expect(foundSandstorm).toBe(true);
    });

    it("can produce Snow in Mountain Peak", () => {
      let foundSnow = false;
      for (let i = 0; i < 200; i++) {
        if (rollWeather("Mountain Peak", 50) === WeatherType.Snow) {
          foundSnow = true;
          break;
        }
      }
      expect(foundSnow).toBe(true);
    });

    it("can produce Fog in Misty Highlands", () => {
      let foundFog = false;
      for (let i = 0; i < 200; i++) {
        if (rollWeather("Misty Highlands", 0) === WeatherType.Fog) {
          foundFog = true;
          break;
        }
      }
      expect(foundFog).toBe(true);
    });

    it("can produce Snow in Frozen biomes via prefix matching", () => {
      let foundSnow = false;
      for (let i = 0; i < 200; i++) {
        if (rollWeather("Frozen Reach", 50) === WeatherType.Snow) {
          foundSnow = true;
          break;
        }
      }
      expect(foundSnow).toBe(true);
    });

    it("can produce Fog in Murky biomes via prefix matching", () => {
      let foundFog = false;
      for (let i = 0; i < 200; i++) {
        if (rollWeather("Murky Expanse", 0) === WeatherType.Fog) {
          foundFog = true;
          break;
        }
      }
      expect(foundFog).toBe(true);
    });

    it("can produce Sandstorm in Scorched biomes via prefix matching", () => {
      let foundSandstorm = false;
      for (let i = 0; i < 200; i++) {
        if (rollWeather("Scorched Hollow", 30) === WeatherType.Sandstorm) {
          foundSandstorm = true;
          break;
        }
      }
      expect(foundSandstorm).toBe(true);
    });

    it("can produce Sandstorm in Rocky biomes via prefix matching", () => {
      let foundSandstorm = false;
      for (let i = 0; i < 200; i++) {
        if (rollWeather("Rocky Crossing", 30) === WeatherType.Sandstorm) {
          foundSandstorm = true;
          break;
        }
      }
      expect(foundSandstorm).toBe(true);
    });

    it("can produce Rain in Woodland biomes via prefix matching", () => {
      let foundRain = false;
      for (let i = 0; i < 200; i++) {
        if (rollWeather("Woodland Frontier", 50) === WeatherType.Rain) {
          foundRain = true;
          break;
        }
      }
      expect(foundRain).toBe(true);
    });
  });

  describe("advanceWeather", () => {
    it("does not change weather before countdown reaches zero", () => {
      const state = createWeatherState();
      state.stepsUntilChange = 5;
      const original = state.current;
      advanceWeather(state, "Heartlands", 0);
      expect(state.stepsUntilChange).toBe(4);
      expect(state.current).toBe(original);
    });

    it("rolls new weather when countdown reaches zero", () => {
      const state = createWeatherState();
      state.stepsUntilChange = 1;
      advanceWeather(state, "Heartlands", 0);
      // After rolling, stepsUntilChange should be reset to 40-80
      expect(state.stepsUntilChange).toBeGreaterThanOrEqual(40);
      expect(state.stepsUntilChange).toBeLessThanOrEqual(80);
    });

    it("returns true when weather changes", () => {
      // Force a change by running many advances on a biome with high weather chance
      let changed = false;
      for (let i = 0; i < 100; i++) {
        const state = createWeatherState();
        state.stepsUntilChange = 1;
        if (advanceWeather(state, "Mountain Peak", 100)) {
          changed = true;
          break;
        }
      }
      expect(changed).toBe(true);
    });

    it("returns false when weather stays the same", () => {
      const state = createWeatherState();
      state.stepsUntilChange = 10;
      const result = advanceWeather(state, "Heartlands", 0);
      expect(result).toBe(false);
    });
  });

  describe("changeZoneWeather", () => {
    it("immediately rolls new weather regardless of countdown", () => {
      const state = createWeatherState();
      state.stepsUntilChange = 999; // would never trigger advanceWeather
      changeZoneWeather(state, "Mountain Peak", 100);
      // stepsUntilChange should reset to 40-80
      expect(state.stepsUntilChange).toBeGreaterThanOrEqual(40);
      expect(state.stepsUntilChange).toBeLessThanOrEqual(80);
    });

    it("can change weather from Clear", () => {
      let changed = false;
      for (let i = 0; i < 200; i++) {
        const state = createWeatherState(); // starts Clear
        if (changeZoneWeather(state, "Mountain Peak", 100)) {
          changed = true;
          expect(state.current).not.toBe(WeatherType.Clear);
          break;
        }
      }
      expect(changed).toBe(true);
    });

    it("returns false when weather stays the same after re-roll", () => {
      // Use heartlands = low weather probability, run many times
      let gotFalse = false;
      for (let i = 0; i < 200; i++) {
        const state = createWeatherState();
        if (!changeZoneWeather(state, "Heartlands", 0)) {
          gotFalse = true;
          break;
        }
      }
      expect(gotFalse).toBe(true);
    });

    it("returns a valid WeatherType after zone change", () => {
      const validTypes = Object.values(WeatherType);
      for (let i = 0; i < 50; i++) {
        const state = createWeatherState();
        changeZoneWeather(state, "Eastern Desert", 30);
        expect(validTypes).toContain(state.current);
      }
    });
  });

  describe("getWeatherAccuracyPenalty", () => {
    it("returns 0 for Clear", () => {
      expect(getWeatherAccuracyPenalty(WeatherType.Clear)).toBe(0);
    });

    it("returns 1 for Rain", () => {
      expect(getWeatherAccuracyPenalty(WeatherType.Rain)).toBe(1);
    });

    it("returns 2 for Sandstorm", () => {
      expect(getWeatherAccuracyPenalty(WeatherType.Sandstorm)).toBe(2);
    });

    it("returns 3 for Fog", () => {
      expect(getWeatherAccuracyPenalty(WeatherType.Fog)).toBe(3);
    });

    it("returns 2 for Storm", () => {
      expect(getWeatherAccuracyPenalty(WeatherType.Storm)).toBe(2);
    });
  });

  describe("getWeatherEncounterMultiplier", () => {
    it("returns 1.0 for Clear", () => {
      expect(getWeatherEncounterMultiplier(WeatherType.Clear)).toBe(1.0);
    });

    it("returns > 1.0 for Storm", () => {
      expect(getWeatherEncounterMultiplier(WeatherType.Storm)).toBeGreaterThan(1.0);
    });

    it("returns < 1.0 for Snow", () => {
      expect(getWeatherEncounterMultiplier(WeatherType.Snow)).toBeLessThan(1.0);
    });

    it("returns a positive value for all types", () => {
      for (const wt of Object.values(WeatherType)) {
        expect(getWeatherEncounterMultiplier(wt)).toBeGreaterThan(0);
      }
    });
  });

  describe("getMonsterWeatherBoost", () => {
    it("returns no boost for unknown monster", () => {
      const boost = getMonsterWeatherBoost("nonexistent", WeatherType.Rain);
      expect(boost.initiativeBonus).toBe(0);
      expect(boost.attackBonus).toBe(0);
    });

    it("returns boost for wolf in Snow", () => {
      const boost = getMonsterWeatherBoost("wolf", WeatherType.Snow);
      expect(boost.initiativeBonus).toBe(2);
      expect(boost.attackBonus).toBe(1);
    });

    it("returns no boost for wolf in Clear", () => {
      const boost = getMonsterWeatherBoost("wolf", WeatherType.Clear);
      expect(boost.initiativeBonus).toBe(0);
    });

    it("returns boost for skeleton in Sandstorm", () => {
      const boost = getMonsterWeatherBoost("skeleton", WeatherType.Sandstorm);
      expect(boost.initiativeBonus).toBe(2);
    });

    it("returns boost for wraith in Fog", () => {
      const boost = getMonsterWeatherBoost("wraith", WeatherType.Fog);
      expect(boost.initiativeBonus).toBe(2);
    });

    it("returns boost for slime in Rain", () => {
      const boost = getMonsterWeatherBoost("slime", WeatherType.Rain);
      expect(boost.initiativeBonus).toBe(2);
    });

    it("returns a copy of the boost object", () => {
      const boost1 = getMonsterWeatherBoost("wolf", WeatherType.Snow);
      const boost2 = getMonsterWeatherBoost("wolf", WeatherType.Snow);
      boost1.initiativeBonus = 99;
      expect(boost2.initiativeBonus).toBe(2);
    });

    it("returns boost for frostGiant in Snow", () => {
      const boost = getMonsterWeatherBoost("frostGiant", WeatherType.Snow);
      expect(boost.initiativeBonus).toBe(2);
      expect(boost.attackBonus).toBe(1);
    });

    it("returns boost for swampHydra in Fog", () => {
      const boost = getMonsterWeatherBoost("swampHydra", WeatherType.Fog);
      expect(boost.initiativeBonus).toBe(2);
    });

    it("returns boost for volcanicWyrm in Sandstorm", () => {
      const boost = getMonsterWeatherBoost("volcanicWyrm", WeatherType.Sandstorm);
      expect(boost.initiativeBonus).toBe(2);
    });

    it("returns boost for canyonDrake in Sandstorm", () => {
      const boost = getMonsterWeatherBoost("canyonDrake", WeatherType.Sandstorm);
      expect(boost.initiativeBonus).toBe(2);
    });
  });

  describe("display data", () => {
    it("has a tint for every weather type", () => {
      for (const wt of Object.values(WeatherType)) {
        expect(WEATHER_TINT[wt]).toBeDefined();
        expect(typeof WEATHER_TINT[wt]).toBe("number");
      }
    });

    it("has a label for every weather type", () => {
      for (const wt of Object.values(WeatherType)) {
        expect(WEATHER_LABEL[wt]).toBeDefined();
        expect(WEATHER_LABEL[wt].length).toBeGreaterThan(0);
      }
    });

    it("Clear tint is white (no tint)", () => {
      expect(WEATHER_TINT[WeatherType.Clear]).toBe(0xffffff);
    });
  });
});
