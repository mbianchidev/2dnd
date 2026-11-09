import type * as Phaser from "phaser";
import { getBattleTrailFrame, type BattleTrailKind } from "../systems/battleChoreography";
import type { PixelPoint } from "../systems/pixelArt";
import { gamePreferences, isReducedMotionEnabled } from "../systems/accessibility";
import { BATTLE_DEPTH } from "./battleDepth";

interface ActionTrail {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly start: PixelPoint;
  readonly targets: readonly PixelPoint[];
  readonly kind: BattleTrailKind;
  readonly color: number;
  readonly motion: { progress: number };
  tween: Phaser.Tweens.Tween | null;
  timer: Phaser.Time.TimerEvent | null;
}

export class BattleChoreographyRenderer {
  private readonly trails = new Map<string, ActionTrail>();
  private readonly unsubscribe: () => void;
  private disposed = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.unsubscribe = gamePreferences.subscribe(() => {
      if (isReducedMotionEnabled()) this.clear();
    });
  }

  get activeCount(): number { return this.trails.size; }

  show(actorId: string, kind: BattleTrailKind, start: PixelPoint, targets: readonly PixelPoint[], color: number): void {
    if (this.disposed || isReducedMotionEnabled() || targets.length === 0) return;
    this.remove(actorId);
    if (this.trails.size >= 8) {
      const oldest = this.trails.keys().next().value;
      if (oldest !== undefined) this.remove(oldest);
    }
    const trail: ActionTrail = {
      graphics: this.scene.add.graphics().setDepth(BATTLE_DEPTH.actionParticles),
      start: { ...start }, targets: targets.slice(0, 8).map((point) => ({ ...point })),
      kind, color, motion: { progress: 0 }, tween: null, timer: null,
    };
    this.trails.set(actorId, trail);
    const duration = kind === "spell" || kind === "heal" ? 480 : 380;
    trail.tween = this.scene.tweens.add({
      targets: trail.motion, progress: 1, duration, ease: "Linear",
      onUpdate: () => {
        if (this.trails.get(actorId) !== trail) return;
        const graphics = trail.graphics.clear();
        for (const target of trail.targets) {
          const frame = getBattleTrailFrame(trail.kind, trail.start, target, trail.motion.progress);
          for (const stroke of frame.strokes) {
            graphics.lineStyle(stroke.width + 2, 0x27333b, stroke.alpha * 0.55)
              .lineBetween(stroke.from.x, stroke.from.y, stroke.to.x, stroke.to.y);
            graphics.lineStyle(stroke.width, trail.color, stroke.alpha)
              .lineBetween(stroke.from.x, stroke.from.y, stroke.to.x, stroke.to.y);
          }
          graphics.fillStyle(trail.color, Math.max(0, 1 - trail.motion.progress))
            .fillRect(frame.head.x - frame.radius, frame.head.y - frame.radius, frame.radius * 2, frame.radius * 2);
        }
      },
      onComplete: () => this.remove(actorId, trail),
    });
    trail.timer = this.scene.time.delayedCall(duration + 120, () => this.remove(actorId, trail));
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    this.clear();
  }

  private clear(): void {
    for (const id of this.trails.keys()) this.remove(id);
  }

  private remove(id: string, expected?: ActionTrail): void {
    const trail = this.trails.get(id);
    if (!trail || (expected && expected !== trail)) return;
    this.trails.delete(id);
    trail.timer?.remove(false);
    trail.tween?.stop();
    trail.tween?.remove();
    trail.graphics.destroy();
  }
}
