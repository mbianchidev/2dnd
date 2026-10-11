import type { DiceOutcome } from "./dicePresentation";

interface DiceAudioNode {
  connect(destination: DiceAudioNode): unknown;
  disconnect(): void;
}

interface DiceOscillator extends DiceAudioNode {
  type: OscillatorType;
  frequency: { setValueAtTime(value: number, time: number): unknown };
  onended: ((event: Event) => void) | null;
  start(time: number): void;
  stop(time: number): void;
}

interface DiceGain extends DiceAudioNode {
  gain: {
    setValueAtTime(value: number, time: number): unknown;
    exponentialRampToValueAtTime(value: number, time: number): unknown;
  };
}

export interface DiceAudioContext {
  readonly currentTime: number;
  createOscillator(): DiceOscillator;
  createGain(): DiceGain;
}

/** Short, deterministic oscillator cues; no noise buffers or shared RNG. */
export function playDiceSound(
  context: DiceAudioContext,
  destination: DiceAudioNode,
  outcome: DiceOutcome,
): () => void {
  const notes = outcome === "critical"
    ? [440, 660, 880]
    : outcome === "fumble" || outcome === "failure" || outcome === "miss"
      ? [330, 220]
      : [520, 620];
  const stops = new Set<() => void>();
  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + index * 0.055;
    let active = true;
    const disconnect = (): void => {
      if (!active) return;
      active = false;
      oscillator.disconnect();
      gain.disconnect();
      stops.delete(stop);
    };
    const stop = (): void => {
      if (!active) return;
      oscillator.stop(context.currentTime);
      disconnect();
    };
    stops.add(stop);
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.055, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.07);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.onended = disconnect;
    oscillator.start(start);
    oscillator.stop(start + 0.075);
  });
  return (): void => {
    for (const stop of [...stops]) stop();
  };
}
