import * as Phaser from "phaser";
import { layoutResponsiveGrid, paginateMeasuredItems } from "../systems/layout";
import { getTextContentSize, syncInteractiveHitArea } from "../managers/layout";
import { calcPanelLayout, createDimGraphics, createOverlayContainer, createPanelGraphics } from "../utils/ui";

interface AchievementPanelAction {
  id: string;
  label: string;
  color: string;
  activate(): void;
}

interface AchievementPanelRow {
  id: string;
  heading: string;
  detail: string;
  progress: string;
  ratio: number;
  color: string;
  selected: boolean;
  earned: boolean;
  select(): void;
}

export interface AchievementPanelContent {
  summary: string;
  title: string;
  controls: readonly AchievementPanelAction[];
  rows: readonly AchievementPanelRow[];
  selectedIndex: number;
  detail: string;
  detailColor: string;
  titleActions: readonly AchievementPanelAction[];
  close(): void;
  previousPage(): void;
  nextPage(): void;
}

export interface AchievementPanelResult {
  container: Phaser.GameObjects.Container;
  pages: number[][];
}

/** Keep headings, wrapped controls, progress bars and details in measured sections. */
export function renderAchievementPanel(
  scene: Phaser.Scene,
  content: AchievementPanelContent,
): AchievementPanelResult {
  const { w, h, px, py, panelW, panelH } = calcPanelLayout(scene, 624, 512);
  const container = createOverlayContainer(scene, "achievements", 95, {
    x: px, y: py, width: panelW, height: panelH,
  });
  const dim = createDimGraphics(scene, w, h, 0.76)
    .setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
  dim.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    if (pointer.x < px || pointer.x > px + panelW || pointer.y < py || pointer.y > py + panelH) {
      content.close();
    }
  });
  container.add([dim, createPanelGraphics(scene, px, py, panelW, panelH, 0.98, 0xc0a060)]);
  const x = px + 12;
  const width = panelW - 24;
  const text = (id: string, value: string, size: number, color: string, maxWidth = width): Phaser.GameObjects.Text => {
    const label = scene.add.text(0, 0, value, {
      fontFamily: "monospace", fontSize: `${size}px`, color,
      wordWrap: { width: maxWidth, useAdvancedWrap: true }, lineSpacing: 2,
    }).setData("layoutId", id);
    container.add(label);
    return label;
  };
  const button = (action: AchievementPanelAction, maxWidth: number): Phaser.GameObjects.Text => {
    const label = scene.add.text(0, 0, action.label, {
      fontFamily: "monospace", fontSize: "10px", color: action.color,
      backgroundColor: "#29324a", padding: { x: 6, y: 6 },
      fixedWidth: maxWidth, wordWrap: { width: maxWidth - 12, useAdvancedWrap: true },
      lineSpacing: 2,
    }).setData("layoutId", action.id).setInteractive({ useHandCursor: true });
    label.on("pointerover", () => label.setColor("#ffd700"));
    label.on("pointerout", () => label.setColor(action.color));
    label.on("pointerdown", action.activate);
    container.add(label);
    return label;
  };
  const close = button({
    id: "achievement-close", label: "Close", color: "#ffaaaa", activate: content.close,
  }, 78);
  const summary = text("achievement-summary", content.summary, 15, "#ffd700", width - 90);
  summary.setPosition(x, py + 12);
  close.setPosition(x + width - close.displayWidth, summary.y);
  const title = text("achievement-title", `Title: ${content.title || "None"}`, 10, content.title ? "#9fe8ff" : "#999999");
  title.setPosition(x, py + 12 + Math.max(summary.displayHeight, close.displayHeight) + 8);

  const controlWidth = (width - 18) / 4;
  const controls = content.controls.map((action) => button(action, controlWidth));
  const controlHeight = Math.max(36, ...controls.map((label) => Math.ceil(label.displayHeight) + 2));
  const controlY = title.y + title.displayHeight + 12;
  controls.forEach((label, index) => {
    label.setFixedSize(controlWidth, controlHeight).setPosition(x + index * (controlWidth + 6), controlY);
    syncInteractiveHitArea(label);
  });
  syncInteractiveHitArea(close);

  const hint = text("achievement-hint", "Up/Down select  Left/Right page  / search  Enter equip  Esc close", 8, "#999999");
  hint.setPosition(x, py + panelH - 12 - hint.displayHeight);
  const footerActions: AchievementPanelAction[] = [
    { id: "achievement-page-previous", label: "‹ Previous", color: "#b8ddff", activate: content.previousPage },
    { id: "achievement-page-next", label: "Next ›", color: "#b8ddff", activate: content.nextPage },
    ...content.titleActions,
  ];
  const footerWidth = (width - (footerActions.length - 1) * 6) / footerActions.length;
  const footer = footerActions.map((action) => button(action, footerWidth));
  const footerHeight = Math.max(36, ...footer.map((label) => Math.ceil(label.displayHeight) + 2));
  const footerGrid = layoutResponsiveGrid({
    availableWidth: width, minColumnWidth: footerWidth, maxColumns: footer.length,
    columnGap: 6, rowGap: 6, itemHeights: footer.map(() => footerHeight),
  });
  const footerY = hint.y - 10 - footerGrid.height;
  footer.forEach((label, index) => {
    const cell = footerGrid.cells[index]!;
    label.setFixedSize(cell.width, footerHeight).setPosition(x + cell.x, footerY + cell.y);
    syncInteractiveHitArea(label);
  });
  const detail = text("achievement-detail", content.detail, 9, content.detailColor);
  const detailHeight = Math.max(detail.displayHeight, ...content.rows.map((row) => getTextContentSize(detail, row.detail).height));
  detail.setPosition(x, footerY - 10 - detailHeight);
  const pageLabel = text("achievement-page", "", 9, "#bbbbbb");
  const pageHeight = pageLabel.displayHeight;
  const rowY = controlY + controlHeight + 12;
  const rowBottom = detail.y - 12 - pageHeight - 6;
  const headingProbe = scene.add.text(0, 0, "", {
    fontFamily: "monospace", fontSize: "10px", padding: { x: 6, y: 6 },
    wordWrap: { width: width - 12, useAdvancedWrap: true }, lineSpacing: 2,
  });
  const progressProbe = scene.add.text(0, 0, "", {
    fontFamily: "monospace", fontSize: "8px",
    wordWrap: { width: 126, useAdvancedWrap: true }, lineSpacing: 2,
  });
  const rows = content.rows.map((row) => {
    const headingHeight = Math.max(32, Math.ceil(getTextContentSize(headingProbe, row.heading).height) + 2);
    const progressHeight = Math.max(8, getTextContentSize(progressProbe, row.progress).height);
    return { row, headingHeight, height: headingHeight + 6 + progressHeight + 6 };
  });
  headingProbe.destroy();
  progressProbe.destroy();
  const pages = paginateMeasuredItems(rows.map((row) => row.height), Math.max(0, rowBottom - rowY), 6);
  const pageIndex = Math.max(0, pages.findIndex((page) => page.includes(content.selectedIndex)));
  const visible = new Set(pages[pageIndex] ?? []);
  let cursor = rowY;
  rows.forEach(({ row, headingHeight, height }, index) => {
    if (!visible.has(index)) return;
    const heading = button({
      id: `achievement-row-${row.id}`, label: row.heading, color: row.color, activate: row.select,
    }, width).setFixedSize(width, headingHeight);
    const progress = text(`achievement-progress-${row.id}`, row.progress, 8, "#bbbbbb", 126);
    heading.setPosition(x, cursor);
    syncInteractiveHitArea(heading);
    const progressY = cursor + heading.displayHeight + 6;
    const barWidth = width - 150;
    progress.setPosition(x + barWidth + 18, progressY);
    const barY = progressY + Math.max(0, (progress.displayHeight - 8) / 2);
    const bar = scene.add.graphics();
    bar.fillStyle(0x22263a, 1).fillRect(x + 8, barY, barWidth, 8);
    bar.fillStyle(row.earned ? 0x66cc88 : 0x5b8bd9, 1)
      .fillRect(x + 8, barY, Math.round(barWidth * Math.max(0, Math.min(1, row.ratio))), 8);
    bar.lineStyle(1, row.selected ? 0xffd700 : 0x8792aa, 1).strokeRect(x + 8, barY, barWidth, 8);
    bar.setData("layoutId", `achievement-bar-${row.id}`);
    bar.setData("layoutBounds", { x: x + 7.5, y: barY - 0.5, width: barWidth + 1, height: 9 });
    container.add(bar);
    cursor += height + 6;
  });
  if (rows.length === 0) {
    const empty = text("achievement-empty", "No achievements match this view.", 11, "#999999");
    empty.setPosition(x, rowY);
  }
  pageLabel.setText(`Page ${pageIndex + 1}/${Math.max(1, pages.length)}`).setPosition(x, detail.y - 12 - pageHeight);
  return { container, pages };
}
