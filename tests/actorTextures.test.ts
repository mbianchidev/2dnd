import { describe, expect, it } from "vitest";
import {
  createActorTextureFamily,
  resolveMonsterTextureFamily,
} from "../src/renderers/actorTextures";
import type { Monster } from "../src/data/monsters";

function createMonster(overrides: Partial<Monster> = {}): Monster {
  return {
    id: "testMonster",
    name: "Test Monster",
    hp: 10,
    ac: 10,
    attackBonus: 1,
    damageCount: 1,
    damageDie: 4,
    xpReward: 10,
    goldReward: 5,
    isBoss: false,
    color: 0xffffff,
    ...overrides,
  };
}

describe("actor texture families", () => {
  it("creates stable explicit frame keys for every animation state", () => {
    const family = createActorTextureFamily({
      id: "hero.knight",
      role: "hero",
      fallbackTextureKey: "player_knight",
      framePrefix: "player_knight_battle",
    });

    expect(family.frames.attack).toEqual([
      { textureKey: "player_knight_battle_attack_0" },
      { textureKey: "player_knight_battle_attack_1" },
    ]);
    expect(family.frames.faint).toHaveLength(2);
  });

  it("uses future family base and frame keys without hardcoded monster IDs", () => {
    const monster = Object.assign(createMonster(), { family: "slime" });
    const family = resolveMonsterTextureFamily(
      monster,
      (key) => key === "monster_slime_base",
    );

    expect(family).toMatchObject({
      id: "monster.slime",
      role: "monster",
      fallbackTextureKey: "monster_slime_base",
    });
    expect(family.frames.damage?.[0]?.textureKey)
      .toBe("monster_slime_damage_0");
  });

  it("falls back to existing generic boss and monster textures", () => {
    expect(resolveMonsterTextureFamily(
      createMonster(),
      (key) => key === "monster",
    ).fallbackTextureKey).toBe("monster");
    expect(resolveMonsterTextureFamily(
      createMonster({ isBoss: true }),
      (key) => key === "monster_boss",
    ).fallbackTextureKey).toBe("monster_boss");
  });
});
