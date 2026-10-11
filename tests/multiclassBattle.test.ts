import { afterEach, describe, expect, it, vi } from "vitest";
import { getAbility } from "../src/data/abilities";
import { getMonster } from "../src/data/monsters";
import { getSpell } from "../src/data/spells";
import { MAIN_QUEST_ID } from "../src/data/quests";
import { PLAYER_CLASSES } from "../src/systems/classes";
import {
  commitHeroLevelUp, prepareHeroLevelUp,
} from "../src/systems/classProgression";
import {
  consumeBattleActionEconomy,
  createBattleActionEconomy,
  createPlayerBattleActionSource,
  executeValidatedBattleAction,
  validateBattleAction,
  type BattleActionEconomyState,
  type BattleActionRequest,
} from "../src/systems/battleActions";
import { createGroupCombatants } from "../src/systems/groupCombat";
import { awardXP, createPlayer, getSpellModifier, xpForLevel, type PlayerState } from "../src/systems/player";
import {
  createActivePartyCombatants, createPartyActionSources, recruitCompanion,
} from "../src/systems/party";
import type { BaseClassId } from "../src/data/classProgression";
import { selectGambitAction, type GambitRule } from "../src/systems/gambits";

const stats = {
  strength: 15, dexterity: 15, constitution: 14,
  intelligence: 15, wisdom: 15, charisma: 15,
};

function advance(player: PlayerState, id: BaseClassId): void {
  awardXP(player, Math.max(0, xpForLevel(player.level + 1) - player.xp));
  const prepared = prepareHeroLevelUp(player, () => 0.5);
  if (!prepared.ok) throw new Error(prepared.message);
  const result = commitHeroLevelUp(player, { trackId: id, expectedTotalLevel: player.level });
  if (!result.ok) throw new Error(result.message);
}

function battle(player: PlayerState) {
  const source = createPlayerBattleActionSource(player);
  const enemies = createGroupCombatants({
    id: "multiclassFixture", name: "Fixture encounter", isGroup: false,
    members: [{ monster: { ...getMonster("goblin")!, hp: 200, ac: 1 }, position: "front" }],
  });
  const companions = createActivePartyCombatants(player.party);
  const sources = [source, ...createPartyActionSources(player.party, companions)];
  const context = { combatants: [source.combatant, ...companions, ...enemies], enemies, sources };
  const resources = (economy: BattleActionEconomyState) => ({
    economy, mp: player.mp, inventory: player.inventory,
    knownSpellIds: player.knownSpells, knownAbilityIds: player.knownAbilities,
  });
  return { source, enemies, companions, sources, context, resources };
}

afterEach(() => vi.restoreAllMocks());

describe("multiclass battle integration", () => {
  it.each(PLAYER_CLASSES)("executes every legal next-class combination starting from $id", (starting) => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    for (const next of PLAYER_CLASSES) {
      const player = createPlayer("Battle fixture", stats, starting.id);
      advance(player, next.id);
      const state = battle(player);
      const spellId = next.spells.find((id) =>
        player.knownSpells.includes(id) && getSpell(id)?.type === "damage");
      const abilityId = next.abilities.find((id) =>
        player.knownAbilities.includes(id) && getAbility(id)?.type === "damage");
      const request: BattleActionRequest = {
        actorId: state.source.combatant.id,
        kind: spellId ? "spell" : "ability",
        actionId: spellId ?? abilityId,
      };
      const economy = createBattleActionEconomy(request.actorId);
      const validation = validateBattleAction(state.context.combatants, request, state.resources(economy));
      if (!validation.plan) throw new Error(validation.message);
      const mp = player.mp;
      const executed = executeValidatedBattleAction(state.source, validation.plan, state.context);
      expect(executed.executed).toBe(true);
      expect(executed.targets[0]?.damage).toBeGreaterThan(0);
      expect(player.mp).toBe(mp - validation.plan.descriptor.mpCost);
      const spent = consumeBattleActionEconomy(economy, validation.plan);
      expect(spent.valid).toBe(true);
      const hp = state.enemies[0]!.currentHp;
      const duplicate = validateBattleAction(state.context.combatants, request, state.resources(spent.state));
      expect(duplicate.valid).toBe(false);
      expect(player.mp).toBe(mp - validation.plan.descriptor.mpCost);
      expect(state.enemies[0]!.currentHp).toBe(hp);
    }
  });

  it("uses the spell's eligible caster stat rather than martial appearance", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const player = createPlayer("Casting fixture", stats);
    advance(player, "wizard");
    expect(player.appearanceId).toBe("knight");
    expect(getSpellModifier(player, "fireBolt")).toBe(4);
    const state = battle(player);
    const validation = validateBattleAction(state.context.combatants, {
      actorId: state.source.combatant.id, kind: "spell", actionId: "fireBolt",
    }, state.resources(createBattleActionEconomy(state.source.combatant.id)));
    if (!validation.plan) throw new Error(validation.message);
    const executed = executeValidatedBattleAction(state.source, validation.plan, state.context);
    expect(executed.executed).toBe(true);
    expect(executed.targets[0]?.hit).toBe(true);
  });

  it("keeps one shared bonus-action slot across distinct class abilities", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const player = createPlayer("Economy fixture", stats, "rogue");
    advance(player, "rogue");
    advance(player, "rogue");
    advance(player, "bard");
    player.hp = 1;
    const state = battle(player);
    const initial = createBattleActionEconomy(state.source.combatant.id);
    const bonus = validateBattleAction(state.context.combatants, {
      actorId: initial.actorId, kind: "ability", actionId: "sneakStance",
    }, state.resources(initial));
    if (!bonus.plan) throw new Error(bonus.message);
    expect(executeValidatedBattleAction(state.source, bonus.plan, state.context).executed).toBe(true);
    const spent = consumeBattleActionEconomy(initial, bonus.plan);
    const mp = player.mp;
    const secondBonus = validateBattleAction(state.context.combatants, {
      actorId: initial.actorId, kind: "ability", actionId: "bardicInspiration",
    }, state.resources(spent.state));
    expect(secondBonus.valid).toBe(false);
    expect(player.hp).toBe(1);
    expect(player.mp).toBe(mp);
    const main = validateBattleAction(state.context.combatants, {
      actorId: initial.actorId, kind: "spell", actionId: "viciousMockery",
    }, state.resources(spent.state));
    if (!main.plan) throw new Error(main.message);
    expect(executeValidatedBattleAction(state.source, main.plan, state.context).executed).toBe(true);
  });

  it("heals independent single-class companions through the same concrete action sources", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const player = createPlayer("Party fixture", stats, "wizard");
    advance(player, "paladin");
    const companion = recruitCompanion(player, "scout").companion;
    if (!companion) throw new Error("Cannot create companion fixture");
    companion.hp = 1;
    const state = battle(player);
    const plan = validateBattleAction(state.context.combatants, {
      actorId: state.source.combatant.id, kind: "spell", actionId: "cureWounds",
      preferredTargetId: state.companions[0]!.id,
    }, state.resources(createBattleActionEconomy(state.source.combatant.id)));
    if (!plan.plan) throw new Error(plan.message);
    const mp = player.mp;
    expect(executeValidatedBattleAction(state.source, plan.plan, state.context).executed).toBe(true);
    expect(companion.hp).toBe(6);
    expect(player.mp).toBe(mp - 2);
    expect("classProgression" in companion).toBe(false);
    expect(companion.appearanceId).toBe("ranger");
  });

  it("rejects unlearned and stale-knowledge actions before consuming resources", () => {
    const player = createPlayer("Knowledge fixture", stats);
    advance(player, "wizard");
    const state = battle(player);
    const economy = createBattleActionEconomy(state.source.combatant.id);
    expect(validateBattleAction(state.context.combatants, {
      actorId: economy.actorId, kind: "spell", actionId: "fireball",
    }, state.resources(economy)).valid).toBe(false);
    const valid = validateBattleAction(state.context.combatants, {
      actorId: economy.actorId, kind: "spell", actionId: "fireBolt",
    }, state.resources(economy));
    if (!valid.plan) throw new Error(valid.message);
    player.knownSpells = [];
    const mp = player.mp;
    const hp = state.enemies[0]!.currentHp;
    expect(executeValidatedBattleAction(state.source, valid.plan, state.context).executed).toBe(false);
    expect(player.mp).toBe(mp);
    expect(state.enemies[0]!.currentHp).toBe(hp);
  });

  it("lets single-class gambits heal a multiclass hero through live snapshots", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const player = createPlayer("Gambit fixture", stats);
    advance(player, "wizard");
    const companion = recruitCompanion(player, "mystic").companion;
    if (!companion) throw new Error("Cannot recruit fixture healer");
    player.hp = 1;
    const state = battle(player);
    const healer = state.sources[1]!;
    const rule: GambitRule = {
      id: "fixtureHeal", rank: 1, enabled: true,
      subject: { kind: "hero" },
      condition: { kind: "resource", resource: "hp", scale: "percent", comparison: "<", value: 50 },
      action: { kind: "spell", spellId: "cureWounds" },
      target: { kind: "matchedSubject" },
    };
    const decision = selectGambitAction([rule], {
      actorId: healer.combatant.id, actors: state.context.combatants,
      sources: state.sources, economy: createBattleActionEconomy(healer.combatant.id),
    });
    if (!decision.plan) throw new Error(decision.trace.join("\n"));
    const mp = companion.mp;
    expect(executeValidatedBattleAction(healer, decision.plan, state.context).executed).toBe(true);
    expect(player.hp).toBe(6);
    expect(companion.mp).toBe(mp - 2);
    expect(companion.appearanceId).toBe("cleric");
    expect("classProgression" in companion).toBe(false);
  });

  it("does not mutate campaign, party recruitment, inventory or gold authority", () => {
    const player = createPlayer("Authority fixture", stats);
    const progression = structuredClone(player.progression);
    const gold = player.gold;
    const weapon = player.equippedWeapon;
    advance(player, "wizard");
    advance(player, "cleric");
    expect(player.progression).toEqual(progression);
    expect(player.progression.quests.quests[MAIN_QUEST_ID].status).toBe("active");
    expect(player.party.companions).toEqual([]);
    expect(player.gold).toBe(gold);
    expect(player.inventory).toEqual([weapon]);
    expect(player.equippedWeapon).toBe(weapon);
  });
});
