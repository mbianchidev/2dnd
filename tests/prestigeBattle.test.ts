import { afterEach, describe, expect, it, vi } from "vitest";
import { getAbility } from "../src/data/abilities";
import { Element } from "../src/data/elements";
import { ITEMS } from "../src/data/items";
import { getMonster } from "../src/data/monsters";
import { PRESTIGE_PATHS } from "../src/data/prestige";
import { getSpell } from "../src/data/spells";
import {
  consumeBattleActionEconomy, createBattleActionEconomy, createPlayerBattleActionSource,
  executeValidatedBattleAction, validateBattleAction,
  type BattleActionEconomyState, type BattleActionResources,
} from "../src/systems/battleActions";
import { getAvailableProgressionGrants } from "../src/systems/classProgression";
import { playerUseAbility } from "../src/systems/combat";
import { playerCastSpellAtTargets } from "../src/systems/combat";
import { abilityModifier } from "../src/systems/dice";
import { getProficiencyBonus } from "../src/systems/classProgression";
import { getTalentAttackBonus } from "../src/data/talents";
import { createGroupCombatants } from "../src/systems/groupCombat";
import { selectGambitAction, type GambitRule } from "../src/systems/gambits";
import { createActivePartyCombatants, createCompanionState, createPartyActionSources } from "../src/systems/party";
import { awardXP, processPendingLevelUps, xpForLevel, type PlayerState } from "../src/systems/player";
import { advancePrestige, prestigeFixture } from "./helpers/prestige";

afterEach(() => vi.restoreAllMocks());

function battle(player: PlayerState) {
  const shield = ITEMS.find((item) => item.type === "shield");
  if (!shield) throw new Error("Missing shield fixture");
  player.inventory.push({ ...shield });
  player.equippedShield = player.inventory[player.inventory.length - 1]!;
  player.hp = 1;
  const companion = createCompanionState("mystic", player.level);
  companion.hp = 1;
  player.party.companions = [companion];
  player.party.activeCompanionIds = ["mystic"];
  const source = createPlayerBattleActionSource(player);
  const companions = createActivePartyCombatants(player.party);
  const sources = [source, ...createPartyActionSources(player.party, companions)];
  const monster = getMonster("goblin");
  if (!monster) throw new Error("Missing enemy fixture");
  const enemies = createGroupCombatants({
    id: "prestigeBattleFixture", name: "Mock prestige encounter", isGroup: true,
    members: [
      { monster: { ...monster, hp: 500, ac: 1 }, position: "front" },
      { monster: { ...monster, hp: 500, ac: 1 }, position: "front" },
      { monster: { ...monster, hp: 500, ac: 1 }, position: "back" },
    ],
  });
  const context = { combatants: [source.combatant, ...companions, ...enemies], enemies, sources };
  const resources = (economy: BattleActionEconomyState): BattleActionResources => ({
    mp: player.mp, inventory: player.inventory, knownSpellIds: player.knownSpells,
    knownAbilityIds: player.knownAbilities, actorState: player, economy,
  });
  return { source, companions, sources, enemies, context, resources };
}

describe.each(PRESTIGE_PATHS.map((path) => [path.pathId] as const))("%s shared actions", (id) => {
  it("executes each earned action with one MP charge and the declared economy/targets", () => {
    const hero = prestigeFixture(id);
    for (let rank = 1; rank <= 5; rank++) advancePrestige(hero, id);
    const path = PRESTIGE_PATHS.find((entry) => entry.pathId === id)!;
    for (const grant of path.grants.filter((entry) => entry.kind !== "talent")) {
      const state = battle(hero);
      hero.mp = hero.maxMp;
      hero.activeEffects = [];
      const initial = createBattleActionEconomy(state.source.combatant.id);
      const request = {
        actorId: initial.actorId, kind: grant.kind === "spell" ? "spell" as const : "ability" as const,
        actionId: grant.id,
      };
      const validated = validateBattleAction(state.context.combatants, request, state.resources(initial));
      if (!validated.plan) throw new Error(validated.message);
      const mp = hero.mp;
      const action = executeValidatedBattleAction(state.source, validated.plan, state.context);
      expect(action.executed, grant.id).toBe(true);
      expect(hero.mp).toBe(mp - validated.plan.descriptor.mpCost);
      const economy = consumeBattleActionEconomy(initial, validated.plan);
      expect(economy.valid).toBe(true);
      expect(economy.state.actionUsed).toBe(validated.plan.descriptor.cost === "action");
      expect(economy.state.bonusActionUsed).toBe(validated.plan.descriptor.cost === "bonus_action");
      const before = structuredClone(hero);
      expect(validateBattleAction(state.context.combatants, request, state.resources(economy.state)).valid).toBe(false);
      expect(hero).toEqual(before);
      if (grant.kind === "spell") {
        const target = getSpell(grant.id)?.targetType;
        expect(action.targets).toHaveLength(target === "all_enemies" ? 3
          : target === "front_row_enemies" || target === "all_party" ? 2 : 1);
      }
    }
  });

  it("cannot execute unowned or unaffordable path actions, including a companion gambit", () => {
    const hero = prestigeFixture(id);
    const state = battle(hero);
    const grant = PRESTIGE_PATHS.find((entry) => entry.pathId === id)!.grants[0]!;
    const request = {
      actorId: state.source.combatant.id,
      kind: grant.kind === "spell" ? "spell" as const : "ability" as const, actionId: grant.id,
    };
    const economy = createBattleActionEconomy(request.actorId);
    const before = structuredClone(hero);
    expect(validateBattleAction(state.context.combatants, request, state.resources(economy)).valid).toBe(false);
    expect(hero).toEqual(before);
    advancePrestige(hero, id);
    hero.mp = 0;
    expect(validateBattleAction(state.context.combatants, request, state.resources(economy)).valid).toBe(false);
    const companionSource = state.sources[1]!;
    const rule: GambitRule = {
      id: "mockUnownedPrestige", rank: 1, enabled: true, subject: { kind: "anyEnemy" },
      condition: { kind: "state", state: "alive" },
      action: grant.kind === "spell" ? { kind: "spell", spellId: grant.id }
        : { kind: "ability", abilityId: grant.id },
      target: { kind: "anyEnemy" },
    };
    const decision = selectGambitAction([rule], {
      actorId: companionSource.combatant.id, actors: state.context.combatants, sources: state.sources,
      economy: createBattleActionEconomy(companionSource.combatant.id), random: () => 0.5,
    });
    expect(decision.plan?.kind).toBe("attack");
    expect(decision.ruleId).toBeUndefined();
  });

  it("trades away real base progression instead of dominating its complete five-rank window", () => {
    const hero = prestigeFixture(id);
    const base = structuredClone(hero);
    for (let rank = 1; rank <= 5; rank++) advancePrestige(hero, id);
    awardXP(base, xpForLevel(11) - base.xp);
    processPendingLevelUps(base);
    expect(hero.level).toBe(base.level);
    const ordinary = getAvailableProgressionGrants(base);
    const specialized = getAvailableProgressionGrants(hero);
    const lost = (["spells", "abilities", "talents"] as const).flatMap((kind) =>
      ordinary[kind].filter((feature) => !specialized[kind].includes(feature)));
    expect(lost.length).toBeGreaterThan(0);
    expect(hero.classProgression.classLevels).not.toEqual(base.classProgression.classLevels);
    const path = PRESTIGE_PATHS.find((entry) => entry.pathId === id)!;
    expect(path.equipmentPermissions).toEqual([]);
    for (const grant of path.grants) {
      if (grant.kind === "talent") continue;
      const action = grant.kind === "spell" ? getSpell(grant.id)! : getAbility(grant.id)!;
      expect(action.mpCost).toBeGreaterThan(0);
      expect(action.mpCost).toBeLessThanOrEqual(9);
    }
  });
});

describe("gear, formation, affinities and status boundaries", () => {
  it.each([0, 0.999, 0.5])("preserves natural rolls and the fixed caster modifier at random %s", (random) => {
    const hero = prestigeFixture("prismScribe");
    advancePrestige(hero, "prismScribe");
    hero.stats.strength = 30;
    hero.stats.intelligence = 13;
    vi.spyOn(Math, "random").mockReturnValue(random);
    const state = battle(hero);
    const result = playerCastSpellAtTargets(hero, "prismNeedle", [{
      monster: { ...state.enemies[0]!.monster, ac: random === 0.999 ? 100 : 1 },
      monsterEffects: [], weatherPenalty: 0,
    }]);
    expect(result.results[0]?.spellMod).toBe(abilityModifier(13)
      + getProficiencyBonus(hero) + getTalentAttackBonus(hero.knownTalents));
    if (random === 0) expect(result.hit).toBe(false);
    if (random === 0.999) {
      expect(result.results[0]?.roll).toBe(20);
      expect(result.hit).toBe(true);
    }
    expect(result.mpUsed).toBe(5);
  });

  it("retains critical dice for a natural20 prestige martial attack", () => {
    const hero = prestigeFixture("roadglassBulwark");
    for (let rank = 1; rank <= 5; rank++) advancePrestige(hero, "roadglassBulwark");
    const state = battle(hero);
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const result = playerUseAbility(hero, "roadglassCrash", { ...state.enemies[0]!.monster, ac: 100 });
    expect(result.roll).toBe(20);
    expect(result.critical).toBe(true);
    expect(result.hit).toBe(true);
    expect(result.damage).toBeGreaterThanOrEqual(3 * 8 * 2);
  });

  it("selects the lower natural roll under disadvantage before a critical and applies elemental resistance", () => {
    const hero = prestigeFixture("prismScribe");
    advancePrestige(hero, "prismScribe");
    hero.activeEffects = [{ id: "frightened", remainingTurns: 2, source: "mock" }];
    const monster = getMonster("goblin")!;
    vi.spyOn(Math, "random").mockReturnValueOnce(0.999).mockReturnValueOnce(0).mockReturnValue(0.5);
    const miss = playerCastSpellAtTargets(hero, "prismNeedle", [{
      monster: { ...monster, ac: 1 }, monsterEffects: [], weatherPenalty: 0,
    }]);
    expect(miss.hit).toBe(false);
    expect(miss.results[0]?.roll).toBe(1);
    hero.activeEffects = [];
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const cast = (resistant: boolean) => playerCastSpellAtTargets(hero, "prismNeedle", [{
      monster: { ...monster, ac: 1, elementalProfile: resistant ? { resistances: [Element.Force] } : undefined },
      monsterEffects: [], weatherPenalty: 0,
    }]);
    const neutral = cast(false);
    const resistance = cast(true);
    expect(resistance.results[0]?.damage).toBe(Math.floor((neutral.results[0]?.damage ?? 0) / 2));
  });

  it.each(["roadglassBrace", "waylineStrike", "foldedShade", "threadcut", "steelCadence"])(
    "%s rejects missing/stale gear in planner, executor and raw compatibility resolver",
    (abilityId) => {
      const path = PRESTIGE_PATHS.find((entry) => entry.grants.some((grant) => grant.id === abilityId))!;
      const hero = prestigeFixture(path.pathId);
      for (let rank = 1; rank <= 5; rank++) advancePrestige(hero, path.pathId);
      const state = battle(hero);
      const economy = createBattleActionEconomy(state.source.combatant.id);
      const request = { actorId: economy.actorId, kind: "ability" as const, actionId: abilityId };
      const plan = validateBattleAction(state.context.combatants, request, state.resources(economy)).plan;
      expect(plan).toBeDefined();
      hero.equippedShield = null;
      hero.equippedWeapon = null;
      const before = structuredClone(hero);
      expect(validateBattleAction(state.context.combatants, request, state.resources(economy)).valid).toBe(false);
      if (!plan) throw new Error("Missing fixture plan");
      expect(executeValidatedBattleAction(state.source, plan, state.context).executed).toBe(false);
      expect(playerUseAbility(hero, abilityId, state.enemies[0]!.monster).mpUsed).toBe(0);
      expect(hero).toEqual(before);
    },
  );

  it("keeps elemental results independent and spends one spell cost for the front row", () => {
    const hero = prestigeFixture("prismScribe");
    for (let rank = 1; rank <= 3; rank++) advancePrestige(hero, "prismScribe");
    const state = battle(hero);
    state.enemies[0]!.monster = {
      ...state.enemies[0]!.monster, elementalProfile: { immunities: [Element.Lightning] },
    };
    state.enemies[1]!.monster = {
      ...state.enemies[1]!.monster, elementalProfile: { weaknesses: [Element.Lightning] },
    };
    const economy = createBattleActionEconomy(state.source.combatant.id);
    const plan = validateBattleAction(state.context.combatants, {
      actorId: economy.actorId, kind: "spell", actionId: "prismFan",
    }, state.resources(economy)).plan;
    if (!plan) throw new Error("Missing AoE fixture plan");
    const mp = hero.mp;
    const result = executeValidatedBattleAction(state.source, plan, state.context);
    expect(result.targets).toHaveLength(2);
    expect(result.targets[0]?.damage).toBe(0);
    expect(result.targets[1]?.damage).toBeGreaterThan(0);
    expect(state.enemies[2]!.currentHp).toBe(500);
    expect(hero.mp).toBe(mp - 7);
  });

  it("shares one bonus slot and refreshes the canonical stance without duplicate effects", () => {
    const hero = prestigeFixture("duskthreadCourier");
    for (let rank = 1; rank <= 3; rank++) advancePrestige(hero, "duskthreadCourier");
    const state = battle(hero);
    const initial = createBattleActionEconomy(state.source.combatant.id);
    const plan = validateBattleAction(state.context.combatants, {
      actorId: initial.actorId, kind: "ability", actionId: "foldedShade",
    }, state.resources(initial)).plan;
    if (!plan) throw new Error("Missing stance fixture plan");
    executeValidatedBattleAction(state.source, plan, state.context);
    const spent = consumeBattleActionEconomy(initial, plan).state;
    expect(validateBattleAction(state.context.combatants, {
      actorId: initial.actorId, kind: "ability", actionId: "sneakStance",
    }, state.resources(spent)).valid).toBe(false);
    const next = createBattleActionEconomy(initial.actorId);
    const repeat = validateBattleAction(state.context.combatants, {
      actorId: next.actorId, kind: "ability", actionId: "foldedShade",
    }, state.resources(next)).plan;
    if (!repeat) throw new Error("Missing next-turn stance plan");
    executeValidatedBattleAction(state.source, repeat, state.context);
    expect(hero.activeEffects.filter((effect) => effect.id === "sneakStance")).toHaveLength(1);
    expect(consumeBattleActionEconomy(next, repeat).state.actionUsed).toBe(false);
  });
});
