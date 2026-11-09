import type * as Phaser from "phaser";
import { Terrain, type CityChunk, type DungeonData } from "../data/mapTypes";
import { PixelSurface } from "../systems/pixelArt";
import { getCitySurfaceTerrainOverride } from "../systems/citySurface";
import {
  createTerrainArt, createFountainPropArt, getTerrainArtKey, getTerrainArtSpec,
  type TerrainArtSpec,
} from "../systems/terrainArt";
import { createPixelTexture } from "./pixelTexture";

export function getDungeonArtGround(dungeon: DungeonData): Terrain {
  return dungeon.visualTheme === "ice" ? Terrain.Tundra : dungeon.visualTheme === "forge" ? Terrain.Volcanic
    : dungeon.visualTheme === "grotto" ? Terrain.Water : Terrain.DungeonFloor;
}

export function getOrCreateTerrainTexture(scene: Phaser.Scene, map: Terrain[][], x: number, y: number, ground?: Terrain): string {
  const original = getTerrainArtSpec(map, x, y);
  const spec = ground === undefined ? original : { ...original, ground };
  return getOrCreateArtTexture(scene, spec);
}

function getOrCreateArtTexture(scene: Phaser.Scene, spec: TerrainArtSpec): string {
  const key = getTerrainArtKey(spec);
  if (!scene.textures.exists(key)) createPixelTexture(scene, key, createTerrainArt(spec));
  return key;
}

export function getOrCreateCityTerrainTexture(scene: Phaser.Scene, chunk: CityChunk, x: number, y: number, ground: Terrain): string {
  const override = getCitySurfaceTerrainOverride(chunk, x, y);
  if (override === "fog") return "tile_fog";
  const original = getTerrainArtSpec(chunk.mapData, x, y);
  return getOrCreateArtTexture(scene, { ...original, ground, terrain: override ?? original.terrain });
}

export function generateTerrainTextures(scene: Phaser.Scene): void {
  createPixelTexture(scene, "prop_fountain", createFountainPropArt());
  const terrains = Object.values(Terrain).filter((value): value is Terrain => typeof value === "number");
  for (const terrain of terrains) {
    const spec = getTerrainArtSpec([[terrain]], 0, 0);
    createPixelTexture(scene, `tile_${terrain}`, createTerrainArt(spec));
  }
  const fog = new PixelSurface(32, 32);
  fog.rect(0, 0, 32, 32, 0x202b30);
  createPixelTexture(scene, "tile_fog", fog);
  const openChest = createTerrainArt(getTerrainArtSpec([[Terrain.Chest]], 0, 0));
  openChest.rect(8, 14, 16, 7, 0x3e3830);
  openChest.rect(8, 8, 16, 5, 0xc49a62);
  createPixelTexture(scene, "tile_chest_open", openChest);
  const barrier = createTerrainArt(getTerrainArtSpec([[Terrain.Path]], 0, 0));
  barrier.rect(3, 12, 26, 4, 0x765941);
  barrier.rect(3, 22, 26, 4, 0x765941);
  barrier.rect(6, 8, 3, 22, 0xc4a16a);
  barrier.rect(23, 8, 3, 22, 0xc4a16a);
  createPixelTexture(scene, "tile_quest_barrier", barrier);
  for (const ground of [Terrain.Grass, Terrain.Forest, Terrain.DeepForest, Terrain.Sand,
    Terrain.Tundra, Terrain.Swamp, Terrain.Volcanic, Terrain.Canyon]) {
    const spec: TerrainArtSpec = { terrain: Terrain.Town, ground, variant: 0, edges: 0 };
    createPixelTexture(scene, `tile_town_${ground}`, createTerrainArt(spec));
  }
  for (const material of ["wood", "sand", "moss", "ice", "dark", "volcanic"]) {
    createPixelTexture(scene, `tile_citywall_${material}`,
      createTerrainArt({ terrain: Terrain.CityWall, ground: Terrain.Grass, variant: 0, edges: 4 }));
  }
  for (const material of ["cobble", "wood", "sand", "gravel", "moss", "dark", "lava"]) {
    const terrain = material === "wood" ? Terrain.ShopFloor : material === "sand" ? Terrain.Sand : Terrain.CityPath;
    createPixelTexture(scene, `tile_path_${material}`, createTerrainArt(getTerrainArtSpec([[terrain]], 0, 0)));
  }
  for (const type of ["weapon", "armor", "general", "magic", "bank", "inn"]) {
    createPixelTexture(scene, `tile_carpet_${type}`, createTerrainArt(getTerrainArtSpec([[Terrain.Carpet]], 0, 0)));
  }
}
