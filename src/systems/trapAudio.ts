import type { TrapType } from "../data/traps";

interface TrapSoundProfile {
  wave: OscillatorType;
  startFrequency: number;
  endFrequency: number;
  duration: number;
  gain: number;
  pulses: number;
  noiseGain: number;
  noiseFilter: BiquadFilterType;
  noiseFrequency: number;
}

const TRAP_SOUND_PROFILES: Record<TrapType, TrapSoundProfile> = {
  spikePit: {
    wave: "square",
    startFrequency: 180,
    endFrequency: 45,
    duration: 0.34,
    gain: 0.18,
    pulses: 1,
    noiseGain: 0.15,
    noiseFilter: "lowpass",
    noiseFrequency: 650,
  },
  poisonDarts: {
    wave: "sawtooth",
    startFrequency: 1800,
    endFrequency: 500,
    duration: 0.16,
    gain: 0.09,
    pulses: 3,
    noiseGain: 0.08,
    noiseFilter: "highpass",
    noiseFrequency: 2400,
  },
  fallingRocks: {
    wave: "sine",
    startFrequency: 110,
    endFrequency: 28,
    duration: 0.55,
    gain: 0.24,
    pulses: 2,
    noiseGain: 0.2,
    noiseFilter: "lowpass",
    noiseFrequency: 500,
  },
  alarm: {
    wave: "square",
    startFrequency: 880,
    endFrequency: 660,
    duration: 0.18,
    gain: 0.12,
    pulses: 4,
    noiseGain: 0,
    noiseFilter: "bandpass",
    noiseFrequency: 1000,
  },
  hiddenFloor: {
    wave: "triangle",
    startFrequency: 240,
    endFrequency: 35,
    duration: 0.5,
    gain: 0.16,
    pulses: 1,
    noiseGain: 0.18,
    noiseFilter: "bandpass",
    noiseFrequency: 420,
  },
  necroticRune: {
    wave: "sawtooth",
    startFrequency: 320,
    endFrequency: 90,
    duration: 0.65,
    gain: 0.11,
    pulses: 2,
    noiseGain: 0.07,
    noiseFilter: "bandpass",
    noiseFrequency: 750,
  },
  frostBurst: {
    wave: "triangle",
    startFrequency: 1500,
    endFrequency: 2600,
    duration: 0.3,
    gain: 0.1,
    pulses: 2,
    noiseGain: 0.1,
    noiseFilter: "highpass",
    noiseFrequency: 3200,
  },
  flameJet: {
    wave: "sawtooth",
    startFrequency: 420,
    endFrequency: 95,
    duration: 0.45,
    gain: 0.13,
    pulses: 2,
    noiseGain: 0.2,
    noiseFilter: "bandpass",
    noiseFrequency: 1100,
  },
};

function playNoiseBurst(
  context: AudioContext,
  destination: AudioNode,
  profile: TrapSoundProfile,
): void {
  if (profile.noiseGain <= 0) return;
  const duration = Math.max(0.08, profile.duration);
  const bufferSize = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index++) {
    data[index] = Math.random() * 2 - 1;
  }

  const source = context.createBufferSource();
  source.buffer = buffer;
  const filter = context.createBiquadFilter();
  filter.type = profile.noiseFilter;
  filter.frequency.value = profile.noiseFrequency;
  const gain = context.createGain();
  gain.gain.setValueAtTime(profile.noiseGain, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    context.currentTime + duration,
  );
  source.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  source.start(context.currentTime);
  source.stop(context.currentTime + duration);
}

/** Synthesize the distinct trigger sound for one dungeon trap type. */
export function playTrapSound(
  context: AudioContext,
  destination: AudioNode,
  type: TrapType,
): void {
  const profile = TRAP_SOUND_PROFILES[type];
  const pulseGap = Math.max(0.06, profile.duration * 0.55);
  for (let pulse = 0; pulse < profile.pulses; pulse++) {
    const startTime = context.currentTime + pulse * pulseGap;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = profile.wave;
    oscillator.frequency.setValueAtTime(profile.startFrequency, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      profile.endFrequency,
      startTime + profile.duration,
    );
    gain.gain.setValueAtTime(profile.gain, startTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      startTime + profile.duration,
    );
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + profile.duration);
  }
  playNoiseBurst(context, destination, profile);
}
