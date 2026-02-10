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

/** Battle profile (non-boss). */
const BATTLE_PROFILE: BiomeProfile = {
  baseNote: -3, scale: NATURAL_MINOR, bpm: 120, wave: "square", padWave: "triangle",
};

/** City / shop profile — cheerful, slower. */
const CITY_PROFILE: BiomeProfile = {
  baseNote: 4, scale: MAJOR_PENTA, bpm: 100, wave: "triangle", padWave: "sine",
};

/** Title screen profile. */
const TITLE_PROFILE: BiomeProfile = {
  baseNote: 0, scale: MAJOR_PENTA, bpm: 76, wave: "sine", padWave: "triangle",
};

/** Defeat / game-over profile (future use). */
const DEFEAT_PROFILE: BiomeProfile = {
  baseNote: -5, scale: NATURAL_MINOR, bpm: 52, wave: "sine", padWave: "sine",
};

// ── Boss-specific tuning overrides ─────────────────────────────

const BOSS_OVERRIDES: Record<string, Partial<BiomeProfile>> = {
  troll:        { baseNote: -10, bpm: 130 },
  dragon:       { baseNote: -12, bpm: 150, wave: "sawtooth" },
  frostGiant:   { baseNote: -5,  bpm: 125, wave: "triangle" },
  swampHydra:   { baseNote: -8,  bpm: 135, wave: "sawtooth" },
  volcanicWyrm: { baseNote: -14, bpm: 155, wave: "square" },
  canyonDrake:  { baseNote: -9,  bpm: 145, wave: "sawtooth" },
};

// ── City-specific tuning overrides ─────────────────────────────

const CITY_OVERRIDES: Record<string, Partial<BiomeProfile>> = {
  Willowdale:  { baseNote: 4,  bpm: 96 },
  Ironhold:    { baseNote: 0,  bpm: 104, wave: "square" },
  Frostheim:   { baseNote: 2,  bpm: 88, scale: MINOR_PENTA },
  Deeproot:    { baseNote: -2, bpm: 92 },
  Sandport:    { baseNote: 5,  bpm: 100, scale: HARMONIC_MINOR },
  Canyonwatch: { baseNote: 3,  bpm: 98, scale: HARMONIC_MINOR },
  Ashfall:     { baseNote: -4, bpm: 90, scale: NATURAL_MINOR },
  Dunerest:    { baseNote: 5,  bpm: 94 },
  Thornvale:   { baseNote: 0,  bpm: 96 },
  Bogtown:     { baseNote: -3, bpm: 80, scale: DIMINISHED },
  Shadowfen:   { baseNote: -5, bpm: 76, scale: DIMINISHED },
  Ridgewatch:  { baseNote: 1,  bpm: 100 },
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
export type TrackKind = "biome" | "battle" | "boss" | "city" | "title" | "defeat" | "none";

export interface AudioState {
  trackKind: TrackKind;
  /** Identifier within the kind (e.g. biome prefix, boss id, city name). */
  trackId: string;
  /** Whether night mode tone shift is active. */
  nightMode: boolean;
  muted: boolean;
  volume: number;
}

export function createAudioState(): AudioState {
  return { trackKind: "none", trackId: "", nightMode: false, muted: false, volume: 0.35 };
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

  // Currently playing music nodes
  private musicNodes: AudioNode[] = [];
  private musicTimer: ReturnType<typeof setInterval> | null = null;

  // Weather ambient nodes
  private weatherNodes: AudioNode[] = [];
  private weatherTimer: ReturnType<typeof setInterval> | null = null;

  // State
  state: AudioState = createAudioState();

  // ─── Init ──────────────────────────────────────────────────

  /** Must be called from a user gesture (click / keydown). */
  init(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.state.muted ? 0 : this.state.volume;
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.6;
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.4;
    this.sfxGain.connect(this.masterGain);
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
  }

  toggleMute(): boolean {
    this.setMuted(!this.state.muted);
    return this.state.muted;
  }

  // ─── Stop helpers ─────────────────────────────────────────

  private stopMusic(): void {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    for (const n of this.musicNodes) {
      try { (n as OscillatorNode).stop?.(); } catch { /* already stopped */ }
      try { n.disconnect(); } catch { /* ok */ }
    }
    this.musicNodes = [];
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
    this.stopMusic();
    this.stopWeather();
    this.state.trackKind = "none";
    this.state.trackId = "";
  }

  // ─── Music playback ───────────────────────────────────────

  /**
   * Start a looping procedural melody from the given profile.
   * Returns immediately — the melody loops via setInterval.
   */
  private playProfile(profile: BiomeProfile, isNight: boolean): void {
    if (!this.ctx || !this.musicGain) return;
    this.stopMusic();

    const { scale, baseNote } = isNight ? nightScale(profile) : { scale: profile.scale, baseNote: profile.baseNote };
    const secPerBeat = 60 / profile.bpm;
    const ctx = this.ctx;
    const dest = this.musicGain;

    // Generate a looping 8-note phrase from the scale
    const phrase: number[] = [];
    for (let i = 0; i < 8; i++) {
      const idx = i % scale.length;
      const octaveShift = i < 4 ? 0 : 12;
      phrase.push(noteFreq(baseNote + scale[idx] + octaveShift));
    }

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

      step++;
    };

    // Play the first note immediately, then loop
    playNote();
    this.musicTimer = setInterval(playNote, secPerBeat * 1000);
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
    if (!this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = noteFreq(pitchOffset + 12);
    gain.gain.setValueAtTime(0.10, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
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
      { label: "City: Willowdale", fn: () => this.playCityMusic("Willowdale") },
      { label: "City: Frostheim", fn: () => this.playCityMusic("Frostheim") },
      { label: "Defeat",         fn: () => this.playDefeatMusic() },
      { label: "Weather: Rain",  fn: () => { this.stopMusic(); this.playWeatherSFX(WeatherType.Rain); } },
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
