import type * as Phaser from "phaser";
import {
  STANDARD_GAMEPAD_BINDINGS,
  InputKeyOwnership,
  SemanticInputState,
  inputPromptSource,
  inputSource,
  normalizeAnalogAxis,
  resolveGamepadAction,
  type InputAction,
  type InputContext,
  type InputSource,
  type SemanticInputEvent,
  type StandardGamepadBinding,
} from "../systems/input";
import {
  featureAvailability,
  getInputActionFeature,
} from "../systems/featureDiscovery";
import {
  gamePreferences,
  type TouchControlVisibility,
} from "../systems/accessibility";

interface GamepadSnapshot {
  buttons: boolean[];
  axes: number[];
}

interface KeyDescriptor {
  code: string;
  key: string;
  keyCode?: number;
}

const ACTION_KEYS: Partial<Record<InputAction, KeyDescriptor>> = {
  moveUp: { code: "KeyW", key: "w" },
  moveDown: { code: "KeyS", key: "s" },
  moveLeft: { code: "KeyA", key: "a" },
  moveRight: { code: "KeyD", key: "d" },
  navigateUp: { code: "KeyW", key: "w" },
  navigateDown: { code: "KeyS", key: "s" },
  navigateLeft: { code: "KeyA", key: "a" },
  navigateRight: { code: "KeyD", key: "d" },
  confirm: { code: "Space", key: " " },
  interact: { code: "Space", key: " " },
  cancel: { code: "Escape", key: "Escape" },
  openMenu: { code: "Escape", key: "Escape" },
  openJournal: { code: "KeyQ", key: "q" },
  openParty: { code: "KeyP", key: "p" },
  openCodex: { code: "KeyC", key: "c" },
  openAchievements: { code: "KeyY", key: "y" },
  openGathering: { code: "KeyK", key: "k" },
  openCrafting: { code: "KeyV", key: "v" },
  openTips: { code: "F1", key: "F1" },
  openSettings: { code: "Escape", key: "Escape" },
  openMap: { code: "KeyM", key: "m" },
  openEquipment: { code: "KeyE", key: "e" },
  toggleMount: { code: "KeyT", key: "t" },
  battleTargetPrevious: { code: "KeyA", key: "a" },
  battleTargetNext: { code: "KeyD", key: "d" },
  battleLogUp: { code: "PageUp", key: "PageUp" },
  battleLogDown: { code: "PageDown", key: "PageDown" },
  cutsceneAdvance: { code: "Space", key: " " },
  cutsceneSkip: { code: "Escape", key: "Escape" },
  inventoryPrevious: { code: "ArrowUp", key: "ArrowUp" },
  inventoryNext: { code: "ArrowDown", key: "ArrowDown" },
  inventoryPagePrevious: { code: "PageUp", key: "PageUp" },
  inventoryPageNext: { code: "PageDown", key: "PageDown" },
  inventoryFirst: { code: "Home", key: "Home" },
  inventoryLast: { code: "End", key: "End" },
  inventoryPrimary: { code: "Enter", key: "Enter" },
  inventoryTransfer: { code: "KeyX", key: "x" },
  inventoryCycleSort: { code: "KeyR", key: "r" },
  inventoryCycleFilter: { code: "KeyF", key: "f" },
  inventorySearch: { code: "Slash", key: "/" },
  inventoryClearSearch: { code: "Backspace", key: "Backspace" },
  inventoryNextTarget: { code: "Tab", key: "Tab" },
  codexSearch: { code: "Slash", key: "/" },
  codexCategoryPrevious: { code: "KeyQ", key: "q" },
  codexCategoryNext: { code: "KeyE", key: "e" },
};

const TOUCH_BUTTONS: ReadonlyArray<{
  action: InputAction;
  label: string;
  className: string;
}> = [
  { action: "navigateUp", label: "▲", className: "touch-up" },
  { action: "navigateLeft", label: "◀", className: "touch-left" },
  { action: "navigateRight", label: "▶", className: "touch-right" },
  { action: "navigateDown", label: "▼", className: "touch-down" },
  { action: "confirm", label: "A", className: "touch-confirm" },
  { action: "cancel", label: "B", className: "touch-cancel" },
  { action: "openMenu", label: "MENU", className: "touch-menu" },
  { action: "openParty", label: "PARTY", className: "touch-party" },
  { action: "openTips", label: "TIPS", className: "touch-tips" },
];

const HELD_TOUCH_ACTIONS = new Set<InputAction>([
  "navigateUp",
  "navigateDown",
  "navigateLeft",
  "navigateRight",
]);
const TOUCH_CLICK_SUPPRESSION_MS = 500;

function isTouchDevice(): boolean {
  return navigator.maxTouchPoints > 0
    || window.matchMedia?.("(pointer: coarse)").matches === true;
}

function now(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

export class SemanticInputRuntime {
  private readonly state = new SemanticInputState();
  private readonly gamepadSnapshots = new Map<number, GamepadSnapshot>();
  private readonly syntheticEvents = new WeakSet<Event>();
  private readonly heldSyntheticKeys = new Map<string, KeyDescriptor>();
  private readonly syntheticKeyOwnership = new InputKeyOwnership();
  private animationFrame = 0;
  private activeSceneKey = "";
  private activeContext: InputContext = "overlay";
  private touchRoot: HTMLDivElement | null = null;
  private cursor: HTMLDivElement | null = null;
  private cursorX = 0;
  private cursorY = 0;
  private cursorActive = false;
  private gamepadConnected = false;
  private unsubscribePreferences: (() => void) | null = null;
  private unsubscribeFeatures: (() => void) | null = null;

  constructor(private readonly game: Phaser.Game) {}

  start(): void {
    window.addEventListener("keydown", this.handleKeyDown, true);
    window.addEventListener("keyup", this.handleKeyUp, true);
    window.addEventListener("gamepadconnected", this.handleGamepadConnection);
    window.addEventListener("gamepaddisconnected", this.handleGamepadConnection);
    window.addEventListener("blur", this.handleBlur);
    document.addEventListener("visibilitychange", this.handleVisibility);
    this.game.canvas.addEventListener("pointerdown", this.handlePointerSource, true);
    this.game.canvas.addEventListener("pointermove", this.handlePointerSource, true);
    this.createTouchControls();
    this.createCursor();
    this.unsubscribePreferences = gamePreferences.subscribe(() => {
      this.applyControlPreferences();
    });
    this.unsubscribeFeatures = featureAvailability.subscribe(() => {
      this.applyFeatureAvailability();
    });
    this.applyControlPreferences();
    this.animationFrame = window.requestAnimationFrame(this.poll);
  }

  destroy(): void {
    window.cancelAnimationFrame(this.animationFrame);
    window.removeEventListener("keydown", this.handleKeyDown, true);
    window.removeEventListener("keyup", this.handleKeyUp, true);
    window.removeEventListener("gamepadconnected", this.handleGamepadConnection);
    window.removeEventListener("gamepaddisconnected", this.handleGamepadConnection);
    window.removeEventListener("blur", this.handleBlur);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    this.game.canvas.removeEventListener("pointerdown", this.handlePointerSource, true);
    this.game.canvas.removeEventListener("pointermove", this.handlePointerSource, true);
    this.unsubscribePreferences?.();
    this.unsubscribePreferences = null;
    this.unsubscribeFeatures?.();
    this.unsubscribeFeatures = null;
    this.touchRoot?.remove();
    this.cursor?.remove();
    this.touchRoot = null;
    this.cursor = null;
    this.clearAll();
  }

  private readonly poll = (timestamp: number): void => {
    const sceneKey = this.getActiveSceneKey();
    const context = this.getContext();
    if (sceneKey !== this.activeSceneKey || context !== this.activeContext) {
      this.closeMobileTextInput();
      this.releaseAllSyntheticKeys();
      this.state.clear();
      this.activeSceneKey = sceneKey;
      this.activeContext = context;
      this.cursorActive = false;
      this.updateCursor();
    }
    this.pollGamepads(timestamp);
    for (const event of this.state.update(timestamp)) this.dispatch(event);
    this.animationFrame = window.requestAnimationFrame(this.poll);
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.syntheticEvents.has(event) || event.repeat) return;
    inputSource.set("keyboard");
    this.updatePresentation("keyboard");
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (this.syntheticEvents.has(event)) return;
  };

  private readonly handlePointerSource = (event: PointerEvent): void => {
    if (this.syntheticEvents.has(event)) return;
    const source: InputSource = event.pointerType === "touch"
      ? "touch"
      : "pointer";
    inputSource.set(source);
    this.updatePresentation(source);
  };

  private readonly handleGamepadConnection = (): void => {
    this.gamepadConnected = navigator.getGamepads().some(Boolean);
    if (!this.gamepadConnected) {
      const released = this.state.releaseMatching("gamepad:");
      for (const entry of released) this.releaseSyntheticToken(entry.token);
      this.gamepadSnapshots.clear();
    }
    this.applyControlPreferences();
  };

  private readonly handleBlur = (): void => {
    this.clearAll();
  };

  private readonly handleVisibility = (): void => {
    if (document.visibilityState !== "visible") this.clearAll();
  };

  private clearAll(): void {
    this.state.clear();
    this.gamepadSnapshots.clear();
    this.releaseAllSyntheticKeys();
    this.closeMobileTextInput();
    this.cursorActive = false;
    this.updateCursor();
  }

  private pollGamepads(timestamp: number): void {
    const pads = navigator.getGamepads();
    this.gamepadConnected = pads.some(Boolean);
    const connectedIndices = new Set<number>();
    for (const pad of pads) {
      if (!pad || pad.mapping !== "standard") continue;
      connectedIndices.add(pad.index);
      const previous = this.gamepadSnapshots.get(pad.index) ?? {
        buttons: [],
        axes: [],
      };
      const next: GamepadSnapshot = {
        buttons: pad.buttons.map((button) => button.pressed),
        axes: pad.axes.map((axis) => normalizeAnalogAxis(axis)),
      };
      for (const binding of STANDARD_GAMEPAD_BINDINGS) {
        this.updateGamepadBinding(pad.index, binding, previous, next, timestamp);
      }
      this.updateGamepadCursor(pad);
      if (
        this.cursorActive
        && next.buttons[11] === true
        && previous.buttons[11] !== true
      ) {
        this.clickCursor();
        inputSource.set("gamepad");
        this.updatePresentation("gamepad");
      }
      this.gamepadSnapshots.set(pad.index, next);
    }
    for (const index of this.gamepadSnapshots.keys()) {
      if (connectedIndices.has(index)) continue;
      this.gamepadSnapshots.delete(index);
      const released = this.state.releaseMatching(`gamepad:${index}:`);
      for (const entry of released) this.releaseSyntheticToken(entry.token);
    }
  }

  private updateGamepadBinding(
    index: number,
    binding: StandardGamepadBinding,
    previous: GamepadSnapshot,
    next: GamepadSnapshot,
    timestamp: number,
  ): void {
    const token = binding.button !== undefined
      ? `gamepad:${index}:button:${binding.button}`
      : `gamepad:${index}:axis:${binding.axis}:${binding.direction}`;
    const wasPressed = binding.button !== undefined
      ? previous.buttons[binding.button] === true
      : this.axisPressed(
        previous.axes[binding.axis ?? 0] ?? 0,
        binding.direction ?? 1,
      );
    const pressed = binding.button !== undefined
      ? next.buttons[binding.button] === true
      : this.axisPressed(
        next.axes[binding.axis ?? 0] ?? 0,
        binding.direction ?? 1,
      );
    if (pressed && !wasPressed) {
      const action = resolveGamepadAction(binding, this.getContext());
      if (
        this.cursorActive
        && (
          action.startsWith("navigate")
          || action.startsWith("move")
        )
      ) {
        this.cursorActive = false;
        this.updateCursor();
      }
      const event = this.state.press(token, action, "gamepad", timestamp);
      if (event) {
        this.dispatch(event);
      } else {
        const descriptor = this.keyForAction(this.contextualizeAction(action));
        if (descriptor) {
          this.pressSyntheticToken(token, descriptor, false, false);
        }
      }
    } else if (!pressed && wasPressed) {
      this.state.release(token);
      this.releaseSyntheticToken(token);
    }
  }

  private axisPressed(value: number, direction: -1 | 1): boolean {
    return direction < 0 ? value <= -0.55 : value >= 0.55;
  }

  private updateGamepadCursor(gamepad: Gamepad): void {
    const x = normalizeAnalogAxis(gamepad.axes[2] ?? 0);
    const y = normalizeAnalogAxis(gamepad.axes[3] ?? 0);
    if (x === 0 && y === 0) return;
    const bounds = this.game.canvas.getBoundingClientRect();
    if (!this.cursorActive) {
      this.cursorX = bounds.left + bounds.width / 2;
      this.cursorY = bounds.top + bounds.height / 2;
    }
    const speed = 12;
    this.cursorX = Math.max(
      bounds.left,
      Math.min(bounds.right, this.cursorX + x * speed),
    );
    this.cursorY = Math.max(
      bounds.top,
      Math.min(bounds.bottom, this.cursorY + y * speed),
    );
    this.cursorActive = true;
    inputSource.set("gamepad");
    this.updatePresentation("gamepad");
    this.updateCursor();
    const mouseMove = new MouseEvent("mousemove", {
      bubbles: true,
      clientX: this.cursorX,
      clientY: this.cursorY,
    });
    this.syntheticEvents.add(mouseMove);
    this.game.canvas.dispatchEvent(mouseMove);
  }

  private dispatch(event: SemanticInputEvent): void {
    inputSource.set(event.source);
    this.updatePresentation(event.source);
    const action = this.contextualizeAction(event.action);
    if (this.handleMobileTextInput(action)) return;
    if (action === "battleLogUp" || action === "battleLogDown") {
      this.dispatchWheel(action === "battleLogUp" ? -120 : 120);
      return;
    }
    const descriptor = event.token && event.repeated
      ? this.heldSyntheticKeys.get(event.token)
      : this.keyForAction(action);
    if (!descriptor) return;
    if (event.token) {
      this.pressSyntheticToken(event.token, descriptor, event.repeated);
    } else {
      this.dispatchKey("keydown", descriptor, event.repeated);
      window.setTimeout(() => this.dispatchKey("keyup", descriptor, false), 0);
    }
  }

  private pressSyntheticToken(
    token: string,
    descriptor: KeyDescriptor,
    repeated: boolean,
    dispatchInitial = true,
  ): void {
    const existing = this.heldSyntheticKeys.get(token);
    if (repeated && existing) {
      this.dispatchKey("keydown", existing, true);
      return;
    }
    if (existing) return;
    this.heldSyntheticKeys.set(token, descriptor);
    const firstOwner = this.syntheticKeyOwnership.acquire(
      token,
      descriptor.code,
    );
    if (dispatchInitial && firstOwner) {
      this.dispatchKey("keydown", descriptor, false);
    }
  }

  private releaseSyntheticToken(token: string): void {
    const descriptor = this.heldSyntheticKeys.get(token);
    if (!descriptor) return;
    this.heldSyntheticKeys.delete(token);
    const release = this.syntheticKeyOwnership.release(token);
    if (release?.finalOwner) {
      this.dispatchKey("keyup", descriptor, false);
    }
  }

  private contextualizeAction(action: InputAction): InputAction {
    const context = this.getContext();
    if (context === "exploration" && action.startsWith("navigate")) {
      return action.replace("navigate", "move") as InputAction;
    }
    if (context === "cutscene" || context === "ending") {
      if (action === "confirm" || action === "interact") return "cutsceneAdvance";
      if (action === "cancel") return "cutsceneSkip";
    }
    if (context === "inventory") {
      const inventoryActions: Partial<Record<InputAction, InputAction>> = {
        navigateUp: "inventoryPrevious",
        navigateDown: "inventoryNext",
        navigateLeft: "inventoryPagePrevious",
        navigateRight: "inventoryPageNext",
        confirm: "inventoryPrimary",
      };
      return inventoryActions[action] ?? action;
    }
    if (context === "codex") {
      if (action === "interact") return "codexSearch";
      if (action === "battleTargetPrevious") return "codexCategoryPrevious";
      if (action === "battleTargetNext") return "codexCategoryNext";
    }
    return action;
  }

  private keyForAction(action: InputAction): KeyDescriptor | undefined {
    if (
      (
        this.getContext() === "shop"
        || this.getContext() === "chronicle"
      )
      && action.startsWith("navigate")
    ) {
      const direction = action.slice("navigate".length);
      return { code: `Arrow${direction}`, key: `Arrow${direction}` };
    }
    if (
      this.getContext() === "characterCreation"
      && action.startsWith("navigate")
    ) {
      const direction = action.slice("navigate".length);
      return { code: `Arrow${direction}`, key: `Arrow${direction}` };
    }
    if (
      this.getContext() === "characterCreation"
      && (action === "confirm" || action === "interact")
    ) {
      return { code: "Enter", key: "Enter" };
    }
    return ACTION_KEYS[action];
  }

  private dispatchKey(
    type: "keydown" | "keyup",
    descriptor: KeyDescriptor,
    repeat: boolean,
  ): void {
    const event = new KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      code: descriptor.code,
      key: descriptor.key,
      repeat,
    });
    const keyCode = descriptor.keyCode ?? this.keyCodeFor(descriptor.code);
    Object.defineProperty(event, "keyCode", { value: keyCode });
    Object.defineProperty(event, "which", { value: keyCode });
    this.syntheticEvents.add(event);
    window.dispatchEvent(event);
  }

  private keyCodeFor(code: string): number {
    const fixed: Readonly<Record<string, number>> = {
      Backspace: 8,
      Tab: 9,
      Enter: 13,
      Escape: 27,
      Space: 32,
      PageUp: 33,
      PageDown: 34,
      End: 35,
      Home: 36,
      ArrowLeft: 37,
      ArrowUp: 38,
      ArrowRight: 39,
      ArrowDown: 40,
      F1: 112,
      Slash: 191,
    };
    if (fixed[code] !== undefined) return fixed[code];
    if (code.startsWith("Key") && code.length === 4) {
      return code.charCodeAt(3);
    }
    return 0;
  }

  private releaseAllSyntheticKeys(): void {
    const descriptors = new Map<string, KeyDescriptor>();
    for (const descriptor of this.heldSyntheticKeys.values()) {
      descriptors.set(descriptor.code, descriptor);
    }
    this.heldSyntheticKeys.clear();
    this.syntheticKeyOwnership.clear();
    for (const descriptor of descriptors.values()) {
      this.dispatchKey("keyup", descriptor, false);
    }
  }

  private dispatchWheel(deltaY: number): void {
    this.game.canvas.dispatchEvent(new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY,
    }));
  }

  private clickCursor(): void {
    const init: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      clientX: this.cursorX,
      clientY: this.cursorY,
      buttons: 1,
    };
    const mouseDown = new MouseEvent("mousedown", init);
    const mouseUp = new MouseEvent("mouseup", {
      ...init,
      buttons: 0,
    });
    this.syntheticEvents.add(mouseDown);
    this.syntheticEvents.add(mouseUp);
    this.game.canvas.dispatchEvent(mouseDown);
    this.game.canvas.dispatchEvent(mouseUp);
  }

  private createTouchControls(): void {
    const root = document.createElement("div");
    root.id = "touch-controls";
    root.setAttribute("aria-label", "Touch game controls");
    for (const definition of TOUCH_BUTTONS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `touch-control ${definition.className}`;
      button.dataset.action = definition.action;
      button.textContent = definition.label;
      button.setAttribute("aria-label", definition.action);
      let lastPointerActivation = Number.NEGATIVE_INFINITY;
      const pulse = (): void => {
        const inputEvent = this.state.pulse(
          this.contextualizeAction(definition.action),
          "touch",
          now(),
        );
        if (inputEvent) this.dispatch(inputEvent);
      };
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        if (!HELD_TOUCH_ACTIONS.has(definition.action)) {
          inputSource.set("touch");
          this.updatePresentation("touch");
          return;
        }
        if (event.isTrusted) button.setPointerCapture(event.pointerId);
        const action = this.contextualizeAction(definition.action);
        const token = `touch:${event.pointerId}:${definition.action}`;
        const inputEvent = this.state.press(token, action, "touch", now());
        if (inputEvent) {
          this.dispatch(inputEvent);
        } else {
          const descriptor = this.keyForAction(action);
          if (descriptor) {
            this.pressSyntheticToken(token, descriptor, false, false);
          }
        }
      });
      const releaseHeld = (event: PointerEvent): void => {
        const token = `touch:${event.pointerId}:${definition.action}`;
        this.state.release(token);
        window.setTimeout(() => this.releaseSyntheticToken(token), 40);
        if (button.hasPointerCapture(event.pointerId)) {
          button.releasePointerCapture(event.pointerId);
        }
      };
      button.addEventListener("pointerup", (event) => {
        event.preventDefault();
        if (HELD_TOUCH_ACTIONS.has(definition.action)) {
          releaseHeld(event);
          return;
        }
        lastPointerActivation = now();
        pulse();
      });
      button.addEventListener("pointercancel", (event) => {
        if (HELD_TOUCH_ACTIONS.has(definition.action)) releaseHeld(event);
      });
      button.addEventListener("lostpointercapture", (event) => {
        const token = `touch:${event.pointerId}:${definition.action}`;
        this.state.release(token);
        window.setTimeout(() => this.releaseSyntheticToken(token), 40);
      });
      button.addEventListener("click", (event) => {
        if (HELD_TOUCH_ACTIONS.has(definition.action)) return;
        event.preventDefault();
        if (now() - lastPointerActivation <= TOUCH_CLICK_SUPPRESSION_MS) return;
        pulse();
      });
      root.append(button);
    }
    document.getElementById("game-inner")?.append(root);
    this.touchRoot = root;
    this.applyFeatureAvailability();
  }

  private applyFeatureAvailability(): void {
    if (!this.touchRoot) return;
    for (const button of this.touchRoot.querySelectorAll<HTMLButtonElement>(
      ".touch-control",
    )) {
      const action = button.dataset.action;
      const featureId = action
        ? getInputActionFeature(action as InputAction)
        : undefined;
      button.hidden = featureId !== undefined
        && !featureAvailability.has(featureId);
    }
  }

  private createCursor(): void {
    const cursor = document.createElement("div");
    cursor.id = "gamepad-cursor";
    cursor.setAttribute("aria-hidden", "true");
    document.body.append(cursor);
    this.cursor = cursor;
    this.updateCursor();
  }

  private updateCursor(): void {
    if (!this.cursor) return;
    this.cursor.style.display = this.cursorActive ? "block" : "none";
    this.cursor.style.transform = `translate(${this.cursorX}px, ${this.cursorY}px)`;
  }

  private applyControlPreferences(): void {
    const controls = gamePreferences.getControls();
    const showTouch = this.shouldShowTouch(controls.touchControls);
    this.touchRoot?.classList.toggle("visible", showTouch);
    this.touchRoot?.classList.toggle(
      "right-handed",
      controls.handedness === "right",
    );
    this.touchRoot?.classList.toggle(
      "left-handed",
      controls.handedness === "left",
    );
    this.game.canvas.dataset.touchControls = String(showTouch);
    this.game.canvas.dataset.controlHandedness = controls.handedness;
    this.updatePresentation(inputSource.get());
  }

  private shouldShowTouch(visibility: TouchControlVisibility): boolean {
    if (visibility === "on") return true;
    if (visibility === "off") return false;
    return isTouchDevice();
  }

  private updatePresentation(source: InputSource): void {
    const promptPreference = gamePreferences.getControls().promptSource;
    const promptSource = promptPreference === "auto"
      ? source
      : promptPreference;
    this.game.canvas.dataset.inputSource = source;
    this.game.canvas.dataset.promptSource = promptSource;
    this.game.canvas.dataset.gamepadConnected = String(this.gamepadConnected);
    document.documentElement.dataset.inputSource = source;
    window.setTimeout(() => {
      if (this.game.canvas.dataset.promptSource === promptSource) {
        inputPromptSource.set(promptSource);
      }
    }, 0);
  }

  private getActiveSceneKey(): string {
    return this.game.scene.getScenes(true)[0]?.scene.key ?? "";
  }

  private handleMobileTextInput(action: InputAction): boolean {
    const form = document.getElementById("mobile-text-input");
    if (!(form instanceof HTMLFormElement)) return false;
    if (
      action === "confirm"
      || action === "interact"
      || action === "inventoryPrimary"
    ) {
      form.requestSubmit();
    } else if (
      action === "cancel"
      || action === "openMenu"
    ) {
      const cancel = form.querySelector<HTMLButtonElement>(
        'button[type="button"]',
      );
      cancel?.click();
    }
    return true;
  }

  private closeMobileTextInput(): void {
    document.getElementById("mobile-text-input")?.remove();
  }

  private getContext(): InputContext {
    const key = this.getActiveSceneKey();
    if (key === "BootScene") {
      const state = document.getElementById("debug-state")?.textContent ?? "";
      return state.includes("Screen: title") ? "title" : "characterCreation";
    }
    if (key === "OverworldScene") {
      const state = document.getElementById("debug-state")?.textContent ?? "";
      if (state.includes("[PARTY:items")) return "inventory";
      if (state.includes("[GATHERING")) return "gathering";
      if (state.includes("[CHRONICLE]")) return "chronicle";
      if (
        state.includes("[PARTY:")
        || state.includes("[MENU]")
        || state.includes("[SAVE_SLOTS:")
        || state.includes("[TIPS")
        || state.includes("[WORLD_EVENT:")
      ) {
        return "overlay";
      }
      return "exploration";
    }
    if (key === "ShopScene") return "shop";
    if (key === "CodexScene") return "codex";
    if (key === "BattleScene") return "battle";
    if (key === "CutsceneScene") return "cutscene";
    if (key === "EndingScene") return "ending";
    if (key === "DefeatScene") return "result";
    return "overlay";
  }
}

export function openMobileTextInput(
  label: string,
  initialValue: string,
  maximumLength: number,
  onCommit: (value: string) => void,
): void {
  const existing = document.getElementById("mobile-text-input");
  existing?.remove();
  const form = document.createElement("form");
  form.id = "mobile-text-input";
  form.setAttribute("aria-label", label);
  const input = document.createElement("input");
  input.type = "text";
  input.value = initialValue;
  input.maxLength = maximumLength;
  input.autocomplete = "off";
  input.setAttribute("aria-label", label);
  const commit = document.createElement("button");
  commit.type = "submit";
  commit.textContent = "Done";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel";
  const close = (): void => form.remove();
  const stopGamePropagation = (event: KeyboardEvent): void => {
    event.stopPropagation();
  };
  form.addEventListener("keydown", stopGamePropagation);
  form.addEventListener("keyup", stopGamePropagation);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onCommit(input.value);
    close();
  });
  cancel.addEventListener("click", close);
  form.append(input, commit, cancel);
  document.body.append(form);
  input.focus();
  input.select();
}
