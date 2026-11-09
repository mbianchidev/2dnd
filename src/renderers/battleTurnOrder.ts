import * as Phaser from "phaser";
import { getAccessibilityPreferences } from "../systems/accessibility";
import { createBattleTurnOrderView, type BattleTurnOrderEntry } from "../systems/battleTurnOrder";
import type { BattleCombatantState, BattleTurn } from "../systems/groupCombat";
import { layoutResponsiveGrid } from "../systems/layout";
import { getScaledBounds, subscribeOverlayReflow } from "../managers/layout";
import { createOverlayContainer, createPanelGraphics, setOverlayViewport } from "../utils/ui";
import { BATTLE_DEPTH } from "./battleDepth";

/** Read-only upcoming-turn chain; authoritative initiative remains scene-owned. */
export class BattleTurnOrderRenderer {
  private readonly container: Phaser.GameObjects.Container;
  private readonly native: HTMLOListElement;
  private readonly unsubscribe: () => void;
  private entries: readonly BattleTurnOrderEntry[] = [];
  private surprise = false;
  private key = "";
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly enemyPanelBottom: () => number,
  ) {
    this.container = createOverlayContainer(scene, "battle-turn-order", BATTLE_DEPTH.ui);
    this.native = document.createElement("ol");
    this.native.id = "battle-turn-order";
    this.native.setAttribute("aria-label", "Turn order");
    this.native.setAttribute("aria-live", "polite");
    this.native.setAttribute("aria-atomic", "true");
    this.native.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap";
    const host = document.getElementById("game-inner");
    if (!host) throw new Error("[battle-order] Game container is unavailable.");
    host.append(this.native);
    this.unsubscribe = subscribeOverlayReflow(scene, () => this.draw());
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  update(
    initiative: readonly BattleTurn[],
    actors: readonly BattleCombatantState[],
    currentIndex: number,
    remainingSurpriseIds: readonly string[] | undefined,
    finished: boolean,
  ): void {
    if (this.destroyed) return;
    const entries = finished ? [] : createBattleTurnOrderView(initiative, actors, currentIndex, remainingSurpriseIds);
    const key = JSON.stringify([entries, remainingSurpriseIds !== undefined, this.enemyPanelBottom()]);
    if (key === this.key) return;
    this.key = key;
    this.entries = entries;
    this.surprise = remainingSurpriseIds !== undefined;
    this.draw();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unsubscribe();
    this.container.destroy(true);
    this.native.remove();
  }

  private draw(): void {
    if (this.destroyed) return;
    this.container.removeAll(true).setVisible(this.entries.length > 0);
    this.native.replaceChildren();
    this.native.hidden = this.entries.length === 0;
    if (this.entries.length === 0) return;
    const width = this.scene.cameras.main.width;
    const x = width * 0.47;
    const y = this.enemyPanelBottom() + 6;
    const panelWidth = width * 0.51 - 10;
    const contrast = getAccessibilityPreferences().highContrast;
    const active = this.entries.find(({ current }) => current);
    const heading = this.scene.add.text(x + 6, y + 4,
      `${this.surprise ? "Ambush order" : "Turn order"}${active ? ` | Now: ${active.label}` : ""}`, {
      fontSize: "9px", color: contrast ? "#ffffff" : "#c8d8d0",
      wordWrap: { width: panelWidth - 12, useAdvancedWrap: true },
    }).setData("layoutId", "battle-turn-order-heading");
    const labels = this.entries.map((entry) => this.scene.add.text(0, 0,
      entry.actorKind === "hero" ? "Hero" : entry.actorKind === "companion" ? entry.label.split(" ")[0]! : entry.label, {
        fontSize: "8px", color: entry.current ? "#f5dfa4" : contrast ? "#ffffff" : "#cfdbd6",
        fontStyle: entry.current ? "bold" : "normal",
      }).setData("layoutId", `turn-order-${entry.id}`));
    const options = {
      availableWidth: panelWidth - 12, minColumnWidth: (panelWidth - 24) / 4,
      columnGap: 4, rowGap: 4, maxColumns: Math.min(4, this.entries.length),
    };
    const columns = layoutResponsiveGrid({ ...options, itemHeights: labels.map(() => 0) });
    labels.forEach((label, index) => label.setWordWrapWidth(columns.cells[index]!.width - 18, true));
    const grid = layoutResponsiveGrid({ ...options, itemHeights: labels.map((label) => getScaledBounds(label).height + 6) });
    const gridY = y + getScaledBounds(heading).height + 8;
    const panelHeight = gridY - y + grid.height + 4;
    this.container.add([createPanelGraphics(this.scene, x, y, panelWidth, panelHeight, 0.94,
      contrast ? 0xffffff : 0x7d9690), heading]);
    for (const [index, cell] of grid.cells.entries()) {
      const entry = this.entries[index]!;
      const label = labels[index]!;
      const left = x + 6 + cell.x;
      const top = gridY + cell.y;
      const chip = this.scene.add.graphics()
        .fillStyle(entry.current ? 0x34494a : 0x182b31, 0.98).fillRect(left, top, cell.width, cell.height);
      if (entry.current) chip.lineStyle(1, contrast ? 0xffffff : 0xefd594).strokeRect(left, top, cell.width, cell.height)
        .fillStyle(0xefd594).fillTriangle(left + 1, top + 1, left + 5, top + 1, left + 1, top + 5);
      const number = this.scene.add.text(left + 3, top + 3, String(index + 1),
        { fontSize: "7px", color: "#b7c8c3" }).setData("layoutId", `turn-order-rank-${entry.id}`);
      label.setPosition(left + 14, top + 3);
      this.container.add([chip, number, label]);
      const item = document.createElement("li");
      item.dataset.combatantId = entry.id;
      item.dataset.side = entry.side;
      item.textContent = `${entry.current ? "Now: " : ""}${entry.label}`;
      if (entry.current) item.setAttribute("aria-current", "step");
      this.native.append(item);
    }
    setOverlayViewport(this.scene, "battle-turn-order", { x, y, width: panelWidth, height: panelHeight });
  }
}
