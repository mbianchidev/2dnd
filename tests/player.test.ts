import { describe, it, expect } from "vitest";
import {
  createPlayer,
  xpForLevel,
  awardXP,
  getAttackModifier,
  getSpellModifier,
  getArmorClass,
  buyItem,
  canAfford,
  useItem,
  type PlayerState,
} from "../src/systems/player";
import { ITEMS, getItem } from "../src/data/items";

describe("player system", () => {
  describe("createPlayer", () => {
    it("creates a level 1 player with default stats", () => {
      const player = createPlayer("TestHero");
      expect(player.name).toBe("TestHero");
      expect(player.level).toBe(1);
      expect(player.xp).toBe(0);
      expect(player.hp).toBe(30);
      expect(player.maxHp).toBe(30);
      expect(player.mp).toBe(10);
      expect(player.maxMp).toBe(10);
      expect(player.gold).toBe(50);
      expect(player.knownSpells).toContain("fireBolt");
      expect(player.inventory).toHaveLength(0);
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
      const player = createPlayer("Test");
      const result = awardXP(player, 100);
      expect(player.xp).toBe(100);
      expect(result.leveledUp).toBe(false);
      expect(result.newLevel).toBe(1);
    });

    it("levels up when enough XP is gained", () => {
      const player = createPlayer("Test");
      const result = awardXP(player, 400); // xpForLevel(2) = 400
      expect(result.leveledUp).toBe(true);
      expect(result.newLevel).toBe(2);
      expect(player.level).toBe(2);
      expect(player.maxHp).toBeGreaterThan(30);
    });

    it("unlocks spells on level up", () => {
      const player = createPlayer("Test");
      // Level up to 3 to unlock magicMissile
      const result = awardXP(player, 900);
      const spellIds = result.newSpells.map((s) => s.id);
      expect(spellIds).toContain("cureWounds");
      expect(player.knownSpells).toContain("cureWounds");
    });
  });

  describe("modifiers", () => {
    it("calculates attack modifier correctly", () => {
      const player = createPlayer("Test");
      // STR 12 -> mod +1, proficiency at level 1 = +2, total = +3
      expect(getAttackModifier(player)).toBe(3);
    });

    it("calculates spell modifier correctly", () => {
      const player = createPlayer("Test");
      // INT 10 -> mod 0, proficiency = +2, total = +2
      expect(getSpellModifier(player)).toBe(2);
    });

    it("calculates armor class correctly", () => {
      const player = createPlayer("Test");
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
      const player = createPlayer("Test");
      expect(canAfford(player, 50)).toBe(true);
      expect(canAfford(player, 51)).toBe(false);
    });

    it("buys items and deducts gold", () => {
      const player = createPlayer("Test");
      const potion = ITEMS.find((i) => i.id === "potion")!;
      expect(buyItem(player, potion)).toBe(true);
      expect(player.gold).toBe(35);
      expect(player.inventory).toHaveLength(1);
      expect(player.inventory[0].id).toBe("potion");
    });

    it("fails to buy when insufficient gold", () => {
      const player = createPlayer("Test");
      player.gold = 5;
      const potion = ITEMS.find((i) => i.id === "potion")!;
      expect(buyItem(player, potion)).toBe(false);
      expect(player.gold).toBe(5);
    });

    it("uses healing potions", () => {
      const player = createPlayer("Test");
      player.hp = 10;
      const potion = ITEMS.find((i) => i.id === "potion")!;
      player.inventory.push({ ...potion });

      const result = useItem(player, 0);
      expect(result.used).toBe(true);
      expect(player.hp).toBe(30); // 10 + 20
      expect(player.inventory).toHaveLength(0);
    });

    it("caps healing at max HP", () => {
      const player = createPlayer("Test");
      player.hp = 25; // 5 below max
      const potion = ITEMS.find((i) => i.id === "potion")!; // heals 20
      player.inventory.push({ ...potion });

      useItem(player, 0);
      expect(player.hp).toBe(30); // capped at max
    });

    it("equips weapons", () => {
      const player = createPlayer("Test");
      const sword = ITEMS.find((i) => i.id === "shortSword")!;
      player.inventory.push({ ...sword });

      const result = useItem(player, 0);
      expect(result.used).toBe(true);
      expect(player.equippedWeapon?.id).toBe("shortSword");
    });
  });
});
