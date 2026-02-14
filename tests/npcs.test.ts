import { describe, it, expect } from "vitest";
import {
  NPC_TEMPLATES,
  getNpcTemplate,
  CITY_NPCS,
  getNpcColors,
  getNpcDialogue,
  getShopkeeperDialogue,
  VILLAGER_DIALOGUES,
  VILLAGER_NIGHT_DIALOGUES,
  CHILD_DIALOGUES,
  SHOPKEEPER_DIALOGUES,
  GUARD_DIALOGUES,
  GUARD_NIGHT_DIALOGUES,
  NPC_SKIN_COLORS,
  NPC_HAIR_COLORS,
  NPC_DRESS_COLORS,
  JOB_ACCENT_COLORS,
  SPECIAL_NPC_KINDS,
  SPECIAL_NPC_DEFS,
  TRAVELER_DIALOGUES,
  ADVENTURER_DIALOGUES,
  WANDERING_MERCHANT_DIALOGUES,
  HERMIT_DIALOGUES,
  HERMIT_FAREWELL,
  SPECIAL_NPC_FAREWELLS,
  getSpecialNpcDialogue,
  rollSpecialNpcSpawns,
  type NpcAgeGroup,
} from "../src/data/npcs";
import { CITIES } from "../src/data/map";

describe("NPC system", () => {
  describe("NPC templates", () => {
    it("should have at least 5 child templates", () => {
      const children = NPC_TEMPLATES.filter((t) => t.ageGroup === "child");
      expect(children.length).toBeGreaterThanOrEqual(5);
    });

    it("should have at least 5 male adult templates", () => {
      const males = NPC_TEMPLATES.filter((t) => t.ageGroup === "male");
      expect(males.length).toBeGreaterThanOrEqual(5);
    });

    it("should have at least 5 female adult templates", () => {
      const females = NPC_TEMPLATES.filter((t) => t.ageGroup === "female");
      expect(females.length).toBeGreaterThanOrEqual(5);
    });

    it("should have unique IDs", () => {
      const ids = NPC_TEMPLATES.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("children should have smaller heightScale", () => {
      for (const t of NPC_TEMPLATES) {
        if (t.ageGroup === "child") {
          expect(t.heightScale).toBeLessThan(1);
        } else {
          expect(t.heightScale).toBeGreaterThanOrEqual(1);
        }
      }
    });

    it("getNpcTemplate returns the correct template", () => {
      const tpl = getNpcTemplate("male_tall");
      expect(tpl).toBeDefined();
      expect(tpl!.ageGroup).toBe("male");
      expect(tpl!.label).toBe("Man");
    });

    it("getNpcTemplate returns undefined for unknown ID", () => {
      expect(getNpcTemplate("nonexistent")).toBeUndefined();
    });
  });

  describe("colour palettes", () => {
    it("should have at least 5 skin colours", () => {
      expect(NPC_SKIN_COLORS.length).toBeGreaterThanOrEqual(5);
    });

    it("should have at least 5 hair colours", () => {
      expect(NPC_HAIR_COLORS.length).toBeGreaterThanOrEqual(5);
    });

    it("should have at least 5 dress colours", () => {
      expect(NPC_DRESS_COLORS.length).toBeGreaterThanOrEqual(5);
    });

    it("job accent colours cover all job types", () => {
      const jobs = ["blacksmith", "innkeeper", "farmer", "merchant", "cook", "villager"];
      for (const j of jobs) {
        expect(JOB_ACCENT_COLORS[j as keyof typeof JOB_ACCENT_COLORS]).toBeDefined();
      }
    });
  });

  describe("getNpcColors determinism", () => {
    it("should return same colours for same city+index", () => {
      const a = getNpcColors("willowdale_city", 0);
      const b = getNpcColors("willowdale_city", 0);
      expect(a).toEqual(b);
    });

    it("should return different colours for different index", () => {
      const a = getNpcColors("willowdale_city", 0);
      const b = getNpcColors("willowdale_city", 5);
      // They may occasionally collide, but generally differ
      expect(a.skinColor !== b.skinColor || a.hairColor !== b.hairColor || a.dressColor !== b.dressColor).toBe(true);
    });

    it("should return valid palette colours", () => {
      const c = getNpcColors("ironhold_city", 3);
      expect(NPC_SKIN_COLORS).toContain(c.skinColor);
      expect(NPC_HAIR_COLORS).toContain(c.hairColor);
      expect(NPC_DRESS_COLORS).toContain(c.dressColor);
    });
  });

  describe("dialogue system", () => {
    it("villager dialogues pool is non-empty", () => {
      expect(VILLAGER_DIALOGUES.length).toBeGreaterThan(0);
    });

    it("child dialogues pool is non-empty", () => {
      expect(CHILD_DIALOGUES.length).toBeGreaterThan(0);
    });

    it("shopkeeper dialogues cover all shop types", () => {
      const types = ["weapon", "armor", "magic", "general", "inn", "bank"];
      for (const t of types) {
        expect(SHOPKEEPER_DIALOGUES[t]).toBeDefined();
        expect(SHOPKEEPER_DIALOGUES[t].length).toBeGreaterThan(0);
      }
    });

    it("getNpcDialogue returns a string from the correct pool", () => {
      const childLine = getNpcDialogue("test_city", 0, "child");
      expect(CHILD_DIALOGUES).toContain(childLine);

      const adultLine = getNpcDialogue("test_city", 1, "male");
      expect(VILLAGER_DIALOGUES).toContain(adultLine);
    });

    it("getNpcDialogue is deterministic", () => {
      const a = getNpcDialogue("willowdale_city", 5, "female");
      const b = getNpcDialogue("willowdale_city", 5, "female");
      expect(a).toBe(b);
    });

    it("getNpcDialogue uses night pool when nightTime is true", () => {
      const nightLine = getNpcDialogue("test_city", 1, "male", undefined, true);
      expect(VILLAGER_NIGHT_DIALOGUES).toContain(nightLine);
    });

    it("getNpcDialogue uses night guard pool when nightTime is true", () => {
      const nightGuardLine = getNpcDialogue("test_city", 0, "male", "guard_male", true);
      expect(GUARD_NIGHT_DIALOGUES).toContain(nightGuardLine);
    });

    it("getNpcDialogue uses day guard pool when nightTime is false", () => {
      const dayGuardLine = getNpcDialogue("test_city", 0, "male", "guard_male", false);
      expect(GUARD_DIALOGUES).toContain(dayGuardLine);
    });

    it("getShopkeeperDialogue returns a string from the correct pool", () => {
      const line = getShopkeeperDialogue("weapon", 0);
      expect(SHOPKEEPER_DIALOGUES["weapon"]).toContain(line);
    });

    it("getShopkeeperDialogue falls back to general for unknown type", () => {
      const line = getShopkeeperDialogue("unknown", 0);
      expect(SHOPKEEPER_DIALOGUES["general"]).toContain(line);
    });
  });

  describe("city NPC assignments", () => {
    it("every city with a layout should have NPCs assigned", () => {
      for (const city of CITIES) {
        expect(CITY_NPCS[city.id]).toBeDefined();
        expect(CITY_NPCS[city.id].length).toBeGreaterThan(0);
      }
    });

    it("all NPC templateIds reference valid templates", () => {
      for (const [cityId, npcs] of Object.entries(CITY_NPCS)) {
        for (const npc of npcs) {
          const tpl = getNpcTemplate(npc.templateId);
          expect(tpl).toBeDefined();
        }
      }
    });

    it("shopkeeper NPCs reference valid shop indices", () => {
      for (const city of CITIES) {
        const npcs = CITY_NPCS[city.id];
        if (!npcs) continue;
        for (const npc of npcs) {
          if (npc.shopIndex !== undefined) {
            expect(npc.shopIndex).toBeGreaterThanOrEqual(0);
            expect(npc.shopIndex).toBeLessThan(city.shops.length);
          }
        }
      }
    });

    it("each city should have a mix of moving and stationary NPCs", () => {
      for (const city of CITIES) {
        const npcs = CITY_NPCS[city.id];
        if (!npcs) continue;
        const moving = npcs.filter((n) => n.moves);
        const stationary = npcs.filter((n) => !n.moves);
        expect(moving.length).toBeGreaterThan(0);
        expect(stationary.length).toBeGreaterThan(0);
      }
    });

    it("each city should have at least two different NPC age groups", () => {
      for (const city of CITIES) {
        const npcs = CITY_NPCS[city.id];
        if (!npcs) continue;
        const ageGroups = new Set(npcs.map((n) => getNpcTemplate(n.templateId)?.ageGroup));
        // At least two different age groups
        expect(ageGroups.size).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe("special (rare) NPCs", () => {
    it("should define all 4 special NPC kinds", () => {
      expect(SPECIAL_NPC_KINDS).toEqual(["traveler", "adventurer", "wanderingMerchant", "hermit"]);
    });

    it("each kind should have a valid definition", () => {
      for (const kind of SPECIAL_NPC_KINDS) {
        const def = SPECIAL_NPC_DEFS[kind];
        expect(def).toBeDefined();
        expect(def.label).toBeTruthy();
        expect(def.spawnChance).toBeGreaterThan(0);
        expect(def.spawnChance).toBeLessThanOrEqual(1);
        expect(getNpcTemplate(def.templateId)).toBeDefined();
      }
    });

    it("wandering merchant should have shop items", () => {
      const def = SPECIAL_NPC_DEFS.wanderingMerchant;
      expect(def.shopItems).toBeDefined();
      expect(def.shopItems!.length).toBeGreaterThan(0);
    });

    it("traveler dialogue pool should be non-empty", () => {
      expect(TRAVELER_DIALOGUES.length).toBeGreaterThan(0);
    });

    it("adventurer dialogue pool should be non-empty", () => {
      expect(ADVENTURER_DIALOGUES.length).toBeGreaterThan(0);
    });

    it("wandering merchant dialogue pool should be non-empty", () => {
      expect(WANDERING_MERCHANT_DIALOGUES.length).toBeGreaterThan(0);
    });

    it("hermit dialogue pool should be non-empty", () => {
      expect(HERMIT_DIALOGUES.length).toBeGreaterThan(0);
    });

    it("getSpecialNpcDialogue returns correct pool for each kind", () => {
      expect(TRAVELER_DIALOGUES).toContain(getSpecialNpcDialogue("traveler", 0));
      expect(ADVENTURER_DIALOGUES).toContain(getSpecialNpcDialogue("adventurer", 0));
      expect(WANDERING_MERCHANT_DIALOGUES).toContain(getSpecialNpcDialogue("wanderingMerchant", 0));
      expect(HERMIT_DIALOGUES).toContain(getSpecialNpcDialogue("hermit", 0));
    });

    it("hermit returns farewell after exhausting dialogue lines", () => {
      const farewell = getSpecialNpcDialogue("hermit", HERMIT_DIALOGUES.length);
      expect(farewell).toBe(HERMIT_FAREWELL);
    });

    it("non-hermit kinds return farewell after exhausting dialogue lines", () => {
      const farewell = getSpecialNpcDialogue("traveler", TRAVELER_DIALOGUES.length);
      expect(farewell).toBe(SPECIAL_NPC_FAREWELLS.traveler);
    });

    it("rollSpecialNpcSpawns returns an array of valid kinds", () => {
      // Run it many times to test it doesn't crash
      for (let i = 0; i < 50; i++) {
        const result = rollSpecialNpcSpawns();
        expect(Array.isArray(result)).toBe(true);
        for (const kind of result) {
          expect(SPECIAL_NPC_KINDS).toContain(kind);
        }
      }
    });

    it("rollSpecialNpcSpawns never returns more than one special NPC", () => {
      for (let i = 0; i < 200; i++) {
        const result = rollSpecialNpcSpawns(100); // very high multiplier to ensure spawns
        expect(result.length).toBeLessThanOrEqual(1);
      }
    });

    it("rollSpecialNpcSpawns with multiplier 0 never spawns", () => {
      for (let i = 0; i < 100; i++) {
        const result = rollSpecialNpcSpawns(0);
        expect(result).toEqual([]);
      }
    });
  });
});
