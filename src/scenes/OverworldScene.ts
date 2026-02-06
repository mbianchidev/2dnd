/**
 * Overworld scene: tile-based map with WASD movement and encounters.
 */

import Phaser from "phaser";
import {
  MAP_DATA,
  MAP_WIDTH,
  MAP_HEIGHT,
  TOWNS,
  BOSSES,
  ENCOUNTER_RATES,
  Terrain,
  isWalkable,
  getTerrainAt,
} from "../data/map";
import { getRandomEncounter, getBoss } from "../data/monsters";
import { createPlayer, type PlayerState } from "../systems/player";
import { abilityModifier } from "../utils/dice";

const TILE_SIZE = 32;

export class OverworldScene extends Phaser.Scene {
  private player!: PlayerState;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private keys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
  };
  private isMoving = false;
  private moveDelay = 150; // ms between moves
  private lastMoveTime = 0;
  private hudText!: Phaser.GameObjects.Text;
  private locationText!: Phaser.GameObjects.Text;
  private tileSprites: Phaser.GameObjects.Sprite[][] = [];
  private defeatedBosses: Set<string> = new Set();

  constructor() {
    super({ key: "OverworldScene" });
  }

  init(data?: { player?: PlayerState; defeatedBosses?: Set<string> }): void {
    if (data?.player) {
      this.player = data.player;
    } else {
      this.player = createPlayer("Hero");
    }
    if (data?.defeatedBosses) {
      this.defeatedBosses = data.defeatedBosses;
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x111111);
    this.cameras.main.fadeIn(500);

    this.renderMap();
    this.createPlayer();
    this.setupInput();
    this.createHUD();
    this.updateLocationText();
  }

  private renderMap(): void {
    this.tileSprites = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
      this.tileSprites[y] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        const terrain = MAP_DATA[y][x];
        const sprite = this.add.sprite(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          `tile_${terrain}`
        );
        this.tileSprites[y][x] = sprite;
      }
    }

    // Add town labels
    for (const town of TOWNS) {
      this.add
        .text(town.x * TILE_SIZE + TILE_SIZE / 2, town.y * TILE_SIZE - 4, town.name, {
          fontSize: "9px",
          fontFamily: "monospace",
          color: "#fff",
          stroke: "#000",
          strokeThickness: 2,
        })
        .setOrigin(0.5, 1);
    }

    // Add boss markers (if not defeated)
    for (const boss of BOSSES) {
      if (!this.defeatedBosses.has(boss.monsterId)) {
        this.add
          .text(
            boss.x * TILE_SIZE + TILE_SIZE / 2,
            boss.y * TILE_SIZE - 4,
            "☠ " + boss.name,
            {
              fontSize: "8px",
              fontFamily: "monospace",
              color: "#ff4444",
              stroke: "#000",
              strokeThickness: 2,
            }
          )
          .setOrigin(0.5, 1);
      }
    }
  }

  private createPlayer(): void {
    this.playerSprite = this.add.sprite(
      this.player.x * TILE_SIZE + TILE_SIZE / 2,
      this.player.y * TILE_SIZE + TILE_SIZE / 2,
      "player"
    );
    this.playerSprite.setDepth(10);
  }

  private setupInput(): void {
    this.keys = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      SPACE: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    };
  }

  private createHUD(): void {
    // HUD background
    const hudBg = this.add.graphics();
    hudBg.fillStyle(0x1a1a2e, 0.9);
    hudBg.fillRect(0, MAP_HEIGHT * TILE_SIZE, MAP_WIDTH * TILE_SIZE, 80);
    hudBg.lineStyle(2, 0xc0a060, 1);
    hudBg.strokeRect(0, MAP_HEIGHT * TILE_SIZE, MAP_WIDTH * TILE_SIZE, 80);
    hudBg.setDepth(20);

    this.hudText = this.add
      .text(10, MAP_HEIGHT * TILE_SIZE + 8, "", {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#ddd",
        lineSpacing: 4,
      })
      .setDepth(21);

    this.locationText = this.add
      .text(MAP_WIDTH * TILE_SIZE - 10, MAP_HEIGHT * TILE_SIZE + 8, "", {
        fontSize: "12px",
        fontFamily: "monospace",
        color: "#aaa",
        align: "right",
        lineSpacing: 4,
      })
      .setOrigin(1, 0)
      .setDepth(21);

    this.updateHUD();
  }

  private updateHUD(): void {
    const p = this.player;
    this.hudText.setText(
      `${p.name} Lv.${p.level}\n` +
        `HP: ${p.hp}/${p.maxHp}  MP: ${p.mp}/${p.maxMp}\n` +
        `Gold: ${p.gold}  XP: ${p.xp}/${(p.level + 1) * (p.level + 1) * 100}`
    );
  }

  private updateLocationText(): void {
    const terrain = getTerrainAt(this.player.x, this.player.y);
    const terrainNames: Record<number, string> = {
      [Terrain.Grass]: "Grassland",
      [Terrain.Forest]: "Forest",
      [Terrain.Mountain]: "Mountain",
      [Terrain.Water]: "Water",
      [Terrain.Sand]: "Desert",
      [Terrain.Town]: "Town",
      [Terrain.Dungeon]: "Dungeon",
      [Terrain.Boss]: "Boss Lair",
      [Terrain.Path]: "Road",
    };

    const town = TOWNS.find(
      (t) => t.x === this.player.x && t.y === this.player.y
    );
    const boss = BOSSES.find(
      (b) => b.x === this.player.x && b.y === this.player.y
    );

    let locStr = terrainNames[terrain ?? 0] ?? "Unknown";
    if (town) locStr = `${town.name}\n[SPACE] Enter Shop`;
    if (boss && !this.defeatedBosses.has(boss.monsterId))
      locStr = `${boss.name}'s Lair\n[SPACE] Challenge Boss`;

    this.locationText.setText(locStr);
  }

  update(time: number): void {
    if (this.isMoving) return;
    if (time - this.lastMoveTime < this.moveDelay) return;

    let dx = 0;
    let dy = 0;

    if (this.keys.W.isDown) dy = -1;
    else if (this.keys.S.isDown) dy = 1;
    else if (this.keys.A.isDown) dx = -1;
    else if (this.keys.D.isDown) dx = 1;

    if (dx !== 0 || dy !== 0) {
      this.tryMove(dx, dy, time);
    }

    // Space for actions (enter town/shop or challenge boss)
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      this.handleAction();
    }
  }

  private tryMove(dx: number, dy: number, time: number): void {
    const newX = this.player.x + dx;
    const newY = this.player.y + dy;

    const terrain = getTerrainAt(newX, newY);
    if (terrain === undefined || !isWalkable(terrain)) return;

    this.lastMoveTime = time;
    this.isMoving = true;
    this.player.x = newX;
    this.player.y = newY;

    this.tweens.add({
      targets: this.playerSprite,
      x: newX * TILE_SIZE + TILE_SIZE / 2,
      y: newY * TILE_SIZE + TILE_SIZE / 2,
      duration: 120,
      onComplete: () => {
        this.isMoving = false;
        this.updateHUD();
        this.updateLocationText();
        this.checkEncounter(terrain);
      },
    });
  }

  private checkEncounter(terrain: Terrain): void {
    // Boss tile: handled by SPACE action, not random
    if (terrain === Terrain.Boss) return;
    if (terrain === Terrain.Town) return;

    const rate = ENCOUNTER_RATES[terrain];
    if (Math.random() < rate) {
      const monster = getRandomEncounter(this.player.level);
      this.startBattle(monster);
    }
  }

  private handleAction(): void {
    // Check if on a town
    const town = TOWNS.find(
      (t) => t.x === this.player.x && t.y === this.player.y
    );
    if (town?.hasShop) {
      this.scene.start("ShopScene", {
        player: this.player,
        townName: town.name,
        defeatedBosses: this.defeatedBosses,
      });
      return;
    }

    // Check if on a boss tile
    const boss = BOSSES.find(
      (b) => b.x === this.player.x && b.y === this.player.y
    );
    if (boss && !this.defeatedBosses.has(boss.monsterId)) {
      const monster = getBoss(boss.monsterId);
      if (monster) {
        this.startBattle(monster);
      }
    }
  }

  private startBattle(monster: ReturnType<typeof getRandomEncounter>): void {
    this.cameras.main.flash(300, 255, 255, 255);
    this.time.delayedCall(300, () => {
      this.scene.start("BattleScene", {
        player: this.player,
        monster,
        defeatedBosses: this.defeatedBosses,
      });
    });
  }
}
