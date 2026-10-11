import type { DicePresentation, DicePresentationEvent } from "../systems/dicePresentation";
import type { GamePreferences } from "../systems/accessibility";
import { getInputPromptSource } from "../systems/input";
import { debugLog } from "../config";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const DIE_ART: Readonly<Record<number, { outline: string; facets: string }>> = {
  4: { outline: "32,3 61,57 3,57", facets: "M32 3L32 40M3 57L32 40L61 57" },
  6: { outline: "17,5 58,5 58,46 46,59 5,59 5,18", facets: "M5 18H46V59M46 18L58 5" },
  8: { outline: "32,3 61,32 32,61 3,32", facets: "M32 3L13 45H51L32 3M3 32H61M13 45L32 61L51 45" },
  10: { outline: "32,3 60,23 50,57 14,57 4,23", facets: "M32 3V16L14 57M32 16L50 57M4 23L32 16L60 23" },
  12: { outline: "32,3 59,18 59,46 32,61 5,46 5,18", facets: "M32 12L51 26L44 48H20L13 26ZM32 3V12M59 18L51 26M59 46L44 48M5 46L20 48M5 18L13 26" },
  20: { outline: "32,3 59,18 59,46 32,61 5,46 5,18", facets: "M5 18L32 9L59 18M5 46L32 55L59 46M32 9L9 46M32 9L55 46M9 46H55" },
  100: { outline: "32,3 60,23 50,57 14,57 4,23", facets: "M32 3L32 16L14 57M32 16L50 57M4 23L32 16L60 23" },
};

function createDie(sides: number, natural: number, selected: boolean): HTMLDivElement {
  const die = document.createElement("div");
  die.className = `resolved-die${selected ? " selected" : ""}`;
  die.dataset.natural = String(natural);
  die.dataset.sides = String(sides);
  die.dataset.selected = String(selected);
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("aria-hidden", "true");
  const outline = document.createElementNS(SVG_NAMESPACE, "polygon");
  const art = DIE_ART[sides] ?? DIE_ART[20];
  outline.setAttribute("points", art.outline);
  outline.setAttribute("fill", "#182842");
  outline.setAttribute("stroke", "#f4f1e8");
  outline.setAttribute("stroke-width", selected ? "4" : "2");
  const facets = document.createElementNS(SVG_NAMESPACE, "path");
  facets.setAttribute("d", art.facets);
  facets.setAttribute("fill", "none");
  facets.setAttribute("stroke", "#a9bedb");
  facets.setAttribute("stroke-width", "1");
  const face = document.createElementNS(SVG_NAMESPACE, "text");
  face.setAttribute("x", "32");
  face.setAttribute("y", "39");
  face.setAttribute("text-anchor", "middle");
  face.setAttribute("fill", "#ffffff");
  face.setAttribute("font-family", "monospace");
  face.setAttribute("font-size", natural >= 100 ? "17" : "23");
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
      this.appendResultDice(event.presentation);
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

  private appendResultDice(view: DicePresentation, sharedGroups = new Set<string>()): void {
    const actionKey = `${view.actorId ?? ""}:${view.actionId ?? ""}`;
    const attackKey = `${actionKey}:attack`;
    if (view.roll && (!view.sharedRoll || !sharedGroups.has(attackKey))) {
      this.appendDiceGroup(view.category, 20, view.roll.naturalRolls, view.roll.selectedIndex);
      if (view.sharedRoll) sharedGroups.add(attackKey);
    } else if (view.components) {
      this.appendDiceGroup(view.category, view.components.sides, view.components.naturalRolls);
    }
    const effectKey = `${actionKey}:${view.effect?.kind}`;
    if (view.effect?.roll && (!view.effect.shared || !sharedGroups.has(effectKey))) {
      this.appendDiceGroup(view.effect.kind, view.effect.roll.sides, view.effect.roll.naturalRolls);
      if (view.effect.shared) sharedGroups.add(effectKey);
    }
    for (const result of view.additionalResults ?? []) this.appendResultDice(result, sharedGroups);
  }

  private appendDiceGroup(
    kind: string,
    sides: number,
    naturals: readonly number[],
    selectedIndex?: number,
  ): void {
    const group = document.createElement("div");
    group.className = "dice-group";
    group.dataset.rollKind = kind;
    const label = document.createElement("span");
    label.className = "dice-group-label";
    label.textContent = kind.charAt(0).toUpperCase() + kind.slice(1);
    const faces = document.createElement("div");
    faces.className = "dice-faces";
    naturals.forEach((natural, index) => faces.append(createDie(sides, natural, index === selectedIndex)));
    group.append(label, faces);
    this.glyphs.append(group);
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
