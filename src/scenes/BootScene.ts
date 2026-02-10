/**
 * Boot scene: generates all procedural assets and shows a title screen.
 */

import Phaser from "phaser";
import { TERRAIN_COLORS, Terrain, WORLD_CHUNKS, WORLD_WIDTH, WORLD_HEIGHT, MAP_WIDTH, MAP_HEIGHT, getTownBiome } from "../data/map";
import { PLAYER_APPEARANCES, type PlayerAppearance, SKIN_COLOR_OPTIONS, HAIR_STYLE_OPTIONS, HAIR_COLOR_OPTIONS, type CustomAppearance, getAppearance } from "../systems/appearance";
import { hasSave, loadGame, deleteSave, getSaveSummary } from "../systems/save";
import { createPlayer } from "../systems/player";

const TILE_SIZE = 32;

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload(): void {
    // No external assets to load - we generate everything procedurally
  }

  create(): void {
    this.generateTileTextures();
    this.generatePlayerTexture();
    this.generatePlayerTextures();
    this.generateMonsterTexture();
    this.generateBossTexture();
    this.generateUITextures();
    this.generateBattleBackgrounds();
    this.showTitleScreen();
  }

  private generateTileTextures(): void {
    // Generate a texture for each terrain type
    const terrainKeys = Object.values(Terrain).filter(
      (v) => typeof v === "number"
    ) as Terrain[];

    for (const terrain of terrainKeys) {
      const key = `tile_${terrain}`;
      const color = TERRAIN_COLORS[terrain];
      const gfx = this.add.graphics();

      gfx.fillStyle(color, 1);
      gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

      // Add subtle detail per terrain
      switch (terrain) {
        case Terrain.Forest:
          gfx.fillStyle(0x1b5e20, 0.5);
          gfx.fillCircle(16, 12, 10);
          gfx.fillStyle(0x4a2800, 1);
          gfx.fillRect(14, 20, 4, 12);
          break;
        case Terrain.Mountain:
          gfx.fillStyle(0x5d4037, 0.7);
          gfx.fillTriangle(16, 4, 4, 28, 28, 28);
          gfx.fillStyle(0xeeeeee, 0.6);
          gfx.fillTriangle(16, 4, 12, 12, 20, 12);
          break;
        case Terrain.Water:
          gfx.fillStyle(0x1565c0, 0.4);
          gfx.fillRect(0, 10, 32, 4);
          gfx.fillRect(8, 20, 32, 4);
          break;
        case Terrain.Town:
          gfx.fillStyle(0x5d4037, 1);
          gfx.fillRect(8, 8, 16, 20);
          gfx.fillStyle(0xcc0000, 1);
          gfx.fillTriangle(6, 10, 26, 10, 16, 2);
          break;
        case Terrain.Dungeon:
          gfx.fillStyle(0x424242, 1);
          gfx.fillRect(6, 4, 20, 24);
          gfx.fillStyle(0x212121, 1);
          gfx.fillRect(12, 14, 8, 14);
          break;
        case Terrain.Boss:
          gfx.fillStyle(0xb71c1c, 0.8);
          gfx.fillCircle(16, 16, 12);
          gfx.fillStyle(0xffeb3b, 1);
          // Draw a star-like shape
          gfx.fillTriangle(16, 6, 12, 20, 20, 20);
          gfx.fillTriangle(16, 26, 12, 12, 20, 12);
          break;
        case Terrain.Path:
          gfx.fillStyle(0x8d6e63, 0.3);
          gfx.fillRect(4, 0, 24, 32);
          break;
        case Terrain.Sand:
          gfx.fillStyle(0xfbc02d, 0.3);
          gfx.fillCircle(8, 8, 2);
          gfx.fillCircle(24, 20, 2);
          gfx.fillCircle(16, 28, 2);
          break;
        case Terrain.DungeonFloor:
          // Dark stone floor with subtle tile pattern
          gfx.fillStyle(0x444444, 0.4);
          gfx.fillRect(0, 0, 15, 15);
          gfx.fillRect(17, 17, 15, 15);
          gfx.lineStyle(1, 0x333333, 0.5);
          gfx.strokeRect(1, 1, 14, 14);
          gfx.strokeRect(17, 17, 14, 14);
          break;
        case Terrain.DungeonWall:
          // Dark brick wall
          gfx.fillStyle(0x1a1a1a, 0.6);
          gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
          gfx.lineStyle(1, 0x333333, 0.4);
          gfx.strokeRect(2, 2, 12, 6);
          gfx.strokeRect(16, 2, 14, 6);
          gfx.strokeRect(0, 10, 8, 6);
          gfx.strokeRect(10, 10, 12, 6);
          gfx.strokeRect(24, 10, 8, 6);
          gfx.strokeRect(2, 18, 12, 6);
          gfx.strokeRect(16, 18, 14, 6);
          gfx.strokeRect(0, 26, 8, 6);
          gfx.strokeRect(10, 26, 12, 6);
          break;
        case Terrain.DungeonExit:
          // Green-tinted exit door
          gfx.fillStyle(0x2e7d32, 0.6);
          gfx.fillRect(6, 2, 20, 28);
          gfx.fillStyle(0x4caf50, 0.8);
          gfx.fillRect(10, 6, 12, 22);
          gfx.fillStyle(0xffeb3b, 1);
          gfx.fillCircle(18, 18, 2);
          break;
        case Terrain.Chest:
          // Golden treasure chest on dark floor
          gfx.fillStyle(0x555555, 1);
          gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
          gfx.fillStyle(0xffc107, 1);
          gfx.fillRect(8, 10, 16, 14);
          gfx.fillStyle(0xffab00, 1);
          gfx.fillRect(8, 10, 16, 4);
          gfx.fillStyle(0x795548, 1);
          gfx.fillRect(14, 12, 4, 6);
          break;
        case Terrain.Tundra:
          // Snowy terrain with frost specks
          gfx.fillStyle(0xe0e0e0, 0.4);
          gfx.fillCircle(6, 6, 3);
          gfx.fillCircle(22, 14, 2);
          gfx.fillCircle(12, 26, 3);
          gfx.fillCircle(28, 28, 2);
          break;
        case Terrain.Swamp:
          // Murky terrain with puddle patches
          gfx.fillStyle(0x33691e, 0.5);
          gfx.fillCircle(10, 10, 6);
          gfx.fillCircle(24, 22, 5);
          gfx.fillStyle(0x1b5e20, 0.4);
          gfx.fillRect(2, 20, 8, 4);
          break;
        case Terrain.DeepForest:
          // Dense canopy with overlapping tree shapes
          gfx.fillStyle(0x0d3b0d, 0.6);
          gfx.fillCircle(10, 10, 8);
          gfx.fillCircle(22, 14, 7);
          gfx.fillCircle(14, 24, 6);
          gfx.fillStyle(0x3e2723, 1);
          gfx.fillRect(9, 18, 3, 10);
          gfx.fillRect(21, 20, 3, 8);
          break;
        case Terrain.Volcanic:
          // Lava-like terrain with hot glow
          gfx.fillStyle(0xff6f00, 0.5);
          gfx.fillRect(4, 4, 10, 6);
          gfx.fillRect(18, 18, 10, 8);
          gfx.fillStyle(0xdd2c00, 0.4);
          gfx.fillCircle(16, 16, 4);
          break;
        case Terrain.Canyon:
          // Rocky canyon floor with layered stone
          gfx.fillStyle(0x8d6e63, 0.4);
          gfx.fillRect(0, 6, 32, 4);
          gfx.fillRect(0, 18, 32, 4);
          gfx.fillStyle(0x6d4c41, 0.3);
          gfx.fillRect(4, 12, 24, 3);
          break;
        case Terrain.MinorTreasure:
          // Blue sparkle on terrain
          gfx.fillStyle(0x4fc3f7, 0.9);
          gfx.fillCircle(16, 16, 4);
          gfx.fillStyle(0x81d4fa, 0.7);
          gfx.fillCircle(16, 16, 2);
          gfx.fillStyle(0xe1f5fe, 1);
          gfx.fillCircle(16, 16, 1);
          // Sparkle rays
          gfx.fillStyle(0x4fc3f7, 0.5);
          gfx.fillRect(14, 8, 4, 4);   // top
          gfx.fillRect(14, 20, 4, 4);  // bottom
          gfx.fillRect(8, 14, 4, 4);   // left
          gfx.fillRect(20, 14, 4, 4);  // right
          // Diagonal sparkle dots
          gfx.fillStyle(0x81d4fa, 0.4);
          gfx.fillCircle(10, 10, 1.5);
          gfx.fillCircle(22, 10, 1.5);
          gfx.fillCircle(10, 22, 1.5);
          gfx.fillCircle(22, 22, 1.5);
          break;
        case Terrain.CityFloor:
          // Cobblestone floor
          gfx.fillStyle(0xa1887f, 0.3);
          gfx.fillRect(0, 0, 15, 15);
          gfx.fillRect(17, 17, 15, 15);
          gfx.lineStyle(1, 0x8d6e63, 0.4);
          gfx.strokeRect(1, 1, 14, 14);
          gfx.strokeRect(17, 17, 14, 14);
          gfx.strokeRect(1, 17, 14, 14);
          gfx.strokeRect(17, 1, 14, 14);
          break;
        case Terrain.CityWall:
          // Solid stone wall with brick pattern (no roof)
          gfx.fillStyle(0x5d4037, 1);
          gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
          // Brick layers
          gfx.fillStyle(0x4e342e, 0.8);
          gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
          gfx.lineStyle(1, 0x3e2723, 0.6);
          // Row 1
          gfx.strokeRect(1, 1, 14, 7);
          gfx.strokeRect(17, 1, 14, 7);
          // Row 2 (offset)
          gfx.strokeRect(8, 9, 14, 7);
          gfx.strokeRect(0, 9, 7, 7);
          gfx.strokeRect(23, 9, 8, 7);
          // Row 3
          gfx.strokeRect(1, 17, 14, 7);
          gfx.strokeRect(17, 17, 14, 7);
          // Row 4 (offset)
          gfx.strokeRect(8, 25, 14, 7);
          gfx.strokeRect(0, 25, 7, 7);
          gfx.strokeRect(23, 25, 8, 7);
          // Top edge shadow
          gfx.fillStyle(0x3e2723, 0.4);
          gfx.fillRect(0, 0, TILE_SIZE, 2);
          break;
        case Terrain.CityExit:
          // City gate / exit
          gfx.fillStyle(0x2e7d32, 0.5);
          gfx.fillRect(4, 2, 24, 28);
          gfx.fillStyle(0x4caf50, 0.7);
          gfx.fillRect(8, 4, 16, 24);
          gfx.fillStyle(0x8d6e63, 1);
          gfx.fillRect(4, 0, 4, 32);
          gfx.fillRect(24, 0, 4, 32);
          gfx.fillStyle(0xffeb3b, 1);
          gfx.fillCircle(16, 18, 2);
          break;
        case Terrain.Carpet:
          // Rich red carpet / doormat marking shop entrances
          gfx.fillStyle(0x8b1a1a, 1);
          gfx.fillRect(2, 2, 28, 28);
          gfx.fillStyle(0xa52a2a, 0.7);
          gfx.fillRect(4, 4, 24, 24);
          // Ornamental border pattern
          gfx.fillStyle(0xdaa520, 0.8);
          gfx.fillRect(2, 2, 28, 2);
          gfx.fillRect(2, 28, 28, 2);
          gfx.fillRect(2, 2, 2, 28);
          gfx.fillRect(28, 2, 2, 28);
          // Center diamond motif
          gfx.fillStyle(0xdaa520, 0.6);
          gfx.fillTriangle(16, 10, 12, 16, 16, 22);
          gfx.fillTriangle(16, 10, 20, 16, 16, 22);
          break;
        case Terrain.Well:
          // Stone well with water visible inside
          gfx.fillStyle(0xbcaaa4, 1);
          gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
          gfx.fillStyle(0x78909c, 1);
          gfx.fillCircle(16, 16, 12);
          gfx.fillStyle(0x546e7a, 1);
          gfx.fillCircle(16, 16, 10);
          gfx.fillStyle(0x1565c0, 0.8);
          gfx.fillCircle(16, 16, 7);
          gfx.fillStyle(0x42a5f5, 0.5);
          gfx.fillCircle(14, 14, 3);
          // Stone rim
          gfx.lineStyle(2, 0x90a4ae, 1);
          gfx.strokeCircle(16, 16, 11);
          // Rope/handle
          gfx.fillStyle(0x8d6e63, 1);
          gfx.fillRect(14, 2, 4, 6);
          gfx.fillRect(12, 2, 8, 2);
          break;
        case Terrain.Fountain:
          // Ornate stone fountain with splashing water
          gfx.fillStyle(0xbcaaa4, 1);
          gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
          gfx.fillStyle(0x90a4ae, 1);
          gfx.fillCircle(16, 16, 13);
          gfx.fillStyle(0x1e88e5, 0.8);
          gfx.fillCircle(16, 16, 10);
          gfx.fillStyle(0x42a5f5, 0.6);
          gfx.fillCircle(16, 16, 7);
          // Central spout
          gfx.fillStyle(0x78909c, 1);
          gfx.fillCircle(16, 16, 4);
          gfx.fillStyle(0x90a4ae, 1);
          gfx.fillCircle(16, 16, 2);
          // Water spray droplets
          gfx.fillStyle(0xbbdefb, 0.9);
          gfx.fillCircle(10, 10, 2);
          gfx.fillCircle(22, 10, 2);
          gfx.fillCircle(10, 22, 2);
          gfx.fillCircle(22, 22, 2);
          gfx.fillCircle(16, 8, 1.5);
          break;
        case Terrain.Crate:
          // Wooden crate with plank detail
          gfx.fillStyle(0xbcaaa4, 1);
          gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
          gfx.fillStyle(0x8d6e63, 1);
          gfx.fillRect(4, 4, 24, 24);
          gfx.fillStyle(0xa1887f, 0.8);
          gfx.fillRect(6, 6, 20, 20);
          // Plank lines
          gfx.lineStyle(1, 0x6d4c41, 0.7);
          gfx.lineBetween(4, 16, 28, 16);
          gfx.lineBetween(16, 4, 16, 28);
          // Corner nails
          gfx.fillStyle(0x424242, 1);
          gfx.fillCircle(7, 7, 1.5);
          gfx.fillCircle(25, 7, 1.5);
          gfx.fillCircle(7, 25, 1.5);
          gfx.fillCircle(25, 25, 1.5);
          break;
        case Terrain.Barrel:
          // Wooden barrel with metal bands
          gfx.fillStyle(0xbcaaa4, 1);
          gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
          gfx.fillStyle(0x6d4c41, 1);
          gfx.fillCircle(16, 16, 12);
          gfx.fillStyle(0x8d6e63, 0.9);
          gfx.fillCircle(16, 16, 10);
          // Wood grain
          gfx.lineStyle(1, 0x5d4037, 0.4);
          gfx.lineBetween(10, 5, 10, 27);
          gfx.lineBetween(16, 4, 16, 28);
          gfx.lineBetween(22, 5, 22, 27);
          // Metal bands
          gfx.lineStyle(2, 0x757575, 0.8);
          gfx.strokeCircle(16, 16, 11);
          gfx.lineStyle(1, 0x9e9e9e, 0.6);
          gfx.strokeCircle(16, 16, 7);
          break;
        case Terrain.ShopFloor:
          // Wooden plank floor (distinct from cobblestone)
          gfx.fillStyle(0xa1887f, 1);
          gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
          gfx.fillStyle(0x8d6e63, 0.5);
          gfx.fillRect(0, 0, TILE_SIZE, 6);
          gfx.fillRect(0, 8, TILE_SIZE, 6);
          gfx.fillRect(0, 16, TILE_SIZE, 6);
          gfx.fillRect(0, 24, TILE_SIZE, 6);
          gfx.lineStyle(1, 0x6d4c41, 0.3);
          gfx.lineBetween(0, 7, 32, 7);
          gfx.lineBetween(0, 15, 32, 15);
          gfx.lineBetween(0, 23, 32, 23);
          // Plank edge offsets for visual interest
          gfx.lineStyle(1, 0x795548, 0.2);
          gfx.lineBetween(10, 0, 10, 7);
          gfx.lineBetween(22, 8, 22, 15);
          gfx.lineBetween(8, 16, 8, 23);
          gfx.lineBetween(20, 24, 20, 31);
          break;
        case Terrain.Temple:
          // Golden temple / shrine on cobblestone
          gfx.fillStyle(0xbcaaa4, 1);
          gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
          // Temple base
          gfx.fillStyle(0xd4af37, 1);
          gfx.fillRect(6, 10, 20, 18);
          // Pillars
          gfx.fillStyle(0xc9a932, 1);
          gfx.fillRect(6, 10, 4, 18);
          gfx.fillRect(22, 10, 4, 18);
          // Peaked roof
          gfx.fillStyle(0xb8860b, 1);
          gfx.fillTriangle(4, 12, 28, 12, 16, 2);
          gfx.fillStyle(0xdaa520, 0.8);
          gfx.fillTriangle(6, 12, 26, 12, 16, 4);
          // Door
          gfx.fillStyle(0x5d4037, 1);
          gfx.fillRect(13, 18, 6, 10);
          // Cross / holy symbol
          gfx.fillStyle(0xfff9c4, 0.9);
          gfx.fillRect(15, 6, 2, 6);
          gfx.fillRect(13, 8, 6, 2);
          break;
        case Terrain.Statue:
          // Stone statue on cobblestone
          gfx.fillStyle(0xbcaaa4, 1);
          gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
          // Pedestal
          gfx.fillStyle(0x757575, 1);
          gfx.fillRect(10, 22, 12, 8);
          gfx.fillStyle(0x9e9e9e, 0.8);
          gfx.fillRect(11, 23, 10, 6);
          // Figure body
          gfx.fillStyle(0x9e9e9e, 1);
          gfx.fillRect(13, 10, 6, 12);
          // Head
          gfx.fillStyle(0xbdbdbd, 1);
          gfx.fillCircle(16, 7, 4);
          // Sword held up
          gfx.fillStyle(0xb0bec5, 1);
          gfx.fillRect(20, 4, 2, 14);
          gfx.fillRect(18, 16, 6, 2);
          break;
        case Terrain.River:
          // Blue water flowing through cobblestone
          gfx.fillStyle(0xbcaaa4, 1);
          gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
          gfx.fillStyle(0x42a5f5, 1);
          gfx.fillRect(0, 10, TILE_SIZE, 12);
          gfx.fillStyle(0x64b5f6, 0.6);
          gfx.fillRect(2, 12, 8, 3);
          gfx.fillRect(16, 15, 10, 3);
          gfx.fillStyle(0x90caf9, 0.4);
          gfx.fillRect(6, 11, 4, 2);
          gfx.fillRect(22, 13, 4, 2);
          break;
        case Terrain.Mill:
          // Windmill building on cobblestone
          gfx.fillStyle(0xbcaaa4, 1);
          gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
          // Tower
          gfx.fillStyle(0x8d6e63, 1);
          gfx.fillRect(10, 8, 12, 20);
          // Roof
          gfx.fillStyle(0x795548, 1);
          gfx.fillTriangle(8, 10, 24, 10, 16, 2);
          // Door
          gfx.fillStyle(0x4e342e, 1);
          gfx.fillRect(14, 22, 4, 6);
          // Windmill blades
          gfx.lineStyle(2, 0x5d4037, 0.9);
          gfx.lineBetween(16, 6, 6, 0);
          gfx.lineBetween(16, 6, 26, 0);
          gfx.lineBetween(16, 6, 10, 14);
          gfx.lineBetween(16, 6, 22, 14);
          break;
        case Terrain.CropField:
          // Green crop rows on brown soil
          gfx.fillStyle(0x795548, 1);
          gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
          gfx.fillStyle(0x8bc34a, 1);
          for (let row = 2; row < 30; row += 6) {
            gfx.fillRect(2, row, 28, 3);
          }
          gfx.fillStyle(0xaed581, 0.5);
          for (let row = 2; row < 30; row += 6) {
            gfx.fillRect(4, row, 4, 2);
            gfx.fillRect(14, row, 4, 2);
            gfx.fillRect(24, row, 4, 2);
          }
          break;
        case Terrain.Fence:
          // Wooden fence on cobblestone
          gfx.fillStyle(0xbcaaa4, 1);
          gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
          // Horizontal rails
          gfx.fillStyle(0x795548, 1);
          gfx.fillRect(0, 10, TILE_SIZE, 3);
          gfx.fillRect(0, 20, TILE_SIZE, 3);
          // Vertical posts
          gfx.fillStyle(0x6d4c41, 1);
          gfx.fillRect(4, 6, 3, 20);
          gfx.fillRect(15, 6, 3, 20);
          gfx.fillRect(26, 6, 3, 20);
          break;
        case Terrain.House:
          // Cottage footprint — wooden walls, thatched roof, small window
          // Foundation
          gfx.fillStyle(0x8d6e63, 1);
          gfx.fillRect(3, 6, 26, 22);
          // Wooden wall texture
          gfx.fillStyle(0x795548, 1);
          gfx.fillRect(4, 7, 24, 20);
          gfx.lineStyle(1, 0x6d4c41, 0.4);
          gfx.lineBetween(4, 12, 28, 12);
          gfx.lineBetween(4, 17, 28, 17);
          gfx.lineBetween(4, 22, 28, 22);
          // Thatched roof (brown/tan, not red)
          gfx.fillStyle(0xa08060, 1);
          gfx.fillTriangle(1, 9, 31, 9, 16, 0);
          gfx.fillStyle(0xb89870, 0.8);
          gfx.fillTriangle(3, 9, 29, 9, 16, 2);
          // Roof texture lines
          gfx.lineStyle(1, 0x8a7050, 0.5);
          gfx.lineBetween(8, 5, 16, 1);
          gfx.lineBetween(24, 5, 16, 1);
          // Door
          gfx.fillStyle(0x4e342e, 1);
          gfx.fillRect(13, 19, 6, 8);
          gfx.fillStyle(0xdaa520, 1);
          gfx.fillRect(17, 22, 1, 2); // door handle
          // Window
          gfx.fillStyle(0xfff9c4, 0.85);
          gfx.fillRect(6, 13, 5, 4);
          gfx.fillRect(21, 13, 5, 4);
          gfx.lineStyle(1, 0x5d4037, 0.7);
          gfx.lineBetween(8, 13, 8, 17);
          gfx.lineBetween(23, 13, 23, 17);
          break;
        case Terrain.Flower:
          // Green grass with 3 small simple flowers
          // Grass texture variation
          gfx.fillStyle(0x43a047, 0.4);
          gfx.fillCircle(6, 8, 4);
          gfx.fillCircle(20, 22, 5);
          gfx.fillCircle(28, 10, 3);
          // Stems
          gfx.fillStyle(0x2e7d32, 0.8);
          gfx.fillRect(9, 12, 1, 6);
          gfx.fillRect(20, 8, 1, 5);
          gfx.fillRect(15, 20, 1, 5);
          // Flower 1 — red
          gfx.fillStyle(0xdd3333, 1);
          gfx.fillCircle(9, 11, 2);
          gfx.fillStyle(0xff6666, 1);
          gfx.fillCircle(9, 11, 1);
          // Flower 2 — yellow
          gfx.fillStyle(0xddcc22, 1);
          gfx.fillCircle(20, 7, 2);
          gfx.fillStyle(0xffee66, 1);
          gfx.fillCircle(20, 7, 1);
          // Flower 3 — white
          gfx.fillStyle(0xeeeeee, 1);
          gfx.fillCircle(15, 19, 2);
          gfx.fillStyle(0xffffcc, 1);
          gfx.fillCircle(15, 19, 1);
          break;
        case Terrain.Cactus:
          // Cactus on sand
          gfx.fillStyle(0x388e3c, 1);
          gfx.fillRect(13, 6, 6, 22);
          // Arms
          gfx.fillRect(7, 10, 6, 4);
          gfx.fillRect(7, 10, 4, 10);
          gfx.fillRect(19, 14, 6, 4);
          gfx.fillRect(21, 14, 4, 10);
          // Texture
          gfx.lineStyle(1, 0x2e7d32, 0.5);
          gfx.lineBetween(16, 8, 16, 26);
          break;
        case Terrain.Geyser:
          // Rocky geyser vent
          gfx.fillStyle(0x616161, 1);
          gfx.fillCircle(16, 20, 8);
          gfx.fillStyle(0x90a4ae, 0.8);
          gfx.fillCircle(16, 20, 5);
          // Steam puffs
          gfx.fillStyle(0xeceff1, 0.5);
          gfx.fillCircle(16, 10, 4);
          gfx.fillCircle(12, 6, 3);
          gfx.fillCircle(20, 4, 3);
          gfx.fillStyle(0xeceff1, 0.3);
          gfx.fillCircle(16, 2, 3);
          break;
        case Terrain.Mushroom:
          // Brown/red mushrooms on swamp ground
          gfx.fillStyle(0x4e342e, 0.3);
          gfx.fillRect(6, 6, 8, 4);
          gfx.fillRect(20, 16, 6, 3);
          // Large mushroom — brown cap
          gfx.fillStyle(0x8d6e63, 1);
          gfx.fillRect(9, 14, 3, 10);
          gfx.fillStyle(0x8b4513, 1);
          gfx.fillCircle(10, 12, 6);
          gfx.fillStyle(0xa0522d, 0.5);
          gfx.fillCircle(8, 10, 2);
          gfx.fillCircle(13, 11, 2);
          // Small mushroom — red cap
          gfx.fillStyle(0x8d6e63, 1);
          gfx.fillRect(22, 22, 2, 6);
          gfx.fillStyle(0xcc3333, 1);
          gfx.fillCircle(23, 20, 4);
          // White spots on red cap
          gfx.fillStyle(0xeeeeee, 0.8);
          gfx.fillCircle(22, 19, 1);
          gfx.fillCircle(24, 21, 1);
          break;
        case Terrain.Casino:
          // Casino building on cobblestone — gold/red facade
          gfx.fillStyle(0xbcaaa4, 1);
          gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
          // Building body
          gfx.fillStyle(0x8b0000, 1);
          gfx.fillRect(2, 8, 28, 22);
          // Gold trim roof
          gfx.fillStyle(0xdaa520, 1);
          gfx.fillRect(2, 6, 28, 4);
          gfx.fillRect(0, 4, TILE_SIZE, 3);
          // Door
          gfx.fillStyle(0x3e2723, 1);
          gfx.fillRect(13, 22, 6, 8);
          // Door handle (gold)
          gfx.fillStyle(0xffd700, 1);
          gfx.fillRect(17, 25, 1, 2);
          // Windows with gold frames
          gfx.fillStyle(0xfff9c4, 0.9);
          gfx.fillRect(5, 12, 6, 5);
          gfx.fillRect(21, 12, 6, 5);
          gfx.lineStyle(1, 0xffd700, 1);
          gfx.strokeRect(5, 12, 6, 5);
          gfx.strokeRect(21, 12, 6, 5);
          // Diamond/star sign above door
          gfx.fillStyle(0xffd700, 1);
          gfx.fillTriangle(16, 8, 13, 13, 19, 13);
          gfx.fillTriangle(16, 18, 13, 13, 19, 13);
          break;
      }

      // Add grid border
      gfx.lineStyle(1, 0x000000, 0.15);
      gfx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);

      gfx.generateTexture(key, TILE_SIZE, TILE_SIZE);
      gfx.destroy();
    }

    // Fog of war tile — solid black with subtle noise
    const fogGfx = this.add.graphics();
    fogGfx.fillStyle(0x111111, 1);
    fogGfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    fogGfx.fillStyle(0x1a1a1a, 0.4);
    fogGfx.fillRect(4, 4, 8, 8);
    fogGfx.fillRect(20, 12, 8, 8);
    fogGfx.fillRect(8, 20, 8, 8);
    fogGfx.lineStyle(1, 0x000000, 0.3);
    fogGfx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
    fogGfx.generateTexture("tile_fog", TILE_SIZE, TILE_SIZE);
    fogGfx.destroy();

    // Open chest tile — opened lid, empty box on dark floor
    const openChestGfx = this.add.graphics();
    openChestGfx.fillStyle(0x555555, 1);
    openChestGfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    // Open box (darker, empty)
    openChestGfx.fillStyle(0x8d6e63, 1);
    openChestGfx.fillRect(8, 14, 16, 10);
    // Open lid tilted back
    openChestGfx.fillStyle(0xa1887f, 1);
    openChestGfx.fillRect(8, 8, 16, 6);
    // Dark interior
    openChestGfx.fillStyle(0x3e2723, 1);
    openChestGfx.fillRect(10, 16, 12, 6);
    openChestGfx.lineStyle(1, 0x000000, 0.15);
    openChestGfx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
    openChestGfx.generateTexture("tile_chest_open", TILE_SIZE, TILE_SIZE);
    openChestGfx.destroy();

    // Generate biome-colored town textures (building on the biome's base color)
    const townBiomes: { terrain: Terrain; baseColor: number }[] = [
      { terrain: Terrain.Grass, baseColor: 0x4caf50 },
      { terrain: Terrain.Forest, baseColor: 0x2e7d32 },
      { terrain: Terrain.Sand, baseColor: 0xfdd835 },
      { terrain: Terrain.Tundra, baseColor: 0xcfd8dc },
      { terrain: Terrain.Swamp, baseColor: 0x6d7b3c },
      { terrain: Terrain.DeepForest, baseColor: 0x1b5e20 },
      { terrain: Terrain.Canyon, baseColor: 0xbf6830 },
    ];
    for (const { terrain, baseColor } of townBiomes) {
      const tg = this.add.graphics();
      // Biome base
      tg.fillStyle(baseColor, 1);
      tg.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
      // Building body
      tg.fillStyle(0x6d4c41, 1);
      tg.fillRect(6, 10, 20, 18);
      // Timber frame accents
      tg.fillStyle(0x5d4037, 1);
      tg.fillRect(6, 10, 20, 2);
      tg.fillRect(6, 20, 20, 2);
      // Roof
      tg.fillStyle(0xcc0000, 1);
      tg.fillTriangle(4, 12, 28, 12, 16, 2);
      tg.fillStyle(0xaa0000, 0.7);
      tg.fillTriangle(6, 12, 26, 12, 16, 4);
      // Door
      tg.fillStyle(0x3e2723, 1);
      tg.fillRect(14, 22, 5, 6);
      // Window
      tg.fillStyle(0xfff9c4, 0.8);
      tg.fillRect(8, 14, 5, 4);
      tg.fillRect(20, 14, 5, 4);
      // Grid
      tg.lineStyle(1, 0x000000, 0.15);
      tg.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
      tg.generateTexture(`tile_town_${terrain}`, TILE_SIZE, TILE_SIZE);
      tg.destroy();
    }
  }

  private generatePlayerTexture(): void {
    // Default player texture (used as fallback)
    this.generatePlayerTextureWithColors("player", 0x3f51b5, 0xffccbc, 0x1a237e);
  }

  private generatePlayerTextures(): void {
    for (const app of PLAYER_APPEARANCES) {
      this.generatePlayerTextureWithColors(
        `player_${app.id}`,
        app.bodyColor,
        app.skinColor,
        app.legColor
      );
    }
  }

  private generatePlayerTextureWithColors(
    key: string,
    bodyColor: number,
    skinColor: number,
    legColor: number
  ): void {
    const gfx = this.add.graphics();
    // Body
    gfx.fillStyle(bodyColor, 1);
    gfx.fillRect(8, 10, 16, 16);
    // Head
    gfx.fillStyle(skinColor, 1);
    gfx.fillCircle(16, 8, 6);
    // Legs
    gfx.fillStyle(legColor, 1);
    gfx.fillRect(9, 26, 5, 6);
    gfx.fillRect(18, 26, 5, 6);
    // Sword
    gfx.fillStyle(0xb0bec5, 1);
    gfx.fillRect(26, 6, 3, 18);
    gfx.fillStyle(0x795548, 1);
    gfx.fillRect(24, 20, 7, 3);

    gfx.generateTexture(key, TILE_SIZE, TILE_SIZE);
    gfx.destroy();
  }

  private generateMonsterTexture(): void {
    const gfx = this.add.graphics();
    // Generic monster silhouette (recolored in battle)
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(48, 32, 28);
    gfx.fillRect(20, 32, 56, 40);
    // Eyes
    gfx.fillStyle(0xff0000, 1);
    gfx.fillCircle(38, 28, 5);
    gfx.fillCircle(58, 28, 5);
    // Mouth
    gfx.fillStyle(0x000000, 1);
    gfx.fillRect(34, 42, 28, 6);
    // Fangs
    gfx.fillStyle(0xffffff, 1);
    gfx.fillTriangle(38, 42, 42, 42, 40, 50);
    gfx.fillTriangle(54, 42, 58, 42, 56, 50);

    gfx.generateTexture("monster", 96, 80);
    gfx.destroy();
  }

  private generateBossTexture(): void {
    const W = 128;
    const H = 110;
    const gfx = this.add.graphics();

    // --- Larger, more menacing boss silhouette ---

    // Wings (behind body)
    gfx.fillStyle(0xffffff, 0.4);
    gfx.fillTriangle(4, 50, 30, 20, 40, 60);
    gfx.fillTriangle(W - 4, 50, W - 30, 20, W - 40, 60);

    // Body (large oval)
    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(W / 2, 40, 36);
    gfx.fillRect(W / 2 - 36, 40, 72, 48);

    // Horns
    gfx.fillStyle(0xffffff, 0.85);
    gfx.fillTriangle(W / 2 - 20, 12, W / 2 - 30, -8, W / 2 - 14, 8);
    gfx.fillTriangle(W / 2 + 20, 12, W / 2 + 30, -8, W / 2 + 14, 8);

    // Eyes — larger, glowing
    gfx.fillStyle(0xff0000, 1);
    gfx.fillCircle(W / 2 - 14, 34, 8);
    gfx.fillCircle(W / 2 + 14, 34, 8);
    // Pupils
    gfx.fillStyle(0xffff00, 1);
    gfx.fillCircle(W / 2 - 14, 34, 4);
    gfx.fillCircle(W / 2 + 14, 34, 4);

    // Mouth with many fangs
    gfx.fillStyle(0x220000, 1);
    gfx.fillRect(W / 2 - 18, 52, 36, 10);
    gfx.fillStyle(0xffffff, 1);
    for (let i = 0; i < 5; i++) {
      const fx = W / 2 - 16 + i * 8;
      gfx.fillTriangle(fx, 52, fx + 4, 52, fx + 2, 64);
    }

    // Crown / spikes on top
    gfx.fillStyle(0xffffff, 0.7);
    for (let i = -2; i <= 2; i++) {
      const sx = W / 2 + i * 10;
      gfx.fillTriangle(sx - 4, 10, sx + 4, 10, sx, -2);
    }

    // Claws at bottom
    gfx.fillStyle(0xffffff, 0.9);
    gfx.fillTriangle(W / 2 - 28, 88, W / 2 - 22, 88, W / 2 - 25, H);
    gfx.fillTriangle(W / 2 - 16, 88, W / 2 - 10, 88, W / 2 - 13, H);
    gfx.fillTriangle(W / 2 + 10, 88, W / 2 + 16, 88, W / 2 + 13, H);
    gfx.fillTriangle(W / 2 + 22, 88, W / 2 + 28, 88, W / 2 + 25, H);

    gfx.generateTexture("monster_boss", W, H);
    gfx.destroy();
  }

  private generateUITextures(): void {
    // Panel background
    const panel = this.add.graphics();
    panel.fillStyle(0x1a1a2e, 0.92);
    panel.fillRect(0, 0, 400, 200);
    panel.lineStyle(2, 0xc0a060, 1);
    panel.strokeRect(1, 1, 398, 198);
    panel.generateTexture("panel", 400, 200);
    panel.destroy();

    // Button
    const btn = this.add.graphics();
    btn.fillStyle(0x2a2a4e, 1);
    btn.fillRect(0, 0, 160, 36);
    btn.lineStyle(2, 0xc0a060, 1);
    btn.strokeRect(0, 0, 160, 36);
    btn.generateTexture("button", 160, 36);
    btn.destroy();

    // Button hover
    const btnHover = this.add.graphics();
    btnHover.fillStyle(0x3a3a6e, 1);
    btnHover.fillRect(0, 0, 160, 36);
    btnHover.lineStyle(2, 0xffd700, 1);
    btnHover.strokeRect(0, 0, 160, 36);
    btnHover.generateTexture("buttonHover", 160, 36);
    btnHover.destroy();

    // Weather particle textures (sized to be visible at game scale)
    // Rain drop — tall narrow streak
    const rain = this.add.graphics();
    rain.fillStyle(0x88aaee, 1);
    rain.fillRect(0, 0, 3, 14);
    rain.generateTexture("particle_rain", 3, 14);
    rain.destroy();

    // Snow flake — soft circle
    const snow = this.add.graphics();
    snow.fillStyle(0xffffff, 1);
    snow.fillCircle(4, 4, 4);
    snow.generateTexture("particle_snow", 8, 8);
    snow.destroy();

    // Sand particle — small grit
    const sand = this.add.graphics();
    sand.fillStyle(0xddbb66, 1);
    sand.fillRect(0, 0, 5, 5);
    sand.generateTexture("particle_sand", 5, 5);
    sand.destroy();

    // Storm rain (heavier / wider streaks)
    const storm = this.add.graphics();
    storm.fillStyle(0x99aadd, 1);
    storm.fillRect(0, 0, 4, 18);
    storm.generateTexture("particle_storm", 4, 18);
    storm.destroy();

    // Fog wisp — large translucent blob
    const fog = this.add.graphics();
    fog.fillStyle(0xcccccc, 0.5);
    fog.fillCircle(10, 10, 10);
    fog.generateTexture("particle_fog", 20, 20);
    fog.destroy();

    // --- Biome decoration creature particles ---
    // Butterfly — soft pastel wings with dark body
    const bfly = this.add.graphics();
    // Left wing (light blue)
    bfly.fillStyle(0x88ccee, 0.85);
    bfly.fillCircle(1, 2, 2); // upper left
    bfly.fillCircle(1, 5, 1.5); // lower left
    // Right wing (light blue)
    bfly.fillStyle(0x88ccee, 0.85);
    bfly.fillCircle(5, 2, 2); // upper right
    bfly.fillCircle(5, 5, 1.5); // lower right
    // Wing spots (white)
    bfly.fillStyle(0xffffff, 0.5);
    bfly.fillCircle(1, 2, 1);
    bfly.fillCircle(5, 2, 1);
    // Body (dark)
    bfly.fillStyle(0x222222, 1);
    bfly.fillRect(3, 1, 1, 5);
    bfly.generateTexture("particle_butterfly", 7, 7);
    bfly.destroy();

    // Snake — tiny brown squiggle
    const snake = this.add.graphics();
    snake.fillStyle(0x886633, 1);
    snake.fillRect(0, 2, 3, 2);
    snake.fillRect(2, 0, 2, 3);
    snake.fillRect(4, 2, 3, 2);
    snake.fillRect(6, 0, 2, 3);
    snake.fillStyle(0x222222, 1);
    snake.fillRect(7, 0, 1, 1); // head/eye
    snake.generateTexture("particle_snake", 8, 4);
    snake.destroy();

    // Smoke puff — soft gray circle
    const smokePuff = this.add.graphics();
    smokePuff.fillStyle(0xbbbbbb, 0.7);
    smokePuff.fillCircle(5, 5, 5);
    smokePuff.fillStyle(0xdddddd, 0.4);
    smokePuff.fillCircle(4, 4, 3);
    smokePuff.generateTexture("particle_smoke", 10, 10);
    smokePuff.destroy();

    // Mosquito — tiny dark speck with wings
    const mosq = this.add.graphics();
    mosq.fillStyle(0x333333, 1);
    mosq.fillRect(2, 1, 2, 3); // body
    mosq.fillStyle(0x99aabb, 0.7);
    mosq.fillTriangle(0, 0, 2, 2, 0, 3); // left wing
    mosq.fillTriangle(6, 0, 4, 2, 6, 3); // right wing
    mosq.generateTexture("particle_mosquito", 7, 4);
    mosq.destroy();

    // --- City animal sprites (small pixel-art creatures) ---
    // Chicken — white body with red comb and orange beak (12x12)
    const chicken = this.add.graphics();
    chicken.fillStyle(0xfafafa, 1);
    chicken.fillCircle(6, 7, 4); // body
    chicken.fillStyle(0xeeeeee, 1);
    chicken.fillCircle(7, 4, 2.5); // head
    chicken.fillStyle(0xdd2222, 1);
    chicken.fillRect(6, 1, 3, 2); // comb
    chicken.fillStyle(0xff8800, 1);
    chicken.fillRect(9, 4, 2, 1); // beak
    chicken.fillStyle(0x111111, 1);
    chicken.fillRect(8, 3, 1, 1); // eye
    chicken.fillStyle(0xcc8800, 1);
    chicken.fillRect(4, 10, 2, 2); // left leg
    chicken.fillRect(7, 10, 2, 2); // right leg
    chicken.generateTexture("sprite_chicken", 12, 12);
    chicken.destroy();

    // Cat — small sitting cat (12x12)
    const cat = this.add.graphics();
    cat.fillStyle(0x888888, 1);
    cat.fillRect(3, 5, 7, 5); // body
    cat.fillCircle(6, 4, 3); // head
    cat.fillStyle(0x666666, 1);
    cat.fillTriangle(3, 1, 4, 4, 2, 4); // left ear
    cat.fillTriangle(9, 1, 8, 4, 10, 4); // right ear
    cat.fillStyle(0x44ff44, 0.8);
    cat.fillRect(5, 3, 1, 1); // left eye
    cat.fillRect(7, 3, 1, 1); // right eye
    cat.fillStyle(0xffaaaa, 1);
    cat.fillRect(6, 5, 1, 1); // nose
    cat.fillStyle(0x777777, 1);
    cat.fillRect(9, 7, 3, 1); // tail
    cat.fillRect(11, 6, 1, 2); // tail tip
    cat.generateTexture("sprite_cat", 12, 12);
    cat.destroy();

    // Mouse — tiny gray mouse (10x8)
    const mouse = this.add.graphics();
    mouse.fillStyle(0xaaaaaa, 1);
    mouse.fillRect(2, 3, 5, 3); // body
    mouse.fillCircle(7, 3, 2); // head
    mouse.fillStyle(0xddaaaa, 1);
    mouse.fillCircle(8, 1, 1.5); // ear
    mouse.fillStyle(0x111111, 1);
    mouse.fillRect(8, 3, 1, 1); // eye
    mouse.fillStyle(0xffaaaa, 1);
    mouse.fillRect(9, 4, 1, 1); // nose
    mouse.fillStyle(0x999999, 1);
    mouse.fillRect(0, 4, 3, 1); // tail
    mouse.generateTexture("sprite_mouse", 10, 8);
    mouse.destroy();

    // Frog — small green frog (12x10)
    const frog = this.add.graphics();
    frog.fillStyle(0x44aa44, 1);
    frog.fillRect(2, 4, 8, 5); // body
    frog.fillCircle(3, 4, 2); // left eye bump
    frog.fillCircle(9, 4, 2); // right eye bump
    frog.fillStyle(0x115511, 1);
    frog.fillRect(3, 3, 2, 1); // left eye
    frog.fillRect(8, 3, 2, 1); // right eye
    frog.fillStyle(0x338833, 1);
    frog.fillRect(0, 7, 3, 3); // left leg
    frog.fillRect(9, 7, 3, 3); // right leg
    frog.generateTexture("sprite_frog", 12, 10);
    frog.destroy();

    // Dog — big brown dog (16x14)
    const dog = this.add.graphics();
    dog.fillStyle(0x8b5e3c, 1);
    dog.fillRect(2, 5, 10, 6); // body
    dog.fillCircle(12, 5, 3.5); // head
    dog.fillStyle(0x7a4e2c, 1);
    dog.fillTriangle(10, 1, 11, 4, 9, 4); // left ear
    dog.fillTriangle(15, 1, 14, 4, 16, 4); // right ear
    dog.fillStyle(0x111111, 1);
    dog.fillRect(13, 4, 1, 1); // eye
    dog.fillStyle(0x333333, 1);
    dog.fillRect(14, 6, 2, 1); // nose
    dog.fillStyle(0x7a4e2c, 1);
    dog.fillRect(3, 10, 2, 4); // front left leg
    dog.fillRect(8, 10, 2, 4); // back left leg
    dog.fillStyle(0x8b5e3c, 0.8);
    dog.fillRect(0, 6, 3, 2); // tail
    dog.generateTexture("sprite_dog", 16, 14);
    dog.destroy();

    // Cow — spotted white/brown cow (16x14)
    const cow = this.add.graphics();
    cow.fillStyle(0xfafafa, 1);
    cow.fillRect(2, 4, 11, 7); // body
    cow.fillStyle(0x8b5e3c, 1);
    cow.fillRect(4, 5, 4, 3); // brown spot
    cow.fillRect(9, 6, 3, 3); // brown spot 2
    cow.fillCircle(13, 4, 2.5); // head
    cow.fillStyle(0xffcccc, 1);
    cow.fillRect(14, 5, 2, 2); // snout
    cow.fillStyle(0x111111, 1);
    cow.fillRect(14, 3, 1, 1); // eye
    cow.fillStyle(0x666666, 1);
    cow.fillTriangle(11, 1, 12, 3, 10, 3); // left horn
    cow.fillTriangle(15, 1, 14, 3, 16, 3); // right horn
    cow.fillStyle(0xdddddd, 1);
    cow.fillRect(3, 10, 2, 4); // front leg
    cow.fillRect(9, 10, 2, 4); // back leg
    cow.fillStyle(0x8b5e3c, 0.7);
    cow.fillRect(0, 7, 3, 1); // tail
    cow.generateTexture("sprite_cow", 16, 14);
    cow.destroy();

    // Sheep — fluffy white sheep (14x12)
    const sheep = this.add.graphics();
    sheep.fillStyle(0xeeeeee, 1);
    sheep.fillCircle(7, 6, 5); // fluffy body
    sheep.fillCircle(5, 5, 3);
    sheep.fillCircle(9, 5, 3);
    sheep.fillStyle(0x999999, 1);
    sheep.fillCircle(12, 4, 2.5); // head (gray face)
    sheep.fillStyle(0x111111, 1);
    sheep.fillRect(12, 3, 1, 1); // eye
    sheep.fillStyle(0x888888, 1);
    sheep.fillRect(4, 10, 2, 2); // front leg
    sheep.fillRect(8, 10, 2, 2); // back leg
    sheep.generateTexture("sprite_sheep", 14, 12);
    sheep.destroy();

    // Lizard — small orange/red lizard for volcanic areas (12x8)
    const liz = this.add.graphics();
    liz.fillStyle(0xdd6622, 1);
    liz.fillRect(3, 3, 6, 3); // body
    liz.fillCircle(9, 3, 2); // head
    liz.fillStyle(0xcc4411, 1);
    liz.fillRect(10, 3, 1, 1); // eye
    liz.fillStyle(0xbb5500, 1);
    liz.fillRect(0, 4, 4, 1); // tail
    liz.fillRect(4, 1, 1, 3); // front leg
    liz.fillRect(7, 1, 1, 3); // back leg
    liz.fillRect(4, 5, 1, 3); // front leg down
    liz.fillRect(7, 5, 1, 3); // back leg down
    liz.generateTexture("sprite_lizard", 12, 8);
    liz.destroy();
  }

  /** Generate procedural 640×560 battle backgrounds for each biome and boss. */
  private generateBattleBackgrounds(): void {
    const W = 640;
    const H = 560;

    // ── Biome backgrounds ──

    // Grass – green rolling hills + blue sky
    const grass = this.add.graphics();
    grass.fillStyle(0x87ceeb, 1); grass.fillRect(0, 0, W, H); // sky
    grass.fillGradientStyle(0x5588cc, 0x5588cc, 0x87ceeb, 0x87ceeb, 1);
    grass.fillRect(0, 0, W, H * 0.5);
    grass.fillStyle(0x4a8c3f, 1); grass.fillRect(0, H * 0.55, W, H * 0.45); // ground
    grass.fillStyle(0x5a9c4f, 1);
    for (let i = 0; i < 6; i++) { // rolling hills
      grass.fillCircle(i * 120 + 40, H * 0.56, 60 + (i % 3) * 15);
    }
    grass.fillStyle(0x3a7c2f, 0.4);
    for (let i = 0; i < 20; i++) { // grass tufts
      const gx = (i * 37) % W; const gy = H * 0.6 + (i * 19) % (H * 0.35);
      grass.fillTriangle(gx, gy, gx + 3, gy - 8, gx + 6, gy);
    }
    grass.generateTexture("bg_grass", W, H);
    grass.destroy();

    // Forest – dark green canopy + forest floor
    const forest = this.add.graphics();
    forest.fillStyle(0x2d5a27, 1); forest.fillRect(0, 0, W, H); // dark green wash
    forest.fillStyle(0x1a3a14, 1); forest.fillRect(0, H * 0.7, W, H * 0.3); // floor
    forest.fillStyle(0x3d2b1a, 1);
    for (let i = 0; i < 8; i++) { // tree trunks
      const tx = 30 + i * 80; forest.fillRect(tx, H * 0.2, 14, H * 0.55);
    }
    forest.fillStyle(0x1d6b18, 0.8);
    for (let i = 0; i < 8; i++) { // canopies
      const tx = 37 + i * 80; forest.fillCircle(tx, H * 0.22, 40);
      forest.fillCircle(tx - 20, H * 0.28, 30);
      forest.fillCircle(tx + 20, H * 0.28, 30);
    }
    forest.fillStyle(0x0e4a09, 0.5);
    for (let i = 0; i < 15; i++) { // leaves on floor
      forest.fillCircle((i * 47) % W, H * 0.72 + (i * 23) % (H * 0.25), 4);
    }
    forest.generateTexture("bg_forest", W, H);
    forest.destroy();

    // Sand – desert dunes + orange sky
    const sand = this.add.graphics();
    sand.fillGradientStyle(0xf4a460, 0xf4a460, 0xffcc66, 0xffcc66, 1);
    sand.fillRect(0, 0, W, H * 0.5); // warm sky
    sand.fillStyle(0xe8c170, 1); sand.fillRect(0, H * 0.45, W, H * 0.55); // sand ground
    sand.fillStyle(0xddb060, 1);
    for (let i = 0; i < 5; i++) { // dunes
      sand.fillCircle(i * 150 + 60, H * 0.5, 80 + (i % 2) * 30);
    }
    sand.fillStyle(0xffdd44, 1); sand.fillCircle(W * 0.8, H * 0.12, 30); // sun
    sand.fillStyle(0xc09040, 0.3);
    for (let i = 0; i < 12; i++) { // sand ripples
      const ry = H * 0.55 + i * 20;
      sand.fillRect(20 + (i * 31) % 100, ry, 80, 2);
    }
    sand.generateTexture("bg_sand", W, H);
    sand.destroy();

    // Tundra – snowy terrain + gray sky
    const tundra = this.add.graphics();
    tundra.fillStyle(0xb0c4de, 1); tundra.fillRect(0, 0, W, H); // overcast sky
    tundra.fillGradientStyle(0x8899aa, 0x8899aa, 0xb0c4de, 0xb0c4de, 1);
    tundra.fillRect(0, 0, W, H * 0.4);
    tundra.fillStyle(0xe8e8f0, 1); tundra.fillRect(0, H * 0.5, W, H * 0.5); // snow
    tundra.fillStyle(0xf0f0ff, 1);
    for (let i = 0; i < 6; i++) {
      tundra.fillCircle(i * 110 + 50, H * 0.52, 50 + (i % 3) * 10);
    }
    tundra.fillStyle(0xccccdd, 0.4);
    for (let i = 0; i < 15; i++) { // snowdrift lines
      tundra.fillRect((i * 51) % W, H * 0.6 + (i * 17) % (H * 0.3), 60, 3);
    }
    tundra.generateTexture("bg_tundra", W, H);
    tundra.destroy();

    // Swamp – murky green + brownish water
    const swamp = this.add.graphics();
    swamp.fillStyle(0x2a3a20, 1); swamp.fillRect(0, 0, W, H); // murky sky
    swamp.fillGradientStyle(0x3a4a30, 0x3a4a30, 0x1a2a10, 0x1a2a10, 1);
    swamp.fillRect(0, 0, W, H * 0.4);
    swamp.fillStyle(0x4a5a30, 1); swamp.fillRect(0, H * 0.5, W, H * 0.5); // marsh
    swamp.fillStyle(0x556b3a, 0.6);
    for (let i = 0; i < 8; i++) { // muck pools
      swamp.fillCircle((i * 90) + 30, H * 0.6 + (i % 3) * 40, 35);
    }
    swamp.fillStyle(0x2d401a, 1);
    for (let i = 0; i < 5; i++) { // dead trees
      const tx = 60 + i * 130; swamp.fillRect(tx, H * 0.3, 6, H * 0.35);
      swamp.fillRect(tx - 10, H * 0.32, 8, 3); // branch
      swamp.fillRect(tx + 6, H * 0.38, 8, 3);
    }
    swamp.generateTexture("bg_swamp", W, H);
    swamp.destroy();

    // Deep forest – very dark, dense canopy + shafts of light
    const dforest = this.add.graphics();
    dforest.fillStyle(0x0d2b0a, 1); dforest.fillRect(0, 0, W, H);
    dforest.fillStyle(0x1a1a0a, 1); dforest.fillRect(0, H * 0.7, W, H * 0.3);
    dforest.fillStyle(0x2a1a10, 1);
    for (let i = 0; i < 12; i++) { // dense trunks
      const tx = 15 + i * 55; dforest.fillRect(tx, 0, 18, H * 0.75);
    }
    dforest.fillStyle(0x0a4a06, 0.7);
    for (let i = 0; i < 12; i++) {
      const tx = 24 + i * 55; dforest.fillCircle(tx, H * 0.1, 45);
      dforest.fillCircle(tx, H * 0.3, 35);
    }
    dforest.fillStyle(0x88cc44, 0.12); // light shafts
    for (let i = 0; i < 4; i++) {
      const lx = 100 + i * 160;
      dforest.fillTriangle(lx, 0, lx - 30, H * 0.7, lx + 30, H * 0.7);
    }
    dforest.generateTexture("bg_deep_forest", W, H);
    dforest.destroy();

    // Volcanic – lava glow + dark rock + red sky
    const volcanic = this.add.graphics();
    volcanic.fillGradientStyle(0x330000, 0x330000, 0x661100, 0x661100, 1);
    volcanic.fillRect(0, 0, W, H * 0.5);
    volcanic.fillStyle(0x2a1a1a, 1); volcanic.fillRect(0, H * 0.5, W, H * 0.5);
    volcanic.fillStyle(0x1a0a0a, 1);
    for (let i = 0; i < 8; i++) { // rock formations
      volcanic.fillCircle(i * 90 + 30, H * 0.48, 40 + (i % 3) * 10);
    }
    volcanic.fillStyle(0xff4400, 0.6);
    for (let i = 0; i < 6; i++) { // lava pools
      volcanic.fillCircle(50 + i * 120, H * 0.75 + (i % 2) * 30, 20);
    }
    volcanic.fillStyle(0xff6600, 0.3);
    for (let i = 0; i < 10; i++) { // embers
      volcanic.fillCircle((i * 71) % W, H * 0.3 + (i * 43) % (H * 0.4), 3);
    }
    volcanic.generateTexture("bg_volcanic", W, H);
    volcanic.destroy();

    // Canyon – red/brown cliffs + dry blue sky
    const canyon = this.add.graphics();
    canyon.fillStyle(0x6699cc, 1); canyon.fillRect(0, 0, W, H * 0.4); // blue sky
    canyon.fillStyle(0xb05a30, 1); canyon.fillRect(0, H * 0.4, W, H * 0.6); // canyon floor
    canyon.fillStyle(0x8b4513, 1);
    for (let i = 0; i < 4; i++) { // cliff walls
      const cx = i * 180; canyon.fillRect(cx, H * 0.15, 50, H * 0.55);
      canyon.fillRect(cx + 140, H * 0.2, 40, H * 0.5);
    }
    canyon.fillStyle(0x995533, 0.5);
    for (let i = 0; i < 6; i++) { // rock layers
      canyon.fillRect(0, H * 0.4 + i * 18, W, 4);
    }
    canyon.fillStyle(0xcc8844, 1);
    for (let i = 0; i < 8; i++) { // small rocks
      canyon.fillCircle((i * 87) % W, H * 0.7 + (i * 29) % (H * 0.2), 8);
    }
    canyon.generateTexture("bg_canyon", W, H);
    canyon.destroy();

    // Dungeon – stone walls + torchlit gloom
    const dung = this.add.graphics();
    dung.fillStyle(0x1a1a22, 1); dung.fillRect(0, 0, W, H); // dark base
    dung.fillStyle(0x2a2a33, 1); dung.fillRect(0, H * 0.65, W, H * 0.35); // floor
    dung.fillStyle(0x333344, 1);
    for (let i = 0; i < 10; i++) { // stone blocks on walls
      for (let j = 0; j < 4; j++) {
        const bx = i * 66 + (j % 2) * 33; const by = j * 40 + 10;
        dung.fillRect(bx, by, 60, 35);
        dung.fillStyle(0x222233, 1);
        dung.fillRect(bx, by, 60, 2); // mortar lines
        dung.fillRect(bx, by, 2, 35);
        dung.fillStyle(0x333344, 1);
      }
    }
    dung.fillStyle(0xff8822, 0.15); // torch glow left
    dung.fillCircle(80, H * 0.35, 80);
    dung.fillStyle(0xff8822, 0.15); // torch glow right
    dung.fillCircle(W - 80, H * 0.35, 80);
    dung.fillStyle(0xff6600, 1);
    dung.fillRect(72, H * 0.3, 6, 14); // torch left
    dung.fillRect(W - 88, H * 0.3, 6, 14); // torch right
    dung.fillStyle(0xffaa00, 1);
    dung.fillCircle(75, H * 0.28, 5); // flame left
    dung.fillCircle(W - 85, H * 0.28, 5); // flame right
    dung.generateTexture("bg_dungeon", W, H);
    dung.destroy();

    // ── Boss backgrounds ──

    // Cave Troll – dark cave with stalactites
    const btroll = this.add.graphics();
    btroll.fillStyle(0x1a1a1a, 1); btroll.fillRect(0, 0, W, H);
    btroll.fillStyle(0x2a2a2a, 1); btroll.fillRect(0, H * 0.6, W, H * 0.4);
    btroll.fillStyle(0x333333, 1);
    for (let i = 0; i < 12; i++) { // stalactites
      const sx = i * 55 + 20; btroll.fillTriangle(sx, 0, sx - 10, 60 + (i % 3) * 20, sx + 10, 60 + (i % 3) * 20);
    }
    btroll.fillStyle(0x444444, 1);
    for (let i = 0; i < 8; i++) { // stalagmites
      const sx = i * 85 + 10; btroll.fillTriangle(sx, H, sx - 12, H - 50 - (i % 3) * 15, sx + 12, H - 50 - (i % 3) * 15);
    }
    btroll.fillStyle(0x556b2f, 0.15); // greenish glow
    btroll.fillCircle(W * 0.5, H * 0.5, 120);
    btroll.generateTexture("bg_boss_troll", W, H);
    btroll.destroy();

    // Young Red Dragon – fiery cavern, molten lava
    const bdragon = this.add.graphics();
    bdragon.fillGradientStyle(0x220000, 0x220000, 0x550000, 0x550000, 1);
    bdragon.fillRect(0, 0, W, H);
    bdragon.fillStyle(0x110000, 1); bdragon.fillRect(0, H * 0.55, W, H * 0.45);
    bdragon.fillStyle(0xff3300, 0.7);
    for (let i = 0; i < 8; i++) { // lava rivers
      bdragon.fillCircle(i * 90 + 30, H * 0.7 + (i % 2) * 40, 25);
    }
    bdragon.fillStyle(0xff6600, 0.5);
    for (let i = 0; i < 12; i++) { // embers rising
      bdragon.fillCircle((i * 57) % W, (i * 47) % (H * 0.5), 4);
    }
    bdragon.fillStyle(0xff0000, 0.1); // red glow
    bdragon.fillCircle(W * 0.5, H * 0.4, 150);
    bdragon.generateTexture("bg_boss_dragon", W, H);
    bdragon.destroy();

    // Frost Giant – icy glacier cavern
    const bfrost = this.add.graphics();
    bfrost.fillStyle(0xc0d8f0, 1); bfrost.fillRect(0, 0, W, H);
    bfrost.fillGradientStyle(0x8899bb, 0x8899bb, 0xc0d8f0, 0xc0d8f0, 1);
    bfrost.fillRect(0, 0, W, H * 0.4);
    bfrost.fillStyle(0xe0e8f8, 1); bfrost.fillRect(0, H * 0.55, W, H * 0.45);
    bfrost.fillStyle(0xaaccee, 0.5);
    for (let i = 0; i < 8; i++) { // icicles
      const ix = i * 85 + 20; bfrost.fillTriangle(ix, 0, ix - 8, 80 + (i % 3) * 25, ix + 8, 80 + (i % 3) * 25);
    }
    bfrost.fillStyle(0x6688aa, 0.3); // ice pillars
    for (let i = 0; i < 4; i++) {
      bfrost.fillRect(i * 180 + 50, H * 0.2, 25, H * 0.5);
    }
    bfrost.fillStyle(0x66bbff, 0.12); // icy glow
    bfrost.fillCircle(W * 0.5, H * 0.5, 130);
    bfrost.generateTexture("bg_boss_frostGiant", W, H);
    bfrost.destroy();

    // Swamp Hydra – toxic swamp with glowing pools
    const bhydra = this.add.graphics();
    bhydra.fillStyle(0x0a1a05, 1); bhydra.fillRect(0, 0, W, H);
    bhydra.fillStyle(0x1a2a10, 1); bhydra.fillRect(0, H * 0.5, W, H * 0.5);
    bhydra.fillStyle(0x44ff44, 0.2);
    for (let i = 0; i < 6; i++) { // toxic glowing pools
      bhydra.fillCircle(i * 110 + 40, H * 0.65 + (i % 2) * 50, 30 + (i % 3) * 10);
    }
    bhydra.fillStyle(0x2d401a, 1);
    for (let i = 0; i < 6; i++) { // gnarled trees
      const tx = 30 + i * 115; bhydra.fillRect(tx, H * 0.15, 8, H * 0.45);
      bhydra.fillRect(tx - 12, H * 0.18, 10, 3);
      bhydra.fillRect(tx + 8, H * 0.25, 12, 3);
    }
    bhydra.fillStyle(0x00ff00, 0.08); // green mist glow
    bhydra.fillCircle(W * 0.5, H * 0.4, 160);
    bhydra.generateTexture("bg_boss_swampHydra", W, H);
    bhydra.destroy();

    // Volcanic Wyrm – erupting volcano
    const bwyrm = this.add.graphics();
    bwyrm.fillGradientStyle(0x110000, 0x110000, 0x440000, 0x440000, 1);
    bwyrm.fillRect(0, 0, W, H);
    bwyrm.fillStyle(0x2a0a0a, 1); bwyrm.fillRect(0, H * 0.6, W, H * 0.4);
    bwyrm.fillStyle(0x3a1a0a, 1); // volcano shape
    bwyrm.fillTriangle(W * 0.5, H * 0.1, W * 0.2, H * 0.6, W * 0.8, H * 0.6);
    bwyrm.fillStyle(0xff4400, 0.8); // lava glow at crater
    bwyrm.fillCircle(W * 0.5, H * 0.15, 25);
    bwyrm.fillStyle(0xff6600, 0.5); // lava flow
    bwyrm.fillTriangle(W * 0.48, H * 0.15, W * 0.42, H * 0.6, W * 0.52, H * 0.6);
    bwyrm.fillStyle(0xff2200, 0.4);
    for (let i = 0; i < 15; i++) { // airborne embers
      bwyrm.fillCircle((i * 47) % W, (i * 37) % (H * 0.5), 3);
    }
    bwyrm.fillStyle(0xff8800, 0.08);
    bwyrm.fillCircle(W * 0.5, H * 0.35, 180);
    bwyrm.generateTexture("bg_boss_volcanicWyrm", W, H);
    bwyrm.destroy();

    // Canyon Drake – canyon with huge arch
    const bdrake = this.add.graphics();
    bdrake.fillStyle(0xcc8844, 1); bdrake.fillRect(0, 0, W, H); // warm sandstone
    bdrake.fillStyle(0x5588bb, 1); bdrake.fillRect(0, 0, W, H * 0.35); // sky
    bdrake.fillStyle(0x8b4513, 1);
    bdrake.fillRect(0, H * 0.2, 100, H * 0.8); // left cliff
    bdrake.fillRect(W - 100, H * 0.15, 100, H * 0.85); // right cliff
    bdrake.fillStyle(0x996633, 1); // natural arch
    bdrake.fillRect(80, H * 0.18, W - 160, 30);
    bdrake.fillStyle(0x5588bb, 1); // sky visible through arch
    bdrake.fillRect(120, H * 0.22, W - 240, 80);
    bdrake.fillStyle(0xaa7744, 1); bdrake.fillRect(0, H * 0.6, W, H * 0.4); // canyon floor
    bdrake.fillStyle(0x885533, 0.5);
    for (let i = 0; i < 10; i++) { // boulders
      bdrake.fillCircle((i * 70) % W, H * 0.65 + (i * 23) % (H * 0.25), 12 + (i % 3) * 5);
    }
    bdrake.generateTexture("bg_boss_canyonDrake", W, H);
    bdrake.destroy();
  }

  private showTitleScreen(): void {
    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;

    this.cameras.main.setBackgroundColor(0x0a0a1a);

    // Title
    this.add
      .text(cx, cy - 100, "2D&D", {
        fontSize: "64px",
        fontFamily: "monospace",
        color: "#ffd700",
        stroke: "#000",
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy - 40, "A Browser JRPG", {
        fontSize: "20px",
        fontFamily: "monospace",
        color: "#c0a060",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy + 4, "Dragon Quest meets Dungeons & Dragons", {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#888",
      })
      .setOrigin(0.5);

    // Menu options
    let menuY = cy + 50;

    const saveExists = hasSave();

    if (saveExists) {
      const summary = getSaveSummary() ?? "Saved game";
      const continueBtn = this.add
        .text(cx, menuY, "▶ Continue", {
          fontSize: "22px",
          fontFamily: "monospace",
          color: "#88ff88",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      continueBtn.on("pointerover", () => continueBtn.setColor("#ffd700"));
      continueBtn.on("pointerout", () => continueBtn.setColor("#88ff88"));
      continueBtn.on("pointerdown", () => this.continueGame());

      this.add
        .text(cx, menuY + 24, summary, {
          fontSize: "10px",
          fontFamily: "monospace",
          color: "#666",
        })
        .setOrigin(0.5);

      menuY += 54;
    }

    const newBtn = this.add
      .text(cx, menuY, "★ New Game", {
        fontSize: "22px",
        fontFamily: "monospace",
        color: "#fff",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    newBtn.on("pointerover", () => newBtn.setColor("#ffd700"));
    newBtn.on("pointerout", () => newBtn.setColor("#fff"));
    newBtn.on("pointerdown", () => this.showCharacterCreation());

    // Controls info
    this.add
      .text(cx, cy + 180, "WASD: Move  |  SPACE: Action  |  B: Bestiary  |  E: Equip", {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#555",
      })
      .setOrigin(0.5);

    // Keyboard shortcuts
    if (saveExists) {
      this.input.keyboard!.once("keydown-SPACE", () => this.continueGame());
      this.input.keyboard!.once("keydown-N", () => this.showCharacterCreation());

      this.add
        .text(cx, menuY + 36, "(SPACE = Continue  |  N = New Game)", {
          fontSize: "10px",
          fontFamily: "monospace",
          color: "#555",
        })
        .setOrigin(0.5);
    } else {
      this.input.keyboard!.once("keydown-SPACE", () => this.showCharacterCreation());
    }
  }

  private continueGame(): void {
    const save = loadGame();
    if (!save) return;
    // Regenerate player texture with custom appearance if present
    if (save.player.customAppearance) {
      const app = getAppearance(save.player.appearanceId);
      const key = `player_${save.player.appearanceId}`;
      if (this.textures.exists(key)) this.textures.remove(key);
      this.generatePlayerTextureWithHair(
        key,
        app.bodyColor,
        save.player.customAppearance.skinColor,
        app.legColor,
        save.player.customAppearance.hairStyle,
        save.player.customAppearance.hairColor
      );
    }
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => {
      this.scene.start("OverworldScene", {
        player: save.player,
        defeatedBosses: new Set(save.defeatedBosses),
        bestiary: save.bestiary,
        timeStep: save.timeStep ?? 0,
        weatherState: save.weatherState,
      });
    });
  }

  private showCharacterCreation(): void {
    // Clear the title screen
    this.children.removeAll(true);
    this.tweens.killAll();
    this.input.keyboard!.removeAllListeners();

    const cx = this.cameras.main.centerX;

    this.add
      .text(cx, 15, "Create Your Hero", {
        fontSize: "24px",
        fontFamily: "monospace",
        color: "#ffd700",
      })
      .setOrigin(0.5, 0);

    // Name entry
    this.add
      .text(cx, 50, "Name:", {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#c0a060",
      })
      .setOrigin(0.5, 0);

    let playerName = "Hero";
    const nameText = this.add
      .text(cx, 70, playerName, {
        fontSize: "18px",
        fontFamily: "monospace",
        color: "#fff",
        backgroundColor: "#1a1a2e",
        padding: { x: 12, y: 4 },
      })
      .setOrigin(0.5, 0);

    // Handle typing for name
    this.input.keyboard!.on("keydown", (event: KeyboardEvent) => {
      if (event.key === "Backspace") {
        playerName = playerName.slice(0, -1);
      } else if (event.key.length === 1 && playerName.length < 12 && /[a-zA-Z0-9 ]/.test(event.key)) {
        playerName += event.key;
      }
      nameText.setText(playerName || "_");
    });

    // Class selection
    this.add
      .text(cx, 105, "Choose Class:", {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#c0a060",
      })
      .setOrigin(0.5, 0);

    let selectedAppearance = PLAYER_APPEARANCES[0];

    // Class option grid
    const cols = 4;
    const optW = 72;
    const optH = 62;
    const startX = cx - ((Math.min(cols, PLAYER_APPEARANCES.length) * optW) / 2) + optW / 2;
    const startY = 150;

    const optionHighlights: Phaser.GameObjects.Graphics[] = [];

    PLAYER_APPEARANCES.forEach((app, i) => {
      const ox = startX + (i % cols) * optW;
      const oy = startY + Math.floor(i / cols) * optH;

      // Highlight box
      const hl = this.add.graphics();
      hl.lineStyle(2, app.id === selectedAppearance.id ? 0xffd700 : 0x444444, 1);
      if (app.id === selectedAppearance.id) {
        hl.fillStyle(0xffd700, 0.1);
        hl.fillRect(ox - 28, oy - 22, 56, 62);
      }
      hl.strokeRect(ox - 28, oy - 22, 56, 62);
      optionHighlights.push(hl);

      // Sprite preview
      this.add.sprite(ox, oy, `player_${app.id}`).setScale(1.8);

      // Label
      this.add
        .text(ox, oy + 24, app.label, {
          fontSize: "10px",
          fontFamily: "monospace",
          color: "#ccc",
          stroke: "#000",
          strokeThickness: 2,
        })
        .setOrigin(0.5, 0);

      // Make the whole box clickable
      const hitZone = this.add.zone(ox, oy + 10, 56, 62).setInteractive({ useHandCursor: true });
      hitZone.on("pointerdown", () => {
        selectedAppearance = app;
        // Update highlights
        optionHighlights.forEach((h, j) => {
          h.clear();
          const isSelected = PLAYER_APPEARANCES[j].id === app.id;
          h.lineStyle(2, isSelected ? 0xffd700 : 0x444444, 1);
          if (isSelected) {
            h.fillStyle(0xffd700, 0.1);
          }
          const hx = startX + (j % cols) * optW;
          const hy = startY + Math.floor(j / cols) * optH;
          if (isSelected) h.fillRect(hx - 28, hy - 22, 56, 62);
          h.strokeRect(hx - 28, hy - 22, 56, 62);
        });
      });
    });

    // Next button
    const btnY = startY + Math.ceil(PLAYER_APPEARANCES.length / cols) * optH + 16;

    const nextBtn = this.add
      .text(cx, btnY, "[ Next > ]", {
        fontSize: "20px",
        fontFamily: "monospace",
        color: "#88ff88",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    nextBtn.on("pointerover", () => nextBtn.setColor("#ffd700"));
    nextBtn.on("pointerout", () => nextBtn.setColor("#88ff88"));

    const goNext = () => {
      this.showAppearanceCustomization(playerName, selectedAppearance);
    };

    nextBtn.on("pointerdown", goNext);

    this.tweens.add({
      targets: nextBtn,
      alpha: 0.4,
      duration: 900,
      yoyo: true,
      repeat: -1,
    });

    this.input.keyboard!.on("keydown-ENTER", goNext);
  }

  private showAppearanceCustomization(playerName: string, selectedClass: PlayerAppearance): void {
    this.children.removeAll(true);
    this.tweens.killAll();
    this.input.keyboard!.removeAllListeners();

    const cx = this.cameras.main.centerX;

    // y=8: title (22px tall) → bottom ~30
    this.add
      .text(cx, 8, "Customize Appearance", {
        fontSize: "22px",
        fontFamily: "monospace",
        color: "#ffd700",
      })
      .setOrigin(0.5, 0);

    // y=34: class label (12px) → bottom ~46
    this.add
      .text(cx, 34, `Class: ${selectedClass.label}`, {
        fontSize: "12px",
        fontFamily: "monospace",
        color: "#888",
      })
      .setOrigin(0.5, 0);

    // State
    let selectedSkinColor = SKIN_COLOR_OPTIONS[0].color;
    let selectedHairStyle = HAIR_STYLE_OPTIONS[0].id;
    let selectedHairColor = HAIR_COLOR_OPTIONS[0].color;

    // y=78: preview sprite center, scale 2 (64px tall: top=46, bottom=110)
    const previewKey = "preview_custom";
    this.generatePlayerTextureWithHair(
      previewKey,
      selectedClass.bodyColor,
      selectedSkinColor,
      selectedClass.legColor,
      selectedHairStyle,
      selectedHairColor
    );
    const previewSprite = this.add.sprite(cx, 78, previewKey).setScale(2);

    const updatePreview = () => {
      if (this.textures.exists(previewKey)) this.textures.remove(previewKey);
      this.generatePlayerTextureWithHair(
        previewKey,
        selectedClass.bodyColor,
        selectedSkinColor,
        selectedClass.legColor,
        selectedHairStyle,
        selectedHairColor
      );
      previewSprite.setTexture(previewKey);
    };

    // y=118: skin color label (13px) → bottom ~131
    this.add
      .text(cx, 118, "Skin Color:", {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#c0a060",
      })
      .setOrigin(0.5, 0);

    // y=142: skin swatches center (radius 10 → top=132, bottom=152; labels at y=156 → bottom ~164)
    const skinSwatchY = 142;
    const skinSwatchSpacing = 40;
    const skinStartX = cx - ((SKIN_COLOR_OPTIONS.length - 1) * skinSwatchSpacing) / 2;
    const skinHighlights: Phaser.GameObjects.Graphics[] = [];

    SKIN_COLOR_OPTIONS.forEach((opt, i) => {
      const sx = skinStartX + i * skinSwatchSpacing;

      const gfx = this.add.graphics();
      gfx.fillStyle(opt.color, 1);
      gfx.fillCircle(sx, skinSwatchY, 10);
      gfx.lineStyle(2, i === 0 ? 0xffd700 : 0x444444, 1);
      gfx.strokeCircle(sx, skinSwatchY, 11);
      skinHighlights.push(gfx);

      this.add
        .text(sx, skinSwatchY + 15, opt.label, {
          fontSize: "8px",
          fontFamily: "monospace",
          color: "#999",
        })
        .setOrigin(0.5, 0);

      const hitZone = this.add.zone(sx, skinSwatchY, 24, 24).setInteractive({ useHandCursor: true });
      hitZone.on("pointerdown", () => {
        selectedSkinColor = opt.color;
        SKIN_COLOR_OPTIONS.forEach((_, j) => {
          const hx = skinStartX + j * skinSwatchSpacing;
          skinHighlights[j].clear();
          skinHighlights[j].fillStyle(SKIN_COLOR_OPTIONS[j].color, 1);
          skinHighlights[j].fillCircle(hx, skinSwatchY, 10);
          skinHighlights[j].lineStyle(2, j === i ? 0xffd700 : 0x444444, 1);
          skinHighlights[j].strokeCircle(hx, skinSwatchY, 11);
        });
        updatePreview();
      });
    });

    // y=174: hair style label (13px) → bottom ~187
    this.add
      .text(cx, 174, "Hair Style:", {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#c0a060",
      })
      .setOrigin(0.5, 0);

    // y=196: hair style buttons (~25px with padding) → bottom ~221
    const hairStyleY = 196;
    const hairStyleSpacing = 80;
    const hairStyleStartX = cx - ((HAIR_STYLE_OPTIONS.length - 1) * hairStyleSpacing) / 2;
    const hairStyleTexts: Phaser.GameObjects.Text[] = [];

    HAIR_STYLE_OPTIONS.forEach((opt, i) => {
      const sx = hairStyleStartX + i * hairStyleSpacing;
      const txt = this.add
        .text(sx, hairStyleY, opt.label, {
          fontSize: "13px",
          fontFamily: "monospace",
          color: i === 0 ? "#ffd700" : "#888",
          backgroundColor: i === 0 ? "#2a2a2a" : undefined,
          padding: { x: 6, y: 3 },
        })
        .setOrigin(0.5, 0)
        .setInteractive({ useHandCursor: true });
      hairStyleTexts.push(txt);

      txt.on("pointerdown", () => {
        selectedHairStyle = opt.id;
        hairStyleTexts.forEach((t, j) => {
          t.setColor(j === i ? "#ffd700" : "#888");
          t.setBackgroundColor(j === i ? "#2a2a2a" : "");
        });
        updatePreview();
      });
    });

    // y=232: hair color label (13px) → bottom ~245
    this.add
      .text(cx, 232, "Hair Color:", {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#c0a060",
      })
      .setOrigin(0.5, 0);

    // y=256: hair color swatches center (radius 10 → top=246, bottom=266; labels at y=270 → bottom ~278)
    const hairSwatchY = 256;
    const hairSwatchSpacing = 40;
    const hairStartX = cx - ((HAIR_COLOR_OPTIONS.length - 1) * hairSwatchSpacing) / 2;
    const hairHighlights: Phaser.GameObjects.Graphics[] = [];

    HAIR_COLOR_OPTIONS.forEach((opt, i) => {
      const hx = hairStartX + i * hairSwatchSpacing;

      const gfx = this.add.graphics();
      gfx.fillStyle(opt.color, 1);
      gfx.fillCircle(hx, hairSwatchY, 10);
      gfx.lineStyle(2, i === 0 ? 0xffd700 : 0x444444, 1);
      gfx.strokeCircle(hx, hairSwatchY, 11);
      hairHighlights.push(gfx);

      this.add
        .text(hx, hairSwatchY + 15, opt.label, {
          fontSize: "8px",
          fontFamily: "monospace",
          color: "#999",
        })
        .setOrigin(0.5, 0);

      const hitZone = this.add.zone(hx, hairSwatchY, 24, 24).setInteractive({ useHandCursor: true });
      hitZone.on("pointerdown", () => {
        selectedHairColor = opt.color;
        HAIR_COLOR_OPTIONS.forEach((_, j) => {
          const hhx = hairStartX + j * hairSwatchSpacing;
          hairHighlights[j].clear();
          hairHighlights[j].fillStyle(HAIR_COLOR_OPTIONS[j].color, 1);
          hairHighlights[j].fillCircle(hhx, hairSwatchY, 10);
          hairHighlights[j].lineStyle(2, j === i ? 0xffd700 : 0x444444, 1);
          hairHighlights[j].strokeCircle(hhx, hairSwatchY, 11);
        });
        updatePreview();
      });
    });

    // y=300: back/start buttons
    const btnY = 300;

    const backBtn = this.add
      .text(cx - 100, btnY, "[ < Back ]", {
        fontSize: "16px",
        fontFamily: "monospace",
        color: "#aaa",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    backBtn.on("pointerover", () => backBtn.setColor("#ffd700"));
    backBtn.on("pointerout", () => backBtn.setColor("#aaa"));
    backBtn.on("pointerdown", () => this.showCharacterCreation());

    const startBtn = this.add
      .text(cx + 100, btnY, "[ Start Adventure ]", {
        fontSize: "16px",
        fontFamily: "monospace",
        color: "#88ff88",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    startBtn.on("pointerover", () => startBtn.setColor("#ffd700"));
    startBtn.on("pointerout", () => startBtn.setColor("#88ff88"));

    const doStart = () => {
      const name = playerName.trim() || "Hero";
      const customAppearance: CustomAppearance = {
        skinColor: selectedSkinColor,
        hairStyle: selectedHairStyle,
        hairColor: selectedHairColor,
      };
      const player = createPlayer(name, selectedClass.id, customAppearance);

      // Generate final player texture with custom appearance
      const texKey = `player_${selectedClass.id}`;
      if (this.textures.exists(texKey)) this.textures.remove(texKey);
      this.generatePlayerTextureWithHair(
        texKey,
        selectedClass.bodyColor,
        selectedSkinColor,
        selectedClass.legColor,
        selectedHairStyle,
        selectedHairColor
      );

      deleteSave();
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.time.delayedCall(500, () => {
        this.scene.start("OverworldScene", { player });
      });
    };

    startBtn.on("pointerdown", doStart);

    this.tweens.add({
      targets: startBtn,
      alpha: 0.4,
      duration: 900,
      yoyo: true,
      repeat: -1,
    });

    this.input.keyboard!.on("keydown-ENTER", doStart);
  }

  private generatePlayerTextureWithHair(
    key: string,
    bodyColor: number,
    skinColor: number,
    legColor: number,
    hairStyle: number,
    hairColor: number
  ): void {
    const gfx = this.add.graphics();
    // Body
    gfx.fillStyle(bodyColor, 1);
    gfx.fillRect(8, 10, 16, 16);
    // Head
    gfx.fillStyle(skinColor, 1);
    gfx.fillCircle(16, 8, 6);
    // Hair
    if (hairStyle > 0) {
      gfx.fillStyle(hairColor, 1);
      if (hairStyle === 1) {
        // Short hair — small cap on top
        gfx.fillRect(11, 2, 10, 4);
      } else if (hairStyle === 2) {
        // Medium hair — covers top and sides slightly
        gfx.fillRect(10, 1, 12, 5);
        gfx.fillRect(9, 4, 4, 6);
        gfx.fillRect(19, 4, 4, 6);
      } else if (hairStyle === 3) {
        // Long hair — extends down to shoulders
        gfx.fillRect(10, 1, 12, 5);
        gfx.fillRect(8, 3, 5, 14);
        gfx.fillRect(19, 3, 5, 14);
      }
    }
    // Legs
    gfx.fillStyle(legColor, 1);
    gfx.fillRect(9, 26, 5, 6);
    gfx.fillRect(18, 26, 5, 6);
    // Sword
    gfx.fillStyle(0xb0bec5, 1);
    gfx.fillRect(26, 6, 3, 18);
    gfx.fillStyle(0x795548, 1);
    gfx.fillRect(24, 20, 7, 3);

    gfx.generateTexture(key, TILE_SIZE, TILE_SIZE);
    gfx.destroy();
  }
}
