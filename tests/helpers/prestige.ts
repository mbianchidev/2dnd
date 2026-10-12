import { vi } from "vitest";
import { FACTION_DEFINITIONS } from "../../src/data/reputation";
import { getPrestigePath, type PrestigePathId } from "../../src/data/prestige";
import { commitHeroLevelUp, prepareHeroLevelUp } from "../../src/systems/classProgression";
import { createHeroProgressionContext } from "../../src/systems/classProgressionContext";
import {
  awardXP, createPlayer, processPendingLevelUps, xpForLevel, type PlayerState,
} from "../../src/systems/player";

export const prestigeStats = {
  strength: 15, dexterity: 15, constitution: 15,
  intelligence: 15, wisdom: 15, charisma: 15,
};
export const prestigeStartingClasses = {
  roadglassBulwark: "knight", prismScribe: "wizard", hearthlightCustodian: "cleric",
  rootwakeKeeper: "druid", duskthreadCourier: "rogue", chordsteelEnvoy: "knight",
} as const;

export function prestigeFixture(id: PrestigePathId): PlayerState {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  const hero = createPlayer("Prestige fixture", prestigeStats, prestigeStartingClasses[id]);
  awardXP(hero, xpForLevel(id === "chordsteelEnvoy" ? 4 : 6));
  processPendingLevelUps(hero);
  if (id === "chordsteelEnvoy") {
    for (let total = 4; total < 6; total++) {
      awardXP(hero, xpForLevel(total + 1) - hero.xp);
      prepareHeroLevelUp(hero, () => 0.5);
      const result = commitHeroLevelUp(hero, { trackId: "wizard", expectedTotalLevel: total });
      if (!result.ok) throw new Error(result.message);
    }
  }
  for (const faction of FACTION_DEFINITIONS) hero.progression.social.factionReputation[faction.id] = 15;
  hero.progression.discoveredCities = ["deeproot_city", "shadowfen_city"];
  hero.progression.social.alignment = { lawChaos: -50, goodEvil: 0 };
  awardXP(hero, xpForLevel(7) - hero.xp);
  return hero;
}

export function advancePrestige(hero: PlayerState, id: PrestigePathId): void {
  const path = getPrestigePath(id);
  if (!path) throw new Error("Unknown fixture prestige path");
  awardXP(hero, Math.max(0, xpForLevel(hero.level + 1) - hero.xp));
  const prepared = prepareHeroLevelUp(hero, () => 0.5);
  if (!prepared.ok) throw new Error(prepared.message);
  const result = commitHeroLevelUp(hero, { trackId: path.id, expectedTotalLevel: hero.level },
    createHeroProgressionContext(() => hero));
  if (!result.ok) throw new Error(result.message);
}
