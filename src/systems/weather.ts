/**
 * Dynamic weather system.
 *
 * Weather types: Clear, Rain, Snow, Sandstorm, Storm, Fog
 * Weather changes based on biome terrain + time of day via step-based updates.
 * Affects encounter rates, combat accuracy, and can boost certain monsters.
 */

import { type TimePeriod, getTimePeriod } from "./daynight";

// ── Weather Types ──────────────────────────────────────────────

export enum WeatherType {
  Clear = "Clear",
  Rain = "Rain",
  Snow = "Snow",
  Sandstorm = "Sandstorm",
  Storm = "Storm",
  Fog = "Fog",
}

// ── Weather State ──────────────────────────────────────────────

export interface WeatherState {
  current: WeatherType;
  /** Steps remaining until the next weather check. */
  stepsUntilChange: number;
}

/** Create a fresh weather state (starts clear). */
export function createWeatherState(): WeatherState {
  return { current: WeatherType.Clear, stepsUntilChange: 40 };
}

// ── Biome → Weather Probabilities ──────────────────────────────
//
// Each biome defines a weighted probability map for non-Clear weather.
// The values represent the chance (0–1) of transitioning to that weather.
// Remaining probability = Clear.  Probabilities are per-check, not per-step.

type WeatherWeights = Partial<Record<WeatherType, number>>;

/** Base weather weights by dominant terrain in the chunk. */
const BIOME_WEATHER: Record<string, WeatherWeights> = {
  // ── Original hand-crafted regions ────────────────────────────
  // Mountain Peak  – snow, fog, storm
  "Mountain Peak":    { [WeatherType.Snow]: 0.25, [WeatherType.Fog]: 0.05, [WeatherType.Storm]: 0.05 },
  // Northern Forest – rain, fog
  "Northern Forest":  { [WeatherType.Rain]: 0.05, [WeatherType.Fog]: 0.05 },
  // Misty Highlands – fog heavy, rain
  "Misty Highlands":  { [WeatherType.Fog]: 0.10, [WeatherType.Rain]: 0.05 },
  // Western Plains  – rain, storm
  "Western Plains":   { [WeatherType.Rain]: 0.05, [WeatherType.Storm]: 0.05 },
  // Heartlands      – mild rain
  "Heartlands":       { [WeatherType.Rain]: 0.05 },
  // Eastern Desert  – sandstorm dominant
  "Eastern Desert":   { [WeatherType.Sandstorm]: 0.25, [WeatherType.Storm]: 0.05 },
  // Marshlands      – fog, rain
  "Marshlands":       { [WeatherType.Fog]: 0.10, [WeatherType.Rain]: 0.05 },
  // Southern Forest – rain, fog
  "Southern Forest":  { [WeatherType.Rain]: 0.05, [WeatherType.Fog]: 0.05 },
  // Dragon's Domain – storm, fog
  "Dragon's Domain":  { [WeatherType.Storm]: 0.10, [WeatherType.Fog]: 0.05, [WeatherType.Rain]: 0.05 },
  // Frozen / Tundra biomes – snow heavy, storm
  "Frozen Expanse":   { [WeatherType.Snow]: 0.30, [WeatherType.Storm]: 0.05 },
  "Frozen Flats":     { [WeatherType.Snow]: 0.25, [WeatherType.Storm]: 0.05 },
  "Frozen Frontier":  { [WeatherType.Snow]: 0.25, [WeatherType.Fog]: 0.05 },
  "Frozen Hollow":    { [WeatherType.Snow]: 0.20, [WeatherType.Fog]: 0.10 },
  "Frozen Passage":   { [WeatherType.Snow]: 0.25, [WeatherType.Storm]: 0.05 },
  "Frozen Reach":     { [WeatherType.Snow]: 0.25, [WeatherType.Fog]: 0.05 },
  "Frozen Vale":      { [WeatherType.Snow]: 0.20, [WeatherType.Storm]: 0.10 },
  // Murky / Swamp biomes – fog, rain heavy
  "Murky Crossing":   { [WeatherType.Fog]: 0.15, [WeatherType.Rain]: 0.10 },
  "Murky Expanse":    { [WeatherType.Fog]: 0.20, [WeatherType.Rain]: 0.10 },
  "Murky Flats":      { [WeatherType.Fog]: 0.15, [WeatherType.Rain]: 0.10 },
  "Murky Passage":    { [WeatherType.Fog]: 0.15, [WeatherType.Rain]: 0.10 },
  "Murky Ridge":      { [WeatherType.Fog]: 0.10, [WeatherType.Rain]: 0.05 },
  "Murky Wilds":      { [WeatherType.Fog]: 0.20, [WeatherType.Rain]: 0.15 },
  // Woodland / Deep Forest biomes – rain, fog
  "Woodland Crossing": { [WeatherType.Rain]: 0.10, [WeatherType.Fog]: 0.05 },
  "Woodland Expanse":  { [WeatherType.Rain]: 0.10, [WeatherType.Fog]: 0.05 },
  "Woodland Flats":    { [WeatherType.Rain]: 0.10, [WeatherType.Fog]: 0.05 },
  "Woodland Frontier": { [WeatherType.Rain]: 0.05, [WeatherType.Fog]: 0.05 },
  "Woodland Hollow":   { [WeatherType.Rain]: 0.10, [WeatherType.Fog]: 0.10 },
  "Woodland Passage":  { [WeatherType.Rain]: 0.05, [WeatherType.Fog]: 0.05 },
  "Woodland Reach":    { [WeatherType.Rain]: 0.10, [WeatherType.Fog]: 0.05 },
  "Woodland Ridge":    { [WeatherType.Rain]: 0.05, [WeatherType.Fog]: 0.05 },
  "Woodland Wilds":    { [WeatherType.Rain]: 0.10, [WeatherType.Fog]: 0.10 },
  // Scorched / Volcanic biomes – sandstorm, storm
  "Scorched Expanse":  { [WeatherType.Sandstorm]: 0.20, [WeatherType.Storm]: 0.10 },
  "Scorched Hollow":   { [WeatherType.Sandstorm]: 0.15, [WeatherType.Storm]: 0.10 },
  // Highland biomes – fog, storm
  "Highland Crossing":  { [WeatherType.Fog]: 0.10, [WeatherType.Storm]: 0.05 },
  "Highland Ridge":     { [WeatherType.Fog]: 0.05, [WeatherType.Storm]: 0.10, [WeatherType.Snow]: 0.05 },
  "Highland Wilds":     { [WeatherType.Fog]: 0.10, [WeatherType.Storm]: 0.05 },
  // Rocky / Canyon / Arid biomes – sandstorm, storm
  "Rocky Crossing":   { [WeatherType.Sandstorm]: 0.10, [WeatherType.Storm]: 0.05 },
  "Rocky Expanse":    { [WeatherType.Sandstorm]: 0.10, [WeatherType.Storm]: 0.05 },
  "Rocky Flats":      { [WeatherType.Sandstorm]: 0.10 },
  "Rocky Frontier":   { [WeatherType.Sandstorm]: 0.05, [WeatherType.Storm]: 0.05 },
  "Rocky Hollow":     { [WeatherType.Sandstorm]: 0.05, [WeatherType.Fog]: 0.05 },
  "Rocky Passage":    { [WeatherType.Sandstorm]: 0.10 },
  "Rocky Reach":      { [WeatherType.Sandstorm]: 0.10, [WeatherType.Storm]: 0.05 },
  "Rocky Vale":       { [WeatherType.Sandstorm]: 0.05, [WeatherType.Fog]: 0.05 },
  "Rocky Wilds":      { [WeatherType.Sandstorm]: 0.10, [WeatherType.Storm]: 0.05 },
  "Arid Crossing":    { [WeatherType.Sandstorm]: 0.20 },
  "Arid Expanse":     { [WeatherType.Sandstorm]: 0.25, [WeatherType.Storm]: 0.05 },
  "Arid Flats":       { [WeatherType.Sandstorm]: 0.20 },
  "Arid Frontier":    { [WeatherType.Sandstorm]: 0.15 },
  "Arid Hollow":      { [WeatherType.Sandstorm]: 0.15, [WeatherType.Fog]: 0.05 },
  "Arid Passage":     { [WeatherType.Sandstorm]: 0.20 },
  "Arid Reach":       { [WeatherType.Sandstorm]: 0.20, [WeatherType.Storm]: 0.05 },
  "Arid Ridge":       { [WeatherType.Sandstorm]: 0.20, [WeatherType.Storm]: 0.05 },
  "Arid Vale":        { [WeatherType.Sandstorm]: 0.15, [WeatherType.Storm]: 0.05 },
  // Ancient biomes – mild mixed weather
  "Ancient Flats":    { [WeatherType.Rain]: 0.05, [WeatherType.Fog]: 0.05 },
  "Ancient Frontier": { [WeatherType.Rain]: 0.05 },
  "Ancient Passage":  { [WeatherType.Fog]: 0.05 },
  "Ancient Reach":    { [WeatherType.Rain]: 0.05, [WeatherType.Fog]: 0.05 },
  "Ancient Vale":     { [WeatherType.Fog]: 0.10 },
};

/**
 * Weather weights by biome prefix.  Procedurally generated chunks use names
 * like "Frozen Reach", "Murky Expanse", etc.  We match on the first word so
 * every chunk in a biome shares the same weather profile.
 */
const BIOME_PREFIX_WEATHER: Record<string, WeatherWeights> = {
  // Frozen / Tundra – heavy snow, blizzards
  "Frozen":   { [WeatherType.Snow]: 0.30, [WeatherType.Storm]: 0.08, [WeatherType.Fog]: 0.05 },
  // Murky / Swamp – fog, rain, storms
  "Murky":    { [WeatherType.Fog]: 0.15, [WeatherType.Rain]: 0.15, [WeatherType.Storm]: 0.05 },
  // Ancient / Deep Forest – fog, rain
  "Ancient":  { [WeatherType.Fog]: 0.10, [WeatherType.Rain]: 0.10 },
  // Scorched / Volcanic – sandstorms, storms (ash clouds)
  "Scorched": { [WeatherType.Sandstorm]: 0.20, [WeatherType.Storm]: 0.10 },
  // Rocky / Canyon – sandstorms, fog in crevasses
  "Rocky":    { [WeatherType.Sandstorm]: 0.10, [WeatherType.Fog]: 0.08, [WeatherType.Storm]: 0.05 },
  // Arid / Desert – sandstorm dominant
  "Arid":     { [WeatherType.Sandstorm]: 0.25, [WeatherType.Storm]: 0.05 },
  // Woodland / Forest – rain, fog
  "Woodland": { [WeatherType.Rain]: 0.08, [WeatherType.Fog]: 0.05 },
  // Highland / Mountain – snow, fog
  "Highland": { [WeatherType.Snow]: 0.15, [WeatherType.Fog]: 0.08, [WeatherType.Storm]: 0.05 },
  // Rolling / Plains – rain, storm
  "Rolling":  { [WeatherType.Rain]: 0.08, [WeatherType.Storm]: 0.05 },
};

/** Fallback for unknown or dungeon biomes. */
const DEFAULT_WEIGHTS: WeatherWeights = { [WeatherType.Rain]: 0.05 };

// ── Time-of-Day Modifiers ──────────────────────────────────────
//
// Some weather is more likely at certain times of day.

const TIME_MULTIPLIERS: Record<TimePeriod, Partial<Record<WeatherType, number>>> = {
  Dawn:  { [WeatherType.Fog]: 1.5 },
  Day:   { [WeatherType.Sandstorm]: 1.4 },
  Dusk:  { [WeatherType.Fog]: 1.3, [WeatherType.Storm]: 1.2 },
  Night: { [WeatherType.Storm]: 1.3, [WeatherType.Snow]: 1.2 },
};

/**
 * Resolve weather weights for a biome name.
 * Tries exact match first, then falls back to biome prefix, then default.
 */
function resolveWeatherWeights(biomeName: string): WeatherWeights {
  // Exact match (hand-crafted regions)
  if (BIOME_WEATHER[biomeName]) return BIOME_WEATHER[biomeName];
  // Prefix match (procedural chunks like "Frozen Reach", "Murky Expanse")
  const prefix = biomeName.split(" ")[0];
  if (BIOME_PREFIX_WEATHER[prefix]) return BIOME_PREFIX_WEATHER[prefix];
  return DEFAULT_WEIGHTS;
}

// ── Weather Roll ───────────────────────────────────────────────

/**
 * Determine the next weather type for a given biome + time of day.
 * Returns a weather type based on weighted random selection.
 */
export function rollWeather(biomeName: string, timeStep: number): WeatherType {
  const period = getTimePeriod(timeStep);
  const baseWeights = resolveWeatherWeights(biomeName);
  const timeMods = TIME_MULTIPLIERS[period] ?? {};

  // Build effective probability list
  let totalNonClear = 0;
  const entries: { type: WeatherType; prob: number }[] = [];

  for (const [typeStr, baseProb] of Object.entries(baseWeights)) {
    const wt = typeStr as WeatherType;
    const mult = timeMods[wt] ?? 1.0;
    const prob = baseProb * mult;
    entries.push({ type: wt, prob });
    totalNonClear += prob;
  }

  // Cap at 0.70 to ensure Clear can still happen
  if (totalNonClear > 0.70) {
    const scale = 0.70 / totalNonClear;
    for (const e of entries) e.prob *= scale;
    totalNonClear = 0.70;
  }

  const roll = Math.random();
  let cumulative = 0;
  for (const e of entries) {
    cumulative += e.prob;
    if (roll < cumulative) return e.type;
  }
  return WeatherType.Clear;
}

// ── Step-Based Update ──────────────────────────────────────────

/** Minimum and maximum steps between weather checks. */
const MIN_CHANGE_STEPS = 40;
const MAX_CHANGE_STEPS = 80;

/**
 * Advance weather by one step.  When the countdown reaches zero, a new
 * weather is rolled based on the biome the player is standing in.
 * Returns true if the weather actually changed.
 */
export function advanceWeather(
  state: WeatherState,
  biomeName: string,
  timeStep: number,
): boolean {
  state.stepsUntilChange--;
  if (state.stepsUntilChange > 0) return false;

  const previous = state.current;
  state.current = rollWeather(biomeName, timeStep);
  state.stepsUntilChange =
    MIN_CHANGE_STEPS + Math.floor(Math.random() * (MAX_CHANGE_STEPS - MIN_CHANGE_STEPS + 1));

  return state.current !== previous;
}

/**
 * Immediately re-roll weather for a new zone/biome.
 * Called on chunk transitions and town entry — weather persists within
 * a zone and only changes when the player moves to a different area.
 * Returns true if the weather actually changed.
 */
export function changeZoneWeather(
  state: WeatherState,
  biomeName: string,
  timeStep: number,
): boolean {
  const previous = state.current;
  state.current = rollWeather(biomeName, timeStep);
  // Reset the legacy countdown in case advanceWeather is still used elsewhere
  state.stepsUntilChange =
    MIN_CHANGE_STEPS + Math.floor(Math.random() * (MAX_CHANGE_STEPS - MIN_CHANGE_STEPS + 1));
  return state.current !== previous;
}

// ── Combat Effects ─────────────────────────────────────────────

/**
 * Accuracy penalty applied to *all* attack rolls during weather.
 * Positive value = penalty to hit (subtracted from the roll total check).
 * The combat system can subtract this from the attacker's roll.
 */
const WEATHER_ACCURACY_PENALTY: Record<WeatherType, number> = {
  [WeatherType.Clear]: 0,
  [WeatherType.Rain]: 1,
  [WeatherType.Snow]: 1,
  [WeatherType.Sandstorm]: 2,
  [WeatherType.Storm]: 2,
  [WeatherType.Fog]: 3,
};

/** Get the accuracy penalty for the current weather (higher = harder to hit). */
export function getWeatherAccuracyPenalty(weather: WeatherType): number {
  return WEATHER_ACCURACY_PENALTY[weather];
}

// ── Encounter Rate Modifier ────────────────────────────────────

const WEATHER_ENCOUNTER_MULT: Record<WeatherType, number> = {
  [WeatherType.Clear]: 1.0,
  [WeatherType.Rain]: 1.1,
  [WeatherType.Snow]: 0.9,
  [WeatherType.Sandstorm]: 1.2,
  [WeatherType.Storm]: 1.3,
  [WeatherType.Fog]: 1.2,
};

/** Encounter rate multiplier for weather (stacks with day/night multiplier). */
export function getWeatherEncounterMultiplier(weather: WeatherType): number {
  return WEATHER_ENCOUNTER_MULT[weather];
}

// ── Monster Weather Boosts ─────────────────────────────────────
//
// Mapping of monster IDs to weather types where they receive a stat boost.
// When a monster fights in its preferred weather it gets +2 AC, +1 attack
// bonus and +2 damage.

const MONSTER_WEATHER_AFFINITY: Record<string, WeatherType[]> = {
  // Overworld random encounters
  slime:     [WeatherType.Rain],
  wolf:      [WeatherType.Snow],
  nightWolf: [WeatherType.Snow, WeatherType.Fog],
  wraith:    [WeatherType.Fog, WeatherType.Storm],
  specter:   [WeatherType.Fog, WeatherType.Storm],
  skeleton:  [WeatherType.Sandstorm],
  orc:       [WeatherType.Sandstorm, WeatherType.Storm],
  // Bosses
  dragon:    [WeatherType.Storm],
  troll:     [WeatherType.Rain],
  frostGiant:   [WeatherType.Snow, WeatherType.Storm],
  swampHydra:   [WeatherType.Rain, WeatherType.Fog],
  volcanicWyrm: [WeatherType.Storm, WeatherType.Sandstorm],
  canyonDrake:  [WeatherType.Sandstorm, WeatherType.Storm],
  // Biome night monsters
  frostWraith:  [WeatherType.Snow, WeatherType.Fog],
  snowStalker:  [WeatherType.Snow],
  willOWisp:    [WeatherType.Fog, WeatherType.Rain],
  bogCreeper:   [WeatherType.Rain, WeatherType.Fog],
  darkTreent:   [WeatherType.Rain, WeatherType.Fog],
  gloomSprite:  [WeatherType.Fog],
  stoneLurker:  [WeatherType.Sandstorm],
  dustDevil:    [WeatherType.Sandstorm, WeatherType.Storm],
  vampireBat:   [WeatherType.Fog, WeatherType.Storm],
  // Dungeon-specific monsters
  cryptSkeleton:  [WeatherType.Fog],
  tombWraith:     [WeatherType.Fog, WeatherType.Storm],
  bonePile:       [WeatherType.Storm],
  iceElemental:   [WeatherType.Snow, WeatherType.Fog],
  frostSpider:    [WeatherType.Snow],
  glacialBear:    [WeatherType.Snow, WeatherType.Storm],
  magmaSlime:     [WeatherType.Storm],
  cinderWraith:   [WeatherType.Storm, WeatherType.Sandstorm],
  obsidianGolem:  [WeatherType.Sandstorm],
};

export interface WeatherBoost {
  initiativeBonus: number;
  attackBonus: number;
}

const NO_BOOST: WeatherBoost = { initiativeBonus: 0, attackBonus: 0 };
const ACTIVE_BOOST: WeatherBoost = { initiativeBonus: 2, attackBonus: 1 };

/** Check if a monster gets a weather boost, and return the stat deltas. */
export function getMonsterWeatherBoost(monsterId: string, weather: WeatherType): WeatherBoost {
  const affinities = MONSTER_WEATHER_AFFINITY[monsterId];
  if (!affinities) return NO_BOOST;
  return affinities.includes(weather) ? { ...ACTIVE_BOOST } : NO_BOOST;
}

// ── Visual / HUD ───────────────────────────────────────────────

/** Tint overlay color per weather (applied on top of day/night tint). */
export const WEATHER_TINT: Record<WeatherType, number> = {
  [WeatherType.Clear]:     0xffffff, // no extra tint
  [WeatherType.Rain]:      0xaabbcc,
  [WeatherType.Snow]:      0xccddee,
  [WeatherType.Sandstorm]: 0xddcc88,
  [WeatherType.Storm]:     0x8899aa,
  [WeatherType.Fog]:       0xbbbbbb,
};

/** HUD label per weather. */
export const WEATHER_LABEL: Record<WeatherType, string> = {
  [WeatherType.Clear]:     "☀ Clear",
  [WeatherType.Rain]:      "🌧 Rain",
  [WeatherType.Snow]:      "❄ Snow",
  [WeatherType.Sandstorm]: "🌪 Sandstorm",
  [WeatherType.Storm]:     "⛈ Storm",
  [WeatherType.Fog]:       "🌫 Fog",
};
