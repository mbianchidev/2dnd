import type * as Phaser from "phaser";
import {
  createAggregateDicePresentation,
  createCombatDicePresentation,
  createD20Presentation,
  type CombatDiceReceipt,
} from "../systems/dicePresentation";
import type {
  BattleCombatantState,
  BattleInitiativeResult,
} from "../systems/groupCombat";
import type { StatusSavingThrowResult } from "../systems/statusEffects";
import type { ResolvedBattleAction } from "../systems/battleActions";
import type { ResolvedD20Roll } from "../systems/rollResults";
import { installDicePresentation, presentDiceResult } from "./dicePresentation";

/** Projects already-applied combat receipts without owning combat or discovery. */
export class BattleDicePresenter {
  constructor(
    private readonly scene: Phaser.Scene,
    addLog: (message: string) => void,
  ) {
    installDicePresentation(scene, addLog);
  }

  presentAttack(
    actor: BattleCombatantState,
    target: BattleCombatantState,
    result: CombatDiceReceipt,
    label = "attack",
  ): void {
    const view = createCombatDicePresentation(result, {
      actorId: actor.id,
      targetId: target.id,
      label: `${actor.label} ${label} -> ${target.label}`,
      revealModifier: actor.side === "party",
      revealThreshold: target.side === "party"
        || ("acDiscovered" in target && target.acDiscovered === true),
    });
    if (view) presentDiceResult(this.scene, view, result);
  }

  presentInitiative(
    actors: readonly BattleCombatantState[],
    result: BattleInitiativeResult,
  ): void {
    for (const actor of actors) {
      const roll = result.rollResults[actor.id];
      if (!roll) continue;
      presentDiceResult(this.scene, createD20Presentation(roll, {
        category: "initiative",
        label: `${actor.label} initiative`,
        actorId: actor.id,
        outcome: "rolled",
        revealModifier: actor.side === "party",
      }), roll);
    }
  }

  presentSaves(
    actor: BattleCombatantState,
    savingThrows: readonly StatusSavingThrowResult[],
  ): void {
    for (const save of savingThrows) {
      presentDiceResult(this.scene, createD20Presentation(save.rollResult, {
        category: "save",
        label: `${actor.label} save vs ${save.label}`,
        actorId: actor.id,
        outcome: save.success ? "success" : "failure",
        threshold: { kind: "DC", value: save.dc },
        revealModifier: actor.side === "party",
        revealThreshold: actor.side === "party",
      }), save);
    }
  }

  presentFlee(
    actor: BattleCombatantState,
    result: { rollResult: ResolvedD20Roll; dc: number; success: boolean },
  ): void {
    presentDiceResult(this.scene, createD20Presentation(result.rollResult, {
      category: "flee",
      label: `${actor.label} flee`,
      actorId: actor.id,
      outcome: result.success ? "success" : "failure",
      threshold: { kind: "DC", value: result.dc },
    }), result);
  }

  presentHealing(
    actor: BattleCombatantState,
    target: BattleCombatantState,
    result: { healing: number },
  ): void {
    presentDiceResult(this.scene, createAggregateDicePresentation({
      category: "healing",
      label: `${actor.label} heals ${target.label}`,
      actorId: actor.id,
      targetId: target.id,
      outcome: "success",
      detail: `${result.healing} HP restored (aggregate; component dice unavailable)`,
    }), result);
  }

  presentResolvedAction(
    result: ResolvedBattleAction,
    actors: readonly BattleCombatantState[],
  ): void {
    const actor = actors.find((candidate) => candidate.id === result.plan.actorId);
    if (!actor) throw new Error("[dice] Resolved action has no stable actor.");
    for (const dice of result.diceResults ?? []) {
      const target = actors.find((candidate) => candidate.id === dice.targetId);
      if (!target) throw new Error("[dice] Resolved action has no stable target.");
      this.presentAttack(actor, target, dice.result, result.plan.actionId ?? result.plan.kind);
    }
    for (const healing of result.targets.filter((target) => target.healing > 0)) {
      const target = actors.find((candidate) => candidate.id === healing.targetId);
      if (target) this.presentHealing(actor, target, healing);
    }
  }
}
