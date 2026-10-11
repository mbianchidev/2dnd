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
import { isControlGuidanceAvailable } from "../systems/featureDiscovery";
import {
  getInputPromptSource,
  type InputSource,
} from "../systems/input";
import type { PlayerState } from "../systems/player";
import {
  calcPanelLayout,
  createDimGraphics,
  createOverlayContainer,
  createPanelGraphics,
} from "../utils/ui";
import { layoutTextStack, subscribeOverlayReflow, syncInteractiveHitArea } from "./layout";
import { paginateMeasuredItems } from "../systems/layout";

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
  private detailPage = 0;
  private unsubscribeReflow: (() => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly callbacks: TutorialManagerCallbacks,
  ) {
    this.scene.events?.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribeReflow?.());
  }

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
    this.watchReflow();
    this.player = player;
    this.mode = "tutorial";
    this.replayingTutorial = replay;
    this.tutorialStepIndex = 0;
    this.renderTutorial();
  }

  showTips(player: PlayerState): void {
    this.watchReflow();
    this.player = player;
    this.mode = "tips";
    this.categoryIndex = 0;
    this.tipIndex = 0;
    this.detailPage = 0;
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
    this.unsubscribeReflow?.();
    this.unsubscribeReflow = null;
    this.overlay?.destroy();
    this.overlay = null;
    this.mode = null;
  }

  private watchReflow(): void {
    this.unsubscribeReflow?.();
    this.unsubscribeReflow = subscribeOverlayReflow(this.scene, () => {
      if (this.mode === "tutorial") this.renderTutorial();
      else if (this.mode === "tips") this.renderTips();
    });
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
    const container = createOverlayContainer(
      this.scene,
      this.mode === "tips" ? "tips" : "tutorial",
      95,
      { x: px, y: py, width: panelW, height: panelH },
    );
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
    const { container, px, py, panelW, panelH } = this.createOverlay(620, 512);
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
    ).setOrigin(0.5, 0).setWordWrapWidth(panelW - 100, true);
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
    const contentTop = title.y + title.displayHeight + 14;
    const contentGap = 24;
    const controlsWidth = 210;
    const detailWidth = panelW - 56 - controlsWidth - contentGap;
    const controlsX = px + panelW - 28 - controlsWidth;
    const summary = this.scene.add.text(
      px + 28,
      contentTop,
      step.summary,
      {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#f2f4ff",
        wordWrap: { width: detailWidth, useAdvancedWrap: true },
        lineSpacing: 5,
      },
    );
    container.add([title, progress, summary]);

    const detailTexts: Phaser.GameObjects.Text[] = [];
    for (const detail of step.details) {
      const detailText = this.scene.add.text(
        0,
        0,
        `- ${detail}`,
        {
          fontSize: "12px",
          fontFamily: "monospace",
          color: "#c7cee0",
          wordWrap: { width: detailWidth - 12, useAdvancedWrap: true },
          lineSpacing: 4,
        },
      );
      container.add(detailText);
      detailTexts.push(detailText);
    }
    layoutTextStack(detailTexts, {
      x: px + 34,
      y: summary.y + summary.height + 18,
      width: detailWidth - 12,
      gap: 10,
    });

    const controlsTitle = this.scene.add.text(
      controlsX,
      contentTop,
      "Controls",
      {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#83d8ff",
        fontStyle: "bold",
      },
    );
    container.add(controlsTitle);
    const controlCards = step.controls.filter((controlId) =>
      isControlGuidanceAvailable(this.player!, controlId)
    ).map((controlId) => {
      const control = CONTROL_GUIDANCE[controlId];
      const card = this.scene.add.text(
        0,
        0,
        `${control.label}\n${this.controlPrompt(control)}`,
        {
          fontSize: "11px",
          fontFamily: "monospace",
          color: "#dce8ff",
          backgroundColor: "#252b42",
          padding: { x: 9, y: 5 },
          lineSpacing: 2,
          wordWrap: { width: controlsWidth - 18, useAdvancedWrap: true },
          fixedWidth: controlsWidth,
        },
      );
      container.add(card);
      return card;
    });
    layoutTextStack(controlCards, {
      x: controlsX,
      y: controlsTitle.y + controlsTitle.height + 12,
      width: controlsWidth,
      gap: 8,
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
    previous.setData("layoutId", "tutorial-previous");
    next.setData("layoutId", "tutorial-next");
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
    const footerHeight = Math.max(previous.displayHeight, next.displayHeight);
    previous.setY(py + panelH - 16 - footerHeight);
    next.setY(previous.y);
    skip.setWordWrapWidth(Math.max(80, panelW - previous.displayWidth - next.displayWidth - 56), true);
    skip.setY(previous.y - 8 - skip.displayHeight);
    const contentBottom = skip.y - 12;
    const availableHeight = contentBottom - controlsTitle.y - controlsTitle.displayHeight - 10;
    const pages = paginateMeasuredItems(controlCards.map((card) => card.displayHeight), availableHeight, 6);
    if (pages.length > 1) {
      const grid = this.scene.add.container();
      const columns = 2;
      const width = (controlsWidth - 8) / columns;
      controlCards.forEach((card, index) => {
        card.setFixedSize(width, 0).setWordWrapWidth(width - 18, true);
        const row = Math.floor(index / columns);
        const previous = controlCards.slice(0, row * columns);
        let offset = 0;
        for (let pair = 0; pair < previous.length; pair += columns) {
          offset += Math.max(...previous.slice(pair, pair + columns).map((label) => label.displayHeight)) + 6;
        }
        card.setPosition(controlsX + index % columns * (width + 8), controlsTitle.y + controlsTitle.displayHeight + 10 + offset);
        grid.add(card);
      });
      container.add(grid);
    }
  }

  private renderTips(): void {
    const { container, px, py, panelW, panelH } = this.createOverlay(620, 512);
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
    replay.setData("layoutId", "tips-replay");
    close.setData("layoutId", "tips-close");
    container.add([title, replay, close]);
    close.setPosition(px + panelW - 18 - close.displayWidth / 2, py + 14);
    replay.setPosition(close.getBounds().x - 12 - replay.displayWidth / 2, py + 14);
    title.setWordWrapWidth(Math.max(100, replay.getBounds().x - title.x - 12), true);
    syncInteractiveHitArea(replay);
    syncInteractiveHitArea(close);
    const tabY = py + 14 + Math.max(title.displayHeight, replay.displayHeight, close.displayHeight) + 12;

    const tabWidth = (panelW - 36) / TIP_CATEGORIES.length;
    const tabs = TIP_CATEGORIES.map((tipCategory, index) => {
      const active = index === this.categoryIndex;
      const tab = this.scene.add.text(
        px + 18 + tabWidth * index + tabWidth / 2,
        tabY,
        TIP_CATEGORY_LABELS[tipCategory],
        {
          fontSize: "11px",
          fontFamily: "monospace",
          color: active ? "#171a27" : "#a8b4cc",
          backgroundColor: active ? "#83d8ff" : "#262c40",
          padding: { x: 7, y: 6 },
          fixedWidth: tabWidth - 4,
          wordWrap: { width: tabWidth - 20, useAdvancedWrap: true },
          align: "center",
        },
      ).setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true }).setData("layoutId", `tips-category-${tipCategory}`);
      tab.on("pointerdown", () => {
        this.categoryIndex = index;
        this.tipIndex = 0;
        this.detailPage = 0;
        this.renderTips();
      });
      container.add(tab);
      return tab;
    });
    const tabHeight = Math.max(...tabs.map((tab) => Math.ceil(tab.displayHeight)));
    tabs.forEach((tab) => {
      tab.setFixedSize(tabWidth - 4, tabHeight);
      syncInteractiveHitArea(tab);
    });

    const listX = px + 22;
    const listY = tabY + tabHeight + 14;
    const listWidth = 172;
    const hint = this.scene.add.text(
      px + panelW / 2, 0,
      `${this.navigationPrompt()}  |  ${this.closePrompt()}: close`,
      {
        fontSize: "10px", fontFamily: "monospace", color: "#a8b4cc",
        align: "center", wordWrap: { width: panelW - 32, useAdvancedWrap: true },
      },
    ).setOrigin(0.5, 0);
    hint.setY(py + panelH - 12 - hint.displayHeight);
    container.add(hint);
    const availableHeight = hint.y - 12 - listY;
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
      const items = tips.map((tip, index) => {
        const selected = index === this.tipIndex;
        const item = this.scene.add.text(
          listX,
          listY,
          tip.title,
          {
            fontSize: "11px",
            fontFamily: "monospace",
            color: selected ? "#171a27" : "#d4daea",
            backgroundColor: selected ? "#ffd86b" : "#252b42",
            padding: { x: 8, y: 8 },
            wordWrap: { width: listWidth - 16, useAdvancedWrap: true },
          },
        ).setFixedSize(listWidth, 0).setInteractive({ useHandCursor: true }).setData("layoutId", `tip-${tip.id}`);
        item.on("pointerdown", () => {
          this.tipIndex = index;
          this.detailPage = 0;
          this.renderTips();
        });
        return item;
      });
      let pages = paginateMeasuredItems(items.map((item) => item.displayHeight), availableHeight, 6);
      if (pages.length > 1) pages = paginateMeasuredItems(items.map((item) => item.displayHeight), availableHeight - 34, 6);
      const currentPage = Math.max(0, pages.findIndex((indices) => indices.includes(this.tipIndex)));
      const visible = new Set(pages[currentPage] ?? []);
      let cursor = listY;
      items.forEach((item, index) => {
        if (!visible.has(index)) { item.destroy(); return; }
        item.setY(cursor);
        cursor += item.displayHeight + 6;
        syncInteractiveHitArea(item);
        container.add(item);
      });
      if (pages.length > 1) {
        const next = this.addButton(container, listX + listWidth / 2, listY + availableHeight - 30,
          `Tips ${currentPage + 1}/${pages.length} ›`, () => {
            this.tipIndex = pages[(currentPage + 1) % pages.length]![0]!;
            this.detailPage = 0;
            this.renderTips();
          });
        container.add(next);
      }
    }

    this.renderTipDetail(
      container,
      current,
      category,
      px + 220,
      listY,
      panelW - 244,
      availableHeight,
    );
  }

  private renderTipDetail(
    container: Phaser.GameObjects.Container,
    tip: TipDefinition | undefined,
    category: TipCategory,
    x: number,
    y: number,
    width: number,
    height: number,
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
    const controls = (tip?.controls ?? []).filter((id) =>
      isControlGuidanceAvailable(this.player!, id)
    ).map((id) => {
      const control = CONTROL_GUIDANCE[id];
      return `${this.controlPrompt(control)}  ${control.label}`;
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
        wordWrap: { width: width - 20, useAdvancedWrap: true },
      },
    ).setFixedSize(width, 0);
    container.add(controlsText);
    const items = [body, ...(controls.length ? [controlsText] : [])];
    if (controls.length === 0) controlsText.destroy();
    const available = Math.max(0, height - heading.displayHeight - 12);
    let pages = paginateMeasuredItems(items.map((item) => item.displayHeight), available, 12);
    if (pages.length > 1) pages = paginateMeasuredItems(items.map((item) => item.displayHeight), available - 38, 12);
    this.detailPage = Math.min(this.detailPage, Math.max(0, pages.length - 1));
    let cursor = y + heading.displayHeight + 12;
    items.forEach((item, index) => {
      if (!pages[this.detailPage]?.includes(index)) {
        item.setVisible(false).setActive(false);
        return;
      }
      item.setY(cursor);
      cursor += item.displayHeight + 12;
    });
    if (pages.length > 1) {
      const next = this.addButton(container, x + width / 2, y + height - 30,
        `Details ${this.detailPage + 1}/${pages.length} ›`, () => {
          this.detailPage = (this.detailPage + 1) % pages.length;
          this.renderTips();
        });
      container.add(next);
    }
  }

  private controlPrompt(
    control: (typeof CONTROL_GUIDANCE)[keyof typeof CONTROL_GUIDANCE],
  ): string {
    const source = getInputPromptSource();
    return control[source === "pointer" ? "pointer" : source];
  }

  private navigationPrompt(): string {
    const prompts: Record<InputSource, string> = {
      keyboard: "A/D categories, W/S tips",
      pointer: "Select a category or tip",
      gamepad: "D-pad categories and tips",
      touch: "D-pad or tap categories and tips",
    };
    return prompts[getInputPromptSource()];
  }

  private closePrompt(): string {
    const prompts: Record<InputSource, string> = {
      keyboard: "F1/Esc",
      pointer: "outside panel",
      gamepad: "B/View",
      touch: "B/TIPS",
    };
    return prompts[getInputPromptSource()];
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
