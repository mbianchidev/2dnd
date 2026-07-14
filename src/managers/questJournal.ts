import * as Phaser from "phaser";
import { buildQuestJournal } from "../systems/quests";
import type { PlayerState } from "../systems/player";
import type {
  QuestJournalEntry,
  QuestUpdate,
} from "../systems/quests";
import { createDimGraphics, createPanelGraphics } from "../utils/ui";

type JournalTab = "active" | "completed";

export class QuestJournalManager {
  private scene: Phaser.Scene;
  private showMessage: (message: string, color?: string) => void;
  private overlay: Phaser.GameObjects.Container | null = null;
  private tab: JournalTab = "active";
  private selectedIndex = 0;
  private notificationQueue: QuestUpdate[] = [];
  private notificationRunning = false;

  constructor(
    scene: Phaser.Scene,
    showMessage: (message: string, color?: string) => void,
  ) {
    this.scene = scene;
    this.showMessage = showMessage;
  }

  isOpen(): boolean {
    return this.overlay !== null;
  }

  close(): void {
    this.overlay?.destroy();
    this.overlay = null;
  }

  toggle(player: PlayerState): void {
    if (this.overlay) {
      this.close();
      return;
    }
    this.open(player);
  }

  open(player: PlayerState): void {
    this.close();
    this.render(player);
  }

  refresh(player: PlayerState): void {
    if (!this.overlay) return;
    this.render(player);
  }

  enqueueUpdates(updates: QuestUpdate[]): void {
    if (updates.length === 0) return;
    this.notificationQueue.push(...updates);
    this.showNextNotification();
  }

  private showNextNotification(): void {
    if (this.notificationRunning) return;
    const update = this.notificationQueue.shift();
    if (!update) return;

    this.notificationRunning = true;
    const color = update.type === "quest"
      ? "#ffd740"
      : update.type === "stage"
        ? "#b39ddb"
        : update.type === "item"
          ? "#80cbc4"
          : "#ccff90";
    this.showMessage(update.message, color);
    this.scene.time.delayedCall(3400, () => {
      this.notificationRunning = false;
      this.showNextNotification();
    });
  }

  private render(player: PlayerState): void {
    this.overlay?.destroy();
    const entries = buildQuestJournal(player);
    const filtered = entries.filter((entry) =>
      this.tab === "active"
        ? entry.status === "active"
        : entry.status === "completed"
    );
    if (this.selectedIndex >= filtered.length) {
      this.selectedIndex = Math.max(0, filtered.length - 1);
    }

    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    const panelW = Math.min(500, w - 40);
    const panelH = Math.min(330, h - 40);
    const px = (w - panelW) / 2;
    const py = (h - panelH) / 2;
    const listW = 155;

    const container = this.scene.add.container(0, 0).setDepth(85);
    const dim = createDimGraphics(this.scene, w, h);
    dim.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, w, h),
      Phaser.Geom.Rectangle.Contains,
    );
    dim.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (
        pointer.x < px
        || pointer.x > px + panelW
        || pointer.y < py
        || pointer.y > py + panelH
      ) {
        this.close();
      }
    });
    container.add(dim);
    container.add(createPanelGraphics(this.scene, px, py, panelW, panelH));

    const title = this.scene.add.text(
      px + panelW / 2,
      py + 12,
      "Quest Journal",
      {
        fontSize: "16px",
        fontFamily: "monospace",
        color: "#ffd740",
      },
    ).setOrigin(0.5, 0);
    container.add(title);

    const activeTab = this.createTab(
      px + 18,
      py + 42,
      "Active",
      this.tab === "active",
      () => {
        this.tab = "active";
        this.selectedIndex = 0;
        this.render(player);
      },
    );
    const completedTab = this.createTab(
      px + 88,
      py + 42,
      "Completed",
      this.tab === "completed",
      () => {
        this.tab = "completed";
        this.selectedIndex = 0;
        this.render(player);
      },
    );
    container.add([activeTab, completedTab]);

    const divider = this.scene.add.graphics();
    divider.lineStyle(1, 0x5c5470, 1);
    divider.lineBetween(px + listW, py + 70, px + listW, py + panelH - 28);
    container.add(divider);

    this.renderQuestList(container, player, filtered, px, py, listW);
    this.renderQuestDetails(container, filtered[this.selectedIndex], px, py, panelW, panelH, listW);

    const hint = this.scene.add.text(
      px + panelW / 2,
      py + panelH - 10,
      "Q or ESC to close",
      {
        fontSize: "10px",
        fontFamily: "monospace",
        color: "#777788",
      },
    ).setOrigin(0.5, 1);
    container.add(hint);

    this.overlay = container;
  }

  private createTab(
    x: number,
    y: number,
    label: string,
    selected: boolean,
    onSelect: () => void,
  ): Phaser.GameObjects.Text {
    const tab = this.scene.add.text(x, y, label, {
      fontSize: "11px",
      fontFamily: "monospace",
      color: selected ? "#ffffff" : "#888899",
      backgroundColor: selected ? "#4a3f6b" : "#242238",
      padding: { x: 8, y: 4 },
    }).setInteractive({ useHandCursor: true });
    tab.on("pointerdown", onSelect);
    return tab;
  }

  private renderQuestList(
    container: Phaser.GameObjects.Container,
    player: PlayerState,
    entries: QuestJournalEntry[],
    px: number,
    py: number,
    listW: number,
  ): void {
    if (entries.length === 0) {
      const empty = this.scene.add.text(
        px + 16,
        py + 84,
        this.tab === "active" ? "No active quests." : "No completed quests.",
        {
          fontSize: "10px",
          fontFamily: "monospace",
          color: "#888899",
          wordWrap: { width: listW - 28 },
        },
      );
      container.add(empty);
      return;
    }

    entries.forEach((entry, index) => {
      const selected = index === this.selectedIndex;
      const label = this.scene.add.text(
        px + 12,
        py + 78 + index * 42,
        `${entry.kind === "main" ? "[Main]" : "[Side]"}\n${entry.title}`,
        {
          fontSize: "10px",
          fontFamily: "monospace",
          color: selected ? "#ffd740" : "#c9c6d8",
          backgroundColor: selected ? "#302a46" : undefined,
          padding: { x: 5, y: 4 },
          wordWrap: { width: listW - 24 },
        },
      ).setInteractive({ useHandCursor: true });
      label.on("pointerdown", () => {
        this.selectedIndex = index;
        this.render(player);
      });
      container.add(label);
    });
  }

  private renderQuestDetails(
    container: Phaser.GameObjects.Container,
    entry: QuestJournalEntry | undefined,
    px: number,
    py: number,
    panelW: number,
    panelH: number,
    listW: number,
  ): void {
    if (!entry) return;
    const detailX = px + listW + 16;
    const detailW = panelW - listW - 30;

    const questTitle = this.scene.add.text(detailX, py + 76, entry.title, {
      fontSize: "13px",
      fontFamily: "monospace",
      color: "#ffffff",
      wordWrap: { width: detailW },
    });
    container.add(questTitle);

    const stageTitle = this.scene.add.text(
      detailX,
      py + 100,
      entry.stageTitle,
      {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#b39ddb",
        wordWrap: { width: detailW },
      },
    );
    container.add(stageTitle);

    const summary = this.scene.add.text(
      detailX,
      py + 122,
      entry.summary,
      {
        fontSize: "10px",
        fontFamily: "monospace",
        color: "#b9b6c8",
        wordWrap: { width: detailW },
      },
    );
    container.add(summary);

    let objectiveY = Math.min(py + 168, summary.y + summary.height + 12);
    for (const objective of entry.objectives) {
      if (objectiveY > py + panelH - 54) break;
      const marker = objective.complete ? "[x]" : "[ ]";
      const count = objective.required > 1
        ? ` ${objective.current}/${objective.required}`
        : "";
      const objectiveText = this.scene.add.text(
        detailX,
        objectiveY,
        `${marker} ${objective.description}${count}`,
        {
          fontSize: "10px",
          fontFamily: "monospace",
          color: objective.complete
            ? "#80cbc4"
            : objective.optional
              ? "#ffcc80"
              : "#eeeeee",
          wordWrap: { width: detailW },
        },
      );
      container.add(objectiveText);
      objectiveY += objectiveText.height + 8;
    }
  }
}
