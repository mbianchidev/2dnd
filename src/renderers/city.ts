/**
 * CityRenderer — handles city NPC spawning, city animals and NPC textures.
 */

import type { CityChunk, CityData } from "../data/map";
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  Terrain,
  isWalkable,
  getCity,
  getCityChunk,
} from "../data/map";
import {
  CITY_NPCS,
  type NpcInstance, type NpcTemplate,
} from "../data/npcs";
import { getTimePeriod, TimePeriod } from "../systems/daynight";
import { isReducedMotionEnabled } from "../systems/accessibility";
import type { PlayerState } from "../systems/player";
import { TILE_SIZE } from "../config";
import { resolveCityShopkeeperVisual, resolveNpcVisual } from "../systems/npcVisuals";
import { getOrCreateNpcTexture } from "./npcTextures";
import { getInteriorForShop } from "../data/cityInteriors";
import { getScaledBounds } from "../managers/layout";
import { createOverlayContainer } from "../utils/ui";

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
  /** Quest markers aligned with the rendered city NPC arrays. */
  questNpcMarkers: Array<Phaser.GameObjects.Text | null> = [];
  private shopkeeperContainer: Phaser.GameObjects.Container | null = null;

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
        { sprite: "sprite_chicken", x: 12, y: 5, moves: true },
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
          if (isReducedMotionEnabled()) return;
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
                if (!sprite.active) return;
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
    return getOrCreateNpcTexture(this.scene, tpl, skinColor, hairColor, dressColor);
  }

  // ── City NPCs ────────────────────────────────────────────────────────

  /** Clear existing city NPCs and re-spawn them (used after inn rest to reflect time change). */
  respawnCityNpcs(
    player: PlayerState, timeStep: number, isExplored: (x: number, y: number) => boolean,
    interactInterior: (id: string) => void,
  ): void {
    if (!player.position.inCity) return;
    const city = getCity(player.position.cityId);
    if (!city) return;
    const chunk = getCityChunk(city, player.position.cityChunkIndex);
    if (!chunk) return;
    // Destroy existing NPC sprites and timers
    for (const s of this.cityNpcSprites) {
      this.scene.tweens.killTweensOf(s);
      s.destroy();
    }
    this.cityNpcSprites = [];
    this.shopkeeperContainer?.destroy(true);
    this.shopkeeperContainer = null;
    for (const marker of this.questNpcMarkers) marker?.destroy();
    this.questNpcMarkers = [];
    for (const t of this.cityNpcTimers) t.destroy();
    this.cityNpcTimers = [];
    this.cityNpcData = [];
    if (chunk.interior) {
      this.spawnInteriorShopkeeper(city, chunk, interactInterior);
      return;
    }
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

    this.cityNpcData = [];

    for (let i = 0; i < npcs.length; i++) {
      const def = npcs[i];
      if (def.shopIndex !== undefined && chunk.shops[def.shopIndex]
        && getInteriorForShop(city, chunkIndex, chunk.shops[def.shopIndex]!)) continue;
      const visual = resolveNpcVisual(city.id, i);
      const tpl = visual.template;

      // At night, skip most non-essential NPCs (children always go, most villagers too)
      if (isNight && def.shopIndex === undefined && !def.questNpcId) {
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

      if (!isExplored(spawnX, spawnY) && !def.questNpcId) continue;

      // Generate a per-instance texture with proper skin/hair/dress colours
      const texKey = this.getOrCreateNpcTexture(
        tpl, visual.skinColor, visual.hairColor, visual.dressColor,
      );
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
      this.cityNpcData.push(def);

      if (def.moves) {
        const wander = (): void => {
          if (isReducedMotionEnabled()) return;
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
              onUpdate: (tween: Phaser.Tweens.Tween) => {
                if (!sprite.active) return;
                if (pick.dx !== 0) sprite.setFlipX(pick.dx < 0);
                sprite.setTexture(`${texKey}_walk_${tween.progress < 0.5 ? 0 : 1}`);
              },
              onComplete: () => { if (sprite.active) sprite.setTexture(texKey); },
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
      } else if (!isReducedMotionEnabled()) {
        // Idle breathing for stationary NPCs
        this.scene.tweens.add({
          targets: sprite,
          scaleY: (tpl.heightScale < 1 ? tpl.heightScale : 1) * 0.97,
          duration: 1500,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
          onYoyo: () => { if (sprite.active) sprite.setTexture(`${texKey}_idle_1`); },
          onRepeat: () => { if (sprite.active) sprite.setTexture(texKey); },
        });
      }
    }
  }

  /** Refresh `!` and `?` markers for currently actionable named NPCs. */
  refreshQuestMarkers(
    getMarker: (
      npcId: NonNullable<NpcInstance["questNpcId"]>,
    ) => "available" | "active" | null,
  ): void {
    for (const marker of this.questNpcMarkers) marker?.destroy();
    this.questNpcMarkers = new Array(this.cityNpcData.length).fill(null);

    for (const [index, npc] of this.cityNpcData.entries()) {
      if (!npc.questNpcId) continue;
      const markerType = getMarker(npc.questNpcId);
      const sprite = this.cityNpcSprites[index];
      if (!markerType || !sprite) continue;
      const marker = this.scene.add.text(
        sprite.x,
        sprite.y - TILE_SIZE / 2 - 4,
        markerType === "available" ? "!" : "?",
        {
          fontSize: "14px",
          fontFamily: "monospace",
          color: markerType === "available" ? "#ffd740" : "#80cbc4",
          stroke: "#000000",
          strokeThickness: 3,
        },
      ).setOrigin(0.5, 1).setDepth(12);
      this.questNpcMarkers[index] = marker;
    }
  }

  spawnInteriorShopkeeper(city: CityData, chunk: CityChunk, interact: (id: string) => void): void {
    const interior = chunk.interior;
    if (!interior || interior.kind !== "shop") return;
    const shop = chunk.shops[0];
    const counter = interior.props.find((prop) => prop.kind === "counter");
    if (!shop || !counter) throw new Error(`[interiors] Missing service counter in ${city.id}:${interior.id}.`);
    const visual = resolveCityShopkeeperVisual(city, interior.sourceChunkIndex, shop);
    const template = visual.template;
    const texture = this.getOrCreateNpcTexture(template,
      visual.skinColor, visual.hairColor, visual.dressColor);
    this.shopkeeperContainer = createOverlayContainer(this.scene, "city-shopkeeper", 11, {
      x: 0, y: 0, width: MAP_WIDTH * TILE_SIZE, height: MAP_HEIGHT * TILE_SIZE,
    });
    const sprite = this.scene.add.sprite(
      (counter.x + 0.5) * TILE_SIZE, (counter.y - 0.5) * TILE_SIZE, texture,
    ).setData("layoutId", "city-shopkeeper").setData("label", `${shop.name} clerk`);
    sprite.setData("layoutBounds", getScaledBounds(sprite));
    sprite.setInteractive({ useHandCursor: true }).on("pointerdown", () => interact(counter.id));
    this.shopkeeperContainer.add(sprite);
    this.cityNpcSprites.push(sprite);
    this.cityNpcData.push({
      templateId: template.id, job: shop.type === "inn" ? "innkeeper" : "merchant",
      x: counter.x, y: counter.y - 1, moves: false, shopIndex: 0,
    });
  }

  // ── Cleanup ──────────────────────────────────────────────────────────

  /** Destroy all sprites, timers, and graphics and reset arrays. */
  clearAll(): void {
    for (const a of this.cityAnimals) {
      this.scene.tweens.killTweensOf(a);
      a.destroy();
    }
    this.cityAnimals = [];
    for (const t of this.cityAnimalTimers) t.destroy();
    this.cityAnimalTimers = [];

    for (const s of this.cityNpcSprites) {
      this.scene.tweens.killTweensOf(s);
      s.destroy();
    }
    this.cityNpcSprites = [];
    this.shopkeeperContainer?.destroy(true);
    this.shopkeeperContainer = null;
    for (const marker of this.questNpcMarkers) marker?.destroy();
    this.questNpcMarkers = [];
    for (const t of this.cityNpcTimers) t.destroy();
    this.cityNpcTimers = [];
    this.cityNpcData = [];
  }
}
