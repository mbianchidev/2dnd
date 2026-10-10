// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { DevotionAccessibility } from "../src/managers/devotionAccessibility";

afterEach(() => document.body.replaceChildren());

describe("devotion native accessibility bridge", () => {
  it("provides named native controls, synchronized focus and a polite result region", () => {
    const selected = vi.fn();
    const activated = vi.fn();
    const bridge = new DevotionAccessibility(selected, activated);
    bridge.open();
    bridge.update("Mock temple", ["Affiliation: none.", "Devotion: 0/100."], [
      { id: "choose", label: "Choose a figure", enabled: true },
      { id: "used", label: "Already performed", enabled: false },
      { id: "close", label: "Close", enabled: true },
    ], "choose");
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)?.textContent)
      .toBe("Mock temple");
    expect(document.getElementById(dialog.getAttribute("aria-describedby")!)?.textContent)
      .toContain("Affiliation: none");
    expect((document.activeElement as HTMLButtonElement).dataset.devotionAction).toBe("choose");
    bridge.moveTab(false);
    expect((document.activeElement as HTMLButtonElement).dataset.devotionAction).toBe("close");
    bridge.moveTab(false);
    expect((document.activeElement as HTMLButtonElement).dataset.devotionAction).toBe("choose");
    bridge.moveTab(true);
    expect(selected).toHaveBeenLastCalledWith("close");
    (document.activeElement as HTMLButtonElement).click();
    expect(activated).toHaveBeenLastCalledWith("close");
    bridge.announce("Choice cancelled.");
    expect(document.querySelector('[role="status"]')?.textContent).toBe("Choice cancelled.");
    bridge.close();
    expect(document.getElementById("devotion-accessibility")).toBeNull();
  });

  it("restores the original focus and does not retain removed controls or listeners", () => {
    const previous = document.createElement("button");
    document.body.append(previous);
    previous.focus();
    const activated = vi.fn();
    const bridge = new DevotionAccessibility(() => {}, activated);
    bridge.open();
    bridge.update("Profile", ["Mock details"], [{ id: "close", label: "Close", enabled: true }], "close");
    bridge.close();
    expect(document.activeElement).toBe(previous);
    bridge.open();
    bridge.update("Profile", ["New details"], [{ id: "return", label: "Return", enabled: true }], "return");
    expect(document.querySelectorAll("#devotion-accessibility")).toHaveLength(1);
    expect(document.querySelectorAll('[data-devotion-action="close"]')).toHaveLength(0);
    bridge.close();
  });
});
