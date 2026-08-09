import { debugLog } from "../config";
import { getItem, type Item } from "../data/items";
import type { CombatActorState } from "./player";

export const INVENTORY_PREFERENCES_STORAGE_KEY = "2dnd_inventory_prefs";

export const INVENTORY_SORT_MODES = [
  "type",
  "value",
  "rarity",
  "recent",
  "name",
] as const;

export const INVENTORY_FILTERS = [
  "all",
  "equipment",
  "consumable",
  "quest",
  "crafting",
] as const;

export const ITEM_RARITIES = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
] as const;

export type InventorySortMode = (typeof INVENTORY_SORT_MODES)[number];
export type InventoryFilter = (typeof INVENTORY_FILTERS)[number];
export type ItemRarity = (typeof ITEM_RARITIES)[number];
export type InventoryCategory = Exclude<InventoryFilter, "all">;

export type InventorySemanticAction =
  | "previousItem"
  | "nextItem"
  | "previousPage"
  | "nextPage"
  | "firstItem"
  | "lastItem"
  | "primaryAction"
  | "transfer"
  | "cycleSort"
  | "cycleFilter"
  | "toggleSearch"
  | "clearSearch"
  | "nextTarget";

export interface InventoryPreferences {
  sortMode: InventorySortMode;
  filter: InventoryFilter;
  search: string;
}

export interface InventoryViewEntry {
  item: Item;
  inventoryIndex: number;
  category: InventoryCategory;
  rarity: ItemRarity;
}

const DEFAULT_INVENTORY_PREFERENCES: InventoryPreferences = {
  sortMode: "recent",
  filter: "all",
  search: "",
};

const TYPE_ORDER: Record<Item["type"], number> = {
  weapon: 0,
  armor: 1,
  shield: 2,
  consumable: 3,
  key: 4,
  mount: 5,
  crafting: 6,
};

const RARITY_ORDER: Record<ItemRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSortMode(value: unknown): value is InventorySortMode {
  return INVENTORY_SORT_MODES.some((mode) => mode === value);
}

function isFilter(value: unknown): value is InventoryFilter {
  return INVENTORY_FILTERS.some((filter) => filter === value);
}

function compareText(left: string, right: string): number {
  const normalizedLeft = left.toLocaleLowerCase();
  const normalizedRight = right.toLocaleLowerCase();
  if (normalizedLeft < normalizedRight) return -1;
  if (normalizedLeft > normalizedRight) return 1;
  return 0;
}

function nextOption<T>(options: readonly T[], current: T): T {
  const currentIndex = options.indexOf(current);
  return options[(currentIndex + 1) % options.length]!;
}

export function normalizeInventoryPreferences(
  value: unknown,
): InventoryPreferences {
  if (!isRecord(value)) {
    return { ...DEFAULT_INVENTORY_PREFERENCES };
  }
  return {
    sortMode: isSortMode(value.sortMode)
      ? value.sortMode
      : DEFAULT_INVENTORY_PREFERENCES.sortMode,
    filter: isFilter(value.filter)
      ? value.filter
      : DEFAULT_INVENTORY_PREFERENCES.filter,
    search: typeof value.search === "string"
      ? value.search.slice(0, 40)
      : DEFAULT_INVENTORY_PREFERENCES.search,
  };
}

function loadInventoryPreferences(): InventoryPreferences {
  if (typeof localStorage === "undefined") {
    return normalizeInventoryPreferences(undefined);
  }
  try {
    const saved = localStorage.getItem(INVENTORY_PREFERENCES_STORAGE_KEY);
    return normalizeInventoryPreferences(
      saved === null ? undefined : JSON.parse(saved) as unknown,
    );
  } catch (error: unknown) {
    debugLog(`Could not load inventory preferences: ${String(error)}`);
    return normalizeInventoryPreferences(undefined);
  }
}

export class InventoryPreferenceStore {
  private preferences = loadInventoryPreferences();

  get(): Readonly<InventoryPreferences> {
    return this.preferences;
  }

  setSortMode(sortMode: InventorySortMode): void {
    this.update({ sortMode });
  }

  cycleSortMode(): void {
    this.setSortMode(nextOption(INVENTORY_SORT_MODES, this.preferences.sortMode));
  }

  setFilter(filter: InventoryFilter): void {
    this.update({ filter });
  }

  cycleFilter(): void {
    this.setFilter(nextOption(INVENTORY_FILTERS, this.preferences.filter));
  }

  setSearch(search: string): void {
    this.update({ search: search.slice(0, 40) });
  }

  reload(): void {
    this.preferences = loadInventoryPreferences();
  }

  private update(changes: Partial<InventoryPreferences>): void {
    this.preferences = { ...this.preferences, ...changes };
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(
        INVENTORY_PREFERENCES_STORAGE_KEY,
        JSON.stringify(this.preferences),
      );
    } catch (error: unknown) {
      debugLog(`Could not save inventory preferences: ${String(error)}`);
    }
  }
}

export const inventoryPreferences = new InventoryPreferenceStore();

export function getInventoryCategory(item: Item): InventoryCategory {
  if (
    item.type === "weapon"
    || item.type === "armor"
    || item.type === "shield"
  ) {
    return "equipment";
  }
  if (item.type === "consumable") return "consumable";
  if (item.type === "crafting") return "crafting";
  return "quest";
}

export function getItemRarity(item: Item): ItemRarity {
  const canonical = getItem(item.id) ?? item;
  if (canonical.material) return canonical.material.rarity;
  const equipmentPower = getInventoryCategory(canonical) === "equipment"
    ? canonical.effect
    : 0;
  if (
    canonical.id === "covenantSigil"
    || canonical.id === "mountShadowSteed"
    || equipmentPower >= 8
  ) {
    return "legendary";
  }
  if (
    canonical.element !== undefined
    || equipmentPower >= 6
    || canonical.cost >= 250
  ) {
    return "epic";
  }
  if (
    canonical.type === "mount"
    || equipmentPower >= 4
    || canonical.cost >= 100
  ) {
    return "rare";
  }
  if (equipmentPower >= 2 || canonical.cost >= 25) {
    return "uncommon";
  }
  return "common";
}

function matchesSearch(entry: InventoryViewEntry, search: string): boolean {
  const query = search.trim().toLocaleLowerCase();
  if (query.length === 0) return true;
  return [
    entry.item.id,
    entry.item.name,
    entry.item.description,
    entry.item.type,
    entry.category,
    entry.rarity,
    ...(entry.item.tags ?? []),
    ...(entry.item.material?.recipeInput.categories ?? []),
    ...(entry.item.material?.recipeInput.tags ?? []),
    entry.item.material?.discipline ?? "",
  ].some((value) => value.toLocaleLowerCase().includes(query));
}

function compareInventoryEntries(
  left: InventoryViewEntry,
  right: InventoryViewEntry,
  sortMode: InventorySortMode,
): number {
  if (sortMode === "recent") {
    return right.inventoryIndex - left.inventoryIndex;
  }
  if (sortMode === "value") {
    const valueDifference = right.item.cost - left.item.cost;
    if (valueDifference !== 0) return valueDifference;
  } else if (sortMode === "rarity") {
    const rarityDifference =
      RARITY_ORDER[right.rarity] - RARITY_ORDER[left.rarity];
    if (rarityDifference !== 0) return rarityDifference;
  } else if (sortMode === "type") {
    const typeDifference =
      TYPE_ORDER[left.item.type] - TYPE_ORDER[right.item.type];
    if (typeDifference !== 0) return typeDifference;
  } else {
    const nameDifference = compareText(left.item.name, right.item.name);
    if (nameDifference !== 0) return nameDifference;
  }

  const nameDifference = compareText(left.item.name, right.item.name);
  return nameDifference !== 0
    ? nameDifference
    : left.inventoryIndex - right.inventoryIndex;
}

export function selectInventoryItems(
  inventory: readonly Item[],
  preferences: Readonly<InventoryPreferences>,
): InventoryViewEntry[] {
  return inventory
    .map((item, inventoryIndex): InventoryViewEntry => ({
      item,
      inventoryIndex,
      category: getInventoryCategory(item),
      rarity: getItemRarity(item),
    }))
    .filter((entry) =>
      (preferences.filter === "all"
        || entry.category === preferences.filter)
      && matchesSearch(entry, preferences.search)
    )
    .sort((left, right) =>
      compareInventoryEntries(left, right, preferences.sortMode)
    );
}

export function moveInventorySelection(
  entries: readonly InventoryViewEntry[],
  selectedInventoryIndex: number | null,
  delta: number,
): number | null {
  if (entries.length === 0) return null;
  const currentPosition = entries.findIndex(
    (entry) => entry.inventoryIndex === selectedInventoryIndex,
  );
  const safePosition = currentPosition < 0 ? 0 : currentPosition;
  const nextPosition = Math.min(
    Math.max(safePosition + delta, 0),
    entries.length - 1,
  );
  return entries[nextPosition]!.inventoryIndex;
}

export function isInventoryItemEquipped(
  actor: CombatActorState,
  item: Item,
): boolean {
  return [
    actor.equippedWeapon,
    actor.equippedOffHand,
    actor.equippedArmor,
    actor.equippedShield,
  ].some((equipped) => equipped === item);
}

export function getItemTransferRestriction(
  actor: CombatActorState,
  item: Item,
): string | null {
  if (item.type === "key" || item.type === "mount") {
    return `${item.name} must remain with the hero.`;
  }
  if (isInventoryItemEquipped(actor, item)) {
    return `${item.name} is currently equipped.`;
  }
  return null;
}
