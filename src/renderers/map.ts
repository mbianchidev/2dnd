/**
 * MapRenderer — renders the tile map, weather particles, biome decorations,
 * and day/night tinting for overworld, dungeon, and city views.
 */

import Phaser from "phaser";
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  getChunk,
  getDungeon,
  getDungeonLevelMap,
  getCity,
  getChestAt,
  getTownBiome,
  hasSparkleAt,
  Terrain,
  type WorldChunk,
  type CityData,
} from "../data/map";
import { getTimePeriod, TimePeriod, PERIOD_TINT } from "../systems/daynight";
import { WeatherType, WEATHER_TINT, type WeatherState } from "../systems/weather";
import type { PlayerState } from "../systems/player";
import type { CityRenderer } from "./city";
import { TILE_SIZE } from "../config";

/** Biome wall texture overrides for city rendering. */
const BIOME_WALL_MAP: Record<number, string> = {
  [Terrain.Grass]: "tile_citywall_wood",
  [Terrain.Forest]: "tile_citywall_moss",
  [Terrain.DeepForest]: "tile_citywall_moss",
  [Terrain.Sand]: "tile_citywall_sand",
  [Terrain.Tundra]: "tile_citywall_ice",
  [Terrain.Swamp]: "tile_citywall_dark",
  [Terrain.Volcanic]: "tile_citywall_volcanic",
  [Terrain.Canyon]: "tile_citywall_sand",
};

/** Biome path texture overrides for city rendering. */
const BIOME_PATH_MAP: Record<number, string> = {
  [Terrain.Grass]: "tile_path_wood",
  [Terrain.Forest]: "tile_path_moss",
  [Terrain.DeepForest]: "tile_path_moss",
  [Terrain.Sand]: "tile_path_sand",
  [Terrain.Tundra]: "tile_path_gravel",
  [Terrain.Swamp]: "tile_path_dark",
  [Terrain.Volcanic]: "tile_path_lava",
  [Terrain.Canyon]: "tile_path_sand",
};

/** Shop-type → carpet texture key. */
const SHOP_CARPET_TEX: Record<string, string> = {
  weapon: "tile_carpet_weapon",
  armor: "tile_carpet_armor",
  general: "tile_carpet_general",
  magic: "tile_carpet_magic",
  bank: "tile_carpet_bank",
  inn: "tile_carpet_inn",
  stable: "tile_carpet_general",
};

/**
 * Blend two 0xRRGGBB tint values, weighting the first (day/night) at 75%
 * and the second (weather) at 25%.
 */
function blendTints(a: number, b: number): number {
  const rA = (a >> 16) & 0xff, gA = (a >> 8) & 0xff, bA = a & 0xff;
  const rB = (b >> 16) & 0xff, gB = (b >> 8) & 0xff, bB = b & 0xff;
  const r = Math.round(rA * 0.75 + rB * 0.25);
  const g = Math.round(gA * 0.75 + gB * 0.25);
  const bl = Math.round(bA * 0.75 + bB * 0.25);
  return (r << 16) | (g << 8) | bl;
}

/** Biome decoration particle configs keyed by terrain. */
const DECO_CREATURES: Record<number, { texture: string; config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig }> = {
  [Terrain.Flower]: {
    texture: "particle_butterfly",
    config: {
      lifespan: 3000,
      speed: { min: 8, max: 20 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.9, end: 0.4 },
      alpha: { start: 0.9, end: 0.2 },
      quantity: 1,
      frequency: 1200,
      gravityY: -5,
    },
  },
  [Terrain.Cactus]: {
    texture: "particle_snake",
    config: {
      lifespan: 4000,
      speedX: { min: -8, max: 8 },
      speedY: { min: -2, max: 2 },
      scale: { start: 0.8, end: 0.8 },
      alpha: { start: 0.85, end: 0.0 },
      quantity: 1,
      frequency: 3000,
      gravityY: 0,
    },
  },
  [Terrain.Geyser]: {
    texture: "particle_smoke",
    config: {
      lifespan: 2000,
      speedY: { min: -30, max: -60 },
      speedX: { min: -6, max: 6 },
      scale: { start: 0.5, end: 1.8 },
      alpha: { start: 0.7, end: 0.0 },
      quantity: 1,
      frequency: 400,
      gravityY: -8,
    },
  },
  [Terrain.Mushroom]: {
    texture: "particle_mosquito",
    config: {
      lifespan: 2500,
      speed: { min: 10, max: 25 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.7, end: 0.3 },
      alpha: { start: 0.9, end: 0.15 },
      quantity: 1,
      frequency: 900,
      gravityY: 0,
    },
  },
};

export class MapRenderer {
  private scene: Phaser.Scene;
  tileSprites: Phaser.GameObjects.Sprite[][] = [];
  private weatherParticles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private stormLightningTimer: Phaser.Time.TimerEvent | null = null;
  biomeDecoEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Render the tile map for the current location (overworld chunk, dungeon, or city).
   * Clears all previous tile sprites before drawing.
   */
  renderMap(
    player: PlayerState,
    defeatedBosses: Set<string>,
    isExplored: (x: number, y: number) => boolean,
    cityRenderer: CityRenderer,
    timeStep: number = 0,
  ): void {
    // Clear old tile sprites
    for (const row of this.tileSprites) {
      for (const sprite of row) sprite.destroy();
    }
    this.tileSprites = [];

    // Clear biome decoration emitters
    for (const em of this.biomeDecoEmitters) em.destroy();
    this.biomeDecoEmitters = [];

    // ── Dungeon interior ──
    if (player.position.inDungeon) {
      this.renderDungeon(player, isExplored);
      return;
    }

    // ── City interior ──
    if (player.position.inCity) {
      this.renderCity(player, isExplored, cityRenderer, timeStep);
      return;
    }

    // ── Overworld ──
    this.renderOverworld(player, defeatedBosses, isExplored);
  }

  /**
   * Update tile sprites for newly revealed tiles without full re-render.
   */
  revealTileSprites(
    player: PlayerState,
    isExplored: (x: number, y: number) => boolean,
    getPlayerShopIndex: (city: CityData) => number,
    shopFloorMap: Map<string, number>,
  ): void {
    if (player.position.inDungeon) {
      this.revealDungeonTiles(player, isExplored);
    } else if (player.position.inCity) {
      this.revealCityTiles(player, isExplored, getPlayerShopIndex, shopFloorMap);
    } else {
      this.revealOverworldTiles(player, isExplored);
    }
  }

  /** Apply a color tint to all map tiles based on time period + weather. */
  applyDayNightTint(player: PlayerState, timeStep: number, weatherState: WeatherState): void {
    const period = player.position.inDungeon ? TimePeriod.Dungeon : getTimePeriod(timeStep);
    const dayTint = PERIOD_TINT[period];
    const weatherTint = WEATHER_TINT[weatherState.current];
    const tint = blendTints(dayTint, weatherTint);
    for (const row of this.tileSprites) {
      for (const sprite of row) {
        sprite.setTint(tint);
      }
    }
  }

  /** Create or update weather particle effects based on current weather. */
  updateWeatherParticles(weatherState: WeatherState): void {
    // Destroy existing emitter
    if (this.weatherParticles) {
      this.weatherParticles.destroy();
      this.weatherParticles = null;
    }
    // Stop lightning timer
    if (this.stormLightningTimer) {
      this.stormLightningTimer.destroy();
      this.stormLightningTimer = null;
    }

    const w = MAP_WIDTH * TILE_SIZE;
    const h = MAP_HEIGHT * TILE_SIZE;
    const weather = weatherState.current;

    if (weather === WeatherType.Clear) return;

    const configs: Record<string, () => Phaser.GameObjects.Particles.ParticleEmitter> = {
      [WeatherType.Rain]: () =>
        this.scene.add.particles(0, -20, "particle_rain", {
          x: { min: 0, max: w },
          quantity: 4,
          lifespan: 2200,
          speedY: { min: 220, max: 360 },
          speedX: { min: -20, max: -40 },
          scale: { start: 1, end: 0.5 },
          alpha: { start: 0.9, end: 0.25 },
          frequency: 16,
        }),
      [WeatherType.Snow]: () =>
        this.scene.add.particles(0, -20, "particle_snow", {
          x: { min: 0, max: w },
          quantity: 2,
          lifespan: 8000,
          speedY: { min: 40, max: 80 },
          speedX: { min: -25, max: 25 },
          scale: { start: 1, end: 0.3 },
          alpha: { start: 0.95, end: 0.1 },
          frequency: 50,
        }),
      [WeatherType.Sandstorm]: () =>
        this.scene.add.particles(w + 10, 0, "particle_sand", {
          y: { min: 0, max: h },
          quantity: 6,
          lifespan: 2400,
          speedX: { min: -450, max: -280 },
          speedY: { min: -30, max: 50 },
          scale: { start: 1.3, end: 0.5 },
          alpha: { start: 0.95, end: 0.2 },
          frequency: 10,
        }),
      [WeatherType.Storm]: () =>
        this.scene.add.particles(0, -20, "particle_storm", {
          x: { min: 0, max: w },
          quantity: 6,
          lifespan: 1600,
          speedY: { min: 350, max: 550 },
          speedX: { min: -60, max: -100 },
          scale: { start: 1, end: 0.5 },
          alpha: { start: 0.9, end: 0.2 },
          frequency: 12,
        }),
      [WeatherType.Fog]: () =>
        this.scene.add.particles(0, 0, "particle_fog", {
          x: { min: 0, max: w },
          y: { min: 0, max: h },
          quantity: 2,
          lifespan: 6000,
          speedX: { min: 8, max: 25 },
          speedY: { min: -5, max: 5 },
          scale: { start: 2.5, end: 6 },
          alpha: { start: 0.4, end: 0.05 },
          frequency: 100,
        }),
    };

    const factory = configs[weather];
    if (factory) {
      this.weatherParticles = factory();
      this.weatherParticles.setDepth(15);
    }

    // Sporadic lightning flashes during storms
    if (weather === WeatherType.Storm) {
      const scheduleFlash = (): void => {
        this.stormLightningTimer = this.scene.time.delayedCall(
          2000 + Math.random() * 6000,
          () => {
            this.scene.cameras.main.flash(120, 255, 255, 255, true);
            scheduleFlash();
          },
        );
      };
      scheduleFlash();
    }
  }

  /** Spawn biome decoration creature emitters on an overworld chunk. */
  spawnBiomeCreatures(chunk: WorldChunk, isExplored: (x: number, y: number) => boolean): void {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (!isExplored(x, y)) continue;
        const terrain = chunk.mapData[y][x];
        const entry = DECO_CREATURES[terrain];
        if (!entry) continue;
        const px = x * TILE_SIZE + TILE_SIZE / 2;
        const py = y * TILE_SIZE + TILE_SIZE / 2;
        const em = this.scene.add.particles(px, py, entry.texture, entry.config);
        em.setDepth(12);
        this.biomeDecoEmitters.push(em);
      }
    }
  }

  /** Clear weather particles and lightning timer. */
  clearWeatherParticles(): void {
    this.weatherParticles?.stop();
    this.weatherParticles = null;
    this.stormLightningTimer?.remove();
    this.stormLightningTimer = null;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /** Render dungeon interior tiles. */
  private renderDungeon(player: PlayerState, isExplored: (x: number, y: number) => boolean): void {
    const dungeon = getDungeon(player.position.dungeonId);
    if (!dungeon) return;
    const levelMap = getDungeonLevelMap(dungeon, player.position.dungeonLevel);

    for (let y = 0; y < MAP_HEIGHT; y++) {
      this.tileSprites[y] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        const explored = isExplored(x, y);
        const terrain = levelMap[y][x];
        let texKey = explored ? `tile_${terrain}` : "tile_fog";
        if (explored && terrain === Terrain.Chest) {
          const chest = getChestAt(x, y, { type: "dungeon", dungeonId: player.position.dungeonId });
          if (chest && player.progression.openedChests.includes(chest.id)) {
            texKey = "tile_chest_open";
          }
        }
        const sprite = this.scene.add.sprite(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          texKey,
        );
        this.tileSprites[y][x] = sprite;
      }
    }

    // Dungeon name label
    const levelLabel = (dungeon.levels?.length ?? 0) > 0 ? ` (Level ${player.position.dungeonLevel + 1})` : "";
    this.scene.add
      .text(MAP_WIDTH * TILE_SIZE / 2, 4, `${dungeon.name}${levelLabel}`, {
        fontSize: "10px",
        fontFamily: "monospace",
        color: "#ff8888",
        stroke: "#000",
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0);

    // Exit and stairs labels
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const t = levelMap[y][x];
        if (t === Terrain.DungeonExit && isExplored(x, y)) {
          this.scene.add
            .text(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE - 4, "EXIT", {
              fontSize: "8px",
              fontFamily: "monospace",
              color: "#88ff88",
              stroke: "#000",
              strokeThickness: 2,
            })
            .setOrigin(0.5, 1);
        }
        if (t === Terrain.DungeonStairs && isExplored(x, y)) {
          this.scene.add
            .text(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE - 4, "STAIRS", {
              fontSize: "8px",
              fontFamily: "monospace",
              color: "#bb88ff",
              stroke: "#000",
              strokeThickness: 2,
            })
            .setOrigin(0.5, 1);
        }
        if (t === Terrain.DungeonBoss && isExplored(x, y)) {
          this.scene.add
            .text(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE - 4, "BOSS", {
              fontSize: "8px",
              fontFamily: "monospace",
              color: "#ff4444",
              stroke: "#000",
              strokeThickness: 2,
            })
            .setOrigin(0.5, 1);
        }
      }
    }
  }

  /** Render city interior tiles with biome-appropriate materials. */
  private renderCity(
    player: PlayerState,
    isExplored: (x: number, y: number) => boolean,
    cityRenderer: CityRenderer,
    timeStep: number = 0,
  ): void {
    const city = getCity(player.position.cityId);
    if (!city) return;

    const cityBiome = getTownBiome(city.chunkX, city.chunkY, city.tileX, city.tileY);
    const biomeFloorTex = `tile_${cityBiome}`;
    const biomeWallTex = BIOME_WALL_MAP[cityBiome] ?? `tile_${Terrain.CityWall}`;
    const biomePathTex = BIOME_PATH_MAP[cityBiome] ?? "tile_path_cobble";

    // Build carpet map from shop types
    const shopCarpetMap = new Map<string, string>();
    for (const shop of city.shops) {
      const carpetTex = SHOP_CARPET_TEX[shop.type];
      shopCarpetMap.set(`${shop.x},${shop.y}`, carpetTex ?? biomeFloorTex);
    }

    // Build shop floor map via flood-fill from each shop entrance
    cityRenderer.shopFloorMap.clear();
    for (let si = 0; si < city.shops.length; si++) {
      const shop = city.shops[si];
      const queue: { x: number; y: number }[] = [];
      const visited = new Set<string>();
      for (let dy = -3; dy <= 0; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const tx = shop.x + dx;
          const ty = shop.y + dy;
          if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
            if (city.mapData[ty][tx] === Terrain.ShopFloor) {
              const key = `${tx},${ty}`;
              if (!visited.has(key)) { visited.add(key); queue.push({ x: tx, y: ty }); }
            }
          }
        }
      }
      while (queue.length > 0) {
        const cur = queue.pop()!;
        cityRenderer.shopFloorMap.set(`${cur.x},${cur.y}`, si);
        for (const [ddx, ddy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nx = cur.x + ddx;
          const ny = cur.y + ddy;
          const key = `${nx},${ny}`;
          if (visited.has(key)) continue;
          if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;
          if (city.mapData[ny][nx] === Terrain.ShopFloor) {
            visited.add(key);
            queue.push({ x: nx, y: ny });
          }
        }
      }
    }

    const activeShopIdx = cityRenderer.getPlayerShopIndex(city, player.position.x, player.position.y);

    for (let y = 0; y < MAP_HEIGHT; y++) {
      this.tileSprites[y] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        const explored = isExplored(x, y);
        const terrain = city.mapData[y][x];
        let texKey = explored ? `tile_${terrain}` : "tile_fog";
        if (explored && terrain === Terrain.CityFloor) texKey = biomeFloorTex;
        if (explored && terrain === Terrain.CityWall) texKey = biomeWallTex;
        if (explored && terrain === Terrain.Carpet) {
          const carpetOverride = shopCarpetMap.get(`${x},${y}`);
          if (carpetOverride) texKey = carpetOverride;
        }
        if (explored && terrain === Terrain.CityPath) texKey = biomePathTex;
        if (terrain === Terrain.ShopFloor) {
          const tileShopIdx = cityRenderer.shopFloorMap.get(`${x},${y}`) ?? -1;
          if (tileShopIdx !== activeShopIdx) texKey = biomeWallTex;
        }
        const sprite = this.scene.add.sprite(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          texKey,
        );
        this.tileSprites[y][x] = sprite;
      }
    }

    // Shop labels and exit label
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (city.mapData[y][x] === Terrain.CityExit && isExplored(x, y)) {
          this.scene.add
            .text(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE - 4, "EXIT", {
              fontSize: "8px",
              fontFamily: "monospace",
              color: "#88ff88",
              stroke: "#000",
              strokeThickness: 2,
            })
            .setOrigin(0.5, 1);
        }
      }
    }
    for (const shop of city.shops) {
      if (isExplored(shop.x, shop.y)) {
        const icon = shop.type === "weapon" ? "⚔" : shop.type === "armor" ? "🛡" : shop.type === "inn" ? "🏨" : shop.type === "bank" ? "🏦" : shop.type === "stable" ? "🐴" : "🏪";
        this.scene.add
          .text(shop.x * TILE_SIZE + TILE_SIZE / 2, shop.y * TILE_SIZE - 6, `${icon} ${shop.name}`, {
            fontSize: "9px",
            fontFamily: "monospace",
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 3,
            backgroundColor: "#00000088",
            padding: { x: 3, y: 1 },
          })
          .setOrigin(0.5, 1)
          .setDepth(15);
      }
    }

    // City animals, NPCs, and shop roofs
    cityRenderer.spawnCityAnimals(city, isExplored);
    cityRenderer.spawnCityNpcs(city, timeStep, isExplored);
    cityRenderer.createShopRoofs(city, cityBiome);
    cityRenderer.updateShopRoofAlpha(cityRenderer.getPlayerShopIndex(city, player.position.x, player.position.y));
  }

  /** Render overworld chunk tiles. */
  private renderOverworld(
    player: PlayerState,
    defeatedBosses: Set<string>,
    isExplored: (x: number, y: number) => boolean,
  ): void {
    const chunk = getChunk(player.position.chunkX, player.position.chunkY);
    if (!chunk) return;

    for (let y = 0; y < MAP_HEIGHT; y++) {
      this.tileSprites[y] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        const explored = isExplored(x, y);
        const terrain = chunk.mapData[y][x];
        let texKey = explored ? `tile_${terrain}` : "tile_fog";
        if (explored && terrain === Terrain.Town) {
          const biome = getTownBiome(player.position.chunkX, player.position.chunkY, x, y);
          texKey = `tile_town_${biome}`;
        }
        if (explored && terrain === Terrain.Chest) {
          const chest = getChestAt(x, y, { type: "overworld", chunkX: player.position.chunkX, chunkY: player.position.chunkY });
          if (chest && player.progression.openedChests.includes(chest.id)) {
            texKey = "tile_chest_open";
          }
        }
        if (explored && hasSparkleAt(player.position.chunkX, player.position.chunkY, x, y)) {
          const tKey = `${player.position.chunkX},${player.position.chunkY},${x},${y}`;
          if (!player.progression.collectedTreasures.includes(tKey)) {
            texKey = `tile_${Terrain.MinorTreasure}`;
          }
        }
        const sprite = this.scene.add.sprite(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          texKey,
        );
        this.tileSprites[y][x] = sprite;
      }
    }

    // Town labels
    for (const town of chunk.towns) {
      if (isExplored(town.x, town.y)) {
        this.scene.add
          .text(town.x * TILE_SIZE + TILE_SIZE / 2, town.y * TILE_SIZE - 4, town.name, {
            fontSize: "9px",
            fontFamily: "monospace",
            color: "#fff",
            stroke: "#000",
            strokeThickness: 2,
          })
          .setOrigin(0.5, 1);
      }
    }

    // Boss markers (if not defeated)
    for (const boss of chunk.bosses) {
      if (!defeatedBosses.has(boss.monsterId) && isExplored(boss.x, boss.y)) {
        this.scene.add
          .text(
            boss.x * TILE_SIZE + TILE_SIZE / 2,
            boss.y * TILE_SIZE - 4,
            "☠ " + boss.name,
            {
              fontSize: "8px",
              fontFamily: "monospace",
              color: "#ff4444",
              stroke: "#000",
              strokeThickness: 2,
            },
          )
          .setOrigin(0.5, 1);
      }
    }

    // Biome decoration emitters
    this.spawnBiomeCreatures(chunk, isExplored);
  }

  /** Reveal newly explored dungeon tiles. */
  private revealDungeonTiles(player: PlayerState, isExplored: (x: number, y: number) => boolean): void {
    const dungeon = getDungeon(player.position.dungeonId);
    if (!dungeon) return;
    const levelMap = getDungeonLevelMap(dungeon, player.position.dungeonLevel);
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (isExplored(x, y) && this.tileSprites[y]?.[x]) {
          const terrain = levelMap[y][x];
          let texKey = `tile_${terrain}`;
          if (terrain === Terrain.Chest) {
            const chest = getChestAt(x, y, { type: "dungeon", dungeonId: player.position.dungeonId });
            if (chest && player.progression.openedChests.includes(chest.id)) {
              texKey = "tile_chest_open";
            }
          }
          this.tileSprites[y][x].setTexture(texKey);
        }
      }
    }
  }

  /** Reveal newly explored city tiles with correct biome textures. */
  private revealCityTiles(
    player: PlayerState,
    isExplored: (x: number, y: number) => boolean,
    getPlayerShopIndex: (city: CityData) => number,
    shopFloorMap: Map<string, number>,
  ): void {
    const city = getCity(player.position.cityId);
    if (!city) return;
    const cityBiome = getTownBiome(city.chunkX, city.chunkY, city.tileX, city.tileY);
    const biomeFloorTex = `tile_${cityBiome}`;
    const biomeWallTex = BIOME_WALL_MAP[cityBiome] ?? `tile_${Terrain.CityWall}`;
    const biomePathTex = BIOME_PATH_MAP[cityBiome] ?? "tile_path_cobble";

    const shopCarpetMap = new Map<string, string>();
    for (const shop of city.shops) {
      const ct = SHOP_CARPET_TEX[shop.type];
      shopCarpetMap.set(`${shop.x},${shop.y}`, ct ?? biomeFloorTex);
    }
    const activeShopIdx = getPlayerShopIndex(city);

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (isExplored(x, y) && this.tileSprites[y]?.[x]) {
          const terrain = city.mapData[y][x];
          let texKey = `tile_${terrain}`;
          if (terrain === Terrain.CityFloor) texKey = biomeFloorTex;
          if (terrain === Terrain.CityWall) texKey = biomeWallTex;
          if (terrain === Terrain.Carpet) {
            const override = shopCarpetMap.get(`${x},${y}`);
            if (override) texKey = override;
          }
          if (terrain === Terrain.CityPath) texKey = biomePathTex;
          if (terrain === Terrain.ShopFloor) {
            const tileShopIdx = shopFloorMap.get(`${x},${y}`) ?? -1;
            if (tileShopIdx !== activeShopIdx) texKey = biomeWallTex;
          }
          this.tileSprites[y][x].setTexture(texKey);
        }
      }
    }
  }

  /** Reveal newly explored overworld tiles. */
  private revealOverworldTiles(player: PlayerState, isExplored: (x: number, y: number) => boolean): void {
    const chunk = getChunk(player.position.chunkX, player.position.chunkY);
    if (!chunk) return;
    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (isExplored(x, y) && this.tileSprites[y]?.[x]) {
          const terrain = chunk.mapData[y][x];
          let texKey = `tile_${terrain}`;
          if (terrain === Terrain.Town) {
            const biome = getTownBiome(player.position.chunkX, player.position.chunkY, x, y);
            texKey = `tile_town_${biome}`;
          }
          if (terrain === Terrain.Chest) {
            const chest = getChestAt(x, y, { type: "overworld", chunkX: player.position.chunkX, chunkY: player.position.chunkY });
            if (chest && player.progression.openedChests.includes(chest.id)) {
              texKey = "tile_chest_open";
            }
          }
          if (hasSparkleAt(player.position.chunkX, player.position.chunkY, x, y)) {
            const tKey = `${player.position.chunkX},${player.position.chunkY},${x},${y}`;
            if (!player.progression.collectedTreasures.includes(tKey)) {
              texKey = `tile_${Terrain.MinorTreasure}`;
            }
          }
          this.tileSprites[y][x].setTexture(texKey);
        }
      }
    }
  }
}
