import { describe, expect, it } from "vitest";
import { getItem } from "../src/data/items";
import { getMonster } from "../src/data/monsters";
import type { MonsterEncounter } from "../src/data/monsterGroups";
import {
  createBattleActionEconomy,
  createPlayerBattleActionSource,
} from "../src/systems/battleActions";
import {
  createGroupCombatants,
  createHeroCombatant,
  createPartyCombatant,
  type BattleCombatantState,
} from "../src/systems/groupCombat";
import {
  MAX_GAMBITS_PER_COMPANION,
  createDefaultGambitRule,
  formatGambitRule,
  normalizeGambitRules,
  selectGambitAction,
  type GambitRule,
} from "../src/systems/gambits";
import { createPlayer, type PlayerStats } from "../src/systems/player";

const stats: PlayerStats = {
  strength: 12,
  dexterity: 14,
  constitution: 12,
  intelligence: 14,
  wisdom: 14,
  charisma: 12,
};

function createContext() {
  const heroState = createPlayer("Hero", stats, "cleric");
  heroState.hp = 5;
  heroState.maxHp = 30;
  heroState.mp = 20;
  const companionState = createPlayer("Scout", stats, "ranger");
  companionState.hp = 8;
  companionState.maxHp = 24;
  companionState.mp = 20;
  companionState.knownAbilities.push("rage");
  companionState.inventory.push({ ...getItem("antidote")! });

  const hero = createHeroCombatant(heroState);
  const companion = createPartyCombatant({
    id: "scout",
    name: companionState.name,
    get hp() {
      return companionState.hp;
    },
    set hp(value: number) {
      companionState.hp = value;
    },
    get maxHp() {
      return companionState.maxHp;
    },
    stats: companionState.stats,
    get activeEffects() {
      return companionState.activeEffects;
    },
    set activeEffects(value) {
      companionState.activeEffects = value;
    },
    getArmorClass: () => 13,
  }, "companion");
  const encounter: MonsterEncounter = {
    id: "gambitEncounter",
    name: "Gambit Encounter",
    isGroup: true,
    members: [
      { monster: getMonster("goblin")!, position: "front" },
      { monster: getMonster("wraith")!, position: "back" },
    ],
  };
  const enemies = createGroupCombatants(encounter);
  const actors: BattleCombatantState[] = [hero, companion, ...enemies];
  return {
    heroState,
    companionState,
    hero,
    companion,
    enemies,
    actors,
    sources: [
      createPlayerBattleActionSource(heroState, hero),
      createPlayerBattleActionSource(companionState, companion),
    ],
    economy: createBattleActionEconomy(companion.id),
  };
}

function rule(overrides: Partial<GambitRule> = {}): GambitRule {
  return {
    id: "rule-1",
    rank: 1,
    enabled: true,
    subject: { kind: "anyPartyMember" },
    condition: {
      kind: "resource",
      resource: "hp",
      scale: "percent",
      comparison: "<",
      value: 50,
    },
    action: { kind: "spell", spellId: "cureWounds" },
    target: { kind: "matchedSubject" },
    ...overrides,
  };
}

describe("gambit engine", () => {
  it("creates and formats a structured default rule", () => {
    const created = createDefaultGambitRule("new-rule", 3);
    expect(created.rank).toBe(3);
    expect(formatGambitRule(created)).toBe(
      "if any enemy is alive do attack on matched subject",
    );
  });
  it("uses rank 1 first and binds the lowest matching party member", () => {
    const context = createContext();
    const decision = selectGambitAction(
      [
        rule({ id: "attack", rank: 2, action: { kind: "attack" }, target: { kind: "anyEnemy" } }),
        rule(),
      ],
      {
        actorId: context.companion.id,
        actors: context.actors,
        sources: context.sources,
        economy: context.economy,
      },
    );

    expect(decision.ruleId).toBe("rule-1");
    expect(decision.matchedSubjectId).toBe(context.hero.id);
    expect(decision.plan?.actionId).toBe("cureWounds");
    expect(decision.plan?.targetIds).toEqual([context.hero.id]);
  });

  it("falls through an unaffordable spell without mutating economy", () => {
    const context = createContext();
    context.companionState.mp = 0;
    const decision = selectGambitAction(
      [
        rule(),
        rule({
          id: "attack",
          rank: 2,
          subject: { kind: "anyEnemy" },
          condition: { kind: "state", state: "alive" },
          action: { kind: "attack" },
          target: { kind: "matchedSubject" },
        }),
      ],
      {
        actorId: context.companion.id,
        actors: context.actors,
        sources: context.sources,
        economy: context.economy,
      },
    );

    expect(decision.ruleId).toBe("attack");
    expect(decision.plan?.kind).toBe("attack");
    expect(context.economy.actionUsed).toBe(false);
    expect(decision.trace.some((entry) => entry.includes("Not enough MP"))).toBe(
      true,
    );
  });

  it("keeps an out-of-stock item rule configured but skips it", () => {
    const context = createContext();
    context.companionState.inventory = [];
    const decision = selectGambitAction(
      [
        rule({
          action: { kind: "item", itemId: "antidote" },
        }),
      ],
      {
        actorId: context.companion.id,
        actors: context.actors,
        sources: context.sources,
        economy: context.economy,
      },
    );

    expect(decision.fallback).toBe(true);
    expect(decision.plan?.kind).toBe("attack");
    expect(decision.trace.some((entry) => entry.includes("out of stock"))).toBe(
      true,
    );
  });

  it("skips already-executed rules when continuing after a bonus action", () => {
    const context = createContext();
    const bonusRule = rule({
      id: "rage",
      action: { kind: "ability", abilityId: "rage" },
      subject: { kind: "self" },
      condition: { kind: "state", state: "alive" },
      target: { kind: "self" },
    });
    const mainRule = rule({
      id: "attack",
      rank: 2,
      subject: { kind: "anyEnemy" },
      condition: { kind: "state", state: "alive" },
      action: { kind: "attack" },
      target: { kind: "matchedSubject" },
    });
    const first = selectGambitAction([bonusRule, mainRule], {
      actorId: context.companion.id,
      actors: context.actors,
      sources: context.sources,
      economy: context.economy,
    });
    const consumedEconomy = {
      ...context.economy,
      bonusActionUsed: true,
    };
    const second = selectGambitAction([bonusRule, mainRule], {
      actorId: context.companion.id,
      actors: context.actors,
      sources: context.sources,
      economy: consumedEconomy,
      executedRuleIds: new Set(["rage"]),
    });

    expect(first.ruleId).toBe("rage");
    expect(first.plan?.descriptor.cost).toBe("bonus_action");
    expect(second.ruleId).toBe("attack");
    expect(second.plan?.descriptor.cost).toBe("action");
  });

  it("matches statuses and derived enemy stats deterministically", () => {
    const context = createContext();
    context.heroState.activeEffects.push({
      id: "poison",
      remainingTurns: 2,
      source: "Slime",
    });
    const statusDecision = selectGambitAction(
      [
        rule({
          subject: { kind: "anyPartyMember" },
          condition: { kind: "status", statusId: "poison", present: true },
          action: { kind: "item", itemId: "antidote" },
          target: { kind: "matchedSubject" },
        }),
      ],
      {
        actorId: context.companion.id,
        actors: context.actors,
        sources: context.sources,
        economy: context.economy,
      },
    );
    const statDecision = selectGambitAction(
      [
        rule({
          id: "slow-fast-enemy",
          subject: { kind: "anyEnemy" },
          condition: {
            kind: "stat",
            stat: "dexterity",
            comparison: ">",
            value: 10,
          },
          action: { kind: "attack" },
          target: { kind: "matchedSubject" },
        }),
      ],
      {
        actorId: context.companion.id,
        actors: context.actors,
        sources: context.sources,
        economy: context.economy,
      },
    );

    expect(statusDecision.matchedSubjectId).toBe(context.hero.id);
    expect(statusDecision.plan?.targetIds).toEqual([context.hero.id]);
    expect(statDecision.matchedSubjectId).toBe(context.enemies[1]!.id);
  });

  it("falls back to defend when there is no valid enemy", () => {
    const context = createContext();
    for (const enemy of context.enemies) {
      enemy.currentHp = 0;
      enemy.isAlive = false;
      enemy.isKnockedOut = true;
    }
    const decision = selectGambitAction([], {
      actorId: context.companion.id,
      actors: context.actors,
      sources: context.sources,
      economy: context.economy,
    });

    expect(decision.fallback).toBe(true);
    expect(decision.plan?.kind).toBe("defend");
  });

  it("normalizes, deduplicates, validates, ranks, and caps persisted rules", () => {
    const raw = Array.from({ length: MAX_GAMBITS_PER_COMPANION + 4 }, (_, index) => ({
      ...rule({
        id: index < 2 ? "duplicate" : `rule-${index}`,
        rank: MAX_GAMBITS_PER_COMPANION - index,
      }),
    }));
    raw.push({
      ...rule(),
      id: "bad-spell",
      action: { kind: "spell", spellId: "doesNotExist" },
    });

    const normalized = normalizeGambitRules(raw);
    expect(normalized).toHaveLength(MAX_GAMBITS_PER_COMPANION);
    expect(new Set(normalized.map((entry) => entry.id)).size).toBe(
      normalized.length,
    );
    expect(normalized.map((entry) => entry.rank)).toEqual(
      Array.from(
        { length: MAX_GAMBITS_PER_COMPANION },
        (_, index) => index + 1,
      ),
    );
    expect(
      normalized.some((entry) =>
        entry.action.kind === "spell"
        && entry.action.spellId === "doesNotExist"
      ),
    ).toBe(false);
  });
});
