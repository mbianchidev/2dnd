import * as Phaser from "phaser";
import {
  CUSTOM_NUMERIC_DIFFICULTY_RULES,
  getDifficultyProfile,
} from "../data/difficulty";
import type { CustomDifficultyOverrides, DifficultySelection } from "../data/difficulty";
import {
  areDifficultySelectionsEqual,
  createCampaignDifficulty,
  getCampaignDifficultyEligibility,
  getDifficultyAchievementEligibility,
  getDifficultyEffectChanges,
  getDifficultyEffectPreview,
} from "../systems/difficulty";
import type { DifficultyEffectPreview } from "../systems/difficulty";
import {
  adjustCustomDifficultyRule,
  cycleDifficultyProfile,
  type DifficultyEditorRuleId,
} from "../systems/difficultyEditor";
import { gamePreferences } from "../systems/accessibility";
import {
  moveSpatialLayoutFocus,
  restoreLayoutFocus,
  type GridNavigationDirection,
} from "../systems/layout";
import type { PlayerState } from "../systems/player";
import { getScaledBounds, layoutTextStack, syncInteractiveHitArea } from "./layout";
import {
  calcPanelLayout,
  createDimGraphics,
  createOverlayContainer,
  createPanelGraphics,
} from "../utils/ui";

export interface DifficultyOverlayFeedback {
  ok: boolean;
  message: string;
}

export interface DifficultyOverlayOptions {
  selection: DifficultySelection;
  campaign?: PlayerState;
  apply?(selection: DifficultySelection): DifficultyOverlayFeedback;
  onClose?(): void;
  onStateChange?(): void;
}

interface DifficultyControl {
  id: string;
  label: string;
  text: Phaser.GameObjects.Text;
  activate(): void;
  adjust?(direction: -1 | 1): void;
}

const PAGE_SIZE = 3;

export class DifficultyOverlayManager {
  private container: Phaser.GameObjects.Container | null = null;
  private options: DifficultyOverlayOptions | null = null;
  private selection: DifficultySelection = { profileId: "standard" };
  private custom: CustomDifficultyOverrides = {};
  private page = 0;
  private focusedId: string | undefined = "difficulty-profile";
  private controls: DifficultyControl[] = [];
  private confirming = false;
  private status = "";
  private focusBorder: Phaser.GameObjects.Graphics | null = null;
  private accessibleDialog: HTMLDivElement | null = null;
  private previousFocus: HTMLElement | null = null;
  private pendingActivation: { eventName: string; handler: () => void } | null = null;
  private readonly unsubscribePreferences: () => void;

  constructor(private readonly scene: Phaser.Scene) {
    this.unsubscribePreferences = gamePreferences.subscribe(() => {
      if (this.isOpen()) this.render();
    });
    if (!scene.events) {
      this.unsubscribePreferences();
      return;
    }
    scene.events.on("postupdate", this.syncHitAreas, this);
    scene.events.once("shutdown", () => this.destroy());
  }

  isOpen(): boolean { return this.options !== null; }

  open(options: DifficultyOverlayOptions): void {
    this.close(false);
    this.options = options;
    this.selection = options.selection;
    this.custom = options.selection.profileId === "custom" ? options.selection.overrides ?? {} : {};
    this.page = 0;
    this.focusedId = "difficulty-profile";
    this.confirming = false;
    this.status = "";
    this.previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.scene.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.render();
  }

  close(notify = true): void {
    const onClose = notify ? this.options?.onClose : undefined;
    const onStateChange = this.options?.onStateChange;
    this.clearPendingActivation();
    this.scene.input.keyboard?.off("keydown", this.handleKeyDown, this);
    this.scene.input.keyboard?.resetKeys();
    this.container?.destroy();
    this.container = null;
    this.options = null;
    this.controls = [];
    this.focusBorder = null;
    this.accessibleDialog?.remove();
    this.accessibleDialog = null;
    if (this.previousFocus?.isConnected) this.previousFocus.focus({ preventScroll: true });
    this.previousFocus = null;
    onClose?.();
    onStateChange?.();
  }

  destroy(): void {
    this.close(false);
    this.unsubscribePreferences();
    this.scene.events?.off("postupdate", this.syncHitAreas, this);
  }

  getDebugState(): string {
    if (!this.options) return "";
    return ` [DIFFICULTY] [RULE_PROFILE:${this.selection.profileId}]`
      + ` [RULE_PAGE:${this.page + 1}] [RULE_FOCUS:${this.focusedId ?? "-"}]`
      + ` [RULE_PHASE:${this.confirming ? "confirm" : this.options.apply ? "edit" : "inspect"}]`;
  }

  private render(): void {
    const options = this.options;
    if (!options) return;
    this.clearPendingActivation();
    this.container?.destroy();
    this.controls = [];
    const panel = calcPanelLayout(this.scene, 600, 490, 0, {
      top: 12, right: 12, bottom: 12, left: 12,
    });
    const { px, py, panelW, panelH } = panel;
    const width = panelW - 36;
    const x = px + 18;
    const container = createOverlayContainer(this.scene, "difficulty", 98, {
      x: px, y: py, width: panelW, height: panelH,
    });
    this.container = container;
    const dim = createDimGraphics(this.scene, panel.w, panel.h, 0.82).setInteractive(
      new Phaser.Geom.Rectangle(0, 0, panel.w, panel.h), Phaser.Geom.Rectangle.Contains,
    );
    dim.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.x < px || pointer.x > px + panelW || pointer.y < py || pointer.y > py + panelH) {
        this.cancel();
      }
    });
    container.add([dim, createPanelGraphics(this.scene, px, py, panelW, panelH)]);
    const profile = getDifficultyProfile(this.selection.profileId);
    const title = this.addText("difficulty-title", x, py + 12,
      options.campaign ? `Campaign Rules (current: ${getDifficultyProfile(options.selection.profileId).name})`
        : "Campaign Rules",
      width, 15, "#ffdf66");
    const description = this.addText(
      "difficulty-description", x, 0,
      this.confirming ? "Confirm this change. Preset challenge continuity cannot be restored."
        : profile.description,
      width, 10,
    );
    const profileLabel = `< ${options.campaign ? "Preview" : "Profile"}: ${profile.name} >`;
    const profileText = this.confirming
      ? this.addText("difficulty-profile", x, 0, profileLabel, width, 11)
      : this.addControl(
        "difficulty-profile", x, 0, width, profileLabel,
        () => this.changeProfile(1), (direction) => this.changeProfile(direction),
      ).text;
    const headerHeight = layoutTextStack([title, description, profileText], {
      x, y: py + 12, width, gap: 12, hitAreaPadding: 8,
    });
    const preview = this.getPreview();
    this.page = Math.min(this.page, Math.ceil(preview.length / PAGE_SIZE) - 1);
    const rows: Phaser.GameObjects.Text[] = [];
    if (!this.confirming) {
      for (const effect of preview.slice(this.page * PAGE_SIZE, (this.page + 1) * PAGE_SIZE)) {
        const bounds = CUSTOM_NUMERIC_DIFFICULTY_RULES.find((rule) => rule.id === effect.id);
        const label = `${effect.label}: ${effect.value}`
          + (bounds ? ` [${bounds.minimum}..${bounds.maximum}${bounds.unit}]` : "");
        const editable = this.selection.profileId === "custom"
          && !effect.id.startsWith("history");
        if (editable) {
          const id = this.editorRuleId(effect.id);
          rows.push(this.addControl(
            `difficulty-rule-${effect.id}`, x, 0, width,
            `${label}  < / >`,
            () => this.changeRule(id, 1),
            (direction) => this.changeRule(id, direction),
          ).text);
        } else {
          rows.push(this.addText(`difficulty-effect-${effect.id}`, x, 0, label, width, 11));
        }
      }
    } else {
      const changes = getDifficultyEffectChanges(options.selection, this.selection);
      const changedLines = changes.slice(0, 3).map((change) =>
        `${change.label}: ${change.from} -> ${change.to}`);
      rows.push(this.addText(
        "difficulty-confirm-summary", x, 0,
        `Current: ${getDifficultyProfile(options.selection.profileId).name}\n`
          + `Selected: ${profile.name}\n`
          + (changedLines.length > 0 ? `${changedLines.join("\n")}\n` : "")
          + (changes.length > 3 ? `Plus ${changes.length - 3} effects shown in the preview.\n` : "")
          + "No existing outcomes or rewards are replayed.",
        width, 11,
      ));
    }
    const rowY = py + 12 + headerHeight + 14;
    const rowHeight = layoutTextStack(rows, { x, y: rowY, width, gap: 18, hitAreaPadding: 8 });
    let nextY = rowY + rowHeight + 20;
    const halfWidth = (width - 24) / 2;
    if (!this.confirming) {
      const previous = this.addControl("difficulty-page-previous", x, nextY, halfWidth,
        "< Effects", () => this.changePage(-1));
      const next = this.addControl("difficulty-page-next", x + halfWidth + 24, nextY, halfWidth,
        `Effects ${this.page + 1}/${Math.ceil(preview.length / PAGE_SIZE)} >`, () => this.changePage(1));
      nextY += Math.max(previous.text.displayHeight, next.text.displayHeight) + 18;
    }
    if (options.apply) {
      const apply = this.addControl("difficulty-apply", x, nextY, halfWidth,
        this.confirming ? "Confirm change" : options.campaign ? "Review change" : "Use these rules",
        () => this.apply());
      const cancel = this.addControl("difficulty-close", x + halfWidth + 24, nextY, halfWidth,
        this.confirming ? "Back" : "Cancel", () => this.cancel());
      nextY += Math.max(apply.text.displayHeight, cancel.text.displayHeight) + 14;
    } else {
      const close = this.addControl("difficulty-close", x, nextY, width, "Close preview", () => this.close());
      nextY += close.text.displayHeight + 14;
    }
    const eligibility = options.campaign
      ? getCampaignDifficultyEligibility(options.campaign)
      : getDifficultyAchievementEligibility(createCampaignDifficulty(this.selection));
    const note = this.addText(
      "difficulty-eligibility", x, nextY,
      this.status || eligibility.reason,
      width, 9, "#e5eef6",
    );
    nextY += note.displayHeight + 8;
    const limits = this.addText(
      "difficulty-limits", x, nextY,
      "Land/sea encounters <=15%; World Events <=8%. Gates and gathering inputs unchanged.\n"
        + "Adjusted costs round up; rewards/resale down. Timing stays opt-in.",
      width, 8, "#c5d5ee",
    );
    this.focusBorder = this.scene.add.graphics();
    container.add(this.focusBorder);
    const focus = restoreLayoutFocus(this.controls.map((control) => ({
      id: control.id, visible: true, enabled: true,
    })), this.focusedId, 0);
    this.focusedId = focus.items[focus.index]?.id;
    this.updateFocus();
    this.renderAccessibleDialog(eligibility.reason);
    if (nextY + limits.displayHeight > py + panelH - 4) {
      throw new Error("[difficulty] Rules content exceeds its measured viewport.");
    }
    options.onStateChange?.();
  }

  private editorRuleId(id: string): DifficultyEditorRuleId {
    const numeric = CUSTOM_NUMERIC_DIFFICULTY_RULES.find((rule) => rule.id === id);
    if (numeric) return numeric.id;
    if (id === "enemyAiPolicy" || id === "defeatXpPenalty" || id === "timedRoundDurationSeconds") return id;
    throw new Error(`[difficulty] Unknown editor row: ${id}`);
  }

  private getPreview(): readonly DifficultyEffectPreview[] {
    const effects = getDifficultyEffectPreview(this.selection);
    const state = this.options?.campaign?.difficulty;
    if (!state) return effects;
    return [
      ...effects,
      {
        id: "historySummary", label: "Recorded rule changes",
        value: `${state.changeCount}; initial ${getDifficultyProfile(state.initialProfileId).name}`,
      },
      ...state.history.map((cause) => ({
        id: `history-${cause.sequence}`,
        label: `Change ${cause.sequence}, step ${cause.timeStep}`,
        value: `${getDifficultyProfile(cause.from.profileId).name} -> `
          + `${getDifficultyProfile(cause.to.profileId).name}, explicitly confirmed`,
      })),
    ];
  }

  private addText(
    id: string, x: number, y: number, label: string, width: number,
    fontSize: number, color = "#f4f1e8",
  ): Phaser.GameObjects.Text {
    const text = this.scene.add.text(x, y, label, {
      fontFamily: "monospace", fontSize: `${fontSize}px`, color,
      wordWrap: { width }, lineSpacing: 2,
    });
    text.setData("layoutId", id);
    this.container?.add(text);
    return text;
  }

  private addControl(
    id: string, x: number, y: number, width: number, label: string,
    activate: () => void, adjust?: (direction: -1 | 1) => void,
  ): DifficultyControl {
    const text = this.scene.add.text(x, y, `  ${label}`, {
      fontFamily: "monospace", fontSize: "11px", color: "#ffffff",
      backgroundColor: "#273650", padding: { x: 10, y: 8 },
      wordWrap: { width: width - 20 }, lineSpacing: 2,
    }).setInteractive({ useHandCursor: true });
    text.setData("layoutId", id);
    text.on("pointerover", () => {
      this.focusedId = id;
      this.updateFocus();
      this.options?.onStateChange?.();
    });
    text.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (adjust) {
        const bounds = getScaledBounds(text);
        adjust(pointer.x < bounds.x + bounds.width / 2 ? -1 : 1);
      } else activate();
    });
    this.container?.add(text);
    const control: DifficultyControl = { id, label, text, activate, adjust };
    this.controls.push(control);
    syncInteractiveHitArea(text, 8);
    return control;
  }

  private updateFocus(): void {
    this.focusBorder?.clear();
    this.controls.forEach((control) => {
      const selected = control.id === this.focusedId;
      control.text.setText(`${selected ? "> " : "  "}${control.label}`);
      syncInteractiveHitArea(control.text, 8);
      if (selected && this.focusBorder) {
        const bounds = getScaledBounds(control.text);
        this.focusBorder.lineStyle(2, 0xffffff, 1)
          .strokeRect(bounds.x - 3, bounds.y - 3, bounds.width + 6, bounds.height + 6);
      }
    });
    this.focusAccessibleControl();
  }

  private focusAccessibleControl(): void {
    if (!this.accessibleDialog?.contains(document.activeElement)) return;
    const button = [...this.accessibleDialog.querySelectorAll("button")].find(
      (entry) => entry.dataset.ruleControl === this.focusedId,
    );
    if (button && button !== document.activeElement) button.focus({ preventScroll: true });
  }

  private syncHitAreas(): void {
    this.controls.forEach((control) => syncInteractiveHitArea(control.text, 8));
  }

  private changeProfile(direction: -1 | 1): void {
    if (this.confirming) return;
    if (this.selection.profileId === "custom") this.custom = this.selection.overrides ?? {};
    this.selection = cycleDifficultyProfile(this.selection, direction, this.custom);
    this.status = "";
    this.page = 0;
    this.render();
  }

  private changeRule(id: DifficultyEditorRuleId, direction: -1 | 1): void {
    const before = this.selection;
    this.selection = adjustCustomDifficultyRule(this.selection, id, direction);
    this.status = areDifficultySelectionsEqual(before, this.selection)
      ? "This rule is at its allowed bound." : "";
    this.render();
  }

  private changePage(direction: -1 | 1): void {
    const count = Math.ceil(this.getPreview().length / PAGE_SIZE);
    this.page = (this.page + direction + count) % count;
    this.render();
  }

  private apply(): void {
    const options = this.options;
    if (!options?.apply) return;
    if (options.campaign && !this.confirming
        && !areDifficultySelectionsEqual(options.selection, this.selection)) {
      this.confirming = true;
      this.focusedId = "difficulty-apply";
      this.render();
      return;
    }
    const result = options.apply(this.selection);
    if (result.ok) this.close();
    else {
      this.status = result.message;
      this.render();
    }
  }

  private cancel(): void {
    if (this.confirming) {
      this.confirming = false;
      this.status = "";
      this.render();
    } else this.close();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.options || event.repeat && (event.key === "Enter" || event.key === " ")) return;
    const control = this.controls.find((entry) => entry.id === this.focusedId);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.cancel();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      if (!control || this.pendingActivation) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const eventName = event.key === " " ? "keyup-SPACE" : "keyup-ENTER";
      const handler = (): void => {
        this.pendingActivation = null;
        control.activate();
      };
      this.pendingActivation = { eventName, handler };
      this.scene.input.keyboard?.once(eventName, handler);
      return;
    }
    const direction: GridNavigationDirection | undefined =
      event.key === "ArrowUp" || event.key.toLowerCase() === "w" ? "up"
        : event.key === "ArrowDown" || event.key.toLowerCase() === "s" ? "down"
        : event.key === "ArrowLeft" || event.key.toLowerCase() === "a" ? "left"
        : event.key === "ArrowRight" || event.key.toLowerCase() === "d" ? "right" : undefined;
    if (!direction) return;
    event.preventDefault();
    if (control?.adjust && (direction === "left" || direction === "right")) {
      control.adjust(direction === "left" ? -1 : 1);
      return;
    }
    this.focusedId = moveSpatialLayoutFocus(this.controls.map((entry) => ({
      id: entry.id, visible: true, enabled: true, bounds: getScaledBounds(entry.text),
    })), this.focusedId, direction);
    this.updateFocus();
    this.options.onStateChange?.();
  };

  private clearPendingActivation(): void {
    if (!this.pendingActivation) return;
    this.scene.input.keyboard?.off(this.pendingActivation.eventName, this.pendingActivation.handler);
    this.pendingActivation = null;
  }

  private renderAccessibleDialog(eligibility: string): void {
    const hadFocus = this.accessibleDialog?.contains(document.activeElement) ?? false;
    this.accessibleDialog?.remove();
    const dialog = document.createElement("div");
    dialog.id = "difficulty-accessible-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "difficulty-accessible-title");
    Object.assign(dialog.style, {
      position: "fixed", width: "1px", height: "1px", overflow: "hidden",
      clipPath: "inset(50%)", whiteSpace: "nowrap",
    });
    const title = document.createElement("h2");
    title.id = "difficulty-accessible-title";
    title.textContent = "Campaign rules";
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.setAttribute("aria-atomic", "true");
    status.textContent = this.status || eligibility;
    dialog.append(title, status);
    for (const control of this.controls) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.ruleControl = control.id;
      button.textContent = control.label;
      button.addEventListener("focus", () => {
        this.focusedId = control.id;
        this.updateFocus();
        this.options?.onStateChange?.();
      });
      button.addEventListener("click", () => control.activate());
      button.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
      });
      button.addEventListener("keyup", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        control.activate();
      });
      dialog.append(button);
    }
    dialog.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      const buttons = [...dialog.querySelectorAll("button")];
      const active = document.activeElement;
      const index = active instanceof HTMLButtonElement ? buttons.indexOf(active) : -1;
      const next = (Math.max(0, index) + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
      event.preventDefault();
      buttons[next]?.focus({ preventScroll: true });
    });
    document.body.append(dialog);
    this.accessibleDialog = dialog;
    if (hadFocus || this.previousFocus !== null) {
      const button = [...dialog.querySelectorAll("button")].find(
        (entry) => entry.dataset.ruleControl === this.focusedId,
      );
      button?.focus({ preventScroll: true });
    }
  }
}
