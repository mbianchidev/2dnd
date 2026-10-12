import * as Phaser from "phaser";
import { generatePlayerTextureWithHair } from "../renderers/textures";
import { HAIR_COLOR_OPTIONS, HAIR_STYLE_OPTIONS, SKIN_COLOR_OPTIONS } from "../systems/appearance";
import { isReducedMotionEnabled } from "../systems/accessibility";
import { layoutResponsiveGrid, moveGridSelection } from "../systems/layout";
import { createOverlayContainer } from "../utils/ui";
import { debugPanelState } from "../config";
import { getScaledBounds, subscribeOverlayReflow, syncInteractiveHitArea } from "./layout";
import type { CustomAppearance } from "../systems/appearance";
import type { PlayerClass } from "../systems/classes";

export interface CharacterCreationControlHandlers {
  up(): void;
  down(): void;
  left(): void;
  right(): void;
  confirm(): void;
  cancel(): void;
}

interface CharacterAppearanceCallbacks {
  bindControls(handlers: CharacterCreationControlHandlers): void;
  back(): void;
  start(appearance: CustomAppearance): void;
  campaignRules?: {
    label(): string;
    isOpen(): boolean;
    open(): void;
    adjust(direction: -1 | 1): void;
  };
}

interface ColorChoice {
  label: string;
  color: number;
}

let nextPreviewId = 0;

/** Own cosmetic state, measured controls and preview textures without rerolling on reflow. */
export class CharacterAppearanceManager {
  private container: Phaser.GameObjects.Container | null = null;
  private unsubscribeReflow: (() => void) | null = null;
  private selectedGroup = 0;
  private readonly appearance: CustomAppearance;
  private readonly previewId = nextPreviewId++;
  private previewRevision = 0;
  private previewKey: string | null = null;
  private startButton: Phaser.GameObjects.Text | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly playerClass: PlayerClass,
    private readonly callbacks: CharacterAppearanceCallbacks,
  ) {
    this.appearance = {
      skinColor: playerClass.skinColor,
      hairStyle: HAIR_STYLE_OPTIONS[0]!.id,
      hairColor: HAIR_COLOR_OPTIONS[0]!.color,
    };
  }

  open(): void {
    this.updatePreviewTexture();
    this.unsubscribeReflow = subscribeOverlayReflow(this.scene, () => this.render());
    this.callbacks.bindControls({
      up: () => this.moveGroup("up"),
      down: () => this.moveGroup("down"),
      left: () => this.moveOption("left"),
      right: () => this.moveOption("right"),
      confirm: () => this.selectedGroup === 3
        ? this.callbacks.campaignRules?.open() : this.callbacks.start({ ...this.appearance }),
      cancel: () => this.callbacks.back(),
    });
    this.render();
  }

  destroy(): void {
    this.unsubscribeReflow?.();
    this.unsubscribeReflow = null;
    if (this.startButton) this.scene.tweens.killTweensOf(this.startButton);
    this.startButton = null;
    this.container?.destroy(true);
    this.container = null;
    if (this.previewKey && this.scene.textures.exists(this.previewKey)) {
      this.scene.textures.remove(this.previewKey);
    }
    this.previewKey = null;
  }

  refresh(): void {
    if (this.container) this.render();
  }

  private updatePreviewTexture(): void {
    const previousKey = this.previewKey;
    this.previewKey = `creation-preview-${this.previewId}-${this.previewRevision++}`;
    generatePlayerTextureWithHair(
      this.scene, this.previewKey, this.playerClass.bodyColor,
      this.appearance.skinColor, this.playerClass.legColor, this.appearance.hairStyle,
      this.appearance.hairColor, this.playerClass.weaponSprite, this.playerClass.clothingStyle,
    );
    this.container?.destroy(true);
    this.container = null;
    if (previousKey && this.scene.textures.exists(previousKey)) this.scene.textures.remove(previousKey);
  }

  private randomize(): void {
    this.appearance.skinColor = SKIN_COLOR_OPTIONS[Math.floor(Math.random() * SKIN_COLOR_OPTIONS.length)]!.color;
    this.appearance.hairStyle = HAIR_STYLE_OPTIONS[Math.floor(Math.random() * HAIR_STYLE_OPTIONS.length)]!.id;
    this.appearance.hairColor = HAIR_COLOR_OPTIONS[Math.floor(Math.random() * HAIR_COLOR_OPTIONS.length)]!.color;
    this.selectedGroup = 0;
    this.updatePreviewTexture();
    this.render();
  }

  private moveGroup(direction: "up" | "down"): void {
    this.selectedGroup = moveGridSelection(this.selectedGroup,
      this.callbacks.campaignRules ? 4 : 3, 1, direction);
    this.render();
  }

  private moveOption(direction: "left" | "right"): void {
    if (this.selectedGroup === 3) {
      this.callbacks.campaignRules?.adjust(direction === "left" ? -1 : 1);
      this.render();
      return;
    }
    if (this.selectedGroup === 0) {
      const index = SKIN_COLOR_OPTIONS.findIndex((option) => option.color === this.appearance.skinColor);
      const next = moveGridSelection(index, SKIN_COLOR_OPTIONS.length, SKIN_COLOR_OPTIONS.length, direction);
      this.appearance.skinColor = SKIN_COLOR_OPTIONS[next]!.color;
    } else if (this.selectedGroup === 1) {
      const index = HAIR_STYLE_OPTIONS.findIndex((option) => option.id === this.appearance.hairStyle);
      const next = moveGridSelection(index, HAIR_STYLE_OPTIONS.length, HAIR_STYLE_OPTIONS.length, direction);
      this.appearance.hairStyle = HAIR_STYLE_OPTIONS[next]!.id;
    } else {
      const index = HAIR_COLOR_OPTIONS.findIndex((option) => option.color === this.appearance.hairColor);
      const next = moveGridSelection(index, HAIR_COLOR_OPTIONS.length, HAIR_COLOR_OPTIONS.length, direction);
      this.appearance.hairColor = HAIR_COLOR_OPTIONS[next]!.color;
    }
    this.updatePreviewTexture();
    this.render();
  }

  private render(): void {
    if (!this.previewKey) throw new Error("[CharacterAppearance] Preview texture is unavailable");
    if (this.startButton) this.scene.tweens.killTweensOf(this.startButton);
    this.container?.destroy(true);
    const camera = this.scene.cameras.main;
    const width = camera.width - 32;
    const x = 16;
    const container = createOverlayContainer(this.scene, "character-appearance", 0, {
      x: 8, y: 8, width: camera.width - 16, height: camera.height - 16,
    });
    this.container = container;
    const centerX = camera.width / 2;
    const text = (id: string, value: string, size: number, color: string, maxWidth = width): Phaser.GameObjects.Text => {
      const label = this.scene.add.text(0, 0, value, {
        fontFamily: "monospace", fontSize: `${size}px`, color,
        wordWrap: { width: maxWidth, useAdvancedWrap: true }, lineSpacing: 2,
      }).setOrigin(0.5, 0).setData("layoutId", id);
      container.add(label);
      return label;
    };
    const button = (id: string, label: string, size: number, color: string, action: () => void): Phaser.GameObjects.Text => {
      const result = text(id, label, size, color);
      result.setPadding(6, 5).setBackgroundColor("#20273a").setInteractive({ useHandCursor: true });
      result.on("pointerover", () => result.setColor("#ffd700"));
      result.on("pointerout", () => result.setColor(color));
      result.on("pointerdown", action);
      return result;
    };
    const title = text("appearance-title", "Customize Appearance", 22, "#ffd700", width - 96);
    const classLabel = text("appearance-class", `Class: ${this.playerClass.label}`, 12, "#b0bec5", width - 96);
    const preview = this.scene.add.sprite(0, 0, this.previewKey).setScale(2);
    preview.setData("layoutId", "appearance-preview");
    container.add(preview);
    const headerHeight = Math.max(preview.displayHeight, title.displayHeight + 6 + classLabel.displayHeight);
    const headerWidth = preview.displayWidth + 16 + Math.max(title.displayWidth, classLabel.displayWidth);
    const randomize = button("appearance-randomize", "🎲 Randomize", 12, "#88ccff", () => this.randomize());
    const rules = this.callbacks.campaignRules;
    const rulesButton = rules ? button("character-difficulty",
      `${this.selectedGroup === 3 ? "> " : ""}Rules: ${rules.label()}`, 12, "#e5eef6", () => rules.open()) : null;
    const utilityWidth = (width - 12) / 2;
    if (rulesButton) [randomize, rulesButton].forEach((label) =>
      label.setWordWrapWidth(utilityWidth - 14, true).setFixedSize(utilityWidth, 0));
    const utilityHeight = Math.max(randomize.displayHeight, rulesButton?.displayHeight ?? 0);
    const groupLabels = ["Skin Color:", "Hair Style:", "Hair Color:"].map((label, index) =>
      text(`appearance-group-${index}`, `${index === this.selectedGroup ? "> " : ""}${label}`, 13,
        index === this.selectedGroup ? "#ffd700" : "#c0a060")
    );

    const skin = this.colorRow(container, "appearance-skin", SKIN_COLOR_OPTIONS, this.appearance.skinColor, width, (color) => {
      this.appearance.skinColor = color;
      this.updatePreviewTexture();
      this.render();
    });
    const hair = this.colorRow(container, "appearance-hair-color", HAIR_COLOR_OPTIONS, this.appearance.hairColor, width, (color) => {
      this.appearance.hairColor = color;
      this.updatePreviewTexture();
      this.render();
    });
    const styleWidth = (width - 18) / HAIR_STYLE_OPTIONS.length;
    const styles = HAIR_STYLE_OPTIONS.map((option) => {
      const selected = option.id === this.appearance.hairStyle;
      const label = button(`appearance-hair-style-${option.id}`, `${selected ? "> " : ""}${option.label}`, 13,
        selected ? "#ffd700" : "#b0bec5", () => {
          this.appearance.hairStyle = option.id;
          this.updatePreviewTexture();
          this.render();
        });
      label.setWordWrapWidth(styleWidth - 14, true).setFixedSize(styleWidth, 0);
      return label;
    });
    const styleHeight = Math.max(34, ...styles.map((label) => label.displayHeight));
    const footer = [
      button("appearance-back", "[ < Back ]", 16, "#b0bec5", () => this.callbacks.back()),
      button("appearance-start", "[ Start Adventure ]", 16, "#88ff88", () => this.callbacks.start({ ...this.appearance })),
    ];
    const footerWidth = (width - 12) / 2;
    footer.forEach((label) => label.setWordWrapWidth(footerWidth - 14, true).setFixedSize(footerWidth, 0));
    const footerHeight = Math.max(44, ...footer.map((label) => label.displayHeight));
    const heights = [
      headerHeight, utilityHeight,
      groupLabels[0]!.displayHeight, skin.height,
      groupLabels[1]!.displayHeight, styleHeight,
      groupLabels[2]!.displayHeight, hair.height, footerHeight,
    ];
    const total = heights.reduce((sum, value) => sum + value, 0) + 8 * 8;
    let cursor = Math.max(8, Math.floor((camera.height - total) / 2));
    const headerX = centerX - headerWidth / 2;
    preview.setPosition(headerX + preview.displayWidth / 2, cursor + headerHeight / 2);
    preview.setData("layoutBounds", getScaledBounds(preview));
    const titleX = headerX + preview.displayWidth + 16 + Math.max(title.displayWidth, classLabel.displayWidth) / 2;
    title.setPosition(titleX, cursor);
    classLabel.setPosition(titleX, cursor + title.displayHeight + 6);
    cursor += headerHeight + 8;
    randomize.setPosition(rulesButton ? x + utilityWidth / 2 : centerX, cursor);
    rulesButton?.setPosition(x + utilityWidth + 12 + utilityWidth / 2, cursor);
    syncInteractiveHitArea(randomize);
    if (rulesButton) syncInteractiveHitArea(rulesButton);
    cursor += utilityHeight + 8;
    groupLabels[0]!.setPosition(centerX, cursor);
    cursor += groupLabels[0]!.displayHeight + 8;
    skin.position(centerX, cursor);
    cursor += skin.height + 8;
    groupLabels[1]!.setPosition(centerX, cursor);
    cursor += groupLabels[1]!.displayHeight + 8;
    styles.forEach((label, index) => {
      label.setFixedSize(styleWidth, styleHeight).setPosition(x + styleWidth / 2 + index * (styleWidth + 6), cursor);
      syncInteractiveHitArea(label);
    });
    cursor += styleHeight + 8;
    groupLabels[2]!.setPosition(centerX, cursor);
    cursor += groupLabels[2]!.displayHeight + 8;
    hair.position(centerX, cursor);
    cursor += hair.height + 8;
    const grid = layoutResponsiveGrid({
      availableWidth: width, minColumnWidth: footerWidth, columnGap: 12,
      rowGap: 8, maxColumns: 2, itemHeights: footer.map(() => footerHeight),
    });
    footer.forEach((label, index) => {
      const cell = grid.cells[index]!;
      label.setFixedSize(cell.width, footerHeight).setPosition(x + cell.x + cell.width / 2, cursor + cell.y);
      syncInteractiveHitArea(label);
    });
    this.startButton = footer[1]!;
    if (!isReducedMotionEnabled()) this.scene.tweens.add({
      targets: this.startButton, alpha: 0.4, duration: 900, yoyo: true, repeat: -1,
    });
    if (!rules?.isOpen()) {
      debugPanelState(`BOOT | Screen: appearance [GROUP:${this.selectedGroup + 1}/${rules ? 4 : 3}]`
        + ` [SKIN:${this.appearance.skinColor}] [HAIR:${this.appearance.hairStyle}] [HAIR_COLOR:${this.appearance.hairColor}]`
        + (rules ? ` [DIFFICULTY_PROFILE:${rules.label().toLowerCase()}]` : ""));
    }
  }

  private colorRow(
    container: Phaser.GameObjects.Container,
    prefix: string,
    options: readonly ColorChoice[],
    selected: number,
    maxWidth: number,
    select: (color: number) => void,
  ): { height: number; position(centerX: number, y: number): void } {
    const width = Math.min(maxWidth, options.length * 72);
    const cellWidth = width / options.length;
    const labels = options.map((option, index) => {
      const label = this.scene.add.text(0, 0, `${option.color === selected ? "> " : ""}${option.label}`, {
        fontFamily: "monospace", fontSize: "8px", color: "#b0bec5",
        wordWrap: { width: cellWidth - 4, useAdvancedWrap: true },
      }).setOrigin(0.5, 0).setData("layoutId", `${prefix}-label-${index}`);
      container.add(label);
      return label;
    });
    const height = 30 + Math.max(...labels.map((label) => label.displayHeight));
    return {
      height,
      position: (centerX, y) => {
        options.forEach((option, index) => {
          const cx = centerX - width / 2 + cellWidth / 2 + index * cellWidth;
          const cy = y + 13;
          const graphic = this.scene.add.graphics();
          graphic.fillStyle(option.color, 1).fillCircle(cx, cy, 10);
          graphic.lineStyle(option.color === selected ? 3 : 1, option.color === selected ? 0xffd700 : 0x999999, 1);
          graphic.strokeCircle(cx, cy, 11);
          graphic.setData("layoutId", `${prefix}-swatch-${index}`);
          graphic.setData("layoutBounds", { x: cx - 13, y: cy - 13, width: 26, height: 26 });
          const zone = this.scene.add.zone(cx, y + height / 2, cellWidth - 4, height)
            .setInteractive({ useHandCursor: true }).setData("testId", `${prefix}-${index}`);
          zone.on("pointerdown", () => select(option.color));
          labels[index]!.setPosition(cx, y + 30);
          container.add([graphic, zone]);
        });
      },
    };
  }
}
