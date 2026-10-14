export type Scale = readonly number[];

export interface BiomeProfile {
  readonly baseNote: number;
  readonly scale: Scale;
  readonly bpm: number;
  readonly wave: OscillatorType;
  readonly padWave: OscillatorType;
  /** Scale degrees across octaves; omitted tracks retain the original phrase. */
  readonly motif?: readonly number[];
}

export const MAJOR_PENTA: Scale = [0, 2, 4, 7, 9];
export const MINOR_PENTA: Scale = [0, 3, 5, 7, 10];
const HARMONIC_MINOR: Scale = [0, 2, 3, 5, 7, 8, 11];
const DIMINISHED: Scale = [0, 1, 3, 4, 6, 7, 9, 10];
const NATURAL_MINOR: Scale = [0, 2, 3, 5, 7, 8, 10];
const PHRYGIAN_DOM: Scale = [0, 1, 4, 5, 7, 8, 10];

export const BIOME_PROFILES: Readonly<Record<string, BiomeProfile>> = {
  Frozen: {
    baseNote: 4, scale: MINOR_PENTA, bpm: 72, wave: "triangle", padWave: "sine",
    motif: [4, 2, 3, 1, 0, 1, 2, 4, 7, 6, 4, 2, 3, 1, 2, 0],
  },
  Murky: {
    baseNote: -5, scale: DIMINISHED, bpm: 66, wave: "sawtooth", padWave: "triangle",
    motif: [0, 1, 0, 3, 2, 1, 4, 3, 8, 7, 5, 3, 4, 2, 1, 0],
  },
  Ancient: {
    baseNote: 0, scale: MINOR_PENTA, bpm: 80, wave: "triangle", padWave: "sine",
    motif: [0, 2, 4, 3, 2, 0, 1, 3, 5, 7, 6, 4, 3, 1, 2, 0],
  },
  Scorched: {
    baseNote: -3, scale: NATURAL_MINOR, bpm: 96, wave: "sawtooth", padWave: "square",
    motif: [0, 0, 3, 2, 0, 4, 3, 1, 7, 6, 4, 3, 2, 1, 3, 0],
  },
  Rocky: {
    baseNote: -2, scale: HARMONIC_MINOR, bpm: 84, wave: "square", padWave: "triangle",
    motif: [0, 3, 1, 4, 2, 3, 0, 2, 6, 4, 7, 5, 3, 2, 1, 0],
  },
  Arid: {
    baseNote: 2, scale: HARMONIC_MINOR, bpm: 78, wave: "triangle", padWave: "sine",
    motif: [0, 1, 3, 4, 2, 1, 5, 4, 7, 8, 6, 4, 3, 2, 1, 0],
  },
  Woodland: {
    baseNote: 0, scale: MAJOR_PENTA, bpm: 88, wave: "triangle", padWave: "sine",
    motif: [0, 2, 1, 3, 2, 4, 3, 1, 5, 6, 4, 7, 3, 2, 1, 0],
  },
  Highland: {
    baseNote: 2, scale: MAJOR_PENTA, bpm: 82, wave: "sine", padWave: "triangle",
    motif: [0, 3, 2, 4, 3, 5, 4, 2, 7, 6, 8, 5, 4, 2, 1, 0],
  },
  Rolling: {
    baseNote: 0, scale: MAJOR_PENTA, bpm: 90, wave: "sine", padWave: "sine",
    motif: [0, 1, 2, 4, 3, 2, 1, 3, 5, 4, 6, 3, 2, 4, 1, 0],
  },
  Sea: {
    baseNote: -2, scale: MINOR_PENTA, bpm: 76, wave: "sine", padWave: "triangle",
    motif: [0, 2, 3, 2, 0, 1, 2, 4, 5, 4, 2, 3, 1, 2, 1, 0],
  },
};

/** Named legacy chunks share their surrounding region's score. */
export const BIOME_ALIASES: Readonly<Record<string, string>> = {
  Heartlands: "Rolling",
  Western: "Rolling",
  Mountain: "Highland",
  Northern: "Woodland",
  Misty: "Highland",
  Eastern: "Arid",
  Marshlands: "Murky",
  Southern: "Woodland",
  "Dragon's": "Scorched",
};

export const DEFAULT_PROFILE: BiomeProfile = {
  baseNote: 0, scale: MAJOR_PENTA, bpm: 90, wave: "sine", padWave: "sine",
};

export const BOSS_PROFILE: BiomeProfile = {
  baseNote: -7, scale: PHRYGIAN_DOM, bpm: 140, wave: "sawtooth", padWave: "square",
};

export const BATTLE_PROFILE: BiomeProfile = {
  baseNote: -5, scale: PHRYGIAN_DOM, bpm: 138, wave: "sawtooth", padWave: "square",
};

export const CITY_PROFILE: BiomeProfile = {
  baseNote: 4, scale: MAJOR_PENTA, bpm: 100, wave: "triangle", padWave: "sine",
};

export const TITLE_PROFILE: BiomeProfile = {
  baseNote: -2, scale: HARMONIC_MINOR, bpm: 68, wave: "triangle", padWave: "sine",
};

export const ENDING_PROFILE: BiomeProfile = {
  baseNote: -5, scale: MAJOR_PENTA, bpm: 62, wave: "triangle", padWave: "sine",
};

export const DEFEAT_PROFILE: BiomeProfile = {
  baseNote: -5, scale: NATURAL_MINOR, bpm: 52, wave: "sine", padWave: "sine",
};

export const BOSS_OVERRIDES: Readonly<Record<string, Partial<BiomeProfile>>> = {
  troll: { baseNote: -10, bpm: 120, scale: NATURAL_MINOR, wave: "square", padWave: "sawtooth" },
  dragon: { baseNote: -12, bpm: 155, scale: PHRYGIAN_DOM, wave: "sawtooth", padWave: "square" },
  frostGiant: { baseNote: -5, bpm: 110, scale: MINOR_PENTA, wave: "triangle", padWave: "sine" },
  swampHydra: { baseNote: -8, bpm: 135, scale: DIMINISHED, wave: "sawtooth", padWave: "triangle" },
  volcanicWyrm: { baseNote: -14, bpm: 160, scale: HARMONIC_MINOR, wave: "square", padWave: "sawtooth" },
  canyonDrake: { baseNote: -7, bpm: 145, scale: HARMONIC_MINOR, wave: "sawtooth", padWave: "triangle" },
  kraken: { baseNote: -15, bpm: 148, scale: DIMINISHED, wave: "sawtooth", padWave: "square" },
};

export const CITY_OVERRIDES: Readonly<Record<string, Partial<BiomeProfile>>> = {
  Willowdale: {
    baseNote: 4, bpm: 92, scale: MAJOR_PENTA, wave: "sine", padWave: "triangle",
    motif: [0, 2, 1, 0, 3, 4, 2, 1, 5, 4, 3, 2, 1, 3, 1, 0],
  },
  Ironhold: {
    baseNote: -1, bpm: 108, scale: NATURAL_MINOR, wave: "square", padWave: "sawtooth",
    motif: [0, 0, 4, 3, 2, 0, 3, 4, 7, 4, 5, 3, 2, 1, 2, 0],
  },
  Frostheim: {
    baseNote: 2, bpm: 76, scale: MINOR_PENTA, wave: "triangle", padWave: "sine",
    motif: [2, 4, 3, 1, 2, 0, 1, 3, 5, 4, 6, 3, 2, 1, 2, 0],
  },
  Deeproot: {
    baseNote: -2, bpm: 84, scale: MINOR_PENTA, wave: "triangle", padWave: "triangle",
    motif: [0, 3, 2, 4, 1, 2, 0, 3, 5, 7, 4, 6, 2, 3, 1, 0],
  },
  Sandport: {
    baseNote: 5, bpm: 104, scale: HARMONIC_MINOR, wave: "sawtooth", padWave: "sine",
    motif: [0, 2, 3, 1, 4, 3, 5, 4, 7, 6, 8, 4, 3, 2, 1, 0],
  },
  Canyonwatch: {
    baseNote: 3, bpm: 96, scale: HARMONIC_MINOR, wave: "triangle", padWave: "square",
    motif: [0, 4, 2, 3, 1, 4, 3, 2, 7, 5, 8, 6, 4, 3, 1, 0],
  },
  Ashfall: {
    baseNote: -4, bpm: 88, scale: PHRYGIAN_DOM, wave: "sawtooth", padWave: "square",
    motif: [0, 1, 3, 1, 0, 4, 2, 1, 7, 6, 4, 5, 3, 2, 1, 0],
  },
  Dunerest: {
    baseNote: 5, bpm: 90, scale: MAJOR_PENTA, wave: "sine", padWave: "sine",
    motif: [0, 1, 3, 2, 4, 2, 1, 0, 5, 3, 4, 2, 3, 1, 2, 0],
  },
  Thornvale: {
    baseNote: 0, bpm: 94, scale: NATURAL_MINOR, wave: "triangle", padWave: "sawtooth",
    motif: [0, 2, 1, 4, 3, 2, 0, 1, 7, 5, 6, 4, 2, 3, 1, 0],
  },
  Bogtown: {
    baseNote: -3, bpm: 72, scale: DIMINISHED, wave: "sawtooth", padWave: "triangle",
    motif: [0, 1, 2, 0, 3, 1, 4, 2, 8, 5, 7, 3, 4, 2, 1, 0],
  },
  Shadowfen: {
    baseNote: -5, bpm: 68, scale: DIMINISHED, wave: "square", padWave: "sawtooth",
    motif: [0, 3, 1, 0, 4, 2, 1, 3, 8, 6, 4, 7, 3, 2, 1, 0],
  },
  Ridgewatch: {
    baseNote: 2, bpm: 100, scale: MAJOR_PENTA, wave: "triangle", padWave: "sine",
    motif: [0, 3, 4, 2, 1, 3, 5, 4, 7, 5, 6, 4, 3, 2, 1, 0],
  },
  Tidehaven: {
    baseNote: 0, bpm: 98, scale: MAJOR_PENTA, wave: "square", padWave: "triangle",
    motif: [0, 2, 3, 2, 1, 0, 2, 4, 5, 3, 4, 2, 1, 3, 1, 0],
  },
  "Starfall Atoll": {
    baseNote: 7, bpm: 64, scale: MINOR_PENTA, wave: "sine", padWave: "triangle",
    motif: [4, 2, 0, 3, 1, 4, 2, 0, 7, 5, 3, 6, 4, 2, 1, 0],
  },
};

export const DUNGEON_PROFILE: BiomeProfile = {
  baseNote: -12, scale: NATURAL_MINOR, bpm: 60, wave: "triangle", padWave: "sine",
};

export const DUNGEON_PROFILES: Readonly<Record<string, BiomeProfile>> = {
  heartlands_dungeon: {
    ...DUNGEON_PROFILE,
    motif: [0, 2, 1, 0, 4, 3, 1, 2, 7, 5, 3, 4, 2, 1, 2, 0],
  },
  frost_cavern: {
    baseNote: -5, scale: MINOR_PENTA, bpm: 64, wave: "sine", padWave: "triangle",
    motif: [4, 3, 1, 2, 0, 2, 1, 3, 7, 4, 6, 2, 3, 1, 2, 0],
  },
  volcanic_forge: {
    baseNote: -10, scale: PHRYGIAN_DOM, bpm: 104, wave: "square", padWave: "sawtooth",
    motif: [0, 0, 3, 1, 4, 2, 0, 3, 7, 4, 6, 3, 2, 1, 3, 0],
  },
  tideglass_grotto: {
    baseNote: -8, scale: MINOR_PENTA, bpm: 70, wave: "triangle", padWave: "sine",
    motif: [0, 3, 4, 2, 0, 1, 3, 2, 5, 7, 4, 6, 3, 2, 1, 0],
  },
};
