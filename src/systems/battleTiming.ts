import type { BattleTimingSettings } from "../data/battleTiming";
import {
  consumeBattleActionEconomy,
  executeValidatedBattleAction,
  validateBattleAction,
  type BattleActionEconomyState,
  type BattleActionExecutionContext,
  type BattleActionSource,
  type ResolvedBattleAction,
} from "./battleActions";
import { normalizeBattleTimingSettings } from "./battleTimingSettings";
import type { BattleCombatantId } from "./groupCombat";

export type BattleTimingPauseReason =
  | "input"
  | "action"
  | "animation"
  | "log"
  | "overlay"
  | "transition"
  | "visibility"
  | "focus"
  | "controller"
  | "scene";

export interface BattleTimedDecision {
  readonly id: string;
  readonly actorId: BattleCombatantId;
  readonly remainingMs: number;
}

export interface BattleTimingSnapshot {
  readonly status: "disabled" | "idle" | "active" | "paused" | "expired" | "claimed" | "stopped";
  readonly decision: Readonly<BattleTimedDecision> | null;
  readonly pauseReasons: readonly BattleTimingPauseReason[];
}

/** Active decision time only; no wall-clock deadline, scheduled callback, or save ownership. */
export class BattleDecisionClock {
  private readonly settings: Readonly<BattleTimingSettings>;
  private readonly pauses = new Set<BattleTimingPauseReason>();
  private decision: BattleTimedDecision | null = null;
  private claimed = false;
  private stopped = false;
  private discardNextFrame = false;

  constructor(settings: Readonly<BattleTimingSettings>) {
    this.settings = Object.freeze(normalizeBattleTimingSettings(settings));
  }

  get snapshot(): BattleTimingSnapshot {
    const status = this.stopped
      ? "stopped"
      : this.settings.mode === "standard"
        ? "disabled"
        : !this.decision
          ? "idle"
          : this.claimed
            ? "claimed"
            : this.pauses.size > 0
              ? "paused"
              : this.decision.remainingMs === 0 ? "expired" : "active";
    return Object.freeze({
      status,
      decision: this.decision ? Object.freeze({ ...this.decision }) : null,
      pauseReasons: Object.freeze([...this.pauses]),
    });
  }

  beginTurn(id: string, actorId: BattleCombatantId): void {
    if (this.stopped || this.settings.mode === "standard") return;
    if (!id || !actorId) throw new Error("Timed decisions require a turn and actor ID.");
    if (this.decision?.id === id) {
      if (this.decision.actorId !== actorId) {
        throw new Error("A timed decision cannot change its actor.");
      }
      return;
    }
    this.decision = { id, actorId, remainingMs: this.settings.durationSeconds * 1_000 };
    this.claimed = false;
    this.discardNextFrame = true;
  }

  endTurn(): void {
    this.decision = null;
    this.claimed = false;
    this.discardNextFrame = true;
  }

  setPaused(reason: BattleTimingPauseReason, paused: boolean): void {
    if (this.stopped || this.pauses.has(reason) === paused) return;
    if (paused) this.pauses.add(reason);
    else this.pauses.delete(reason);
    this.discardNextFrame = true;
  }

  advance(elapsedMs: number): void {
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
      throw new RangeError("Timed decision elapsed time must be finite and non-negative.");
    }
    if (this.stopped || !this.decision || this.claimed || this.pauses.size > 0) return;
    // The frame straddling turn start or a pause boundary is not decision time.
    if (this.discardNextFrame) {
      this.discardNextFrame = false;
      return;
    }
    this.decision = {
      ...this.decision,
      remainingMs: Math.max(0, this.decision.remainingMs - elapsedMs),
    };
  }

  claimTimeout(id: string): boolean {
    if (
      this.stopped
      || this.claimed
      || this.pauses.size > 0
      || this.decision?.id !== id
      || this.decision.remainingMs !== 0
    ) {
      return false;
    }
    this.claimed = true;
    return true;
  }

  destroy(): void {
    this.endTurn();
    this.pauses.clear();
    this.stopped = true;
  }
}

export interface TimedBattleTimeoutResult {
  claimed: boolean;
  executed: boolean;
  message: string;
  economy: BattleActionEconomyState;
  action?: ResolvedBattleAction;
}

/** Claim once and validate a fresh self-Defend, never an unconfirmed menu selection. */
export function executeTimedBattleTimeout(
  clock: BattleDecisionClock,
  decisionId: string,
  source: BattleActionSource,
  economy: BattleActionEconomyState,
  context: BattleActionExecutionContext,
): TimedBattleTimeoutResult {
  if (
    clock.snapshot.decision?.actorId !== source.combatant.id
    || !clock.claimTimeout(decisionId)
  ) {
    return {
      claimed: false, executed: false,
      message: "Timed decision is no longer available.", economy,
    };
  }
  const validation = validateBattleAction(
    context.combatants,
    { actorId: source.combatant.id, kind: "defend" },
    {
      mp: source.state.mp,
      inventory: source.state.inventory,
      knownSpellIds: source.state.knownSpells,
      knownAbilityIds: source.state.knownAbilities,
      economy,
    },
  );
  if (!validation.plan) {
    return { claimed: true, executed: false, message: validation.message, economy };
  }
  const transition = consumeBattleActionEconomy(economy, validation.plan);
  if (!transition.valid) {
    return { claimed: true, executed: false, message: transition.message, economy };
  }
  const action = executeValidatedBattleAction(source, validation.plan, context);
  return {
    claimed: true,
    executed: action.executed,
    message: action.message,
    economy: action.executed ? transition.state : economy,
    action,
  };
}
