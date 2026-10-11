import * as Phaser from "phaser";
import { getAdjacentDevotionTemple } from "../systems/devotionTemples";
import { getDevotionVisitPrompt } from "../systems/devotionProfile";
import { getInputPromptSource } from "../systems/input";
import type { PlayerState } from "../systems/player";
import { createOverlayContainer } from "../utils/ui";
import { syncInteractiveHitArea } from "../managers/layout";

export class DevotionPromptRenderer {
  private container: Phaser.GameObjects.Container | null = null;
  private button: Phaser.GameObjects.Text | null = null;
  private hitWidth = 0;
  private hitHeight = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly visit: () => void,
  ) {}

  update(player: PlayerState, blocked: boolean): void {
    if (blocked || !getAdjacentDevotionTemple(player.position)) {
      this.clear();
      return;
    }
    const camera = this.scene.cameras.main;
    if (!this.container) {
      this.container = createOverlayContainer(this.scene, "devotion-visit", 100, {
        x: 8, y: camera.height - 72, width: camera.width - 16, height: 60,
      });
      this.button = this.scene.add.text(0, 0, "", {
        fontFamily: "monospace", fontSize: "12px", color: "#ffffff",
        backgroundColor: "#25304a", padding: { x: 12, y: 5 },
      }).setOrigin(0.5, 1).setInteractive({ useHandCursor: true });
      this.button.setData("layoutId", "devotion-visit-prompt");
      this.button.on("pointerdown", this.visit);
      this.container.add(this.button);
    }
    const button = this.button;
    if (!button) return;
    const label = getDevotionVisitPrompt(getInputPromptSource());
    if (button.text !== label) button.setText(label);
    button.setPosition(camera.width / 2, camera.height - 16);
    if (button.width !== this.hitWidth || button.height !== this.hitHeight) {
      syncInteractiveHitArea(button);
      this.hitWidth = button.width;
      this.hitHeight = button.height;
    }
  }

  clear(): void {
    this.container?.destroy(true);
    this.container = null;
    this.button = null;
    this.hitWidth = 0;
    this.hitHeight = 0;
  }
}
