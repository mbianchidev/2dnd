import { afterEach, describe, expect, it, vi } from "vitest";
import type { Talent } from "../src/data/talents";

vi.mock("../src/data/talents", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/data/talents")>();
  const trackTalent: Talent = {
    id: "fixtureTrackTalent", name: "Fixture talent", description: "Fixture HP",
    levelRequired: 1, maxHpBonus: 9,
  };
  const talents = [...original.TALENTS, trackTalent];
  return {
    ...original,
    TALENTS: talents,
    getTalent: (id: string): Talent | undefined => talents.find((talent) => talent.id === id),
  };
});

import { BASE_CLASS_PROFILES, type ProgressionTrackProfile } from "../src/data/classProgression";
import {
  commitHeroLevelUp, getAvailableProgressionGrants, getFeatureSources,
  prepareHeroLevelUp,
} from "../src/systems/classProgression";
import { awardXP, createPlayer, processPendingLevelUps, xpForLevel } from "../src/systems/player";
import { createCompanionState } from "../src/systems/party";
import { normalizeHeroProgressionState } from "../src/systems/classProgressionState";

const stats = {
  strength: 15, dexterity: 15, constitution: 14,
  intelligence: 15, wisdom: 15, charisma: 15,
};

afterEach(() => vi.restoreAllMocks());

describe("owning-track talent isolation", () => {
  it("never leaks unscoped/track talents through generic hero or companion scans", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const hero = createPlayer("Profile fixture", stats);
    awardXP(hero, xpForLevel(7));
    processPendingLevelUps(hero);
    expect(hero.knownTalents).not.toContain("fixtureTrackTalent");
    expect(getAvailableProgressionGrants(hero).talents).not.toContain("fixtureTrackTalent");
    const companion = createCompanionState("mystic", 7);
    expect(companion.knownTalents).not.toContain("fixtureTrackTalent");
    const normalized = normalizeHeroProgressionState(hero, 19);
    expect(normalized?.knownTalents).not.toContain("fixtureTrackTalent");
  });

  it("grants owning-track HP exactly once and retains only its provenance after normalization", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const hero = createPlayer("Profile fixture", stats);
    awardXP(hero, xpForLevel(7));
    processPendingLevelUps(hero);
    const profile: ProgressionTrackProfile = {
      ...BASE_CLASS_PROFILES[0]!,
      id: "prestige:fixturePath", kind: "prestige", label: "Fixture path", maxRank: 5,
      entryRequirements: [{ type: "totalLevel", minimum: 7 }],
      grants: [{ id: "fixtureTrackTalent", kind: "talent", rank: 1 }],
    };
    const context = { profiles: [...BASE_CLASS_PROFILES, profile] };
    const hp = hero.maxHp;
    awardXP(hero, xpForLevel(8) - hero.xp);
    prepareHeroLevelUp(hero, () => 0.5);
    const first = commitHeroLevelUp(hero, { trackId: profile.id, expectedTotalLevel: 7 }, context);
    expect(first.ok).toBe(true);
    expect(hero.maxHp).toBe(hp + 8 + 9);
    expect(getFeatureSources(hero, "talent", "fixtureTrackTalent", context)).toEqual([{
      kind: "track", trackId: profile.id, rank: 1, stat: undefined,
    }]);
    const normalized = normalizeHeroProgressionState(hero, 19, context);
    expect(normalized?.maxHp).toBe(hero.maxHp);
    expect(normalized?.knownTalents.filter((id) => id === "fixtureTrackTalent")).toHaveLength(1);
    awardXP(hero, xpForLevel(9) - hero.xp);
    prepareHeroLevelUp(hero, () => 0.5);
    commitHeroLevelUp(hero, { trackId: profile.id, expectedTotalLevel: 8 }, context);
    expect(hero.maxHp).toBe(hp + 8 + 9 + 8);
  });
});
