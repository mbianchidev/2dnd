import * as Phaser from "phaser";
import { BATTLE_DEPTH } from "../renderers/battleDepth";
import { restoreLayoutFocus, type GridNavigationDirection } from "../systems/layout";
import { createOverlayContainer, setOverlayViewport } from "../utils/ui";
import { layoutTextStack, syncInteractiveHitArea } from "./layout";

export interface BattleDecisionMenuRow {
  id: string;
  label: string;
  enabled: boolean;
  action(): void;
}

interface FocusedMenuRow extends BattleDecisionMenuRow {
  visible: boolean;
  text: Phaser.GameObjects.Text;
}

/** A bounded, measured decision list shared by timed hero and manual companion input. */
export class BattleDecisionMenu {
  private container: Phaser.GameObjects.Container | null = null;
  private title = "";
  private rows: readonly BattleDecisionMenuRow[] = [];
  private visibleRows: FocusedMenuRow[] = [];
  private selectedId: string | undefined;
  private page = 0;
  private pageSize = 6;
  private back: (() => void) | undefined;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly id: string,
    private readonly acceptsInput: () => boolean,
  ) {}

  get isOpen(): boolean {
    return this.container !== null;
  }

  get debugState(): string {
    if (!this.isOpen) return "";
    const unavailable = this.visibleRows.filter((row) => !row.enabled).map((row) => row.id);
    return ` [DECISION_MENU:${this.title}:${this.selectedId ?? "-"}]`
      + ` [UNAVAILABLE_ACTIONS:${unavailable.join(",")}]`;
  }

  show(
    title: string,
    rows: readonly BattleDecisionMenuRow[],
    back?: () => void,
  ): void {
    if (title !== this.title) {
      this.page = 0;
      this.pageSize = 6;
      this.selectedId = undefined;
    }
    this.title = title;
    this.rows = rows;
    this.back = back;
    this.render();
  }

  navigate(direction: GridNavigationDirection): boolean {
    if (!this.isOpen) return false;
    if (!this.acceptsInput()) return true;
    const focus = restoreLayoutFocus(this.visibleRows, this.selectedId);
    if (focus.items.length === 0) return true;
    const delta = direction === "up" || direction === "left" ? -1 : 1;
    this.selectedId = focus.items[
      (focus.index + delta + focus.items.length) % focus.items.length
    ]!.id;
    this.updateSelection();
    return true;
  }

  confirm(): boolean {
    if (!this.isOpen) return false;
    if (!this.acceptsInput()) return true;
    const row = this.visibleRows.find((candidate) => candidate.id === this.selectedId);
    if (row?.enabled) row.action();
    return true;
  }

  cancel(): boolean {
    if (!this.isOpen || !this.back) return false;
    if (this.acceptsInput()) this.back();
    return true;
  }

  clear(): void {
    this.container?.destroy();
    this.container = null;
    this.visibleRows = [];
  }

  private render(): void {
    this.clear();
    const width = Math.min(310, this.scene.cameras.main.width - 20);
    const contentWidth = width - 24;
    const totalPages = Math.max(1, Math.ceil(this.rows.length / this.pageSize));
    this.page = Math.min(this.page, totalPages - 1);
    const visible = this.rows.slice(this.page * this.pageSize, (this.page + 1) * this.pageSize);
    const entries: BattleDecisionMenuRow[] = [...visible];
    if (this.page > 0) {
      entries.push({
        id: "page-previous", label: "Previous page", enabled: true,
        action: () => { this.page--; this.render(); },
      });
    }
    if (this.page < totalPages - 1) {
      entries.push({
        id: "page-next", label: "Next page", enabled: true,
        action: () => { this.page++; this.render(); },
      });
    }
    if (this.back) {
      entries.push({ id: "back", label: "Back", enabled: true, action: this.back });
    }

    const container = createOverlayContainer(this.scene, this.id, BATTLE_DEPTH.uiOverlay);
    const background = this.scene.add.graphics();
    const title = this.scene.add.text(12, 8, [
      this.title,
      ...(totalPages > 1 ? [`Page ${this.page + 1}/${totalPages}`] : []),
    ].join("\n"), {
      fontSize: "11px", fontFamily: "monospace", color: "#ffffff",
      wordWrap: { width: contentWidth },
    }).setData("layoutId", `${this.id}-title`);
    container.add([background, title]);
    this.container = container;
    this.visibleRows = entries.map((row) => {
      const text = this.scene.add.text(12, 0, row.label, {
        fontSize: "11px", fontFamily: "monospace",
        color: row.enabled ? "#f4f1e8" : "#a9afbc",
        backgroundColor: "#121a2e",
        padding: { x: 6, y: 4 },
        wordWrap: { width: contentWidth - 16 },
      }).setData("layoutId", `${this.id}-${row.id}`);
      if (row.enabled) {
        text.setInteractive({ useHandCursor: true });
        text.on("pointerover", () => {
          this.selectedId = row.id;
          this.updateSelection();
        });
        text.on("pointerdown", () => {
          if (!this.acceptsInput()) return;
          this.selectedId = row.id;
          this.updateSelection();
          row.action();
        });
      }
      container.add(text);
      return { ...row, visible: true, text };
    });
    const focus = restoreLayoutFocus(this.visibleRows, this.selectedId);
    this.selectedId = focus.items[focus.index]?.id;
    this.updateSelection();

    let previousMeasurements = "";
    const reflow = (): void => {
      if (!container.active) return;
      const texts = [title, ...this.visibleRows.map((row) => row.text)];
      const measurements = texts.map((text) => `${text.displayWidth}:${text.displayHeight}`).join(",");
      if (measurements === previousMeasurements) return;
      previousMeasurements = measurements;
      container.setPosition(0, 0);
      const height = layoutTextStack(texts, {
        x: 12, y: 8, width: contentWidth, gap: 5, hitAreaPadding: 2,
      }) + 16;
      if (height > this.scene.cameras.main.height - 20 && this.pageSize > 1) {
        this.pageSize--;
        this.render();
        return;
      }
      const x = this.scene.cameras.main.width - width - 10;
      const y = Math.max(10, this.scene.cameras.main.height - height - 10);
      background.clear();
      background.fillStyle(0x080c16, 0.98).fillRoundedRect(0, 0, width, height, 6);
      background.lineStyle(2, 0xffffff, 1).strokeRoundedRect(0, 0, width, height, 6);
      background.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains,
      );
      container.setPosition(x, y);
      setOverlayViewport(this.scene, this.id, { x, y, width, height });
    };
    this.scene.events.on("postupdate", reflow);
    container.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.scene.events.off("postupdate", reflow);
    });
    reflow();
  }

  private updateSelection(): void {
    for (const row of this.visibleRows) {
      const selected = row.enabled && row.id === this.selectedId;
      row.text.setText(`${row.enabled ? selected ? "> " : "  " : "[Unavailable] "}${row.label}`);
      row.text.setBackgroundColor(selected ? "#34416b" : "#121a2e");
      syncInteractiveHitArea(row.text, 2);
    }
  }
}
