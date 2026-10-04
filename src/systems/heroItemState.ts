import { isElement } from "../data/elements";
import {
  GATHERING_DISCIPLINES,
  GATHERING_RARITIES,
  MATERIAL_CATEGORIES,
} from "../data/gathering";
import { getItem, type Item, type WeaponSpriteType } from "../data/items";
import { debugLog } from "../config";

const ITEM_TYPES: readonly Item["type"][] = [
  "consumable", "weapon", "armor", "shield", "key", "mount", "crafting",
];
const WEAPON_SPRITES: readonly WeaponSpriteType[] = [
  "sword", "staff", "dagger", "bow", "mace", "axe", "fist",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMember<T extends string>(value: unknown, members: readonly T[]): value is T {
  return typeof value === "string" && members.some((member) => member === value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isMaterial(value: unknown): boolean {
  if (!isRecord(value) || typeof value["resourceId"] !== "string"
    || !isMember(value["discipline"], GATHERING_DISCIPLINES)
    || !isMember(value["rarity"], GATHERING_RARITIES)
    || !isRecord(value["recipeInput"])) return false;
  const input = value["recipeInput"];
  return typeof input["materialId"] === "string"
    && Array.isArray(input["categories"])
    && input["categories"].every((category) => isMember(category, MATERIAL_CATEGORIES))
    && typeof input["tier"] === "number" && Number.isInteger(input["tier"])
    && input["tier"] >= 1 && input["tier"] <= 5
    && isStringArray(input["tags"]);
}

/** Hero saves historically allow well-formed custom items, unlike companion loadouts. */
export function isSerializedHeroItem(value: unknown): value is Item {
  if (!isRecord(value)
    || typeof value["id"] !== "string" || !value["id"].trim()
    || typeof value["name"] !== "string" || !value["name"].trim()
    || typeof value["description"] !== "string"
    || !isMember(value["type"], ITEM_TYPES)
    || !isFiniteNumber(value["cost"]) || value["cost"] < 0
    || !isFiniteNumber(value["effect"])) return false;
  if (!["twoHanded", "light", "finesse", "cureEffects", "restoresMp"].every((key) =>
    value[key] === undefined || typeof value[key] === "boolean"
  )) return false;
  if (!["levelReq", "trapDetectionBonus", "trapDisarmBonus"].every((key) =>
    value[key] === undefined || isFiniteNumber(value[key])
  )) return false;
  return (value["weaponSprite"] === undefined || isMember(value["weaponSprite"], WEAPON_SPRITES))
    && (value["mountId"] === undefined || typeof value["mountId"] === "string")
    && (value["element"] === undefined || isElement(value["element"]))
    && (value["targetType"] === undefined
      || value["targetType"] === "self" || value["targetType"] === "single_ally")
    && (value["tags"] === undefined || isStringArray(value["tags"]))
    && (value["material"] === undefined || isMaterial(value["material"]));
}

/** Preserve serialized ownership metadata; repair incomplete known definitions only. */
export function normalizeSerializedHeroItem(value: unknown): Item | null {
  if (isSerializedHeroItem(value)) return { ...value };
  const canonical = isRecord(value) && typeof value["id"] === "string"
    ? getItem(value["id"]) : undefined;
  if (!canonical || !isRecord(value)) {
    debugLog("[save] Ignored a malformed serialized hero item.");
    return null;
  }
  debugLog(`[save] Repaired malformed hero item ${canonical.id}.`);
  return {
    ...canonical,
    name: typeof value["name"] === "string" && value["name"].trim()
      ? value["name"] : canonical.name,
    description: typeof value["description"] === "string"
      ? value["description"] : canonical.description,
    cost: isFiniteNumber(value["cost"]) && value["cost"] >= 0
      ? value["cost"] : canonical.cost,
    effect: isFiniteNumber(value["effect"]) ? value["effect"] : canonical.effect,
  };
}

function sameSerializedValue(
  left: unknown,
  right: unknown,
  seen: WeakMap<object, object>,
): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    if (seen.has(left)) return seen.get(left) === right;
    seen.set(left, right);
    return left.every((entry, index) => sameSerializedValue(entry, right[index], seen));
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  if (seen.has(left)) return seen.get(left) === right;
  seen.set(left, right);
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) =>
    Object.prototype.hasOwnProperty.call(right, key)
    && sameSerializedValue(left[key], right[key], seen)
  );
}

/** Match all serialized metadata so similar duplicates keep the exact equipped owner. */
export function heroItemsMatch(left: Item, right: Item): boolean {
  return sameSerializedValue(left, right, new WeakMap<object, object>());
}
