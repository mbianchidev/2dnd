import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BASE_CLASS_PROFILES,
  NORMAL_LEVEL_CAP,
  type BaseClassId,
  type ProgressionTrackProfile,
} from "../src/data/classProgression";
import { ABILITIES } from "../src/data/abilities";
import { getItem } from "../src/data/items";
import { SPELLS } from "../src/data/spells";
import { TALENTS } from "../src/data/talents";
import { PLAYER_CLASSES } from "../src/systems/classes";
import {
  canActorEquip,
  commitHeroLevelUp,
  getClassLevel,
  getFeatureSources,
  getProgressionTracks,
  getProficiencyBonus,
  getSpellCastingStat,
  getTotalLevel,
  prepareHeroLevelUp,
  previewHeroLevelUp,
  qualifyNextClass,
} from "../src/systems/classProgression";
import {
  allocateStatPoint,
  awardXP,
  createPlayer,
  processPendingLevelUps,
  xpForLevel,
  type PlayerState,
  type PlayerStats,
} from "../src/systems/player";
import { createCompanionState } from "../src/systems/party";
import { abilityModifier } from "../src/systems/dice";

const eligibleStats: PlayerStats = {
  strength: 15, dexterity: 15, constitution: 14,
  intelligence: 15, wisdom: 15, charisma: 15,
};

afterEach(() => vi.restoreAllMocks());

function hero(classId: BaseClassId = "knight"): PlayerState {
  return createPlayer("Progression fixture", eligibleStats, classId);
}

function advance(player: PlayerState, classId: BaseClassId): void {
  awardXP(player, Math.max(0, xpForLevel(player.level + 1) - player.xp));
  expect(prepareHeroLevelUp(player, () => 0.5).ok).toBe(true);
  const result = commitHeroLevelUp(player, {
    trackId: classId,
    expectedTotalLevel: player.level,
  });
  expect(result.ok).toBe(true);
}

describe("class progression definitions", () => {
  it("defines every existing class with canonical grants and explicit growth", () => {
    expect(BASE_CLASS_PROFILES.map((profile) => profile.id)).toEqual(
      PLAYER_CLASSES.map((definition) => definition.id),
    );
    for (const profile of BASE_CLASS_PROFILES) {
      const definition = PLAYER_CLASSES.find((entry) => entry.id === profile.id)!;
      expect(profile.maxRank).toBe(NORMAL_LEVEL_CAP);
      expect(profile.hpGrowth.hitDie).toBe(definition.hitDie);
      expect(profile.mpGrowth).toEqual({
        pool: "mp", base: 2, stat: "intelligence", minimum: 1,
      });
      expect(profile.primaryStat).toBe(definition.primaryStat);
      expect(profile.equipmentPermissions).toEqual(["weapon", "armor", "shield"]);
      expect(profile.entryRequirements.length).toBeGreaterThan(0);
      for (const grant of profile.grants) {
        const definition = grant.kind === "spell"
          ? SPELLS.find((spell) => spell.id === grant.id)
          : grant.kind === "ability"
            ? ABILITIES.find((ability) => ability.id === grant.id)
            : TALENTS.find((talent) => talent.id === grant.id);
        expect(definition).toBeDefined();
        expect(grant.rank).toBe(definition?.levelRequired);
      }
    }
  });

  const requirements: Array<[BaseClassId, Array<keyof PlayerStats>]> = [
    ["barbarian", ["strength"]],
    ["ranger", ["dexterity", "wisdom"]],
    ["wizard", ["intelligence"]],
    ["sorcerer", ["charisma"]],
    ["rogue", ["dexterity"]],
    ["paladin", ["strength", "charisma"]],
    ["warlock", ["charisma"]],
    ["cleric", ["wisdom"]],
    ["druid", ["wisdom"]],
    ["monk", ["dexterity", "wisdom"]],
    ["bard", ["charisma"]],
  ];
  it.each(requirements)("checks every %s entry score at the 13 boundary", (id, keys) => {
    const player = hero();
    player.stats = { ...eligibleStats };
    for (const key of keys) {
      player.stats[key] = 12;
      expect(qualifyNextClass(player, id).qualified).toBe(false);
      player.stats[key] = 13;
    }
    expect(qualifyNextClass(player, id).qualified).toBe(true);
  });

  it("allows Knight entry with either Strength or Dexterity 13", () => {
    const player = hero("wizard");
    player.stats.strength = 12;
    player.stats.dexterity = 12;
    expect(qualifyNextClass(player, "knight").qualified).toBe(false);
    player.stats.dexterity = 13;
    expect(qualifyNextClass(player, "knight").qualified).toBe(true);
    player.stats.dexterity = 12;
    player.stats.strength = 13;
    expect(qualifyNextClass(player, "knight").qualified).toBe(true);
  });

  it("requires the starting class prerequisite only when entering a new class", () => {
    const player = hero("paladin");
    player.stats.strength = 8;
    player.stats.charisma = 8;
    expect(qualifyNextClass(player, "wizard").qualified).toBe(false);
    expect(qualifyNextClass(player, "paladin").qualified).toBe(true);
    advance(player, "paladin");
    expect(player.level).toBe(2);
  });

  it("rejects unknown tracks and caps normal progression", () => {
    expect(qualifyNextClass(hero(), "unknown").qualified).toBe(false);
    const player = hero();
    awardXP(player, xpForLevel(30));
    processPendingLevelUps(player);
    expect(player.level).toBe(20);
    expect(getTotalLevel(player)).toBe(20);
    expect(qualifyNextClass(player, "wizard").qualified).toBe(false);
    expect(prepareHeroLevelUp(player).ok).toBe(false);
    expect(player.pendingLevelUps).toBe(0);
  });
});

describe("once-only prepared level application", () => {
  it.each(PLAYER_CLASSES)("supports every legal next-class combination from $id", (starting) => {
    for (const next of PLAYER_CLASSES) {
      const player = hero(starting.id);
      advance(player, next.id);
      expect(getTotalLevel(player)).toBe(2);
      expect(player.classProgression.startingClassId).toBe(starting.id);
      expect(getClassLevel(player, next.id)).toBe(next.id === starting.id ? 2 : 1);
      expect(player.hp).toBe(player.maxHp);
      expect(player.mp).toBe(player.maxMp);
    }
  });

  it.each(PLAYER_CLASSES)("preserves all historical single-class gains for $id", (definition) => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const player = hero(definition.id);
    let hp = player.maxHp;
    let mp = player.maxMp;
    const spells = [...player.knownSpells];
    const abilities = [...player.knownAbilities];
    const talents: string[] = [];
    let asi = 0;
    for (let level = 2; level <= NORMAL_LEVEL_CAP; level++) {
      hp += Math.max(1, Math.floor(definition.hitDie / 2) + 1 + abilityModifier(player.stats.constitution));
      mp += Math.max(1, 2 + abilityModifier(player.stats.intelligence));
      for (const spell of SPELLS) {
        if (definition.spells.includes(spell.id) && spell.levelRequired <= level
          && !spells.includes(spell.id)) spells.push(spell.id);
      }
      for (const ability of ABILITIES) {
        if (definition.abilities.includes(ability.id) && ability.levelRequired <= level
          && !abilities.includes(ability.id)) abilities.push(ability.id);
      }
      for (const talent of TALENTS) {
        if (talent.levelRequired <= level && !talents.includes(talent.id)
          && (!talent.classRestriction || talent.classRestriction.includes(definition.id))) {
          talents.push(talent.id);
          hp += talent.maxHpBonus ?? 0;
          mp += talent.maxMpBonus ?? 0;
        }
      }
      if ([4, 8, 12, 16, 19].includes(level)) asi += 2;
      awardXP(player, xpForLevel(level) - player.xp);
      processPendingLevelUps(player);
      expect(player.maxHp).toBe(hp);
      expect(player.maxMp).toBe(mp);
      expect(player.knownSpells).toEqual(spells);
      expect(player.knownAbilities).toEqual(abilities);
      expect(player.knownTalents).toEqual(talents);
      expect(player.pendingStatPoints).toBe(asi);
    }
  });

  it("does not roll for invalid preparation or read-only previews", () => {
    const player = hero();
    const random = vi.fn(() => 0.5);
    expect(prepareHeroLevelUp(player, random).ok).toBe(false);
    expect(previewHeroLevelUp(player, "wizard").ok).toBe(false);
    expect(random).not.toHaveBeenCalled();
    awardXP(player, xpForLevel(2));
    expect(prepareHeroLevelUp(player, random).ok).toBe(true);
    const saved = structuredClone(player);
    expect(prepareHeroLevelUp(player, random).ok).toBe(true);
    expect(previewHeroLevelUp(player, "wizard").ok).toBe(true);
    expect(previewHeroLevelUp(player, "barbarian").ok).toBe(true);
    expect(player).toEqual(saved);
    expect(random).toHaveBeenCalledTimes(1);
  });

  it("previews exact selected-class growth without repeating starting boosts", () => {
    const player = hero();
    awardXP(player, xpForLevel(2));
    prepareHeroLevelUp(player, () => 0.5);
    const stats = { ...player.stats };
    const weapon = player.equippedWeapon;
    const hp = player.maxHp;
    const mp = player.maxMp;
    const preview = previewHeroLevelUp(player, "wizard");
    expect(preview.ok).toBe(true);
    if (!preview.ok) throw new Error(preview.message);
    expect(preview.preview.hpGain).toBe(6);
    expect(preview.preview.mpGain).toBe(4);
    expect(preview.preview.newSpells.map((spell) => spell.id)).toEqual([
      "fireBolt", "rayOfFrost",
    ]);
    const result = commitHeroLevelUp(player, {
      trackId: "wizard", expectedTotalLevel: 1,
    });
    expect(result.ok).toBe(true);
    expect(player.maxHp).toBe(hp + preview.preview.hpGain);
    expect(player.maxMp).toBe(mp + preview.preview.mpGain);
    expect(player.stats).toEqual(stats);
    expect(player.equippedWeapon).toBe(weapon);
    expect(player.inventory).toContain(weapon);
    expect(player.classProgression.startingClassId).toBe("knight");
    expect(player.classProgression.classLevels).toEqual({ knight: 1, wizard: 1 });
    expect(player.appearanceId).toBe("knight");
  });

  it("freezes growth scores even when a pending ASI is allocated", () => {
    const player = hero();
    awardXP(player, xpForLevel(2));
    prepareHeroLevelUp(player, () => 0.1);
    const before = previewHeroLevelUp(player, "wizard");
    player.pendingStatPoints = 1;
    expect(allocateStatPoint(player, "intelligence")).toBe(true);
    expect(previewHeroLevelUp(player, "wizard")).toEqual(before);
  });

  it("rejects stale, repeated, unqualified and unearned input without mutation", () => {
    const player = hero();
    awardXP(player, xpForLevel(4));
    prepareHeroLevelUp(player, () => 0.25);
    const before = structuredClone(player);
    expect(commitHeroLevelUp(player, {
      trackId: "wizard", expectedTotalLevel: 0,
    }).ok).toBe(false);
    expect(commitHeroLevelUp(player, {
      trackId: "unknown", expectedTotalLevel: 1,
    }).ok).toBe(false);
    expect(player).toEqual(before);
    player.stats.intelligence = 12;
    const unqualified = structuredClone(player);
    expect(commitHeroLevelUp(player, {
      trackId: "wizard", expectedTotalLevel: 1,
    }).ok).toBe(false);
    expect(player).toEqual(unqualified);
    player.stats.intelligence = 13;
    expect(commitHeroLevelUp(player, {
      trackId: "wizard", expectedTotalLevel: 1,
    }).ok).toBe(true);
    const committed = structuredClone(player);
    expect(commitHeroLevelUp(player, {
      trackId: "wizard", expectedTotalLevel: 1,
    }).ok).toBe(false);
    expect(player).toEqual(committed);
    expect(player.pendingLevelUps).toBe(2);
    expect(player.classProgression.pendingLevel).toBeNull();
  });

  it("rejects invalid random values before preparing a receipt", () => {
    for (const value of [NaN, Infinity, -1, 1]) {
      const player = hero();
      awardXP(player, xpForLevel(2));
      const before = structuredClone(player);
      expect(prepareHeroLevelUp(player, () => value).ok).toBe(false);
      expect(player).toEqual(before);
    }
  });

  it("rejects corrupt prepared resources and ownership before mutation", () => {
    const player = hero();
    awardXP(player, xpForLevel(2));
    prepareHeroLevelUp(player, () => 0.5);
    if (!player.classProgression.pendingLevel) throw new Error("Missing receipt");
    player.classProgression.pendingLevel = { ...player.classProgression.pendingLevel, resourceRoll: NaN };
    const corrupt = structuredClone(player);
    expect(commitHeroLevelUp(player, {
      trackId: "wizard", expectedTotalLevel: 1,
    }).ok).toBe(false);
    expect(player).toEqual(corrupt);
    player.classProgression.pendingLevel = null;
    player.classProgression.classLevels = { wizard: 1 };
    expect(prepareHeroLevelUp(player).ok).toBe(false);
  });
});

describe("source-aware progression", () => {
  it("uses total level for proficiency, common talents and ASIs", () => {
    const player = hero();
    advance(player, "wizard");
    advance(player, "cleric");
    advance(player, "rogue");
    expect(getTotalLevel(player)).toBe(4);
    expect(player.pendingStatPoints).toBe(2);
    expect(player.knownTalents.filter((id) => id === "toughness")).toHaveLength(1);
    expect(player.knownTalents).not.toContain("improvedCritical");
    advance(player, "bard");
    expect(getProficiencyBonus(player)).toBe(3);
    expect(getClassLevel(player, "knight")).toBe(1);
    expect(getClassLevel(player, "wizard")).toBe(1);
    expect(getClassLevel(player, "barbarian")).toBe(0);
    expect(player.pendingStatPoints).toBe(2);
  });

  it("does not unlock high-rank features from total level", () => {
    const player = hero("knight");
    for (let index = 0; index < 5; index++) advance(player, "knight");
    advance(player, "wizard");
    expect(player.level).toBe(7);
    expect(player.knownAbilities).toContain("actionSurge");
    expect(player.knownSpells).toContain("fireBolt");
    expect(player.knownSpells).not.toContain("fireball");
    expect(player.knownSpells).not.toContain("magicMissile");
    advance(player, "wizard");
    expect(player.knownSpells).toContain("magicMissile");
    expect(player.knownSpells).not.toContain("fireball");
  });

  it("deduplicates overlapping grants and one-time resource talents", () => {
    const player = hero("wizard");
    for (let index = 0; index < 3; index++) advance(player, "wizard");
    const hp = player.maxHp;
    const mp = player.maxMp;
    for (let index = 0; index < 4; index++) advance(player, "sorcerer");
    expect(player.knownTalents.filter((id) => id === "arcaneWard")).toHaveLength(1);
    expect(player.knownSpells.filter((id) => id === "fireBolt")).toHaveLength(1);
    expect(player.maxHp).toBe(hp + 24);
    expect(player.maxMp).toBe(mp + 20);
    expect(getFeatureSources(player, "talent", "arcaneWard").map(
      (source) => source.trackId,
    )).toEqual(["wizard", "sorcerer"]);
    expect(player.pendingStatPoints).toBe(4);
  });

  it("uses qualified spell origins and not the current appearance", () => {
    const player = hero("cleric");
    advance(player, "bard");
    player.stats.wisdom = 15;
    player.stats.charisma = 18;
    expect(getSpellCastingStat(player, "cureWounds")).toBe("charisma");
    expect(getSpellCastingStat(player, "sacredFlame")).toBe("wisdom");
    player.appearanceId = "barbarian";
    expect(getSpellCastingStat(player, "cureWounds")).toBe("charisma");
    expect(getSpellCastingStat(player, "sacredFlame")).toBe("wisdom");
    player.stats.wisdom = 18;
    expect(getSpellCastingStat(player, "cureWounds")).toBe("wisdom");
  });

  it("retains permissive equipment eligibility and single-class companions", () => {
    const player = hero("wizard");
    expect(canActorEquip(player, getItem("plateArmor")!)).toBe(true);
    const companion = createCompanionState("guardian", 5);
    expect(getTotalLevel(companion)).toBe(5);
    expect(getClassLevel(companion, "paladin")).toBe(5);
    expect("classProgression" in companion).toBe(false);
    expect(getProgressionTracks(companion).map((track) => track.id)).toEqual(["paladin"]);
  });

  it("provides bounded external profiles without advancing any base class", () => {
    const player = hero();
    for (let index = 0; index < 6; index++) advance(player, "knight");
    const base = BASE_CLASS_PROFILES[0];
    const testProfile: ProgressionTrackProfile = {
      ...base,
      id: "prestige:testPath",
      kind: "prestige",
      label: "Fixture track",
      maxRank: 5,
      primaryStat: "wisdom",
      grants: [{ kind: "spell", id: "cureWounds", rank: 1 }],
      entryRequirements: [{ type: "totalLevel", minimum: 7 }],
    };
    const context = { profiles: [...BASE_CLASS_PROFILES, testProfile] };
    awardXP(player, xpForLevel(8) - player.xp);
    prepareHeroLevelUp(player, () => 0.5);
    expect(previewHeroLevelUp(player, testProfile.id, context).ok).toBe(true);
    const result = commitHeroLevelUp(player, {
      trackId: testProfile.id, expectedTotalLevel: 7,
    }, context);
    expect(result.ok).toBe(true);
    expect(player.classProgression.classLevels).toEqual({ knight: 7 });
    expect(player.classProgression.trackLevels).toEqual({ "prestige:testPath": 1 });
    expect(getTotalLevel(player)).toBe(8);
    expect(player.pendingStatPoints).toBe(4);
    expect(getSpellCastingStat(player, "cureWounds", context)).toBe("wisdom");
  });
});
