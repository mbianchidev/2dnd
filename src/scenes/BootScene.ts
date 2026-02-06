/**
 * Boot scene: generates all procedural assets and shows a title screen.
 */

import Phaser from "phaser";
import { TERRAIN_COLORS, Terrain } from "../data/map";

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
    this.generateMonsterTexture();
    this.generateUITextures();
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
      }

      // Add grid border
      gfx.lineStyle(1, 0x000000, 0.15);
      gfx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);

      gfx.generateTexture(key, TILE_SIZE, TILE_SIZE);
      gfx.destroy();
    }
  }

  private generatePlayerTexture(): void {
    const gfx = this.add.graphics();
    // Body
    gfx.fillStyle(0x3f51b5, 1);
    gfx.fillRect(8, 10, 16, 16);
    // Head
    gfx.fillStyle(0xffccbc, 1);
    gfx.fillCircle(16, 8, 6);
    // Legs
    gfx.fillStyle(0x1a237e, 1);
    gfx.fillRect(9, 26, 5, 6);
    gfx.fillRect(18, 26, 5, 6);
    // Sword
    gfx.fillStyle(0xb0bec5, 1);
    gfx.fillRect(26, 6, 3, 18);
    gfx.fillStyle(0x795548, 1);
    gfx.fillRect(24, 20, 7, 3);

    gfx.generateTexture("player", TILE_SIZE, TILE_SIZE);
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
  }

  private showTitleScreen(): void {
    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;

    // Background
    this.cameras.main.setBackgroundColor(0x0a0a1a);

    // Title
    this.add
      .text(cx, cy - 80, "2D&D", {
        fontSize: "64px",
        fontFamily: "monospace",
        color: "#ffd700",
        stroke: "#000",
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy - 20, "A Browser JRPG", {
        fontSize: "20px",
        fontFamily: "monospace",
        color: "#c0a060",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy + 30, "Dragon Quest meets Dungeons & Dragons", {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#888",
      })
      .setOrigin(0.5);

    // Start button
    const startText = this.add
      .text(cx, cy + 90, "[ Press SPACE to Start ]", {
        fontSize: "22px",
        fontFamily: "monospace",
        color: "#fff",
      })
      .setOrigin(0.5);

    // Blink effect
    this.tweens.add({
      targets: startText,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    // Controls info
    this.add
      .text(cx, cy + 150, "WASD: Move  |  SPACE: Action  |  ESC: Menu", {
        fontSize: "12px",
        fontFamily: "monospace",
        color: "#666",
      })
      .setOrigin(0.5);

    // Wait for space to start
    this.input.keyboard!.once("keydown-SPACE", () => {
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.time.delayedCall(500, () => {
        this.scene.start("OverworldScene");
      });
    });
  }
}
