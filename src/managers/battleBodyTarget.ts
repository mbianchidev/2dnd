import * as Phaser from "phaser";
import { getBodyPart, type BodyPart, type BodyPartId, type PhysicalDiscovery } from "../data/anatomy";
import type { Monster } from "../data/monsters";
import type { PhysicalDamageType } from "../data/damageTypes";
import { getBodyTargetChoices, type BodyTargetChoice } from "../systems/physicalCombat";
import { gamePreferences } from "../systems/accessibility";
import { getInputPromptSource, inputPromptSource, type InputSource } from "../systems/input";
import { createBattleActionMenu } from "./battleActionMenu";
import { publishSceneLayoutReport, syncInteractiveHitArea } from "./layout";

interface BodyTargetOptions {
  readonly monster: Monster;
  readonly label: string;
  readonly targetId: string;
  readonly targetLabel: string;
  readonly damageType: PhysicalDamageType;
  readonly discoveries: readonly PhysicalDiscovery[];
  select(part: BodyPart | undefined): void;
  confirm(bodyPartId: BodyPartId | undefined): void;
  cancel(): void;
}

const PROMPTS: Readonly<Record<InputSource, string>> = {
  keyboard: "Arrows/WASD: select | Enter/Space: aim | Esc: back",
  pointer: "Click a part | Esc: back",
  gamepad: "D-pad: select | A: aim | B: back | Right stick: cursor",
  touch: "Tap a part or use D-pad | A: aim | B: back",
};

/** Shared hero/companion aiming UI. All mechanics remain in the validated combat path. */
export class BattleBodyTargetManager {
  private options: BodyTargetOptions | null = null;
  private choices: BodyTargetChoice[] = [];
  private selectedId = "whole";
  private page = 0;
  private pages: string[][] = [];
  private container: Phaser.GameObjects.Container | null = null;
  private root: HTMLDivElement | null = null;
  private previousFocus: HTMLElement | null = null;
  private unsubscribePreferences: (() => void) | null = null;
  private unsubscribePrompts: (() => void) | null = null;
  private pendingActivation: string | null = null;
  private readonly consumedKeys = new WeakSet<KeyboardEvent>();

  constructor(private readonly scene: Phaser.Scene) {}

  get isOpen(): boolean { return this.options !== null; }

  ownsKey(event: KeyboardEvent): boolean { return this.consumedKeys.has(event); }

  get selectedPart(): BodyPart | undefined {
    const choice = this.choices.find((entry) => entry.id === this.selectedId);
    return this.options ? getBodyPart(this.options.monster, choice?.bodyPartId) : undefined;
  }

  open(options: BodyTargetOptions): void {
    this.close();
    this.options = options;
    this.choices = getBodyTargetChoices(options.monster, options.damageType, options.discoveries);
    this.selectedId = "whole";
    this.page = 0;
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.createElement("div");
    root.id = "battle-body-accessibility";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "battle-body-title");
    root.setAttribute("aria-describedby", "battle-body-content");
    Object.assign(root.style, {
      position: "fixed", width: "1px", height: "1px", overflow: "hidden", clipPath: "inset(50%)",
    });
    document.body.append(root);
    this.root = root;
    window.addEventListener("keydown", this.handleKeyDown, true);
    window.addEventListener("keyup", this.handleKeyUp, true);
    window.addEventListener("blur", this.handleWindowBlur, true);
    window.addEventListener("gamepaddisconnected", this.clearPendingActivation, true);
    document.addEventListener("visibilitychange", this.clearPendingActivation, true);
    this.scene.scale.on("resize", this.render, this);
    this.unsubscribePreferences = gamePreferences.subscribe(() => this.render());
    this.unsubscribePrompts = inputPromptSource.subscribe(() => this.render());
    this.render();
  }

  close(): void {
    window.removeEventListener("keydown", this.handleKeyDown, true);
    window.removeEventListener("keyup", this.handleKeyUp, true);
    window.removeEventListener("blur", this.handleWindowBlur, true);
    window.removeEventListener("gamepaddisconnected", this.clearPendingActivation, true);
    document.removeEventListener("visibilitychange", this.clearPendingActivation, true);
    this.scene.scale.off("resize", this.render, this);
    this.unsubscribePreferences?.();
    this.unsubscribePrompts?.();
    this.unsubscribePreferences = null;
    this.unsubscribePrompts = null;
    this.container?.destroy(true);
    this.container = null;
    this.root?.remove();
    this.root = null;
    const wasOpen = this.isOpen;
    this.options = null;
    this.choices = [];
    this.pendingActivation = null;
    if (wasOpen) this.scene.input.keyboard?.resetKeys();
    if (this.previousFocus?.isConnected) this.previousFocus.focus({ preventScroll: true });
    this.previousFocus = null;
    if (this.scene.game?.canvas) delete this.scene.game.canvas.dataset.bodyTarget;
    if (this.scene.game?.canvas) delete this.scene.game.canvas.dataset.bodyTargetMarker;
  }

  private render(): void {
    const options = this.options;
    if (!options) return;
    this.container?.destroy(true);
    const rows = [
      ...this.choices.map((choice) => ({
        ...choice, enabled: true, activate: () => this.activate(choice.id),
      })),
      {
        id: "cancel", label: "Back to enemy selection", description: "No action or MP spent.",
        enabled: true, activate: () => this.activate("cancel"),
      },
    ];
    const title = `${options.label}: ${options.targetLabel} (${options.monster.size ?? "medium"})`;
    const result = createBattleActionMenu(this.scene, {
      kind: "body", entries: rows, page: this.page, selectedId: this.selectedId,
      title, footer: PROMPTS[getInputPromptSource()],
      onSelect: (id) => this.select(id),
      onPageChange: (page) => {
        this.page = page;
        this.selectedId = this.pages[page]?.[0] ?? "whole";
        this.render();
      },
    });
    this.container = result.container;
    this.page = result.page;
    this.pages = result.pages;
    const root = this.root;
    if (root) {
      root.replaceChildren();
      const heading = document.createElement("h2");
      heading.id = "battle-body-title";
      heading.textContent = title;
      const content = document.createElement("p");
      content.id = "battle-body-content";
      content.textContent = "Parts share monster HP. Aim trades accuracy for local defenses and temporary effects.";
      root.append(heading, content);
      for (const row of rows) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.bodyPart = row.id;
        button.textContent = `${row.label}. ${row.description}`;
        button.addEventListener("focus", () => this.select(row.id));
        button.addEventListener("click", () => this.activate(row.id));
        root.append(button);
      }
    }
    this.select(this.selectedId);
    publishSceneLayoutReport(this.scene);
  }

  private select(id: string): void {
    if (id !== this.selectedId) this.pendingActivation = null;
    this.selectedId = id;
    const targetPage = this.pages.findIndex((ids) => ids.includes(id));
    if (targetPage >= 0 && targetPage !== this.page) {
      this.page = targetPage;
      this.render();
      return;
    }
    for (const child of this.container?.list ?? []) {
      if (!(child instanceof Phaser.GameObjects.Text)) continue;
      const layoutId: unknown = child.getData("layoutId");
      const choice = this.choices.find((entry) => layoutId === `battle-body-${entry.id}`);
      const label = choice?.label ?? (layoutId === "battle-body-cancel" ? "Back to enemy selection" : undefined);
      if (!label) continue;
      const selected = layoutId === `battle-body-${id}`;
      child.setText(`${selected ? "> " : "  "}${label}`)
        .setBackgroundColor(selected ? "#465577" : "")
        .setColor(selected ? "#ffd700" : "#dde7f4");
      syncInteractiveHitArea(child);
    }
    const focused = this.root?.querySelector<HTMLButtonElement>(`[data-body-part="${id}"]`);
    if (focused && document.activeElement !== focused) focused.focus({ preventScroll: true });
    this.options?.select(this.selectedPart);
    const pane = this.container?.getBounds();
    this.scene.game.canvas.dataset.bodyTarget = JSON.stringify({
      monsterId: this.options?.monster.id, targetId: this.options?.targetId, selectedId: id,
      page: this.page, part: this.selectedPart?.anchor,
      pane: pane ? { x: pane.x, y: pane.y, width: pane.width, height: pane.height } : undefined,
    });
  }

  private activate(id: string): void {
    const options = this.options;
    if (!options) return;
    const choice = this.choices.find((entry) => entry.id === id);
    if (!choice && id !== "cancel") return;
    this.close();
    if (id === "cancel") options.cancel();
    else options.confirm(choice?.bodyPartId);
  }

  private readonly clearPendingActivation = (): void => { this.pendingActivation = null; };
  private readonly handleWindowBlur = (event: Event): void => {
    if (event.target === window) this.clearPendingActivation();
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.isOpen || event.target instanceof HTMLInputElement
      || event.target instanceof HTMLTextAreaElement) return;
    const ids = [...this.choices.map((choice) => choice.id), "cancel"];
    const backward = ["ArrowUp", "ArrowLeft", "w", "W", "a", "A"].includes(event.key)
      || (event.key === "Tab" && event.shiftKey);
    const forward = ["ArrowDown", "ArrowRight", "s", "S", "d", "D", "Tab"].includes(event.key);
    if (!backward && !forward && !["Home", "End", "Escape", "Enter", " "].includes(event.key)) return;
    this.consumedKeys.add(event);
    if (backward || forward) {
      const index = Math.max(0, ids.indexOf(this.selectedId));
      this.select(ids[(index + (backward ? -1 : 1) + ids.length) % ids.length]!);
    } else if (event.key === "Home" || event.key === "End") {
      this.select(event.key === "Home" ? ids[0]! : ids[ids.length - 1]!);
    } else if (event.key === "Escape") {
      this.activate("cancel");
    } else if (event.key === "Enter" || event.key === " ") {
      if (!event.repeat) this.pendingActivation = this.selectedId;
    } else return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    this.consumedKeys.add(event);
    const id = this.pendingActivation;
    this.pendingActivation = null;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (id) this.activate(id);
  };
}
