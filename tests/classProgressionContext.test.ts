import { afterEach, describe, expect, it, vi } from "vitest";
import { BASE_CLASS_PROFILES, type ProgressionTrackProfile, type ProgressionWorldRequirement } from "../src/data/classProgression";
import { MAIN_QUEST_ID } from "../src/data/quests";
import {
  commitHeroLevelUp, prepareHeroLevelUp, previewHeroLevelUp,
} from "../src/systems/classProgression";
import { createHeroProgressionContext } from "../src/systems/classProgressionContext";
import { normalizeHeroProgressionState } from "../src/systems/classProgressionState";
import { awardXP, createPlayer, processPendingLevelUps, xpForLevel, type PlayerState } from "../src/systems/player";
import { createQuestLog } from "../src/systems/quests";
import { createSocialState } from "../src/systems/reputation";

const stats = {
  strength: 15, dexterity: 15, constitution: 14,
  intelligence: 15, wisdom: 15, charisma: 15,
};

afterEach(() => vi.restoreAllMocks());

function fixture(): PlayerState {
  const player = createPlayer("World owner fixture", stats);
  awardXP(player, xpForLevel(7));
  processPendingLevelUps(player);
  player.progression.quests.quests[MAIN_QUEST_ID].status = "completed";
  player.position.inCity = true;
  player.position.cityId = "willowdale_city";
  player.progression.social.factionReputation.twelvefoldCovenant = 60;
  awardXP(player, xpForLevel(8) - player.xp);
  prepareHeroLevelUp(player, () => 0.5);
  return player;
}

const requirements: readonly ProgressionWorldRequirement[] = [
  { type: "questCompleted", questId: MAIN_QUEST_ID },
  { type: "city", cityId: "willowdale_city" },
  { type: "reputation", kind: "faction", targetId: "twelvefoldCovenant", minimum: 50 },
];
const profile: ProgressionTrackProfile = {
  ...BASE_CLASS_PROFILES[0]!,
  id: "prestige:contextFixture", kind: "prestige", label: "Fixture track",
  maxRank: 5, grants: [], entryRequirements: requirements,
};
const profiles = [...BASE_CLASS_PROFILES, profile];

describe("live progression owner context", () => {
  it.each(["quest", "location", "social"])("rechecks changed %s entry evidence at commit without mutation", (domain) => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const player = fixture();
    const context = createHeroProgressionContext(() => player, profiles);
    expect(previewHeroLevelUp(player, profile.id, context).ok).toBe(true);
    if (domain === "quest") player.progression.quests.quests[MAIN_QUEST_ID].status = "active";
    if (domain === "location") player.position.cityId = "ironhold_city";
    if (domain === "social") player.progression.social.factionReputation.twelvefoldCovenant = 0;
    const before = structuredClone(player);
    expect(commitHeroLevelUp(player, { trackId: profile.id, expectedTotalLevel: 7 }, context).ok).toBe(false);
    expect(player).toEqual(before);
  });

  it("fails closed without a world owner and never rechecks earned ranks on normalization", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const player = fixture();
    expect(previewHeroLevelUp(player, profile.id, { profiles }).ok).toBe(false);
    const context = createHeroProgressionContext(() => player, profiles);
    expect(commitHeroLevelUp(player, { trackId: profile.id, expectedTotalLevel: 7 }, context).ok).toBe(true);
    player.progression.quests = createQuestLog();
    const normalized = normalizeHeroProgressionState(player, 19, context);
    expect(normalized?.classProgression.trackLevels["prestige:contextFixture"]).toBe(1);
  });

  it("preserves a detached frozen receipt across equipment relink/restoration/world reset and requires owner rebind", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const original = fixture();
    const oldContext = createHeroProgressionContext(() => original, profiles);
    const detached = structuredClone(original);
    const normalized = normalizeHeroProgressionState(detached, 19, oldContext);
    if (!normalized) throw new Error("Cannot normalize detached owner");
    Object.assign(detached, normalized);
    detached.hp = detached.maxHp;
    detached.mp = detached.maxMp;
    detached.progression.quests = createQuestLog();
    detached.progression.social = createSocialState();
    detached.progression.seenCutsceneIds = [];
    detached.progression.pendingCutsceneIds = [];
    expect(detached.classProgression.pendingLevel).toEqual(original.classProgression.pendingLevel);
    expect(detached.classProgression.readyLevelUps).toBe(original.classProgression.readyLevelUps);
    expect(detached.classProgression.legacyGrants).toEqual(original.classProgression.legacyGrants);
    expect(detached.equippedWeapon).toBe(detached.inventory[0]);
    expect(detached.equippedWeapon).not.toBe(original.equippedWeapon);
    expect(previewHeroLevelUp(detached, profile.id, oldContext).ok).toBe(false);
    detached.progression.quests.quests[MAIN_QUEST_ID].status = "completed";
    detached.progression.social.factionReputation.twelvefoldCovenant = 60;
    const newContext = createHeroProgressionContext(() => detached, profiles);
    expect(previewHeroLevelUp(detached, profile.id, newContext).ok).toBe(true);
    const before = original.level;
    expect(commitHeroLevelUp(detached, { trackId: profile.id, expectedTotalLevel: 7 }, newContext).ok).toBe(true);
    expect(original.level).toBe(before);
    expect(original.classProgression.readyLevelUps).toBe(1);
    expect(detached.classProgression.readyLevelUps).toBe(0);
  });
});
