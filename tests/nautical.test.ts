import { describe, expect, it } from "vitest";
import {
  BOATS,
  CONTINENTS,
  ISLANDS,
  MERCHANT_ROUTES,
  PORTS,
  SEA_DAY_MONSTERS,
  SEA_NIGHT_MONSTERS,
  SEA_ZONES,
  getSeaZoneAt,
} from "../src/data/nautical";
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  Terrain,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  getTerrainAt,
} from "../src/data/map";
import { CITIES } from "../src/data/cities";
import {
  acquireBoat,
  canDisembark,
  canEmbark,
  createNauticalState,
  discoverPort,
  disembark,
  embark,
  executeMerchantRoute,
  getSeaEncounterPool,
  getSeaEncounterRate,
  installBoatUpgrade,
  customizeBoat,
  repairActiveBoat,
  normalizeNauticalState,
  prepareSeaEncounter,
  prepareSeaHazard,
  purchaseBoat,
  resolvePendingMerchantRoute,
  resolvePendingSeaEncounter,
  resolvePendingSeaHazard,
  seaFogKey,
  selectWeightedSeaMonster,
} from "../src/systems/nautical";
import { WeatherType } from "../src/systems/weather";
import type { PlayerPosition, PlayerStats } from "../src/systems/player";
import type {
  NauticalState,
  PendingSeaHazard,
} from "../src/systems/nautical";

const TEST_STATS: PlayerStats = {
  strength: 8,
  dexterity: 8,
  constitution: 8,
  intelligence: 8,
  wisdom: 8,
  charisma: 8,
};

function position(
  overrides: Partial<PlayerPosition> = {},
): PlayerPosition {
  return {
    x: 5,
    y: 1,
    chunkX: 4,
    chunkY: 2,
    inDungeon: false,
    dungeonId: "",
    dungeonLevel: 0,
    inCity: false,
    cityId: "",
    cityChunkIndex: 0,
    ...overrides,
  };
}

function sailingState(): NauticalState {
  const state = createNauticalState();
  acquireBoat(state, "stormcutter");
  state.sailing = true;
  return state;
}

function findStormHazard(): {
  seed: number;
  state: NauticalState;
  pending: PendingSeaHazard;
} {
  for (let seed = 1; seed <= 10_000; seed += 1) {
    const state = sailingState();
    const pending = prepareSeaHazard({
      state,
      stepId: "storm-step",
      seed,
      zoneId: "southreachDeep",
      depth: "deep",
      timeStep: 300,
      weather: WeatherType.Storm,
      routeSafety: "dangerous",
    });
    if (pending) return { seed, state, pending };
  }
  throw new Error("Expected a deterministic storm hazard seed");
}

describe("nautical data integrity", () => {
  it("assigns every world chunk to exactly four coherent landmasses", () => {
    expect(CONTINENTS).toHaveLength(4);
    expect(new Set(CONTINENTS.map((entry) => entry.id)).size).toBe(4);
    expect(new Set(CONTINENTS.map((entry) => entry.name)).size).toBe(4);

    const assigned = CONTINENTS.flatMap((continent) =>
      continent.chunks.map(
        ({ chunkX, chunkY }) => `${chunkX},${chunkY}`,
      ));
    expect(assigned).toHaveLength(WORLD_WIDTH * WORLD_HEIGHT);
    expect(new Set(assigned).size).toBe(WORLD_WIDTH * WORLD_HEIGHT);
    for (let chunkY = 0; chunkY < WORLD_HEIGHT; chunkY += 1) {
      for (let chunkX = 0; chunkX < WORLD_WIDTH; chunkX += 1) {
        expect(assigned).toContain(`${chunkX},${chunkY}`);
      }
    }
  });

  it("keeps stable unique IDs and valid metadata references", () => {
    const collections = [
      CONTINENTS,
      SEA_ZONES,
      ISLANDS,
      PORTS,
      MERCHANT_ROUTES,
      BOATS,
    ];
    for (const collection of collections) {
      const ids = collection.map((entry) => entry.id);
      expect(new Set(ids).size).toBe(ids.length);
      ids.forEach((id) => expect(id).toMatch(/^[a-z][a-zA-Z0-9]*$/));
    }

    const portIds = new Set(PORTS.map((port) => port.id));
    for (const route of MERCHANT_ROUTES) {
      expect(route.fee).toBeGreaterThan(0);
      expect(route.distance).toBeGreaterThan(0);
      route.portIds.forEach((portId) => expect(portIds.has(portId)).toBe(true));
    }
  });

  it("uses live city IDs plus the future Tidehaven city metadata", () => {
    const liveCityIds = new Set(CITIES.map((city) => city.id));
    const expectedLivePorts = [
      "willowdale_city",
      "sandport_city",
      "frostheim_city",
      "ridgewatch_city",
    ];
    expectedLivePorts.forEach((cityId) => {
      expect(liveCityIds.has(cityId)).toBe(true);
      expect(PORTS.some((port) => port.cityId === cityId)).toBe(true);
    });
    expect(PORTS.some((port) => port.cityId === "tidehaven_city")).toBe(true);
  });

  it("places stable island markers without renumbering legacy chunks", () => {
    expect(ISLANDS.map((island) => island.id)).toEqual(
      expect.arrayContaining(["tideglassIsle", "emberwakeCay"]),
    );
    for (const island of ISLANDS) {
      const { chunkX, chunkY, tileX, tileY } = island.location;
      const terrain = getTerrainAt(chunkX, chunkY, tileX, tileY);
      expect(terrain).toBe(
        island.id === "tideglassIsle" ? Terrain.Town : Terrain.Water,
      );
    }
  });

  it("looks up stable sea zones and shallow or deep water by world tile", () => {
    expect(getSeaZoneAt(1, 0, 0, 0)).toEqual({
      zoneId: "frostwakeSea",
      depth: "shallow",
    });
    expect(getSeaZoneAt(1, 1, 0, 14)).toEqual({
      zoneId: "frostwakeSea",
      depth: "deep",
    });
    expect(getSeaZoneAt(3, 8, 0, 14)).toEqual({
      zoneId: "southreachDeep",
      depth: "deep",
    });
    expect(getSeaZoneAt(-1, 0, 0, 0)).toBeUndefined();
  });
});

describe("nautical state and discovery", () => {
  it("creates a schema-v15-compatible empty default", () => {
    expect(normalizeNauticalState(undefined, 15)).toEqual(
      createNauticalState(),
    );
    expect(normalizeNauticalState({ ownedBoats: [] }, 14)).toEqual(
      createNauticalState(),
    );
  });

  it("repairs malformed IDs, bounds values, and restores dependencies", () => {
    const normalized = normalizeNauticalState({
      ownedBoats: [
        {
          id: "reedSkiff",
          condition: 999,
          upgradeIds: ["navigatorCharts", "reinforcedHull", "invalid"],
          cosmeticId: "missing",
        },
        { id: "invalidBoat", condition: 50 },
      ],
      activeBoatId: "invalidBoat",
      sailing: true,
      heading: "up",
      discoveredPortIds: ["tidehavenPort", "tidehavenPort", "missing"],
      discoveredRouteIds: ["missing"],
      discoveredIslandIds: ["missing"],
      discoveredContinentIds: ["missing"],
      discoveredSeaTiles: [
        "s:covenantStrait,4,2,6,1",
        "s:missing,4,2,6,1",
        "s:covenantStrait,99,2,6,1",
      ],
      pendingMerchantRoute: {
        instanceId: "bad-route",
        routeId: "sandportTidehavenRun",
        fromPortId: "sandportHarbor",
        toPortId: "sandportHarbor",
        boatId: "reedSkiff",
      },
      pendingHazard: { hazardId: "missing" },
      pendingEncounter: { monsterId: "missing" },
      stats: {
        seaSteps: -5,
        tilesDiscovered: -2,
        portsDiscovered: 999,
        hazardsFaced: 1,
        hazardsAvoided: 99,
        routeFeesPaid: Number.POSITIVE_INFINITY,
      },
    }, 15);

    expect(normalized.ownedBoats).toEqual([{
      id: "reedSkiff",
      condition: 100,
      upgradeIds: ["navigatorCharts"],
      cosmeticId: "naturalTimber",
    }]);
    expect(normalized.activeBoatId).toBe("reedSkiff");
    expect(normalized.heading).toBe("north");
    expect(normalized.discoveredPortIds).toEqual(["tidehavenPort"]);
    expect(normalized.discoveredIslandIds).toContain("tideglassIsle");
    expect(normalized.discoveredContinentIds).toContain("verdantCovenant");
    expect(normalized.discoveredRouteIds).toContain("sandportTidehavenRun");
    expect(normalized.discoveredSeaTiles).toEqual([
      "s:covenantStrait,4,2,6,1",
    ]);
    expect(normalized.pendingMerchantRoute).toBeNull();
    expect(normalized.pendingHazard).toBeNull();
    expect(normalized.pendingEncounter).toBeNull();
    expect(normalized.stats).toMatchObject({
      seaSteps: 0,
      tilesDiscovered: 1,
      portsDiscovered: 1,
      hazardsFaced: 1,
      hazardsAvoided: 1,
      routeFeesPaid: 0,
    });
  });

  it("preserves a valid recoverable pending merchant route", () => {
    const normalized = normalizeNauticalState({
      ownedBoats: [{
        id: "merchantSloop",
        condition: 72,
        upgradeIds: [],
        cosmeticId: "covenantBlue",
      }],
      activeBoatId: "merchantSloop",
      discoveredPortIds: ["sandportHarbor"],
      discoveredRouteIds: ["sandportTidehavenRun"],
      pendingMerchantRoute: {
        instanceId: "route-recovery",
        routeId: "sandportTidehavenRun",
        fromPortId: "sandportHarbor",
        toPortId: "tidehavenPort",
        boatId: "merchantSloop",
        feePaid: 999,
        safety: "dangerous",
        distance: 999,
      },
    }, 15);

    expect(normalized.sailing).toBe(true);
    expect(normalized.pendingMerchantRoute).toMatchObject({
      instanceId: "route-recovery",
      feePaid: 70,
      safety: "standard",
      distance: 12,
    });
  });

  it("acquires boats and discovers ports idempotently", () => {
    const state = createNauticalState();
    expect(acquireBoat(state, "merchantSloop").acquired).toBe(true);
    expect(acquireBoat(state, "merchantSloop").acquired).toBe(false);
    expect(state.ownedBoats).toHaveLength(1);
    expect(state.activeBoatId).toBe("merchantSloop");

    expect(discoverPort(state, "tidehavenPort")).toBe(true);
    expect(discoverPort(state, "tidehavenPort")).toBe(false);
    expect(state.discoveredIslandIds).toContain("tideglassIsle");
    expect(state.discoveredContinentIds).toContain("verdantCovenant");
    expect(state.discoveredRouteIds).toContain("sandportTidehavenRun");
    expect(state.stats.portsDiscovered).toBe(1);
  });

  it("validates upgrades, cosmetics, and bounded repairs", () => {
    const state = createNauticalState();
    acquireBoat(state, "merchantSloop");
    const boat = state.ownedBoats[0]!;
    boat.condition = 60;
    expect(installBoatUpgrade(state, "reinforcedHull")).toBe(true);
    expect(installBoatUpgrade(state, "reinforcedHull")).toBe(false);
    expect(customizeBoat(state, "covenantBlue")).toBe(true);
    expect(repairActiveBoat(state, 80)).toBe(40);
    expect(boat).toMatchObject({
      condition: 100,
      cosmeticId: "covenantBlue",
      upgradeIds: ["reinforcedHull"],
    });
  });
});

describe("merchant routes", () => {
  it("supports merchant passage before owning a boat", () => {
    const state = createNauticalState();
    discoverPort(state, "sandportHarbor");
    const wallet = { gold: 100 };
    const started = executeMerchantRoute(
      state,
      wallet,
      "sandportTidehavenRun",
      "sandportHarbor",
      "pre-boat-route",
    );
    expect(started.ok).toBe(true);
    expect(state.ownedBoats).toHaveLength(0);
    expect(wallet.gold).toBe(30);
    expect(resolvePendingMerchantRoute(
      state,
      "pre-boat-route",
    )).toMatchObject({
      ok: true,
      destinationPortId: "tidehavenPort",
      conditionLost: 0,
    });
  });

  it("normalizes a recoverable pre-boat merchant route", () => {
    const state = createNauticalState();
    discoverPort(state, "sandportHarbor");
    const wallet = { gold: 100 };
    executeMerchantRoute(
      state,
      wallet,
      "sandportTidehavenRun",
      "sandportHarbor",
      "pre-boat-reload",
    );
    const normalized = normalizeNauticalState(state, 16);
    expect(normalized.pendingMerchantRoute).toMatchObject({
      instanceId: "pre-boat-reload",
      boatId: null,
      toPortId: "tidehavenPort",
    });
  });

  it("gates optional boat purchases behind the harbor prerequisite", () => {
    const state = createNauticalState();
    const wallet = { gold: 2_000 };
    expect(purchaseBoat(
      state,
      wallet,
      "stormcutter",
      false,
    ).purchased).toBe(false);
    expect(wallet.gold).toBe(2_000);
    expect(purchaseBoat(
      state,
      wallet,
      "stormcutter",
      true,
    ).purchased).toBe(true);
    expect(wallet.gold).toBe(200);
    expect(state.activeBoatId).toBe("stormcutter");
  });

  it("allows merchant passage when a personal boat is disabled", () => {
    const state = createNauticalState();
    acquireBoat(state, "reedSkiff").boat.condition = 0;
    discoverPort(state, "sandportHarbor");
    const wallet = { gold: 100 };
    const started = executeMerchantRoute(
      state,
      wallet,
      "sandportTidehavenRun",
      "sandportHarbor",
      "disabled-boat-route",
    );
    expect(started.ok).toBe(true);
    expect(started.pending?.boatId).toBeNull();
  });

  it("charges atomically, resolves once, and discovers the destination", () => {
    const state = createNauticalState();
    acquireBoat(state, "merchantSloop");
    discoverPort(state, "sandportHarbor");
    const wallet = { gold: 50 };

    const insufficient = executeMerchantRoute(
      state,
      wallet,
      "sandportTidehavenRun",
      "sandportHarbor",
      "route-1",
    );
    expect(insufficient.ok).toBe(false);
    expect(wallet.gold).toBe(50);
    expect(state.pendingMerchantRoute).toBeNull();

    wallet.gold = 100;
    const started = executeMerchantRoute(
      state,
      wallet,
      "sandportTidehavenRun",
      "sandportHarbor",
      "route-1",
    );
    expect(started.ok).toBe(true);
    expect(wallet.gold).toBe(30);
    expect(state.sailing).toBe(true);

    const duplicateStart = executeMerchantRoute(
      state,
      wallet,
      "sandportTidehavenRun",
      "sandportHarbor",
      "route-1",
    );
    expect(duplicateStart.idempotent).toBe(true);
    expect(wallet.gold).toBe(30);

    const resolved = resolvePendingMerchantRoute(state, "route-1");
    const conditionAfter = state.ownedBoats[0].condition;
    expect(resolved.destinationPortId).toBe("tidehavenPort");
    expect(state.discoveredPortIds).toContain("tidehavenPort");
    expect(state.stats.routesCompleted).toBe(1);

    const duplicateResolution = resolvePendingMerchantRoute(state, "route-1");
    expect(duplicateResolution.idempotent).toBe(true);
    expect(state.ownedBoats[0].condition).toBe(conditionAfter);
    expect(state.stats.routesCompleted).toBe(1);
  });

  it("does not charge a quest-gated route until its gate succeeds", () => {
    const state = createNauticalState();
    acquireBoat(state, "stormcutter");
    discoverPort(state, "ridgewatchPort");
    const wallet = { gold: 500 };

    const blocked = executeMerchantRoute(
      state,
      wallet,
      "ridgewatchSandportRun",
      "ridgewatchPort",
      "gated-route",
      () => false,
    );
    expect(blocked.ok).toBe(false);
    expect(wallet.gold).toBe(500);

    const started = executeMerchantRoute(
      state,
      wallet,
      "ridgewatchSandportRun",
      "ridgewatchPort",
      "gated-route",
      () => true,
    );
    expect(started.ok).toBe(true);
    expect(wallet.gold).toBe(390);
  });
});

describe("embarkation and landing", () => {
  it("embarks onto canonical Water and disembarks onto walkable land", () => {
    const state = createNauticalState();
    acquireBoat(state, "merchantSloop");
    const start = position({ x: 6, y: 1 });
    expect(getTerrainAt(4, 2, 6, 1)).toBe(Terrain.Town);
    expect(getTerrainAt(4, 2, 6, 0)).toBe(Terrain.Water);

    const embarkCheck = canEmbark(
      state,
      start,
      "north",
      getTerrainAt,
      () => false,
    );
    expect(embarkCheck.ok).toBe(true);
    const embarked = embark(
      state,
      start,
      "north",
      getTerrainAt,
      () => false,
    );
    expect(embarked.position).toMatchObject({ x: 6, y: 0 });
    expect(state.sailing).toBe(true);
    expect(state.discoveredSeaTiles).toContain(
      "s:covenantStrait,4,2,6,0",
    );

    expect(canDisembark(
      state,
      embarked.position,
      "south",
      getTerrainAt,
      () => true,
    ).ok).toBe(false);
    const landed = disembark(
      state,
      embarked.position,
      "south",
      getTerrainAt,
      () => false,
    );
    expect(landed.position).toMatchObject({ x: 6, y: 1 });
    expect(state.sailing).toBe(false);
  });

  it("blocks shallow boats from deep water without moving state", () => {
    const state = createNauticalState();
    acquireBoat(state, "reedSkiff");
    const start = position({ chunkX: 1, chunkY: 2, x: 3, y: 1 });
    const terrainAt = (
      _chunkX: number,
      _chunkY: number,
      tileX: number,
      _tileY: number,
    ): Terrain => tileX === 4 ? Terrain.Water : Terrain.Grass;

    const check = canEmbark(state, start, "east", terrainAt, () => false);
    expect(check.ok).toBe(false);
    expect(check.reason).toContain("deep water");
    expect(state.sailing).toBe(false);
  });
});

describe("sea encounters", () => {
  it("caps stacked encounter rates and applies route safety and upgrades", () => {
    const state = sailingState();
    const boat = state.ownedBoats[0];
    boat.upgradeIds.push("navigatorCharts");
    const dangerous = getSeaEncounterRate({
      zoneId: "southreachDeep",
      depth: "deep",
      timeStep: 300,
      weather: WeatherType.Storm,
      boat,
      routeSafety: "dangerous",
    });
    const guarded = getSeaEncounterRate({
      zoneId: "southreachDeep",
      depth: "deep",
      timeStep: 300,
      weather: WeatherType.Storm,
      boat,
      routeSafety: "guarded",
    });
    expect(dangerous).toBeLessThanOrEqual(0.15);
    expect(dangerous).toBeGreaterThanOrEqual(guarded);
  });

  it("uses day/night pools and deterministic weighted deep-water selection", () => {
    const dayPool = getSeaEncounterPool(100, "covenantStrait", "shallow");
    const nightPool = getSeaEncounterPool(300, "southreachDeep", "deep");
    expect(dayPool.map((entry) => entry.monsterId)).toEqual(
      [...SEA_DAY_MONSTERS],
    );
    expect(nightPool.map((entry) => entry.monsterId)).toEqual(
      [...SEA_NIGHT_MONSTERS],
    );

    const shallow = getSeaEncounterPool(100, "covenantStrait", "shallow");
    const deep = getSeaEncounterPool(100, "covenantStrait", "deep");
    const shallowSerpent = shallow.find(
      (entry) => entry.monsterId === "seaSerpent",
    );
    const deepSerpent = deep.find(
      (entry) => entry.monsterId === "seaSerpent",
    );
    expect(deepSerpent?.weight).toBeGreaterThan(shallowSerpent?.weight ?? 0);
    expect(selectWeightedSeaMonster(deep, 0.42)).toBe(
      selectWeightedSeaMonster(deep, 0.42),
    );
  });

  it("persists and resolves a selected encounter once per step", () => {
    const state = sailingState();
    const boat = state.ownedBoats[0];
    const pending = prepareSeaEncounter({
      state,
      stepId: "encounter-step",
      rateRoll: 0,
      selectionRoll: 0.5,
      zoneId: "covenantStrait",
      depth: "shallow",
      timeStep: 100,
      weather: WeatherType.Clear,
      boat,
      position: position({ x: 6 }),
    });
    expect(pending).not.toBeNull();
    expect(prepareSeaEncounter({
      state,
      stepId: "encounter-step",
      rateRoll: 0.9,
      selectionRoll: 0.9,
      zoneId: "covenantStrait",
      depth: "shallow",
      timeStep: 100,
      weather: WeatherType.Clear,
      boat,
      position: position({ x: 6 }),
    })).toBe(pending);
    expect(resolvePendingSeaEncounter(
      state,
      pending?.instanceId ?? "",
      "victory",
    )).toBe(true);
    expect(resolvePendingSeaEncounter(
      state,
      pending?.instanceId ?? "",
      "victory",
    )).toBe(false);
    expect(state.stats.encountersWon).toBe(1);
  });
});

describe("weather hazards and sea fog", () => {
  it("selects hazards deterministically and resolves nonlethal damage once", () => {
    const found = findStormHazard();
    const duplicate = prepareSeaHazard({
      state: found.state,
      stepId: "storm-step",
      seed: found.seed,
      zoneId: "southreachDeep",
      depth: "deep",
      timeStep: 300,
      weather: WeatherType.Storm,
      routeSafety: "dangerous",
    });
    expect(duplicate).toBe(found.pending);
    expect(found.state.stats.seaSteps).toBe(1);

    const repeatedState = sailingState();
    const repeated = prepareSeaHazard({
      state: repeatedState,
      stepId: "storm-step",
      seed: found.seed,
      zoneId: "southreachDeep",
      depth: "deep",
      timeStep: 300,
      weather: WeatherType.Storm,
      routeSafety: "dangerous",
    });
    expect(repeated).toEqual(found.pending);

    found.pending.naturalRoll = 1;
    const traveler = { hp: 5, maxHp: 20, stats: TEST_STATS };
    const first = resolvePendingSeaHazard(
      found.state,
      traveler,
      found.pending.instanceId,
    );
    expect(first.ok).toBe(true);
    expect(first.check?.success).toBe(false);
    expect(traveler.hp).toBe(1);
    expect(first.conditionLost).toBeGreaterThan(0);

    const hpAfter = traveler.hp;
    const conditionAfter = found.state.ownedBoats[0].condition;
    const second = resolvePendingSeaHazard(
      found.state,
      traveler,
      found.pending.instanceId,
    );
    expect(second.idempotent).toBe(true);
    expect(traveler.hp).toBe(hpAfter);
    expect(found.state.ownedBoats[0].condition).toBe(conditionAfter);
    expect(found.state.stats.hazardsFaced).toBe(1);
    expect(prepareSeaHazard({
      state: found.state,
      stepId: "storm-step",
      seed: found.seed,
      zoneId: "southreachDeep",
      depth: "deep",
      timeStep: 300,
      weather: WeatherType.Storm,
      routeSafety: "dangerous",
    })).toBeNull();
    expect(found.state.stats.seaSteps).toBe(1);
  });

  it("uses stable zone-qualified fog keys and rejects invalid coordinates", () => {
    expect(seaFogKey("covenantStrait", 4, 2, 6, 1)).toBe(
      "s:covenantStrait,4,2,6,1",
    );
    expect(() => seaFogKey(
      "covenantStrait",
      WORLD_WIDTH,
      0,
      0,
      0,
    )).toThrow();
    expect(() => seaFogKey(
      "covenantStrait",
      0,
      0,
      MAP_WIDTH,
      MAP_HEIGHT,
    )).toThrow();
  });
});
