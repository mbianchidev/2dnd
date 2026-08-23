import * as Phaser from "phaser";
import {
  deleteSave,
  type SaveActionResult,
} from "../systems/save";
import {
  copySaveSlot,
  exportSaveSlot,
  formatSavePlaytime,
  importSaveSlot,
  listSaveSlots,
  renameSaveSlot,
  type SaveSlotId,
  type SaveSlotInfo,
} from "../systems/saveSlots";
import {
  calcPanelLayout,
  createDimGraphics,
  createOverlayContainer,
  createPanelGraphics,
} from "../utils/ui";
import {
  layoutResponsiveGrid,
  restoreLayoutFocus,
} from "../systems/layout";
import { syncInteractiveHitArea } from "./layout";
import { openMobileTextInput } from "./input";

export type SaveSlotOverlayMode = "load" | "save";

interface SaveSlotManagerCallbacks {
  load(slotId: SaveSlotId): void;
  save(slotId: SaveSlotId, overwrite: boolean): SaveActionResult;
  onStateChange?(): void;
}

type SaveSlotAction =
  | "load"
  | "save"
  | "rename"
  | "copy"
  | "delete"
  | "export"
  | "import"
  | "confirm"
  | "cancel"
  | "close";

interface PendingConfirmation {
  kind: "save" | "copy" | "delete" | "import" | "newGame";
  sourceSlotId?: SaveSlotId;
  targetSlotId: SaveSlotId;
}

const ACTION_LABELS: Readonly<Record<SaveSlotAction, string>> = {
  load: "Load",
  save: "Save",
  rename: "Rename",
  copy: "Copy",
  delete: "Delete",
  export: "Export",
  import: "Import",
  confirm: "Confirm",
  cancel: "Cancel",
  close: "Close",
};

function formatSavedAt(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()} `
    + `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function slotStatusText(slot: SaveSlotInfo): string {
  const metadata = slot.metadata;
  if (metadata) {
    return `${metadata.characterName} Lv.${metadata.level} ${metadata.className}\n`
      + `${metadata.location} | ${metadata.campaignStatus} | `
      + `${formatSavePlaytime(metadata.playtimeSeconds)} | `
      + `${formatSavedAt(metadata.savedAt)}`;
  }
  if (slot.state === "corrupt") {
    return `Recovery needed\n${slot.diagnostic ?? "Campaign data is corrupt."}`;
  }
  if (slot.state === "unavailable") {
    return `Storage unavailable\n${slot.diagnostic ?? "Campaign storage cannot be read."}`;
  }
  return "Empty\nNo campaign stored";
}

function actionColor(action: SaveSlotAction): string {
  if (action === "delete") return "#ff8a80";
  if (action === "confirm") return "#88ff88";
  if (action === "cancel" || action === "close") return "#b0bec5";
  return "#9fe8ff";
}

export class SaveSlotManager {
  private container: Phaser.GameObjects.Container | null = null;
  private mode: SaveSlotOverlayMode = "load";
  private slots: SaveSlotInfo[] = [];
  private selectedSlotIndex = 0;
  private selectedActionIndex = 0;
  private actions: SaveSlotAction[] = [];
  private pendingConfirmation: PendingConfirmation | null = null;
  private copySourceSlotId: SaveSlotId | null = null;
  private status = "";
  private statusColor = "#b0bec5";
  private liveRegion: HTMLDivElement | null = null;
  private importInput: HTMLInputElement | null = null;
  private startNewGame: (() => void) | null = null;
  private lastHandledKey = "";
  private lastHandledAt = Number.NEGATIVE_INFINITY;
  private pendingActivation: {
    eventName: "keyup-ENTER" | "keyup-SPACE";
    handler: () => void;
  } | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly callbacks: SaveSlotManagerCallbacks,
  ) {}

  open(mode: SaveSlotOverlayMode): void {
    this.close();
    this.mode = mode;
    this.slots = listSaveSlots();
    this.selectedSlotIndex = mode === "save"
      ? Math.max(0, this.slots.findIndex((slot) => slot.slotId === "manual-1"))
      : Math.max(0, this.slots.findIndex((slot) => slot.state === "valid"));
    this.selectedActionIndex = 0;
    this.pendingConfirmation = null;
    this.copySourceSlotId = null;
    this.status = "";
    this.lastHandledKey = "";
    this.lastHandledAt = Number.NEGATIVE_INFINITY;
    this.createLiveRegion();
    this.scene.input.keyboard?.on("keydown", this.handleKeyDown, this);
    this.render();
  }

  confirmNewGame(start: () => void): void {
    const autosave = listSaveSlots().find((slot) => slot.slotId === "autosave");
    if (!autosave || autosave.state === "empty") {
      start();
      return;
    }
    this.open("load");
    this.selectedSlotIndex = 0;
    this.startNewGame = start;
    this.pendingConfirmation = {
      kind: "newGame",
      targetSlotId: "autosave",
    };
    this.selectedActionIndex = 0;
    this.status = "Starting a new campaign will replace Autosave. Manual slots stay safe.";
    this.statusColor = "#ffcc80";
    this.render();
  }

  close(): void {
    this.scene.input.keyboard?.off("keydown", this.handleKeyDown, this);
    if (this.pendingActivation) {
      this.scene.input.keyboard?.off(
        this.pendingActivation.eventName,
        this.pendingActivation.handler,
      );
      this.pendingActivation = null;
    }
    this.container?.destroy();
    this.container = null;
    this.pendingConfirmation = null;
    this.copySourceSlotId = null;
    this.startNewGame = null;
    this.importInput?.remove();
    this.importInput = null;
    this.liveRegion?.remove();
    this.liveRegion = null;
    this.callbacks.onStateChange?.();
  }

  destroy(): void {
    this.close();
  }

  isOpen(): boolean {
    return this.container !== null;
  }

  getDebugState(): string {
    if (!this.container) return "";
    const slotId = this.slots[this.selectedSlotIndex]?.slotId ?? "-";
    const action = this.actions[this.selectedActionIndex] ?? "-";
    const phase = this.pendingConfirmation
      ? `confirm-${this.pendingConfirmation.kind}`
      : this.copySourceSlotId ? "copy-target" : "browse";
    return ` [SAVE_SLOTS:${this.mode}] [SAVE_SLOT:${slotId}]`
      + ` [SAVE_ACTION:${action}] [SAVE_PHASE:${phase}]`;
  }

  private render(): void {
    this.container?.destroy();
    this.slots = listSaveSlots();
    this.selectedSlotIndex = Math.min(
      Math.max(this.selectedSlotIndex, 0),
      this.slots.length - 1,
    );
    const selectedSlot = this.slots[this.selectedSlotIndex]!;
    const previousAction = this.actions[this.selectedActionIndex];
    this.actions = this.getActions(selectedSlot);
    this.selectedActionIndex = restoreLayoutFocus(
      this.actions.map((action) => ({
        id: action,
        visible: true,
        enabled: true,
      })),
      previousAction,
      this.selectedActionIndex,
    ).index;

    const { w, h, px, py, panelW, panelH } = calcPanelLayout(
      this.scene,
      600,
      490,
    );
    const container = createOverlayContainer(
      this.scene,
      "save-slots",
      96,
      { x: px, y: py, width: panelW, height: panelH },
    );
    this.container = container;

    const dim = createDimGraphics(this.scene, w, h, 0.78);
    dim.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, w, h),
      Phaser.Geom.Rectangle.Contains,
    );
    dim.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (
        pointer.x < px
        || pointer.x > px + panelW
        || pointer.y < py
        || pointer.y > py + panelH
      ) {
        this.cancelOrClose();
      }
    });
    container.add(dim);
    container.add(createPanelGraphics(this.scene, px, py, panelW, panelH));

    const title = this.scene.add.text(
      px + panelW / 2,
      py + 12,
      this.mode === "save" ? "Save Campaign" : "Load & Manage Campaigns",
      {
        fontSize: "16px",
        fontFamily: "monospace",
        color: "#ffd700",
      },
    ).setOrigin(0.5, 0);
    title.setData("layoutId", "save-slots-title");
    container.add(title);

    const instruction = this.scene.add.text(
      px + panelW / 2,
      py + 43,
      this.copySourceSlotId
        ? "Choose a manual destination, then Confirm."
        : "Up/Down: slot  Left/Right: action  Enter/Space: select  Esc: back",
      {
        fontSize: "9px",
        fontFamily: "monospace",
        color: "#90a4ae",
        align: "center",
      },
    ).setOrigin(0.5, 0);
    instruction.setData("layoutId", "save-slots-instruction");
    container.add(instruction);

    const rowX = px + 22;
    const rowY = py + 65;
    const rowWidth = panelW - 44;
    this.slots.forEach((slot, index) => {
      const selected = index === this.selectedSlotIndex;
      const stateSymbol = slot.state === "valid"
        ? "●"
        : slot.state === "empty"
          ? "○"
          : "!";
      const copySource = slot.slotId === this.copySourceSlotId ? " [SOURCE]" : "";
      const row = this.scene.add.text(
        rowX,
        rowY + index * 59,
        `${selected ? "▶" : " "} ${stateSymbol} ${slot.displayName}${copySource}\n`
          + `  ${slotStatusText(slot)}`,
        {
          fontSize: "10px",
          fontFamily: "monospace",
          color: selected ? "#ffffff" : slot.state === "corrupt"
            ? "#ff8a80"
            : "#cfd8dc",
          backgroundColor: selected ? "#38435f" : "#20273a",
          padding: { x: 8, y: 4 },
          fixedWidth: rowWidth,
          fixedHeight: 54,
          lineSpacing: 2,
          wordWrap: { width: rowWidth - 16 },
        },
      ).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      row.setData("layoutId", `save-slot-row-${slot.slotId}`);
      row.setData("testId", `save-slot-${slot.slotId}`);
      syncInteractiveHitArea(row);
      row.on("pointerover", () => row.setColor("#ffffff"));
      row.on("pointerout", () => row.setColor(
        index === this.selectedSlotIndex
          ? "#ffffff"
          : slot.state === "corrupt" ? "#ff8a80" : "#cfd8dc",
      ));
      row.on("pointerdown", () => {
        this.selectedSlotIndex = index;
        this.selectedActionIndex = 0;
        this.render();
      });
      container.add(row);
    });

    const actionGrid = layoutResponsiveGrid({
      availableWidth: panelW - 44,
      minColumnWidth: 88,
      columnGap: 6,
      rowGap: 6,
      itemHeights: this.actions.map(() => 32),
      maxColumns: 5,
    });
    const actionY = py + 306;
    this.actions.forEach((action, index) => {
      const cell = actionGrid.cells[index]!;
      const selected = index === this.selectedActionIndex;
      const button = this.scene.add.text(
        px + 22 + cell.x + cell.width / 2,
        actionY + cell.y,
        `${selected ? "▶ " : ""}${ACTION_LABELS[action]}`,
        {
          fontSize: "10px",
          fontFamily: "monospace",
          color: selected ? "#ffffff" : actionColor(action),
          backgroundColor: selected ? "#455a7a" : "#2a2a4e",
          align: "center",
          padding: { x: 5, y: 5 },
          fixedWidth: cell.width,
          fixedHeight: cell.height,
        },
      ).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
      button.setData("layoutId", `save-slot-action-${action}`);
      button.setData("testId", `save-slot-action-${action}`);
      syncInteractiveHitArea(button);
      button.on("pointerover", () => button.setColor("#ffffff"));
      button.on("pointerout", () => button.setColor(
        index === this.selectedActionIndex ? "#ffffff" : actionColor(action),
      ));
      button.on("pointerdown", () => {
        this.selectedActionIndex = index;
        this.activateSelectedAction();
      });
      container.add(button);
    });

    const status = this.scene.add.text(
      px + panelW / 2,
      py + panelH - 48,
      this.status || this.selectedDescription(selectedSlot),
      {
        fontSize: "9px",
        fontFamily: "monospace",
        color: this.status ? this.statusColor : "#90a4ae",
        align: "center",
        wordWrap: { width: panelW - 44 },
      },
    ).setOrigin(0.5, 0);
    status.setData("layoutId", "save-slots-status");
    container.add(status);

    const hint = this.scene.add.text(
      px + panelW / 2,
      py + panelH - 12,
      "Autosave is updated automatically. Manual slots remain independent.",
      {
        fontSize: "8px",
        fontFamily: "monospace",
        color: "#78909c",
      },
    ).setOrigin(0.5, 1);
    hint.setData("layoutId", "save-slots-hint");
    container.add(hint);
    this.announceSelection();
    this.callbacks.onStateChange?.();
  }

  private getActions(slot: SaveSlotInfo): SaveSlotAction[] {
    if (this.pendingConfirmation) return ["confirm", "cancel"];
    if (this.copySourceSlotId) return ["confirm", "cancel"];

    const actions: SaveSlotAction[] = [];
    if (this.mode === "load" && slot.state === "valid") actions.push("load");
    if (this.mode === "save" && slot.kind === "manual") actions.push("save");
    if (slot.kind === "manual" && slot.state === "valid") actions.push("rename");
    if (slot.state === "valid") actions.push("copy", "export");
    if (
      slot.state !== "empty"
      && (this.mode === "load" || slot.kind === "manual")
    ) {
      actions.push("delete");
    }
    if (this.mode === "load" || slot.kind === "manual") actions.push("import");
    actions.push("close");
    return actions;
  }

  private selectedDescription(slot: SaveSlotInfo): string {
    if (this.pendingConfirmation) {
      if (this.pendingConfirmation.kind === "newGame") {
        return "Confirm replacing Autosave with a new campaign.";
      }
      return `${ACTION_LABELS[this.pendingConfirmation.kind]} will replace or remove stored data.`;
    }
    if (this.copySourceSlotId) {
      return slot.slotId === this.copySourceSlotId
        ? "Choose a different manual slot."
        : `Copy into ${slot.displayName}. Existing data requires confirmation.`;
    }
    return slot.diagnostic ?? `${slot.displayName}: ${slot.state}.`;
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.container) return;
    const handledAt = event.timeStamp || performance.now();
    if (
      event.repeat
      || (
        event.key === this.lastHandledKey
        && handledAt - this.lastHandledAt < 80
      )
    ) {
      return;
    }
    this.lastHandledKey = event.key;
    this.lastHandledAt = handledAt;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.cancelOrClose();
      return;
    }
    if (
      event.key === "ArrowUp"
      || event.key === "w"
      || event.key === "W"
    ) {
      event.preventDefault();
      this.moveSlot(-1);
      return;
    }
    if (
      event.key === "ArrowDown"
      || event.key === "s"
      || event.key === "S"
    ) {
      event.preventDefault();
      this.moveSlot(1);
      return;
    }
    if (
      event.key === "ArrowLeft"
      || event.key === "a"
      || event.key === "A"
    ) {
      event.preventDefault();
      this.moveAction(-1);
      return;
    }
    if (
      event.key === "ArrowRight"
      || event.key === "d"
      || event.key === "D"
    ) {
      event.preventDefault();
      this.moveAction(1);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      this.selectedSlotIndex = event.key === "Home" ? 0 : this.slots.length - 1;
      this.selectedActionIndex = 0;
      this.render();
      return;
    }
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.scheduleSelectedAction(event.key === " " ? "keyup-SPACE" : "keyup-ENTER");
  };

  private scheduleSelectedAction(
    eventName: "keyup-ENTER" | "keyup-SPACE",
  ): void {
    if (this.pendingActivation) return;
    const handler = (): void => {
      this.pendingActivation = null;
      if (this.container) this.activateSelectedAction();
    };
    this.pendingActivation = { eventName, handler };
    this.scene.input.keyboard?.once(eventName, handler);
  }

  private moveSlot(direction: -1 | 1): void {
    const selectable = this.copySourceSlotId
      ? this.slots
        .map((slot, index) => ({ slot, index }))
        .filter(({ slot }) =>
          slot.kind === "manual" && slot.slotId !== this.copySourceSlotId
        )
      : this.slots.map((slot, index) => ({ slot, index }));
    if (selectable.length === 0) return;
    const current = selectable.findIndex(
      ({ index }) => index === this.selectedSlotIndex,
    );
    const next = (Math.max(current, 0) + direction + selectable.length)
      % selectable.length;
    this.selectedSlotIndex = selectable[next]!.index;
    this.selectedActionIndex = 0;
    this.status = "";
    this.render();
  }

  private moveAction(direction: -1 | 1): void {
    if (this.actions.length === 0) return;
    this.selectedActionIndex = (
      this.selectedActionIndex + direction + this.actions.length
    ) % this.actions.length;
    this.render();
  }

  private activateSelectedAction(): void {
    const action = this.actions[this.selectedActionIndex];
    const slot = this.slots[this.selectedSlotIndex];
    if (!action || !slot) return;

    if (action === "close") {
      this.close();
      return;
    }
    if (action === "cancel") {
      this.cancelPendingAction();
      return;
    }
    if (action === "confirm") {
      this.confirmPendingAction(slot);
      return;
    }
    if (action === "load") {
      this.close();
      this.callbacks.load(slot.slotId);
      return;
    }
    if (action === "save") {
      if (slot.state === "empty") {
        this.applyResult(this.callbacks.save(slot.slotId, false));
      } else {
        this.requestConfirmation({ kind: "save", targetSlotId: slot.slotId });
      }
      return;
    }
    if (action === "rename") {
      openMobileTextInput(
        "Save slot name",
        slot.displayName,
        24,
        (name) => this.applyResult(renameSaveSlot(slot.slotId, name)),
      );
      return;
    }
    if (action === "copy") {
      this.copySourceSlotId = slot.slotId;
      const target = this.slots.findIndex((candidate) =>
        candidate.kind === "manual" && candidate.slotId !== slot.slotId
      );
      this.selectedSlotIndex = Math.max(0, target);
      this.selectedActionIndex = 0;
      this.status = "";
      this.render();
      return;
    }
    if (action === "delete") {
      this.requestConfirmation({ kind: "delete", targetSlotId: slot.slotId });
      return;
    }
    if (action === "export") {
      this.exportSlot(slot.slotId);
      return;
    }
    if (action === "import") {
      if (slot.state === "empty") {
        this.openImportPicker(slot.slotId, false);
      } else {
        this.requestConfirmation({ kind: "import", targetSlotId: slot.slotId });
      }
    }
  }

  private confirmPendingAction(selectedSlot: SaveSlotInfo): void {
    if (this.copySourceSlotId && !this.pendingConfirmation) {
      if (
        selectedSlot.kind !== "manual"
        || selectedSlot.slotId === this.copySourceSlotId
      ) {
        this.setStatus("Choose a different manual destination.", false);
        return;
      }
      if (selectedSlot.state === "empty") {
        const sourceSlotId = this.copySourceSlotId;
        this.copySourceSlotId = null;
        this.applyResult(copySaveSlot(sourceSlotId, selectedSlot.slotId));
      } else {
        this.requestConfirmation({
          kind: "copy",
          sourceSlotId: this.copySourceSlotId,
          targetSlotId: selectedSlot.slotId,
        });
      }
      return;
    }

    const pending = this.pendingConfirmation;
    if (!pending) return;
    this.pendingConfirmation = null;
    if (pending.kind === "newGame") {
      const start = this.startNewGame;
      this.close();
      start?.();
    } else if (pending.kind === "save") {
      this.applyResult(this.callbacks.save(pending.targetSlotId, true));
    } else if (pending.kind === "delete") {
      this.applyResult(deleteSave(pending.targetSlotId));
    } else if (pending.kind === "import") {
      this.openImportPicker(pending.targetSlotId, true);
    } else if (pending.sourceSlotId) {
      this.copySourceSlotId = null;
      this.applyResult(copySaveSlot(
        pending.sourceSlotId,
        pending.targetSlotId,
        true,
      ));
    }
  }

  private requestConfirmation(confirmation: PendingConfirmation): void {
    this.pendingConfirmation = confirmation;
    this.selectedActionIndex = 0;
    this.status = `Confirm ${confirmation.kind} for `
      + `${slotDisplay(confirmation.targetSlotId, this.slots)}?`;
    this.statusColor = "#ffcc80";
    this.render();
  }

  private cancelPendingAction(): void {
    const wasNewGame = this.pendingConfirmation?.kind === "newGame";
    this.pendingConfirmation = null;
    this.copySourceSlotId = null;
    this.startNewGame = null;
    if (wasNewGame) {
      this.close();
      return;
    }
    this.selectedActionIndex = 0;
    this.status = "Action cancelled.";
    this.statusColor = "#b0bec5";
    this.render();
  }

  private cancelOrClose(): void {
    if (this.pendingConfirmation || this.copySourceSlotId) {
      this.cancelPendingAction();
    } else {
      this.close();
    }
  }

  private applyResult(result: SaveActionResult): void {
    this.setStatus(
      result.ok
        ? result.warning ? `${result.message} ${result.warning}` : result.message
        : result.message,
      result.ok,
    );
  }

  private setStatus(message: string, success: boolean): void {
    this.status = message;
    this.statusColor = success ? "#88ff88" : "#ff8a80";
    this.selectedActionIndex = 0;
    this.render();
  }

  private exportSlot(slotId: SaveSlotId): void {
    const result = exportSaveSlot(slotId);
    if (!result.ok) {
      this.setStatus(result.message, false);
      return;
    }
    try {
      const url = URL.createObjectURL(new Blob([result.json], {
        type: "application/json",
      }));
      const link = document.createElement("a");
      link.href = url;
      link.download = result.fileName;
      link.click();
      URL.revokeObjectURL(url);
      this.setStatus(`Exported ${result.fileName}.`, true);
    } catch (error: unknown) {
      this.setStatus(`Export failed: ${String(error)}`, false);
    }
  }

  private openImportPicker(slotId: SaveSlotId, overwrite: boolean): void {
    this.importInput?.remove();
    const input = document.createElement("input");
    input.id = "save-slot-import-input";
    input.type = "file";
    input.accept = ".json,application/json";
    input.setAttribute("aria-label", `Import campaign into ${slotId}`);
    input.style.position = "fixed";
    input.style.left = "-10000px";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        this.applyResult(importSaveSlot(slotId, await file.text(), overwrite));
      } catch (error: unknown) {
        this.setStatus(`Import failed: ${String(error)}`, false);
      } finally {
        input.remove();
        if (this.importInput === input) this.importInput = null;
      }
    }, { once: true });
    document.body.append(input);
    this.importInput = input;
    input.click();
  }

  private createLiveRegion(): void {
    const region = document.createElement("div");
    region.id = "save-slot-live-region";
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    region.style.position = "fixed";
    region.style.width = "1px";
    region.style.height = "1px";
    region.style.overflow = "hidden";
    region.style.clipPath = "inset(50%)";
    document.body.append(region);
    this.liveRegion = region;
  }

  private announceSelection(): void {
    const slot = this.slots[this.selectedSlotIndex];
    const action = this.actions[this.selectedActionIndex];
    if (!this.liveRegion || !slot) return;
    this.liveRegion.textContent = [
      this.mode === "save" ? "Save campaigns" : "Load campaigns",
      slot.displayName,
      slotStatusText(slot).replace(/\n/g, ". "),
      action ? ACTION_LABELS[action] : "",
      this.status,
    ].filter(Boolean).join(". ");
  }
}

function slotDisplay(slotId: SaveSlotId, slots: readonly SaveSlotInfo[]): string {
  return slots.find((slot) => slot.slotId === slotId)?.displayName ?? slotId;
}
