import { afterEach, describe, expect, it, vi } from "vitest";
import { getAbility } from "../src/data/abilities";
import { getAvailableSpells, getSpell } from "../src/data/spells";
import { getTalent, isTotalLevelTalent } from "../src/data/talents";
import { PRESTIGE_PATHS, getPrestigePath, type PrestigePathId } from "../src/data/prestige";
import {
  commitHeroLevelUp, getAvailableProgressionGrants, getFeatureSources,
  getProficiencyBonus, getSpellCastingStat, getTotalLevel, prepareHeroLevelUp,
  prepareNextHeroLevelUp, previewHeroLevelUp, qualifyNextClass,
} from "../src/systems/classProgression";
import { createHeroProgressionContext } from "../src/systems/classProgressionContext";
import { createCompanionState } from "../src/systems/party";
import { awardXP, createPlayer, processPendingLevelUps, xpForLevel } from "../src/systems/player";
import { buildPrestigeDetails } from "../src/systems/prestige";
import {
  prestigeFixture as fixture, prestigeStats as stats, prestigeStartingClasses as startingClasses,
} from "./helpers/prestige";
import { BASE_CLASS_IDS, PROGRESSION_PROFILES, type ProgressionRequirement } from "../src/data/classProgression";
import { isValidProgressionRequirement } from "../src/systems/classProgression";

afterEach(() => vi.restoreAllMocks());

describe("original prestige profile integrity", () => {
  it("installs six optional five-rank archetypes with valid scoped features and full tables", () => {
    expect(PRESTIGE_PATHS).toHaveLength(6);
    expect(new Set(PRESTIGE_PATHS.map((path) => path.id)).size).toBe(6);
    expect(new Set(PRESTIGE_PATHS.map((path) => path.archetype)).size).toBe(6);
    for (const path of PRESTIGE_PATHS) {
      expect(path.id).toMatch(/^prestige:[a-z][a-zA-Z0-9]*$/);
      expect(path.kind).toBe("prestige");
      expect(path.maxRank).toBe(5);
      expect(path.equipmentPermissions).toEqual([]);
      expect(path.entryRequirements).toContainEqual({ type: "totalLevel", minimum: 6 });
      for (const grant of path.grants) {
        expect(grant.rank).toBeGreaterThanOrEqual(1);
        expect(grant.rank).toBeLessThanOrEqual(5);
        const feature = grant.kind === "spell" ? getSpell(grant.id)
          : grant.kind === "ability" ? getAbility(grant.id) : getTalent(grant.id);
        expect(feature, grant.id).toBeDefined();
        if (grant.kind === "talent") expect(isTotalLevelTalent(getTalent(grant.id)!)).toBe(false);
      }
      const details = buildPrestigeDetails(fixture(path.pathId), path.id);
      for (let rank = 1; rank <= 5; rank++) expect(details).toContain(`Rank ${rank}:`);
      expect(details).toContain("earned ranks remain");
    }
    expect(getPrestigePath("unknown")).toBeUndefined();
  });

  it("does not grant path features to normal heroes or companions", () => {
    const hero = createPlayer("Ordinary fixture", stats);
    awardXP(hero, xpForLevel(20));
    processPendingLevelUps(hero);
    const companion = createCompanionState("mystic", 20);
    for (const path of PRESTIGE_PATHS) for (const grant of path.grants) {
      const key = grant.kind === "spell" ? "spells" : grant.kind === "ability" ? "abilities" : "talents";
      expect(getAvailableProgressionGrants(hero)[key]).not.toContain(grant.id);
      if (grant.kind === "spell") expect(getAvailableSpells(20).map((spell) => spell.id)).not.toContain(grant.id);
      const known = grant.kind === "spell" ? companion.knownSpells
        : grant.kind === "ability" ? companion.knownAbilities : companion.knownTalents;
      expect(known).not.toContain(grant.id);
    }
  });
});

describe.each(PRESTIGE_PATHS.map((path) => [path.pathId] as const))("%s progression", (id) => {
  it("uses one frozen rested credit per rank, total milestones once, and entry-only evidence", () => {
    const hero = fixture(id);
    const path = getPrestigePath(id)!;
    const context = createHeroProgressionContext(() => hero);
    expect(qualifyNextClass(hero, path.id, context).qualified).toBe(true);
    expect(previewHeroLevelUp(hero, path.id, context).ok).toBe(false);
    prepareHeroLevelUp(hero, () => 0.5);
    const baseLevels = { ...hero.classProgression.classLevels };
    const firstPrepared = hero.classProgression.pendingLevel;
    expect(prepareNextHeroLevelUp(hero, () => 0.1)).toEqual({ ok: true, pending: firstPrepared });
    for (let rank = 1; rank <= 5; rank++) {
      if (rank > 1) {
        awardXP(hero, xpForLevel(hero.level + 1) - hero.xp);
        prepareHeroLevelUp(hero, () => 0.5);
      }
      const before = structuredClone(hero);
      const preview = previewHeroLevelUp(hero, path.id, context);
      expect(preview.ok).toBe(true);
      expect(hero).toEqual(before);
      if (!preview.ok) throw new Error(preview.message);
      const committed = commitHeroLevelUp(hero, { trackId: path.id, expectedTotalLevel: hero.level }, context);
      expect(committed.ok).toBe(true);
      expect(hero.level).toBe(6 + rank);
      expect(getTotalLevel(hero)).toBe(hero.level);
      expect(hero.classProgression.classLevels).toEqual(baseLevels);
      expect(hero.classProgression.trackLevels[path.id]).toBe(rank);
      expect(hero.maxHp).toBe(before.maxHp + preview.preview.hpGain);
      expect(hero.maxMp).toBe(before.maxMp + preview.preview.mpGain);
      expect(hero.pendingStatPoints).toBe(before.pendingStatPoints + preview.preview.asiGained);
      expect(hero.classProgression.readyLevelUps).toBe(0);
      expect(hero.pendingLevelUps).toBe(0);
      const after = structuredClone(hero);
      expect(commitHeroLevelUp(hero, { trackId: path.id, expectedTotalLevel: before.level }, context).ok).toBe(false);
      expect(hero).toEqual(after);
      hero.progression.social.factionReputation = {};
      hero.progression.discoveredCities = [];
      hero.progression.social.alignment = { lawChaos: 100, goodEvil: -100 };
      for (const grant of path.grants.filter((entry) => entry.rank <= rank)) {
        expect(getFeatureSources(hero, grant.kind, grant.id)).toContainEqual(
          expect.objectContaining({ kind: "track", trackId: path.id, rank: grant.rank }),
        );
        if (grant.kind === "spell") expect(getSpellCastingStat(hero, grant.id)).toBe(path.primaryStat);
      }
    }
    expect(getProficiencyBonus(hero)).toBe(4);
    expect(qualifyNextClass(hero, path.id, context).qualified).toBe(false);
    expect(hero.knownTalents.filter((entry) => entry === "resilience")).toHaveLength(1);
  });

  it("rejects missing, stale-owner and freshly changed world evidence without spending", () => {
    const hero = fixture(id);
    const path = getPrestigePath(id)!;
    prepareHeroLevelUp(hero, () => 0.5);
    const context = createHeroProgressionContext(() => hero);
    const clone = structuredClone(hero);
    expect(previewHeroLevelUp(clone, path.id, context).ok).toBe(false);
    expect(previewHeroLevelUp(clone, path.id, createHeroProgressionContext(() => clone)).ok).toBe(true);
    hero.progression.social.factionReputation = {};
    hero.progression.discoveredCities = [];
    const before = structuredClone(hero);
    expect(previewHeroLevelUp(hero, path.id).ok).toBe(false);
    expect(commitHeroLevelUp(hero, { trackId: path.id, expectedTotalLevel: 6 }, context).ok).toBe(false);
    expect(hero).toEqual(before);
  });
});

describe("prestige entry boundaries", () => {
  it.each(PRESTIGE_PATHS.filter((path) => path.archetype !== "hybrid"))(
    "covers every $pathId class branch at rank3/4 without accepting cosmetic state",
    (path) => {
      const classOptions = path.entryRequirements.find((entry) =>
        entry.type === "anyOf" && entry.requirements.every((child) => child.type === "classLevel"));
      if (classOptions?.type !== "anyOf") throw new Error("Missing class alternatives");
      for (const entry of classOptions.requirements) {
        if (entry.type !== "classLevel") throw new Error("Invalid fixture alternative");
        const hero = createPlayer("Class boundary fixture", stats, entry.classId);
        awardXP(hero, xpForLevel(6));
        processPendingLevelUps(hero);
        const evidence = fixture(path.pathId);
        hero.progression.social = evidence.progression.social;
        hero.progression.discoveredCities = evidence.progression.discoveredCities;
        const other = BASE_CLASS_IDS.find((id) => id !== entry.classId)!;
        hero.classProgression.classLevels = { [entry.classId]: 3, [other]: 3 };
        const context = createHeroProgressionContext(() => hero);
        expect(qualifyNextClass(hero, path.id, context).qualified).toBe(false);
        hero.classProgression.classLevels = { [entry.classId]: 4, [other]: 2 };
        expect(qualifyNextClass(hero, path.id, context).qualified).toBe(true);
      }
    },
  );

  it.each<ProgressionRequirement>([
    { type: "anyOf", requirements: [] },
    { type: "allOf", requirements: [] },
    { type: "abilityScore", stat: "strength", minimum: Number.NaN },
    { type: "alignmentAxis", axis: "lawChaos", minimum: 30, maximum: 20 },
    { type: "questStageCompleted", questId: "twelvefoldCovenant", stageId: "unknownStage" },
  ])("fails closed on malformed grouped/owner predicates %j at preview and commit", (requirement) => {
    const hero = fixture("roadglassBulwark");
    prepareHeroLevelUp(hero, () => 0.5);
    const path = getPrestigePath("roadglassBulwark")!;
    const profiles = [...PROGRESSION_PROFILES.filter((profile) => profile.id !== path.id),
      { ...path, entryRequirements: [requirement] }];
    const context = createHeroProgressionContext(() => hero, profiles);
    const before = structuredClone(hero);
    expect(isValidProgressionRequirement(requirement)).toBe(false);
    expect(previewHeroLevelUp(hero, path.id, context).ok).toBe(false);
    expect(commitHeroLevelUp(hero, { trackId: path.id, expectedTotalLevel: 6 }, context).ok).toBe(false);
    expect(hero).toEqual(before);
  });

  it.each(PRESTIGE_PATHS.map((path) => [path.pathId, path.primaryStat] as const))(
    "%s requires its fixed score and applied total before entry",
    (id, stat) => {
      const hero = fixture(id);
      const path = getPrestigePath(id)!;
      const context = createHeroProgressionContext(() => hero);
      hero.stats[stat] = 12;
      expect(qualifyNextClass(hero, path.id, context).qualified).toBe(false);
      hero.stats[stat] = 13;
      expect(qualifyNextClass(hero, path.id, context).qualified).toBe(true);
      const fresh = createPlayer("Low-level fixture", stats, startingClasses[id]);
      awardXP(fresh, xpForLevel(20));
      expect(qualifyNextClass(fresh, path.id, createHeroProgressionContext(() => fresh)).qualified).toBe(false);
    },
  );

  it("accepts exact quest completion and discovered-city alternatives, not current-stage or cosmetic flags", () => {
    const prism = fixture("prismScribe");
    prism.progression.social.factionReputation = {};
    const path = getPrestigePath("prismScribe")!;
    const context = createHeroProgressionContext(() => prism);
    const main = prism.progression.quests.quests.twelvefoldCovenant;
    main.status = "active";
    main.stage = 1;
    expect(qualifyNextClass(prism, path.id, context).qualified).toBe(false);
    main.stage = 2;
    expect(qualifyNextClass(prism, path.id, context).qualified).toBe(true);
    main.status = "locked";
    prism.progression.discoveredFeatureIds.push("prestige");
    expect(qualifyNextClass(prism, path.id, context).qualified).toBe(false);
    const wake = fixture("rootwakeKeeper");
    wake.progression.social.factionReputation = {};
    expect(qualifyNextClass(wake, getPrestigePath("rootwakeKeeper")!.id,
      createHeroProgressionContext(() => wake)).qualified).toBe(true);
    expect(wake.position.inCity).toBe(false);
  });

  it("checks faction14/15, morality-1/0 and law24/25 exactly", () => {
    const road = fixture("roadglassBulwark");
    const roadPath = getPrestigePath("roadglassBulwark")!;
    const roadContext = createHeroProgressionContext(() => road);
    road.progression.social.factionReputation.heartlandsWardens = 14;
    expect(qualifyNextClass(road, roadPath.id, roadContext).qualified).toBe(false);
    road.progression.social.factionReputation.heartlandsWardens = 15;
    expect(qualifyNextClass(road, roadPath.id, roadContext).qualified).toBe(true);
    const hearth = fixture("hearthlightCustodian");
    const hearthContext = createHeroProgressionContext(() => hearth);
    hearth.progression.social.alignment.goodEvil = -1;
    expect(qualifyNextClass(hearth, getPrestigePath("hearthlightCustodian")!.id, hearthContext).qualified).toBe(false);
    hearth.progression.social.alignment.goodEvil = 0;
    expect(qualifyNextClass(hearth, getPrestigePath("hearthlightCustodian")!.id, hearthContext).qualified).toBe(true);
    const dusk = fixture("duskthreadCourier");
    const duskContext = createHeroProgressionContext(() => dusk);
    dusk.progression.social.alignment.lawChaos = 24;
    expect(qualifyNextClass(dusk, getPrestigePath("duskthreadCourier")!.id, duskContext).qualified).toBe(true);
    dusk.progression.social.alignment.lawChaos = 25;
    expect(qualifyNextClass(dusk, getPrestigePath("duskthreadCourier")!.id, duskContext).qualified).toBe(false);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 101, 15.5])(
    "rejects malformed live reputation %s before spending a prepared level",
    (value) => {
      const hero = fixture("roadglassBulwark");
      prepareHeroLevelUp(hero, () => 0.5);
      hero.progression.social.factionReputation.heartlandsWardens = value;
      const before = structuredClone(hero);
      const context = createHeroProgressionContext(() => hero);
      expect(qualifyNextClass(hero, "prestige:roadglassBulwark", context).qualified).toBe(false);
      expect(commitHeroLevelUp(hero, { trackId: "prestige:roadglassBulwark", expectedTotalLevel: 6 }, context).ok)
        .toBe(false);
      expect(hero).toEqual(before);
    },
  );

  it("requires distinct hybrid classes and never exceeds the single level20 cap", () => {
    const hero = fixture("chordsteelEnvoy");
    const path = getPrestigePath("chordsteelEnvoy")!;
    const context = createHeroProgressionContext(() => hero);
    hero.classProgression.classLevels = { paladin: 6 };
    Object.assign(hero.classProgression, { startingClassId: "paladin" });
    expect(qualifyNextClass(hero, path.id, context).qualified).toBe(false);
    hero.classProgression.classLevels = { paladin: 4, bard: 2 };
    expect(qualifyNextClass(hero, path.id, context).qualified).toBe(true);
    hero.classProgression.classLevels = { paladin: 20 };
    hero.level = 20;
    expect(qualifyNextClass(hero, path.id, context).qualified).toBe(false);
  });
});
