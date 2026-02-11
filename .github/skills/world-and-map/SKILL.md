---
name: world-and-map
description: Understand and extend the multi-chunk world, cities, dungeons, and terrain in 2D&D
license: MIT
---

# World & Map System

The game world is defined in `src/data/map.ts` (~3,000 lines).

## World Structure

- **World grid:** 10 columns × 9 rows = 90 chunks
- **Chunk size:** 20 tiles wide × 15 tiles tall
- **Tile size:** 32×32 pixels
- **Total world:** 200×135 tiles

```typescript
import {
  WORLD_WIDTH,    // 10 (chunks)
  WORLD_HEIGHT,   // 9 (chunks)
  MAP_WIDTH,      // 20 (tiles per chunk)
  MAP_HEIGHT,     // 15 (tiles per chunk)
  WORLD_CHUNKS,   // WorldChunk[][] — the full 10×9 grid
  getChunk,       // (cx, cy) → WorldChunk | undefined
  getTerrainAt,   // (cx, cy, tx, ty) → Terrain | undefined
  isWalkable,     // (terrain) → boolean
} from "../data/map";
```

## Terrain Types

The `Terrain` enum defines all tile types (0–39):

| Category | Terrains |
|----------|----------|
| Natural | Grass(0), Forest(1), Mountain(2), Water(3), Sand(4), Tundra(13), Swamp(14), DeepForest(15), Volcanic(16), Canyon(17) |
| Structures | Town(5), Dungeon(6), Boss(7), Path(8) |
| Dungeon Interior | DungeonFloor(9), DungeonWall(10), DungeonExit(11), Chest(12) |
| City Interior | CityFloor(19), CityWall(20), CityExit(21), Carpet(22), Well(23), Fountain(24) |
| Decorative | Crate(25), Barrel(26), ShopFloor(27), Temple(28), Statue(29), River(30), Mill(31), CropField(32), Fence(33), House(34), Flower(35), Cactus(36), Geyser(37), Mushroom(38), Casino(39) |
| Collectible | MinorTreasure(18) |

## Chunks

Each chunk is a `WorldChunk`:
```typescript
interface WorldChunk {
  name: string;       // e.g. "Frozen Reach", "Woodland Frontier"
  mapData: Terrain[][]; // 15 rows × 20 cols
  towns: TownData[];
  bosses: BossData[];
}
```

The biome prefix (first word of chunk name) determines music, weather probabilities, and visual theme.

## Cities

12 cities with full interior layouts:

```typescript
interface CityData {
  id: string;
  name: string;
  chunkX: number; chunkY: number;  // World chunk position
  tileX: number; tileY: number;    // Town tile position in chunk
  mapData: Terrain[][];            // City interior layout (20×15)
  spawnX: number; spawnY: number;  // Where player appears
  shops: CityShopData[];           // Shops within the city
}

interface CityShopData {
  type: "weapon" | "armor" | "magic" | "inn" | "bank" | "general";
  name: string;
  x: number; y: number;
  shopItems: string[];  // Item IDs
}
```

Cities are always fully revealed on entry (no fog of war).

### Adding a New City
1. Define a `const MY_CITY_INTERIOR: Terrain[][]` (20×15 grid)
2. Add a `CityData` entry to the `CITIES` array
3. Place a `Terrain.Town` tile in the parent chunk's `mapData`
4. Add city music override in `CITY_OVERRIDES` in `audio.ts`
5. Add weather weights if the city's biome needs them

## Dungeons

```typescript
interface DungeonData {
  id: string;
  name: string;
  entranceChunkX: number; entranceChunkY: number;
  entranceTileX: number; entranceTileY: number;
  mapData: Terrain[][];
  spawnX: number; spawnY: number;
}
```

Dungeons require a `dungeonKey` item to enter (or debug mode).
Place `Terrain.Dungeon` on the overworld to mark the entrance.

## Chests & Treasures

```typescript
interface ChestData {
  id: string;
  itemId: string;
  x: number; y: number;
  location: { type: "overworld"; chunkX: number; chunkY: number }
          | { type: "dungeon"; dungeonId: string };
}
```

- `Terrain.Chest` tiles on dungeon/overworld maps
- `Terrain.MinorTreasure` for small gold pickups (5–25 gold)
- Opened chests tracked in `player.openedChests`

## Fog of War

Explored tiles stored in `player.exploredTiles` as a flat `Record<string, boolean>`:
- Overworld: `"${chunkX},${chunkY},${tileX},${tileY}"`
- Dungeon: `"d:${dungeonId},${tileX},${tileY}"`
- City: `"c:${cityId},${tileX},${tileY}"`

Tiles within radius 2 of the player are revealed on each step.

## Key Functions

```typescript
getChunk(cx, cy)              // Get chunk by world coords
getTerrainAt(cx, cy, tx, ty)  // Get terrain at world position
isWalkable(terrain)           // Can the player walk on this?
getDungeonAt(cx, cy, tx, ty)  // Get dungeon entrance at position
getDungeon(id)                // Get dungeon by ID
getChestAt(x, y, location)   // Get chest at position
getCity(id)                   // Get city by ID
getCityForTown(cx, cy, tx, ty) // Get city for a town tile
getCityShopNearby(city, x, y)  // Get shop near player in a city
getTownBiome(cx, cy, tx, ty)   // Get biome for a town (texture coloring)
```

## Encounter Rates

Defined per terrain type in `ENCOUNTER_RATES`:
- Grass/Path: low chance
- Forest/Sand: moderate
- Swamp/Volcanic: higher
- Town/Water/Mountain: no encounters

## Common Pitfalls
- ❌ Don't forget that mapData is `[y][x]` (row-major), not `[x][y]`
- ❌ Don't add a city without placing a Town tile in the parent chunk
- ❌ Don't forget to add music overrides for new cities/bosses
- ❌ Always use `isWalkable()` to check terrain — don't hardcode walkable types
- ❌ Chunk names must have a biome prefix word that matches `BIOME_PROFILES` keys
