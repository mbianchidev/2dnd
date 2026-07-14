import { getAbility } from "../data/abilities";
import {
  isCompanionId,
  type CompanionId,
} from "../data/companions";
import { getItem } from "../data/items";
import { getSpell } from "../data/spells";
import {
  getAttackRangeForWeapon,
  HERO_COMBATANT_ID,
  isCombatantActive,
  type BattleCombatantId,
  type BattleCombatantState,
  type GroupCombatant,
  type PartyCombatant,
} from "./groupCombat";
import {
  validateBattleAction,
  type BattleActionEconomyState,
  type BattleActionPlan,
  type BattleActionRequest,
  type BattleActionSource,
} from "./battleActions";
import {
  isStatusEffectId,
  type StatusEffectId,
} from "./statusEffects";
import type { PlayerStats } from "./player";

export type GambitComparison = "<" | "<=" | "=" | ">=" | ">";

export type GambitSubjectSelector =
  | { kind: "self" }
  | { kind: "hero" }
  | { kind: "anyPartyMember" }
  | { kind: "companion"; companionId: CompanionId }
  | { kind: "anyEnemy" };

export type GambitCondition =
  | {
      kind: "resource";
      resource: "hp" | "mp";
      scale: "absolute" | "percent";
      comparison: GambitComparison;
      value: number;
    }
  | {
      kind: "status";
      statusId: StatusEffectId;
      present: boolean;
    }
  | {
      kind: "state";
      state: "alive" | "knockedOut";
    }
  | {
      kind: "stat";
      stat: keyof PlayerStats;
      comparison: GambitComparison;
      value: number;
    };

export type GambitAction =
  | { kind: "attack" }
  | { kind: "defend" }
  | { kind: "spell"; spellId: string }
  | { kind: "ability"; abilityId: string }
  | { kind: "item"; itemId: string };

export type GambitTargetSelector =
  | { kind: "matchedSubject" }
  | { kind: "self" }
  | { kind: "hero" }
  | { kind: "companion"; companionId: CompanionId }
  | { kind: "lowestHpAlly" }
  | { kind: "highestHpAlly" }
  | { kind: "lowestHpEnemy" }
  | { kind: "highestHpEnemy" }
  | { kind: "anyEnemy" }
  | { kind: "automatic" };

export interface GambitRule {
  id: string;
  rank: number;
  enabled: boolean;
  subject: GambitSubjectSelector;
  condition: GambitCondition;
  action: GambitAction;
  target: GambitTargetSelector;
}

export const MAX_GAMBITS_PER_COMPANION = 12;

export interface GambitSelectionContext {
  actorId: BattleCombatantId;
  actors: BattleCombatantState[];
  sources: BattleActionSource[];
  economy: BattleActionEconomyState;
  executedRuleIds?: ReadonlySet<string>;
  random?: () => number;
}

export interface GambitDecision {
  ruleId?: string;
  matchedSubjectId?: BattleCombatantId;
  plan?: BattleActionPlan;
  fallback: boolean;
  trace: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compare(
  left: number,
  operator: GambitComparison,
  right: number,
): boolean {
  switch (operator) {
    case "<": return left < right;
    case "<=": return left <= right;
    case "=": return left === right;
    case ">=": return left >= right;
    case ">": return left > right;
  }
}

function getActionSource(
  sources: BattleActionSource[],
  actorId: BattleCombatantId,
): BattleActionSource | undefined {
  return sources.find((source) => source.combatant.id === actorId);
}

function getActorStats(actor: BattleCombatantState): PlayerStats {
  if (actor.side === "party") {
    return (actor as PartyCombatant).stats;
  }
  const monster = (actor as GroupCombatant).monster;
  const physical = Math.min(20, 10 + monster.attackBonus);
  const mental = Math.min(18, 10 + Math.floor(monster.attackBonus / 2));
  return {
    strength: physical,
    dexterity: physical,
    constitution: physical,
    intelligence: mental,
    wisdom: mental,
    charisma: mental,
  };
}

function getSubjectCandidates(
  selector: GambitSubjectSelector,
  context: GambitSelectionContext,
): BattleCombatantState[] {
  switch (selector.kind) {
    case "self":
      return context.actors.filter((actor) => actor.id === context.actorId);
    case "hero":
      return context.actors.filter((actor) => actor.id === HERO_COMBATANT_ID);
    case "anyPartyMember":
      return context.actors.filter((actor) => actor.side === "party");
    case "companion":
      return context.actors.filter(
        (actor) => actor.id === `party:companion:${selector.companionId}`,
      );
    case "anyEnemy":
      return context.actors.filter((actor) => actor.side === "enemy");
  }
}

function getResourceValue(
  actor: BattleCombatantState,
  condition: Extract<GambitCondition, { kind: "resource" }>,
  context: GambitSelectionContext,
): number | undefined {
  if (condition.resource === "hp") {
    return condition.scale === "percent"
      ? actor.maxHp > 0 ? (actor.currentHp / actor.maxHp) * 100 : 0
      : actor.currentHp;
  }
  const source = getActionSource(context.sources, actor.id);
  if (!source) return undefined;
  return condition.scale === "percent"
    ? source.state.maxMp > 0
      ? (source.state.mp / source.state.maxMp) * 100
      : 0
    : source.state.mp;
}

function matchesCondition(
  actor: BattleCombatantState,
  condition: GambitCondition,
  context: GambitSelectionContext,
): boolean {
  switch (condition.kind) {
    case "resource": {
      const value = getResourceValue(actor, condition, context);
      return value !== undefined
        && compare(value, condition.comparison, condition.value);
    }
    case "status":
      return actor.effects.some((effect) => effect.id === condition.statusId)
        === condition.present;
    case "state":
      return condition.state === "alive"
        ? isCombatantActive(actor)
        : !isCombatantActive(actor);
    case "stat":
      return compare(
        getActorStats(actor)[condition.stat],
        condition.comparison,
        condition.value,
      );
  }
}

function getConditionMetric(
  actor: BattleCombatantState,
  condition: GambitCondition,
  context: GambitSelectionContext,
): number | undefined {
  if (condition.kind === "resource") {
    return getResourceValue(actor, condition, context);
  }
  if (condition.kind === "stat") {
    return getActorStats(actor)[condition.stat];
  }
  return undefined;
}

function selectMatchedSubject(
  rule: GambitRule,
  context: GambitSelectionContext,
): BattleCombatantState | undefined {
  const candidates = getSubjectCandidates(rule.subject, context)
    .filter((actor) => matchesCondition(actor, rule.condition, context));
  const descending = (
    rule.condition.kind === "resource"
    || rule.condition.kind === "stat"
  ) && (
    rule.condition.comparison === ">"
    || rule.condition.comparison === ">="
  );
  if (
    rule.condition.kind === "resource"
    || rule.condition.kind === "stat"
  ) {
    const originalOrder = new Map(
      context.actors.map((actor, index) => [actor.id, index]),
    );
    candidates.sort((left, right) => {
      const leftMetric = getConditionMetric(left, rule.condition, context) ?? 0;
      const rightMetric = getConditionMetric(right, rule.condition, context) ?? 0;
      if (leftMetric !== rightMetric) {
        return descending
          ? rightMetric - leftMetric
          : leftMetric - rightMetric;
      }
      return (originalOrder.get(left.id) ?? 0)
        - (originalOrder.get(right.id) ?? 0);
    });
  }
  return candidates[0];
}

function getActiveActors(
  context: GambitSelectionContext,
  side: "party" | "enemy",
): BattleCombatantState[] {
  return context.actors.filter(
    (actor) => actor.side === side && isCombatantActive(actor),
  );
}

function selectByHp(
  actors: BattleCombatantState[],
  highest: boolean,
): BattleCombatantState | undefined {
  return actors.reduce<BattleCombatantState | undefined>((selected, actor) => {
    if (!selected) return actor;
    if (actor.currentHp === selected.currentHp) return selected;
    return highest
      ? actor.currentHp > selected.currentHp ? actor : selected
      : actor.currentHp < selected.currentHp ? actor : selected;
  }, undefined);
}

function resolvePreferredTarget(
  selector: GambitTargetSelector,
  matchedSubject: BattleCombatantState,
  context: GambitSelectionContext,
): BattleCombatantId | undefined {
  const actor = context.actors.find((entry) => entry.id === context.actorId);
  switch (selector.kind) {
    case "matchedSubject": return matchedSubject.id;
    case "self": return context.actorId;
    case "hero": return HERO_COMBATANT_ID;
    case "companion": return `party:companion:${selector.companionId}`;
    case "lowestHpAlly":
      return actor
        ? selectByHp(getActiveActors(context, actor.side), false)?.id
        : undefined;
    case "highestHpAlly":
      return actor
        ? selectByHp(getActiveActors(context, actor.side), true)?.id
        : undefined;
    case "lowestHpEnemy":
      return actor
        ? selectByHp(
            getActiveActors(context, actor.side === "party" ? "enemy" : "party"),
            false,
          )?.id
        : undefined;
    case "highestHpEnemy":
      return actor
        ? selectByHp(
            getActiveActors(context, actor.side === "party" ? "enemy" : "party"),
            true,
          )?.id
        : undefined;
    case "anyEnemy":
      return actor
        ? getActiveActors(
            context,
            actor.side === "party" ? "enemy" : "party",
          )[0]?.id
        : undefined;
    case "automatic": return undefined;
  }
}

function createActionRequest(
  rule: GambitRule,
  matchedSubject: BattleCombatantState,
  source: BattleActionSource,
  context: GambitSelectionContext,
): { request?: BattleActionRequest; reason?: string } {
  const preferredTargetId = resolvePreferredTarget(
    rule.target,
    matchedSubject,
    context,
  );
  switch (rule.action.kind) {
    case "attack":
      return {
        request: {
          actorId: context.actorId,
          kind: "attack",
          attackRange: getAttackRangeForWeapon(source.state.equippedWeapon),
          preferredTargetId,
        },
      };
    case "defend":
      return {
        request: {
          actorId: context.actorId,
          kind: "defend",
          preferredTargetId,
        },
      };
    case "spell":
      return {
        request: {
          actorId: context.actorId,
          kind: "spell",
          actionId: rule.action.spellId,
          preferredTargetId,
        },
      };
    case "ability":
      return {
        request: {
          actorId: context.actorId,
          kind: "ability",
          actionId: rule.action.abilityId,
          preferredTargetId,
        },
      };
    case "item": {
      const itemId = rule.action.itemId;
      const itemIndex = source.state.inventory.findIndex(
        (item) => item.id === itemId,
      );
      return itemIndex >= 0
        ? {
            request: {
              actorId: context.actorId,
              kind: "item",
              actionId: itemId,
              itemIndex,
              preferredTargetId,
            },
          }
        : { reason: `${itemId} is out of stock.` };
    }
  }
}

function actionIsApplicable(
  plan: BattleActionPlan,
  context: GambitSelectionContext,
): boolean {
  if (plan.kind === "spell" && plan.actionId) {
    const spell = getSpell(plan.actionId);
    if (spell?.type === "heal") {
      return plan.targetIds.some((targetId) => {
        const target = context.actors.find((actor) => actor.id === targetId);
        return target !== undefined && target.currentHp < target.maxHp;
      });
    }
  }
  if (plan.kind === "ability" && plan.actionId) {
    const ability = getAbility(plan.actionId);
    if (ability?.type === "heal") {
      return plan.targetIds.some((targetId) => {
        const target = context.actors.find((actor) => actor.id === targetId);
        return target !== undefined && target.currentHp < target.maxHp;
      });
    }
    const effectId = ability?.selfEffect ?? ability?.targetEffect;
    if (effectId) {
      return plan.targetIds.some((targetId) => {
        const target = context.actors.find((actor) => actor.id === targetId);
        return target !== undefined
          && !target.effects.some((effect) => effect.id === effectId);
      });
    }
  }
  return true;
}

function getResources(
  source: BattleActionSource,
  economy: BattleActionEconomyState,
) {
  return {
    mp: source.state.mp,
    inventory: source.state.inventory,
    economy,
    knownSpellIds: source.state.knownSpells,
    knownAbilityIds: source.state.knownAbilities,
  };
}

function createFallbackDecision(
  context: GambitSelectionContext,
  source: BattleActionSource,
  trace: string[],
): GambitDecision {
  const resources = getResources(source, context.economy);
  const attack = validateBattleAction(
    context.actors,
    {
      actorId: context.actorId,
      kind: "attack",
      attackRange: getAttackRangeForWeapon(source.state.equippedWeapon),
    },
    resources,
    context.random,
  );
  if (attack.plan) {
    return {
      plan: attack.plan,
      fallback: true,
      trace: [...trace, "Fallback: basic attack."],
    };
  }
  const defend = validateBattleAction(
    context.actors,
    { actorId: context.actorId, kind: "defend" },
    resources,
    context.random,
  );
  return {
    plan: defend.plan,
    fallback: true,
    trace: [
      ...trace,
      defend.plan
        ? "Fallback: defend."
        : `No fallback action: ${defend.message}`,
    ],
  };
}

export function selectGambitAction(
  rules: GambitRule[],
  context: GambitSelectionContext,
): GambitDecision {
  const source = getActionSource(context.sources, context.actorId);
  if (!source) {
    return {
      fallback: true,
      trace: ["No action source for gambit actor."],
    };
  }
  const executedRuleIds = context.executedRuleIds ?? new Set<string>();
  const trace: string[] = [];
  const ordered = rules
    .filter((rule) => rule.enabled)
    .slice()
    .sort((left, right) => left.rank - right.rank);

  for (const rule of ordered) {
    if (executedRuleIds.has(rule.id)) {
      trace.push(`${rule.id}: already executed this turn.`);
      continue;
    }
    const matchedSubject = selectMatchedSubject(rule, context);
    if (!matchedSubject) {
      trace.push(`${rule.id}: condition did not match.`);
      continue;
    }
    const requestResult = createActionRequest(
      rule,
      matchedSubject,
      source,
      context,
    );
    if (!requestResult.request) {
      trace.push(`${rule.id}: ${requestResult.reason ?? "invalid action"}`);
      continue;
    }
    const validation = validateBattleAction(
      context.actors,
      requestResult.request,
      getResources(source, context.economy),
      context.random,
    );
    if (!validation.plan) {
      trace.push(`${rule.id}: ${validation.message}`);
      continue;
    }
    if (!actionIsApplicable(validation.plan, context)) {
      trace.push(`${rule.id}: action has no applicable effect.`);
      continue;
    }
    return {
      ruleId: rule.id,
      matchedSubjectId: matchedSubject.id,
      plan: validation.plan,
      fallback: false,
      trace,
    };
  }
  return createFallbackDecision(context, source, trace);
}

function normalizeSubject(value: unknown): GambitSubjectSelector | undefined {
  if (!isRecord(value) || typeof value["kind"] !== "string") return undefined;
  switch (value["kind"]) {
    case "self":
    case "hero":
    case "anyPartyMember":
    case "anyEnemy":
      return { kind: value["kind"] };
    case "companion":
      return isCompanionId(value["companionId"])
        ? { kind: "companion", companionId: value["companionId"] }
        : undefined;
    default:
      return undefined;
  }
}

function isComparison(value: unknown): value is GambitComparison {
  return value === "<"
    || value === "<="
    || value === "="
    || value === ">="
    || value === ">";
}

function normalizeCondition(value: unknown): GambitCondition | undefined {
  if (!isRecord(value) || typeof value["kind"] !== "string") return undefined;
  if (value["kind"] === "resource") {
    return (
      (value["resource"] === "hp" || value["resource"] === "mp")
      && (value["scale"] === "absolute" || value["scale"] === "percent")
      && isComparison(value["comparison"])
      && typeof value["value"] === "number"
      && Number.isFinite(value["value"])
    ) ? {
      kind: "resource",
      resource: value["resource"],
      scale: value["scale"],
      comparison: value["comparison"],
      value: value["value"],
    } : undefined;
  }
  if (value["kind"] === "status") {
    return isStatusEffectId(value["statusId"])
      && typeof value["present"] === "boolean"
      ? {
          kind: "status",
          statusId: value["statusId"],
          present: value["present"],
        }
      : undefined;
  }
  if (value["kind"] === "state") {
    return value["state"] === "alive" || value["state"] === "knockedOut"
      ? { kind: "state", state: value["state"] }
      : undefined;
  }
  if (value["kind"] === "stat") {
    const stat = value["stat"];
    return (
      (
        stat === "strength"
        || stat === "dexterity"
        || stat === "constitution"
        || stat === "intelligence"
        || stat === "wisdom"
        || stat === "charisma"
      )
      && isComparison(value["comparison"])
      && typeof value["value"] === "number"
      && Number.isFinite(value["value"])
    ) ? {
      kind: "stat",
      stat,
      comparison: value["comparison"],
      value: value["value"],
    } : undefined;
  }
  return undefined;
}

function normalizeAction(value: unknown): GambitAction | undefined {
  if (!isRecord(value) || typeof value["kind"] !== "string") return undefined;
  switch (value["kind"]) {
    case "attack": return { kind: "attack" };
    case "defend": return { kind: "defend" };
    case "spell":
      return typeof value["spellId"] === "string"
        && getSpell(value["spellId"]) !== undefined
        ? { kind: "spell", spellId: value["spellId"] }
        : undefined;
    case "ability":
      return typeof value["abilityId"] === "string"
        && getAbility(value["abilityId"]) !== undefined
        ? { kind: "ability", abilityId: value["abilityId"] }
        : undefined;
    case "item":
      return typeof value["itemId"] === "string"
        && getItem(value["itemId"]) !== undefined
        ? { kind: "item", itemId: value["itemId"] }
        : undefined;
    default:
      return undefined;
  }
}

function normalizeTarget(value: unknown): GambitTargetSelector | undefined {
  if (!isRecord(value) || typeof value["kind"] !== "string") return undefined;
  switch (value["kind"]) {
    case "matchedSubject":
    case "self":
    case "hero":
    case "lowestHpAlly":
    case "highestHpAlly":
    case "lowestHpEnemy":
    case "highestHpEnemy":
    case "anyEnemy":
    case "automatic":
      return { kind: value["kind"] };
    case "companion":
      return isCompanionId(value["companionId"])
        ? { kind: "companion", companionId: value["companionId"] }
        : undefined;
    default:
      return undefined;
  }
}

export function normalizeGambitRules(value: unknown): GambitRule[] {
  if (!Array.isArray(value)) return [];
  const rules = value.flatMap((candidate, index) => {
    if (!isRecord(candidate)) return [];
    const id = typeof candidate["id"] === "string"
      && candidate["id"].trim().length > 0
      ? candidate["id"].trim()
      : undefined;
    const subject = normalizeSubject(candidate["subject"]);
    const condition = normalizeCondition(candidate["condition"]);
    const action = normalizeAction(candidate["action"]);
    const target = normalizeTarget(candidate["target"]);
    if (!id || !subject || !condition || !action || !target) return [];
    return [{
      rule: {
        id,
        rank: typeof candidate["rank"] === "number"
          && Number.isInteger(candidate["rank"])
          ? candidate["rank"]
          : index + 1,
        enabled: candidate["enabled"] !== false,
        subject,
        condition,
        action,
        target,
      },
      index,
    }];
  });
  rules.sort((left, right) =>
    left.rule.rank - right.rule.rank || left.index - right.index
  );
  const seen = new Set<string>();
  return rules
    .filter(({ rule }) => {
      if (seen.has(rule.id)) return false;
      seen.add(rule.id);
      return true;
    })
    .slice(0, MAX_GAMBITS_PER_COMPANION)
    .map(({ rule }, index) => ({ ...rule, rank: index + 1 }));
}
