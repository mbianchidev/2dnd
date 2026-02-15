/**
 * Overworld map data — multi-chunk world system.
 * The world is a 10x9 grid of 20x15-tile chunks (10x the original 3x3).
 *
 * Core types, enums, and constants live here. Large data arrays are
 * extracted into sibling modules for better code organization:
 *   - mapTypes.ts   — Shared types, enums, and dimension constants
 *   - dungeons.ts   — Dungeon interior map data
 *   - cities.ts     — City interior maps & definitions
 *   - chunks.ts     — World chunk map arrays & region colors
 */

// Re-export types and enums so consumers can continue importing from "./map"
export {
  Terrain,
  MAP_WIDTH, MAP_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT,
  type TownData, type BossData, type WorldChunk,
  type DungeonData, type DungeonLevel, type ChestData, type CityShopData, type CityData,
} from "./mapTypes";

export { DUNGEONS } from "./dungeons";
export { CITIES, INN_COSTS, getInnCost, getCity, getCityForTown, getCityShopAt, getCityShopNearby } from "./cities";
export { WORLD_CHUNKS, REGION_COLORS, getChunk, getTerrainAt, getAllTowns, getAllBosses } from "./chunks";

import { Terrain, MAP_WIDTH, MAP_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT } from "./mapTypes";
import type { ChestData, DungeonData } from "./mapTypes";
import { DUNGEONS } from "./dungeons";
import { WORLD_CHUNKS, getChunk } from "./chunks";

/** Colors for each terrain type (used for procedural rendering). */
export const TERRAIN_COLORS: Record<Terrain, number> = {
  [Terrain.Grass]: 0x4caf50,
  [Terrain.Forest]: 0x2e7d32,
  [Terrain.Mountain]: 0x795548,
  [Terrain.Water]: 0x2196f3,
  [Terrain.Sand]: 0xfdd835,
  [Terrain.Town]: 0xab47bc,
  [Terrain.Dungeon]: 0x616161,
  [Terrain.Boss]: 0xd32f2f,
  [Terrain.Path]: 0xbcaaa4,
  [Terrain.DungeonFloor]: 0x555555,
  [Terrain.DungeonWall]: 0x222222,
  [Terrain.DungeonExit]: 0x66bb6a,
  [Terrain.Chest]: 0xffc107,
  [Terrain.Tundra]: 0xb0bec5,
  [Terrain.Swamp]: 0x558b2f,
  [Terrain.DeepForest]: 0x1b5e20,
  [Terrain.Volcanic]: 0xbf360c,
  [Terrain.Canyon]: 0xa1887f,
  [Terrain.MinorTreasure]: 0x4fc3f7,
  [Terrain.CityFloor]: 0xbcaaa4,
  [Terrain.CityWall]: 0x5d4037,
  [Terrain.CityExit]: 0x66bb6a,
  [Terrain.Carpet]: 0x8b1a1a,
  [Terrain.Well]: 0x607d8b,
  [Terrain.Fountain]: 0x4fc3f7,
  [Terrain.Crate]: 0x8d6e63,
  [Terrain.Barrel]: 0x6d4c41,
  [Terrain.ShopFloor]: 0xa1887f,
  [Terrain.Temple]: 0xd4af37,
  [Terrain.Statue]: 0x9e9e9e,
  [Terrain.River]: 0x42a5f5,
  [Terrain.Mill]: 0x8d6e63,
  [Terrain.CropField]: 0xaed581,
  [Terrain.Fence]: 0x795548,
  [Terrain.House]: 0x6d4c41,
  [Terrain.Flower]: 0x4caf50,
  [Terrain.Cactus]: 0x558b2f,
  [Terrain.Geyser]: 0x90a4ae,
  [Terrain.Mushroom]: 0x558b2f,
  [Terrain.Casino]: 0xdaa520,
  [Terrain.CityPath]: 0x9e9e9e,
  [Terrain.DungeonStairs]: 0x7e57c2,
  [Terrain.DungeonBoss]: 0xd32f2f,
};

/** Encounter rates per terrain (0 = no encounters). */
export const ENCOUNTER_RATES: Record<Terrain, number> = {
  [Terrain.Grass]: 0.08,
  [Terrain.Forest]: 0.15,
  [Terrain.Mountain]: 0.12,
  [Terrain.Water]: 0,
  [Terrain.Sand]: 0.06,
  [Terrain.Town]: 0,
  [Terrain.Dungeon]: 0.2,
  [Terrain.Boss]: 0,
  [Terrain.Path]: 0.04,
  [Terrain.DungeonFloor]: 0.12,
  [Terrain.DungeonWall]: 0,
  [Terrain.DungeonExit]: 0,
  [Terrain.Chest]: 0,
  [Terrain.Tundra]: 0.07,
  [Terrain.Swamp]: 0.18,
  [Terrain.DeepForest]: 0.2,
  [Terrain.Volcanic]: 0,
  [Terrain.Canyon]: 0.1,
  [Terrain.MinorTreasure]: 0,
  [Terrain.CityFloor]: 0,
  [Terrain.CityWall]: 0,
  [Terrain.CityExit]: 0,
  [Terrain.Carpet]: 0,
  [Terrain.Well]: 0,
  [Terrain.Fountain]: 0,
  [Terrain.Crate]: 0,
  [Terrain.Barrel]: 0,
  [Terrain.ShopFloor]: 0,
  [Terrain.Temple]: 0,
  [Terrain.Statue]: 0,
  [Terrain.River]: 0,
  [Terrain.Mill]: 0,
  [Terrain.CropField]: 0,
  [Terrain.Fence]: 0,
  [Terrain.House]: 0,
  [Terrain.Flower]: 0.06,
  [Terrain.Cactus]: 0.05,
  [Terrain.Geyser]: 0,
  [Terrain.Mushroom]: 0.08,
  [Terrain.Casino]: 0,
  [Terrain.CityPath]: 0,
  [Terrain.DungeonStairs]: 0,
  [Terrain.DungeonBoss]: 0,
};


/** Check if a terrain is walkable. */
export function isWalkable(terrain: Terrain): boolean {
  return (
    terrain !== Terrain.Water &&
    terrain !== Terrain.Mountain &&
    terrain !== Terrain.DungeonWall &&
    terrain !== Terrain.Volcanic &&
    terrain !== Terrain.CityWall &&
    terrain !== Terrain.Well &&
    terrain !== Terrain.Fountain &&
    terrain !== Terrain.Crate &&
    terrain !== Terrain.Barrel &&
    terrain !== Terrain.Temple &&
    terrain !== Terrain.Statue &&
    terrain !== Terrain.River &&
    terrain !== Terrain.Mill &&
    terrain !== Terrain.Fence &&
    terrain !== Terrain.House &&
    terrain !== Terrain.Geyser &&
    terrain !== Terrain.Casino
  );
}

/** Terrain types that should not be replaced by road diversification or treasure placement. */
function isSpecialTerrain(t: Terrain): boolean {
  return t === Terrain.Town || t === Terrain.Boss || t === Terrain.Dungeon ||
    t === Terrain.Chest || t === Terrain.DungeonExit || t === Terrain.DungeonFloor ||
    t === Terrain.DungeonWall || t === Terrain.Water || t === Terrain.Mountain ||
    t === Terrain.Volcanic ||
    t === Terrain.CityFloor || t === Terrain.CityWall || t === Terrain.CityExit ||
    t === Terrain.Carpet || t === Terrain.Well || t === Terrain.Fountain ||
    t === Terrain.Crate || t === Terrain.Barrel || t === Terrain.ShopFloor ||
    t === Terrain.Temple || t === Terrain.Statue ||
    t === Terrain.River || t === Terrain.Mill || t === Terrain.CropField ||
    t === Terrain.Fence || t === Terrain.House ||
    t === Terrain.Flower || t === Terrain.Cactus || t === Terrain.Geyser || t === Terrain.Mushroom ||
    t === Terrain.Casino || t === Terrain.CityPath ||
    t === Terrain.DungeonStairs || t === Terrain.DungeonBoss;
}

export function getTownBiome(chunkX: number, chunkY: number, tileX: number, tileY: number): Terrain {
  const chunk = getChunk(chunkX, chunkY);
  if (!chunk) return Terrain.Grass;
  const counts: Record<number, number> = {};
  const biomes = [Terrain.Grass, Terrain.Forest, Terrain.Sand, Terrain.Tundra, Terrain.Swamp, Terrain.DeepForest, Terrain.Canyon];
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = tileX + dx;
      const ny = tileY + dy;
      if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT) {
        const t = chunk.mapData[ny][nx];
        if (biomes.includes(t)) {
          counts[t] = (counts[t] ?? 0) + 1;
        }
      }
    }
  }
  let best = Terrain.Grass;
  let bestCount = 0;
  for (const [t, c] of Object.entries(counts)) {
    if (c > bestCount) { bestCount = c; best = Number(t) as Terrain; }
  }
  return best;
}

export const CHESTS: ChestData[] = [
  { id: "crypt_flame", itemId: "flameBlade", x: 18, y: 1, location: { type: "dungeon", dungeonId: "heartlands_dungeon" } },
  { id: "crypt_guardian", itemId: "cryptGuardian", x: 9, y: 7, location: { type: "dungeon", dungeonId: "heartlands_dungeon" } },
  { id: "crypt_frost", itemId: "frostfang", x: 17, y: 13, location: { type: "dungeon", dungeonId: "heartlands_dungeon" } },
  { id: "forest_shadow", itemId: "shadowCloak", x: 3, y: 13, location: { type: "overworld", chunkX: 4, chunkY: 1 } },
  { id: "frost_blade_chest", itemId: "frostBrand", x: 17, y: 1, location: { type: "dungeon", dungeonId: "frost_cavern" } },
  { id: "frost_pelt_chest", itemId: "tundraPelt", x: 16, y: 13, location: { type: "dungeon", dungeonId: "frost_cavern" } },
  { id: "frost_aegis_chest", itemId: "glacialAegis", x: 9, y: 7, location: { type: "dungeon", dungeonId: "frost_cavern" } },
  { id: "forge_core_chest", itemId: "magmaCore", x: 18, y: 1, location: { type: "dungeon", dungeonId: "volcanic_forge" } },
  { id: "forge_shield_chest", itemId: "volcanicShield", x: 9, y: 7, location: { type: "dungeon", dungeonId: "volcanic_forge" } },
  { id: "forge_ember_chest", itemId: "emberBlade", x: 17, y: 13, location: { type: "dungeon", dungeonId: "volcanic_forge" } },
  { id: "swamp_mantle_chest", itemId: "swampMantle", x: 5, y: 3, location: { type: "overworld", chunkX: 0, chunkY: 4 } },
  { id: "canyon_bow_chest", itemId: "canyonBow", x: 5, y: 3, location: { type: "overworld", chunkX: 8, chunkY: 6 } },
];

export function getChestAt(
  x: number, y: number,
  location: { type: "overworld"; chunkX: number; chunkY: number } | { type: "dungeon"; dungeonId: string }
): ChestData | undefined {
  return CHESTS.find((c) => {
    if (c.x !== x || c.y !== y) return false;
    if (c.location.type !== location.type) return false;
    if (c.location.type === "overworld" && location.type === "overworld") {
      return c.location.chunkX === location.chunkX && c.location.chunkY === location.chunkY;
    }
    if (c.location.type === "dungeon" && location.type === "dungeon") {
      return c.location.dungeonId === location.dungeonId;
    }
    return false;
  });
}

export function getDungeonAt(cx: number, cy: number, x: number, y: number): DungeonData | undefined {
  return DUNGEONS.find((d) => d.entranceChunkX === cx && d.entranceChunkY === cy && d.entranceTileX === x && d.entranceTileY === y);
}

export function getDungeon(id: string): DungeonData | undefined {
  return DUNGEONS.find((d) => d.id === id);
}

/** Get the map data for a dungeon at a specific level. Level 0 = entrance level. */
export function getDungeonLevelMap(dungeon: DungeonData, level: number): Terrain[][] {
  if (level === 0) return dungeon.mapData;
  if (dungeon.levels && level >= 1 && level <= dungeon.levels.length) {
    return dungeon.levels[level - 1].mapData;
  }
  return dungeon.mapData; // fallback to level 0
}

/** Get the spawn point for a dungeon level. Level 0 = entrance level. */
export function getDungeonLevelSpawn(dungeon: DungeonData, level: number): { x: number; y: number } {
  if (level === 0) return { x: dungeon.spawnX, y: dungeon.spawnY };
  if (dungeon.levels && level >= 1 && level <= dungeon.levels.length) {
    const lvl = dungeon.levels[level - 1];
    return { x: lvl.spawnX, y: lvl.spawnY };
  }
  return { x: dungeon.spawnX, y: dungeon.spawnY }; // fallback
}

/** Get the total number of levels in a dungeon (including entrance level). */
export function getDungeonTotalLevels(dungeon: DungeonData): number {
  return 1 + (dungeon.levels?.length ?? 0);
}

// ─── Road Diversification ─────────────────────────────────────────
// Post-processes chunk map data at module load to vary road patterns.

/** Find the most common non-special terrain in a chunk (used to fill removed roads). */
function dominantFill(md: Terrain[][]): Terrain {
  const counts = new Map<Terrain, number>();
  for (const row of md) {
    for (const t of row) {
      if (t === Terrain.Path || isSpecialTerrain(t)) continue;
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  let best = Terrain.Grass;
  let bestCount = 0;
  for (const [t, c] of counts) {
    if (c > bestCount) { best = t; bestCount = c; }
  }
  return best;
}

/** Set a tile to Path if it isn't special terrain. */
function setPath(md: Terrain[][], y: number, x: number): void {
  if (y < 0 || y >= md.length || x < 0 || x >= md[0].length) return;
  if (!isSpecialTerrain(md[y][x])) md[y][x] = Terrain.Path;
}

/** Replace path tile with fill terrain if it currently is a path. */
function clearPath(md: Terrain[][], y: number, x: number, fill: Terrain): void {
  if (y < 0 || y >= md.length || x < 0 || x >= md[0].length) return;
  if (md[y][x] === Terrain.Path) md[y][x] = fill;
}

function diversifyRoads(): void {
  for (let cy = 0; cy < WORLD_HEIGHT; cy++) {
    for (let cx = 0; cx < WORLD_WIDTH; cx++) {
      const chunk = WORLD_CHUNKS[cy][cx];
      const md = chunk.mapData;
      const H = md.length;
      const W = md[0].length;
      const fill = dominantFill(md);

      const isTop = cy === 0;
      const isBot = cy === WORLD_HEIGHT - 1;
      const isLeft = cx === 0;
      const isRight = cx === WORLD_WIDTH - 1;

      // ── Edge chunks: remove the arm that goes off-map ──
      if (isTop) {
        for (let y = 0; y < 7; y++) { clearPath(md, y, 9, fill); clearPath(md, y, 10, fill); }
      }
      if (isBot) {
        for (let y = 8; y < H; y++) { clearPath(md, y, 9, fill); clearPath(md, y, 10, fill); }
      }
      if (isLeft) {
        for (let x = 0; x < 9; x++) clearPath(md, 7, x, fill);
      }
      if (isRight) {
        for (let x = 11; x < W; x++) clearPath(md, 7, x, fill);
      }

      // ── Interior variety for empty chunks (no towns/bosses) ──
      if (chunk.towns.length > 0 || chunk.bosses.length > 0) continue;

      const seed = (cx * 31 + cy * 17 + cx * cy * 7) % 7;
      switch (seed) {
        case 0: // Keep straight cross (no change)
          break;

        case 1: { // Wide plaza at intersection (5×5 clear area)
          for (let y = 5; y <= 9; y++) {
            for (let x = 7; x <= 12; x++) setPath(md, y, x);
          }
          break;
        }

        case 2: { // Winding horizontal — road snakes through rows 5-9
          // Clear the straight horizontal (except at intersection cols)
          for (let x = 1; x < W - 1; x++) {
            if (x >= 8 && x <= 11) continue;
            clearPath(md, 7, x, fill);
          }
          const rowWind = [7, 6, 6, 5, 6, 7, 8, 9, 8, /* 9,10 junction */ 7, 7, 8, 9, 9, 8, 7, 6, 6, 7, 7];
          for (let x = 0; x < W; x++) {
            const wy = rowWind[x];
            setPath(md, wy, x);
            // Connect winding row to the fixed junction row
            if (x >= 8 && x <= 11) {
              for (let y = Math.min(wy, 7); y <= Math.max(wy, 7); y++) setPath(md, y, x);
            }
          }
          break;
        }

        case 3: { // Winding vertical — road snakes through cols 7-12
          for (let y = 1; y < H - 1; y++) {
            if (y >= 6 && y <= 8) continue;
            clearPath(md, y, 9, fill);
            clearPath(md, y, 10, fill);
          }
          const colWind = [9, 10, 11, 11, 10, 9, /* 6-8 junction */ 9, 9, 9, 8, 8, 9, 10, 10, 9];
          for (let y = 0; y < H; y++) {
            const wx = colWind[y];
            setPath(md, y, wx);
            setPath(md, y, wx + 1);
            if (y >= 6 && y <= 8) {
              for (let x = Math.min(wx, 9); x <= Math.max(wx + 1, 10); x++) setPath(md, y, x);
            }
          }
          break;
        }

        case 4: { // Side branches — short dead-end roads
          // Branch NW from vertical at y=3
          for (let x = 6; x <= 9; x++) setPath(md, 3, x);
          // Branch SE from vertical at y=11
          for (let x = 10; x <= 14; x++) setPath(md, 11, x);
          // Branch N from horizontal at x=4
          for (let y = 4; y <= 7; y++) setPath(md, y, 4);
          // Branch S from horizontal at x=15
          for (let y = 7; y <= 11; y++) setPath(md, y, 15);
          break;
        }

        case 5: { // Roundabout — circular clearing at the intersection
          const cx2 = 9.5, cy2 = 7;
          for (let y = 4; y <= 10; y++) {
            for (let x = 6; x <= 13; x++) {
              const dx = x - cx2, dy = y - cy2;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist >= 2.2 && dist <= 3.8) setPath(md, y, x);
            }
          }
          break;
        }

        case 6: { // Diagonal offset — road shifts by 2 tiles in each quadrant
          // NW quadrant: vertical shifted left
          for (let y = 0; y < 7; y++) {
            clearPath(md, y, 9, fill);
            clearPath(md, y, 10, fill);
            setPath(md, y, 7);
            setPath(md, y, 8);
          }
          // Connect shifted vertical to junction
          for (let x = 7; x <= 10; x++) { setPath(md, 6, x); setPath(md, 7, x); }
          // SE quadrant: vertical shifted right
          for (let y = 8; y < H; y++) {
            clearPath(md, y, 9, fill);
            clearPath(md, y, 10, fill);
            setPath(md, y, 11);
            setPath(md, y, 12);
          }
          for (let x = 9; x <= 12; x++) { setPath(md, 7, x); setPath(md, 8, x); }
          break;
        }
      }
    }
  }
}

// ─── Minor Treasure Placement ─────────────────────────────────────
// Scatter small blue sparkle treasures across overworld chunks on walkable tiles.

/** Deterministic pseudo-random number based on seed. */
function seededRand(seed: number): () => number {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

/** Sparkle positions stored as overlay — terrain data is never modified. */
export const SPARKLE_POSITIONS: Set<string> = new Set();

/** Check if a tile has a sparkle overlay. */
export function hasSparkleAt(cx: number, cy: number, x: number, y: number): boolean {
  return SPARKLE_POSITIONS.has(`${cx},${cy},${x},${y}`);
}

function placeMinorTreasures(): void {
  const rng = seededRand(42);
  for (let cy = 0; cy < WORLD_HEIGHT; cy++) {
    for (let cx = 0; cx < WORLD_WIDTH; cx++) {
      const chunk = WORLD_CHUNKS[cy][cx];
      const md = chunk.mapData;
      // Place 1-3 minor treasures per chunk on walkable non-special tiles
      const count = 1 + Math.floor(rng() * 3);
      let placed = 0;
      let attempts = 0;
      while (placed < count && attempts < 60) {
        attempts++;
        const tx = Math.floor(rng() * MAP_WIDTH);
        const ty = Math.floor(rng() * MAP_HEIGHT);
        const t = md[ty][tx];
        // Only place on walkable, non-special, non-path tiles
        if (isWalkable(t) && !isSpecialTerrain(t) && t !== Terrain.Path) {
          SPARKLE_POSITIONS.add(`${cx},${cy},${tx},${ty}`);
          placed++;
        }
      }
    }
  }
}

// ─── Biome Decorations ──────────────────────────────────────────
// Scatter themed decoration tiles on overworld biome terrains.

/** Map from biome terrain to the decoration terrain to scatter. */
const BIOME_DECORATION_MAP: Partial<Record<Terrain, Terrain>> = {
  [Terrain.Grass]: Terrain.Flower,
  [Terrain.Sand]: Terrain.Cactus,
  [Terrain.Volcanic]: Terrain.Geyser,  // placed on adjacent walkable tiles
  [Terrain.Swamp]: Terrain.Mushroom,
};

function placeBiomeDecorations(): void {
  const rng = seededRand(7777);
  for (let cy = 0; cy < WORLD_HEIGHT; cy++) {
    for (let cx = 0; cx < WORLD_WIDTH; cx++) {
      const chunk = WORLD_CHUNKS[cy][cx];
      const md = chunk.mapData;
      // Count biome tiles to determine dominant biome(s)
      for (let ty = 0; ty < MAP_HEIGHT; ty++) {
        for (let tx = 0; tx < MAP_WIDTH; tx++) {
          const t = md[ty][tx];
          const deco = BIOME_DECORATION_MAP[t];
          if (!deco) continue;
          // Sparse placement: ~4% chance per matching tile
          if (rng() > 0.04) continue;
          // For Volcanic: place on a walkable neighbour rather than the tile itself
          if (t === Terrain.Volcanic) {
            const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
            for (const [dx, dy] of dirs) {
              const nx = tx + dx, ny = ty + dy;
              if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT) {
                const nt = md[ny][nx];
                if (isWalkable(nt) && !isSpecialTerrain(nt) && nt !== Terrain.Path) {
                  md[ny][nx] = deco;
                  break;
                }
              }
            }
          } else {
            // Don't place flowers on grass tiles adjacent to sand/desert
            if (t === Terrain.Grass && deco === Terrain.Flower) {
              let nearSand = false;
              for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
                const nx = tx + dx, ny = ty + dy;
                if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT) {
                  const nt = md[ny][nx];
                  if (nt === Terrain.Sand || nt === Terrain.Cactus) { nearSand = true; break; }
                }
              }
              if (nearSand) continue;
            }
            md[ty][tx] = deco;
          }
        }
      }
    }
  }
}

// Execute at module load
diversifyRoads();
placeBiomeDecorations();
placeMinorTreasures();
