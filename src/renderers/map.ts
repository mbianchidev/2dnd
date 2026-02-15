/**
 * Map renderer: manages tile sprites and rendering state.
 */

import Phaser from "phaser";

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
}
