import * as Phaser from "phaser";
import { debugPanelLog } from "../config";
import { getAchievement, getTitle } from "../data/achievements";
import {
  acknowledgeAchievementNotification,
  type AchievementId,
} from "../systems/achievements";
import { getMotionDuration } from "../systems/accessibility";
import type { PlayerState } from "../systems/player";

export class AchievementNotificationManager {
  private container: Phaser.GameObjects.Container | null = null;
  private dismissTimer: Phaser.Time.TimerEvent | null = null;
  private currentId: AchievementId | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: PlayerState,
    private readonly onAcknowledged: () => void,
  ) {}

  update(safeToShow: boolean): void {
    if (!safeToShow || this.container) return;
    const achievementId =
      this.player.progression.achievements.pendingNotificationIds[0];
    if (achievementId) this.show(achievementId);
  }

  clear(): void {
    this.dismissTimer?.remove(false);
    this.dismissTimer = null;
    if (this.container) {
      this.scene.tweens.killTweensOf(this.container);
      this.container.destroy(true);
      this.container = null;
    }
    this.currentId = null;
  }

  private show(achievementId: AchievementId): void {
    const definition = getAchievement(achievementId);
    const reward = definition.rewardTitleId
      ? getTitle(definition.rewardTitleId)
      : undefined;
    const width = Math.min(330, this.scene.cameras.main.width - 16);
    const height = reward ? 58 : 46;
    const background = this.scene.add.graphics();
    background.fillStyle(0x101b18, 0.97);
    background.fillRoundedRect(0, 0, width, height, 5);
    background.lineStyle(2, 0xffd700, 1);
    background.strokeRoundedRect(0, 0, width, height, 5);
    const text = this.scene.add.text(
      8,
      6,
      `ACHIEVEMENT UNLOCKED\n${definition.name} (+${definition.points} pts)${reward ? `\nTitle: ${reward.name}` : ""}`,
      {
        fontSize: "10px",
        fontFamily: "monospace",
        color: "#fff3a6",
        wordWrap: { width: width - 16 },
      },
    );
    text.setData("accessibilityMaxWidth", width - 16);
    const container = this.scene.add.container(
      this.scene.cameras.main.width - width - 8,
      48,
      [background, text],
    ).setDepth(9_900);
    this.container = container;
    this.currentId = achievementId;
    debugPanelLog(`[ACHIEVEMENT] Unlocked ${achievementId}`, true);

    const fadeDuration = getMotionDuration(160);
    if (fadeDuration > 0) {
      container.setAlpha(0);
      this.scene.tweens.add({
        targets: container,
        alpha: 1,
        duration: fadeDuration,
      });
    }
    this.dismissTimer = this.scene.time.delayedCall(2800, () => {
      if (this.container !== container || this.currentId !== achievementId) return;
      const finish = (): void => {
        acknowledgeAchievementNotification(this.player, achievementId);
        this.clear();
        this.onAcknowledged();
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
}
