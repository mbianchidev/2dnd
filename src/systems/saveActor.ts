import { isElement } from "../data/elements";
import {
  GATHERING_DISCIPLINES,
  GATHERING_RARITIES,
  MATERIAL_CATEGORIES,
} from "../data/gathering";
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

const ITEM_TYPES: readonly string[] = [
  "consumable", "weapon", "armor", "shield", "key", "mount", "crafting",
] satisfies readonly Item["type"][];
const WEAPON_SPRITES: readonly string[] = [
  "sword", "staff", "dagger", "bow", "mace", "axe", "fist",
] satisfies readonly NonNullable<Item["weaponSprite"]>[];
const OPTIONAL_ITEM_BOOLEANS = [
  "twoHanded", "light", "finesse", "cureEffects", "restoresMp",
] as const;
const OPTIONAL_ITEM_NUMBERS = ["trapDetectionBonus", "trapDisarmBonus"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIntegerAtLeast(value: unknown, minimum: number): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= minimum;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.every((entry: unknown) => typeof entry === "string");
}

function isListedString(value: unknown, values: readonly string[]): boolean {
  return typeof value === "string" && values.includes(value);
}

function isSavedMaterial(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value["recipeInput"])) return false;
  const contract = value["recipeInput"];
  return typeof value["resourceId"] === "string"
    && isListedString(value["discipline"], GATHERING_DISCIPLINES)
    && isListedString(value["rarity"], GATHERING_RARITIES)
    && typeof contract["materialId"] === "string"
    && isStringArray(contract["categories"])
    && contract["categories"].every((category) =>
      isListedString(category, MATERIAL_CATEGORIES)
    )
    && isIntegerAtLeast(contract["tier"], 1)
    && contract["tier"] <= 5
    && isStringArray(contract["tags"]);
}

function isUsableSavedItem(value: unknown): value is Item {
  if (!isRecord(value)) return false;
  return typeof value["id"] === "string"
    && value["id"].length > 0
    && typeof value["name"] === "string"
    && typeof value["description"] === "string"
    && isListedString(value["type"], ITEM_TYPES)
    && typeof value["cost"] === "number"
    && Number.isFinite(value["cost"])
    && value["cost"] >= 0
    && typeof value["effect"] === "number"
    && Number.isFinite(value["effect"])
    && OPTIONAL_ITEM_BOOLEANS.every((key) =>
      value[key] === undefined || typeof value[key] === "boolean"
    )
    && OPTIONAL_ITEM_NUMBERS.every((key) =>
      value[key] === undefined
      || (typeof value[key] === "number" && Number.isFinite(value[key]))
    )
    && (value["levelReq"] === undefined || isIntegerAtLeast(value["levelReq"], 0))
    && (value["mountId"] === undefined || typeof value["mountId"] === "string")
    && (value["weaponSprite"] === undefined
      || isListedString(value["weaponSprite"], WEAPON_SPRITES))
    && (value["element"] === undefined || isElement(value["element"]))
    && (value["targetType"] === undefined
      || value["targetType"] === "self" || value["targetType"] === "single_ally")
    && (value["tags"] === undefined || isStringArray(value["tags"]))
    && (value["material"] === undefined || isSavedMaterial(value["material"]));
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

/** Preserve serialized hero items; repair malformed known items without deleting ownership. */
export function normalizeSavedHeroInventory(value: unknown): Item[] | null {
  if (!Array.isArray(value)) return null;
  const inventory: Item[] = [];
  for (const candidate of value) {
    if (isUsableSavedItem(candidate)) {
      inventory.push({ ...candidate });
      continue;
    }
    const canonical = isRecord(candidate) && typeof candidate["id"] === "string"
      ? getItem(candidate["id"])
      : undefined;
    if (!canonical) return null;
    inventory.push({ ...canonical });
  }
  return inventory;
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
