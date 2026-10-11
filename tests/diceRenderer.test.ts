// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiceRollRenderer } from "../src/renderers/dice";
import { normalizeGamePreferences } from "../src/systems/accessibility";
import {
  createD20Presentation,
  createCombatDicePresentation,
  createEffectDicePresentation,
  combineDicePresentations,
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

  it("displays the hit and actual damage dice together with different procedural die geometry", () => {
    const renderer = new DiceRollRenderer(vi.fn());
    const presentation = createCombatDicePresentation({
      rollResult: {
        naturalRolls: [20], selectedIndex: 0, selection: "normal",
        naturalRoll: 20, modifier: 3, total: 23,
      },
      hit: true, critical: true, damage: 10,
      damageRoll: {
        roll: { sides: 6, naturalRolls: [1, 6], modifier: 3, total: 10 },
        modifiers: [{ label: "Strength", value: 3 }], adjustments: [],
        amount: 10, application: { amount: 2, limit: "Overkill" }, criticalDice: true,
      },
    }, { label: "Attack" })!;
    const text = formatDicePresentation(presentation);
    renderer.show({ presentation, text, duration: 0, sequence: 1 }, normalizeGamePreferences(undefined));
    expect([...renderer.root.querySelectorAll<HTMLElement>(".resolved-die")].map(
      (die) => [die.dataset.sides, die.dataset.natural],
    )).toEqual([["20", "20"], ["6", "1"], ["6", "6"]]);
    const outlines = [...renderer.root.querySelectorAll("polygon")].map((outline) => outline.getAttribute("points"));
    expect(outlines[0]).not.toBe(outlines[1]);
    expect(outlines[1]).toBe(outlines[2]);
    expect(renderer.root.querySelector("p")?.textContent).toContain("HP lost 2 (Overkill)");
    expect(document.getElementById("dice-announcement")?.textContent).toBe(text);
    renderer.destroy();
  });

  it("renders a shared area pool once while retaining every target's applied result", () => {
    const renderer = new DiceRollRenderer(vi.fn());
    const views = [16, 4, 0].map((amount, index) => createCombatDicePresentation({
      rollResult: {
        naturalRolls: [15], selectedIndex: 0, selection: "normal",
        naturalRoll: 15, modifier: 4, total: 19,
      },
      hit: true, damage: amount,
      damageRoll: {
        roll: { sides: 10, naturalRolls: [6], modifier: 2, total: 8 },
        modifiers: [{ label: "Statuses", value: 2 }], adjustments: [],
        amount, application: { amount }, shared: true,
      },
    }, {
      label: `Area target ${index}`, actorId: "party:hero", targetId: `fixture:${index}`,
      actionId: "fireBolt", sharedRoll: true,
    })!);
    const presentation = combineDicePresentations(views[0]!, views.slice(1));
    const text = formatDicePresentation(presentation);
    renderer.show({ presentation, text, duration: 0, sequence: 1 }, normalizeGamePreferences(undefined));
    expect(renderer.root.querySelectorAll(".resolved-die")).toHaveLength(2);
    expect(renderer.root.querySelectorAll('[data-sides="20"]')).toHaveLength(1);
    expect(renderer.root.querySelectorAll('[data-sides="10"]')).toHaveLength(1);
    for (const amount of [16, 4, 0]) {
      expect(renderer.root.querySelector("p")?.textContent).toContain(`HP lost ${amount}`);
    }
    expect(renderer.root.querySelector("p")?.textContent).toContain("(shared roll)");
    renderer.destroy();
  });

  it("keeps exact non-d20 faces and totals static and cancels repeated cleanup safely", () => {
    const renderer = new DiceRollRenderer(vi.fn());
    const views = [4, 6, 8, 10, 12, 20, 100].map((sides) =>
      createEffectDicePresentation({
        roll: { sides, naturalRolls: [sides], modifier: 0, total: sides },
        modifiers: [], adjustments: [], amount: sides,
      }, { category: "healing", label: `d${sides} heal`, outcome: "success" }),
    );
    const presentation = combineDicePresentations(views[0]!, views.slice(1));
    const preferences = normalizeGamePreferences({
      accessibility: { textScale: 1.5, highContrast: true, reducedMotion: true },
      dice: { frequency: "all", speed: "instant" },
    });
    renderer.show({
      presentation, text: formatDicePresentation(presentation), duration: 0, sequence: 1,
    }, preferences);
    expect([...renderer.root.querySelectorAll<HTMLElement>(".resolved-die")].map((die) =>
      die.dataset.sides)).toEqual(["4", "6", "8", "10", "12", "20", "100"]);
    expect(renderer.root.dataset.phase).toBe("ready");
    expect(renderer.root.querySelector<HTMLButtonElement>("button")?.disabled).toBe(true);
    expect(renderer.root.classList.contains("high-contrast")).toBe(true);
    renderer.destroy();
    renderer.destroy();
    expect(document.getElementById("dice-presentation")).toBeNull();
    expect(document.getElementById("dice-announcement")).toBeNull();
  });
});
