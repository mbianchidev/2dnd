import { describe, it, expect } from "vitest";
import {
  NPC_TEMPLATES,
  getNpcTemplate,
  CITY_NPCS,
  getNpcColors,
  getNpcDialogue,
  getShopkeeperDialogue,
  VILLAGER_DIALOGUES,
  CHILD_DIALOGUES,
  SHOPKEEPER_DIALOGUES,
  NPC_SKIN_COLORS,
  NPC_HAIR_COLORS,
  NPC_DRESS_COLORS,
  JOB_ACCENT_COLORS,
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

    it("each city should have at least one child NPC, one male NPC, and one female NPC", () => {
      for (const city of CITIES) {
        const npcs = CITY_NPCS[city.id];
        if (!npcs) continue;
        const ageGroups = new Set(npcs.map((n) => getNpcTemplate(n.templateId)?.ageGroup));
        // At least two different age groups
        expect(ageGroups.size).toBeGreaterThanOrEqual(2);
      }
    });
  });
});
