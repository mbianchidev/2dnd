import * as Phaser from "phaser";
import { layoutResponsiveGrid, paginateMeasuredItems } from "../systems/layout";
import { syncInteractiveHitArea } from "../managers/layout";
import { calcPanelLayout, createDimGraphics, createOverlayContainer, createPanelGraphics } from "../utils/ui";

interface SaveSlotPanelRow {
  id: string;
  text: string;
  color: string;
  selected: boolean;
}

interface SaveSlotPanelAction {
  id: string;
  label: string;
  color: string;
  selected: boolean;
  activate(): void;
}

export interface SaveSlotPanelContent {
  title: string;
  instruction: string;
  rows: readonly SaveSlotPanelRow[];
  selectedRow: number;
  actions: readonly SaveSlotPanelAction[];
  status: string;
  statusColor: string;
  hint: string;
  confirmation: boolean;
  pageLabel?: string;
  onBack(): void;
  onSelectRow(index: number): void;
}

/** Measure every text surface before allocating rows and the action/footer stack. */
export function renderSaveSlotPanel(
  scene: Phaser.Scene,
  content: SaveSlotPanelContent,
): Phaser.GameObjects.Container {
  const { w, h, px, py, panelW, panelH } = calcPanelLayout(
    scene, content.confirmation ? 460 : 600, content.confirmation ? 264 : 490,
  );
  const container = createOverlayContainer(scene, "save-slots", 96, {
    x: px, y: py, width: panelW, height: panelH,
  });
  const dim = createDimGraphics(scene, w, h, 0.78)
    .setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
  dim.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    if (pointer.x < px || pointer.x > px + panelW || pointer.y < py || pointer.y > py + panelH) {
      content.onBack();
    }
  });
  container.add([dim, createPanelGraphics(scene, px, py, panelW, panelH)]);
  const x = px + 22;
  const width = panelW - 44;
  const text = (id: string, value: string, size: number, color: string): Phaser.GameObjects.Text => {
    const label = scene.add.text(x, 0, value, {
      fontFamily: "monospace", fontSize: `${size}px`, color,
      wordWrap: { width }, lineSpacing: 2,
    }).setData("layoutId", id);
    container.add(label);
    return label;
  };
  const title = text("save-slots-title", content.title, content.confirmation ? 18 : 16, "#ffd700");
  title.setPosition(px + panelW / 2, py + 12).setOrigin(0.5, 0);
  const instruction = text("save-slots-instruction", content.instruction, content.confirmation ? 12 : 9, "#90a4ae");
  instruction.setPosition(px + panelW / 2, title.y + title.displayHeight + 8).setOrigin(0.5, 0);
  instruction.setAlign("center");
  const hint = text("save-slots-hint", content.hint, 8, "#78909c");
  hint.setAlign("center").setOrigin(0.5, 0);
  hint.setPosition(px + panelW / 2, py + panelH - 12 - hint.displayHeight);
  const status = text("save-slots-status", content.status, 9, content.statusColor);
  status.setAlign("center").setOrigin(0.5, 0);
  status.setPosition(px + panelW / 2, hint.y - 8 - status.displayHeight);

  const actionColumns = content.confirmation ? 2
    : Math.min(5, content.actions.length, Math.max(1, Math.floor((width + 6) / 94)));
  const cellWidth = (width - 6 * (actionColumns - 1)) / actionColumns;
  const actions = content.actions.map((action) => {
    const button = scene.add.text(0, 0, `${action.selected ? "▶ " : ""}${action.label}`, {
      fontFamily: "monospace", fontSize: content.confirmation ? "14px" : "10px",
      color: action.color, backgroundColor: action.selected ? "#455a7a" : "#2a2a4e",
      align: "center", padding: { x: 5, y: 6 },
      fixedWidth: cellWidth, wordWrap: { width: cellWidth - 10 },
    }).setInteractive({ useHandCursor: true });
    button.setData("layoutId", `save-slot-action-${action.id}`);
    button.setData("testId", `save-slot-action-${action.id}`);
    button.on("pointerover", () => button.setColor("#ffffff"));
    button.on("pointerout", () => button.setColor(action.color));
    button.on("pointerdown", action.activate);
    return button;
  });
  const actionHeight = Math.max(content.confirmation ? 60 : 36, ...actions.map((button) => Math.ceil(button.displayHeight) + 2));
  const grid = layoutResponsiveGrid({
    availableWidth: width, minColumnWidth: content.confirmation ? 160 : 88,
    columnGap: 6, rowGap: 6, maxColumns: actionColumns,
    itemHeights: actions.map(() => actionHeight),
  });
  const actionY = status.y - 10 - grid.height;
  actions.forEach((button, index) => {
    const cell = grid.cells[index]!;
    button.setFixedSize(cell.width, actionHeight);
    button.setPosition(x + cell.x, actionY + cell.y);
    syncInteractiveHitArea(button);
    container.add(button);
  });
  if (content.confirmation) return container;

  const rowY = instruction.y + instruction.displayHeight + 12;
  const rows = content.rows.map((row, index) => {
    const label = scene.add.text(x, 0, row.text, {
      fontFamily: "monospace", fontSize: "10px", color: row.color,
      backgroundColor: row.selected ? "#38435f" : "#20273a",
      padding: { x: 8, y: 5 }, lineSpacing: 2,
      fixedWidth: width, wordWrap: { width: width - 16 },
    }).setInteractive({ useHandCursor: true });
    label.setFixedSize(width, Math.max(54, Math.ceil(label.displayHeight) + 2));
    label.setData("layoutId", `save-slot-row-${row.id}`);
    label.setData("testId", `save-slot-${row.id}`);
    label.on("pointerover", () => label.setColor("#ffffff"));
    label.on("pointerout", () => label.setColor(row.color));
    label.on("pointerdown", () => content.onSelectRow(index));
    return label;
  });
  const available = Math.max(0, actionY - 12 - rowY);
  let pages = paginateMeasuredItems(rows.map((row) => row.displayHeight), available, 6);
  const paged = pages.length > 1;
  if (paged) pages = paginateMeasuredItems(rows.map((row) => row.displayHeight), Math.max(0, available - 42), 6);
  const pageIndex = Math.max(0, pages.findIndex((page) => page.includes(content.selectedRow)));
  const visible = new Set(pages[pageIndex] ?? []);
  let cursor = rowY;
  rows.forEach((row, index) => {
    if (!visible.has(index)) {
      row.destroy();
      return;
    }
    row.setY(cursor);
    cursor += row.displayHeight + 6;
    syncInteractiveHitArea(row);
    container.add(row);
  });
  if (paged) {
    const pagerY = actionY - 44;
    const pager = (direction: -1 | 1, label: string, offset: number): void => {
      const button = scene.add.text(x + offset, pagerY, label, {
        fontFamily: "monospace", fontSize: "10px", color: "#b8ddff",
        backgroundColor: "#29324a", padding: { x: 8, y: 5 },
        wordWrap: { width: width / 2 - 20 },
      }).setInteractive({ useHandCursor: true })
        .setData("layoutId", direction < 0 ? "save-slot-page-previous" : "save-slot-page-next");
      button.on("pointerdown", () => {
        const destination = (pageIndex + direction + pages.length) % pages.length;
        const selected = pages[destination]?.[0];
        if (selected !== undefined) content.onSelectRow(selected);
      });
      syncInteractiveHitArea(button);
      container.add(button);
    };
    const pageLabel = content.pageLabel ?? "Slots";
    pager(-1, `‹ ${pageLabel} ${pageIndex + 1}/${pages.length}`, 0);
    pager(1, `More ${pageLabel.toLowerCase()} ›`, width / 2);
  }
  return container;
}
