import * as Phaser from "phaser";
import {
  CONTROL_GUIDANCE,
  TIP_CATEGORIES,
  TIP_CATEGORY_LABELS,
  TUTORIAL_STEPS,
  type TipCategory,
  type TipDefinition,
} from "../data/tutorial";
import {
  completeTutorial,
  createTutorialTipContext,
  getUnlockedTips,
} from "../systems/tutorial";
import type { PlayerState } from "../systems/player";
import {
  calcPanelLayout,
  createDimGraphics,
  createPanelGraphics,
} from "../utils/ui";

export type TutorialNavigationAction =
  | "previous"
  | "next"
  | "up"
  | "down"
  | "confirm";

interface TutorialManagerCallbacks {
  autoSave: () => void;
}

type TutorialMode = "tutorial" | "tips";

export class TutorialManager {
  private overlay: Phaser.GameObjects.Container | null = null;
  private mode: TutorialMode | null = null;
  private player: PlayerState | null = null;
  private tutorialStepIndex = 0;
  private replayingTutorial = false;
  private categoryIndex = 0;
  private tipIndex = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly callbacks: TutorialManagerCallbacks,
  ) {}

  isOpen(): boolean {
    return this.overlay !== null;
  }

  isTutorialOpen(): boolean {
    return this.mode === "tutorial" && this.isOpen();
  }

  isTipsOpen(): boolean {
    return this.mode === "tips" && this.isOpen();
  }

  showTutorial(player: PlayerState, replay = false): void {
    this.player = player;
    this.mode = "tutorial";
    this.replayingTutorial = replay;
    this.tutorialStepIndex = 0;
    this.renderTutorial();
  }

  showTips(player: PlayerState): void {
    this.player = player;
    this.mode = "tips";
    this.categoryIndex = 0;
    this.tipIndex = 0;
    this.renderTips();
  }

  close(): void {
    if (this.mode === "tutorial" && !this.replayingTutorial) {
      this.finishInitialTutorial();
      return;
    }
    this.destroyOverlay();
  }

  handleAction(action: TutorialNavigationAction): void {
    if (!this.player || !this.mode) return;
    if (this.mode === "tutorial") {
      this.handleTutorialAction(action);
      return;
    }
    this.handleTipsAction(action);
  }

  private handleTutorialAction(action: TutorialNavigationAction): void {
    if (action === "previous" || action === "up") {
      if (this.tutorialStepIndex > 0) {
        this.tutorialStepIndex -= 1;
        this.renderTutorial();
      }
      return;
    }
    if (action !== "next" && action !== "down" && action !== "confirm") return;
    if (this.tutorialStepIndex < TUTORIAL_STEPS.length - 1) {
      this.tutorialStepIndex += 1;
      this.renderTutorial();
      return;
    }
    if (this.replayingTutorial) {
      this.showTips(this.player!);
    } else {
      this.finishInitialTutorial();
    }
  }

  private handleTipsAction(action: TutorialNavigationAction): void {
    if (action === "previous") {
      this.categoryIndex = (
        this.categoryIndex - 1 + TIP_CATEGORIES.length
      ) % TIP_CATEGORIES.length;
      this.tipIndex = 0;
      this.renderTips();
      return;
    }
    if (action === "next") {
      this.categoryIndex = (this.categoryIndex + 1) % TIP_CATEGORIES.length;
      this.tipIndex = 0;
      this.renderTips();
      return;
    }
    const tips = this.getCurrentTips();
    if (tips.length === 0) return;
    if (action === "up") {
      this.tipIndex = (this.tipIndex - 1 + tips.length) % tips.length;
      this.renderTips();
    } else if (action === "down") {
      this.tipIndex = (this.tipIndex + 1) % tips.length;
      this.renderTips();
    }
  }

  private finishInitialTutorial(): void {
    if (this.player && completeTutorial(this.player.progression.tutorial)) {
      this.callbacks.autoSave();
    }
    this.destroyOverlay();
  }

  private destroyOverlay(): void {
    this.overlay?.destroy();
    this.overlay = null;
    this.mode = null;
  }

  private createOverlay(
    width: number,
    height: number,
  ): {
    container: Phaser.GameObjects.Container;
    px: number;
    py: number;
    panelW: number;
    panelH: number;
  } {
    this.overlay?.destroy();
    const { w, h, px, py, panelW, panelH } = calcPanelLayout(
      this.scene,
      width,
      height,
    );
    const container = this.scene.add.container(0, 0).setDepth(95);
    const dim = createDimGraphics(this.scene, w, h, 0.82);
    dim.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, w, h),
      Phaser.Geom.Rectangle.Contains,
    );
    container.add(dim);
    container.add(createPanelGraphics(this.scene, px, py, panelW, panelH));
    this.overlay = container;
    return { container, px, py, panelW, panelH };
  }

  private renderTutorial(): void {
    const step = TUTORIAL_STEPS[this.tutorialStepIndex];
    const { container, px, py, panelW, panelH } = this.createOverlay(560, 450);
    const title = this.scene.add.text(
      px + panelW / 2,
      py + 18,
      step.title,
      {
        fontSize: "20px",
        fontFamily: "monospace",
        color: "#ffd86b",
        fontStyle: "bold",
      },
    ).setOrigin(0.5, 0);
    const progress = this.scene.add.text(
      px + panelW - 18,
      py + 20,
      `${this.tutorialStepIndex + 1}/${TUTORIAL_STEPS.length}`,
      {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#8da2c9",
      },
    ).setOrigin(1, 0);
    const summary = this.scene.add.text(
      px + 28,
      py + 62,
      step.summary,
      {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#f2f4ff",
        wordWrap: { width: panelW - 56, useAdvancedWrap: true },
        lineSpacing: 5,
      },
    );
    container.add([title, progress, summary]);

    let y = summary.y + summary.height + 18;
    for (const detail of step.details) {
      const detailText = this.scene.add.text(
        px + 34,
        y,
        `- ${detail}`,
        {
          fontSize: "12px",
          fontFamily: "monospace",
          color: "#c7cee0",
          wordWrap: { width: panelW - 68, useAdvancedWrap: true },
          lineSpacing: 4,
        },
      );
      container.add(detailText);
      y += detailText.height + 10;
    }

    const controlsTitle = this.scene.add.text(
      px + 28,
      Math.max(y + 4, py + 225),
      "Controls",
      {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#83d8ff",
        fontStyle: "bold",
      },
    );
    container.add(controlsTitle);
    const controlStartY = controlsTitle.y + 26;
    const cardWidth = (panelW - 72) / 2;
    step.controls.forEach((controlId, index) => {
      const control = CONTROL_GUIDANCE[controlId];
      const column = index % 2;
      const row = Math.floor(index / 2);
      const cardX = px + 28 + column * (cardWidth + 16);
      const cardY = controlStartY + row * 42;
      const card = this.scene.add.text(
        cardX,
        cardY,
        `${control.label}\n${control.keyboard}`,
        {
          fontSize: "11px",
          fontFamily: "monospace",
          color: "#dce8ff",
          backgroundColor: "#252b42",
          padding: { x: 9, y: 5 },
          lineSpacing: 2,
        },
      ).setFixedSize(cardWidth, 36);
      container.add(card);
    });

    const previous = this.addButton(
      container,
      px + 94,
      py + panelH - 48,
      "< Back",
      () => this.handleAction("previous"),
      this.tutorialStepIndex > 0,
    );
    const nextLabel = this.tutorialStepIndex === TUTORIAL_STEPS.length - 1
      ? (this.replayingTutorial ? "Back to Tips" : "Start Adventure")
      : "Next >";
    const next = this.addButton(
      container,
      px + panelW - 94,
      py + panelH - 48,
      nextLabel,
      () => this.handleAction("confirm"),
    );
    const skip = this.scene.add.text(
      px + panelW / 2,
      py + panelH - 42,
      this.replayingTutorial ? "Esc: back to game" : "Esc: skip tutorial",
      {
        fontSize: "10px",
        fontFamily: "monospace",
        color: "#77839c",
      },
    ).setOrigin(0.5, 0);
    container.add([previous, next, skip]);
  }

  private renderTips(): void {
    const { container, px, py, panelW, panelH } = this.createOverlay(590, 470);
    const category = TIP_CATEGORIES[this.categoryIndex];
    const tips = this.getCurrentTips();
    if (tips.length > 0) {
      this.tipIndex = Math.min(this.tipIndex, tips.length - 1);
    } else {
      this.tipIndex = 0;
    }
    const current = tips[this.tipIndex];

    const title = this.scene.add.text(px + 24, py + 16, "Adventurer Tips", {
      fontSize: "19px",
      fontFamily: "monospace",
      color: "#ffd86b",
      fontStyle: "bold",
    });
    const replay = this.addButton(
      container,
      px + panelW - 154,
      py + 26,
      "Replay Tutorial",
      () => this.showTutorial(this.player!, true),
    );
    const close = this.addButton(
      container,
      px + panelW - 48,
      py + 26,
      "Close",
      () => this.close(),
    );
    container.add([title, replay, close]);

    const tabWidth = (panelW - 36) / TIP_CATEGORIES.length;
    TIP_CATEGORIES.forEach((tipCategory, index) => {
      const active = index === this.categoryIndex;
      const tab = this.scene.add.text(
        px + 18 + tabWidth * index + tabWidth / 2,
        py + 58,
        TIP_CATEGORY_LABELS[tipCategory],
        {
          fontSize: "11px",
          fontFamily: "monospace",
          color: active ? "#171a27" : "#a8b4cc",
          backgroundColor: active ? "#83d8ff" : "#262c40",
          padding: { x: 7, y: 6 },
          fixedWidth: tabWidth - 4,
          align: "center",
        },
      ).setOrigin(0.5, 0).setFixedSize(tabWidth - 4, 28)
        .setInteractive({ useHandCursor: true });
      tab.on("pointerdown", () => {
        this.categoryIndex = index;
        this.tipIndex = 0;
        this.renderTips();
      });
      container.add(tab);
    });

    const listX = px + 22;
    const listY = py + 104;
    const listWidth = 172;
    if (tips.length === 0) {
      const locked = this.scene.add.text(
        listX,
        listY,
        "No tips unlocked yet.\n\nKeep exploring to reveal advice for this category.",
        {
          fontSize: "12px",
          fontFamily: "monospace",
          color: "#77839c",
          wordWrap: { width: listWidth, useAdvancedWrap: true },
          lineSpacing: 5,
        },
      );
      container.add(locked);
    } else {
      tips.forEach((tip, index) => {
        const selected = index === this.tipIndex;
        const item = this.scene.add.text(
          listX,
          listY + index * 50,
          tip.title,
          {
            fontSize: "11px",
            fontFamily: "monospace",
            color: selected ? "#171a27" : "#d4daea",
            backgroundColor: selected ? "#ffd86b" : "#252b42",
            padding: { x: 8, y: 8 },
            wordWrap: { width: listWidth - 16, useAdvancedWrap: true },
          },
        ).setFixedSize(listWidth, 44).setInteractive({ useHandCursor: true });
        item.on("pointerdown", () => {
          this.tipIndex = index;
          this.renderTips();
        });
        container.add(item);
      });
    }

    this.renderTipDetail(
      container,
      current,
      category,
      px + 220,
      listY,
      panelW - 244,
    );

    const hint = this.scene.add.text(
      px + panelW / 2,
      py + panelH - 20,
      "A/D or arrows: category  |  W/S or arrows: tip  |  F1/Esc: close",
      {
        fontSize: "10px",
        fontFamily: "monospace",
        color: "#77839c",
      },
    ).setOrigin(0.5, 0);
    container.add(hint);
  }

  private renderTipDetail(
    container: Phaser.GameObjects.Container,
    tip: TipDefinition | undefined,
    category: TipCategory,
    x: number,
    y: number,
    width: number,
  ): void {
    const heading = this.scene.add.text(
      x,
      y,
      tip?.title ?? `${TIP_CATEGORY_LABELS[category]} tips`,
      {
        fontSize: "16px",
        fontFamily: "monospace",
        color: "#83d8ff",
        fontStyle: "bold",
        wordWrap: { width, useAdvancedWrap: true },
      },
    );
    const body = this.scene.add.text(
      x,
      y + heading.height + 18,
      tip?.body ?? "This advice unlocks automatically as your adventure progresses.",
      {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#e1e6f2",
        wordWrap: { width, useAdvancedWrap: true },
        lineSpacing: 6,
      },
    );
    container.add([heading, body]);
    if (!tip?.controls?.length) return;
    const controls = tip.controls.map((id) => {
      const control = CONTROL_GUIDANCE[id];
      return `${control.keyboard}  ${control.label}`;
    });
    const controlsText = this.scene.add.text(
      x,
      body.y + body.height + 26,
      controls.join("\n"),
      {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#b7c9ed",
        backgroundColor: "#252b42",
        padding: { x: 10, y: 8 },
        lineSpacing: 5,
      },
    ).setFixedSize(width, Math.max(44, controls.length * 22 + 16));
    container.add(controlsText);
  }

  private getCurrentTips(): TipDefinition[] {
    if (!this.player) return [];
    return getUnlockedTips(
      createTutorialTipContext(this.player),
      TIP_CATEGORIES[this.categoryIndex],
    );
  }

  private addButton(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    label: string,
    action: () => void,
    enabled = true,
  ): Phaser.GameObjects.Text {
    const button = this.scene.add.text(x, y, label, {
      fontSize: "12px",
      fontFamily: "monospace",
      color: enabled ? "#eaf1ff" : "#5f687a",
      backgroundColor: enabled ? "#33415f" : "#242936",
      padding: { x: 11, y: 7 },
      align: "center",
    }).setOrigin(0.5, 0);
    if (enabled) {
      button.setInteractive({ useHandCursor: true });
      button.on("pointerover", () => button.setColor("#ffd86b"));
      button.on("pointerout", () => button.setColor("#eaf1ff"));
      button.on("pointerdown", action);
    }
    return button;
  }
}
