import * as Phaser from "phaser";
import type { BattleHudActionId } from "../systems/battleHud";
import { getAccessibilityPreferences } from "../systems/accessibility";
import { layoutResponsiveGrid } from "../systems/layout";
import { getScaledBounds, placeBattleDecisionPanel, subscribeOverlayReflow } from "../managers/layout";
import { createOverlayContainer, createPanelGraphics, setOverlayViewport } from "../utils/ui";
import { getBattleActionIconKey } from "./battleHud";
import { BATTLE_DEPTH } from "./battleDepth";

export interface BattleCommand {
  readonly id: BattleHudActionId;
  readonly label: string;
  activate(): void;
}

interface CommandRow {
  readonly command: BattleCommand;
  readonly container: Phaser.GameObjects.Container;
  readonly hit: Phaser.GameObjects.Zone;
  readonly text: Phaser.GameObjects.Text;
  readonly icon: Phaser.GameObjects.Image;
  readonly state: Phaser.GameObjects.Graphics;
}

/** One quiet command folio, present only while its controlled actor can decide. */
export class BattleCommandRenderer {
  private readonly container: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly rows: CommandRow[] = [];
  private readonly unsubscribe: () => void;
  private visible = false;
  private selected = 0;
  private destroyed = false;

  constructor(private readonly scene: Phaser.Scene, commands: readonly BattleCommand[], private readonly select: (index: number) => void) {
    this.container = createOverlayContainer(scene, "battle-commands", BATTLE_DEPTH.ui);
    this.background = createPanelGraphics(scene, 0, 0, 1, 1);
    this.container.add(this.background);
    commands.forEach((command, index) => {
      const container = scene.add.container(0, 0);
      const state = scene.add.graphics();
      const hit = scene.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      const icon = scene.add.image(0, 0, getBattleActionIconKey(command.id)).setDisplaySize(16, 16)
        .setData("layoutId", `battle-action-${command.id}-icon`);
      const text = scene.add.text(0, 0, command.label, { fontSize: "12px", color: "#f1e9cf" })
        .setData("layoutId", `battle-action-${command.id}`);
      hit.on("pointermove", () => { if (this.visible) this.select(index); });
      hit.on("pointerdown", () => { if (this.visible) { this.select(index); command.activate(); } });
      container.add([state, hit, icon, text]);
      this.container.add(container);
      this.rows.push({ command, container, hit, icon, text, state });
    });
    this.unsubscribe = subscribeOverlayReflow(scene, () => this.reflow());
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.reflow();
    this.setState(false, 0);
  }

  get count(): number { return this.rows.length; }

  setState(visible: boolean, selected: number): void {
    if (this.destroyed) return;
    this.visible = visible;
    this.selected = selected;
    this.container.setVisible(visible);
    for (const row of this.rows) if (row.hit.input) row.hit.input.enabled = visible;
    this.paintSelection();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unsubscribe();
    this.container.destroy(true);
  }

  private reflow(): void {
    if (this.destroyed) return;
    const width = 282;
    const labelHeight = Math.max(18, ...this.rows.map(({ text }) => getScaledBounds(text).height));
    const grid = layoutResponsiveGrid({
      availableWidth: width - 20, minColumnWidth: 120, maxColumns: 2,
      columnGap: 6, rowGap: 3, itemHeights: this.rows.map(() => labelHeight + 8),
    });
    const height = grid.height + 16;
    const { x, y } = placeBattleDecisionPanel(this.scene, {
      x: 12, y: this.scene.cameras.main.height - height - 12, width, height,
    });
    this.container.setPosition(x, y);
    this.background.clear().fillStyle(0x14262c, getAccessibilityPreferences().highContrast ? 1 : 0.93)
      .fillRect(0, 0, width, height).lineStyle(1, 0xc6aa69, 0.9).strokeRect(0, 0, width, height);
    grid.cells.forEach((cell, index) => {
      const row = this.rows[index]!;
      row.container.setPosition(10 + cell.x, 8 + cell.y);
      row.hit.setSize(cell.width, cell.height);
      const hitArea: unknown = row.hit.input?.hitArea;
      if (hitArea instanceof Phaser.Geom.Rectangle) hitArea.setSize(cell.width, cell.height);
      row.icon.setPosition(13, cell.height / 2);
      row.text.setPosition(29, (cell.height - row.text.displayHeight) / 2);
      const iconBounds = getScaledBounds(row.icon);
      row.icon.setData("layoutBounds", iconBounds);
      row.container.setData("commandWidth", cell.width).setData("commandHeight", cell.height);
    });
    setOverlayViewport(this.scene, "battle-commands", { x, y, width, height });
    this.paintSelection();
  }

  private paintSelection(): void {
    const contrast = getAccessibilityPreferences().highContrast;
    this.rows.forEach((row, index) => {
      const selected = this.visible && index === this.selected;
      row.state.clear();
      row.text.setColor(selected ? "#f5dda1" : contrast ? "#ffffff" : "#f1e9cf");
      if (!selected) return;
      const width: unknown = row.container.getData("commandWidth");
      const height: unknown = row.container.getData("commandHeight");
      if (typeof width !== "number" || typeof height !== "number") return;
      row.state.fillStyle(0x3b514d, 0.8).fillRect(0, 0, width, height)
        .fillStyle(0xefdb9f).fillTriangle(1, height / 2 - 3, 1, height / 2 + 3, 5, height / 2);
    });
  }
}
