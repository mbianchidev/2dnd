import { vi } from "vitest";

class MockAudioParam {
  value = 0;
  readonly setValueAtTime = vi.fn((value: number, _time: number): void => { this.value = value; });
  readonly linearRampToValueAtTime = vi.fn();
  readonly exponentialRampToValueAtTime = vi.fn();
  readonly cancelAndHoldAtTime = vi.fn();
}

class MockAudioNode {
  readonly connect = vi.fn();
  readonly disconnect = vi.fn();
}

class MockAudioSource extends MockAudioNode {
  type: OscillatorType = "sine";
  readonly frequency = new MockAudioParam();
  buffer: { duration: number } | null = null;
  loop = false;
  onended: (() => void) | null = null;
  private endTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly context: MockAudioContext) { super(); }

  readonly start = vi.fn((time = this.context.currentTime): void => {
    this.context.started.push({
      frequency: this.frequency.value, wave: this.type, time, source: this,
    });
  });

  readonly stop = vi.fn((time = this.context.currentTime): void => {
    if (this.endTimer !== null) clearTimeout(this.endTimer);
    this.endTimer = setTimeout(() => {
      this.endTimer = null;
      this.onended?.();
    }, Math.max(0, time - this.context.currentTime) * 1000);
  });
}

/** Observable Web Audio adapter: no real output, and its clock follows fake timers. */
export class MockAudioContext {
  static instances: MockAudioContext[] = [];
  readonly destination = new MockAudioNode();
  readonly sampleRate = 64;
  readonly nodes: MockAudioNode[] = [];
  readonly started: Array<{
    frequency: number; wave: OscillatorType; time: number; source: MockAudioSource;
  }> = [];
  readonly buffers: object[] = [];
  state: AudioContextState = "running";
  clockOffset = 0;
  private readonly createdAt = Date.now();
  private readonly stateListeners = new Set<() => void>();

  constructor() { MockAudioContext.instances.push(this); }

  get currentTime(): number { return (Date.now() - this.createdAt) / 1000 + this.clockOffset; }

  createGain(): MockAudioNode & { gain: MockAudioParam } {
    const node = Object.assign(new MockAudioNode(), { gain: new MockAudioParam() });
    this.nodes.push(node);
    return node;
  }

  createBiquadFilter(): MockAudioNode & {
    frequency: MockAudioParam; Q: MockAudioParam; type: BiquadFilterType;
  } {
    const node = Object.assign(new MockAudioNode(), {
      frequency: new MockAudioParam(), Q: new MockAudioParam(), type: "lowpass" as BiquadFilterType,
    });
    this.nodes.push(node);
    return node;
  }

  createOscillator(): MockAudioSource {
    const node = new MockAudioSource(this);
    this.nodes.push(node);
    return node;
  }

  createBufferSource(): MockAudioSource { return this.createOscillator(); }

  createBuffer(_channels: number, length: number, sampleRate: number): {
    duration: number; getChannelData: () => Float32Array;
  } {
    const samples = new Float32Array(length);
    const buffer = { duration: length / sampleRate, getChannelData: () => samples };
    this.buffers.push(buffer);
    return buffer;
  }

  addEventListener(_name: string, callback: () => void): void { this.stateListeners.add(callback); }
  removeEventListener(_name: string, callback: () => void): void { this.stateListeners.delete(callback); }
  setState(state: AudioContextState): void {
    this.state = state;
    for (const listener of this.stateListeners) listener();
  }
}
