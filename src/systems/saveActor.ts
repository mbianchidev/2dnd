import { getItem } from "../data/items";
import type { Item } from "../data/items";
import type { PlayerStats } from "./player";

const STAT_KEYS = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
] as const satisfies readonly (keyof PlayerStats)[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIntegerAtLeast(value: unknown, minimum: number): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= minimum;
}

/** Reject missing actor authority before repairing optional campaign state. */
export function hasUsableSavePlayerCore(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value["stats"])) return false;
  const stats = value["stats"];
  return typeof value["name"] === "string"
    && value["name"].trim().length > 0
    && isIntegerAtLeast(value["level"], 1)
    && value["level"] <= 20
    && isIntegerAtLeast(value["xp"], 0)
    && isIntegerAtLeast(value["gold"], 0)
    && isIntegerAtLeast(value["hp"], 0)
    && isIntegerAtLeast(value["maxHp"], 1)
    && value["hp"] <= value["maxHp"]
    && isIntegerAtLeast(value["mp"], 0)
    && isIntegerAtLeast(value["maxMp"], 0)
    && value["mp"] <= value["maxMp"]
    && STAT_KEYS.every((key) => isIntegerAtLeast(stats[key], 1))
    && Array.isArray(value["knownSpells"])
    && value["knownSpells"].every((id: unknown) => typeof id === "string")
    && Array.isArray(value["inventory"])
    && value["inventory"].every((item: unknown) =>
      isRecord(item) && typeof item["id"] === "string"
    );
}

/** Restore inventory entries from immutable canonical item definitions. */
export function normalizeSavedInventory(
  value: unknown,
  fallback: Item[],
): Item[] {
  if (!Array.isArray(value)) return fallback.map((item) => ({ ...item }));
  return value.flatMap((candidate: unknown) => {
    if (!isRecord(candidate) || typeof candidate["id"] !== "string") return [];
    const item = getItem(candidate["id"]);
    return item ? [{ ...item }] : [];
  });
}

/** Relink equipment to the owning inventory's exact item objects. */
export function relinkSavedEquipment(
  inventory: Item[],
  value: unknown,
  type: "weapon" | "armor" | "shield",
): Item | null {
  const itemId = typeof value === "string"
    ? value
    : isRecord(value) && typeof value["id"] === "string"
      ? value["id"]
      : undefined;
  return itemId
    ? inventory.find((item) => item.id === itemId && item.type === type) ?? null
    : null;
}
