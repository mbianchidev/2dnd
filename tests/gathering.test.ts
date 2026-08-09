import { describe, expect, it } from "vitest";
import {
  GATHERING_DEFINITIONS,
  GATHERING_DISCIPLINES,
  GATHERING_RESOURCES,
  GATHERING_TABLES,
  getGatheringOutcome,
  type GatheringDiscipline,
} from "../src/data/gathering";
import { getItem, getSellValue } from "../src/data/items";
import {
  Terrain,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  getChunk,
  isWalkable,
} from "../src/data/map";
import {
  applyGatheringAction,
  claimGatheringReward,
  createGatheringState,
  findGatheringNodes,
  getAvailableGatheringNode,
  getGatheringOutcomeWeight,
  getGatheringScore,
  isGatheringGameComplete,
  movePlayerNearGatheringNode,
  resolveGatheringGame,
  startGathering,
  tickGatheringCooldowns,
  type GatheringDirection,
  type GatheringNode,
  type PendingGathering,
} from "../src/systems/gathering";
import { normalizeGatheringState } from "../src/systems/gatheringState";
import {
  reconcileAchievements,
  suppressCurrentlyMetAchievements,
} from "../src/systems/achievements";
import { createCodex } from "../src/systems/codex";
import { TimePeriod } from "../src/systems/daynight";
import { createPlayer, type PlayerState } from "../src/systems/player";
import { getItemTransferRestriction, getItemRarity } from "../src/systems/inventory";
import { WeatherType } from "../src/systems/weather";

const BASE_STATS = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
};

function createTestPlayer(seed = 620062): PlayerState {
  const player = createPlayer("Gatherer", BASE_STATS);
  player.progression.gathering = createGatheringState(seed);
  return player;
}

function createNode(
  discipline: GatheringDiscipline,
  terrain: Terrain,
  context: "overworld" | "city" | "dungeon" = "overworld",
): GatheringNode {
  return {
    id: `g:${discipline}:${context}:test:0:4,3`,
    discipline,
    location: {
      context,
      contextId: "test",
      sublevel: 0,
      playerX: 3,
      playerY: 3,
      targetX: 4,
      targetY: 3,
      terrain,
      biome: context === "dungeon" ? "Heartlands Crypt" : "Mountain Reach",
    },
  };
}

function completePending(pending: PendingGathering): void {
  if (pending.game.kind === "fishing") {
    while (pending.game.phase === "waiting") {
      applyGatheringAction(
        pending,
        pending.reducedMotion ? { type: "confirm" } : { type: "tick" },
      );
    }
    applyGatheringAction(pending, { type: "confirm" });
    for (const direction of pending.game.tensionPattern) {
      applyGatheringAction(pending, { type: "direction", direction });
    }
    return;
  }
  if (pending.game.kind === "mining") {
    for (const direction of pending.game.pattern) {
      applyGatheringAction(pending, { type: "direction", direction });
      applyGatheringAction(pending, { type: "confirm" });
    }
    return;
  }
  while (pending.game.phase === "reveal") {
    applyGatheringAction(
      pending,
      pending.reducedMotion ? { type: "confirm" } : { type: "tick" },
    );
  }
  for (const direction of pending.game.pattern) {
    applyGatheringAction(pending, { type: "direction", direction });
  }
}

describe("gathering data and terrain eligibility", () => {
  it("defines stable unique disciplines, tables, outcomes, resources, and recipe inputs", () => {
    expect(new Set(GATHERING_DISCIPLINES).size).toBe(3);
    expect(new Set(GATHERING_TABLES.map((table) => table.id)).size)
      .toBe(GATHERING_TABLES.length);
    expect(new Set(GATHERING_TABLES.flatMap((table) =>
      table.outcomes.map((outcome) => outcome.id)
    )).size).toBe(GATHERING_TABLES.flatMap((table) => table.outcomes).length);
    expect(new Set(GATHERING_RESOURCES.map((resource) => resource.id)).size)
      .toBe(GATHERING_RESOURCES.length);

    for (const resource of GATHERING_RESOURCES) {
      const item = getItem(resource.itemId);
      expect(item?.type).toBe("crafting");
      expect(item?.material?.resourceId).toBe(resource.id);
      expect(item?.material?.recipeInput).toEqual(resource.recipeInput);
      expect(getItemRarity(item!)).toBe(resource.rarity);
      expect(getItemTransferRestriction(createTestPlayer(), item!)).toBeNull();
      expect(resource.recipeInput.materialId).toBe(resource.id);
      expect(resource.recipeInput.tags.length).toBeGreaterThan(0);
    }
  });

  it("finds safe reachable nodes without moving the hero onto blocked terrain", () => {
    for (const discipline of GATHERING_DISCIPLINES) {
      const player = createTestPlayer();
      const node = movePlayerNearGatheringNode(player, discipline);
      expect(node, discipline).toBeDefined();
      expect(isWalkable(node!.location.terrain)).toBe(
        discipline === "foraging",
      );
      const nodes = findGatheringNodes(player);
      expect(nodes.some((candidate) => candidate.id === node!.id)).toBe(true);
      expect(GATHERING_DEFINITIONS[discipline].targetTerrains)
        .toContain(node!.location.terrain);
    }
  });

  it("keeps adjacent ready nodes available when another node is cooling down", () => {
    const player = createTestPlayer();
    let candidates: ReturnType<typeof findGatheringNodes> = [];
    for (let chunkY = 0; chunkY < WORLD_HEIGHT && candidates.length < 2; chunkY += 1) {
      for (let chunkX = 0; chunkX < WORLD_WIDTH && candidates.length < 2; chunkX += 1) {
        const chunk = getChunk(chunkX, chunkY);
        if (!chunk) continue;
        player.position.chunkX = chunkX;
        player.position.chunkY = chunkY;
        for (let y = 0; y < chunk.mapData.length && candidates.length < 2; y += 1) {
          for (let x = 0; x < chunk.mapData[y]!.length && candidates.length < 2; x += 1) {
            if (!isWalkable(chunk.mapData[y]![x]!)) continue;
            player.position.x = x;
            player.position.y = y;
            const nodes = findGatheringNodes(player);
            const grouped = GATHERING_DISCIPLINES.map((discipline) =>
              nodes.filter((node) => node.discipline === discipline)
            ).find((group) => group.length >= 2);
            if (grouped) candidates = grouped;
          }
        }
      }
    }
    expect(candidates.length).toBeGreaterThanOrEqual(2);
    for (const node of findGatheringNodes(player)) {
      if (node.id === candidates[1]!.id) continue;
      player.progression.gathering.nodeStates[node.id] = {
        attempts: 1,
        cooldownRemaining: 8,
      };
    }
    expect(getAvailableGatheringNode(player).node?.id).toBe(candidates[1]!.id);
  });
});

describe("deterministic gathering tables and environmental modifiers", () => {
  it("preselects the same outcome and quantity for the same seed and instance", () => {
    const node = createNode("fishing", Terrain.Water);
    const first = createTestPlayer(12345);
    const second = createTestPlayer(12345);
    const context = {
      timeStep: 100,
      weather: WeatherType.Clear,
      reducedMotion: false,
    };
    const left = startGathering(first, node, context);
    const right = startGathering(second, node, context);
    expect(left.outcomeId).toBe(right.outcomeId);
    expect(left.quantity).toBe(right.quantity);
    expect(left.game).toEqual(right.game);
  });

  it("applies weather, day-night, biome, and terrain rarity weights", () => {
    const stormEel = getGatheringOutcome("catchStormEel")!;
    const moonKoi = getGatheringOutcome("catchMoonKoi")!;
    const moonstone = getGatheringOutcome("mineMoonstone")!;
    const redcap = getGatheringOutcome("gatherRedcap")!;
    const fishing = createNode("fishing", Terrain.Water);
    const mining = createNode("mining", Terrain.DungeonWall, "dungeon");
    const foraging = createNode("foraging", Terrain.Mushroom);

    expect(getGatheringOutcomeWeight(stormEel, fishing, {
      timeStep: 100,
      weather: WeatherType.Storm,
      reducedMotion: false,
    })).toBeGreaterThan(stormEel.weight);
    expect(getGatheringOutcomeWeight(moonKoi, fishing, {
      timeStep: 300,
      weather: WeatherType.Clear,
      reducedMotion: false,
    })).toBeGreaterThan(moonKoi.weight);
    expect(getGatheringOutcomeWeight(moonstone, mining, {
      timeStep: 100,
      weather: WeatherType.Clear,
      reducedMotion: false,
    })).toBeGreaterThan(moonstone.weight);
    expect(getGatheringOutcomeWeight(redcap, foraging, {
      timeStep: 100,
      weather: WeatherType.Fog,
      reducedMotion: false,
    })).toBeGreaterThan(redcap.weight);
    expect(TimePeriod.Night).toBe("Night");
  });
});

describe("gathering minigame state machines", () => {
  it.each([
    ["fishing", Terrain.Water],
    ["mining", Terrain.Mountain],
    ["foraging", Terrain.Forest],
  ] as const)("completes interactive %s input deterministically", (discipline, terrain) => {
    const player = createTestPlayer();
    const pending = startGathering(
      player,
      createNode(discipline, terrain),
      {
        timeStep: 100,
        weather: WeatherType.Clear,
        reducedMotion: false,
      },
    );
    completePending(pending);
    expect(isGatheringGameComplete(pending.game)).toBe(true);
    expect(getGatheringScore(pending.game)).toBe(100);
  });

  it.each([
    ["fishing", Terrain.Water],
    ["foraging", Terrain.Forest],
  ] as const)("preserves %s difficulty and score under reduced motion", (discipline, terrain) => {
    const livePlayer = createTestPlayer(8800);
    const reducedPlayer = createTestPlayer(8800);
    const node = createNode(discipline, terrain);
    const live = startGathering(livePlayer, node, {
      timeStep: 100,
      weather: WeatherType.Clear,
      reducedMotion: false,
    });
    const reduced = startGathering(reducedPlayer, node, {
      timeStep: 100,
      weather: WeatherType.Clear,
      reducedMotion: true,
    });
    completePending(live);
    completePending(reduced);
    expect(reduced.outcomeId).toBe(live.outcomeId);
    expect(reduced.quantity).toBe(live.quantity);
    expect(reduced.game.kind).toBe(live.game.kind);
    expect(getGatheringScore(reduced.game)).toBe(getGatheringScore(live.game));
  });

  it("records failure without granting inventory", () => {
    const player = createTestPlayer();
    const pending = startGathering(player, createNode("mining", Terrain.Mountain), {
      timeStep: 100,
      weather: WeatherType.Clear,
      reducedMotion: false,
    });
    const wrong: GatheringDirection = pending.game.kind === "mining"
      && pending.game.pattern[0] !== "left"
      ? "left"
      : "right";
    if (pending.game.kind !== "mining") throw new Error("Expected mining game");
    for (let index = 0; index < pending.game.pattern.length; index += 1) {
      applyGatheringAction(pending, { type: "direction", direction: wrong });
      applyGatheringAction(pending, { type: "confirm" });
    }
    const before = player.inventory.length;
    const resolution = resolveGatheringGame(player);
    expect(resolution.success).toBe(false);
    expect(player.inventory).toHaveLength(before);
    expect(player.progression.gathering.stats.mining.failures).toBe(1);
  });
});

describe("gathering rewards, cooldowns, hooks, and persistence", () => {
  it("grants canonical stack entries, applies depletion cooldowns, and prevents rerolls", () => {
    const player = createTestPlayer(9);
    const node = createNode("foraging", Terrain.Forest);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      player.progression.gathering.nodeStates[node.id] = {
        attempts: attempt,
        cooldownRemaining: 0,
      };
      const pending = startGathering(player, node, {
        timeStep: 0,
        weather: WeatherType.Clear,
        reducedMotion: true,
      });
      completePending(pending);
      const beforeCount = player.inventory.filter((item) =>
        item.id === pending.resourceId
      ).length;
      const resolution = resolveGatheringGame(player);
      expect(resolution.success).toBe(true);
      expect(player.inventory.filter((item) => item.id === resolution.itemId))
        .toHaveLength(beforeCount + resolution.quantity);
    }
    expect(player.progression.gathering.nodeStates[node.id]!.cooldownRemaining)
      .toBeGreaterThan(GATHERING_DEFINITIONS.foraging.baseCooldownSteps);
    tickGatheringCooldowns(player);
    expect(player.progression.gathering.nodeStates[node.id]!.cooldownRemaining)
      .toBe(GATHERING_DEFINITIONS.foraging.depletedCooldownSteps - 1);
    expect(player.progression.gathering.claimedOutcomeIds).toHaveLength(4);
  });

  it("uses the normal Battle contract for special gathering creatures and claims once", () => {
    const player = createTestPlayer(55);
    const pending = startGathering(player, createNode("fishing", Terrain.Water), {
      timeStep: 100,
      weather: WeatherType.Storm,
      reducedMotion: true,
    });
    pending.outcomeId = "catchStormEel";
    pending.resourceId = "stormEel";
    pending.rarity = "rare";
    completePending(pending);
    const resolution = resolveGatheringGame(player);
    expect(resolution.battle?.id).toContain("gathering:");
    expect(player.progression.gathering.pending?.phase).toBe("battle");
    const reward = claimGatheringReward(player, true);
    expect(reward.itemId).toBe("stormEel");
    expect(player.inventory.filter((item) => item.id === "stormEel"))
      .toHaveLength(reward.quantity);
    expect(claimGatheringReward(player, true).resolved).toBe(false);
  });

  it("normalizes schema-v14 state and clears seed-coupled state after malformed seed recovery", () => {
    const valid = normalizeGatheringState({
      seed: 42,
      sequence: 3,
      nodeStates: { "g:fishing:overworld:1,1:0:2,2": { attempts: 2, cooldownRemaining: 9 } },
      discoveredNodeIds: ["g:fishing:overworld:1,1:0:2,2"],
      discoveredResourceIds: ["brookTrout", "unknown"],
      claimedOutcomeIds: ["claim"],
      stats: { fishing: { attempts: 3, successes: 2, failures: 1, rareFinds: 0, bestScore: 80 } },
      history: [],
      pending: null,
    }, 14);
    expect(valid.seed).toBe(42);
    expect(valid.discoveredResourceIds).toEqual(["brookTrout"]);

    const corrupt = normalizeGatheringState({
      ...valid,
      seed: "bad",
      pending: valid.pending,
    }, 14);
    expect(corrupt.nodeStates).toEqual({});
    expect(corrupt.discoveredNodeIds).toEqual([]);
    expect(corrupt.pending).toBeNull();

    const highUse = normalizeGatheringState({
      ...valid,
      nodeStates: {
        "g:fishing:overworld:1,1:0:2,2": {
          attempts: 21,
          cooldownRemaining: 0,
        },
      },
    }, 14);
    expect(highUse.nodeStates["g:fishing:overworld:1,1:0:2,2"]?.attempts)
      .toBe(21);
  });

  it("derives gathering achievements without making them authoritative", () => {
    const player = createTestPlayer();
    player.progression.gathering.stats.fishing.successes = 5;
    player.progression.gathering.stats.mining.successes = 5;
    player.progression.gathering.stats.foraging.successes = 5;
    player.progression.gathering.stats.foraging.rareFinds = 1;
    const result = reconcileAchievements({
      player,
      defeatedBosses: new Set(),
      codex: createCodex(),
    });
    expect(result.newlyUnlocked).toEqual(expect.arrayContaining([
      "resourceGatherer",
      "rareHarvest",
      "masterGatherer",
    ]));
    expect(player.progression.gathering.stats.fishing.successes).toBe(5);
  });

  it("supports debug suppression before gathering achievement reconciliation", () => {
    const player = createTestPlayer();
    player.progression.gathering.stats.fishing.successes = 5;
    player.progression.gathering.stats.mining.successes = 5;
    player.progression.gathering.stats.foraging.successes = 5;
    const context = {
      player,
      defeatedBosses: new Set<string>(),
      codex: createCodex(),
    };
    expect(suppressCurrentlyMetAchievements(context)).toContain("masterGatherer");
    expect(reconcileAchievements(context).newlyUnlocked).not.toContain(
      "masterGatherer",
    );
  });

  it("keeps gathering sale values bounded below ordinary battle income", () => {
    const sellValues = GATHERING_RESOURCES.map((resource) =>
      getSellValue(getItem(resource.itemId)!)
    );
    expect(Math.max(...sellValues)).toBeLessThanOrEqual(22);
    expect(sellValues.every((value) => value > 0)).toBe(true);
  });
});
