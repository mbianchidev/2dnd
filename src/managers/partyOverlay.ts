import * as Phaser from "phaser";
import { getAbility } from "../data/abilities";
import { COMPANION_IDS, isCompanionId, type CompanionId } from "../data/companions";
import type { Item } from "../data/items";
import { getSpell } from "../data/spells";
import { renderPartyInventory } from "../renderers/partyInventory";
import type { PartyInventoryContent } from "../renderers/partyInventory";
import { useCombatItem, useCombatItemOnTarget, type CombatActorState, type PlayerState } from "../systems/player";
import { playerCastSpellAtTargets } from "../systems/combat";
import { createEffectDicePresentation } from "../systems/dicePresentation";
import { HERO_COMBATANT_ID } from "../systems/groupCombat";
import { presentDiceResult } from "./dicePresentation";
import { getCompanion, moveActiveCompanion, setCompanionActive, transferPartyItem, type CompanionState, type PartyMemberId } from "../systems/party";
import {
  getItemTransferRestriction,
  inventoryPreferences,
  isInventoryItemEquipped,
  moveInventorySelection,
  selectInventoryItems,
  type InventorySemanticAction,
  type InventoryViewEntry,
} from "../systems/inventory";
import {
  MAX_GAMBITS_PER_COMPANION,
  createDefaultGambitRule,
  formatGambitRule,
  type GambitAction,
  type GambitCondition,
  type GambitRule,
  type GambitSubjectSelector,
  type GambitTargetSelector,
} from "../systems/gambits";
import {
  createDimGraphics,
  createOverlayContainer,
  createPanelGraphics,
} from "../utils/ui";
import { openMobileTextInput } from "./input";
import { getSocialSummaryPageCount, renderSocialSummary } from "../renderers/social";
import { renderPartyStatus } from "../renderers/partyStatus";
import { subscribeOverlayReflow, syncInteractiveHitArea } from "./layout";
import { getPartyDiscoveryPages, isFeatureAvailable } from "../systems/featureDiscovery";
import type { PartyMemberView, PartyOverlayCallbacks, PartyOverlayPage } from "./partyOverlayTypes";

export class PartyOverlayManager {
  private readonly scene: Phaser.Scene;
  private readonly callbacks: PartyOverlayCallbacks;
  private overlay: Phaser.GameObjects.Container | null = null;
  private player: PlayerState | null = null;
  private selectedId: PartyMemberId = "hero";
  private targetId: PartyMemberId = "hero";
  private page: PartyOverlayPage = "status";
  private listPage = 0;
  private inventorySelectedIndex: number | null = null;
  private inventorySearchActive = false;
  private inventoryPages: readonly (readonly number[])[] = [];
  private unsubscribeReflow: (() => void) | null = null;
  constructor(scene: Phaser.Scene, callbacks: PartyOverlayCallbacks) {
    this.scene = scene; this.callbacks = callbacks;
  }
  isOpen(): boolean { return this.overlay !== null; }
  toggle(player: PlayerState): void {
    if (this.overlay) this.close();
    else this.open(player);
  }
  open(player: PlayerState, page: PartyOverlayPage = "status"): void {
    this.close();
    this.player = player;
    this.selectedId = this.resolveSelectedId(player);
    this.targetId = this.selectedId;
    const availablePages = this.getAvailablePages(player);
    this.page = availablePages.includes(page) ? page : availablePages[0]!;
    this.listPage = 0;
    this.inventorySelectedIndex = null;
    this.inventorySearchActive = false;
    this.inventoryPages = [];
    this.scene.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.unsubscribeReflow = subscribeOverlayReflow(this.scene, () => this.render());
    this.render();
  }
  openInventory(player: PlayerState): void { this.open(player, "items"); }
  close(): void {
    this.unsubscribeReflow?.();
    this.unsubscribeReflow = null;
    this.scene.input.keyboard?.off("keydown", this.handleKeyDown, this);
    this.overlay?.destroy();
    this.overlay = null;
    this.player = null;
    this.inventorySearchActive = false;
  }

  isInventorySearchActive(): boolean {
    return this.isOpen() && this.page === "items" && this.inventorySearchActive;
  }

  getDebugState(): string {
    if (!this.overlay || !this.player) return "";
    if (this.page !== "items") return ` [PARTY:${this.page}]`;
    const entries = this.getInventoryEntries();
    const selectedPosition = entries.findIndex(
      (entry) => entry.inventoryIndex === this.inventorySelectedIndex,
    );
    const page = Math.max(0, this.inventoryPages.findIndex((indices) => indices.includes(selectedPosition))) + 1;
    const totalPages = Math.max(1, this.inventoryPages.length);
    const preferences = inventoryPreferences.get();
    return ` [PARTY:items Inventory ${Math.max(selectedPosition + 1, 0)}/${entries.length} Page ${page}/${totalPages} SelectedIndex:${this.inventorySelectedIndex ?? "-"} Sort:${preferences.sortMode} Filter:${preferences.filter} Search:${preferences.search || "-"}${this.inventorySearchActive ? " Focus:search" : ""}]`;
  }

  private resolveSelectedId(player: PlayerState): PartyMemberId {
    if (this.selectedId === "hero") return "hero";
    return player.party.companions.some(
      (companion) => companion.id === this.selectedId,
    ) ? this.selectedId : "hero";
  }

  private getMembers(): PartyMemberView[] {
    const player = this.player!;
    return [
      { id: "hero", name: player.name, state: player },
      ...player.party.companions.map((companion) => ({
        id: companion.id,
        name: companion.name,
        state: companion,
        companion,
      })),
    ];
  }

  private getAvailablePages(player: PlayerState): PartyOverlayPage[] {
    return getPartyDiscoveryPages(player);
  }

  private getMember(memberId: PartyMemberId): PartyMemberView | undefined {
    return this.getMembers().find((member) => member.id === memberId);
  }

  private render(): void {
    const player = this.player;
    if (!player) return;
    this.overlay?.destroy();
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;
    const panelWidth = Math.min(620, width - 24);
    const panelHeight = Math.min(this.page === "items" ? 494 : 450, height - 24);
    const panelX = Math.floor((width - panelWidth) / 2);
    const panelY = Math.floor((height - panelHeight) / 2);
    const container = createOverlayContainer(
      this.scene,
      `party-${this.page}`,
      80,
      {
        x: panelX,
        y: panelY,
        width: panelWidth,
        height: panelHeight,
      },
    );
    const dim = createDimGraphics(this.scene, width, height, 0.7)
      .setInteractive(
        new Phaser.Geom.Rectangle(0, 0, width, height),
        Phaser.Geom.Rectangle.Contains,
      );
    dim.on("pointerdown", () => this.close());
    container.add(dim);
    container.add(createPanelGraphics(
      this.scene,
      panelX,
      panelY,
      panelWidth,
      panelHeight,
      0.98,
      0xc0a060,
    ));
    const hasParty = isFeatureAvailable(player, "party");
    container.add(this.scene.add.text(
      panelX + panelWidth / 2,
      panelY + 10,
      hasParty ? "Party & Inventory" : "Inventory",
      {
        fontSize: "16px",
        fontFamily: "monospace",
        color: "#ffd700",
      },
    ).setOrigin(0.5, 0));
    this.overlay = container;

    if (hasParty) {
      this.renderMemberList(panelX + 12, panelY + 42, 150);
    }
    const contentX = hasParty ? panelX + 176 : panelX + 16;
    const contentWidth = hasParty ? panelWidth - 188 : panelWidth - 32;
    this.renderTabs(contentX, panelY + 42, contentWidth);
    if (this.page === "status") {
      this.renderStatusPage(contentX, panelY + 80, contentWidth, panelHeight - 128);
    } else if (this.page === "social") {
      this.renderSocialPage(contentX, panelY + 74, contentWidth);
    } else if (this.page === "items") {
      this.renderItemsPage(contentX, panelY + 82, contentWidth, panelHeight - 108);
    } else {
      this.renderGambitsPage(contentX, panelY + 74, contentWidth);
    }
    const closeButton = this.addButton(
      panelX + panelWidth - 70,
      panelY + panelHeight - 30,
      "Close",
      () => this.close(),
      "#ff9999",
      60,
      "party-close",
    );
    closeButton.setY(panelY + 10);
    syncInteractiveHitArea(closeButton);
  }

  private renderMemberList(x: number, y: number, width: number): void {
    let currentY = y;
    for (const member of this.getMembers()) {
      const companion = member.companion;
      const activeIndex = companion
        ? this.player!.party.activeCompanionIds.indexOf(companion.id)
        : -1;
      const activeLabel = member.id === "hero"
        ? "[Leader]"
        : activeIndex >= 0
          ? `[${activeIndex + 1}]`
          : "[Reserve]";
      const memberButton = this.addButton(
        x,
        currentY,
        `${member.id === this.selectedId ? "▶" : " "} ${member.name} ${activeLabel}`,
        () => {
          this.selectedId = member.id;
          this.targetId = member.id;
          this.listPage = 0;
          this.inventorySelectedIndex = null;
          this.render();
        },
        member.id === this.selectedId ? "#ffd700" : "#b8ddff",
        width,
      );
      currentY += memberButton.displayHeight + 6;
      if (companion) {
        const up = this.addButton(x, currentY, "Up", () => {
          this.applyMutation(
            moveActiveCompanion(this.player!.party, companion.id, -1),
          );
        }, "#aaaaaa", 42);
        const down = this.addButton(x + 48, currentY, "Down", () => {
          this.applyMutation(
            moveActiveCompanion(this.player!.party, companion.id, 1),
          );
        }, "#aaaaaa", 50);
        const active = this.addButton(x + 104, currentY, activeIndex >= 0 ? "Out" : "In", () => {
          this.applyMutation(
            setCompanionActive(
              this.player!.party,
              companion.id,
              activeIndex < 0,
            ),
          );
        }, "#aaaaaa", 42);
        currentY += Math.max(up.displayHeight, down.displayHeight, active.displayHeight) + 6;
      }
    }
  }

  private renderTabs(x: number, y: number, width: number): void {
    const definitions: Array<{ page: PartyOverlayPage; label: string }> = [
      { page: "status", label: "Status" },
      { page: "social", label: "Social" },
      { page: "items", label: "Items" },
      { page: "gambits", label: "Gambits" },
    ];
    const available = new Set(this.getAvailablePages(this.player!));
    const tabs = definitions.filter((tab) => available.has(tab.page));
    const tabWidth = Math.floor((width - 12) / tabs.length);
    tabs.forEach((tab, index) => {
      this.addButton(
        x + index * (tabWidth + 4),
        y,
        tab.label,
        () => {
          this.page = tab.page;
          this.listPage = 0;
          this.inventorySelectedIndex = null;
          this.inventorySearchActive = false;
          this.render();
        },
        this.page === tab.page ? "#ffd700" : "#bbbbbb",
        tabWidth,
        `party-tab-${tab.page}`,
      );
    });
  }

  private renderStatusPage(x: number, y: number, width: number, height: number): void {
    const member = this.getMember(this.selectedId);
    if (!member) return;
    renderPartyStatus({
      memberName: member.name,
      state: member.state,
      companion: member.companion,
      targetName: this.getMember(this.targetId)?.name ?? "Hero",
      x,
      y,
      width,
      height,
      page: this.listPage,
      changePage: (page) => { this.listPage = page; this.render(); },
      addText: (...args) => this.addText(...args),
      addButton: (...args) => this.addButton(...args),
      changed: (message) => this.changed(message),
      nextTarget: () => {
        this.cycleTarget();
        this.render();
      },
      openProgression: member.companion ? undefined : () => {
        this.close();
        this.callbacks.openProgression();
      },
    });
  }

  private renderSocialPage(x: number, y: number, width: number): void {
    renderSocialSummary(
      this.scene,
      this.overlay!,
      this.player!,
      x,
      y,
      width,
      this.listPage,
    );
    const pageCount = getSocialSummaryPageCount(this.player!);
    this.addButton(x, y + 350, "< Page", () => {
      this.listPage = (this.listPage - 1 + pageCount) % pageCount;
      this.render();
    }, "#bbbbbb", 70);
    this.addText(
      x + 78,
      y + 356,
      `Page ${this.listPage + 1}/${pageCount}`,
      "#aaaaaa",
      9,
    );
    this.addButton(x + 150, y + 350, "Page >", () => {
      this.listPage = (this.listPage + 1) % pageCount;
      this.render();
    }, "#bbbbbb", 70);
  }

  private renderItemsPage(x: number, y: number, width: number, height: number): void {
    const member = this.getMember(this.selectedId);
    const target = this.getMember(this.targetId);
    if (!member || !target) return;
    const entries = this.getInventoryEntries();
    this.ensureInventorySelection(entries);
    const selectedPosition = entries.findIndex(
      (entry) => entry.inventoryIndex === this.inventorySelectedIndex,
    );
    const preferences = inventoryPreferences.get();
    const controls: Array<PartyInventoryContent["controls"][number]> = [
      {
        id: "party-inventory-sort", label: `Sort:${this.capitalize(preferences.sortMode)}`, color: "#b8ddff",
        activate: () => { this.handleInventoryAction("cycleSort"); },
      },
      {
        id: "party-inventory-filter", label: `Filter:${this.capitalize(preferences.filter)}`, color: "#b8ddff",
        activate: () => { this.handleInventoryAction("cycleFilter"); },
      },
    ];
    if (isFeatureAvailable(this.player!, "crafting")) {
      controls.push({
        id: "party-inventory-craft", label: "Craft", color: "#f7c948",
        activate: () => { this.close(); this.callbacks.openCrafting(); },
      });
    }
    const searchLabel = preferences.search.length > 0
      ? `Search:${this.truncate(preferences.search, 13)}`
      : this.inventorySearchActive ? "Search:typing..." : "Search:/";
    const search = (): void => {
      if (
        this.scene.input.activePointer.event instanceof PointerEvent
        && this.scene.input.activePointer.event.pointerType === "touch"
        && !this.inventorySearchActive
      ) {
        openMobileTextInput(
          "Inventory search",
          preferences.search,
          32,
          (value) => {
            inventoryPreferences.setSearch(value);
            this.inventorySearchActive = false;
            this.render();
          },
        );
        return;
      }
      this.handleInventoryAction("toggleSearch");
    };
    const selectedEntry = this.getSelectedInventoryEntry(entries);
    const restriction = selectedEntry ? getItemTransferRestriction(member.state, selectedEntry.item) : "";
    const actions: Array<PartyInventoryContent["actions"][number]> = [
      {
        id: "party-inventory-previous", label: "< Page", color: "#bbbbbb",
        activate: () => { this.handleInventoryAction("previousPage"); },
      },
      {
        id: "party-inventory-next", label: "Page >", color: "#bbbbbb",
        activate: () => { this.handleInventoryAction("nextPage"); },
      },
      {
        id: "party-inventory-primary", label: this.getPrimaryActionLabel(selectedEntry), color: "#aaffaa",
        activate: () => { this.handleInventoryAction("primaryAction"); },
      },
      {
        id: "party-inventory-transfer", label: "Transfer", color: "#aaddff",
        activate: () => { this.handleInventoryAction("transfer"); },
      },
    ];
    const healingSpells = member.state.knownSpells
      .map((spellId) => getSpell(spellId))
      .filter((spell) => spell?.type === "heal");
    if (healingSpells.length > 0) {
      actions.push({
        id: "party-inventory-heal", label: "Heal", color: "#ccffcc",
        activate: () => this.castFirstHealingSpell(member, target),
      });
    }
    actions.push({
      id: "party-inventory-target", label: `To:${target.name}`, color: "#bbbbff",
      activate: () => { this.handleInventoryAction("nextTarget"); },
    });
    this.inventoryPages = renderPartyInventory(this.scene, this.overlay!, { x, y, width, height }, {
      heading: `${member.name}'s bag  ${entries.length}/${member.state.inventory.length}`,
      controls,
      search: { id: "party-inventory-search", label: searchLabel, color: this.inventorySearchActive ? "#ffd700" : "#b8ddff", activate: search },
      clearSearch: () => { this.handleInventoryAction("clearSearch"); },
      rows: entries.map((entry) => {
        const selected = entry.inventoryIndex === this.inventorySelectedIndex;
        const equipped = isInventoryItemEquipped(member.state, entry.item);
        return {
          id: `party-inventory-item-${entry.inventoryIndex}`,
          item: entry.item,
          label: `${selected ? ">" : " "} ${entry.item.name}  ${this.capitalize(entry.rarity)}${equipped ? " [E]" : ""}`,
          selected,
          activate: () => { this.inventorySelectedIndex = entry.inventoryIndex; this.render(); },
        };
      }),
      selectedPosition,
      detail: selectedEntry
        ? `${selectedEntry.item.description} | ${selectedEntry.item.cost}g | ${selectedEntry.item.type}${restriction ? ` | ${restriction}` : ""}`
        : "No items match the current view.",
      detailColor: restriction ? "#ffcc88" : "#bbbbbb",
      actions,
    });
  }

  handleInventoryAction(action: InventorySemanticAction): boolean {
    if (!this.player || this.page !== "items") return false;
    const member = this.getMember(this.selectedId);
    const target = this.getMember(this.targetId);
    if (!member || !target) return false;
    const entries = this.getInventoryEntries();
    this.ensureInventorySelection(entries);

    if (action === "cycleSort") {
      inventoryPreferences.cycleSortMode();
      this.render();
      return true;
    }
    if (action === "cycleFilter") {
      inventoryPreferences.cycleFilter();
      this.render();
      return true;
    }
    if (action === "toggleSearch") {
      this.inventorySearchActive = !this.inventorySearchActive;
      this.render();
      return true;
    }
    if (action === "clearSearch") {
      inventoryPreferences.setSearch("");
      this.inventorySearchActive = false;
      this.render();
      return true;
    }
    if (action === "nextTarget") {
      this.cycleTarget();
      this.render();
      return true;
    }
    if (action === "previousItem" || action === "nextItem") {
      this.inventorySelectedIndex = moveInventorySelection(
        entries,
        this.inventorySelectedIndex,
        action === "previousItem" ? -1 : 1,
      );
      this.render();
      return true;
    }
    if (action === "previousPage" || action === "nextPage") {
      const position = entries.findIndex((entry) => entry.inventoryIndex === this.inventorySelectedIndex);
      const current = Math.max(0, this.inventoryPages.findIndex((indices) => indices.includes(position)));
      const direction = action === "previousPage" ? -1 : 1;
      const destination = this.inventoryPages[Math.max(0, Math.min(current + direction, this.inventoryPages.length - 1))];
      const offset = Math.max(0, this.inventoryPages[current]?.indexOf(position) ?? 0);
      const targetPosition = destination?.[Math.min(offset, destination.length - 1)];
      if (targetPosition !== undefined) this.inventorySelectedIndex = entries[targetPosition]?.inventoryIndex ?? null;
      this.render();
      return true;
    }
    if (action === "firstItem" || action === "lastItem") {
      const entry = action === "firstItem"
        ? entries[0]
        : entries[entries.length - 1];
      this.inventorySelectedIndex = entry?.inventoryIndex ?? null;
      this.render();
      return true;
    }
    const selectedEntry = this.getSelectedInventoryEntry(entries);
    if (!selectedEntry) {
      this.callbacks.showMessage("No item selected.", "#ff8888");
      return true;
    }
    if (action === "transfer") {
      const result = transferPartyItem(
        this.player,
        member.id,
        target.id,
        selectedEntry.inventoryIndex,
      );
      this.changed(result.message, result.transferred);
      return true;
    }
    if (action === "primaryAction") {
      if (
        selectedEntry.item.type === "weapon"
        || selectedEntry.item.type === "armor"
        || selectedEntry.item.type === "shield"
      ) {
        const result = useCombatItem(
          member.state,
          selectedEntry.inventoryIndex,
        );
        this.changed(result.message, result.used);
      } else if (selectedEntry.item.type === "consumable") {
        const result = useCombatItemOnTarget(
          member.state,
          selectedEntry.inventoryIndex,
          target.state,
        );
        this.changed(result.message, result.used);
      } else {
        this.callbacks.showMessage(
          `${selectedEntry.item.name} has no direct action.`,
          "#ffcc88",
        );
      }
      return true;
    }
    return false;
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.overlay) return;
    const pageIndex = Number.parseInt(event.key, 10) - 1;
    const page = Number.isInteger(pageIndex)
      ? this.getAvailablePages(this.player!)[pageIndex]
      : undefined;
    if (page && !this.inventorySearchActive) {
      this.page = page;
      this.render();
      event.preventDefault();
      return;
    }
    if (this.page === "social") {
      const pageCount = getSocialSummaryPageCount(this.player!);
      if (event.key === "PageUp" || event.key === "ArrowLeft") {
        this.listPage = (this.listPage - 1 + pageCount) % pageCount;
        this.render();
        event.preventDefault();
      } else if (event.key === "PageDown" || event.key === "ArrowRight") {
        this.listPage = (this.listPage + 1) % pageCount;
        this.render();
        event.preventDefault();
      }
      return;
    }
    if (this.page !== "items") return;
    if (
      !this.inventorySearchActive
      && event.key.toLowerCase() === "v"
      && isFeatureAvailable(this.player!, "crafting")
    ) {
      this.close(); this.callbacks.openCrafting();
      event.preventDefault();
      return;
    }
    if (this.inventorySearchActive) {
      if (event.key === "Enter") {
        this.inventorySearchActive = false;
        this.render();
        event.preventDefault();
        return;
      }
      if (event.key === "Backspace") {
        inventoryPreferences.setSearch(
          inventoryPreferences.get().search.slice(0, -1),
        );
        this.render();
        event.preventDefault();
        return;
      }
      if (/^[a-zA-Z0-9_'’-]$/.test(event.key)) {
        inventoryPreferences.setSearch(
          `${inventoryPreferences.get().search}${event.key}`,
        );
        this.render();
        event.preventDefault();
      }
      return;
    }
    const actions: Partial<Record<string, InventorySemanticAction>> = {
      ArrowUp: "previousItem",
      ArrowDown: "nextItem",
      PageUp: "previousPage",
      PageDown: "nextPage",
      Home: "firstItem",
      End: "lastItem",
      Enter: "primaryAction",
      x: "transfer",
      X: "transfer",
      r: "cycleSort",
      R: "cycleSort",
      f: "cycleFilter",
      F: "cycleFilter",
      "/": "toggleSearch",
      Tab: "nextTarget",
    };
    const action = actions[event.key];
    if (action) {
      this.handleInventoryAction(action);
      event.preventDefault();
    }
  }
  private getInventoryEntries(): InventoryViewEntry[] {
    const member = this.getMember(this.selectedId);
    return member
      ? selectInventoryItems(member.state.inventory, inventoryPreferences.get())
      : [];
  }
  private ensureInventorySelection(entries: readonly InventoryViewEntry[]): void {
    if (
      this.inventorySelectedIndex === null
      || !entries.some(
        (entry) => entry.inventoryIndex === this.inventorySelectedIndex,
      )
    ) {
      this.inventorySelectedIndex = entries[0]?.inventoryIndex ?? null;
    }
  }
  private getSelectedInventoryEntry(
    entries: readonly InventoryViewEntry[],
  ): InventoryViewEntry | undefined {
    return entries.find(
      (entry) => entry.inventoryIndex === this.inventorySelectedIndex,
    );
  }
  private getPrimaryActionLabel(
    entry: InventoryViewEntry | undefined,
  ): string {
    if (!entry) return "Action";
    if (entry.item.type === "consumable") return "Use";
    if (
      entry.item.type === "weapon"
      || entry.item.type === "armor"
      || entry.item.type === "shield"
    ) {
      return "Equip";
    }
    return "Inspect";
  }
  private castFirstHealingSpell(
    member: PartyMemberView,
    target: PartyMemberView,
  ): void {
    const spell = member.state.knownSpells
      .map((spellId) => getSpell(spellId))
      .find((knownSpell) => knownSpell?.type === "heal");
    if (!spell) {
      this.callbacks.showMessage("No healing spell is available.", "#ff8888");
      return;
    }
    const result = playerCastSpellAtTargets(
      member.state,
      spell.id,
      [],
      [{
        id: target.id,
        label: target.name,
        get currentHp() {
          return target.state.hp;
        },
        set currentHp(value: number) {
          target.state.hp = value;
        },
        get maxHp() {
          return target.state.maxHp;
        },
        effects: target.state.activeEffects,
      }],
    );
    for (const healing of result.healingResults) {
      if (healing.healingRoll) {
        presentDiceResult(this.scene, createEffectDicePresentation(healing.healingRoll, {
          category: "healing",
          label: `${member.name} ${spell.name} -> ${target.name}`,
          actorId: member.id === "hero" ? HERO_COMBATANT_ID : `party:companion:${member.id}`,
          targetId: target.id === "hero" ? HERO_COMBATANT_ID : `party:companion:${target.id}`,
          actionId: spell.id,
          outcome: "success",
        }), healing);
      }
    }
    this.changed(result.message, result.mpUsed > 0);
  }
  private capitalize(value: string): string {
    return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
  }
  private truncate(value: string, length: number): string {
    return value.length <= length ? value : `${value.slice(0, length - 1)}…`;
  }

  private renderGambitsPage(x: number, y: number, width: number): void {
    const companion = isCompanionId(this.selectedId)
      ? getCompanion(this.player!.party, this.selectedId)
      : undefined;
    if (!companion) {
      this.addText(x, y, "Select a companion to edit gambits.", "#888888");
      return;
    }
    this.addText(
      x,
      y,
      `${companion.name} - ${companion.controlMode}`,
      "#ffd700",
      13,
    );
    this.addButton(x + width - 100, y - 4, "Add Rule", () => {
      if (companion.gambits.length >= MAX_GAMBITS_PER_COMPANION) {
        this.callbacks.showMessage("Maximum 12 gambits.", "#ff8888");
        return;
      }
      companion.gambits.push(createDefaultGambitRule(
        `${companion.id}-${Date.now()}-${companion.gambits.length}`,
        companion.gambits.length + 1,
      ));
      this.changed("Gambit added.");
    }, "#aaffaa", 90);
    const pageSize = 4;
    const totalPages = Math.max(
      1,
      Math.ceil(companion.gambits.length / pageSize),
    );
    this.listPage = Phaser.Math.Clamp(this.listPage, 0, totalPages - 1);
    const visible = companion.gambits.slice(
      this.listPage * pageSize,
      (this.listPage + 1) * pageSize,
    );
    visible.forEach((rule, offset) => {
      const ruleIndex = this.listPage * pageSize + offset;
      const rowY = y + 34 + offset * 82;
      this.addText(
        x,
        rowY,
        `${rule.rank}. ${rule.enabled ? "[ON]" : "[OFF]"} ${formatGambitRule(rule)}`,
        rule.enabled ? "#dddddd" : "#777777",
        9,
        width,
      );
      const controls: Array<{ label: string; action: () => void }> = [
        { label: "S", action: () => this.cycleSubject(companion, ruleIndex) },
        { label: "C", action: () => this.cycleCondition(companion, ruleIndex) },
        { label: "A", action: () => this.cycleAction(companion, ruleIndex) },
        { label: "T", action: () => this.cycleRuleTarget(companion, ruleIndex) },
        { label: rule.enabled ? "Off" : "On", action: () => {
          rule.enabled = !rule.enabled;
          this.changed("Gambit toggled.");
        } },
        { label: "Up", action: () => this.moveRule(companion, ruleIndex, -1) },
        { label: "Down", action: () => this.moveRule(companion, ruleIndex, 1) },
        { label: "Del", action: () => {
          companion.gambits.splice(ruleIndex, 1);
          this.rankRules(companion.gambits);
          this.changed("Gambit removed.");
        } },
      ];
      controls.forEach((control, index) => {
        this.addButton(
          x + index * 47,
          rowY + 45,
          control.label,
          control.action,
          "#aaddff",
          42,
        );
      });
    });
    this.addButton(x, y + 370, `Page ${this.listPage + 1}/${totalPages}`, () => {
      this.listPage = (this.listPage + 1) % totalPages;
      this.render();
    }, "#bbbbbb", 100);
  }

  private cycleSubject(
    companion: CompanionState,
    ruleIndex: number,
  ): void {
    const options: GambitSubjectSelector[] = [
      { kind: "self" },
      { kind: "hero" },
      { kind: "anyPartyMember" },
      { kind: "anyEnemy" },
      ...this.player!.party.companions.map(
        (entry): GambitSubjectSelector => ({
          kind: "companion",
          companionId: entry.id,
        }),
      ),
    ];
    companion.gambits[ruleIndex]!.subject = this.nextOption(
      options,
      companion.gambits[ruleIndex]!.subject,
    );
    this.changed("Gambit subject updated.");
  }

  private cycleCondition(
    companion: CompanionState,
    ruleIndex: number,
  ): void {
    const options: GambitCondition[] = [
      { kind: "state", state: "alive" },
      {
        kind: "resource",
        resource: "hp",
        scale: "percent",
        comparison: "<",
        value: 50,
      },
      {
        kind: "resource",
        resource: "hp",
        scale: "percent",
        comparison: ">",
        value: 90,
      },
      {
        kind: "resource",
        resource: "mp",
        scale: "percent",
        comparison: "<",
        value: 25,
      },
      { kind: "status", statusId: "poison", present: true },
      {
        kind: "stat",
        stat: "dexterity",
        comparison: ">",
        value: 15,
      },
    ];
    companion.gambits[ruleIndex]!.condition = this.nextOption(
      options,
      companion.gambits[ruleIndex]!.condition,
    );
    this.changed("Gambit condition updated.");
  }

  private cycleAction(
    companion: CompanionState,
    ruleIndex: number,
  ): void {
    const itemIds = [...new Set(
      companion.inventory
        .filter((item) => item.type === "consumable")
        .map((item) => item.id),
    )];
    const options: GambitAction[] = [
      { kind: "attack" },
      { kind: "defend" },
      ...companion.knownSpells.map(
        (spellId): GambitAction => ({ kind: "spell", spellId }),
      ),
      ...companion.knownAbilities.map(
        (abilityId): GambitAction => ({ kind: "ability", abilityId }),
      ),
      ...itemIds.map(
        (itemId): GambitAction => ({ kind: "item", itemId }),
      ),
    ];
    companion.gambits[ruleIndex]!.action = this.nextOption(
      options,
      companion.gambits[ruleIndex]!.action,
    );
    this.changed("Gambit action updated.");
  }

  private cycleRuleTarget(
    companion: CompanionState,
    ruleIndex: number,
  ): void {
    const options: GambitTargetSelector[] = [
      { kind: "matchedSubject" },
      { kind: "self" },
      { kind: "hero" },
      { kind: "lowestHpAlly" },
      { kind: "highestHpAlly" },
      { kind: "lowestHpEnemy" },
      { kind: "highestHpEnemy" },
      { kind: "anyEnemy" },
      { kind: "automatic" },
      ...this.player!.party.companions.map(
        (entry): GambitTargetSelector => ({
          kind: "companion",
          companionId: entry.id,
        }),
      ),
    ];
    companion.gambits[ruleIndex]!.target = this.nextOption(
      options,
      companion.gambits[ruleIndex]!.target,
    );
    this.changed("Gambit target updated.");
  }

  private moveRule(
    companion: CompanionState,
    index: number,
    direction: -1 | 1,
  ): void {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= companion.gambits.length) return;
    const [moved] = companion.gambits.splice(index, 1);
    companion.gambits.splice(targetIndex, 0, moved!);
    this.rankRules(companion.gambits);
    this.changed("Gambit priority updated.");
  }

  private rankRules(rules: GambitRule[]): void {
    rules.forEach((rule, index) => { rule.rank = index + 1; });
  }

  private nextOption<T>(options: T[], current: T): T {
    const serialized = JSON.stringify(current);
    const index = options.findIndex(
      (option) => JSON.stringify(option) === serialized,
    );
    return options[(index + 1) % options.length]!;
  }

  private cycleTarget(): void {
    const members = this.getMembers();
    const index = members.findIndex((member) => member.id === this.targetId);
    this.targetId = members[(index + 1) % members.length]!.id;
  }

  private applyMutation(result: { changed: boolean; message: string }): void {
    this.changed(result.message, result.changed);
  }

  private changed(message: string, changed = true): void {
    this.callbacks.showMessage(message, changed ? "#88ff88" : "#ff8888");
    if (changed) {
      this.callbacks.updateHUD();
      this.callbacks.refreshActors();
      this.callbacks.autoSave();
    }
    this.render();
  }

  private addText(
    x: number,
    y: number,
    text: string,
    color = "#dddddd",
    size = 11,
    width?: number,
  ): Phaser.GameObjects.Text {
    const label = this.scene.add.text(x, y, text, {
      fontSize: `${size}px`,
      fontFamily: "monospace",
      color,
      wordWrap: width ? { width, useAdvancedWrap: true } : undefined,
    });
    this.overlay?.add(label);
    return label;
  }

  private addButton(
    x: number,
    y: number,
    label: string,
    action: () => void,
    color = "#dddddd",
    width = 120,
    layoutId?: string,
  ): Phaser.GameObjects.Text {
    const button = this.scene.add.text(x, y, label, {
      fontSize: "10px",
      fontFamily: "monospace",
      color,
      backgroundColor: "#29324a",
      padding: { x: 5, y: 4 },
      fixedWidth: width,
      wordWrap: { width: width - 12, useAdvancedWrap: true },
      align: "center",
    }).setInteractive({ useHandCursor: true });
    syncInteractiveHitArea(button);
    if (layoutId) button.setData("layoutId", layoutId);
    button.on("pointerover", () => button.setColor("#ffd700"));
    button.on("pointerout", () => button.setColor(color));
    button.on("pointerdown", action);
    this.overlay?.add(button);
    return button;
  }
}
