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
    const canvas = document.querySelector("canvas")!;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(new DOMRect(80, 100, 640, 528));
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("renders exact numbered faces over the canvas without an external dock or log", () => {
    const renderer = new DiceRollRenderer(vi.fn());
    const result = event();
    renderer.show(result, normalizeGamePreferences(undefined));
    expect([...renderer.root.querySelectorAll(".resolved-die")].map((die) =>
      (die as HTMLElement).dataset.natural)).toEqual(["20", "1"]);
    expect(renderer.root.querySelector(".selected")?.textContent).toContain("1d20*");
    expect(document.querySelector('[role="status"]')?.textContent).toBe(result.text);
    expect(document.getElementById("dice-announcement")?.hidden).toBe(false);
    expect(renderer.root.querySelector("p")?.textContent).toBe(result.text);
    expect(renderer.root.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(renderer.root.querySelector("details")).toBeNull();
    expect(document.getElementById("dice-log")).toBeNull();
    expect(renderer.root.style.left).toBe("80px");
    expect(Number.parseFloat(renderer.root.style.top)).toBeCloseTo(126.4);
    expect(renderer.root.style.width).toBe("640px");
    renderer.destroy();
    expect(document.getElementById("dice-presentation")).toBeNull();
    expect(document.getElementById("dice-announcement")).toBeNull();
  });

  it("keeps battle details only in the lower log while retaining faces, announcements and skip", () => {
    const skip = vi.fn();
    const renderer = new DiceRollRenderer(skip, "battle");
    const result = event();
    renderer.show(result, normalizeGamePreferences(undefined));
    expect(document.getElementById("dice-result")).toBeNull();
    expect(renderer.root.dataset.scope).toBe("battle");
    expect(renderer.root.querySelectorAll(".resolved-die")).toHaveLength(2);
    expect(document.getElementById("dice-announcement")?.textContent).toBe(result.text);
    renderer.root.querySelector<HTMLButtonElement>("button")!.click();
    expect(skip).toHaveBeenCalledOnce();
    renderer.applyPreferences(normalizeGamePreferences({
      accessibility: { textScale: 1.5, highContrast: true },
    }));
    expect(document.getElementById("dice-result")).toBeNull();
    expect(renderer.root.querySelectorAll(".resolved-die")).toHaveLength(2);
    renderer.hide();
    expect(document.getElementById("dice-announcement")?.textContent).toBe("");
    renderer.destroy();
  });

  it("draws exact faces with crisp pixel numerals rather than smooth system-font text", () => {
    const renderer = new DiceRollRenderer(vi.fn());
    renderer.show(event(), normalizeGamePreferences(undefined));
    const dice = [...renderer.root.querySelectorAll<HTMLElement>(".resolved-die")];
    for (const die of dice) {
      const svg = die.querySelector("svg")!;
      expect(svg.getAttribute("viewBox")).toBe("0 0 32 32");
      expect(svg.getAttribute("shape-rendering")).toBe("crispEdges");
      expect(svg.querySelector("text")).toBeNull();
      expect(svg.querySelector("[data-pixel-number]")?.getAttribute("data-pixel-number"))
        .toBe(die.dataset.natural);
      expect(svg.querySelector(".die-number path")?.getAttribute("d")).toMatch(/h2v2h-2z/);
    }
    renderer.destroy();
  });

  it("does not display or announce an ordinary disabled roll or create separate history", () => {
    const renderer = new DiceRollRenderer(vi.fn());
    const presentation = createD20Presentation({
      naturalRolls: [12], selectedIndex: 0, selection: "normal",
      naturalRoll: 12, modifier: 3, total: 15,
    }, { category: "attack", label: "Ordinary attack", outcome: "hit" });
    const result = { presentation, text: formatDicePresentation(presentation), duration: 0, sequence: 1 };
    renderer.show(result, normalizeGamePreferences({
      accessibility: { textScale: 1.5, highContrast: true, reducedMotion: true },
      dice: { frequency: "off", speed: "instant" },
    }));
    expect(renderer.root.querySelectorAll("svg")).toHaveLength(0);
    expect(renderer.root.hidden).toBe(true);
    expect(renderer.root.dataset.phase).toBe("ready");
    expect(renderer.root.style.getPropertyValue("--dice-text-scale")).toBe("1.5");
    expect(renderer.root.classList.contains("high-contrast")).toBe(true);
    expect(renderer.root.querySelector("p")?.textContent).toBe(result.text);
    expect(renderer.root.querySelector("li")).toBeNull();
    expect(document.getElementById("dice-announcement")?.textContent).toBe("");
    expect(renderer.root.querySelector("button")?.disabled).toBe(true);
    renderer.destroy();
  });

  it.each(["critical", "fumble"] as const)("keeps %s faces visible with Off and instant/reduced motion", (outcome) => {
    const renderer = new DiceRollRenderer(vi.fn());
    const natural = outcome === "critical" ? 20 : 1;
    const presentation = createD20Presentation({
      naturalRolls: [natural], selectedIndex: 0, selection: "normal",
      naturalRoll: natural, modifier: 3, total: natural + 3,
    }, { category: "attack", label: "Mandatory result", outcome });
    const result = { presentation, text: formatDicePresentation(presentation), duration: 0, sequence: 1 };
    renderer.show(result, normalizeGamePreferences({
      dice: { frequency: "off", speed: "instant" },
      accessibility: { reducedMotion: true },
    }));
    expect(renderer.root.hidden).toBe(false);
    expect(renderer.root.querySelectorAll(".resolved-die")).toHaveLength(1);
    expect(renderer.root.querySelector<HTMLElement>(".resolved-die")?.dataset.natural).toBe(String(natural));
    expect(document.getElementById("dice-announcement")?.textContent).toBe(result.text);
    expect(document.getElementById("dice-roll-stage")?.hidden).toBe(false);
    renderer.applyPreferences(normalizeGamePreferences({ dice: { frequency: "off", speed: "normal" } }));
    expect(renderer.root.querySelectorAll(".resolved-die")).toHaveLength(1);
    renderer.destroy();
  });

  it("applies visibility live and never revives a result that has been dismissed", () => {
    const renderer = new DiceRollRenderer(vi.fn());
    const presentation = createD20Presentation({
      naturalRolls: [12], selectedIndex: 0, selection: "normal",
      naturalRoll: 12, modifier: 3, total: 15,
    }, { category: "attack", label: "Ordinary attack", outcome: "hit" });
    renderer.show({
      presentation, text: formatDicePresentation(presentation), duration: 0, sequence: 1,
    }, normalizeGamePreferences(undefined));
    renderer.applyPreferences(normalizeGamePreferences({ dice: { frequency: "off" } }));
    expect(renderer.root.hidden).toBe(true);
    renderer.applyPreferences(normalizeGamePreferences(undefined));
    expect(renderer.root.hidden).toBe(false);
    renderer.hide();
    renderer.applyPreferences(normalizeGamePreferences({ dice: { frequency: "off" } }));
    renderer.applyPreferences(normalizeGamePreferences(undefined));
    expect(renderer.root.hidden).toBe(true);
    expect(renderer.root.querySelectorAll(".resolved-die")).toHaveLength(0);
    expect(renderer.root.querySelector("p")?.textContent).toBe("");
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
    expect([...renderer.root.querySelectorAll("[data-pixel-number]")].map((number) =>
      number.getAttribute("data-pixel-number"))).toEqual(["4", "6", "8", "10", "12", "20", "100"]);
    expect(renderer.root.dataset.phase).toBe("ready");
    expect(renderer.root.querySelector<HTMLButtonElement>("button")?.disabled).toBe(true);
    expect(renderer.root.classList.contains("high-contrast")).toBe(true);
    renderer.destroy();
    renderer.destroy();
    expect(document.getElementById("dice-presentation")).toBeNull();
    expect(document.getElementById("dice-announcement")).toBeNull();
  });

  it("reveals a new transient result without changing canvas focus or inheriting scroll state", () => {
    const renderer = new DiceRollRenderer(vi.fn());
    const preferences = normalizeGamePreferences(undefined);
    renderer.show(event(), preferences);
    const canvas = document.querySelector<HTMLCanvasElement>("canvas")!;
    canvas.tabIndex = -1;
    canvas.focus();
    renderer.root.querySelector("p")!.scrollTop = 120;
    renderer.show(event(2), preferences);
    expect(renderer.root.querySelector("p")!.scrollTop).toBe(0);
    expect(document.activeElement).toBe(canvas);
    renderer.hide();
    expect(renderer.root.hidden).toBe(true);
    expect(document.activeElement).toBe(canvas);
    renderer.destroy();
  });

  it("throws exact dice over the game in owned multi-axis animations and clears every visual on skip/replacement", async () => {
    const originalAnimate = Object.getOwnPropertyDescriptor(Element.prototype, "animate");
    const calls: {
      target: Element;
      frames: readonly Keyframe[];
      cancel: ReturnType<typeof vi.fn>;
    }[] = [];
    Object.defineProperty(Element.prototype, "animate", {
      configurable: true,
      value: function(this: Element, frames: readonly Keyframe[]) {
        let rejectFinished: (error: DOMException) => void = () => {};
        const finished = new Promise<void>((_resolve, reject) => { rejectFinished = reject; });
        const cancel = vi.fn(() => rejectFinished(new DOMException("Canceled", "AbortError")));
        calls.push({ target: this, frames, cancel });
        return { cancel, finished };
      },
    });
    const renderer = new DiceRollRenderer(vi.fn());
    try {
      renderer.show(event(), normalizeGamePreferences(undefined));
      const stage = document.getElementById("dice-roll-stage")!;
      expect(stage.hidden).toBe(false);
      expect(stage.getAttribute("aria-hidden")).toBe("true");
      expect(renderer.root.style.left).toBe("80px");
      expect(stage.querySelectorAll(".rolling-die")).toHaveLength(2);
      expect(stage.querySelectorAll(".rolling-die-shadow")).toHaveLength(2);
      expect([...stage.querySelectorAll<HTMLElement>(".rolling-die")].map((die) =>
        die.dataset.natural)).toEqual(["20", "1"]);
      expect(calls).toHaveLength(4);
      expect(calls[0]!.frames[0]!.transform).toMatch(/translate3d.*rotateZ.*rotateX.*rotateY/);
      renderer.show(event(2), normalizeGamePreferences(undefined));
      for (const call of calls.slice(0, 4)) expect(call.cancel).toHaveBeenCalledTimes(1);
      expect(stage.querySelectorAll(".rolling-die")).toHaveLength(2);
      renderer.settle();
      renderer.settle();
      for (const call of calls) expect(call.cancel).toHaveBeenCalledTimes(1);
      expect(stage.hidden).toBe(false);
      expect(stage.querySelectorAll(".rolling-die")).toHaveLength(2);
      expect(renderer.root.querySelectorAll(".resolved-die")).toHaveLength(2);
      renderer.hide();
      expect(stage.hidden).toBe(true);
      expect(stage.childElementCount).toBe(0);
      await Promise.resolve();
      renderer.destroy();
      expect(document.getElementById("dice-roll-stage")).toBeNull();
    } finally {
      renderer.destroy();
      if (originalAnimate) Object.defineProperty(Element.prototype, "animate", originalAnimate);
      else Reflect.deleteProperty(Element.prototype, "animate");
    }
  });
});
