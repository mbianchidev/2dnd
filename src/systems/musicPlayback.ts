import { buildMusicBar, noteFreq } from "./music";
import type { MusicBar, MusicContext, MusicNote } from "./music";
import type { BiomeProfile } from "../data/music";
import type { WeatherType } from "./weather";

const LOOKAHEAD_SECONDS = 0.12;
const SCHEDULER_INTERVAL_MS = 25;
const CROSSFADE_SECONDS = 0.6;

interface MusicVoice {
  readonly source: AudioScheduledSourceNode;
  readonly nodes: readonly AudioNode[];
}

interface MusicTrack {
  readonly gain: GainNode;
  readonly voices: Set<MusicVoice>;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

interface MusicLoop {
  readonly track: MusicTrack;
  readonly profile: BiomeProfile;
  context: MusicContext;
  step: number;
  nextTime: number;
  barIndex: number;
  bar: MusicBar;
}

export interface MusicPlaybackSnapshot {
  readonly bar: number;
  readonly section: MusicBar["section"] | null;
  readonly pressure: number;
  readonly weather: WeatherType | null;
  readonly activeVoices: number;
  readonly activeTracks: number;
  readonly scheduling: boolean;
}

/** Audio-clock scheduling with bounded lookahead and explicitly owned voices/crossfades. */
export class ProceduralMusicPlayer {
  private readonly tracks = new Set<MusicTrack>();
  private loop: MusicLoop | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private paused = false;

  public constructor(
    private readonly context: AudioContext,
    private readonly destination: AudioNode,
    private readonly noise: AudioBuffer,
  ) {
    context.addEventListener("statechange", this.handleStateChange);
  }

  public get snapshot(): MusicPlaybackSnapshot {
    let activeVoices = 0;
    for (const track of this.tracks) activeVoices += track.voices.size;
    return {
      bar: this.loop?.barIndex ?? 0,
      section: this.loop?.bar.section ?? null,
      pressure: this.loop?.context.pressure ?? 0,
      weather: this.loop?.context.weather ?? null,
      activeVoices,
      activeTracks: this.tracks.size,
      scheduling: this.timer !== null,
    };
  }

  public play(profile: BiomeProfile, context: MusicContext): void {
    if (this.context.state === "closed") return;
    this.retireCurrentTrack();
    const track = this.createTrack();
    const now = this.context.currentTime;
    track.gain.gain.setValueAtTime(0, now);
    track.gain.gain.linearRampToValueAtTime(1, now + CROSSFADE_SECONDS);
    this.loop = {
      track, profile, context, step: 0, nextTime: now + 0.02,
      barIndex: 0, bar: buildMusicBar(profile, 0, context),
    };
    this.startScheduler();
  }

  public setWeather(weather: WeatherType): void {
    if (this.loop && this.loop.context.weather !== weather) {
      this.loop.context = { ...this.loop.context, weather };
    }
  }

  public setPressure(pressure: number): void {
    if (this.loop && this.loop.context.pressure !== pressure) {
      this.loop.context = { ...this.loop.context, pressure };
    }
  }

  public setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      this.clearScheduler();
      for (const track of this.tracks) {
        for (const voice of [...track.voices]) this.releaseVoice(track, voice, true);
      }
    } else {
      if (this.loop) this.loop.nextTime = this.context.currentTime + 0.02;
      this.startScheduler();
    }
  }

  public playVictory(): void {
    this.stop();
    if (this.context.state === "closed" || this.paused) return;
    const track = this.createTrack();
    const now = this.context.currentTime + 0.02;
    const notes = [0, 4, 7, 12, 16, 19];
    notes.forEach((note, index) => {
      const duration = index === notes.length - 1 ? 0.6 : 0.15 * 0.95;
      const descriptor: MusicNote = {
        instrument: "lead", frequency: noteFreq(note), wave: "triangle",
        offsetBeats: 0, durationBeats: duration, volume: 0.18,
      };
      this.scheduleVoice(track, descriptor, now + index * 0.15, 1);
      if (index % 2 === 0) {
        this.scheduleVoice(track, {
          ...descriptor, frequency: descriptor.frequency / 2, wave: "sine", volume: 0.08,
        }, now + index * 0.15, 1);
      }
    });
    track.cleanupTimer = setTimeout(() => this.releaseTrack(track), 1500);
  }

  public stop(): void {
    this.clearScheduler();
    this.loop = null;
    for (const track of [...this.tracks]) this.releaseTrack(track);
  }

  public destroy(): void {
    this.stop();
    this.context.removeEventListener("statechange", this.handleStateChange);
  }

  private readonly handleStateChange = (): void => {
    if (this.context.state === "closed") this.stop();
    else if (this.context.state === "running") this.startScheduler();
    else this.clearScheduler();
  };

  private startScheduler(): void {
    if (!this.loop || this.paused || this.context.state !== "running" || this.timer !== null) return;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), SCHEDULER_INTERVAL_MS);
  }

  private clearScheduler(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    const loop = this.loop;
    if (!loop || this.paused || this.context.state !== "running") return;
    const now = this.context.currentTime;
    const halfBeat = 30 / loop.profile.bpm;
    // A throttled/background tab skips missed beats instead of allocating a catch-up burst.
    if (loop.nextTime < now - 0.05) {
      const skipped = Math.ceil((now - loop.nextTime) / halfBeat);
      loop.step += skipped;
      loop.nextTime += skipped * halfBeat;
    }
    while (loop.nextTime < now + LOOKAHEAD_SECONDS) {
      const barIndex = Math.floor(loop.step / 8);
      if (barIndex !== loop.barIndex) {
        loop.barIndex = barIndex;
        loop.bar = buildMusicBar(loop.profile, barIndex, loop.context);
      }
      const beat = (loop.step % 8) / 2;
      for (const note of loop.bar.notes) {
        if (note.offsetBeats === beat) {
          this.scheduleVoice(loop.track, note, loop.nextTime, halfBeat * 2);
        }
      }
      loop.step++;
      loop.nextTime += halfBeat;
    }
  }

  private createTrack(): MusicTrack {
    const gain = this.context.createGain();
    gain.connect(this.destination);
    const track: MusicTrack = { gain, voices: new Set(), cleanupTimer: null };
    this.tracks.add(track);
    return track;
  }

  private retireCurrentTrack(): void {
    if (!this.loop) {
      for (const track of [...this.tracks]) this.releaseTrack(track);
      return;
    }
    const track = this.loop.track;
    this.loop = null;
    const now = this.context.currentTime;
    track.gain.gain.cancelAndHoldAtTime(now);
    track.gain.gain.linearRampToValueAtTime(0, now + CROSSFADE_SECONDS);
    track.cleanupTimer = setTimeout(
      () => this.releaseTrack(track), CROSSFADE_SECONDS * 1000 + 50,
    );
    // Rapid location changes retain at most one outgoing track.
    for (const stale of [...this.tracks]) {
      if (stale !== track) this.releaseTrack(stale);
    }
  }

  private scheduleVoice(
    track: MusicTrack,
    note: MusicNote,
    time: number,
    secondsPerBeat: number,
  ): void {
    const duration = Math.max(0.035, note.durationBeats * secondsPerBeat);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(note.volume, time + Math.min(0.025, duration / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    gain.connect(track.gain);
    let source: AudioScheduledSourceNode;
    const nodes: AudioNode[] = [gain];
    if (note.instrument === "hat") {
      const noise = this.context.createBufferSource();
      noise.buffer = this.noise;
      const filter = this.context.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = note.frequency;
      noise.connect(filter);
      filter.connect(gain);
      nodes.push(filter);
      source = noise;
    } else {
      const oscillator = this.context.createOscillator();
      oscillator.type = note.wave;
      oscillator.frequency.setValueAtTime(note.frequency, time);
      if (note.instrument === "kick") {
        oscillator.frequency.exponentialRampToValueAtTime(40, time + duration);
      }
      oscillator.connect(gain);
      source = oscillator;
    }
    const voice: MusicVoice = { source, nodes };
    track.voices.add(voice);
    source.onended = () => this.releaseVoice(track, voice, false);
    source.start(time);
    source.stop(time + duration + 0.015);
  }

  private releaseVoice(track: MusicTrack, voice: MusicVoice, stop: boolean): void {
    if (!track.voices.delete(voice)) return;
    voice.source.onended = null;
    if (stop && this.context.state !== "closed") voice.source.stop(this.context.currentTime);
    voice.source.disconnect();
    for (const node of voice.nodes) node.disconnect();
  }

  private releaseTrack(track: MusicTrack): void {
    if (!this.tracks.delete(track)) return;
    if (track.cleanupTimer !== null) clearTimeout(track.cleanupTimer);
    for (const voice of [...track.voices]) this.releaseVoice(track, voice, true);
    track.gain.disconnect();
  }
}
