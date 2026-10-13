import { NEW_GAME_PLUS_SCALE_CAP } from "../data/newGamePlus";
import type { DifficultyScaleLayer } from "./difficulty";
import { isNewGamePlusState, type NewGamePlusState } from "./newGamePlusState";
import { NEW_GAME_PLUS_MONSTERS } from "../data/newGamePlusContent";
import type { Monster } from "../data/monsterTypes";

/** Each cycle starts from canonical values; difficulty composes this bounded layer once. */
export function getNewGamePlusScale(state: NewGamePlusState | null | undefined): DifficultyScaleLayer {
  if (!state) return {};
  if (!isNewGamePlusState(state)) throw new Error("[newGamePlus] Cannot scale invalid cycle authority.");
  const tier = Math.min(NEW_GAME_PLUS_SCALE_CAP, state.cycle) - 1;
  return Object.freeze({
    enemyHpMultiplier: 2 + tier * 0.5,
    enemyDamageMultiplier: 1.5 + tier * 0.2,
    encounterPressureMultiplier: 1.1 + tier * 0.05,
    xpRewardMultiplier: 1.5 + tier * 0.125,
    goldRewardMultiplier: 1.25 + tier * 0.0625,
    priceMultiplier: 1.1 + tier * 0.1,
  });
}

/** Optional replacements keep ordinary pools/RNG unchanged and never replace a required boss. */
export function selectNewGamePlusVariant(
  monster: Monster,
  state: NewGamePlusState | null | undefined,
  random: () => number = Math.random,
): Monster {
  if (!state || monster.isBoss) return monster;
  const variants = NEW_GAME_PLUS_MONSTERS.filter((variant) => variant.variantOf === monster.id
    && !variant.isBoss && state.cycle >= (variant.minimumNewGamePlusCycle ?? 1));
  if (variants.length === 0) return monster;
  const roll = random();
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new Error("[newGamePlus] Invalid variant roll.");
  return roll < 0.2 ? variants[Math.floor(roll / 0.2 * variants.length)]! : monster;
}
