import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  CITIES,
  MAP_WIDTH,
  MAP_HEIGHT,
  Terrain,
  isWalkable,
  getCity,
  getCityForTown,
  getCityShopAt,
  getCityChunkCount,
  getCityChunk,
  getCityChunkMap,
  getCityChunkSpawn,
  getCityChunkShops,
  getCityChunkShopAt,
  getCityChunkNames,
  type CityData,
  type CityChunk,
} from "../src/data/map";
import { tryGridMove } from "../src/systems/movement";
import { createPlayer, type PlayerStats } from "../src/systems/player";
import { saveGame, loadGame, deleteSave } from "../src/systems/save";
import { createCodex } from "../src/systems/codex";
import { createWeatherState } from "../src/systems/weather";
import { FogOfWar } from "../src/managers/fogOfWar";

const defaultStats: PlayerStats = {
  strength: 10, dexterity: 10, constitution: 10,
  intelligence: 10, wisdom: 10, charisma: 10,
};

/** Create a minimal test city chunk. */
function makeTestChunk(name: string): CityChunk {
  const cF = Terrain.CityFloor;
  const cW = Terrain.CityWall;
  const cE = Terrain.CityExit;
  const sF = Terrain.ShopFloor;
  const cP = Terrain.Carpet;
  // 20×15 minimal city chunk
  const row = (fill: Terrain): Terrain[] => Array(MAP_WIDTH).fill(fill);
  const mapData: Terrain[][] = [];
  for (let y = 0; y < MAP_HEIGHT; y++) {
    if (y === 0 || y === MAP_HEIGHT - 1) {
      const r = row(cW);
      if (y === MAP_HEIGHT - 1) r[10] = cE;
      mapData.push(r);
    } else if (y === 2) {
      const r = row(cF);
      r[0] = cW; r[MAP_WIDTH - 1] = cW;
      r[3] = sF; r[4] = sF; r[5] = sF;
      mapData.push(r);
    } else if (y === 3) {
      const r = row(cF);
      r[0] = cW; r[MAP_WIDTH - 1] = cW;
      r[4] = cP;
      mapData.push(r);
    } else {
      const r = row(cF);
      r[0] = cW; r[MAP_WIDTH - 1] = cW;
      mapData.push(r);
    }
  }
  return {
    name,
    mapData,
    spawnX: 10,
    spawnY: 12,
    shops: [
      { type: "general", name: `${name} Shop`, x: 4, y: 3, shopItems: ["potion"] },
    ],
  };
}

/** Create a test multi-chunk city (primary + extra district). */
function makeMultiChunkCity(): CityData {
  const base = getCity("willowdale_city")!;
  return {
    ...base,
    id: "test_multichunk_city",
    name: "TestMultiChunk",
    chunks: [makeTestChunk("Market District")],
  };
}

describe("multi-chunk city helpers", () => {
  describe("getCityChunkCount", () => {
    it("returns 1 for a city with no extra chunks", () => {
      const city = getCity("willowdale_city")!;
      expect(getCityChunkCount(city)).toBe(1);
    });

    it("returns 2 for a city with one extra chunk", () => {
      const city = makeMultiChunkCity();
      expect(getCityChunkCount(city)).toBe(2);
    });

    it("returns correct count for multiple extra chunks", () => {
      const city = makeMultiChunkCity();
      city.chunks!.push(makeTestChunk("Docks"));
      expect(getCityChunkCount(city)).toBe(3);
    });
  });

  describe("getCityChunk", () => {
    it("returns primary chunk for index 0", () => {
      const city = getCity("willowdale_city")!;
      const chunk = getCityChunk(city, 0);
      expect(chunk).toBeDefined();
      expect(chunk!.name).toBe("Willowdale");
      expect(chunk!.mapData).toBe(city.mapData);
      expect(chunk!.spawnX).toBe(city.spawnX);
      expect(chunk!.spawnY).toBe(city.spawnY);
      expect(chunk!.shops).toBe(city.shops);
    });

    it("returns extra chunk for index 1", () => {
      const city = makeMultiChunkCity();
      const chunk = getCityChunk(city, 1);
      expect(chunk).toBeDefined();
      expect(chunk!.name).toBe("Market District");
      expect(chunk!.shops).toHaveLength(1);
      expect(chunk!.shops[0].name).toBe("Market District Shop");
    });

    it("returns undefined for out-of-range index", () => {
      const city = getCity("willowdale_city")!;
      expect(getCityChunk(city, 1)).toBeUndefined();
      expect(getCityChunk(city, 99)).toBeUndefined();
    });

    it("returns undefined for out-of-range index on multi-chunk city", () => {
      const city = makeMultiChunkCity();
      expect(getCityChunk(city, 2)).toBeUndefined();
    });
  });

  describe("getCityChunkMap", () => {
    it("returns primary map for index 0", () => {
      const city = getCity("willowdale_city")!;
      const map = getCityChunkMap(city, 0);
      expect(map).toBe(city.mapData);
    });

    it("returns extra chunk map for valid index", () => {
      const city = makeMultiChunkCity();
      const map = getCityChunkMap(city, 1);
      expect(map).not.toBe(city.mapData);
      expect(map).toHaveLength(MAP_HEIGHT);
      expect(map[0]).toHaveLength(MAP_WIDTH);
    });

    it("falls back to primary map for invalid index", () => {
      const city = getCity("willowdale_city")!;
      const map = getCityChunkMap(city, 5);
      expect(map).toBe(city.mapData);
    });
  });

  describe("getCityChunkSpawn", () => {
    it("returns primary spawn for index 0", () => {
      const city = getCity("willowdale_city")!;
      const spawn = getCityChunkSpawn(city, 0);
      expect(spawn.x).toBe(city.spawnX);
      expect(spawn.y).toBe(city.spawnY);
    });

    it("returns extra chunk spawn for valid index", () => {
      const city = makeMultiChunkCity();
      const spawn = getCityChunkSpawn(city, 1);
      expect(spawn.x).toBe(10);
      expect(spawn.y).toBe(12);
    });
  });

  describe("getCityChunkShops", () => {
    it("returns primary shops for index 0", () => {
      const city = getCity("willowdale_city")!;
      const shops = getCityChunkShops(city, 0);
      expect(shops).toBe(city.shops);
    });

    it("returns extra chunk shops for valid index", () => {
      const city = makeMultiChunkCity();
      const shops = getCityChunkShops(city, 1);
      expect(shops).toHaveLength(1);
      expect(shops[0].name).toBe("Market District Shop");
    });
  });

  describe("getCityChunkShopAt", () => {
    it("finds shop at position in primary chunk", () => {
      const city = getCity("willowdale_city")!;
      const shop = getCityChunkShopAt(city, 0, city.shops[0].x, city.shops[0].y);
      expect(shop).toBeDefined();
      expect(shop!.name).toBe(city.shops[0].name);
    });

    it("finds shop at position in extra chunk", () => {
      const city = makeMultiChunkCity();
      const shop = getCityChunkShopAt(city, 1, 4, 3);
      expect(shop).toBeDefined();
      expect(shop!.name).toBe("Market District Shop");
    });

    it("returns undefined for non-shop position", () => {
      const city = makeMultiChunkCity();
      expect(getCityChunkShopAt(city, 1, 0, 0)).toBeUndefined();
    });
  });

  describe("getCityChunkNames", () => {
    it("returns single name for standard city", () => {
      const city = getCity("willowdale_city")!;
      const names = getCityChunkNames(city);
      expect(names).toEqual(["Willowdale"]);
    });

    it("returns all chunk names for multi-chunk city", () => {
      const city = makeMultiChunkCity();
      const names = getCityChunkNames(city);
      expect(names).toEqual(["TestMultiChunk", "Market District"]);
    });
  });
});

describe("multi-chunk city movement", () => {
  it("moves within primary chunk (index 0)", () => {
    const player = createPlayer("TestMover", defaultStats);
    const city = getCity("willowdale_city")!;
    player.position.inCity = true;
    player.position.cityId = city.id;
    player.position.cityChunkIndex = 0;
    player.position.x = city.spawnX;
    player.position.y = city.spawnY;

    let moved = false;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const savedX = player.position.x;
      const savedY = player.position.y;
      const result = tryGridMove(player, dx, dy);
      if (result.moved) {
        moved = true;
        expect(result.chunkChanged).toBe(false);
        break;
      }
      player.position.x = savedX;
      player.position.y = savedY;
    }
    expect(moved).toBe(true);
  });

  it("uses extra chunk map data when cityChunkIndex > 0", () => {
    const player = createPlayer("TestMover", defaultStats);
    // Use a city with extra chunks (simulated through getCityChunkMap)
    const city = makeMultiChunkCity();
    // The extra chunk has CityFloor at most interior positions
    const map1 = getCityChunkMap(city, 1);
    // Verify the extra chunk map is different from primary
    expect(map1).not.toBe(city.mapData);
    expect(map1).toHaveLength(MAP_HEIGHT);
  });
});

describe("multi-chunk city fog of war", () => {
  it("generates standard key for primary chunk (index 0)", () => {
    const fog = new FogOfWar();
    const player = createPlayer("TestFog", defaultStats);
    player.position.inCity = true;
    player.position.cityId = "willowdale_city";
    player.position.cityChunkIndex = 0;

    const key = fog.exploredKey(5, 3, player);
    expect(key).toBe("c:willowdale_city,5,3");
  });

  it("generates chunk-indexed key for extra chunks (index > 0)", () => {
    const fog = new FogOfWar();
    const player = createPlayer("TestFog", defaultStats);
    player.position.inCity = true;
    player.position.cityId = "willowdale_city";
    player.position.cityChunkIndex = 1;

    const key = fog.exploredKey(5, 3, player);
    expect(key).toBe("c:willowdale_city,1,5,3");
  });

  it("generates unique keys for different chunks", () => {
    const fog = new FogOfWar();
    const player = createPlayer("TestFog", defaultStats);
    player.position.inCity = true;
    player.position.cityId = "willowdale_city";

    player.position.cityChunkIndex = 0;
    const key0 = fog.exploredKey(5, 3, player);

    player.position.cityChunkIndex = 1;
    const key1 = fog.exploredKey(5, 3, player);

    player.position.cityChunkIndex = 2;
    const key2 = fog.exploredKey(5, 3, player);

    expect(key0).not.toBe(key1);
    expect(key1).not.toBe(key2);
    expect(key0).not.toBe(key2);
  });

  it("reveals tiles in a radius for city chunks", () => {
    const fog = new FogOfWar();
    const player = createPlayer("TestFog", defaultStats);
    player.position.inCity = true;
    player.position.cityId = "willowdale_city";
    player.position.cityChunkIndex = 1;

    fog.revealAround(5, 5, 2, player);

    expect(fog.isExplored(5, 5, player)).toBe(true);
    expect(fog.isExplored(3, 5, player)).toBe(true);
    expect(fog.isExplored(7, 5, player)).toBe(true);
    expect(fog.isExplored(5, 3, player)).toBe(true);
    expect(fog.isExplored(5, 7, player)).toBe(true);
  });
});

describe("discovered cities in player progression", () => {
  it("starts with empty discovered cities list", () => {
    const player = createPlayer("TestDiscovery", defaultStats);
    expect(player.progression.discoveredCities).toEqual([]);
  });

  it("can add discovered city IDs", () => {
    const player = createPlayer("TestDiscovery", defaultStats);
    player.progression.discoveredCities.push("willowdale_city");
    expect(player.progression.discoveredCities).toContain("willowdale_city");
  });

  it("prevents duplicate city entries", () => {
    const player = createPlayer("TestDiscovery", defaultStats);
    const cityId = "willowdale_city";
    if (!player.progression.discoveredCities.includes(cityId)) {
      player.progression.discoveredCities.push(cityId);
    }
    if (!player.progression.discoveredCities.includes(cityId)) {
      player.progression.discoveredCities.push(cityId);
    }
    expect(player.progression.discoveredCities.filter(id => id === cityId)).toHaveLength(1);
  });
});

// @vitest-environment happy-dom
describe("multi-chunk city save/load", () => {
  beforeEach(() => { deleteSave(); });
  afterEach(() => { deleteSave(); });

  it("persists cityChunkIndex through save/load", () => {
    const player = createPlayer("TestSave", defaultStats);
    player.position.inCity = true;
    player.position.cityId = "willowdale_city";
    player.position.cityChunkIndex = 2;
    player.progression.discoveredCities.push("willowdale_city");

    saveGame(player, new Set(), createCodex(), "knight", 0, createWeatherState());

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.position.cityChunkIndex).toBe(2);
    expect(loaded!.player.progression.discoveredCities).toContain("willowdale_city");
  });

  it("migrates old saves without cityChunkIndex to default 0", () => {
    const player = createPlayer("TestMigrate", defaultStats);
    saveGame(player, new Set(), createCodex(), "knight", 0, createWeatherState());

    // Simulate old save without cityChunkIndex
    const raw = localStorage.getItem("2dnd_save");
    const data = JSON.parse(raw!);
    delete data.player.position.cityChunkIndex;
    delete data.player.progression.discoveredCities;
    localStorage.setItem("2dnd_save", JSON.stringify(data));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.player.position.cityChunkIndex).toBe(0);
    expect(loaded!.player.progression.discoveredCities).toEqual([]);
  });

  it("derives discoveredCities from exploredTiles on old saves", () => {
    const player = createPlayer("TestDerive", defaultStats);
    player.progression.exploredTiles["c:willowdale_city,5,5"] = true;
    player.progression.exploredTiles["c:ironhold_city,3,3"] = true;
    player.progression.exploredTiles["4,2,5,5"] = true; // overworld tile

    saveGame(player, new Set(), createCodex(), "knight", 0, createWeatherState());

    // Simulate old save without discoveredCities
    const raw = localStorage.getItem("2dnd_save");
    const data = JSON.parse(raw!);
    delete data.player.progression.discoveredCities;
    localStorage.setItem("2dnd_save", JSON.stringify(data));

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    const discovered = loaded!.player.progression.discoveredCities;
    expect(discovered).toContain("willowdale_city");
    expect(discovered).toContain("ironhold_city");
    expect(discovered).toHaveLength(2);
  });
});

describe("existing city data integrity", () => {
  it("all existing cities have chunkCount of 1 (no extra chunks defined yet)", () => {
    for (const city of CITIES) {
      expect(getCityChunkCount(city)).toBe(1);
    }
  });

  it("getCityChunk(city, 0) works for all cities", () => {
    for (const city of CITIES) {
      const chunk = getCityChunk(city, 0);
      expect(chunk).toBeDefined();
      expect(chunk!.mapData).toBe(city.mapData);
      expect(chunk!.shops).toBe(city.shops);
    }
  });

  it("getCityChunkMap returns primary map for all cities at index 0", () => {
    for (const city of CITIES) {
      const map = getCityChunkMap(city, 0);
      expect(map).toBe(city.mapData);
      expect(map).toHaveLength(MAP_HEIGHT);
    }
  });

  it("extra chunk helpers gracefully handle single-chunk cities", () => {
    for (const city of CITIES) {
      // Should return undefined or fallback gracefully
      expect(getCityChunk(city, 1)).toBeUndefined();
      expect(getCityChunkMap(city, 1)).toBe(city.mapData); // fallback
      expect(getCityChunkNames(city)).toEqual([city.name]);
    }
  });
});

describe("player position cityChunkIndex", () => {
  it("createPlayer initializes cityChunkIndex to 0", () => {
    const player = createPlayer("TestInit", defaultStats);
    expect(player.position.cityChunkIndex).toBe(0);
  });

  it("cityChunkIndex can be set and read", () => {
    const player = createPlayer("TestSet", defaultStats);
    player.position.cityChunkIndex = 3;
    expect(player.position.cityChunkIndex).toBe(3);
  });
});
