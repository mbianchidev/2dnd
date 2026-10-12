import type * as Phaser from "phaser";
import { debugPanelLog } from "../config";
import { getAchievement, getTitle } from "../data/achievements";
import {
  acknowledgeAchievementNotification,
  type AchievementId,
} from "../systems/achievements";
import { getMotionDuration } from "../systems/accessibility";
import { renderNotificationPanel } from "../renderers/notification";
import type { PlayerState } from "../systems/player";

export class AchievementNotificationManager {
  private container: Phaser.GameObjects.Container | null = null;
  private dismissTimer: Phaser.Time.TimerEvent | null = null;
  private currentId: AchievementId | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: PlayerState,
    private readonly onAcknowledged: () => void,
    private readonly canShow: () => boolean = () => true,
  ) {}

  update(safeToShow: boolean): void {
    if (!safeToShow) {
      this.clear();
      return;
    }
    if (this.container) return;
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
    const container = renderNotificationPanel(this.scene, {
      id: "achievement-notification",
      message: `ACHIEVEMENT UNLOCKED\n${definition.name} (+${definition.points} pts)${reward ? `\nTitle: ${reward.name}` : ""}`,
      maxWidth: 330,
      y: 48,
      depth: 9_900,
      backgroundColor: 0x101b18,
    });
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
        if (this.container !== container || this.currentId !== achievementId) return;
        if (!this.canShow()) {
          this.clear();
          return;
        }
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
