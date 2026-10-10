import { describe, expect, it, vi } from "vitest";
import { playDiceSound } from "../src/systems/diceAudio";
import { audioEngine } from "../src/systems/audio";

describe("deterministic dice cues", () => {
  it("is a cleanup-safe no-op before audio initialization", () => {
    expect(() => {
      const cleanup = audioEngine.playDiceCue("critical");
      cleanup();
      cleanup();
    }).not.toThrow();
  });

  it("uses no RNG and disconnects each node exactly once after end or cancellation", () => {
    const oscillators: Array<{
      connect: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
      frequency: { setValueAtTime: ReturnType<typeof vi.fn> };
      onended: ((event: Event) => void) | null;
      type: OscillatorType;
    }> = [];
    const gains: Array<{
      connect: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
      gain: {
        setValueAtTime: ReturnType<typeof vi.fn>;
        exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
      };
    }> = [];
    const context = {
      currentTime: 2,
      createOscillator: () => {
        const oscillator = {
          connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(),
          frequency: { setValueAtTime: vi.fn() },
          onended: null as ((event: Event) => void) | null,
          type: "triangle" as OscillatorType,
        };
        oscillators.push(oscillator);
        return oscillator;
      },
      createGain: () => {
        const gain = {
          connect: vi.fn(), disconnect: vi.fn(),
          gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        };
        gains.push(gain);
        return gain;
      },
    };
    const destination = { connect: vi.fn(), disconnect: vi.fn() };
    const random = vi.spyOn(Math, "random");
    const cleanup = playDiceSound(context, destination, "critical");
    expect(oscillators).toHaveLength(3);
    expect(oscillators[0]?.frequency.setValueAtTime).toHaveBeenCalledWith(440, 2);
    oscillators[0]?.onended?.(new Event("ended"));
    cleanup();
    cleanup();
    for (const oscillator of oscillators) {
      oscillator.onended?.(new Event("ended"));
      expect(oscillator.disconnect).toHaveBeenCalledTimes(1);
    }
    for (const gain of gains) expect(gain.disconnect).toHaveBeenCalledTimes(1);
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });
});
