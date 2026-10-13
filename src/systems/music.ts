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
} from "../data/music";
import type { BiomeProfile } from "../data/music";

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
  const scale = isNight && profile.scale === MAJOR_PENTA ? MINOR_PENTA : profile.scale;
  const baseNote = profile.baseNote - (isNight ? profile.scale === MAJOR_PENTA ? 3 : 2 : 0);
  const length = scale.length;
  const degrees = profile.motif ?? [
    0, 1, 2, 3,
    length + 3, length + 2, length + 1, length,
    2, length * 2 - 1, length + 1, 3,
    length - 2, length, 1, 0,
  ];
  return degrees.map((degree) =>
    noteFreq(baseNote + scale[degree % length] + Math.floor(degree / length) * 12)
  );
}
