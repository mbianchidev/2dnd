import * as Phaser from "phaser";
import { paginateMeasuredItems } from "../systems/layout";
import { getLayoutTexts, getScaledBounds, getTextContentSize, syncInteractiveHitArea } from "../managers/layout";
import { createOverlayContainer } from "../utils/ui";
import type { LayoutRect } from "../systems/layout";

/** Reflow legacy equipment rows without changing their source-owned callbacks. */
export function layoutEquipmentColumn(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  objects: readonly Phaser.GameObjects.GameObject[],
  id: string,
  viewport: LayoutRect,
  requestedPage: number,
  changePage: (page: number) => void,
): { page: number; count: number } {
  const group = createOverlayContainer(scene, id, 0, viewport);
  group.add([...objects]);
  parent.add(group);
  const rows = getLayoutTexts(objects).filter((text) => text.text.trim().length > 0).map((text, index) => {
    const bounds = getScaledBounds(text);
    const indent = Math.max(0, Math.min(8, bounds.x - viewport.x));
    const width = viewport.width - indent;
    text.setData("accessibilityMaxWidth", null).setScale(1);
    text.setWordWrapWidth(Math.max(1, width - (text.padding.left ?? 0) - (text.padding.right ?? 0) - text.style.strokeThickness), true);
    if (text.style.fixedWidth > 0) {
      text.setFixedSize(Math.min(text.style.fixedWidth, width), 0);
      text.setFixedSize(text.style.fixedWidth, Math.ceil(getTextContentSize(text).height) + 2);
    }
    if (!text.getData("layoutId")) text.setData("layoutId", `${id}-row-${index}`);
    return { text, indent, height: text.displayHeight, interactive: text.input?.enabled === true };
  });
  let pages = paginateMeasuredItems(rows.map((row) => row.height), viewport.height, 6);
  if (pages.length > 1) pages = paginateMeasuredItems(rows.map((row) => row.height), Math.max(0, viewport.height - 40), 6);
  const page = Math.max(0, Math.min(requestedPage, Math.max(0, pages.length - 1)));
  const visible = new Set(pages[page] ?? []);
  let y = viewport.y;
  rows.forEach((row, index) => {
    const show = visible.has(index);
    row.text.setVisible(show).setActive(show);
    if (row.text.input) row.text.input.enabled = show && row.interactive;
    if (!show) return;
    const bounds = getScaledBounds(row.text);
    row.text.setPosition(
      row.text.x + viewport.x + row.indent - bounds.x,
      row.text.y + y - bounds.y,
    );
    syncInteractiveHitArea(row.text);
    y += row.height + 6;
  });
  if (pages.length > 1) {
    for (const direction of [-1, 1] as const) {
      const label = scene.add.text(
        viewport.x + (direction < 0 ? 0 : viewport.width / 2),
        viewport.y + viewport.height - 28,
        direction < 0 ? `‹ ${page + 1}/${pages.length}` : "Next ›",
        {
          fontFamily: "monospace", fontSize: "9px", color: "#b8ddff",
          backgroundColor: "#29324a", padding: { x: 4, y: 4 },
          wordWrap: { width: viewport.width / 2 - 8, useAdvancedWrap: true },
        },
      ).setInteractive({ useHandCursor: true })
        .setData("layoutId", `${id}-page-${direction < 0 ? "previous" : "next"}`);
      label.on("pointerdown", () => changePage((page + direction + pages.length) % pages.length));
      group.add(label);
      syncInteractiveHitArea(label);
    }
  }
  return { page, count: Math.max(1, pages.length) };
}
