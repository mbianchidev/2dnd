import { describe, it, expect } from "vitest";
import { Element, applyElementalModifier, elementDisplayName } from "../src/data/elements";
import type { ElementalProfile } from "../src/data/elements";
import { ALL_MONSTERS, getMonster } from "../src/data/monsters";
import { SPELLS, getSpell } from "../src/data/spells";
import { ABILITIES, getAbility } from "../src/data/abilities";
import { getItem, ITEMS } from "../src/data/items";
import { playerCastSpell, playerAttack, playerUseAbility } from "../src/systems/combat";
import { createPlayer, type PlayerStats } from "../src/systems/player";
import { createCodex, recordDefeat, discoverElement } from "../src/systems/codex";
import type { Monster } from "../src/data/monsters";

const defaultStats: PlayerStats = {
  strength: 10, dexterity: 10, constitution: 10,
  intelligence: 10, wisdom: 10, charisma: 10,
};

function createTestMonster(overrides?: Partial<Monster>): Monster {
  return {
    id: "testMonster",
    name: "Test Monster",
    hp: 20,
    ac: 12,
    attackBonus: 3,
    damageCount: 1,
    damageDie: 6,
    xpReward: 50,
    goldReward: 10,
    isBoss: false,
    color: 0xff0000,
    ...overrides,
  };
}

describe("elemental system", () => {
  describe("Element enum", () => {
    it("has all expected element values", () => {
      expect(Element.Fire).toBe("fire");
      expect(Element.Ice).toBe("ice");
      expect(Element.Lightning).toBe("lightning");
      expect(Element.Poison).toBe("poison");
      expect(Element.Necrotic).toBe("necrotic");
      expect(Element.Radiant).toBe("radiant");
      expect(Element.Thunder).toBe("thunder");
      expect(Element.Force).toBe("force");
      expect(Element.Psychic).toBe("psychic");
    });
  });

  describe("elementDisplayName", () => {
    it("capitalizes element names", () => {
      expect(elementDisplayName(Element.Fire)).toBe("Fire");
      expect(elementDisplayName(Element.Ice)).toBe("Ice");
      expect(elementDisplayName(Element.Lightning)).toBe("Lightning");
      expect(elementDisplayName(Element.Necrotic)).toBe("Necrotic");
    });
  });

  describe("applyElementalModifier", () => {
    it("returns base damage when no element or profile", () => {
      const result = applyElementalModifier(10, undefined, undefined);
      expect(result.damage).toBe(10);
      expect(result.label).toBe("");
    });

    it("returns base damage when element but no profile", () => {
      const result = applyElementalModifier(10, Element.Fire, undefined);
      expect(result.damage).toBe(10);
      expect(result.label).toBe("");
    });

    it("returns base damage when profile but no element", () => {
      const profile: ElementalProfile = { weaknesses: [Element.Fire] };
      const result = applyElementalModifier(10, undefined, profile);
      expect(result.damage).toBe(10);
      expect(result.label).toBe("");
    });

    it("doubles damage for weakness", () => {
      const profile: ElementalProfile = { weaknesses: [Element.Fire] };
      const result = applyElementalModifier(10, Element.Fire, profile);
      expect(result.damage).toBe(20);
      expect(result.label).toBe("weak");
    });

    it("halves damage for resistance (floor)", () => {
      const profile: ElementalProfile = { resistances: [Element.Ice] };
      const result = applyElementalModifier(10, Element.Ice, profile);
      expect(result.damage).toBe(5);
      expect(result.label).toBe("resistant");
    });

    it("halves odd damage with floor", () => {
      const profile: ElementalProfile = { resistances: [Element.Ice] };
      const result = applyElementalModifier(7, Element.Ice, profile);
      expect(result.damage).toBe(3);
      expect(result.label).toBe("resistant");
    });

    it("reduces damage to 0 for immunity", () => {
      const profile: ElementalProfile = { immunities: [Element.Fire] };
      const result = applyElementalModifier(50, Element.Fire, profile);
      expect(result.damage).toBe(0);
      expect(result.label).toBe("immune");
    });

    it("immunity takes priority over weakness", () => {
      const profile: ElementalProfile = {
        immunities: [Element.Fire],
        weaknesses: [Element.Fire],
      };
      const result = applyElementalModifier(10, Element.Fire, profile);
      expect(result.damage).toBe(0);
      expect(result.label).toBe("immune");
    });

    it("returns neutral for unmatched element", () => {
      const profile: ElementalProfile = { weaknesses: [Element.Fire] };
      const result = applyElementalModifier(10, Element.Ice, profile);
      expect(result.damage).toBe(10);
      expect(result.label).toBe("");
    });

    it("handles empty profile arrays", () => {
      const profile: ElementalProfile = {
        resistances: [],
        weaknesses: [],
        immunities: [],
      };
      const result = applyElementalModifier(10, Element.Fire, profile);
      expect(result.damage).toBe(10);
      expect(result.label).toBe("");
    });
  });

  describe("monster elemental data integrity", () => {
    it("all monsters with elementalProfile have valid elements", () => {
      const validElements = Object.values(Element);
      for (const monster of ALL_MONSTERS) {
        if (!monster.elementalProfile) continue;
        const { resistances, weaknesses, immunities } = monster.elementalProfile;
        for (const e of resistances ?? []) {
          expect(validElements).toContain(e);
        }
        for (const e of weaknesses ?? []) {
          expect(validElements).toContain(e);
        }
        for (const e of immunities ?? []) {
          expect(validElements).toContain(e);
        }
      }
    });

    it("specific monsters have expected elemental profiles", () => {
      const dragon = getMonster("dragon")!;
      expect(dragon.elementalProfile?.immunities).toContain(Element.Fire);
      expect(dragon.elementalProfile?.weaknesses).toContain(Element.Ice);

      const frostGiant = getMonster("frostGiant")!;
      expect(frostGiant.elementalProfile?.immunities).toContain(Element.Ice);
      expect(frostGiant.elementalProfile?.weaknesses).toContain(Element.Fire);

      const skeleton = getMonster("skeleton")!;
      expect(skeleton.elementalProfile?.weaknesses).toContain(Element.Radiant);
      expect(skeleton.elementalProfile?.resistances).toContain(Element.Necrotic);
    });

    it("fire-themed monsters are immune to fire", () => {
      for (const id of ["dragon", "volcanicWyrm", "magmaSlime"]) {
        const m = getMonster(id);
        expect(m, `Monster ${id} should exist`).toBeDefined();
        expect(m!.elementalProfile?.immunities, `${id} should be immune to fire`).toContain(Element.Fire);
      }
    });

    it("undead monsters are weak to radiant", () => {
      for (const id of ["skeleton", "wraith", "cryptSkeleton", "tombWraith"]) {
        const m = getMonster(id);
        expect(m, `Monster ${id} should exist`).toBeDefined();
        expect(m!.elementalProfile?.weaknesses, `${id} should be weak to radiant`).toContain(Element.Radiant);
      }
    });

    it("ice-themed monsters are immune or resistant to ice", () => {
      const iceElemental = getMonster("iceElemental")!;
      expect(iceElemental.elementalProfile?.immunities).toContain(Element.Ice);

      const frostSpider = getMonster("frostSpider")!;
      expect(frostSpider.elementalProfile?.resistances).toContain(Element.Ice);
    });
  });

  describe("monster ability elements", () => {
    it("dragon Fire Breath has fire element", () => {
      const dragon = getMonster("dragon")!;
      const fireBreath = dragon.abilities?.find(a => a.name === "Fire Breath");
      expect(fireBreath?.element).toBe(Element.Fire);
    });

    it("wraith Life Drain has necrotic element", () => {
      const wraith = getMonster("wraith")!;
      const lifeDrain = wraith.abilities?.find(a => a.name === "Life Drain");
      expect(lifeDrain?.element).toBe(Element.Necrotic);
    });

    it("frost giant Icy Smash has ice element", () => {
      const frostGiant = getMonster("frostGiant")!;
      const icySmash = frostGiant.abilities?.find(a => a.name === "Icy Smash");
      expect(icySmash?.element).toBe(Element.Ice);
    });
  });

  describe("spell elements", () => {
    it("fire spells have fire element", () => {
      for (const id of ["fireBolt", "fireball", "scorchingRay", "hellishRebuke", "flameStrike", "fireStorm", "meteorSwarm"]) {
        const spell = getSpell(id);
        expect(spell, `Spell ${id} should exist`).toBeDefined();
        expect(spell!.element, `${id} should have fire element`).toBe(Element.Fire);
      }
    });

    it("ice spells have ice element", () => {
      for (const id of ["rayOfFrost", "iceStorm", "coneOfCold"]) {
        const spell = getSpell(id);
        expect(spell, `Spell ${id} should exist`).toBeDefined();
        expect(spell!.element, `${id} should have ice element`).toBe(Element.Ice);
      }
    });

    it("lightning spells have lightning element", () => {
      for (const id of ["shockingGrasp", "lightningBolt", "callLightning", "chainLightning"]) {
        const spell = getSpell(id);
        expect(spell, `Spell ${id} should exist`).toBeDefined();
        expect(spell!.element, `${id} should have lightning element`).toBe(Element.Lightning);
      }
    });

    it("radiant spells have radiant element", () => {
      for (const id of ["sacredFlame", "guidingBolt", "moonbeam", "spiritGuardians", "sunbeam"]) {
        const spell = getSpell(id);
        expect(spell, `Spell ${id} should exist`).toBeDefined();
        expect(spell!.element, `${id} should have radiant element`).toBe(Element.Radiant);
      }
    });

    it("heal spells do not have an element", () => {
      const heals = SPELLS.filter(s => s.type === "heal");
      for (const spell of heals) {
        expect(spell.element, `Heal spell ${spell.id} should not have element`).toBeUndefined();
      }
    });

    it("all damage spell elements are valid", () => {
      const validElements = Object.values(Element);
      for (const spell of SPELLS) {
        if (spell.element) {
          expect(validElements).toContain(spell.element);
        }
      }
    });
  });

  describe("ability elements", () => {
    it("paladin smite abilities have radiant element", () => {
      for (const id of ["smite", "holyStrike", "greaterSmite"]) {
        const ability = getAbility(id);
        expect(ability, `Ability ${id} should exist`).toBeDefined();
        expect(ability!.element, `${id} should have radiant element`).toBe(Element.Radiant);
      }
    });

    it("all ability elements are valid", () => {
      const validElements = Object.values(Element);
      for (const ability of ABILITIES) {
        if (ability.element) {
          expect(validElements).toContain(ability.element);
        }
      }
    });
  });

  describe("item elements", () => {
    it("fire weapons have fire element", () => {
      for (const id of ["flameBlade", "magmaCore", "emberBlade"]) {
        const item = getItem(id);
        expect(item, `Item ${id} should exist`).toBeDefined();
        expect(item!.element, `${id} should have fire element`).toBe(Element.Fire);
      }
    });

    it("ice weapons have ice element", () => {
      for (const id of ["frostfang", "frostBrand"]) {
        const item = getItem(id);
        expect(item, `Item ${id} should exist`).toBeDefined();
        expect(item!.element, `${id} should have ice element`).toBe(Element.Ice);
      }
    });

    it("non-elemental weapons do not have element", () => {
      for (const id of ["startSword", "shortSword", "longSword", "greatSword"]) {
        const item = getItem(id);
        expect(item, `Item ${id} should exist`).toBeDefined();
        expect(item!.element, `${id} should not have element`).toBeUndefined();
      }
    });

    it("all item elements are valid", () => {
      const validElements = Object.values(Element);
      for (const item of ITEMS) {
        if (item.element) {
          expect(validElements).toContain(item.element);
        }
      }
    });
  });

  describe("combat elemental integration", () => {
    it("spell damage is doubled against weak monster", () => {
      const player = createPlayer("Test", defaultStats);
      player.mp = 100;
      // Monster weak to fire, low AC for reliable hits
      const monster = createTestMonster({
        ac: 1,
        elementalProfile: { weaknesses: [Element.Fire] },
      });

      let gotHit = false;
      for (let i = 0; i < 50; i++) {
        player.mp = 100;
        const result = playerCastSpell(player, "fireBolt", monster);
        if (result.hit && result.damage > 0) {
          gotHit = true;
          expect(result.elementalLabel).toBe("weak");
          expect(result.message).toContain("weak to Fire");
          // Fire Bolt is 1d10, so min base is 1. Doubled = 2.
          expect(result.damage).toBeGreaterThanOrEqual(2);
        }
      }
      expect(gotHit).toBe(true);
    });

    it("spell damage is 0 against immune monster", () => {
      const player = createPlayer("Test", defaultStats);
      player.mp = 100;
      const monster = createTestMonster({
        ac: 1,
        elementalProfile: { immunities: [Element.Fire] },
      });

      let gotHit = false;
      for (let i = 0; i < 50; i++) {
        player.mp = 100;
        const result = playerCastSpell(player, "fireBolt", monster);
        if (result.hit) {
          gotHit = true;
          expect(result.elementalLabel).toBe("immune");
          expect(result.damage).toBe(0);
          expect(result.message).toContain("immune to Fire");
        }
      }
      expect(gotHit).toBe(true);
    });

    it("weapon attack with element applies modifier", () => {
      const player = createPlayer("Test", defaultStats);
      const flameBlade = getItem("flameBlade")!;
      player.equippedWeapon = flameBlade;
      const monster = createTestMonster({
        ac: 1,
        elementalProfile: { weaknesses: [Element.Fire] },
      });

      let gotHit = false;
      for (let i = 0; i < 50; i++) {
        const result = playerAttack(player, monster);
        if (result.hit) {
          gotHit = true;
          expect(result.elementalLabel).toBe("weak");
          expect(result.message).toContain("weak to Fire");
        }
      }
      expect(gotHit).toBe(true);
    });

    it("no elemental label for non-elemental attacks", () => {
      const player = createPlayer("Test", defaultStats);
      const monster = createTestMonster({
        ac: 1,
        elementalProfile: { weaknesses: [Element.Fire] },
      });

      for (let i = 0; i < 50; i++) {
        const result = playerAttack(player, monster);
        // No weapon element, so no elemental interaction
        expect(result.elementalLabel).toBeFalsy();
      }
    });

    it("ability with element applies modifier", () => {
      const player = createPlayer("Test", defaultStats, "paladin");
      player.mp = 100;
      player.knownAbilities = ["smite"];
      const monster = createTestMonster({
        ac: 1,
        elementalProfile: { weaknesses: [Element.Radiant] },
      });

      let gotHit = false;
      for (let i = 0; i < 50; i++) {
        player.mp = 100;
        const result = playerUseAbility(player, "smite", monster);
        if (result.hit && result.damage > 0) {
          gotHit = true;
          expect(result.elementalLabel).toBe("weak");
          expect(result.message).toContain("weak to Radiant");
        }
      }
      expect(gotHit).toBe(true);
    });
  });

  describe("codex elemental discovery", () => {
    it("discoveredElements starts empty on new entries", () => {
      const codex = createCodex();
      const monster = createTestMonster();
      const entry = recordDefeat(codex, monster, false, []);
      expect(entry.discoveredElements).toEqual([]);
    });

    it("discoverElement records new elements", () => {
      const codex = createCodex();
      const monster = createTestMonster();
      recordDefeat(codex, monster, false, []);

      discoverElement(codex, "testMonster", Element.Fire);
      const entry = codex.entries["testMonster"];
      expect(entry.discoveredElements).toContain(Element.Fire);
    });

    it("discoverElement does not duplicate", () => {
      const codex = createCodex();
      const monster = createTestMonster();
      recordDefeat(codex, monster, false, []);

      discoverElement(codex, "testMonster", Element.Fire);
      discoverElement(codex, "testMonster", Element.Fire);
      const entry = codex.entries["testMonster"];
      expect(entry.discoveredElements.filter(e => e === Element.Fire)).toHaveLength(1);
    });

    it("discoverElement handles unknown monster gracefully", () => {
      const codex = createCodex();
      // Should not throw
      discoverElement(codex, "nonExistent", Element.Fire);
      expect(Object.keys(codex.entries)).toHaveLength(0);
    });

    it("discovers multiple elements independently", () => {
      const codex = createCodex();
      const monster = createTestMonster();
      recordDefeat(codex, monster, false, []);

      discoverElement(codex, "testMonster", Element.Fire);
      discoverElement(codex, "testMonster", Element.Ice);
      const entry = codex.entries["testMonster"];
      expect(entry.discoveredElements).toContain(Element.Fire);
      expect(entry.discoveredElements).toContain(Element.Ice);
      expect(entry.discoveredElements).toHaveLength(2);
    });
  });
});
