/**
 * Phaser-free action planning for player controls, companion AI, and gambits.
 */

import {
  getAbility,
  getAbilityRange,
  getAbilityTargetType,
} from "../data/abilities";
import type { Element, ElementalInteraction } from "../data/elements";
import { getItemTargetType, type Item } from "../data/items";
import {
  getSpell,
  getSpellTargetType,
  type TargetType,
} from "../data/spells";
import {
  playerAttack,
  playerCastSpellAtTargets,
  playerUseAbility,
  type HealingTarget,
} from "./combat";
import {
  useCombatItem,
  useCombatItemOnTarget,
  type CombatActorState,
  type PlayerState,
} from "./player";
import {
  createHeroCombatant,
  getBattleTargetIds,
  getCombatantById,
  isCombatantActive,
  type AttackRange,
  type BattleCombatantId,
  type BattleCombatantState,
  type GroupCombatant,
  type PartyCombatant,
} from "./groupCombat";

export type BattleActionKind =
  | "attack"
  | "spell"
  | "ability"
  | "item"
  | "defend";
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
  spell(plan: BattleActionPlan): TResult;
  ability(plan: BattleActionPlan): TResult;
  item(plan: BattleActionPlan): TResult;
  defend(plan: BattleActionPlan): TResult;
}

export interface BattleActionExecution<TResult> {
  result: TResult;
  economy: BattleActionEconomyState;
}

export interface BattleActionSource {
  combatant: PartyCombatant;
  state: CombatActorState;
}

export interface BattleActionExecutionContext {
  combatants: BattleCombatantState[];
  enemies: GroupCombatant[];
  sources: BattleActionSource[];
  weatherPenalty?: number;
  getEnemyDefenseBonus?(target: GroupCombatant): number;
  onElementalInteraction?(
    targetId: BattleCombatantId,
    interaction: ElementalInteraction,
    element: Element,
  ): void;
}

export interface ResolvedBattleActionTarget {
  targetId: BattleCombatantId;
  hit: boolean;
  damage: number;
  healing: number;
  elementalLabel?: ElementalInteraction;
}

export interface ResolvedBattleAction {
  executed: boolean;
  message: string;
  plan: BattleActionPlan;
  targets: ResolvedBattleActionTarget[];
  mpUsed: number;
  itemUsed: boolean;
}

export function createBattleActionSource(
  combatant: PartyCombatant,
  state: CombatActorState,
): BattleActionSource {
  if (combatant.side !== "party") {
    throw new Error("Battle action sources must belong to the party side.");
  }
  return { combatant, state };
}

export function createPlayerBattleActionSource(
  player: PlayerState,
  combatant: PartyCombatant = createHeroCombatant(player),
): BattleActionSource {
  return createBattleActionSource(combatant, player);
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
    case "spell":
      return executors.spell(plan);
    case "ability":
      return executors.ability(plan);
    case "item":
      return executors.item(plan);
    case "defend":
      return executors.defend(plan);
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

function resolveEnemyTargets(
  plan: BattleActionPlan,
  context: BattleActionExecutionContext,
): GroupCombatant[] {
  return plan.targetIds.flatMap((targetId) => {
    const target = getCombatantById(context.enemies, targetId);
    return target && isCombatantActive(target) ? [target] : [];
  });
}

function resolveHealingTargets(
  plan: BattleActionPlan,
  context: BattleActionExecutionContext,
): HealingTarget[] {
  return plan.targetIds.flatMap((targetId) => {
    const target = getCombatantById(context.combatants, targetId);
    return target?.side === "party" && isCombatantActive(target)
      ? [target as HealingTarget]
      : [];
  });
}

function recordElementalInteraction(
  context: BattleActionExecutionContext,
  targetId: BattleCombatantId,
  interaction: ElementalInteraction | undefined,
  element: Element | undefined,
): void {
  if (!interaction || !element) return;
  context.onElementalInteraction?.(targetId, interaction, element);
}

/** Execute a previously validated plan using reusable combat mechanics. */
export function executeValidatedBattleAction(
  source: BattleActionSource,
  plan: BattleActionPlan,
  context: BattleActionExecutionContext,
): ResolvedBattleAction {
  if (source.combatant.id !== plan.actorId) {
    return {
      executed: false,
      message: "Action source does not match the validated actor.",
      plan,
      targets: [],
      mpUsed: 0,
      itemUsed: false,
    };
  }
  if (!isCombatantActive(source.combatant)) {
    return {
      executed: false,
      message: "Actor is no longer able to act.",
      plan,
      targets: [],
      mpUsed: 0,
      itemUsed: false,
    };
  }

  if (plan.kind === "defend") {
    source.combatant.isDefending = true;
    return {
      executed: true,
      message: `${source.combatant.label} takes a defensive stance!`,
      plan,
      targets: [{
        targetId: source.combatant.id,
        hit: true,
        damage: 0,
        healing: 0,
      }],
      mpUsed: 0,
      itemUsed: false,
    };
  }

  if (plan.kind === "item") {
    if (plan.itemIndex === undefined) {
      return {
        executed: false,
        message: "Validated item plan has no inventory index.",
        plan,
        targets: [],
        mpUsed: 0,
        itemUsed: false,
      };
    }
    const targetId = plan.targetIds[0];
    const targetSource = targetId === source.combatant.id
      ? source
      : context.sources.find(
          (candidate) => candidate.combatant.id === targetId,
        );
    if (!targetSource) {
      return {
        executed: false,
        message: "Validated item target has no action source.",
        plan,
        targets: [],
        mpUsed: 0,
        itemUsed: false,
      };
    }
    const item = source.state.inventory[plan.itemIndex];
    const result = item?.type === "consumable"
      ? useCombatItemOnTarget(
          source.state,
          plan.itemIndex,
          targetSource.state,
        )
      : useCombatItem(source.state, plan.itemIndex);
    return {
      executed: result.used,
      message: result.message,
      plan,
      targets: [{
        targetId: targetSource.combatant.id,
        hit: result.used,
        damage: 0,
        healing: 0,
      }],
      mpUsed: 0,
      itemUsed: result.used,
    };
  }

  const enemies = resolveEnemyTargets(plan, context);
  const healingTargets = resolveHealingTargets(plan, context);
  if (plan.kind === "attack") {
    const target = enemies[0];
    if (!target) {
      return {
        executed: false,
        message: "Validated attack target is no longer available.",
        plan,
        targets: [],
        mpUsed: 0,
        itemUsed: false,
      };
    }
    const result = playerAttack(
      source.state,
      target.monster,
      (target.isDefending ? 2 : 0)
        + (context.getEnemyDefenseBonus?.(target) ?? 0),
      context.weatherPenalty ?? 0,
      target.effects,
    );
    target.currentHp = Math.max(0, target.currentHp - result.damage);
    if (target.currentHp === 0) {
      target.isAlive = false;
      target.isKnockedOut = true;
    }
    recordElementalInteraction(
      context,
      target.id,
      result.elementalLabel,
      source.state.equippedWeapon?.element,
    );
    return {
      executed: true,
      message: result.message,
      plan,
      targets: [{
        targetId: target.id,
        hit: result.hit,
        damage: result.damage,
        healing: 0,
        elementalLabel: result.elementalLabel,
      }],
      mpUsed: 0,
      itemUsed: false,
    };
  }

  if (plan.kind === "spell") {
    if (!plan.actionId) {
      return {
        executed: false,
        message: "Validated spell plan has no spell ID.",
        plan,
        targets: [],
        mpUsed: 0,
        itemUsed: false,
      };
    }
    const result = playerCastSpellAtTargets(
      source.state,
      plan.actionId,
      enemies.map((target) => ({
        monster: target.monster,
        monsterEffects: target.effects,
        weatherPenalty: context.weatherPenalty ?? 0,
        acPenalty: (target.isDefending ? 2 : 0)
          + (context.getEnemyDefenseBonus?.(target) ?? 0),
      })),
      healingTargets,
    );
    const targets: ResolvedBattleActionTarget[] = [];
    for (const targetResult of result.results) {
      const target = enemies[targetResult.targetIndex];
      if (!target) continue;
      target.currentHp = Math.max(0, target.currentHp - targetResult.damage);
      if (target.currentHp === 0) {
        target.isAlive = false;
        target.isKnockedOut = true;
      }
      recordElementalInteraction(
        context,
        target.id,
        targetResult.elementalLabel,
        getSpell(plan.actionId)?.element,
      );
      targets.push({
        targetId: target.id,
        hit: targetResult.hit,
        damage: targetResult.damage,
        healing: 0,
        elementalLabel: targetResult.elementalLabel,
      });
    }
    for (const healingResult of result.healingResults) {
      targets.push({
        targetId: healingResult.targetId,
        hit: true,
        damage: 0,
        healing: healingResult.healing,
      });
    }
    return {
      executed:
        result.results.length > 0 || result.healingResults.length > 0,
      message: result.message,
      plan,
      targets,
      mpUsed: result.mpUsed,
      itemUsed: false,
    };
  }

  if (!plan.actionId) {
    return {
      executed: false,
      message: "Validated ability plan has no ability ID.",
      plan,
      targets: [],
      mpUsed: 0,
      itemUsed: false,
    };
  }
  const ability = getAbility(plan.actionId);
  const canUseWithoutEnemyTarget = ability?.type === "heal"
    || ability?.type === "buff";
  const target = enemies[0] ?? (
    canUseWithoutEnemyTarget
      ? context.enemies.find(isCombatantActive)
      : undefined
  );
  if (!target) {
    return {
      executed: false,
      message: "No enemy remains for ability resolution.",
      plan,
      targets: [],
      mpUsed: 0,
      itemUsed: false,
    };
  }
  const result = playerUseAbility(
    source.state,
    plan.actionId,
    target.monster,
    (context.weatherPenalty ?? 0)
      + (target.isDefending ? 2 : 0)
      + (context.getEnemyDefenseBonus?.(target) ?? 0),
    target.effects,
    healingTargets,
  );
  target.currentHp = Math.max(0, target.currentHp - result.damage);
  if (target.currentHp === 0) {
    target.isAlive = false;
    target.isKnockedOut = true;
  }
  recordElementalInteraction(
    context,
    target.id,
    result.elementalLabel,
    getAbility(plan.actionId)?.element,
  );
  const targets: ResolvedBattleActionTarget[] = result.damage > 0
    ? [{
        targetId: target.id,
        hit: result.hit,
        damage: result.damage,
        healing: 0,
        elementalLabel: result.elementalLabel,
      }]
    : [];
  for (const healingResult of result.healingResults ?? []) {
    targets.push({
      targetId: healingResult.targetId,
      hit: true,
      damage: 0,
      healing: healingResult.healing,
    });
  }
  return {
    executed: result.mpUsed > 0
      || (ability?.mpCost === 0 && result.hit),
    message: result.message,
    plan,
    targets,
    mpUsed: result.mpUsed,
    itemUsed: false,
  };
}
