import {
  isDicePresentationVisible,
  type DicePresentation,
  type DicePresentationEvent,
  type DicePresentationScope,
} from "../systems/dicePresentation";
import type { GamePreferences } from "../systems/accessibility";
import { getInputPromptSource } from "../systems/input";
import { debugLog } from "../config";
import { createDiceThrowMotion } from "../systems/diceMotion";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const DIE_ART: Readonly<Record<number, { outline: string; facets: string }>> = {
  4: {
    outline: "15,2 17,2 17,6 19,6 19,10 21,10 21,14 23,14 23,18 25,18 25,22 27,22 27,26 29,26 29,29 3,29 3,26 5,26 5,22 7,22 7,18 9,18 9,14 11,14 11,10 13,10 13,6 15,6",
    facets: "M16 6V25H6M16 25H26",
  },
  6: {
    outline: "9,2 29,2 29,22 27,22 27,24 25,24 25,26 23,26 23,28 3,28 3,8 5,8 5,6 7,6 7,4 9,4",
    facets: "M3 8H23V28M23 8H25V6H27V4H29",
  },
  8: {
    outline: "14,2 18,2 18,6 22,6 22,10 26,10 26,14 30,14 30,18 26,18 26,22 22,22 22,26 18,26 18,30 14,30 14,26 10,26 10,22 6,22 6,18 2,18 2,14 6,14 6,10 10,10 10,6 14,6",
    facets: "M16 4V8H14V12H12V16H10V24H22V16H20V12H18V8H16M4 16H28M16 24V28",
  },
  10: {
    outline: "14,2 18,2 18,4 22,4 22,6 26,6 26,8 30,8 30,16 28,16 28,22 26,22 26,28 6,28 6,22 4,22 4,16 2,16 2,8 6,8 6,6 10,6 10,4 14,4",
    facets: "M16 4V8H14V14H12V20H10V26M16 8H18V14H20V20H22V26M4 10H28",
  },
  12: {
    outline: "12,2 20,2 20,4 24,4 24,6 28,6 28,10 30,10 30,22 28,22 28,26 24,26 24,28 20,28 20,30 12,30 12,28 8,28 8,26 4,26 4,22 2,22 2,10 4,10 4,6 8,6 8,4 12,4",
    facets: "M12 8H20V10H24V22H20V26H12V22H8V10H12V8M16 4V8M4 12H8M24 12H28M4 24H8M24 24H28",
  },
  20: {
    outline: "14,2 18,2 18,4 22,4 22,6 26,6 26,8 29,8 29,24 26,24 26,26 22,26 22,28 18,28 18,30 14,30 14,28 10,28 10,26 6,26 6,24 3,24 3,8 6,8 6,6 10,6 10,4 14,4",
    facets: "M4 10H8V8H12V6H20V8H24V10H28M16 6V10H14V14H12V18H10V22H8V24H24V22H22V18H20V14H18V10H16M8 24V26H12V28H20V26H24",
  },
  100: {
    outline: "14,2 18,2 18,4 22,4 22,6 26,6 26,8 30,8 30,16 28,16 28,22 26,22 26,28 6,28 6,22 4,22 4,16 2,16 2,8 6,8 6,6 10,6 10,4 14,4",
    facets: "M16 4V8H14V14H12V20H10V26M16 8H18V14H20V20H22V26M4 10H28",
  },
};

const DIGITS: Readonly<Record<string, readonly string[]>> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
};

function createPixelNumber(natural: number): SVGGElement {
  const face = document.createElementNS(SVG_NAMESPACE, "g");
  face.classList.add("die-number");
  face.setAttribute("data-pixel-number", String(natural));
  const title = document.createElementNS(SVG_NAMESPACE, "title");
  title.textContent = String(natural);
  const digits = [...String(natural)];
  const startX = 16 - (digits.length * 8 - 2) / 2;
  const cells: string[] = [];
  digits.forEach((digit, index) => {
    DIGITS[digit].forEach((row, y) => {
      [...row].forEach((cell, x) => {
        if (cell === "1") cells.push(`M${startX + index * 8 + x * 2} ${12 + y * 2}h2v2h-2z`);
      });
    });
  });
  const shadow = document.createElementNS(SVG_NAMESPACE, "path");
  shadow.setAttribute("d", cells.join(""));
  shadow.setAttribute("class", "die-number-shadow");
  shadow.setAttribute("transform", "translate(1 1)");
  const pixels = document.createElementNS(SVG_NAMESPACE, "path");
  pixels.setAttribute("d", cells.join(""));
  face.append(title, shadow, pixels);
  return face;
}

function createDie(sides: number, natural: number, selected: boolean): HTMLDivElement {
  const die = document.createElement("div");
  die.className = `resolved-die${selected ? " selected" : ""}`;
  die.dataset.natural = String(natural);
  die.dataset.sides = String(sides);
  die.dataset.selected = String(selected);
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", "0 0 32 32");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("shape-rendering", "crispEdges");
  const outline = document.createElementNS(SVG_NAMESPACE, "polygon");
  const art = DIE_ART[sides] ?? DIE_ART[20];
  outline.setAttribute("points", art.outline);
  outline.setAttribute("class", "die-outline");
  outline.setAttribute("stroke-width", selected ? "2" : "1");
  const facets = document.createElementNS(SVG_NAMESPACE, "path");
  facets.setAttribute("d", art.facets);
  facets.setAttribute("fill", "none");
  facets.setAttribute("class", "die-facets");
  facets.setAttribute("stroke-width", "1");
  const face = createPixelNumber(natural);
  const caption = document.createElement("span");
  caption.textContent = `d${sides}${selected ? " selected" : ""}`;
  svg.append(outline, facets, face);
  die.append(svg, caption);
  return die;
}

export class DiceRollRenderer {
  readonly root: HTMLElement;
  private readonly glyphs: HTMLDivElement;
  private readonly result: HTMLParagraphElement | null;
  private readonly announcement: HTMLDivElement;
  private readonly fastForwardButton: HTMLButtonElement;
  private readonly animations = new Set<Animation>();
  private readonly stage: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly resizeObserver: ResizeObserver;
  private currentEvent: DicePresentationEvent | null = null;

  constructor(onFastForward: () => void, scope: DicePresentationScope = "transient") {
    const host = document.getElementById("game-inner");
    const canvasHost = document.getElementById("game-container");
    if (!host || !canvasHost) {
      throw new Error("[dice] Game container is unavailable.");
    }
    const canvas = canvasHost.querySelector("canvas");
    if (!canvas) throw new Error("[dice] Game canvas is unavailable.");
    this.canvas = canvas;
    this.stage = document.createElement("div");
    this.stage.id = "dice-roll-stage";
    this.stage.className = "dice-roll-stage resolved-dice";
    this.stage.hidden = true;
    this.stage.setAttribute("aria-hidden", "true");
    this.resizeObserver = new ResizeObserver(() => this.fitToCanvas());
    this.resizeObserver.observe(canvas);
    this.root = document.createElement("section");
    this.root.id = "dice-presentation";
    this.root.className = "dice-presentation";
    this.root.hidden = true;
    this.root.dataset.phase = "ready";
    this.root.dataset.scope = scope;
    this.root.setAttribute("aria-label", "Resolved dice");
    this.glyphs = this.stage;
    this.result = scope === "transient" ? document.createElement("p") : null;
    if (this.result) this.result.id = "dice-result";
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
    this.root.append(this.stage);
    if (this.result) this.root.append(this.result);
    this.root.append(this.fastForwardButton);
    const stopGameKeys = (event: KeyboardEvent): void => {
      if (event.code === "Escape") {
        this.restoreCanvasFocus();
      }
      if (event.code !== "KeyZ") event.stopPropagation();
    };
    this.root.addEventListener("keydown", stopGameKeys);
    this.root.addEventListener("keyup", stopGameKeys);
    host.append(this.root);
    host.append(this.announcement);
  }

  show(
    event: DicePresentationEvent,
    preferences: Readonly<GamePreferences>,
    announce = true,
  ): void {
    this.hide();
    this.currentEvent = event;
    this.root.dataset.phase = event.duration > 0 ? "animating" : "ready";
    this.root.dataset.sequence = String(event.sequence);
    this.root.dataset.category = event.presentation.category;
    this.root.dataset.skipped = "false";
    if (this.result) this.result.textContent = event.text;
    this.applyPreferences(preferences);
    const visible = isDicePresentationVisible(event.presentation, preferences.dice);
    if (announce && visible) this.announcement.textContent = event.text;
    if (visible) this.placeDice(event.duration, preferences);
    this.fastForwardButton.disabled = !visible || event.duration === 0;
    this.fastForwardButton.hidden = this.fastForwardButton.disabled;
    this.updatePrompt();
    if (this.result) this.result.scrollTop = 0;
  }

  applyPreferences(preferences: Readonly<GamePreferences>): void {
    if (this.root.dataset.phase === "fading") this.hide();
    this.root.style.setProperty(
      "--dice-text-scale", String(preferences.accessibility.textScale),
    );
    this.root.classList.toggle("high-contrast", preferences.accessibility.highContrast);
    this.stage.classList.toggle("high-contrast", preferences.accessibility.highContrast);
    this.stage.style.setProperty("--dice-text-scale", String(preferences.accessibility.textScale));
    this.root.dataset.frequency = preferences.dice.frequency;
    this.root.dataset.speed = preferences.dice.speed;
    const event = this.currentEvent;
    if (!event) return;
    const visible = isDicePresentationVisible(event.presentation, preferences.dice);
    this.root.hidden = !visible;
    this.cancelAnimations();
    this.glyphs.replaceChildren();
    this.stage.hidden = true;
    if (visible) {
      this.appendResultDice(event.presentation);
      this.placeDice(0, preferences);
    } else this.announcement.textContent = "";
    if (this.root.hidden && this.root.contains(document.activeElement)) {
      this.restoreCanvasFocus();
    }
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

  private placeDice(duration: number, preferences: Readonly<GamePreferences>): void {
    for (const shadow of this.stage.querySelectorAll(".rolling-die-shadow")) shadow.remove();
    const bounds = this.canvas.getBoundingClientRect();
    const height = bounds.height * 0.52;
    const dice = [...this.glyphs.querySelectorAll<HTMLElement>(".resolved-die")];
    const motion = createDiceThrowMotion(dice.length, bounds.width, height, preferences.accessibility.textScale);
    this.stage.style.width = `${bounds.width}px`;
    this.stage.style.height = `${height}px`;
    this.stage.dataset.sequence = this.root.dataset.sequence;
    this.stage.hidden = dice.length === 0;
    this.fitToCanvas();
    for (const [index, die] of dice.entries()) {
      const path = motion[index]!;
      die.classList.add("rolling-die");
      die.style.left = `${path.x}px`;
      die.style.top = `${path.y}px`;
      die.style.width = `${path.size}px`;
      die.style.setProperty("--rolling-die-size", `${path.size}px`);
      const caption = die.querySelector("span");
      if (caption) caption.textContent = `d${die.dataset.sides}${die.dataset.selected === "true" ? "*" : ""}`;
      const shadow = document.createElement("div");
      shadow.className = "rolling-die-shadow";
      shadow.style.left = `${path.x}px`;
      shadow.style.top = `${path.y + path.size * 0.9}px`;
      shadow.style.width = `${path.size}px`;
      shadow.style.height = `${path.size * 0.15}px`;
      this.stage.append(shadow);
      if (duration === 0 || typeof die.animate !== "function") continue;
      this.ownAnimation(die.animate(path.frames.map((frame) => ({
        offset: frame.offset,
        transform: `translate3d(${frame.x}px,${frame.y}px,0) rotateZ(${frame.rotation}deg)`
          + ` rotateX(${frame.tilt}deg) rotateY(${frame.yaw}deg) scale(${frame.scaleX},${frame.scaleY})`,
      })), { duration, easing: "linear", fill: "forwards" }));
      this.ownAnimation(shadow.animate(path.frames.map((frame) => ({
        offset: frame.offset,
        transform: `translateX(${frame.x}px) scale(${frame.shadowScale},${frame.shadowScale})`,
        opacity: frame.shadowOpacity,
      })), { duration, easing: "linear", fill: "forwards" }));
    }
  }

  private fitToCanvas(): void {
    if (this.root.hidden) return;
    const bounds = this.canvas.getBoundingClientRect();
    this.root.style.left = `${bounds.left}px`;
    this.root.style.top = `${bounds.top + bounds.height * 0.05}px`;
    this.root.style.width = `${bounds.width}px`;
    this.root.style.height = `${bounds.height * 0.72}px`;
    this.stage.style.transformOrigin = "0 0";
    const originalWidth = Number.parseFloat(this.stage.style.width);
    const originalHeight = Number.parseFloat(this.stage.style.height);
    if (originalWidth > 0 && originalHeight > 0) {
      this.stage.style.transform = `scale(${bounds.width / originalWidth},${bounds.height * 0.52 / originalHeight})`;
    }
  }

  private ownAnimation(animation: Animation): void {
    this.animations.add(animation);
    void animation.finished.catch((error: unknown) => {
      this.animations.delete(animation);
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        debugLog("[dice] Visual animation failed", error);
      }
    });
  }

  updatePrompt(): void {
    const source = getInputPromptSource();
    const shortcut = source === "gamepad" ? "L3" : source === "keyboard" ? "Z" : "tap";
    this.fastForwardButton.textContent = `Skip (${shortcut})`;
    this.fastForwardButton.setAttribute("aria-label", `Fast-forward dice animation, ${shortcut}`);
  }

  settle(): void {
    this.cancelAnimations();
    this.root.dataset.phase = "ready";
    if (document.activeElement === this.fastForwardButton) this.restoreCanvasFocus();
    this.fastForwardButton.disabled = true;
    this.fastForwardButton.hidden = true;
  }

  private cancelAnimations(): void {
    for (const animation of this.animations) animation.cancel();
    this.animations.clear();
  }

  private restoreCanvasFocus(): void {
    this.canvas.tabIndex = -1;
    this.canvas.focus({ preventScroll: true });
  }

  dismiss(duration: number): void {
    this.settle();
    const event = this.currentEvent;
    if (this.root.hidden || duration === 0 || typeof this.root.animate !== "function") {
      this.hide();
      return;
    }
    this.root.dataset.phase = "fading";
    const fade = this.root.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration, easing: "ease-out", fill: "forwards",
    });
    this.ownAnimation(fade);
    void fade.finished.then(() => {
      if (this.currentEvent === event) this.hide();
    }, (error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")
        && this.currentEvent === event) this.hide();
    });
  }

  hide(): void {
    this.settle();
    this.currentEvent = null;
    this.root.hidden = true;
    this.stage.hidden = true;
    this.stage.replaceChildren();
    if (this.result) this.result.textContent = "";
    this.announcement.textContent = "";
  }

  destroy(): void {
    if (this.root.contains(document.activeElement)) {
      this.restoreCanvasFocus();
    }
    this.hide();
    this.root.remove();
    this.announcement.remove();
    this.stage.remove();
    this.resizeObserver.disconnect();
  }
}
