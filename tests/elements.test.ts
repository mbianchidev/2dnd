import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Element,
  applyElementalModifier,
  elementDisplayName,
} from "../src/data/elements";
import type { ElementalProfile } from "../src/data/elements";
import { ABILITIES, getAbility } from "../src/data/abilities";
import { getItem, ITEMS } from "../src/data/items";
import { ALL_MONSTERS, getMonster } from "../src/data/monsters";
import type { Monster } from "../src/data/monsters";
import { getSpell, SPELLS } from "../src/data/spells";
import {
  monsterUseAbility,
  playerAttack,
  playerCastSpell,
  playerUseAbility,
} from "../src/systems/combat";
import {
  createCodex,
  discoverElement,
  recordDefeat,
} from "../src/systems/codex";
import { createPlayer } from "../src/systems/player";

const stats = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

function createTestMonster(overrides: Partial<Monster> = {}): Monster {
  return {
    id: "testMonster",
    name: "Test Monster",
    hp: 20,
    ac: 1,
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("elemental damage", () => {
  it("applies immunity, weakness, resistance, and neutral damage", () => {
    const profile: ElementalProfile = {
      immunities: [Element.Fire],
      weaknesses: [Element.Ice],
      resistances: [Element.Lightning],
    };

    expect(applyElementalModifier(10, Element.Fire, profile)).toEqual({
      damage: 0,
      interaction: "immune",
    });
    expect(applyElementalModifier(10, Element.Ice, profile)).toEqual({
      damage: 20,
      interaction: "weak",
    });
    expect(applyElementalModifier(7, Element.Lightning, profile)).toEqual({
      damage: 3,
      interaction: "resistant",
    });
    expect(applyElementalModifier(10, Element.Radiant, profile)).toEqual({
      damage: 10,
      interaction: "",
    });
  });

  it("prioritizes immunity when a malformed profile overlaps", () => {
    const profile: ElementalProfile = {
      immunities: [Element.Fire],
      weaknesses: [Element.Fire],
      resistances: [Element.Fire],
    };

    expect(applyElementalModifier(10, Element.Fire, profile)).toEqual({
      damage: 0,
      interaction: "immune",
    });
  });

  it("formats element names for UI messages", () => {
    expect(elementDisplayName(Element.Necrotic)).toBe("Necrotic");
  });
});

describe("elemental game data", () => {
  it("uses valid, non-overlapping monster profiles", () => {
    const validElements = Object.values(Element);
    for (const monster of ALL_MONSTERS) {
      const profile = monster.elementalProfile;
      if (!profile) continue;
      const resistances = profile.resistances ?? [];
      const weaknesses = profile.weaknesses ?? [];
      const immunities = profile.immunities ?? [];

      for (const element of [...resistances, ...weaknesses, ...immunities]) {
        expect(validElements).toContain(element);
      }
      expect(resistances.filter((element) => immunities.includes(element))).toEqual([]);
      expect(weaknesses.filter((element) => immunities.includes(element))).toEqual([]);
      expect(resistances.filter((element) => weaknesses.includes(element))).toEqual([]);
    }
  });

  it("assigns profiles and ability elements to themed monsters", () => {
    expect(getMonster("dragon")?.elementalProfile?.immunities).toContain(
      Element.Fire,
    );
    expect(getMonster("skeleton")?.elementalProfile?.weaknesses).toContain(
      Element.Radiant,
    );
    expect(getMonster("frostWarden")?.elementalProfile?.immunities).toContain(
      Element.Ice,
    );
    expect(
      getMonster("infernoForgemaster")?.abilities?.find(
        (ability) => ability.name === "Molten Eruption",
      )?.element,
    ).toBe(Element.Fire);
    expect(
      getMonster("cryptLich")?.abilities?.find(
        (ability) => ability.name === "Necrotic Ray",
      )?.element,
    ).toBe(Element.Necrotic);
  });

  it("assigns elements to spells, abilities, and weapons", () => {
    expect(getSpell("fireball")?.element).toBe(Element.Fire);
    expect(getSpell("magicMissile")?.element).toBe(Element.Force);
    expect(getAbility("smite")?.element).toBe(Element.Radiant);
    expect(getItem("flameBlade")?.element).toBe(Element.Fire);
    expect(getItem("frostfang")?.element).toBe(Element.Ice);
  });

  it("keeps healing data non-elemental and all assigned values valid", () => {
    const validElements = Object.values(Element);
    for (const spell of SPELLS) {
      if (spell.type === "heal") expect(spell.element).toBeUndefined();
      if (spell.element) expect(validElements).toContain(spell.element);
    }
    for (const ability of ABILITIES) {
      if (ability.type === "heal") expect(ability.element).toBeUndefined();
      if (ability.element) expect(validElements).toContain(ability.element);
    }
    for (const item of ITEMS) {
      if (item.element) expect(validElements).toContain(item.element);
    }
  });
});

describe("elemental combat integration", () => {
  it("applies spell weaknesses and immunities", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const player = createPlayer("Mage", stats, "mage");
    player.mp = 100;

    const weakResult = playerCastSpell(
      player,
      "fireBolt",
      createTestMonster({
        elementalProfile: { weaknesses: [Element.Fire] },
      }),
    );
    expect(weakResult.damage).toBe(12);
    expect(weakResult.elementalLabel).toBe("weak");
    expect(weakResult.message).toContain("weak to Fire");

    const immuneResult = playerCastSpell(
      player,
      "fireBolt",
      createTestMonster({
        elementalProfile: { immunities: [Element.Fire] },
      }),
    );
    expect(immuneResult.damage).toBe(0);
    expect(immuneResult.elementalLabel).toBe("immune");
    expect(immuneResult.message).toContain("immune to Fire");
  });

  it("applies weapon and martial ability elements", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const monster = createTestMonster({
      elementalProfile: { weaknesses: [Element.Fire, Element.Radiant] },
    });
    const player = createPlayer("Paladin", stats, "paladin");
    player.mp = 100;
    player.equippedWeapon = getItem("flameBlade")!;

    const attack = playerAttack(player, monster);
    expect(attack.damage).toBe(20);
    expect(attack.elementalLabel).toBe("weak");

    const ability = playerUseAbility(player, "smite", monster);
    expect(ability.damage).toBe(10);
    expect(ability.elementalLabel).toBe("weak");
  });

  it("labels elemental monster abilities", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const player = createPlayer("Target", stats);
    const monster = getMonster("dragon")!;
    const fireBreath = monster.abilities!.find(
      (ability) => ability.name === "Fire Breath",
    )!;

    const result = monsterUseAbility(fireBreath, monster, player);
    expect(result.element).toBe(Element.Fire);
    expect(result.message).toContain("(Fire)");
  });
});

describe("Codex elemental discovery", () => {
  it("records unique discovered elements on defeated monsters", () => {
    const codex = createCodex();
    const monster = createTestMonster();
    const entry = recordDefeat(codex, monster, false, []);
    expect(entry.discoveredElements).toEqual([]);

    discoverElement(codex, monster.id, Element.Fire);
    discoverElement(codex, monster.id, Element.Fire);
    discoverElement(codex, monster.id, Element.Ice);

    expect(entry.discoveredElements).toEqual([Element.Fire, Element.Ice]);
  });

  it("ignores discoveries for monsters not yet recorded", () => {
    const codex = createCodex();
    discoverElement(codex, "unknown", Element.Fire);
    expect(codex.entries).toEqual({});
  });
});
