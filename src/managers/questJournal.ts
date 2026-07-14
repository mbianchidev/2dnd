/**
 * Quest journal overlay for active and completed story progress.
 */

import * as Phaser from "phaser";
import { getQuestJournalEntries } from "../systems/quests";
import { calcPanelLayout, createDimGraphics, createPanelGraphics } from "../utils/ui";
import type { PlayerState } from "../systems/player";

export class QuestJournalManager {
  private readonly scene: Phaser.Scene;
  private journalOverlay: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  isOpen(): boolean {
    return this.journalOverlay !== null;
  }

  close(): void {
    this.journalOverlay?.destroy();
    this.journalOverlay = null;
  }

  toggle(player: PlayerState): void {
    if (this.journalOverlay) {
      this.close();
      return;
    }

    const entries = getQuestJournalEntries(player);
    const cameraWidth = this.scene.cameras.main.width;
    const cameraHeight = this.scene.cameras.main.height;
    const panelWidth = Math.min(560, cameraWidth - 40);
    const panelHeight = Math.min(
      cameraHeight - 40,
      Math.max(240, 114 + entries.length * 118),
    );
    const layout = calcPanelLayout(this.scene, panelWidth, panelHeight);
    const container = this.scene.add.container(0, 0).setDepth(90).setScrollFactor(0);

    const dim = createDimGraphics(this.scene, layout.w, layout.h, 0.72);
    dim.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, layout.w, layout.h),
      Phaser.Geom.Rectangle.Contains,
    );
    dim.on("pointerdown", () => this.close());
    container.add(dim);

    const panel = createPanelGraphics(
      this.scene,
      layout.px,
      layout.py,
      panelWidth,
      panelHeight,
    );
    panel.setInteractive(
      new Phaser.Geom.Rectangle(layout.px, layout.py, panelWidth, panelHeight),
      Phaser.Geom.Rectangle.Contains,
    );
    container.add(panel);

    const title = this.scene.add.text(
      layout.px + panelWidth / 2,
      layout.py + 14,
      "Quest Journal",
      {
        fontSize: "18px",
        fontFamily: "monospace",
        color: "#ffd700",
      },
    ).setOrigin(0.5, 0);
    container.add(title);

    let y = layout.py + 48;
    for (const entry of entries) {
      const typeLabel = entry.type === "main" ? "MAIN" : "SIDE";
      const statusLabel = entry.status === "completed" ? "COMPLETE" : "ACTIVE";
      const heading = this.scene.add.text(
        layout.px + 20,
        y,
        `[${typeLabel}] ${entry.name} - ${statusLabel}`,
        {
          fontSize: "13px",
          fontFamily: "monospace",
          color: entry.status === "completed" ? "#88ff88" : "#ffffff",
        },
      );
      container.add(heading);

      const stage = this.scene.add.text(
        layout.px + 30,
        y + 22,
        entry.stageTitle,
        {
          fontSize: "12px",
          fontFamily: "monospace",
          color: "#ffcc80",
        },
      );
      container.add(stage);

      const objective = this.scene.add.text(
        layout.px + 30,
        y + 40,
        entry.objective,
        {
          fontSize: "11px",
          fontFamily: "monospace",
          color: "#dddddd",
          wordWrap: { width: panelWidth - 60 },
        },
      );
      container.add(objective);

      const reward = this.scene.add.text(
        layout.px + 30,
        y + 70,
        `Reward: ${entry.reward}`,
        {
          fontSize: "10px",
          fontFamily: "monospace",
          color: "#9ecbff",
          wordWrap: { width: panelWidth - 60 },
        },
      );
      container.add(reward);
      y += 118;
    }

    const footer = this.scene.add.text(
      layout.px + panelWidth / 2,
      layout.py + panelHeight - 24,
      "[Q / ESC] Close",
      {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#aaaaaa",
      },
    ).setOrigin(0.5, 0);
    container.add(footer);

    this.journalOverlay = container;
  }
}
