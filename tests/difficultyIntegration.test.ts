import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PhysicalDamageType } from "../src/data/damageTypes";
import { Element } from "../src/data/elements";
import { getItem } from "../src/data/items";
import { getMonster, type Monster, type MonsterAbility } from "../src/data/monsters";
import {
  changeCampaignDifficulty,
  createCampaignDifficulty,
  getCampaignDifficultyRules,
  getDifficultyTimingAdjustment,
  scaleEnemyDamage,
} from "../src/systems/difficulty";
import { monsterAttack, monsterUseAbility } from "../src/systems/combat";
import { createCodex } from "../src/systems/codex";
import { createCurrentSaveData, normalizeSaveData, SAVE_VERSION } from "../src/systems/save";
import { prepareHeroLevelUp } from "../src/systems/classProgression";
import { awardXP, xpForLevel } from "../src/systems/player";
import { visitDevotionTemple, performTempleRite } from "../src/systems/devotionTemples";
import { applyStatusEffect, processEndOfTurn, processStartOfTurn } from "../src/systems/statusEffects";
import { createMinigameState } from "../src/systems/minigameState";
import { applyMinigameAction, startMinigame } from "../src/systems/minigames";
import { createBattleTimingSettings, resolveBattleTimingSettings } from "../src/systems/battleTimingSettings";
import { playerAt, requestFor, startRequest } from "./helpers/minigames";
import { advancePrestige, prestigeFixture } from "./helpers/prestige";
import { createDifficultyPlayer, DIFFICULTY_MODE_CASES } from "./difficultyFixtures";

beforeEach(() => vi.spyOn(Math, "random").mockReturnValue(0.5));
afterEach(() => vi.restoreAllMocks());

describe.each(DIFFICULTY_MODE_CASES)("$name combined campaign contracts", ({ selection }) => {
  it("scales incoming dice once before armor while retaining real faces and capped HP deltas", () => {
    const player = createDifficultyPlayer(selection);
    player.equippedArmor = { ...getItem("leatherArmor")! };
    player.hp = 2;
    const monster: Monster = {
      ...getMonster("goblin")!, attackBonus: 30, damageCount: 1, damageDie: 12,
      physicalDamageType: PhysicalDamageType.Bludgeoning,
    };
    const rules = getCampaignDifficultyRules(player);
    const effects: typeof player.activeEffects = [];
    applyStatusEffect(effects, "slow", "Fixture");
    const result = monsterAttack(monster, player, 0, 0, 0, effects, 0, 3);
    const scaled = scaleEnemyDamage(8, rules);
    const armored = Math.floor(scaled / 2);
    expect(result.damage).toBe(armored);
    expect(result.physicalLabel).toBe("resistant");
    expect(player.hp).toBe(0);
    expect(result.damageRoll?.roll).toMatchObject({ naturalRolls: [7], modifier: 1, total: 8 });
    expect(result.damageRoll?.amount).toBe(armored);
    expect(result.damageRoll?.application?.amount).toBe(2);
    expect(result.damageRoll?.adjustments.map((adjustment) => adjustment.amount))
      .toEqual(rules.enemyDamageMultiplier === 1 ? [armored] : [scaled, armored]);

    const physicalAbility: MonsterAbility = {
      name: "Fixture Slam", chance: 1, damageCount: 1, damageDie: 12,
      type: "damage", physicalDamageType: PhysicalDamageType.Bludgeoning,
    };
    player.hp = player.maxHp;
    const physical = monsterUseAbility(physicalAbility, monster, player, effects, 3);
    expect(physical.damage).toBe(armored);
    expect(physical.damageRoll?.roll?.naturalRolls).toEqual([7]);
    player.hp = player.maxHp;
    const magic = monsterUseAbility({
      ...physicalAbility, physicalDamageType: undefined, element: Element.Fire,
    }, monster, player, effects, 3);
    expect(magic.damage).toBe(scaled);
    expect(magic.physicalLabel).toBeUndefined();
    expect(magic.damageRoll?.application?.amount).toBe(scaled);
  });

  it("records scaled status damage without adding RNG or changing saves", () => {
    const player = createDifficultyPlayer(selection);
    const effects: typeof player.activeEffects = [];
    applyStatusEffect(effects, "poison", "Fixture");
    applyStatusEffect(effects, "burn", "Fixture");
    const base = processStartOfTurn(structuredClone(effects), player.stats);
    vi.mocked(Math.random).mockClear();
    const scaled = processStartOfTurn(structuredClone(effects), player.stats, {
      adjustDamage: (damage) => scaleEnemyDamage(damage, getCampaignDifficultyRules(player)),
    });
    expect(Math.random).toHaveBeenCalledTimes(
      base.savingThrows.length + base.damageRolls.filter((entry) => entry.damageRoll.roll).length,
    );
    expect(scaled.savingThrows).toEqual(base.savingThrows);
    scaled.damageRolls.forEach((entry, index) => {
      expect(entry.damageRoll.roll).toEqual(base.damageRolls[index]!.damageRoll.roll);
      expect(entry.damageRoll.amount)
        .toBe(scaleEnemyDamage(base.damageRolls[index]!.damageRoll.amount, getCampaignDifficultyRules(player)));
    });
  });

  it("suggests supported durations only after explicit timing opt-in without changing its configuration", () => {
    const standard = createBattleTimingSettings();
    const adjustment = getDifficultyTimingAdjustment(selection);
    expect(resolveBattleTimingSettings(standard, adjustment)).toEqual(standard);
    const timed = { ...standard, mode: "timed" as const, durationSeconds: 90 as const };
    const before = structuredClone(timed);
    expect(resolveBattleTimingSettings(timed, adjustment)).toEqual({
      ...timed, durationSeconds: adjustment.durationSeconds ?? 90,
    });
    expect(timed).toEqual(before);
  });

  it.each(["willowInnTable", "willowdaleRange", "sandportRegatta"] as const)(
    "blocks changes while %s owns an exact paid session and preserves it on reload",
    (venueId) => {
      const player = playerAt(venueId);
      player.difficulty = createCampaignDifficulty(selection);
      expect(startMinigame(player, startRequest(player, venueId)).ok).toBe(true);
      const before = structuredClone(player);
      const persist = vi.fn(() => ({ ok: true, message: "saved" }));
      expect(changeCampaignDifficulty(player, { profileId: "standard" }, {
        phase: "exploration", inputAccepted: true, confirmed: true, timeStep: 45,
      }, persist).message).toContain("tavern or festival");
      expect(player).toEqual(before);
      expect(persist).not.toHaveBeenCalled();
      const loaded = normalizeSaveData(JSON.parse(JSON.stringify(
        createCurrentSaveData(player, new Set(), createCodex(), player.appearanceId, 45),
      )));
      expect(loaded?.player.difficulty).toEqual(before.difficulty);
      expect(loaded?.player.progression.minigames).toEqual(before.progression.minigames);
      expect(loaded?.player.gold).toBe(before.gold);
      expect(loaded?.player.progression.nautical.ownedBoats).toEqual(before.progression.nautical.ownedBoats);
      if (venueId === "willowInnTable") {
        expect(applyMinigameAction(player, requestFor(player, { type: "bank" })).ok).toBe(true);
        expect(player.progression.minigames.pending?.phase).toBe("result");
        expect(changeCampaignDifficulty(player, { profileId: "standard" }, {
          phase: "exploration", inputAccepted: true, confirmed: true, timeStep: 45,
        }, persist).ok).toBe(false);
        expect(persist).not.toHaveBeenCalled();
      }
    },
  );
});

it("upgrades main v25 while preserving prestige, frozen growth, exact custom gear, devotion and activity authority", () => {
  const player = prestigeFixture("prismScribe");
  advancePrestige(player, "prismScribe");
  awardXP(player, xpForLevel(player.level + 1) - player.xp);
  expect(prepareHeroLevelUp(player, () => 0.35).ok).toBe(true);
  if (!player.equippedWeapon) throw new Error("Missing fixture weapon");
  const gear = { ...player.equippedWeapon, id: "mockRulesStaff", name: "Mock Rules Staff" };
  player.inventory.push(gear);
  player.equippedWeapon = gear;
  Object.assign(player.position, {
    inCity: true, cityId: "willowdale_city", cityChunkIndex: 1, x: 10, y: 8,
  });
  player.progression.devotion.deityId = "orivane";
  visitDevotionTemple(player, "willowdaleSpan");
  performTempleRite(player, "willowdaleSpanThread");
  processEndOfTurn(player.activeEffects);
  player.position = playerAt("willowdaleRange").position;
  player.gold = 1_000;
  player.progression.minigames = createMinigameState(167);
  expect(startMinigame(player, startRequest(player, "willowdaleRange")).ok).toBe(true);
  player.battleTiming = { mode: "timed", durationSeconds: 60, timeoutAction: "defend" };
  const { difficulty: _difficulty, ...mainPlayer } = structuredClone(player);
  const before = structuredClone(mainPlayer);
  const random = vi.mocked(Math.random);
  random.mockClear();
  const loaded = normalizeSaveData({
    ...createCurrentSaveData(player, new Set(), createCodex(), player.appearanceId, 45),
    version: 25, player: mainPlayer,
  });
  expect(loaded?.version).toBe(SAVE_VERSION);
  expect(loaded?.player.difficulty).toEqual(createCampaignDifficulty());
  for (const key of ["classProgression", "level", "xp", "hp", "maxHp", "mp", "maxMp", "stats",
    "pendingLevelUps", "pendingStatPoints", "inventory", "activeEffects", "battleTiming"] as const) {
    expect(loaded?.player[key]).toEqual(before[key]);
  }
  expect(loaded?.player.progression.devotion).toEqual(before.progression.devotion);
  expect(loaded?.player.progression.minigames).toEqual(before.progression.minigames);
  expect(loaded?.player.gold).toBe(before.gold);
  const inventory = loaded?.player.inventory;
  expect(loaded?.player.equippedWeapon).toBe(inventory?.[inventory.length - 1]);
  expect(random).not.toHaveBeenCalled();
});

it("keeps v19 difficulty-preview continuity and legacy resources instead of applying modern repair growth", () => {
  const player = createDifficultyPlayer({ profileId: "legendary" });
  player.hp = 13;
  player.maxHp = 53;
  player.mp = 7;
  player.maxMp = 19;
  player.knownSpells = ["magicMissile"];
  const weapon = { ...getItem("startSword")!, id: "mockPreviewSword", name: "Mock Preview Sword", effect: 4.5 };
  player.inventory = [weapon];
  player.equippedWeapon = weapon;
  const { classProgression: _classProgression, ...preview } = structuredClone(player);
  const random = vi.mocked(Math.random);
  random.mockClear();
  const loaded = normalizeSaveData({
    ...createCurrentSaveData(player, new Set(), createCodex(), player.appearanceId, 0),
    version: 19, player: preview,
  });
  expect(loaded?.player.difficulty).toEqual(player.difficulty);
  for (const key of ["hp", "maxHp", "mp", "maxMp", "stats", "inventory", "knownSpells"] as const) {
    expect(loaded?.player[key]).toEqual(player[key]);
  }
  expect(loaded?.player.classProgression.legacyGrants.spells).toContain("magicMissile");
  expect(loaded?.player.equippedWeapon).toBe(loaded?.player.inventory[0]);
  expect(random).not.toHaveBeenCalled();
});
