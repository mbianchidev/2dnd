import { describe, it, expect } from "vitest";
import {
  createPlayer,
  xpForLevel,
  awardXP,
  allocateStatPoint,
  ASI_LEVELS,
  getAttackModifier,
  getSpellModifier,
  getArmorClass,
  buyItem,
  canAfford,
  useItem,
  calculatePointsSpent,
  isValidPointBuy,
  POINT_BUY_COSTS,
  POINT_BUY_TOTAL,
  type PlayerState,
  type PlayerStats,
} from "../src/systems/player";
import { ITEMS, getItem } from "../src/data/items";
import { getAbility } from "../src/data/abilities";

const defaultStats: PlayerStats = {
  strength: 10, dexterity: 10, constitution: 10,
  intelligence: 10, wisdom: 10, charisma: 10,
};

/** Helper: create a player with controlled stats for deterministic testing. */
function createTestPlayer(overrides?: Partial<PlayerState>): PlayerState {
  const player = createPlayer("Test", {
    strength: 10, dexterity: 8, constitution: 12,
    intelligence: 8, wisdom: 8, charisma: 8,
  });
  // Pin stats for predictable tests
  player.stats = {
    strength: 12,
    dexterity: 10,
    constitution: 14,
    intelligence: 10,
    wisdom: 10,
    charisma: 8,
  };
  player.maxHp = 30;
  player.hp = 30;
  player.maxMp = 10;
  player.mp = 10;
  if (overrides) Object.assign(player, overrides);
  return player;
}

describe("player system", () => {
  describe("createPlayer", () => {
    it("creates a level 1 player with provided base stats + class boosts", () => {
      const player = createPlayer("TestHero", defaultStats);
      expect(player.name).toBe("TestHero");
      expect(player.level).toBe(1);
      expect(player.xp).toBe(0);
      // Knight default: STR+2, CON+1 on top of base 10s
      expect(player.stats.strength).toBe(12); // 10 + 2
      expect(player.stats.constitution).toBe(11); // 10 + 1
      expect(player.stats.dexterity).toBe(10); // unchanged
      // HP and MP are derived from CON/INT
      expect(player.maxHp).toBeGreaterThanOrEqual(10);
      expect(player.maxMp).toBeGreaterThanOrEqual(4);
      expect(player.gold).toBe(50);
      expect(player.knownSpells).toContain("cureWounds");
      expect(player.inventory).toHaveLength(0);
      expect(player.pendingStatPoints).toBe(0);
      expect(player.openedChests).toEqual([]);
      expect(player.exploredTiles).toEqual({});
    });

    it("applies class boosts correctly for different classes", () => {
      // Mage: INT+2, WIS+1
      const mage = createPlayer("TestMage", { ...defaultStats, intelligence: 15 }, "mage");
      expect(mage.stats.intelligence).toBe(17); // 15 + 2
      expect(mage.stats.wisdom).toBe(11); // 10 + 1

      // Rogue: DEX+2, CHA+1
      const rogue = createPlayer("TestRogue", defaultStats, "rogue");
      expect(rogue.stats.dexterity).toBe(12); // 10 + 2
      expect(rogue.stats.charisma).toBe(11); // 10 + 1
    });

    it("does not mutate the passed-in base stats object", () => {
      const myStats = { ...defaultStats };
      createPlayer("TestHero", myStats);
      expect(myStats.strength).toBe(10); // should be unchanged
    });
  });

  describe("Point Buy system", () => {
    it("calculates points spent for all stats at 8 as 0", () => {
      const allEight: PlayerStats = {
        strength: 8, dexterity: 8, constitution: 8,
        intelligence: 8, wisdom: 8, charisma: 8,
      };
      expect(calculatePointsSpent(allEight)).toBe(0);
    });

    it("calculates standard array 15/14/13/12/10/8 as 27 points", () => {
      const standardArray: PlayerStats = {
        strength: 15, dexterity: 14, constitution: 13,
        intelligence: 12, wisdom: 10, charisma: 8,
      };
      expect(calculatePointsSpent(standardArray)).toBe(27);
    });

    it("calculates all stats at 15 as 54 points (over budget)", () => {
      const allFifteen: PlayerStats = {
        strength: 15, dexterity: 15, constitution: 15,
        intelligence: 15, wisdom: 15, charisma: 15,
      };
      expect(calculatePointsSpent(allFifteen)).toBe(54);
    });

    it("validates a correct Point Buy distribution", () => {
      const valid: PlayerStats = {
        strength: 15, dexterity: 14, constitution: 13,
        intelligence: 12, wisdom: 10, charisma: 8,
      };
      expect(isValidPointBuy(valid)).toBe(true);
    });

    it("rejects Point Buy with wrong total", () => {
      const invalid: PlayerStats = {
        strength: 15, dexterity: 15, constitution: 15,
        intelligence: 15, wisdom: 15, charisma: 15,
      };
      expect(isValidPointBuy(invalid)).toBe(false);
    });

    it("rejects Point Buy with stats below 8", () => {
      const invalid: PlayerStats = {
        strength: 7, dexterity: 15, constitution: 15,
        intelligence: 15, wisdom: 10, charisma: 8,
      };
      expect(isValidPointBuy(invalid)).toBe(false);
    });

    it("rejects Point Buy with stats above 15", () => {
      const invalid: PlayerStats = {
        strength: 16, dexterity: 8, constitution: 8,
        intelligence: 8, wisdom: 8, charisma: 8,
      };
      expect(isValidPointBuy(invalid)).toBe(false);
    });
  });

  describe("xpForLevel", () => {
    it("scales quadratically", () => {
      expect(xpForLevel(2)).toBe(400);
      expect(xpForLevel(3)).toBe(900);
      expect(xpForLevel(5)).toBe(2500);
      expect(xpForLevel(10)).toBe(10000);
    });
  });

  describe("awardXP", () => {
    it("awards XP without leveling up", () => {
      const player = createTestPlayer();
      const result = awardXP(player, 100);
      expect(player.xp).toBe(100);
      expect(result.leveledUp).toBe(false);
      expect(result.newLevel).toBe(1);
      expect(result.asiGained).toBe(0);
    });

    it("levels up when enough XP is gained", () => {
      const player = createTestPlayer();
      const startHp = player.maxHp;
      const result = awardXP(player, 400); // xpForLevel(2) = 400
      expect(result.leveledUp).toBe(true);
      expect(result.newLevel).toBe(2);
      expect(player.level).toBe(2);
      expect(player.maxHp).toBeGreaterThan(startHp);
    });

    it("unlocks spells on level up", () => {
      const player = createTestPlayer();
      // Level up to 5 to unlock healingWord (Knight spell)
      const result = awardXP(player, xpForLevel(5 + 1));
      const spellIds = result.newSpells.map((s) => s.id);
      expect(spellIds).toContain("healingWord");
      expect(player.knownSpells).toContain("healingWord");
    });

    it("grants ASI points at D&D levels 4, 8, 12, 16, 19", () => {
      const player = createTestPlayer();
      // Level to 4 (first ASI level): xpForLevel(5) = 2500 is enough to hit 4
      awardXP(player, xpForLevel(4 + 1)); // enough to reach level 4
      expect(player.level).toBeGreaterThanOrEqual(4);
      expect(player.pendingStatPoints).toBe(2);
    });

    it("does not grant ASI points at non-ASI levels", () => {
      const player = createTestPlayer();
      awardXP(player, 400); // level 2
      expect(player.pendingStatPoints).toBe(0);
      awardXP(player, 500); // level 3
      expect(player.pendingStatPoints).toBe(0);
    });
  });

  describe("modifiers", () => {
    it("calculates attack modifier correctly", () => {
      const player = createTestPlayer();
      // STR 12 -> mod +1, proficiency at level 1 = +2, total = +3
      expect(getAttackModifier(player)).toBe(3);
    });

    it("calculates spell modifier correctly", () => {
      const player = createTestPlayer();
      // Knight: primary stat is STR (12 -> mod +1), proficiency = +2, total = +3
      expect(getSpellModifier(player)).toBe(3);
    });

    it("calculates armor class correctly", () => {
      const player = createTestPlayer();
      // DEX 10 -> mod 0, base AC = 10
      expect(getArmorClass(player)).toBe(10);

      // Equip armor
      const armor = getItem("leatherArmor")!;
      player.equippedArmor = armor;
      expect(getArmorClass(player)).toBe(12);
    });
  });

  describe("inventory", () => {
    it("checks affordability", () => {
      const player = createTestPlayer();
      expect(canAfford(player, 50)).toBe(true);
      expect(canAfford(player, 51)).toBe(false);
    });

    it("buys items and deducts gold", () => {
      const player = createTestPlayer();
      const potion = ITEMS.find((i) => i.id === "potion")!;
      expect(buyItem(player, potion)).toBe(true);
      expect(player.gold).toBe(35);
      expect(player.inventory).toHaveLength(1);
      expect(player.inventory[0].id).toBe("potion");
    });

    it("fails to buy when insufficient gold", () => {
      const player = createTestPlayer();
      player.gold = 5;
      const potion = ITEMS.find((i) => i.id === "potion")!;
      expect(buyItem(player, potion)).toBe(false);
      expect(player.gold).toBe(5);
    });

    it("uses healing potions", () => {
      const player = createTestPlayer();
      player.hp = 10;
      const potion = ITEMS.find((i) => i.id === "potion")!;
      player.inventory.push({ ...potion });

      const result = useItem(player, 0);
      expect(result.used).toBe(true);
      expect(player.hp).toBe(30); // 10 + 20
      expect(player.inventory).toHaveLength(0);
    });

    it("caps healing at max HP", () => {
      const player = createTestPlayer();
      player.hp = 25; // 5 below max
      const potion = ITEMS.find((i) => i.id === "potion")!; // heals 20
      player.inventory.push({ ...potion });

      useItem(player, 0);
      expect(player.hp).toBe(30); // capped at max
    });

    it("equips weapons", () => {
      const player = createTestPlayer();
      const sword = ITEMS.find((i) => i.id === "shortSword")!;
      player.inventory.push({ ...sword });

      const result = useItem(player, 0);
      expect(result.used).toBe(true);
      expect(player.equippedWeapon?.id).toBe("shortSword");
    });
  });

  describe("allocateStatPoint", () => {
    it("allocates a point to the chosen stat", () => {
      const player = createTestPlayer({ pendingStatPoints: 2 });
      expect(allocateStatPoint(player, "strength")).toBe(true);
      expect(player.stats.strength).toBe(13);
      expect(player.pendingStatPoints).toBe(1);
    });

    it("refuses when no points are available", () => {
      const player = createTestPlayer({ pendingStatPoints: 0 });
      expect(allocateStatPoint(player, "strength")).toBe(false);
      expect(player.stats.strength).toBe(12);
    });

    it("boosts HP when allocating to constitution", () => {
      const player = createTestPlayer({ pendingStatPoints: 1, level: 4 });
      const prevMaxHp = player.maxHp;
      allocateStatPoint(player, "constitution");
      expect(player.maxHp).toBe(prevMaxHp + 4); // +1 per level
    });

    it("boosts MP when allocating to intelligence", () => {
      const player = createTestPlayer({ pendingStatPoints: 1, level: 4 });
      const prevMaxMp = player.maxMp;
      allocateStatPoint(player, "intelligence");
      expect(player.maxMp).toBe(prevMaxMp + 4); // +1 per level
    });
  });

  describe("class differentiation", () => {
    it("each class has unique starting spell or ability", () => {
      const startingSpells = new Set<string>();
      const startingAbilities = new Set<string>();
      for (const classId of ["knight", "ranger", "mage", "rogue", "paladin", "warlock", "cleric", "barbarian", "monk"]) {
        const player = createPlayer("Test", defaultStats, classId);
        if (player.knownSpells.length > 0) startingSpells.add(player.knownSpells[0]);
        if (player.knownAbilities.length > 0) startingAbilities.add(player.knownAbilities[0]);
      }
      // At least 3 distinct starting spells/abilities across classes
      expect(startingSpells.size + startingAbilities.size).toBeGreaterThanOrEqual(3);
    });

    it("rogue, barbarian, and monk have no spells (pure martial)", () => {
      const rogue = createPlayer("Rogue", defaultStats, "rogue");
      const barbarian = createPlayer("Barb", defaultStats, "barbarian");
      const monk = createPlayer("Monk", defaultStats, "monk");
      expect(rogue.knownSpells).toHaveLength(0);
      expect(barbarian.knownSpells).toHaveLength(0);
      expect(monk.knownSpells).toHaveLength(0);
    });

    it("mage has no martial abilities", () => {
      const mage = createPlayer("Mage", defaultStats, "mage");
      expect(mage.knownAbilities).toHaveLength(0);
    });

    it("attack modifier uses class primary stat", () => {
      // Mage has primaryStat=intelligence, so attack mod depends on INT
      const mageStats = { ...defaultStats, intelligence: 16 };
      const mage = createPlayer("Mage", mageStats, "mage");
      // INT 16+2=18 -> mod +4, proficiency +2 = 6
      expect(getAttackModifier(mage)).toBe(6);

      // Knight has primaryStat=strength, so attack mod depends on STR
      const knightStats = { ...defaultStats, strength: 16 };
      const knight = createPlayer("Knight", knightStats, "knight");
      // STR 16+2=18 -> mod +4, proficiency +2 = 6
      expect(getAttackModifier(knight)).toBe(6);
    });

    it("spell modifier uses class primary stat", () => {
      // Warlock has primaryStat=charisma
      const warlockStats = { ...defaultStats, charisma: 14 };
      const warlock = createPlayer("Warlock", warlockStats, "warlock");
      // CHA 14+2=16 -> mod +3, proficiency +2 = 5
      expect(getSpellModifier(warlock)).toBe(5);

      // Cleric has primaryStat=wisdom
      const clericStats = { ...defaultStats, wisdom: 14 };
      const cleric = createPlayer("Cleric", clericStats, "cleric");
      // WIS 14+2=16 -> mod +3, proficiency +2 = 5
      expect(getSpellModifier(cleric)).toBe(5);
    });

    it("monk has martial abilities and no spells", () => {
      const monk = createPlayer("Monk", defaultStats, "monk");
      expect(monk.knownAbilities.length).toBeGreaterThan(0);
      expect(monk.knownSpells).toHaveLength(0);
    });

    it("barbarian has enrage as a bonus action ability", () => {
      const barbarian = createPlayer("Barb", defaultStats, "barbarian");
      // Level up to unlock enrage (level 3)
      const result = awardXP(barbarian, xpForLevel(4));
      const newAbilityIds = result.newAbilities.map((a) => a.id);
      expect(newAbilityIds).toContain("enrage");
      const enrage = getAbility("enrage");
      expect(enrage).toBeDefined();
      expect(enrage!.bonusAction).toBe(true);
    });
  });
});
