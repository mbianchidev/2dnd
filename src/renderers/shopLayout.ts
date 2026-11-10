import * as Phaser from "phaser";
import { getAccessibilityPreferences } from "../systems/accessibility";
import type { LayoutRect } from "../systems/layout";
import { getTextContentSize, subscribeOverlayReflow } from "../managers/layout";
import { bindPointerRelease, createOverlayContainer, paintPanel, setOverlayViewport } from "../utils/ui";
import { UI_COLORS } from "../systems/uiTheme";

export interface ShopLayoutOptions {
  readonly title: string;
  readonly innLabel?: string;
  readonly negotiate: boolean;
  readonly buy: () => void;
  readonly sell: () => void;
  readonly leave: () => void;
  readonly rest: () => void;
  readonly reflow: () => void;
}

/** Measured shop chrome and paged equipment text; it never owns purchases or inventory. */
export class ShopLayoutRenderer {
  readonly gold: Phaser.GameObjects.Text;
  readonly message: Phaser.GameObjects.Text;
  readonly buy: Phaser.GameObjects.Text;
  readonly sell: Phaser.GameObjects.Text;
  readonly negotiate?: Phaser.GameObjects.Text;
  readonly list: Phaser.GameObjects.Container;
  private readonly title: Phaser.GameObjects.Text;
  private readonly heading: Phaser.GameObjects.Text;
  private readonly summary: Phaser.GameObjects.Text;
  private readonly details: Phaser.GameObjects.Text;
  private readonly leave: Phaser.GameObjects.Text;
  private readonly rest?: Phaser.GameObjects.Text;
  private readonly chrome: Phaser.GameObjects.Graphics;
  private readonly container: Phaser.GameObjects.Container;
  private summaryText = "";
  private summaryPage = 0;
  private summaryPages: string[] = [];
  private itemDetails: Phaser.GameObjects.Container | null = null;
  listBounds: LayoutRect = { x: 0, y: 0, width: 1, height: 1 };

  constructor(private readonly scene: Phaser.Scene, options: ShopLayoutOptions) {
    this.container = createOverlayContainer(scene, "shop-chrome", 0, {
      x: 0, y: 0, width: scene.cameras.main.width, height: scene.cameras.main.height,
    });
    this.chrome = scene.add.graphics();
    this.container.add(this.chrome);
    const text = (label: string, size: number, id: string, color = "#e7d7af"): Phaser.GameObjects.Text => {
      const object = scene.add.text(0, 0, label, { fontFamily: "monospace", fontSize: `${size}px`, color })
        .setData("layoutId", id);
      this.container.add(object);
      return object;
    };
    const button = (label: string, id: string, activate: () => void): Phaser.GameObjects.Text => {
      const object = text(label, 12, id).setPadding(8, 4).setBackgroundColor("#334351")
        .setInteractive({ useHandCursor: true });
      bindPointerRelease(object, activate);
      return object;
    };
    this.title = text(options.title, 22, "shop-title").setOrigin(0.5, 0);
    this.gold = text("", 16, "shop-gold").setOrigin(0.5, 0);
    this.heading = text("Your Equipment", 14, "shop-summary-heading");
    this.summary = text("", 12, "shop-summary", "#d4d6cf").setLineSpacing(3);
    this.details = button("Details [Tab]", "shop-details", () => this.nextDetailsPage());
    this.buy = button("Buy", "shop-buy", options.buy);
    this.sell = button("Sell", "shop-sell", options.sell);
    if (options.negotiate) this.negotiate = text("Negotiate", 12, "shop-negotiate")
      .setPadding(8, 4).setBackgroundColor("#334351");
    this.message = text("Welcome! Select an item to purchase.", 12, "shop-message", "#a8d6ab").setOrigin(0.5, 0);
    this.leave = button("Leave [Esc]", "shop-leave", options.leave).setOrigin(1, 0);
    if (options.innLabel) this.rest = button(options.innLabel, "shop-rest", options.rest);
    this.list = createOverlayContainer(scene, "shop-items", 1, this.listBounds);
    const unsubscribe = subscribeOverlayReflow(scene, () => {
      this.reflow();
      options.reflow();
    });
    this.container.once(Phaser.GameObjects.Events.DESTROY, unsubscribe);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.closeItemDetails();
      this.container.destroy(true);
      this.list.destroy(true);
    });
    scene.input.keyboard?.on("keyup-TAB", this.nextDetailsPage);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.input.keyboard?.off("keyup-TAB", this.nextDetailsPage));
    this.reflow();
  }

  setSummary(text: string): void {
    this.summaryText = text;
    this.reflow();
  }

  get hasItemDetails(): boolean { return this.itemDetails !== null; }

  closeItemDetails(): boolean {
    if (!this.itemDetails) return false;
    this.itemDetails.destroy(true);
    this.itemDetails = null;
    return true;
  }

  showItemDetails(name: string, description: string): void {
    this.closeItemDetails();
    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    const panel = createOverlayContainer(this.scene, "shop-item-details", 40, { x: 0, y: 0, width: w, height: h });
    this.itemDetails = panel;
    const background = this.scene.add.graphics().fillStyle(0x000000, 0.8).fillRect(0, 0, w, h)
      .setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    const title = this.scene.add.text(24, 32, name, { fontFamily: "monospace", fontSize: "16px", color: "#e7d7af",
      wordWrap: { width: w - 48 } }).setData("layoutId", "shop-item-details-title");
    const body = this.scene.add.text(24, 0, "", { fontFamily: "monospace", fontSize: "12px", color: "#ffffff",
      wordWrap: { width: w - 48 }, lineSpacing: 3 }).setData("layoutId", "shop-item-details-body");
    let page = 0;
    const button = (label: string, id: string, action: () => void): Phaser.GameObjects.Text => {
      const control = this.scene.add.text(0, 0, label, {
        fontFamily: "monospace", fontSize: "12px", color: "#e7d7af", backgroundColor: "#334351", padding: { x: 8, y: 5 },
      }).setData("layoutId", id).setInteractive({ useHandCursor: true });
      bindPointerRelease(control, action);
      return control;
    };
    const previous = button("Previous", "shop-item-details-previous", () => { page = Math.max(0, page - 1); render(); });
    const next = button("Next", "shop-item-details-next", () => { page++; render(); });
    const close = button("Close [Esc]", "shop-item-details-close", () => this.closeItemDetails()).setOrigin(1, 0);
    panel.add([background, title, body, previous, next, close]);
    const render = (): void => {
      body.setPosition(24, title.y + title.displayHeight + 12);
      const controlY = h - close.displayHeight - 20;
      previous.setPosition(24, controlY);
      next.setPosition(30 + previous.displayWidth, controlY);
      close.setPosition(w - 24, controlY);
      const lineH = getTextContentSize(body, "M").height + body.lineSpacing;
      const perPage = Math.max(1, Math.floor((controlY - body.y - 16) / Math.max(1, lineH)));
      const lines = body.getWrappedText(description);
      const count = Math.max(1, Math.ceil(lines.length / perPage));
      page = Math.min(page, count - 1);
      body.setText(lines.slice(page * perPage, (page + 1) * perPage).join("\n"));
      previous.setVisible(page > 0);
      next.setVisible(page < count - 1);
      if (page > 0) previous.setInteractive({ useHandCursor: true }); else previous.disableInteractive();
      if (page < count - 1) next.setInteractive({ useHandCursor: true }); else next.disableInteractive();
    };
    const unsubscribe = subscribeOverlayReflow(this.scene, render);
    panel.once(Phaser.GameObjects.Events.DESTROY, unsubscribe);
    render();
  }

  readonly nextDetailsPage = (): void => {
    if (this.summaryPages.length <= 1) return;
    this.summaryPage = (this.summaryPage + 1) % this.summaryPages.length;
    this.reflow();
  };

  reflow(): void {
    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    this.title.setWordWrapWidth(w - 24, true).setPosition(w / 2, 8);
    this.gold.setPosition(w / 2, 14 + this.title.displayHeight);
    const top = this.gold.y + this.gold.displayHeight + 12;
    this.message.setWordWrapWidth(w - 24, true);
    const controlH = Math.max(this.leave.displayHeight, this.rest?.displayHeight ?? 0);
    const footerH = this.message.displayHeight + controlH + 22;
    const bottom = h - footerH - 4;
    this.message.setPosition(w / 2, bottom + 8);
    const controlsY = this.message.y + this.message.displayHeight + 6;
    this.leave.setPosition(w - 14, controlsY);
    this.rest?.setPosition(14, controlsY);
    const leftW = Math.floor(w * 0.35);
    const rightX = leftW + 20;
    const rightW = w - rightX - 10;
    this.heading.setPosition(18, top + 8);
    this.summary.setPosition(18, this.heading.y + this.heading.displayHeight + 8).setWordWrapWidth(leftW - 20, true);
    this.details.setPosition(18, bottom - this.details.displayHeight - 8);
    const lineH = getTextContentSize(this.summary, "M").height + this.summary.lineSpacing;
    const lines = this.summary.getWrappedText(this.summaryText);
    const count = Math.max(1, Math.floor((this.details.y - this.summary.y - 6) / Math.max(1, lineH)));
    this.summaryPages = [];
    for (let offset = 0; offset < lines.length; offset += count) this.summaryPages.push(lines.slice(offset, offset + count).join("\n"));
    this.summaryPage = Math.min(this.summaryPage, Math.max(0, this.summaryPages.length - 1));
    this.summary.setText(this.summaryPages[this.summaryPage] ?? "");
    this.details.setText(`Details ${this.summaryPage + 1}/${Math.max(1, this.summaryPages.length)} [Tab]`)
      .setVisible(this.summaryPages.length > 1);
    if (this.summaryPages.length > 1) this.details.setInteractive({ useHandCursor: true });
    else this.details.disableInteractive();
    let x = rightX + 8;
    let y = top + 8;
    let rowH = 0;
    for (const control of [this.buy, this.sell, this.negotiate].filter((object): object is Phaser.GameObjects.Text => object !== undefined)) {
      if (x + control.displayWidth > w - 18 && x > rightX + 8) {
        y += rowH + 6;
        x = rightX + 8;
        rowH = 0;
      }
      control.setPosition(x, y);
      x += control.displayWidth + 6;
      rowH = Math.max(rowH, control.displayHeight);
    }
    this.listBounds = { x: rightX + 8, y: y + rowH + 8, width: rightW - 16, height: Math.max(1, bottom - y - rowH - 16) };
    this.list.setPosition(this.listBounds.x, this.listBounds.y);
    setOverlayViewport(this.scene, "shop-items", this.listBounds);
    const contrast = getAccessibilityPreferences().highContrast;
    this.chrome.clear().fillStyle(contrast ? 0x000000 : UI_COLORS.backdrop, 1).fillRect(0, 0, w, h);
    paintPanel(this.chrome, 10, top, leftW, Math.max(1, bottom - top), 0.94, contrast ? 0xffffff : UI_COLORS.border);
    paintPanel(this.chrome, rightX, top, rightW, Math.max(1, bottom - top), 0.94, contrast ? 0xffffff : UI_COLORS.border);
    this.chrome.lineBetween(0, bottom, w, bottom);
  }
}
