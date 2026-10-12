import { afterEach, describe, expect, it, vi } from "vitest";
import { PhysicalDamageType } from "../src/data/damageTypes";
import {
  ITEMS, getArmorPhysicalProfile, getItem, getItemDescription,
} from "../src/data/items";
import { Element } from "../src/data/elements";
import { ALL_MONSTERS, getMonster, type Monster, type MonsterAbility } from "../src/data/monsters";
import {
  monsterAttack, monsterAttackTarget, monsterUseAbility, monsterUseAbilityTarget,
} from "../src/systems/combat";
import { createHeroCombatant } from "../src/systems/groupCombat";
import { createActivePartyCombatants, recruitCompanion } from "../src/systems/party";
import { createPlayer, getArmorClass, type PlayerState } from "../src/systems/player";
import { applyStatusEffect } from "../src/systems/statusEffects";
import { rollD20 } from "../src/systems/dice";
import { createCombatDicePresentation } from "../src/systems/dicePresentation";
import { triggerDungeonTrap } from "../src/systems/traps";
import type { DungeonTrap, TrapType } from "../src/data/traps";

const { Bludgeoning, Slashing, Piercing } = PhysicalDamageType;
const ARMOR_EXPECTATIONS = [
  ["leatherArmor", [Bludgeoning]],
  ["chainMail", [Slashing]],
  ["plateArmor", [Slashing, Piercing]],
  ["frostWardMail", [Bludgeoning, Slashing]],
  ["shadowCloak", [Piercing]],
  ["tundraPelt", [Bludgeoning]],
  ["swampMantle", [Slashing]],
] as const;

function actor(): PlayerState {
  const player = createPlayer("Armor fixture", {
    strength: 12, dexterity: 12, constitution: 12,
    intelligence: 12, wisdom: 12, charisma: 10,
  });
  player.hp = player.maxHp = 100;
  player.mp = player.maxMp = 50;
  player.equippedArmor = null;
  player.equippedShield = null;
  player.activeEffects = [];
  return player;
}

function attacker(type: PhysicalDamageType = Slashing): Monster {
  return {
    ...getMonster("goblin")!, damageCount: 1, damageDie: 10,
    attackBonus: 30, physicalDamageType: type,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("canonical armor defenses", () => {
  it("gives every body armor declared type-specific defenses without changing AC", () => {
    expect(ITEMS.filter((item) => item.type === "armor").map((item) => item.id).sort())
      .toEqual(ARMOR_EXPECTATIONS.map(([id]) => id).sort());
    for (const [id, resistances] of ARMOR_EXPECTATIONS) {
      const armor = getItem(id)!;
      expect(armor.physicalResistances).toEqual([...resistances]);
      expect(getArmorPhysicalProfile(armor)).toEqual({ resistances: [...resistances] });
      const player = actor();
      const bareAC = getArmorClass(player);
      player.equippedArmor = armor;
      expect(getArmorClass(player)).toBe(bareAC + armor.effect);
      for (const type of resistances) expect(getItemDescription(armor)).toContain(type.charAt(0).toUpperCase() + type.slice(1));
    }
  });

  it("resolves old canonical copies without rewriting metadata and leaves shields or bare actors neutral", () => {
    const old = { ...getItem("chainMail")! };
    delete old.physicalResistances;
    const before = structuredClone(old);
    expect(getArmorPhysicalProfile(old)).toEqual({ resistances: [Slashing] });
    expect(old).toEqual(before);
    expect(getArmorPhysicalProfile(getItem("woodenShield"))).toBeUndefined();
    expect(getArmorPhysicalProfile(null)).toBeUndefined();
    expect(getArmorPhysicalProfile({
      ...getItem("chainMail")!, physicalResistances: [],
    })).toEqual({ resistances: [] });
  });

  it("declares basic attack types for the full roster and meaningful physical ability overrides", () => {
    for (const monster of ALL_MONSTERS) {
      expect(Object.values(PhysicalDamageType), monster.id).toContain(monster.physicalDamageType);
    }
    expect(getMonster("goblin")!.physicalDamageType).toBe(Slashing);
    expect(getMonster("wolf")!.physicalDamageType).toBe(Piercing);
    expect(getMonster("stoneGolem")!.physicalDamageType).toBe(Bludgeoning);
    expect(getMonster("dragon")!.abilities?.find((ability) => ability.name === "Tail Sweep")?.physicalDamageType)
      .toBe(Bludgeoning);
    expect(getMonster("dragon")!.abilities?.find((ability) => ability.name === "Fire Breath")?.physicalDamageType)
      .toBeUndefined();
  });
});

describe("incoming armor damage", () => {
  it.each(ARMOR_EXPECTATIONS.flatMap(([id, resistances]) =>
    Object.values(PhysicalDamageType).map((type) => ({ id, resistances, type }))
  ))("matches $id against $type using the existing floored half-damage rule", ({ id, resistances, type }) => {
    const player = actor();
    player.equippedArmor = getItem(id)!;
    const random = vi.spyOn(Math, "random").mockReturnValueOnce(0.5).mockReturnValueOnce(0.8);
    const protectedType = resistances.some((resistance) => resistance === type);
    const result = monsterAttack(attacker(type), player);
    expect(result).toMatchObject({
      hit: true, damage: protectedType ? 4 : 9, physicalType: type,
      physicalLabel: protectedType ? "resistant" : "",
      damageRoll: { roll: { naturalRolls: [9] }, amount: protectedType ? 4 : 9 },
    });

    expect(player.hp).toBe(100 - result.damage);
    expect(player.mp).toBe(50);
    expect(random).toHaveBeenCalledTimes(2);
  });

  it("keeps critical faces, status/synergy ordering, overkill and the next RNG result exact", () => {
    const player = actor();
    player.equippedArmor = getItem("chainMail")!;
    player.hp = 2;
    const effects: PlayerState["activeEffects"] = [];
    applyStatusEffect(effects, "slow", "Fixture");
    const random = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.999).mockReturnValueOnce(0.3).mockReturnValueOnce(0.8)
      .mockReturnValueOnce(0.25);
    const result = monsterAttack(attacker(), player, 0, 0, 0, effects, 0, 3);
    expect(result).toMatchObject({
      critical: true, damage: 7,
      damageRoll: {
        roll: { naturalRolls: [4, 9], modifier: 1, total: 14 },
        adjustments: [{ label: "Armor: Slashing resistance /2 (floor)", amount: 7 }],
        amount: 7, application: { amount: 2, limit: "Overkill" },
      },
    });
    expect(player.hp).toBe(0);
    expect(random).toHaveBeenCalledTimes(3);
    expect(rollD20().roll).toBe(6);
    expect(Object.isFrozen(result.damageRoll)).toBe(true);
    const view = createCombatDicePresentation(result, {
      label: "Enemy armor fixture", revealModifier: false, revealThreshold: false,
    })!;
    expect(view.effect?.amount).toBe(7);
    expect(view.effect?.modifiers).toBeUndefined();
    expect(view.effect?.adjustments).toBeUndefined();
  });

  it("uses live hero and companion armor through their normal accessor-backed targets", () => {
    const player = actor();
    recruitCompanion(player, "guardian");
    const companion = player.party.companions[0]!;
    companion.hp = companion.maxHp = 100;
    const hero = createHeroCombatant(player);
    const ally = createActivePartyCombatants(player.party)[0]!;
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    player.equippedArmor = getItem("chainMail")!;
    companion.equippedArmor = getItem("plateArmor")!;
    expect(monsterAttackTarget(attacker(), hero).damage).toBe(3);
    expect(monsterAttackTarget(attacker(Piercing), ally).damage).toBe(3);
    expect(player.hp).toBe(97);
    expect(companion.hp).toBe(97);
    companion.equippedArmor = getItem("tundraPelt")!;
    expect(monsterAttackTarget(attacker(Piercing), ally).damage).toBe(6);
    expect(companion.hp).toBe(91);
  });

  it("does not invent damage dice for misses or reduce magic, healing or unrelated physical types", () => {
    const player = actor();
    player.equippedArmor = getItem("chainMail")!;
    vi.spyOn(Math, "random").mockReturnValue(0);
    const miss = monsterAttack(attacker(), player);
    expect(miss).toMatchObject({ hit: false, fumble: true, damage: 0 });
    expect(miss.damageRoll).toBeUndefined();
    expect(player.hp).toBe(100);
    const fire: MonsterAbility = {
      name: "Fixture flame", chance: 1, damageCount: 1, damageDie: 10,
      type: "damage", element: Element.Fire,
    };
    vi.mocked(Math.random).mockReturnValue(0.8);
    expect(monsterUseAbility(fire, attacker(), player).damage).toBe(9);
    expect(monsterUseAbility({ ...fire, type: "heal" }, attacker(), player).healing).toBe(9);
    expect(monsterUseAbility({
      ...fire, element: undefined, physicalDamageType: Piercing,
    }, attacker(), player).damage).toBe(9);
  });

  it("applies physical ability overrides, zero-damage status gating and self-heal from resolved damage", () => {
    const player = actor();
    player.equippedArmor = getItem("leatherArmor")!;
    const hero = createHeroCombatant(player);
    vi.spyOn(Math, "random").mockReturnValue(0.8);
    const slam: MonsterAbility = {
      name: "Fixture slam", chance: 1, damageCount: 1, damageDie: 10,
      type: "damage", physicalDamageType: Bludgeoning, selfHeal: true,
    };
    const result = monsterUseAbilityTarget(slam, attacker(Piercing), hero);
    expect(result).toMatchObject({
      damage: 4, healing: 4, physicalType: Bludgeoning, physicalLabel: "resistant",
      damageRoll: { roll: { naturalRolls: [9] }, amount: 4, application: { amount: 4 } },
    });
    vi.mocked(Math.random).mockReturnValue(0);
    const harmless = monsterUseAbilityTarget({ ...slam, statusEffect: "stunned" }, attacker(), hero);
    expect(harmless.damage).toBe(0);
    expect(player.activeEffects).toEqual([]);
  });
});

describe("physical trap protection", () => {
  function trap(type: TrapType): DungeonTrap {
    return {
      id: `armorFixture:${type}`, dungeonId: "heartlands_dungeon", level: 0,
      x: 4, y: 4, type, detectionDC: 10, disarmDC: 10,
      rewardXp: 0, protectsTreasure: false,
    };
  }

  it("reduces actual physical trap faces before the existing nonlethal cap without rerolling or refunding", () => {
    const player = actor();
    player.equippedArmor = getItem("plateArmor")!;
    player.hp = 4;
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const result = triggerDungeonTrap(player, trap("spikePit"));
    expect(result).toMatchObject({
      triggered: true, damage: 3,
      damageRoll: {
        roll: { sides: 6, naturalRolls: [4, 4], total: 8 },
        adjustments: [{ label: "Armor: Piercing resistance /2 (floor)", amount: 4 }],
        amount: 4, application: { amount: 3, limit: "Nonlethal" },
      },
    });
    expect(player.hp).toBe(1);
    expect(player.activeEffects.some((effect) => effect.id === "prone")).toBe(true);
    expect(random).toHaveBeenCalledTimes(2);
    expect(triggerDungeonTrap(player, trap("spikePit")).triggered).toBe(false);
    expect(random).toHaveBeenCalledTimes(2);
  });

  it("supports numeric legacy rolls without inventing dice and leaves magical trap damage/MP unchanged", () => {
    const player = actor();
    player.equippedArmor = getItem("leatherArmor")!;
    const rocks = triggerDungeonTrap(player, trap("fallingRocks"), () => 9);
    expect(rocks.damage).toBe(4);
    expect(rocks.damageRoll).toBeUndefined();
    const magic = triggerDungeonTrap(player, trap("necroticRune"), () => 9);
    expect(magic.damage).toBe(9);
    expect(magic.mpLoss).toBe(6);
  });
});
