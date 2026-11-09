import { INTERIOR_STUDIES, type InteriorStudy } from "../data/interiorBooks";
import type { CombatActorState } from "./player";

export function getInteriorStudyGrants(
  ledger: unknown,
  classLevels: Readonly<Partial<Record<string, number>>>,
): readonly InteriorStudy[] {
  if (!Array.isArray(ledger)) return [];
  return INTERIOR_STUDIES.filter((study) => ledger.includes(`study:${study.id}`)
    && study.classIds.some((id) => (classLevels[id] ?? 0) >= study.minimumRank));
}

export function getActorStudyGrants(actor: CombatActorState): readonly InteriorStudy[] {
  if (!actor.classProgression || !("progression" in actor)) return [];
  const progression = actor.progression;
  if (!progression || typeof progression !== "object" || !("collectedTreasures" in progression)) return [];
  return getInteriorStudyGrants(progression.collectedTreasures, actor.classProgression.classLevels);
}

export function getPermanentStudyLedger(ledger: readonly string[]): string[] {
  return ledger.filter((id) => INTERIOR_STUDIES.some((study) => id === `study:${study.id}`));
}
