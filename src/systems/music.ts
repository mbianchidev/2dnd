import {
  BIOME_ALIASES,
  BIOME_PROFILES,
  CITY_OVERRIDES,
  CITY_PROFILE,
  DEFAULT_PROFILE,
  DUNGEON_PROFILE,
  DUNGEON_PROFILES,
  MAJOR_PENTA,
  MINOR_PENTA,
  MUSIC_LEAD_RHYTHMS,
  MUSIC_MELODY_VARIATIONS,
  MUSIC_SECTIONS,
} from "../data/music";
import { WeatherType } from "./weather";
import type { BiomeProfile, MusicSection, MusicTrackKind, Scale } from "../data/music";

export interface MusicContext {
  readonly kind: MusicTrackKind;
  readonly isNight: boolean;
  readonly weather: WeatherType;
  readonly pressure: number;
}

export interface MusicNote {
  readonly instrument: "lead" | "bass" | "pad" | "bell" | "kick" | "hat";
  readonly frequency: number;
  readonly wave: OscillatorType;
  readonly offsetBeats: number;
  readonly durationBeats: number;
  readonly volume: number;
}

export interface MusicBar {
  readonly section: MusicSection;
  readonly beats: 4;
  readonly notes: readonly MusicNote[];
}

/** Concert-pitch A4 plus a signed semitone offset. */
export function noteFreq(semitonesFromA4: number): number {
  return 440 * Math.pow(2, semitonesFromA4 / 12);
}

/** Named legacy areas resolve to the same score as their surrounding biome. */
export function resolveBiomePrefix(chunkName: string): string {
  const prefix = chunkName.split(" ")[0];
  return BIOME_PROFILES[prefix] ? prefix : BIOME_ALIASES[prefix] ?? "";
}

export function getProfileForBiome(chunkName: string): BiomeProfile {
  return BIOME_PROFILES[resolveBiomePrefix(chunkName)] ?? DEFAULT_PROFILE;
}

export function getProfileForCity(cityName: string): BiomeProfile {
  return { ...CITY_PROFILE, ...CITY_OVERRIDES[cityName] };
}

export function getProfileForDungeon(dungeonId: string): BiomeProfile {
  return DUNGEON_PROFILES[dungeonId] ?? DUNGEON_PROFILE;
}

/** Resolve a fixed musical motif without consuming gameplay randomness. */
export function buildMusicPhrase(profile: BiomeProfile, isNight: boolean): number[] {
  const { scale, baseNote } = resolveMusicScale(profile, isNight);
  return getMotif(profile).map((degree) => degreeFrequency(baseNote, scale, degree));
}

/** Four phrases develop the area's motif; weather and danger change layers, never tempo or RNG. */
export function buildMusicBar(
  profile: BiomeProfile,
  barIndex: number,
  context: MusicContext,
): MusicBar {
  const section = MUSIC_SECTIONS[Math.floor(barIndex / 4) % MUSIC_SECTIONS.length];
  const variation = MUSIC_MELODY_VARIATIONS[Math.floor(barIndex / 16) % MUSIC_MELODY_VARIATIONS.length];
  const { scale, baseNote } = resolveMusicScale(profile, context.isNight);
  const motif = getMotif(profile);
  const start = (barIndex * 4) % motif.length;
  const combat = context.kind === "battle" || context.kind === "boss";
  const solemn = context.kind === "defeat" || context.kind === "ending" || context.kind === "title";
  const storm = context.kind === "biome"
    && (context.weather === WeatherType.Storm || context.weather === WeatherType.Sandstorm);
  const danger = combat && context.pressure >= 0.65;
  const quiet = context.isNight || context.weather === WeatherType.Snow || context.weather === WeatherType.Fog;
  const notes: MusicNote[] = [];
  const add = (
    instrument: MusicNote["instrument"],
    degree: number,
    offsetBeats: number,
    durationBeats: number,
    volume: number,
    wave: OscillatorType,
  ): void => {
    notes.push({
      instrument,
      frequency: degreeFrequency(baseNote, scale, degree),
      offsetBeats, durationBeats, volume, wave,
    });
  };

  for (const beat of MUSIC_LEAD_RHYTHMS[section]) {
    let degree = motif[(start + Math.floor(beat)) % motif.length];
    if (section === "answer" && beat < 3) degree += scale.length;
    if (section === "answer" && beat === 1) degree += variation;
    if (section === "lift" && beat === 2) degree -= variation;
    add("lead", degree, beat, section === "breath" ? 1.65 : 0.8,
      quiet ? 0.075 : combat ? 0.12 : 0.1, profile.wave);
  }

  const anchor = motif[start] % scale.length;
  for (const beat of [0, 2]) {
    add("bass", anchor - scale.length * 2 + (beat === 2 ? 2 : 0), beat, 1.7,
      quiet ? 0.035 : 0.055, profile.padWave);
  }
  for (const degree of [0, 2, 4]) {
    add("pad", anchor + degree - scale.length, 0, 3.8, quiet ? 0.012 : 0.02, "sine");
  }
  if ((section === "lift" && !quiet) || danger) {
    for (const beat of danger ? [0.5, 1.5, 2.5, 3.5] : [0.5, 2.5]) {
      add("bell", motif[(start + Math.floor(beat) + 2) % motif.length] + scale.length,
        beat, 0.45, 0.025, "sine");
    }
  }
  if (!solemn && (!quiet || combat) && (section !== "breath" || danger)) {
    const kicks = combat || storm ? [0, 2] : [0];
    for (const beat of kicks) {
      notes.push({
        instrument: "kick", frequency: 130, wave: "sine",
        offsetBeats: beat, durationBeats: 0.3, volume: combat ? 0.075 : 0.045,
      });
    }
    const hats = danger || storm || context.kind === "boss"
      ? [0.5, 1, 1.5, 2.5, 3, 3.5] : combat ? [1, 3] : [2];
    for (const beat of hats) {
      notes.push({
        instrument: "hat", frequency: 7000, wave: "sine",
        offsetBeats: beat, durationBeats: 0.12, volume: 0.022,
      });
    }
  }
  return { section, beats: 4, notes };
}

/** Read live party resources without retaining actors or altering combat. */
export function getMusicPressure(
  party: readonly { readonly currentHp: number; readonly maxHp: number }[],
): number {
  let hp = 0;
  let maximum = 0;
  for (const actor of party) {
    hp += actor.currentHp;
    maximum += actor.maxHp;
  }
  return maximum > 0 ? Math.max(0, Math.min(1, 1 - hp / maximum)) : 0;
}

function resolveMusicScale(profile: BiomeProfile, isNight: boolean): {
  scale: Scale;
  baseNote: number;
} {
  return {
    scale: isNight && profile.scale === MAJOR_PENTA ? MINOR_PENTA : profile.scale,
    baseNote: profile.baseNote - (isNight ? profile.scale === MAJOR_PENTA ? 3 : 2 : 0),
  };
}

function getMotif(profile: BiomeProfile): readonly number[] {
  const length = profile.scale.length;
  return profile.motif ?? [
    0, 1, 2, 3,
    length + 3, length + 2, length + 1, length,
    2, length * 2 - 1, length + 1, 3,
    length - 2, length, 1, 0,
  ];
}

function degreeFrequency(baseNote: number, scale: Scale, degree: number): number {
  const index = ((degree % scale.length) + scale.length) % scale.length;
  return noteFreq(baseNote + scale[index] + Math.floor(degree / scale.length) * 12);
}
