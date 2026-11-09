import * as Phaser from "phaser";
import { CITIES } from "../data/cities";
import { Terrain, type CityData } from "../data/mapTypes";
import { isIslandCityAvailable } from "../systems/islandAccess";
import { getBlockedQuestEntranceAt } from "../systems/quests";
import { createTerrainArt } from "../systems/terrainArt";
import { createWorldCityArt, getWorldCityArtProfile, getWorldCityArtTiles } from "../systems/worldCityArt";
import type { PlayerState } from "../systems/player";
import { createPixelTexture } from "./pixelTexture";
import { TILE_SIZE } from "../config";

const reportOwners = new WeakMap<HTMLCanvasElement, WorldCityRenderer>();

export function getWorldCityTextureKey(cityId: string): string {
  return `world-city-${cityId}`;
}

export function generateWorldCityTextures(scene: Phaser.Scene): void {
  for (const city of CITIES) {
    const key = getWorldCityTextureKey(city.id);
    createPixelTexture(scene, key, createWorldCityArt(getWorldCityArtProfile(city.id)));
    const texture = scene.textures.get(key);
    const profile = getWorldCityArtProfile(city.id);
    for (let row = 0; row < profile.rows; row++) {
      for (let column = 0; column < profile.columns; column++) {
        const frame = `${column},${row}`;
        if (!texture.has(frame)) texture.add(frame, 0, column * 32, row * 32, 32, 32);
      }
    }
  }
}

export function getWorldCityGroundTexture(scene: Phaser.Scene, ground: Terrain): string {
  const key = `world-city-ground-${ground}`;
  if (!scene.textures.exists(key)) {
    createPixelTexture(scene, key, createTerrainArt({ terrain: Terrain.CityFloor, ground, variant: 0, edges: 0 }));
  }
  return key;
}

/** Reuse the same fog-redacted cartography in exploration and both atlas zoom levels. */
export function drawWorldCityLandmark(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  city: CityData,
  isExplored: (x: number, y: number) => boolean,
  tileSize: number,
  originX = 0,
  originY = 0,
): void {
  for (const tile of getWorldCityArtTiles(city, isExplored)) {
    container.add(scene.add.image(originX + (tile.x + 0.5) * tileSize, originY + (tile.y + 0.5) * tileSize,
      getWorldCityTextureKey(city.id), `${tile.column},${tile.row}`).setDisplaySize(tileSize, tileSize));
  }
}

export class WorldCityRenderer {
  private container: Phaser.GameObjects.Container | null = null;
  private signature = "";

  constructor(private readonly scene: Phaser.Scene) {}

  render(player: PlayerState, isExplored: (x: number, y: number) => boolean): readonly CityData[] {
    if (!this.container) {
      this.container = this.scene.add.container(0, 0).setDepth(2);
      this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    }
    const cities = CITIES.filter((city) => city.chunkX === player.position.chunkX
      && city.chunkY === player.position.chunkY && isIslandCityAvailable(city.id, player.newGamePlus)
      && isExplored(city.tileX, city.tileY));
    const report = cities.map((city) => ({
      cityId: city.id, cells: getWorldCityArtTiles(city, isExplored),
      blocked: Boolean(getBlockedQuestEntranceAt(player, city.chunkX, city.chunkY, city.tileX, city.tileY)),
    }));
    const signature = JSON.stringify(report);
    if (signature === this.signature) return cities;
    this.signature = signature;
    this.container.removeAll(true);
    for (const city of cities) {
      drawWorldCityLandmark(this.scene, this.container, city, isExplored, TILE_SIZE);
      if (getBlockedQuestEntranceAt(player, city.chunkX, city.chunkY, city.tileX, city.tileY)) {
        this.container.add(this.scene.add.image((city.tileX + 0.5) * TILE_SIZE,
          (city.tileY + 0.5) * TILE_SIZE, "tile_quest_barrier"));
      }
    }
    reportOwners.set(this.scene.game.canvas, this);
    this.scene.game.canvas.setAttribute("data-world-city-landmarks", signature);
    return cities;
  }

  clear(): void {
    this.signature = "";
    this.container?.removeAll(true);
    if (reportOwners.get(this.scene.game.canvas) === this) {
      reportOwners.delete(this.scene.game.canvas);
      this.scene.game.canvas.removeAttribute("data-world-city-landmarks");
    }
  }

  destroy(): void {
    this.clear();
    this.container?.destroy(true);
    this.container = null;
  }
}
