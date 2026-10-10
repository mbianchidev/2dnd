import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMonster } from "../src/data/monsters";
import { createSoloEncounter } from "../src/data/monsterGroups";
import { getItem } from "../src/data/items";
import {
  getCampaignDifficultyRules,
  resolveDifficultyRules,
  scaleEnemyDamage,
} from "../src/systems/difficulty";
import {
  attemptFlee,
  monsterAttack,
  monsterUseAbility,
} from "../src/systems/combat";
import {
  createBattleActionEconomy,
  createPlayerBattleActionSource,
  executeBattleActionWithEconomy,
  executeValidatedBattleAction,
  validateBattleAction,
  type BattleActionExecutionContext,
  type BattleActionPlan,
  type ResolvedBattleAction,
} from "../src/systems/battleActions";
import {
  createBattleResult,
  createGroupCombatants,
  createHeroCombatant,
  getFleeDC,
  getMonsterDefendChance,
  recordGroupDefeats,
  resolveBattleRewards,
  selectMonsterTarget,
} from "../src/systems/groupCombat";
import {
  applyPartyDefeat,
  createActivePartyCombatants,
  createPartyActionSources,
  distributePartyVictory,
  recruitCompanion,
} from "../src/systems/party";
import { createDefaultGambitRule, selectGambitAction } from "../src/systems/gambits";
import { applyStatusEffect, processStartOfTurn } from "../src/systems/statusEffects";
import { getEnemyAbilityChance } from "../src/systems/enemyTactics";
import { DIFFICULTY_MODE_CASES, createDifficultyPlayer } from "./difficultyFixtures";
import { createCodex } from "../src/systems/codex";

beforeEach(() => vi.spyOn(Math, "random").mockReturnValue(0.5));
afterEach(() => vi.restoreAllMocks());

describe.each(DIFFICULTY_MODE_CASES)("$name combat authority", ({ selection }) => {
  it("scales boss HP, attacks and abilities once without changing canonical stats", () => {
    const player = createDifficultyPlayer(selection);
    const baselinePlayer = createDifficultyPlayer({ profileId: "standard" });
    player.hp = player.maxHp = baselinePlayer.hp = baselinePlayer.maxHp = 1000;
    const rules = getCampaignDifficultyRules(player);
    const monster = getMonster("cryptLich")!;
    const before = JSON.stringify(monster);
    const enemy = createGroupCombatants(createSoloEncounter(monster), rules)[0]!;
    expect(enemy.maxHp).toBe(Math.max(1, Math.floor(monster.hp * rules.enemyHpMultiplier)));
    expect(enemy.monster.attackBonus).toBe(monster.attackBonus);
    const codex = createCodex();
    recordGroupDefeats(codex, [enemy]);
    expect(codex.entries[monster.id]!.hp).toBe(monster.hp);
    const effects: typeof player.activeEffects = [];
    applyStatusEffect(effects, "slow", "test");
    const baseline = monsterAttack(monster, baselinePlayer, 2, 1, 1, effects, 2, 1);
    const result = monsterAttack(enemy.monster, player, 2, 1, 1, effects, 2, 1);
    expect(result.hit).toBe(true);
    expect(result.attackBonus).toBe(baseline.attackBonus + rules.enemyAccuracyBonus);
    expect(result.damage).toBe(scaleEnemyDamage(baseline.damage, rules));
    expect(player.hp).toBe(1000 - result.damage);

    const ability = getMonster("dragon")!.abilities!.find((entry) => entry.type === "damage")!;
    player.hp = baselinePlayer.hp = 1000;
    const baseAbility = monsterUseAbility(ability, monster, baselinePlayer, effects, 1);
    const scaledAbility = monsterUseAbility(ability, monster, player, effects, 1);
    expect(scaledAbility.damage).toBe(scaleEnemyDamage(baseAbility.damage, rules));
    expect(player.hp).toBe(1000 - scaledAbility.damage);
    expect(JSON.stringify(monster)).toBe(before);
  });

  it("keeps natural attack outcomes and group flee boundaries authoritative", () => {
    const player = createDifficultyPlayer(selection);
    const rules = getCampaignDifficultyRules(player);
    const monster = getMonster("goblin")!;
    vi.mocked(Math.random).mockReturnValue(0);
    expect(monsterAttack(monster, player).hit).toBe(false);
    vi.mocked(Math.random).mockReturnValue(0.95);
    expect(monsterAttack(monster, player).critical).toBe(true);
    vi.mocked(Math.random).mockReturnValue(0.45);
    for (const aliveCount of [1, 2, 3, 4]) {
      const dc = getFleeDC(aliveCount, rules);
      expect(dc).toBe(10 + (aliveCount - 1) * 2 + rules.fleeDcAdjustment);
      expect(attemptFlee(0, aliveCount, rules).success).toBe(10 >= dc);
    }
  });

  it("scales incoming combat DoT once while preserving saving throws and status lifecycle", () => {
    const player = createDifficultyPlayer(selection);
    const effects: typeof player.activeEffects = [];
    applyStatusEffect(effects, "poison", "Test enemy");
    applyStatusEffect(effects, "burn", "Test enemy");
    const baseline = processStartOfTurn(structuredClone(effects), player.stats);
    const rules = getCampaignDifficultyRules(player);
    const adjustDamage = vi.fn((damage: number) => scaleEnemyDamage(damage, rules));
    const scaled = processStartOfTurn(structuredClone(effects), player.stats, { adjustDamage });
    expect(adjustDamage).toHaveBeenCalledTimes(2);
    expect(scaled.tickDamage).toBe(adjustDamage.mock.results.reduce((sum, result) =>
      sum + (result.type === "return" ? result.value : 0), 0));
    expect(scaled.skipTurn).toBe(baseline.skipTurn);
    expect(scaled.messages.filter((message) => message.startsWith("Saved")))
      .toEqual(baseline.messages.filter((message) => message.startsWith("Saved")));
    expect(() => processStartOfTurn(structuredClone(effects), player.stats, {
      adjustDamage: () => -1,
    })).toThrow("non-negative integers");
  });

  it("selects only conscious targets and bounds tactical ability/defend chances", () => {
    const player = createDifficultyPlayer(selection);
    recruitCompanion(player, "guardian");
    recruitCompanion(player, "scout");
    player.hp = player.maxHp = 100;
    const guardian = player.party.companions[0]!;
    const scout = player.party.companions[1]!;
    guardian.hp = 20;
    guardian.maxHp = 50;
    scout.hp = scout.maxHp = 10;
    const actors = [createHeroCombatant(player), ...createActivePartyCombatants(player.party)];
    const rules = getCampaignDifficultyRules(player);
    const random = vi.fn(() => 0.99);
    const target = selectMonsterTarget(actors, random, rules);
    const expected = {
      gentle: actors[0]!.id, standard: actors[2]!.id,
      tactical: actors[1]!.id, relentless: actors[2]!.id,
    }[rules.enemyAiPolicy];
    expect(target?.id).toBe(expected);
    expect(random).toHaveBeenCalledTimes(rules.enemyAiPolicy === "standard" ? 1 : 0);
    actors[1]!.currentHp = actors[2]!.currentHp = 0;
    expect(selectMonsterTarget(actors, () => 0.99, rules)?.id).toBe(actors[0]!.id);
    actors[0]!.currentHp = 0;
    expect(selectMonsterTarget(actors, () => 0.99, rules)).toBeUndefined();

    const monster = getMonster("cryptLich")!;
    const enemies = createGroupCombatants(createSoloEncounter(monster), rules);
    expect(getMonsterDefendChance(undefined, enemies, 0, rules)).toBeGreaterThanOrEqual(0);
    expect(getMonsterDefendChance(undefined, enemies, 0, rules)).toBeLessThanOrEqual(1);
    for (const ability of monster.abilities ?? []) {
      expect(getEnemyAbilityChance(ability, 1, monster.hp, rules)).toBeLessThanOrEqual(1);
      expect(getEnemyAbilityChance(ability, 1, monster.hp, rules)).toBeGreaterThanOrEqual(0);
    }
  });

  it("executes all companion gambits and targeted items through one action/bonus economy", () => {
    vi.mocked(Math.random).mockReturnValue(0.95);
    const player = createDifficultyPlayer(selection);
    for (const id of ["guardian", "scout", "mystic"] as const) recruitCompanion(player, id);
    const hero = createHeroCombatant(player);
    const party = [hero, ...createActivePartyCombatants(player.party)];
    const sources = [
      createPlayerBattleActionSource(player, hero),
      ...createPartyActionSources(player.party, party.slice(1)),
    ];
    const monster = { ...getMonster("goblin")!, hp: 500 };
    const enemies = createGroupCombatants(createSoloEncounter(monster), getCampaignDifficultyRules(player));
    const context: BattleActionExecutionContext = {
      combatants: [...party, ...enemies], enemies, sources,
    };
    for (const source of sources.slice(1)) {
      player.hp = 5;
      source.state.inventory.push({ ...getItem("potion")! });
      const itemIndex = source.state.inventory.length - 1;
      const economy = createBattleActionEconomy(source.combatant.id);
      const itemPlan = validateBattleAction(context.combatants, {
        actorId: source.combatant.id, kind: "item", itemIndex, preferredTargetId: hero.id,
      }, {
        mp: source.state.mp, inventory: source.state.inventory, economy,
      }).plan!;
      const execute = (plan: BattleActionPlan): ResolvedBattleAction =>
        executeValidatedBattleAction(source, plan, context);
      const executors = {
        attack: execute, spell: execute, ability: execute, item: execute, defend: execute,
      };
      const usedItem = executeBattleActionWithEconomy(itemPlan, economy, executors);
      expect(usedItem.result.itemUsed).toBe(true);
      expect(player.hp).toBeGreaterThan(5);
      expect(source.state.inventory).toHaveLength(itemIndex);
      expect(usedItem.economy.bonusActionUsed).toBe(true);
      expect(usedItem.economy.actionUsed).toBe(false);
      const decision = selectGambitAction([createDefaultGambitRule("attack", 1)], {
        actorId: source.combatant.id, actors: context.combatants,
        sources, economy: usedItem.economy,
      });
      expect(decision.plan?.kind).toBe("attack");
      const hpBefore = enemies[0]!.currentHp;
      const attack = executeBattleActionWithEconomy(decision.plan!, usedItem.economy, executors);
      expect(attack.result.executed).toBe(true);
      expect(enemies[0]!.currentHp).toBeLessThan(hpBefore);
      expect(attack.economy.actionUsed).toBe(true);
      expect(attack.economy.bonusActionUsed).toBe(true);
      const inventoryBefore = JSON.stringify(source.state.inventory);
      expect(() => executeBattleActionWithEconomy(decision.plan!, attack.economy, executors))
        .toThrow("already consumed");
      expect(JSON.stringify(source.state.inventory)).toBe(inventoryBefore);
    }
  });

  it("adjusts aggregate rewards before hooks and never scales party XP twice", () => {
    const player = createDifficultyPlayer(selection);
    player.gold = player.xp = 0;
    recruitCompanion(player, "guardian");
    const hero = createHeroCombatant(player);
    const party = [hero, ...createActivePartyCombatants(player.party)];
    const encounter = {
      ...createSoloEncounter(getMonster("goblin")!),
      isGroup: true,
      members: [
        { monster: getMonster("goblin")!, position: "front" as const },
        { monster: getMonster("goblin")!, position: "back" as const },
      ],
    };
    const rules = getCampaignDifficultyRules(player);
    const base = resolveBattleRewards(encounter);
    const hook = vi.fn((reward: { xp: number; gold: number }) => reward);
    const rewards = resolveBattleRewards(encounter, { adjustRewards: hook }, rules);
    expect(hook).toHaveBeenCalledOnce();
    expect(rewards.xp).toBe(Math.floor(base.xp * rules.xpRewardMultiplier));
    expect(rewards.gold).toBe(Math.floor(base.gold * rules.goldRewardMultiplier));
    const result = createBattleResult("victory", party, [], rewards);
    distributePartyVictory(player, result);
    expect(player.gold).toBe(rewards.gold);
    expect(player.xp).toBe(rewards.xp);
    expect(player.party.companions[0]!.xp).toBe(rewards.xp);
    expect(() => resolveBattleRewards(encounter, {
      adjustRewards: () => ({ xp: -1, gold: 0 }),
    }, rules)).toThrow("non-negative");
  });

  it("keeps KO members ineligible for victory XP even when XP loss is disabled", () => {
    const player = createDifficultyPlayer(selection);
    recruitCompanion(player, "guardian");
    const companion = player.party.companions[0]!;
    companion.hp = 0;
    companion.xp = 399;
    companion.pendingLevelUps = 1;
    const result = distributePartyVictory(player, {
      outcome: "victory", defeatedEnemyIds: [],
      survivingPartyIds: ["party:hero", "party:companion:guardian"],
      knockedOutPartyIds: ["party:companion:guardian"],
      rewards: { xp: 100, gold: 10 }, droppedItemIds: [],
    });
    expect(result.xpRecipientIds).toEqual(["party:hero"]);
    const losesXp = getCampaignDifficultyRules(player).defeatXpPenalty === "currentLevel";
    expect(companion.xp).toBe(losesXp ? 0 : 399);
    expect(companion.pendingLevelUps).toBe(losesXp ? 0 : 1);
    expect(result.penalizedIds).toHaveLength(losesXp ? 1 : 0);
  });

  it("returns one exact bounded party-wipe receipt with independent companion recovery", () => {
    const player = createDifficultyPlayer(selection);
    for (const id of ["guardian", "scout", "mystic"] as const) recruitCompanion(player, id);
    const sources = [player, ...player.party.companions];
    for (const actor of sources) {
      actor.hp = 0;
      actor.maxHp = 31;
      actor.maxMp = 9;
      actor.xp = 399;
      actor.pendingLevelUps = 1;
      applyStatusEffect(actor.activeEffects, "poison", "test");
    }
    player.gold = 101;
    const ids = ["party:hero", ...player.party.companions.map((actor) => `party:companion:${actor.id}`)];
    const receipt = applyPartyDefeat(player, [...ids, "party:hero"]);
    const rules = getCampaignDifficultyRules(player);
    expect(receipt.actors).toHaveLength(4);
    expect(receipt.goldAfter).toBe(Math.floor(101 * rules.defeatGoldRetention));
    expect(receipt.goldLost).toBe(101 - receipt.goldAfter);
    for (const [index, actor] of sources.entries()) {
      expect(actor.hp).toBe(Math.floor(31 * rules.defeatRecoveryMultiplier));
      expect(actor.mp).toBe(Math.floor(9 * rules.defeatRecoveryMultiplier));
      expect(actor.activeEffects).toEqual([]);
      expect(receipt.actors[index]!.restoredHp).toBe(actor.hp);
      expect(receipt.actors[index]!.xpLost).toBe(
        rules.defeatXpPenalty === "none" ? 0 : 399,
      );
    }
    expect(player.position.inDungeon).toBe(false);
    expect(player.progression.nautical.sailing).toBe(false);
  });
});

it("does not make full-health tactical healing more likely than a valid attack", () => {
  const ability = {
    name: "Test Heal", type: "heal" as const,
    damageCount: 1, damageDie: 6 as const, chance: 0.5,
  };
  expect(getEnemyAbilityChance(ability, 10, 10, resolveDifficultyRules({ profileId: "standard" })))
    .toBe(0.5);
  expect(getEnemyAbilityChance(ability, 10, 10, resolveDifficultyRules({ profileId: "legendary" })))
    .toBe(0);
});
