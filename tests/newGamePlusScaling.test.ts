import { describe, expect, it, vi } from "vitest";
import { DIFFICULTY_PROFILE_IDS } from "../src/data/difficulty";
import { buildNewGamePlus } from "../src/systems/newGamePlus";
import { getNewGamePlusScale, selectNewGamePlusVariant } from "../src/systems/newGamePlusScaling";
import {
  createCampaignDifficulty, getCampaignDifficultyRules, resolveDifficultyRules, scaleEnemy,
  scaleEnemyDamage, scaleReward, scaleCost, scaleSaleValue, getDifficultyEncounterRate,
} from "../src/systems/difficulty";
import { getMonster } from "../src/data/monsters";
import { createCompletedCampaign } from "./helpers/campaign";
import { isWorldEventEligible } from "../src/systems/worldEvents";
import { NEW_GAME_PLUS_WORLD_EVENTS } from "../src/data/newGamePlusContent";
import { Terrain } from "../src/data/mapTypes";
import { TimePeriod } from "../src/systems/daynight";
import { WeatherType } from "../src/systems/weather";

describe("canonical bounded NG+ difficulty composition", () => {
  it.each(DIFFICULTY_PROFILE_IDS)("scales every supported cycle with %s once and saturates at five", (profileId) => {
    const built = buildNewGamePlus(createCompletedCampaign(), "scaling", 1000, "1234abcd");
    if (!built.ok) throw new Error(built.message);
    const player = built.data.player;
    player.difficulty = createCampaignDifficulty({ profileId });
    const original = getMonster("slime");
    if (!original) throw new Error("Missing canonical slime");
    const before = structuredClone(original);
    for (let cycle = 1; cycle <= 99; cycle++) {
      player.newGamePlus = { ...player.newGamePlus!, cycle, parentCycle: cycle - 1 };
      const layer = getNewGamePlusScale(player.newGamePlus);
      const rules = getCampaignDifficultyRules(player);
      expect(rules).toEqual(resolveDifficultyRules(player.difficulty.selection, layer));
      expect(scaleEnemy(original, rules).hp).toBe(Math.floor(original.hp * rules.enemyHpMultiplier));
      expect(scaleEnemyDamage(13, rules)).toBe(Math.floor(13 * rules.enemyDamageMultiplier));
      expect(scaleReward(101, "xp", rules)).toBe(Math.floor(101 * rules.xpRewardMultiplier));
      expect(scaleReward(31, "gold", rules)).toBe(Math.floor(31 * rules.goldRewardMultiplier));
      expect(getDifficultyEncounterRate(0.15, rules, 3, 2, 4)).toBe(0.15);
      expect(scaleSaleValue(30, rules)).toBeLessThan(scaleCost(60, rules, 0.35));
      if (cycle >= 5) {
        expect(layer).toEqual(getNewGamePlusScale({ ...player.newGamePlus, cycle: 5, parentCycle: 4 }));
      }
    }
    expect(original).toEqual(before);
  });

  it("keeps normal variants/RNG unchanged and gates optional NG+ challenges on child completion", () => {
    const original = getMonster("slime");
    if (!original) throw new Error("Missing canonical slime");
    const random = vi.fn(() => 0);
    expect(selectNewGamePlusVariant(original, null, random)).toBe(original);
    expect(random).not.toHaveBeenCalled();
    const source = createCompletedCampaign();
    const built = buildNewGamePlus(source, "variants", 1000, "1234abcd");
    if (!built.ok) throw new Error(built.message);
    const player = built.data.player;
    expect(selectNewGamePlusVariant(original, player.newGamePlus, random).id).toBe("echoSlime");
    const context = {
      location: { chunkX: 4, chunkY: 2, x: 3, y: 3, terrain: Terrain.Grass, areaName: "Heartlands" },
      level: 20, timeStep: 0, period: TimePeriod.Day, weather: WeatherType.Clear,
      quests: player.progression.quests, defeatedBosses: new Set<string>(), social: player.progression.social,
    };
    for (const event of NEW_GAME_PLUS_WORLD_EVENTS) {
      expect(isWorldEventEligible(event, player.progression.worldEvents, context)).toBe(false);
    }
    const trial = NEW_GAME_PLUS_WORLD_EVENTS.find((event) => event.id === "covenantEchoTrial");
    if (!trial) throw new Error("Missing post-game challenge");
    expect(isWorldEventEligible(trial, player.progression.worldEvents, { ...context, newGamePlus: player.newGamePlus })).toBe(false);
    expect(isWorldEventEligible(trial, player.progression.worldEvents, {
      ...context, newGamePlus: player.newGamePlus, quests: source.player.progression.quests,
    })).toBe(true);
  });
});
