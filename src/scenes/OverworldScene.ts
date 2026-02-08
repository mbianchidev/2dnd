/**
 * Overworld scene: tile-based map with WASD movement and encounters.
 */

import Phaser from "phaser";
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_CHUNKS,
  ENCOUNTER_RATES,
  TERRAIN_COLORS,
  Terrain,
  isWalkable,
  getTerrainAt,
  getChunk,
  getDungeonAt,
  getDungeon,
  getChestAt,
  type WorldChunk,
  type DungeonData,
} from "../data/map";
import { getRandomEncounter, getDungeonEncounter, getBoss } from "../data/monsters";
import { createPlayer, getArmorClass, awardXP, xpForLevel, allocateStatPoint, ASI_LEVELS, type PlayerState, type PlayerStats } from "../systems/player";
import { abilityModifier } from "../utils/dice";
import { isDebug, debugLog, debugPanelLog, debugPanelState, debugPanelClear, setDebugCommandHandler } from "../config";
import type { BestiaryData } from "../systems/bestiary";
import { createBestiary } from "../systems/bestiary";
import { saveGame } from "../systems/save";
import { getItem } from "../data/items";

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
  private bestiary: BestiaryData = createBestiary();
  private equipOverlay: Phaser.GameObjects.Container | null = null;
  private statOverlay: Phaser.GameObjects.Container | null = null;
  private menuOverlay: Phaser.GameObjects.Container | null = null;
  private worldMapOverlay: Phaser.GameObjects.Container | null = null;
  private isNewPlayer = false;
  private debugEncounters = true; // debug toggle for encounters
  private debugFogDisabled = false; // debug toggle for fog of war
  private messageText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: "OverworldScene" });
  }

  init(data?: { player?: PlayerState; defeatedBosses?: Set<string>; bestiary?: BestiaryData }): void {
    if (data?.player) {
      this.player = data.player;
      this.isNewPlayer = false;
    } else {
      this.player = createPlayer("Hero");
      this.isNewPlayer = true;
    }
    if (data?.defeatedBosses) {
      this.defeatedBosses = data.defeatedBosses;
    }
    if (data?.bestiary) {
      this.bestiary = data.bestiary;
    }
    // Reset movement state — a tween may have been orphaned when the scene
    // switched to battle mid-move, leaving isMoving permanently true.
    this.isMoving = false;
    this.lastMoveTime = 0;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x111111);
    this.cameras.main.fadeIn(500);

    // Reveal tiles around player on creation (fog of war)
    this.revealAround();

    this.renderMap();
    this.createPlayer();
    this.setupInput();
    this.createHUD();
    this.setupDebug();
    this.updateLocationText();

    // Show rolled stats on new game, or ASI overlay if points are pending
    if (this.isNewPlayer) {
      this.showRolledStatsOverlay();
    } else if (this.player.pendingStatPoints > 0) {
      this.time.delayedCall(400, () => this.showStatOverlay());
    }
  }

  private setupDebug(): void {
    debugPanelClear();
    debugPanelState("OVERWORLD | Loading...");

    // Cheat keys (only work when debug is on)
    const gKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.G);
    const lKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.L);
    const hKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    const pKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.P);

    gKey.on("down", () => {
      if (!isDebug()) return;
      this.player.gold += 100;
      debugLog("CHEAT: +100 gold", { total: this.player.gold });
      debugPanelLog(`[CHEAT] +100 gold (total: ${this.player.gold})`, true);
      this.updateHUD();
    });

    lKey.on("down", () => {
      if (!isDebug()) return;
      const needed = xpForLevel(this.player.level + 1) - this.player.xp;
      const xpResult = awardXP(this.player, Math.max(needed, 0));
      debugLog("CHEAT: Level up", { newLevel: xpResult.newLevel });
      debugPanelLog(`[CHEAT] Level up! Now Lv.${xpResult.newLevel}`, true);
      for (const spell of xpResult.newSpells) {
        debugPanelLog(`[CHEAT] Learned ${spell.name}!`, true);
      }
      if (xpResult.asiGained > 0) {
        debugPanelLog(`[CHEAT] +${xpResult.asiGained} stat points! Press T.`, true);
      }
      this.updateHUD();
    });

    hKey.on("down", () => {
      if (!isDebug()) return;
      this.player.hp = this.player.maxHp;
      debugLog("CHEAT: Full heal");
      debugPanelLog(`[CHEAT] HP restored to ${this.player.maxHp}!`, true);
      this.updateHUD();
    });

    pKey.on("down", () => {
      if (!isDebug()) return;
      this.player.mp = this.player.maxMp;
      debugLog("CHEAT: Restore MP");
      debugPanelLog(`[CHEAT] MP restored to ${this.player.maxMp}!`, true);
      this.updateHUD();
    });

    // F key — toggle encounters on/off
    const fKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    fKey.on("down", () => {
      if (!isDebug()) return;
      this.debugEncounters = !this.debugEncounters;
      debugLog("CHEAT: Encounters " + (this.debugEncounters ? "ON" : "OFF"));
      debugPanelLog(`[CHEAT] Encounters ${this.debugEncounters ? "ON" : "OFF"}`, true);
    });

    // R key — reveal full map (remove fog)
    const rKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    rKey.on("down", () => {
      if (!isDebug()) return;
      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          const key = this.exploredKey(x, y);
          this.player.exploredTiles[key] = true;
        }
      }
      this.renderMap();
      this.createPlayer();
      debugPanelLog(`[CHEAT] Map revealed`, true);
    });

    // V key — toggle fog of war on/off
    const vKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.V);
    vKey.on("down", () => {
      if (!isDebug()) return;
      this.debugFogDisabled = !this.debugFogDisabled;
      debugLog("CHEAT: Fog " + (this.debugFogDisabled ? "OFF" : "ON"));
      debugPanelLog(`[CHEAT] Fog of War ${this.debugFogDisabled ? "OFF" : "ON"}`, true);
      this.renderMap();
      this.createPlayer();
    });

    // Register debug command handler
    setDebugCommandHandler((cmd, args) => this.handleDebugCommand(cmd, args));
  }

  private handleDebugCommand(cmd: string, args: string): void {
    const val = parseInt(args, 10);
    switch (cmd) {
      case "gold":
        if (!isNaN(val)) { this.player.gold = val; this.updateHUD(); debugPanelLog(`[CMD] Gold set to ${val}`, true); }
        else debugPanelLog(`Usage: /gold <amount>`, true);
        break;
      case "exp":
      case "xp":
        if (!isNaN(val)) {
          const result = awardXP(this.player, val);
          this.updateHUD();
          debugPanelLog(`[CMD] +${val} XP (now Lv.${result.newLevel})`, true);
          if (result.leveledUp) debugPanelLog(`[CMD] Level up to ${result.newLevel}!`, true);
        } else debugPanelLog(`Usage: /exp <amount>`, true);
        break;
      case "hp":
        if (!isNaN(val)) { this.player.hp = Math.min(val, this.player.maxHp); this.updateHUD(); debugPanelLog(`[CMD] HP set to ${this.player.hp}`, true); }
        else debugPanelLog(`Usage: /hp <amount>`, true);
        break;
      case "max_hp":
      case "maxhp":
        if (!isNaN(val)) { this.player.maxHp = val; this.player.hp = Math.min(this.player.hp, val); this.updateHUD(); debugPanelLog(`[CMD] Max HP set to ${val}`, true); }
        else debugPanelLog(`Usage: /max_hp <amount>`, true);
        break;
      case "mp":
        if (!isNaN(val)) { this.player.mp = Math.min(val, this.player.maxMp); this.updateHUD(); debugPanelLog(`[CMD] MP set to ${this.player.mp}`, true); }
        else debugPanelLog(`Usage: /mp <amount>`, true);
        break;
      case "max_mp":
      case "maxmp":
        if (!isNaN(val)) { this.player.maxMp = val; this.player.mp = Math.min(this.player.mp, val); this.updateHUD(); debugPanelLog(`[CMD] Max MP set to ${val}`, true); }
        else debugPanelLog(`Usage: /max_mp <amount>`, true);
        break;
      case "level":
      case "lvl":
        if (!isNaN(val) && val >= 1 && val <= 20) {
          while (this.player.level < val) {
            const needed = xpForLevel(this.player.level + 1) - this.player.xp;
            awardXP(this.player, Math.max(needed, 0));
          }
          this.updateHUD();
          debugPanelLog(`[CMD] Level set to ${this.player.level}`, true);
        } else debugPanelLog(`Usage: /level <1-20>`, true);
        break;
      case "item": {
        const itemId = args.trim();
        if (itemId) {
          const item = getItem(itemId);
          if (item) {
            this.player.inventory.push({ ...item });
            debugPanelLog(`[CMD] Added ${item.name} to inventory`, true);
          } else {
            debugPanelLog(`[CMD] Unknown item: ${itemId}`, true);
          }
        } else debugPanelLog(`Usage: /item <itemId>`, true);
        break;
      }
      case "heal":
        this.player.hp = this.player.maxHp;
        this.player.mp = this.player.maxMp;
        this.updateHUD();
        debugPanelLog(`[CMD] Fully healed!`, true);
        break;
      case "help":
        debugPanelLog(`Commands: /gold /exp /hp /max_hp /mp /max_mp /level /item /heal /help`, true);
        break;
      default:
        debugPanelLog(`Unknown command: /${cmd}. Type /help for list.`, true);
    }
  }

  private renderMap(): void {
    // Clear old tile sprites if re-rendering (chunk transition)
    for (const row of this.tileSprites) {
      for (const sprite of row) {
        sprite.destroy();
      }
    }
    this.tileSprites = [];

    // If inside a dungeon, render the dungeon interior
    if (this.player.inDungeon) {
      const dungeon = getDungeon(this.player.dungeonId);
      if (!dungeon) return;
      for (let y = 0; y < MAP_HEIGHT; y++) {
        this.tileSprites[y] = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
          const explored = this.isExplored(x, y);
          const terrain = dungeon.mapData[y][x];
          let texKey = explored ? `tile_${terrain}` : "tile_fog";
          // Show open chest texture for opened chests
          if (explored && terrain === Terrain.Chest) {
            const chest = getChestAt(x, y, { type: "dungeon", dungeonId: this.player.dungeonId });
            if (chest && this.player.openedChests.includes(chest.id)) {
              texKey = "tile_chest_open";
            }
          }
          const sprite = this.add.sprite(
            x * TILE_SIZE + TILE_SIZE / 2,
            y * TILE_SIZE + TILE_SIZE / 2,
            texKey
          );
          this.tileSprites[y][x] = sprite;
        }
      }
      // Dungeon name label
      this.add
        .text(MAP_WIDTH * TILE_SIZE / 2, 4, dungeon.name, {
          fontSize: "10px",
          fontFamily: "monospace",
          color: "#ff8888",
          stroke: "#000",
          strokeThickness: 2,
        })
        .setOrigin(0.5, 0);
      // Exit label (only if explored)
      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          if (dungeon.mapData[y][x] === Terrain.DungeonExit && this.isExplored(x, y)) {
            this.add
              .text(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE - 4, "EXIT", {
                fontSize: "8px",
                fontFamily: "monospace",
                color: "#88ff88",
                stroke: "#000",
                strokeThickness: 2,
              })
              .setOrigin(0.5, 1);
          }
        }
      }
      return;
    }

    const chunk = getChunk(this.player.chunkX, this.player.chunkY);
    if (!chunk) return;

    for (let y = 0; y < MAP_HEIGHT; y++) {
      this.tileSprites[y] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        const explored = this.isExplored(x, y);
        const terrain = chunk.mapData[y][x];
        let texKey = explored ? `tile_${terrain}` : "tile_fog";
        // Show open chest texture for opened chests
        if (explored && terrain === Terrain.Chest) {
          const chest = getChestAt(x, y, { type: "overworld", chunkX: this.player.chunkX, chunkY: this.player.chunkY });
          if (chest && this.player.openedChests.includes(chest.id)) {
            texKey = "tile_chest_open";
          }
        }
        const sprite = this.add.sprite(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          texKey
        );
        this.tileSprites[y][x] = sprite;
      }
    }

    // Add town labels for this chunk (only if explored)
    for (const town of chunk.towns) {
      if (this.isExplored(town.x, town.y)) {
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
    }

    // Add boss markers (if not defeated) for this chunk (only if explored)
    for (const boss of chunk.bosses) {
      if (!this.defeatedBosses.has(boss.monsterId) && this.isExplored(boss.x, boss.y)) {
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

  // ─── Fog of War helpers ─────────────────────────────────────────

  /** Build the explored-tiles key for a position (respects dungeon vs overworld). */
  private exploredKey(x: number, y: number): string {
    if (this.player.inDungeon) {
      return `d:${this.player.dungeonId},${x},${y}`;
    }
    return `${this.player.chunkX},${this.player.chunkY},${x},${y}`;
  }

  /** Check if a tile has been explored. */
  private isExplored(x: number, y: number): boolean {
    if (isDebug() && this.debugFogDisabled) return true;
    return !!this.player.exploredTiles[this.exploredKey(x, y)];
  }

  /** Reveal tiles in a radius around the player's current position. */
  private revealAround(radius = 2): void {
    const px = this.player.x;
    const py = this.player.y;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = px + dx;
        const ny = py + dy;
        if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT) {
          this.player.exploredTiles[this.exploredKey(nx, ny)] = true;
        }
      }
    }
  }

  /** Update tile sprites for newly revealed tiles without full re-render. */
  private revealTileSprites(): void {
    if (this.player.inDungeon) {
      const dungeon = getDungeon(this.player.dungeonId);
      if (!dungeon) return;
      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          if (this.isExplored(x, y) && this.tileSprites[y]?.[x]) {
            const terrain = dungeon.mapData[y][x];
            let texKey = `tile_${terrain}`;
            if (terrain === Terrain.Chest) {
              const chest = getChestAt(x, y, { type: "dungeon", dungeonId: this.player.dungeonId });
              if (chest && this.player.openedChests.includes(chest.id)) {
                texKey = "tile_chest_open";
              }
            }
            this.tileSprites[y][x].setTexture(texKey);
          }
        }
      }
    } else {
      const chunk = getChunk(this.player.chunkX, this.player.chunkY);
      if (!chunk) return;
      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          if (this.isExplored(x, y) && this.tileSprites[y]?.[x]) {
            const terrain = chunk.mapData[y][x];
            let texKey = `tile_${terrain}`;
            if (terrain === Terrain.Chest) {
              const chest = getChestAt(x, y, { type: "overworld", chunkX: this.player.chunkX, chunkY: this.player.chunkY });
              if (chest && this.player.openedChests.includes(chest.id)) {
                texKey = "tile_chest_open";
              }
            }
            this.tileSprites[y][x].setTexture(texKey);
          }
        }
      }
    }
  }

  // ─── Message display ───────────────────────────────────────────

  /** Show a temporary floating message above the HUD. */
  private showMessage(text: string, color = "#ffd700"): void {
    if (this.messageText) {
      this.messageText.destroy();
      this.messageText = null;
    }
    this.messageText = this.add
      .text(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE - 8, text, {
        fontSize: "12px",
        fontFamily: "monospace",
        color,
        stroke: "#000",
        strokeThickness: 3,
        align: "center",
      })
      .setOrigin(0.5, 1)
      .setDepth(30);

    this.tweens.add({
      targets: this.messageText,
      alpha: 0,
      y: MAP_HEIGHT * TILE_SIZE - 30,
      duration: 2500,
      onComplete: () => {
        this.messageText?.destroy();
        this.messageText = null;
      },
    });
  }

  private createPlayer(): void {
    if (this.playerSprite) {
      this.playerSprite.destroy();
    }
    const texKey = `player_${this.player.appearanceId}`;
    // Use the appearance texture if it exists, else fall back to default
    const key = this.textures.exists(texKey) ? texKey : "player";
    this.playerSprite = this.add.sprite(
      this.player.x * TILE_SIZE + TILE_SIZE / 2,
      this.player.y * TILE_SIZE + TILE_SIZE / 2,
      key
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

    // B key opens bestiary
    const bKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B);
    bKey.on("down", () => this.openBestiary());

    // E key toggles equipment overlay
    const eKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    eKey.on("down", () => this.toggleEquipOverlay());

    // T key opens stat allocation overlay when points are available
    const tKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.T);
    tKey.on("down", () => this.toggleStatOverlay());

    // M key opens game menu
    const mKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    mKey.on("down", () => this.toggleMenuOverlay());

    // N key opens world map overlay
    const nKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.N);
    nKey.on("down", () => this.toggleWorldMap());
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
    let regionName: string;
    if (p.inDungeon) {
      const dungeon = getDungeon(p.dungeonId);
      regionName = dungeon ? `🔻 ${dungeon.name}` : "Dungeon";
    } else {
      const chunk = getChunk(p.chunkX, p.chunkY);
      regionName = chunk?.name ?? "Unknown";
    }
    const asiHint = p.pendingStatPoints > 0 ? `  ★ ${p.pendingStatPoints} Stat Pts [T]` : "";
    this.hudText.setText(
      `${p.name} Lv.${p.level}  —  ${regionName}\n` +
        `HP: ${p.hp}/${p.maxHp}  MP: ${p.mp}/${p.maxMp}  Gold: ${p.gold}${asiHint}`
    );
  }

  private updateLocationText(): void {
    // In dungeon: show dungeon-specific text
    if (this.player.inDungeon) {
      const dungeon = getDungeon(this.player.dungeonId);
      if (!dungeon) { this.locationText.setText("???"); return; }
      const terrain = dungeon.mapData[this.player.y]?.[this.player.x];
      if (terrain === Terrain.DungeonExit) {
        this.locationText.setText(`${dungeon.name}\n[SPACE] Exit Dungeon`);
      } else if (terrain === Terrain.Chest) {
        const chest = getChestAt(this.player.x, this.player.y, { type: "dungeon", dungeonId: this.player.dungeonId });
        if (chest && !this.player.openedChests.includes(chest.id)) {
          this.locationText.setText(`Treasure Chest\n[SPACE] Open`);
        } else {
          this.locationText.setText("Opened Chest");
        }
      } else {
        this.locationText.setText(dungeon.name);
      }
      return;
    }

    const terrain = getTerrainAt(this.player.chunkX, this.player.chunkY, this.player.x, this.player.y);
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

    const chunk = getChunk(this.player.chunkX, this.player.chunkY);
    const town = chunk?.towns.find(
      (t) => t.x === this.player.x && t.y === this.player.y
    );
    const boss = chunk?.bosses.find(
      (b) => b.x === this.player.x && b.y === this.player.y
    );

    let locStr = terrainNames[terrain ?? 0] ?? "Unknown";
    if (town) locStr = `${town.name}\n[SPACE] Enter Shop`;
    if (boss && !this.defeatedBosses.has(boss.monsterId))
      locStr = `${boss.name}'s Lair\n[SPACE] Challenge Boss`;

    // Dungeon entrance hint
    if (terrain === Terrain.Dungeon) {
      const dungeon = getDungeonAt(this.player.chunkX, this.player.chunkY, this.player.x, this.player.y);
      if (dungeon) {
        const hasKey = this.player.inventory.some((i) => i.id === "dungeonKey");
        if (hasKey || isDebug()) {
          locStr = `${dungeon.name}\n[SPACE] Enter Dungeon`;
        } else {
          locStr = `${dungeon.name}\n(Locked — need key)`;
        }
      }
    }

    // Overworld chest hint
    if (terrain === Terrain.Chest) {
      const chest = getChestAt(this.player.x, this.player.y, { type: "overworld", chunkX: this.player.chunkX, chunkY: this.player.chunkY });
      if (chest && !this.player.openedChests.includes(chest.id)) {
        locStr = `Treasure Chest\n[SPACE] Open`;
      } else {
        locStr = "Opened Chest";
      }
    }

    this.locationText.setText(locStr);
  }

  private updateDebugPanel(): void {
    const p = this.player;
    const terrainNames: Record<number, string> = {
      [Terrain.Grass]: "Grass",
      [Terrain.Forest]: "Forest",
      [Terrain.Mountain]: "Mountain",
      [Terrain.Water]: "Water",
      [Terrain.Sand]: "Sand",
      [Terrain.Town]: "Town",
      [Terrain.Dungeon]: "Dungeon",
      [Terrain.Boss]: "Boss",
      [Terrain.Path]: "Path",
      [Terrain.DungeonFloor]: "DFloor",
      [Terrain.DungeonWall]: "DWall",
      [Terrain.DungeonExit]: "DExit",
      [Terrain.Chest]: "Chest",
    };

    let terrain: Terrain | undefined;
    if (p.inDungeon) {
      const dungeon = getDungeon(p.dungeonId);
      terrain = dungeon?.mapData[p.y]?.[p.x];
    } else {
      terrain = getTerrainAt(p.chunkX, p.chunkY, p.x, p.y);
    }

    const tName = terrainNames[terrain ?? 0] ?? "?";
    const rate = terrain !== undefined ? (ENCOUNTER_RATES[terrain] ?? 0) : 0;
    const dungeonTag = p.inDungeon ? ` [DUNGEON:${p.dungeonId}]` : "";
    debugPanelState(
      `OVERWORLD | Chunk: (${p.chunkX},${p.chunkY}) Pos: (${p.x},${p.y}) ${tName}${dungeonTag} | ` +
      `Enc: ${(rate * 100).toFixed(0)}%${this.debugEncounters ? "" : " [OFF]"}${this.debugFogDisabled ? " Fog[OFF]" : ""} | ` +
      `HP ${p.hp}/${p.maxHp} MP ${p.mp}/${p.maxMp} | ` +
      `Lv.${p.level} XP ${p.xp} Gold ${p.gold} | ` +
      `Bosses: ${this.defeatedBosses.size}\n` +
      `Cheats: G=Gold H=Heal P=MP L=LvUp F=EncToggle R=Reveal V=FogToggle`
    );
  }

  update(time: number): void {
    this.updateDebugPanel();
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
    let newX = this.player.x + dx;
    let newY = this.player.y + dy;

    // In dungeon: no chunk transitions, just wall checks
    if (this.player.inDungeon) {
      const dungeon = getDungeon(this.player.dungeonId);
      if (!dungeon) return;
      if (newX < 0 || newX >= MAP_WIDTH || newY < 0 || newY >= MAP_HEIGHT) return;
      const terrain = dungeon.mapData[newY][newX];
      if (!isWalkable(terrain)) return;

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
          this.revealAround();
          this.revealTileSprites();
          this.updateHUD();
          this.updateLocationText();
          this.checkEncounter(terrain);
        },
      });
      return;
    }

    let newChunkX = this.player.chunkX;
    let newChunkY = this.player.chunkY;

    // Chunk transition detection
    if (newX < 0) {
      newChunkX--;
      newX = MAP_WIDTH - 1;
    } else if (newX >= MAP_WIDTH) {
      newChunkX++;
      newX = 0;
    }
    if (newY < 0) {
      newChunkY--;
      newY = MAP_HEIGHT - 1;
    } else if (newY >= MAP_HEIGHT) {
      newChunkY++;
      newY = 0;
    }

    const terrain = getTerrainAt(newChunkX, newChunkY, newX, newY);
    if (terrain === undefined || !isWalkable(terrain)) {
      debugLog("Blocked move", { to: { x: newX, y: newY, cx: newChunkX, cy: newChunkY }, terrain });
      return;
    }

    const chunkChanged = newChunkX !== this.player.chunkX || newChunkY !== this.player.chunkY;

    this.lastMoveTime = time;
    this.isMoving = true;
    this.player.x = newX;
    this.player.y = newY;
    this.player.chunkX = newChunkX;
    this.player.chunkY = newChunkY;

    if (chunkChanged) {
      // Chunk transition — flash and re-render
      this.cameras.main.flash(200, 255, 255, 255);
      this.scene.restart({
        player: this.player,
        defeatedBosses: this.defeatedBosses,
        bestiary: this.bestiary,
      });
      return;
    }

    this.tweens.add({
      targets: this.playerSprite,
      x: newX * TILE_SIZE + TILE_SIZE / 2,
      y: newY * TILE_SIZE + TILE_SIZE / 2,
      duration: 120,
      onComplete: () => {
        this.isMoving = false;
        this.revealAround();
        this.revealTileSprites();
        this.updateHUD();
        this.updateLocationText();
        this.checkEncounter(terrain);
      },
    });
  }

  private checkEncounter(terrain: Terrain): void {
    // Auto-save after each step
    this.autoSave();

    // Boss tile: handled by SPACE action, not random
    if (terrain === Terrain.Boss) return;
    if (terrain === Terrain.Town) return;
    if (terrain === Terrain.DungeonExit) return;
    if (terrain === Terrain.Chest) return;

    // Debug: encounters can be toggled off
    if (isDebug() && !this.debugEncounters) return;

    const rate = ENCOUNTER_RATES[terrain];
    if (Math.random() < rate) {
      // Use dungeon monsters when inside a dungeon
      const monster = this.player.inDungeon
        ? getDungeonEncounter(this.player.level)
        : getRandomEncounter(this.player.level);
      debugLog("Encounter!", { terrain: Terrain[terrain], rate, monster: monster.name, inDungeon: this.player.inDungeon });
      this.startBattle(monster);
    }
  }

  private handleAction(): void {
    // ── Dungeon exit: pressing SPACE on an exit tile inside a dungeon ──
    if (this.player.inDungeon) {
      const dungeon = getDungeon(this.player.dungeonId);
      if (!dungeon) return;
      const terrain = dungeon.mapData[this.player.y]?.[this.player.x];
      if (terrain === Terrain.DungeonExit) {
        // Return to overworld at the dungeon entrance tile
        this.player.inDungeon = false;
        this.player.dungeonId = "";
        this.player.chunkX = dungeon.entranceChunkX;
        this.player.chunkY = dungeon.entranceChunkY;
        this.player.x = dungeon.entranceTileX;
        this.player.y = dungeon.entranceTileY;
        this.autoSave();
        this.cameras.main.flash(300, 255, 255, 255);
        this.scene.restart({
          player: this.player,
          defeatedBosses: this.defeatedBosses,
          bestiary: this.bestiary,
        });
        return;
      }

      // ── Chest interaction inside dungeon ──
      if (terrain === Terrain.Chest) {
        const chest = getChestAt(this.player.x, this.player.y, { type: "dungeon", dungeonId: this.player.dungeonId });
        if (chest && !this.player.openedChests.includes(chest.id)) {
          const item = getItem(chest.itemId);
          if (item) {
            this.player.openedChests.push(chest.id);
            this.player.inventory.push({ ...item });
            // Auto-equip if better
            if (item.type === "weapon" && (!this.player.equippedWeapon || item.effect > this.player.equippedWeapon.effect)) {
              this.player.equippedWeapon = item;
              if (item.twoHanded) this.player.equippedShield = null;
            }
            if (item.type === "armor" && (!this.player.equippedArmor || item.effect > this.player.equippedArmor.effect)) {
              this.player.equippedArmor = item;
            }
            if (item.type === "shield" && !this.player.equippedWeapon?.twoHanded && (!this.player.equippedShield || item.effect > this.player.equippedShield.effect)) {
              this.player.equippedShield = item;
            }
            this.showMessage(`🎁 Found ${item.name}!`);
            this.updateHUD();
            this.autoSave();
          }
        } else if (chest && this.player.openedChests.includes(chest.id)) {
          this.showMessage("Already opened.", "#666666");
        }
        return;
      }
      return;
    }

    // ── Overworld actions ──
    const chunk = getChunk(this.player.chunkX, this.player.chunkY);
    if (!chunk) return;

    // Check if on a town
    const town = chunk.towns.find(
      (t) => t.x === this.player.x && t.y === this.player.y
    );
    if (town?.hasShop) {
      this.autoSave();
      this.scene.start("ShopScene", {
        player: this.player,
        townName: town.name,
        defeatedBosses: this.defeatedBosses,
        bestiary: this.bestiary,
        shopItemIds: town.shopItems,
      });
      return;
    }

    // Check if on a dungeon entrance tile
    const terrain = getTerrainAt(this.player.chunkX, this.player.chunkY, this.player.x, this.player.y);
    if (terrain === Terrain.Dungeon) {
      const dungeon = getDungeonAt(
        this.player.chunkX,
        this.player.chunkY,
        this.player.x,
        this.player.y
      );
      if (dungeon) {
        const hasKey = this.player.inventory.some((i) => i.id === "dungeonKey");
        if (hasKey || isDebug()) {
          // Enter the dungeon
          this.player.inDungeon = true;
          this.player.dungeonId = dungeon.id;
          this.player.x = dungeon.spawnX;
          this.player.y = dungeon.spawnY;
          this.autoSave();
          this.cameras.main.flash(300, 100, 100, 100);
          this.scene.restart({
            player: this.player,
            defeatedBosses: this.defeatedBosses,
            bestiary: this.bestiary,
          });
        }
        // No key — just do nothing (location text already hints)
      }
      return;
    }

    // Check if on an overworld chest tile
    if (terrain === Terrain.Chest) {
      const chest = getChestAt(this.player.x, this.player.y, { type: "overworld", chunkX: this.player.chunkX, chunkY: this.player.chunkY });
      if (chest && !this.player.openedChests.includes(chest.id)) {
        const item = getItem(chest.itemId);
        if (item) {
          this.player.openedChests.push(chest.id);
          this.player.inventory.push({ ...item });
          if (item.type === "weapon" && (!this.player.equippedWeapon || item.effect > this.player.equippedWeapon.effect)) {
            this.player.equippedWeapon = item;
            if (item.twoHanded) this.player.equippedShield = null;
          }
          if (item.type === "armor" && (!this.player.equippedArmor || item.effect > this.player.equippedArmor.effect)) {
            this.player.equippedArmor = item;
          }
          if (item.type === "shield" && !this.player.equippedWeapon?.twoHanded && (!this.player.equippedShield || item.effect > this.player.equippedShield.effect)) {
            this.player.equippedShield = item;
          }
          this.showMessage(`🎁 Found ${item.name}!`);
          this.updateHUD();
          this.autoSave();
        }
      } else if (chest && this.player.openedChests.includes(chest.id)) {
        this.showMessage("Already opened.", "#666666");
      }
      return;
    }

    // Check if on a boss tile
    const boss = chunk.bosses.find(
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
    this.autoSave();
    this.cameras.main.flash(300, 255, 255, 255);
    this.time.delayedCall(300, () => {
      this.scene.start("BattleScene", {
        player: this.player,
        monster,
        defeatedBosses: this.defeatedBosses,
        bestiary: this.bestiary,
      });
    });
  }

  private openBestiary(): void {
    if (this.equipOverlay) {
      this.equipOverlay.destroy();
      this.equipOverlay = null;
    }
    this.autoSave();
    this.scene.start("BestiaryScene", {
      player: this.player,
      defeatedBosses: this.defeatedBosses,
      bestiary: this.bestiary,
    });
  }

  private autoSave(): void {
    saveGame(this.player, this.defeatedBosses, this.bestiary, this.player.appearanceId);
  }

  private toggleEquipOverlay(): void {
    if (this.equipOverlay) {
      this.equipOverlay.destroy();
      this.equipOverlay = null;
      return;
    }

    this.buildEquipOverlay();
  }

  private buildEquipOverlay(): void {
    if (this.equipOverlay) {
      this.equipOverlay.destroy();
      this.equipOverlay = null;
    }

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const panelW = 280;
    const panelH = 420;
    const px = Math.floor((w - panelW) / 2);
    const py = Math.floor((h - panelH) / 2) - 20;

    this.equipOverlay = this.add.container(0, 0).setDepth(50);

    // Dim background
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.5);
    dim.fillRect(0, 0, w, h);
    dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    dim.on("pointerdown", () => this.toggleEquipOverlay());
    this.equipOverlay.add(dim);

    // Panel background
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRect(px, py, panelW, panelH);
    bg.lineStyle(2, 0xc0a060, 1);
    bg.strokeRect(px, py, panelW, panelH);
    this.equipOverlay.add(bg);

    // Title
    const title = this.add.text(px + panelW / 2, py + 10, "⚔ Equipment", {
      fontSize: "16px",
      fontFamily: "monospace",
      color: "#ffd700",
    }).setOrigin(0.5, 0);
    this.equipOverlay.add(title);

    const p = this.player;
    const ac = getArmorClass(p);
    let cy = py + 34;

    // --- Header stats ---
    const header = this.add.text(px + 14, cy, [
      `${p.name}  Lv.${p.level}`,
      `HP: ${p.hp}/${p.maxHp}   MP: ${p.mp}/${p.maxMp}   AC: ${ac}`,
    ].join("\n"), {
      fontSize: "11px",
      fontFamily: "monospace",
      color: "#ccc",
      lineSpacing: 4,
    });
    this.equipOverlay.add(header);
    cy += 38;

    // --- Weapon slot ---
    const weaponLabel = this.add.text(px + 14, cy, "Weapon:", {
      fontSize: "11px", fontFamily: "monospace", color: "#c0a060",
    });
    this.equipOverlay.add(weaponLabel);
    cy += 16;

    const ownedWeapons = p.inventory.filter((i) => i.type === "weapon");
    if (ownedWeapons.length === 0 && !p.equippedWeapon) {
      const bare = this.add.text(px + 20, cy, "Bare Hands", {
        fontSize: "11px", fontFamily: "monospace", color: "#666",
      });
      this.equipOverlay.add(bare);
      cy += 16;
    } else {
      // Show equipped weapon and owned alternatives
      const allWeapons = p.equippedWeapon
        ? [p.equippedWeapon, ...ownedWeapons.filter((i) => i.id !== p.equippedWeapon!.id)]
        : ownedWeapons;
      for (const wpn of allWeapons) {
        const isEquipped = p.equippedWeapon?.id === wpn.id;
        const prefix = isEquipped ? "► " : "  ";
        const color = isEquipped ? "#88ff88" : "#aaddff";
        const txt = this.add.text(px + 20, cy,
          `${prefix}${wpn.name} (+${wpn.effect} dmg)${isEquipped ? " [equipped]" : ""}`,
          { fontSize: "11px", fontFamily: "monospace", color }
        ).setInteractive({ useHandCursor: !isEquipped });
        if (!isEquipped) {
          txt.on("pointerover", () => txt.setColor("#ffd700"));
          txt.on("pointerout", () => txt.setColor(color));
          txt.on("pointerdown", () => {
            p.equippedWeapon = wpn;
            // Two-handed weapons unequip shield
            if (wpn.twoHanded) p.equippedShield = null;
            this.buildEquipOverlay();
          });
        }
        this.equipOverlay.add(txt);
        cy += 16;
      }
    }
    cy += 6;

    // --- Armor slot ---
    const armorLabel = this.add.text(px + 14, cy, "Armor:", {
      fontSize: "11px", fontFamily: "monospace", color: "#c0a060",
    });
    this.equipOverlay.add(armorLabel);
    cy += 16;

    const ownedArmor = p.inventory.filter((i) => i.type === "armor");
    if (ownedArmor.length === 0 && !p.equippedArmor) {
      const none = this.add.text(px + 20, cy, "No Armor", {
        fontSize: "11px", fontFamily: "monospace", color: "#666",
      });
      this.equipOverlay.add(none);
      cy += 16;
    } else {
      const allArmor = p.equippedArmor
        ? [p.equippedArmor, ...ownedArmor.filter((i) => i.id !== p.equippedArmor!.id)]
        : ownedArmor;
      for (const arm of allArmor) {
        const isEquipped = p.equippedArmor?.id === arm.id;
        const prefix = isEquipped ? "► " : "  ";
        const color = isEquipped ? "#88ff88" : "#aaddff";
        const txt = this.add.text(px + 20, cy,
          `${prefix}${arm.name} (+${arm.effect} AC)${isEquipped ? " [equipped]" : ""}`,
          { fontSize: "11px", fontFamily: "monospace", color }
        ).setInteractive({ useHandCursor: !isEquipped });
        if (!isEquipped) {
          txt.on("pointerover", () => txt.setColor("#ffd700"));
          txt.on("pointerout", () => txt.setColor(color));
          txt.on("pointerdown", () => {
            p.equippedArmor = arm;
            this.buildEquipOverlay();
          });
        }
        this.equipOverlay.add(txt);
        cy += 16;
      }
    }
    cy += 6;

    // --- Shield slot ---
    const shieldLabel = this.add.text(px + 14, cy, "Shield:", {
      fontSize: "11px", fontFamily: "monospace", color: "#c0a060",
    });
    this.equipOverlay.add(shieldLabel);
    cy += 16;

    const isTwoHanded = p.equippedWeapon?.twoHanded === true;
    const ownedShields = p.inventory.filter((i) => i.type === "shield");
    if (isTwoHanded) {
      const note = this.add.text(px + 20, cy, "(two-handed weapon equipped)", {
        fontSize: "11px", fontFamily: "monospace", color: "#666",
      });
      this.equipOverlay.add(note);
      cy += 16;
    } else if (ownedShields.length === 0 && !p.equippedShield) {
      const none = this.add.text(px + 20, cy, "No Shield", {
        fontSize: "11px", fontFamily: "monospace", color: "#666",
      });
      this.equipOverlay.add(none);
      cy += 16;
    } else {
      const allShields = p.equippedShield
        ? [p.equippedShield, ...ownedShields.filter((i) => i.id !== p.equippedShield!.id)]
        : ownedShields;
      for (const sh of allShields) {
        const isEquipped = p.equippedShield?.id === sh.id;
        const prefix = isEquipped ? "► " : "  ";
        const color = isEquipped ? "#88ff88" : "#aaddff";
        const txt = this.add.text(px + 20, cy,
          `${prefix}${sh.name} (+${sh.effect} AC)${isEquipped ? " [equipped]" : ""}`,
          { fontSize: "11px", fontFamily: "monospace", color }
        ).setInteractive({ useHandCursor: !isEquipped });
        if (!isEquipped) {
          txt.on("pointerover", () => txt.setColor("#ffd700"));
          txt.on("pointerout", () => txt.setColor(color));
          txt.on("pointerdown", () => {
            p.equippedShield = sh;
            this.buildEquipOverlay();
          });
        }
        this.equipOverlay.add(txt);
        cy += 16;
      }
    }
    cy += 6;

    // --- Ability Scores ---
    const statsBlock = this.add.text(px + 14, cy, [
      `― Stats ―`,
      `STR ${p.stats.strength}  DEX ${p.stats.dexterity}`,
      `CON ${p.stats.constitution}  INT ${p.stats.intelligence}`,
      `WIS ${p.stats.wisdom}  CHA ${p.stats.charisma}`,
    ].join("\n"), {
      fontSize: "11px", fontFamily: "monospace", color: "#ccc", lineSpacing: 4,
    });
    this.equipOverlay.add(statsBlock);
    cy += 66;

    // --- Consumables ---
    const consumables = p.inventory.filter((i) => i.type === "consumable");
    const potionCount = consumables.filter((i) => i.id === "potion").length;
    const etherCount = consumables.filter((i) => i.id === "ether").length;
    const greaterCount = consumables.filter((i) => i.id === "greaterPotion").length;

    const consBlock = this.add.text(px + 14, cy, [
      `― Consumables ―`,
      `Potions: ${potionCount}  Ethers: ${etherCount}`,
      `Greater Potions: ${greaterCount}`,
      ``,
      `Spells Known: ${p.knownSpells.length}`,
    ].join("\n"), {
      fontSize: "11px", fontFamily: "monospace", color: "#ccc", lineSpacing: 4,
    });
    this.equipOverlay.add(consBlock);

    // Close hint
    const hint = this.add.text(px + panelW / 2, py + panelH - 14, "Press E or click to close", {
      fontSize: "10px",
      fontFamily: "monospace",
      color: "#666",
    }).setOrigin(0.5, 1);
    this.equipOverlay.add(hint);
  }

  // ─── Rolled-Stats Overlay (shown once on new game) ───────────────

  private showRolledStatsOverlay(): void {
    if (this.statOverlay) {
      this.statOverlay.destroy();
      this.statOverlay = null;
    }

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const panelW = 260;
    const panelH = 240;
    const px = Math.floor((w - panelW) / 2);
    const py = Math.floor((h - panelH) / 2) - 20;

    this.statOverlay = this.add.container(0, 0).setDepth(60);

    // Dim background
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.6);
    dim.fillRect(0, 0, w, h);
    this.statOverlay.add(dim);

    // Panel
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRect(px, py, panelW, panelH);
    bg.lineStyle(2, 0xffd700, 1);
    bg.strokeRect(px, py, panelW, panelH);
    this.statOverlay.add(bg);

    const title = this.add.text(px + panelW / 2, py + 12, "🎲 Your Rolled Stats", {
      fontSize: "15px", fontFamily: "monospace", color: "#ffd700",
    }).setOrigin(0.5, 0);
    this.statOverlay.add(title);

    const p = this.player;
    const statNames: { key: keyof PlayerStats; label: string }[] = [
      { key: "strength", label: "STR" },
      { key: "dexterity", label: "DEX" },
      { key: "constitution", label: "CON" },
      { key: "intelligence", label: "INT" },
      { key: "wisdom", label: "WIS" },
      { key: "charisma", label: "CHA" },
    ];

    let cy = py + 40;
    for (const { key, label } of statNames) {
      const val = p.stats[key];
      const mod = abilityModifier(val);
      const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
      const txt = this.add.text(px + 30, cy, `${label}:  ${val}  (${modStr})`, {
        fontSize: "13px", fontFamily: "monospace", color: "#ddd",
      });
      this.statOverlay.add(txt);
      cy += 22;
    }

    cy += 8;
    const hpMp = this.add.text(px + 30, cy, `HP: ${p.maxHp}   MP: ${p.maxMp}`, {
      fontSize: "12px", fontFamily: "monospace", color: "#88cc88",
    });
    this.statOverlay.add(hpMp);

    const closeHint = this.add.text(px + panelW / 2, py + panelH - 14, "Press SPACE to continue", {
      fontSize: "11px", fontFamily: "monospace", color: "#888",
    }).setOrigin(0.5, 1);
    this.statOverlay.add(closeHint);

    // Blink hint
    this.tweens.add({ targets: closeHint, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });

    // Dismiss on SPACE
    const handler = () => {
      if (this.statOverlay) {
        this.statOverlay.destroy();
        this.statOverlay = null;
      }
    };
    this.input.keyboard!.once("keydown-SPACE", handler);
  }

  // ─── Game Menu Overlay ───────────────────────────────────────────

  private toggleMenuOverlay(): void {
    if (this.menuOverlay) {
      this.menuOverlay.destroy();
      this.menuOverlay = null;
      return;
    }
    this.showMenuOverlay();
  }

  private showMenuOverlay(): void {
    // Close other overlays
    if (this.equipOverlay) { this.equipOverlay.destroy(); this.equipOverlay = null; }
    if (this.statOverlay) { this.statOverlay.destroy(); this.statOverlay = null; }

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const panelW = 220;
    const panelH = 160;
    const px = Math.floor((w - panelW) / 2);
    const py = Math.floor((h - panelH) / 2) - 10;

    this.menuOverlay = this.add.container(0, 0).setDepth(70);

    // Dim background
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.6);
    dim.fillRect(0, 0, w, h);
    this.menuOverlay.add(dim);
    dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    dim.on("pointerdown", () => this.toggleMenuOverlay());

    // Panel
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRect(px, py, panelW, panelH);
    bg.lineStyle(2, 0xffd700, 1);
    bg.strokeRect(px, py, panelW, panelH);
    this.menuOverlay.add(bg);

    // Title
    const title = this.add.text(px + panelW / 2, py + 14, "⚙ Menu", {
      fontSize: "14px", fontFamily: "monospace", color: "#ffd700",
    }).setOrigin(0.5, 0);
    this.menuOverlay.add(title);

    // Resume button
    const resumeBtn = this.add.text(px + panelW / 2, py + 56, "▶ Resume", {
      fontSize: "14px", fontFamily: "monospace", color: "#88ff88",
      backgroundColor: "#2a2a4e", padding: { x: 16, y: 6 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    resumeBtn.on("pointerover", () => resumeBtn.setColor("#ffd700"));
    resumeBtn.on("pointerout", () => resumeBtn.setColor("#88ff88"));
    resumeBtn.on("pointerdown", () => this.toggleMenuOverlay());
    this.menuOverlay.add(resumeBtn);

    // Quit to Title button
    const quitBtn = this.add.text(px + panelW / 2, py + 100, "✕ Quit to Title", {
      fontSize: "14px", fontFamily: "monospace", color: "#ff6666",
      backgroundColor: "#2a2a4e", padding: { x: 16, y: 6 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    quitBtn.on("pointerover", () => quitBtn.setColor("#ff4444"));
    quitBtn.on("pointerout", () => quitBtn.setColor("#ff6666"));
    quitBtn.on("pointerdown", () => {
      // Save before quitting
      saveGame(this.player, this.defeatedBosses, this.bestiary, this.player.appearanceId);
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.time.delayedCall(400, () => {
        this.scene.start("BootScene");
      });
    });
    this.menuOverlay.add(quitBtn);

    // Close hint
    const hint = this.add.text(px + panelW / 2, py + panelH - 8, "Press M to close", {
      fontSize: "10px", fontFamily: "monospace", color: "#666",
    }).setOrigin(0.5, 1);
    this.menuOverlay.add(hint);
  }

  // ─── ASI Stat Allocation Overlay ─────────────────────────────────

  private toggleStatOverlay(): void {
    if (this.statOverlay) {
      this.statOverlay.destroy();
      this.statOverlay = null;
      return;
    }
    if (this.player.pendingStatPoints <= 0) return;
    this.showStatOverlay();
  }

  private showStatOverlay(): void {
    // Close equipment overlay first
    if (this.equipOverlay) {
      this.equipOverlay.destroy();
      this.equipOverlay = null;
    }
    if (this.statOverlay) {
      this.statOverlay.destroy();
      this.statOverlay = null;
    }

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const panelW = 280;
    const panelH = 280;
    const px = Math.floor((w - panelW) / 2);
    const py = Math.floor((h - panelH) / 2) - 10;

    this.statOverlay = this.add.container(0, 0).setDepth(60);

    // Dim background
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.6);
    dim.fillRect(0, 0, w, h);
    this.statOverlay.add(dim);

    // Panel
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRect(px, py, panelW, panelH);
    bg.lineStyle(2, 0xffd700, 1);
    bg.strokeRect(px, py, panelW, panelH);
    this.statOverlay.add(bg);

    const title = this.add.text(px + panelW / 2, py + 10, "★ Ability Score Improvement", {
      fontSize: "13px", fontFamily: "monospace", color: "#ffd700",
    }).setOrigin(0.5, 0);
    this.statOverlay.add(title);

    const remaining = this.add.text(px + panelW / 2, py + 30, `Points remaining: ${this.player.pendingStatPoints}`, {
      fontSize: "12px", fontFamily: "monospace", color: "#88ff88",
    }).setOrigin(0.5, 0);
    this.statOverlay.add(remaining);

    const p = this.player;
    const statNames: { key: keyof PlayerStats; label: string }[] = [
      { key: "strength", label: "STR" },
      { key: "dexterity", label: "DEX" },
      { key: "constitution", label: "CON" },
      { key: "intelligence", label: "INT" },
      { key: "wisdom", label: "WIS" },
      { key: "charisma", label: "CHA" },
    ];

    let cy = py + 54;
    for (const { key, label } of statNames) {
      const val = p.stats[key];
      const mod = abilityModifier(val);
      const modStr = mod >= 0 ? `+${mod}` : `${mod}`;

      const row = this.add.text(px + 20, cy, `${label}:  ${val}  (${modStr})`, {
        fontSize: "12px", fontFamily: "monospace", color: "#ddd",
      });
      this.statOverlay.add(row);

      // "+" button
      const btn = this.add.text(px + panelW - 40, cy - 2, "[+]", {
        fontSize: "14px", fontFamily: "monospace", color: "#88ff88",
      }).setInteractive({ useHandCursor: true });

      btn.on("pointerover", () => btn.setColor("#ffd700"));
      btn.on("pointerout", () => btn.setColor("#88ff88"));
      btn.on("pointerdown", () => {
        if (allocateStatPoint(p, key)) {
          this.updateHUD();
          if (p.pendingStatPoints > 0) {
            this.showStatOverlay(); // rebuild
          } else {
            this.statOverlay?.destroy();
            this.statOverlay = null;
          }
        }
      });

      this.statOverlay.add(btn);
      cy += 28;
    }

    // Close hint
    const hint = this.add.text(px + panelW / 2, py + panelH - 14,
      p.pendingStatPoints > 0 ? "Click [+] to allocate  |  T to close" : "Press T or click to close", {
        fontSize: "10px", fontFamily: "monospace", color: "#666",
      }).setOrigin(0.5, 1);
    this.statOverlay.add(hint);
  }

  // ─── World Map Overlay ───────────────────────────────────────────

  private toggleWorldMap(): void {
    if (this.worldMapOverlay) {
      this.worldMapOverlay.destroy();
      this.worldMapOverlay = null;
      return;
    }
    this.showWorldMap();
  }

  private showWorldMap(): void {
    // Close other overlays
    if (this.equipOverlay) { this.equipOverlay.destroy(); this.equipOverlay = null; }
    if (this.statOverlay) { this.statOverlay.destroy(); this.statOverlay = null; }
    if (this.menuOverlay) { this.menuOverlay.destroy(); this.menuOverlay = null; }

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;

    // Each mini-chunk is rendered at 4px per tile → 80×60 px per chunk
    const tilePixel = 4;
    const chunkW = MAP_WIDTH * tilePixel;  // 80
    const chunkH = MAP_HEIGHT * tilePixel; // 60
    const gap = 4;
    const gridW = WORLD_WIDTH * chunkW + (WORLD_WIDTH - 1) * gap;   // 248
    const gridH = WORLD_HEIGHT * chunkH + (WORLD_HEIGHT - 1) * gap; // 188
    const panelPad = 16;
    const titleH = 30;
    const panelW = gridW + panelPad * 2;
    const panelH = gridH + panelPad * 2 + titleH + 24; // extra for hint text
    const px = Math.floor((w - panelW) / 2);
    const py = Math.floor((h - panelH) / 2) - 10;

    this.worldMapOverlay = this.add.container(0, 0).setDepth(80);

    // Dim background
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.6);
    dim.fillRect(0, 0, w, h);
    dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    dim.on("pointerdown", () => this.toggleWorldMap());
    this.worldMapOverlay.add(dim);

    // Panel background
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRect(px, py, panelW, panelH);
    bg.lineStyle(2, 0xffd700, 1);
    bg.strokeRect(px, py, panelW, panelH);
    this.worldMapOverlay.add(bg);

    // Title
    const title = this.add.text(px + panelW / 2, py + 10, "🗺 World Map", {
      fontSize: "15px", fontFamily: "monospace", color: "#ffd700",
    }).setOrigin(0.5, 0);
    this.worldMapOverlay.add(title);

    const gridX = px + panelPad;
    const gridY = py + titleH + panelPad;

    // Draw each chunk as a mini-map
    for (let cy = 0; cy < WORLD_HEIGHT; cy++) {
      for (let cx = 0; cx < WORLD_WIDTH; cx++) {
        const chunk = getChunk(cx, cy);
        if (!chunk) continue;

        const ox = gridX + cx * (chunkW + gap);
        const oy = gridY + cy * (chunkH + gap);

        // Draw terrain tiles (fog of war applied)
        const miniGfx = this.add.graphics();
        let hasExplored = false;
        for (let ty = 0; ty < MAP_HEIGHT; ty++) {
          for (let tx = 0; tx < MAP_WIDTH; tx++) {
            const terrain = chunk.mapData[ty][tx];
            // Check if this tile has been explored
            const exploredKey = `${cx},${cy},${tx},${ty}`;
            const explored = !!this.player.exploredTiles[exploredKey];
            if (explored) hasExplored = true;
            const color = explored ? TERRAIN_COLORS[terrain] : 0x0a0a0a;
            miniGfx.fillStyle(color, 1);
            miniGfx.fillRect(ox + tx * tilePixel, oy + ty * tilePixel, tilePixel, tilePixel);
          }
        }
        this.worldMapOverlay.add(miniGfx);

        // Border
        const border = this.add.graphics();
        const isCurrent = cx === this.player.chunkX && cy === this.player.chunkY;
        border.lineStyle(isCurrent ? 2 : 1, isCurrent ? 0xffd700 : 0x333333, 1);
        border.strokeRect(ox, oy, chunkW, chunkH);
        this.worldMapOverlay.add(border);

        // Region name below this mini-chunk (only if player has explored at least one tile)
        if (hasExplored) {
          const regionLabel = this.add.text(ox + chunkW / 2, oy + chunkH + 1, chunk.name, {
            fontSize: "7px", fontFamily: "monospace",
            color: isCurrent ? "#ffd700" : "#999",
          }).setOrigin(0.5, 0);
          this.worldMapOverlay.add(regionLabel);
        }

        // Draw town markers (only if explored)
        for (const town of chunk.towns) {
          const townExploredKey = `${cx},${cy},${town.x},${town.y}`;
          if (!this.player.exploredTiles[townExploredKey]) continue;
          const mx = ox + town.x * tilePixel + tilePixel / 2;
          const my = oy + town.y * tilePixel + tilePixel / 2;
          const townMarker = this.add.graphics();
          townMarker.fillStyle(0xff9800, 1);
          townMarker.fillCircle(mx, my, 3);
          this.worldMapOverlay.add(townMarker);
        }

        // Draw boss markers (if not defeated and explored)
        for (const boss of chunk.bosses) {
          const bossExploredKey = `${cx},${cy},${boss.x},${boss.y}`;
          if (!this.defeatedBosses.has(boss.monsterId) && this.player.exploredTiles[bossExploredKey]) {
            const mx = ox + boss.x * tilePixel + tilePixel / 2;
            const my = oy + boss.y * tilePixel + tilePixel / 2;
            const bossMarker = this.add.graphics();
            bossMarker.fillStyle(0xff0000, 1);
            bossMarker.fillCircle(mx, my, 3);
            bossMarker.lineStyle(1, 0xffffff, 1);
            bossMarker.strokeCircle(mx, my, 3);
            this.worldMapOverlay.add(bossMarker);
          }
        }

        // Draw player marker on current chunk
        if (isCurrent) {
          const pmx = ox + this.player.x * tilePixel + tilePixel / 2;
          const pmy = oy + this.player.y * tilePixel + tilePixel / 2;
          const playerMarker = this.add.graphics();
          playerMarker.fillStyle(0x00ff00, 1);
          playerMarker.fillCircle(pmx, pmy, 3);
          playerMarker.lineStyle(1, 0xffffff, 1);
          playerMarker.strokeCircle(pmx, pmy, 3);
          this.worldMapOverlay.add(playerMarker);
        }
      }
    }

    // Legend
    const legendY = gridY + gridH + 14;
    const legend = this.add.text(px + panelW / 2, legendY,
      "● You   ● Town   ● Boss      Press N to close", {
        fontSize: "9px", fontFamily: "monospace", color: "#aaa",
      }).setOrigin(0.5, 0);
    this.worldMapOverlay.add(legend);
  }
}
