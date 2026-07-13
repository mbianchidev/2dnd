import { describe, expect, it } from "vitest";
import { CHESTS, CITIES, Terrain } from "../src/data/map";
import { CITY_NPCS } from "../src/data/npcs";
import {
  EXPLORATION_EVENTS,
  NPC_SKILL_CHALLENGES,
  SHOP_NEGOTIATION_OPTIONS,
  getCityShopSkillCheckId,
  getTownShopSkillCheckId,
} from "../src/data/skillChecks";
import {
  applyNonlethalDamage,
  getMinorTreasureGold,
  getShopNegotiationDiscount,
  resolveSkillCheck,
  selectExplorationEvent,
} from "../src/systems/skillChecks";
import type { PlayerStats } from "../src/systems/player";

const stats: PlayerStats = {
  strength: 10,
  dexterity: 14,
  constitution: 10,
  intelligence: 10,
  wisdom: 8,
  charisma: 12,
};

describe("non-combat skill checks", () => {
  it("uses the selected ability modifier and succeeds when total meets the DC", () => {
    const result = resolveSkillCheck(stats, "dexterity", 12, 10);

    expect(result).toEqual({
      ability: "dexterity",
      naturalRoll: 10,
      modifier: 2,
      total: 12,
      dc: 12,
      success: true,
    });
  });

  it("supports Intelligence and typed flat modifiers", () => {
    const result = resolveSkillCheck(
      { ...stats, intelligence: 16 },
      "intelligence",
      15,
      10,
      { modifierBonus: 2, optionId: "detect" },
    );

    expect(result).toEqual({
      ability: "intelligence",
      naturalRoll: 10,
      modifier: 5,
      total: 15,
      dc: 15,
      success: true,
      optionId: "detect",
    });
  });

  it("does not treat natural 1 or 20 as automatic outcomes", () => {
    const naturalOne = resolveSkillCheck(
      { ...stats, charisma: 20 },
      "charisma",
      6,
      1,
    );
    const naturalTwenty = resolveSkillCheck(
      { ...stats, wisdom: 6 },
      "wisdom",
      19,
      20,
    );

    expect(naturalOne.success).toBe(true);
    expect(naturalTwenty.success).toBe(false);
  });

  it("rejects invalid natural rolls and difficulty classes", () => {
    expect(() => resolveSkillCheck(stats, "wisdom", 10, 0)).toThrow();
    expect(() => resolveSkillCheck(stats, "wisdom", 10, 21)).toThrow();
    expect(() => resolveSkillCheck(stats, "wisdom", 0, 10)).toThrow();
    expect(() => resolveSkillCheck(stats, "wisdom", 10.5, 10)).toThrow();
    expect(() => resolveSkillCheck(
      stats,
      "wisdom",
      10,
      10,
      { modifierBonus: 1.5 },
    )).toThrow();
  });

  it("restores only successful shop negotiation discounts", () => {
    const persuade = SHOP_NEGOTIATION_OPTIONS.find((option) => option.id === "persuade");
    const bluff = SHOP_NEGOTIATION_OPTIONS.find((option) => option.id === "bluff");
    expect(persuade).toBeDefined();
    expect(bluff).toBeDefined();

    expect(getShopNegotiationDiscount({
      ...resolveSkillCheck(stats, "charisma", persuade!.dc, 15),
      optionId: persuade!.id,
    })).toBe(persuade!.discount);
    expect(getShopNegotiationDiscount({
      ...resolveSkillCheck(stats, "charisma", bluff!.dc, 1),
      optionId: bluff!.id,
    })).toBe(0);
    expect(getShopNegotiationDiscount(undefined)).toBe(0);
  });

  it("builds stable city and overworld shop check IDs", () => {
    expect(getCityShopSkillCheckId(
      "willowdale_city",
      0,
      { type: "general", x: 4, y: 5 },
    )).toBe("shop:city:willowdale_city:0:general:4,5");
    expect(getTownShopSkillCheckId(4, 2, 3, 3))
      .toBe("shop:town:4,2,3,3");
  });

  it("uses bounded rewards for Wisdom treasure searches", () => {
    expect(getMinorTreasureGold(true, 0)).toBe(15);
    expect(getMinorTreasureGold(true, 0.999)).toBe(35);
    expect(getMinorTreasureGold(false, 0)).toBe(1);
    expect(getMinorTreasureGold(false, 0.999)).toBe(5);
  });

  it("keeps exploration hazard damage nonlethal", () => {
    expect(applyNonlethalDamage(30, 6)).toBe(24);
    expect(applyNonlethalDamage(4, 10)).toBe(1);
    expect(applyNonlethalDamage(1, 8)).toBe(1);
  });

  it("selects only exploration events valid for the terrain and environment", () => {
    const overworldEvent = selectExplorationEvent(Terrain.Forest, "overworld", 0);
    const dungeonEvent = selectExplorationEvent(Terrain.DungeonFloor, "dungeon", 0);

    expect(overworldEvent?.environments).toContain("overworld");
    expect(overworldEvent?.terrains).toContain(Terrain.Forest);
    expect(dungeonEvent?.environments).toContain("dungeon");
    expect(dungeonEvent?.terrains).toContain(Terrain.DungeonFloor);
    expect(selectExplorationEvent(Terrain.CityFloor, "overworld", 0)).toBeUndefined();
    expect(selectExplorationEvent(Terrain.Forest, "overworld", 0.999)).toBeUndefined();
  });

  it("defines Wisdom discoveries and Dexterity hazards in overworld and dungeons", () => {
    const abilities = new Set(EXPLORATION_EVENTS.map((event) => event.ability));
    expect(abilities).toEqual(new Set(["wisdom", "dexterity"]));
    expect(EXPLORATION_EVENTS.some((event) => event.environments.includes("overworld"))).toBe(true);
    expect(EXPLORATION_EVENTS.some((event) => event.environments.includes("dungeon"))).toBe(true);

    for (const environment of ["overworld", "dungeon"] as const) {
      for (const terrain of Object.values(Terrain).filter((value): value is Terrain => typeof value === "number")) {
        const totalChance = EXPLORATION_EVENTS
          .filter((event) => event.environments.includes(environment) && event.terrains.includes(terrain))
          .reduce((sum, event) => sum + event.chance, 0);
        expect(totalChance).toBeLessThanOrEqual(1);
      }
    }
  });

  it("references stable, unique city NPC identities", () => {
    const ids = new Set<string>();
    for (const challenge of NPC_SKILL_CHALLENGES) {
      expect(ids.has(challenge.id)).toBe(false);
      ids.add(challenge.id);
      expect(CITIES.some((city) => city.id === challenge.cityId)).toBe(true);

      const matches = (CITY_NPCS[challenge.cityId] ?? []).filter((npc) =>
        npc.templateId === challenge.npc.templateId
        && npc.x === challenge.npc.x
        && npc.y === challenge.npc.y
      );
      expect(matches).toHaveLength(1);
      expect(challenge.ability).toBe("charisma");
      expect(["persuade", "bluff"]).toContain(challenge.approach);
    }
  });

  it("adds valid lock, trap, and secret checks to overworld and dungeon chests", () => {
    const checkedChests = CHESTS.filter((chest) => chest.lockDc !== undefined || chest.secretDc !== undefined);
    expect(checkedChests.some((chest) => chest.location.type === "overworld")).toBe(true);
    expect(checkedChests.some((chest) => chest.location.type === "dungeon")).toBe(true);

    for (const chest of checkedChests) {
      if (chest.lockDc !== undefined) {
        expect(chest.lockDc).toBeGreaterThan(0);
        expect(chest.trapDamage).toBeGreaterThan(0);
      }
      if (chest.secretDc !== undefined) {
        expect(chest.secretDc).toBeGreaterThan(0);
        expect(chest.secretGold).toBeGreaterThan(0);
      }
    }
  });
});
