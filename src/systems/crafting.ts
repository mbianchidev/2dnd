import {
  CRAFTING_CATEGORIES,
  CRAFTING_RECIPES,
  getCraftingRecipe,
  isCraftingCategory,
  isCraftingRecipeId,
  type CraftingCategory,
  type CraftingIngredient,
  type CraftingRecipe,
  type CraftingRecipeId,
  type CraftingStation,
  type CraftingUnlockSource,
} from "../data/crafting";
import { ITEMS, getItem, getSellValue, type Item } from "../data/items";
import type { CodexData } from "./codex";
import { isCodexKnowledgeUnlocked } from "./codex";
import type { CombatActorState, PlayerState } from "./player";
import {
  getCompanion,
  type PartyMemberId,
} from "./party";
import {
  getQuestCompletionActions,
  isQuestCompleted,
} from "./quests";
import {
  CRAFTING_HISTORY_LIMIT,
  CRAFTING_TRANSACTION_LIMIT,
  createCraftingState,
  type CraftingHistoryEntry,
} from "./craftingState";
import { getDefaultCraftingRecipeIds } from "../data/crafting";

export const CRAFTING_SORTS = ["category", "name", "known", "craftable"] as const;

export type CraftingSort = (typeof CRAFTING_SORTS)[number];

export interface CraftingQuery {
  category?: CraftingCategory | "all";
  search?: string;
  sort?: CraftingSort;
  includeUnknown?: boolean;
}

export interface CraftingRecipeEntry {
  recipe: CraftingRecipe;
  known: boolean;
  craftable: boolean;
  reason?: string;
}

export interface CraftingIngredientStatus {
  ingredient: CraftingIngredient;
  owned: number;
  required: number;
}

export interface CraftingValidation {
  valid: boolean;
  reason?: string;
  recipe?: CraftingRecipe;
  actorId: PartyMemberId;
  batch: number;
  ingredients: CraftingIngredientStatus[];
  goldRequired: number;
  outputItem?: Item;
}

export interface CraftingRequest {
  recipeId: string;
  transactionId: string;
  actorId?: PartyMemberId;
  batch?: number;
  station?: CraftingStation;
  debug?: boolean;
  allowUnknown?: boolean;
}

export interface CraftingResult {
  crafted: boolean;
  duplicate: boolean;
  message: string;
  recipeId?: CraftingRecipeId;
  actorId: PartyMemberId;
  batch: number;
  outputItemId?: string;
  outputQuantity?: number;
}

export type CraftingDiscoverySignal =
  | { type: "city"; cityId: string }
  | { type: "shop"; shopId: string }
  | { type: "npc"; npcId: string }
  | { type: "readable"; readableId: string }
  | { type: "item"; itemId: string }
  | {
    type: "worldEvent";
    eventId: string;
    outcomeId: string;
  };

interface InventoryPlan {
  readonly indexes: number[];
  readonly upgradeItem?: Item;
  readonly upgradeIndexes: number[];
}

interface ActorSelection {
  readonly id: PartyMemberId;
  readonly actor: CombatActorState;
}

function getActor(
  player: PlayerState,
  actorId: PartyMemberId,
): ActorSelection | undefined {
  if (actorId === "hero") return { id: "hero", actor: player };
  const companion = getCompanion(player.party, actorId);
  return companion ? { id: actorId, actor: companion } : undefined;
}

function canonicalItem(item: Item): Item {
  return getItem(item.id) ?? item;
}

export function matchesCraftingIngredient(
  item: Item,
  ingredient: CraftingIngredient,
): boolean {
  const canonical = canonicalItem(item);
  if (ingredient.match.kind === "item") {
    return canonical.id === ingredient.match.itemId;
  }
  const contract = canonical.material?.recipeInput;
  if (!contract) return false;
  if (
    ingredient.match.materialIds
    && !ingredient.match.materialIds.includes(contract.materialId)
  ) {
    return false;
  }
  if (
    ingredient.match.categories
    && !ingredient.match.categories.some((category) =>
      contract.categories.includes(category)
    )
  ) {
    return false;
  }
  if (
    ingredient.match.minimumTier !== undefined
    && contract.tier < ingredient.match.minimumTier
  ) {
    return false;
  }
  return (ingredient.match.tags ?? []).every((tag) =>
    contract.tags.includes(tag)
  );
}

function getEquipmentSlots(
  actor: CombatActorState,
): Array<keyof Pick<
  CombatActorState,
  "equippedWeapon" | "equippedOffHand" | "equippedArmor" | "equippedShield"
>> {
  return [
    "equippedWeapon",
    "equippedOffHand",
    "equippedArmor",
    "equippedShield",
  ];
}

function isEquipped(actor: CombatActorState, item: Item): boolean {
  return getEquipmentSlots(actor).some((slot) => actor[slot] === item);
}

function protectedReason(
  actor: CombatActorState,
  item: Item,
  recipe: CraftingRecipe,
): string | undefined {
  const canonical = canonicalItem(item);
  if (canonical.type === "key" || canonical.type === "mount") {
    return `${canonical.name} is protected and cannot be consumed.`;
  }
  if (isEquipped(actor, item) && recipe.upgrade?.inputItemId !== canonical.id) {
    return `${canonical.name} is equipped and cannot be consumed by this recipe.`;
  }
  return undefined;
}

export function getCraftingItemRestriction(
  actor: CombatActorState,
  item: Item,
  recipeId: CraftingRecipeId,
): string | undefined {
  return protectedReason(actor, item, getCraftingRecipe(recipeId));
}

function countMatchingItems(
  actor: CombatActorState,
  recipe: CraftingRecipe,
  ingredient: CraftingIngredient,
): number {
  return actor.inventory.filter((item) =>
    matchesCraftingIngredient(item, ingredient)
    && protectedReason(actor, item, recipe) === undefined
  ).length;
}

function buildInventoryPlan(
  actor: CombatActorState,
  recipe: CraftingRecipe,
  batch: number,
): InventoryPlan | string {
  const used = new Set<number>();
  const indexes: number[] = [];
  const upgradeIndexes: number[] = [];
  let upgradeItem: Item | undefined;
  for (const ingredient of recipe.ingredients) {
    let needed = ingredient.quantity * batch;
    for (let index = 0; index < actor.inventory.length && needed > 0; index++) {
      if (used.has(index)) continue;
      const item = actor.inventory[index]!;
      if (!matchesCraftingIngredient(item, ingredient)) continue;
      const restriction = protectedReason(actor, item, recipe);
      if (restriction) continue;
      used.add(index);
      indexes.push(index);
      if (recipe.upgrade?.inputItemId === canonicalItem(item).id) {
        upgradeItem = item;
        upgradeIndexes.push(index);
      }
      needed -= 1;
    }
    if (needed > 0) {
      const protectedMatch = actor.inventory.find((item) =>
        matchesCraftingIngredient(item, ingredient)
        && protectedReason(actor, item, recipe) !== undefined
      );
      return protectedMatch
        ? protectedReason(actor, protectedMatch, recipe)!
        : `Need ${ingredient.quantity * batch}x ${ingredient.label}.`;
    }
  }
  if (recipe.upgrade) {
    if (!upgradeItem || upgradeIndexes.length !== 1 || batch !== 1) {
      return "Equipment upgrades require exactly one valid base item.";
    }
  }
  return { indexes, upgradeItem, upgradeIndexes };
}

export function getAvailableCraftingStations(
  player: PlayerState,
): CraftingStation[] {
  if (!player.position.inCity) return [];
  return [
    "ironhold_city",
    "ashfall_city",
    "ridgewatch_city",
  ].includes(player.position.cityId)
    ? ["forge"]
    : [];
}

export function validateCraftingRequest(
  player: PlayerState,
  request: CraftingRequest,
): CraftingValidation {
  const actorId = request.actorId ?? "hero";
  const batch = request.batch ?? 1;
  if (!isCraftingRecipeId(request.recipeId)) {
    return {
      valid: false,
      reason: `Unknown recipe: ${request.recipeId}.`,
      actorId,
      batch,
      ingredients: [],
      goldRequired: 0,
    };
  }
  const recipe = getCraftingRecipe(request.recipeId);
  const selection = getActor(player, actorId);
  if (!selection) {
    return {
      valid: false,
      reason: `Party member ${actorId} is unavailable.`,
      recipe,
      actorId,
      batch,
      ingredients: [],
      goldRequired: 0,
    };
  }
  if (
    !request.allowUnknown
    && !player.progression.crafting.knownRecipeIds.includes(recipe.id)
  ) {
    return {
      valid: false,
      reason: `${recipe.name} has not been discovered.`,
      recipe,
      actorId,
      batch,
      ingredients: [],
      goldRequired: 0,
    };
  }
  const maxBatch = recipe.maxBatch ?? 99;
  if (!Number.isSafeInteger(batch) || batch < 1 || batch > maxBatch) {
    return {
      valid: false,
      reason: `Batch must be between 1 and ${maxBatch}.`,
      recipe,
      actorId,
      batch,
      ingredients: [],
      goldRequired: 0,
    };
  }
  if (recipe.station && request.station !== recipe.station) {
    return {
      valid: false,
      reason: `${recipe.name} requires a ${recipe.station}.`,
      recipe,
      actorId,
      batch,
      ingredients: [],
      goldRequired: (recipe.goldCost ?? 0) * batch,
    };
  }
  const outputItem = getItem(recipe.outputItemId);
  if (!outputItem) {
    return {
      valid: false,
      reason: `Recipe output ${recipe.outputItemId} is invalid.`,
      recipe,
      actorId,
      batch,
      ingredients: [],
      goldRequired: 0,
    };
  }
  if (
    recipe.upgrade
    && (
      recipe.upgrade.outputItemId !== recipe.outputItemId
      || getItem(recipe.upgrade.inputItemId) === undefined
      || outputItem.type !== getItem(recipe.upgrade.inputItemId)?.type
    )
  ) {
    return {
      valid: false,
      reason: `${recipe.name} has an invalid equipment upgrade contract.`,
      recipe,
      actorId,
      batch,
      ingredients: [],
      goldRequired: 0,
    };
  }
  const ingredients = recipe.ingredients.map(
    (ingredient): CraftingIngredientStatus => ({
      ingredient,
      owned: countMatchingItems(selection.actor, recipe, ingredient),
      required: ingredient.quantity * batch,
    }),
  );
  const plan = buildInventoryPlan(selection.actor, recipe, batch);
  if (typeof plan === "string") {
    return {
      valid: false,
      reason: plan,
      recipe,
      actorId,
      batch,
      ingredients,
      goldRequired: (recipe.goldCost ?? 0) * batch,
      outputItem,
    };
  }
  const goldRequired = (recipe.goldCost ?? 0) * batch;
  if (player.gold < goldRequired) {
    return {
      valid: false,
      reason: `Need ${goldRequired} gold; only ${player.gold} is available.`,
      recipe,
      actorId,
      batch,
      ingredients,
      goldRequired,
      outputItem,
    };
  }
  return {
    valid: true,
    recipe,
    actorId,
    batch,
    ingredients,
    goldRequired,
    outputItem,
  };
}

function appendHistory(
  player: PlayerState,
  entry: CraftingHistoryEntry,
): void {
  const history = player.progression.crafting.recentHistory;
  history.push(entry);
  if (history.length > CRAFTING_HISTORY_LIMIT) {
    history.splice(0, history.length - CRAFTING_HISTORY_LIMIT);
  }
}

function replaceEquippedUpgrade(
  actor: CombatActorState,
  input: Item,
  output: Item,
): void {
  for (const slot of getEquipmentSlots(actor)) {
    if (actor[slot] === input) actor[slot] = output;
  }
}

export function craftItem(
  player: PlayerState,
  request: CraftingRequest,
): CraftingResult {
  const actorId = request.actorId ?? "hero";
  const batch = request.batch ?? 1;
  const transactionId = request.transactionId.trim();
  if (transactionId.length === 0) {
    return {
      crafted: false,
      duplicate: false,
      message: "Crafting requires a stable transaction ID.",
      actorId,
      batch,
    };
  }
  const state = player.progression.crafting;
  if (state.appliedTransactionIds.includes(transactionId)) {
    return {
      crafted: false,
      duplicate: true,
      message: "This craft was already applied.",
      actorId,
      batch,
    };
  }
  const validation = validateCraftingRequest(player, request);
  if (
    !validation.valid
    || !validation.recipe
    || !validation.outputItem
  ) {
    return {
      crafted: false,
      duplicate: false,
      message: validation.reason ?? "Crafting validation failed.",
      recipeId: validation.recipe?.id,
      actorId,
      batch,
    };
  }
  const selection = getActor(player, actorId)!;
  const plan = buildInventoryPlan(
    selection.actor,
    validation.recipe,
    batch,
  );
  if (typeof plan === "string") {
    return {
      crafted: false,
      duplicate: false,
      message: plan,
      recipeId: validation.recipe.id,
      actorId,
      batch,
    };
  }
  const outputQuantity = validation.recipe.outputQuantity * batch;
  const outputs = Array.from(
    { length: outputQuantity },
    () => ({ ...validation.outputItem! }),
  );
  const upgradeOutput = validation.recipe.upgrade ? outputs[0] : undefined;
  const upgradeInput = plan.upgradeItem;

  for (const index of [...plan.indexes].sort((left, right) => right - left)) {
    selection.actor.inventory.splice(index, 1);
  }
  player.gold -= validation.goldRequired;
  selection.actor.inventory.push(...outputs);
  if (upgradeInput && upgradeOutput) {
    replaceEquippedUpgrade(selection.actor, upgradeInput, upgradeOutput);
  }

  state.appliedTransactionIds.push(transactionId);
  if (state.appliedTransactionIds.length > CRAFTING_TRANSACTION_LIMIT) {
    state.appliedTransactionIds.splice(
      0,
      state.appliedTransactionIds.length - CRAFTING_TRANSACTION_LIMIT,
    );
  }
  const debug = request.debug === true;
  if (!debug) {
    state.statistics.totalCrafts += batch;
    state.statistics.recipeCraftCounts[validation.recipe.id] =
      (state.statistics.recipeCraftCounts[validation.recipe.id] ?? 0) + batch;
    if (validation.recipe.upgrade) {
      state.statistics.equipmentUpgrades += batch;
    }
  }
  const sequence = state.nextSequence;
  state.nextSequence += 1;
  appendHistory(player, {
    sequence,
    recipeId: validation.recipe.id,
    actorId,
    quantity: batch,
    outputItemId: validation.outputItem.id,
    outputQuantity,
    debug,
  });
  return {
    crafted: true,
    duplicate: false,
    message: `Crafted ${outputQuantity}x ${validation.outputItem.name}.`,
    recipeId: validation.recipe.id,
    actorId,
    batch,
    outputItemId: validation.outputItem.id,
    outputQuantity,
  };
}

function sourceMatchesSignal(
  source: CraftingUnlockSource,
  signal: CraftingDiscoverySignal,
): boolean {
  if (source.type !== signal.type) return false;
  switch (source.type) {
    case "city":
      return signal.type === "city" && source.cityId === signal.cityId;
    case "shop":
      return signal.type === "shop" && source.shopId === signal.shopId;
    case "npc":
      return signal.type === "npc" && source.npcId === signal.npcId;
    case "readable":
      return signal.type === "readable"
        && source.readableId === signal.readableId;
    case "item":
      return signal.type === "item" && source.itemId === signal.itemId;
    case "worldEvent":
      return signal.type === "worldEvent"
        && source.eventId === signal.eventId
        && source.outcomeId === signal.outcomeId;
    default:
      return false;
  }
}

function signalId(signal: CraftingDiscoverySignal): string {
  switch (signal.type) {
    case "city":
      return `city:${signal.cityId}`;
    case "shop":
      return `shop:${signal.shopId}`;
    case "npc":
      return `npc:${signal.npcId}`;
    case "readable":
      return `readable:${signal.readableId}`;
    case "item":
      return `item:${signal.itemId}`;
    case "worldEvent":
      return `worldEvent:${signal.eventId}:${signal.outcomeId}`;
  }
}

function unlockRecipe(
  player: PlayerState,
  recipeId: CraftingRecipeId,
  discoveryId: string,
): boolean {
  const state = player.progression.crafting;
  if (!state.appliedDiscoveryIds.includes(discoveryId)) {
    state.appliedDiscoveryIds.push(discoveryId);
    if (state.appliedDiscoveryIds.length > CRAFTING_TRANSACTION_LIMIT) {
      state.appliedDiscoveryIds.splice(
        0,
        state.appliedDiscoveryIds.length - CRAFTING_TRANSACTION_LIMIT,
      );
    }
  }
  if (state.knownRecipeIds.includes(recipeId)) return false;
  state.knownRecipeIds.push(recipeId);
  return true;
}

export function discoverCraftingRecipes(
  player: PlayerState,
  signal: CraftingDiscoverySignal,
): CraftingRecipeId[] {
  const discoveryId = signalId(signal);
  const unlocked: CraftingRecipeId[] = [];
  for (const recipe of CRAFTING_RECIPES) {
    if (!recipe.unlockSources.some((source) =>
      sourceMatchesSignal(source, signal)
    )) {
      continue;
    }
    if (unlockRecipe(player, recipe.id, discoveryId)) {
      unlocked.push(recipe.id);
    }
  }
  return unlocked;
}

function sourceSatisfied(
  player: PlayerState,
  codex: CodexData,
  source: CraftingUnlockSource,
): boolean {
  switch (source.type) {
    case "default":
      return true;
    case "city":
      return player.progression.discoveredCities.includes(source.cityId);
    case "quest":
      return isQuestCompleted(player.progression.quests, source.questId);
    case "gathering":
      return player.progression.gathering.stats[source.discipline].successes
        >= source.successes;
    case "codex":
      return isCodexKnowledgeUnlocked(codex, source.entryId);
    case "worldEvent":
      return player.progression.worldEvents.log.some((entry) =>
        entry.eventId === source.eventId && entry.outcomeId === source.outcomeId
      );
    case "item":
      return player.inventory.some((item) => item.id === source.itemId);
    case "shop":
    case "npc":
    case "readable":
      return player.progression.crafting.appliedDiscoveryIds.includes(
        source.type === "shop"
          ? `shop:${source.shopId}`
          : source.type === "npc"
            ? `npc:${source.npcId}`
            : `readable:${source.readableId}`,
      );
  }
}

function sourceStableId(source: CraftingUnlockSource): string {
  switch (source.type) {
    case "default":
      return "default";
    case "city":
      return `city:${source.cityId}`;
    case "quest":
      return `quest:${source.questId}`;
    case "gathering":
      return `gathering:${source.discipline}:${source.successes}`;
    case "codex":
      return `codex:${source.entryId}`;
    case "worldEvent":
      return `worldEvent:${source.eventId}:${source.outcomeId}`;
    case "item":
      return `item:${source.itemId}`;
    case "shop":
      return `shop:${source.shopId}`;
    case "npc":
      return `npc:${source.npcId}`;
    case "readable":
      return `readable:${source.readableId}`;
  }
}

export function reconcileCraftingRecipes(
  player: PlayerState,
  codex: CodexData,
): CraftingRecipeId[] {
  if (!player.progression.crafting) {
    player.progression.crafting = createCraftingState();
  }
  const unlocked: CraftingRecipeId[] = [];
  for (const action of getQuestCompletionActions(
    player.progression.quests,
    "unlockRecipe",
  )) {
    if (!isCraftingRecipeId(action.targetId)) continue;
    if (unlockRecipe(player, action.targetId, `questAction:${action.id}`)) {
      unlocked.push(action.targetId);
    }
  }
  for (const recipe of CRAFTING_RECIPES) {
    const source = recipe.unlockSources.find((candidate) =>
      sourceSatisfied(player, codex, candidate)
    );
    if (
      source
      && unlockRecipe(player, recipe.id, sourceStableId(source))
    ) {
      unlocked.push(recipe.id);
    }
  }
  return [...new Set(unlocked)];
}

export function getCraftingIngredientStatuses(
  player: PlayerState,
  recipeId: CraftingRecipeId,
  actorId: PartyMemberId = "hero",
  batch = 1,
): CraftingIngredientStatus[] {
  const recipe = getCraftingRecipe(recipeId);
  const selection = getActor(player, actorId);
  if (!selection) {
    return recipe.ingredients.map((ingredient) => ({
      ingredient,
      owned: 0,
      required: ingredient.quantity * batch,
    }));
  }
  return recipe.ingredients.map((ingredient) => ({
    ingredient,
    owned: countMatchingItems(selection.actor, recipe, ingredient),
    required: ingredient.quantity * batch,
  }));
}

export function selectCraftingRecipes(
  player: PlayerState,
  query: CraftingQuery,
  actorId: PartyMemberId = "hero",
  station?: CraftingStation,
): CraftingRecipeEntry[] {
  const search = query.search?.trim().toLocaleLowerCase() ?? "";
  const entries = CRAFTING_RECIPES
    .filter((recipe) =>
      (query.category === undefined
        || query.category === "all"
        || recipe.category === query.category)
      && (
        search.length === 0
        || [
          recipe.id,
          recipe.name,
          recipe.category,
          recipe.preview.summary,
          recipe.preview.benefit,
          recipe.preview.sourceHint,
          ...recipe.ingredients.map((ingredient) => ingredient.label),
        ].some((value) => value.toLocaleLowerCase().includes(search))
      )
    )
    .map((recipe): CraftingRecipeEntry => {
      const known = player.progression.crafting.knownRecipeIds.includes(
        recipe.id,
      );
      const validation = validateCraftingRequest(player, {
        recipeId: recipe.id,
        transactionId: "preview",
        actorId,
        batch: 1,
        station,
      });
      return {
        recipe,
        known,
        craftable: known && validation.valid,
        ...(!validation.valid ? { reason: validation.reason } : {}),
      };
    })
    .filter((entry) => query.includeUnknown !== false || entry.known);
  const sort = query.sort ?? "category";
  return entries.sort((left, right) => {
    if (sort === "known") {
      const difference = Number(right.known) - Number(left.known);
      if (difference !== 0) return difference;
    }
    if (sort === "craftable") {
      const difference = Number(right.craftable) - Number(left.craftable);
      if (difference !== 0) return difference;
    }
    if (sort === "category") {
      const difference = CRAFTING_CATEGORIES.indexOf(left.recipe.category)
        - CRAFTING_CATEGORIES.indexOf(right.recipe.category);
      if (difference !== 0) return difference;
    }
    return left.recipe.name.localeCompare(right.recipe.name);
  });
}

export function getRecipeInputMarketValue(
  recipe: CraftingRecipe,
  maximumDiscount = 0,
): number {
  const ingredientValue = recipe.ingredients.reduce((total, ingredient) => {
    const candidates = ingredient.match.kind === "item"
      ? [getItem(ingredient.match.itemId)].filter(
        (item): item is Item => item !== undefined,
      )
      : ITEMS.filter((item) =>
        item.material !== undefined
        && matchesCraftingIngredient(item, ingredient)
      );
    const minimum = candidates.reduce(
      (value, item) => Math.min(value, item.cost),
      Number.POSITIVE_INFINITY,
    );
    const unitCost = Number.isFinite(minimum)
      ? minimum > 0
        ? Math.max(1, Math.floor(minimum * (1 - maximumDiscount)))
        : 0
      : 0;
    return total + unitCost * ingredient.quantity;
  }, recipe.goldCost ?? 0);
  return ingredientValue;
}

export function getRecipeOutputSellValue(recipe: CraftingRecipe): number {
  const output = getItem(recipe.outputItemId);
  return output ? getSellValue(output) * recipe.outputQuantity : 0;
}

export function isCraftingQueryCategory(
  value: unknown,
): value is CraftingCategory | "all" {
  return value === "all" || isCraftingCategory(value);
}

export interface CraftingDebugResult {
  changed: boolean;
  lines: string[];
}

export function executeCraftingDebugCommand(
  player: PlayerState,
  codex: CodexData,
  args: string,
): CraftingDebugResult {
  const parts = args.trim().split(/\s+/).filter(Boolean);
  const action = parts[0]?.toLowerCase() ?? "status";
  if (action === "list") {
    return {
      changed: false,
      lines: CRAFTING_RECIPES.map((recipe) => {
        const known = player.progression.crafting.knownRecipeIds.includes(
          recipe.id,
        );
        return `${known ? "[KNOWN]" : "[LOCKED]"} ${recipe.id} -> ${recipe.outputQuantity}x ${recipe.outputItemId}`;
      }),
    };
  }
  if (action === "status") {
    const state = player.progression.crafting;
    return {
      changed: false,
      lines: [
        `Known ${state.knownRecipeIds.length}/${CRAFTING_RECIPES.length}`,
        `Natural crafts ${state.statistics.totalCrafts}`,
        `Equipment upgrades ${state.statistics.equipmentUpgrades}`,
        `History ${state.recentHistory.length}/${CRAFTING_HISTORY_LIMIT}`,
        `Transactions ${state.appliedTransactionIds.length}/${CRAFTING_TRANSACTION_LIMIT}`,
      ],
    };
  }
  if (action === "unlock" && parts[1]) {
    if (!isCraftingRecipeId(parts[1])) {
      return { changed: false, lines: [`Unknown recipe ${parts[1]}.`] };
    }
    const recipeId = parts[1];
    if (player.progression.crafting.knownRecipeIds.includes(recipeId)) {
      return { changed: false, lines: [`${recipeId} is already known.`] };
    }
    player.progression.crafting.knownRecipeIds.push(recipeId);
    const sourceId = `debug:unlock:${recipeId}`;
    if (!player.progression.crafting.appliedDiscoveryIds.includes(sourceId)) {
      player.progression.crafting.appliedDiscoveryIds.push(sourceId);
    }
    return { changed: true, lines: [`Unlocked ${recipeId} for debugging.`] };
  }
  if (action === "lock" && parts[1]) {
    if (!isCraftingRecipeId(parts[1])) {
      return { changed: false, lines: [`Unknown recipe ${parts[1]}.`] };
    }
    const recipeId = parts[1];
    if (getDefaultCraftingRecipeIds().includes(recipeId)) {
      return {
        changed: false,
        lines: [`${recipeId} is a default recipe and cannot be locked.`],
      };
    }
    const before = player.progression.crafting.knownRecipeIds.length;
    player.progression.crafting.knownRecipeIds =
      player.progression.crafting.knownRecipeIds.filter((id) => id !== recipeId);
    return {
      changed: player.progression.crafting.knownRecipeIds.length !== before,
      lines: [
        before === player.progression.crafting.knownRecipeIds.length
          ? `${recipeId} was already locked.`
          : `Locked ${recipeId}.`,
      ],
    };
  }
  if (action === "material" && parts[1]) {
    const material = getItem(parts[1]);
    if (!material?.material) {
      return { changed: false, lines: [`Unknown material item ${parts[1]}.`] };
    }
    const quantity = parts[2] === undefined
      ? 1
      : Number.parseInt(parts[2], 10);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
      return {
        changed: false,
        lines: ["Material quantity must be an integer from 1 to 99."],
      };
    }
    for (let index = 0; index < quantity; index += 1) {
      player.inventory.push({ ...material });
    }
    return {
      changed: true,
      lines: [`Added ${quantity}x ${material.name} to the hero inventory.`],
    };
  }
  if (action === "craft" && parts[1]) {
    const batch = parts[2] === undefined ? 1 : Number.parseInt(parts[2], 10);
    const actorId = (parts[3] ?? "hero") as PartyMemberId;
    if (
      actorId !== "hero"
      && actorId !== "guardian"
      && actorId !== "scout"
      && actorId !== "mystic"
    ) {
      return { changed: false, lines: [`Unknown party member ${actorId}.`] };
    }
    const result = craftItem(player, {
      recipeId: parts[1],
      transactionId:
        `debug:craft:${player.progression.crafting.nextSequence}:${parts[1]}:${actorId}:${batch}`,
      actorId,
      batch,
      station: getAvailableCraftingStations(player)[0],
      debug: true,
      allowUnknown: true,
    });
    return { changed: result.crafted, lines: [result.message] };
  }
  if (action === "reset") {
    player.progression.crafting = createCraftingState();
    reconcileCraftingRecipes(player, codex);
    return {
      changed: true,
      lines: ["Crafting state reset and durable discoveries reconciled."],
    };
  }
  return {
    changed: false,
    lines: [
      "Usage: /craft <list|status|unlock recipeId|lock recipeId|craft recipeId [batch] [hero|guardian|scout|mystic]|material itemId [quantity]|reset>",
    ],
  };
}
