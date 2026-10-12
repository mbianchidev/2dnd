import type * as Phaser from "phaser";
import { debugLog } from "../config";
import {
  createAggregateDicePresentation,
  createCombatDicePresentation,
  createD20Presentation,
  createEffectDicePresentation,
  combineDicePresentations,
  type CombatDiceReceipt,
  type DicePresentation,
  type DicePresentationEvent,
} from "../systems/dicePresentation";
import type {
  BattleCombatantState,
  BattleInitiativeResult,
} from "../systems/groupCombat";
import type { StatusTurnStartResult } from "../systems/statusEffects";
import type { MonsterAbilityResult } from "../systems/combat";
import type { ResolvedBattleAction } from "../systems/battleActions";
import type { ResolvedD20Roll, ResolvedEffectRoll } from "../systems/rollResults";
import { installDicePresentation, presentDiceResult } from "./dicePresentation";

export interface ResolvedAttackDiceTarget {
  readonly target: BattleCombatantState;
  readonly result: CombatDiceReceipt;
}

export interface ResolvedHealingDiceTarget {
  readonly target: BattleCombatantState;
  readonly result: { readonly healing: number; readonly healingRoll?: ResolvedEffectRoll };
}

/** Projects already-applied combat receipts without owning combat or discovery. */
export class BattleDicePresenter {
  constructor(
    private readonly scene: Phaser.Scene,
    addLog: (message: string, event: DicePresentationEvent) => void,
  ) {
    installDicePresentation(scene, addLog);
  }

  presentAttack(
    actor: BattleCombatantState,
    target: BattleCombatantState,
    result: CombatDiceReceipt,
    label = "attack",
    actionId = "attack",
  ): void {
    this.presentAttacks(actor, [{ target, result }], label, actionId, result);
  }

  /** One canonical action may share a roll while applying different target effects. */
  presentAttacks(
    actor: BattleCombatantState,
    targets: readonly ResolvedAttackDiceTarget[],
    label: string,
    actionId: string,
    source: object,
  ): void {
    const views: DicePresentation[] = [];
    for (const { target, result } of targets) {
      debugLog("[dice] receipt", {
        kind: "attack", actorId: actor.id, targetId: target.id, actionId, attack: result,
      });
      const view = createCombatDicePresentation(result, {
        actorId: actor.id,
        targetId: target.id,
        actionId,
        sharedRoll: targets.length > 1,
        label: `${actor.label} ${label} -> ${target.label}`
          + (result.bodyPartLabel ? ` [${result.bodyPartLabel}]` : ""),
        revealModifier: actor.side === "party",
        revealThreshold: target.side === "party"
          || ("acDiscovered" in target && target.acDiscovered === true),
      });
      if (view) views.push(view);
    }
    this.presentResults(views, source);
  }

  private presentResults(views: readonly DicePresentation[], source: object): void {
    const primary = views[0];
    if (primary) {
      presentDiceResult(this.scene, combineDicePresentations(primary, views.slice(1)), source);
    }
  }

  presentInitiative(
    actors: readonly BattleCombatantState[],
    result: BattleInitiativeResult,
  ): void {
    for (const actor of actors) {
      const roll = result.rollResults[actor.id];
      if (!roll) continue;
      debugLog("[dice] receipt", {
        kind: "initiative", actorId: actor.id, rollResult: roll,
      });
      presentDiceResult(this.scene, createD20Presentation(roll, {
        category: "initiative",
        label: `${actor.label} initiative`,
        actorId: actor.id,
        actionId: "initiative",
        outcome: "rolled",
        revealModifier: actor.side === "party",
      }), roll);
    }
  }

  presentStatusTurn(
    actor: BattleCombatantState,
    result: StatusTurnStartResult,
    appliedDamage: number,
  ): void {
    const views: DicePresentation[] = [];
    for (const save of result.savingThrows) {
      debugLog("[dice] receipt", { kind: "save", actorId: actor.id, save });
      views.push(createD20Presentation(save.rollResult, {
        category: "save",
        label: `${actor.label} save vs ${save.label}`,
        actorId: actor.id,
        actionId: `status:${save.effectId}:save`,
        outcome: save.success ? "success" : "failure",
        threshold: { kind: "DC", value: save.dc },
        revealModifier: actor.side === "party",
        revealThreshold: actor.side === "party",
      }));
    }
    for (const damage of result.damageRolls) {
      debugLog("[dice] receipt", {
        kind: "statusDamage", actorId: actor.id, damage, appliedDamage,
      });
      views.push(createEffectDicePresentation(damage.damageRoll, {
        category: "damage",
        label: `${actor.label} ${damage.label} damage`,
        actorId: actor.id,
        actionId: `status:${damage.effectId}:tick`,
        outcome: "rolled",
        revealModifier: actor.side === "party",
      }));
    }
    const primary = views[0];
    if (!primary) return;
    presentDiceResult(this.scene, combineDicePresentations(
      primary, views.slice(1),
      result.tickDamage > 0
        ? `Total status damage ${result.tickDamage}; HP lost ${appliedDamage}`
          + (appliedDamage !== result.tickDamage ? " (Overkill)" : "")
        : undefined,
    ), result);
  }

  presentFlee(
    actor: BattleCombatantState,
    result: { rollResult: ResolvedD20Roll; dc: number; success: boolean },
  ): void {
    debugLog("[dice] receipt", { kind: "flee", actorId: actor.id, flee: result });
    presentDiceResult(this.scene, createD20Presentation(result.rollResult, {
      category: "flee",
      label: `${actor.label} flee`,
      actorId: actor.id,
      actionId: "flee",
      outcome: result.success ? "success" : "failure",
      threshold: { kind: "DC", value: result.dc },
    }), result);
  }

  presentHealing(
    actor: BattleCombatantState,
    target: BattleCombatantState,
    result: { healing: number; healingRoll?: ResolvedEffectRoll },
    label = "heals",
    actionId = "healing",
  ): void {
    this.presentHealings(actor, [{ target, result }], label, actionId, result);
  }

  presentHealings(
    actor: BattleCombatantState,
    targets: readonly ResolvedHealingDiceTarget[],
    label: string,
    actionId: string,
    source: object,
  ): void {
    const views = targets.map(({ target, result }): DicePresentation => {
      debugLog("[dice] receipt", {
        kind: "healing", actorId: actor.id, targetId: target.id, actionId, healing: result,
      });
      const options = {
        category: "healing" as const,
        label: `${actor.label} ${label} -> ${target.label}`,
        actorId: actor.id,
        targetId: target.id,
        actionId,
        outcome: "success" as const,
        revealModifier: actor.side === "party",
      };
      return result.healingRoll
        ? createEffectDicePresentation(result.healingRoll, options)
        : createAggregateDicePresentation({
          ...options,
          detail: `${result.healing} HP restored (aggregate; no independent dice)`,
        });
    });
    this.presentResults(views, source);
  }

  presentMonsterAbility(
    actor: BattleCombatantState,
    target: BattleCombatantState,
    result: MonsterAbilityResult,
    healingTarget?: BattleCombatantState,
    appliedHealing = 0,
  ): void {
    debugLog("[dice] receipt", {
      kind: "monsterAbility", actorId: actor.id, targetId: target.id, ability: result,
    });
    const views: DicePresentation[] = [];
    if (result.damageRoll) {
      views.push(createEffectDicePresentation(result.damageRoll, {
        category: "damage",
        label: `${actor.label} ${result.abilityName} -> ${target.label}`,
        actorId: actor.id,
        targetId: target.id,
        actionId: `monsterAbility:${result.abilityName}`,
        outcome: "rolled",
        revealModifier: actor.side === "party",
        detail: "No attack roll",
      }));
    }
    if (healingTarget) {
      const options = {
        category: "healing" as const,
        label: `${actor.label} ${result.abilityName} -> ${healingTarget.label}`,
        actorId: actor.id,
        targetId: healingTarget.id,
        actionId: `monsterAbility:${result.abilityName}`,
        outcome: "success" as const,
        revealModifier: actor.side === "party",
      };
      views.push(result.healingRoll
        ? createEffectDicePresentation(result.healingRoll, options)
        : createAggregateDicePresentation({
          ...options,
          detail: `Derived healing ${result.healing} from damage (no new dice); HP restored ${appliedHealing}`
            + (appliedHealing !== result.healing ? " (Maximum HP)" : ""),
        }));
    }
    this.presentResults(views, result);
  }

  presentResolvedAction(
    result: ResolvedBattleAction,
    actors: readonly BattleCombatantState[],
  ): void {
    const actor = actors.find((candidate) => candidate.id === result.plan.actorId);
    if (!actor) throw new Error("[dice] Resolved action has no stable actor.");
    const attacks = (result.diceResults ?? []).map((dice): ResolvedAttackDiceTarget => {
      const target = actors.find((candidate) => candidate.id === dice.targetId);
      if (!target) throw new Error("[dice] Resolved action has no stable target.");
      return { target, result: dice.result };
    });
    const actionId = result.plan.actionId ?? result.plan.kind;
    this.presentAttacks(actor, attacks, actionId, actionId, result);
    const healings = result.targets.filter((target) => target.healing > 0 || target.healingRoll)
      .map((healing): ResolvedHealingDiceTarget => {
        const target = actors.find((candidate) => candidate.id === healing.targetId);
        if (!target) throw new Error("[dice] Resolved healing has no stable target.");
        return { target, result: healing };
      });
    this.presentHealings(actor, healings, actionId, actionId, result);
  }
}
