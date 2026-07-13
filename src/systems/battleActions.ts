/**
 * Phaser-free action planning for player controls, companion AI, and gambits.
 */

import {
  getAbility,
  getAbilityRange,
  getAbilityTargetType,
} from "../data/abilities";
import { getItemTargetType, type Item } from "../data/items";
import {
  getSpell,
  getSpellTargetType,
  type TargetType,
} from "../data/spells";
import {
  getBattleTargetIds,
  getCombatantById,
  isCombatantActive,
  type AttackRange,
  type BattleCombatantId,
  type BattleCombatantState,
} from "./groupCombat";

export type BattleActionKind =
  | "attack"
  | "defend"
  | "spell"
  | "ability"
  | "item";
export type BattleActionCost = "action" | "bonus_action";

export interface BattleActionRequest {
  actorId: BattleCombatantId;
  kind: BattleActionKind;
  actionId?: string;
  itemIndex?: number;
  preferredTargetId?: BattleCombatantId;
  attackRange?: AttackRange;
}

export interface BattleActionResources {
  mp: number;
  inventory: readonly Item[];
  economy: BattleActionEconomyState;
  knownSpellIds?: readonly string[];
  knownAbilityIds?: readonly string[];
}

export interface BattleActionEconomyState {
  readonly actorId: BattleCombatantId;
  readonly actionUsed: boolean;
  readonly bonusActionUsed: boolean;
  readonly itemsUsed: number;
}

export interface BattleActionAvailability {
  actionAvailable: boolean;
  bonusActionAvailable: boolean;
  itemsRemaining: number;
}

export interface BattleActionEconomyTransition {
  valid: boolean;
  message: string;
  state: BattleActionEconomyState;
}

export interface BattleActionDescriptor {
  kind: BattleActionKind;
  actionId?: string;
  targetType: TargetType;
  range: AttackRange;
  mpCost: number;
  cost: BattleActionCost;
}

export interface BattleActionPlan {
  readonly actorId: BattleCombatantId;
  readonly kind: BattleActionKind;
  readonly actionId?: string;
  readonly itemIndex?: number;
  readonly targetIds: readonly BattleCombatantId[];
  readonly descriptor: Readonly<BattleActionDescriptor>;
}

export interface BattleActionValidation {
  valid: boolean;
  message: string;
  plan?: BattleActionPlan;
}

export interface BattleActionExecutors<TResult> {
  attack(plan: BattleActionPlan): TResult;
  defend(plan: BattleActionPlan): TResult;
  spell(plan: BattleActionPlan): TResult;
  ability(plan: BattleActionPlan): TResult;
  item(plan: BattleActionPlan): TResult;
}

export interface BattleActionExecution<TResult> {
  result: TResult;
  economy: BattleActionEconomyState;
}

export function createBattleActionEconomy(
  actorId: BattleCombatantId,
): BattleActionEconomyState {
  return Object.freeze({
    actorId,
    actionUsed: false,
    bonusActionUsed: false,
    itemsUsed: 0,
  });
}

export function getBattleActionAvailability(
  economy: BattleActionEconomyState,
): BattleActionAvailability {
  return {
    actionAvailable: !economy.actionUsed,
    bonusActionAvailable: !economy.bonusActionUsed,
    itemsRemaining: Math.max(0, 2 - economy.itemsUsed),
  };
}

export function getLivingBattleActors<T extends BattleCombatantState>(
  combatants: readonly T[],
): T[] {
  return combatants.filter(isCombatantActive);
}

export function getBattleActionDescriptor(
  request: BattleActionRequest,
  resources: BattleActionResources,
): BattleActionDescriptor | undefined {
  if (request.kind === "attack") {
    return {
      kind: "attack",
      targetType: "single_enemy",
      range: request.attackRange ?? "melee",
      mpCost: 0,
      cost: "action",
    };
  }
  if (request.kind === "defend") {
    return {
      kind: "defend",
      targetType: "self",
      range: "melee",
      mpCost: 0,
      cost: "action",
    };
  }
  if (request.kind === "spell") {
    const spell = request.actionId ? getSpell(request.actionId) : undefined;
    if (!spell || spell.type === "utility") return undefined;
    return {
      kind: "spell",
      actionId: spell.id,
      targetType: getSpellTargetType(spell),
      range: "ranged",
      mpCost: spell.mpCost,
      cost: "action",
    };
  }
  if (request.kind === "ability") {
    const ability = request.actionId ? getAbility(request.actionId) : undefined;
    if (!ability || ability.type === "utility") return undefined;
    return {
      kind: "ability",
      actionId: ability.id,
      targetType: getAbilityTargetType(ability),
      range: getAbilityRange(ability),
      mpCost: ability.mpCost,
      cost: ability.bonusAction ? "bonus_action" : "action",
    };
  }

  const item = request.itemIndex !== undefined
    ? resources.inventory[request.itemIndex]
    : undefined;
  if (!item || (request.actionId && request.actionId !== item.id)) {
    return undefined;
  }
  return {
    kind: "item",
    actionId: item.id,
    targetType: getItemTargetType(item),
    range: "ranged",
    mpCost: 0,
    cost: resources.economy.itemsUsed === 0 ? "bonus_action" : "action",
  };
}

function getSingleEnemyCandidates(
  combatants: readonly BattleCombatantState[],
  actor: BattleCombatantState,
  range: AttackRange,
): BattleCombatantState[] {
  const enemies = getLivingBattleActors(combatants).filter(
    (combatant) => combatant.side !== actor.side,
  );
  if (range === "ranged") return enemies;
  const front = enemies.filter((combatant) => combatant.position === "front");
  return front.length > 0
    ? front
    : enemies.filter((combatant) => combatant.position === "back");
}

export function resolveBattleActionTargets(
  combatants: readonly BattleCombatantState[],
  actorId: BattleCombatantId,
  descriptor: BattleActionDescriptor,
  preferredTargetId?: BattleCombatantId,
  random: () => number = Math.random,
): BattleCombatantId[] {
  const actor = getCombatantById([...combatants], actorId);
  if (!actor || !isCombatantActive(actor)) return [];

  if (
    descriptor.targetType === "single"
    || descriptor.targetType === "single_enemy"
  ) {
    const candidates = getSingleEnemyCandidates(
      combatants,
      actor,
      descriptor.range,
    );
    if (preferredTargetId) {
      return candidates.some((candidate) => candidate.id === preferredTargetId)
        ? [preferredTargetId]
        : [];
    }
    return candidates[0] ? [candidates[0].id] : [];
  }

  if (descriptor.targetType === "single_ally") {
    const allies = getLivingBattleActors(combatants).filter(
      (combatant) =>
        combatant.side === actor.side && combatant.id !== actor.id,
    );
    const candidates = allies.length > 0 ? allies : [actor];
    if (preferredTargetId) {
      return candidates.some((candidate) => candidate.id === preferredTargetId)
        ? [preferredTargetId]
        : [];
    }
    return candidates[0] ? [candidates[0].id] : [];
  }

  const targets = getBattleTargetIds(
    [...combatants],
    actorId,
    descriptor.targetType,
    random,
  );
  if (
    preferredTargetId
    && (descriptor.targetType === "self")
    && !targets.includes(preferredTargetId)
  ) {
    return [];
  }
  return targets;
}

function freezePlan(
  request: BattleActionRequest,
  descriptor: BattleActionDescriptor,
  targetIds: BattleCombatantId[],
): BattleActionPlan {
  const frozenDescriptor = Object.freeze({ ...descriptor });
  const frozenTargets = Object.freeze(targetIds.slice());
  return Object.freeze({
    actorId: request.actorId,
    kind: request.kind,
    actionId: descriptor.actionId,
    itemIndex: request.itemIndex,
    targetIds: frozenTargets,
    descriptor: frozenDescriptor,
  });
}

export function validateBattleAction(
  combatants: readonly BattleCombatantState[],
  request: BattleActionRequest,
  resources: BattleActionResources,
  random: () => number = Math.random,
): BattleActionValidation {
  const actor = getCombatantById([...combatants], request.actorId);
  if (!actor || !isCombatantActive(actor)) {
    return { valid: false, message: "Actor is not able to act." };
  }
  if (resources.economy.actorId !== request.actorId) {
    return {
      valid: false,
      message: "Action economy belongs to a different actor.",
    };
  }
  const descriptor = getBattleActionDescriptor(request, resources);
  if (!descriptor) {
    return {
      valid: false,
      message: request.kind === "item"
        ? "Selected item is unavailable."
        : "Unknown or unavailable action.",
    };
  }
  if (
    descriptor.kind === "spell"
    && resources.knownSpellIds
    && !resources.knownSpellIds.includes(descriptor.actionId ?? "")
  ) {
    return { valid: false, message: "Actor does not know that spell." };
  }
  if (
    descriptor.kind === "ability"
    && resources.knownAbilityIds
    && !resources.knownAbilityIds.includes(descriptor.actionId ?? "")
  ) {
    return { valid: false, message: "Actor does not know that ability." };
  }
  if (resources.mp < descriptor.mpCost) {
    return { valid: false, message: "Not enough MP." };
  }
  if (descriptor.cost === "action" && resources.economy.actionUsed) {
    return { valid: false, message: "Turn action is unavailable." };
  }
  if (
    descriptor.cost === "bonus_action"
    && resources.economy.bonusActionUsed
  ) {
    return { valid: false, message: "Actor has no bonus action available." };
  }
  if (request.kind === "item" && resources.economy.itemsUsed >= 2) {
    return { valid: false, message: "Actor cannot use another item this turn." };
  }

  const targetIds = resolveBattleActionTargets(
    combatants,
    request.actorId,
    descriptor,
    request.preferredTargetId,
    random,
  );
  if (targetIds.length === 0) {
    return { valid: false, message: "No valid target for that action." };
  }

  return {
    valid: true,
    message: "Action is valid.",
    plan: freezePlan(request, descriptor, targetIds),
  };
}

export function consumeBattleActionEconomy(
  economy: BattleActionEconomyState,
  plan: BattleActionPlan,
): BattleActionEconomyTransition {
  if (economy.actorId !== plan.actorId) {
    return {
      valid: false,
      message: "Action economy belongs to a different actor.",
      state: economy,
    };
  }
  if (plan.descriptor.cost === "action" && economy.actionUsed) {
    return {
      valid: false,
      message: "Turn action is already consumed.",
      state: economy,
    };
  }
  if (plan.descriptor.cost === "bonus_action" && economy.bonusActionUsed) {
    return {
      valid: false,
      message: "Bonus action is already consumed.",
      state: economy,
    };
  }
  if (plan.kind === "item" && economy.itemsUsed >= 2) {
    return {
      valid: false,
      message: "Item-use limit is already reached.",
      state: economy,
    };
  }

  const state = Object.freeze({
    actorId: economy.actorId,
    actionUsed: economy.actionUsed || plan.descriptor.cost === "action",
    bonusActionUsed:
      economy.bonusActionUsed || plan.descriptor.cost === "bonus_action",
    itemsUsed: economy.itemsUsed + (plan.kind === "item" ? 1 : 0),
  });
  return {
    valid: true,
    message: "Action economy consumed.",
    state,
  };
}

export function executeBattleAction<TResult>(
  plan: BattleActionPlan,
  executors: BattleActionExecutors<TResult>,
): TResult {
  switch (plan.kind) {
    case "attack":
      return executors.attack(plan);
    case "defend":
      return executors.defend(plan);
    case "spell":
      return executors.spell(plan);
    case "ability":
      return executors.ability(plan);
    case "item":
      return executors.item(plan);
  }
}

export function executeBattleActionWithEconomy<TResult>(
  plan: BattleActionPlan,
  economy: BattleActionEconomyState,
  executors: BattleActionExecutors<TResult>,
): BattleActionExecution<TResult> {
  const transition = consumeBattleActionEconomy(economy, plan);
  if (!transition.valid) {
    throw new Error(transition.message);
  }
  return {
    result: executeBattleAction(plan, executors),
    economy: transition.state,
  };
}
