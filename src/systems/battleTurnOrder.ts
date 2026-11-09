import { isCombatantActive } from "./groupCombat";
import type { BattleActorKind, BattleCombatantState, BattleTurn, CombatSide } from "./groupCombat";

export interface BattleTurnOrderEntry {
  readonly id: string;
  readonly label: string;
  readonly side: CombatSide;
  readonly actorKind: BattleActorKind;
  readonly current: boolean;
}

/** Project upcoming turns without changing scheduling or revealing initiative arithmetic. */
export function createBattleTurnOrderView(
  initiative: readonly BattleTurn[],
  actors: readonly BattleCombatantState[],
  currentIndex: number,
  remainingSurpriseIds?: readonly string[],
): readonly BattleTurnOrderEntry[] {
  if (initiative.length === 0) return [];
  if (!Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= initiative.length) {
    throw new Error("[battle-order] Invalid current initiative index.");
  }
  const ids = remainingSurpriseIds ?? [
    ...initiative.slice(currentIndex), ...initiative.slice(0, currentIndex),
  ].map(({ combatantId }) => combatantId);
  const currentId = ids[0];
  return ids.flatMap((id) => {
    const actor = actors.find((candidate) => candidate.id === id);
    if (!actor) throw new Error(`[battle-order] Missing initiative actor ${id}.`);
    return isCombatantActive(actor) ? [{
      id, label: actor.label, side: actor.side, actorKind: actor.actorKind, current: id === currentId,
    }] : [];
  });
}
