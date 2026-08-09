import * as Phaser from "phaser";
import { debugPanelLog } from "../config";
import type { CodexKnowledgeEntry } from "../data/codexKnowledge";
import { getMotionDuration } from "../systems/accessibility";

export class CodexDiscoveryManager {
  private container: Phaser.GameObjects.Container | null = null;
  private dismissTimer: Phaser.Time.TimerEvent | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  isShowing(): boolean {
    return this.container !== null;
  }

  show(entries: readonly CodexKnowledgeEntry[]): void {
    if (entries.length === 0) return;
    this.clear();

    const first = entries[0]!;
    const suffix = entries.length > 1 ? ` (+${entries.length - 1})` : "";
    const category = first.category.toUpperCase();
    const message = `CODEX ${category}: ${first.name}${suffix}`;
    debugPanelLog(`[CODEX] Discovered ${first.id}${suffix}`, true);

    const width = Math.min(300, this.scene.cameras.main.width - 16);
    const background = this.scene.add.graphics();
    background.fillStyle(0x101024, 0.96);
    background.fillRoundedRect(0, 0, width, 34, 5);
    background.lineStyle(2, 0xffd700, 1);
    background.strokeRoundedRect(0, 0, width, 34, 5);

    const text = this.scene.add.text(8, 6, `NEW - ${message}`, {
      fontSize: "10px",
      fontFamily: "monospace",
      color: "#fff3a6",
      wordWrap: { width: width - 16 },
    });
    text.setData("accessibilityMaxWidth", width - 16);

    const container = this.scene.add.container(
      this.scene.cameras.main.width - width - 8,
      8,
      [background, text],
    ).setDepth(10_000);
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
      const duration = getMotionDuration(180);
      if (duration === 0) {
        this.clear();
        return;
      }
      this.scene.tweens.add({
        targets: container,
        alpha: 0,
        duration,
        onComplete: () => this.clear(),
      });
    });
  }

  clear(): void {
    this.dismissTimer?.remove(false);
    this.dismissTimer = null;
    if (this.container) {
      this.scene.tweens.killTweensOf(this.container);
      this.container.destroy(true);
      this.container = null;
    }
  }
}
