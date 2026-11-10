import { isCombatantActive, type GroupCombatant } from "./groupCombat";
import { createEnemyHudView, type BattleHudEnemy } from "./battleHud";
import type { DiceRollCategory } from "./dicePresentation";

export const BATTLE_NOTICE_ENTER_MS = 140;
export const BATTLE_NOTICE_HOLD_MS = 2800;
export const BATTLE_NOTICE_FADE_MS = 240;

export interface BattleDecisionVisibilityInput {
  readonly controlledDecision: boolean;
  readonly animationActive: boolean;
  readonly blocked: boolean;
  readonly submenuOpen: boolean;
  readonly targeting: boolean;
}

export interface BattleDecisionVisibility {
  readonly decision: boolean;
  readonly commands: boolean;
}

export function getBattleDecisionVisibility(input: BattleDecisionVisibilityInput): BattleDecisionVisibility {
  const decision = input.controlledDecision && !input.animationActive && !input.blocked;
  return { decision, commands: decision && !input.submenuOpen && !input.targeting };
}

export interface EnemyHealthFocus {
  readonly targeting: boolean;
  readonly targetIds: readonly string[];
  readonly hoveredId: string | null;
  readonly focusedId: string | null;
}

/** Unrevealed, untargeted and inactive HP never enters a visual or native tooltip. */
export function getTargetHealthView(
  enemies: readonly GroupCombatant[],
  focus: EnemyHealthFocus,
): BattleHudEnemy | null {
  if (!focus.targeting) return null;
  const id = focus.hoveredId ?? focus.focusedId;
  if (!id || !focus.targetIds.includes(id)) return null;
  const enemy = enemies.find((candidate) => candidate.id === id);
  return enemy && isCombatantActive(enemy) && enemy.hpRevealed ? createEnemyHudView(enemy, true) : null;
}

export interface BattleLogEntry {
  readonly id: number;
  readonly text: string;
  readonly category?: DiceRollCategory;
}

export interface BattleNoticeState {
  readonly text: string;
  readonly revision: number;
  readonly visible: boolean;
  readonly alpha: number;
  readonly offsetY: number;
}

/** Runtime-only history and coalesced latest-action feedback, never combat authority. */
export class BattleLogState {
  private readonly history: BattleLogEntry[] = [];
  private pending: string[] = [];
  private sequence = 0;
  private revision = 0;
  private text = "";
  private age = Infinity;

  get entries(): readonly BattleLogEntry[] { return this.history; }

  append(text: string, category?: DiceRollCategory): BattleLogEntry {
    const entry = { id: ++this.sequence, text, ...(category ? { category } : {}) };
    this.history.push(entry);
    if (this.history.length > 200) this.history.splice(0, this.history.length - 200);
    if (category === undefined) {
      this.pending.push(text);
      if (this.pending.length > 3) this.pending.shift();
    }
    return entry;
  }

  commitNotice(): boolean {
    if (this.pending.length === 0) return false;
    this.text = this.pending.join("\n");
    this.pending = [];
    this.age = 0;
    this.revision++;
    return true;
  }

  advance(elapsedMs: number): void {
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new Error("[battle-log] Invalid elapsed time.");
    this.age += elapsedMs;
  }

  readNotice(reducedMotion: boolean): BattleNoticeState {
    const fadeStart = BATTLE_NOTICE_ENTER_MS + BATTLE_NOTICE_HOLD_MS;
    const visible = this.text.length > 0 && this.age < fadeStart + BATTLE_NOTICE_FADE_MS;
    const entrance = Math.min(1, this.age / BATTLE_NOTICE_ENTER_MS);
    const fade = Math.max(0, Math.min(1, 1 - (this.age - fadeStart) / BATTLE_NOTICE_FADE_MS));
    return {
      text: this.text, revision: this.revision, visible,
      alpha: !visible ? 0 : reducedMotion ? 1 : Math.min(entrance, fade),
      offsetY: visible && !reducedMotion ? Math.round((1 - entrance) * 4) : 0,
    };
  }

  clearNotice(): void {
    this.pending = [];
    this.text = "";
    this.age = Infinity;
  }

  reset(): void {
    this.clearNotice();
    this.history.length = 0;
    this.sequence = 0;
    this.revision = 0;
  }
}
