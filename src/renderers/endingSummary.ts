import * as Phaser from "phaser";
import { paginateMeasuredItems } from "../systems/layout";
import { subscribeOverlayReflow, syncInteractiveHitArea } from "../managers/layout";
import { OverlayAccessibility } from "../managers/overlayAccessibility";
import type { CampaignEndingSummary } from "../systems/cutscenes";

/** Measured pages retain full hero/party/cycle text without shrinking supported fonts. */
export class EndingSummaryRenderer {
  private readonly pageContent: Phaser.GameObjects.Container;
  private page = 0;
  private pageCount = 1;
  private selectedId = "continue";
  private heldId: string | null = null;
  private readonly accessibility: OverlayAccessibility;
  private readonly unsubscribe: () => void;
  private disposed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
    private readonly heading: string,
    private readonly summary: CampaignEndingSummary,
    private readonly advance: () => void,
  ) {
    this.pageContent = scene.add.container(0, 0);
    parent.add(this.pageContent);
    this.accessibility = new OverlayAccessibility("ending-summary",
      (id) => { if (this.selectedId !== id) { this.selectedId = id; this.render(); } },
      (id) => this.activate(id),
      { keyDown: this.keyDown, keyUp: this.keyUp });
    this.accessibility.open();
    window.addEventListener("blur", this.clearHeld);
    window.addEventListener("gamepaddisconnected", this.clearHeld);
    document.addEventListener("visibilitychange", this.clearHeld);
    this.unsubscribe = subscribeOverlayReflow(scene, () => { if (!this.disposed) this.render(); });
    this.render();
  }

  navigate(direction: -1 | 1): void {
    this.page = (this.page + direction + this.pageCount) % this.pageCount;
    this.render();
  }

  confirm(): void {
    this.activate(this.selectedId);
  }

  destroy(): void {
    this.disposed = true;
    this.unsubscribe();
    this.heldId = null;
    window.removeEventListener("blur", this.clearHeld);
    window.removeEventListener("gamepaddisconnected", this.clearHeld);
    document.removeEventListener("visibilitychange", this.clearHeld);
    this.accessibility.close();
    this.pageContent.destroy();
  }

  private render(): void {
    this.pageContent.removeAll(true);
    const title = this.scene.add.text(320, 40, this.heading.toUpperCase(), {
      fontFamily: "monospace", fontSize: "20px", color: "#ffe38a",
      wordWrap: { width: 560 }, align: "center",
    }).setOrigin(0.5, 0).setData("layoutId", "ending-summary-title");
    this.pageContent.add(title);
    const columns: string[][] = [
      [
        "HERO", this.summary.hero, "PARTY",
        ...(this.summary.party.length > 1 ? this.summary.party.slice(1) : ["No companions recruited"]),
        `Cities: ${this.summary.discoveredCities.current}/${this.summary.discoveredCities.total}`,
        `Codex: ${this.summary.codexEntries}`, `Alignment: ${this.summary.alignment}`,
        `Roadwardens: ${this.summary.roadwardenStanding}`, ...this.summary.pendingProgression,
      ],
      [
        "REWARDS", ...this.summary.rewards,
        ...(this.summary.optionalBonuses.length ? ["OPTIONAL FEATS", ...this.summary.optionalBonuses] : []),
        "KEYSTONE GUARDIANS", ...this.summary.campaignBosses, "LEGACY", this.summary.epilogueVariant,
      ],
    ];
    const top = title.y + title.displayHeight + 18;
    const rows = columns.map((lines, column) => lines.map((line, index) =>
      this.scene.add.text(column === 0 ? 42 : 338, 0, line, {
        fontFamily: "monospace", fontSize: "11px", color: "#dfe4ff",
        lineSpacing: 2, wordWrap: { width: 260, useAdvancedWrap: true },
      }).setData("layoutId", `ending-summary-${column}-${index}`),
    ));
    const pages = rows.map((column) => paginateMeasuredItems(
      column.map((row) => row.displayHeight), Math.max(1, 414 - top), 6,
    ));
    this.pageCount = Math.max(1, ...pages.map((column) => column.length));
    this.page = Math.min(this.page, this.pageCount - 1);
    if (this.pageCount === 1) this.selectedId = "continue";
    rows.forEach((column, columnIndex) => {
      const visible = new Set(pages[columnIndex]?.[this.page] ?? []);
      let y = top;
      column.forEach((row, index) => {
        if (!visible.has(index)) { row.destroy(); return; }
        row.setY(y);
        this.pageContent.add(row);
        y += row.displayHeight + 6;
      });
    });
    const actions = [
      { id: "previous", label: "< Previous", enabled: this.pageCount > 1 },
      { id: "continue", label: `Continue (${this.page + 1}/${this.pageCount})`, enabled: true },
      { id: "next", label: "Next >", enabled: this.pageCount > 1 },
    ].filter((action) => action.enabled);
    for (const [index, action] of actions.entries()) {
      const button = this.scene.add.text(actions.length === 1 ? 320 : 110 + index * 210, 446, action.label, {
        fontFamily: "monospace", fontSize: "10px",
        color: action.enabled ? "#dfe4ff" : "#90a4ae",
        backgroundColor: this.selectedId === action.id ? "#455a7a" : "#20273a",
        padding: { x: 6, y: 6 },
      }).setOrigin(0.5, 0).setData("layoutId", `ending-summary-${action.id}`);
      if (action.enabled) {
        button.setInteractive({ useHandCursor: true });
        syncInteractiveHitArea(button);
        button.on("pointerdown", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          this.activate(action.id);
        });
      }
      this.pageContent.add(button);
    }
    this.accessibility.update(this.heading, columns.flat(), actions, this.selectedId);
    this.accessibility.announce(`Summary page ${this.page + 1} of ${this.pageCount}.`);
  }

  private activate(id: string): void {
    if (this.disposed) return;
    if (id !== "continue" && this.pageCount === 1) return;
    this.selectedId = id;
    if (id === "previous") this.navigate(-1);
    else if (id === "next") this.navigate(1);
    else if (id === "continue") this.advance();
  }

  private readonly keyDown = (event: KeyboardEvent): void => {
    if (event.key === "Tab") {
      event.preventDefault(); event.stopImmediatePropagation();
      this.accessibility.moveTab(event.shiftKey);
      return;
    }
    if (event.key !== "Enter" && event.key !== " " && event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") this.navigate(event.key === "ArrowLeft" ? -1 : 1);
    else if (!event.repeat) this.heldId = this.selectedId;
  };

  private readonly clearHeld = (): void => { this.heldId = null; };

  private readonly keyUp = (event: KeyboardEvent): void => {
    if ((event.key === "Enter" || event.key === " ") && this.heldId) {
      event.preventDefault(); event.stopImmediatePropagation();
      const id = this.heldId;
      this.heldId = null;
      this.activate(id);
    }
  };
}
