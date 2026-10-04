import * as Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../config";
import { getAccessibilityPreferences } from "../systems/accessibility";
import { isInputAction, isTouchActionAvailable } from "../systems/input";
import { layoutMinigamePanel, paginateMinigameLines } from "../systems/minigameLayout";
import { wrapMeasuredText } from "../systems/layout";
import { syncInteractiveHitArea } from "../managers/layout";
import { createDimGraphics, createOverlayContainer, createPanelGraphics, setOverlayViewport } from "../utils/ui";
import type { MinigameBoard } from "../systems/minigamePresentation";
import type { LayoutRect } from "../systems/layout";

export interface MinigamePanelAction {
  readonly id: string;
  readonly label: string;
  readonly execute: () => void;
  readonly disabled?: boolean;
}

export interface MinigamePanelContent {
  readonly title: string;
  readonly status: string;
  readonly prompt: string;
  readonly paragraphs: readonly string[];
  readonly actions: readonly MinigamePanelAction[];
  readonly selectedId: string;
  readonly page: number;
  readonly board?: MinigameBoard;
  readonly columns?: number;
  readonly onSelect: (id: string) => void;
  readonly onBack: () => void;
  readonly onAim?: (aim: number) => void;
}

const PIPS: Readonly<Record<number, readonly [number, number][]>> = {
  1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1], [2, 2]],
};

const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  B: ["110", "101", "110", "101", "110"],
  F: ["111", "100", "110", "100", "100"],
  "#": ["101", "111", "101", "111", "101"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["110", "001", "010", "100", "111"],
  "3": ["110", "001", "010", "001", "110"],
  "4": ["101", "101", "111", "001", "001"],
};

function drawGlyph(graphics: Phaser.GameObjects.Graphics, glyph: string, x: number, y: number, size: number): void {
  const pattern = GLYPHS[glyph];
  if (!pattern) return;
  const pixel = Math.max(0.5, size / 7);
  pattern.forEach((row, rowIndex) => {
    [...row].forEach((cell, column) => {
      if (cell === "1") graphics.fillRect(x + column * pixel, y + rowIndex * pixel, pixel, pixel);
    });
  });
}

function drawBoard(graphics: Phaser.GameObjects.Graphics, board: MinigameBoard, bounds: LayoutRect): void {
  graphics.clear();
  if (board.kind === "dice") {
    const size = Math.min(88, bounds.height - 12, bounds.width / 3);
    for (let index = 0; index < 2; index += 1) {
      const x = bounds.x + bounds.width / 2 + (index === 0 ? -size - 8 : 8);
      const y = bounds.y + Math.max(0, (bounds.height - size) / 2);
      graphics.fillStyle(0xffffff).fillRoundedRect(x, y, size, size, 5);
      graphics.lineStyle(2, 0x000000).strokeRoundedRect(x, y, size, size, 5);
      graphics.fillStyle(0x000000);
      const face = board.roll?.naturalRolls[index];
      for (const [px, py] of face ? PIPS[face] ?? [] : []) {
        graphics.fillCircle(x + size * (0.25 + px * 0.25), y + size * (0.25 + py * 0.25), Math.max(2, size * 0.05));
      }
      if (!face) graphics.strokeRect(x + size * 0.3, y + size * 0.3, size * 0.4, size * 0.4);
    }
    return;
  }
  if (board.kind === "archery") {
    const left = bounds.x + 14;
    const width = bounds.width - 28;
    const y = bounds.y + bounds.height / 2;
    const target = left + width * board.target / 100;
    const aim = left + width * board.aim / 100;
    graphics.fillStyle(0x18344a).fillRect(left, y - 18, width, 36);
    graphics.lineStyle(2, 0xffffff).strokeRect(left, y - 18, width, 36);
    graphics.fillStyle(0xf3c75f).fillRect(target - 4, y - 25, 8, 50);
    graphics.lineStyle(3, 0xffffff).lineBetween(aim, y - 30, aim, y + 30);
    graphics.fillStyle(0xffffff).fillTriangle(aim - 6, y - 36, aim + 6, y - 36, aim, y - 26);
    for (let index = 0; index <= 10; index += 1) {
      graphics.lineStyle(1, 0xffffff).lineBetween(left + width * index / 10, y + 18, left + width * index / 10, y + 24);
    }
    return;
  }
  const cell = Math.max(1, Math.min(bounds.width / board.width, bounds.height / board.height));
  const x = bounds.x + (bounds.width - cell * board.width) / 2;
  const y = bounds.y + (bounds.height - cell * board.height) / 2;
  for (let row = 0; row < board.height; row += 1) {
    for (let column = 0; column < board.width; column += 1) {
      graphics.fillStyle((row + column) % 2 === 0 ? 0x173b54 : 0x214b66)
        .fillRect(x + column * cell, y + row * cell, cell - 1, cell - 1);
    }
  }
  const mark = (point: { readonly x: number; readonly y: number }, glyph: string, color: number): void => {
    graphics.fillStyle(color);
    drawGlyph(graphics, glyph, x + point.x * cell + cell * 0.28, y + point.y * cell + cell * 0.14, cell);
  };
  for (const obstacle of board.obstacles) mark(obstacle, "#", 0xffffff);
  board.buoys.forEach((buoy, index) => mark(buoy, String(index + 1), index < board.buoyIndex ? 0x99e9c5 : 0xffdf66));
  mark(board.finish, "F", 0xffffff);
  mark(board.position, "B", 0xffffff);
}

export class MinigamePanelRenderer {
  private container: Phaser.GameObjects.Container | null = null;
  private boardGraphics: Phaser.GameObjects.Graphics | null = null;
  private status: Phaser.GameObjects.Text | null = null;
  private boardBounds: LayoutRect | null = null;
  private buttons: Phaser.GameObjects.Text[] = [];
  columns = 3;
  pageCount = 1;
  visibleActions: readonly MinigamePanelAction[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  isOpen(): boolean {
    return this.container !== null;
  }

  hasTouchPad(): boolean {
    return document.getElementById("touch-controls")?.classList.contains("visible") === true;
  }

  private touchBottomReserve(scale: number): number {
    if (!this.hasTouchPad()) return 0;
    const canvas = this.scene.game.canvas.getBoundingClientRect();
    let reserve = 0;
    document.querySelectorAll<HTMLElement>("#touch-controls .touch-control").forEach((button) => {
      const action = button.dataset["action"];
      if (!isInputAction(action) || !isTouchActionAvailable(action, "minigame")) return;
      const bounds = button.getBoundingClientRect();
      if (bounds.right <= canvas.left || bounds.left >= canvas.right || bounds.top >= canvas.bottom || bounds.bottom <= canvas.top) return;
      reserve = Math.max(reserve, (canvas.bottom - Math.max(bounds.top, canvas.top)) / scale + 8);
    });
    return reserve;
  }

  render(content: MinigamePanelContent): void {
    this.clear();
    const canvasScale = Math.max(0.1, this.scene.game.canvas.getBoundingClientRect().width / GAME_WIDTH);
    const reserve = this.touchBottomReserve(canvasScale);
    const container = createOverlayContainer(this.scene, "minigames", 350);
    this.container = container;
    const dim = createDimGraphics(this.scene, GAME_WIDTH, GAME_HEIGHT, 0.82)
      .setInteractive(new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT), Phaser.Geom.Rectangle.Contains);
    dim.on("pointerup", content.onBack);
    container.add(dim);
    const title = this.text("minigame-title", content.title, 15, "#ffe38a");
    const status = this.text("minigame-status", content.status, 12);
    const prompt = this.text("minigame-prompt", content.prompt, 10);
    const probe = this.scene.add.text(0, 0, "", { fontFamily: "monospace", fontSize: "12px" }).setVisible(false);
    const bodyLines = content.paragraphs.flatMap((paragraph) =>
      wrapMeasuredText(paragraph, 568, (value) => probe.context.measureText(value).width));
    const lineHeight = Math.ceil(Number.parseFloat(String(probe.style.fontSize)) * 1.25);
    probe.destroy();
    this.visibleActions = content.actions.filter((action) => !action.disabled);
    const layout = layoutMinigamePanel({
      viewport: { x: 0, y: 0, width: GAME_WIDTH, height: GAME_HEIGHT },
      safeArea: { bottom: reserve },
      titleHeight: title.displayHeight, statusHeight: status.displayHeight,
      promptHeight: prompt.displayHeight, buttonHeight: Math.max(48, Math.ceil(44 / canvasScale)),
      buttonCount: this.visibleActions.length, columns: content.columns ?? 3,
    });
    this.columns = layout.grid.columns;
    setOverlayViewport(this.scene, "minigames", layout.panel);
    const background = createPanelGraphics(this.scene, layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height, 1,
      getAccessibilityPreferences().highContrast ? 0xffffff : 0xffd700);
    background.setInteractive(new Phaser.Geom.Rectangle(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height), Phaser.Geom.Rectangle.Contains);
    container.addAt(background, 1);
    for (const [object, bounds] of [[title, layout.title], [status, layout.status], [prompt, layout.prompt]] as const) {
      object.setPosition(bounds.x, bounds.y);
      container.add(object);
    }
    this.status = status;
    if (content.board) {
      this.boardBounds = layout.body;
      const graphics = this.scene.add.graphics();
      container.add(graphics);
      this.boardGraphics = graphics;
      drawBoard(graphics, content.board, layout.body);
      this.publishBoard(content.board, layout.body);
      if (content.board.kind === "archery" && content.onAim) {
        graphics.setInteractive(new Phaser.Geom.Rectangle(layout.body.x, layout.body.y, layout.body.width, layout.body.height), Phaser.Geom.Rectangle.Contains);
        graphics.on("pointerup", (pointer: Phaser.Input.Pointer) => {
          const aim = Math.round((pointer.x - layout.body.x - 14) / (layout.body.width - 28) * 100);
          content.onAim?.(Math.max(0, Math.min(100, aim)));
        });
      }
      this.pageCount = 1;
    } else {
      const pages = paginateMinigameLines(bodyLines.length, lineHeight, layout.body.height);
      this.pageCount = Math.max(1, pages.length);
      const indices = pages[Math.min(content.page, this.pageCount - 1)] ?? [];
      indices.forEach((lineIndex, row) => {
        const text = this.text(`minigame-body-${lineIndex}`, bodyLines[lineIndex]!, 12);
        text.setPosition(layout.body.x, layout.body.y + row * (lineHeight + 3));
        container.add(text);
      });
    }
    this.buttons = this.visibleActions.map((action, index) => {
      const cell = layout.grid.cells[index]!;
      const button = this.scene.add.text(layout.actions.x + cell.x, layout.actions.y + cell.y, "", {
        fontFamily: "monospace", fontSize: "12px", color: "#ffffff",
        backgroundColor: "#293958", align: "center",
        fixedWidth: cell.width, fixedHeight: cell.height,
        padding: { x: 6, y: Math.max(8, Math.floor((cell.height - 36) / 2)) },
        wordWrap: { width: cell.width - 12 },
      }).setInteractive({ useHandCursor: true });
      button.setData("layoutId", `minigame-${action.id}`);
      button.setData("testId", `minigame-${action.id}`);
      button.on("pointerover", () => content.onSelect(action.id));
      button.on("pointerdown", () => content.onSelect(action.id));
      button.on("pointerup", action.execute);
      syncInteractiveHitArea(button);
      container.add(button);
      return button;
    });
    container.setData("minigamePageCount", this.pageCount);
    container.setData("layoutViewport", layout.panel);
    this.setSelected(content.selectedId);
    this.scene.game.canvas.dataset["minigameBodyPages"] = String(this.pageCount);
  }

  private text(id: string, value: string, size: number, color = "#ffffff"): Phaser.GameObjects.Text {
    return this.scene.add.text(0, 0, value, {
      fontFamily: "monospace", fontSize: `${size}px`, color,
      wordWrap: { width: 568 },
    }).setData("layoutId", id);
  }

  setSelected(id: string): void {
    this.buttons.forEach((button, index) => {
      const action = this.visibleActions[index]!;
      button.setText(`${action.id === id ? "> " : "  "}${action.label}`);
      button.setBackgroundColor(action.id === id ? "#49638f" : "#293958");
      syncInteractiveHitArea(button);
    });
  }

  refreshGame(status: string, board: MinigameBoard): void {
    this.status?.setText(status);
    if (this.boardGraphics && this.boardBounds) {
      drawBoard(this.boardGraphics, board, this.boardBounds);
      this.publishBoard(board, this.boardBounds);
    }
  }

  private publishBoard(board: MinigameBoard, bounds: LayoutRect): void {
    const canvas = this.scene.game.canvas;
    if (board.kind === "archery") {
      canvas.dataset["minigameVisibleAim"] = String(board.aim);
      canvas.dataset["minigameTarget"] = String(board.target);
      canvas.dataset["minigameMeter"] = JSON.stringify({
        x: bounds.x + 14, y: bounds.y + bounds.height / 2,
        width: bounds.width - 28, height: 36,
      });
    }
  }

  clear(): void {
    this.container?.destroy(true);
    this.container = null;
    this.status = null;
    this.boardGraphics = null;
    this.boardBounds = null;
    this.buttons = [];
    this.visibleActions = [];
    delete this.scene.game.canvas.dataset["minigameBodyPages"];
    delete this.scene.game.canvas.dataset["minigameVisibleAim"];
    delete this.scene.game.canvas.dataset["minigameTarget"];
    delete this.scene.game.canvas.dataset["minigameMeter"];
  }
}
