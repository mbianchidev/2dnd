import * as Phaser from "phaser";
import { BattleLogState } from "../systems/battleCinematic";
import { getAccessibilityPreferences, isReducedMotionEnabled } from "../systems/accessibility";
import { inputPromptSource } from "../systems/input";
import type { DiceRollCategory } from "../systems/dicePresentation";
import { BATTLE_SIDEBAR_WIDTH } from "../systems/layout";
import { BATTLE_DEPTH } from "../renderers/battleDepth";
import { createOverlayContainer, createPanelGraphics, createStatusAnnouncer, setOverlayViewport } from "../utils/ui";
import { getScaledBounds, subscribeOverlayReflow, syncInteractiveHitArea } from "./layout";

interface BattleLogCallbacks {
  canOpen(): boolean;
  openChanged(open: boolean): void;
}

/** Brief action receipts over the scene; a bounded full history opens only on request. */
export class BattleLogManager {
  private readonly model = new BattleLogState();
  private readonly control: Phaser.GameObjects.Container;
  private readonly notice: Phaser.GameObjects.Container;
  private readonly button: Phaser.GameObjects.Text;
  private readonly noticeBackground: Phaser.GameObjects.Graphics;
  private readonly noticeText: Phaser.GameObjects.Text;
  private readonly history: HTMLOListElement;
  private readonly nativeControl: HTMLDivElement;
  private readonly nativeButton: HTMLButtonElement;
  private readonly announcement: HTMLDivElement;
  private readonly unsubscribe: () => void;
  private historyGroup: Phaser.GameObjects.Container | null = null;
  private historyNative: HTMLDivElement | null = null;
  private previousFocus: HTMLElement | null = null;
  private offset = 0;
  private destroyed = false;
  private noticeVisible = false;

  constructor(private readonly scene: Phaser.Scene, private readonly callbacks: BattleLogCallbacks) {
    this.control = createOverlayContainer(scene, "battle-log-controls", BATTLE_DEPTH.ui);
    this.button = scene.add.text(8, 8, "", {
      fontSize: "9px", color: "#e9dfbc", backgroundColor: "#14262c", padding: { x: 6, y: 5 },
    }).setData("layoutId", "battle-log-toggle").setInteractive({ useHandCursor: true });
    this.button.on("pointerdown", () => this.toggle());
    this.control.add(this.button);
    this.notice = createOverlayContainer(scene, "battle-action-notice", BATTLE_DEPTH.ui);
    this.noticeBackground = scene.add.graphics();
    this.noticeText = scene.add.text(0, 0, "", {
      fontSize: "11px", color: "#f1e9cf", lineSpacing: 3,
      wordWrap: { width: scene.cameras.main.width - BATTLE_SIDEBAR_WIDTH - 44 },
    }).setData("layoutId", "battle-action-notice-copy");
    this.notice.add([this.noticeBackground, this.noticeText]).setVisible(false);
    this.history = document.createElement("ol");
    this.history.id = "battle-log";
    this.history.className = "battle-log-accessible";
    this.history.setAttribute("role", "log");
    this.history.setAttribute("aria-label", "Battle log");
    this.history.setAttribute("aria-live", "off");
    this.nativeControl = document.createElement("div");
    this.nativeControl.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap";
    this.nativeButton = document.createElement("button");
    this.nativeButton.type = "button";
    this.nativeButton.textContent = "Battle log";
    this.nativeButton.setAttribute("aria-haspopup", "dialog");
    this.nativeButton.setAttribute("aria-expanded", "false");
    this.nativeButton.addEventListener("click", () => this.toggle());
    this.nativeButton.addEventListener("keydown", this.isolateButton);
    this.nativeControl.append(this.nativeButton, this.history);
    const host = document.getElementById("game-inner");
    if (!host) throw new Error("[battle-log] Game container is unavailable.");
    host.append(this.nativeControl);
    this.announcement = createStatusAnnouncer("battle-action-announcement");
    this.unsubscribe = subscribeOverlayReflow(scene, () => this.reflow());
    scene.input.on("wheel", this.handleWheel, this);
    scene.input.keyboard?.on("keydown", this.handleKey, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    window.addEventListener("blur", this.clearNotice);
    document.addEventListener("visibilitychange", this.handleVisibility);
    this.reflow();
  }

  get isOpen(): boolean { return this.historyGroup !== null; }

  append(text: string, category?: DiceRollCategory): void {
    if (this.destroyed) return;
    this.model.append(text, category);
    const item = document.createElement("li");
    item.textContent = text;
    if (category) item.dataset.category = category;
    this.history.append(item);
    if (this.history.children.length > 200) this.history.firstElementChild?.remove();
    if (this.isOpen) this.renderHistory();
  }

  update(elapsedMs: number): void {
    if (this.destroyed) return;
    const enabled = this.isOpen || this.callbacks.canOpen();
    if (this.nativeButton.disabled === enabled) this.nativeButton.disabled = !enabled;
    if (this.button.input) this.button.input.enabled = enabled;
    if (this.button.alpha !== (enabled ? 1 : 0.45)) this.button.setAlpha(enabled ? 1 : 0.45);
    this.model.advance(elapsedMs);
    if (this.model.commitNotice()) {
      if (this.isOpen) this.model.clearNotice();
      else {
        this.announcement.textContent = this.model.readNotice(true).text;
        this.reflowNotice();
      }
    }
    const state = this.model.readNotice(isReducedMotionEnabled());
    this.notice.setVisible(state.visible && !this.isOpen);
    if (this.notice.alpha !== state.alpha) this.notice.setAlpha(state.alpha);
    if (this.notice.y !== state.offsetY) this.notice.setY(state.offsetY);
    if (this.noticeVisible !== (state.visible && !this.isOpen)) {
      this.noticeVisible = state.visible && !this.isOpen;
      this.scene.game.canvas.dataset.battleNoticeVisible = String(this.noticeVisible);
    }
  }

  toggle(): void {
    if (this.destroyed) return;
    if (this.isOpen) { this.close(); return; }
    if (!this.callbacks.canOpen()) return;
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.offset = 0;
    this.clearNotice();
    this.historyGroup = createOverlayContainer(this.scene, "battle-log-history", BATTLE_DEPTH.uiOverlay);
    this.historyNative = document.createElement("div");
    this.historyNative.setAttribute("role", "dialog");
    this.historyNative.setAttribute("aria-modal", "true");
    this.historyNative.setAttribute("aria-label", "Battle log history");
    this.historyNative.style.cssText = this.nativeControl.style.cssText;
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Close battle log";
    close.addEventListener("click", () => this.close());
    close.addEventListener("keydown", this.isolateButton);
    this.historyNative.addEventListener("keydown", (event) => {
      if (event.key === "Tab") {
        event.preventDefault();
        close.focus({ preventScroll: true });
      }
    });
    this.historyNative.append(close, this.history);
    document.body.append(this.historyNative);
    this.nativeButton.setAttribute("aria-expanded", "true");
    this.callbacks.openChanged(true);
    this.renderHistory();
    close.focus({ preventScroll: true });
  }

  close(restoreFocus = true): boolean {
    if (!this.isOpen) return false;
    this.historyGroup?.destroy(true);
    this.historyGroup = null;
    this.nativeControl.append(this.history);
    this.historyNative?.remove();
    this.historyNative = null;
    this.nativeButton.setAttribute("aria-expanded", "false");
    this.clearNotice();
    if (!this.destroyed) this.callbacks.openChanged(false);
    if (restoreFocus && !this.destroyed) {
      const target = this.previousFocus?.isConnected ? this.previousFocus : this.scene.game.canvas;
      target.focus({ preventScroll: true });
    }
    this.previousFocus = null;
    return true;
  }

  readonly clearNotice = (): void => {
    this.model.clearNotice();
    this.notice.setVisible(false);
    this.announcement.textContent = "";
    if (this.noticeVisible) {
      this.noticeVisible = false;
      this.scene.game.canvas.dataset.battleNoticeVisible = "false";
    }
  };

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.close(false);
    this.unsubscribe();
    this.scene.input.off("wheel", this.handleWheel, this);
    this.scene.input.keyboard?.off("keydown", this.handleKey, this);
    window.removeEventListener("blur", this.clearNotice);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.control.destroy(true);
    this.notice.destroy(true);
    this.nativeControl.remove();
    this.announcement.remove();
    this.model.reset();
    delete this.scene.game.canvas.dataset.battleNoticeVisible;
  }

  private readonly isolateButton = (event: KeyboardEvent): void => {
    if (event.key === "Enter" || event.key === " ") event.stopPropagation();
  };

  private readonly handleVisibility = (): void => {
    if (document.hidden) this.clearNotice();
  };

  private reflow(): void {
    this.button.setText(inputPromptSource.get() === "keyboard" ? "Log [J]" : "Log");
    syncInteractiveHitArea(this.button, 3);
    this.reflowNotice();
    if (this.isOpen) this.renderHistory();
  }

  private reflowNotice(): void {
    const state = this.model.readNotice(true);
    if (!state.text) return;
    const width = this.scene.cameras.main.width - BATTLE_SIDEBAR_WIDTH - 16;
    this.noticeText.setWordWrapWidth(width - 28, true);
    const lines = this.noticeText.getWrappedText(state.text);
    this.noticeText.setText(lines.slice(0, 4).join("\n")).setPosition(22, 65);
    const height = this.noticeText.displayHeight + 18;
    const contrast = getAccessibilityPreferences().highContrast;
    this.noticeBackground.clear().fillStyle(contrast ? 0x000000 : 0x14262c, 0.94)
      .fillRect(12, 57, width, height).fillStyle(0xc6aa69).fillRect(12, 57, 2, height)
      .lineStyle(1, contrast ? 0xffffff : 0x6a8278, 0.8).lineBetween(14, 57 + height, 12 + width, 57 + height);
    setOverlayViewport(this.scene, "battle-action-notice", { x: 12, y: 53, width, height: height + 8 });
  }

  private renderHistory(): void {
    const group = this.historyGroup;
    if (!group) return;
    group.removeAll(true);
    const { width, height } = this.scene.cameras.main;
    const x = 20;
    const y = 72;
    const panelWidth = width - 40;
    const panelHeight = height - 108;
    const dim = this.scene.add.graphics().fillStyle(0x040a0f, 0.6).fillRect(0, 0, width, height)
      .setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
    const panel = createPanelGraphics(this.scene, x, y, panelWidth, panelHeight, 0.98);
    const title = this.scene.add.text(x + 16, y + 12, "Battle log", { fontSize: "16px", color: "#efd594" });
    const close = this.scene.add.text(x + panelWidth - 12, y + 10, "Close", {
      fontSize: "11px", color: "#ffffff", backgroundColor: "#30423f", padding: { x: 8, y: 5 },
    }).setOrigin(1, 0).setData("layoutId", "battle-log-close").setInteractive({ useHandCursor: true });
    close.on("pointerdown", () => this.close());
    const hint = this.scene.add.text(x + 16, y + panelHeight - 14,
      "PgUp / PgDn or arrows to scroll  |  Esc to close", {
        fontSize: "9px", color: "#bccdc3", wordWrap: { width: panelWidth - 32 },
      }).setOrigin(0, 1);
    const top = y + 16 + Math.max(getScaledBounds(title).height, getScaledBounds(close).height);
    const body = this.scene.add.text(x + 16, top, "", {
      fontSize: "11px", color: "#f1e9cf", lineSpacing: 4, wordWrap: { width: panelWidth - 32 },
    }).setData("layoutId", "battle-log-history-copy");
    const lines = this.model.entries.flatMap(({ text }) => body.getWrappedText(text));
    this.offset = Math.max(0, Math.min(this.offset, Math.max(0, lines.length - 1)));
    const end = Math.max(1, lines.length - this.offset);
    let start = end;
    let visible = "";
    while (start > 0) {
      const candidate = lines.slice(start - 1, end).join("\n");
      body.setText(candidate);
      if (body.displayHeight > hint.y - hint.displayHeight - top - 12) break;
      visible = candidate;
      start--;
    }
    body.setText(visible || "No actions recorded yet.");
    group.add([dim, panel, title, close, body, hint]);
    setOverlayViewport(this.scene, "battle-log-history", { x, y, width: panelWidth, height: panelHeight });
  }

  private handleWheel(_pointer: Phaser.Input.Pointer, _objects: Phaser.GameObjects.GameObject[], _dx: number, dy: number): void {
    if (!this.isOpen) this.toggle();
    if (!this.isOpen) return;
    this.offset = Math.max(0, this.offset + (dy < 0 ? 2 : -2));
    this.renderHistory();
  }

  private handleKey(event: KeyboardEvent): void {
    if (!this.isOpen) return;
    const delta = ["ArrowUp", "PageUp", "w", "W"].includes(event.key) ? 3
      : ["ArrowDown", "PageDown", "s", "S"].includes(event.key) ? -3 : 0;
    if (delta) {
      event.preventDefault();
      this.offset = Math.max(0, this.offset + delta);
      this.renderHistory();
    }
  }
}
