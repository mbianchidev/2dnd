import * as Phaser from "phaser";
import { createOverlayContainer } from "../utils/ui";

export type TitleMenuActionId =
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
}

const ACTION_LAYOUT_IDS: Readonly<Record<TitleMenuActionId, string>> = {
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
    const buttonHeight = Math.min(
      MAX_BUTTON_HEIGHT,
      (
        availableHeight
        - BUTTON_GAP * (this.options.actions.length - 1)
      ) / this.options.actions.length,
    );
    const menuHeight = buttonHeight * this.options.actions.length
      + BUTTON_GAP * (this.options.actions.length - 1);
    const startY = MENU_TOP + (availableHeight - menuHeight) / 2;
    const container = createOverlayContainer(
      this.scene,
      "title-menu",
      5,
      {
        x: camera.centerX - BUTTON_WIDTH / 2,
        y: startY,
        width: BUTTON_WIDTH,
        height: menuHeight,
      },
    );
    this.container = container;
    this.buttons = this.options.actions.map((action, index) => {
      const centerY = startY + buttonHeight / 2
        + index * (buttonHeight + BUTTON_GAP);
      return this.createButton(action, index, camera.centerX, centerY, buttonHeight);
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
    y: number,
    height: number,
  ): TitleMenuButton {
    const background = this.scene.add.rectangle(
      x,
      y,
      BUTTON_WIDTH,
      height,
      0x171c32,
      0.94,
    ).setStrokeStyle(1, 0x59627c, 1);
    const label = this.scene.add.text(
      x,
      action.detail ? y - 9 : y,
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

    const objects: Phaser.GameObjects.GameObject[] = [background, label];
    if (action.detail) {
      const detail = this.scene.add.text(x, y + 15, action.detail, {
        fontSize: "9px",
        fontFamily: "monospace",
        color: "#8d96ac",
        align: "center",
      }).setOrigin(0.5);
      detail.setData("layoutAuditIgnore", true);
      objects.push(detail);
    }

    const hitZone = this.scene.add.zone(
      x,
      y,
      BUTTON_WIDTH,
      height,
    ).setInteractive({ useHandCursor: true });
    hitZone.on("pointerover", () => this.select(index));
    hitZone.on("pointerdown", () => {
      this.select(index);
      this.activateSelected();
    });
    objects.push(hitZone);
    this.container?.add(objects);
    return { action, background, label };
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
