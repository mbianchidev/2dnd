import type * as Phaser from "phaser";
import { debugPanelLog } from "../config";
import type { CodexKnowledgeEntry } from "../data/codexKnowledge";
import { getMotionDuration } from "../systems/accessibility";
import { renderNotificationPanel } from "../renderers/notification";

export class CodexDiscoveryManager {
  private container: Phaser.GameObjects.Container | null = null;
  private dismissTimer: Phaser.Time.TimerEvent | null = null;
  private pendingEntries: readonly CodexKnowledgeEntry[] = [];
  private safeToShow = true;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly canShow: () => boolean = () => true,
  ) {}

  isShowing(): boolean {
    return this.container !== null;
  }

  show(entries: readonly CodexKnowledgeEntry[]): void {
    if (entries.length === 0) return;
    this.clear();
    this.pendingEntries = [...entries];
    if (this.safeToShow && this.canShow()) this.present();
  }

  update(safeToShow: boolean): void {
    this.safeToShow = safeToShow && this.canShow();
    if (!this.safeToShow) {
      this.clearPresentation();
    } else if (!this.container && this.pendingEntries.length > 0) {
      this.present();
    }
  }

  private present(): void {
    const first = this.pendingEntries[0]!;
    const suffix = this.pendingEntries.length > 1 ? ` (+${this.pendingEntries.length - 1})` : "";
    const category = first.category.toUpperCase();
    const message = `CODEX ${category}: ${first.name}${suffix}`;
    debugPanelLog(`[CODEX] Discovered ${first.id}${suffix}`, true);

    const container = renderNotificationPanel(this.scene, {
      id: "codex-discovery-notice",
      message: `NEW - ${message}`,
      maxWidth: 300,
      y: 8,
      depth: 10_000,
      backgroundColor: 0x101024,
    });
    this.container = container;

    const fadeDuration = getMotionDuration(160);
    if (fadeDuration > 0) {
      container.setAlpha(0);
      this.scene.tweens.add({
        targets: container,
        alpha: 1,
        duration: fadeDuration,
      });
    }

    this.dismissTimer = this.scene.time.delayedCall(2600, () => {
      if (this.container !== container) return;
      const finish = (): void => {
        if (this.container !== container) return;
        if (this.canShow()) this.clear();
        else this.clearPresentation();
      };
      const duration = getMotionDuration(180);
      if (duration === 0) {
        finish();
        return;
      }
      this.scene.tweens.add({
        targets: container,
        alpha: 0,
        duration,
        onComplete: finish,
      });
    });
  }

  clear(): void {
    this.clearPresentation();
    this.pendingEntries = [];
  }

  private clearPresentation(): void {
    this.dismissTimer?.remove(false);
    this.dismissTimer = null;
    if (this.container) {
      this.scene.tweens.killTweensOf(this.container);
      this.container.destroy(true);
      this.container = null;
    }
  }
}
