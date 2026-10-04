import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CRAFTING_RECIPES } from "../src/data/crafting";
import { ITEMS, getItem, getSellValue } from "../src/data/items";
import { MERCHANT_ROUTES } from "../src/data/nautical";
import { Terrain } from "../src/data/map";
import {
  getCampaignDifficultyRules, resolveDifficultyRules, scaleCost, scaleSaleValue,
} from "../src/systems/difficulty";
import {
  craftItem, getRecipeInputMarketValue, getRecipeOutputSellValue,
  matchesCraftingIngredient, validateCraftingRequest,
} from "../src/systems/crafting";
import { buyItem } from "../src/systems/player";
import {
  acquireBoat, createNauticalState, discoverPort, executeMerchantRoute,
  getBoatPurchaseCost, getSeaEncounterRate, normalizeNauticalState,
  prepareSeaHazard, purchaseBoat, repairBoatWithGold, resolvePendingMerchantRoute,
  resolvePendingSeaHazard,
} from "../src/systems/nautical";
import {
  applyGatheringAction, claimGatheringReward, createGatheringState,
  getGatheringScore, resolveGatheringGame, startGathering,
  type GatheringNode,
} from "../src/systems/gathering";
import { WeatherType } from "../src/systems/weather";
import { DIFFICULTY_MODE_CASES, createDifficultyPlayer } from "./difficultyFixtures";

beforeEach(() => vi.spyOn(Math, "random").mockReturnValue(0.5));
afterEach(() => vi.restoreAllMocks());

describe.each(DIFFICULTY_MODE_CASES)("$name economy and exploration", ({ selection }) => {
  it("uses the same quote for buying, crafting and bounded resale", () => {
    const player = createDifficultyPlayer(selection);
    const rules = getCampaignDifficultyRules(player);
    const potion = getItem("potion")!;
    const goldBefore = player.gold;
    expect(buyItem(player, potion)).toBe(true);
    expect(player.gold).toBe(goldBefore - scaleCost(potion.cost, rules));
    expect(scaleSaleValue(getSellValue(potion), rules))
      .toBeLessThanOrEqual(scaleCost(potion.cost, rules, 0.35, 1));
    for (const recipe of CRAFTING_RECIPES) {
      expect(getRecipeInputMarketValue(recipe, 0.35, rules), recipe.id)
        .toBeGreaterThan(getRecipeOutputSellValue(recipe, rules));
    }
    const recipe = CRAFTING_RECIPES.find((entry) => (entry.goldCost ?? 0) > 0)!;
    player.progression.crafting.knownRecipeIds.push(recipe.id);
    const batch = Math.min(2, recipe.maxBatch ?? 99);
    for (const ingredient of recipe.ingredients) {
      const canonical = ITEMS.find((item) => matchesCraftingIngredient(item, ingredient))!;
      expect(canonical).toBeDefined();
      for (let index = 0; index < ingredient.quantity * batch; index += 1) {
        player.inventory.push({ ...canonical });
      }
    }
    const request = {
      recipeId: recipe.id, batch, station: recipe.station, transactionId: "mode:craft:1",
    };
    const quote = validateCraftingRequest(player, request);
    expect(quote.valid).toBe(true);
    expect(quote.goldRequired).toBe(scaleCost((recipe.goldCost ?? 0) * batch, rules));
    const beforeCraft = player.gold;
    expect(craftItem(player, request).crafted).toBe(true);
    expect(player.gold).toBe(beforeCraft - quote.goldRequired);
    const receipt = JSON.stringify({ gold: player.gold, inventory: player.inventory });
    expect(craftItem(player, request).crafted).toBe(false);
    expect(JSON.stringify({ gold: player.gold, inventory: player.inventory })).toBe(receipt);
  });

  it("preserves exact merchant-route fees across reload and resolves them once", () => {
    const player = createDifficultyPlayer(selection);
    const state = player.progression.nautical;
    discoverPort(state, "sandportHarbor");
    const route = MERCHANT_ROUTES.find((entry) => entry.id === "sandportTidehavenRun")!;
    const fee = scaleCost(route.fee, getCampaignDifficultyRules(player));
    const goldBefore = player.gold;
    const started = executeMerchantRoute(state, player, route.id, "sandportHarbor", "mode:route:1");
    expect(started.ok).toBe(true);
    expect(started.pending?.feePaid).toBe(fee);
    expect(player.gold).toBe(goldBefore - fee);
    expect(executeMerchantRoute(state, player, route.id, "sandportHarbor", "mode:route:1").idempotent)
      .toBe(true);
    expect(player.gold).toBe(goldBefore - fee);
    const recovered = normalizeNauticalState(JSON.parse(JSON.stringify(state)), 19);
    expect(recovered.pendingMerchantRoute?.feePaid).toBe(fee);
    expect(resolvePendingMerchantRoute(recovered, "mode:route:1").ok).toBe(true);
    expect(resolvePendingMerchantRoute(recovered, "mode:route:1").idempotent).toBe(true);
    expect(recovered.stats.routesCompleted).toBe(1);
    expect(recovered.stats.routeFeesPaid).toBe(fee);
  });

  it("keeps boat purchases and fractional-price repair atomic and affordable", () => {
    const player = createDifficultyPlayer(selection);
    const state = player.progression.nautical;
    player.gold = 5000;
    const price = getBoatPurchaseCost(player, "merchantSloop");
    const purchased = purchaseBoat(state, player, "merchantSloop", true);
    expect(purchased.purchased).toBe(true);
    expect(purchased.cost).toBe(price);
    expect(player.gold).toBe(5000 - price);
    expect(purchaseBoat(state, player, "merchantSloop", true).purchased).toBe(false);
    expect(player.gold).toBe(5000 - price);
    state.ownedBoats[0]!.condition = 91;
    player.gold = 5;
    const repair = repairBoatWithGold(state, player);
    expect(repair.repaired).toBeGreaterThan(0);
    expect(repair.cost).toBe(scaleCost(repair.repaired * 2, getCampaignDifficultyRules(player)));
    expect(player.gold).toBe(5 - repair.cost);
    expect(player.gold).toBeGreaterThanOrEqual(0);
    expect(state.ownedBoats[0]!.condition).toBe(91 + repair.repaired);
    const again = repairBoatWithGold(state, player);
    expect(again.repaired).toBe(0);
  });

  it("keeps sea encounters capped and sea hazards nonlethal and idempotent", () => {
    const player = createDifficultyPlayer(selection);
    player.hp = 1;
    const state = createNauticalState();
    const boat = acquireBoat(state, "stormcutter").boat;
    state.sailing = true;
    const rate = getSeaEncounterRate({
      zoneId: "southreachDeep", depth: "deep", timeStep: 300,
      weather: WeatherType.Storm, boat, routeSafety: "dangerous", difficulty: selection,
    });
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThanOrEqual(0.15);
    for (let seed = 1; seed <= 10000 && !state.pendingHazard; seed += 1) {
      prepareSeaHazard({
        state, stepId: `mode:sea:${seed}`, seed, zoneId: "southreachDeep",
        depth: "deep", timeStep: 300, weather: WeatherType.Storm,
      });
    }
    expect(state.pendingHazard).not.toBeNull();
    const pending = state.pendingHazard!;
    pending.naturalRoll = 1;
    const result = resolvePendingSeaHazard(state, player, pending.instanceId);
    expect(result.ok).toBe(true);
    expect(player.hp).toBe(1);
    expect(result.check?.modifier).toBe(getCampaignDifficultyRules(player).skillCheckAssistance);
    expect(boat.condition).toBeGreaterThanOrEqual(0);
    const condition = boat.condition;
    expect(resolvePendingSeaHazard(state, player, pending.instanceId).idempotent).toBe(true);
    expect(boat.condition).toBe(condition);
    expect(state.stats.hazardsFaced).toBe(1);
  });

  it("does not change deterministic gathering patterns, materials or reduced-motion thresholds", () => {
    const node: GatheringNode = {
      id: "g:mining:overworld:test:0:4,3", discipline: "mining",
      location: {
        context: "overworld", contextId: "test", sublevel: 0,
        playerX: 3, playerY: 3, targetX: 4, targetY: 3,
        terrain: Terrain.Mountain, biome: "Mountain Reach",
      },
    };
    const player = createDifficultyPlayer(selection);
    const baseline = createDifficultyPlayer({ profileId: "standard" });
    player.progression.gathering = createGatheringState(99);
    baseline.progression.gathering = createGatheringState(99);
    const pending = startGathering(player, node, {
      timeStep: 100, weather: WeatherType.Clear, reducedMotion: true,
    });
    const original = startGathering(baseline, node, {
      timeStep: 100, weather: WeatherType.Clear, reducedMotion: false,
    });
    expect(pending.outcomeId).toBe(original.outcomeId);
    expect(pending.quantity).toBe(original.quantity);
    expect(pending.game).toEqual(original.game);
    if (pending.game.kind !== "mining") throw new Error("Expected canonical mining pattern");
    for (const direction of pending.game.pattern) {
      applyGatheringAction(pending, { type: "direction", direction });
      applyGatheringAction(pending, { type: "confirm" });
    }
    expect(getGatheringScore(pending.game)).toBe(100);
    const before = player.inventory.length;
    resolveGatheringGame(player);
    if (player.progression.gathering.pending?.phase === "battle") claimGatheringReward(player, true);
    expect(player.inventory.length).toBe(before + pending.quantity);
    expect(claimGatheringReward(player, true).resolved).toBe(false);
    expect(player.inventory.length).toBe(before + pending.quantity);
  });
});

it("keeps every recipe non-arbitrage at every allowed price override", () => {
  for (let pricePercent = 75; pricePercent <= 150; pricePercent += 5) {
    const rules = resolveDifficultyRules({ profileId: "custom", overrides: { pricePercent } });
    for (const recipe of CRAFTING_RECIPES) {
      expect(getRecipeInputMarketValue(recipe, 0.35, rules), `${recipe.id}:${pricePercent}`)
        .toBeGreaterThan(getRecipeOutputSellValue(recipe, rules));
    }
  }
});
