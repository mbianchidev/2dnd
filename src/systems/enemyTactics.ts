import { ENEMY_AI_BEHAVIORS } from "../data/difficulty";
import type { MonsterAbility } from "../data/monsters";
import type { DifficultyRules } from "./difficulty";

interface EnemyTargetCandidate {
  readonly currentHp: number;
  readonly maxHp: number;
}

/** Receives only conscious candidates; Standard retains the original RNG call. */
export function selectEnemyTarget<T extends EnemyTargetCandidate>(
  candidates: readonly T[],
  rules: DifficultyRules,
  random: () => number,
): T | undefined {
  if (candidates.length === 0) return undefined;
  const behavior = ENEMY_AI_BEHAVIORS[rules.enemyAiPolicy];
  if (behavior.target === "random") {
    const index = Math.floor(Math.max(0, Math.min(0.999999, random())) * candidates.length);
    return candidates[index];
  }
  let selected = candidates[0]!;
  const score = (target: T): number => behavior.target === "lowestHp"
    ? target.currentHp : target.currentHp / Math.max(1, target.maxHp);
  for (const candidate of candidates.slice(1)) {
    const better = behavior.target === "highestHpRatio"
      ? score(candidate) > score(selected)
      : score(candidate) < score(selected);
    if (better) selected = candidate;
  }
  return selected;
}

export function adjustEnemyDefendChance(
  baseChance: number,
  rules: DifficultyRules,
): number {
  return Math.min(1, Math.max(0,
    baseChance * ENEMY_AI_BEHAVIORS[rules.enemyAiPolicy].defendChanceMultiplier,
  ));
}

/** Ability execution, status application, and resource ownership stay in combat. */
export function getEnemyAbilityChance(
  ability: MonsterAbility,
  currentHp: number,
  maxHp: number,
  rules: DifficultyRules,
): number {
  const behavior = ENEMY_AI_BEHAVIORS[rules.enemyAiPolicy];
  if (behavior.avoidFullHealthHealing && ability.type === "heal" && currentHp >= maxHp) return 0;
  return Math.min(1, Math.max(0, ability.chance * behavior.abilityChanceMultiplier));
}
