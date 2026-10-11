import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PhysicalDamageType,
  applyPhysicalModifier,
} from "../src/data/damageTypes";
import { getBodyPart, getTargetableBodyParts, MONSTER_SIZES } from "../src/data/anatomy";
import { Element } from "../src/data/elements";
import { getAbilityPhysicalDamageType } from "../src/data/abilities";
import { ITEMS, getItem, getWeaponPhysicalDamageType } from "../src/data/items";
import { ALL_MONSTERS, getMonster, type Monster } from "../src/data/monsters";
import { createSoloEncounter } from "../src/data/monsterGroups";
import {
  playerAttack, playerOffHandAttack, playerUseAbility, playerCastSpellAtTargets,
} from "../src/systems/combat";
import { createPlayer, type PlayerState } from "../src/systems/player";
import { createGroupCombatants, createHeroCombatant } from "../src/systems/groupCombat";
import {
  createBattleActionEconomy, createPlayerBattleActionSource,
  consumeBattleActionEconomy, executeValidatedBattleAction, validateBattleAction,
} from "../src/systems/battleActions";
import {
  applyStatusEffect, getEffectDamageModifier, processEndOfTurn,
} from "../src/systems/statusEffects";

const { Bludgeoning, Slashing, Piercing } = PhysicalDamageType;

function createActor(): PlayerState {
  const actor = createPlayer("Combat fixture", {
    strength: 14, dexterity: 14, constitution: 12,
    intelligence: 12, wisdom: 12, charisma: 10,
  });
  actor.stats.strength = 14;
  actor.knownTalents = [];
  actor.hp = actor.maxHp = 100;
  actor.mp = actor.maxMp = 100;
  actor.equippedWeapon = { ...getItem("startMace")!, effect: 0 };
  return actor;
}

function createTarget(overrides: Partial<Monster> = {}): Monster {
  return {
    ...getMonster("goblin")!, hp: 100, ac: 1,
    physicalProfile: undefined, elementalProfile: undefined, ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("physical damage profiles", () => {
  it("uses immunity, weakness, floored resistance, and neutral precedence", () => {
    expect(applyPhysicalModifier(9, Bludgeoning, { weaknesses: [Bludgeoning] }))
      .toEqual({ damage: 18, interaction: "weak" });
    expect(applyPhysicalModifier(9, Piercing, { resistances: [Piercing] }))
      .toEqual({ damage: 4, interaction: "resistant" });
    expect(applyPhysicalModifier(9, Slashing, {
      immunities: [Slashing], weaknesses: [Slashing], resistances: [Slashing],
    })).toEqual({ damage: 0, interaction: "immune" });
    expect(applyPhysicalModifier(9, undefined, { resistances: [Piercing] }))
      .toEqual({ damage: 9, interaction: "" });
  });

  it("replaces a matching whole-body affinity locally without stacking or bypassing immunity", () => {
    const local = { weaknesses: [Piercing] };
    expect(applyPhysicalModifier(9, Piercing, { resistances: [Piercing] }, local))
      .toEqual({ damage: 18, interaction: "weak" });
    expect(applyPhysicalModifier(9, Piercing, { weaknesses: [Piercing] }, local).damage)
      .toBe(18);
    expect(applyPhysicalModifier(9, Piercing, { immunities: [Piercing] }, local).damage)
      .toBe(0);
    expect(applyPhysicalModifier(9, Slashing, { resistances: [Slashing] }, local).damage)
      .toBe(4);
  });

  it("classifies every canonical weapon and preserves explicit and legacy custom types", () => {
    for (const item of ITEMS.filter((entry) => entry.type === "weapon")) {
      expect(Object.values(PhysicalDamageType), item.id).toContain(item.physicalDamageType);
    }
    expect(getWeaponPhysicalDamageType(getItem("startMace"))).toBe(Bludgeoning);
    expect(getWeaponPhysicalDamageType(getItem("startSword"))).toBe(Slashing);
    expect(getWeaponPhysicalDamageType(getItem("startBow"))).toBe(Piercing);
    expect(getWeaponPhysicalDamageType(getItem("startRapier"))).toBe(Piercing);
    expect(getWeaponPhysicalDamageType({
      ...getItem("startRapier")!, physicalDamageType: undefined,
    })).toBe(Piercing);
    expect(getWeaponPhysicalDamageType({
      ...getItem("startSword")!, id: "mockCustomWeapon", physicalDamageType: Piercing,
    })).toBe(Piercing);
    expect(getWeaponPhysicalDamageType(undefined)).toBe(Bludgeoning);
    expect(getAbilityPhysicalDamageType("shieldBash", getItem("startSword"))).toBe(Bludgeoning);
    expect(getAbilityPhysicalDamageType("aimedShot", getItem("startMace"))).toBe(Piercing);
    expect(getAbilityPhysicalDamageType("sneakAttack", getItem("startSword"))).toBe(Slashing);
    expect(getAbilityPhysicalDamageType("smite", getItem("startSword"))).toBeUndefined();
  });
});

describe("D&D-sized monster anatomy", () => {
  it("gives humanoid forms and Large+ anatomical creatures parts, not small beasts or oozes", () => {
    expect(getTargetableBodyParts(getMonster("goblin")!).map((part) => part.id))
      .toEqual(["head", "body", "arms", "legs"]);
    expect(getTargetableBodyParts(getMonster("giantRat")!)).toEqual([]);
    expect(getTargetableBodyParts(getMonster("slime")!)).toEqual([]);
    expect(getTargetableBodyParts(getMonster("wraith")!)).toEqual([]);
    expect(getTargetableBodyParts(getMonster("dragon")!).map((part) => part.id))
      .toContain("wings");
    expect(getTargetableBodyParts(getMonster("kraken")!).map((part) => part.id))
      .toContain("tentacles");
    expect(getMonster("dragon")!.size).toBe("large");
    expect(getMonster("kraken")!.size).toBe("gargantuan");
    expect(getMonster("swampHydra")!.size).toBe("huge");
  });

  it("keeps every roster size, physical profile, part ID, aim penalty and anchor valid", () => {
    for (const monster of ALL_MONSTERS) {
      expect(MONSTER_SIZES, monster.id).toContain(monster.size);
      const parts = getTargetableBodyParts(monster);
      expect(new Set(parts.map((part) => part.id)).size, monster.id).toBe(parts.length);
      for (const part of parts) {
        expect(getBodyPart(monster, part.id)).toBe(part);
        expect(part.aimPenalty).toBeGreaterThanOrEqual(0);
        expect(part.anchor.x).toBeGreaterThanOrEqual(0);
        expect(part.anchor.x).toBeLessThanOrEqual(1);
        expect(part.anchor.y).toBeGreaterThanOrEqual(0);
        expect(part.anchor.y).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("canonical physical and aimed attacks", () => {
  it("keeps the actual pool, status-before-physical-before-element ordering and RNG sequence", () => {
    const actor = createActor();
    actor.equippedWeapon!.element = Element.Fire;
    applyStatusEffect(actor.activeEffects, "slow", "Fixture");
    const random = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.5).mockReturnValueOnce(0.7).mockReturnValueOnce(0.25);
    const result = playerAttack(actor, createTarget({
      physicalProfile: { weaknesses: [Bludgeoning] },
      elementalProfile: { resistances: [Element.Fire] },
    }));
    expect(result).toMatchObject({
      hit: true, damage: 5, physicalType: Bludgeoning,
      physicalLabel: "weak", elementalLabel: "resistant",
      damageRoll: {
        roll: { naturalRolls: [5], modifier: 0, total: 5 },
        adjustments: [
          { label: "Bludgeoning weakness x2", amount: 10 },
          { label: "Fire resistance /2 (floor)", amount: 5 },
        ],
        amount: 5,
      },
    });
    expect(random).toHaveBeenCalledTimes(2);
  });

  it("aims at shared HP, applies a temporary limb effect, and never mutates definitions", () => {
    const actor = createActor();
    const monster = createTarget();
    const before = JSON.stringify(monster);
    const effects: PlayerState["activeEffects"] = [];
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const normal = playerAttack(actor, monster);
    const aimed = playerAttack(actor, monster, 0, 0, effects, "arms");
    expect(aimed.attackMod).toBe(normal.attackMod - getBodyPart(monster, "arms")!.aimPenalty);
    expect(aimed).toMatchObject({ bodyPartId: "arms", hit: true, damage: 6 });
    expect(effects).toEqual([{ id: "weakened", remainingTurns: 2, source: actor.name }]);
    expect(getEffectDamageModifier(effects)).toBe(-2);
    processEndOfTurn(effects);
    expect(effects[0]!.remainingTurns).toBe(1);
    processEndOfTurn(effects);
    expect(effects).toEqual([]);
    expect(JSON.stringify(monster)).toBe(before);
  });

  it("uses the off-hand weapon type and leaves misses and immune hits without limb debuffs", () => {
    const actor = createActor();
    actor.equippedOffHand = { ...getItem("startDagger")! };
    const effects: PlayerState["activeEffects"] = [];
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const offHand = playerOffHandAttack(actor, createTarget(), 0, 0, effects, "head");
    expect(offHand.physicalType).toBe(Piercing);
    expect(offHand.physicalLabel).toBe("weak");
    expect(effects[0]!.id).toBe("confused");
    effects.length = 0;
    random.mockReturnValue(0);
    expect(playerAttack(actor, createTarget(), 0, 0, effects, "arms").hit).toBe(false);
    expect(effects).toEqual([]);
    random.mockReturnValue(0.999);
    const immune = playerAttack(actor, createTarget({
      physicalProfile: { immunities: [Bludgeoning] },
    }), 0, 0, effects, "arms");
    expect(immune).toMatchObject({ critical: true, damage: 0, physicalLabel: "immune" });
    expect(effects).toEqual([]);
  });

  it("bases aimed criticals and fumbles on the selected disadvantage natural", () => {
    const actor = createActor();
    applyStatusEffect(actor.activeEffects, "prone", "Fixture");
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.999).mockReturnValueOnce(0)
      .mockReturnValueOnce(0.999).mockReturnValueOnce(0.999)
      .mockReturnValue(0.5);
    expect(playerAttack(actor, createTarget(), 0, 0, [], "head"))
      .toMatchObject({ hit: false, fumble: true, critical: false, damage: 0 });
    const critical = playerAttack(actor, createTarget(), 0, 0, [], "head");
    expect(critical).toMatchObject({ hit: true, critical: true });
    expect(critical.damageRoll?.roll?.naturalRolls).toHaveLength(2);
  });

  it("rejects unsupported anatomy before rolling or spending and leaves magic whole-target", () => {
    const actor = createActor();
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(() => playerAttack(actor, getMonster("slime")!, 0, 0, [], "head"))
      .toThrow(/body part/i);
    expect(random).not.toHaveBeenCalled();
    const invalid = playerUseAbility(actor, "smite", createTarget(), 0, [], undefined, "head");
    expect(invalid).toMatchObject({ hit: false, mpUsed: 0 });
    expect(actor.mp).toBe(100);
    const result = playerCastSpellAtTargets(actor, "magicMissile", [{
      monster: createTarget({ physicalProfile: { immunities: [Bludgeoning, Slashing, Piercing] } }),
    }]);
    expect(result.results[0]).toMatchObject({ hit: true, autoHit: true });
    expect(result.results[0]!.damage).toBeGreaterThan(0);
    expect(result.results[0]!.physicalLabel).toBeUndefined();
  });

  it("aims physical abilities with their own type and spends MP once", () => {
    const actor = createActor();
    const effects: PlayerState["activeEffects"] = [];
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const result = playerUseAbility(actor, "aimedShot", createTarget(), 0, effects, undefined, "head");
    expect(result).toMatchObject({
      hit: true, damage: 12, mpUsed: 2,
      physicalType: Piercing, physicalLabel: "weak", bodyPartId: "head",
    });
    expect(result.damageRoll?.roll?.naturalRolls).toEqual([6]);
    expect(effects).toEqual([{ id: "confused", remainingTurns: 2, source: actor.name }]);
    expect(actor.mp).toBe(98);
    expect(random).toHaveBeenCalledTimes(2);
  });
});

describe("aimed action validation and execution", () => {
  it("rejects a stale weapon type or a range that bypasses equipped melee formation", () => {
    const player = createActor();
    const hero = createHeroCombatant(player);
    const enemies = createGroupCombatants(createSoloEncounter(createTarget()));
    const actors = [hero, ...enemies];
    const resources = {
      mp: player.mp, inventory: player.inventory,
      economy: createBattleActionEconomy(hero.id), actorState: player,
    };
    const request = {
      actorId: hero.id, kind: "attack" as const,
      preferredTargetId: enemies[0]!.id, bodyPartId: "head" as const,
    };
    expect(validateBattleAction(actors, { ...request, attackRange: "ranged" }, resources).valid).toBe(false);
    const plan = validateBattleAction(actors, request, resources).plan!;
    player.equippedWeapon = { ...getItem("startSword")! };
    const source = createPlayerBattleActionSource(player, hero);
    const random = vi.spyOn(Math, "random");
    expect(executeValidatedBattleAction(source, plan, {
      combatants: actors, enemies, sources: [source],
    })).toMatchObject({ executed: false, mpUsed: 0, itemUsed: false });
    expect(random).not.toHaveBeenCalled();
    expect(enemies[0]!.currentHp).toBe(enemies[0]!.maxHp);
  });

  it("binds one stable target and part, consumes one action, and keeps duplicate enemies independent", () => {
    const player = createActor();
    const hero = createHeroCombatant(player);
    const monster = createTarget();
    const enemies = createGroupCombatants({
      id: "aimedDuplicates", name: "Aimed duplicates", isGroup: true,
      members: [
        { monster, position: "front" }, { monster, position: "front" },
      ],
    });
    const economy = createBattleActionEconomy(hero.id);
    const validation = validateBattleAction([hero, ...enemies], {
      actorId: hero.id, kind: "attack", preferredTargetId: enemies[1]!.id, bodyPartId: "arms",
    }, { mp: player.mp, inventory: player.inventory, economy, actorState: player });
    expect(validation.valid).toBe(true);
    expect(validation.plan?.bodyPartId).toBe("arms");
    expect(Object.isFrozen(validation.plan)).toBe(true);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const source = createPlayerBattleActionSource(player, hero);
    const result = executeValidatedBattleAction(source, validation.plan!, {
      combatants: [hero, ...enemies], enemies, sources: [source],
    });
    expect(result.executed).toBe(true);
    expect(enemies[0]!.currentHp).toBe(monster.hp);
    expect(enemies[0]!.effects).toEqual([]);
    expect(enemies[1]!.currentHp).toBe(monster.hp - 6);
    expect(enemies[1]!.effects[0]!.id).toBe("weakened");
    expect(consumeBattleActionEconomy(economy, validation.plan!).state.actionUsed).toBe(true);
    expect(consumeBattleActionEconomy(economy, validation.plan!).state.bonusActionUsed).toBe(false);
  });

  it("rejects invalid parts, nonphysical actions, protected rows, and stale targets before mutation", () => {
    const player = createActor();
    const hero = createHeroCombatant(player);
    const enemies = createGroupCombatants({
      id: "aimedFormation", name: "Aimed formation", isGroup: true,
      members: [
        { monster: createTarget(), position: "front" },
        { monster: createTarget(), position: "back" },
      ],
    });
    const actors = [hero, ...enemies];
    const economy = createBattleActionEconomy(hero.id);
    const resources = {
      mp: player.mp, inventory: player.inventory, economy, actorState: player,
    };
    for (const request of [
      { kind: "attack", bodyPartId: "wings" },
      { kind: "spell", actionId: "magicMissile", bodyPartId: "head" },
      { kind: "defend", bodyPartId: "head" },
    ] as const) {
      expect(validateBattleAction(actors, {
        actorId: hero.id, preferredTargetId: enemies[0]!.id, ...request,
      }, resources).valid).toBe(false);
    }
    expect(validateBattleAction(actors, {
      actorId: hero.id, kind: "attack", preferredTargetId: enemies[1]!.id, bodyPartId: "head",
    }, resources).valid).toBe(false);
    const plan = validateBattleAction(actors, {
      actorId: hero.id, kind: "attack", preferredTargetId: enemies[0]!.id, bodyPartId: "head",
    }, resources).plan!;
    enemies[0]!.monster = getMonster("slime")!;
    const source = createPlayerBattleActionSource(player, hero);
    const random = vi.spyOn(Math, "random");
    const result = executeValidatedBattleAction(source, plan, {
      combatants: actors, enemies, sources: [source],
    });
    expect(result.executed).toBe(false);
    expect(random).not.toHaveBeenCalled();
    expect(player.mp).toBe(100);
    expect(economy.actionUsed).toBe(false);
    expect(enemies[0]!.effects).toEqual([]);
  });
});
