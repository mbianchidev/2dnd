import * as Phaser from "phaser";
import { getTextContentSize, subscribeOverlayReflow, syncInteractiveHitArea, updateLayoutGroupViewport } from "../managers/layout";
import { paginateMeasuredItems } from "../systems/layout";
import { createDimGraphics, createOverlayContainer, createPanelGraphics } from "../utils/ui";
import type { EscapeMenuEntry } from "../systems/featureDiscovery";

/** Lay out menu rows from wrapped captions, paging without leaving hidden hit targets. */
export function renderEscapeMenu(
  scene: Phaser.Scene,
  entries: readonly EscapeMenuEntry[],
  callbacks: {
    selected(): number;
    select(index: number): void;
    activate(entry: EscapeMenuEntry): void;
    close(): void;
  },
): {
  container: Phaser.GameObjects.Container;
  buttons: Phaser.GameObjects.Text[];
  reflow(): void;
} {
  const camera = scene.cameras.main;
  const panelWidth = Math.min(520, camera.width - 16);
  const panelX = Math.floor((camera.width - panelWidth) / 2);
  const contentWidth = panelWidth - 40;
  const columns = 2;
  const cellWidth = (contentWidth - 12) / columns;
  const container = createOverlayContainer(scene, "escape-menu", 70);
  const dim = createDimGraphics(scene, camera.width, camera.height).setInteractive(
    new Phaser.Geom.Rectangle(0, 0, camera.width, camera.height), Phaser.Geom.Rectangle.Contains,
  );
  dim.on("pointerdown", callbacks.close);
  const background = createPanelGraphics(scene, 0, 0, 1, 1);
  const title = scene.add.text(0, 0, "⚙ Menu", {
    fontFamily: "monospace", fontSize: "16px", color: "#ffd700",
  }).setOrigin(0.5, 0).setData("layoutId", "escape-menu-title");
  const hint = scene.add.text(0, 0, "Press ESC to close", {
    fontFamily: "monospace", fontSize: "10px", color: "#999999",
  }).setOrigin(0.5, 1).setData("layoutId", "escape-menu-hint");
  container.add([dim, background, title, hint]);
  const buttons = entries.map((entry, index) => {
    const button = scene.add.text(0, 0, entry.label, {
      fontFamily: "monospace", fontSize: "13px", color: entry.color,
      backgroundColor: "#2a2a4e", padding: { x: 10, y: 6 }, align: "center",
      fixedWidth: cellWidth, wordWrap: { width: cellWidth - 22, useAdvancedWrap: true },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    button.setData("testId", entry.testId).setData("layoutId", `escape-menu-${entry.action}`);
    button.on("pointerover", () => callbacks.select(index));
    button.on("pointerdown", () => callbacks.activate(entry));
    container.add(button);
    return button;
  });
  let pages: number[][] = [];
  let page = 0;
  const pageButton = (direction: -1 | 1): Phaser.GameObjects.Text => {
    const button = scene.add.text(0, 0, direction < 0 ? "‹ Previous" : "More ›", {
      fontFamily: "monospace", fontSize: "10px", color: "#b8ddff",
      backgroundColor: "#29324a", padding: { x: 8, y: 5 },
    }).setInteractive({ useHandCursor: true })
      .setData("layoutId", `escape-menu-page-${direction < 0 ? "previous" : "next"}`);
    button.on("pointerdown", () => {
      const destination = (page + direction + pages.length) % pages.length;
      const row = pages[destination]?.[0];
      if (row !== undefined) callbacks.select(row * columns);
    });
    container.add(button);
    return button;
  };
  const previous = pageButton(-1);
  const next = pageButton(1);
  const reflow = (): void => {
    buttons.forEach((button) => button.setFixedSize(cellWidth, 0));
    const heights = buttons.map((button) => Math.max(44, Math.ceil(getTextContentSize(button).height)));
    const rowHeights = Array.from({ length: Math.ceil(entries.length / columns) }, (_value, index) =>
      Math.max(...heights.slice(index * columns, (index + 1) * columns))
    );
    const headerHeight = title.displayHeight + 28;
    const footerHeight = hint.displayHeight + 24;
    const naturalHeight = rowHeights.reduce((sum, height) => sum + height, 0)
      + Math.max(0, rowHeights.length - 1) * 4;
    const panelHeight = Math.min(camera.height - 16, naturalHeight + headerHeight + footerHeight);
    const panelY = Math.floor((camera.height - panelHeight) / 2);
    const pagerHeight = Math.max(previous.displayHeight, next.displayHeight) + 10;
    const available = panelHeight - headerHeight - footerHeight;
    pages = paginateMeasuredItems(rowHeights, available, 4);
    if (pages.length > 1) pages = paginateMeasuredItems(rowHeights, Math.max(0, available - pagerHeight), 4);
    page = Math.max(0, pages.findIndex((rows) => rows.includes(Math.floor(callbacks.selected() / columns))));
    const visibleRows = new Set(pages[page] ?? []);
    let cursor = panelY + headerHeight;
    buttons.forEach((button, index) => {
      const row = Math.floor(index / columns);
      const visible = visibleRows.has(row);
      button.setVisible(visible).setActive(visible);
      if (button.input) button.input.enabled = visible;
      if (!visible) return;
      button.setFixedSize(cellWidth, rowHeights[row]!)
        .setPosition(panelX + 20 + index % columns * (cellWidth + 12) + cellWidth / 2, cursor);
      syncInteractiveHitArea(button);
      if (index % columns === columns - 1 || index === buttons.length - 1) cursor += rowHeights[row]! + 4;
    });
    title.setPosition(camera.width / 2, panelY + 14);
    hint.setPosition(camera.width / 2, panelY + panelHeight - 10);
    for (const [button, x] of [[previous, panelX + 20], [next, panelX + panelWidth - 20 - next.displayWidth]] as const) {
      button.setPosition(x, panelY + panelHeight - footerHeight - pagerHeight + 4);
      button.setVisible(pages.length > 1).setActive(pages.length > 1);
      if (button.input) button.input.enabled = pages.length > 1;
      syncInteractiveHitArea(button);
    }
    background.clear().fillStyle(0x1a1a2e, 0.98).fillRect(panelX, panelY, panelWidth, panelHeight)
      .lineStyle(2, 0xc0a060, 1).strokeRect(panelX, panelY, panelWidth, panelHeight);
    updateLayoutGroupViewport(scene, "escape-menu", { x: panelX, y: panelY, width: panelWidth, height: panelHeight });
  };
  const unsubscribe = subscribeOverlayReflow(scene, reflow);
  container.once(Phaser.GameObjects.Events.DESTROY, unsubscribe);
  reflow();
  return { container, buttons, reflow };
}
