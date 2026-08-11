import * as Phaser from "phaser";
import {
  ACHIEVEMENT_CATEGORIES,
  getTitle,
  type AchievementCategory,
} from "../data/achievements";
import {
  equipAchievementTitle,
  getAchievementList,
  getAchievementSummary,
  getEquippedTitleName,
  type AchievementContext,
  type AchievementListEntry,
  type AchievementSort,
  type AchievementVisibility,
} from "../systems/achievements";
import { openMobileTextInput } from "./input";
import {
  createDimGraphics,
  createOverlayContainer,
  createPanelGraphics,
} from "../utils/ui";

interface AchievementOverlayCallbacks {
  autoSave(): void;
  showMessage(text: string, color?: string): void;
}

const PAGE_SIZE = 5;
const CATEGORY_OPTIONS: readonly ("all" | AchievementCategory)[] = [
  "all",
  ...ACHIEVEMENT_CATEGORIES,
];
const VISIBILITY_OPTIONS: readonly AchievementVisibility[] = [
  "all",
  "completed",
  "locked",
];
const SORT_OPTIONS: readonly AchievementSort[] = [
  "category",
  "name",
  "progress",
  "completed",
];

export class AchievementOverlayManager {
  private overlay: Phaser.GameObjects.Container | null = null;
  private context: AchievementContext | null = null;
  private category: "all" | AchievementCategory = "all";
  private visibility: AchievementVisibility = "all";
  private sort: AchievementSort = "category";
  private search = "";
  private searchActive = false;
  private selectedIndex = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly callbacks: AchievementOverlayCallbacks,
  ) {}

  isOpen(): boolean {
    return this.overlay !== null;
  }

  open(context: AchievementContext): void {
    this.close();
    this.context = context;
    this.selectedIndex = 0;
    this.searchActive = false;
    this.scene.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.render();
  }

  close(): void {
    this.scene.input.keyboard?.off("keydown", this.handleKeyDown, this);
    this.overlay?.destroy(true);
    this.overlay = null;
    this.context = null;
    this.searchActive = false;
  }

  getDebugState(): string {
    if (!this.overlay || !this.context) return "";
    const entries = this.getEntries();
    const selected = entries[this.selectedIndex];
    const selection = selected
      ? ` Selected:${selected.definition.id} Progress:${selected.progress.current}/${selected.progress.target}`
      : "";
    return ` [ACHIEVEMENTS ${Math.min(this.selectedIndex + 1, entries.length)}/${entries.length} Category:${this.category} Visibility:${this.visibility} Sort:${this.sort} Search:${this.search || "-"}${this.searchActive ? " Focus:search" : ""}${selection}]`;
  }

  private getEntries(): AchievementListEntry[] {
    if (!this.context) return [];
    return getAchievementList(this.context, {
      ...(this.category === "all" ? {} : { category: this.category }),
      visibility: this.visibility,
      search: this.search,
      sort: this.sort,
    });
  }

  private render(): void {
    const context = this.context;
    if (!context) return;
    this.overlay?.destroy(true);
    const camera = this.scene.cameras.main;
    const width = Math.min(624, camera.width - 16);
    const height = Math.min(494, camera.height - 16);
    const x = Math.floor((camera.width - width) / 2);
    const y = Math.floor((camera.height - height) / 2);
    const container = createOverlayContainer(
      this.scene,
      "achievements",
      95,
      { x, y, width, height },
    );
    const dim = createDimGraphics(this.scene, camera.width, camera.height, 0.76)
      .setInteractive(
        new Phaser.Geom.Rectangle(0, 0, camera.width, camera.height),
        Phaser.Geom.Rectangle.Contains,
      );
    dim.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (
        pointer.x < x
        || pointer.x > x + width
        || pointer.y < y
        || pointer.y > y + height
      ) {
        this.close();
      }
    });
    container.add(dim);
    container.add(createPanelGraphics(
      this.scene,
      x,
      y,
      width,
      height,
      0.98,
      0xc0a060,
    ));
    this.overlay = container;

    const summary = getAchievementSummary(context.player);
    const titleName = getEquippedTitleName(context.player);
    this.addText(
      x + 12,
      y + 10,
      `Achievements  ${summary.earned}/${summary.total}  ${summary.points}/${summary.totalPoints} pts`,
      "#ffd700",
      15,
      width - 24,
    );
    this.addText(
      x + 12,
      y + 32,
      `Title: ${titleName || "None"}`,
      titleName ? "#9fe8ff" : "#999999",
      10,
    );
    this.addButton(x + width - 74, y + 8, "Close", () => this.close(), "#ffaaaa", 62);
    this.addButton(x + width - 144, y + 30, "Clear title", () => {
      const result = equipAchievementTitle(context.player, "");
      this.callbacks.showMessage(result.message, result.changed ? "#88ff88" : "#ffcc88");
      if (result.changed) this.callbacks.autoSave();
      this.render();
    }, "#bbbbbb", 132);

    const controlWidth = Math.floor((width - 36) / 4);
    const controlX = (index: number): number =>
      x + 12 + index * (controlWidth + 4);
    this.addButton(controlX(0), y + 56, `Category:${this.label(this.category)}`, () => {
      this.category = this.nextOption(CATEGORY_OPTIONS, this.category);
      this.selectedIndex = 0;
      this.render();
    }, "#b8ddff", controlWidth);
    this.addButton(controlX(1), y + 56, `View:${this.label(this.visibility)}`, () => {
      this.visibility = this.nextOption(VISIBILITY_OPTIONS, this.visibility);
      this.selectedIndex = 0;
      this.render();
    }, "#b8ddff", controlWidth);
    this.addButton(controlX(2), y + 56, `Sort:${this.label(this.sort)}`, () => {
      this.sort = this.nextOption(SORT_OPTIONS, this.sort);
      this.selectedIndex = 0;
      this.render();
    }, "#b8ddff", controlWidth);
    const searchLabel = this.search
      ? `Search:${this.truncate(this.search, 14)}`
      : this.searchActive ? "Search:typing..." : "Search:/";
    this.addButton(controlX(3), y + 56, searchLabel, () => {
      const pointerEvent = this.scene.input.activePointer.event;
      if (
        pointerEvent instanceof PointerEvent
        && pointerEvent.pointerType === "touch"
      ) {
        openMobileTextInput("Achievement search", this.search, 32, (value) => {
          this.search = value;
          this.searchActive = false;
          this.selectedIndex = 0;
          this.render();
        });
        return;
      }
      this.searchActive = !this.searchActive;
      this.render();
    }, this.searchActive ? "#ffd700" : "#b8ddff", controlWidth);

    const entries = this.getEntries();
    this.selectedIndex = entries.length === 0
      ? 0
      : Phaser.Math.Clamp(this.selectedIndex, 0, entries.length - 1);
    const page = Math.floor(this.selectedIndex / PAGE_SIZE);
    const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
    const visible = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    visible.forEach((entry, offset) => {
      this.renderEntry(entry, page * PAGE_SIZE + offset, x + 12, y + 94, width - 24);
    });
    if (entries.length === 0) {
      this.addText(x + 20, y + 124, "No achievements match this view.", "#888888", 11);
    }

    const selected = entries[this.selectedIndex];
    const detailY = y + height - 72;
    if (selected) {
      const hidden = selected.definition.hidden && !selected.earned;
      const reward = selected.definition.rewardTitleId
        ? getTitle(selected.definition.rewardTitleId)
        : undefined;
      const completion = selected.earned
        ? `Completed #${selected.earned.order} - ${new Date(selected.earned.unlockedAt).toLocaleDateString()}${selected.earned.debug ? " [DEBUG]" : ""}`
        : `${selected.progress.current}/${selected.progress.target}`;
      this.addText(
        x + 12,
        detailY,
        hidden
          ? "Hidden achievement - complete it to reveal details."
          : `${selected.definition.description} | ${completion}${reward ? ` | Reward: ${reward.name}` : ""}`,
        hidden ? "#888888" : "#dddddd",
        9,
        width - 124,
      );
      if (
        reward
        && context.player.progression.achievements.unlockedTitleIds.includes(
          reward.id,
        )
      ) {
        this.addButton(x + width - 106, detailY, "Equip title", () => {
          const result = equipAchievementTitle(context.player, reward.id);
          this.callbacks.showMessage(
            result.message,
            result.changed ? "#88ff88" : "#ffcc88",
          );
          if (result.changed) this.callbacks.autoSave();
          this.render();
        }, "#aaffdd", 94);
      }
    }
    this.addText(
      x + 12,
      y + height - 24,
      `Page ${page + 1}/${pageCount}  Up/Down select  Left/Right page  / search  Enter equip  Esc close`,
      "#888888",
      8,
      width - 24,
    );
  }

  private renderEntry(
    entry: AchievementListEntry,
    index: number,
    x: number,
    y: number,
    width: number,
  ): void {
    const rowY = y + (index % PAGE_SIZE) * 52;
    const selected = index === this.selectedIndex;
    const hidden = entry.definition.hidden && !entry.earned;
    const marker = entry.earned ? "[DONE]" : hidden ? "[HIDDEN]" : "[LOCKED]";
    const name = hidden ? "????" : entry.definition.name;
    const progress = hidden
      ? "Progress hidden"
      : `${entry.progress.current}/${entry.progress.target}`;
    this.addButton(
      x,
      rowY,
      `${selected ? ">" : " "} ${marker} ${name}  ${entry.definition.points} pts`,
      () => {
        this.selectedIndex = index;
        this.render();
      },
      entry.earned ? "#aaffaa" : selected ? "#ffd700" : "#dddddd",
      width,
    );
    const barWidth = Math.max(40, width - 120);
    const ratio = hidden ? 0 : entry.progress.current / entry.progress.target;
    const bar = this.scene.add.graphics();
    bar.fillStyle(0x22263a, 1);
    bar.fillRect(x + 8, rowY + 29, barWidth, 8);
    bar.fillStyle(entry.earned ? 0x66cc88 : 0x5b8bd9, 1);
    bar.fillRect(x + 8, rowY + 29, Math.round(barWidth * ratio), 8);
    bar.lineStyle(1, selected ? 0xffd700 : 0x8792aa, 1);
    bar.strokeRect(x + 8, rowY + 29, barWidth, 8);
    this.overlay?.add(bar);
    this.addText(x + barWidth + 16, rowY + 27, progress, "#bbbbbb", 8, 96);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.overlay || !this.context) return;
    if (event.key === "Escape" || event.key === "y" || event.key === "Y") {
      this.close();
      event.preventDefault();
      return;
    }
    if (this.searchActive) {
      if (event.key === "Enter") {
        this.searchActive = false;
      } else if (event.key === "Backspace") {
        this.search = this.search.slice(0, -1);
      } else if (/^[a-zA-Z0-9 '’-]$/.test(event.key) && this.search.length < 32) {
        this.search += event.key;
      } else {
        return;
      }
      this.selectedIndex = 0;
      this.render();
      event.preventDefault();
      return;
    }
    const entries = this.getEntries();
    if (event.key === "/") {
      this.searchActive = true;
    } else if (event.key === "ArrowUp") {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
    } else if (event.key === "ArrowDown") {
      this.selectedIndex = Math.min(
        Math.max(0, entries.length - 1),
        this.selectedIndex + 1,
      );
    } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
      this.selectedIndex = Math.max(0, this.selectedIndex - PAGE_SIZE);
    } else if (event.key === "ArrowRight" || event.key === "PageDown") {
      this.selectedIndex = Math.min(
        Math.max(0, entries.length - 1),
        this.selectedIndex + PAGE_SIZE,
      );
    } else if (event.key === "c" || event.key === "C") {
      this.category = this.nextOption(CATEGORY_OPTIONS, this.category);
      this.selectedIndex = 0;
    } else if (event.key === "v" || event.key === "V") {
      this.visibility = this.nextOption(VISIBILITY_OPTIONS, this.visibility);
      this.selectedIndex = 0;
    } else if (event.key === "s" || event.key === "S") {
      this.sort = this.nextOption(SORT_OPTIONS, this.sort);
      this.selectedIndex = 0;
    } else if (event.key === "Enter") {
      const selected = entries[this.selectedIndex];
      const titleId = selected?.definition.rewardTitleId;
      if (
        titleId
        && this.context.player.progression.achievements.unlockedTitleIds.includes(
          titleId,
        )
      ) {
        const result = equipAchievementTitle(this.context.player, titleId);
        this.callbacks.showMessage(
          result.message,
          result.changed ? "#88ff88" : "#ffcc88",
        );
        if (result.changed) this.callbacks.autoSave();
      }
    } else {
      return;
    }
    this.render();
    event.preventDefault();
  }

  private addText(
    x: number,
    y: number,
    text: string,
    color = "#dddddd",
    fontSize = 10,
    width?: number,
  ): Phaser.GameObjects.Text {
    const label = this.scene.add.text(x, y, text, {
      fontSize: `${fontSize}px`,
      fontFamily: "monospace",
      color,
      ...(width ? { wordWrap: { width } } : {}),
    });
    if (width) label.setData("accessibilityMaxWidth", width);
    this.overlay?.add(label);
    return label;
  }

  private addButton(
    x: number,
    y: number,
    label: string,
    action: () => void,
    color: string,
    width: number,
  ): Phaser.GameObjects.Text {
    const button = this.scene.add.text(x, y, label, {
      fontSize: "10px",
      fontFamily: "monospace",
      color,
      backgroundColor: "#29324a",
      padding: { x: 5, y: 4 },
      fixedWidth: width,
    }).setInteractive({ useHandCursor: true });
    button.on("pointerover", () => button.setColor("#ffd700"));
    button.on("pointerout", () => button.setColor(color));
    button.on("pointerdown", action);
    this.overlay?.add(button);
    return button;
  }

  private nextOption<T>(
    options: readonly T[],
    current: T,
  ): T {
    const index = options.indexOf(current);
    return options[(index + 1) % options.length]!;
  }

  private label(value: string): string {
    return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
  }

  private truncate(value: string, length: number): string {
    return value.length <= length ? value : `${value.slice(0, length - 1)}…`;
  }
}
