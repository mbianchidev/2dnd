import { describe, it, expect } from "vitest";
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_CHUNKS,
  Terrain,
  isWalkable,
  getTerrainAt,
  getChunk,
  getAllTowns,
  getAllBosses,
  ENCOUNTER_RATES,
  DUNGEONS,
  getDungeonAt,
  getDungeon,
  getDungeonLevelMap,
  getDungeonLevelSpawn,
  getDungeonTotalLevels,
  CHESTS,
  getChestAt,
  CITIES,
  getCity,
  getCityForTown,
  getCityShopAt,
} from "../src/data/map";
import { MONSTERS, getRandomEncounter, getBoss, getMonster, DUNGEON_MONSTERS, getDungeonEncounter, DUNGEON_MONSTER_POOLS, HEARTLANDS_CRYPT_MONSTERS, FROST_CAVERN_MONSTERS, VOLCANIC_FORGE_MONSTERS, NIGHT_MONSTERS, getNightEncounter, TUNDRA_NIGHT_MONSTERS, SWAMP_NIGHT_MONSTERS, FOREST_NIGHT_MONSTERS, CANYON_NIGHT_MONSTERS, DUNGEON_BOSSES, DUNGEON_BOSS_MAP, getDungeonBoss } from "../src/data/monsters";
import { SPELLS, getSpell, getAvailableSpells } from "../src/data/spells";
import { ITEMS, getItem, getShopItems, getShopItemsForTown } from "../src/data/items";
import { ABILITIES, getAbility } from "../src/data/abilities";
import { PLAYER_CLASSES, getPlayerClass, CASTER_CLASSES } from "../src/systems/classes";

describe("game data", () => {
  describe("world map", () => {
    it("has correct world dimensions", () => {
      expect(WORLD_CHUNKS).toHaveLength(WORLD_HEIGHT);
      for (const row of WORLD_CHUNKS) {
        expect(row).toHaveLength(WORLD_WIDTH);
      }
    });

    it("each chunk has correct tile dimensions", () => {
      for (let cy = 0; cy < WORLD_HEIGHT; cy++) {
        for (let cx = 0; cx < WORLD_WIDTH; cx++) {
          const chunk = getChunk(cx, cy);
          expect(chunk).toBeDefined();
          expect(chunk!.mapData).toHaveLength(MAP_HEIGHT);
          for (const row of chunk!.mapData) {
            expect(row).toHaveLength(MAP_WIDTH);
          }
        }
      }
    });

    it("has walkable town tiles in their chunks", () => {
      const towns = getAllTowns();
      expect(towns.length).toBeGreaterThanOrEqual(12);
      for (const town of towns) {
        const terrain = getTerrainAt(town.chunkX, town.chunkY, town.x, town.y);
        expect(terrain).toBe(Terrain.Town);
        expect(isWalkable(Terrain.Town)).toBe(true);
      }
    });

    it("has boss tiles at boss locations", () => {
      const bosses = getAllBosses();
      expect(bosses.length).toBeGreaterThanOrEqual(6);
      for (const boss of bosses) {
        const terrain = getTerrainAt(boss.chunkX, boss.chunkY, boss.x, boss.y);
        expect(terrain).toBe(Terrain.Boss);
      }
    });

    it("towns are spread across different chunks", () => {
      const towns = getAllTowns();
      const chunkKeys = new Set(towns.map((t) => `${t.chunkX},${t.chunkY}`));
      expect(chunkKeys.size).toBeGreaterThanOrEqual(3);
    });

    it("returns undefined for out of bounds", () => {
      // Chunk out of bounds
      expect(getTerrainAt(-1, 0, 0, 0)).toBeUndefined();
      expect(getTerrainAt(0, -1, 0, 0)).toBeUndefined();
      expect(getTerrainAt(WORLD_WIDTH, 0, 0, 0)).toBeUndefined();
      expect(getTerrainAt(0, WORLD_HEIGHT, 0, 0)).toBeUndefined();
      // Tile out of bounds within valid chunk
      expect(getTerrainAt(1, 1, -1, 0)).toBeUndefined();
      expect(getTerrainAt(1, 1, 0, -1)).toBeUndefined();
      expect(getTerrainAt(1, 1, MAP_WIDTH, 0)).toBeUndefined();
      expect(getTerrainAt(1, 1, 0, MAP_HEIGHT)).toBeUndefined();
    });

    it("water, mountain, and volcanic are not walkable", () => {
      expect(isWalkable(Terrain.Water)).toBe(false);
      expect(isWalkable(Terrain.Mountain)).toBe(false);
      expect(isWalkable(Terrain.DungeonWall)).toBe(false);
      expect(isWalkable(Terrain.Volcanic)).toBe(false);
    });

    it("towns have no random encounters", () => {
      expect(ENCOUNTER_RATES[Terrain.Town]).toBe(0);
      expect(ENCOUNTER_RATES[Terrain.Water]).toBe(0);
    });

    it("adjacent chunks have matching walkable exits", () => {
      // Check east-west connectivity
      for (let cy = 0; cy < WORLD_HEIGHT; cy++) {
        for (let cx = 0; cx < WORLD_WIDTH - 1; cx++) {
          const east = getChunk(cx, cy)!;
          const west = getChunk(cx + 1, cy)!;
          // At least one row in 5-9 should be walkable on both sides
          let connected = false;
          for (let r = 5; r <= 9; r++) {
            const eTerrain = east.mapData[r][MAP_WIDTH - 1];
            const wTerrain = west.mapData[r][0];
            if (isWalkable(eTerrain) && isWalkable(wTerrain)) {
              connected = true;
              break;
            }
          }
          expect(connected).toBe(true);
        }
      }
      // Check north-south connectivity
      for (let cy = 0; cy < WORLD_HEIGHT - 1; cy++) {
        for (let cx = 0; cx < WORLD_WIDTH; cx++) {
          const south = getChunk(cx, cy)!;
          const north = getChunk(cx, cy + 1)!;
          let connected = false;
          for (let c = 8; c <= 11; c++) {
            const sTerrain = south.mapData[MAP_HEIGHT - 1][c];
            const nTerrain = north.mapData[0][c];
            if (isWalkable(sTerrain) && isWalkable(nTerrain)) {
              connected = true;
              break;
            }
          }
          expect(connected).toBe(true);
        }
      }
    });
  });

  describe("monsters", () => {
    it("has both bosses and non-bosses", () => {
      const bosses = MONSTERS.filter((m) => m.isBoss);
      const nonBosses = MONSTERS.filter((m) => !m.isBoss);
      expect(bosses.length).toBeGreaterThan(0);
      expect(nonBosses.length).toBeGreaterThan(0);
    });

    it("getRandomEncounter returns a non-boss", () => {
      for (let i = 0; i < 20; i++) {
        const monster = getRandomEncounter(1);
        expect(monster.isBoss).toBe(false);
        expect(monster.hp).toBeGreaterThan(0);
      }
    });

    it("getRandomEncounter returns a copy", () => {
      const m1 = getRandomEncounter(1);
      const m2 = getRandomEncounter(1);
      m1.hp = 0;
      expect(m2.hp).toBeGreaterThan(0);
    });

    it("getBoss returns boss by ID", () => {
      const troll = getBoss("troll");
      expect(troll).toBeDefined();
      expect(troll!.name).toBe("Cave Troll");
      expect(troll!.isBoss).toBe(true);
    });

    it("getBoss returns undefined for non-boss ID", () => {
      expect(getBoss("slime")).toBeUndefined();
      expect(getBoss("nonexistent")).toBeUndefined();
    });

    it("getMonster returns any monster by ID (O(1) lookup)", () => {
      const slime = getMonster("slime");
      expect(slime).toBeDefined();
      expect(slime!.name).toBe("Slime");
      expect(slime!.isBoss).toBe(false);

      const dragon = getMonster("dragon");
      expect(dragon).toBeDefined();
      expect(dragon!.name).toBe("Young Red Dragon");
      expect(dragon!.isBoss).toBe(true);
    });

    it("getMonster returns dungeon and night monsters", () => {
      expect(getMonster("stoneGolem")).toBeDefined();
      expect(getMonster("nightWolf")).toBeDefined();
      expect(getMonster("frostWraith")).toBeDefined();
    });

    it("getMonster returns undefined for non-existent ID", () => {
      expect(getMonster("nonexistent")).toBeUndefined();
    });

    it("getMonster returns a copy", () => {
      const m1 = getMonster("slime");
      const m2 = getMonster("slime");
      expect(m1).toEqual(m2);
      expect(m1).not.toBe(m2);
    });
  });

  describe("spells", () => {
    it("has spells at various level requirements", () => {
      const levels = new Set(SPELLS.map((s) => s.levelRequired));
      expect(levels.size).toBeGreaterThan(3);
    });

    it("getSpell looks up by ID", () => {
      const fb = getSpell("fireBolt");
      expect(fb).toBeDefined();
      expect(fb!.name).toBe("Fire Bolt");
    });

    it("getAvailableSpells filters by level", () => {
      const level1 = getAvailableSpells(1);
      const level5 = getAvailableSpells(5);
      expect(level5.length).toBeGreaterThan(level1.length);
    });

    it("has both damage and heal spells", () => {
      const types = new Set(SPELLS.map((s) => s.type));
      expect(types.has("damage")).toBe(true);
      expect(types.has("heal")).toBe(true);
    });

    it("has class-specific spells", () => {
      // Warlock-specific spells
      expect(getSpell("eldritchBlast")).toBeDefined();
      expect(getSpell("hexCurse")).toBeDefined();
      expect(getSpell("hungerOfHadar")).toBeDefined();
      // Cleric-specific spells
      expect(getSpell("sacredFlame")).toBeDefined();
      expect(getSpell("spiritGuardians")).toBeDefined();
      // Wizard-specific spells
      expect(getSpell("disintegrate")).toBeDefined();
    });

    it("each spell has a unique ID", () => {
      const ids = SPELLS.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("items", () => {
    it("has consumables, weapons, and armor", () => {
      const types = new Set(ITEMS.map((i) => i.type));
      expect(types.has("consumable")).toBe(true);
      expect(types.has("weapon")).toBe(true);
      expect(types.has("armor")).toBe(true);
    });

    it("getItem looks up by ID", () => {
      const potion = getItem("potion");
      expect(potion).toBeDefined();
      expect(potion!.name).toBe("Healing Potion");
    });

    it("getShopItems returns purchasable items", () => {
      const shopItems = getShopItems();
      expect(shopItems.length).toBeGreaterThan(0);
      for (const item of shopItems) {
        expect(item.cost).toBeGreaterThan(0);
      }
    });

    it("getShopItemsForTown returns town-specific items", () => {
      const willowdaleItems = getShopItemsForTown(["potion", "ether", "shortSword", "leatherArmor"]);
      expect(willowdaleItems).toHaveLength(4);
      expect(willowdaleItems.map((i) => i.id)).toContain("potion");
      expect(willowdaleItems.map((i) => i.id)).toContain("shortSword");
    });

    it("different towns have different shop inventories", () => {
      const towns = getAllTowns();
      const inventories = towns.map((t) => t.shopItems.sort().join(","));
      const unique = new Set(inventories);
      expect(unique.size).toBeGreaterThanOrEqual(3);
    });

    it("all town shop item IDs resolve to real items", () => {
      const towns = getAllTowns();
      for (const town of towns) {
        for (const itemId of town.shopItems) {
          expect(getItem(itemId)).toBeDefined();
        }
      }
    });

    it("dungeon key is sold only in starting area (Willowdale)", () => {
      const towns = getAllTowns();
      const townsWithKey = towns.filter((t) => t.shopItems.includes("dungeonKey"));
      expect(townsWithKey).toHaveLength(1);
      expect(townsWithKey[0].name).toBe("Willowdale");
      expect(townsWithKey[0].chunkX).toBe(4);
      expect(townsWithKey[0].chunkY).toBe(2);
    });
  });

  describe("dungeons", () => {
    it("has at least one dungeon defined", () => {
      expect(DUNGEONS.length).toBeGreaterThanOrEqual(1);
    });

    it("dungeon maps have correct dimensions", () => {
      for (const dungeon of DUNGEONS) {
        expect(dungeon.mapData).toHaveLength(MAP_HEIGHT);
        for (const row of dungeon.mapData) {
          expect(row).toHaveLength(MAP_WIDTH);
        }
      }
    });

    it("dungeon entrance exists on the overworld", () => {
      for (const dungeon of DUNGEONS) {
        const terrain = getTerrainAt(
          dungeon.entranceChunkX,
          dungeon.entranceChunkY,
          dungeon.entranceTileX,
          dungeon.entranceTileY
        );
        expect(terrain).toBe(Terrain.Dungeon);
      }
    });

    it("dungeon spawn point is walkable", () => {
      for (const dungeon of DUNGEONS) {
        const terrain = dungeon.mapData[dungeon.spawnY][dungeon.spawnX];
        expect(isWalkable(terrain)).toBe(true);
      }
    });

    it("dungeon has at least one exit tile", () => {
      for (const dungeon of DUNGEONS) {
        let hasExit = false;
        for (const row of dungeon.mapData) {
          if (row.includes(Terrain.DungeonExit)) {
            hasExit = true;
            break;
          }
        }
        expect(hasExit).toBe(true);
      }
    });

    it("getDungeonAt returns dungeon for valid entrance", () => {
      const dungeon = DUNGEONS[0];
      const found = getDungeonAt(
        dungeon.entranceChunkX,
        dungeon.entranceChunkY,
        dungeon.entranceTileX,
        dungeon.entranceTileY
      );
      expect(found).toBeDefined();
      expect(found!.id).toBe(dungeon.id);
    });

    it("getDungeon returns dungeon by ID", () => {
      const dungeon = getDungeon("heartlands_dungeon");
      expect(dungeon).toBeDefined();
      expect(dungeon!.name).toBe("Heartlands Crypt");
    });

    it("getDungeonAt returns undefined for non-dungeon tiles", () => {
      expect(getDungeonAt(0, 0, 0, 0)).toBeUndefined();
    });

    it("dungeon walls are not walkable, floors and exit are", () => {
      expect(isWalkable(Terrain.DungeonWall)).toBe(false);
      expect(isWalkable(Terrain.DungeonFloor)).toBe(true);
      expect(isWalkable(Terrain.DungeonExit)).toBe(true);
    });

    it("DungeonStairs and DungeonBoss terrains are walkable", () => {
      expect(isWalkable(Terrain.DungeonStairs)).toBe(true);
      expect(isWalkable(Terrain.DungeonBoss)).toBe(true);
    });

    it("DungeonStairs and DungeonBoss have zero encounter rate", () => {
      expect(ENCOUNTER_RATES[Terrain.DungeonStairs]).toBe(0);
      expect(ENCOUNTER_RATES[Terrain.DungeonBoss]).toBe(0);
    });
  });

  describe("multi-level dungeons", () => {
    it("each dungeon has at least 2 levels", () => {
      for (const dungeon of DUNGEONS) {
        const totalLevels = getDungeonTotalLevels(dungeon);
        expect(totalLevels).toBeGreaterThanOrEqual(2);
      }
    });

    it("each dungeon level has correct map dimensions", () => {
      for (const dungeon of DUNGEONS) {
        const totalLevels = getDungeonTotalLevels(dungeon);
        for (let lvl = 0; lvl < totalLevels; lvl++) {
          const map = getDungeonLevelMap(dungeon, lvl);
          expect(map).toHaveLength(MAP_HEIGHT);
          for (const row of map) {
            expect(row).toHaveLength(MAP_WIDTH);
          }
        }
      }
    });

    it("getDungeonLevelMap returns correct level data", () => {
      for (const dungeon of DUNGEONS) {
        // Level 0 should return mapData
        expect(getDungeonLevelMap(dungeon, 0)).toBe(dungeon.mapData);
        // Level 1 should return levels[0].mapData
        if (dungeon.levels && dungeon.levels.length > 0) {
          expect(getDungeonLevelMap(dungeon, 1)).toBe(dungeon.levels[0].mapData);
        }
      }
    });

    it("getDungeonLevelMap falls back to level 0 for invalid level", () => {
      const dungeon = DUNGEONS[0];
      expect(getDungeonLevelMap(dungeon, 999)).toBe(dungeon.mapData);
    });

    it("getDungeonLevelSpawn returns correct spawn per level", () => {
      for (const dungeon of DUNGEONS) {
        const spawn0 = getDungeonLevelSpawn(dungeon, 0);
        expect(spawn0.x).toBe(dungeon.spawnX);
        expect(spawn0.y).toBe(dungeon.spawnY);
        if (dungeon.levels && dungeon.levels.length > 0) {
          const spawn1 = getDungeonLevelSpawn(dungeon, 1);
          expect(spawn1.x).toBe(dungeon.levels[0].spawnX);
          expect(spawn1.y).toBe(dungeon.levels[0].spawnY);
        }
      }
    });

    it("each dungeon level spawn point is walkable", () => {
      for (const dungeon of DUNGEONS) {
        const totalLevels = getDungeonTotalLevels(dungeon);
        for (let lvl = 0; lvl < totalLevels; lvl++) {
          const map = getDungeonLevelMap(dungeon, lvl);
          const spawn = getDungeonLevelSpawn(dungeon, lvl);
          const terrain = map[spawn.y][spawn.x];
          expect(isWalkable(terrain)).toBe(true);
        }
      }
    });

    it("level 0 has stairs tile connecting to deeper level", () => {
      for (const dungeon of DUNGEONS) {
        if (!dungeon.levels || dungeon.levels.length === 0) continue;
        let hasStairs = false;
        for (const row of dungeon.mapData) {
          if (row.includes(Terrain.DungeonStairs)) {
            hasStairs = true;
            break;
          }
        }
        expect(hasStairs).toBe(true);
      }
    });

    it("deepest level has a DungeonBoss tile", () => {
      for (const dungeon of DUNGEONS) {
        const totalLevels = getDungeonTotalLevels(dungeon);
        const deepestMap = getDungeonLevelMap(dungeon, totalLevels - 1);
        let hasBoss = false;
        for (const row of deepestMap) {
          if (row.includes(Terrain.DungeonBoss)) {
            hasBoss = true;
            break;
          }
        }
        expect(hasBoss).toBe(true);
      }
    });

    it("deepest level has stairs back (exit tile or stairs)", () => {
      for (const dungeon of DUNGEONS) {
        const totalLevels = getDungeonTotalLevels(dungeon);
        const deepestMap = getDungeonLevelMap(dungeon, totalLevels - 1);
        let hasExit = false;
        for (const row of deepestMap) {
          if (row.includes(Terrain.DungeonStairs) || row.includes(Terrain.DungeonExit)) {
            hasExit = true;
            break;
          }
        }
        expect(hasExit).toBe(true);
      }
    });
  });

  describe("unique dungeon bosses", () => {
    it("each dungeon has a bossId defined", () => {
      for (const dungeon of DUNGEONS) {
        expect(dungeon.bossId).toBeDefined();
        expect(dungeon.bossId!.length).toBeGreaterThan(0);
      }
    });

    it("each dungeon bossId maps to a valid boss monster", () => {
      for (const dungeon of DUNGEONS) {
        const boss = getDungeonBoss(dungeon.id);
        expect(boss).toBeDefined();
        expect(boss!.isBoss).toBe(true);
        expect(boss!.id).toBe(dungeon.bossId);
      }
    });

    it("each dungeon has a unique boss", () => {
      const bossIds = DUNGEONS.map((d) => d.bossId);
      expect(new Set(bossIds).size).toBe(bossIds.length);
    });

    it("dungeon bosses are distinct from overworld bosses", () => {
      const overworldBossIds = new Set(
        MONSTERS.filter((m) => m.isBoss).map((m) => m.id)
      );
      for (const boss of DUNGEON_BOSSES) {
        expect(overworldBossIds.has(boss.id)).toBe(false);
      }
    });

    it("DUNGEON_BOSSES array matches DUNGEON_BOSS_MAP", () => {
      const mapValues = Object.values(DUNGEON_BOSS_MAP);
      for (const bossId of mapValues) {
        expect(DUNGEON_BOSSES.some((b) => b.id === bossId)).toBe(true);
      }
    });

    it("getDungeonBoss returns a copy", () => {
      const b1 = getDungeonBoss("heartlands_dungeon");
      const b2 = getDungeonBoss("heartlands_dungeon");
      expect(b1).toEqual(b2);
      expect(b1).not.toBe(b2);
    });

    it("getDungeonBoss returns undefined for invalid dungeon", () => {
      expect(getDungeonBoss("nonexistent")).toBeUndefined();
    });

    it("dungeon bosses have abilities", () => {
      for (const boss of DUNGEON_BOSSES) {
        expect(boss.abilities).toBeDefined();
        expect(boss.abilities!.length).toBeGreaterThan(0);
      }
    });

    it("dungeon bosses have drops", () => {
      for (const boss of DUNGEON_BOSSES) {
        expect(boss.drops).toBeDefined();
        expect(boss.drops!.length).toBeGreaterThan(0);
      }
    });

    it("dungeon bosses are included in ALL_MONSTERS", () => {
      for (const boss of DUNGEON_BOSSES) {
        const found = getMonster(boss.id);
        expect(found).toBeDefined();
        expect(found!.isBoss).toBe(true);
      }
    });

    it("dungeon bosses can be looked up via getBoss", () => {
      for (const boss of DUNGEON_BOSSES) {
        const found = getBoss(boss.id);
        expect(found).toBeDefined();
        expect(found!.name).toBe(boss.name);
      }
    });
  });

  describe("dungeon monsters", () => {
    it("has dungeon-exclusive monsters", () => {
      expect(DUNGEON_MONSTERS.length).toBeGreaterThanOrEqual(3);
    });

    it("dungeon monsters are not bosses", () => {
      for (const m of DUNGEON_MONSTERS) {
        expect(m.isBoss).toBe(false);
      }
    });

    it("dungeon monsters are distinct from overworld monsters", () => {
      const overworldIds = new Set(MONSTERS.filter((m) => !m.isBoss).map((m) => m.id));
      for (const m of DUNGEON_MONSTERS) {
        expect(overworldIds.has(m.id)).toBe(false);
      }
    });

    it("getDungeonEncounter returns a non-boss monster copy", () => {
      for (let i = 0; i < 20; i++) {
        const m = getDungeonEncounter(5);
        expect(m.isBoss).toBe(false);
      }
    });

    it("getDungeonEncounter returns a copy", () => {
      const m1 = getDungeonEncounter(1);
      const m2 = getDungeonEncounter(1);
      m1.hp = 0;
      expect(m2.hp).toBeGreaterThan(0);
    });

    it("each dungeon has a unique monster pool", () => {
      expect(HEARTLANDS_CRYPT_MONSTERS.length).toBeGreaterThanOrEqual(2);
      expect(FROST_CAVERN_MONSTERS.length).toBeGreaterThanOrEqual(2);
      expect(VOLCANIC_FORGE_MONSTERS.length).toBeGreaterThanOrEqual(2);
    });

    it("dungeon-specific monsters have unique IDs", () => {
      const allIds = [
        ...HEARTLANDS_CRYPT_MONSTERS.map((m) => m.id),
        ...FROST_CAVERN_MONSTERS.map((m) => m.id),
        ...VOLCANIC_FORGE_MONSTERS.map((m) => m.id),
      ];
      expect(new Set(allIds).size).toBe(allIds.length);
    });

    it("dungeon-specific monsters are not bosses", () => {
      for (const m of [...HEARTLANDS_CRYPT_MONSTERS, ...FROST_CAVERN_MONSTERS, ...VOLCANIC_FORGE_MONSTERS]) {
        expect(m.isBoss).toBe(false);
      }
    });

    it("getDungeonEncounter with dungeonId uses correct pool", () => {
      for (let i = 0; i < 30; i++) {
        const m = getDungeonEncounter(10, "heartlands_dungeon");
        const pool = DUNGEON_MONSTER_POOLS["heartlands_dungeon"];
        expect(pool.some((dm) => dm.id === m.id)).toBe(true);
      }
    });

    it("getDungeonEncounter without dungeonId uses generic pool", () => {
      for (let i = 0; i < 20; i++) {
        const m = getDungeonEncounter(5);
        expect(DUNGEON_MONSTERS.some((dm) => dm.id === m.id)).toBe(true);
      }
    });
  });

  describe("night monsters", () => {
    it("has generic night monsters", () => {
      expect(NIGHT_MONSTERS.length).toBeGreaterThanOrEqual(3);
    });

    it("has biome-specific night monsters", () => {
      expect(TUNDRA_NIGHT_MONSTERS.length).toBeGreaterThanOrEqual(2);
      expect(SWAMP_NIGHT_MONSTERS.length).toBeGreaterThanOrEqual(2);
      expect(FOREST_NIGHT_MONSTERS.length).toBeGreaterThanOrEqual(2);
      expect(CANYON_NIGHT_MONSTERS.length).toBeGreaterThanOrEqual(2);
    });

    it("biome night monsters are not bosses", () => {
      for (const m of [...TUNDRA_NIGHT_MONSTERS, ...SWAMP_NIGHT_MONSTERS, ...FOREST_NIGHT_MONSTERS, ...CANYON_NIGHT_MONSTERS]) {
        expect(m.isBoss).toBe(false);
      }
    });

    it("getNightEncounter returns a non-boss copy", () => {
      for (let i = 0; i < 20; i++) {
        const m = getNightEncounter(5);
        expect(m.isBoss).toBe(false);
        expect(m.hp).toBeGreaterThan(0);
      }
    });

    it("getNightEncounter with tundra biome uses tundra pool", () => {
      for (let i = 0; i < 20; i++) {
        const m = getNightEncounter(10, "Frozen Expanse");
        expect(TUNDRA_NIGHT_MONSTERS.some((nm) => nm.id === m.id)).toBe(true);
      }
    });

    it("getNightEncounter with swamp biome uses swamp pool", () => {
      for (let i = 0; i < 20; i++) {
        const m = getNightEncounter(10, "Murky Wilds");
        expect(SWAMP_NIGHT_MONSTERS.some((nm) => nm.id === m.id)).toBe(true);
      }
    });

    it("getNightEncounter with unknown biome falls back to generic", () => {
      for (let i = 0; i < 20; i++) {
        const m = getNightEncounter(5, "Heartlands");
        expect(NIGHT_MONSTERS.some((nm) => nm.id === m.id)).toBe(true);
      }
    });
  });

  describe("treasure chests", () => {
    it("has at least one chest defined", () => {
      expect(CHESTS.length).toBeGreaterThan(0);
    });

    it("each chest has a unique ID", () => {
      const ids = CHESTS.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("each chest references a valid item", () => {
      for (const chest of CHESTS) {
        const item = getItem(chest.itemId);
        expect(item, `chest ${chest.id} references unknown item ${chest.itemId}`).toBeDefined();
      }
    });

    it("chest items are treasure-only (cost 0)", () => {
      for (const chest of CHESTS) {
        const item = getItem(chest.itemId);
        expect(item!.cost).toBe(0);
      }
    });

    it("chest tiles exist on appropriate maps", () => {
      for (const chest of CHESTS) {
        if (chest.location.type === "dungeon") {
          const dungeon = getDungeon(chest.location.dungeonId);
          expect(dungeon, `dungeon ${chest.location.dungeonId} not found`).toBeDefined();
          const terrain = dungeon!.mapData[chest.y][chest.x];
          expect(terrain).toBe(Terrain.Chest);
        } else {
          const chunk = getChunk(chest.location.chunkX, chest.location.chunkY);
          expect(chunk, `chunk ${chest.location.chunkX},${chest.location.chunkY} not found`).toBeDefined();
          const terrain = chunk!.mapData[chest.y][chest.x];
          expect(terrain).toBe(Terrain.Chest);
        }
      }
    });

    it("getChestAt returns chest for valid positions", () => {
      for (const chest of CHESTS) {
        const found = getChestAt(chest.x, chest.y, chest.location);
        expect(found).toBeDefined();
        expect(found!.id).toBe(chest.id);
      }
    });

    it("getChestAt returns undefined for invalid positions", () => {
      const result = getChestAt(0, 0, { type: "overworld", chunkX: 0, chunkY: 0 });
      expect(result).toBeUndefined();
    });

    it("Chest terrain is walkable", () => {
      expect(isWalkable(Terrain.Chest)).toBe(true);
    });

    it("Chest terrain has zero encounter rate", () => {
      expect(ENCOUNTER_RATES[Terrain.Chest]).toBe(0);
    });
  });

  describe("cities", () => {
    it("has at least one city defined", () => {
      expect(CITIES.length).toBeGreaterThanOrEqual(1);
    });

    it("city maps have correct dimensions", () => {
      for (const city of CITIES) {
        expect(city.mapData).toHaveLength(MAP_HEIGHT);
        for (const row of city.mapData) {
          expect(row).toHaveLength(MAP_WIDTH);
        }
      }
    });

    it("city spawn point is walkable", () => {
      for (const city of CITIES) {
        const terrain = city.mapData[city.spawnY][city.spawnX];
        expect(isWalkable(terrain)).toBe(true);
      }
    });

    it("city has at least one exit tile", () => {
      for (const city of CITIES) {
        let hasExit = false;
        for (const row of city.mapData) {
          if (row.includes(Terrain.CityExit)) {
            hasExit = true;
            break;
          }
        }
        expect(hasExit).toBe(true);
      }
    });

    it("city has at least one shop", () => {
      for (const city of CITIES) {
        expect(city.shops.length).toBeGreaterThanOrEqual(1);
      }
    });

    it("city shop locations are on walkable tiles", () => {
      for (const city of CITIES) {
        for (const shop of city.shops) {
          const terrain = city.mapData[shop.y][shop.x];
          expect(isWalkable(terrain), `shop ${shop.name} at (${shop.x},${shop.y}) in ${city.name} is on non-walkable tile`).toBe(true);
        }
      }
    });

    it("city shop item IDs resolve to real items", () => {
      for (const city of CITIES) {
        for (const shop of city.shops) {
          for (const itemId of shop.shopItems) {
            expect(getItem(itemId), `shop ${shop.name} references unknown item ${itemId}`).toBeDefined();
          }
        }
      }
    });

    it("getCity returns city by ID", () => {
      const city = getCity("willowdale_city");
      expect(city).toBeDefined();
      expect(city!.name).toBe("Willowdale");
    });

    it("getCity returns undefined for non-existent ID", () => {
      expect(getCity("nonexistent")).toBeUndefined();
    });

    it("getCityForTown returns city for valid town location", () => {
      const city = getCityForTown(4, 2, 2, 2);
      expect(city).toBeDefined();
      expect(city!.id).toBe("willowdale_city");
    });

    it("getCityForTown returns undefined for non-city towns", () => {
      expect(getCityForTown(0, 0, 0, 0)).toBeUndefined();
    });

    it("getCityShopAt returns shop for valid position", () => {
      const city = getCity("willowdale_city")!;
      const shop = getCityShopAt(city, city.shops[0].x, city.shops[0].y);
      expect(shop).toBeDefined();
      expect(shop!.name).toBe(city.shops[0].name);
    });

    it("getCityShopAt returns undefined for non-shop position", () => {
      const city = getCity("willowdale_city")!;
      expect(getCityShopAt(city, 0, 0)).toBeUndefined();
    });

    it("city terrain types have correct properties", () => {
      expect(isWalkable(Terrain.CityFloor)).toBe(true);
      expect(isWalkable(Terrain.CityExit)).toBe(true);
      expect(isWalkable(Terrain.CityWall)).toBe(false);
      expect(ENCOUNTER_RATES[Terrain.CityFloor]).toBe(0);
      expect(ENCOUNTER_RATES[Terrain.CityWall]).toBe(0);
      expect(ENCOUNTER_RATES[Terrain.CityExit]).toBe(0);
    });

    it("each city has a unique ID", () => {
      const ids = CITIES.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("cities correspond to existing town locations", () => {
      const towns = getAllTowns();
      for (const city of CITIES) {
        const town = towns.find(
          (t) => t.chunkX === city.chunkX && t.chunkY === city.chunkY && t.x === city.tileX && t.y === city.tileY
        );
        expect(town, `city ${city.name} has no matching town`).toBeDefined();
      }
    });
  });

  describe("class system", () => {
    it("has 12 distinct classes", () => {
      expect(PLAYER_CLASSES).toHaveLength(12);
      const ids = PLAYER_CLASSES.map((a) => a.id);
      expect(new Set(ids).size).toBe(12);
    });

    it("each class has description and playstyle", () => {
      for (const app of PLAYER_CLASSES) {
        expect(app.description.length).toBeGreaterThan(10);
        expect(app.playstyle.length).toBeGreaterThan(3);
      }
    });

    it("each class has a hit die between 6 and 12", () => {
      for (const app of PLAYER_CLASSES) {
        expect(app.hitDie).toBeGreaterThanOrEqual(6);
        expect(app.hitDie).toBeLessThanOrEqual(12);
      }
    });

    it("barbarian has the highest hit die (d12)", () => {
      const barbarian = getPlayerClass("barbarian");
      expect(barbarian.hitDie).toBe(12);
    });

    it("wizard has the lowest hit die (d6)", () => {
      const wizard = getPlayerClass("wizard");
      expect(wizard.hitDie).toBe(6);
    });

    it("each class has a weapon sprite type", () => {
      const weaponTypes = new Set(PLAYER_CLASSES.map((a) => a.weaponSprite));
      expect(weaponTypes.size).toBeGreaterThanOrEqual(4);
    });

    it("pure caster classes have no martial damage abilities (only utility)", () => {
      const pureCasters = CASTER_CLASSES.filter((id) => id !== "bard");
      for (const casterId of pureCasters) {
        const app = getPlayerClass(casterId);
        const damageAbilities = app.abilities.filter((id) => {
          const ab = getAbility(id);
          return ab && ab.type === "damage";
        });
        expect(damageAbilities, `${app.label} should have no damage abilities`).toHaveLength(0);
      }
    });

    it("martial classes have at least 3 abilities", () => {
      const martialClasses = ["knight", "ranger", "rogue", "paladin", "barbarian", "monk"];
      for (const classId of martialClasses) {
        const app = getPlayerClass(classId);
        expect(app.abilities.length, `${app.label} should have abilities`).toBeGreaterThanOrEqual(3);
      }
    });

    it("all class spell IDs reference valid spells", () => {
      for (const app of PLAYER_CLASSES) {
        for (const spellId of app.spells) {
          expect(getSpell(spellId), `${app.label} references unknown spell ${spellId}`).toBeDefined();
        }
      }
    });

    it("all class ability IDs reference valid abilities", () => {
      for (const app of PLAYER_CLASSES) {
        for (const abilityId of app.abilities) {
          expect(getAbility(abilityId), `${app.label} references unknown ability ${abilityId}`).toBeDefined();
        }
      }
    });

    it("rogue, barbarian, and monk have only utility spells (no damage/heal)", () => {
      for (const cls of ["rogue", "barbarian", "monk"]) {
        const app = getPlayerClass(cls);
        const combatSpells = app.spells.filter((id) => {
          const sp = getSpell(id);
          return sp && sp.type !== "utility";
        });
        expect(combatSpells, `${cls} should have no combat spells`).toHaveLength(0);
      }
    });

    it("each ability has a unique ID", () => {
      const ids = ABILITIES.map((a) => a.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("each class has a valid starting weapon", () => {
      for (const app of PLAYER_CLASSES) {
        const weapon = getItem(app.startingWeaponId);
        expect(weapon, `${app.label} starting weapon ${app.startingWeaponId} not found`).toBeDefined();
        expect(weapon!.type).toBe("weapon");
      }
    });

    it("each class has a clothing style", () => {
      const validStyles = ["heavy", "robe", "leather", "vestment", "bare", "wrap", "performer"];
      for (const app of PLAYER_CLASSES) {
        expect(validStyles).toContain(app.clothingStyle);
      }
    });

    it("weapon items have weaponSprite field", () => {
      const weapons = ITEMS.filter((i) => i.type === "weapon");
      const validSprites = ["sword", "staff", "dagger", "bow", "mace", "axe", "fist"];
      for (const wpn of weapons) {
        expect(wpn.weaponSprite, `${wpn.name} missing weaponSprite`).toBeDefined();
        expect(validSprites).toContain(wpn.weaponSprite);
      }
    });
  });

  // ── Fast Travel data tests ────────────────────────────────────
  describe("fast travel items and monsters", () => {
    it("Chimaera Wing item exists as consumable", () => {
      const wing = getItem("chimaeraWing");
      expect(wing).toBeDefined();
      expect(wing!.name).toBe("Chimaera Wing");
      expect(wing!.type).toBe("consumable");
      expect(wing!.cost).toBe(75);
    });

    it("Chimaera monster exists with wing drop", () => {
      const chimaera = MONSTERS.find((m) => m.id === "chimaera");
      expect(chimaera).toBeDefined();
      expect(chimaera!.drops).toBeDefined();
      const wingDrop = chimaera!.drops!.find((d) => d.itemId === "chimaeraWing");
      expect(wingDrop).toBeDefined();
      expect(wingDrop!.chance).toBe(0.15);
    });

    it("Great Chimaera has higher drop rate than Chimaera", () => {
      const chimaera = MONSTERS.find((m) => m.id === "chimaera")!;
      const great = MONSTERS.find((m) => m.id === "greatChimaera")!;
      const chimaeraChance = chimaera.drops!.find((d) => d.itemId === "chimaeraWing")!.chance;
      const greatChance = great.drops!.find((d) => d.itemId === "chimaeraWing")!.chance;
      expect(greatChance).toBeGreaterThan(chimaeraChance);
    });

    it("Chimaera Wing is sold in at least one shop", () => {
      const allShopItems = WORLD_CHUNKS.flat().flatMap((c) =>
        c.towns.filter((t) => t.hasShop).flatMap((t) => t.shopItems ?? [])
      );
      expect(allShopItems).toContain("chimaeraWing");
    });
  });

  describe("fast travel spells and abilities", () => {
    it("Teleport spell exists as utility type at level 5", () => {
      const tp = getSpell("teleport");
      expect(tp).toBeDefined();
      expect(tp!.name).toBe("Teleport");
      expect(tp!.type).toBe("utility");
      expect(tp!.levelRequired).toBe(5);
      expect(tp!.mpCost).toBe(8);
    });

    it("Teleport spell is available to caster classes", () => {
      for (const cls of CASTER_CLASSES) {
        const appearance = getPlayerClass(cls);
        expect(appearance.spells, `${cls} should have teleport`).toContain("teleport");
      }
    });

    it("Fast Travel ability exists as utility type at level 5", () => {
      const ft = getAbility("fastTravel");
      expect(ft).toBeDefined();
      expect(ft!.name).toBe("Fast Travel");
      expect(ft!.type).toBe("utility");
      expect(ft!.levelRequired).toBe(5);
    });

    it("Fast Travel ability is available to martial classes", () => {
      const martialClasses = PLAYER_CLASSES.filter((c) => c.abilities.includes("fastTravel"));
      // Martial classes have Fast Travel; casters use Teleport spell instead
      expect(martialClasses.length).toBeGreaterThanOrEqual(5);
      for (const cls of martialClasses) {
        expect(cls.abilities, `${cls.label} should have fastTravel`).toContain("fastTravel");
      }
    });

    it("Short Rest ability exists as utility type at level 1", () => {
      const sr = getAbility("shortRest");
      expect(sr).toBeDefined();
      expect(sr!.name).toBe("Short Rest");
      expect(sr!.type).toBe("utility");
      expect(sr!.levelRequired).toBe(1);
      expect(sr!.mpCost).toBe(0);
    });

    it("Short Rest ability is available to all classes", () => {
      for (const appearance of PLAYER_CLASSES) {
        expect(appearance.abilities, `${appearance.label} should have shortRest`).toContain("shortRest");
      }
    });
  });
});
