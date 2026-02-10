/**
 * Boot scene: generates all procedural assets and shows a title screen.
 */

import Phaser from "phaser";
import { TERRAIN_COLORS, Terrain } from "../data/map";
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
          // Stone building wall
          gfx.fillStyle(0x3e2723, 0.8);
          gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
          gfx.lineStyle(1, 0x4e342e, 0.5);
          gfx.strokeRect(2, 2, 12, 8);
          gfx.strokeRect(16, 2, 14, 8);
          gfx.strokeRect(0, 12, 10, 8);
          gfx.strokeRect(12, 12, 10, 8);
          gfx.strokeRect(24, 12, 8, 8);
          gfx.strokeRect(2, 22, 12, 8);
          gfx.strokeRect(16, 22, 14, 8);
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
