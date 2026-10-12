// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeTextEntry,
  handleTextEntryAction,
  openMobileTextInput,
} from "../src/managers/textEntry";
import { gamePreferences } from "../src/systems/accessibility";
import { inputSource } from "../src/systems/input";

describe("shared text-entry surface", () => {
  beforeEach(() => {
    localStorage.clear();
    gamePreferences.reload();
    inputSource.set("keyboard");
    document.body.replaceChildren();
  });

  afterEach(() => {
    closeTextEntry();
    document.body.replaceChildren();
  });

  it("keeps keyboard typing and once-only submit with focus restoration", () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const commit = vi.fn();
    openMobileTextInput("Hero name", "Hero", 12, commit);
    const input = document.querySelector<HTMLInputElement>("#mobile-text-input input")!;
    expect(document.activeElement).toBe(input);
    expect(document.querySelector<HTMLElement>("#controller-keyboard")!.hidden).toBe(true);
    input.value = "Mock Hero";
    expect(handleTextEntryAction("confirm")).toBe(true);
    expect(commit).toHaveBeenCalledExactlyOnceWith("Mock Hero");
    expect(handleTextEntryAction("confirm")).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it.each(["Hero name", "Save name", "Codex search"])(
    "uses the same controller keyboard for %s",
    (label) => {
      inputSource.set("gamepad");
      const commit = vi.fn();
      openMobileTextInput(label, "Initial", 20, commit);
      const keyboard = document.querySelector<HTMLElement>("#controller-keyboard")!;
      expect(keyboard.hidden).toBe(false);
      expect(handleTextEntryAction("interact")).toBe(true);
      expect(handleTextEntryAction("confirm")).toBe(true);
      const input = document.querySelector<HTMLInputElement>("#mobile-text-input input")!;
      expect(input.value).toBe("q");
      expect(handleTextEntryAction("openMenu")).toBe(true);
      expect(commit).toHaveBeenCalledExactlyOnceWith("q");
      expect(document.getElementById("mobile-text-input")).toBeNull();
    },
  );

  it("cancels without committing and can reconnect with the existing edit", () => {
    const commit = vi.fn();
    openMobileTextInput("Save name", "Mock", 24, commit);
    inputSource.set("gamepad");
    handleTextEntryAction("confirm");
    inputSource.set("keyboard");
    expect(document.querySelector<HTMLElement>("#controller-keyboard")!.hidden).toBe(true);
    inputSource.set("gamepad");
    expect(document.querySelector<HTMLElement>("#controller-keyboard")!.hidden).toBe(false);
    handleTextEntryAction("cancel");
    expect(commit).not.toHaveBeenCalled();
    expect(document.getElementById("mobile-text-input")).toBeNull();
  });

  it("keeps the first physical character when switching from a controller key to typing", () => {
    inputSource.set("gamepad");
    openMobileTextInput("Mock name", "Initial", 20, vi.fn());
    handleTextEntryAction("navigateRight");
    const selected = document.querySelector<HTMLButtonElement>("#controller-keyboard [data-selected=true]");
    const input = document.querySelector<HTMLInputElement>("#mobile-text-input input");
    if (!selected || !input) throw new Error("Missing controller-to-keyboard fixture");
    selected.dispatchEvent(new KeyboardEvent("keydown", { key: "w", code: "KeyW", bubbles: true }));
    expect(input.value).toBe("w");
    expect(document.activeElement).toBe(input);
    expect(document.querySelector<HTMLElement>("#controller-keyboard")!.hidden).toBe(true);
  });

  it("uses icon hints with descriptive accessible button positions", () => {
    inputSource.set("gamepad");
    openMobileTextInput("Mock icons", "", 20, vi.fn());
    const hint = document.querySelector("#controller-keyboard p");
    expect(hint?.textContent).toContain("↑ ↓ ← →");
    expect(hint?.textContent).not.toMatch(/\b(north|west|south|east)\b/i);
    expect(hint?.getAttribute("aria-label")).toContain("Bottom face button");
  });

  it("updates accessibility live without adding campaign data", () => {
    inputSource.set("gamepad");
    localStorage.setItem("2dnd_save", "untouched mock campaign");
    openMobileTextInput("Search", "", 24, vi.fn());
    gamePreferences.cycleTextScale();
    gamePreferences.cycleTextScale();
    gamePreferences.setHighContrast(true);
    const form = document.querySelector<HTMLElement>("#mobile-text-input")!;
    expect(form.dataset.textScale).toBe("1.5");
    expect(form.dataset.highContrast).toBe("true");
    expect(localStorage.getItem("2dnd_save")).toBe("untouched mock campaign");
  });

  it("closes an existing form before replacing it and does not replay callbacks", () => {
    const firstCommit = vi.fn();
    openMobileTextInput("First", "", 12, firstCommit);
    openMobileTextInput("Second", "Mock", 12, vi.fn());
    expect(document.querySelectorAll("#mobile-text-input")).toHaveLength(1);
    closeTextEntry();
    closeTextEntry();
    expect(firstCommit).not.toHaveBeenCalled();
    expect(handleTextEntryAction("confirm")).toBe(false);
  });

  it("isolates the game while modal and restores its prior inert state", () => {
    const wrapper = document.createElement("div");
    wrapper.id = "game-wrapper";
    document.body.append(wrapper);
    openMobileTextInput("Mock modal", "", 12, vi.fn());
    expect(wrapper.inert).toBe(true);
    expect(document.getElementById("text-entry-backdrop")).not.toBeNull();
    closeTextEntry();
    expect(wrapper.inert).toBe(false);
    expect(document.getElementById("text-entry-backdrop")).toBeNull();
  });
});
