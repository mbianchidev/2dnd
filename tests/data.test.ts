import { describe, it, expect } from "vitest";
import {
  MAP_DATA,
  MAP_WIDTH,
  MAP_HEIGHT,
  TOWNS,
  BOSSES,
  Terrain,
  isWalkable,
  getTerrainAt,
  ENCOUNTER_RATES,
} from "../src/data/map";
import { MONSTERS, getRandomEncounter, getBoss } from "../src/data/monsters";
import { SPELLS, getSpell, getAvailableSpells } from "../src/data/spells";
import { ITEMS, getItem, getShopItems } from "../src/data/items";

describe("game data", () => {
  describe("map", () => {
    it("has correct dimensions", () => {
      expect(MAP_DATA).toHaveLength(MAP_HEIGHT);
      for (const row of MAP_DATA) {
        expect(row).toHaveLength(MAP_WIDTH);
      }
    });

    it("has walkable town tiles", () => {
      for (const town of TOWNS) {
        const terrain = getTerrainAt(town.x, town.y);
        expect(terrain).toBe(Terrain.Town);
        expect(isWalkable(Terrain.Town)).toBe(true);
      }
    });

    it("has boss tiles at boss locations", () => {
      for (const boss of BOSSES) {
        const terrain = getTerrainAt(boss.x, boss.y);
        expect(terrain).toBe(Terrain.Boss);
      }
    });

    it("returns undefined for out of bounds", () => {
      expect(getTerrainAt(-1, 0)).toBeUndefined();
      expect(getTerrainAt(0, -1)).toBeUndefined();
      expect(getTerrainAt(MAP_WIDTH, 0)).toBeUndefined();
      expect(getTerrainAt(0, MAP_HEIGHT)).toBeUndefined();
    });

    it("water and mountain are not walkable", () => {
      expect(isWalkable(Terrain.Water)).toBe(false);
      expect(isWalkable(Terrain.Mountain)).toBe(false);
    });

    it("towns have no random encounters", () => {
      expect(ENCOUNTER_RATES[Terrain.Town]).toBe(0);
      expect(ENCOUNTER_RATES[Terrain.Water]).toBe(0);
    });
  });

  describe("monsters", () => {
    it("has both bosses and non-bosses", () => {
      const bosses = MONSTERS.filter((m) => m.isBoss);
      const nonBosses = MONSTERS.filter((m) => !m.isBoss);
      expect(bosses.length).toBeGreaterThan(0);
      expect(nonBosses.length).toBeGreaterThan(0);
    });

    it("getRandomEncounter returns a non-boss", () => {
      for (let i = 0; i < 20; i++) {
        const monster = getRandomEncounter(1);
        expect(monster.isBoss).toBe(false);
        expect(monster.hp).toBeGreaterThan(0);
      }
    });

    it("getRandomEncounter returns a copy", () => {
      const m1 = getRandomEncounter(1);
      const m2 = getRandomEncounter(1);
      m1.hp = 0;
      // m2 should not be affected
      expect(m2.hp).toBeGreaterThan(0);
    });

    it("getBoss returns boss by ID", () => {
      const troll = getBoss("troll");
      expect(troll).toBeDefined();
      expect(troll!.name).toBe("Cave Troll");
      expect(troll!.isBoss).toBe(true);
    });

    it("getBoss returns undefined for non-boss ID", () => {
      expect(getBoss("slime")).toBeUndefined();
      expect(getBoss("nonexistent")).toBeUndefined();
    });
  });

  describe("spells", () => {
    it("has spells at various level requirements", () => {
      const levels = new Set(SPELLS.map((s) => s.levelRequired));
      expect(levels.size).toBeGreaterThan(3);
    });

    it("getSpell looks up by ID", () => {
      const fb = getSpell("fireBolt");
      expect(fb).toBeDefined();
      expect(fb!.name).toBe("Fire Bolt");
    });

    it("getAvailableSpells filters by level", () => {
      const level1 = getAvailableSpells(1);
      const level5 = getAvailableSpells(5);
      expect(level5.length).toBeGreaterThan(level1.length);
    });

    it("has both damage and heal spells", () => {
      const types = new Set(SPELLS.map((s) => s.type));
      expect(types.has("damage")).toBe(true);
      expect(types.has("heal")).toBe(true);
    });
  });

  describe("items", () => {
    it("has consumables, weapons, and armor", () => {
      const types = new Set(ITEMS.map((i) => i.type));
      expect(types.has("consumable")).toBe(true);
      expect(types.has("weapon")).toBe(true);
      expect(types.has("armor")).toBe(true);
    });

    it("getItem looks up by ID", () => {
      const potion = getItem("potion");
      expect(potion).toBeDefined();
      expect(potion!.name).toBe("Healing Potion");
    });

    it("getShopItems returns purchasable items", () => {
      const shopItems = getShopItems();
      expect(shopItems.length).toBeGreaterThan(0);
      for (const item of shopItems) {
        expect(item.cost).toBeGreaterThan(0);
      }
    });
  });
});
