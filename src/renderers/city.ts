/**
 * CityRenderer — handles city NPC spawning, city animals, shop roofs,
 * and NPC texture generation.  Extracted from OverworldScene for modularity.
 */

import type { CityChunk, CityData, CityShopData } from "../data/map";
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  Terrain,
  isWalkable,
  getCity,
  getCityChunk,
} from "../data/map";
import {
  CITY_NPCS, getNpcTemplate, getNpcColors,
  type NpcInstance, type NpcTemplate,
} from "../data/npcs";
import { getTimePeriod, TimePeriod } from "../systems/daynight";
import type { PlayerState } from "../systems/player";
import { TILE_SIZE } from "../config";

export class CityRenderer {
  private scene: Phaser.Scene;

  /** Active animal sprites in the current city. */
  cityAnimals: Phaser.GameObjects.Sprite[] = [];
  /** Wander timers for moving animals. */
  cityAnimalTimers: Phaser.Time.TimerEvent[] = [];
  /** Active NPC sprites in the current city. */
  cityNpcSprites: Phaser.GameObjects.Sprite[] = [];
  /** Wander timers for moving NPCs. */
  cityNpcTimers: Phaser.Time.TimerEvent[] = [];
  /** NPC instance data for the current city. */
  cityNpcData: NpcInstance[] = [];
  /** Graphics objects for shop roof overlays. */
  shopRoofGraphics: Phaser.GameObjects.Graphics[] = [];
  /** Bounding rectangles for each shop roof. */
  shopRoofBounds: { x: number; y: number; w: number; h: number; shopX: number; shopY: number; shopIdx: number }[] = [];
  /** Maps "x,y" → shop index for ShopFloor tiles. */
  shopFloorMap: Map<string, number> = new Map();
  /** Maps shop index → group id for merged shops sharing the same roof area. */
  shopGroupMap: Map<number, number> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // ── Animals ──────────────────────────────────────────────────────────

  /** Spawn animated animal sprites in a city's primary chunk. */
  spawnCityAnimals(
    city: CityData,
    cityMap: Terrain[][],
    chunkIndex: number,
    isExplored: (x: number, y: number) => boolean,
  ): void {
    if (chunkIndex !== 0) return;
    // Animal definitions per city
    const CITY_ANIMALS: Record<string, Array<{ sprite: string; x: number; y: number; moves: boolean }>> = {
      willowdale_city: [
        { sprite: "sprite_chicken", x: 8, y: 5, moves: true },
        { sprite: "sprite_chicken", x: 11, y: 8, moves: true },
        { sprite: "sprite_chicken", x: 14, y: 5, moves: true },
        { sprite: "sprite_dog", x: 9, y: 10, moves: true },
      ],
      ironhold_city: [
        { sprite: "sprite_cow", x: 12, y: 8, moves: true },
        { sprite: "sprite_sheep", x: 10, y: 9, moves: true },
      ],
      frostheim_city: [
        { sprite: "sprite_cat", x: 5, y: 7, moves: false },
        { sprite: "sprite_cat", x: 14, y: 7, moves: false },
        { sprite: "sprite_sheep", x: 10, y: 9, moves: true },
      ],
      deeproot_city: [
        { sprite: "sprite_cat", x: 9, y: 6, moves: false },
        { sprite: "sprite_cat", x: 11, y: 8, moves: false },
        { sprite: "sprite_sheep", x: 7, y: 12, moves: true },
        { sprite: "sprite_sheep", x: 9, y: 12, moves: true },
      ],
      sandport_city: [
        { sprite: "sprite_cat", x: 12, y: 9, moves: false },
        { sprite: "sprite_chicken", x: 7, y: 7, moves: true },
        { sprite: "sprite_chicken", x: 9, y: 6, moves: true },
      ],
      bogtown_city: [
        { sprite: "sprite_mouse", x: 8, y: 7, moves: true },
        { sprite: "sprite_mouse", x: 12, y: 6, moves: true },
        { sprite: "sprite_frog", x: 10, y: 10, moves: true },
      ],
      thornvale_city: [
        { sprite: "sprite_frog", x: 9, y: 8, moves: true },
        { sprite: "sprite_frog", x: 11, y: 7, moves: true },
        { sprite: "sprite_cow", x: 8, y: 12, moves: true },
        { sprite: "sprite_cow", x: 13, y: 8, moves: true },
        { sprite: "sprite_sheep", x: 10, y: 10, moves: true },
      ],
      canyonwatch_city: [
        { sprite: "sprite_dog", x: 10, y: 8, moves: true },
        { sprite: "sprite_chicken", x: 8, y: 6, moves: true },
        { sprite: "sprite_chicken", x: 12, y: 6, moves: true },
      ],
      ridgewatch_city: [
        { sprite: "sprite_sheep", x: 8, y: 7, moves: true },
        { sprite: "sprite_sheep", x: 11, y: 7, moves: true },
        { sprite: "sprite_sheep", x: 9, y: 9, moves: true },
        { sprite: "sprite_dog", x: 13, y: 8, moves: true },
      ],
      ashfall_city: [
        { sprite: "sprite_lizard", x: 9, y: 8, moves: true },
        { sprite: "sprite_lizard", x: 12, y: 5, moves: true },
      ],
      dunerest_city: [
        { sprite: "sprite_lizard", x: 7, y: 7, moves: true },
        { sprite: "sprite_cat", x: 10, y: 9, moves: false },
      ],
      shadowfen_city: [
        { sprite: "sprite_frog", x: 8, y: 8, moves: true },
        { sprite: "sprite_mouse", x: 11, y: 10, moves: true },
      ],
    };

    const animals = CITY_ANIMALS[city.id];
    if (!animals) return;

    const ANIMAL_SCALE: Record<string, number> = {
      sprite_cow: 2.5,
      sprite_dog: 1.6,
      sprite_sheep: 1.8,
      sprite_cat: 1.3,
      sprite_chicken: 1.0,
      sprite_frog: 0.8,
      sprite_mouse: 0.7,
      sprite_lizard: 0.9,
    };

    for (const def of animals) {
      if (!isExplored(def.x, def.y)) continue;

      const sprite = this.scene.add.sprite(
        def.x * TILE_SIZE + TILE_SIZE / 2,
        def.y * TILE_SIZE + TILE_SIZE / 2,
        def.sprite
      );
      const animalScale = ANIMAL_SCALE[def.sprite] ?? 1.0;
      sprite.setScale(animalScale);
      sprite.setDepth(11);
      this.cityAnimals.push(sprite);

      if (def.moves) {
        const wander = (): void => {
          const dirs = [
            { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
            { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
          ];
          const pick = dirs[Math.floor(Math.random() * dirs.length)];
          const curTileX = Math.floor(sprite.x / TILE_SIZE);
          const curTileY = Math.floor(sprite.y / TILE_SIZE);
          const nx = curTileX + pick.dx;
          const ny = curTileY + pick.dy;
          if (
            nx >= 1 && nx < MAP_WIDTH - 1 &&
            ny >= 1 && ny < MAP_HEIGHT - 1 &&
            isWalkable(cityMap[ny][nx])
          ) {
            this.scene.tweens.add({
              targets: sprite,
              x: nx * TILE_SIZE + TILE_SIZE / 2,
              y: ny * TILE_SIZE + TILE_SIZE / 2,
              duration: 600 + Math.random() * 400,
              ease: "Sine.easeInOut",
              onUpdate: () => {
                if (pick.dx !== 0) sprite.setFlipX(pick.dx < 0);
              },
            });
          }
        };
        const delay = 1500 + Math.random() * 2000;
        const timer = this.scene.time.addEvent({ delay, callback: wander, loop: true });
        this.cityAnimalTimers.push(timer);
      } else {
        this.scene.tweens.add({
          targets: sprite,
          scaleY: animalScale * 0.9,
          duration: 1200,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    }
  }

  // ── Shop Roofs ───────────────────────────────────────────────────────

  /**
   * Draw roof overlays over shop buildings.  Each shop has a cluster of
   * CityWall + ShopFloor tiles that form the structure; the roof covers
   * them and fades out when the player is inside.
   */
  createShopRoofs(
    cityMap: Terrain[][],
    shops: CityShopData[],
    biome: Terrain,
  ): void {
    // Biome-based roof colour palettes
    const BIOME_ROOF_COLORS: Record<number, { base: number; ridge: number; border: number }> = {
      [Terrain.Grass]:      { base: 0x8d6e63, ridge: 0x6d4c41, border: 0x4e342e },
      [Terrain.Forest]:     { base: 0x5d7a4f, ridge: 0x3e5a30, border: 0x2e4420 },
      [Terrain.DeepForest]: { base: 0x4a6040, ridge: 0x334830, border: 0x223420 },
      [Terrain.Sand]:       { base: 0xc8a864, ridge: 0xa08844, border: 0x806830 },
      [Terrain.Tundra]:     { base: 0x8899aa, ridge: 0x667788, border: 0x445566 },
      [Terrain.Swamp]:      { base: 0x5a5a4a, ridge: 0x3e3e30, border: 0x2a2a20 },
      [Terrain.Volcanic]:   { base: 0x6a3a2a, ridge: 0x4a2a1a, border: 0x3a1a0a },
      [Terrain.Canyon]:     { base: 0xb07050, ridge: 0x905838, border: 0x704028 },
    };
    const palette = BIOME_ROOF_COLORS[biome] ?? BIOME_ROOF_COLORS[Terrain.Grass];

    // Global visited set so merged shop areas are claimed by the first shop only
    const globalVisited = new Set<string>();

    for (let si = 0; si < shops.length; si++) {
      const shop = shops[si];
      const tiles: { x: number; y: number }[] = [];
      const queue: { x: number; y: number }[] = [];

      // Seed: scan a small area around the shop entrance for ShopFloor tiles
      for (let dy = -3; dy <= 0; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const tx = shop.x + dx;
          const ty = shop.y + dy;
          if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
            const t = cityMap[ty][tx];
            if (t === Terrain.ShopFloor) {
              const key = `${tx},${ty}`;
              if (!globalVisited.has(key)) {
                globalVisited.add(key);
                queue.push({ x: tx, y: ty });
                tiles.push({ x: tx, y: ty });
                this.shopFloorMap.set(key, si);
              }
            }
          }
        }
      }

      // Expand through connected ShopFloor tiles (walls are no longer part of shops)
      while (queue.length > 0) {
        const cur = queue.pop()!;
        for (const [ddx, ddy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nx = cur.x + ddx;
          const ny = cur.y + ddy;
          const key = `${nx},${ny}`;
          if (globalVisited.has(key)) continue;
          if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;
          const t = cityMap[ny][nx];
          if (t === Terrain.ShopFloor) {
            globalVisited.add(key);
            queue.push({ x: nx, y: ny });
            tiles.push({ x: nx, y: ny });
            this.shopFloorMap.set(key, si);
          }
        }
      }

      if (tiles.length === 0) continue;

      // Compute bounding box
      let minX = tiles[0].x, maxX = tiles[0].x, minY = tiles[0].y, maxY = tiles[0].y;
      for (const t of tiles) {
        if (t.x < minX) minX = t.x;
        if (t.x > maxX) maxX = t.x;
        if (t.y < minY) minY = t.y;
        if (t.y > maxY) maxY = t.y;
      }

      const bx = minX * TILE_SIZE;
      const by = minY * TILE_SIZE;
      const bw = (maxX - minX + 1) * TILE_SIZE;
      const bh = (maxY - minY + 1) * TILE_SIZE;

      // Draw a roof graphic over the building area
      const gfx = this.scene.add.graphics();
      gfx.setDepth(14); // above NPCs (11) and animals (11) but below HUD

      // Main roof colour — vary slightly by shop type
      const typeShift = shop.type === "inn" ? 0x101010 : shop.type === "weapon" ? -0x080808 : 0;
      const roofColor = Math.max(0, palette.base + typeShift);
      gfx.fillStyle(roofColor, 1);
      gfx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);

      // Ridge lines for a tiled-roof look
      gfx.lineStyle(1, palette.ridge, 0.6);
      for (let ry = by; ry < by + bh; ry += 6) {
        gfx.lineBetween(bx - 2, ry, bx + bw + 2, ry);
      }

      // Roof border
      gfx.lineStyle(2, palette.border, 0.9);
      gfx.strokeRect(bx - 2, by - 2, bw + 4, bh + 4);

      // Ridge cap (center horizontal line)
      gfx.lineStyle(2, palette.ridge, 0.8);
      gfx.lineBetween(bx - 2, by + bh / 2, bx + bw + 2, by + bh / 2);

      this.shopRoofGraphics.push(gfx);
      this.shopRoofBounds.push({
        x: minX, y: minY,
        w: maxX - minX + 1, h: maxY - minY + 1,
        shopX: shop.x, shopY: shop.y, shopIdx: si,
      });
    }

    // Build shop groups: shops whose carpet entrance is adjacent to ShopFloor
    // tiles claimed by another shop are in the same group.
    let nextGroup = 0;
    for (let si = 0; si < shops.length; si++) {
      if (this.shopGroupMap.has(si)) continue;
      // Check if this shop's entrance area connects to another shop's floor
      const shop = shops[si];
      const adjacentShops = new Set<number>();
      adjacentShops.add(si);
      for (let dy = -1; dy <= 0; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const key = `${shop.x + dx},${shop.y + dy}`;
          const owner = this.shopFloorMap.get(key);
          if (owner !== undefined) adjacentShops.add(owner);
        }
      }
      // Assign the same group to all connected shops
      const groupId = nextGroup++;
      for (const idx of adjacentShops) {
        this.shopGroupMap.set(idx, groupId);
      }
    }
    // Merge groups: if two shops map to different groups but share a connection
    // (transitive closure)
    let changed = true;
    while (changed) {
      changed = false;
      for (let si = 0; si < shops.length; si++) {
        const shop = shops[si];
        const myGroup = this.shopGroupMap.get(si) ?? -1;
        for (let dy = -1; dy <= 0; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const key = `${shop.x + dx},${shop.y + dy}`;
            const owner = this.shopFloorMap.get(key);
            if (owner !== undefined) {
              const otherGroup = this.shopGroupMap.get(owner) ?? -1;
              if (otherGroup !== myGroup && otherGroup >= 0 && myGroup >= 0) {
                // Merge: set all shops in otherGroup to myGroup
                const minGroup = Math.min(myGroup, otherGroup);
                const maxGroup = Math.max(myGroup, otherGroup);
                for (const [k, v] of this.shopGroupMap) {
                  if (v === maxGroup) this.shopGroupMap.set(k, minGroup);
                }
                changed = true;
              }
            }
          }
        }
      }
    }
  }

  /** Return the shop index the player is currently inside (-1 if not in any shop). */
  getPlayerShopIndex(
    cityMap: Terrain[][],
    shops: CityShopData[],
    playerX: number,
    playerY: number,
  ): number {
    const terrain = cityMap[playerY]?.[playerX];
    if (terrain === Terrain.ShopFloor) {
      return this.shopFloorMap.get(`${playerX},${playerY}`) ?? -1;
    }
    if (terrain === Terrain.Carpet) {
      for (let si = 0; si < shops.length; si++) {
        if (shops[si].x === playerX && shops[si].y === playerY) return si;
      }
      // Check if adjacent ShopFloor tiles belong to a shop
      for (const [ddx, ddy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const key = `${playerX + ddx},${playerY + ddy}`;
        const owner = this.shopFloorMap.get(key);
        if (owner !== undefined) return owner;
      }
    }
    return -1;
  }

  /** Fade shop roofs: transparent when the player is inside the shop or its merged group. */
  updateShopRoofAlpha(activeShopIdx: number): void {
    // Find the group id for the active shop
    const activeGroup = activeShopIdx >= 0 ? (this.shopGroupMap.get(activeShopIdx) ?? -1) : -1;
    for (let i = 0; i < this.shopRoofBounds.length; i++) {
      const gfx = this.shopRoofGraphics[i];
      if (!gfx) continue;
      const roofShopIdx = this.shopRoofBounds[i].shopIdx;
      const roofGroup = this.shopGroupMap.get(roofShopIdx) ?? -1;
      const isActive = roofShopIdx === activeShopIdx || (activeGroup >= 0 && roofGroup === activeGroup);
      gfx.setAlpha(isActive ? 0.1 : 1);
    }
  }

  // ── NPC Textures ─────────────────────────────────────────────────────

  /**
   * Generate (or retrieve from cache) an NPC texture with skin, hair, and
   * dress colours baked in so that `setTint` isn't needed.  This prevents the
   * entire sprite — skin, hair, legs — from being tinted a single colour.
   */
  getOrCreateNpcTexture(
    tpl: NpcTemplate,
    skinColor: number,
    hairColor: number,
    dressColor: number,
  ): string {
    const key = `npc_${tpl.id}_${skinColor.toString(16)}_${hairColor.toString(16)}_${dressColor.toString(16)}`;
    if (this.scene.textures.exists(key)) return key;

    const S = TILE_SIZE;
    const gfx = this.scene.add.graphics();
    const isChild = tpl.ageGroup === "child";
    const bodyW = isChild ? 10 : 14;
    const bodyH = isChild ? 10 : 14;
    const headR = isChild ? 5 : 6;
    const legW = isChild ? 3 : 4;
    const legH = isChild ? 4 : 5;
    const bx = Math.floor((S - bodyW) / 2);
    const by = isChild ? 14 : 10;

    // Body / dress — uses the per-instance dress colour
    gfx.fillStyle(dressColor, 1);
    gfx.fillRect(bx, by, bodyW, bodyH);

    // Head — real skin colour
    gfx.fillStyle(skinColor, 1);
    gfx.fillCircle(S / 2, by - headR + 2, headR);

    // Hair
    gfx.fillStyle(hairColor, 1);
    if (tpl.ageGroup === "child") {
      gfx.fillRect(S / 2 - headR + 1, by - headR * 2 + 3, headR * 2 - 2, 3);
    } else if (tpl.ageGroup === "female") {
      gfx.fillRect(S / 2 - headR, by - headR * 2 + 2, headR * 2, 4);
      gfx.fillRect(S / 2 - headR, by - headR + 4, 2, headR);
      gfx.fillRect(S / 2 + headR - 2, by - headR + 4, 2, headR);
    } else {
      gfx.fillRect(S / 2 - headR + 1, by - headR * 2 + 2, headR * 2 - 2, 4);
    }

    // Eyes
    gfx.fillStyle(0x111111, 1);
    gfx.fillRect(S / 2 - 2, by - headR + 3, 1, 1);
    gfx.fillRect(S / 2 + 2, by - headR + 3, 1, 1);

    // Legs — neutral brown
    gfx.fillStyle(0x6d4c41, 1);
    gfx.fillRect(bx + 1, by + bodyH, legW, legH);
    gfx.fillRect(bx + bodyW - legW - 1, by + bodyH, legW, legH);

    gfx.generateTexture(key, S, S);
    gfx.destroy();
    return key;
  }

  // ── City NPCs ────────────────────────────────────────────────────────

  /** Clear existing city NPCs and re-spawn them (used after inn rest to reflect time change). */
  respawnCityNpcs(player: PlayerState, timeStep: number, isExplored: (x: number, y: number) => boolean): void {
    if (!player.position.inCity) return;
    const city = getCity(player.position.cityId);
    if (!city) return;
    const chunk = getCityChunk(city, player.position.cityChunkIndex);
    if (!chunk) return;
    // Destroy existing NPC sprites and timers
    for (const s of this.cityNpcSprites) s.destroy();
    this.cityNpcSprites = [];
    for (const t of this.cityNpcTimers) t.destroy();
    this.cityNpcTimers = [];
    this.cityNpcData = [];
    // Re-spawn
    this.spawnCityNpcs(
      city,
      chunk,
      player.position.cityChunkIndex,
      timeStep,
      isExplored,
    );
  }

  /** Spawn NPC sprites in cities with wandering / stationary behaviour. */
  spawnCityNpcs(
    city: CityData,
    chunk: CityChunk,
    chunkIndex: number,
    timeStep: number,
    isExplored: (x: number, y: number) => boolean,
  ): void {
    if (chunkIndex !== 0) return;
    const npcs = CITY_NPCS[city.id];
    if (!npcs) return;

    const isNight = getTimePeriod(timeStep) === TimePeriod.Night;

    // At night, track how many non-essential NPCs we keep (about 30%)
    let nonEssentialCount = 0;

    this.cityNpcData = npcs;

    for (let i = 0; i < npcs.length; i++) {
      const def = npcs[i];
      const tpl = getNpcTemplate(def.templateId);
      if (!tpl) continue;

      // At night, skip most non-essential NPCs (children always go, most villagers too)
      if (isNight && def.shopIndex === undefined) {
        const isGuard = def.templateId.startsWith("guard_");
        const isChild = tpl.ageGroup === "child";
        if (isChild) {
          // Children are never out at night
          continue;
        }
        if (!isGuard) {
          // Keep only ~30% of regular villagers at night
          nonEssentialCount++;
          if (nonEssentialCount % 3 !== 0) continue;
        }
      }

      // Shopkeeper NPCs are placed inside their shop (on the nearest ShopFloor tile)
      let spawnX = def.x;
      let spawnY = def.y;
      if (def.shopIndex !== undefined) {
        const shop = chunk.shops[def.shopIndex];
        if (shop) {
          // Search for a ShopFloor tile near the shop entrance (carpet)
          for (let dy = -2; dy <= 0; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const tx = shop.x + dx;
              const ty = shop.y + dy;
              if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
                if (chunk.mapData[ty][tx] === Terrain.ShopFloor) {
                  spawnX = tx;
                  spawnY = ty;
                }
              }
            }
          }
        }
      }

      if (!isExplored(spawnX, spawnY)) continue;

      // Generate a per-instance texture with proper skin/hair/dress colours
      const colors = getNpcColors(city.id, i);
      // Elders always have grey hair
      const hairColor = def.templateId.includes("elder") ? 0xaaaaaa : colors.hairColor;
      const texKey = this.getOrCreateNpcTexture(tpl, colors.skinColor, hairColor, colors.dressColor);
      const sprite = this.scene.add.sprite(
        spawnX * TILE_SIZE + TILE_SIZE / 2,
        spawnY * TILE_SIZE + TILE_SIZE / 2,
        texKey
      );
      sprite.setDepth(11);

      // Scale children smaller
      if (tpl.heightScale < 1) {
        sprite.setScale(tpl.heightScale);
      }

      this.cityNpcSprites.push(sprite);

      if (def.moves) {
        const wander = (): void => {
          const dirs = [
            { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
            { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
          ];
          const pick = dirs[Math.floor(Math.random() * dirs.length)];
          const curTileX = Math.floor(sprite.x / TILE_SIZE);
          const curTileY = Math.floor(sprite.y / TILE_SIZE);
          const nx = curTileX + pick.dx;
          const ny = curTileY + pick.dy;
          if (
            nx >= 1 && nx < MAP_WIDTH - 1 &&
            ny >= 1 && ny < MAP_HEIGHT - 1 &&
            isWalkable(chunk.mapData[ny][nx])
          ) {
            this.scene.tweens.add({
              targets: sprite,
              x: nx * TILE_SIZE + TILE_SIZE / 2,
              y: ny * TILE_SIZE + TILE_SIZE / 2,
              duration: 800 + Math.random() * 400,
              ease: "Sine.easeInOut",
              onUpdate: () => {
                if (pick.dx !== 0) sprite.setFlipX(pick.dx < 0);
              },
            });
          }
        };
        const delay = 2000 + Math.random() * 2000;
        const timer = this.scene.time.addEvent({
          delay,
          callback: wander,
          loop: true,
        });
        this.cityNpcTimers.push(timer);
      } else {
        // Idle breathing for stationary NPCs
        this.scene.tweens.add({
          targets: sprite,
          scaleY: (tpl.heightScale < 1 ? tpl.heightScale : 1) * 0.97,
          duration: 1500,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    }
  }

  // ── Cleanup ──────────────────────────────────────────────────────────

  /** Destroy all sprites, timers, and graphics and reset arrays. */
  clearAll(): void {
    for (const a of this.cityAnimals) a.destroy();
    this.cityAnimals = [];
    for (const t of this.cityAnimalTimers) t.destroy();
    this.cityAnimalTimers = [];

    for (const s of this.cityNpcSprites) s.destroy();
    this.cityNpcSprites = [];
    for (const t of this.cityNpcTimers) t.destroy();
    this.cityNpcTimers = [];
    this.cityNpcData = [];

    for (const g of this.shopRoofGraphics) g.destroy();
    this.shopRoofGraphics = [];
    this.shopRoofBounds = [];

    this.shopFloorMap.clear();
    this.shopGroupMap.clear();
  }
}
