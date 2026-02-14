/**
 * Map renderer: handles tile rendering, day/night tinting, weather particles, and audio.
 */

import Phaser from "phaser";
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  TERRAIN_COLORS,
  Terrain,
  getTerrainAt,
  getChunk,
  getDungeonAt,
  DUNGEONS,
  CITIES,
  getCity,
  hasSparkleAt,
  type WorldChunk,
  type CityData,
} from "../data/map";
import { getTimePeriod, TimePeriod, PERIOD_TINT } from "./daynight";
import { WeatherType, WEATHER_TINT, type WeatherState } from "./weather";
import { audioEngine } from "./audio";

const TILE_SIZE = 32;

/**
 * Blend two 0xRRGGBB tint values, weighting the first (day/night) at 75%
 * and the second (weather) at 25%. This keeps the day/night cycle clearly
 * visible through any weather condition.
 */
function blendTints(a: number, b: number): number {
  const rA = (a >> 16) & 0xff, gA = (a >> 8) & 0xff, bA = a & 0xff;
  const rB = (b >> 16) & 0xff, gB = (b >> 8) & 0xff, bB = b & 0xff;
  const r = Math.round(rA * 0.75 + rB * 0.25);
  const g = Math.round(gA * 0.75 + gB * 0.25);
  const bl = Math.round(bA * 0.75 + bB * 0.25);
  return (r << 16) | (g << 8) | bl;
}

export class MapRenderer {
  private scene: Phaser.Scene;
  private tileSprites: Phaser.GameObjects.Sprite[][] = [];
  private weatherParticles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private stormLightningTimer: Phaser.Time.TimerEvent | null = null;
  private biomeDecoEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private shopRoofGraphics: Phaser.GameObjects.Graphics[] = [];
  private shopRoofBounds: { x: number; y: number; w: number; h: number; shopX: number; shopY: number; shopIdx: number }[] = [];
  private shopFloorMap: Map<string, number> = new Map();
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }
  
  /**
   * Get the tile sprites array.
   */
  getTileSprites(): Phaser.GameObjects.Sprite[][] {
    return this.tileSprites;
  }
  
  /**
   * Get shop roof graphics.
   */
  getShopRoofGraphics(): Phaser.GameObjects.Graphics[] {
    return this.shopRoofGraphics;
  }
  
  /**
   * Get shop roof bounds.
   */
  getShopRoofBounds(): { x: number; y: number; w: number; h: number; shopX: number; shopY: number; shopIdx: number }[] {
    return this.shopRoofBounds;
  }
  
  /**
   * Get shop floor map.
   */
  getShopFloorMap(): Map<string, number> {
    return this.shopFloorMap;
  }
  
  /**
   * Clear weather particles.
   */
  clearWeatherParticles(): void {
    this.weatherParticles?.stop();
    this.weatherParticles = null;
    this.stormLightningTimer?.remove();
    this.stormLightningTimer = null;
  }
  
  /**
   * Apply day/night tint to all tile sprites.
   */
  applyDayNightTint(timeStep: number, weatherState: WeatherState): void {
    const period = getTimePeriod(timeStep);
    const dayNightTint = PERIOD_TINT[period];
    const weatherTint = WEATHER_TINT[weatherState.current];
    const finalTint = blendTints(dayNightTint, weatherTint);
    
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let x = 0; x < WORLD_WIDTH; x++) {
        const sprite = this.tileSprites[y]?.[x];
        if (sprite) {
          sprite.setTint(finalTint);
        }
      }
    }
  }
  
  /**
   * Convert terrain to biome name for audio/weather.
   */
  terrainToBiome(terrain?: Terrain): string {
    if (!terrain) return "Plains";
    
    const chunkData = getChunk(0, 0); // dummy call to get chunk type
    if (typeof chunkData === "string") {
      return chunkData;
    }
    
    // Fallback terrain mapping
    switch (terrain) {
      case Terrain.Grass: return "Plains";
      case Terrain.Forest: return "Forest";
      case Terrain.Mountain: return "Mountain";
      case Terrain.Water: return "Ocean";
      case Terrain.Sand: return "Desert";
      case Terrain.Snow: return "Tundra";
      case Terrain.Swamp: return "Swamp";
      case Terrain.DungeonFloor:
      case Terrain.DungeonWall: return "Dungeon";
      case Terrain.ShopFloor:
      case Terrain.CityWall: return "City";
      default: return "Plains";
    }
  }
  
  /**
   * Update audio based on current biome, time, and weather.
   */
  updateAudio(biome: string, timeStep: number, weatherState: WeatherState, inDungeon: boolean): void {
    const period = getTimePeriod(timeStep);
    audioEngine.playBiomeMusic(biome, period);
    if (!inDungeon) {
      audioEngine.playWeatherSFX(weatherState.current);
    }
  }
}
