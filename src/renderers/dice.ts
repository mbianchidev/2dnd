import { isDicePresentationVisible, type DicePresentation, type DicePresentationEvent } from "../systems/dicePresentation";
import type { GamePreferences } from "../systems/accessibility";
import { getInputPromptSource } from "../systems/input";
import { debugLog } from "../config";
import { createDiceThrowMotion } from "../systems/diceMotion";

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
  private readonly animations = new Set<Animation>();
  private readonly stage: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly resizeObserver: ResizeObserver;
  private currentEvent: DicePresentationEvent | null = null;

  constructor(onFastForward: () => void) {
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
    this.root.setAttribute("aria-label", "Resolved dice");
    this.glyphs = this.stage;
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
    this.root.append(this.stage, this.result, this.fastForwardButton);
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
    this.result.textContent = event.text;
    this.applyPreferences(preferences);
    const visible = isDicePresentationVisible(event.presentation, preferences.dice);
    if (announce && visible) this.announcement.textContent = event.text;
    if (visible) this.placeDice(event.duration, preferences);
    this.fastForwardButton.disabled = !visible || event.duration === 0;
    this.fastForwardButton.hidden = this.fastForwardButton.disabled;
    this.updatePrompt();
    this.result.scrollTop = 0;
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
    this.result.textContent = "";
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
