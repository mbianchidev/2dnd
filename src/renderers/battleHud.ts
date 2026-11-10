import * as Phaser from "phaser";
import {
  BATTLE_HUD_ACTION_IDS, createBattleActionIcon, getBattleHudPalette, getBattleResourceRatio,
  type BattleHudActionId, type BattleHudAlly, type BattleHudEnemy, type BattleHudResource,
} from "../systems/battleHud";
import { gamePreferences, getAccessibilityPreferences } from "../systems/accessibility";
import { inputPromptSource } from "../systems/input";
import {
  BATTLE_SIDEBAR_WIDTH, BATTLE_VITALS_WIDTH, clampRectToViewport, layoutVerticalStack, type LayoutRect,
} from "../systems/layout";
import type { PortraitVisual } from "../systems/portraitArt";
import { getScaledBounds, subscribeOverlayReflow, syncInteractiveHitArea } from "../managers/layout";
import { createOverlayContainer, setOverlayViewport } from "../utils/ui";
import { createPixelTexture } from "./pixelTexture";
import { acquirePortraitTexture, getPortraitTextureKey } from "./portraitTextures";
import type { HeroTextureLease } from "./heroTextures";
import { BATTLE_DEPTH } from "./battleDepth";

type ResourceKind = "HP" | "MP";

interface HudBar {
  readonly graphic: Phaser.GameObjects.Graphics;
  readonly text: Phaser.GameObjects.Text;
  readonly meter: HTMLMeterElement;
  value: BattleHudResource;
}

interface HudRow {
  readonly container: Phaser.GameObjects.Container;
  readonly title: Phaser.GameObjects.Text;
  readonly outline: Phaser.GameObjects.Graphics;
  readonly native: HTMLElement;
  readonly nativeTitle: HTMLElement;
  readonly nativeDetails: HTMLElement;
  readonly bars: Map<ResourceKind, HudBar>;
  portrait?: Phaser.GameObjects.Image;
  knockoutBadge?: Phaser.GameObjects.Graphics;
  lease?: HeroTextureLease;
}

export function getBattleActionIconKey(action: BattleHudActionId): string {
  return `battle-action-icon-${action}`;
}

export function generateBattleHudTextures(scene: Phaser.Scene): void {
  for (const action of BATTLE_HUD_ACTION_IDS) {
    createPixelTexture(scene, getBattleActionIconKey(action), createBattleActionIcon(action));
  }
}

/** Portrait party cards and a single knowledge-gated target tooltip, never an enemy dashboard. */
export class BattleHudRenderer {
  private partyGroup: Phaser.GameObjects.Container | null = null;
  private enemyGroup: Phaser.GameObjects.Container | null = null;
  private background: Phaser.GameObjects.Graphics | null = null;
  private toggle: Phaser.GameObjects.Text | null = null;
  private native: HTMLElement | null = null;
  private nativeToggle: HTMLButtonElement | null = null;
  private targets: HTMLElement | null = null;
  private readonly partyRows = new Map<string, HudRow>();
  private readonly enemyRows = new Map<string, HudRow>();
  private readonly commands = new Map<BattleHudActionId, HTMLButtonElement>();
  private readonly portraits = new Map<string, PortraitVisual>();
  private allies: readonly BattleHudAlly[] = [];
  private enemies: readonly BattleHudEnemy[] = [];
  private targetIds: readonly string[] = [];
  private targetHealth: BattleHudEnemy | null = null;
  private targetAnchor: LayoutRect | null = null;
  private targetAvoidance: LayoutRect | null = null;
  private unsubscribe: (() => void) | null = null;
  private partyKey = "";
  private enemyKey = "";
  private targetKey = "";
  private commandsEnabled = false;
  private visualRevision = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly selectEnemy: (id: string) => void,
    private readonly focusEnemy: (id: string | null) => void,
  ) {}

  get portraitRevision(): number { return this.visualRevision; }
  getPartyPortrait(id: string): PortraitVisual | undefined { return this.portraits.get(id); }

  create(): void {
    const viewport = { x: 0, y: 0, width: this.scene.cameras.main.width, height: this.scene.cameras.main.height };
    this.partyGroup = createOverlayContainer(this.scene, "battle-party-vitals", BATTLE_DEPTH.ui, viewport);
    this.enemyGroup = createOverlayContainer(this.scene, "battle-enemy-vitals", BATTLE_DEPTH.uiOverlay, viewport);
    this.background = this.scene.add.graphics();
    this.partyGroup.add(this.background);
    this.toggle = this.scene.add.text(0, 0, "", {
      fontSize: "9px", color: "#e9dfbc", backgroundColor: "#14262c", padding: { x: 7, y: 5 },
    }).setOrigin(1, 1).setData("layoutId", "battle-vitals-toggle").setInteractive({ useHandCursor: true });
    this.toggle.on("pointerdown", () => this.toggleVitals());
    this.partyGroup.add(this.toggle);
    this.native = document.createElement("section");
    this.native.id = "battle-vitals";
    this.native.setAttribute("aria-label", "Battle health and mana");
    this.native.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap";
    this.nativeToggle = document.createElement("button");
    this.nativeToggle.type = "button";
    this.nativeToggle.setAttribute("aria-label", "Compact battle vitals");
    this.nativeToggle.dataset.battleDisplayAction = "vitals";
    this.nativeToggle.addEventListener("click", () => this.toggleVitals());
    this.targets = document.createElement("div");
    this.targets.id = "battle-target-options";
    this.targets.setAttribute("role", "group");
    this.targets.setAttribute("aria-label", "Battle targets");
    this.native.append(this.nativeToggle, this.targets);
    const host = document.getElementById("game-inner");
    if (!host) throw new Error("[battle-hud] Game container is unavailable.");
    host.append(this.native);
    this.unsubscribe = subscribeOverlayReflow(this.scene, () => this.reflow());
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.reflow();
  }

  toggleVitals(): void {
    if (this.native?.isConnected) gamePreferences.toggleBattleVitals();
  }

  setParty(allies: readonly BattleHudAlly[]): void {
    this.allies = allies;
    const key = JSON.stringify(allies);
    if (!this.partyGroup || key === this.partyKey) return;
    this.partyKey = key;
    this.removeMissing(this.partyRows, new Set(allies.map(({ id }) => id)));
    for (const ally of allies) {
      const row = this.partyRows.get(ally.id) ?? this.createRow(ally.id, false);
      this.updateRow(row, `${ally.name}  Lv.${ally.level}`, ally.accessibleDetails ?? ally.details ?? "",
        [["HP", ally.health], ["MP", ally.mana]]);
      const portrait: PortraitVisual = { kind: "hero", visual: ally.portrait };
      const key = getPortraitTextureKey(portrait);
      if (row.lease?.key !== key) {
        const lease = acquirePortraitTexture(this.scene, portrait);
        if (row.portrait) row.portrait.setTexture(lease.key);
        else {
          row.portrait = this.scene.add.image(0, 0, lease.key)
            .setData("layoutId", `battle-vitals-${ally.id}-portrait`);
          row.container.add(row.portrait);
        }
        row.lease?.release();
        row.lease = lease;
        this.portraits.set(ally.id, portrait);
        this.visualRevision++;
      }
      row.portrait?.setAlpha(ally.health.current > 0 ? 1 : 0.4);
    }
    this.reflow();
  }

  setEnemies(enemies: readonly BattleHudEnemy[]): void {
    this.enemies = enemies;
    const key = JSON.stringify(enemies);
    if (key === this.enemyKey) return;
    this.enemyKey = key;
    this.syncTargets();
  }

  setTargets(ids: readonly string[]): void {
    if (ids.join("\n") === this.targetIds.join("\n")) return;
    this.targetIds = ids;
    this.syncTargets();
  }

  setTargetHealth(view: BattleHudEnemy | null, anchor: LayoutRect | null, avoidance: LayoutRect | null = null): void {
    const rounded = anchor ? {
      x: Math.round(anchor.x), y: Math.round(anchor.y),
      width: Math.round(anchor.width), height: Math.round(anchor.height),
    } : null;
    const key = JSON.stringify([view, rounded, avoidance]);
    if (key === this.targetKey) return;
    this.targetKey = key;
    this.targetHealth = view?.health && anchor ? view : null;
    this.targetAnchor = rounded;
    this.targetAvoidance = avoidance;
    this.removeMissing(this.enemyRows, new Set(this.targetHealth ? [this.targetHealth.id] : []));
    if (this.targetHealth?.health) {
      const row = this.enemyRows.get(this.targetHealth.id) ?? this.createRow(this.targetHealth.id, true);
      this.updateRow(row, this.targetHealth.name, "", [["HP", this.targetHealth.health]]);
    }
    this.reflowEnemy();
  }

  bindCommand(action: BattleHudActionId, label: string, activate: () => void): void {
    if (!this.native || this.commands.has(action)) return;
    const button = document.createElement("button");
    button.type = "button";
    button.tabIndex = -1;
    button.textContent = label;
    button.dataset.battleAction = action;
    const root = this.native;
    button.addEventListener("click", () => {
      if (this.native === root && button.isConnected && !button.disabled) activate();
    });
    this.native.append(button);
    this.commands.set(action, button);
    button.hidden = !this.commandsEnabled;
    button.disabled = !this.commandsEnabled;
  }

  setCommandsEnabled(enabled: boolean): void {
    this.commandsEnabled = enabled;
    for (const button of this.commands.values()) {
      if (button.disabled === enabled) button.disabled = !enabled;
      if (button.hidden === enabled) button.hidden = !enabled;
    }
  }

  private syncTargets(): void {
    if (!this.targets) return;
    const root = this.targets;
    root.replaceChildren();
    for (const enemy of this.enemies) {
      if (!enemy.alive || !this.targetIds.includes(enemy.id)) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = enemy.name;
      button.dataset.enemyTargetId = enemy.id;
      button.addEventListener("focus", () => {
        if (button.isConnected) this.focusEnemy(enemy.id);
      });
      button.addEventListener("blur", () => this.focusEnemy(null));
      button.addEventListener("click", () => {
        if (button.isConnected && this.targetIds.includes(enemy.id)) this.selectEnemy(enemy.id);
      });
      button.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") event.stopPropagation();
      });
      root.append(button);
    }
    root.hidden = root.children.length === 0;
  }

  private createRow(id: string, enemy: boolean): HudRow {
    const parent = enemy ? this.enemyGroup : this.partyGroup;
    if (!parent || !this.native) throw new Error("[battle-hud] Status created before HUD initialization.");
    const container = this.scene.add.container(0, 0);
    const title = this.scene.add.text(0, 0, "", { fontSize: "9px", color: "#f6f2e6" })
      .setData("layoutId", `battle-vitals-${id}-name`);
    const outline = this.scene.add.graphics();
    container.add([outline, title]);
    parent.add(container);
    const native = document.createElement("div");
    native.dataset.combatantId = id;
    native.dataset.side = enemy ? "enemy" : "party";
    const nativeTitle = document.createElement("span");
    const nativeDetails = document.createElement("span");
    native.append(nativeTitle, nativeDetails);
    this.native.append(native);
    const row = { container, title, outline, native, nativeTitle, nativeDetails, bars: new Map<ResourceKind, HudBar>() };
    (enemy ? this.enemyRows : this.partyRows).set(id, row);
    return row;
  }

  private updateRow(
    row: HudRow, name: string, details: string,
    resources: readonly (readonly [ResourceKind, BattleHudResource])[],
  ): void {
    if (row.title.text !== name) row.title.setText(name);
    if (row.nativeTitle.textContent !== name) row.nativeTitle.textContent = name;
    if (row.nativeDetails.textContent !== details) row.nativeDetails.textContent = details;
    for (const [kind, value] of resources) {
      getBattleResourceRatio(value);
      let bar = row.bars.get(kind);
      if (!bar) {
        const id = `${row.title.getData("layoutId")}-${kind}`;
        const graphic = this.scene.add.graphics().setData("layoutId", `${id}-bar`)
          .setData("layoutAllowOverlapWith", [`${id}-value`]);
        const text = this.scene.add.text(0, 0, "", { fontSize: "8px", fontFamily: "monospace", color: "#f6f2e6" })
          .setOrigin(0.5).setData("layoutId", `${id}-value`).setData("layoutAllowOverlapWith", [`${id}-bar`]);
        row.container.add([graphic, text]);
        const meter = document.createElement("meter");
        meter.min = 0;
        meter.dataset.resource = kind;
        row.native.append(meter);
        bar = { graphic, text, meter, value };
        row.bars.set(kind, bar);
      }
      bar.value = value;
      const label = `${kind} ${value.current}/${value.maximum}`;
      if (bar.text.text !== label) bar.text.setText(label);
      const accessibleName = `${name} ${kind === "HP" ? "health" : "mana"}`;
      if (bar.meter.getAttribute("aria-label") !== accessibleName) bar.meter.setAttribute("aria-label", accessibleName);
      const maximum = Math.max(1, value.maximum);
      const current = Math.max(0, Math.min(maximum, value.current));
      if (bar.meter.max !== maximum) bar.meter.max = maximum;
      if (bar.meter.value !== current) bar.meter.value = current;
      if (bar.meter.getAttribute("aria-valuetext") !== label) bar.meter.setAttribute("aria-valuetext", label);
    }
  }

  private drawBar(bar: HudBar, kind: ResourceKind, bounds: LayoutRect, compact = false): void {
    const palette = getBattleHudPalette(getAccessibilityPreferences().highContrast);
    const { x, y, width, height } = bounds;
    const fillWidth = Math.round((width - 2) * getBattleResourceRatio(bar.value));
    bar.graphic.clear().fillStyle(palette.track).fillRect(x, y, width, height);
    if (fillWidth > 0) bar.graphic.fillStyle(kind === "HP" ? palette.health : palette.mana)
      .fillRect(x + 1, y + 1, fillWidth, Math.max(1, height - 2));
    bar.graphic.lineStyle(1, palette.outline, compact ? 0.6 : 1).strokeRect(x, y, width, height);
    bar.graphic.setData("layoutBounds", bounds);
    bar.text.setVisible(!compact).setPosition(x + width / 2, y + height / 2);
    bar.text.setColor(`#${palette.text.toString(16).padStart(6, "0")}`);
  }

  private reflow(): void {
    if (!this.partyGroup || !this.background || !this.toggle) return;
    const background = this.background;
    const { width, height } = this.scene.cameras.main;
    const compact = gamePreferences.getBattleHud().vitals === "compact";
    const palette = getBattleHudPalette(getAccessibilityPreferences().highContrast);
    this.background.clear();
    let top = height - 78;
    if (compact) {
      const cellWidth = 34;
      const left = width - 12 - this.allies.length * cellWidth;
      this.allies.forEach((ally, index) => {
        const row = this.partyRows.get(ally.id)!;
        const x = left + index * cellWidth;
        row.title.setVisible(false);
        row.portrait?.setPosition(x + 14, top + 14).setDisplaySize(28, 28);
        this.drawPortraitFrame(row, x - 1, top - 1, 30, ally.health.current <= 0);
        for (const [barIndex, [kind, bar]] of [...row.bars.entries()].entries()) {
          this.drawBar(bar, kind, { x, y: top + 33 + barIndex * 7, width: 28, height: 4 }, true);
        }
      });
    } else {
      const panelWidth = BATTLE_VITALS_WIDTH;
      const x = width - panelWidth - 8;
      const rowWidth = panelWidth - 49;
      const rows = this.allies.map((ally) => {
        const row = this.partyRows.get(ally.id)!;
        row.title.setVisible(true).setWordWrapWidth(rowWidth - 8, true);
        const barHeight = Math.max(14, ...[...row.bars.values()].map(({ text }) => text.displayHeight + 4));
        return { id: ally.id, width: panelWidth, height: Math.max(42, row.title.displayHeight + barHeight * 2 + 11), barHeight };
      });
      const stack = layoutVerticalStack(rows, { x, gap: 5 });
      top = height - 12 - stack.height;
      stack.items.forEach((item, index) => {
        const ally = this.allies[index]!;
        const row = this.partyRows.get(ally.id)!;
        const y = top + item.y;
        background.fillStyle(palette.panel, getAccessibilityPreferences().highContrast ? 1 : 0.78)
          .fillRect(x, y, panelWidth, item.height)
          .lineStyle(1, palette.outline, 0.5).lineBetween(x + 40, y + item.height, x + panelWidth, y + item.height);
        row.title.setPosition(x + 45, y + 3);
        row.portrait?.setPosition(x + 21, y + item.height / 2).setDisplaySize(34, 34);
        this.drawPortraitFrame(row, x + 3, y + item.height / 2 - 18, 36, ally.health.current <= 0);
        const barY = row.title.y + row.title.displayHeight + 3;
        [...row.bars.entries()].forEach(([kind, bar], barIndex) => this.drawBar(bar, kind, {
          x: x + 45, y: barY + barIndex * (rows[index]!.barHeight + 2),
          width: rowWidth - 5, height: rows[index]!.barHeight,
        }));
      });
    }
    this.toggle.setText(`${compact ? "Expand" : "Compact"}${inputPromptSource.get() === "keyboard" ? " [U]" : ""}`)
      .setPosition(width - 9, top - 6);
    syncInteractiveHitArea(this.toggle, 3);
    this.nativeToggle?.setAttribute("aria-pressed", String(compact));
    if (this.scene.game.canvas.dataset.battleVitalsMode !== (compact ? "compact" : "expanded")) {
      this.scene.game.canvas.dataset.battleVitalsMode = compact ? "compact" : "expanded";
    }
    setOverlayViewport(this.scene, "battle-party-vitals", { x: 0, y: 0, width, height });
    this.reflowEnemy();
  }

  private drawPortraitFrame(row: HudRow, x: number, y: number, size: number, knockedOut: boolean): void {
    const palette = getBattleHudPalette(getAccessibilityPreferences().highContrast);
    row.outline.clear().fillStyle(palette.panel, 0.92).fillRect(x, y, size, size)
      .lineStyle(1, palette.outline, 0.8).strokeRect(x, y, size, size);
    if (knockedOut && !row.knockoutBadge) {
      row.knockoutBadge = this.scene.add.graphics();
      row.container.add(row.knockoutBadge);
    }
    if (row.knockoutBadge) {
      row.knockoutBadge.clear().setVisible(knockedOut);
      if (knockedOut) {
        row.container.bringToTop(row.knockoutBadge);
        row.knockoutBadge.fillStyle(palette.panel).fillRect(x + size - 12, y + 1, 11, 11)
          .lineStyle(2, 0xffffff)
          .lineBetween(x + size - 9, y + 3, x + size - 3, y + 9)
          .lineBetween(x + size - 3, y + 3, x + size - 9, y + 9);
      }
    }
    if (row.portrait) row.portrait.setData("layoutBounds", getScaledBounds(row.portrait));
  }

  private reflowEnemy(): void {
    const view = this.targetHealth;
    const anchor = this.targetAnchor;
    if (!this.enemyGroup || !view || !anchor) return;
    const row = this.enemyRows.get(view.id);
    const bar = row?.bars.get("HP");
    if (!row || !bar) return;
    const width = 168;
    row.title.setWordWrapWidth(width - 12, true);
    const barHeight = Math.max(14, bar.text.displayHeight + 4);
    const height = row.title.displayHeight + barHeight + 15;
    const arenaWidth = this.scene.cameras.main.width - BATTLE_SIDEBAR_WIDTH;
    const preferredX = this.targetAvoidance
      ? this.targetAvoidance.x > arenaWidth / 2 ? 8 : arenaWidth - width - 8
      : anchor.x + anchor.width / 2 - width / 2;
    const bounds = clampRectToViewport({
      x: preferredX, y: anchor.y - height - 32, width, height,
    }, { x: 8, y: 58, width: arenaWidth - 8, height: this.scene.cameras.main.height - 70 });
    row.outline.clear().fillStyle(0x102126, 0.97).fillRect(bounds.x, bounds.y, width, height)
      .lineStyle(1, 0xd8cba4).strokeRect(bounds.x, bounds.y, width, height);
    row.title.setPosition(bounds.x + 6, bounds.y + 4);
    this.drawBar(bar, "HP", { x: bounds.x + 6, y: bounds.y + row.title.displayHeight + 8, width: width - 12, height: barHeight });
  }

  private removeMissing(rows: Map<string, HudRow>, present: ReadonlySet<string>): void {
    for (const [id, row] of rows) {
      if (present.has(id)) continue;
      row.container.destroy(true);
      row.lease?.release();
      row.native.remove();
      rows.delete(id);
      if (this.portraits.delete(id)) this.visualRevision++;
    }
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.partyGroup?.destroy(true);
    this.enemyGroup?.destroy(true);
    for (const row of this.partyRows.values()) row.lease?.release();
    this.partyGroup = this.enemyGroup = null;
    this.background = null;
    this.toggle = null;
    this.native?.remove();
    this.native = null;
    this.nativeToggle = null;
    this.targets = null;
    this.partyRows.clear();
    this.enemyRows.clear();
    this.portraits.clear();
    this.commands.clear();
  }
}
