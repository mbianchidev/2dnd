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
  castSpellOutsideCombat,
  useAbilityOutsideCombat,
  shortRest,
  calculatePointsSpent,
  isValidPointBuy,
  POINT_BUY_COSTS,
  POINT_BUY_TOTAL,
  type PlayerState,
  type PlayerStats,
} from "../src/systems/player";
import { ITEMS, getItem } from "../src/data/items";

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
      expect(player.knownSpells).toContain("fireBolt");
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
      // Level up to 3 to unlock cureWounds
      const result = awardXP(player, 900);
      const spellIds = result.newSpells.map((s) => s.id);
      expect(spellIds).toContain("cureWounds");
      expect(player.knownSpells).toContain("cureWounds");
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
      // INT 10 -> mod 0, proficiency = +2, total = +2
      expect(getSpellModifier(player)).toBe(2);
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

    it("uses greater healing potions", () => {
      const player = createTestPlayer();
      player.hp = 10;
      const greaterPotion = ITEMS.find((i) => i.id === "greaterPotion")!;
      player.inventory.push({ ...greaterPotion });

      const result = useItem(player, 0);
      expect(result.used).toBe(true);
      expect(player.hp).toBe(Math.min(10 + 50, player.maxHp));
      expect(player.inventory).toHaveLength(0);
    });

    it("uses Chimaera Wing item", () => {
      const player = createTestPlayer();
      const wing = ITEMS.find((i) => i.id === "chimaeraWing")!;
      player.inventory.push({ ...wing });

      const result = useItem(player, 0);
      expect(result.used).toBe(true);
      expect(result.message).toContain("Chimaera Wing");
      expect(player.inventory).toHaveLength(0);
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

  describe("castSpellOutsideCombat", () => {
    it("heals with a heal spell outside combat", () => {
      const player = createTestPlayer();
      player.hp = 10;
      player.mp = 20;
      player.knownSpells.push("cureWounds");

      const result = castSpellOutsideCombat(player, "cureWounds");
      expect(result.success).toBe(true);
      expect(result.message).toContain("healed");
      expect(player.hp).toBeGreaterThan(10);
      expect(player.mp).toBeLessThan(20);
    });

    it("rejects damage spells outside combat", () => {
      const player = createTestPlayer();
      player.mp = 20;
      player.knownSpells.push("fireBolt");

      const result = castSpellOutsideCombat(player, "fireBolt");
      expect(result.success).toBe(false);
      expect(result.message).toContain("damage");
    });

    it("rejects heal spells when HP is full", () => {
      const player = createTestPlayer();
      player.mp = 20;
      player.knownSpells.push("cureWounds");

      const result = castSpellOutsideCombat(player, "cureWounds");
      expect(result.success).toBe(false);
      expect(result.message).toContain("full");
    });

    it("rejects spells when not enough MP", () => {
      const player = createTestPlayer();
      player.hp = 10;
      player.mp = 0;
      player.knownSpells.push("cureWounds");

      const result = castSpellOutsideCombat(player, "cureWounds");
      expect(result.success).toBe(false);
      expect(result.message).toContain("MP");
    });

    it("casts utility spell (Teleport) outside combat", () => {
      const player = createTestPlayer();
      player.mp = 20;
      player.knownSpells.push("teleport");

      const result = castSpellOutsideCombat(player, "teleport");
      expect(result.success).toBe(true);
      expect(result.message).toContain("Teleport");
      expect(player.mp).toBe(12); // 20 - 8
    });

    it("returns failure for unknown spell", () => {
      const player = createTestPlayer();
      const result = castSpellOutsideCombat(player, "nonexistent");
      expect(result.success).toBe(false);
    });
  });

  describe("useAbilityOutsideCombat", () => {
    it("heals with a heal ability outside combat", () => {
      const player = createTestPlayer();
      player.hp = 10;
      player.mp = 20;
      player.knownAbilities = ["secondWind"];

      const result = useAbilityOutsideCombat(player, "secondWind");
      expect(result.success).toBe(true);
      expect(result.message).toContain("healed");
      expect(player.hp).toBeGreaterThan(10);
      expect(player.mp).toBeLessThan(20);
    });

    it("rejects damage abilities outside combat", () => {
      const player = createTestPlayer();
      player.mp = 20;
      player.knownAbilities = ["shieldBash"];

      const result = useAbilityOutsideCombat(player, "shieldBash");
      expect(result.success).toBe(false);
      expect(result.message).toContain("damage");
    });

    it("rejects heal abilities when HP is full", () => {
      const player = createTestPlayer();
      player.mp = 20;
      player.knownAbilities = ["secondWind"];

      const result = useAbilityOutsideCombat(player, "secondWind");
      expect(result.success).toBe(false);
      expect(result.message).toContain("full");
    });

    it("rejects abilities when not enough MP", () => {
      const player = createTestPlayer();
      player.hp = 10;
      player.mp = 0;
      player.knownAbilities = ["secondWind"];

      const result = useAbilityOutsideCombat(player, "secondWind");
      expect(result.success).toBe(false);
      expect(result.message).toContain("MP");
    });

    it("uses utility ability (Fast Travel) outside combat", () => {
      const player = createTestPlayer();
      player.mp = 20;
      player.knownAbilities = ["fastTravel"];

      const result = useAbilityOutsideCombat(player, "fastTravel");
      expect(result.success).toBe(true);
      expect(result.message).toContain("Fast Travel");
      expect(player.mp).toBe(15); // 20 - 5
    });

    it("returns failure for unknown ability", () => {
      const player = createTestPlayer();
      const result = useAbilityOutsideCombat(player, "nonexistent");
      expect(result.success).toBe(false);
    });
  });

  describe("shortRest", () => {
    it("restores 50% HP and 50% MP", () => {
      const player = createTestPlayer();
      player.hp = 10;
      player.mp = 2;
      player.shortRestsRemaining = 2;

      const { hpRestored, mpRestored } = shortRest(player);
      expect(hpRestored).toBe(Math.floor(player.maxHp * 0.5));
      expect(mpRestored).toBe(Math.floor(player.maxMp * 0.5));
      expect(player.shortRestsRemaining).toBe(1);
    });

    it("caps restoration at max values", () => {
      const player = createTestPlayer();
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
      const player = createTestPlayer();
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
      const player = createTestPlayer();
      player.knownSpells.push("shortRest");
      player.shortRestsRemaining = 0;

      const result = castSpellOutsideCombat(player, "shortRest");
      expect(result.success).toBe(false);
      expect(result.message).toContain("No short rests remaining");
    });

    it("fails when HP and MP are full", () => {
      const player = createTestPlayer();
      player.knownSpells.push("shortRest");
      player.shortRestsRemaining = 2;

      const result = castSpellOutsideCombat(player, "shortRest");
      expect(result.success).toBe(false);
      expect(result.message).toContain("already full");
    });

    it("succeeds when HP is not full", () => {
      const player = createTestPlayer();
      player.knownSpells.push("shortRest");
      player.shortRestsRemaining = 2;
      player.hp = 10;
      player.mp = 2;

      const result = castSpellOutsideCombat(player, "shortRest");
      expect(result.success).toBe(true);
      expect(result.message).toContain("Short Rest");
      expect(player.shortRestsRemaining).toBe(1);
      expect(player.hp).toBeGreaterThan(10);
      expect(player.mp).toBeGreaterThan(2);
    });

    it("limited to 2 uses", () => {
      const player = createTestPlayer();
      player.knownSpells.push("shortRest");
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

  describe("createPlayer starts with shortRest spell", () => {
    it("new player knows shortRest spell", () => {
      const player = createPlayer("Test", defaultStats, "knight");
      expect(player.knownSpells).toContain("shortRest");
    });

    it("all classes start with shortRest", () => {
      const classes = ["knight", "ranger", "mage", "rogue", "paladin", "warlock", "cleric", "barbarian"];
      for (const cls of classes) {
        const player = createPlayer("Test", defaultStats, cls);
        expect(player.knownSpells, `${cls} should know shortRest`).toContain("shortRest");
      }
    });

    it("new player starts with 2 short rests", () => {
      const player = createPlayer("Test", defaultStats, "knight");
      expect(player.shortRestsRemaining).toBe(2);
    });

    it("new player also knows fireBolt", () => {
      const player = createPlayer("Test", defaultStats, "knight");
      expect(player.knownSpells).toContain("fireBolt");
    });
  });
});
