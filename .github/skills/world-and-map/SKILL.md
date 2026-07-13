---
name: world-and-map
description: Extend the multi-chunk world, city districts, dungeon levels, terrain, and fog in 2D&D
license: MIT
---

# World and Map System

## Module layout

- `src/data/map.ts`: hub, shared helpers, encounter rates, and re-exports
- `src/data/mapTypes.ts`: terrain enum, interfaces, and dimensions
- `src/data/chunks.ts`: 10x9 overworld chunk grid
- `src/data/cities.ts`: city layouts, districts, shops, and gates
- `src/data/dungeons.ts`: dungeon floors and stairs
- `src/systems/movement.ts`: grid, city-gate, and dungeon-stair movement
- `src/managers/fogOfWar.ts`: exploration-key generation and reveal state
- `src/managers/skillChecks.ts`: terrain events, hidden treasure, and chest
  checks
- `src/renderers/map.ts`: terrain and weather rendering
- `src/renderers/city.ts`: city NPC, animal, and district rendering

## Dimensions

- World: 10x9 chunks
- Chunk/interior: 20x15 tiles
- Tile size: 32x32 pixels
- Map arrays are always `[y][x]`

## Terrain

`Terrain` currently spans IDs 0-43. Important navigation additions:

- `CityGate = 41`
- `DungeonStairs = 42`
- `DungeonBoss = 43`

Use `isWalkable()` and `ENCOUNTER_RATES` for behavior. Stairs, gates, and boss
tiles are walkable and do not produce random encounters.

## Overworld

Use:

```typescript
getChunk(chunkX, chunkY);
getTerrainAt(chunkX, chunkY, tileX, tileY);
getTownBiome(chunkX, chunkY, tileX, tileY);
```

Chunk names drive biome music, weather probabilities, and presentation. New
names must retain a recognized biome prefix.

Terrain-driven Wisdom discoveries and Dexterity hazards are defined in
`src/data/skillChecks.ts`. Select them through the shared skill-check helpers;
do not hardcode event rolls in the scene.

## Multi-chunk cities

`CityData.mapData`, `spawnX`, `spawnY`, and `shops` represent chunk 0. The
optional `chunks` array stores additional districts starting at logical index
1. Never index that array using the logical city chunk index.

Use:

```typescript
getCityChunkCount(city);
getCityChunk(city, chunkIndex);
getCityChunkMap(city, chunkIndex);
getCityChunkSpawn(city, chunkIndex);
getCityChunkShops(city, chunkIndex);
getCityChunkShopNearby(city, chunkIndex, x, y);
getCityConnectionAt(city, chunkIndex, x, y);
```

`CityData.connections` maps a source gate tile to a destination district and
tile. Movement through a connection updates `player.position.cityChunkIndex`,
`x`, and `y`.

When adding a district:

1. Add a 20x15 `CityChunk`.
2. Place reachable `Terrain.CityGate` tiles.
3. Add both travel directions when the gate should be bidirectional.
4. Add district shops to that chunk.
5. Test map dimensions, walkability, connection destinations, and reachability.

## Multi-level dungeons

Level 0 remains in `DungeonData.mapData`; `levels[0]` is logical level 1.
Use:

```typescript
getDungeonTotalLevels(dungeon);
getDungeonLevelMap(dungeon, level);
getDungeonLevelSpawn(dungeon, level);
getDungeonConnectionAt(dungeon, level, x, y);
getDungeonBoss(dungeonId);
```

`DungeonData.connections` contains explicit source and destination levels and
tiles. Model ascent and descent as separate connections. The deepest floor
contains `Terrain.DungeonBoss` and a unique `bossId`.

Dungeon encounters should pass the dungeon ID so the correct exclusive pool is
used.

## Chests

Dungeon chest locations may include `dungeonLevel`. Resolve the level map
before reading a chest tile. Opened chest IDs remain globally unique and are
stored in player progression.

`ChestData` may also define `lockDc`/`trapDamage` and
`secretDc`/`secretGold`. Lock failures can deal nonlethal damage, while secret
checks can grant bonus gold. Persist results with stable chest-derived check
IDs so a fixed check cannot be rerolled.

## Fog of war

Always generate keys through `FogOfWar.exploredKey()`.

| Location | Key |
| --- | --- |
| Overworld | `chunkX,chunkY,x,y` |
| Dungeon level 0 | `d:dungeonId,x,y` |
| Dungeon level N | `d:dungeonId,level,x,y` |
| City chunk 0 | `c:cityId,x,y` |
| City chunk N | `c:cityId,chunkIndex,x,y` |

The level-zero and chunk-zero formats intentionally preserve existing saves.
`revealEntireWorld()` must cover every dungeon level and city district.

## Player position

```typescript
interface PlayerPosition {
  x: number;
  y: number;
  chunkX: number;
  chunkY: number;
  inDungeon: boolean;
  dungeonId: string;
  dungeonLevel: number;
  inCity: boolean;
  cityId: string;
  cityChunkIndex: number;
}
```

Dungeon and city flags are mutually exclusive. Save loading validates IDs,
clamps levels/chunks, repairs invalid tiles to the correct spawn, and falls back
to the Willowdale overworld start when necessary.

## Common pitfalls

- Indexing maps as `[x][y]`
- Treating `city.chunks[0]` as logical chunk 0
- Using `dungeon.levels[level]` directly
- Adding only one direction of a reversible connection
- Reusing fog keys across floors or districts
- Looking up only generic dungeon monsters and omitting exclusive pools/bosses
- Hardcoding walkability or encounter behavior
