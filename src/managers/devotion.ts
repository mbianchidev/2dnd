import * as Phaser from "phaser";
import {
  DEITY_IDS,
  TEMPLE_CONVERSATIONS,
  getDeity,
  getTemple,
  type DeityId,
  type TempleId,
} from "../data/devotion";
import { QUESTS } from "../data/quests";
import { gamePreferences } from "../systems/accessibility";
import {
  getDevotionHistoryLines,
  getDevotionProfileLines,
  getDevotionRites,
  getDeityTenetLines,
} from "../systems/devotionProfile";
import type { DevotionMutationResult } from "../systems/devotion";
import {
  getAdjacentDevotionTemple,
  getTempleGreeting,
  isAtDevotionTemple,
  performTempleRite,
  resolveTempleConversation,
  visitDevotionTemple,
} from "../systems/devotionTemples";
import {
  getInputPromptSource,
  inputPromptSource,
} from "../systems/input";
import {
  layoutResponsiveGrid,
  moveGridSelection,
  paginateMeasuredItems,
  restoreLayoutFocus,
  type GridNavigationDirection,
} from "../systems/layout";
import type { PlayerState } from "../systems/player";
import type { SocialMutationResult } from "../systems/reputation";
import { layoutTextStack, syncInteractiveHitArea } from "./layout";
import { DevotionAccessibility } from "./devotionAccessibility";
import { DevotionPromptRenderer } from "../renderers/devotionPrompt";
import {
  calcPanelLayout,
  createDimGraphics,
  createOverlayContainer,
  createPanelGraphics,
} from "../utils/ui";

type DevotionView = "profile" | "pantheon" | "rites" | "keeper" | "history" | "confirmation";

interface DevotionAction {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly activate: () => void;
}

export interface DevotionManagerCallbacks {
  canVisitTemple(): boolean;
  onMutation(result: DevotionMutationResult & { socialEffect?: SocialMutationResult }): void;
  offerQuest(templeId: TempleId): void;
  affiliationConsequences(target: DeityId | null): string;
  changeAffiliation(
    templeId: TempleId,
    target: DeityId | null,
    expectedDeity: DeityId | null,
    expectedScore: number,
  ): DevotionMutationResult;
  onClose(): void;
}

const VIEW_LABELS: Readonly<Record<DevotionView, string>> = {
  profile: "Profile", pantheon: "Pantheon", rites: "Available rites",
  keeper: "The keeper's choice", history: "Recent causes", confirmation: "Confirm affiliation",
};

export class DevotionManager {
  private container: Phaser.GameObjects.Container | null = null;
  private player: PlayerState | null = null;
  private templeId: TempleId | null = null;
  private view: DevotionView = "profile";
  private selectedDeity: DeityId = "orivane";
  private selectedAction = "";
  private actions: readonly DevotionAction[] = [];
  private readonly buttons = new Map<string, Phaser.GameObjects.Text>();
  private columns = 2;
  private page = 0;
  private pageCount = 1;
  private message = "";
  private pending: { target: DeityId | null; expectedDeity: DeityId | null; expectedScore: number } | null = null;
  private pendingActivation: string | null = null;
  private unsubscribePreferences: (() => void) | null = null;
  private unsubscribePrompts: (() => void) | null = null;
  private readonly accessibility: DevotionAccessibility;
  private readonly visitPrompt: DevotionPromptRenderer;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly callbacks: DevotionManagerCallbacks,
  ) {
    this.accessibility = new DevotionAccessibility(
      (id) => this.selectAction(id),
      (id) => this.activateAction(id),
    );
    this.visitPrompt = new DevotionPromptRenderer(scene, () => {
      const player = this.promptPlayer;
      const temple = player ? getAdjacentDevotionTemple(player.position) : undefined;
      if (player && temple && !this.isOpen() && this.callbacks.canVisitTemple()) {
        this.openTemple(player, temple.id);
      }
    });
  }

  private promptPlayer: PlayerState | null = null;

  updateVisitPrompt(player: PlayerState, blocked: boolean): void {
    this.promptPlayer = blocked ? null : player;
    this.visitPrompt.update(player, blocked);
  }

  isOpen(): boolean { return this.player !== null; }

  openProfile(player: PlayerState): void {
    this.open(player, getAdjacentDevotionTemple(player.position)?.id ?? null);
  }

  openTemple(player: PlayerState, templeId: TempleId): void {
    if (!isAtDevotionTemple(player, templeId)) {
      this.callbacks.onMutation({ changed: false, delta: 0, message: "Approach this temple's marked site first." });
      return;
    }
    this.open(player, templeId);
    const result = visitDevotionTemple(player, templeId);
    if (result.changed) {
      this.message = result.message;
      this.callbacks.onMutation(result);
    }
    this.render();
  }

  private open(player: PlayerState, templeId: TempleId | null): void {
    this.close();
    this.visitPrompt.clear();
    this.player = player;
    this.templeId = templeId;
    this.view = "profile";
    this.page = 0;
    this.selectedAction = "";
    this.message = "";
    this.selectedDeity = player.progression.devotion.deityId
      ?? (templeId ? getTemple(templeId).deityId : "orivane");
    this.accessibility.open();
    this.scene.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.scene.input.keyboard?.on("keyup", this.handleKeyUp, this);
    this.scene.scale.on("resize", this.render, this);
    this.unsubscribePreferences = gamePreferences.subscribe(() => this.render());
    this.unsubscribePrompts = inputPromptSource.subscribe(() => this.render());
    this.render();
  }

  close(): void {
    const wasOpen = this.player !== null;
    this.scene.input.keyboard?.off("keydown", this.handleKeyDown, this);
    this.scene.input.keyboard?.off("keyup", this.handleKeyUp, this);
    this.scene.scale.off("resize", this.render, this);
    this.unsubscribePreferences?.();
    this.unsubscribePrompts?.();
    this.unsubscribePreferences = null;
    this.unsubscribePrompts = null;
    this.container?.destroy(true);
    this.container = null;
    this.player = null;
    this.pending = null;
    this.pendingActivation = null;
    this.actions = [];
    this.buttons.clear();
    this.accessibility.close();
    if (wasOpen) this.scene.input.keyboard?.resetKeys();
    if (wasOpen) this.callbacks.onClose();
  }

  cancel(): void {
    if (this.view === "confirmation") {
      this.pending = null;
      this.showView("pantheon");
    } else {
      this.close();
    }
  }

  destroy(): void {
    this.close();
    this.visitPrompt.clear();
    this.promptPlayer = null;
  }

  getDebugState(): string {
    if (!this.player) return "";
    const state = this.player.progression.devotion;
    return ` [DEVOTION:${this.templeId ?? "profile"} View:${this.view} Affiliation:${state.deityId ?? "none"} Score:${state.score} Figure:${this.selectedDeity} Page:${this.page + 1}/${this.pageCount} Action:${this.selectedAction}]`;
  }

  private showView(view: DevotionView): void {
    this.view = view;
    this.page = 0;
    this.selectedAction = "";
    this.message = "";
    this.pendingActivation = null;
    this.render();
  }

  private getLines(): readonly string[] {
    return [...(this.message ? [`Result: ${this.message}`] : []), ...this.getViewLines()];
  }

  private getViewLines(): readonly string[] {
    const player = this.player!;
    const temple = this.templeId ? getTemple(this.templeId) : null;
    if (this.view === "profile") {
      return [
        ...(temple ? [temple.description] : []),
        ...getDevotionProfileLines(player),
      ];
    }
    if (this.view === "pantheon") {
      const deity = getDeity(this.selectedDeity);
      return [
        `${deity.name}, ${deity.epithet}. ${deity.description}`,
        ...getDeityTenetLines(deity.id),
        this.templeId
          ? "Choose one figure here, or remain unaffiliated. Every alignment is welcome."
          : "Visit a temple to choose or change affiliation; browsing does not make a choice.",
      ];
    }
    if (this.view === "history") return getDevotionHistoryLines(player);
    if (this.view === "rites") {
      return temple ? getDevotionRites(player, temple.id).map((rite) =>
        `${rite.available ? "[Available]" : "[Unavailable]"} ${rite.definition.name}: ${rite.reason}`)
        : ["Visit a marked temple site to perform its two optional rites. All visitors receive the same blessing and normal short-rest rules."];
    }
    if (this.view === "keeper" && temple) {
      const conversation = TEMPLE_CONVERSATIONS.find((entry) => entry.templeId === temple.id)!;
      return [
        getTempleGreeting(player, temple),
        conversation.prompt,
        "Offering a place is once here: +4 devotion if followed, Good/Evil +2 and town reputation +2. Refusing changes none of those states.",
        `Optional quest: ${QUESTS[temple.questId].name}. ${QUESTS[temple.questId].summary}`,
      ];
    }
    return this.pending ? [
      `Choose ${this.pending.target ? getDeity(this.pending.target).name : "no affiliation"}?`,
      this.callbacks.affiliationConsequences(this.pending.target),
      "Your canonical quests, rewards, alignment and reputation will not change. Cancel keeps your current choice.",
    ] : [];
  }

  private getActions(): DevotionAction[] {
    const player = this.player!;
    const temple = this.templeId ? getTemple(this.templeId) : null;
    const action = (id: string, label: string, activate: () => void, enabled = true): DevotionAction =>
      ({ id, label, activate, enabled });
    const back = action("back", "Back to profile", () => this.showView("profile"));
    const close = action("close", "Close", () => this.close());
    if (this.view === "confirmation") return [
      action("confirm-affiliation", "Confirm this choice", () => this.confirmAffiliation()),
      action("cancel-affiliation", "Keep current choice", () => {
        this.pending = null;
        this.showView("pantheon");
      }),
    ];
    if (this.view === "pantheon") return [
      action("previous-figure", "Previous figure", () => this.cycleDeity(-1)),
      action("next-figure", "Next figure", () => this.cycleDeity(1)),
      action("follow", `Follow ${getDeity(this.selectedDeity).name}`, () => this.askAffiliation(this.selectedDeity),
        !!temple && player.progression.devotion.deityId !== this.selectedDeity),
      action("unaffiliate", "Choose no affiliation", () => this.askAffiliation(null),
        !!temple && player.progression.devotion.deityId !== null),
      back, close,
    ];
    if (this.view === "rites") return [
      ...(temple ? getDevotionRites(player, temple.id).map((rite) =>
        action(`rite-${rite.definition.id}`, rite.definition.name, () =>
          this.mutate(performTempleRite(player, rite.definition.id)), rite.available)) : []),
      back, close,
    ];
    if (this.view === "keeper" && temple) {
      const conversation = TEMPLE_CONVERSATIONS.find((entry) => entry.templeId === temple.id)!;
      return [
        ...conversation.choices.map((choice) => action(
          `choice-${choice.id}`, choice.label,
          () => this.mutate(resolveTempleConversation(player, temple.id, choice.id)),
          !choice.sourceId || !player.progression.devotion.appliedSourceIds.includes(choice.sourceId),
        )),
        action("offer-quest", `Help: ${QUESTS[temple.questId].name}`, () => {
          this.callbacks.offerQuest(temple.id);
          this.render();
        }, player.progression.quests.quests[temple.questId].status === "locked"),
        back, close,
      ];
    }
    if (this.view === "history") return [back, close];
    return [
      action("pantheon", "Browse pantheon", () => this.showView("pantheon")),
      action("rites", "Available rites", () => this.showView("rites")),
      ...(temple ? [action("keeper", "Speak with keeper", () => this.showView("keeper"))] : []),
      action("history", "Recent causes", () => this.showView("history")),
      close,
    ];
  }

  private askAffiliation(target: DeityId | null): void {
    if (!this.player || !this.templeId) return;
    this.pending = {
      target, expectedDeity: this.player.progression.devotion.deityId,
      expectedScore: this.player.progression.devotion.score,
    };
    this.showView("confirmation");
  }

  private confirmAffiliation(): void {
    const pending = this.pending;
    if (!pending || !this.templeId) return;
    this.pending = null;
    const result = this.callbacks.changeAffiliation(
      this.templeId, pending.target, pending.expectedDeity, pending.expectedScore,
    );
    this.view = "profile";
    this.page = 0;
    this.mutate(result);
  }

  private cycleDeity(direction: -1 | 1): void {
    const index = DEITY_IDS.indexOf(this.selectedDeity);
    this.selectedDeity = DEITY_IDS[(index + direction + DEITY_IDS.length) % DEITY_IDS.length];
    this.page = 0;
    this.render();
  }

  private mutate(result: DevotionMutationResult & { socialEffect?: SocialMutationResult }): void {
    this.message = result.message;
    this.callbacks.onMutation(result);
    this.render();
    this.accessibility.announce(result.message);
  }

  private render(): void {
    const player = this.player;
    if (!player) return;
    this.container?.destroy(true);
    this.buttons.clear();
    const { w, h, px, py, panelW, panelH } = calcPanelLayout(this.scene, 608, 504, 0, {
      top: 8, right: 8, bottom: 8, left: 8,
    });
    const container = createOverlayContainer(this.scene, "devotion", 110,
      { x: px, y: py, width: panelW, height: panelH });
    this.container = container;
    const dim = createDimGraphics(this.scene, w, h, 0.8).setInteractive(
      new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains,
    );
    dim.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.x < px || pointer.x > px + panelW || pointer.y < py || pointer.y > py + panelH) {
        this.cancel();
      }
    });
    container.add([dim, createPanelGraphics(this.scene, px, py, panelW, panelH, 0.99)]);
    const titleLabel = this.templeId ? getTemple(this.templeId).name : `${player.name}'s Devotion`;
    const title = this.text(`${titleLabel}: ${VIEW_LABELS[this.view]}`, 15, panelW - 32, "#fff0ad", "devotion-title");
    const state = player.progression.devotion;
    const subtitle = this.text(
      `${state.deityId ? getDeity(state.deityId).name : "Unaffiliated"} | Devotion ${state.score}/100 | Text ${this.page + 1}/${this.pageCount}`,
      11, panelW - 32, "#e4edff", "devotion-summary",
    );
    container.add([title, subtitle]);
    const headerHeight = layoutTextStack([title, subtitle], {
      x: px + 16, y: py + 12, gap: 6, width: panelW - 32,
    });
    const prompt = {
      keyboard: "Arrows/WASD: select | Enter/Space: confirm | Esc: cancel | Tab: focus",
      pointer: "Select a button | Click outside to cancel",
      gamepad: "D-pad: select | A: confirm | B: cancel | Right stick: cursor",
      touch: "Tap a button or use D-pad | A: confirm | B: cancel",
    }[getInputPromptSource()];
    const footer = this.text(prompt, 9, panelW - 32, "#d0d9e8", "devotion-hint");
    footer.setPosition(px + 16, py + panelH - footer.displayHeight - 10);
    container.add(footer);
    const contentY = py + 12 + headerHeight + 12;
    const contentLines = this.getLines();
    const paragraphs = contentLines.map((line, index) =>
      this.text(line, 11, panelW - 32, "#ffffff", `devotion-content-${index}`));
    const baseActions = this.getActions();
    const columnWidth = (panelW - 40) / 2;
    const makeButton = (entry: DevotionAction): Phaser.GameObjects.Text => {
      const button = this.scene.add.text(0, 0, `> ${entry.label}`, {
        fontFamily: "monospace", fontSize: "11px",
        color: entry.enabled ? "#ffffff" : "#a3a8b4", backgroundColor: "#25304a",
        padding: { x: 8, y: 6 }, fixedWidth: columnWidth,
        wordWrap: { width: columnWidth - 16, useAdvancedWrap: true },
      });
      button.setData("layoutId", `devotion-action-${entry.id}`);
      if (entry.enabled) {
        button.setInteractive({ useHandCursor: true });
        button.on("pointerover", () => this.selectAction(entry.id));
        button.on("pointerdown", () => this.activateAction(entry.id));
      }
      this.buttons.set(entry.id, button);
      return button;
    };
    let actions = baseActions;
    let actionButtons = actions.map(makeButton);
    const makeGrid = (): ReturnType<typeof layoutResponsiveGrid> => layoutResponsiveGrid({
      availableWidth: panelW - 32, minColumnWidth: columnWidth,
      columnGap: 8, rowGap: 8, maxColumns: 2,
      itemHeights: actionButtons.map((button) => button.displayHeight),
    });
    let grid = makeGrid();
    const availableHeight = (): number =>
      Math.max(1, footer.y - 12 - grid.height - 12 - contentY);
    let pages = paginateMeasuredItems(paragraphs.map((text) => text.displayHeight), availableHeight(), 8);
    if (pages.length > 1) {
      const pageActions: DevotionAction[] = [
        { id: "previous-page", label: "Previous text page", enabled: true,
          activate: () => { this.page = (this.page - 1 + this.pageCount) % this.pageCount; this.render(); } },
        { id: "next-page", label: "Next text page", enabled: true,
          activate: () => { this.page = (this.page + 1) % this.pageCount; this.render(); } },
      ];
      actions = [...baseActions, ...pageActions];
      actionButtons = [...actionButtons, ...pageActions.map(makeButton)];
      grid = makeGrid();
      pages = paginateMeasuredItems(paragraphs.map((text) => text.displayHeight), availableHeight(), 8);
    }
    this.pageCount = Math.max(1, pages.length);
    this.page = Math.min(this.page, this.pageCount - 1);
    subtitle.setText(`${state.deityId ? getDeity(state.deityId).name : "Unaffiliated"} | Devotion ${state.score}/100 | Text ${this.page + 1}/${this.pageCount}`);
    const visible = new Set(pages[this.page] ?? []);
    const visibleParagraphs = paragraphs.filter((_text, index) => visible.has(index));
    paragraphs.filter((_text, index) => !visible.has(index)).forEach((text) => text.destroy());
    container.add(visibleParagraphs);
    layoutTextStack(visibleParagraphs, { x: px + 16, y: contentY, gap: 8, width: panelW - 32 });
    const actionY = footer.y - 12 - grid.height;
    actionButtons.forEach((button, index) => {
      const cell = grid.cells[index];
      button.setPosition(px + 16 + cell.x, actionY + cell.y);
      syncInteractiveHitArea(button);
    });
    container.add(actionButtons);
    this.actions = actions;
    this.columns = grid.columns;
    const focus = restoreLayoutFocus(actions.map((entry) => ({
      id: entry.id, visible: true, enabled: entry.enabled,
    })), this.selectedAction);
    this.selectedAction = focus.items[focus.index]?.id ?? "";
    this.updateSelection();
    this.accessibility.update(`${titleLabel}: ${VIEW_LABELS[this.view]}`, contentLines, actions, this.selectedAction);
  }

  private text(
    content: string, fontSize: number, width: number, color: string, id: string,
  ): Phaser.GameObjects.Text {
    const text = this.scene.add.text(0, 0, content, {
      fontFamily: "monospace", fontSize: `${fontSize}px`, color,
      wordWrap: { width, useAdvancedWrap: true }, lineSpacing: 3,
    });
    text.setData("layoutId", id);
    return text;
  }

  private selectAction(id: string): void {
    if (!this.actions.some((entry) => entry.id === id && entry.enabled)) return;
    this.selectedAction = id;
    this.updateSelection();
    this.accessibility.focus(id);
  }

  private updateSelection(): void {
    for (const action of this.actions) {
      const button = this.buttons.get(action.id);
      if (!button) continue;
      button.setText(`${action.id === this.selectedAction ? "> " : "  "}${action.label}`);
      button.setBackgroundColor(action.id === this.selectedAction ? "#465577" : "#25304a");
      syncInteractiveHitArea(button);
    }
  }

  private activateAction(id: string): void {
    const action = this.actions.find((entry) => entry.id === id && entry.enabled);
    this.pendingActivation = null;
    action?.activate();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.player) return;
    if (event.key === "Tab") {
      event.preventDefault();
      this.accessibility.moveTab(event.shiftKey);
      return;
    }
    const directions: Readonly<Record<string, GridNavigationDirection>> = {
      ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down",
      ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right",
    };
    const direction = directions[event.key];
    if (direction) {
      let index = this.actions.findIndex((entry) => entry.id === this.selectedAction);
      for (let attempt = 0; attempt < this.actions.length; attempt++) {
        index = moveGridSelection(index, this.actions.length, this.columns, direction);
        const entry = this.actions[index];
        if (entry?.enabled) { this.selectAction(entry.id); break; }
      }
      event.preventDefault();
    } else if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
      this.pendingActivation = this.selectedAction;
      event.preventDefault();
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    const id = this.pendingActivation;
    if (id && this.player) this.activateAction(id);
  }
}
