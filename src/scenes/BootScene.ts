/**
 * Boot scene: generates all procedural assets and shows a title screen.
 */

import Phaser from "phaser";
import { TERRAIN_COLORS, Terrain } from "../data/map";
import { PLAYER_APPEARANCES, type PlayerAppearance } from "../systems/appearance";
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
      }

      // Add grid border
      gfx.lineStyle(1, 0x000000, 0.15);
      gfx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);

      gfx.generateTexture(key, TILE_SIZE, TILE_SIZE);
      gfx.destroy();
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
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.time.delayedCall(500, () => {
      this.scene.start("OverworldScene", {
        player: save.player,
        defeatedBosses: new Set(save.defeatedBosses),
        bestiary: save.bestiary,
      });
    });
  }

  private showCharacterCreation(): void {
    // Clear the title screen
    this.children.removeAll(true);
    this.tweens.killAll();

    const cx = this.cameras.main.centerX;
    const w = this.cameras.main.width;

    this.add
      .text(cx, 20, "Create Your Hero", {
        fontSize: "24px",
        fontFamily: "monospace",
        color: "#ffd700",
      })
      .setOrigin(0.5, 0);

    // Name entry
    this.add
      .text(cx, 58, "Name:", {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#c0a060",
      })
      .setOrigin(0.5, 0);

    let playerName = "Hero";
    const nameText = this.add
      .text(cx, 78, playerName, {
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

    // Appearance selection
    this.add
      .text(cx, 116, "Choose Appearance:", {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#c0a060",
      })
      .setOrigin(0.5, 0);

    let selectedAppearance = PLAYER_APPEARANCES[0];
    const previewSprite = this.add
      .sprite(cx, 180, `player_${selectedAppearance.id}`)
      .setScale(3);

    const selectedLabel = this.add
      .text(cx, 210, selectedAppearance.label, {
        fontSize: "14px",
        fontFamily: "monospace",
        color: "#88ff88",
      })
      .setOrigin(0.5, 0);

    // Appearance option grid
    const cols = 4;
    const optW = 72;
    const optH = 68;
    const startX = cx - ((Math.min(cols, PLAYER_APPEARANCES.length) * optW) / 2) + optW / 2;
    const startY = 240;

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
      const spr = this.add.sprite(ox, oy, `player_${app.id}`).setScale(1.8);

      // Label — bigger and clearer
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
        previewSprite.setTexture(`player_${app.id}`);
        selectedLabel.setText(app.label);
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

    // Start Adventure button
    const btnY = startY + Math.ceil(PLAYER_APPEARANCES.length / cols) * optH + 16;

    const startBtn = this.add
      .text(cx, btnY, "[ Start Adventure ]", {
        fontSize: "20px",
        fontFamily: "monospace",
        color: "#88ff88",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    startBtn.on("pointerover", () => startBtn.setColor("#ffd700"));
    startBtn.on("pointerout", () => startBtn.setColor("#88ff88"));

    const doStart = () => {
      const name = playerName.trim() || "Hero";
      const player = createPlayer(name, selectedAppearance.id);
      deleteSave(); // clear any old save for new run
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.time.delayedCall(500, () => {
        this.scene.start("OverworldScene", { player });
      });
    };

    startBtn.on("pointerdown", doStart);

    // Blink the start btn
    this.tweens.add({
      targets: startBtn,
      alpha: 0.4,
      duration: 900,
      yoyo: true,
      repeat: -1,
    });

    // ENTER also starts
    this.input.keyboard!.on("keydown-ENTER", doStart);
  }
}
