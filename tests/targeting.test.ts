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
    expect(getSpellTargetType(getSpell("fireBolt")!)).toBe("single");
    expect(getSpellTargetType(getSpell("fireball")!)).toBe("all_enemies");
    expect(getSpellTargetType(getSpell("lightningBolt")!)).toBe("front_row");
    expect(getSpellTargetType(getSpell("scorchingRay")!)).toBe("random_2");
    expect(getSpellTargetType(getSpell("cureWounds")!)).toBe("self");
  });

  it("defaults abilities safely and marks ranged attacks explicitly", () => {
    expect(getAbilityTargetType(getAbility("shieldBash")!)).toBe("single");
    expect(getAbilityTargetType(getAbility("secondWind")!)).toBe("self");
    expect(getAbilityRange(getAbility("shieldBash")!)).toBe("melee");
    expect(getAbilityRange(getAbility("aimedShot")!)).toBe("ranged");
  });

  it("resolves a valid target type for every spell and ability", () => {
    const targetTypes = new Set([
      "single",
      "all_enemies",
      "front_row",
      "back_row",
      "random_2",
      "self",
    ]);
    for (const spell of SPELLS) {
      expect(targetTypes.has(getSpellTargetType(spell))).toBe(true);
    }
    for (const ability of ABILITIES) {
      expect(targetTypes.has(getAbilityTargetType(ability))).toBe(true);
    }
  });
});
