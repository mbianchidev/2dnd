import { describe, expect, it } from "vitest";
import {
  MINIGAME_ACTIVITY_IDS,
  MINIGAME_DIFFICULTIES,
  MINIGAME_DIFFICULTY_IDS,
  MINIGAME_VENUES,
  getMinigameActivity,
  getMinigameRecordId,
  getMinigameVenue,
  isMinigameRecordId,
} from "../src/data/minigames";
import { getCity, getCityChunkMap, isWalkable } from "../src/data/map";
import {
  CROWN_AND_BONES_ODDS,
  classifyCrownDice,
  createMinigameChallenge,
  getArcheryScore,
  getCrownPayout,
  getCrownScore,
  getMinigameForecast,
} from "../src/systems/minigameRules";
import { WeatherType, rollWeather } from "../src/systems/weather";
import { vi } from "vitest";

describe("immutable activity and venue contracts", () => {
  it("ships all three activities with distinct stable rules, scores, and rewards", () => {
    expect(MINIGAME_ACTIVITY_IDS).toEqual(["crownAndBones", "archery", "regatta"]);
    for (const field of ["rulesetId", "scoreId", "rewardId"] as const) {
      expect(new Set(MINIGAME_ACTIVITY_IDS.map(
        (id) => getMinigameActivity(id)[field],
      )).size).toBe(3);
    }
    expect(new Set(MINIGAME_VENUES.map((venue) => venue.id)).size)
      .toBe(MINIGAME_VENUES.length);
  });

  it("places every venue on a safe existing city district and validates record IDs", () => {
    for (const venue of MINIGAME_VENUES) {
      const city = getCity(venue.cityId);
      expect(city, venue.id).toBeDefined();
      const map = getCityChunkMap(city!, venue.cityChunkIndex);
      expect(isWalkable(map[venue.y]![venue.x]!), venue.id).toBe(true);
      expect(getMinigameVenue(venue.id)).toBe(venue);
      for (const difficulty of MINIGAME_DIFFICULTY_IDS) {
        const recordId = getMinigameRecordId(venue.id, difficulty);
        expect(isMinigameRecordId(recordId)).toBe(true);
      }
    }
    expect(isMinigameRecordId("record:unknown:archeryV1:friendly")).toBe(false);
    expect(isMinigameRecordId("record:willowInnTable:archeryV1:friendly")).toBe(false);
  });
});

describe("Crown & Bones truthful odds and capped economy", () => {
  it("matches displayed odds against every one of the 36 ordered 2d6 outcomes", () => {
    const counts = { bones: 0, crown: 0, safe: 0 };
    for (let first = 1; first <= 6; first += 1) {
      for (let second = 1; second <= 6; second += 1) {
        const result = classifyCrownDice([first, second]);
        expect(result.total).toBe(first + second);
        expect(result.naturalRolls).toEqual([first, second]);
        counts[result.outcome] += 1;
      }
    }
    expect(counts).toEqual({ bones: 6, crown: 6, safe: 24 });
    expect(CROWN_AND_BONES_ODDS).toEqual({
      orderedOutcomes: 36,
      bones: 6,
      crown: 6,
      safe: 24,
    });
  });

  it("rejects fabricated or malformed natural dice rather than defaulting them", () => {
    for (const rolls of [[0, 6], [7, 1], [1.5, 2], [NaN, 1]] as const) {
      expect(() => classifyCrownDice(rolls)).toThrow(/natural/i);
    }
  });

  it("caps banking at twice the stake, includes the stake in the payout, and never refunds an unplayed hand", () => {
    for (const difficulty of MINIGAME_DIFFICULTY_IDS) {
      const cap = MINIGAME_DIFFICULTIES[difficulty].crownStakeCap;
      for (let stake = 1; stake <= cap; stake += 1) {
        expect(getCrownPayout(stake, 0, false)).toBe(0);
        expect(getCrownPayout(stake, 1, false)).toBe(Math.floor(stake / 2));
        expect(getCrownPayout(stake, 2, false)).toBe(stake);
        expect(getCrownPayout(stake, 3, false)).toBe(Math.floor(stake * 1.5));
        expect(getCrownPayout(stake, 4, false)).toBe(stake * 2);
        expect(getCrownPayout(stake, 4, true)).toBe(0);
      }
    }
  });

  it("has no profitable guaranteed or optimal stopping strategy at any allowed stake", () => {
    const orderedRolls = Array.from({ length: 36 }, (_, index): readonly [number, number] => [
      Math.floor(index / 6) + 1, index % 6 + 1,
    ]);
    for (const difficulty of MINIGAME_DIFFICULTY_IDS) {
      const firstMedalBonus = getMinigameActivity("crownAndBones").milestoneGold[
        MINIGAME_DIFFICULTY_IDS.indexOf(difficulty)
      ];
      for (let stake = 1; stake <= MINIGAME_DIFFICULTIES[difficulty].crownStakeCap; stake += 1) {
        for (const alreadyClaimed of [false, true]) {
          const memo = new Map<string, number>();
          const optimalReturn = (safeRolls: number, crowns: number): number => {
            const key = `${safeRolls}:${crowns}`;
            const known = memo.get(key);
            if (known !== undefined) return known;
            const past = Array.from({ length: safeRolls }, (_, index): readonly [number, number] =>
              index < crowns ? [2, 2] : [2, 3]);
            const score = getCrownScore(past, safeRolls);
            const bank = getCrownPayout(stake, safeRolls, false)
              + (!alreadyClaimed && score >= 80 ? firstMedalBonus : 0);
            const expectedRoll = safeRolls === 4 ? bank : orderedRolls.reduce((total, dice) => {
              const result = classifyCrownDice(dice);
              return total + (result.outcome === "bones" ? 0
                : optimalReturn(safeRolls + 1, crowns + Number(result.outcome === "crown")));
            }, 0) / orderedRolls.length;
            const result = Math.max(bank, expectedRoll);
            memo.set(key, result);
            return result;
          };
          expect(optimalReturn(0, 0)).toBeLessThan(stake);
          expect(optimalReturn(0, 0)).toBeLessThanOrEqual(stake * 2 * (30 / 36) ** 4 + 1e-10);
        }
      }
    }
  });

  it("scores crowns without secretly increasing monetary payouts", () => {
    expect(getCrownScore([[2, 2], [3, 4]], 1)).toBe(25);
    expect(getCrownScore([[2, 2], [3, 4]], 2)).toBe(0);
    expect(getCrownScore([[2, 2], [3, 3], [4, 4], [6, 6]], 4)).toBe(100);
  });
});

describe("seeded class-neutral challenges", () => {
  it("keeps default weather RNG behavior and plans harbor forecasts without consuming it", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.01);
    try {
      expect(rollWeather("Heartlands", 45)).toBe(WeatherType.Rain);
      expect(random).toHaveBeenCalledTimes(1);
      expect(rollWeather("Heartlands", 45, () => 0.01)).toBe(WeatherType.Rain);
      const forecast = getMinigameForecast("sandportRegatta", 167, 1, 45, WeatherType.Clear);
      expect(getMinigameForecast("sandportRegatta", 167, 1, 45, WeatherType.Clear)).toBe(forecast);
      expect(getMinigameForecast("sandportRegatta", 167, 1, 45, WeatherType.Storm)).toBe(WeatherType.Storm);
      expect(random).toHaveBeenCalledTimes(1);
      expect(() => rollWeather("Heartlands", 45, () => 1)).toThrow(/selection roll/);
    } finally {
      random.mockRestore();
    }
  });

  it("recreates every exact challenge from its stable seed and session identity", () => {
    for (const activity of MINIGAME_ACTIVITY_IDS) {
      for (const difficulty of MINIGAME_DIFFICULTY_IDS) {
        const challenge = createMinigameChallenge(activity, difficulty, 167, "session:1");
        expect(createMinigameChallenge(activity, difficulty, 167, "session:1"))
          .toEqual(challenge);
        expect(createMinigameChallenge(activity, difficulty, 167, "session:2"))
          .not.toEqual(challenge);
      }
    }
  });

  it("uses the same bounded precision formula independently of class, stats, gear, or input source", () => {
    for (const difficulty of MINIGAME_DIFFICULTY_IDS) {
      const challenge = createMinigameChallenge("archery", difficulty, 167, "archery:1");
      if (challenge.kind !== "archery") throw new Error("Missing archery challenge");
      expect(getArcheryScore(challenge, challenge.targets, difficulty)).toBe(100);
      expect(getArcheryScore(challenge, [], difficulty)).toBe(0);
      expect(getArcheryScore(challenge, challenge.targets.map(() => 0), difficulty))
        .toBeGreaterThanOrEqual(0);
      expect(getArcheryScore(challenge, challenge.targets.map(() => 100), difficulty))
        .toBeLessThanOrEqual(100);
    }
  });

  it("keeps a clear cardinal route through all buoys in every seeded regatta layout", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      for (const difficulty of MINIGAME_DIFFICULTY_IDS) {
        const challenge = createMinigameChallenge("regatta", difficulty, seed, "regatta:1");
        if (challenge.kind !== "regatta") throw new Error("Missing regatta challenge");
        expect(challenge.route[0]).toEqual(challenge.start);
        expect(challenge.route[challenge.route.length - 1]).toEqual(challenge.finish);
        for (let index = 1; index < challenge.route.length; index += 1) {
          const previous = challenge.route[index - 1]!;
          const point = challenge.route[index]!;
          expect(Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y))
            .toBe(1);
          expect(challenge.obstacles).not.toContainEqual(point);
        }
        for (const buoy of challenge.buoys) {
          expect(challenge.route).toContainEqual(buoy);
        }
        expect(challenge.obstacles.length)
          .toBe(MINIGAME_DIFFICULTIES[difficulty].regattaObstacles);
      }
    }
  });
});
