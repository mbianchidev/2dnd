import { describe, expect, it } from "vitest";
import {
  CRAFTING_RECIPES,
  getCraftingRecipe,
} from "../src/data/crafting";
import { getItem } from "../src/data/items";
import { CITIES, CHESTS } from "../src/data/map";
import { ALL_MONSTERS } from "../src/data/monsters";
import {
  craftItem,
  discoverCraftingRecipes,
  executeCraftingDebugCommand,
  getAvailableCraftingStations,
  getCraftingItemRestriction,
  getRecipeInputMarketValue,
  getRecipeOutputSellValue,
  matchesCraftingIngredient,
  reconcileCraftingRecipes,
  selectCraftingRecipes,
  validateCraftingRequest,
} from "../src/systems/crafting";
import { normalizeCraftingState } from "../src/systems/craftingState";
import { createCodex } from "../src/systems/codex";
import { TimePeriod } from "../src/systems/daynight";
import { recruitCompanion } from "../src/systems/party";
import { createPlayer, type PlayerState } from "../src/systems/player";
import { getMinorTreasureMaterialId } from "../src/systems/skillChecks";
import { WeatherType } from "../src/systems/weather";

const BASE_STATS = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

function item(itemId: string) {
  return { ...getItem(itemId)! };
}

function createCrafter(): PlayerState {
  const player = createPlayer("Crafter", BASE_STATS);
  player.gold = 1_000;
  return player;
}

describe("crafting recipe data", () => {
  it("uses stable unique recipes and canonical outputs", () => {
    expect(new Set(CRAFTING_RECIPES.map((recipe) => recipe.id)).size)
      .toBe(CRAFTING_RECIPES.length);
    for (const recipe of CRAFTING_RECIPES) {
      expect(recipe.id).toMatch(/^[a-z][a-zA-Z0-9]*$/);
      expect(getItem(recipe.outputItemId)).toBeDefined();
      expect(recipe.ingredients.length).toBeGreaterThan(0);
      expect(recipe.outputQuantity).toBeGreaterThan(0);
      if (recipe.upgrade) {
        expect(getItem(recipe.upgrade.inputItemId)?.type)
          .toBe(getItem(recipe.upgrade.outputItemId)?.type);
        expect(recipe.maxBatch).toBe(1);
      }
    }
  });

  it("broadens deterministic material acquisition without replacing rewards", () => {
    const materialChestRewards = CHESTS.flatMap((chest) =>
      chest.bonusItems ?? []
    );
    expect(materialChestRewards.length).toBeGreaterThanOrEqual(4);
    expect(materialChestRewards.every((reward) =>
      getItem(reward.itemId)?.material !== undefined
      && reward.quantity > 0
    )).toBe(true);

    const materialDrops = ALL_MONSTERS.flatMap((monster) =>
      monster.drops ?? []
    ).filter((drop) => getItem(drop.itemId)?.material !== undefined);
    expect(materialDrops.length).toBeGreaterThanOrEqual(4);
    expect(materialDrops.every((drop) => drop.chance > 0 && drop.chance < 0.5))
      .toBe(true);

    const shopMaterialIds = CITIES.flatMap((city) => [
      ...city.shops,
      ...(city.chunks ?? []).flatMap((chunk) => chunk.shops),
    ]).flatMap((shop) => shop.shopItems).filter(
      (itemId) => getItem(itemId)?.material !== undefined,
    );
    expect(shopMaterialIds).toEqual(expect.arrayContaining([
      "wildHerbs",
      "brookTrout",
      "ironOre",
      "copperOre",
      "redcapMushroom",
    ]));
    expect(shopMaterialIds.some((itemId) =>
      ["moonKoi", "runicShard", "elderBark"].includes(itemId)
    )).toBe(false);
  });

  it("selects small-treasure materials deterministically", () => {
    const key = "4,2,3,3";
    expect(getMinorTreasureMaterialId(key, true))
      .toBe(getMinorTreasureMaterialId(key, true));
    expect(getItem(getMinorTreasureMaterialId(key, true)!)?.material)
      .toBeDefined();
  });

  it("prevents guaranteed buy-craft-sell arbitrage", () => {
    for (const recipe of CRAFTING_RECIPES) {
      expect(
        getRecipeInputMarketValue(recipe, 0.35),
        recipe.id,
      ).toBeGreaterThan(getRecipeOutputSellValue(recipe));
    }
  });

  it("matches exact and alternative material contracts", () => {
    const recipe = getCraftingRecipe("fieldPotion");
    const ingredient = recipe.ingredients[0]!;

    expect(matchesCraftingIngredient(item("wildHerbs"), ingredient)).toBe(true);
    expect(matchesCraftingIngredient(item("frostbloom"), ingredient)).toBe(true);
    expect(matchesCraftingIngredient(item("redcapMushroom"), ingredient))
      .toBe(false);
    expect(matchesCraftingIngredient(item("ironOre"), ingredient)).toBe(false);
  });
});

describe("crafting transactions", () => {
  it("fails atomically when ingredients are insufficient", () => {
    const player = createCrafter();
    player.inventory.push(item("wildHerbs"));
    const beforeInventory = player.inventory.map((entry) => entry.id);
    const beforeGold = player.gold;

    const result = craftItem(player, {
      recipeId: "fieldPotion",
      transactionId: "test:insufficient",
    });

    expect(result.crafted).toBe(false);
    expect(result.message).toContain("Need 2x");
    expect(player.inventory.map((entry) => entry.id)).toEqual(beforeInventory);
    expect(player.gold).toBe(beforeGold);
    expect(player.progression.crafting.appliedTransactionIds).toEqual([]);
  });

  it("consumes and produces a batch exactly once", () => {
    const player = createCrafter();
    player.inventory.push(
      item("wildHerbs"),
      item("wildHerbs"),
      item("frostbloom"),
      item("frostbloom"),
    );

    const request = {
      recipeId: "fieldPotion",
      transactionId: "test:batch",
      batch: 2,
    };
    const first = craftItem(player, request);
    const inventoryAfterFirst = player.inventory.map((entry) => entry.id);
    const goldAfterFirst = player.gold;
    const second = craftItem(player, request);

    expect(first).toMatchObject({
      crafted: true,
      outputItemId: "potion",
      outputQuantity: 2,
    });
    expect(inventoryAfterFirst.filter((id) => id === "potion")).toHaveLength(2);
    expect(second.duplicate).toBe(true);
    expect(player.inventory.map((entry) => entry.id)).toEqual(inventoryAfterFirst);
    expect(player.gold).toBe(goldAfterFirst);
    expect(player.progression.crafting.statistics.totalCrafts).toBe(2);
  });

  it("preserves equipped links through an atomic upgrade", () => {
    const player = createCrafter();
    const shortSword = item("shortSword");
    player.inventory = [
      shortSword,
      item("ironOre"),
      item("ironOre"),
      item("ironOre"),
    ];
    player.equippedWeapon = shortSword;
    player.position.inCity = true;
    player.position.cityId = "ironhold_city";
    player.progression.crafting.knownRecipeIds.push("temperedLongSword");

    const result = craftItem(player, {
      recipeId: "temperedLongSword",
      transactionId: "test:upgrade",
      station: "forge",
    });

    expect(result.crafted).toBe(true);
    expect(player.inventory.map((entry) => entry.id)).toEqual(["longSword"]);
    expect(player.equippedWeapon).toBe(player.inventory[0]);
    expect(player.equippedWeapon?.id).toBe("longSword");
    expect(player.progression.crafting.statistics.equipmentUpgrades).toBe(1);
  });

  it("rejects protected and unrelated equipped ingredients", () => {
    const player = createCrafter();
    const upgradeInput = item("shortSword");
    player.inventory.push(upgradeInput);
    player.equippedWeapon = upgradeInput;

    expect(
      getCraftingItemRestriction(player, item("dungeonKey"), "fieldPotion"),
    ).toContain("protected");
    expect(
      getCraftingItemRestriction(player, upgradeInput, "fieldPotion"),
    ).toContain("equipped");
    expect(
      getCraftingItemRestriction(player, upgradeInput, "temperedLongSword"),
    ).toBeUndefined();
  });

  it("keeps hero and companion ownership explicit", () => {
    const player = createCrafter();
    const guardian = recruitCompanion(player, "guardian").companion!;
    guardian.inventory.push(item("wildHerbs"), item("wildHerbs"));

    const heroAttempt = craftItem(player, {
      recipeId: "fieldPotion",
      transactionId: "test:hero-empty",
    });
    const companionAttempt = craftItem(player, {
      recipeId: "fieldPotion",
      transactionId: "test:guardian",
      actorId: "guardian",
    });

    expect(heroAttempt.crafted).toBe(false);
    expect(companionAttempt.crafted).toBe(true);
    expect(player.inventory.some((entry) => entry.id === "potion")).toBe(false);
    expect(guardian.inventory.some((entry) => entry.id === "potion")).toBe(true);
  });

  it("excludes debug crafting from natural statistics", () => {
    const player = createCrafter();
    player.inventory.push(item("wildHerbs"), item("wildHerbs"));

    const result = craftItem(player, {
      recipeId: "fieldPotion",
      transactionId: "debug:craft:fieldPotion",
      debug: true,
    });

    expect(result.crafted).toBe(true);
    expect(player.progression.crafting.statistics.totalCrafts).toBe(0);
    expect(player.progression.crafting.recentHistory[0]?.debug).toBe(true);
  });
});

describe("crafting discovery and queries", () => {
  it("unlocks direct discovery signals idempotently", () => {
    const player = createCrafter();

    const first = discoverCraftingRecipes(player, {
      type: "npc",
      npcId: "bogtownApothecary",
    });
    const second = discoverCraftingRecipes(player, {
      type: "npc",
      npcId: "bogtownApothecary",
    });

    expect(first).toEqual(["battleSalves"]);
    expect(second).toEqual([]);
    expect(player.progression.crafting.knownRecipeIds).toContain("battleSalves");
  });

  it("reconciles durable city, gathering, Codex, event, and item evidence", () => {
    const player = createCrafter();
    const codex = createCodex();
    player.progression.discoveredCities.push("ironhold_city");
    player.progression.gathering.stats.fishing.successes = 3;
    player.progression.worldEvents.log.push({
      instanceId: "stormWashedCrossing:1",
      eventId: "stormWashedCrossing",
      family: "hazard",
      title: "Storm-Washed Crossing",
      source: "test",
      location: {
        chunkX: 4,
        chunkY: 2,
        x: 3,
        y: 3,
        areaName: "Heartlands",
        terrain: 1,
      },
      timeStep: 1,
      period: TimePeriod.Day,
      weather: WeatherType.Storm,
      choiceId: "crossQuickly",
      outcomeId: "crossingCleared",
      outcome: "Cleared",
    });
    player.inventory.push(item("trapKit"));
    codex.unlockedEntryIds.push("chainsOfTheForgemaster");

    const unlocked = reconcileCraftingRecipes(player, codex);
    const repeated = reconcileCraftingRecipes(player, codex);

    expect(unlocked).toEqual(expect.arrayContaining([
      "aetherTea",
      "trapKit",
      "temperedLongSword",
      "reinforcedChainMail",
      "ironboundShield",
      "stormforgedBlade",
      "runicAegis",
    ]));
    expect(repeated).toEqual([]);
  });

  it("filters and sorts known, unknown, and craftable recipes", () => {
    const player = createCrafter();
    player.inventory.push(item("wildHerbs"), item("wildHerbs"));

    const entries = selectCraftingRecipes(player, {
      category: "consumable",
      search: "healing",
      sort: "craftable",
      includeUnknown: true,
    });

    expect(entries[0]?.recipe.id).toBe("fieldPotion");
    expect(entries[0]?.craftable).toBe(true);
    expect(entries.some((entry) => !entry.known)).toBe(true);
  });

  it("requires justified stations only in valid cities", () => {
    const player = createCrafter();
    expect(getAvailableCraftingStations(player)).toEqual([]);
    player.position.inCity = true;
    player.position.cityId = "ironhold_city";
    expect(getAvailableCraftingStations(player)).toEqual(["forge"]);

    const validation = validateCraftingRequest(player, {
      recipeId: "temperedLongSword",
      transactionId: "preview",
      station: undefined,
      allowUnknown: true,
    });
    expect(validation.reason).toContain("requires a forge");
  });

  it("normalizes schema-v15 state and repairs malformed values", () => {
    const normalized = normalizeCraftingState({
      knownRecipeIds: ["fieldPotion", "fieldPotion", "unknown"],
      appliedDiscoveryIds: ["city:ironhold_city", "", 3],
      appliedTransactionIds: ["tx:1", "tx:1"],
      statistics: {
        totalCrafts: -3,
        equipmentUpgrades: 2,
        recipeCraftCounts: {
          fieldPotion: 5,
          unknown: 20,
        },
      },
      recentHistory: [{
        sequence: 3,
        recipeId: "fieldPotion",
        actorId: "hero",
        quantity: 1,
        outputItemId: "potion",
        outputQuantity: 1,
        debug: false,
      }],
      nextSequence: 1,
    }, 15);

    expect(normalized.knownRecipeIds.filter((id) => id === "fieldPotion"))
      .toHaveLength(1);
    expect(normalized.statistics.totalCrafts).toBe(0);
    expect(normalized.statistics.recipeCraftCounts).toEqual({ fieldPotion: 5 });
    expect(normalized.nextSequence).toBe(4);
  });

  it("validates debug commands and excludes debug crafts from achievements", () => {
    const player = createCrafter();
    const codex = createCodex();
    expect(executeCraftingDebugCommand(
      player,
      codex,
      "material unknown 2",
    ).changed).toBe(false);
    executeCraftingDebugCommand(player, codex, "material wildHerbs 2");
    const result = executeCraftingDebugCommand(
      player,
      codex,
      "craft fieldPotion 1 hero",
    );

    expect(result.changed).toBe(true);
    expect(player.progression.crafting.statistics.totalCrafts).toBe(0);
    expect(
      player.progression.crafting.recentHistory[
        player.progression.crafting.recentHistory.length - 1
      ]?.debug,
    ).toBe(true);
  });
});
