import { describe, it, expect } from "vitest";
import {
  applyStatusEffect,
  removeStatusEffect,
  cureWithItem,
  hasEffect,
  getEffectAccuracyModifier,
  getEffectACModifier,
  getEffectDamageModifier,
  mustSkipTurn,
  processStartOfTurn,
  clearAllEffects,
  clearDebuffs,
  getActiveEffectNames,
  getStatusEffectDef,
  type ActiveStatusEffect,
  type StatusEffectId,
} from "../src/systems/statusEffects";
import { createPlayer, useItem, getArmorClass, type PlayerStats } from "../src/systems/player";
import { playerAttack, playerUseAbility, monsterUseAbility } from "../src/systems/combat";
import { getItem } from "../src/data/items";
import type { Monster, MonsterAbility } from "../src/data/monsters";

const defaultStats: PlayerStats = {
  strength: 10, dexterity: 10, constitution: 10,
  intelligence: 10, wisdom: 10, charisma: 10,
};

function createTestMonster(overrides?: Partial<Monster>): Monster {
  return {
    id: "testMonster",
    name: "Test Monster",
    hp: 20,
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

describe("status effects system", () => {
  describe("getStatusEffectDef", () => {
    it("returns definition for known effects", () => {
      const poison = getStatusEffectDef("poison");
      expect(poison).toBeDefined();
      expect(poison!.name).toBe("Poisoned");
      expect(poison!.category).toBe("debuff");
      expect(poison!.tickDamage).toBeGreaterThan(0);
    });

    it("returns undefined for unknown effects", () => {
      expect(getStatusEffectDef("nonexistent" as StatusEffectId)).toBeUndefined();
    });

    it("defines all expected effects", () => {
      const expectedIds: StatusEffectId[] = [
        "poison", "burn", "freeze", "paralysis", "stunned",
        "frightened", "slow", "prone", "asleep", "confused",
        "enraged", "haste", "rage", "sneakStance",
      ];
      for (const id of expectedIds) {
        expect(getStatusEffectDef(id)).toBeDefined();
      }
    });
  });

  describe("applyStatusEffect", () => {
    it("applies a new effect", () => {
      const effects: ActiveStatusEffect[] = [];
      const result = applyStatusEffect(effects, "poison", "Slime");
      expect(result.applied).toBe(true);
      expect(effects).toHaveLength(1);
      expect(effects[0].id).toBe("poison");
      expect(effects[0].source).toBe("Slime");
      expect(effects[0].remainingTurns).toBe(3); // default duration
    });

    it("refreshes duration if new is longer", () => {
      const effects: ActiveStatusEffect[] = [
        { id: "poison", remainingTurns: 1, source: "old" },
      ];
      const result = applyStatusEffect(effects, "poison", "new", 5);
      expect(result.applied).toBe(true);
      expect(effects).toHaveLength(1);
      expect(effects[0].remainingTurns).toBe(5);
      expect(effects[0].source).toBe("new");
    });

    it("does not stack if already at max duration", () => {
      const effects: ActiveStatusEffect[] = [
        { id: "poison", remainingTurns: 5, source: "old" },
      ];
      const result = applyStatusEffect(effects, "poison", "new", 3);
      expect(result.applied).toBe(false);
      expect(effects).toHaveLength(1);
      expect(effects[0].remainingTurns).toBe(5);
    });

    it("supports custom duration override", () => {
      const effects: ActiveStatusEffect[] = [];
      applyStatusEffect(effects, "burn", "Fire", 10);
      expect(effects[0].remainingTurns).toBe(10);
    });
  });

  describe("removeStatusEffect", () => {
    it("removes an existing effect", () => {
      const effects: ActiveStatusEffect[] = [
        { id: "poison", remainingTurns: 3, source: "test" },
        { id: "burn", remainingTurns: 2, source: "test" },
      ];
      const removed = removeStatusEffect(effects, "poison");
      expect(removed).toBe(true);
      expect(effects).toHaveLength(1);
      expect(effects[0].id).toBe("burn");
    });

    it("returns false for non-existent effect", () => {
      const effects: ActiveStatusEffect[] = [];
      expect(removeStatusEffect(effects, "poison")).toBe(false);
    });
  });

  describe("cureWithItem", () => {
    it("cures effects matching the item", () => {
      const effects: ActiveStatusEffect[] = [
        { id: "poison", remainingTurns: 3, source: "test" },
        { id: "burn", remainingTurns: 2, source: "test" },
      ];
      const cured = cureWithItem(effects, "antidote");
      expect(cured).toContain("Poisoned");
      expect(effects).toHaveLength(1);
      expect(effects[0].id).toBe("burn");
    });

    it("returns empty array when no effects match", () => {
      const effects: ActiveStatusEffect[] = [
        { id: "burn", remainingTurns: 2, source: "test" },
      ];
      const cured = cureWithItem(effects, "antidote");
      expect(cured).toHaveLength(0);
      expect(effects).toHaveLength(1);
    });

    it("cures frightened and asleep with smelling salts", () => {
      const effects: ActiveStatusEffect[] = [
        { id: "frightened", remainingTurns: 2, source: "test" },
        { id: "asleep", remainingTurns: 3, source: "test" },
      ];
      const cured = cureWithItem(effects, "smellingSalts");
      expect(cured).toHaveLength(2);
      expect(effects).toHaveLength(0);
    });
  });

  describe("hasEffect", () => {
    it("returns true when effect is present", () => {
      const effects: ActiveStatusEffect[] = [
        { id: "poison", remainingTurns: 3, source: "test" },
      ];
      expect(hasEffect(effects, "poison")).toBe(true);
    });

    it("returns false when effect is not present", () => {
      const effects: ActiveStatusEffect[] = [];
      expect(hasEffect(effects, "poison")).toBe(false);
    });
  });

  describe("modifier calculations", () => {
    it("calculates accuracy modifier from effects", () => {
      const effects: ActiveStatusEffect[] = [
        { id: "poison", remainingTurns: 3, source: "test" }, // -2
        { id: "frightened", remainingTurns: 2, source: "test" }, // -3
      ];
      expect(getEffectAccuracyModifier(effects)).toBe(-5);
    });

    it("calculates AC modifier from effects", () => {
      const effects: ActiveStatusEffect[] = [
        { id: "paralysis", remainingTurns: 2, source: "test" }, // -4
        { id: "sneakStance", remainingTurns: 2, source: "test" }, // +2
      ];
      expect(getEffectACModifier(effects)).toBe(-2);
    });

    it("calculates damage modifier from effects", () => {
      const effects: ActiveStatusEffect[] = [
        { id: "rage", remainingTurns: 5, source: "self" }, // +3
        { id: "slow", remainingTurns: 3, source: "test" }, // -2
      ];
      expect(getEffectDamageModifier(effects)).toBe(1);
    });

    it("returns 0 for empty effects", () => {
      expect(getEffectAccuracyModifier([])).toBe(0);
      expect(getEffectACModifier([])).toBe(0);
      expect(getEffectDamageModifier([])).toBe(0);
    });
  });

  describe("mustSkipTurn", () => {
    it("returns true for paralysis", () => {
      const effects: ActiveStatusEffect[] = [
        { id: "paralysis", remainingTurns: 2, source: "test" },
      ];
      expect(mustSkipTurn(effects)).toBe(true);
    });

    it("returns true for stunned", () => {
      const effects: ActiveStatusEffect[] = [
        { id: "stunned", remainingTurns: 1, source: "test" },
      ];
      expect(mustSkipTurn(effects)).toBe(true);
    });

    it("returns true for asleep", () => {
      const effects: ActiveStatusEffect[] = [
        { id: "asleep", remainingTurns: 3, source: "test" },
      ];
      expect(mustSkipTurn(effects)).toBe(true);
    });

    it("returns false for non-skip effects", () => {
      const effects: ActiveStatusEffect[] = [
        { id: "poison", remainingTurns: 3, source: "test" },
        { id: "burn", remainingTurns: 2, source: "test" },
      ];
      expect(mustSkipTurn(effects)).toBe(false);
    });

    it("returns false for empty effects", () => {
      expect(mustSkipTurn([])).toBe(false);
    });
  });

  describe("processStartOfTurn", () => {
    it("applies tick damage from poison", () => {
      const effects: ActiveStatusEffect[] = [
        { id: "poison", remainingTurns: 3, source: "test" },
      ];
      const result = processStartOfTurn(effects, defaultStats);
      expect(result.tickDamage).toBeGreaterThan(0);
      expect(result.messages.some(m => m.includes("damage"))).toBe(true);
    });

    it("decrements duration", () => {
      const effects: ActiveStatusEffect[] = [
        { id: "rage", remainingTurns: 3, source: "self" },
      ];
      processStartOfTurn(effects, defaultStats);
      // rage has no save so it just decrements
      expect(effects[0].remainingTurns).toBe(2);
    });

    it("removes expired effects", () => {
      const effects: ActiveStatusEffect[] = [
        { id: "rage", remainingTurns: 1, source: "self" },
      ];
      const result = processStartOfTurn(effects, defaultStats);
      expect(effects).toHaveLength(0);
      expect(result.messages.some(m => m.includes("wore off"))).toBe(true);
    });

    it("handles multiple effects", () => {
      const effects: ActiveStatusEffect[] = [
        { id: "poison", remainingTurns: 2, source: "test" },
        { id: "rage", remainingTurns: 1, source: "self" },
      ];
      processStartOfTurn(effects, defaultStats);
      // rage should be removed (expired), poison may or may not be (save)
      const rageActive = effects.find(e => e.id === "rage");
      expect(rageActive).toBeUndefined();
    });
  });

  describe("clearAllEffects", () => {
    it("removes all effects", () => {
      const effects: ActiveStatusEffect[] = [
        { id: "poison", remainingTurns: 3, source: "test" },
        { id: "rage", remainingTurns: 5, source: "self" },
      ];
      clearAllEffects(effects);
      expect(effects).toHaveLength(0);
    });
  });

  describe("clearDebuffs", () => {
    it("removes only debuffs, keeps buffs", () => {
      const effects: ActiveStatusEffect[] = [
        { id: "poison", remainingTurns: 3, source: "test" },
        { id: "rage", remainingTurns: 5, source: "self" },
        { id: "burn", remainingTurns: 2, source: "test" },
      ];
      clearDebuffs(effects);
      expect(effects).toHaveLength(1);
      expect(effects[0].id).toBe("rage");
    });
  });

  describe("getActiveEffectNames", () => {
    it("returns formatted names with turns", () => {
      const effects: ActiveStatusEffect[] = [
        { id: "poison", remainingTurns: 3, source: "test" },
        { id: "rage", remainingTurns: 5, source: "self" },
      ];
      const names = getActiveEffectNames(effects);
      expect(names).toContain("Poisoned (3t)");
      expect(names).toContain("Raging (5t)");
    });
  });
});

describe("cure items integration", () => {
  it("antidote cures poison via useItem", () => {
    const player = createPlayer("Test", defaultStats);
    player.activeEffects = [{ id: "poison", remainingTurns: 3, source: "test" }];
    const antidote = getItem("antidote")!;
    player.inventory.push({ ...antidote });
    const idx = player.inventory.findIndex(i => i.id === "antidote");
    const result = useItem(player, idx);
    expect(result.used).toBe(true);
    expect(result.message).toContain("Cured");
    expect(player.activeEffects).toHaveLength(0);
  });

  it("cure item fails when no matching effect", () => {
    const player = createPlayer("Test", defaultStats);
    player.activeEffects = [];
    const antidote = getItem("antidote")!;
    player.inventory.push({ ...antidote });
    const idx = player.inventory.findIndex(i => i.id === "antidote");
    const result = useItem(player, idx);
    expect(result.used).toBe(false);
    expect(result.message).toContain("No ailment");
  });

  it("all cure items exist and are purchasable", () => {
    const cureIds = ["antidote", "burnSalve", "thawingTonic", "paralysisRemedy", "smellingSalts"];
    for (const id of cureIds) {
      const item = getItem(id);
      expect(item).toBeDefined();
      expect(item!.type).toBe("consumable");
      expect(item!.cost).toBeGreaterThan(0);
      expect(item!.cureEffects).toBe(true);
    }
  });
});

describe("status effects in combat", () => {
  it("player AC is modified by active effects", () => {
    const player = createPlayer("Test", defaultStats);
    const baseAC = getArmorClass(player);
    
    player.activeEffects = [{ id: "sneakStance", remainingTurns: 2, source: "self" }];
    const buffedAC = getArmorClass(player);
    expect(buffedAC).toBe(baseAC + 2);
    
    player.activeEffects = [{ id: "paralysis", remainingTurns: 2, source: "test" }];
    const debuffedAC = getArmorClass(player);
    expect(debuffedAC).toBe(baseAC - 4);
  });

  it("monster ability with statusEffect applies it to player", () => {
    const player = createPlayer("Test", defaultStats);
    player.activeEffects = [];
    const monster = createTestMonster();
    const ability: MonsterAbility = {
      name: "Poison Bite",
      chance: 1.0,
      damageCount: 1,
      damageDie: 4,
      type: "damage",
      statusEffect: "poison",
    };
    const result = monsterUseAbility(ability, monster, player);
    expect(result.damage).toBeGreaterThan(0);
    expect(player.activeEffects).toHaveLength(1);
    expect(player.activeEffects[0].id).toBe("poison");
  });

  it("buff ability applies self-effect via playerUseAbility", () => {
    const player = createPlayer("Test", defaultStats, "barbarian");
    player.knownAbilities = ["rage"];
    player.mp = 100;
    player.activeEffects = [];
    const monster = createTestMonster();
    const result = playerUseAbility(player, "rage", monster);
    expect(result.hit).toBe(true);
    expect(result.message).toContain("Rage");
    expect(player.activeEffects).toHaveLength(1);
    expect(player.activeEffects[0].id).toBe("rage");
  });

  it("sneak stance buff applies AC bonus", () => {
    const player = createPlayer("Test", defaultStats, "rogue");
    player.knownAbilities = ["sneakStance"];
    player.mp = 100;
    player.activeEffects = [];
    const monster = createTestMonster();
    const baseAC = getArmorClass(player);
    playerUseAbility(player, "sneakStance", monster);
    const buffedAC = getArmorClass(player);
    expect(buffedAC).toBe(baseAC + 2);
  });
});
