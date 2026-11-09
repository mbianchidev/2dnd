import * as Phaser from "phaser";
import type { PlayerState } from "../systems/player";
import {
  getChunk, getCity, getCityChunk, getDungeon, getDungeonLevelMap, getChestAt, Terrain,
} from "../data/map";
import { getAccessibilityPreferences } from "../systems/accessibility";
import { layoutVerticalStack } from "../systems/layout";
import { createMinimapPlan, getMinimapBounds, type MinimapMarker } from "../systems/minimap";
import { getScaledBounds, subscribeOverlayReflow } from "../managers/layout";
import { createOverlayContainer } from "../utils/ui";
import { isLocalDev } from "../config";

/** Keep event-driven messages separate from location prompts and the persistent minimap. */
export function layoutHudMessages(
  scene: Phaser.Scene, background: Phaser.GameObjects.Graphics,
  message: Phaser.GameObjects.Text, location: Phaser.GameObjects.Text,
): void {
  const width = scene.cameras.main.width;
  const height = scene.cameras.main.height;
  const texts = [message, location].filter((text) => text.active && text.alpha > 0 && text.text.trim().length > 0);
  texts.forEach((text) => text.setWordWrapWidth(width - 24 - text.style.strokeThickness, true));
  const stack = layoutVerticalStack(texts.map((text, index) => ({
    id: String(index), width: text.displayWidth, height: text.displayHeight,
  })), { x: 12, width: width - 24, gap: 6, align: "center" });
  const top = Math.max(0, height - stack.height - 16);
  stack.items.forEach((item, index) => {
    const text = texts[index]!;
    const bounds = getScaledBounds(text);
    text.setPosition(text.x + item.x - bounds.x, text.y + top + 8 + item.y - bounds.y);
  });
  background.clear().fillStyle(0x202c37, 0.95).fillRect(0, top, width, height - top);
  background.lineStyle(2, 0xc4ad7c, 1).strokeRect(1, top + 1, width - 2, height - top - 2);
}

export class HUDRenderer {
  private group: Phaser.GameObjects.Container | null = null;
  private graphics: Phaser.GameObjects.Graphics | null = null;
  private title: Phaser.GameObjects.Text | null = null;
  private summary: HTMLElement | null = null;
  private player: PlayerState | null = null;
  private isExplored: ((x: number, y: number) => boolean) | null = null;
  private bosses: ReadonlySet<string> = new Set();
  private lastKey = "";
  private visible = false;
  private dataset = "";

  constructor(private readonly scene: Phaser.Scene) {}

  createHUD(): void {
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.clear());
    this.group = createOverlayContainer(this.scene, "exploration-minimap", 19, {
      x: 0, y: 0, width: this.scene.cameras.main.width, height: this.scene.cameras.main.height,
    }).setVisible(false);
    this.graphics = this.scene.add.graphics();
    this.title = this.scene.add.text(0, 0, "MINIMAP", {
      fontFamily: "monospace", fontSize: "9px", color: "#e7d7af",
    }).setOrigin(0.5, 0).setData("layoutId", "minimap-caption");
    this.group.add([this.graphics, this.title]);
    this.summary = document.createElement("div");
    this.summary.id = "exploration-minimap-summary";
    this.summary.setAttribute("role", "img");
    this.summary.hidden = true;
    this.summary.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap";
    const host = document.getElementById("game-inner");
    if (!host) throw new Error("[minimap] Game container is unavailable.");
    host.append(this.summary);
    const unsubscribe = subscribeOverlayReflow(this.scene, () => this.redraw());
    this.group.once(Phaser.GameObjects.Events.DESTROY, unsubscribe);
  }

  updateHUD(player: PlayerState, isExplored: (x: number, y: number) => boolean, defeatedBosses: ReadonlySet<string>): void {
    this.player = player;
    this.isExplored = isExplored;
    this.bosses = defeatedBosses;
    this.redraw();
  }

  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    this.group?.setVisible(visible);
    if (this.summary) this.summary.hidden = !visible;
  }

  private redraw(): void {
    const player = this.player;
    if (!player || !this.isExplored || !this.graphics || !this.title) return;
    const position = player.position;
    const city = position.inCity ? getCity(position.cityId) : undefined;
    const room = city ? getCityChunk(city, position.cityChunkIndex) : undefined;
    const dungeon = position.inDungeon ? getDungeon(position.dungeonId) : undefined;
    const chunk = !position.inCity && !position.inDungeon ? getChunk(position.chunkX, position.chunkY) : undefined;
    const map = room?.mapData ?? (dungeon ? getDungeonLevelMap(dungeon, position.dungeonLevel) : chunk?.mapData);
    if (!map) throw new Error("[minimap] The current location has no canonical map.");
    const markers = new Map<string, MinimapMarker | undefined>();
    for (const prop of room?.interior?.props ?? []) {
      if (prop.reward && !player.progression.collectedTreasures.includes(prop.id)) {
        markers.set(`${prop.x},${prop.y}`, prop.kind === "book" ? "book" : "supplies");
      }
    }
    for (const boss of chunk?.bosses ?? []) if (this.bosses.has(boss.monsterId)) markers.set(`${boss.x},${boss.y}`, undefined);
    for (let y = Math.max(0, position.y - 5); y <= Math.min(map.length - 1, position.y + 5); y++) {
      for (let x = Math.max(0, position.x - 5); x <= Math.min(map[y]!.length - 1, position.x + 5); x++) {
        if (map[y]![x] !== Terrain.Chest) continue;
        const location = position.inDungeon
          ? { type: "dungeon" as const, dungeonId: position.dungeonId, dungeonLevel: position.dungeonLevel }
          : { type: "overworld" as const, chunkX: position.chunkX, chunkY: position.chunkY };
        const chest = getChestAt(x, y, location);
        if (chest && player.progression.openedChests.includes(chest.id)) markers.set(`${x},${y}`, undefined);
      }
    }
    const plan = createMinimapPlan(map, position.x, position.y, this.isExplored, markers);
    const bounds = getMinimapBounds({ x: 0, y: 0, width: this.scene.cameras.main.width,
      height: this.scene.cameras.main.height }, position.x, position.y);
    const contrast = getAccessibilityPreferences().highContrast;
    const key = JSON.stringify([plan, bounds, contrast]);
    if (key === this.lastKey) return;
    this.lastKey = key;
    const graphics = this.graphics.clear();
    const cx = bounds.x + bounds.width / 2;
    const radius = Math.min(41, (bounds.height - 33) / 2, (bounds.width - 10) / 2);
    const cy = bounds.y + bounds.height * 0.59;
    const cellSize = radius / 5.85;
    graphics.fillStyle(contrast ? 0x000000 : 0x25353d, 0.92).fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 6);
    graphics.lineStyle(1, contrast ? 0xffffff : 0xc4ad7c).strokeRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 6);
    graphics.fillStyle(0x202d34).fillCircle(cx, cy, radius - 1);
    for (const cell of plan.cells) {
      const x = cx + cell.dx * cellSize - cellSize / 2;
      const y = cy + cell.dy * cellSize - cellSize / 2;
      graphics.fillStyle(contrast && cell.explored ? 0xbfc5bb : cell.color).fillRect(x, y, cellSize, cellSize);
      if (cell.marker) {
        const color = cell.marker === "boss" ? 0xdd8b7b : cell.marker === "book" ? 0xbdc9df : 0xf1d49a;
        graphics.lineStyle(1, contrast ? 0xffffff : color).strokeRect(x + 1, y + 1, 5, 5);
        if (cell.marker === "treasure" || cell.marker === "supplies") {
          graphics.fillStyle(color).fillRect(x + 2, y + 3, 3, 1).fillRect(x + 3, y + 2, 1, 3);
        } else if (cell.marker === "stairs") {
          graphics.fillStyle(color).fillRect(x + 2, y + 2, 3, 1).fillRect(x + 3, y + 3, 2, 1).fillRect(x + 4, y + 4, 1, 1);
        }
      }
    }
    graphics.lineStyle(2, contrast ? 0xffffff : 0xc4ad7c).strokeCircle(cx, cy, radius);
    graphics.fillStyle(0x202c37).fillTriangle(cx, cy - 6, cx - 5, cy + 5, cx + 5, cy + 5);
    graphics.fillStyle(0xffffff).fillTriangle(cx, cy - 4, cx - 3, cy + 3, cx + 3, cy + 3);
    graphics.fillStyle(0xe7d7af).fillRect(cx - 1, bounds.y + 23, 2, 4);
    this.title.setPosition(cx, bounds.y + 6);
    if (this.summary) this.summary.setAttribute("aria-label", plan.description);
    if (isLocalDev()) {
      this.dataset = JSON.stringify({ bounds, cells: plan.cells.length, explored: plan.cells.filter((cell) => cell.explored).length });
      this.scene.game.canvas.dataset.explorationMinimap = this.dataset;
    }
  }

  clear(): void {
    this.group?.destroy(true);
    this.group = null;
    this.graphics = null;
    this.title = null;
    this.summary?.remove();
    this.summary = null;
    if (this.scene.game.canvas.dataset.explorationMinimap === this.dataset) delete this.scene.game.canvas.dataset.explorationMinimap;
  }
}
