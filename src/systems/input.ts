export const INPUT_ACTIONS = [
  "moveUp",
  "moveDown",
  "moveLeft",
  "moveRight",
  "navigateUp",
  "navigateDown",
  "navigateLeft",
  "navigateRight",
  "confirm",
  "cancel",
  "interact",
  "openMenu",
  "openJournal",
  "openParty",
  "openCodex",
  "openAchievements",
  "openGathering",
  "openCrafting",
  "openTips",
  "openSettings",
  "openMap",
  "openEquipment",
  "toggleMount",
  "battleAttack",
  "battleAbilities",
  "battleSpells",
  "battleItems",
  "battleDefend",
  "battleFlee",
  "battleTargetPrevious",
  "battleTargetNext",
  "battleLogUp",
  "battleLogDown",
  "cutsceneAdvance",
  "cutsceneSkip",
  "inventoryPrevious",
  "inventoryNext",
  "inventoryPagePrevious",
  "inventoryPageNext",
  "inventoryFirst",
  "inventoryLast",
  "inventoryPrimary",
  "inventoryTransfer",
  "inventoryCycleSort",
  "inventoryCycleFilter",
  "inventorySearch",
  "inventoryClearSearch",
  "inventoryNextTarget",
  "codexSearch",
  "codexCategoryPrevious",
  "codexCategoryNext",
] as const;

export type InputAction = (typeof INPUT_ACTIONS)[number];

export type InputSource = "keyboard" | "pointer" | "gamepad" | "touch";

export type InputContext =
  | "title"
  | "characterCreation"
  | "exploration"
  | "overlay"
  | "chronicle"
  | "inventory"
  | "gathering"
  | "crafting"
  | "shop"
  | "codex"
  | "battle"
  | "cutscene"
  | "ending"
  | "result";

export interface SemanticInputEvent {
  action: InputAction;
  source: InputSource;
  timestamp: number;
  repeated: boolean;
  token?: string;
}

export interface InputContextRegistration {
  id: string;
  context: InputContext;
  priority: number;
  enabled: () => boolean;
}

export interface StandardGamepadBinding {
  action: InputAction;
  button?: number;
  axis?: number;
  direction?: -1 | 1;
  repeatable?: boolean;
}

export const STANDARD_GAMEPAD_BINDINGS: readonly StandardGamepadBinding[] = [
  { button: 0, action: "confirm" },
  { button: 1, action: "cancel" },
  { button: 2, action: "interact" },
  { button: 3, action: "openMenu" },
  { button: 4, action: "battleTargetPrevious", repeatable: true },
  { button: 5, action: "battleTargetNext", repeatable: true },
  { button: 6, action: "battleLogUp", repeatable: true },
  { button: 7, action: "battleLogDown", repeatable: true },
  { button: 8, action: "openTips" },
  { button: 9, action: "openMenu" },
  { button: 12, action: "navigateUp", repeatable: true },
  { button: 13, action: "navigateDown", repeatable: true },
  { button: 14, action: "navigateLeft", repeatable: true },
  { button: 15, action: "navigateRight", repeatable: true },
  { axis: 0, direction: -1, action: "navigateLeft", repeatable: true },
  { axis: 0, direction: 1, action: "navigateRight", repeatable: true },
  { axis: 1, direction: -1, action: "navigateUp", repeatable: true },
  { axis: 1, direction: 1, action: "navigateDown", repeatable: true },
];

const REPEATABLE_ACTIONS = new Set<InputAction>([
  "moveUp",
  "moveDown",
  "moveLeft",
  "moveRight",
  "navigateUp",
  "navigateDown",
  "navigateLeft",
  "navigateRight",
  "battleTargetPrevious",
  "battleTargetNext",
  "battleLogUp",
  "battleLogDown",
  "inventoryPrevious",
  "inventoryNext",
  "inventoryPagePrevious",
  "inventoryPageNext",
]);

const KEYBOARD_SHORTCUTS: Readonly<Record<string, InputAction>> = {
  Escape: "cancel",
  F1: "openTips",
  KeyC: "openCodex",
  KeyY: "openAchievements",
  KeyK: "openGathering",
  KeyV: "openCrafting",
  KeyE: "openEquipment",
  KeyM: "openMap",
  KeyP: "openParty",
  KeyQ: "openJournal",
  KeyT: "toggleMount",
  PageUp: "battleLogUp",
  PageDown: "battleLogDown",
  Home: "inventoryFirst",
  End: "inventoryLast",
  Tab: "inventoryNextTarget",
};

const NAVIGATION_CONTEXTS = new Set<InputContext>([
  "title",
  "characterCreation",
  "overlay",
  "chronicle",
  "inventory",
  "gathering",
  "shop",
  "codex",
  "battle",
  "cutscene",
  "ending",
  "result",
]);

const EXPLORATION_ONLY_TOUCH_ACTIONS = new Set<InputAction>([
  "openMenu",
  "openTips",
]);

function directionalAction(
  direction: "Up" | "Down" | "Left" | "Right",
  context: InputContext,
): InputAction {
  const prefix = context === "exploration" ? "move" : "navigate";
  return `${prefix}${direction}` as InputAction;
}

export function isInputAction(value: unknown): value is InputAction {
  return typeof value === "string"
    && (INPUT_ACTIONS as readonly string[]).includes(value);
}

export function normalizeAnalogAxis(value: number, deadZone = 0.24): number {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.max(-1, Math.min(1, value));
  const magnitude = Math.abs(clamped);
  if (magnitude <= deadZone) return 0;
  const scaled = (magnitude - deadZone) / (1 - deadZone);
  return Math.sign(clamped) * scaled;
}

export function mapKeyboardCode(
  code: string,
  context: InputContext,
): InputAction | undefined {
  if (code === "Enter" || code === "Space") {
    return context === "exploration" ? "interact" : "confirm";
  }
  if (code.startsWith("Arrow")) {
    const direction = code.slice("Arrow".length) as
      | "Up"
      | "Down"
      | "Left"
      | "Right";
    return directionalAction(direction, context);
  }
  const wasd: Readonly<Record<string, "Up" | "Down" | "Left" | "Right">> = {
    KeyW: "Up",
    KeyS: "Down",
    KeyA: "Left",
    KeyD: "Right",
  };
  const direction = wasd[code];
  if (direction) return directionalAction(direction, context);
  if (context === "inventory") {
    const inventory: Readonly<Record<string, InputAction>> = {
      KeyR: "inventoryCycleSort",
      KeyF: "inventoryCycleFilter",
      Slash: "inventorySearch",
      KeyX: "inventoryTransfer",
    };
    if (inventory[code]) return inventory[code];
  }
  if (context === "codex" && code === "Slash") return "codexSearch";
  return KEYBOARD_SHORTCUTS[code];
}

export function resolveGamepadAction(
  binding: StandardGamepadBinding,
  context: InputContext,
): InputAction {
  if (!binding.action.startsWith("navigate") || context !== "exploration") {
    return binding.action;
  }
  return binding.action.replace("navigate", "move") as InputAction;
}

export function isRepeatableAction(action: InputAction): boolean {
  return REPEATABLE_ACTIONS.has(action);
}

export function isTouchActionAvailable(
  action: InputAction,
  context: InputContext,
  featureAvailable = true,
): boolean {
  return featureAvailable
    && (
      !EXPLORATION_ONLY_TOUCH_ACTIONS.has(action)
      || context === "exploration"
    );
}

export class InputContextStack {
  private readonly registrations = new Map<string, InputContextRegistration>();

  register(registration: InputContextRegistration): () => void {
    this.registrations.set(registration.id, registration);
    return () => this.registrations.delete(registration.id);
  }

  resolve(fallback: InputContext): InputContext {
    return [...this.registrations.values()]
      .filter((registration) => registration.enabled())
      .sort((a, b) => b.priority - a.priority)[0]?.context ?? fallback;
  }

  clear(): void {
    this.registrations.clear();
  }
}

export class InputKeyOwnership {
  private readonly heldKeys = new Map<string, string>();
  private readonly ownerCounts = new Map<string, number>();

  acquire(token: string, key: string): boolean {
    if (this.heldKeys.has(token)) return false;
    this.heldKeys.set(token, key);
    const owners = this.ownerCounts.get(key) ?? 0;
    this.ownerCounts.set(key, owners + 1);
    return owners === 0;
  }

  release(token: string): { key: string; finalOwner: boolean } | null {
    const key = this.heldKeys.get(token);
    if (!key) return null;
    this.heldKeys.delete(token);
    const owners = this.ownerCounts.get(key) ?? 1;
    if (owners <= 1) {
      this.ownerCounts.delete(key);
      return { key, finalOwner: true };
    }
    this.ownerCounts.set(key, owners - 1);
    return { key, finalOwner: false };
  }

  clear(): string[] {
    const keys = [...this.ownerCounts.keys()];
    this.heldKeys.clear();
    this.ownerCounts.clear();
    return keys;
  }
}

interface HeldInput {
  action: InputAction;
  source: InputSource;
  nextRepeatAt: number;
}

export class SemanticInputState {
  private readonly held = new Map<string, HeldInput>();
  private readonly lastDispatch = new Map<InputAction, number>();
  private currentSource: InputSource = "keyboard";

  constructor(
    private readonly repeatDelay = 320,
    private readonly repeatInterval = 110,
    private readonly duplicateWindow = 45,
  ) {}

  get source(): InputSource {
    return this.currentSource;
  }

  press(
    token: string,
    action: InputAction,
    source: InputSource,
    timestamp: number,
  ): SemanticInputEvent | null {
    if (this.held.has(token)) return null;
    this.currentSource = source;
    this.held.set(token, {
      action,
      source,
      nextRepeatAt: timestamp + this.repeatDelay,
    });
    return this.createEvent(action, source, timestamp, false, token);
  }

  pulse(
    action: InputAction,
    source: InputSource,
    timestamp: number,
  ): SemanticInputEvent | null {
    this.currentSource = source;
    return this.createEvent(action, source, timestamp, false);
  }

  release(token: string): void {
    this.held.delete(token);
  }

  update(timestamp: number): SemanticInputEvent[] {
    const events: SemanticInputEvent[] = [];
    for (const [token, held] of this.held) {
      if (
        !isRepeatableAction(held.action)
        || timestamp < held.nextRepeatAt
      ) {
        continue;
      }
      held.nextRepeatAt = timestamp + this.repeatInterval;
      const event = this.createEvent(
        held.action,
        held.source,
        timestamp,
        true,
        token,
      );
      if (event) events.push(event);
    }
    return events;
  }

  clearSource(source: InputSource): void {
    for (const [token, held] of this.held) {
      if (held.source === source) this.held.delete(token);
    }
  }

  releaseMatching(tokenPrefix: string): Array<{
    token: string;
    action: InputAction;
  }> {
    const released: Array<{ token: string; action: InputAction }> = [];
    for (const [token, held] of this.held) {
      if (!token.startsWith(tokenPrefix)) continue;
      released.push({ token, action: held.action });
      this.held.delete(token);
    }
    return released;
  }

  clear(): void {
    this.held.clear();
    this.lastDispatch.clear();
  }

  private createEvent(
    action: InputAction,
    source: InputSource,
    timestamp: number,
    repeated: boolean,
    token?: string,
  ): SemanticInputEvent | null {
    const last = this.lastDispatch.get(action);
    if (last !== undefined && timestamp - last < this.duplicateWindow) {
      return null;
    }
    this.lastDispatch.set(action, timestamp);
    return { action, source, timestamp, repeated, token };
  }
}

type InputSourceListener = (source: InputSource) => void;

class InputSourceStore {
  private source: InputSource = "keyboard";
  private readonly listeners = new Set<InputSourceListener>();

  get(): InputSource {
    return this.source;
  }

  set(source: InputSource): void {
    if (source === this.source) return;
    this.source = source;
    for (const listener of this.listeners) listener(source);
  }

  subscribe(listener: InputSourceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const inputSource = new InputSourceStore();
export const inputPromptSource = new InputSourceStore();

export function getInputPromptSource(): InputSource {
  return inputPromptSource.get();
}
