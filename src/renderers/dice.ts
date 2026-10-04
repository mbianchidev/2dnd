import type { DicePresentationEvent } from "../systems/dicePresentation";
import type { GamePreferences } from "../systems/accessibility";
import { getInputPromptSource } from "../systems/input";
import { debugLog } from "../config";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function createDie(sides: number, natural: number, selected: boolean): HTMLDivElement {
  const die = document.createElement("div");
  die.className = `resolved-die${selected ? " selected" : ""}`;
  die.dataset.natural = String(natural);
  die.dataset.selected = String(selected);
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("aria-hidden", "true");
  const outline = document.createElementNS(SVG_NAMESPACE, "polygon");
  outline.setAttribute("points", "32,3 59,18 59,46 32,61 5,46 5,18");
  outline.setAttribute("fill", "#182842");
  outline.setAttribute("stroke", "#f4f1e8");
  outline.setAttribute("stroke-width", selected ? "4" : "2");
  const facets = document.createElementNS(SVG_NAMESPACE, "path");
  facets.setAttribute("d", "M5 18L32 9L59 18M5 46L32 55L59 46M32 9L9 46M32 9L55 46M9 46H55");
  facets.setAttribute("fill", "none");
  facets.setAttribute("stroke", "#a9bedb");
  facets.setAttribute("stroke-width", "1");
  const face = document.createElementNS(SVG_NAMESPACE, "text");
  face.setAttribute("x", "32");
  face.setAttribute("y", "39");
  face.setAttribute("text-anchor", "middle");
  face.setAttribute("fill", "#ffffff");
  face.setAttribute("font-family", "monospace");
  face.setAttribute("font-size", "23");
  face.setAttribute("font-weight", "bold");
  face.setAttribute("stroke", "#182842");
  face.setAttribute("stroke-width", "1");
  face.setAttribute("paint-order", "stroke");
  face.textContent = String(natural);
  const caption = document.createElement("span");
  caption.textContent = `d${sides}${selected ? " selected" : ""}`;
  svg.append(outline, facets, face);
  die.append(svg, caption);
  return die;
}

export class DiceRollRenderer {
  readonly root: HTMLElement;
  private readonly glyphs: HTMLDivElement;
  private readonly result: HTMLParagraphElement;
  private readonly announcement: HTMLDivElement;
  private readonly fastForwardButton: HTMLButtonElement;
  private readonly history: HTMLOListElement;
  private readonly summary: HTMLElement;
  private readonly animations = new Set<Animation>();

  constructor(onFastForward: () => void) {
    const host = document.getElementById("game-inner");
    const canvasHost = document.getElementById("game-container");
    if (!host || !canvasHost) {
      throw new Error("[dice] Game container is unavailable.");
    }
    this.root = document.createElement("section");
    this.root.id = "dice-presentation";
    this.root.className = "dice-presentation";
    this.root.hidden = true;
    this.root.setAttribute("aria-label", "Resolved dice");
    const row = document.createElement("div");
    row.className = "dice-result-row";
    this.glyphs = document.createElement("div");
    this.glyphs.className = "resolved-dice";
    this.glyphs.setAttribute("aria-hidden", "true");
    this.result = document.createElement("p");
    this.result.id = "dice-result";
    this.announcement = document.createElement("div");
    this.announcement.id = "dice-announcement";
    this.announcement.className = "dice-announcement";
    this.announcement.setAttribute("role", "status");
    this.announcement.setAttribute("aria-live", "polite");
    this.announcement.setAttribute("aria-atomic", "true");
    this.fastForwardButton = document.createElement("button");
    this.fastForwardButton.type = "button";
    this.fastForwardButton.id = "dice-fast-forward";
    this.fastForwardButton.dataset.action = "fastForwardDice";
    this.fastForwardButton.addEventListener("click", onFastForward);
    const details = document.createElement("details");
    details.id = "dice-history";
    this.summary = document.createElement("summary");
    this.summary.textContent = "Roll log";
    this.history = document.createElement("ol");
    this.history.id = "dice-log";
    this.history.setAttribute("aria-label", "Resolved roll log");
    this.history.setAttribute("aria-live", "off");
    details.append(this.summary, this.history);
    row.append(this.glyphs, this.result, this.fastForwardButton);
    this.root.append(row, details);
    const stopGameKeys = (event: KeyboardEvent): void => {
      if (event.code === "Escape") {
        details.open = false;
        const canvas = canvasHost.querySelector("canvas");
        if (canvas) {
          canvas.tabIndex = -1;
          canvas.focus({ preventScroll: true });
        }
      }
      if (event.code !== "KeyZ") event.stopPropagation();
    };
    this.root.addEventListener("keydown", stopGameKeys);
    this.root.addEventListener("keyup", stopGameKeys);
    host.insertBefore(this.root, canvasHost);
    host.append(this.announcement);
  }

  record(event: DicePresentationEvent): void {
    const item = document.createElement("li");
    item.textContent = event.text;
    item.dataset.category = event.presentation.category;
    item.dataset.sequence = String(event.sequence);
    this.history.append(item);
    if (this.history.children.length > 40) this.history.firstElementChild?.remove();
    this.summary.textContent = `Roll log (${this.history.children.length})`;
  }

  show(
    event: DicePresentationEvent,
    preferences: Readonly<GamePreferences>,
    announce = true,
  ): void {
    this.settle();
    this.applyPreferences(preferences);
    this.root.hidden = false;
    this.root.dataset.phase = event.duration > 0 ? "animating" : "ready";
    this.root.dataset.sequence = String(event.sequence);
    this.root.dataset.category = event.presentation.category;
    this.root.dataset.skipped = "false";
    this.result.textContent = event.text;
    if (announce) this.announcement.textContent = event.text;
    this.glyphs.replaceChildren();
    if (preferences.dice.frequency !== "off") {
      const roll = event.presentation.roll;
      if (roll) {
        roll.naturalRolls.forEach((natural, index) => {
          this.glyphs.append(createDie(20, natural, index === roll.selectedIndex));
        });
      } else if (event.presentation.components) {
        const components = event.presentation.components;
        components.naturalRolls.forEach((natural) => {
          this.glyphs.append(createDie(components.sides, natural, false));
        });
      }
    }
    if (event.duration > 0) {
      for (const svg of this.glyphs.querySelectorAll("svg")) {
        if (typeof svg.animate !== "function") continue;
        const animation = svg.animate([
          { transform: "rotate(-12deg) scale(0.9)" },
          { transform: "rotate(7deg) scale(1.04)", offset: 0.6 },
          { transform: "rotate(0deg) scale(1)" },
        ], { duration: event.duration, easing: "ease-out" });
        this.animations.add(animation);
        void animation.finished.then(() => {
          this.animations.delete(animation);
        }, (error: unknown) => {
          this.animations.delete(animation);
          if (!(error instanceof DOMException && error.name === "AbortError")) {
            debugLog("[dice] Visual animation failed", error);
          }
        });
      }
    }
    this.fastForwardButton.disabled = event.duration === 0;
    this.updatePrompt();
  }

  applyPreferences(preferences: Readonly<GamePreferences>): void {
    this.root.style.setProperty(
      "--dice-text-scale", String(preferences.accessibility.textScale),
    );
    this.root.classList.toggle("high-contrast", preferences.accessibility.highContrast);
    this.root.dataset.frequency = preferences.dice.frequency;
    this.root.dataset.speed = preferences.dice.speed;
    if (preferences.dice.frequency === "off") this.glyphs.replaceChildren();
  }

  updatePrompt(): void {
    const source = getInputPromptSource();
    const shortcut = source === "gamepad" ? "L3" : source === "keyboard" ? "Z" : "tap";
    this.fastForwardButton.textContent = `Skip animation (${shortcut})`;
    this.fastForwardButton.setAttribute("aria-label", `Fast-forward dice animation, ${shortcut}`);
  }

  settle(): void {
    for (const animation of this.animations) animation.cancel();
    this.animations.clear();
    this.root.dataset.phase = "ready";
    if (document.activeElement === this.fastForwardButton) {
      this.summary.focus({ preventScroll: true });
    }
    this.fastForwardButton.disabled = true;
  }

  destroy(): void {
    this.settle();
    if (this.root.contains(document.activeElement)) {
      const canvas = document.querySelector<HTMLCanvasElement>("#game-container canvas");
      if (canvas) {
        canvas.tabIndex = -1;
        canvas.focus({ preventScroll: true });
      }
    }
    this.root.remove();
    this.announcement.remove();
  }
}
