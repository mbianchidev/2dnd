import { afterEach, describe, expect, it, vi } from "vitest";
import { ABILITIES, getAbility } from "../src/data/abilities";
import { getCity } from "../src/data/cities";
import { Element } from "../src/data/elements";
import { getItem, ITEMS } from "../src/data/items";
import { getMonster, MONSTERS } from "../src/data/monsters";
import type { Monster, MonsterAbility } from "../src/data/monsters";
import {
  monsterUseAbility,
  playerAttack,
  playerCastSpell,
  playerUseAbility,
} from "../src/systems/combat";
import {
  createPlayer,
  getArmorClass,
  useItem,
} from "../src/systems/player";
import type { PlayerStats } from "../src/systems/player";
import {
  STATUS_EFFECT_IDS,
  applyStatusEffect,
  clearAllEffects,
  clearDebuffs,
  cureWithItem,
  getActiveEffectNames,
  getEffectACModifier,
  getEffectAccuracyModifier,
  getEffectDamageModifier,
  getStatusEffectDef,
  hasEffect,
  isStatusEffectId,
  mustSkipTurn,
  normalizeActiveEffects,
  processEndOfTurn,
  processStartOfTurn,
  removeStatusEffect,
} from "../src/systems/statusEffects";
import type { ActiveStatusEffect } from "../src/systems/statusEffects";

const stats: PlayerStats = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

function createTestMonster(overrides: Partial<Monster> = {}): Monster {
  return {
    id: "testMonster",
    name: "Test Monster",
    hp: 30,
    ac: 12,
    attackBonus: 3,
    damageCount: 1,
    damageDie: 6,
    xpReward: 50,
    goldReward: 10,
    isBoss: false,
    color: 0xff0000,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("status effect definitions", () => {
  it("defines every supported effect", () => {
    expect(STATUS_EFFECT_IDS).toHaveLength(14);
    for (const id of STATUS_EFFECT_IDS) {
      expect(getStatusEffectDef(id)).toBeDefined();
    }
  });

  it("uses true disadvantage without duplicate flat penalties", () => {
    for (const id of ["poison", "frightened", "prone"] as const) {
      const definition = getStatusEffectDef(id)!;
      expect(definition.attackDisadvantage).toBe(true);
      expect(definition.accuracyModifier).toBe(0);
    }
  });

  it("keeps all data-driven status references valid", () => {
    for (const ability of ABILITIES) {
      if (ability.selfEffect) expect(isStatusEffectId(ability.selfEffect)).toBe(true);
      if (ability.targetEffect) {
        expect(isStatusEffectId(ability.targetEffect)).toBe(true);
      }
    }
    for (const monster of MONSTERS) {
      for (const ability of monster.abilities ?? []) {
        if (ability.statusEffect) {
          expect(isStatusEffectId(ability.statusEffect)).toBe(true);
        }
      }
    }
    for (const item of ITEMS.filter((candidate) => candidate.cureEffects)) {
      const hasCurableEffect = STATUS_EFFECT_IDS.some((id) => {
        const definition = getStatusEffectDef(id);
        return definition?.cureItemId === item.id
          && definition.removalMethods.includes("cure");
      });
      expect(hasCurableEffect).toBe(true);
    }
  });
});

describe("status effect operations", () => {
  it("applies, refreshes, and removes effects without stacking", () => {
    const effects: ActiveStatusEffect[] = [];
    expect(applyStatusEffect(effects, "poison", "Slime").applied).toBe(true);
    expect(effects).toEqual([
      { id: "poison", remainingTurns: 3, source: "Slime" },
    ]);

    expect(applyStatusEffect(effects, "poison", "Spider", 2).applied).toBe(false);
    expect(applyStatusEffect(effects, "poison", "Spider", 5).applied).toBe(true);
    expect(effects).toEqual([
      { id: "poison", remainingTurns: 5, source: "Spider" },
    ]);

    expect(removeStatusEffect(effects, "poison")).toBe(true);
    expect(removeStatusEffect(effects, "poison")).toBe(false);
  });

  it("rejects invalid duration overrides", () => {
    const effects: ActiveStatusEffect[] = [];
    const result = applyStatusEffect(effects, "burn", "Trap", -1);
    expect(result.applied).toBe(false);
    expect(effects).toEqual([]);
  });

  it("cures all effects associated with a remedy", () => {
    const effects: ActiveStatusEffect[] = [
      { id: "frightened", remainingTurns: 2, source: "Wraith" },
      { id: "asleep", remainingTurns: 3, source: "Spell" },
      { id: "poison", remainingTurns: 3, source: "Slime" },
    ];

    expect(cureWithItem(effects, "smellingSalts")).toEqual([
      "Asleep",
      "Frightened",
    ]);
    expect(effects).toEqual([
      { id: "poison", remainingTurns: 3, source: "Slime" },
    ]);
  });

  it("reports modifiers, skips, and display names", () => {
    const effects: ActiveStatusEffect[] = [
      { id: "freeze", remainingTurns: 2, source: "Frost Warden" },
      { id: "rage", remainingTurns: 5, source: "Hero" },
      { id: "paralysis", remainingTurns: 1, source: "Trap" },
    ];

    expect(getEffectAccuracyModifier(effects)).toBe(-3);
    expect(getEffectACModifier(effects)).toBe(-6);
    expect(getEffectDamageModifier(effects)).toBe(3);
    expect(mustSkipTurn(effects)).toBe(true);
    expect(hasEffect(effects, "rage")).toBe(true);
    expect(getActiveEffectNames(effects)).toContain("Raging (5t)");
  });

  it("clears debuffs separately from all effects", () => {
    const effects: ActiveStatusEffect[] = [
      { id: "poison", remainingTurns: 2, source: "Slime" },
      { id: "rage", remainingTurns: 4, source: "Hero" },
    ];
    clearDebuffs(effects);
    expect(effects.map((effect) => effect.id)).toEqual(["rage"]);
    clearAllEffects(effects);
    expect(effects).toEqual([]);
  });
});

describe("status turn lifecycle", () => {
  it("applies tick damage before a failed save", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const effects: ActiveStatusEffect[] = [
      { id: "poison", remainingTurns: 3, source: "Slime" },
    ];

    const start = processStartOfTurn(effects, stats);
    expect(start.tickDamage).toBe(3);
    expect(start.skipTurn).toBe(false);
    expect(effects[0].remainingTurns).toBe(3);

    processEndOfTurn(effects);
    expect(effects[0].remainingTurns).toBe(2);
  });

  it("lets a successful save prevent a skipped turn", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const effects: ActiveStatusEffect[] = [
      { id: "paralysis", remainingTurns: 2, source: "Frost Warden" },
    ];

    const result = processStartOfTurn(effects, stats);
    expect(result.skipTurn).toBe(false);
    expect(effects).toEqual([]);
  });

  it("keeps a one-turn stun active until the skipped turn ends", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const effects: ActiveStatusEffect[] = [
      { id: "stunned", remainingTurns: 1, source: "Knight" },
    ];

    const start = processStartOfTurn(effects, stats);
    expect(start.skipTurn).toBe(true);
    expect(effects).toHaveLength(1);

    const end = processEndOfTurn(effects);
    expect(end.messages).toContain("Stunned wore off.");
    expect(effects).toEqual([]);
  });

  it("does not decrement manual-duration effects", () => {
    const effects: ActiveStatusEffect[] = [
      { id: "rage", remainingTurns: 0, source: "Hero" },
    ];
    processEndOfTurn(effects);
    expect(effects[0].remainingTurns).toBe(0);
  });
});

describe("status save normalization", () => {
  it("filters malformed entries and keeps the longest duplicate", () => {
    const normalized = normalizeActiveEffects([
      { id: "poison", remainingTurns: 1, source: "old" },
      { id: "poison", remainingTurns: 4, source: "new" },
      { id: "burn", remainingTurns: "bad", source: 42 },
      { id: "unknown", remainingTurns: 3, source: "bad" },
      null,
    ]);

    expect(normalized).toEqual([
      { id: "poison", remainingTurns: 4, source: "new" },
      { id: "burn", remainingTurns: 3, source: "unknown" },
    ]);
  });
});

describe("status combat integration", () => {
  it("preserves critical hits and fumbles under disadvantage", () => {
    const player = createPlayer("Hero", stats);
    player.activeEffects = [
      { id: "poison", remainingTurns: 3, source: "Slime" },
    ];
    const monster = createTestMonster({ ac: 1 });

    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.999)
      .mockReturnValueOnce(0.999)
      .mockReturnValue(0.5);
    const critical = playerAttack(player, monster);
    expect(critical.disadvantage).toBe(true);
    expect(critical.critical).toBe(true);

    vi.restoreAllMocks();
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.999);
    const fumble = playerAttack(player, monster);
    expect(fumble.disadvantage).toBe(true);
    expect(fumble.hit).toBe(false);
    expect(fumble.roll).toBe(1);
  });

  it("does not roll auto-hit spells with disadvantage", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const player = createPlayer("Wizard", stats, "wizard");
    player.mp = 100;
    player.activeEffects = [
      { id: "poison", remainingTurns: 3, source: "Slime" },
    ];

    const result = playerCastSpell(
      player,
      "magicMissile",
      createTestMonster(),
    );
    expect(result.hit).toBe(true);
    expect(result.autoHit).toBe(true);
    expect(result.roll).toBeUndefined();
    expect(result.disadvantage).toBe(false);
  });

  it("applies status damage bonuses and monster AC modifiers", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const player = createPlayer("Hero", stats);
    const monster = createTestMonster({ ac: 12 });

    const baseline = playerAttack(player, monster);
    player.activeEffects = [
      { id: "rage", remainingTurns: 5, source: "Hero" },
    ];
    const enraged = playerAttack(player, monster);
    expect(enraged.damage).toBe(baseline.damage + 3);

    const proneMonster: ActiveStatusEffect[] = [
      { id: "prone", remainingTurns: 1, source: "Hero" },
    ];
    const againstProne = playerAttack(player, monster, 0, 0, proneMonster);
    expect(againstProne.targetAC).toBe(10);
  });

  it("combines elemental weaknesses with status modifiers", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const player = createPlayer("Paladin", stats, "paladin");
    player.equippedWeapon = getItem("flameBlade")!;
    player.activeEffects = [
      { id: "rage", remainingTurns: 5, source: "Hero" },
    ];
    const monster = createTestMonster({
      ac: 12,
      elementalProfile: { weaknesses: [Element.Fire] },
    });
    const monsterEffects: ActiveStatusEffect[] = [
      { id: "prone", remainingTurns: 1, source: "Hero" },
    ];

    const result = playerAttack(player, monster, 0, 0, monsterEffects);
    expect(result.damage).toBe(26);
    expect(result.targetAC).toBe(10);
    expect(result.elementalLabel).toBe("weak");
  });

  it("applies player ability and monster ability status effects", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const player = createPlayer("Knight", stats, "knight");
    player.mp = 100;
    const monster = createTestMonster({ ac: 1 });
    const monsterEffects: ActiveStatusEffect[] = [];

    const bash = playerUseAbility(
      player,
      "shieldBash",
      monster,
      0,
      monsterEffects,
    );
    expect(bash.hit).toBe(true);
    expect(monsterEffects[0]?.id).toBe("stunned");

    const poisonAbility: MonsterAbility = {
      name: "Poison Bite",
      chance: 1,
      damageCount: 1,
      damageDie: 4,
      type: "damage",
      statusEffect: "poison",
    };
    monsterUseAbility(poisonAbility, monster, player);
    expect(player.activeEffects.some((effect) => effect.id === "poison")).toBe(
      true,
    );
  });

  it("applies buff abilities and cure consumables", () => {
    const player = createPlayer("Barbarian", stats, "barbarian");
    player.mp = 100;
    const monster = createTestMonster();

    const rage = playerUseAbility(player, "rage", monster);
    expect(rage.hit).toBe(true);
    expect(player.activeEffects[0]?.id).toBe("rage");

    player.activeEffects.push({
      id: "poison",
      remainingTurns: 3,
      source: "Slime",
    });
    player.inventory.push({ ...getItem("antidote")! });
    const itemIndex = player.inventory.findIndex(
      (item) => item.id === "antidote",
    );
    const cure = useItem(player, itemIndex);
    expect(cure.used).toBe(true);
    expect(hasEffect(player.activeEffects, "poison")).toBe(false);
  });

  it("updates player AC and exposes status-enabled game data", () => {
    const player = createPlayer("Rogue", stats, "rogue");
    const baseAC = getArmorClass(player);
    player.activeEffects = [
      { id: "sneakStance", remainingTurns: 2, source: "Rogue" },
    ];
    expect(getArmorClass(player)).toBe(baseAC + 2);

    expect(getAbility("sneakStance")?.bonusAction).toBe(true);
    expect(getItem("paralysisRemedy")?.cureEffects).toBe(true);
    expect(
      getMonster("frostWarden")?.abilities?.find(
        (ability) => ability.name === "Glacial Tomb",
      )?.statusEffect,
    ).toBe("paralysis");

    const remedies = getCity("willowdale_city")?.shops
      .flatMap((shop) => shop.shopItems);
    expect(remedies).toEqual(
      expect.arrayContaining([
        "antidote",
        "burnSalve",
        "thawingTonic",
        "paralysisRemedy",
        "smellingSalts",
      ]),
    );
  });
});
