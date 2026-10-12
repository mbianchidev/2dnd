import * as Phaser from "phaser";
import { paginateMeasuredItems } from "../systems/layout";
import { createOverlayContainer, setOverlayViewport } from "../utils/ui";
import { BATTLE_DEPTH } from "../renderers/battleDepth";
import { syncInteractiveHitArea } from "./layout";

export interface BattleMenuEntry {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  activate(): void;
}

export interface BattleActionMenuOptions {
  kind: "spell" | "ability" | "body";
  entries: readonly BattleMenuEntry[];
  page: number;
  onPageChange(page: number): void;
  title?: string;
  footer?: string;
  selectedId?: string;
  onSelect?(id: string): void;
}

/** Shared measured spell/ability rows preserve readable descriptions at every text scale. */
export function createBattleActionMenu(
  scene: Phaser.Scene,
  options: BattleActionMenuOptions,
): { container: Phaser.GameObjects.Container; page: number; pages: string[][] } {
  const width = 260;
  const textWidth = width - 10;
  const name = scene.add.text(0, 0, "", {
    fontSize: "12px", fontFamily: "monospace", wordWrap: { width: textWidth },
  }).setVisible(false);
  const description = scene.add.text(0, 0, "", {
    fontSize: "9px", fontFamily: "monospace", wordWrap: { width: textWidth },
  }).setVisible(false);
  const heights = options.entries.map((entry) => {
    const prefix = options.kind === "body" ? entry.id === options.selectedId ? "> " : "  " : "";
    name.setText(`${prefix}${entry.enabled ? "" : "[X] "}${entry.label}`);
    description.setText(entry.description);
    return name.displayHeight + description.displayHeight + 10;
  });
  const titleHeight = options.title ? name.setText(options.title).displayHeight + 8 : 0;
  const footerHeight = options.footer ? description.setText(options.footer).displayHeight + 8 : 0;
  name.destroy();
  description.destroy();
  const bottom = scene.cameras.main.height * 0.78 - 10;
  const pages = paginateMeasuredItems(heights, Math.max(1, bottom - 50 - titleHeight - footerHeight), 0, 5);
  const page = Math.max(0, Math.min(options.page, pages.length - 1));
  const groupId = `battle-${options.kind}-menu`;
  const container = createOverlayContainer(scene, groupId, BATTLE_DEPTH.uiOverlay);
  const background = scene.add.graphics();
  container.add(background);
  if (options.title) container.add(scene.add.text(0, 0, options.title, {
    fontSize: "12px", fontFamily: "monospace", color: "#ffd700",
    wordWrap: { width: textWidth },
  }).setData("layoutId", `${groupId}-title`));
  let y = titleHeight;
  for (const index of pages[page] ?? []) {
    const entry = options.entries[index]!;
    const color = entry.enabled ? "#dde7f4" : "#b0bec5";
    const prefix = options.kind === "body" ? entry.id === options.selectedId ? "> " : "  " : "";
    const text = scene.add.text(0, y, `${prefix}${entry.enabled ? "" : "[X] "}${entry.label}`, {
      fontSize: "12px", fontFamily: "monospace", color,
      wordWrap: { width: textWidth },
    }).setData("layoutId", `battle-${options.kind}-${entry.id}`);
    const details = scene.add.text(0, y + text.displayHeight + 2, entry.description, {
      fontSize: "9px", fontFamily: "monospace", color: "#b0bec5",
      wordWrap: { width: textWidth },
    }).setData("layoutId", `battle-${options.kind}-${entry.id}-description`);
    if (entry.enabled) {
      text.setInteractive({ useHandCursor: true });
      syncInteractiveHitArea(text);
      text.on("pointerdown", entry.activate);
      text.on("pointerover", () => text.setColor("#ffd700"));
      text.on("pointerover", () => options.onSelect?.(entry.id));
      text.on("pointerout", () => text.setColor(color));
    }
    container.add([text, details]);
    y += heights[index]!;
  }
  if (pages.length > 1) {
    const previous = scene.add.text(10, y, "< Prev", {
      fontSize: "10px", fontFamily: "monospace", color: page > 0 ? "#dde7f4" : "#b0bec5",
    }).setData("layoutId", `battle-${options.kind}-previous`);
    const next = scene.add.text(190, y, "Next >", {
      fontSize: "10px", fontFamily: "monospace", color: page < pages.length - 1 ? "#dde7f4" : "#b0bec5",
    }).setData("layoutId", `battle-${options.kind}-next`);
    const label = scene.add.text(125, y, `${page + 1}/${pages.length}`, {
      fontSize: "10px", fontFamily: "monospace", color: "#dde7f4",
    }).setOrigin(0.5, 0).setData("layoutId", `battle-${options.kind}-page`);
    if (page > 0) previous.setInteractive({ useHandCursor: true })
      .on("pointerdown", () => options.onPageChange(page - 1));
    if (page < pages.length - 1) next.setInteractive({ useHandCursor: true })
      .on("pointerdown", () => options.onPageChange(page + 1));
    container.add([previous, label, next]);
    y += Math.max(previous.displayHeight, label.displayHeight, next.displayHeight) + 6;
  }
  if (options.footer) {
    container.add(scene.add.text(0, y, options.footer, {
      fontSize: "9px", fontFamily: "monospace", color: "#dde7f4",
      wordWrap: { width: textWidth },
    }).setData("layoutId", `${groupId}-footer`));
    y += footerHeight;
  }
  const height = y + 6;
  const x = options.kind === "body" ? 12
    : Math.min(scene.cameras.main.width - width - 6, scene.cameras.main.width * 0.52);
  const top = Math.max(6, bottom - height);
  container.setPosition(x, top);
  background.fillStyle(0x1a1a3e, 0.97).fillRect(-5, -5, width, height + 5);
  background.lineStyle(1, 0xc0a060, 1).strokeRect(-5, -5, width, height + 5);
  setOverlayViewport(scene, groupId, { x: x - 5, y: top - 5, width, height: height + 5 });
  return { container, page, pages: pages.map((indices) => indices.map((index) => options.entries[index]!.id)) };
}
