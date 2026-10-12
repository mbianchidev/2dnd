import * as Phaser from "phaser";
import {
  ACHIEVEMENT_CATEGORIES,
  getTitle,
  type AchievementCategory,
  type TitleId,
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
import { subscribeOverlayReflow } from "./layout";
import { createStatusAnnouncer } from "../utils/ui";
import { renderAchievementPanel } from "../renderers/achievementPanel";
import { inputSource } from "../systems/input";
import type { AchievementPanelContent } from "../renderers/achievementPanel";

interface AchievementOverlayCallbacks {
  autoSave(): void;
  showMessage(text: string, color?: string): void;
}

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
  private pages: readonly (readonly number[])[] = [];
  private unsubscribeReflow: (() => void) | null = null;
  private liveRegion: HTMLDivElement | null = null;

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
    this.unsubscribeReflow = subscribeOverlayReflow(this.scene, () => this.render());
    this.liveRegion = createStatusAnnouncer("achievement-live-region");
    this.render();
  }

  close(): void {
    this.unsubscribeReflow?.();
    this.unsubscribeReflow = null;
    this.liveRegion?.remove();
    this.liveRegion = null;
    this.scene.input.keyboard?.off("keydown", this.handleKeyDown, this);
    this.overlay?.destroy(true);
    this.overlay = null;
    this.context = null;
    this.searchActive = false;
    this.pages = [];
  }

  getDebugState(): string {
    if (!this.overlay || !this.context) return "";
    const entries = this.getEntries();
    const selected = entries[this.selectedIndex];
    const selection = selected
      ? ` Selected:${selected.definition.id} Progress:${selected.progress.current}/${selected.progress.target}`
      : "";
    const page = Math.max(0, this.pages.findIndex((indices) => indices.includes(this.selectedIndex)));
    return ` [ACHIEVEMENTS ${Math.min(this.selectedIndex + 1, entries.length)}/${entries.length} Page:${page + 1}/${Math.max(1, this.pages.length)} Category:${this.category} Visibility:${this.visibility} Sort:${this.sort} Search:${this.search || "-"}${this.searchActive ? " Focus:search" : ""}${selection}]`;
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
    const summary = getAchievementSummary(context.player);
    const titleName = getEquippedTitleName(context.player);
    const searchLabel = this.search
      ? `Search:${this.truncate(this.search, 14)}`
      : this.searchActive ? "Search:typing..." : "Search:/";
    const entries = this.getEntries();
    this.selectedIndex = entries.length === 0
      ? 0
      : Phaser.Math.Clamp(this.selectedIndex, 0, entries.length - 1);
    const selected = entries[this.selectedIndex];
    const hidden = !!selected?.definition.hidden && !selected.earned;
    const reward = selected?.definition.rewardTitleId ? getTitle(selected.definition.rewardTitleId) : undefined;
    const detail = this.describeEntry(selected);
    const titleActions: Array<AchievementPanelContent["titleActions"][number]> = [];
    if (titleName) titleActions.push({
      id: "achievement-clear-title", label: "Clear title", color: "#bbbbbb",
      activate: () => this.equipTitle(""),
    });
    if (reward && context.player.progression.achievements.unlockedTitleIds.includes(reward.id)) {
      titleActions.push({
        id: "achievement-equip-title", label: "Equip title", color: "#aaffdd",
        activate: () => this.equipTitle(reward.id),
      });
    }
    const panel = renderAchievementPanel(this.scene, {
      summary: `Achievements  ${summary.earned}/${summary.total}  ${summary.points}/${summary.totalPoints} pts`,
      title: titleName,
      controls: [
        {
          id: "achievement-category", label: `Category:${this.label(this.category)}`, color: "#b8ddff",
          activate: () => {
            this.category = this.nextOption(CATEGORY_OPTIONS, this.category);
            this.selectedIndex = 0;
            this.render();
          },
        },
        {
          id: "achievement-visibility", label: `View:${this.label(this.visibility)}`, color: "#b8ddff",
          activate: () => {
            this.visibility = this.nextOption(VISIBILITY_OPTIONS, this.visibility);
            this.selectedIndex = 0;
            this.render();
          },
        },
        {
          id: "achievement-sort", label: `Sort:${this.label(this.sort)}`, color: "#b8ddff",
          activate: () => {
            this.sort = this.nextOption(SORT_OPTIONS, this.sort);
            this.selectedIndex = 0;
            this.render();
          },
        },
        {
          id: "achievement-search", label: searchLabel, color: this.searchActive ? "#ffd700" : "#b8ddff",
          activate: () => this.openSearchDialog(),
        },
      ],
      rows: entries.map((entry, index) => {
        const rowHidden = entry.definition.hidden && !entry.earned;
        const marker = entry.earned ? "[DONE]" : rowHidden ? "[HIDDEN]" : "[LOCKED]";
        return {
          id: entry.definition.id,
          heading: `${index === this.selectedIndex ? ">" : " "} ${marker} ${rowHidden ? "????" : entry.definition.name}  ${entry.definition.points} pts`,
          detail: this.describeEntry(entry),
          progress: rowHidden ? "Progress hidden" : `${entry.progress.current}/${entry.progress.target}`,
          ratio: rowHidden ? 0 : entry.progress.current / entry.progress.target,
          selected: index === this.selectedIndex,
          earned: !!entry.earned,
          color: entry.earned ? "#aaffaa" : index === this.selectedIndex ? "#ffd700" : "#dddddd",
          select: () => { this.selectedIndex = index; this.render(); },
        };
      }),
      selectedIndex: this.selectedIndex, detail,
      detailColor: hidden ? "#999999" : "#dddddd", titleActions,
      close: () => this.close(),
      previousPage: () => { this.selectPage(-1); this.render(); },
      nextPage: () => { this.selectPage(1); this.render(); },
    });
    this.overlay = panel.container;
    this.pages = panel.pages;
    if (this.liveRegion) {
      const page = Math.max(0, this.pages.findIndex((indices) => indices.includes(this.selectedIndex)));
      this.liveRegion.textContent = `Achievements: ${summary.earned}/${summary.total}, ${summary.points} points. `
        + `Page ${page + 1}/${Math.max(1, this.pages.length)}. `
        + `${hidden ? "Hidden achievement" : selected?.definition.name ?? "No matches"}. ${detail}`;
    }
  }

  private describeEntry(entry?: AchievementListEntry): string {
    if (!entry) return "";
    if (entry.definition.hidden && !entry.earned) return "Hidden achievement - complete it to reveal details.";
    const reward = entry.definition.rewardTitleId ? getTitle(entry.definition.rewardTitleId) : undefined;
    const completion = entry.earned
      ? `Completed #${entry.earned.order} - ${new Date(entry.earned.unlockedAt).toLocaleDateString()}${entry.earned.debug ? " [DEBUG]" : ""}`
      : `${entry.progress.current}/${entry.progress.target}`;
    return `${entry.definition.description} | ${completion}${reward ? ` | Reward: ${reward.name}` : ""}`;
  }

  private equipTitle(titleId: TitleId | ""): void {
    if (!this.context) return;
    const result = equipAchievementTitle(this.context.player, titleId);
    this.callbacks.showMessage(result.message, result.changed ? "#88ff88" : "#ffcc88");
    if (result.changed) this.callbacks.autoSave();
    this.render();
  }

  private openSearchDialog(): void {
    openMobileTextInput("Achievement search", this.search, 32, (value) => {
      this.search = value;
      this.searchActive = false;
      this.selectedIndex = 0;
      this.render();
    });
  }

  private selectPage(direction: -1 | 1): void {
    const current = Math.max(0, this.pages.findIndex((page) => page.includes(this.selectedIndex)));
    const destination = this.pages[Phaser.Math.Clamp(current + direction, 0, this.pages.length - 1)];
    if (!destination?.length) return;
    const offset = Math.max(0, this.pages[current]?.indexOf(this.selectedIndex) ?? 0);
    this.selectedIndex = destination[Math.min(offset, destination.length - 1)]!;
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
      if (inputSource.get() !== "keyboard") {
        this.openSearchDialog();
        event.preventDefault();
        return;
      }
      this.searchActive = true;
    } else if (event.key === "ArrowUp") {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
    } else if (event.key === "ArrowDown") {
      this.selectedIndex = Math.min(
        Math.max(0, entries.length - 1),
        this.selectedIndex + 1,
      );
    } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
      this.selectPage(-1);
    } else if (event.key === "ArrowRight" || event.key === "PageDown") {
      this.selectPage(1);
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
