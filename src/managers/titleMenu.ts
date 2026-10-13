import * as Phaser from "phaser";
import { createOverlayContainer } from "../utils/ui";
import { layoutVerticalStack } from "../systems/layout";

export type TitleMenuActionId =
  | "newGamePlus"
  | "continue"
  | "newGame"
  | "saveSlots"
  | "settings"
  | "quit";

export interface TitleMenuAction {
  id: TitleMenuActionId;
  label: string;
  color: string;
  detail?: string;
  shortcut?: string;
  activate(): void;
}

interface TitleMenuOptions {
  actions: readonly TitleMenuAction[];
  canActivate(): boolean;
  onSelectionChange(): void;
}

interface TitleMenuButton {
  action: TitleMenuAction;
  background: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  detail?: Phaser.GameObjects.Text;
  hitZone: Phaser.GameObjects.Zone;
}

const ACTION_LAYOUT_IDS: Readonly<Record<TitleMenuActionId, string>> = {
  newGamePlus: "title-new-game-plus",
  continue: "title-continue",
  newGame: "title-new-game",
  saveSlots: "title-save-slots",
  settings: "title-settings",
  quit: "title-quit-desktop",
};

const MENU_TOP = 250;
const MENU_BOTTOM = 520;
const BUTTON_WIDTH = 360;
const MAX_BUTTON_HEIGHT = 64;
const BUTTON_GAP = 4;
const DETAIL_GAP = 2;
const BUTTON_CONTENT_INSET = 1;

export class TitleMenuManager {
  private container: Phaser.GameObjects.Container | null = null;
  private buttons: TitleMenuButton[] = [];
  private selectedIndex = 0;
  private boundAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: TitleMenuOptions,
  ) {}

  open(): void {
    this.destroy();
    if (this.options.actions.length === 0) {
      throw new Error("[TitleMenuManager] At least one title action is required");
    }

    const camera = this.scene.cameras.main;
    const availableHeight = MENU_BOTTOM - MENU_TOP;
    this.buttons = this.options.actions.map((action, index) =>
      this.createButton(action, index, camera.centerX),
    );
    const contentHeights = this.buttons.map(({ label, detail }) =>
      label.displayHeight + (detail ? DETAIL_GAP + detail.displayHeight : 0),
    );
    const minimumHeights = contentHeights.map((height) => height + BUTTON_CONTENT_INSET * 2);
    const contentHeight = minimumHeights.reduce((total, height) => total + height, 0);
    const gap = this.buttons.length > 1
      ? Math.min(BUTTON_GAP, Math.max(0, (availableHeight - contentHeight) / (this.buttons.length - 1)))
      : 0;
    const spareHeight = Math.max(0, availableHeight - contentHeight - gap * (this.buttons.length - 1));
    const rows = layoutVerticalStack(this.buttons.map(({ action }, index) => ({
      id: action.id,
      width: BUTTON_WIDTH,
      height: Math.min(
        Math.max(MAX_BUTTON_HEIGHT, minimumHeights[index]!),
        minimumHeights[index]! + spareHeight / this.buttons.length,
      ),
    })), { x: camera.centerX - BUTTON_WIDTH / 2, gap });
    const startY = MENU_TOP + (availableHeight - rows.height) / 2;
    const container = createOverlayContainer(
      this.scene,
      "title-menu",
      5,
      {
        x: camera.centerX - BUTTON_WIDTH / 2,
        y: startY,
        width: BUTTON_WIDTH,
        height: rows.height,
      },
    );
    this.container = container;
    this.buttons.forEach((button, index) => {
      const row = rows.items[index]!;
      const top = startY + row.y;
      const centerY = top + row.height / 2;
      const contentTop = top + (row.height - contentHeights[index]!) / 2;
      button.background.setPosition(camera.centerX, centerY).setSize(BUTTON_WIDTH, row.height);
      button.label.setY(contentTop + button.label.displayHeight / 2);
      button.detail?.setY(contentTop + button.label.displayHeight + DETAIL_GAP + button.detail.displayHeight / 2);
      button.hitZone.setPosition(camera.centerX, centerY).setSize(BUTTON_WIDTH, row.height);
      if (button.hitZone.input) {
        button.hitZone.input.hitArea = new Phaser.Geom.Rectangle(0, 0, BUTTON_WIDTH, row.height);
        button.hitZone.input.hitAreaCallback = Phaser.Geom.Rectangle.Contains;
      }
      container.add([
        button.background, button.label,
        ...(button.detail ? [button.detail] : []), button.hitZone,
      ]);
    });
    this.selectedIndex = 0;
    this.updateSelection();
    this.boundAt = performance.now();
    this.scene.input.keyboard?.on("keydown", this.handleKeyDown);
  }

  destroy(): void {
    this.scene.input.keyboard?.off("keydown", this.handleKeyDown);
    this.container?.destroy();
    this.container = null;
    this.buttons = [];
  }

  getSelectedActionId(): TitleMenuActionId | null {
    return this.buttons[this.selectedIndex]?.action.id ?? null;
  }

  private createButton(
    action: TitleMenuAction,
    index: number,
    x: number,
  ): TitleMenuButton {
    const background = this.scene.add.rectangle(
      x,
      0,
      BUTTON_WIDTH,
      1,
      0x171c32,
      0.94,
    ).setStrokeStyle(1, 0x59627c, 1);
    const label = this.scene.add.text(
      x,
      0,
      action.label,
      {
        fontSize: action.detail ? "18px" : "17px",
        fontFamily: "monospace",
        color: action.color,
        align: "center",
      },
    ).setOrigin(0.5);
    label.setData("layoutId", ACTION_LAYOUT_IDS[action.id]);
    label.setData("testId", ACTION_LAYOUT_IDS[action.id]);

    const detail = action.detail ? this.scene.add.text(x, 0, action.detail, {
      fontSize: "9px",
      fontFamily: "monospace",
      color: "#8d96ac",
      align: "center",
      wordWrap: { width: BUTTON_WIDTH - 12, useAdvancedWrap: true },
    }).setOrigin(0.5).setData("layoutId", `${ACTION_LAYOUT_IDS[action.id]}-detail`) : undefined;

    const hitZone = this.scene.add.zone(
      x,
      0,
      BUTTON_WIDTH,
      1,
    ).setInteractive({ useHandCursor: true });
    hitZone.on("pointerover", () => this.select(index));
    hitZone.on("pointerdown", () => {
      this.select(index);
      this.activateSelected();
    });
    return { action, background, label, detail, hitZone };
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.timeStamp <= this.boundAt || !this.options.canActivate()) return;
    if (
      event.key === "ArrowUp"
      || event.key === "w"
      || event.key === "W"
    ) {
      event.preventDefault();
      this.move(-1);
      return;
    }
    if (
      event.key === "ArrowDown"
      || event.key === "s"
      || event.key === "S"
    ) {
      event.preventDefault();
      this.move(1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      if (event.repeat) return;
      event.preventDefault();
      this.activateSelected();
      return;
    }
    if (event.repeat) return;
    const shortcut = event.key.toLowerCase();
    const index = this.buttons.findIndex(
      ({ action }) => action.shortcut === shortcut,
    );
    if (index < 0) return;
    event.preventDefault();
    this.select(index);
    this.activateSelected();
  };

  private move(direction: -1 | 1): void {
    this.select(
      (
        this.selectedIndex
        + direction
        + this.buttons.length
      ) % this.buttons.length,
    );
  }

  private select(index: number): void {
    if (index === this.selectedIndex) return;
    this.selectedIndex = index;
    this.updateSelection();
  }

  private updateSelection(): void {
    this.buttons.forEach(({ action, background, label }, index) => {
      const selected = index === this.selectedIndex;
      background
        .setFillStyle(selected ? 0x344365 : 0x171c32, 0.96)
        .setStrokeStyle(selected ? 2 : 1, selected ? 0xffd700 : 0x59627c, 1);
      label.setColor(selected ? "#ffd700" : action.color);
    });
    this.options.onSelectionChange();
  }

  private activateSelected(): void {
    if (!this.options.canActivate()) return;
    this.buttons[this.selectedIndex]?.action.activate();
  }
}
