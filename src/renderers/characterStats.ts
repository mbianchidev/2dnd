import * as Phaser from "phaser";
import { layoutVerticalStack } from "../systems/layout";
import { syncInteractiveHitArea } from "../managers/layout";
import { createOverlayContainer } from "../utils/ui";
import type { PlayerStats } from "../systems/player";

export interface CharacterStatRow {
  id: keyof PlayerStats;
  label: string;
  value: string;
  boost: string;
  modifier: string;
  cost: string;
  selected: boolean;
  primary: boolean;
  canDecrease: boolean;
  canIncrease: boolean;
  decrease(): void;
  increase(): void;
}

export interface CharacterStatsContent {
  classLabel: string;
  mode: "pointbuy" | "random";
  points: string;
  summary: string;
  nextEnabled: boolean;
  rows: readonly CharacterStatRow[];
  changeMode(mode: "pointbuy" | "random"): void;
  reroll(): void;
  next(): void;
  back(): void;
}

/** Allocate columns and vertical sections from the actual scaled stat labels. */
export function renderCharacterStatsPanel(
  scene: Phaser.Scene,
  content: CharacterStatsContent,
): Phaser.GameObjects.Container {
  const camera = scene.cameras.main;
  const width = camera.width - 32;
  const centerX = camera.width / 2;
  const container = createOverlayContainer(scene, "character-stats", 0, {
    x: 8, y: 8, width: camera.width - 16, height: camera.height - 16,
  });
  const text = (id: string, value: string, size: number, color: string): Phaser.GameObjects.Text => {
    const label = scene.add.text(0, 0, value, {
      fontFamily: "monospace", fontSize: `${size}px`, color,
      wordWrap: { width, useAdvancedWrap: true }, lineSpacing: 2,
    }).setData("layoutId", id);
    container.add(label);
    return label;
  };
  const button = (
    id: string, value: string, size: number, color: string, action: () => void, enabled = true,
  ): Phaser.GameObjects.Text => {
    const label = text(id, value, size, enabled ? color : "#555555").setPadding(4, 2);
    if (enabled) {
      label.setBackgroundColor("#20273a").setInteractive({ useHandCursor: true });
      label.on("pointerdown", action);
    }
    return label;
  };
  const title = text("creation-stats-title", "Allocate Stats", 22, "#ffd700").setOrigin(0.5, 0);
  const classLabel = text("creation-stats-class", content.classLabel, 11, "#b0bec5").setOrigin(0.5, 0);
  const modeButtons = [
    button("creation-stat-mode-pointbuy", "[ Point Buy ]", 13, content.mode === "pointbuy" ? "#ffd700" : "#b0bec5",
      () => content.changeMode("pointbuy")).setOrigin(0.5, 0),
    button("creation-stat-mode-random", "[ 🎲 Random ]", 13, content.mode === "random" ? "#ffd700" : "#b0bec5",
      () => content.changeMode("random")).setOrigin(0.5, 0),
  ];
  const modeHeight = Math.max(...modeButtons.map((label) => label.displayHeight));
  const budget = (content.mode === "pointbuy"
    ? text("creation-stat-budget", content.points, 13, content.nextEnabled ? "#88ff88" : "#ffd700")
    : button("creation-stat-reroll", "[ 🎲 Re-Roll ]", 14, "#aaddff", content.reroll)).setOrigin(0.5, 0);
  const rows = content.rows.map((row) => {
    const cells = [
      text(`creation-stat-${row.id}-label`, `${row.selected ? ">" : " "} ${row.primary ? "★ " : ""}${row.label}:`, 14,
        row.selected ? "#ffffff" : row.primary ? "#ffd700" : "#c0a060"),
      text(`creation-stat-${row.id}-value`, row.value, 14, "#ffffff"),
      text(`creation-stat-${row.id}-boost`, row.boost, 11, "#88ff88"),
      text(`creation-stat-${row.id}-modifier`, row.modifier, 13, "#b0bec5"),
    ];
    if (content.mode === "pointbuy") cells.push(
      button(`creation-stat-${row.id}-minus`, "[-]", 16, "#ff8888", row.decrease, row.canDecrease),
      button(`creation-stat-${row.id}-plus`, "[+]", 16, "#88ff88", row.increase, row.canIncrease),
      text(`creation-stat-${row.id}-cost`, row.cost, 9, "#90a4ae"),
    );
    return { cells, height: Math.max(30, ...cells.map((cell) => cell.displayHeight)) };
  });
  const columnCount = Math.max(0, ...rows.map((row) => row.cells.length));
  const columns = Array.from({ length: columnCount }, (_value, index) =>
    Math.max(0, ...rows.map((row) => row.cells[index]?.displayWidth ?? 0))
  );
  const tableWidth = columns.reduce((sum, value) => sum + value, 0) + Math.max(0, columnCount - 1) * 10;
  const rowLayout = layoutVerticalStack(rows.map((row, index) => ({
    id: String(index), width: tableWidth, height: row.height,
  })), { gap: 5 });
  const summary = text("creation-stats-summary", content.summary, 11, "#b0bec5")
    .setAlign("center").setOrigin(0.5, 0);
  const footer = [
    button("creation-stats-back", "[ < Back ]", 16, "#b0bec5", content.back).setOrigin(0.5, 0),
    button("creation-stats-next", "[ Next > ]", 18, "#88ff88", content.next, content.nextEnabled).setOrigin(0.5, 0),
  ];
  footer[1]!.setColor("#88ff88").setAlpha(content.nextEnabled ? 1 : 0.4);
  const footerHeight = Math.max(...footer.map((label) => label.displayHeight));
  const sectionHeights = [
    title.displayHeight, classLabel.displayHeight, modeHeight,
    budget.displayHeight, rowLayout.height, summary.displayHeight, footerHeight,
  ];
  const total = sectionHeights.reduce((sum, value) => sum + value, 0) + 6 * 6;
  const sections = layoutVerticalStack(sectionHeights.map((height, index) => ({
    id: String(index), width, height,
  })), { y: Math.max(8, Math.floor((camera.height - total) / 2)), gap: 6 });
  title.setPosition(centerX, sections.items[0]!.y);
  classLabel.setPosition(centerX, sections.items[1]!.y);
  modeButtons.forEach((label, index) => {
    label.setPosition(centerX + (index === 0 ? -width / 4 : width / 4), sections.items[2]!.y);
    syncInteractiveHitArea(label);
  });
  budget.setPosition(centerX, sections.items[3]!.y);
  syncInteractiveHitArea(budget);
  rows.forEach(({ cells, height }, index) => {
    let x = centerX - tableWidth / 2;
    const y = sections.items[4]!.y + rowLayout.items[index]!.y;
    cells.forEach((label, column) => {
      label.setPosition(x, y + (height - label.displayHeight) / 2);
      syncInteractiveHitArea(label);
      x += columns[column]! + 10;
    });
  });
  summary.setPosition(centerX, sections.items[5]!.y);
  footer.forEach((label, index) => {
    label.setPosition(centerX + (index === 0 ? -width / 4 : width / 4), sections.items[6]!.y);
    syncInteractiveHitArea(label);
  });
  return container;
}
