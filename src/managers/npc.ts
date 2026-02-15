/**
 * NPC adjacency and interaction helpers for city NPCs and animals.
 *
 * These are pure functions that operate on CityRenderer data, extracted
 * from the Overworld scene for modularity.
 */

import { Terrain } from "../data/map";
import type { CityData } from "../data/map";
import type { NpcInstance } from "../data/npcs";
import type { CityRenderer } from "../renderers/city";
import { TILE_SIZE } from "../config";

/**
 * Find an NPC adjacent to or on the player's current position.
 * Shopkeeper NPCs can only be talked to from inside their shop
 * (player must be on a ShopFloor tile, not just the carpet entrance).
 */
export function findAdjacentNpc(
  city: CityData,
  playerX: number,
  playerY: number,
  cityRenderer: CityRenderer,
): { npcDef: NpcInstance; npcIndex: number } | null {
  const npcs = cityRenderer.cityNpcData;
  if (!npcs.length) return null;

  const playerTerrain = city.mapData[playerY]?.[playerX];
  const playerInsideShop =
    playerTerrain === Terrain.ShopFloor ||
    playerTerrain === Terrain.CityFloor ||
    playerTerrain === Terrain.Carpet;

  const checks = [
    { x: playerX, y: playerY },
    { x: playerX - 1, y: playerY },
    { x: playerX + 1, y: playerY },
    { x: playerX, y: playerY - 1 },
    { x: playerX, y: playerY + 1 },
  ];

  for (let i = 0; i < npcs.length; i++) {
    const npc = npcs[i];
    if (npc.shopIndex !== undefined) {
      const shop = city.shops[npc.shopIndex];
      const isOutdoorShop = shop?.type === "stable";
      if (!isOutdoorShop && !playerInsideShop) continue;
    }

    let nx: number;
    let ny: number;
    if (cityRenderer.cityNpcSprites[i]) {
      nx = Math.floor(cityRenderer.cityNpcSprites[i].x / TILE_SIZE);
      ny = Math.floor(cityRenderer.cityNpcSprites[i].y / TILE_SIZE);
    } else {
      nx = npc.x;
      ny = npc.y;
    }
    for (const c of checks) {
      if (c.x === nx && c.y === ny) return { npcDef: npc, npcIndex: i };
    }
  }
  return null;
}

/** Check if the player is adjacent to a city animal sprite. */
export function findAdjacentAnimal(
  playerX: number,
  playerY: number,
  cityAnimals: Phaser.GameObjects.Sprite[],
): { spriteName: string } | null {
  const checks = [
    { x: playerX, y: playerY },
    { x: playerX - 1, y: playerY },
    { x: playerX + 1, y: playerY },
    { x: playerX, y: playerY - 1 },
    { x: playerX, y: playerY + 1 },
  ];
  for (const sprite of cityAnimals) {
    if (!sprite.active) continue;
    const ax = Math.floor(sprite.x / TILE_SIZE);
    const ay = Math.floor(sprite.y / TILE_SIZE);
    for (const c of checks) {
      if (c.x === ax && c.y === ay) return { spriteName: sprite.texture.key };
    }
  }
  return null;
}
