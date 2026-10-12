import * as Phaser from "phaser";
import { getTextContentSize, syncInteractiveHitArea } from "../managers/layout";
import { layoutResponsiveGrid, paginateMeasuredItems } from "../systems/layout";
import { createItemVisual } from "./itemVisuals";
import type { Item } from "../data/items";

interface InventoryPanelAction {
  id: string;
  label: string;
  color: string;
  activate(): void;
}

interface InventoryPanelRow {
  id: string;
  label: string;
  item: Item;
  selected: boolean;
  activate(): void;
}

export interface PartyInventoryContent {
  heading: string;
  controls: readonly InventoryPanelAction[];
  search: InventoryPanelAction;
  clearSearch(): void;
  rows: readonly InventoryPanelRow[];
  selectedPosition: number;
  detail: string;
  detailColor: string;
  actions: readonly InventoryPanelAction[];
}

/** Render only complete measured inventory rows, preserving canonical item identities. */
export function renderPartyInventory(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  viewport: { x: number; y: number; width: number; height: number },
  content: PartyInventoryContent,
): number[][] {
  const { x, y, width, height } = viewport;
  const addText = (id: string, value: string, size: number, color: string, maxWidth = width): Phaser.GameObjects.Text => {
    const label = scene.add.text(0, 0, value, {
      fontFamily: "monospace", fontSize: `${size}px`, color, lineSpacing: 2,
      wordWrap: { width: maxWidth, useAdvancedWrap: true },
    }).setData("layoutId", id);
    container.add(label);
    return label;
  };
  const button = (action: InventoryPanelAction, buttonWidth: number): Phaser.GameObjects.Text => {
    const label = scene.add.text(0, 0, action.label, {
      fontFamily: "monospace", fontSize: "10px", color: action.color,
      backgroundColor: "#29324a", padding: { x: 5, y: 5 }, lineSpacing: 2,
      fixedWidth: buttonWidth, wordWrap: { width: buttonWidth - 12, useAdvancedWrap: true },
      align: "center",
    }).setInteractive({ useHandCursor: true }).setData("layoutId", action.id);
    label.on("pointerover", () => label.setColor("#ffd700"));
    label.on("pointerout", () => label.setColor(action.color));
    label.on("pointerdown", action.activate);
    container.add(label);
    return label;
  };
  const heading = addText("party-inventory-heading", content.heading, 13, "#ffd700");
  heading.setPosition(x, y);
  const controlWidth = (width - 6 * Math.max(0, content.controls.length - 1)) / content.controls.length;
  const controls = content.controls.map((action) => button(action, controlWidth));
  const controlHeight = Math.max(30, ...controls.map((label) => Math.ceil(label.displayHeight)));
  const controlY = y + heading.displayHeight + 6;
  controls.forEach((label, index) => {
    label.setFixedSize(controlWidth, controlHeight).setPosition(x + index * (controlWidth + 6), controlY);
    syncInteractiveHitArea(label);
  });
  const search = button(content.search, width - 40);
  const clear = button({
    id: "party-inventory-clear-search", label: "X", color: "#ffaaaa", activate: content.clearSearch,
  }, 34);
  const searchY = controlY + controlHeight + 6;
  search.setPosition(x, searchY);
  clear.setPosition(x + width - 34, searchY);
  const searchHeight = Math.max(search.displayHeight, clear.displayHeight);
  syncInteractiveHitArea(search);
  syncInteractiveHitArea(clear);

  const actionColumns = Math.min(4, Math.max(1, Math.floor((width + 6) / 86)));
  const actionWidth = (width - 6 * (actionColumns - 1)) / actionColumns;
  const actions = content.actions.map((action) => button(action, actionWidth));
  const actionHeight = Math.max(32, ...actions.map((label) => Math.ceil(label.displayHeight)));
  const actionGrid = layoutResponsiveGrid({
    availableWidth: width, minColumnWidth: actionWidth, columnGap: 6, rowGap: 6,
    maxColumns: actionColumns, itemHeights: actions.map(() => actionHeight),
  });
  const actionY = y + height - actionGrid.height;
  actions.forEach((label, index) => {
    const cell = actionGrid.cells[index]!;
    label.setFixedSize(cell.width, cell.height).setPosition(x + cell.x, actionY + cell.y);
    syncInteractiveHitArea(label);
  });
  const detail = addText("party-inventory-detail", content.detail, 9, content.detailColor);
  detail.setPosition(x, actionY - 8 - detail.displayHeight);
  const pageLabel = addText("party-inventory-page", "Page 1/1", 8, "#b0bec5");
  const pageY = detail.y - 8 - pageLabel.displayHeight;
  const rowY = searchY + searchHeight + 8;
  const probe = scene.add.text(0, 0, "", {
    fontFamily: "monospace", fontSize: "10px", padding: { left: 30, right: 6, top: 5, bottom: 5 },
    wordWrap: { width: width - 38, useAdvancedWrap: true }, lineSpacing: 2,
  });
  const rowHeights = content.rows.map((row) => Math.max(30, Math.ceil(getTextContentSize(probe, row.label).height) + 2));
  probe.destroy();
  const pages = paginateMeasuredItems(rowHeights, Math.max(0, pageY - 6 - rowY), 6, 6);
  const currentPage = Math.max(0, pages.findIndex((indices) => indices.includes(content.selectedPosition)));
  const visible = new Set(pages[currentPage] ?? []);
  let cursor = rowY;
  content.rows.forEach((row, index) => {
    if (!visible.has(index)) return;
    const label = scene.add.text(x, cursor, row.label, {
      fontFamily: "monospace", fontSize: "10px", color: row.selected ? "#ffd700" : "#dddddd",
      backgroundColor: "#29324a", padding: { left: 30, right: 6, top: 5, bottom: 5 }, lineSpacing: 2,
      fixedWidth: width, fixedHeight: rowHeights[index],
      wordWrap: { width: width - 38, useAdvancedWrap: true },
    }).setInteractive({ useHandCursor: true }).setData("layoutId", row.id);
    label.on("pointerdown", row.activate);
    container.add(label);
    syncInteractiveHitArea(label);
    container.add(createItemVisual(scene, row.item, x + 4, cursor + 4, 22));
    cursor += rowHeights[index]! + 6;
  });
  if (content.rows.length === 0) {
    addText("party-inventory-empty", "No items match the current view.", 10, "#999999").setPosition(x, rowY);
  }
  pageLabel.setText(`Page ${currentPage + 1}/${Math.max(1, pages.length)}`).setPosition(x, pageY);
  return pages;
}
