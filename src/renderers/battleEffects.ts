import type * as Phaser from "phaser";
import { getBattleImpactFrame, type BattleImpactOptions } from "../systems/battleEffects";
import { gamePreferences, getAccessibilityPreferences, isReducedMotionEnabled } from "../systems/accessibility";
import { BATTLE_DEPTH } from "./battleDepth";

interface ActiveImpact {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly options: BattleImpactOptions;
  readonly motion: { progress: number };
  tween: Phaser.Tweens.Tween | null;
  watchdog: Phaser.Time.TimerEvent | null;
}

const IMPACT_COLORS = {
  strike: 0xffe6ad,
  spell: 0x78b7ff,
  ability: 0xffc65a,
  heal: 0x8ff0a4,
  guard: 0x80c8ff,
} as const;
const MAX_ACTIVE_IMPACTS = 8;

/** One Graphics object and one tween per actor, rather than a tween/object per particle. */
export class BattleImpactRenderer {
  private readonly impacts = new Map<string, ActiveImpact>();
  private readonly unsubscribePreferences: () => void;
  private disposed = false;

  public constructor(private readonly scene: Phaser.Scene) {
    this.unsubscribePreferences = gamePreferences.subscribe(() => {
      if (this.disposed) return;
      if (isReducedMotionEnabled()) this.clear();
      else for (const impact of this.impacts.values()) this.draw(impact);
    });
  }

  public get activeCount(): number { return this.impacts.size; }

  public get debugState(): string {
    let kinds = "";
    for (const impact of this.impacts.values()) {
      kinds += `${kinds ? "," : ""}${impact.options.kind}`;
    }
    return kinds || "none";
  }

  public show(actorId: string, x: number, y: number, options: BattleImpactOptions): void {
    if (this.disposed || isReducedMotionEnabled()) return;
    this.remove(actorId);
    if (this.impacts.size >= MAX_ACTIVE_IMPACTS) {
      const oldest = this.impacts.keys().next().value;
      if (oldest !== undefined) this.remove(oldest);
    }
    const graphics = this.scene.add.graphics()
      .setPosition(x, y)
      .setDepth(BATTLE_DEPTH.actionParticles)
      .setData("battleImpact", options.kind);
    const impact: ActiveImpact = {
      graphics, options, motion: { progress: 0 }, tween: null, watchdog: null,
    };
    this.impacts.set(actorId, impact);
    this.draw(impact);
    const duration = options.kind === "heal" || options.kind === "spell" ? 360 : 260;
    impact.tween = this.scene.tweens.add({
      targets: impact.motion,
      progress: 1,
      duration,
      ease: "Linear",
      onUpdate: () => {
        if (this.impacts.get(actorId) === impact) this.draw(impact);
      },
      onComplete: () => this.remove(actorId, impact),
    });
    impact.watchdog = this.scene.time.delayedCall(duration + 120, () => this.remove(actorId, impact));
  }

  public clear(): void {
    for (const actorId of this.impacts.keys()) this.remove(actorId);
  }

  public destroy(): void {
    this.disposed = true;
    this.unsubscribePreferences();
    this.clear();
  }

  private draw(impact: ActiveImpact): void {
    const frame = getBattleImpactFrame(impact.options, impact.motion.progress);
    const color = getAccessibilityPreferences().highContrast ? 0xffffff
      : impact.options.critical ? 0xffdf5d : IMPACT_COLORS[impact.options.kind];
    const graphics = impact.graphics.clear();
    for (const pixel of frame.pixels) {
      graphics.fillStyle(color, pixel.alpha).fillRect(pixel.x, pixel.y, pixel.size, pixel.size);
    }
    for (const stroke of frame.strokes) {
      graphics.lineStyle(stroke.width, color, stroke.alpha)
        .lineBetween(stroke.x1, stroke.y1, stroke.x2, stroke.y2);
    }
  }

  private remove(actorId: string, expected?: ActiveImpact): void {
    const impact = this.impacts.get(actorId);
    if (!impact || (expected && impact !== expected)) return;
    this.impacts.delete(actorId);
    impact.watchdog?.remove(false);
    impact.tween?.stop();
    impact.tween?.remove();
    impact.graphics.destroy();
  }
}
