export interface DiceThrowFrame {
  readonly offset: number;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
  readonly tilt: number;
  readonly yaw: number;
  readonly scaleX: number;
  readonly scaleY: number;
  readonly shadowScale: number;
  readonly shadowOpacity: number;
}

export interface DiceThrowMotion {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly frames: readonly DiceThrowFrame[];
}

const THROW_PHASES = [
  { offset: 0, progress: 0, bounce: 0, tilt: 65, yaw: -130, squash: 1 },
  { offset: 0.2, progress: 0.35, bounce: 0, tilt: -55, yaw: 115, squash: 0.86 },
  { offset: 0.36, progress: 0.55, bounce: 1, tilt: 48, yaw: -80, squash: 1 },
  { offset: 0.52, progress: 0.73, bounce: 0, tilt: -30, yaw: 60, squash: 0.93 },
  { offset: 0.65, progress: 0.84, bounce: 0.45, tilt: 25, yaw: -40, squash: 1 },
  { offset: 0.78, progress: 0.92, bounce: 0, tilt: -15, yaw: 20, squash: 0.97 },
  { offset: 0.88, progress: 0.97, bounce: 0.15, tilt: 8, yaw: -10, squash: 1 },
  { offset: 1, progress: 1, bounce: 0, tilt: 0, yaw: 0, squash: 1 },
] as const;

/** Deterministic throw geometry only; it never sees rolls, actors or mechanics. */
export function createDiceThrowMotion(
  count: number,
  width: number,
  height: number,
  textScale: number,
): readonly DiceThrowMotion[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`[diceMotion] Invalid dice count ${count}`);
  }
  if (!Number.isFinite(width) || !Number.isFinite(height)
    || width <= 0 || height <= 0 || !Number.isFinite(textScale) || textScale <= 0) {
    throw new Error("[diceMotion] Invalid measured viewport.");
  }
  if (count === 0) return Object.freeze([]);
  const columns = Math.min(count, Math.ceil(Math.sqrt(count * width / height)));
  const rows = Math.ceil(count / columns);
  const size = Math.min(84 * textScale, width / (columns + 1) * 0.65, height / (rows + 1) * 0.75);
  const margin = size * 0.55;
  return Object.freeze(Array.from({ length: count }, (_unused, index): DiceThrowMotion => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = width * (column + 1) / (columns + 1) - size / 2;
    const y = height * (row + 1) / (rows + 1) - size / 2;
    const direction = index % 2 === 0 ? 1 : -1;
    const startX = direction === 1 ? margin - x : width - size - margin - x;
    const startY = -Math.max(0, Math.min(size * 1.8, y - margin));
    const bounceHeight = Math.max(0, Math.min(size * 0.85, y - margin));
    const turns = 2 + index % 2;
    return Object.freeze({
      x, y, size,
      frames: Object.freeze(THROW_PHASES.map((phase): DiceThrowFrame => Object.freeze({
        offset: phase.offset,
        x: phase.progress === 1 ? 0 : startX * (1 - phase.progress),
        y: phase.offset === 0 ? startY : phase.bounce === 0 ? 0 : -bounceHeight * phase.bounce,
        rotation: phase.progress === 1 ? 0 : -360 * turns * direction * (1 - phase.progress),
        tilt: phase.tilt,
        yaw: phase.yaw === 0 ? 0 : phase.yaw * direction,
        scaleX: phase.squash === 1 ? 1 : 2 - phase.squash,
        scaleY: phase.squash,
        shadowScale: phase.offset === 0 ? 0.45 : 1 - phase.bounce * 0.4,
        shadowOpacity: phase.offset === 0 ? 0.25 : 0.6 - phase.bounce * 0.3,
      }))),
    });
  }));
}
