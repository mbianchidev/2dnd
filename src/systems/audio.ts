/**
 * Procedural audio system using the Web Audio API.
 *
 * Provides biome-based background music, weather ambient SFX, boss/battle
 * themes, city themes, day/night tone shifts, and stubs for future
 * defeat music & dialogue blip sounds.
 *
 * All audio is synthesised at runtime – no external assets required.
 */

import { WeatherType } from "./weather";
import { TimePeriod } from "./daynight";

// ── Musical constants ──────────────────────────────────────────

/** Concert-pitch A4 reference. */
const A4 = 440;

/** Semitone-to-frequency helper. */
function noteFreq(semitonesFromA4: number): number {
  return A4 * Math.pow(2, semitonesFromA4 / 12);
}

/**
 * A scale is an array of semitone offsets from A4.
 * We store *one* octave and shift it for night mode.
 */
type Scale = number[];

// Major pentatonic (happy / bright)
const MAJOR_PENTA: Scale = [0, 2, 4, 7, 9];
// Minor pentatonic (melancholic)
const MINOR_PENTA: Scale = [0, 3, 5, 7, 10];
// Harmonic minor (exotic / desert feel)
const HARMONIC_MINOR: Scale = [0, 2, 3, 5, 7, 8, 11];
// Diminished (eerie / swamp)
const DIMINISHED: Scale = [0, 1, 3, 4, 6, 7, 9, 10];
// Minor (general dark mood)
const NATURAL_MINOR: Scale = [0, 2, 3, 5, 7, 8, 10];
// Phrygian dominant (boss fight tension)
const PHRYGIAN_DOM: Scale = [0, 1, 4, 5, 7, 8, 10];

// ── Biome music profiles ───────────────────────────────────────

export interface BiomeProfile {
  /** Base note offset from A4 in semitones. */
  baseNote: number;
  /** Scale intervals. */
  scale: Scale;
  /** BPM — beats per minute. */
  bpm: number;
  /** Oscillator wave type for lead. */
  wave: OscillatorType;
  /** Oscillator wave type for bass/pad. */
  padWave: OscillatorType;
}

/**
 * Map from biome prefix → music profile.
 * Biome prefixes match the first word of chunk names (Frozen, Murky, etc.).
 */
export const BIOME_PROFILES: Record<string, BiomeProfile> = {
  Frozen:   { baseNote: 4,  scale: MINOR_PENTA,    bpm: 72,  wave: "triangle", padWave: "sine" },
  Murky:    { baseNote: -5, scale: DIMINISHED,      bpm: 66,  wave: "sawtooth", padWave: "triangle" },
  Ancient:  { baseNote: 0,  scale: MINOR_PENTA,     bpm: 80,  wave: "triangle", padWave: "sine" },
  Scorched: { baseNote: -3, scale: NATURAL_MINOR,   bpm: 96,  wave: "sawtooth", padWave: "square" },
  Rocky:    { baseNote: -2, scale: HARMONIC_MINOR,   bpm: 84,  wave: "square",   padWave: "triangle" },
  Arid:     { baseNote: 2,  scale: HARMONIC_MINOR,   bpm: 78,  wave: "triangle", padWave: "sine" },
  Woodland: { baseNote: 0,  scale: MAJOR_PENTA,      bpm: 88,  wave: "triangle", padWave: "sine" },
  Highland: { baseNote: 2,  scale: MAJOR_PENTA,      bpm: 82,  wave: "sine",     padWave: "triangle" },
  Rolling:  { baseNote: 0,  scale: MAJOR_PENTA,      bpm: 90,  wave: "sine",     padWave: "sine" },
};

/** Default/fallback profile (Heartlands, plains, etc.) */
const DEFAULT_PROFILE: BiomeProfile = {
  baseNote: 0, scale: MAJOR_PENTA, bpm: 90, wave: "sine", padWave: "sine",
};

/** Boss-fight profile — intense, fast, Phrygian dominant. */
const BOSS_PROFILE: BiomeProfile = {
  baseNote: -7, scale: PHRYGIAN_DOM, bpm: 140, wave: "sawtooth", padWave: "square",
};

/** Battle profile (non-boss) — fast, driving, Phrygian dominant for epic feel. */
const BATTLE_PROFILE: BiomeProfile = {
  baseNote: -5, scale: PHRYGIAN_DOM, bpm: 138, wave: "sawtooth", padWave: "square",
};

/** City / shop profile — cheerful, slower. */
const CITY_PROFILE: BiomeProfile = {
  baseNote: 4, scale: MAJOR_PENTA, bpm: 100, wave: "triangle", padWave: "sine",
};

/** Title screen profile — soft but majestic, slow harmonic minor for an epic feel. */
const TITLE_PROFILE: BiomeProfile = {
  baseNote: -2, scale: HARMONIC_MINOR, bpm: 68, wave: "triangle", padWave: "sine",
};

/** Defeat / game-over profile (future use). */
const DEFEAT_PROFILE: BiomeProfile = {
  baseNote: -5, scale: NATURAL_MINOR, bpm: 52, wave: "sine", padWave: "sine",
};

// ── Boss-specific tuning overrides ─────────────────────────────

const BOSS_OVERRIDES: Record<string, Partial<BiomeProfile>> = {
  // Cave Troll — brutish, stomping rhythm, heavy and slow
  troll:        { baseNote: -10, bpm: 120, scale: NATURAL_MINOR,   wave: "square",   padWave: "sawtooth" },
  // Young Red Dragon — blazing fast, dissonant, fiery
  dragon:       { baseNote: -12, bpm: 155, scale: PHRYGIAN_DOM,    wave: "sawtooth", padWave: "square" },
  // Frost Giant — glacial, powerful, cold and wide
  frostGiant:   { baseNote: -5,  bpm: 110, scale: MINOR_PENTA,     wave: "triangle", padWave: "sine" },
  // Swamp Hydra — chaotic, slithering, eerie multi-headed
  swampHydra:   { baseNote: -8,  bpm: 135, scale: DIMINISHED,      wave: "sawtooth", padWave: "triangle" },
  // Volcanic Wyrm — explosive, intense, relentless
  volcanicWyrm: { baseNote: -14, bpm: 160, scale: HARMONIC_MINOR,  wave: "square",   padWave: "sawtooth" },
  // Canyon Drake — agile, soaring, sharp attacks
  canyonDrake:  { baseNote: -7,  bpm: 145, scale: HARMONIC_MINOR,  wave: "sawtooth", padWave: "triangle" },
};

// ── City-specific tuning overrides ─────────────────────────────

const CITY_OVERRIDES: Record<string, Partial<BiomeProfile>> = {
  // Willowdale — peaceful pastoral village, warm and gentle
  Willowdale:  { baseNote: 4,  bpm: 92,  scale: MAJOR_PENTA,      wave: "sine",     padWave: "triangle" },
  // Ironhold — industrial fortress city, strong and rhythmic
  Ironhold:    { baseNote: -1, bpm: 108, scale: NATURAL_MINOR,     wave: "square",   padWave: "sawtooth" },
  // Frostheim — frozen northern town, melancholic and quiet
  Frostheim:   { baseNote: 2,  bpm: 76,  scale: MINOR_PENTA,       wave: "triangle", padWave: "sine" },
  // Deeproot — ancient forest settlement, mystical and organic
  Deeproot:    { baseNote: -2, bpm: 84,  scale: MINOR_PENTA,       wave: "triangle", padWave: "triangle" },
  // Sandport — bustling desert trade hub, exotic and lively
  Sandport:    { baseNote: 5,  bpm: 104, scale: HARMONIC_MINOR,    wave: "sawtooth", padWave: "sine" },
  // Canyonwatch — rugged mountain outpost, adventurous
  Canyonwatch: { baseNote: 3,  bpm: 96,  scale: HARMONIC_MINOR,    wave: "triangle", padWave: "square" },
  // Ashfall — volcanic settlement, ominous and smoky
  Ashfall:     { baseNote: -4, bpm: 88,  scale: PHRYGIAN_DOM,      wave: "sawtooth", padWave: "square" },
  // Dunerest — quiet desert oasis town, relaxed and warm
  Dunerest:    { baseNote: 5,  bpm: 90,  scale: MAJOR_PENTA,       wave: "sine",     padWave: "sine" },
  // Thornvale — dark forest town, tense and alert
  Thornvale:   { baseNote: 0,  bpm: 94,  scale: NATURAL_MINOR,     wave: "triangle", padWave: "sawtooth" },
  // Bogtown — murky swamp village, unsettling and damp
  Bogtown:     { baseNote: -3, bpm: 72,  scale: DIMINISHED,         wave: "sawtooth", padWave: "triangle" },
  // Shadowfen — sinister swamp enclave, dark and creeping
  Shadowfen:   { baseNote: -5, bpm: 68,  scale: DIMINISHED,         wave: "square",   padWave: "sawtooth" },
  // Ridgewatch — highland fortress, proud and bright
  Ridgewatch:  { baseNote: 2,  bpm: 100, scale: MAJOR_PENTA,       wave: "triangle", padWave: "sine" },
};

// ── Night mode helpers ─────────────────────────────────────────

/**
 * Shift a major scale to its relative minor by lowering the 3rd, 6th, 7th.
 * For already-minor scales we just flatten the root by 3 semitones.
 */
function nightScale(profile: BiomeProfile): { scale: Scale; baseNote: number } {
  if (profile.scale === MAJOR_PENTA) {
    return { scale: MINOR_PENTA, baseNote: profile.baseNote - 3 };
  }
  // Already dark — just drop the root a bit
  return { scale: profile.scale, baseNote: profile.baseNote - 2 };
}

// ── Resolve biome prefix ──────────────────────────────────────

/**
 * Resolve the biome prefix from a chunk name (e.g. "Frozen Reach" → "Frozen").
 */
export function resolveBiomePrefix(chunkName: string): string {
  const prefix = chunkName.split(" ")[0];
  if (BIOME_PROFILES[prefix]) return prefix;
  return "";
}

/**
 * Get the music profile for a given chunk name.
 */
export function getProfileForBiome(chunkName: string): BiomeProfile {
  const prefix = resolveBiomePrefix(chunkName);
  return prefix ? BIOME_PROFILES[prefix] : DEFAULT_PROFILE;
}

// ── Audio Engine ──────────────────────────────────────────────

/** Current track identifier so we avoid restarting the same music. */
export type TrackKind = "biome" | "battle" | "boss" | "city" | "title" | "defeat" | "victory" | "none";

/** Duration in seconds for crossfade between tracks. */
const CROSSFADE_DURATION = 1.0;

export interface AudioState {
  trackKind: TrackKind;
  /** Identifier within the kind (e.g. biome prefix, boss id, city name). */
  trackId: string;
  /** Whether night mode tone shift is active. */
  nightMode: boolean;
  muted: boolean;
  volume: number;
  /** Per-channel volumes (0–1). */
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  dialogVolume: number;
}

export function createAudioState(): AudioState {
  return {
    trackKind: "none", trackId: "", nightMode: false, muted: false, volume: 0.35,
    masterVolume: 1.0, musicVolume: 0.6, sfxVolume: 0.4, dialogVolume: 0.5,
  };
}

// ── Audio preferences persistence ──────────────────────────────

const AUDIO_PREFS_KEY = "2dnd_audio_prefs";

interface AudioPrefs {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  dialogVolume: number;
  muted: boolean;
}

function loadAudioPrefs(): AudioPrefs | null {
  try {
    const raw = localStorage.getItem(AUDIO_PREFS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.masterVolume === "number") return parsed as AudioPrefs;
    return null;
  } catch { return null; }
}

function saveAudioPrefs(state: AudioState): void {
  try {
    const prefs: AudioPrefs = {
      masterVolume: state.masterVolume,
      musicVolume: state.musicVolume,
      sfxVolume: state.sfxVolume,
      dialogVolume: state.dialogVolume,
      muted: state.muted,
    };
    localStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify(prefs));
  } catch { /* localStorage may be unavailable in tests */ }
}

/**
 * The global audio engine instance.
 *
 * Uses Web Audio API directly (not Phaser's sound manager) so we can
 * procedurally synthesise every note in real time.
 *
 * Call `initAudio()` from a user-interaction handler to create the
 * AudioContext (browsers block autoplay).
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private dialogGain: GainNode | null = null;
  private footstepGain: GainNode | null = null;

  // Currently playing music nodes
  private musicNodes: AudioNode[] = [];
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicFadeTimer: ReturnType<typeof setTimeout> | null = null;
  private musicStartTimer: ReturnType<typeof setTimeout> | null = null;

  // Weather ambient nodes
  private weatherNodes: AudioNode[] = [];
  private weatherTimer: ReturnType<typeof setInterval> | null = null;

  // State
  state: AudioState = createAudioState();

  constructor() {
    // Restore saved preferences from localStorage
    const prefs = loadAudioPrefs();
    if (prefs) {
      this.state.masterVolume = prefs.masterVolume;
      this.state.musicVolume = prefs.musicVolume;
      this.state.sfxVolume = prefs.sfxVolume;
      this.state.dialogVolume = prefs.dialogVolume;
      this.state.muted = prefs.muted;
      this.state.volume = prefs.masterVolume * 0.35;
    }
  }

  // ─── Init ──────────────────────────────────────────────────

  /** Must be called from a user gesture (click / keydown). */
  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.state.muted ? 0 : this.state.volume;
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.state.musicVolume;
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.state.sfxVolume;
    this.sfxGain.connect(this.masterGain);

    this.dialogGain = this.ctx.createGain();
    this.dialogGain.gain.value = this.state.dialogVolume;
    this.dialogGain.connect(this.masterGain);

    this.footstepGain = this.ctx.createGain();
    this.footstepGain.gain.value = this.state.sfxVolume * 0.3; // very low footstep volume
    this.footstepGain.connect(this.masterGain);
  }

  get initialized(): boolean {
    return this.ctx !== null;
  }

  // ─── Volume / mute ────────────────────────────────────────

  setVolume(v: number): void {
    this.state.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) {
      this.masterGain.gain.value = this.state.muted ? 0 : this.state.volume;
    }
  }

  setMuted(m: boolean): void {
    this.state.muted = m;
    if (this.masterGain) {
      this.masterGain.gain.value = m ? 0 : this.state.volume;
    }
    saveAudioPrefs(this.state);
  }

  toggleMute(): boolean {
    this.setMuted(!this.state.muted);
    return this.state.muted;
  }

  /** Set master volume (0–1). Affects all channels. */
  setMasterVolume(v: number): void {
    this.state.masterVolume = Math.max(0, Math.min(1, v));
    this.setVolume(this.state.masterVolume * 0.35);
    saveAudioPrefs(this.state);
  }

  /** Set music volume (0–1). */
  setMusicVolume(v: number): void {
    this.state.musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicGain) {
      this.musicGain.gain.value = this.state.musicVolume;
    }
    saveAudioPrefs(this.state);
  }

  /** Set SFX volume (0–1). */
  setSFXVolume(v: number): void {
    this.state.sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain) {
      this.sfxGain.gain.value = this.state.sfxVolume;
    }
    if (this.footstepGain) {
      this.footstepGain.gain.value = this.state.sfxVolume * 0.3;
    }
    saveAudioPrefs(this.state);
  }

  /** Set dialog volume (0–1). */
  setDialogVolume(v: number): void {
    this.state.dialogVolume = Math.max(0, Math.min(1, v));
    if (this.dialogGain) {
      this.dialogGain.gain.value = this.state.dialogVolume;
    }
    saveAudioPrefs(this.state);
  }

  // ─── Stop helpers ─────────────────────────────────────────

  /**
   * Fade out and stop the currently playing music track.
   * If `immediate` is true, stops instantly with no fade.
   */
  private stopMusic(immediate = false): void {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    // Cancel any pending fade-cleanup or delayed start
    if (this.musicFadeTimer) {
      clearTimeout(this.musicFadeTimer);
      this.musicFadeTimer = null;
    }
    if (this.musicStartTimer) {
      clearTimeout(this.musicStartTimer);
      this.musicStartTimer = null;
    }
    if (!immediate && this.musicGain && this.ctx) {
      // Smooth fade-out
      try {
        this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, this.ctx.currentTime);
        this.musicGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + CROSSFADE_DURATION);
      } catch { /* context may be closed */ }
      // Schedule node cleanup after fade completes
      const staleNodes = [...this.musicNodes];
      this.musicNodes = [];
      this.musicFadeTimer = setTimeout(() => {
        this.musicFadeTimer = null;
        for (const n of staleNodes) {
          try { (n as OscillatorNode).stop?.(); } catch { /* ok */ }
          try { n.disconnect(); } catch { /* ok */ }
        }
      }, CROSSFADE_DURATION * 1000 + 50);
    } else {
      for (const n of this.musicNodes) {
        try { (n as OscillatorNode).stop?.(); } catch { /* already stopped */ }
        try { n.disconnect(); } catch { /* ok */ }
      }
      this.musicNodes = [];
    }
  }

  private stopWeather(): void {
    if (this.weatherTimer) {
      clearInterval(this.weatherTimer);
      this.weatherTimer = null;
    }
    for (const n of this.weatherNodes) {
      try { (n as OscillatorNode).stop?.(); } catch { /* already stopped */ }
      try { n.disconnect(); } catch { /* ok */ }
    }
    this.weatherNodes = [];
  }

  stopAll(): void {
    this.stopMusic(true);
    this.stopWeather();
    this.state.trackKind = "none";
    this.state.trackId = "";
  }

  // ─── Music playback ───────────────────────────────────────

  /**
   * Build a 16-note melodic phrase from the given scale, with variation.
   *
   * The phrase walks through the scale across two octaves, using a mix of
   * ascending runs, descending steps, and occasional leaps so the loop
   * feels musical rather than robotic.
   */
  private buildPhrase(scale: Scale, baseNote: number): number[] {
    const phrase: number[] = [];
    const len = scale.length;

    // Section A (4 notes): ascending root octave
    for (let i = 0; i < 4; i++) {
      phrase.push(noteFreq(baseNote + scale[i % len]));
    }
    // Section B (4 notes): upper octave descending
    for (let i = 3; i >= 0; i--) {
      phrase.push(noteFreq(baseNote + scale[i % len] + 12));
    }
    // Section C (4 notes): mixed — leap up, step down, step up, root
    phrase.push(noteFreq(baseNote + scale[2 % len]));
    phrase.push(noteFreq(baseNote + scale[(len - 1) % len] + 12));
    phrase.push(noteFreq(baseNote + scale[1 % len] + 12));
    phrase.push(noteFreq(baseNote + scale[3 % len]));
    // Section D (4 notes): resolve back toward root with passing tones
    phrase.push(noteFreq(baseNote + scale[(len - 2) % len]));
    phrase.push(noteFreq(baseNote + scale[0] + 12));
    phrase.push(noteFreq(baseNote + scale[1 % len]));
    phrase.push(noteFreq(baseNote + scale[0]));

    return phrase;
  }

  /**
   * Start a looping procedural melody from the given profile.
   * Crossfades out the previous track, then fades in the new one.
   */
  private playProfile(profile: BiomeProfile, isNight: boolean): void {
    if (!this.ctx || !this.musicGain) return;

    // Crossfade: fade out old track, then start new one
    this.stopMusic(); // initiates fade-out

    const { scale, baseNote } = isNight ? nightScale(profile) : { scale: profile.scale, baseNote: profile.baseNote };
    const secPerBeat = 60 / profile.bpm;
    const ctx = this.ctx;
    const dest = this.musicGain;

    // Build a 16-note phrase for a longer, less repetitive loop
    const phrase = this.buildPhrase(scale, baseNote);

    const startPlayback = () => {
      if (!this.ctx || this.ctx.state === "closed") return;

      // Fade music gain back in
      try {
        dest.gain.setValueAtTime(0, ctx.currentTime);
        dest.gain.linearRampToValueAtTime(this.state.musicVolume, ctx.currentTime + CROSSFADE_DURATION);
      } catch { /* ok */ }

      let step = 0;
      const playNote = () => {
        if (!this.ctx || this.ctx.state === "closed") return;
        const freq = phrase[step % phrase.length];

        // Lead note
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = profile.wave;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + secPerBeat * 0.9);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + secPerBeat);

        // Soft pad / bass every other beat
        if (step % 2 === 0) {
          const pad = ctx.createOscillator();
          const pGain = ctx.createGain();
          pad.type = profile.padWave;
          pad.frequency.value = freq / 2;
          pGain.gain.setValueAtTime(0.08, ctx.currentTime);
          pGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + secPerBeat * 1.8);
          pad.connect(pGain);
          pGain.connect(dest);
          pad.start(ctx.currentTime);
          pad.stop(ctx.currentTime + secPerBeat * 2);
        }

        // ── Orchestral layers ─────────────────────────────────

        // Strings: sustained sine + vibrato, every 4 beats
        if (step % 4 === 0) {
          const strOsc = ctx.createOscillator();
          const strGain = ctx.createGain();
          const vibrato = ctx.createOscillator();
          const vibratoGain = ctx.createGain();
          strOsc.type = "sine";
          strOsc.frequency.value = freq * 2; // an octave above
          vibrato.type = "sine";
          vibrato.frequency.value = 5; // 5 Hz vibrato
          vibratoGain.gain.value = 3; // subtle depth
          vibrato.connect(vibratoGain);
          vibratoGain.connect(strOsc.frequency);
          strGain.gain.setValueAtTime(0.06, ctx.currentTime);
          strGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + secPerBeat * 3.5);
          strOsc.connect(strGain);
          strGain.connect(dest);
          strOsc.start(ctx.currentTime);
          strOsc.stop(ctx.currentTime + secPerBeat * 4);
          vibrato.start(ctx.currentTime);
          vibrato.stop(ctx.currentTime + secPerBeat * 4);
        }

        // Brass / horn stab: sawtooth a 5th above, every 4 beats offset by 2
        if (step % 4 === 2) {
          const horn = ctx.createOscillator();
          const hGain = ctx.createGain();
          horn.type = "sawtooth";
          horn.frequency.value = freq * 1.5; // a fifth above
          hGain.gain.setValueAtTime(0.05, ctx.currentTime);
          hGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + secPerBeat * 0.6);
          horn.connect(hGain);
          hGain.connect(dest);
          horn.start(ctx.currentTime);
          horn.stop(ctx.currentTime + secPerBeat * 0.8);
        }

        // Percussion: kick on even beats, hihat on odd beats
        if (step % 2 === 0) {
          // Kick drum — pitched-down sine
          const kick = ctx.createOscillator();
          const kGain = ctx.createGain();
          kick.type = "sine";
          kick.frequency.setValueAtTime(150, ctx.currentTime);
          kick.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
          kGain.gain.setValueAtTime(0.08, ctx.currentTime);
          kGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
          kick.connect(kGain);
          kGain.connect(dest);
          kick.start(ctx.currentTime);
          kick.stop(ctx.currentTime + 0.2);
        } else {
          // Hihat — short filtered noise burst
          const hhBufSize = Math.floor(ctx.sampleRate * 0.05);
          const hhBuf = ctx.createBuffer(1, hhBufSize, ctx.sampleRate);
          const hhData = hhBuf.getChannelData(0);
          for (let i = 0; i < hhBufSize; i++) hhData[i] = Math.random() * 2 - 1;
          const hhSrc = ctx.createBufferSource();
          hhSrc.buffer = hhBuf;
          const hhFilter = ctx.createBiquadFilter();
          hhFilter.type = "highpass";
          hhFilter.frequency.value = 7000;
          const hhGain = ctx.createGain();
          hhGain.gain.setValueAtTime(0.04, ctx.currentTime);
          hhGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
          hhSrc.connect(hhFilter);
          hhFilter.connect(hhGain);
          hhGain.connect(dest);
          hhSrc.start(ctx.currentTime);
        }

        step++;
      };

      // Play the first note immediately, then loop
      playNote();
      this.musicTimer = setInterval(playNote, secPerBeat * 1000);
    };

    // Delay new track start by the crossfade duration so the old one fades out
    this.musicStartTimer = setTimeout(() => {
      this.musicStartTimer = null;
      startPlayback();
    }, CROSSFADE_DURATION * 1000);
  }

  // ─── Public music API ─────────────────────────────────────

  /** Play biome-appropriate overworld music. */
  playBiomeMusic(chunkName: string, period: TimePeriod): void {
    if (!this.ctx) return;
    const isNight = period === TimePeriod.Night || period === TimePeriod.Dusk;
    const prefix = resolveBiomePrefix(chunkName) || "default";
    const trackId = `${prefix}_${isNight ? "night" : "day"}`;

    if (this.state.trackKind === "biome" && this.state.trackId === trackId) return;

    const profile = getProfileForBiome(chunkName);
    this.state.trackKind = "biome";
    this.state.trackId = trackId;
    this.state.nightMode = isNight;
    this.playProfile(profile, isNight);
  }

  /** Play battle music (non-boss). */
  playBattleMusic(): void {
    if (!this.ctx) return;
    if (this.state.trackKind === "battle") return;
    this.state.trackKind = "battle";
    this.state.trackId = "battle";
    this.state.nightMode = false;
    this.playProfile(BATTLE_PROFILE, false);
  }

  /** Play boss-specific battle music. */
  playBossMusic(bossId: string): void {
    if (!this.ctx) return;
    if (this.state.trackKind === "boss" && this.state.trackId === bossId) return;
    const overrides = BOSS_OVERRIDES[bossId] ?? {};
    const profile: BiomeProfile = { ...BOSS_PROFILE, ...overrides };
    this.state.trackKind = "boss";
    this.state.trackId = bossId;
    this.state.nightMode = false;
    this.playProfile(profile, false);
  }

  /** Play city / shop music. */
  playCityMusic(cityName: string): void {
    if (!this.ctx) return;
    if (this.state.trackKind === "city" && this.state.trackId === cityName) return;
    const overrides = CITY_OVERRIDES[cityName] ?? {};
    const profile: BiomeProfile = { ...CITY_PROFILE, ...overrides };
    this.state.trackKind = "city";
    this.state.trackId = cityName;
    this.state.nightMode = false;
    this.playProfile(profile, false);
  }

  /** Play title screen music. */
  playTitleMusic(): void {
    if (!this.ctx) return;
    if (this.state.trackKind === "title") return;
    this.state.trackKind = "title";
    this.state.trackId = "title";
    this.state.nightMode = false;
    this.playProfile(TITLE_PROFILE, false);
  }

  /** Play defeat / game-over music (future use). */
  playDefeatMusic(): void {
    if (!this.ctx) return;
    if (this.state.trackKind === "defeat") return;
    this.state.trackKind = "defeat";
    this.state.trackId = "defeat";
    this.state.nightMode = false;
    this.playProfile(DEFEAT_PROFILE, false);
  }

  /**
   * Play a short victory fanfare (ascending arpeggio).
   * Stops the current music, plays the jingle, then goes silent.
   */
  playVictoryJingle(): void {
    if (!this.ctx || !this.musicGain) return;
    this.stopMusic(true);
    this.state.trackKind = "victory";
    this.state.trackId = "victory";

    const ctx = this.ctx;
    const dest = this.musicGain;
    // Restore gain immediately for the jingle
    try {
      dest.gain.setValueAtTime(this.state.musicVolume, ctx.currentTime);
    } catch { /* ok */ }

    // Ascending major arpeggio: root, 3rd, 5th, octave, high 3rd, high 5th
    const jingleNotes = [0, 4, 7, 12, 16, 19];
    const noteDuration = 0.15;
    const holdDuration = 0.6;

    for (let i = 0; i < jingleNotes.length; i++) {
      const freq = noteFreq(jingleNotes[i]);
      const startTime = ctx.currentTime + i * noteDuration;
      const isLast = i === jingleNotes.length - 1;
      const dur = isLast ? holdDuration : noteDuration * 0.95;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.22, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(startTime);
      osc.stop(startTime + dur + 0.05);

      // Harmony on even notes
      if (i % 2 === 0) {
        const harm = ctx.createOscillator();
        const hGain = ctx.createGain();
        harm.type = "sine";
        harm.frequency.value = freq / 2;
        hGain.gain.setValueAtTime(0.10, startTime);
        hGain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
        harm.connect(hGain);
        hGain.connect(dest);
        harm.start(startTime);
        harm.stop(startTime + dur + 0.05);
      }
    }
  }

  // ─── Weather SFX ──────────────────────────────────────────

  /** Start weather ambient sound effect overlay. */
  playWeatherSFX(weather: WeatherType): void {
    if (!this.ctx || !this.sfxGain) return;
    this.stopWeather();
    if (weather === WeatherType.Clear) return;

    const ctx = this.ctx;
    const dest = this.sfxGain;

    switch (weather) {
      case WeatherType.Rain: {
        // Filtered white noise — gentle rain patter
        const bufSize = ctx.sampleRate * 2;
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 800;
        const gain = ctx.createGain();
        gain.gain.value = 0.06;
        src.connect(filter);
        filter.connect(gain);
        gain.connect(dest);
        src.start();
        this.weatherNodes.push(src, filter, gain);
        break;
      }
      case WeatherType.Snow: {
        // Very soft high-filtered noise
        const bufSize = ctx.sampleRate * 2;
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.value = 3000;
        const gain = ctx.createGain();
        gain.gain.value = 0.03;
        src.connect(filter);
        filter.connect(gain);
        gain.connect(dest);
        src.start();
        this.weatherNodes.push(src, filter, gain);
        break;
      }
      case WeatherType.Sandstorm: {
        // Harsh midrange noise
        const bufSize = ctx.sampleRate * 2;
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 1200;
        bp.Q.value = 0.8;
        const gain = ctx.createGain();
        gain.gain.value = 0.07;
        src.connect(bp);
        bp.connect(gain);
        gain.connect(dest);
        src.start();
        this.weatherNodes.push(src, bp, gain);
        break;
      }
      case WeatherType.Storm: {
        // Heavy rain + periodic low rumble
        const bufSize = ctx.sampleRate * 2;
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 600;
        const gain = ctx.createGain();
        gain.gain.value = 0.10;
        src.connect(filter);
        filter.connect(gain);
        gain.connect(dest);
        src.start();
        this.weatherNodes.push(src, filter, gain);

        // Thunder rumble — periodic low osc
        const rumble = () => {
          if (!this.ctx || this.ctx.state === "closed") return;
          const osc = ctx.createOscillator();
          const rGain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = 40 + Math.random() * 30;
          rGain.gain.setValueAtTime(0.12, ctx.currentTime);
          rGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
          osc.connect(rGain);
          rGain.connect(dest);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 1.5);
        };
        rumble();
        this.weatherTimer = setInterval(rumble, 3000 + Math.random() * 5000);
        break;
      }
      case WeatherType.Fog: {
        // Very low drone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 80;
        gain.gain.value = 0.04;
        osc.connect(gain);
        gain.connect(dest);
        osc.start();
        this.weatherNodes.push(osc, gain);
        break;
      }
    }
  }

  // ─── Dialogue blip (future use) ───────────────────────────

  /**
   * Play a quick "blabla" blip for NPC dialogue.
   * Each character can have a different pitch offset.
   * @param pitchOffset Semitones from A4 (default 0).
   */
  playDialogueBlip(pitchOffset = 0): void {
    if (!this.ctx || !this.dialogGain) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = noteFreq(pitchOffset + 12);
    gain.gain.setValueAtTime(0.10, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(this.dialogGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  }

  // ─── Interaction SFX ──────────────────────────────────────

  /** Play a weapon attack swoosh + impact (normal hit). */
  playAttackSFX(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const dest = this.sfxGain;

    // Swoosh — band-pass filtered noise sweep
    const swBufSize = Math.floor(ctx.sampleRate * 0.15);
    const swBuf = ctx.createBuffer(1, swBufSize, ctx.sampleRate);
    const swData = swBuf.getChannelData(0);
    for (let i = 0; i < swBufSize; i++) swData[i] = Math.random() * 2 - 1;
    const swSrc = ctx.createBufferSource();
    swSrc.buffer = swBuf;
    const swFilter = ctx.createBiquadFilter();
    swFilter.type = "bandpass";
    swFilter.frequency.setValueAtTime(3000, ctx.currentTime);
    swFilter.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.12);
    swFilter.Q.value = 2;
    const swGain = ctx.createGain();
    swGain.gain.setValueAtTime(0.25, ctx.currentTime);
    swGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    swSrc.connect(swFilter);
    swFilter.connect(swGain);
    swGain.connect(dest);
    swSrc.start(ctx.currentTime);

    // Impact thump — low sine hit
    const impOsc = ctx.createOscillator();
    const impGain = ctx.createGain();
    impOsc.type = "sine";
    impOsc.frequency.setValueAtTime(120, ctx.currentTime + 0.08);
    impOsc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.22);
    impGain.gain.setValueAtTime(0, ctx.currentTime);
    impGain.gain.linearRampToValueAtTime(0.20, ctx.currentTime + 0.08);
    impGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    impOsc.connect(impGain);
    impGain.connect(dest);
    impOsc.start(ctx.currentTime);
    impOsc.stop(ctx.currentTime + 0.35);

    // Metallic clang overtone for extra audibility
    const clang = ctx.createOscillator();
    const clGain = ctx.createGain();
    clang.type = "square";
    clang.frequency.value = 800;
    clGain.gain.setValueAtTime(0.06, ctx.currentTime + 0.06);
    clGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    clang.connect(clGain);
    clGain.connect(dest);
    clang.start(ctx.currentTime + 0.06);
    clang.stop(ctx.currentTime + 0.2);
  }

  /** Play a miss / whiff sound — swoosh with no impact. */
  playMissSFX(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const dest = this.sfxGain;

    // Airy swoosh that fades to nothing — high to low sweep
    const swBufSize = Math.floor(ctx.sampleRate * 0.2);
    const swBuf = ctx.createBuffer(1, swBufSize, ctx.sampleRate);
    const swData = swBuf.getChannelData(0);
    for (let i = 0; i < swBufSize; i++) swData[i] = Math.random() * 2 - 1;
    const swSrc = ctx.createBufferSource();
    swSrc.buffer = swBuf;
    const swFilter = ctx.createBiquadFilter();
    swFilter.type = "highpass";
    swFilter.frequency.setValueAtTime(4000, ctx.currentTime);
    swFilter.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.2);
    const swGain = ctx.createGain();
    swGain.gain.setValueAtTime(0.18, ctx.currentTime);
    swGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    swSrc.connect(swFilter);
    swFilter.connect(swGain);
    swGain.connect(dest);
    swSrc.start(ctx.currentTime);

    // Descending "whoop" — sine pitch drop that conveys a miss
    const whoop = ctx.createOscillator();
    const wGain = ctx.createGain();
    whoop.type = "sine";
    whoop.frequency.setValueAtTime(500, ctx.currentTime + 0.05);
    whoop.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.25);
    wGain.gain.setValueAtTime(0.08, ctx.currentTime + 0.05);
    wGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    whoop.connect(wGain);
    wGain.connect(dest);
    whoop.start(ctx.currentTime + 0.05);
    whoop.stop(ctx.currentTime + 0.3);
  }

  /** Play a critical hit sound — powerful slam with rising sting. */
  playCriticalHitSFX(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const dest = this.sfxGain;

    // Heavy impact — deep and loud
    const impOsc = ctx.createOscillator();
    const impGain = ctx.createGain();
    impOsc.type = "sine";
    impOsc.frequency.setValueAtTime(180, ctx.currentTime);
    impOsc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.3);
    impGain.gain.setValueAtTime(0.30, ctx.currentTime);
    impGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    impOsc.connect(impGain);
    impGain.connect(dest);
    impOsc.start(ctx.currentTime);
    impOsc.stop(ctx.currentTime + 0.4);

    // Crunchy noise layer — distorted impact
    const crBufSize = Math.floor(ctx.sampleRate * 0.12);
    const crBuf = ctx.createBuffer(1, crBufSize, ctx.sampleRate);
    const crData = crBuf.getChannelData(0);
    for (let i = 0; i < crBufSize; i++) crData[i] = Math.random() * 2 - 1;
    const crSrc = ctx.createBufferSource();
    crSrc.buffer = crBuf;
    const crFilter = ctx.createBiquadFilter();
    crFilter.type = "lowpass";
    crFilter.frequency.value = 1200;
    const crGain = ctx.createGain();
    crGain.gain.setValueAtTime(0.22, ctx.currentTime);
    crGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    crSrc.connect(crFilter);
    crFilter.connect(crGain);
    crGain.connect(dest);
    crSrc.start(ctx.currentTime);

    // Rising metallic sting — ascending pitch for "critical!" emphasis
    const sting = ctx.createOscillator();
    const stGain = ctx.createGain();
    sting.type = "sawtooth";
    sting.frequency.setValueAtTime(400, ctx.currentTime + 0.08);
    sting.frequency.exponentialRampToValueAtTime(1600, ctx.currentTime + 0.25);
    const stFilter = ctx.createBiquadFilter();
    stFilter.type = "bandpass";
    stFilter.frequency.value = 1000;
    stFilter.Q.value = 2;
    stGain.gain.setValueAtTime(0.10, ctx.currentTime + 0.08);
    stGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    sting.connect(stFilter);
    stFilter.connect(stGain);
    stGain.connect(dest);
    sting.start(ctx.currentTime + 0.08);
    sting.stop(ctx.currentTime + 0.35);

    // High-pitched bell accent
    const bell = ctx.createOscillator();
    const bGain = ctx.createGain();
    bell.type = "triangle";
    bell.frequency.value = noteFreq(19); // high G#
    bGain.gain.setValueAtTime(0.12, ctx.currentTime + 0.12);
    bGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    bell.connect(bGain);
    bGain.connect(dest);
    bell.start(ctx.currentTime + 0.12);
    bell.stop(ctx.currentTime + 0.45);
  }

  /** Play a chest-opening jingle — ascending twinkle. */
  playChestOpenSFX(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const dest = this.sfxGain;

    // 4-note ascending music-box twinkle
    const notes = [0, 4, 7, 12]; // root, 3rd, 5th, octave
    const noteDuration = 0.1;

    for (let i = 0; i < notes.length; i++) {
      const startTime = ctx.currentTime + i * noteDuration;
      const freq = noteFreq(notes[i] + 12); // high register

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.14, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration * 2);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(startTime);
      osc.stop(startTime + noteDuration * 2.5);

      // Shimmer on the last note
      if (i === notes.length - 1) {
        const shim = ctx.createOscillator();
        const sGain = ctx.createGain();
        shim.type = "sine";
        shim.frequency.value = freq * 2;
        sGain.gain.setValueAtTime(0.06, startTime);
        sGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
        shim.connect(sGain);
        sGain.connect(dest);
        shim.start(startTime);
        shim.stop(startTime + 0.5);
      }
    }
  }

  /** Play a dungeon-enter boom — ominous deep impact. */
  playDungeonEnterSFX(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const dest = this.sfxGain;

    // Deep reverberating boom
    const boom = ctx.createOscillator();
    const bGain = ctx.createGain();
    boom.type = "sine";
    boom.frequency.setValueAtTime(80, ctx.currentTime);
    boom.frequency.exponentialRampToValueAtTime(25, ctx.currentTime + 0.8);
    bGain.gain.setValueAtTime(0.18, ctx.currentTime);
    bGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    boom.connect(bGain);
    bGain.connect(dest);
    boom.start(ctx.currentTime);
    boom.stop(ctx.currentTime + 1.0);

    // Descending eerie tone
    const eerie = ctx.createOscillator();
    const eGain = ctx.createGain();
    eerie.type = "sawtooth";
    eerie.frequency.setValueAtTime(400, ctx.currentTime);
    eerie.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.6);
    const eFilter = ctx.createBiquadFilter();
    eFilter.type = "lowpass";
    eFilter.frequency.value = 600;
    eGain.gain.setValueAtTime(0.06, ctx.currentTime);
    eGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    eerie.connect(eFilter);
    eFilter.connect(eGain);
    eGain.connect(dest);
    eerie.start(ctx.currentTime);
    eerie.stop(ctx.currentTime + 0.7);

    // Stone scraping noise
    const scBufSize = Math.floor(ctx.sampleRate * 0.4);
    const scBuf = ctx.createBuffer(1, scBufSize, ctx.sampleRate);
    const scData = scBuf.getChannelData(0);
    for (let i = 0; i < scBufSize; i++) scData[i] = Math.random() * 2 - 1;
    const scSrc = ctx.createBufferSource();
    scSrc.buffer = scBuf;
    const scFilter = ctx.createBiquadFilter();
    scFilter.type = "bandpass";
    scFilter.frequency.value = 400;
    scFilter.Q.value = 1.5;
    const scGain = ctx.createGain();
    scGain.gain.setValueAtTime(0.08, ctx.currentTime);
    scGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    scSrc.connect(scFilter);
    scFilter.connect(scGain);
    scGain.connect(dest);
    scSrc.start(ctx.currentTime);
  }

  /** Play a potion drinking / glug sound. */
  playPotionSFX(): void {
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const dest = this.sfxGain;

    // Three quick "glug" bubbles — rapid frequency wobble
    for (let i = 0; i < 3; i++) {
      const t = ctx.currentTime + i * 0.1;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(300 + i * 60, t);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.07);
      gain.gain.setValueAtTime(0.10, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.1);
    }

    // Healing shimmer after the glugs
    const shimOsc = ctx.createOscillator();
    const shimGain = ctx.createGain();
    shimOsc.type = "triangle";
    shimOsc.frequency.value = noteFreq(12);
    shimGain.gain.setValueAtTime(0, ctx.currentTime);
    shimGain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.3);
    shimGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    shimOsc.connect(shimGain);
    shimGain.connect(dest);
    shimOsc.start(ctx.currentTime);
    shimOsc.stop(ctx.currentTime + 0.7);
  }

  // ─── Terrain Footstep SFX ────────────────────────────────

  /**
   * Play a very quiet footstep sound that varies by terrain type.
   * @param terrainType Terrain enum value from map data.
   */
  playFootstepSFX(terrainType: number): void {
    if (!this.ctx || !this.footstepGain) return;
    const ctx = this.ctx;
    const dest = this.footstepGain;

    // Determine filter parameters based on terrain
    let filterFreq = 1200;
    let filterQ = 1;
    let volume = 0.12;
    let duration = 0.08;
    let filterType: BiquadFilterType = "bandpass";

    // Terrain constants (matching map.ts Terrain enum):
    // 0=Grass, 1=Forest, 2=Mountain, 4=Sand, 8=Path, 9=DungeonFloor,
    // 13=Tundra, 14=Swamp, 15=DeepForest, 16=Volcanic, 17=Canyon,
    // 19=CityFloor, 22=Carpet
    switch (terrainType) {
      case 0: // Grass — soft rustle
        filterFreq = 2000; filterQ = 0.5; volume = 0.08; duration = 0.06;
        break;
      case 1: case 15: // Forest / DeepForest — twig snap + leaf crunch
        filterFreq = 3000; filterQ = 1.5; volume = 0.10; duration = 0.05;
        break;
      case 2: case 17: // Mountain / Canyon — rocky crunch
        filterFreq = 800; filterQ = 2; volume = 0.14; duration = 0.07;
        break;
      case 4: // Sand — soft shifting
        filterFreq = 4000; filterQ = 0.3; volume = 0.06; duration = 0.1;
        filterType = "highpass";
        break;
      case 8: case 19: // Path / CityFloor — hard tap
        filterFreq = 1500; filterQ = 3; volume = 0.12; duration = 0.04;
        break;
      case 9: // DungeonFloor — echoing stone
        filterFreq = 600; filterQ = 4; volume = 0.13; duration = 0.09;
        break;
      case 13: // Tundra — crunchy snow
        filterFreq = 5000; filterQ = 0.5; volume = 0.09; duration = 0.08;
        filterType = "highpass";
        break;
      case 14: // Swamp — squelch
        filterFreq = 400; filterQ = 2; volume = 0.11; duration = 0.12;
        filterType = "lowpass";
        break;
      case 16: // Volcanic — hot gravel crunch
        filterFreq = 700; filterQ = 2.5; volume = 0.13; duration = 0.06;
        break;
      case 22: // Carpet — very muffled
        filterFreq = 300; filterQ = 0.5; volume = 0.04; duration = 0.05;
        filterType = "lowpass";
        break;
    }

    // Generate short noise burst filtered to mimic the terrain
    const bufSize = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    filter.Q.value = filterQ;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(ctx.currentTime);
  }

  /** Play a hoofbeat sound for mounted movement. Two rapid taps to mimic a trotting gait. */
  playMountedFootstepSFX(): void {
    if (!this.ctx || !this.footstepGain) return;
    const ctx = this.ctx;
    const dest = this.footstepGain;

    for (let tap = 0; tap < 2; tap++) {
      const offset = tap * 0.06; // delay second tap by 60ms for trotting rhythm
      const duration = 0.04;
      const bufSize = Math.floor(ctx.sampleRate * duration);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 500; // deep thud for hooves
      filter.Q.value = 5;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + duration);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      src.start(ctx.currentTime + offset);
    }
  }

  // ─── Debug: play all sounds ───────────────────────────────

  /**
   * Sequentially demo every sound the engine can produce.
   * Returns total duration in seconds so callers can show a countdown.
   */
  async playAllSounds(): Promise<number> {
    if (!this.ctx) {
      this.init();
    }
    const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const demos: { label: string; fn: () => void }[] = [
      { label: "Title",          fn: () => this.playTitleMusic() },
      { label: "Biome: Woodland", fn: () => this.playBiomeMusic("Woodland Frontier", TimePeriod.Day) },
      { label: "Biome: Frozen (night)", fn: () => this.playBiomeMusic("Frozen Reach", TimePeriod.Night) },
      { label: "Biome: Murky",   fn: () => this.playBiomeMusic("Murky Expanse", TimePeriod.Day) },
      { label: "Biome: Arid",    fn: () => this.playBiomeMusic("Arid Ridge", TimePeriod.Day) },
      { label: "Biome: Scorched", fn: () => this.playBiomeMusic("Scorched Hollow", TimePeriod.Day) },
      { label: "Battle",         fn: () => this.playBattleMusic() },
      { label: "Boss: dragon",   fn: () => this.playBossMusic("dragon") },
      { label: "Boss: frostGiant", fn: () => this.playBossMusic("frostGiant") },
      { label: "Victory jingle", fn: () => this.playVictoryJingle() },
      { label: "City: Willowdale", fn: () => this.playCityMusic("Willowdale") },
      { label: "City: Frostheim", fn: () => this.playCityMusic("Frostheim") },
      { label: "Defeat",         fn: () => this.playDefeatMusic() },
      { label: "SFX: Attack",    fn: () => { this.stopMusic(true); this.playAttackSFX(); } },
      { label: "SFX: Miss",      fn: () => this.playMissSFX() },
      { label: "SFX: Crit Hit",  fn: () => this.playCriticalHitSFX() },
      { label: "SFX: Chest",     fn: () => this.playChestOpenSFX() },
      { label: "SFX: Dungeon",   fn: () => this.playDungeonEnterSFX() },
      { label: "SFX: Potion",    fn: () => this.playPotionSFX() },
      { label: "SFX: Footstep (grass)", fn: () => { for (let i = 0; i < 4; i++) setTimeout(() => this.playFootstepSFX(0), i * 200); } },
      { label: "SFX: Footstep (stone)", fn: () => { for (let i = 0; i < 4; i++) setTimeout(() => this.playFootstepSFX(9), i * 200); } },
      { label: "SFX: Footstep (sand)",  fn: () => { for (let i = 0; i < 4; i++) setTimeout(() => this.playFootstepSFX(4), i * 200); } },
      { label: "SFX: Mounted hoofbeat", fn: () => { for (let i = 0; i < 4; i++) setTimeout(() => this.playMountedFootstepSFX(), i * 200); } },
      { label: "Weather: Rain",  fn: () => { this.playWeatherSFX(WeatherType.Rain); } },
      { label: "Weather: Storm", fn: () => { this.playWeatherSFX(WeatherType.Storm); } },
      { label: "Weather: Snow",  fn: () => { this.playWeatherSFX(WeatherType.Snow); } },
      { label: "Weather: Sandstorm", fn: () => { this.playWeatherSFX(WeatherType.Sandstorm); } },
      { label: "Weather: Fog",   fn: () => { this.playWeatherSFX(WeatherType.Fog); } },
      { label: "Dialogue blip (low)", fn: () => { this.stopWeather(); for (let i = 0; i < 5; i++) setTimeout(() => this.playDialogueBlip(-5), i * 80); } },
      { label: "Dialogue blip (high)", fn: () => { for (let i = 0; i < 5; i++) setTimeout(() => this.playDialogueBlip(8), i * 80); } },
    ];

    const durationPerDemo = 3; // seconds
    for (const demo of demos) {
      demo.fn();
      await pause(durationPerDemo * 1000);
    }
    this.stopAll();
    return demos.length * durationPerDemo;
  }
}

// ── Singleton ──────────────────────────────────────────────────

export const audioEngine = new AudioEngine();
