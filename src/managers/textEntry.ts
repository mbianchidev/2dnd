import { gamePreferences } from "../systems/accessibility";
import { inputSource, type InputAction } from "../systems/input";
import {
  editTextSelection,
  moveTextKeySelection,
  TEXT_KEY_ROWS,
  type TextKey,
  type TextKeySelection,
} from "../systems/textEntry";
import type { GridNavigationDirection } from "../systems/layout";

interface ActiveTextEntry {
  readonly form: HTMLFormElement;
  handle(action: InputAction): void;
  close(): void;
}

let activeEntry: ActiveTextEntry | null = null;

export function isTextEntryOpen(): boolean {
  return activeEntry !== null && activeEntry.form.isConnected;
}

export function closeTextEntry(): void {
  activeEntry?.close();
}

export function handleTextEntryAction(action: InputAction): boolean {
  if (!activeEntry) return false;
  if (!activeEntry.form.isConnected) {
    activeEntry.close();
    return false;
  }
  activeEntry.handle(action);
  return true;
}

/** Shared native HTML text entry for names, slot labels and searches. */
export function openMobileTextInput(
  label: string,
  initialValue: string,
  maximumLength: number,
  onCommit: (value: string) => void,
): void {
  editTextSelection("", 0, 0, "", maximumLength);
  closeTextEntry();
  const previousFocus = document.activeElement;
  const gameWrapper = document.getElementById("game-wrapper");
  const wasInert = gameWrapper?.inert ?? false;
  if (gameWrapper) gameWrapper.inert = true;
  const backdrop = document.createElement("div");
  backdrop.id = "text-entry-backdrop";
  backdrop.setAttribute("aria-hidden", "true");
  const form = document.createElement("form");
  form.id = "mobile-text-input";
  form.setAttribute("role", "dialog");
  form.setAttribute("aria-modal", "true");
  form.setAttribute("aria-label", label);
  const heading = document.createElement("label");
  heading.htmlFor = "text-entry-value";
  heading.textContent = label;
  const fieldRow = document.createElement("div");
  fieldRow.className = "text-entry-field";
  const input = document.createElement("input");
  input.id = "text-entry-value";
  input.type = "text";
  input.value = initialValue.slice(0, maximumLength);
  input.maxLength = maximumLength;
  input.autocomplete = "off";
  const commit = document.createElement("button");
  commit.type = "submit";
  commit.textContent = "Done";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel";
  const keyboard = document.createElement("div");
  keyboard.id = "controller-keyboard";
  keyboard.setAttribute("role", "group");
  keyboard.setAttribute("aria-label", "Controller keyboard");
  const hint = document.createElement("p");
  hint.textContent = "D-pad: select | South: type | West: delete | Menu: done | East: cancel";
  keyboard.append(hint);
  const keyViewport = document.createElement("div");
  keyViewport.className = "text-entry-keys";
  keyboard.append(keyViewport);
  let selection: TextKeySelection = { row: 1, column: 0 };
  let shifted = false;
  let closed = false;
  const buttons: HTMLButtonElement[][] = [];

  const updateKeys = (): void => {
    TEXT_KEY_ROWS.forEach((row, rowIndex) => row.forEach((key, column) => {
      const button = buttons[rowIndex]![column]!;
      button.textContent = key.kind === "command"
        ? key.label
        : key.value === " " ? "Space" : shifted ? key.value.toUpperCase() : key.value;
      const selected = selection.row === rowIndex && selection.column === column;
      button.dataset.selected = String(selected);
      if (selected) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
      if (key.kind === "command" && key.command === "shift") {
        button.setAttribute("aria-pressed", String(shifted));
      }
    }));
    if (!keyboard.hidden && form.isConnected && inputSource.get() === "gamepad") {
      const selected = buttons[selection.row]![selection.column]!;
      selected.focus({ preventScroll: true });
      selected.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "instant" });
    }
  };

  const applyEdit = (value: string): void => {
    const edit = editTextSelection(
      input.value,
      input.selectionStart ?? input.value.length,
      input.selectionEnd ?? input.value.length,
      value,
      maximumLength,
    );
    input.value = edit.value;
    input.setSelectionRange(edit.cursor, edit.cursor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const activateKey = (key: TextKey): void => {
    if (key.kind === "character") {
      applyEdit(shifted ? key.value.toUpperCase() : key.value);
    } else if (key.command === "shift") {
      shifted = !shifted;
      updateKeys();
    } else if (key.command === "done") {
      form.requestSubmit();
    } else if (key.command === "cancel") {
      close();
    } else {
      applyEdit(key.command);
    }
  };

  TEXT_KEY_ROWS.forEach((row, rowIndex) => {
    const element = document.createElement("div");
    element.className = "text-entry-key-row";
    const rowButtons: HTMLButtonElement[] = [];
    row.forEach((key, column) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.textKey = key.id;
      if (key.kind === "command") button.className = "text-entry-command";
      if (key.kind === "command" && key.command === "shift") {
        button.setAttribute("aria-label", "Change letter case");
      }
      button.addEventListener("pointerdown", (event) => event.preventDefault());
      button.addEventListener("click", () => {
        selection = { row: rowIndex, column };
        updateKeys();
        activateKey(key);
      });
      rowButtons.push(button);
      element.append(button);
    });
    buttons.push(rowButtons);
    keyViewport.append(element);
  });

  const applyAccessibility = (): void => {
    const preferences = gamePreferences.getAccessibility();
    form.dataset.textScale = String(preferences.textScale);
    form.dataset.highContrast = String(preferences.highContrast);
    form.style.setProperty("--text-entry-scale", String(preferences.textScale));
  };
  const applySource = (): void => {
    keyboard.hidden = inputSource.get() !== "gamepad";
    if (keyboard.hidden && keyboard.contains(document.activeElement)) {
      input.focus({ preventScroll: true });
    }
    updateKeys();
  };
  const unsubscribePreferences = gamePreferences.subscribe(applyAccessibility);
  const unsubscribeSource = inputSource.subscribe(applySource);
  const close = (): void => {
    if (closed) return;
    closed = true;
    unsubscribePreferences();
    unsubscribeSource();
    form.remove();
    backdrop.remove();
    if (gameWrapper) gameWrapper.inert = wasInert;
    if (activeEntry?.form === form) activeEntry = null;
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
      previousFocus.focus({ preventScroll: true });
    }
  };
  const handle = (action: InputAction): void => {
    if (action === "cancel") {
      close();
    } else if (action === "openMenu") {
      form.requestSubmit();
    } else if (action === "interact" && !keyboard.hidden) {
      applyEdit("backspace");
    } else if (
      action === "confirm" || action === "interact" || action === "inventoryPrimary"
    ) {
      if (keyboard.hidden) form.requestSubmit();
      else activateKey(TEXT_KEY_ROWS[selection.row]![selection.column]!);
    } else {
      const directions: Partial<Record<InputAction, GridNavigationDirection>> = {
        navigateUp: "up", moveUp: "up", inventoryPrevious: "up",
        navigateDown: "down", moveDown: "down", inventoryNext: "down",
        navigateLeft: "left", moveLeft: "left", inventoryPagePrevious: "left",
        navigateRight: "right", moveRight: "right", inventoryPageNext: "right",
      };
      const direction = directions[action];
      if (direction) {
        selection = moveTextKeySelection(selection, direction);
        updateKeys();
      }
    }
  };
  form.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      const focusable = [...form.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
        "input, button",
      )].filter((element) => !element.closest("[hidden]"));
      const current = focusable.findIndex((element) => element === document.activeElement);
      const next = (current + (event.shiftKey ? -1 : 1) + focusable.length)
        % focusable.length;
      event.preventDefault();
      focusable[next]?.focus();
    }
  });
  form.addEventListener("keyup", (event) => event.stopPropagation());
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (closed) return;
    const value = input.value;
    close();
    onCommit(value);
  });
  cancel.addEventListener("click", close);
  fieldRow.append(input, commit, cancel);
  form.append(heading, fieldRow, keyboard);
  document.body.append(backdrop, form);
  activeEntry = { form, handle, close };
  applyAccessibility();
  applySource();
  input.focus();
  input.select();
}
