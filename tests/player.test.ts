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
  type PlayerState,
} from "../src/systems/player";
import { ITEMS, getItem } from "../src/data/items";

/** Helper: create a player with controlled stats for deterministic testing. */
function createTestPlayer(overrides?: Partial<PlayerState>): PlayerState {
  const player = createPlayer("Test");
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
    it("creates a level 1 player with rolled stats", () => {
      const player = createPlayer("TestHero");
      expect(player.name).toBe("TestHero");
      expect(player.level).toBe(1);
      expect(player.xp).toBe(0);
      // Rolled stats should be in 3-18 range
      for (const val of Object.values(player.stats)) {
        expect(val).toBeGreaterThanOrEqual(3);
        expect(val).toBeLessThanOrEqual(18);
      }
      // HP and MP are derived from CON/INT
      expect(player.maxHp).toBeGreaterThanOrEqual(10);
      expect(player.maxMp).toBeGreaterThanOrEqual(4);
      expect(player.gold).toBe(50);
      expect(player.knownSpells).toContain("fireBolt");
      expect(player.inventory).toHaveLength(0);
      expect(player.pendingStatPoints).toBe(0);
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
});
