import * as Phaser from "phaser";
import { MAIN_QUEST_ID } from "../data/quests";
import { NEW_GAME_PLUS_CARRY_SUMMARY } from "../data/newGamePlus";
import { isQuestCompleted } from "../systems/quests";
import { listSaveSlots, type SaveSlotInfo } from "../systems/saveSlots";
import type { SaveActionResult } from "../systems/save";
import {
  copyCompletedSnapshot, createNewGamePlusSlot, inspectCampaignSlot, prepareNewGamePlus,
  type CampaignSlotInspection, type NewGamePlusRequest,
} from "../systems/newGamePlusSlots";
import { MANUAL_SAVE_SLOT_IDS, type SaveSlotId } from "../systems/saveStorage";
import { renderSaveSlotPanel, type SaveSlotPanelContent } from "../renderers/saveSlotPanel";
import { subscribeOverlayReflow } from "./layout";
import { OverlayAccessibility } from "./overlayAccessibility";

type NewGamePlusPhase = "source" | "snapshotTarget" | "snapshotConfirm" | "destination" | "preview";

export class NewGamePlusManager {
  private container: Phaser.GameObjects.Container | null = null;
  private phase: NewGamePlusPhase = "source";
  private slots: SaveSlotInfo[] = [];
  private row = 0;
  private action = 0;
  private focusId = "row-0";
  private source: CampaignSlotInspection | null = null;
  private destination: CampaignSlotInspection | null = null;
  private request: NewGamePlusRequest | null = null;
  private status = "";
  private busy = false;
  private heldConfirm = false;
  private unsubscribe: (() => void) | null = null;
  private readonly accessibility: OverlayAccessibility;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly launch: (slot: SaveSlotId) => SaveActionResult,
    private readonly changed: () => void,
  ) {
    this.accessibility = new OverlayAccessibility("new-game-plus",
      (id) => this.selectAccessible(id), (id) => this.activateAccessible(id),
      { keyDown: this.keyDown, keyUp: this.keyUp });
  }

  isOpen(): boolean { return this.container !== null; }
  getDebugState(): string {
    return this.isOpen() ? ` [NG_PLUS:${this.phase}] [NG_ROW:${this.row}] [NG_ACTION:${this.action}]` : "";
  }

  open(sourceSlotId?: SaveSlotId): void {
    this.close();
    this.phase = "source";
    this.slots = listSaveSlots(true);
    this.row = Math.max(0, this.slots.findIndex((slot) => slot.slotId === sourceSlotId));
    this.action = 0;
    this.focusId = `row-${this.row}`;
    this.status = "Choose a completed manual source; Autosave requires an explicit protected snapshot.";
    this.accessibility.open();
    this.scene.input.keyboard?.on("keydown", this.keyDown);
    this.scene.input.keyboard?.on("keyup", this.keyUp);
    window.addEventListener("blur", this.clearHeld);
    window.addEventListener("gamepaddisconnected", this.clearHeld);
    document.addEventListener("visibilitychange", this.clearHeld);
    this.unsubscribe = subscribeOverlayReflow(this.scene, () => { if (this.isOpen()) this.render(); });
    this.render();
  }

  close(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.scene.input.keyboard?.off("keydown", this.keyDown);
    this.scene.input.keyboard?.off("keyup", this.keyUp);
    window.removeEventListener("blur", this.clearHeld);
    window.removeEventListener("gamepaddisconnected", this.clearHeld);
    document.removeEventListener("visibilitychange", this.clearHeld);
    this.container?.destroy();
    this.container = null;
    this.accessibility.close();
    this.source = null;
    this.destination = null;
    this.request = null;
    this.heldConfirm = false;
    this.busy = false;
    this.scene.input.keyboard?.resetKeys();
    this.changed();
  }

  private rows(): SaveSlotPanelContent["rows"] {
    if (this.phase === "preview") return NEW_GAME_PLUS_CARRY_SUMMARY.map((text, index) => ({
      id: `carry-${index}`, text, selected: this.row === index, color: "#cfd8dc",
    }));
    if (this.phase === "snapshotConfirm") return [{
      id: "snapshot-confirm", text: `Save completed Autosave into ${this.destination?.slotId}?\n`
        + `${this.destination?.present ? "Existing destination will be replaced." : "Destination is empty."}\n`
        + "This is a snapshot, not a new cycle; no reward, rest or level is applied.",
      selected: true, color: "#ffcc80",
    }];
    return this.slots.map((slot, index) => ({
      id: slot.slotId,
      text: `${slot.displayName}${slot.slotId === this.source?.slotId ? " [PROTECTED SOURCE]" : ""}\n`
        + (slot.metadata ? `${slot.metadata.characterName} Lv.${slot.metadata.level} | ${slot.metadata.campaignStatus}\n`
          + `Rules: ${slot.metadata.difficultyName} | Cycle ${slot.metadata.cycle}`
          : `${slot.state}${slot.diagnostic ? `: ${slot.diagnostic}` : ""}`),
      selected: index === this.row, color: "#cfd8dc",
    }));
  }

  private render(): void {
    this.container?.destroy();
    const rows = this.rows();
    this.row = Math.min(Math.max(0, this.row), rows.length - 1);
    const title = this.phase === "preview" ? "New Game+ carry and reset"
      : this.phase.startsWith("snapshot") ? "Protect completed campaign" : "New Game+";
    const instruction = this.phase === "preview"
      ? `Protected: ${this.source?.slotId}  Destination: ${this.destination?.slotId}\n`
        + `${this.destination?.present ? "Confirm replaces the destination. " : ""}Autosave becomes the active NG+ run.`
      : this.phase === "destination" ? "Choose a different manual destination. The completed source stays unchanged."
        : "Up/Down: selection  Left/Right: action  Confirm on release  Cancel: back";
    this.container = renderSaveSlotPanel(this.scene, {
      title, instruction, rows, selectedRow: this.row, confirmation: false,
      pageLabel: this.phase === "preview" ? "Policy" : "Slots",
      actions: ["confirm", "cancel"].map((id, index) => ({
        id, label: id === "confirm" ? this.phase === "preview" ? "Create & Play" : "Select / Confirm" : "Back / Cancel",
        selected: this.action === index, color: this.action === index ? "#ffffff" : "#9fe8ff",
        activate: () => { this.action = index; this.focusId = id; this.activate(); },
      })),
      status: this.status, statusColor: "#ffcc80",
      hint: "The completed manual source is never overwritten. No automatic slot eviction.",
      onBack: () => this.back(),
      onSelectRow: (index) => {
        this.row = index; this.action = 0; this.focusId = `row-${index}`; this.render();
      },
    });
    const actions = [
      ...rows.map((row, index) => ({ id: `row-${index}`, label: row.text, enabled: true })),
      { id: "confirm", label: this.phase === "preview" ? "Create and play independent cycle" : "Select or confirm", enabled: true },
      { id: "cancel", label: "Back or cancel", enabled: true },
    ];
    this.accessibility.update(title, [instruction, this.status, ...NEW_GAME_PLUS_CARRY_SUMMARY],
      actions, this.focusId);
    this.accessibility.announce(this.status);
    this.changed();
  }

  private activate(): void {
    if (this.busy) return;
    if (this.action === 1) { this.back(); return; }
    if (this.phase === "preview" && this.request) {
      this.busy = true;
      const created = createNewGamePlusSlot(this.request);
      if (created.ok) {
        if (created.warning) {
          this.status = `${created.warning} Select Create & Play again to continue.`;
          this.busy = false;
          this.render();
          return;
        }
        const launched = this.launch(this.request.targetSlotId);
        if (launched.ok) { this.close(); return; }
        this.status = launched.message;
      } else this.status = created.message;
      this.busy = false;
      this.render();
      return;
    }
    if (this.phase === "snapshotConfirm" && this.source && this.destination) {
      const slot = MANUAL_SAVE_SLOT_IDS.find((id) => id === this.destination!.slotId);
      if (!slot) return;
      const copied = copyCompletedSnapshot(slot, this.source.token, this.destination.token, this.destination.present);
      this.status = copied.ok ? copied.warning ?? copied.message : copied.message;
      if (copied.ok) {
        this.slots = listSaveSlots(true);
        this.phase = "source";
        this.row = this.slots.findIndex((entry) => entry.slotId === slot);
        this.focusId = `row-${this.row}`;
        this.source = null;
      }
      this.render();
      return;
    }
    const slot = this.slots[this.row];
    if (!slot) return;
    const result = inspectCampaignSlot(slot.slotId);
    if (!result.ok) { this.status = result.message; this.render(); return; }
    const inspected = result.inspection;
    if (this.phase === "source") {
      if (!inspected.data || !isQuestCompleted(inspected.data.player.progression.quests, MAIN_QUEST_ID)) {
        this.status = "Select an authoritative completed campaign.";
      } else {
        this.source = inspected;
        this.phase = slot.slotId === "autosave" ? "snapshotTarget" : "destination";
        this.row = Math.max(1, this.slots.findIndex((entry) =>
          entry.kind === "manual" && entry.slotId !== slot.slotId && entry.state === "empty"));
        this.focusId = `row-${this.row}`;
      }
    } else if (this.phase === "snapshotTarget") {
      if (slot.kind !== "manual") this.status = "Choose a manual snapshot slot.";
      else {
        this.destination = inspected; this.phase = "snapshotConfirm"; this.row = 0; this.focusId = "confirm";
      }
    } else if (this.phase === "destination" && this.source) {
      const sourceId = MANUAL_SAVE_SLOT_IDS.find((id) => id === this.source!.slotId);
      const targetId = MANUAL_SAVE_SLOT_IDS.find((id) => id === slot.slotId);
      if (!sourceId || !targetId || sourceId === targetId) this.status = "Choose a different manual destination.";
      else {
        const prepared = prepareNewGamePlus(sourceId, targetId, crypto.randomUUID(), inspected.present);
        if (!prepared.ok) this.status = prepared.message;
        else if (prepared.request.sourceToken !== this.source.token) {
          this.status = "Source changed since selection. Cancel and select the completed source again.";
        }
        else {
          this.request = prepared.request;
          this.destination = inspected;
          this.phase = "preview";
          this.row = 0;
          this.focusId = "row-0";
          this.status = "Review all carry/reset pages. Confirm starts only the independent cycle.";
        }
      }
    }
    this.render();
  }

  private back(): void {
    if (this.phase === "source") { this.close(); return; }
    this.phase = "source";
    this.source = null;
    this.destination = null;
    this.request = null;
    this.row = 0;
    this.action = 0;
    this.focusId = "row-0";
    this.status = "Cancelled. Campaigns remain unchanged; any explicitly saved snapshot stays available.";
    this.render();
  }

  private selectAccessible(id: string): void {
    if (id === this.focusId) return;
    if (id === "confirm" || id === "cancel") this.action = id === "cancel" ? 1 : 0;
    else {
      const row = id.startsWith("row-") ? Number(id.slice(4)) : -1;
      if (!Number.isInteger(row) || row < 0 || row >= this.rows().length) return;
      this.row = row;
      this.action = 0;
    }
    this.focusId = id;
    this.render();
  }

  private activateAccessible(id: string): void {
    if (id.startsWith("row-")) this.selectAccessible(id);
    else { this.action = id === "cancel" ? 1 : 0; this.activate(); }
  }

  private readonly clearHeld = (): void => { this.heldConfirm = false; };
  private readonly keyDown = (event: KeyboardEvent): void => {
    if (!this.isOpen() || this.busy) return;
    if (["Enter", " ", "Escape", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(event.key)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    if (event.key === "Escape") { this.back(); return; }
    if (event.key === "Tab") { this.accessibility.moveTab(event.shiftKey); return; }
    if (event.key === "Enter" || event.key === " ") { if (!event.repeat) this.heldConfirm = true; return; }
    if (event.key === "ArrowUp" || event.key === "w") {
      this.row = (this.row - 1 + this.rows().length) % this.rows().length;
      this.action = 0; this.focusId = `row-${this.row}`;
    } else if (event.key === "ArrowDown" || event.key === "s") {
      this.row = (this.row + 1) % this.rows().length;
      this.action = 0; this.focusId = `row-${this.row}`;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "a" || event.key === "d") {
      this.action = 1 - this.action; this.focusId = this.action === 1 ? "cancel" : "confirm";
    }
    else return;
    this.render();
  };
  private readonly keyUp = (event: KeyboardEvent): void => {
    if ((event.key === "Enter" || event.key === " ") && this.heldConfirm && this.isOpen()) {
      this.heldConfirm = false;
      event.preventDefault();
      event.stopImmediatePropagation();
      this.activate();
    }
  };
}
