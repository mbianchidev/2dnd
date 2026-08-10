import {
  getBoat,
  isBoatId,
  isBoatCosmeticId,
  isBoatUpgradeId,
  type BoatCosmeticId,
  type BoatId,
  type BoatUpgradeId,
} from "../data/nautical";
import type { PlayerState } from "./player";
import { replayQuestCompletionActions } from "./quests";
import { findBoat, type BoatState, type NauticalState } from "./nauticalState";

export interface NauticalWallet {
  gold: number;
}

export function acquireBoat(
  state: NauticalState,
  boatId: BoatId,
): { acquired: boolean; boat: BoatState } {
  const existing = findBoat(state, boatId);
  if (existing) return { acquired: false, boat: existing };
  const definition = getBoat(boatId);
  const boat: BoatState = {
    id: boatId,
    condition: definition.baseCondition,
    upgradeIds: [],
    cosmeticId: "naturalTimber",
  };
  state.ownedBoats.push(boat);
  state.activeBoatId ??= boatId;
  return { acquired: true, boat };
}

export function synchronizeNauticalQuestRewards(
  player: PlayerState,
): BoatState[] {
  const acquired: BoatState[] = [];
  replayQuestCompletionActions(
    player.progression.quests,
    (action) => {
      if (!isBoatId(action.targetId)) return;
      const result = acquireBoat(player.progression.nautical, action.targetId);
      if (result.acquired) acquired.push(result.boat);
    },
    "acquireBoat",
  );
  return acquired;
}

export function purchaseBoat(
  state: NauticalState,
  wallet: NauticalWallet,
  boatId: BoatId,
  prerequisiteMet: boolean,
): { purchased: boolean; reason?: string; boat?: BoatState } {
  if (!prerequisiteMet) {
    return { purchased: false, reason: "The harbor charter is not complete." };
  }
  if (findBoat(state, boatId)) {
    return { purchased: false, reason: "That boat is already owned." };
  }
  const definition = getBoat(boatId);
  if (wallet.gold < definition.price) {
    return { purchased: false, reason: "Not enough gold." };
  }
  wallet.gold -= definition.price;
  const result = acquireBoat(state, boatId);
  if (result.acquired) state.activeBoatId = boatId;
  return { purchased: result.acquired, boat: result.boat };
}

export function installBoatUpgrade(
  state: NauticalState,
  upgradeId: BoatUpgradeId,
): boolean {
  const boat = findBoat(state);
  if (
    !boat
    || !isBoatUpgradeId(upgradeId)
    || !getBoat(boat.id).allowedUpgradeIds.includes(upgradeId)
    || boat.upgradeIds.includes(upgradeId)
  ) {
    return false;
  }
  boat.upgradeIds.push(upgradeId);
  return true;
}

export function customizeBoat(
  state: NauticalState,
  cosmeticId: BoatCosmeticId,
): boolean {
  const boat = findBoat(state);
  if (!boat || !isBoatCosmeticId(cosmeticId)) return false;
  boat.cosmeticId = cosmeticId;
  return true;
}

export function repairActiveBoat(
  state: NauticalState,
  amount: number,
): number {
  const boat = findBoat(state);
  if (!boat || !Number.isFinite(amount) || amount <= 0) return 0;
  const before = boat.condition;
  boat.condition = Math.min(100, boat.condition + Math.floor(amount));
  return boat.condition - before;
}
