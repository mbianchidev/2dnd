import { DIFFICULTY_PROFILE_IDS } from "../src/data/difficulty";
import type { DifficultyProfileId, DifficultySelection } from "../src/data/difficulty";
import { createPlayer, type PlayerState } from "../src/systems/player";

export interface DifficultyModeCase {
  name: DifficultyProfileId;
  selection: DifficultySelection;
}

export const DIFFICULTY_MODE_CASES: readonly DifficultyModeCase[] =
  DIFFICULTY_PROFILE_IDS.map((profileId): DifficultyModeCase => ({
    name: profileId,
    selection: profileId === "custom"
      ? {
        profileId,
        overrides: {
          enemyHpPercent: 130,
          enemyDamagePercent: 125,
          enemyAccuracyBonus: 1,
          enemyAiPolicy: "gentle",
          encounterPressurePercent: 115,
          fleeDcAdjustment: 3,
          skillCheckAssistance: 1,
          defeatGoldLossPercent: 10,
          defeatRecoveryPercent: 70,
          pricePercent: 85,
          xpRewardPercent: 105,
          goldRewardPercent: 110,
          timedRoundDurationSeconds: 45,
        },
      }
      : { profileId },
  }));

export function createDifficultyPlayer(selection: DifficultySelection): PlayerState {
  const player = createPlayer("RulesTest", {
    strength: 10, dexterity: 10, constitution: 10,
    intelligence: 10, wisdom: 10, charisma: 10,
  }, "knight", undefined, { difficulty: selection });
  player.gold = 1000;
  player.progression.trapSeed = 17117;
  return player;
}
