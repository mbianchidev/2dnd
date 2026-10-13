import { EPIC_LEVEL_CAP } from "../data/epicProgression";
import { isNewGamePlusState, type NewGamePlusState } from "./newGamePlusState";

interface CampaignProgressionOwner {
  readonly newGamePlus?: NewGamePlusState | null;
}

const owners = new WeakMap<object, () => CampaignProgressionOwner>();

/** Companion policy is runtime-bound to its owning campaign, never duplicated in its save. */
export function bindActorProgressionOwner(actor: object, getOwner: () => CampaignProgressionOwner): void {
  owners.set(actor, getOwner);
}

export function getActorLevelCap(actor: CampaignProgressionOwner & object): number {
  const owner = owners.get(actor)?.() ?? actor;
  return isNewGamePlusState(owner.newGamePlus) ? EPIC_LEVEL_CAP : 20;
}
