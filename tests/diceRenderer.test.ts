// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiceRollRenderer } from "../src/renderers/dice";
import { normalizeGamePreferences } from "../src/systems/accessibility";
import {
  createD20Presentation,
  formatDicePresentation,
  type DicePresentationEvent,
} from "../src/systems/dicePresentation";

function event(sequence = 1): DicePresentationEvent {
  const presentation = createD20Presentation({
    naturalRolls: [20, 1], selectedIndex: 1, selection: "disadvantage",
    naturalRoll: 1, modifier: 2, total: 3,
  }, { category: "attack", label: "Test attack", outcome: "fumble" });
  return { presentation, text: formatDicePresentation(presentation), duration: 450, sequence };
}

describe("procedural resolved-dice renderer", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="game-inner"><div id="game-container"><canvas></canvas></div></div>';
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("renders only exact faces, selected text, an accessible result and bounded log", () => {
    const renderer = new DiceRollRenderer(vi.fn());
    const result = event();
    renderer.record(result);
    renderer.show(result, normalizeGamePreferences(undefined));
    expect([...renderer.root.querySelectorAll(".resolved-die")].map((die) =>
      (die as HTMLElement).dataset.natural)).toEqual(["20", "1"]);
    expect(renderer.root.querySelector(".selected")?.textContent).toContain("1d20 selected");
    expect(document.querySelector('[role="status"]')?.textContent).toBe(result.text);
    expect(document.getElementById("dice-announcement")?.hidden).toBe(false);
    expect(renderer.root.querySelector("p")?.textContent).toBe(result.text);
    expect(renderer.root.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(renderer.root.querySelector("summary")?.textContent).toBe("Roll log (1)");
    for (let index = 2; index <= 45; index++) renderer.record(event(index));
    expect(renderer.root.querySelectorAll("li")).toHaveLength(40);
    renderer.destroy();
    expect(document.getElementById("dice-presentation")).toBeNull();
    expect(document.getElementById("dice-announcement")).toBeNull();
  });

  it("keeps disabled information, text scale and high contrast without dice animation", () => {
    const renderer = new DiceRollRenderer(vi.fn());
    const result = { ...event(), duration: 0 };
    renderer.record(result);
    renderer.show(result, normalizeGamePreferences({
      accessibility: { textScale: 1.5, highContrast: true, reducedMotion: true },
      dice: { frequency: "off", speed: "instant" },
    }));
    expect(renderer.root.querySelectorAll("svg")).toHaveLength(0);
    expect(renderer.root.dataset.phase).toBe("ready");
    expect(renderer.root.style.getPropertyValue("--dice-text-scale")).toBe("1.5");
    expect(renderer.root.classList.contains("high-contrast")).toBe(true);
    expect(renderer.root.querySelector("p")?.textContent).toBe(result.text);
    expect(renderer.root.querySelector("button")?.disabled).toBe(true);
    renderer.destroy();
  });

  it("routes skip without consuming the same Enter/Space in the game", () => {
    const skip = vi.fn();
    const gameKey = vi.fn();
    window.addEventListener("keydown", gameKey);
    const renderer = new DiceRollRenderer(skip);
    renderer.show(event(), normalizeGamePreferences(undefined));
    const button = renderer.root.querySelector("button")!;
    button.dispatchEvent(new KeyboardEvent("keydown", {
      code: "Space", bubbles: true,
    }));
    button.click();
    expect(skip).toHaveBeenCalledTimes(1);
    expect(gameKey).not.toHaveBeenCalled();
    renderer.destroy();
    window.removeEventListener("keydown", gameKey);
  });
});
