import { describe, expect, it, vi } from "vitest";
import {
  executeBattleAction,
  executeBattleActionWithEconomy,
  executeValidatedBattleAction,
  createBattleActionEconomy,
  createBattleActionSource,
  createPlayerBattleActionSource,
  consumeBattleActionEconomy,
  getLivingBattleActors,
  validateBattleAction,
  type BattleActionKind,
  type BattleActionResources,
} from "../src/systems/battleActions";
import {
  createGroupCombatants,
  createHeroCombatant,
  createPartyCombatant,
  type BattleCombatantState,
  type PartyCombatant,
} from "../src/systems/groupCombat";
import {
  createPlayer,
  type CombatActorState,
  type PlayerStats,
} from "../src/systems/player";
import type { MonsterEncounter } from "../src/data/monsterGroups";
import { getMonster } from "../src/data/monsters";
import { getItem } from "../src/data/items";

const stats: PlayerStats = {
  strength: 12,
  dexterity: 14,
  constitution: 12,
  intelligence: 14,
  wisdom: 12,
  charisma: 10,
};

function createStateBackedCompanion(
  state: CombatActorState,
  id = "lyra",
): PartyCombatant {
  return createPartyCombatant({
    id,
    name: state.name,
    get hp(): number {
      return state.hp;
    },
    set hp(value: number) {
      state.hp = value;
    },
    get maxHp(): number {
      return state.maxHp;
    },
    stats: state.stats,
    get activeEffects() {
      return state.activeEffects;
    },
    set activeEffects(value) {
      state.activeEffects = value;
    },
    getArmorClass: () => 13,
  }, "companion", "back");
}

function createActors(): {
  actors: BattleCombatantState[];
  heroId: string;
  companionId: string;
  frontEnemyId: string;
  backEnemyId: string;
} {
  const player = createPlayer("Hero", stats);
  const hero = createHeroCombatant(player);
  const companion = createPartyCombatant({
    id: "lyra",
    name: "Lyra",
    hp: 20,
    maxHp: 20,
    stats,
    activeEffects: [],
    getArmorClass: () => 13,
  }, "companion", "back");
  const encounter: MonsterEncounter = {
    id: "gambitTest",
    name: "Gambit Test",
    isGroup: true,
    members: [
      { monster: getMonster("goblin")!, position: "front" },
      { monster: getMonster("wraith")!, position: "back" },
    ],
  };
  const enemies = createGroupCombatants(encounter);
  return {
    actors: [hero, companion, ...enemies],
    heroId: hero.id,
    companionId: companion.id,
    frontEnemyId: enemies[0]!.id,
    backEnemyId: enemies[1]!.id,
  };
}

function resources(
  overrides: Partial<BattleActionResources> = {},
): BattleActionResources {
  return {
    mp: 20,
    inventory: [getItem("potion")!],
    economy: createBattleActionEconomy("party:hero"),
    ...overrides,
  };
}

describe("pure battle action pipeline", () => {
  it("enumerates only living, conscious actors", () => {
    const { actors, companionId } = createActors();
    const companion = actors.find((actor) => actor.id === companionId)!;
    companion.currentHp = 0;

    expect(getLivingBattleActors(actors).map((actor) => actor.id)).not.toContain(
      companionId,
    );
  });

  it("binds a matched target while enforcing melee formation", () => {
    const {
      actors,
      heroId,
      frontEnemyId,
      backEnemyId,
    } = createActors();

    const blocked = validateBattleAction(
      actors,
      {
        actorId: heroId,
        kind: "attack",
        attackRange: "melee",
        preferredTargetId: backEnemyId,
      },
      resources(),
    );
    expect(blocked.valid).toBe(false);
    expect(blocked.message).toContain("target");

    const melee = validateBattleAction(
      actors,
      {
        actorId: heroId,
        kind: "attack",
        attackRange: "melee",
      },
      resources(),
    );
    expect(melee.plan?.targetIds).toEqual([frontEnemyId]);

    const ranged = validateBattleAction(
      actors,
      {
        actorId: heroId,
        kind: "attack",
        attackRange: "ranged",
        preferredTargetId: backEnemyId,
      },
      resources(),
    );
    expect(ranged.plan?.targetIds).toEqual([backEnemyId]);
  });

  it("validates spell MP and binds matched allies or enemy groups", () => {
    const {
      actors,
      heroId,
      companionId,
      frontEnemyId,
      backEnemyId,
    } = createActors();

    const noMp = validateBattleAction(
      actors,
      { actorId: heroId, kind: "spell", actionId: "fireball" },
      resources({ mp: 0 }),
    );
    expect(noMp.valid).toBe(false);
    expect(noMp.message).toContain("MP");

    const fireball = validateBattleAction(
      actors,
      { actorId: heroId, kind: "spell", actionId: "fireball" },
      resources(),
    );
    expect(fireball.plan?.targetIds).toEqual([frontEnemyId, backEnemyId]);

    const heal = validateBattleAction(
      actors,
      {
        actorId: heroId,
        kind: "spell",
        actionId: "cureWounds",
        preferredTargetId: companionId,
      },
      resources(),
    );
    expect(heal.plan?.targetIds).toEqual([companionId]);
  });

  it("validates ability action economy and item inventory", () => {
    const { actors, heroId, companionId } = createActors();

    const noBonus = validateBattleAction(
      actors,
      { actorId: heroId, kind: "ability", actionId: "rage" },
      resources({
        economy: {
          ...createBattleActionEconomy(heroId),
          bonusActionUsed: true,
        },
      }),
    );
    expect(noBonus.valid).toBe(false);
    expect(noBonus.message).toContain("bonus action");

    const missingItem = validateBattleAction(
      actors,
      { actorId: heroId, kind: "item", itemIndex: 3 },
      resources(),
    );
    expect(missingItem.valid).toBe(false);
    expect(missingItem.message).toContain("item");

    const item = validateBattleAction(
      actors,
      {
        actorId: heroId,
        kind: "item",
        itemIndex: 0,
        preferredTargetId: companionId,
      },
      resources(),
    );
    expect(item.valid).toBe(true);
    expect(item.plan?.actionId).toBe("potion");
    expect(item.plan?.targetIds).toEqual([companionId]);
  });

  it("uses consumable target metadata with solo and self-only fallbacks", () => {
    const { actors, heroId, companionId } = createActors();
    const soloActors = actors.filter((actor) => actor.id !== companionId);
    const legacyPotion = { ...getItem("potion")! };
    delete legacyPotion.targetType;

    const soloPotion = validateBattleAction(
      soloActors,
      { actorId: heroId, kind: "item", itemIndex: 0 },
      resources({ inventory: [legacyPotion] }),
    );
    expect(soloPotion.valid).toBe(true);
    expect(soloPotion.plan?.descriptor.targetType).toBe("single_ally");
    expect(soloPotion.plan?.targetIds).toEqual([heroId]);

    const selfOnly = validateBattleAction(
      actors,
      {
        actorId: heroId,
        kind: "item",
        itemIndex: 0,
        preferredTargetId: heroId,
      },
      resources({ inventory: [getItem("chimaeraWing")!] }),
    );
    expect(selfOnly.valid).toBe(true);
    expect(selfOnly.plan?.descriptor.targetType).toBe("self");
    expect(selfOnly.plan?.targetIds).toEqual([heroId]);
  });

  it("validates defend as a frozen self-targeting action", () => {
    const { actors, heroId } = createActors();
    const validation = validateBattleAction(
      actors,
      { actorId: heroId, kind: "defend" },
      resources(),
    );

    expect(validation.valid).toBe(true);
    expect(validation.plan?.targetIds).toEqual([heroId]);
    expect(validation.plan?.descriptor).toMatchObject({
      kind: "defend",
      targetType: "self",
      mpCost: 0,
      cost: "action",
    });
    expect(Object.isFrozen(validation.plan)).toBe(true);
  });

  it("returns frozen plans and dispatches exactly one executor", () => {
    const { actors, heroId } = createActors();
    const kinds: BattleActionKind[] = [
      "attack",
      "spell",
      "ability",
      "item",
      "defend",
    ];

    for (const kind of kinds) {
      const request = kind === "attack"
        ? { actorId: heroId, kind, attackRange: "ranged" as const }
        : kind === "spell"
          ? { actorId: heroId, kind, actionId: "fireBolt" }
          : kind === "ability"
            ? { actorId: heroId, kind, actionId: "shieldBash" }
            : kind === "item"
              ? { actorId: heroId, kind, itemIndex: 0 }
              : { actorId: heroId, kind };
      const validation = validateBattleAction(actors, request, resources());
      expect(validation.valid).toBe(true);
      expect(Object.isFrozen(validation.plan)).toBe(true);
      expect(Object.isFrozen(validation.plan?.targetIds)).toBe(true);

      const attack = vi.fn(() => "attack");
      const spell = vi.fn(() => "spell");
      const ability = vi.fn(() => "ability");
      const item = vi.fn(() => "item");
      const defend = vi.fn(() => "defend");
      const result = executeBattleAction(validation.plan!, {
        attack,
        spell,
        ability,
        item,
        defend,
      });

      expect(result).toBe(kind);
      expect(
        [attack, spell, ability, item, defend].reduce(
          (calls, executor) => calls + executor.mock.calls.length,
          0,
        ),
      ).toBe(1);
    }
  });

  it("consumes one bonus action and still permits one main action", () => {
    const { actors, heroId } = createActors();
    const initial = createBattleActionEconomy(heroId);
    const bonus = validateBattleAction(
      actors,
      { actorId: heroId, kind: "ability", actionId: "rage" },
      resources({ economy: initial }),
    );
    expect(bonus.valid).toBe(true);
    const consumedBonus = consumeBattleActionEconomy(
      initial,
      bonus.plan!,
    );
    expect(consumedBonus.valid).toBe(true);
    expect(consumedBonus.state.actionUsed).toBe(false);
    expect(consumedBonus.state.bonusActionUsed).toBe(true);
    expect(Object.isFrozen(consumedBonus.state)).toBe(true);

    const main = validateBattleAction(
      actors,
      { actorId: heroId, kind: "attack", attackRange: "melee" },
      resources({ economy: consumedBonus.state }),
    );
    expect(main.valid).toBe(true);
    const executors = {
      attack: vi.fn(() => 12),
      spell: vi.fn(() => 0),
      ability: vi.fn(() => 0),
      item: vi.fn(() => 0),
      defend: vi.fn(() => 0),
    };
    const executed = executeBattleActionWithEconomy(
      main.plan!,
      consumedBonus.state,
      executors,
    );
    expect(executed.result).toBe(12);
    expect(executed.economy.actionUsed).toBe(true);
    expect(executed.economy.bonusActionUsed).toBe(true);

    const duplicate = validateBattleAction(
      actors,
      { actorId: heroId, kind: "attack", attackRange: "melee" },
      resources({ economy: executed.economy }),
    );
    expect(duplicate.valid).toBe(false);
    expect(duplicate.message).toContain("action");
  });

  it("consumes defend and rejects duplicate or foreign action economy", () => {
    const { actors, heroId, companionId } = createActors();
    const initial = createBattleActionEconomy(heroId);
    const defend = validateBattleAction(
      actors,
      { actorId: heroId, kind: "defend" },
      resources({ economy: initial }),
    );
    expect(defend.valid).toBe(true);

    const consumed = consumeBattleActionEconomy(initial, defend.plan!);
    expect(consumed.valid).toBe(true);
    expect(consumed.state.actionUsed).toBe(true);
    expect(consumed.state.bonusActionUsed).toBe(false);

    const duplicate = validateBattleAction(
      actors,
      { actorId: heroId, kind: "defend" },
      resources({ economy: consumed.state }),
    );
    expect(duplicate.valid).toBe(false);
    expect(duplicate.message).toContain("action");

    const validation = validateBattleAction(
      actors,
      { actorId: companionId, kind: "defend" },
      resources({ economy: createBattleActionEconomy(heroId) }),
    );

    expect(validation.valid).toBe(false);
    expect(validation.message).toContain("economy");
  });

  it("executes validated generic attack, spell, ability, item, and defend plans", () => {
    const player = createPlayer("Executor", {
      strength: 15,
      dexterity: 14,
      constitution: 14,
      intelligence: 15,
      wisdom: 12,
      charisma: 10,
    }, "wizard");
    player.level = 10;
    player.mp = 100;
    player.maxMp = 100;
    player.hp = 10;
    player.maxHp = 50;
    player.knownSpells.push("fireball");
    player.knownAbilities.push("shieldBash");
    player.inventory.push(getItem("potion")!);
    const hero = createHeroCombatant(player);
    const companionState = createPlayer("Executor Ally", stats);
    companionState.hp = 5;
    companionState.maxHp = 30;
    const companion = createStateBackedCompanion(
      companionState,
      "executorAlly",
    );
    const source = createPlayerBattleActionSource(player, hero);
    const companionSource = createBattleActionSource(
      companion,
      companionState,
    );
    const encounter: MonsterEncounter = {
      id: "executorTest",
      name: "Executor Test",
      isGroup: true,
      members: [
        { monster: getMonster("goblin")!, position: "front" },
        { monster: getMonster("wraith")!, position: "back" },
      ],
    };
    const enemies = createGroupCombatants(encounter);
    const actors: BattleCombatantState[] = [hero, companion, ...enemies];
    const context = {
      combatants: actors,
      enemies,
      sources: [source, companionSource],
    };
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    const attack = validateBattleAction(
      actors,
      {
        actorId: hero.id,
        kind: "attack",
        attackRange: "ranged",
        preferredTargetId: enemies[0]!.id,
      },
      resources({ economy: createBattleActionEconomy(hero.id) }),
    ).plan!;
    const attackHp = enemies[0]!.currentHp;
    const attackResult = executeValidatedBattleAction(source, attack, context);
    expect(attackResult.executed).toBe(true);
    expect(enemies[0]!.currentHp).toBeLessThan(attackHp);

    const spell = validateBattleAction(
      actors,
      { actorId: hero.id, kind: "spell", actionId: "fireball" },
      resources({
        mp: player.mp,
        economy: createBattleActionEconomy(hero.id),
        knownSpellIds: player.knownSpells,
      }),
    ).plan!;
    const mpBeforeSpell = player.mp;
    const spellResult = executeValidatedBattleAction(source, spell, context);
    expect(spellResult.executed).toBe(true);
    expect(player.mp).toBe(mpBeforeSpell - 6);
    expect(spellResult.targets).toHaveLength(2);

    const ability = validateBattleAction(
      actors,
      {
        actorId: hero.id,
        kind: "ability",
        actionId: "shieldBash",
        preferredTargetId: enemies[1]!.id,
      },
      resources({
        mp: player.mp,
        economy: createBattleActionEconomy(hero.id),
        knownAbilityIds: player.knownAbilities,
      }),
    ).plan!;
    const abilityResult = executeValidatedBattleAction(
      source,
      ability,
      context,
    );
    expect(abilityResult.executed).toBe(true);

    const potionIndex = player.inventory.findIndex(
      (item) => item.id === "potion",
    );
    const item = validateBattleAction(
      actors,
      {
        actorId: hero.id,
        kind: "item",
        itemIndex: potionIndex,
        preferredTargetId: companion.id,
      },
      {
        mp: player.mp,
        inventory: player.inventory,
        economy: createBattleActionEconomy(hero.id),
      },
    ).plan!;
    const inventorySize = player.inventory.length;
    const itemResult = executeValidatedBattleAction(source, item, context);
    expect(itemResult.itemUsed).toBe(true);
    expect(itemResult.targets).toEqual([
      expect.objectContaining({
        targetId: companion.id,
        healing: 20,
      }),
    ]);
    expect(companionState.hp).toBe(25);
    expect(player.hp).toBe(10);
    expect(player.inventory).toHaveLength(inventorySize - 1);

    const defend = validateBattleAction(
      actors,
      { actorId: hero.id, kind: "defend" },
      resources({ economy: createBattleActionEconomy(hero.id) }),
    ).plan!;
    const defendResult = executeValidatedBattleAction(source, defend, context);
    expect(defendResult.executed).toBe(true);
    expect(hero.isDefending).toBe(true);
  });

  it("does not consume stale cantrips or redirect stale melee abilities", () => {
    const player = createPlayer("Stale Tester", stats, "knight");
    player.knownSpells.push("fireBolt");
    player.knownAbilities.push("shieldBash");
    const hero = createHeroCombatant(player);
    const source = createPlayerBattleActionSource(player, hero);
    const encounter: MonsterEncounter = {
      id: "staleTargets",
      name: "Stale Targets",
      isGroup: true,
      members: [
        { monster: getMonster("goblin")!, position: "front" },
        { monster: getMonster("wraith")!, position: "back" },
      ],
    };
    const enemies = createGroupCombatants(encounter);
    const actors: BattleCombatantState[] = [hero, ...enemies];
    const context = { combatants: actors, enemies, sources: [source] };

    const spellPlan = validateBattleAction(
      actors,
      {
        actorId: hero.id,
        kind: "spell",
        actionId: "fireBolt",
        preferredTargetId: enemies[0]!.id,
      },
      resources({
        economy: createBattleActionEconomy(hero.id),
        knownSpellIds: player.knownSpells,
      }),
    ).plan!;
    enemies[0]!.currentHp = 0;
    enemies[0]!.isAlive = false;
    enemies[0]!.isKnockedOut = true;
    expect(
      executeValidatedBattleAction(source, spellPlan, context).executed,
    ).toBe(false);

    enemies[0]!.currentHp = enemies[0]!.maxHp;
    enemies[0]!.isAlive = true;
    enemies[0]!.isKnockedOut = false;
    const abilityPlan = validateBattleAction(
      actors,
      {
        actorId: hero.id,
        kind: "ability",
        actionId: "shieldBash",
        preferredTargetId: enemies[0]!.id,
      },
      resources({
        economy: createBattleActionEconomy(hero.id),
        knownAbilityIds: player.knownAbilities,
      }),
    ).plan!;
    enemies[0]!.currentHp = 0;
    enemies[0]!.isAlive = false;
    enemies[0]!.isKnockedOut = true;
    const backHp = enemies[1]!.currentHp;
    expect(
      executeValidatedBattleAction(source, abilityPlan, context).executed,
    ).toBe(false);
    expect(enemies[1]!.currentHp).toBe(backHp);
  });

  it("consumes the actor's antidote while curing a preferred ally", () => {
    const player = createPlayer("Item User", stats);
    player.inventory.push(getItem("antidote")!);
    const hero = createHeroCombatant(player);
    const heroSource = createPlayerBattleActionSource(player, hero);
    const allyState = createPlayer("Lyra", stats);
    allyState.activeEffects.push({
      id: "poison",
      remainingTurns: 3,
      source: "Slime",
    });
    const ally = createPartyCombatant({
      id: "lyra",
      name: allyState.name,
      get hp(): number {
        return allyState.hp;
      },
      set hp(value: number) {
        allyState.hp = value;
      },
      get maxHp(): number {
        return allyState.maxHp;
      },
      stats: allyState.stats,
      get activeEffects() {
        return allyState.activeEffects;
      },
      set activeEffects(value) {
        allyState.activeEffects = value;
      },
      getArmorClass: () => 12,
    }, "companion");
    const allySource = createBattleActionSource(ally, allyState);
    const actors: BattleCombatantState[] = [hero, ally];
    const itemIndex = player.inventory.findIndex(
      (item) => item.id === "antidote",
    );
    const validation = validateBattleAction(
      actors,
      {
        actorId: hero.id,
        kind: "item",
        itemIndex,
        preferredTargetId: ally.id,
      },
      {
        mp: player.mp,
        inventory: player.inventory,
        economy: createBattleActionEconomy(hero.id),
      },
    );

    expect(validation.plan?.targetIds).toEqual([ally.id]);
    const result = executeValidatedBattleAction(
      heroSource,
      validation.plan!,
      {
        combatants: actors,
        enemies: [],
        sources: [heroSource, allySource],
      },
    );

    expect(result.itemUsed).toBe(true);
    expect(result.targets[0]?.targetId).toBe(ally.id);
    expect(allyState.activeEffects).toHaveLength(0);
    expect(player.inventory.some((item) => item.id === "antidote")).toBe(false);
  });
});
