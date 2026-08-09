import {
  getDefaultCraftingRecipeIds,
  isCraftingRecipeId,
  type CraftingRecipeId,
} from "../data/crafting";
import type { PartyMemberId } from "./party";

export const CRAFTING_HISTORY_LIMIT = 40;
export const CRAFTING_TRANSACTION_LIMIT = 120;

export interface CraftingHistoryEntry {
  sequence: number;
  recipeId: CraftingRecipeId;
  actorId: PartyMemberId;
  quantity: number;
  outputItemId: string;
  outputQuantity: number;
  debug: boolean;
}

export interface CraftingStatistics {
  totalCrafts: number;
  equipmentUpgrades: number;
  recipeCraftCounts: Partial<Record<CraftingRecipeId, number>>;
}

export interface CraftingState {
  knownRecipeIds: CraftingRecipeId[];
  appliedDiscoveryIds: string[];
  appliedTransactionIds: string[];
  statistics: CraftingStatistics;
  recentHistory: CraftingHistoryEntry[];
  nextSequence: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonNegativeInteger(value: unknown, maximum = 1_000_000): number {
  return typeof value === "number"
      && Number.isSafeInteger(value)
      && value >= 0
    ? Math.min(value, maximum)
    : 0;
}

function normalizeStringIds(value: unknown, limit: number): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter(
      (entry): entry is string =>
        typeof entry === "string" && entry.trim().length > 0,
    ).map((entry) => entry.trim()))].slice(-limit)
    : [];
}

function normalizeHistory(value: unknown): CraftingHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: CraftingHistoryEntry[] = [];
  for (const candidate of value.slice(-CRAFTING_HISTORY_LIMIT)) {
    if (
      !isRecord(candidate)
      || !isCraftingRecipeId(candidate["recipeId"])
      || (
        candidate["actorId"] !== "hero"
        && candidate["actorId"] !== "guardian"
        && candidate["actorId"] !== "scout"
        && candidate["actorId"] !== "mystic"
      )
      || typeof candidate["outputItemId"] !== "string"
      || candidate["outputItemId"].trim().length === 0
    ) {
      continue;
    }
    entries.push({
      sequence: nonNegativeInteger(candidate["sequence"]),
      recipeId: candidate["recipeId"],
      actorId: candidate["actorId"],
      quantity: Math.max(1, nonNegativeInteger(candidate["quantity"], 99)),
      outputItemId: candidate["outputItemId"].trim(),
      outputQuantity: Math.max(
        1,
        nonNegativeInteger(candidate["outputQuantity"], 999),
      ),
      debug: candidate["debug"] === true,
    });
  }
  return entries
    .sort((left, right) => left.sequence - right.sequence)
    .slice(-CRAFTING_HISTORY_LIMIT);
}

export function createCraftingState(): CraftingState {
  return {
    knownRecipeIds: getDefaultCraftingRecipeIds(),
    appliedDiscoveryIds: ["default"],
    appliedTransactionIds: [],
    statistics: {
      totalCrafts: 0,
      equipmentUpgrades: 0,
      recipeCraftCounts: {},
    },
    recentHistory: [],
    nextSequence: 1,
  };
}

export function normalizeCraftingState(
  value: unknown,
  sourceVersion: number,
): CraftingState {
  if (!isRecord(value) || sourceVersion < 15) return createCraftingState();
  const statistics = isRecord(value["statistics"])
    ? value["statistics"]
    : {};
  const recipeCraftCounts: Partial<Record<CraftingRecipeId, number>> = {};
  if (isRecord(statistics["recipeCraftCounts"])) {
    for (const [recipeId, count] of Object.entries(
      statistics["recipeCraftCounts"],
    )) {
      if (!isCraftingRecipeId(recipeId)) continue;
      const normalized = nonNegativeInteger(count);
      if (normalized > 0) recipeCraftCounts[recipeId] = normalized;
    }
  }
  const recentHistory = normalizeHistory(value["recentHistory"]);
  const highestSequence = recentHistory.reduce(
    (highest, entry) => Math.max(highest, entry.sequence),
    0,
  );
  return {
    knownRecipeIds: [
      ...new Set([
        ...getDefaultCraftingRecipeIds(),
        ...(Array.isArray(value["knownRecipeIds"])
          ? value["knownRecipeIds"].filter(isCraftingRecipeId)
          : []),
      ]),
    ],
    appliedDiscoveryIds: normalizeStringIds(
      value["appliedDiscoveryIds"],
      CRAFTING_TRANSACTION_LIMIT,
    ),
    appliedTransactionIds: normalizeStringIds(
      value["appliedTransactionIds"],
      CRAFTING_TRANSACTION_LIMIT,
    ),
    statistics: {
      totalCrafts: nonNegativeInteger(statistics["totalCrafts"]),
      equipmentUpgrades: nonNegativeInteger(
        statistics["equipmentUpgrades"],
      ),
      recipeCraftCounts,
    },
    recentHistory,
    nextSequence: Math.max(
      highestSequence + 1,
      nonNegativeInteger(value["nextSequence"]) || 1,
    ),
  };
}
