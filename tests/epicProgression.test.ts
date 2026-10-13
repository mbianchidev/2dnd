import { describe, expect, it, vi, afterEach } from "vitest";
import { BASE_CLASS_IDS } from "../src/data/classProgression";
import { PRESTIGE_PATH_IDS } from "../src/data/prestige";
import { EPIC_TRACK_ID } from "../src/data/epicProgression";
import {
  commitHeroLevelUp, getActorLevelCap, getNextLevelXP, getProficiencyBonus,
  prepareHeroLevelUp, prepareNextHeroLevelUp, previewHeroLevelUp,
} from "../src/systems/classProgression";
import { createHeroProgressionContext } from "../src/systems/classProgressionContext";
import { createCurrentSaveData, normalizeSaveData, SAVE_VERSION } from "../src/systems/save";
import { createCodex } from "../src/systems/codex";
import { awardXP, xpForLevel } from "../src/systems/player";
import { buildNewGamePlus } from "../src/systems/newGamePlus";
import { createCompanionState, restPartyAtInn } from "../src/systems/party";
import { completeCampaignThroughOwners, createCompletedCampaign } from "./helpers/campaign";
import { prestigeFixture, advancePrestige } from "./helpers/prestige";

afterEach(() => vi.restoreAllMocks());

describe("bounded epic ranks through the shared engine", () => {
  it.each(BASE_CLASS_IDS)("preserves %s ownership and applies one frozen grant per level 21-30", (classId) => {
    const source = createCompletedCampaign(classId, 20);
    const original = structuredClone(source);
    const built = buildNewGamePlus(source, `epic-${classId}`, 1000, "1234abcd");
    if (!built.ok) throw new Error(built.message);
    const player = built.data.player;
    const context = createHeroProgressionContext(() => player);
    const base = structuredClone(player.classProgression.classLevels);
    const initialPoints = player.pendingStatPoints;
    for (let target = 21; target <= 30; target++) {
      awardXP(player, xpForLevel(target) - player.xp);
      expect(player.pendingLevelUps).toBe(1);
      expect(prepareNextHeroLevelUp(player, () => 0.5).ok).toBe(false);
      const prepared = prepareHeroLevelUp(player, () => 0.5);
      expect(prepared.ok).toBe(true);
      const preview = previewHeroLevelUp(player, EPIC_TRACK_ID, context);
      if (!preview.ok) throw new Error(preview.message);
      const roll = vi.spyOn(Math, "random");
      roll.mockClear();
      const hpBefore = player.maxHp;
      const mpBefore = player.maxMp;
      const selection = { trackId: EPIC_TRACK_ID, expectedTotalLevel: target - 1 };
      expect(commitHeroLevelUp(player, selection, context).ok).toBe(true);
      expect(player.maxHp - hpBefore).toBe(preview.preview.hpGain);
      expect(player.maxMp - mpBefore).toBe(preview.preview.mpGain);
      expect(commitHeroLevelUp(player, selection, context).ok).toBe(false);
      expect(player.classProgression.classLevels).toEqual(base);
      expect(player.classProgression.trackLevels[EPIC_TRACK_ID]).toBe(target - 20);
      expect(player.level).toBe(target);
      expect(getProficiencyBonus(player)).toBe(Math.floor((target - 1) / 4) + 2);
      expect(roll).not.toHaveBeenCalled();
      const normalized = normalizeSaveData(structuredClone(built.data));
      expect(normalized?.player.classProgression).toEqual(player.classProgression);
      expect(normalized?.player.maxHp).toBe(player.maxHp);
      roll.mockRestore();
    }
    expect(player.pendingStatPoints - initialPoints).toBe(6);
    for (const id of ["roadwardenResolve", "roadwardenFocus", "roadwardenEdge"]) {
      expect(player.knownTalents.filter((known) => known === id)).toHaveLength(1);
    }
    expect(getNextLevelXP(player)).toBeNull();
    awardXP(player, 1_000_000);
    expect(player.pendingLevelUps).toBe(0);
    expect(prepareHeroLevelUp(player).ok).toBe(false);
    expect(source).toEqual(original);
  });

  it("keeps ordinary campaigns capped at 20 and rejects unregistered or malformed epic ownership", () => {
    const normal = createCompletedCampaign("knight", 20);
    awardXP(normal.player, 1_000_000);
    expect(getActorLevelCap(normal.player)).toBe(20);
    expect(normal.player.pendingLevelUps).toBe(0);
    expect(prepareHeroLevelUp(normal.player).ok).toBe(false);
    normal.player.classProgression.trackLevels[EPIC_TRACK_ID] = 1;
    normal.player.level = 21;
    expect(normalizeSaveData(normal)).toBeNull();
    const built = buildNewGamePlus(createCompletedCampaign("knight", 20), "corruption", 1000, "1234abcd");
    if (!built.ok) throw new Error(built.message);
    for (const rank of [-1, 0, 1.5, 11]) {
      const data = structuredClone(built.data);
      data.player.classProgression.trackLevels[EPIC_TRACK_ID] = rank;
      expect(normalizeSaveData(data)).toBeNull();
    }
    const invalid = structuredClone(built.data);
    invalid.player.newGamePlus = { ...invalid.player.newGamePlus!, policyVersion: 999 };
    expect(normalizeSaveData(invalid)).toBeNull();
    expect(SAVE_VERSION).toBeGreaterThan(26);
  });

  it("binds single-class companion XP/rest/load to the owning cycle without saving duplicate policy", () => {
    const built = buildNewGamePlus(createCompletedCampaign("knight", 20), "companions", 1000, "1234abcd");
    if (!built.ok) throw new Error(built.message);
    const player = built.data.player;
    const companion = createCompanionState("mystic", 20, player);
    player.party.companions.push(companion);
    player.party.activeCompanionIds.push("mystic");
    awardXP(companion, xpForLevel(30) - companion.xp);
    restPartyAtInn(player, true);
    expect(companion.level).toBe(30);
    expect(companion.classProgression).toBeUndefined();
    expect(companion.newGamePlus).toBeUndefined();
    expect(companion.knownTalents).toContain("roadwardenFocus");
    const normalized = normalizeSaveData(structuredClone(built.data));
    expect(normalized?.player.party.companions[0]?.level).toBe(30);
    expect(normalized?.player.party.companions[0]?.maxHp).toBe(companion.maxHp);
  });

  it("never spends epic headroom on extra base or prestige ranks", () => {
    const built = buildNewGamePlus(createCompletedCampaign("knight", 20), "normal-cap", 1000, "1234abcd");
    if (!built.ok) throw new Error(built.message);
    for (const extra of ["wizard", "prestige:roadglassBulwark"]) {
      const invalid = structuredClone(built.data);
      invalid.player.level = 21;
      if (extra === "wizard") invalid.player.classProgression.classLevels.wizard = 1;
      else invalid.player.classProgression.trackLevels["prestige:roadglassBulwark"] = 1;
      expect(normalizeSaveData(invalid)).toBeNull();
    }
  });

  it.each(PRESTIGE_PATH_IDS)("composes %s and existing multiclass ownership with all ten epic ranks", (pathId) => {
    const player = prestigeFixture(pathId);
    for (let rank = 0; rank < 5; rank++) advancePrestige(player, pathId);
    awardXP(player, xpForLevel(20) - player.xp);
    const context = createHeroProgressionContext(() => player);
    while (player.level < 20) {
      prepareHeroLevelUp(player, () => 0.5);
      const committed = commitHeroLevelUp(player, {
        trackId: player.classProgression.startingClassId, expectedTotalLevel: player.level,
      }, context);
      if (!committed.ok) throw new Error(committed.message);
    }
    const bosses = new Set<string>();
    completeCampaignThroughOwners(player, bosses);
    const source = createCurrentSaveData(player, bosses, createCodex(), player.appearanceId, 0);
    const built = buildNewGamePlus(source, `prestige-${pathId}`, 1000, "1234abcd");
    if (!built.ok) throw new Error(built.message);
    const hero = built.data.player;
    const normal = structuredClone(hero.classProgression);
    const owner = createHeroProgressionContext(() => hero);
    awardXP(hero, xpForLevel(30) - hero.xp);
    prepareHeroLevelUp(hero, () => 0.5);
    while (hero.level < 30) {
      const result = commitHeroLevelUp(hero, { trackId: EPIC_TRACK_ID, expectedTotalLevel: hero.level }, owner);
      if (!result.ok) throw new Error(result.message);
      if (hero.level < 30) expect(prepareNextHeroLevelUp(hero, () => 0.5).ok).toBe(true);
    }
    expect(hero.classProgression.classLevels).toEqual(normal.classLevels);
    expect(hero.classProgression.trackLevels).toEqual({ ...normal.trackLevels, [EPIC_TRACK_ID]: 10 });
    expect(hero.level).toBe(30);
    expect(hero.classProgression.readyLevelUps).toBe(0);
    expect(normalizeSaveData(built.data)?.player.classProgression).toEqual(hero.classProgression);
  });

  it("removes unearned epic talents from companion imports without replaying resource bonuses", () => {
    const normal = createCompletedCampaign();
    const companion = createCompanionState("mystic", 20);
    companion.knownTalents.push("roadwardenResolve", "roadwardenFocus", "roadwardenEdge");
    normal.player.party.companions.push(companion);
    const ordinary = normalizeSaveData(normal);
    expect(ordinary?.player.party.companions[0]?.knownTalents).not.toContain("roadwardenResolve");
    const built = buildNewGamePlus(createCompletedCampaign("knight", 20), "talent-cap", 1000, "1234abcd");
    if (!built.ok) throw new Error(built.message);
    companion.level = 25;
    companion.xp = xpForLevel(25);
    built.data.player.party.companions.push(companion);
    const normalized = normalizeSaveData(built.data);
    expect(normalized?.player.party.companions[0]?.knownTalents).toContain("roadwardenResolve");
    expect(normalized?.player.party.companions[0]?.knownTalents).toContain("roadwardenFocus");
    expect(normalized?.player.party.companions[0]?.knownTalents).not.toContain("roadwardenEdge");
    expect(normalized?.player.party.companions[0]?.maxHp).toBe(companion.maxHp);
    expect(normalized?.player.party.companions[0]?.maxMp).toBe(companion.maxMp);
  });
});
