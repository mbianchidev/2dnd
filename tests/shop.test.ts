/**
 * Tests for shop selling functionality
 */

import { describe, it, expect } from "vitest";
import { getSellValue, canSellItem, getItem } from "../src/data/items";
import {
  createPlayer,
  sellItem,
  isLastEquipment,
  type PlayerState,
} from "../src/systems/player";

function createTestPlayer(): PlayerState {
  const player = createPlayer("TestHero", {
    strength: 10, dexterity: 10, constitution: 10,
    intelligence: 10, wisdom: 10, charisma: 10,
  });
  player.gold = 100;
  return player;
}

describe("shop selling system", () => {
  describe("getSellValue", () => {
    it("returns 50% of cost for regular items", () => {
      const potion = getItem("potion")!;
      expect(getSellValue(potion)).toBe(7); // 15g -> 7g (floor of 7.5)
      
      const shortSword = getItem("shortSword")!;
      expect(getSellValue(shortSword)).toBe(15); // 30g -> 15g
    });

    it("returns 0 for treasure items (cost=0)", () => {
      const flameBlade = getItem("flameBlade")!;
      expect(flameBlade.cost).toBe(0);
      expect(getSellValue(flameBlade)).toBe(0);
    });

    it("returns 0 for quest items (dungeon key)", () => {
      const dungeonKey = getItem("dungeonKey")!;
      expect(getSellValue(dungeonKey)).toBe(0);
    });

    it("returns at least 1g for items with very low cost", () => {
      // Even if cost is 1g, sell value should be at least 1g
      const item = { ...getItem("potion")!, cost: 1 };
      expect(getSellValue(item)).toBe(1);
    });
  });

  describe("canSellItem", () => {
    it("returns false for treasure items", () => {
      const flameBlade = getItem("flameBlade")!;
      expect(canSellItem(flameBlade)).toBe(false);
    });

    it("returns false for quest items", () => {
      const dungeonKey = getItem("dungeonKey")!;
      expect(canSellItem(dungeonKey)).toBe(false);
    });

    it("returns true for regular shop items", () => {
      const potion = getItem("potion")!;
      expect(canSellItem(potion)).toBe(true);
      
      const shortSword = getItem("shortSword")!;
      expect(canSellItem(shortSword)).toBe(true);
    });
  });

  describe("isLastEquipment", () => {
    it("returns true if player has only one weapon", () => {
      const player = createTestPlayer();
      // Player starts with one weapon equipped and one in inventory (the same weapon)
      expect(player.equippedWeapon).not.toBeNull();
      const weaponCount = player.inventory.filter(i => i.type === "weapon").length;
      expect(weaponCount).toBe(1);
      
      const weapon = player.equippedWeapon!;
      expect(isLastEquipment(player, weapon)).toBe(true);
    });

    it("returns false if player has multiple weapons", () => {
      const player = createTestPlayer();
      const shortSword = getItem("shortSword")!;
      player.inventory.push({ ...shortSword });
      
      const weapon = player.equippedWeapon!;
      expect(isLastEquipment(player, weapon)).toBe(false);
    });

    it("returns true if player has only one armor piece", () => {
      const player = createTestPlayer();
      const leather = getItem("leatherArmor")!;
      player.inventory.push({ ...leather });
      player.equippedArmor = null;
      
      expect(isLastEquipment(player, leather)).toBe(true);
    });

    it("returns false if player has multiple armor pieces", () => {
      const player = createTestPlayer();
      const leather = getItem("leatherArmor")!;
      const chain = getItem("chainMail")!;
      player.inventory.push({ ...leather });
      player.inventory.push({ ...chain });
      
      expect(isLastEquipment(player, leather)).toBe(false);
    });

    it("returns false for non-equipment items", () => {
      const player = createTestPlayer();
      const potion = getItem("potion")!;
      player.inventory.push({ ...potion });
      
      expect(isLastEquipment(player, potion)).toBe(false);
    });
  });

  describe("sellItem", () => {
    it("removes item from inventory and awards gold", () => {
      const player = createTestPlayer();
      const potion = getItem("potion")!;
      player.inventory.push({ ...potion });
      const initialGold = player.gold;
      const inventorySize = player.inventory.length;
      
      const sellValue = getSellValue(potion);
      const result = sellItem(player, inventorySize - 1, sellValue);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain("Sold");
      expect(player.inventory.length).toBe(inventorySize - 1);
      expect(player.gold).toBe(initialGold + sellValue);
    });

    it("fails if item index is invalid", () => {
      const player = createTestPlayer();
      const result = sellItem(player, 999, 10);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid");
    });

    it("fails if sell value is 0", () => {
      const player = createTestPlayer();
      const flameBlade = getItem("flameBlade")!;
      player.inventory.push({ ...flameBlade });
      
      const result = sellItem(player, player.inventory.length - 1, 0);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain("cannot be sold");
    });

    it("correctly handles selling multiple items", () => {
      const player = createTestPlayer();
      const potion = getItem("potion")!;
      player.inventory.push({ ...potion });
      player.inventory.push({ ...potion });
      player.inventory.push({ ...potion });
      const initialGold = player.gold;
      const sellValue = getSellValue(potion);
      
      // Sell all three potions
      sellItem(player, player.inventory.length - 1, sellValue);
      sellItem(player, player.inventory.length - 1, sellValue);
      sellItem(player, player.inventory.length - 1, sellValue);
      
      expect(player.gold).toBe(initialGold + sellValue * 3);
    });
  });
});
