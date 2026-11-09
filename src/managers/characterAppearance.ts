import * as Phaser from "phaser";
import {
  ACCESSORY_OPTIONS, BODY_BUILD_OPTIONS, createCustomAppearance, EYE_COLOR_OPTIONS,
  FACIAL_HAIR_OPTIONS, HAIR_COLOR_OPTIONS, HAIR_STYLE_OPTIONS, OUTFIT_COLOR_OPTIONS, SKIN_COLOR_OPTIONS,
} from "../systems/appearance";
import { resolveHeroVisualDescriptor } from "../systems/heroVisuals";
import { acquireHeroTexture } from "../renderers/heroTextures";
import { moveGridSelection } from "../systems/layout";
import { UI_COLORS, UI_CSS, UI_FONT_DISPLAY } from "../systems/uiTheme";
import { createOverlayContainer, createPanelGraphics, paintPanel } from "../utils/ui";
import { debugPanelState } from "../config";
import { getScaledBounds, subscribeOverlayReflow, syncInteractiveHitArea } from "./layout";
import type { CustomAppearance } from "../systems/appearance";
import type { PlayerClass } from "../systems/classes";
import type { HeroFacing } from "../systems/heroVisuals";
import type { HeroTextureLease } from "../renderers/heroTextures";

export interface CharacterCreationControlHandlers {
  up(): void;
  down(): void;
  left(): void;
  right(): void;
  confirm(): void;
  cancel(): void;
  tab?(): void;
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

interface AppearanceRow {
  readonly id: string;
  readonly label: string;
  readonly options: readonly { label: string; color?: number }[];
  index(): number;
  choose(index: number): void;
}

const PAGES = ["Hair & skin", "Features", "Clothing", "Details"] as const;
const FACINGS: readonly { label: string; id: HeroFacing }[] = [
  { label: "Front", id: "front" }, { label: "Side", id: "side" }, { label: "Back", id: "back" },
];

/** Cosmetic state survives reflow; the preview uses the same descriptor as every gameplay scene. */
export class CharacterAppearanceManager {
  private container: Phaser.GameObjects.Container | null = null;
  private unsubscribeReflow: (() => void) | null = null;
  private selectedGroup = 0;
  private page = 0;
  private facing: HeroFacing = "front";
  private readonly appearance: CustomAppearance;
  private preview: HeroTextureLease | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly playerClass: PlayerClass,
    private readonly callbacks: CharacterAppearanceCallbacks,
  ) {
    this.appearance = createCustomAppearance(playerClass);
  }

  open(): void {
    this.updatePreview();
    this.unsubscribeReflow = subscribeOverlayReflow(this.scene, () => this.render());
    this.callbacks.bindControls({
      up: () => this.moveGroup("up"), down: () => this.moveGroup("down"),
      left: () => this.moveOption(-1), right: () => this.moveOption(1),
      tab: () => this.selectPage((this.page + 1) % PAGES.length),
      confirm: () => this.selectedGroup === 3
        ? this.callbacks.campaignRules?.open() : this.callbacks.start({ ...this.appearance }),
      cancel: () => this.callbacks.back(),
    });
    this.render();
  }

  destroy(): void {
    this.unsubscribeReflow?.();
    this.unsubscribeReflow = null;
    this.container?.destroy(true);
    this.container = null;
    this.preview?.release();
    this.preview = null;
  }

  refresh(): void { if (this.container) this.render(); }

  private updatePreview(): void {
    this.container?.destroy(true);
    this.container = null;
    const descriptor = resolveHeroVisualDescriptor({
      appearanceId: this.playerClass.id, customAppearance: this.appearance,
      equippedWeapon: null, equippedArmor: null, equippedOffHand: null, equippedShield: null,
    });
    const previous = this.preview;
    this.preview = acquireHeroTexture(this.scene, descriptor, this.facing);
    previous?.release();
  }

  private row<T extends { label: string }>(
    id: string, label: string, options: readonly T[], selected: (choice: T) => boolean, choose: (choice: T) => void,
  ): AppearanceRow {
    return {
      id, label, options,
      index: () => Math.max(0, options.findIndex(selected)),
      choose: (index) => {
        const option = options[index];
        if (!option) throw new Error(`[appearance] Unknown ${id} option ${index}.`);
        choose(option);
      },
    };
  }

  private rows(page = this.page): AppearanceRow[] {
    const colorRow = (
      key: "skinColor" | "hairColor" | "eyeColor" | "outfitColor" | "legColor" | "accentColor",
      id: string, label: string, colors: readonly { label: string; color: number }[],
    ): AppearanceRow => {
      const current = this.appearance[key]!;
      const options = colors.some(({ color }) => color === current) ? colors : [{ label: "Class original", color: current }, ...colors];
      return this.row(id, label, options, ({ color }) => color === this.appearance[key],
        ({ color }) => { this.appearance[key] = color; });
    };
    if (page === 0) return [
      colorRow("skinColor", "skin", "Skin tone", SKIN_COLOR_OPTIONS),
      this.row("hair-style", "Hairstyle", HAIR_STYLE_OPTIONS, ({ id }) => id === this.appearance.hairStyle,
        ({ id }) => { this.appearance.hairStyle = id; }),
      colorRow("hairColor", "hair-color", "Hair color", HAIR_COLOR_OPTIONS),
    ];
    if (page === 1) return [
      colorRow("eyeColor", "eyes", "Eye color", EYE_COLOR_OPTIONS),
      this.row("facial-hair", "Facial hair", FACIAL_HAIR_OPTIONS, ({ id }) => id === this.appearance.facialHair,
        ({ id }) => { this.appearance.facialHair = id; }),
      this.row("build", "Body build", BODY_BUILD_OPTIONS, ({ id }) => id === this.appearance.bodyBuild,
        ({ id }) => { this.appearance.bodyBuild = id; }),
    ];
    if (page === 2) return [
      colorRow("outfitColor", "outfit", "Outfit color", OUTFIT_COLOR_OPTIONS),
      colorRow("legColor", "trousers", "Trouser color", OUTFIT_COLOR_OPTIONS),
      colorRow("accentColor", "accent", "Belt & trim", OUTFIT_COLOR_OPTIONS),
    ];
    return [
      this.row("accessory", "Accessory", ACCESSORY_OPTIONS, ({ id }) => id === this.appearance.accessory,
        ({ id }) => { this.appearance.accessory = id; }),
      this.row("headwear", "Class headwear", [{ label: "Shown", value: true }, { label: "Hidden", value: false }],
        ({ value }) => value === this.appearance.headwear, ({ value }) => { this.appearance.headwear = value; }),
      this.row("facing", "Preview angle", FACINGS, ({ id }) => id === this.facing, ({ id }) => { this.facing = id; }),
    ];
  }

  private selectPage(page: number): void {
    this.page = page;
    this.selectedGroup = 0;
    this.render();
  }

  private randomize(): void {
    for (let page = 0; page < PAGES.length; page++) {
      for (const row of this.rows(page)) {
        if (row.id !== "facing") row.choose(Math.floor(Math.random() * row.options.length));
      }
    }
    this.selectedGroup = 0;
    this.updatePreview();
    this.render();
  }

  private moveGroup(direction: "up" | "down"): void {
    this.selectedGroup = moveGridSelection(this.selectedGroup, this.callbacks.campaignRules ? 4 : 3, 1, direction);
    this.render();
  }

  private moveOption(direction: -1 | 1): void {
    if (this.selectedGroup === 3) {
      this.callbacks.campaignRules?.adjust(direction);
    } else {
      const row = this.rows()[this.selectedGroup]!;
      row.choose((row.index() + direction + row.options.length) % row.options.length);
      this.updatePreview();
    }
    this.render();
  }

  private render(): void {
    if (!this.preview) throw new Error("[appearance] Preview texture is unavailable.");
    this.container?.destroy(true);
    const { width, height } = this.scene.cameras.main;
    const container = createOverlayContainer(this.scene, "character-appearance", 0, {
      x: 8, y: 8, width: width - 16, height: height - 16,
    });
    this.container = container;
    container.add(createPanelGraphics(this.scene, 12, 12, width - 24, height - 24, 0.9));
    const text = (
      id: string, value: string, x: number, y: number, size: number, maxWidth: number, color: string = UI_CSS.text,
    ): Phaser.GameObjects.Text => {
      const label = this.scene.add.text(x, y, value, {
        fontFamily: "monospace", fontSize: `${size}px`, color,
        wordWrap: { width: maxWidth, useAdvancedWrap: true }, lineSpacing: 2,
      }).setData("layoutId", id);
      container.add(label);
      return label;
    };
    const button = (
      id: string, value: string, x: number, y: number, buttonWidth: number, action: () => void, selected = false,
    ): Phaser.GameObjects.Text => {
      const label = text(id, value, x, y, 12, buttonWidth - 16, selected ? UI_CSS.gold : UI_CSS.text);
      label.setPadding(8, 8).setBackgroundColor(selected ? UI_CSS.selected : UI_CSS.raised);
      label.setFixedSize(buttonWidth, Math.max(36, label.height)).setInteractive({ useHandCursor: true });
      label.on("pointerdown", action);
      label.on("pointerover", () => label.setColor(UI_CSS.gold));
      label.on("pointerout", () => label.setColor(selected ? UI_CSS.gold : UI_CSS.text));
      syncInteractiveHitArea(label);
      return label;
    };
    const title = text("appearance-title", "Make this hero yours", 28, 24, 24, width - 56, UI_CSS.gold);
    const subtitle = text("appearance-class", "Appearance / All choices are cosmetic", 28,
      title.y + title.height + 4, 11, width - 56, UI_CSS.muted);
    const tabY = subtitle.y + subtitle.height + 12;
    const tabWidth = (width - 68) / PAGES.length;
    const tabs = PAGES.map((name, index) => button(`appearance-page-${index}`, name,
      28 + index * (tabWidth + 4), tabY, tabWidth, () => this.selectPage(index), index === this.page));
    const top = tabY + Math.max(...tabs.map((tab) => tab.height)) + 12;
    const footerY = height - 68;
    const cardWidth = 170;
    const cardX = 28;
    const rowsX = cardX + cardWidth + 14;
    const rowWidth = width - rowsX - 28;
    const card = this.scene.add.graphics();
    paintPanel(card, cardX, top, cardWidth, footerY - top - 12, 0.74, UI_COLORS.border);
    container.add(card);
    const classLabel = text("appearance-preview-class", this.playerClass.label, cardX + 12, top + 12, 18, cardWidth - 24, UI_CSS.gold);
    classLabel.setFontFamily(UI_FONT_DISPLAY);
    const preview = this.scene.add.sprite(cardX + cardWidth / 2, top + 126, this.preview.key).setScale(3);
    preview.setData("layoutId", "appearance-preview").setData("layoutBounds", getScaledBounds(preview));
    container.add(preview);
    const randomize = button("appearance-randomize", "Randomize", cardX + 12, top + 198, cardWidth - 24, () => this.randomize());
    const previewHint = text("appearance-preview-hint", "Tab: next category", cardX + 12,
      randomize.y + randomize.height + 8, 9, cardWidth - 24, UI_CSS.muted);
    previewHint.setVisible(previewHint.y + previewHint.height < footerY - 16);
    let cursor = top;
    this.rows().forEach((row, index) => {
      const selected = row.index();
      const option = row.options[selected]!;
      const label = text(`appearance-group-${index}`, `${index === this.selectedGroup ? "> " : ""}${row.label}`,
        rowsX + 10, cursor + 5, 11, rowWidth - 112, index === this.selectedGroup ? UI_CSS.gold : UI_CSS.muted);
      const value = text(`appearance-${row.id}-value`, option.label, rowsX + 10,
        label.y + label.height + 2, 14, rowWidth - 146);
      const rowHeight = Math.max(54, value.y + value.height - cursor + 7);
      const background = this.scene.add.graphics();
      background.fillStyle(index === this.selectedGroup ? UI_COLORS.selected : UI_COLORS.raised, 0.7)
        .fillRect(rowsX, cursor, rowWidth, rowHeight);
      if (index === this.selectedGroup) background.fillStyle(UI_COLORS.gold).fillRect(rowsX, cursor, 3, rowHeight);
      container.addAt(background, 1);
      if ("color" in option && typeof option.color === "number") {
        const swatch = this.scene.add.rectangle(rowsX + rowWidth - 118, cursor + rowHeight / 2, 18, 18, option.color)
          .setStrokeStyle(1, UI_COLORS.border).setData("layoutId", `appearance-${row.id}-swatch`);
        container.add(swatch);
      }
      for (const direction of [-1, 1] as const) {
        const control = button(`appearance-${row.id}-${direction < 0 ? "previous" : "next"}`,
          direction < 0 ? "<" : ">", rowsX + rowWidth - (direction < 0 ? 94 : 46),
          cursor + Math.max(0, (rowHeight - 44) / 2), 42, () => {
            this.selectedGroup = index;
            this.moveOption(direction);
          });
        control.setFixedSize(42, Math.max(44, control.height));
        syncInteractiveHitArea(control);
      }
      cursor += rowHeight + 8;
    });
    if (this.callbacks.campaignRules) {
      const rules = this.callbacks.campaignRules;
      button("character-difficulty", `${this.selectedGroup === 3 ? "> " : ""}Rules: ${rules.label()}`,
        rowsX, cursor, rowWidth, () => rules.open(), this.selectedGroup === 3);
    }
    const footerWidth = (width - 68) / 2;
    button("appearance-back", "< Back", 28, footerY, footerWidth, () => this.callbacks.back());
    button("appearance-start", "Start adventure >", 40 + footerWidth, footerY, footerWidth,
      () => this.callbacks.start({ ...this.appearance }), true);
    if (!this.callbacks.campaignRules?.isOpen()) {
      debugPanelState(`BOOT | Screen: appearance [GROUP:${this.selectedGroup + 1}/${this.callbacks.campaignRules ? 4 : 3}]`
        + ` [SKIN:${this.appearance.skinColor}] [HAIR:${this.appearance.hairStyle}] [HAIR_COLOR:${this.appearance.hairColor}]`
        + ` [APPEARANCE_PAGE:${this.page}]`
        + (this.callbacks.campaignRules ? ` [DIFFICULTY_PROFILE:${this.callbacks.campaignRules.label().toLowerCase()}]` : ""));
    }
  }
}
