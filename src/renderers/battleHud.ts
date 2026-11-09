import * as Phaser from "phaser";
import {
  BATTLE_HUD_ACTION_IDS, createBattleActionIcon, getBattleHudPalette, getBattleResourceRatio,
  type BattleHudActionId, type BattleHudAlly, type BattleHudEnemy, type BattleHudResource,
} from "../systems/battleHud";
import { getAccessibilityPreferences } from "../systems/accessibility";
import { getScaledBounds, subscribeOverlayReflow } from "../managers/layout";
import { createOverlayContainer, setOverlayViewport } from "../utils/ui";
import { createPixelTexture } from "./pixelTexture";
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
  readonly details: Phaser.GameObjects.Text;
  readonly outline: Phaser.GameObjects.Graphics;
  readonly native: HTMLElement;
  readonly nativeTitle: HTMLElement;
  readonly nativeDetails: HTMLElement;
  readonly bars: Map<ResourceKind, HudBar>;
}

export function getBattleActionIconKey(action: BattleHudActionId): string {
  return `battle-action-icon-${action}`;
}

export function generateBattleHudTextures(scene: Phaser.Scene): void {
  for (const action of BATTLE_HUD_ACTION_IDS) {
    createPixelTexture(scene, getBattleActionIconKey(action), createBattleActionIcon(action));
  }
}

/** Read-only battle status, with native meters and no hidden-enemy resource values. */
export class BattleHudRenderer {
  private partyGroup: Phaser.GameObjects.Container | null = null;
  private enemyGroup: Phaser.GameObjects.Container | null = null;
  private background: Phaser.GameObjects.Graphics | null = null;
  private native: HTMLElement | null = null;
  private readonly partyRows = new Map<string, HudRow>();
  private readonly enemyRows = new Map<string, HudRow>();
  private readonly commands = new Map<BattleHudActionId, HTMLButtonElement>();
  private allies: readonly BattleHudAlly[] = [];
  private enemies: readonly BattleHudEnemy[] = [];
  private unsubscribe: (() => void) | null = null;
  private partyKey = "";
  private enemyKey = "";

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly selectEnemy: (id: string) => void,
  ) {}

  create(): void {
    const viewport = { x: 0, y: 0, width: this.scene.cameras.main.width, height: this.scene.cameras.main.height };
    this.partyGroup = createOverlayContainer(this.scene, "battle-party-vitals", BATTLE_DEPTH.ui, viewport);
    this.enemyGroup = createOverlayContainer(this.scene, "battle-enemy-vitals", BATTLE_DEPTH.ui, viewport);
    this.background = this.scene.add.graphics();
    this.partyGroup.add(this.background);
    this.native = document.createElement("section");
    this.native.id = "battle-vitals";
    this.native.setAttribute("aria-label", "Battle health and mana");
    this.native.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap";
    const host = document.getElementById("game-inner");
    if (!host) throw new Error("[battle-hud] Game container is unavailable.");
    host.append(this.native);
    this.unsubscribe = subscribeOverlayReflow(this.scene, () => this.reflow());
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  setParty(allies: readonly BattleHudAlly[]): void {
    this.allies = allies;
    const key = JSON.stringify(allies);
    if (!this.partyGroup || key === this.partyKey) return;
    this.partyKey = key;
    this.removeMissing(this.partyRows, new Set(allies.map((ally) => ally.id)));
    for (const ally of allies) {
      const row = this.partyRows.get(ally.id) ?? this.createRow(ally.id, false);
      this.updateRow(row, ally.name, ally.details ?? "", [["HP", ally.health], ["MP", ally.mana]],
        ally.accessibleDetails);
    }
    this.reflow();
  }

  setEnemies(enemies: readonly BattleHudEnemy[]): void {
    this.enemies = enemies;
    const key = JSON.stringify(enemies);
    if (!this.enemyGroup || key === this.enemyKey) return;
    this.enemyKey = key;
    this.removeMissing(this.enemyRows, new Set(enemies.map((enemy) => enemy.id)));
    for (const enemy of enemies) {
      const row = this.enemyRows.get(enemy.id) ?? this.createRow(enemy.id, true);
      this.updateRow(row, enemy.name, "", enemy.health ? [["HP", enemy.health]] : []);
      row.container.setAlpha(enemy.alive ? 1 : 0.4);
    }
    this.reflow();
  }

  bindCommand(action: BattleHudActionId, label: string, activate: () => void): void {
    if (!this.native || this.commands.has(action)) return;
    const button = document.createElement("button");
    button.type = "button";
    button.tabIndex = -1;
    button.textContent = label;
    button.dataset.battleAction = action;
    button.addEventListener("click", activate);
    this.native.append(button);
    this.commands.set(action, button);
  }

  setCommandsEnabled(enabled: boolean): void {
    for (const button of this.commands.values()) {
      if (button.disabled === enabled) button.disabled = !enabled;
    }
  }

  private createRow(id: string, enemy: boolean): HudRow {
    const parent = enemy ? this.enemyGroup : this.partyGroup;
    if (!parent || !this.native) throw new Error("[battle-hud] Status created before HUD initialization.");
    const container = this.scene.add.container(0, 0);
    const title = this.scene.add.text(0, 0, "", {
      fontFamily: "monospace", fontSize: enemy ? "9px" : "10px", color: "#f6f2e6",
    }).setData("layoutId", `battle-vitals-${id}-name`);
    const details = this.scene.add.text(0, 0, "", {
      fontFamily: "monospace", fontSize: "8px", color: "#f6f2e6",
    }).setData("layoutId", `battle-vitals-${id}-details`).setVisible(false);
    const outline = this.scene.add.graphics();
    container.add([outline, title, details]);
    parent.add(container);
    if (enemy) title.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.selectEnemy(id));
    const native = document.createElement("div");
    native.dataset.combatantId = id;
    native.dataset.side = enemy ? "enemy" : "party";
    const nativeTitle = document.createElement("span");
    const nativeDetails = document.createElement("span");
    native.append(nativeTitle, nativeDetails);
    this.native.append(native);
    const row = { container, title, details, outline, native, nativeTitle, nativeDetails, bars: new Map<ResourceKind, HudBar>() };
    (enemy ? this.enemyRows : this.partyRows).set(id, row);
    return row;
  }

  private updateRow(
    row: HudRow, name: string, details: string,
    resources: readonly (readonly [ResourceKind, BattleHudResource])[],
    accessibleDetails = details,
  ): void {
    if (row.title.text !== name) row.title.setText(name);
    if (row.details.text !== details) row.details.setText(details);
    row.details.setVisible(details.length > 0);
    if (row.nativeTitle.textContent !== name) row.nativeTitle.textContent = name;
    if (row.nativeDetails.textContent !== accessibleDetails) row.nativeDetails.textContent = accessibleDetails;
    const visible = new Set(resources.map(([kind]) => kind));
    for (const [kind, bar] of row.bars) {
      if (visible.has(kind)) continue;
      bar.graphic.destroy();
      bar.text.destroy();
      bar.meter.remove();
      row.bars.delete(kind);
    }
    for (const [kind, value] of resources) {
      getBattleResourceRatio(value);
      let bar = row.bars.get(kind);
      if (!bar) {
        const id = `${row.title.getData("layoutId")}-${kind}`;
        const graphic = this.scene.add.graphics().setData("layoutId", `${id}-bar`)
          .setData("layoutAllowOverlapWith", [`${id}-value`]);
        const text = this.scene.add.text(0, 0, "", {
          fontFamily: "monospace", fontSize: "9px", color: "#f6f2e6",
        }).setOrigin(0.5).setData("layoutId", `${id}-value`)
          .setData("layoutAllowOverlapWith", [`${id}-bar`]);
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

  private drawBar(bar: HudBar, kind: ResourceKind, x: number, y: number, width: number, height: number): void {
    const palette = getBattleHudPalette(getAccessibilityPreferences().highContrast);
    const fillWidth = Math.round((width - 4) * getBattleResourceRatio(bar.value));
    bar.graphic.clear().fillStyle(palette.track).fillRect(x, y, width, height);
    if (fillWidth > 0) bar.graphic.fillStyle(kind === "HP" ? palette.health : palette.mana)
      .fillRect(x + 2, y + 2, fillWidth, height - 4);
    bar.graphic.lineStyle(1, palette.outline).strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    bar.graphic.setData("layoutBounds", { x, y, width, height });
    bar.text.setPosition(x + width / 2, y + height / 2);
    bar.text.setColor(`#${palette.text.toString(16).padStart(6, "0")}`);
  }

  private reflow(): void {
    if (!this.partyGroup || !this.enemyGroup || !this.background) return;
    const { width, height } = this.scene.cameras.main;
    const palette = getBattleHudPalette(getAccessibilityPreferences().highContrast);
    const partyX = 8;
    const partyY = 6;
    const partyWidth = width * 0.44;
    const innerWidth = partyWidth - 16;
    let y = partyY + 6;
    for (const ally of this.allies) {
      const row = this.partyRows.get(ally.id);
      if (!row) continue;
      row.title.setWordWrapWidth(innerWidth, true).setPosition(partyX + 8, y);
      row.title.setColor(`#${palette.text.toString(16).padStart(6, "0")}`);
      y += getScaledBounds(row.title).height + 3;
      if (row.details.visible) {
        row.details.setWordWrapWidth(innerWidth, true).setPosition(partyX + 8, y);
        y += getScaledBounds(row.details).height + 3;
      }
      const barHeight = Math.max(14, ...[...row.bars.values()].map((bar) => bar.text.displayHeight + 4));
      const barWidth = (innerWidth - 8) / 2;
      [...row.bars.entries()].forEach(([kind, bar], index) =>
        this.drawBar(bar, kind, partyX + 8 + index * (barWidth + 8), y, barWidth, barHeight));
      y += barHeight + 4;
    }
    const partyHeight = this.allies.length > 0 ? y - partyY : 0;
    this.background.clear();
    if (partyHeight > 0) this.background.fillStyle(palette.panel, 0.96)
      .fillRoundedRect(partyX, partyY, partyWidth, partyHeight, 4)
      .lineStyle(1, palette.outline).strokeRoundedRect(partyX, partyY, partyWidth, partyHeight, 4);
    setOverlayViewport(this.scene, "battle-party-vitals", { x: partyX, y: partyY, width: partyWidth, height: height * 0.43 });
    const enemyX = width * 0.47;
    const enemyWidth = width * 0.51 - 10;
    y = 6;
    for (const enemy of this.enemies) {
      const row = this.enemyRows.get(enemy.id);
      if (!row) continue;
      const top = y;
      const health = row.bars.get("HP");
      const barWidth = Math.min(152, enemyWidth * 0.48);
      row.title.setWordWrapWidth(health ? enemyWidth - barWidth - 16 : enemyWidth - 8, true);
      const rowHeight = Math.max(row.title.displayHeight,
        health ? Math.max(14, health.text.displayHeight + 4) : 0);
      row.title.setPosition(enemyX + 4, y + (rowHeight - row.title.displayHeight) / 2);
      if (health) {
        this.drawBar(health, "HP", enemyX + enemyWidth - barWidth - 4, y, barWidth, rowHeight);
      }
      const rowWidth = health ? enemyWidth : row.title.displayWidth + 8;
      row.outline.clear().fillStyle(palette.panel, 0.96)
        .fillRoundedRect(enemyX, top - 2, rowWidth, rowHeight + 4, 2);
      if (enemy.selected) row.outline.lineStyle(1, palette.outline)
        .strokeRect(enemyX, top - 2, rowWidth, rowHeight + 4);
      y += rowHeight + 9;
    }
    setOverlayViewport(this.scene, "battle-enemy-vitals", { x: enemyX - 2, y: 0, width: enemyWidth + 4, height: height * 0.43 });
  }

  private removeMissing(rows: Map<string, HudRow>, present: ReadonlySet<string>): void {
    for (const [id, row] of rows) {
      if (present.has(id)) continue;
      row.container.destroy(true);
      row.native.remove();
      rows.delete(id);
    }
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.partyGroup?.destroy(true);
    this.enemyGroup?.destroy(true);
    this.partyGroup = this.enemyGroup = null;
    this.background = null;
    this.native?.remove();
    this.native = null;
    this.partyRows.clear();
    this.enemyRows.clear();
    this.commands.clear();
  }
}
