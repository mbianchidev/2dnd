import { describe, expect, it } from "vitest";
import {
  getMonsterFamily,
  getMonsterPalette,
  getMonsterTextureKey,
  MONSTER_FAMILIES,
  MONSTER_FAMILY_IDS,
} from "../src/data/monsterFamilies";
import {
  ALL_MONSTERS,
  CANYON_NIGHT_MONSTERS,
  DUNGEON_MONSTERS,
  FROST_CAVERN_MONSTERS,
  MONSTERS,
  NIGHT_MONSTERS,
  getEligibleEncounterMonsters,
  getMonster,
  selectWeightedMonster,
  type Monster,
} from "../src/data/monsters";
import {
  createCodex,
  getCodexFamilyProgress,
  getCodexFamilyProgressList,
  getCodexMonsterList,
  recordDefeat,
} from "../src/systems/codex";

describe("monster families", () => {
  it("assigns every monster to a valid family with at least two members", () => {
    for (const monster of ALL_MONSTERS) {
      expect(MONSTER_FAMILY_IDS).toContain(monster.family);
      expect(getMonsterFamily(monster.family).id).toBe(monster.family);
    }

    for (const family of MONSTER_FAMILIES) {
      const members = ALL_MONSTERS.filter(
        (monster) => monster.family === family.id,
      );
      expect(members.length, family.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("keeps every family palette unique across its members", () => {
    for (const family of MONSTER_FAMILIES) {
      const palettes = ALL_MONSTERS
        .filter((monster) => monster.family === family.id)
        .map((monster) => {
          const palette = getMonsterPalette(monster);
          return [
            palette.primary,
            palette.secondary,
            palette.detail,
            palette.outline,
          ].join(":");
        });
      expect(new Set(palettes).size, family.id).toBe(palettes.length);
    }
  });

  it("defines valid differentiated variants within the same family", () => {
    const variants = ALL_MONSTERS.filter((monster) => monster.variantOf);
    expect(variants.length).toBeGreaterThanOrEqual(20);

    for (const variant of variants) {
      const base = getMonster(variant.variantOf!);
      expect(base, `${variant.id} base`).toBeDefined();
      expect(variant.family).toBe(base!.family);
      expect(variant.color).not.toBe(base!.color);
      expect(variant.abilities?.map((ability) => ability.name) ?? []).not.toEqual(
        base!.abilities?.map((ability) => ability.name) ?? [],
      );
    }
  });

  it("expands priority families through eligible weighted encounter pools", () => {
    expect(ALL_MONSTERS.filter((monster) => monster.family === "slime").length)
      .toBeGreaterThanOrEqual(4);
    expect(ALL_MONSTERS.filter((monster) => monster.family === "lupine").length)
      .toBeGreaterThanOrEqual(4);
    expect(ALL_MONSTERS.filter((monster) => monster.family === "raider").length)
      .toBeGreaterThanOrEqual(4);
    expect(ALL_MONSTERS.filter((monster) => monster.family === "construct").length)
      .toBeGreaterThanOrEqual(4);
    expect(ALL_MONSTERS.filter((monster) => monster.family === "drake").length)
      .toBeGreaterThanOrEqual(4);

    expect(MONSTERS.map((monster) => monster.id)).toEqual(
      expect.arrayContaining(["toxicSlime", "goblinShaman", "orcBerserker"]),
    );
    expect(DUNGEON_MONSTERS.map((monster) => monster.id)).toContain("runicMimic");
    expect(FROST_CAVERN_MONSTERS.map((monster) => monster.id)).toEqual(
      expect.arrayContaining(["frostSlime", "iceGolem"]),
    );
    expect(NIGHT_MONSTERS.map((monster) => monster.id)).toContain("emberWolf");
    expect(CANYON_NIGHT_MONSTERS.map((monster) => monster.id)).toContain(
      "stormDrake",
    );
  });

  it("selects eligible monsters deterministically by positive encounter weight", () => {
    const common: Monster = {
      ...getMonster("slime")!,
      encounterWeight: 1,
    };
    const rare: Monster = {
      ...getMonster("toxicSlime")!,
      encounterWeight: 0.25,
    };
    const eligible = getEligibleEncounterMonsters(
      [common, rare, getMonster("dragon")!],
      1,
      2,
    );
    expect(eligible.map((monster) => monster.id)).toEqual([
      "slime",
      "toxicSlime",
    ]);
    expect(selectWeightedMonster(eligible, () => 0).id).toBe("slime");
    expect(selectWeightedMonster(eligible, () => 0.99).id).toBe("toxicSlime");
    expect(
      getEligibleEncounterMonsters(NIGHT_MONSTERS, 0, 2)
        .some((monster) => monster.id === "emberWolf"),
    ).toBe(false);
  });

  it("derives family grouping, sorting, and completion from current discovery", () => {
    const codex = createCodex();
    const slimeMembers = ALL_MONSTERS.filter(
      (monster) => monster.family === "slime",
    );
    recordDefeat(codex, slimeMembers[1]!, true, []);
    recordDefeat(codex, slimeMembers[1]!, true, []);

    const familySorted = getCodexMonsterList(codex, "family");
    expect(familySorted.slice(0, slimeMembers.length).every(
      (monster) => monster.family === "slime",
    )).toBe(true);
    expect(getCodexMonsterList(codex, "defeated")[0]?.id)
      .toBe(slimeMembers[1]!.id);
    expect(getCodexMonsterList(codex, "family", "slime")).toHaveLength(
      slimeMembers.length,
    );

    let progress = getCodexFamilyProgress(codex, "slime");
    expect(progress).toMatchObject({
      discovered: 1,
      total: slimeMembers.length,
      complete: false,
    });
    for (const monster of slimeMembers) {
      if (!(monster.id in codex.entries)) {
        recordDefeat(codex, monster, false, []);
      }
    }
    progress = getCodexFamilyProgress(codex, "slime");
    expect(progress.complete).toBe(true);
    expect(getCodexFamilyProgressList(codex)).toHaveLength(
      MONSTER_FAMILIES.length,
    );
  });

  it("provides one stable idle texture key for every monster", () => {
    const keys = ALL_MONSTERS.map((monster) => getMonsterTextureKey(monster));
    expect(new Set(keys).size).toBe(ALL_MONSTERS.length);
    for (const monster of ALL_MONSTERS) {
      expect(getMonsterTextureKey(monster)).toBe(
        `monster-${monster.id}-${monster.isBoss ? "boss" : "normal"}-idle`,
      );
    }
  });
});
