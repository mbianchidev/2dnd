import {
  snapshotD20Roll,
  snapshotDiceComponents,
  type ResolvedD20Roll,
  type ResolvedDiceComponents,
} from "./rollResults";
import type { SkillCheckRecord } from "../data/skillChecks";
import type { DicePreferences } from "./accessibility";
import type { TrapCheckResult } from "./traps";
import type { StatusSavingThrowResult } from "./statusEffects";

export type DiceRollCategory =
  | "attack" | "save" | "initiative" | "skill" | "trap" | "flee"
  | "gathering" | "navigation" | "damage" | "healing" | "other";
export type DiceOutcome =
  | "hit" | "miss" | "critical" | "fumble" | "success" | "failure"
  | "rolled" | "autoHit" | "automatic";

export interface VisibleD20Roll extends Omit<ResolvedD20Roll, "modifier" | "total"> {
  readonly modifier?: number;
  readonly total?: number;
}

export interface VisibleDiceComponents extends Omit<ResolvedDiceComponents, "modifier" | "total"> {
  readonly modifier?: number;
  readonly total?: number;
}

export interface DiceThreshold {
  readonly kind: "AC" | "DC";
  readonly value: number;
}

export interface DicePresentationOptions {
  readonly id?: string;
  readonly category: DiceRollCategory;
  readonly label: string;
  readonly outcome: DiceOutcome;
  readonly actorId?: string;
  readonly targetId?: string;
  readonly threshold?: DiceThreshold;
  readonly detail?: string;
  readonly revealModifier?: boolean;
  readonly revealThreshold?: boolean;
}

/** A redacted presentation snapshot; it contains no hidden mechanics or callbacks. */
export interface DicePresentation {
  readonly id?: string;
  readonly category: DiceRollCategory;
  readonly label: string;
  readonly outcome: DiceOutcome;
  readonly actorId?: string;
  readonly targetId?: string;
  readonly roll?: VisibleD20Roll;
  readonly components?: VisibleDiceComponents;
  readonly threshold?: DiceThreshold;
  readonly detail?: string;
}

export interface CombatDiceReceipt {
  readonly rollResult?: ResolvedD20Roll;
  readonly hit: boolean;
  readonly critical?: boolean;
  readonly fumble?: boolean;
  readonly autoHit?: boolean;
  readonly targetAC?: number;
  readonly damage: number;
}

export type CombatDiceOptions = Omit<
  DicePresentationOptions, "category" | "outcome" | "threshold"
>;

function snapshotPresentation(
  options: DicePresentationOptions,
): DicePresentation {
  return {
    ...(options.id !== undefined ? { id: options.id } : {}),
    category: options.category,
    label: options.label,
    outcome: options.outcome,
    ...(options.actorId !== undefined ? { actorId: options.actorId } : {}),
    ...(options.targetId !== undefined ? { targetId: options.targetId } : {}),
    ...(options.detail !== undefined ? { detail: options.detail } : {}),
    ...(options.threshold && options.revealThreshold !== false
      ? { threshold: Object.freeze({ ...options.threshold }) }
      : {}),
  };
}

export function createD20Presentation(
  result: ResolvedD20Roll,
  options: DicePresentationOptions,
): DicePresentation {
  const exact = snapshotD20Roll(result);
  const roll: VisibleD20Roll = Object.freeze({
    naturalRolls: exact.naturalRolls,
    selectedIndex: exact.selectedIndex,
    selection: exact.selection,
    naturalRoll: exact.naturalRoll,
    ...(options.revealModifier !== false
      ? { modifier: exact.modifier, total: exact.total }
      : {}),
  });
  return Object.freeze({ ...snapshotPresentation(options), roll });
}

export function createComponentDicePresentation(
  result: ResolvedDiceComponents,
  options: DicePresentationOptions,
): DicePresentation {
  const exact = snapshotDiceComponents(result);
  return Object.freeze({
    ...snapshotPresentation(options),
    components: Object.freeze({
      sides: exact.sides,
      naturalRolls: exact.naturalRolls,
      ...(options.revealModifier !== false
        ? { modifier: exact.modifier, total: exact.total }
        : {}),
    }),
  });
}

export function createAggregateDicePresentation(
  options: DicePresentationOptions,
): DicePresentation {
  return Object.freeze(snapshotPresentation(options));
}

export function createCombatDicePresentation(
  result: CombatDiceReceipt,
  options: CombatDiceOptions,
): DicePresentation | null {
  if (!result.rollResult && !result.autoHit) return null;
  const outcome: DiceOutcome = result.autoHit
    ? "autoHit"
    : result.fumble ? "fumble"
      : result.critical ? "critical"
        : result.hit ? "hit" : "miss";
  const presentationOptions: DicePresentationOptions = {
    ...options,
    category: "attack",
    outcome,
    detail: `${result.damage} damage (aggregate)`,
    ...(!result.autoHit && result.targetAC !== undefined
      ? { threshold: { kind: "AC", value: result.targetAC } }
      : {}),
    // Hidden until the owning combatant's normal AC discovery succeeds.
    revealThreshold: options.revealThreshold === true,
  };
  return result.autoHit
    ? createAggregateDicePresentation(presentationOptions)
    : createD20Presentation(result.rollResult!, presentationOptions);
}

export function createSkillDicePresentation(
  result: SkillCheckRecord,
  options: Omit<DicePresentationOptions, "outcome" | "category" | "threshold"> & {
    readonly category?: DiceRollCategory;
  },
): DicePresentation {
  return createD20Presentation({
    naturalRolls: [result.naturalRoll],
    selectedIndex: 0,
    selection: "normal",
    naturalRoll: result.naturalRoll,
    modifier: result.modifier,
    total: result.total,
  }, {
    ...options,
    category: options.category ?? "skill",
    outcome: result.success ? "success" : "failure",
    threshold: { kind: "DC", value: result.dc },
  });
}

export function createTrapDicePresentation(
  result: TrapCheckResult,
  trapLabel: string,
  detection: boolean,
): DicePresentation | null {
  if (!result.attempted) return null;
  const options: DicePresentationOptions = {
    category: "trap",
    label: detection && !result.success
      ? "Dungeon awareness" : `${trapLabel} ${detection ? "detection" : "disarm"}`,
    outcome: result.automatic ? "automatic" : result.success ? "success" : "failure",
    threshold: { kind: "DC", value: result.dc },
    revealThreshold: !detection || result.success,
  };
  if (result.automatic) {
    return createAggregateDicePresentation({ ...options, revealThreshold: false });
  }
  if (result.roll === null) {
    throw new Error("[dice] Attempted trap check has no resolved natural die.");
  }
  return createD20Presentation({
    naturalRolls: [result.roll],
    selectedIndex: 0,
    selection: "normal",
    naturalRoll: result.roll,
    modifier: result.modifier,
    total: result.total,
  }, options);
}

export function redactSavingThrowMessage(
  message: string,
  savingThrows: readonly StatusSavingThrowResult[],
  revealDetails: boolean,
): string {
  if (revealDetails) return message;
  const save = savingThrows.find((result) => result.successMessage === message);
  return save ? `Saved vs ${save.label}!` : message;
}

const OUTCOME_LABELS: Readonly<Record<DiceOutcome, string>> = {
  hit: "Hit",
  miss: "Miss",
  critical: "Critical hit",
  fumble: "Fumble / critical miss",
  success: "Success",
  failure: "Failure",
  rolled: "Resolved",
  autoHit: "Auto-hit (no attack roll)",
  automatic: "Automatic (no roll)",
};

function signedModifier(modifier: number): string {
  return modifier >= 0 ? `+${modifier}` : String(modifier);
}

export function formatDicePresentation(view: DicePresentation): string {
  const parts: string[] = [];
  if (view.roll) {
    const roll = view.roll;
    if (roll.selection === "normal") {
      parts.push(`d20 ${roll.naturalRoll}`);
    } else {
      const selection = roll.selection === "advantage"
        ? "Advantage" : "Disadvantage";
      const faces = roll.naturalRolls.map((natural, index) =>
        `${natural}${index === roll.selectedIndex ? " selected" : ""}`
      );
      parts.push(`${selection}: d20 [${faces.join(", ")}] -> ${roll.naturalRoll}`);
    }
    if (roll.modifier !== undefined && roll.total !== undefined) {
      parts.push(`${signedModifier(roll.modifier)} = ${roll.total}`);
    }
  } else if (view.components) {
    const dice = view.components;
    parts.push(`d${dice.sides} [${dice.naturalRolls.join(", ")}]`);
    if (dice.modifier !== undefined && dice.total !== undefined) {
      parts.push(`${signedModifier(dice.modifier)} = ${dice.total}`);
    }
  }
  if (view.threshold) {
    parts.push(`vs ${view.threshold.kind} ${view.threshold.value}`);
  }
  const details = [
    ...(parts.length > 0 ? [parts.join(" ")] : []),
    OUTCOME_LABELS[view.outcome],
    ...(view.detail ? [view.detail] : []),
  ];
  return `${view.label}: ${details.join(" | ")}`;
}

export function getDicePresentationDuration(
  presentation: DicePresentation,
  preferences: Readonly<DicePreferences>,
  reducedMotion: boolean,
): number {
  if (reducedMotion || preferences.frequency === "off"
    || preferences.speed === "instant") return 0;
  const important = presentation.category !== "attack"
    && presentation.category !== "initiative"
    || presentation.outcome === "critical"
    || presentation.outcome === "fumble";
  if (preferences.frequency === "important" && !important) return 0;
  if (!presentation.roll && !presentation.components) return 0;
  return preferences.speed === "fast" ? 150 : 450;
}

export interface DicePresentationEvent {
  readonly presentation: DicePresentation;
  readonly text: string;
  readonly duration: number;
  readonly sequence: number;
}

export interface DicePresentationAdapter {
  record(event: DicePresentationEvent): void;
  show(event: DicePresentationEvent): void;
  settle(): void;
  clear(): void;
  schedule(duration: number, complete: () => void): () => void;
}

/** Bounded consultable evidence across scene handoffs, never campaign state. */
export class DiceRollHistory {
  private events: readonly DicePresentationEvent[] = [];

  get entries(): readonly DicePresentationEvent[] {
    return this.events;
  }

  append(event: DicePresentationEvent): void {
    this.events = Object.freeze([...this.events.slice(-39), event]);
  }

  clear(): void {
    this.events = [];
  }
}

export const diceRollHistory = new DiceRollHistory();

/** Visual ownership only: no action, reward, turn, or handoff callbacks exist. */
export class DicePresentationController {
  private events: DicePresentationEvent[] = [];
  private readonly seenSources = new WeakMap<object, Set<string>>();
  private readonly seenIds = new Set<string>();
  private cancelTimer: (() => void) | null = null;
  private sequence = 0;
  private state: "ready" | "animating" | "clean" = "ready";

  constructor(private readonly adapter: DicePresentationAdapter) {}

  get phase(): "ready" | "animating" | "clean" {
    return this.state;
  }

  get history(): readonly DicePresentationEvent[] {
    return this.events;
  }

  present(
    presentation: DicePresentation,
    preferences: Readonly<DicePreferences>,
    reducedMotion: boolean,
    source: object = presentation,
  ): void {
    if (this.state === "clean") return;
    const key = `${presentation.category}:${presentation.actorId ?? ""}`
      + `:${presentation.targetId ?? ""}:${presentation.label}`;
    const seen = this.seenSources.get(source) ?? new Set<string>();
    if (seen.has(key) || (
      presentation.id !== undefined && this.seenIds.has(presentation.id)
    )) return;
    seen.add(key);
    this.seenSources.set(source, seen);
    if (presentation.id !== undefined) {
      this.seenIds.add(presentation.id);
      if (this.seenIds.size > 1_024) {
        const oldestId = this.seenIds.values().next().value;
        if (oldestId !== undefined) this.seenIds.delete(oldestId);
      }
    }
    this.fastForward();
    const sequence = ++this.sequence;
    const event = Object.freeze({
      presentation,
      text: formatDicePresentation(presentation),
      duration: getDicePresentationDuration(presentation, preferences, reducedMotion),
      sequence,
    });
    this.events = [...this.events.slice(-39), event];
    this.adapter.record(event);
    this.state = event.duration > 0 ? "animating" : "ready";
    this.adapter.show(event);
    if (event.duration > 0) {
      this.cancelTimer = this.adapter.schedule(event.duration, () => {
        if (this.state !== "animating" || sequence !== this.sequence) return;
        this.cancelTimer = null;
        this.state = "ready";
        this.adapter.settle();
      });
    }
  }

  fastForward(): void {
    if (this.state !== "animating") return;
    this.cancelTimer?.();
    this.cancelTimer = null;
    this.state = "ready";
    this.adapter.settle();
  }

  cleanup(): void {
    if (this.state === "clean") return;
    this.cancelTimer?.();
    this.cancelTimer = null;
    this.state = "clean";
    this.events = [];
    this.seenIds.clear();
    this.adapter.clear();
  }
}
