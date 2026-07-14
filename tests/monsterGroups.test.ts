import { describe, expect, it } from "vitest";
import {
  MONSTER_GROUP_TEMPLATES,
  createRandomEncounter,
  createSoloEncounter,
  getEligibleMonsterGroups,
  getGroupBudget,
  getGroupDifficulty,
  getMonsterDifficultyRating,
  getRandomGroupEncounter,
  rollEncounterType,
} from "../src/data/monsterGroups";
import { getMonster } from "../src/data/monsters";

describe("monster group data", () => {
  it("references valid monsters and stays within template constraints", () => {
    for (const template of MONSTER_GROUP_TEMPLATES) {
      expect(template.members.length).toBeGreaterThanOrEqual(2);
      expect(template.members.length).toBeLessThanOrEqual(4);
      expect(template.synergy?.breakThreshold ?? 0).toBeLessThanOrEqual(
        template.members.length,
      );
      expect(getGroupDifficulty(template)).toBeLessThanOrEqual(
        getGroupBudget(template.minPlayerLevel),
      );

      for (const member of template.members) {
        expect(getMonster(member.monsterId)).toBeDefined();
      }
    }
  });

  it("maps XP rewards to the documented difficulty tiers", () => {
    expect(getMonsterDifficultyRating(50)).toBe(1);
    expect(getMonsterDifficultyRating(51)).toBe(2);
    expect(getMonsterDifficultyRating(200)).toBe(3);
    expect(getMonsterDifficultyRating(500)).toBe(4);
    expect(getMonsterDifficultyRating(1000)).toBe(5);
    expect(getMonsterDifficultyRating(1001)).toBe(6);
  });

  it("keeps level one encounters solo and caps group chance at 50%", () => {
    expect(rollEncounterType(1, () => 0)).toBe("solo");
    expect(rollEncounterType(5, () => 0.19)).toBe("group");
    expect(rollEncounterType(5, () => 0.2)).toBe("solo");
    expect(rollEncounterType(20, () => 0.49)).toBe("group");
    expect(rollEncounterType(20, () => 0.5)).toBe("solo");
  });

  it("offers a defeatable grass group at level two", () => {
    const eligible = getEligibleMonsterGroups(2, ["grass"]);
    expect(eligible.some((template) => template.id === "slimeSwarm")).toBe(true);

    const encounter = getRandomGroupEncounter(2, ["grass"], () => 0);
    expect(encounter?.members.length).toBeGreaterThanOrEqual(2);
    expect(encounter?.members.length).toBeLessThanOrEqual(4);
  });

  it("falls back to the supplied solo encounter when no group is eligible", () => {
    const slime = getMonster("slime")!;
    const encounter = createRandomEncounter(
      slime,
      2,
      ["unmatched-environment"],
      () => 0,
    );

    expect(encounter.isGroup).toBe(false);
    expect(encounter.members).toHaveLength(1);
    expect(encounter.members[0]?.monster.id).toBe("slime");
  });

  it("returns copies instead of mutable monster definitions", () => {
    const slime = getMonster("slime")!;
    const encounter = createSoloEncounter(slime);
    encounter.members[0]!.monster.hp = 0;

    expect(getMonster("slime")!.hp).toBeGreaterThan(0);
  });
});
