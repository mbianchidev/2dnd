import { describe, expect, it } from "vitest";
import {
  ABILITIES,
  getAbility,
  getAbilityRange,
  getAbilityTargetType,
} from "../src/data/abilities";
import {
  SPELLS,
  getSpell,
  getSpellTargetType,
} from "../src/data/spells";

describe("action targeting metadata", () => {
  it("classifies existing AoE and self-targeting spells", () => {
    expect(getSpellTargetType(getSpell("fireBolt")!)).toBe("single_enemy");
    expect(getSpellTargetType(getSpell("fireball")!)).toBe("all_enemies");
    expect(getSpellTargetType(getSpell("lightningBolt")!)).toBe("front_row_enemies");
    expect(getSpellTargetType(getSpell("scorchingRay")!)).toBe("random_2");
    expect(getSpellTargetType(getSpell("cureWounds")!)).toBe("single_ally");
    expect(getSpellTargetType(getSpell("massCureWounds")!)).toBe("all_party");
  });

  it("defaults abilities safely and marks ranged attacks explicitly", () => {
    expect(getAbilityTargetType(getAbility("shieldBash")!)).toBe("single_enemy");
    expect(getAbilityTargetType(getAbility("secondWind")!)).toBe("self");
    expect(getAbilityRange(getAbility("shieldBash")!)).toBe("melee");
    expect(getAbilityRange(getAbility("aimedShot")!)).toBe("ranged");
  });

  it("resolves a valid target type for every spell and ability", () => {
    const targetTypes = new Set([
      "single",
      "single_enemy",
      "all_enemies",
      "front_row",
      "front_row_enemies",
      "back_row",
      "back_row_enemies",
      "random_2",
      "self",
      "single_ally",
      "all_allies",
      "all_party",
    ]);
    for (const spell of SPELLS) {
      expect(targetTypes.has(getSpellTargetType(spell))).toBe(true);
    }
    for (const ability of ABILITIES) {
      expect(targetTypes.has(getAbilityTargetType(ability))).toBe(true);
    }
  });

  it("stores explicit targeting on every heal instead of relying on defaults", () => {
    for (const spell of SPELLS.filter((entry) => entry.type === "heal")) {
      expect(spell.targetType).toBeDefined();
    }
    for (const ability of ABILITIES.filter((entry) => entry.type === "heal")) {
      expect(ability.targetType).toBeDefined();
    }
  });
});
