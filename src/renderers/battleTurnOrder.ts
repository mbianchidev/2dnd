import * as Phaser from "phaser";
import { getAccessibilityPreferences } from "../systems/accessibility";
import { createBattleTurnOrderView, type BattleTurnOrderEntry } from "../systems/battleTurnOrder";
import type { BattleCombatantState, BattleTurn } from "../systems/groupCombat";
import type { PortraitVisual } from "../systems/portraitArt";
import { BATTLE_SIDEBAR_WIDTH, clampRectToViewport } from "../systems/layout";
import { getScaledBounds, subscribeOverlayReflow } from "../managers/layout";
import { createOverlayContainer, setOverlayViewport } from "../utils/ui";
import { acquirePortraitTexture, getPortraitTextureKey } from "./portraitTextures";
import type { HeroTextureLease } from "./heroTextures";
import { BATTLE_DEPTH } from "./battleDepth";

interface TimelineIcon {
  readonly image: Phaser.GameObjects.Image;
  readonly letter: Phaser.GameObjects.Text;
  readonly native: HTMLLIElement;
  lease: HeroTextureLease;
}

/** A thin initiative thread of canonical portraits, independent from combat scheduling. */
export class BattleTurnOrderRenderer {
  private readonly container: Phaser.GameObjects.Container;
  private readonly thread: Phaser.GameObjects.Graphics;
  private readonly tooltip: Phaser.GameObjects.Text;
  private readonly native: HTMLOListElement;
  private readonly unsubscribe: () => void;
  private readonly icons = new Map<string, TimelineIcon>();
  private entries: readonly BattleTurnOrderEntry[] = [];
  private hovered: string | null = null;
  private key = "";
  private destroyed = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly resolvePortrait: (id: string) => PortraitVisual,
    private readonly portraitRevision: () => number,
  ) {
    this.container = createOverlayContainer(scene, "battle-turn-order", BATTLE_DEPTH.ui);
    this.thread = scene.add.graphics();
    this.tooltip = scene.add.text(0, 0, "", {
      fontSize: "9px", color: "#f5e8bd", backgroundColor: "#14262c", padding: { x: 6, y: 3 },
      wordWrap: { width: scene.cameras.main.width - BATTLE_SIDEBAR_WIDTH - 80 },
    }).setOrigin(0.5, 0).setVisible(false).setData("layoutId", "battle-turn-order-name");
    this.container.add([this.thread, this.tooltip]);
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
    const key = JSON.stringify([entries, remainingSurpriseIds !== undefined, this.portraitRevision()]);
    if (key === this.key) return;
    this.key = key;
    this.entries = entries;
    this.native.setAttribute("aria-label", remainingSurpriseIds === undefined ? "Turn order" : "Ambush turn order");
    this.draw();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unsubscribe();
    this.container.destroy(true);
    for (const icon of this.icons.values()) icon.lease.release();
    this.icons.clear();
    this.native.remove();
  }

  private draw(): void {
    if (this.destroyed) return;
    const ids = new Set(this.entries.map(({ id }) => id));
    for (const [id, icon] of this.icons) {
      if (ids.has(id)) continue;
      icon.image.destroy();
      icon.letter.destroy();
      icon.native.remove();
      icon.lease.release();
      this.icons.delete(id);
    }
    this.container.setVisible(this.entries.length > 0);
    this.native.hidden = this.entries.length === 0;
    this.thread.clear();
    const arenaWidth = this.scene.cameras.main.width - BATTLE_SIDEBAR_WIDTH;
    const step = 35;
    const left = arenaWidth / 2 - (this.entries.length - 1) * step / 2 + 20;
    const y = 24;
    const contrast = getAccessibilityPreferences().highContrast;
    if (this.entries.length > 1) this.thread.lineStyle(1, contrast ? 0xffffff : 0xb69b64, 0.8)
      .lineBetween(left, y, left + (this.entries.length - 1) * step, y);
    const nativeItems: HTMLLIElement[] = [];
    this.entries.forEach((entry, index) => {
      const visual = this.resolvePortrait(entry.id);
      const key = getPortraitTextureKey(visual);
      let icon = this.icons.get(entry.id);
      if (!icon) {
        const lease = acquirePortraitTexture(this.scene, visual);
        const image = this.scene.add.image(0, 0, lease.key).setInteractive()
          .setData("layoutId", `turn-order-${entry.id}`);
        const letter = this.scene.add.text(0, 0, "", {
          fontSize: "7px", color: "#ffffff", backgroundColor: "#14262c", padding: { x: 2, y: 0 },
        }).setOrigin(1, 1).setData("layoutId", `turn-order-letter-${entry.id}`);
        image.setData("layoutAllowOverlapWith", [`turn-order-letter-${entry.id}`]);
        letter.setData("layoutAllowOverlapWith", [`turn-order-${entry.id}`]);
        image.on("pointerover", () => { this.hovered = entry.id; this.drawTooltip(); });
        image.on("pointerout", () => { if (this.hovered === entry.id) this.hovered = null; this.drawTooltip(); });
        const native = document.createElement("li");
        native.dataset.combatantId = entry.id;
        native.dataset.side = entry.side;
        icon = { image, letter, lease, native };
        this.icons.set(entry.id, icon);
        this.container.add([image, letter]);
      } else if (icon.lease.key !== key) {
        const lease = acquirePortraitTexture(this.scene, visual);
        icon.image.setTexture(lease.key);
        icon.lease.release();
        icon.lease = lease;
      }
      const x = left + index * step;
      const size = entry.current ? 30 : 22;
      this.thread.fillStyle(0x14262c, 0.9).fillCircle(x, y, size / 2 + 2)
        .lineStyle(entry.current ? 2 : 1, entry.current || contrast ? 0xefdb9f : 0x708d89)
        .strokeCircle(x, y, size / 2 + 2);
      if (entry.current) this.thread.fillStyle(0xefdb9f).fillTriangle(x - 3, 3, x + 3, 3, x, 7);
      icon.image.setPosition(x, y).setDisplaySize(size, size);
      icon.image.setData("layoutBounds", getScaledBounds(icon.image));
      const letter = entry.actorKind === "monster" ? entry.label.match(/ ([A-D])$/)?.[1] ?? "" : "";
      icon.letter.setText(letter).setPosition(x + size / 2 + 2, y + size / 2 + 3).setVisible(letter.length > 0);
      icon.native.textContent = `${entry.current ? "Now: " : ""}${entry.label}`;
      if (entry.current) icon.native.setAttribute("aria-current", "step");
      else icon.native.removeAttribute("aria-current");
      nativeItems.push(icon.native);
    });
    this.native.replaceChildren(...nativeItems);
    this.drawTooltip();
    this.container.bringToTop(this.tooltip);
    setOverlayViewport(this.scene, "battle-turn-order", { x: 60, y: 0, width: arenaWidth - 45, height: 104 });
  }

  private drawTooltip(): void {
    const entry = this.entries.find(({ id }) => id === this.hovered);
    const icon = entry ? this.icons.get(entry.id) : undefined;
    this.tooltip.setVisible(Boolean(entry && icon));
    if (entry && icon) {
      this.tooltip.setText(entry.label).setPosition(icon.image.x, 46);
      const before = getScaledBounds(this.tooltip);
      const after = clampRectToViewport(before,
        { x: 60, y: 44, width: this.scene.cameras.main.width - BATTLE_SIDEBAR_WIDTH - 45, height: 60 });
      this.tooltip.setX(this.tooltip.x + after.x - before.x);
    }
  }
}
