/**
 * Dynamic weather system — weather changes based on biome and time of day.
 * Weather affects combat (accuracy), encounter rates, and visual effects.
 */

import { Terrain } from "../data/map";

// ── Weather types ──────────────────────────────────────────────

export enum WeatherType {
  Clear = "clear",
  Rain = "rain",
  Snow = "snow",
  Sandstorm = "sandstorm",
  Storm = "storm",
  Fog = "fog",
}

export enum TimeOfDay {
  Dawn = "dawn",
  Day = "day",
  Dusk = "dusk",
  Night = "night",
}

// ── Weather display info ───────────────────────────────────────

export interface WeatherInfo {
  label: string;
  icon: string;
  tint: number;       // color overlay for the overworld
  alpha: number;      // overlay intensity
}

export const WEATHER_INFO: Record<WeatherType, WeatherInfo> = {
  [WeatherType.Clear]:     { label: "Clear",     icon: "☀",  tint: 0x000000, alpha: 0 },
  [WeatherType.Rain]:      { label: "Rain",      icon: "🌧",  tint: 0x2244aa, alpha: 0.15 },
  [WeatherType.Snow]:      { label: "Snow",      icon: "❄",  tint: 0xccddff, alpha: 0.12 },
  [WeatherType.Sandstorm]: { label: "Sandstorm", icon: "🌪",  tint: 0xaa8844, alpha: 0.2 },
  [WeatherType.Storm]:     { label: "Storm",     icon: "⛈",  tint: 0x111133, alpha: 0.25 },
  [WeatherType.Fog]:       { label: "Fog",       icon: "🌫",  tint: 0xcccccc, alpha: 0.22 },
};

// ── Combat modifiers per weather ───────────────────────────────

export interface WeatherCombatModifier {
  accuracyPenalty: number;  // subtracted from attack rolls (both player & monster)
  encounterRateMult: number; // multiplier for encounter rates
}

export const WEATHER_COMBAT_MODIFIERS: Record<WeatherType, WeatherCombatModifier> = {
  [WeatherType.Clear]:     { accuracyPenalty: 0, encounterRateMult: 1.0 },
  [WeatherType.Rain]:      { accuracyPenalty: 1, encounterRateMult: 0.8 },
  [WeatherType.Snow]:      { accuracyPenalty: 1, encounterRateMult: 0.7 },
  [WeatherType.Sandstorm]: { accuracyPenalty: 2, encounterRateMult: 0.5 },
  [WeatherType.Storm]:     { accuracyPenalty: 2, encounterRateMult: 0.6 },
  [WeatherType.Fog]:       { accuracyPenalty: 3, encounterRateMult: 1.2 },
};

// ── Biome-weather probability tables ───────────────────────────
// Each biome maps to possible weathers and their relative weights,
// optionally modified by time of day.

interface WeatherWeight {
  weather: WeatherType;
  weight: number;
  /** If set, weight is multiplied by this factor during the given time(s). */
  timeBonus?: { times: TimeOfDay[]; multiplier: number };
}

/**
 * Weather weights per dominant terrain. Weight values are relative —
 * they'll be normalised when rolling for weather.
 */
const BIOME_WEATHER_WEIGHTS: Partial<Record<Terrain, WeatherWeight[]>> = {
  [Terrain.Grass]: [
    { weather: WeatherType.Clear, weight: 60 },
    { weather: WeatherType.Rain, weight: 20 },
    { weather: WeatherType.Fog, weight: 10, timeBonus: { times: [TimeOfDay.Dawn, TimeOfDay.Night], multiplier: 2 } },
    { weather: WeatherType.Storm, weight: 10, timeBonus: { times: [TimeOfDay.Night], multiplier: 1.5 } },
  ],
  [Terrain.Forest]: [
    { weather: WeatherType.Clear, weight: 40 },
    { weather: WeatherType.Rain, weight: 30 },
    { weather: WeatherType.Fog, weight: 20, timeBonus: { times: [TimeOfDay.Dawn, TimeOfDay.Night], multiplier: 2 } },
    { weather: WeatherType.Storm, weight: 10 },
  ],
  [Terrain.Mountain]: [
    { weather: WeatherType.Clear, weight: 35 },
    { weather: WeatherType.Snow, weight: 30, timeBonus: { times: [TimeOfDay.Night], multiplier: 1.5 } },
    { weather: WeatherType.Fog, weight: 15, timeBonus: { times: [TimeOfDay.Dawn], multiplier: 2 } },
    { weather: WeatherType.Storm, weight: 15 },
    { weather: WeatherType.Rain, weight: 5 },
  ],
  [Terrain.Sand]: [
    { weather: WeatherType.Clear, weight: 50 },
    { weather: WeatherType.Sandstorm, weight: 30, timeBonus: { times: [TimeOfDay.Day], multiplier: 2 } },
    { weather: WeatherType.Fog, weight: 10, timeBonus: { times: [TimeOfDay.Night, TimeOfDay.Dawn], multiplier: 2 } },
    { weather: WeatherType.Storm, weight: 10, timeBonus: { times: [TimeOfDay.Night], multiplier: 1.5 } },
  ],
  [Terrain.Water]: [
    { weather: WeatherType.Clear, weight: 30 },
    { weather: WeatherType.Rain, weight: 25 },
    { weather: WeatherType.Storm, weight: 25, timeBonus: { times: [TimeOfDay.Night], multiplier: 1.5 } },
    { weather: WeatherType.Fog, weight: 20, timeBonus: { times: [TimeOfDay.Dawn], multiplier: 2 } },
  ],
};

/** Fallback weights when no biome-specific table exists. */
const DEFAULT_WEATHER_WEIGHTS: WeatherWeight[] = [
  { weather: WeatherType.Clear, weight: 65 },
  { weather: WeatherType.Rain, weight: 15 },
  { weather: WeatherType.Fog, weight: 10 },
  { weather: WeatherType.Storm, weight: 5 },
  { weather: WeatherType.Snow, weight: 5 },
];

// ── Weather state ──────────────────────────────────────────────

export interface WeatherState {
  current: WeatherType;
  timeOfDay: TimeOfDay;
  /** Steps since last weather change (resets on change). */
  stepsSinceChange: number;
}

/** Steps between possible weather re-rolls. */
const MIN_STEPS_BETWEEN_CHANGES = 30;
/** Probability of changing weather when eligible. */
const WEATHER_CHANGE_CHANCE = 0.25;

/** Create initial weather state. */
export function createWeatherState(): WeatherState {
  return {
    current: WeatherType.Clear,
    timeOfDay: TimeOfDay.Day,
    stepsSinceChange: 0,
  };
}

// ── Time-of-day cycle ──────────────────────────────────────────

const TIME_CYCLE: TimeOfDay[] = [
  TimeOfDay.Dawn,
  TimeOfDay.Day,
  TimeOfDay.Day,
  TimeOfDay.Dusk,
  TimeOfDay.Night,
  TimeOfDay.Night,
];
/** Steps per time-of-day phase. */
const STEPS_PER_TIME_PHASE = 50;

/** Advance the time of day based on total steps taken. */
export function getTimeOfDay(totalSteps: number): TimeOfDay {
  const phase = Math.floor(totalSteps / STEPS_PER_TIME_PHASE) % TIME_CYCLE.length;
  return TIME_CYCLE[phase];
}

// ── Weather roll ───────────────────────────────────────────────

/**
 * Pick a weather type based on the dominant terrain of the current chunk
 * and the current time of day.
 */
export function rollWeather(
  dominantTerrain: Terrain,
  timeOfDay: TimeOfDay,
  rng: () => number = Math.random
): WeatherType {
  const table = BIOME_WEATHER_WEIGHTS[dominantTerrain] ?? DEFAULT_WEATHER_WEIGHTS;
  const entries = table.map((entry) => {
    let w = entry.weight;
    if (entry.timeBonus && entry.timeBonus.times.includes(timeOfDay)) {
      w *= entry.timeBonus.multiplier;
    }
    return { weather: entry.weather, weight: w };
  });
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  let roll = rng() * total;
  for (const e of entries) {
    roll -= e.weight;
    if (roll <= 0) return e.weather;
  }
  return WeatherType.Clear;
}

/**
 * Determine the dominant terrain in a chunk by counting tiles.
 * Returns the most common walkable terrain (ignoring paths, towns, etc.).
 */
export function getDominantTerrain(mapData: Terrain[][]): Terrain {
  const counts: Partial<Record<Terrain, number>> = {};
  const countable = new Set([Terrain.Grass, Terrain.Forest, Terrain.Mountain, Terrain.Water, Terrain.Sand]);
  for (const row of mapData) {
    for (const t of row) {
      if (countable.has(t)) {
        counts[t] = (counts[t] ?? 0) + 1;
      }
    }
  }
  let best: Terrain = Terrain.Grass;
  let bestCount = 0;
  for (const [t, c] of Object.entries(counts)) {
    if ((c as number) > bestCount) {
      bestCount = c as number;
      best = Number(t) as Terrain;
    }
  }
  return best;
}

// ── Step-based weather updates ─────────────────────────────────

/**
 * Called each time the player takes a step. May update weather and time of day.
 * Returns true if the weather actually changed.
 */
export function updateWeather(
  state: WeatherState,
  dominantTerrain: Terrain,
  totalSteps: number,
  rng: () => number = Math.random
): boolean {
  state.timeOfDay = getTimeOfDay(totalSteps);
  state.stepsSinceChange++;

  if (state.stepsSinceChange < MIN_STEPS_BETWEEN_CHANGES) return false;
  if (rng() > WEATHER_CHANGE_CHANCE) return false;

  const newWeather = rollWeather(dominantTerrain, state.timeOfDay, rng);
  if (newWeather === state.current) return false;

  state.current = newWeather;
  state.stepsSinceChange = 0;
  return true;
}

/** Get the accuracy penalty for the current weather. */
export function getWeatherAccuracyPenalty(weather: WeatherType): number {
  return WEATHER_COMBAT_MODIFIERS[weather].accuracyPenalty;
}

/** Get the encounter rate multiplier for the current weather. */
export function getWeatherEncounterMult(weather: WeatherType): number {
  return WEATHER_COMBAT_MODIFIERS[weather].encounterRateMult;
}
