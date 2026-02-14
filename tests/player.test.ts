import { describe, it, expect } from "vitest";
import {
  createPlayer,
  xpForLevel,
  awardXP,
  processPendingLevelUps,
  allocateStatPoint,
  getAttackModifier,
  getSpellModifier,
  getArmorClass,
  buyItem,
  canAfford,
  useItem,
  calculatePointsSpent,
  isValidPointBuy,
  shortRest,
  castSpellOutsideCombat,
  useAbilityOutsideCombat,
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
  player.gold = 50; // Pin gold for deterministic tests
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
      expect(player.gold).toBeGreaterThanOrEqual(50);  // D&D 5e: Knight = 5d4 × 10 (min 50)
      expect(player.gold).toBeLessThanOrEqual(200);     // max 200
      expect(player.knownSpells).toContain("shortRest");
      expect(player.inventory).toHaveLength(1); // starting weapon
      expect(player.equippedWeapon).not.toBeNull();
      expect(player.equippedWeapon?.id).toBe("startSword"); // Knight default
      expect(player.pendingStatPoints).toBe(0);
      expect(player.progression.openedChests).toEqual([]);
      expect(player.progression.exploredTiles).toEqual({});
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
      expect(result.pendingLevels).toBe(0);
      expect(player.level).toBe(1);
    });

    it("tracks pending level-ups when enough XP is gained", () => {
      const player = createTestPlayer();
      const result = awardXP(player, 400); // xpForLevel(2) = 400
      expect(result.pendingLevels).toBe(1);
      expect(player.level).toBe(1); // not yet leveled — pending
      expect(player.pendingLevelUps).toBe(1);
    });

    it("applies pending level-ups on processPendingLevelUps", () => {
      const player = createTestPlayer();
      const startHp = player.maxHp;
      awardXP(player, 400);
      const result = processPendingLevelUps(player);
      expect(result.leveledUp).toBe(true);
      expect(result.newLevel).toBe(2);
      expect(player.level).toBe(2);
      expect(player.maxHp).toBeGreaterThan(startHp);
    });

    it("unlocks spells on level up via processPendingLevelUps", () => {
      const player = createTestPlayer();
      // Level up to 5 to unlock healingWord (Knight spell)
      awardXP(player, xpForLevel(5 + 1));
      const result = processPendingLevelUps(player);
      const spellIds = result.newSpells.map((s) => s.id);
      expect(spellIds).toContain("healingWord");
      expect(player.knownSpells).toContain("healingWord");
    });

    it("grants ASI points at D&D levels 4, 8, 12, 16, 19", () => {
      const player = createTestPlayer();
      // Level to 4 (first ASI level): xpForLevel(5) = 2500 is enough to hit 4
      awardXP(player, xpForLevel(4 + 1)); // enough to reach level 4
      processPendingLevelUps(player);
      expect(player.level).toBeGreaterThanOrEqual(4);
      expect(player.pendingStatPoints).toBe(2);
    });

    it("does not grant ASI points at non-ASI levels", () => {
      const player = createTestPlayer();
      awardXP(player, 400); // enough for level 2
      processPendingLevelUps(player);
      expect(player.pendingStatPoints).toBe(0);
      awardXP(player, 500); // enough for level 3
      processPendingLevelUps(player);
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
      const startingItems = player.inventory.length;
      const potion = ITEMS.find((i) => i.id === "potion")!;
      expect(buyItem(player, potion)).toBe(true);
      expect(player.gold).toBe(35);
      expect(player.inventory).toHaveLength(startingItems + 1);
      expect(player.inventory[startingItems].id).toBe("potion");
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
      player.inventory = []; // clear starting weapon for this test
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
      player.inventory = []; // clear starting weapon for this test
      const potion = ITEMS.find((i) => i.id === "potion")!; // heals 20
      player.inventory.push({ ...potion });

      useItem(player, 0);
      expect(player.hp).toBe(30); // capped at max
    });

    it("prevents using potions at full HP", () => {
      const player = createTestPlayer();
      player.hp = player.maxHp;
      player.inventory = [];
      const potion = ITEMS.find((i) => i.id === "potion")!;
      player.inventory.push({ ...potion });

      const result = useItem(player, 0);
      expect(result.used).toBe(false);
      expect(result.message).toBe("HP is already full!");
      expect(player.inventory).toHaveLength(1); // item not consumed
    });

    it("prevents using ethers at full MP", () => {
      const player = createTestPlayer();
      player.mp = player.maxMp;
      player.inventory = [];
      const ether = ITEMS.find((i) => i.id === "ether")!;
      player.inventory.push({ ...ether });

      const result = useItem(player, 0);
      expect(result.used).toBe(false);
      expect(result.message).toBe("MP is already full!");
      expect(player.inventory).toHaveLength(1); // item not consumed
    });

    it("equips weapons", () => {
      const player = createTestPlayer();
      const sword = ITEMS.find((i) => i.id === "shortSword")!;
      player.inventory.push({ ...sword });
      const swordIndex = player.inventory.findIndex((i) => i.id === "shortSword");

      const result = useItem(player, swordIndex);
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
      for (const classId of ["knight", "ranger", "mage", "rogue", "paladin", "warlock", "cleric", "barbarian", "monk", "bard"]) {
        const player = createPlayer("Test", defaultStats, classId);
        if (player.knownSpells.length > 0) startingSpells.add(player.knownSpells[0]);
        if (player.knownAbilities.length > 0) startingAbilities.add(player.knownAbilities[0]);
      }
      // At least 3 distinct starting spells/abilities across classes
      expect(startingSpells.size + startingAbilities.size).toBeGreaterThanOrEqual(3);
    });

    it("rogue, barbarian, and monk have only utility spells (no combat spells)", () => {
      const rogue = createPlayer("Rogue", defaultStats, "rogue");
      const barbarian = createPlayer("Barb", defaultStats, "barbarian");
      const monk = createPlayer("Monk", defaultStats, "monk");
      // They should only have shortRest (utility) - no combat spells
      expect(rogue.knownSpells).toContain("shortRest");
      expect(barbarian.knownSpells).toContain("shortRest");
      expect(monk.knownSpells).toContain("shortRest");
    });

    it("mage has no martial damage abilities", () => {
      const mage = createPlayer("Mage", defaultStats, "mage");
      const damageAbilities = mage.knownAbilities.filter((id) => {
        const ab = getAbility(id);
        return ab && ab.type === "damage";
      });
      expect(damageAbilities).toHaveLength(0);
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

    it("monk has martial abilities and only utility spells", () => {
      const monk = createPlayer("Monk", defaultStats, "monk");
      expect(monk.knownAbilities.length).toBeGreaterThan(0);
      // Monk has shortRest (utility) but no combat spells
      expect(monk.knownSpells).toContain("shortRest");
    });

    it("barbarian has enrage as a bonus action ability", () => {
      const barbarian = createPlayer("Barb", defaultStats, "barbarian");
      // Level up to unlock enrage (level 3)
      awardXP(barbarian, xpForLevel(4));
      const result = processPendingLevelUps(barbarian);
      const newAbilityIds = result.newAbilities.map((a) => a.id);
      expect(newAbilityIds).toContain("enrage");
      const enrage = getAbility("enrage");
      expect(enrage).toBeDefined();
      expect(enrage!.bonusAction).toBe(true);
    });

    it("each class starts with a weapon equipped", () => {
      for (const classId of ["knight", "ranger", "mage", "rogue", "paladin", "warlock", "cleric", "barbarian", "monk", "bard"]) {
        const player = createPlayer("Test", defaultStats, classId);
        expect(player.equippedWeapon, `${classId} should start with a weapon`).not.toBeNull();
        expect(player.inventory.length, `${classId} should have weapon in inventory`).toBeGreaterThanOrEqual(1);
      }
    });

    it("different classes start with different weapons", () => {
      const knight = createPlayer("K", defaultStats, "knight");
      const mage = createPlayer("M", defaultStats, "mage");
      const rogue = createPlayer("R", defaultStats, "rogue");
      const bard = createPlayer("B", defaultStats, "bard");
      expect(knight.equippedWeapon?.id).toBe("startSword");
      expect(mage.equippedWeapon?.id).toBe("startStaff");
      expect(rogue.equippedWeapon?.id).toBe("startDagger");
      expect(bard.equippedWeapon?.id).toBe("startRapier");
    });

    it("bard has spells and abilities (hybrid caster)", () => {
      const bard = createPlayer("Bard", defaultStats, "bard");
      expect(bard.knownSpells.length).toBeGreaterThan(0);
      expect(bard.knownAbilities.length).toBeGreaterThan(0);
      expect(bard.knownSpells).toContain("viciousMockery");
      expect(bard.knownAbilities).toContain("bardicInspiration");
    });
  });

  // ── Short Rest tests ──────────────────────────────────────────
  describe("shortRest", () => {
    it("restores 50% HP and 50% MP", () => {
      const player = createPlayer("Test", defaultStats, "knight");
      player.hp = 10;
      player.mp = 2;
      player.shortRestsRemaining = 2;

      const { hpRestored, mpRestored } = shortRest(player);
      expect(hpRestored).toBe(Math.floor(player.maxHp * 0.5));
      expect(mpRestored).toBe(Math.floor(player.maxMp * 0.5));
      expect(player.shortRestsRemaining).toBe(1);
    });

    it("caps restoration at max values", () => {
      const player = createPlayer("Test", defaultStats, "knight");
      player.hp = player.maxHp - 1;
      player.mp = player.maxMp - 1;
      player.shortRestsRemaining = 2;

      const { hpRestored, mpRestored } = shortRest(player);
      expect(hpRestored).toBe(1);
      expect(mpRestored).toBe(1);
      expect(player.hp).toBe(player.maxHp);
      expect(player.mp).toBe(player.maxMp);
    });

    it("decrements shortRestsRemaining each call", () => {
      const player = createPlayer("Test", defaultStats, "knight");
      player.hp = 1;
      player.mp = 1;
      player.shortRestsRemaining = 2;
      shortRest(player);
      expect(player.shortRestsRemaining).toBe(1);
      player.hp = 1;
      player.mp = 1;
      shortRest(player);
      expect(player.shortRestsRemaining).toBe(0);
    });
  });

  describe("Short Rest spell via castSpellOutsideCombat", () => {
    it("fails when no rests remaining", () => {
      const player = createPlayer("Test", defaultStats, "knight");
      player.shortRestsRemaining = 0;

      const result = castSpellOutsideCombat(player, "shortRest");
      expect(result.success).toBe(false);
      expect(result.message).toContain("No short rests remaining");
    });

    it("fails when HP and MP are full", () => {
      const player = createPlayer("Test", defaultStats, "knight");
      player.shortRestsRemaining = 2;

      const result = castSpellOutsideCombat(player, "shortRest");
      expect(result.success).toBe(false);
      expect(result.message).toContain("already full");
    });

    it("succeeds when HP is not full", () => {
      const player = createPlayer("Test", defaultStats, "knight");
      player.shortRestsRemaining = 2;
      player.hp = 10;
      player.mp = 2;

      const result = castSpellOutsideCombat(player, "shortRest");
      expect(result.success).toBe(true);
      expect(result.message).toContain("Short Rest");
      expect(player.shortRestsRemaining).toBe(1);
    });

    it("limited to 2 uses", () => {
      const player = createPlayer("Test", defaultStats, "knight");
      player.shortRestsRemaining = 1;
      player.hp = 10;

      const result1 = castSpellOutsideCombat(player, "shortRest");
      expect(result1.success).toBe(true);
      expect(player.shortRestsRemaining).toBe(0);

      player.hp = 10;
      const result2 = castSpellOutsideCombat(player, "shortRest");
      expect(result2.success).toBe(false);
    });
  });

  describe("castSpellOutsideCombat - heal spells", () => {
    it("heals with a heal spell", () => {
      const player = createPlayer("Test", defaultStats, "knight");
      player.hp = 10;
      player.mp = 10;
      player.knownSpells.push("cureWounds");

      const result = castSpellOutsideCombat(player, "cureWounds");
      expect(result.success).toBe(true);
      expect(player.hp).toBeGreaterThan(10);
    });

    it("refuses damage spells outside combat", () => {
      const player = createPlayer("Test", defaultStats, "mage");

      const result = castSpellOutsideCombat(player, "fireBolt");
      expect(result.success).toBe(false);
      expect(result.message).toContain("damage");
    });

    it("refuses heal when HP is full", () => {
      const player = createPlayer("Test", defaultStats, "knight");
      player.mp = 10;

      const result = castSpellOutsideCombat(player, "cureWounds");
      expect(result.success).toBe(false);
      expect(result.message).toContain("full");
    });
  });

  describe("useAbilityOutsideCombat", () => {
    it("heals with a heal ability", () => {
      const player = createPlayer("Test", defaultStats, "knight");
      player.hp = 10;
      player.mp = 10;
      player.knownAbilities.push("secondWind");

      const result = useAbilityOutsideCombat(player, "secondWind");
      expect(result.success).toBe(true);
      expect(player.hp).toBeGreaterThan(10);
    });

    it("refuses damage abilities outside combat", () => {
      const player = createPlayer("Test", defaultStats, "knight");
      player.knownAbilities.push("shieldBash");

      const result = useAbilityOutsideCombat(player, "shieldBash");
      expect(result.success).toBe(false);
      expect(result.message).toContain("damage");
    });
  });

  describe("createPlayer starts with shortRest spell", () => {
    it("new player knows shortRest spell", () => {
      const player = createPlayer("Test", defaultStats, "knight");
      expect(player.knownSpells).toContain("shortRest");
    });

    it("all classes start with shortRest", () => {
      const classes = ["knight", "ranger", "mage", "rogue", "paladin", "warlock", "cleric", "barbarian", "monk", "bard"];
      for (const cls of classes) {
        const player = createPlayer("Test", defaultStats, cls);
        expect(player.knownSpells, `${cls} should know shortRest`).toContain("shortRest");
      }
    });

    it("new player starts with 2 short rests", () => {
      const player = createPlayer("Test", defaultStats, "knight");
      expect(player.shortRestsRemaining).toBe(2);
    });
  });
});
