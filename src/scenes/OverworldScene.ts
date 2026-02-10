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
  DUNGEONS,
  CITIES,
  getCity,
  getCityForTown,
  getCityShopAt,
  type WorldChunk,
  type DungeonData,
  type CityData,
} from "../data/map";
import { getRandomEncounter, getDungeonEncounter, getBoss, getNightEncounter, MONSTERS, DUNGEON_MONSTERS, NIGHT_MONSTERS, type Monster } from "../data/monsters";
import { createPlayer, getArmorClass, awardXP, xpForLevel, allocateStatPoint, ASI_LEVELS, type PlayerState, type PlayerStats } from "../systems/player";
import { abilityModifier } from "../utils/dice";
import { isDebug, debugLog, debugPanelLog, debugPanelState, debugPanelClear } from "../config";
import type { BestiaryData } from "../systems/bestiary";
import { createBestiary } from "../systems/bestiary";
import { saveGame } from "../systems/save";
import { getItem } from "../data/items";
import { TimePeriod, getTimePeriod, getEncounterMultiplier, isNightTime, PERIOD_TINT, PERIOD_LABEL, CYCLE_LENGTH } from "../systems/daynight";
import { registerSharedHotkeys, buildSharedCommands, registerCommandRouter, SHARED_HELP, type HelpEntry } from "../systems/debug";
import {
  type WeatherState,
  WeatherType,
  createWeatherState,
  advanceWeather,
  changeZoneWeather,
  getWeatherAccuracyPenalty,
  getWeatherEncounterMultiplier,
  getMonsterWeatherBoost,
  WEATHER_TINT,
  WEATHER_LABEL,
} from "../systems/weather";

const TILE_SIZE = 32;

/**
 * Blend two 0xRRGGBB tint values, weighting the first (day/night) at 75%
 * and the second (weather) at 25%.  This keeps the day/night cycle clearly
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
  private timeStep = 0; // day/night cycle step counter
  private weatherState: WeatherState = createWeatherState();
  private weatherParticles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private stormLightningTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super({ key: "OverworldScene" });
  }

  init(data?: { player?: PlayerState; defeatedBosses?: Set<string>; bestiary?: BestiaryData; timeStep?: number; weatherState?: WeatherState }): void {
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
    if (data?.timeStep !== undefined) {
      this.timeStep = data.timeStep;
    }
    if (data?.weatherState) {
      this.weatherState = data.weatherState;
    }
    // Reset movement state — a tween may have been orphaned when the scene
    // switched to battle mid-move, leaving isMoving permanently true.
    this.isMoving = false;
    this.lastMoveTime = 0;
    // Clear stale particle reference — scene.restart destroys all game objects
    // but doesn't re-run class property initialisers.
    this.weatherParticles = null;
    this.stormLightningTimer = null;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x111111);
    this.cameras.main.fadeIn(500);

    // Dungeons are enclosed — always force clear weather
    if (this.player.inDungeon) {
      this.weatherState.current = WeatherType.Clear;
    }

    // Reveal tiles around player on creation (fog of war)
    this.revealAround();

    this.renderMap();
    this.applyDayNightTint();
    this.createPlayer();
    this.setupInput();
    this.createHUD();
    this.setupDebug();
    this.updateLocationText();
    this.updateWeatherParticles();

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

    const cb = {
      updateUI: () => this.updateHUD(),
      onLevelUp: (_asiGained: number) => {
        this.time.delayedCall(200, () => {
          if (this.player.pendingStatPoints > 0) this.showStatOverlay();
        });
      },
    };

    // Shared hotkeys: G=Gold, H=Heal, P=MP, L=LvUp
    registerSharedHotkeys(this, this.player, cb);

    // Overworld-only hotkeys
    const fKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    fKey.on("down", () => {
      if (!isDebug()) return;
      this.debugEncounters = !this.debugEncounters;
      debugLog("CHEAT: Encounters " + (this.debugEncounters ? "ON" : "OFF"));
      debugPanelLog(`[CHEAT] Encounters ${this.debugEncounters ? "ON" : "OFF"}`, true);
    });

    const rKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    rKey.on("down", () => {
      if (!isDebug()) return;
      this.revealEntireWorld();
      debugPanelLog(`[CHEAT] Map revealed`, true);
    });

    const vKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.V);
    vKey.on("down", () => {
      if (!isDebug()) return;
      this.debugFogDisabled = !this.debugFogDisabled;
      debugLog("CHEAT: Fog " + (this.debugFogDisabled ? "OFF" : "ON"));
      debugPanelLog(`[CHEAT] Fog of War ${this.debugFogDisabled ? "OFF" : "ON"}`, true);
      this.renderMap();
      this.createPlayer();
    });

    // Slash commands: shared + overworld-specific
    const cmds = buildSharedCommands(this.player, cb);

    // Overworld-only commands
    cmds.set("reveal", () => {
      this.revealEntireWorld();
      debugPanelLog(`[CMD] Entire world map revealed`, true);
    });

    cmds.set("max_hp", (args) => {
      const val = parseInt(args, 10);
      if (!isNaN(val)) { this.player.maxHp = val; this.player.hp = Math.min(this.player.hp, val); this.updateHUD(); debugPanelLog(`[CMD] Max HP set to ${val}`, true); }
      else debugPanelLog(`Usage: /max_hp <amount>`, true);
    });
    cmds.set("maxhp", cmds.get("max_hp")!);

    cmds.set("max_mp", (args) => {
      const val = parseInt(args, 10);
      if (!isNaN(val)) { this.player.maxMp = val; this.player.mp = Math.min(this.player.mp, val); this.updateHUD(); debugPanelLog(`[CMD] Max MP set to ${val}`, true); }
      else debugPanelLog(`Usage: /max_mp <amount>`, true);
    });
    cmds.set("maxmp", cmds.get("max_mp")!);

    cmds.set("level", (args) => {
      const val = parseInt(args, 10);
      if (!isNaN(val) && val >= 1 && val <= 20) {
        while (this.player.level < val) {
          const needed = xpForLevel(this.player.level + 1) - this.player.xp;
          awardXP(this.player, Math.max(needed, 0));
        }
        this.updateHUD();
        debugPanelLog(`[CMD] Level set to ${this.player.level}`, true);
        if (this.player.pendingStatPoints > 0) {
          this.time.delayedCall(200, () => this.showStatOverlay());
        }
      } else debugPanelLog(`Usage: /level <1-20>`, true);
    });
    cmds.set("lvl", cmds.get("level")!);

    cmds.set("item", (args) => {
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
    });

    cmds.set("weather", (args) => {
      const weatherArg = args.trim().toLowerCase();
      const weatherMap: Record<string, WeatherType> = {
        clear: WeatherType.Clear,
        rain: WeatherType.Rain,
        snow: WeatherType.Snow,
        sandstorm: WeatherType.Sandstorm,
        storm: WeatherType.Storm,
        fog: WeatherType.Fog,
      };
      const wt = weatherMap[weatherArg];
      if (wt) {
        this.weatherState.current = wt;
        this.applyDayNightTint();
        this.updateWeatherParticles();
        this.updateHUD();
        debugPanelLog(`[CMD] Weather set to ${wt}`, true);
      } else {
        debugPanelLog(`Usage: /weather <clear|rain|snow|sandstorm|storm|fog>`, true);
      }
    });

    cmds.set("time", (args) => {
      const timeArg = args.trim().toLowerCase();
      const timeMap: Record<string, number> = {
        dawn: 0,
        day: 45,
        dusk: 220,
        night: 265,
      };
      const step = timeMap[timeArg];
      if (step !== undefined) {
        this.timeStep = step;
        this.applyDayNightTint();
        this.updateHUD();
        debugPanelLog(`[CMD] Time set to ${timeArg} (step ${step})`, true);
      } else {
        debugPanelLog(`Usage: /time <dawn|day|dusk|night>`, true);
      }
    });

    cmds.set("spawn", (args) => {
      const query = args.trim().toLowerCase();
      if (!query) { debugPanelLog(`Usage: /spawn <monster name or id>`, true); return; }
      // Search all monster pools by id or name (case-insensitive partial match)
      const allMonsters: Monster[] = [...MONSTERS, ...DUNGEON_MONSTERS, ...NIGHT_MONSTERS];
      let found = allMonsters.find(m => m.id.toLowerCase() === query);
      if (!found) found = allMonsters.find(m => m.name.toLowerCase() === query);
      if (!found) found = allMonsters.find(m => m.name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query));
      if (found) {
        debugPanelLog(`[CMD] Spawning ${found.name}...`, true);
        this.startBattle({ ...found });
      } else {
        debugPanelLog(`[CMD] Unknown monster: "${args.trim()}". Try a partial name or id.`, true);
      }
    });

    cmds.set("teleport", (args) => {
      const parts = args.trim().split(/\s+/);
      if (parts.length !== 2) { debugPanelLog(`Usage: /teleport <chunkX> <chunkY>`, true); return; }
      const cx = parseInt(parts[0], 10);
      const cy = parseInt(parts[1], 10);
      if (isNaN(cx) || isNaN(cy) || cx < 0 || cx >= WORLD_WIDTH || cy < 0 || cy >= WORLD_HEIGHT) {
        debugPanelLog(`[CMD] Invalid chunk coords. Range: 0-${WORLD_WIDTH - 1} x 0-${WORLD_HEIGHT - 1}`, true);
        return;
      }
      const chunk = getChunk(cx, cy);
      if (!chunk) { debugPanelLog(`[CMD] No chunk at (${cx}, ${cy})`, true); return; }
      this.player.chunkX = cx;
      this.player.chunkY = cy;
      // Place player at center of chunk
      this.player.x = Math.floor(MAP_WIDTH / 2);
      this.player.y = Math.floor(MAP_HEIGHT / 2);
      // Exit dungeon if inside one
      if (this.player.inDungeon) {
        this.player.inDungeon = false;
        this.player.dungeonId = "";
      }
      this.renderMap();
      this.createPlayer();
      this.updateHUD();
      debugPanelLog(`[CMD] Teleported to chunk (${cx}, ${cy}) — ${chunk.name}`, true);
    });
    cmds.set("tp", cmds.get("teleport")!);

    // Help entries
    const helpEntries: HelpEntry[] = [
      ...SHARED_HELP,
      { usage: "/reveal", desc: "Reveal entire world map" },
      { usage: "/max_hp <n>", desc: "Set max HP (alias: /maxhp)" },
      { usage: "/max_mp <n>", desc: "Set max MP (alias: /maxmp)" },
      { usage: "/level <1-20>", desc: "Set level (alias: /lvl)" },
      { usage: "/item <id>", desc: "Add item to inventory" },
      { usage: "/weather <w>", desc: "Set weather (clear|rain|snow|sandstorm|storm|fog)" },
      { usage: "/time <t>", desc: "Set time (dawn|day|dusk|night)" },
      { usage: "/spawn <name>", desc: "Spawn a monster battle by name/id" },
      { usage: "/teleport <x> <y>", desc: "Teleport to chunk (alias: /tp)" },
    ];

    registerCommandRouter(cmds, "Overworld", helpEntries, "G=Gold H=Heal P=MP L=LvUp F=Enc R=Reveal V=Fog");
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

    // If inside a city, render the city interior
    if (this.player.inCity) {
      const city = getCity(this.player.cityId);
      if (!city) return;
      for (let y = 0; y < MAP_HEIGHT; y++) {
        this.tileSprites[y] = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
          const explored = this.isExplored(x, y);
          const terrain = city.mapData[y][x];
          const texKey = explored ? `tile_${terrain}` : "tile_fog";
          const sprite = this.add.sprite(
            x * TILE_SIZE + TILE_SIZE / 2,
            y * TILE_SIZE + TILE_SIZE / 2,
            texKey
          );
          this.tileSprites[y][x] = sprite;
        }
      }
      // City name label
      this.add
        .text(MAP_WIDTH * TILE_SIZE / 2, 4, city.name, {
          fontSize: "10px",
          fontFamily: "monospace",
          color: "#dda0dd",
          stroke: "#000",
          strokeThickness: 2,
        })
        .setOrigin(0.5, 0);
      // Shop labels and exit label
      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          if (city.mapData[y][x] === Terrain.CityExit && this.isExplored(x, y)) {
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
      for (const shop of city.shops) {
        if (this.isExplored(shop.x, shop.y)) {
          const icon = shop.type === "weapon" ? "⚔" : shop.type === "armor" ? "🛡" : shop.type === "inn" ? "🏨" : shop.type === "bank" ? "🏦" : "🏪";
          this.add
            .text(shop.x * TILE_SIZE + TILE_SIZE / 2, shop.y * TILE_SIZE - 4, `${icon} ${shop.name}`, {
              fontSize: "7px",
              fontFamily: "monospace",
              color: "#ffd700",
              stroke: "#000",
              strokeThickness: 2,
            })
            .setOrigin(0.5, 1);
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
        // Show grass for collected minor treasures
        if (explored && terrain === Terrain.MinorTreasure) {
          const tKey = `${this.player.chunkX},${this.player.chunkY},${x},${y}`;
          if (this.player.collectedTreasures.includes(tKey)) {
            texKey = "tile_0";
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

  /** Build the explored-tiles key for a position (respects dungeon/city vs overworld). */
  private exploredKey(x: number, y: number): string {
    if (this.player.inDungeon) {
      return `d:${this.player.dungeonId},${x},${y}`;
    }
    if (this.player.inCity) {
      return `c:${this.player.cityId},${x},${y}`;
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
    } else if (this.player.inCity) {
      const city = getCity(this.player.cityId);
      if (!city) return;
      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          if (this.isExplored(x, y) && this.tileSprites[y]?.[x]) {
            const terrain = city.mapData[y][x];
            this.tileSprites[y][x].setTexture(`tile_${terrain}`);
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
            if (terrain === Terrain.MinorTreasure) {
              const tKey = `${this.player.chunkX},${this.player.chunkY},${x},${y}`;
              if (this.player.collectedTreasures.includes(tKey)) {
                texKey = "tile_0";
              }
            }
            this.tileSprites[y][x].setTexture(texKey);
          }
        }
      }
    }
  }

  /** Reveal every tile in every overworld chunk and every dungeon. */
  private revealEntireWorld(): void {
    // Reveal all overworld chunks
    for (let cy = 0; cy < WORLD_HEIGHT; cy++) {
      for (let cx = 0; cx < WORLD_WIDTH; cx++) {
        for (let ty = 0; ty < MAP_HEIGHT; ty++) {
          for (let tx = 0; tx < MAP_WIDTH; tx++) {
            this.player.exploredTiles[`${cx},${cy},${tx},${ty}`] = true;
          }
        }
      }
    }
    // Reveal all dungeon tiles
    for (const dungeon of DUNGEONS) {
      for (let ty = 0; ty < dungeon.mapData.length; ty++) {
        for (let tx = 0; tx < dungeon.mapData[ty].length; tx++) {
          this.player.exploredTiles[`d:${dungeon.id},${tx},${ty}`] = true;
        }
      }
    }
    this.renderMap();
    this.createPlayer();
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
    const asiHint = p.pendingStatPoints > 0 ? `  ★ ${p.pendingStatPoints} Stat Pts` : "";
    const timeLabel = PERIOD_LABEL[getTimePeriod(this.timeStep)];
    const weatherLabel = WEATHER_LABEL[this.weatherState.current];
    this.hudText.setText(
      `${p.name} Lv.${p.level}  —  ${regionName}  ${timeLabel}  ${weatherLabel}\n` +
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

    // In city: show city-specific text
    if (this.player.inCity) {
      const city = getCity(this.player.cityId);
      if (!city) { this.locationText.setText("???"); return; }
      const terrain = city.mapData[this.player.y]?.[this.player.x];
      if (terrain === Terrain.CityExit) {
        this.locationText.setText(`${city.name}\n[SPACE] Leave City`);
      } else {
        const shop = getCityShopAt(city, this.player.x, this.player.y);
        if (shop) {
          this.locationText.setText(`${shop.name}\n[SPACE] Enter`);
        } else {
          this.locationText.setText(city.name);
        }
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
      [Terrain.Tundra]: "Tundra",
      [Terrain.Swamp]: "Swamp",
      [Terrain.DeepForest]: "Deep Forest",
      [Terrain.Volcanic]: "Volcanic",
      [Terrain.Canyon]: "Canyon",
      [Terrain.MinorTreasure]: "Sparkle",
    };

    const chunk = getChunk(this.player.chunkX, this.player.chunkY);
    const town = chunk?.towns.find(
      (t) => t.x === this.player.x && t.y === this.player.y
    );
    const boss = chunk?.bosses.find(
      (b) => b.x === this.player.x && b.y === this.player.y
    );

    let locStr = terrainNames[terrain ?? 0] ?? "Unknown";
    if (town) {
      const city = getCityForTown(this.player.chunkX, this.player.chunkY, town.x, town.y);
      locStr = city ? `${town.name}\n[SPACE] Enter City` : `${town.name}\n[SPACE] Enter Shop`;
    }
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
      [Terrain.Tundra]: "Tundra",
      [Terrain.Swamp]: "Swamp",
      [Terrain.DeepForest]: "DForest",
      [Terrain.Volcanic]: "Volcanic",
      [Terrain.Canyon]: "Canyon",
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
    const encMult = getEncounterMultiplier(this.timeStep);
    const weatherEncMult = getWeatherEncounterMultiplier(this.weatherState.current);
    const effectiveRate = rate * encMult * weatherEncMult;
    const dungeonTag = p.inDungeon ? ` [DUNGEON:${p.dungeonId}]` : "";
    const timePeriod = getTimePeriod(this.timeStep);
    debugPanelState(
      `OVERWORLD | Chunk: (${p.chunkX},${p.chunkY}) Pos: (${p.x},${p.y}) ${tName}${dungeonTag} | ` +
      `Time: ${timePeriod} (step ${this.timeStep}) | Weather: ${this.weatherState.current} (${this.weatherState.stepsUntilChange} steps) | ` +
      `Enc: ${(effectiveRate * 100).toFixed(0)}% (×${encMult}×${weatherEncMult})${this.debugEncounters ? "" : " [OFF]"}${this.debugFogDisabled ? " Fog[OFF]" : ""} | ` +
      `HP ${p.hp}/${p.maxHp} MP ${p.mp}/${p.maxMp} | ` +
      `Lv.${p.level} XP ${p.xp} Gold ${p.gold} | ` +
      `Bosses: ${this.defeatedBosses.size}\n` +
      `Cheats: G=Gold H=Heal P=MP L=LvUp F=EncToggle R=Reveal V=FogToggle`
    );
  }

  /** Check whether any overlay (menu, map, equip, stat allocation) is currently open. */
  private isOverlayOpen(): boolean {
    return !!(this.menuOverlay || this.worldMapOverlay || this.equipOverlay || this.statOverlay);
  }

  update(time: number): void {
    this.updateDebugPanel();
    if (this.isMoving) return;
    if (this.isOverlayOpen()) return; // block movement when menus/maps are open
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
          this.advanceTime();
          this.revealAround();
          this.revealTileSprites();
          this.collectMinorTreasure();
          this.updateHUD();
          this.updateLocationText();
          this.checkEncounter(terrain);
        },
      });
      return;
    }

    // In city: no chunk transitions, no encounters
    if (this.player.inCity) {
      const city = getCity(this.player.cityId);
      if (!city) return;
      if (newX < 0 || newX >= MAP_WIDTH || newY < 0 || newY >= MAP_HEIGHT) return;
      const terrain = city.mapData[newY][newX];
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
          this.advanceTime();
          this.revealAround();
          this.revealTileSprites();
          this.updateHUD();
          this.updateLocationText();
          // No encounters in cities
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
      // Chunk transition — flash, re-roll weather for the new zone, and re-render
      this.advanceTime();
      this.rerollWeather();
      this.cameras.main.flash(200, 255, 255, 255);
      this.scene.restart({
        player: this.player,
        defeatedBosses: this.defeatedBosses,
        bestiary: this.bestiary,
        timeStep: this.timeStep,
        weatherState: this.weatherState,
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
        this.advanceTime();
        this.revealAround();
        this.revealTileSprites();
        this.collectMinorTreasure();
        this.updateHUD();
        this.updateLocationText();
        this.checkEncounter(terrain);
      },
    });
  }

  /** Auto-collect minor treasure when stepping on it. Awards 5-25 gold. */
  private collectMinorTreasure(): void {
    const px = this.player.x;
    const py = this.player.y;
    let terrain: Terrain | undefined;

    if (this.player.inDungeon) return; // no minor treasures in dungeons

    terrain = getTerrainAt(this.player.chunkX, this.player.chunkY, px, py);
    if (terrain !== Terrain.MinorTreasure) return;

    const key = `${this.player.chunkX},${this.player.chunkY},${px},${py}`;
    if (this.player.collectedTreasures.includes(key)) return;

    this.player.collectedTreasures.push(key);
    const goldAmount = 5 + Math.floor(Math.random() * 21); // 5-25
    this.player.gold += goldAmount;

    // Update tile sprite to show collected state (plain grass)
    if (this.tileSprites[py]?.[px]) {
      this.tileSprites[py][px].setTexture("tile_0"); // grass texture
    }

    this.showMessage(`✨ Found ${goldAmount} gold!`, "#4fc3f7");
    this.updateHUD();
  }

  private checkEncounter(terrain: Terrain): void {
    // Auto-save after each step
    this.autoSave();

    // Boss tile: handled by SPACE action, not random
    if (terrain === Terrain.Boss) return;
    if (terrain === Terrain.Town) return;
    if (terrain === Terrain.DungeonExit) return;
    if (terrain === Terrain.Chest) return;
    if (terrain === Terrain.MinorTreasure) return;

    // Debug: encounters can be toggled off
    if (isDebug() && !this.debugEncounters) return;

    const rate = ENCOUNTER_RATES[terrain] * getEncounterMultiplier(this.timeStep) * getWeatherEncounterMultiplier(this.weatherState.current);
    if (Math.random() < rate) {
      let monster;
      if (this.player.inDungeon) {
        monster = getDungeonEncounter(this.player.level, this.player.dungeonId);
      } else if (isNightTime(this.timeStep) && Math.random() < 0.4) {
        // 40% chance of a night-exclusive monster during dusk/night
        const chunk = getChunk(this.player.chunkX, this.player.chunkY);
        monster = getNightEncounter(this.player.level, chunk?.name);
      } else {
        monster = getRandomEncounter(this.player.level);
      }
      debugLog("Encounter!", { terrain: Terrain[terrain], rate, monster: monster.name, inDungeon: this.player.inDungeon, time: getTimePeriod(this.timeStep) });
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
        // Roll outdoor weather for the biome the player emerges into
        this.rerollWeather();
        this.autoSave();
        this.cameras.main.flash(300, 255, 255, 255);
        this.scene.restart({
          player: this.player,
          defeatedBosses: this.defeatedBosses,
          bestiary: this.bestiary,
          timeStep: this.timeStep,
          weatherState: this.weatherState,
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

    // ── City actions: exit and shop interaction ──
    if (this.player.inCity) {
      const city = getCity(this.player.cityId);
      if (!city) return;
      const terrain = city.mapData[this.player.y]?.[this.player.x];
      if (terrain === Terrain.CityExit) {
        // Return to overworld at the town tile
        this.player.inCity = false;
        this.player.cityId = "";
        this.player.chunkX = city.chunkX;
        this.player.chunkY = city.chunkY;
        this.player.x = city.tileX;
        this.player.y = city.tileY;
        this.rerollWeather();
        this.autoSave();
        this.cameras.main.flash(300, 255, 255, 255);
        this.scene.restart({
          player: this.player,
          defeatedBosses: this.defeatedBosses,
          bestiary: this.bestiary,
          timeStep: this.timeStep,
          weatherState: this.weatherState,
        });
        return;
      }

      // Check if on a shop location
      const shop = getCityShopAt(city, this.player.x, this.player.y);
      if (shop) {
        if (shop.type === "inn") {
          // Inn: heal directly without opening shop
          if (this.player.gold < 10) {
            this.showMessage("Not enough gold to rest! (Need 10g)", "#ff6666");
          } else {
            this.player.gold -= 10;
            this.player.hp = this.player.maxHp;
            this.player.mp = this.player.maxMp;
            this.showMessage("You rest at the inn. HP and MP fully restored!", "#88ff88");
            this.updateHUD();
            this.autoSave();
          }
          return;
        }
        if (shop.type === "bank") {
          this.showMessage(`💰 The bank holds your gold safe. Balance: ${this.player.gold}g`, "#ffd700");
          return;
        }
        // Open shop with specific items
        this.autoSave();
        this.scene.start("ShopScene", {
          player: this.player,
          townName: `${city.name} - ${shop.name}`,
          defeatedBosses: this.defeatedBosses,
          bestiary: this.bestiary,
          shopItemIds: shop.shopItems,
          timeStep: this.timeStep,
          weatherState: this.weatherState,
          fromCity: true,
          cityId: city.id,
        });
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
      // Track this town as the last visited (respawn point on death)
      this.player.lastTownX = town.x;
      this.player.lastTownY = town.y;
      this.player.lastTownChunkX = this.player.chunkX;
      this.player.lastTownChunkY = this.player.chunkY;

      // Check if this town has an explorable city layout
      const city = getCityForTown(this.player.chunkX, this.player.chunkY, town.x, town.y);
      if (city) {
        // Enter the city interior
        this.player.inCity = true;
        this.player.cityId = city.id;
        this.player.x = city.spawnX;
        this.player.y = city.spawnY;
        this.weatherState.current = WeatherType.Clear;
        this.autoSave();
        this.cameras.main.flash(300, 200, 180, 160);
        this.scene.restart({
          player: this.player,
          defeatedBosses: this.defeatedBosses,
          bestiary: this.bestiary,
          timeStep: this.timeStep,
          weatherState: this.weatherState,
        });
        return;
      }

      // No city layout — open shop directly (legacy behavior)
      this.rerollWeather();
      this.autoSave();
      this.scene.start("ShopScene", {
        player: this.player,
        townName: town.name,
        defeatedBosses: this.defeatedBosses,
        bestiary: this.bestiary,
        shopItemIds: town.shopItems,
        timeStep: this.timeStep,
        weatherState: this.weatherState,
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
          // Enter the dungeon — force clear weather (closed space)
          this.player.inDungeon = true;
          this.player.dungeonId = dungeon.id;
          this.player.x = dungeon.spawnX;
          this.player.y = dungeon.spawnY;
          this.weatherState.current = WeatherType.Clear;
          this.autoSave();
          this.cameras.main.flash(300, 100, 100, 100);
          this.scene.restart({
            player: this.player,
            defeatedBosses: this.defeatedBosses,
            bestiary: this.bestiary,
            timeStep: this.timeStep,
            weatherState: this.weatherState,
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
        timeStep: this.timeStep,
        weatherState: this.weatherState,
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
      timeStep: this.timeStep,
      weatherState: this.weatherState,
    });
  }

  private autoSave(): void {
    saveGame(this.player, this.defeatedBosses, this.bestiary, this.player.appearanceId, this.timeStep, this.weatherState);
  }

  /** Advance the day/night cycle by one step and update the map tint. */
  private advanceTime(): void {
    const oldPeriod = getTimePeriod(this.timeStep);
    this.timeStep = (this.timeStep + 1) % CYCLE_LENGTH;
    const newPeriod = getTimePeriod(this.timeStep);

    // Dungeons and cities are enclosed — weather stays Clear, only advance time-of-day tint.
    if (this.player.inDungeon || this.player.inCity) {
      if (oldPeriod !== newPeriod) this.applyDayNightTint();
      return;
    }

    // Advance weather step countdown (can also shift naturally over time)
    const biomeName = getChunk(this.player.chunkX, this.player.chunkY)?.name ?? "Heartlands";
    const weatherChanged = advanceWeather(this.weatherState, biomeName, this.timeStep);

    if (oldPeriod !== newPeriod || weatherChanged) {
      this.applyDayNightTint();
      if (weatherChanged) this.updateWeatherParticles();
    }
  }

  /**
   * Re-roll weather for the current biome (called on chunk transition and town entry).
   * Updates tint and particle effects if the weather changed.
   */
  private rerollWeather(): void {
    const biomeName = getChunk(this.player.chunkX, this.player.chunkY)?.name ?? "Heartlands";
    const weatherChanged = changeZoneWeather(this.weatherState, biomeName, this.timeStep);
    if (weatherChanged) {
      this.applyDayNightTint();
      this.updateWeatherParticles();
    }
  }

  /** Apply a color tint to all map tiles based on time period + weather. */
  private applyDayNightTint(): void {
    const dayTint = PERIOD_TINT[getTimePeriod(this.timeStep)];
    const weatherTint = WEATHER_TINT[this.weatherState.current];
    // Blend: average the two tint values per channel
    const tint = blendTints(dayTint, weatherTint);
    for (const row of this.tileSprites) {
      for (const sprite of row) {
        sprite.setTint(tint);
      }
    }
  }

  /** Create or update weather particle effects based on current weather. */
  private updateWeatherParticles(): void {
    // Destroy existing emitter
    if (this.weatherParticles) {
      this.weatherParticles.destroy();
      this.weatherParticles = null;
    }
    // Stop lightning timer
    if (this.stormLightningTimer) {
      this.stormLightningTimer.destroy();
      this.stormLightningTimer = null;
    }

    const w = MAP_WIDTH * TILE_SIZE;
    const h = MAP_HEIGHT * TILE_SIZE;
    const weather = this.weatherState.current;

    if (weather === WeatherType.Clear) return;

    const configs: Record<string, () => Phaser.GameObjects.Particles.ParticleEmitter> = {
      [WeatherType.Rain]: () => this.add.particles(0, -20, "particle_rain", {
        x: { min: 0, max: w },
        quantity: 4,
        lifespan: 2200,
        speedY: { min: 220, max: 360 },
        speedX: { min: -20, max: -40 },
        scale: { start: 1, end: 0.5 },
        alpha: { start: 0.9, end: 0.25 },
        frequency: 16,
      }),
      [WeatherType.Snow]: () => this.add.particles(0, -20, "particle_snow", {
        x: { min: 0, max: w },
        quantity: 2,
        lifespan: 8000,
        speedY: { min: 40, max: 80 },
        speedX: { min: -25, max: 25 },
        scale: { start: 1, end: 0.3 },
        alpha: { start: 0.95, end: 0.1 },
        frequency: 50,
      }),
      [WeatherType.Sandstorm]: () => this.add.particles(w + 10, 0, "particle_sand", {
        y: { min: 0, max: h },
        quantity: 6,
        lifespan: 2400,
        speedX: { min: -450, max: -280 },
        speedY: { min: -30, max: 50 },
        scale: { start: 1.3, end: 0.5 },
        alpha: { start: 0.95, end: 0.2 },
        frequency: 10,
      }),
      [WeatherType.Storm]: () => this.add.particles(0, -20, "particle_storm", {
        x: { min: 0, max: w },
        quantity: 6,
        lifespan: 1600,
        speedY: { min: 350, max: 550 },
        speedX: { min: -60, max: -100 },
        scale: { start: 1, end: 0.5 },
        alpha: { start: 0.9, end: 0.2 },
        frequency: 12,
      }),
      [WeatherType.Fog]: () => this.add.particles(0, 0, "particle_fog", {
        x: { min: 0, max: w },
        y: { min: 0, max: h },
        quantity: 2,
        lifespan: 6000,
        speedX: { min: 8, max: 25 },
        speedY: { min: -5, max: 5 },
        scale: { start: 2.5, end: 6 },
        alpha: { start: 0.4, end: 0.05 },
        frequency: 100,
      }),
    };

    const factory = configs[weather];
    if (factory) {
      this.weatherParticles = factory();
      this.weatherParticles.setDepth(15);
    }

    // Sporadic lightning flashes during storms
    if (weather === WeatherType.Storm) {
      const scheduleFlash = () => {
        this.stormLightningTimer = this.time.delayedCall(
          2000 + Math.random() * 6000,  // 2-8 seconds between strikes
          () => {
            this.cameras.main.flash(120, 255, 255, 255, true);
            scheduleFlash();
          },
        );
      };
      scheduleFlash();
    }
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
    const xpNeeded = xpForLevel(p.level + 1);
    const header = this.add.text(px + 14, cy, [
      `${p.name}  Lv.${p.level}`,
      `HP: ${p.hp}/${p.maxHp}   MP: ${p.mp}/${p.maxMp}   AC: ${ac}`,
      `EXP: ${p.xp}/${xpNeeded}  (${xpNeeded - p.xp} to next)`,
    ].join("\n"), {
      fontSize: "11px",
      fontFamily: "monospace",
      color: "#ccc",
      lineSpacing: 4,
    });
    this.equipOverlay.add(header);
    cy += 52;

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
      p.pendingStatPoints > 0 ? "Click [+] to allocate" : "All points allocated!", {
        fontSize: "10px", fontFamily: "monospace", color: "#666",
      }).setOrigin(0.5, 1);
    this.statOverlay.add(hint);
  }

  // ─── World Map Overlay ───────────────────────────────────────────

  private toggleWorldMap(): void {
    if (this.worldMapOverlay) {
      this.worldMapOverlay.destroy();
      this.worldMapOverlay = null;
      // Remove map-specific input listeners
      this.input.off("wheel");
      this.input.off("pointermove");
      this.input.off("pointerup");
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

    this.worldMapOverlay = this.add.container(0, 0).setDepth(80);

    // Dim background (click to close)
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.6);
    dim.fillRect(0, 0, w, h);
    dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    dim.on("pointerdown", () => this.toggleWorldMap());
    this.worldMapOverlay.add(dim);

    // Panel sizing
    const panelPad = 12;
    const titleH = 28;
    const legendH = 36;
    const panelW = w - 20;
    const panelH = h - 20;
    const px = 10;
    const py = 10;

    // Panel background
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRect(px, py, panelW, panelH);
    bg.lineStyle(2, 0xffd700, 1);
    bg.strokeRect(px, py, panelW, panelH);
    bg.setInteractive(new Phaser.Geom.Rectangle(px, py, panelW, panelH), Phaser.Geom.Rectangle.Contains);
    this.worldMapOverlay.add(bg);

    // Title
    const title = this.add.text(px + panelW / 2, py + 6, "🗺 World Map", {
      fontSize: "14px", fontFamily: "monospace", color: "#ffd700",
    }).setOrigin(0.5, 0);
    this.worldMapOverlay.add(title);

    // Content area bounds (clipped region)
    const contentX = px + panelPad;
    const contentY = py + titleH + panelPad;
    const contentW = panelW - panelPad * 2;
    const contentH = panelH - titleH - panelPad * 2 - legendH;

    // Scrollable/zoomable map container
    const mapContainer = this.add.container(0, 0);
    this.worldMapOverlay.add(mapContainer);

    // Mask to clip content to panel area
    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(contentX, contentY, contentW, contentH);
    const mask = maskShape.createGeometryMask();
    mapContainer.setMask(mask);

    // ── Zoom / Pan state ──
    let zoomLevel = 1;
    const minZoom = 0.5;
    const maxZoom = 3;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let panStartX = 0;
    let panStartY = 0;
    let detailChunk: { cx: number; cy: number } | null = null;

    // Base tile scale for the overview
    const baseTilePixel = 4;
    const gap = 3;

    // ── Draw function (called on zoom/pan/detail change) ──
    const redraw = () => {
      mapContainer.removeAll(true);

      if (detailChunk) {
        // ── DETAIL VIEW: single chunk zoomed in ──
        const { cx: dcx, cy: dcy } = detailChunk;
        const chunk = getChunk(dcx, dcy);
        if (!chunk) return;

        const detailTile = Math.min(
          Math.floor(contentW / MAP_WIDTH),
          Math.floor(contentH / MAP_HEIGHT)
        );
        const mapW = MAP_WIDTH * detailTile;
        const mapH = MAP_HEIGHT * detailTile;
        const ox = contentX + Math.floor((contentW - mapW) / 2);
        const oy = contentY + Math.floor((contentH - mapH) / 2);

        // Draw terrain
        const gfx = this.add.graphics();
        for (let ty = 0; ty < MAP_HEIGHT; ty++) {
          for (let tx = 0; tx < MAP_WIDTH; tx++) {
            const terrain = chunk.mapData[ty][tx];
            const exploredKey = `${dcx},${dcy},${tx},${ty}`;
            const explored = !!this.player.exploredTiles[exploredKey];
            const color = explored ? TERRAIN_COLORS[terrain] : 0x0a0a0a;
            gfx.fillStyle(color, 1);
            gfx.fillRect(ox + tx * detailTile, oy + ty * detailTile, detailTile, detailTile);
            // Grid lines
            if (detailTile >= 6) {
              gfx.lineStyle(1, 0x000000, 0.15);
              gfx.strokeRect(ox + tx * detailTile, oy + ty * detailTile, detailTile, detailTile);
            }
          }
        }
        mapContainer.add(gfx);

        // Town labels
        for (const town of chunk.towns) {
          const eKey = `${dcx},${dcy},${town.x},${town.y}`;
          if (!this.player.exploredTiles[eKey]) continue;
          const mx = ox + town.x * detailTile + detailTile / 2;
          const my = oy + town.y * detailTile + detailTile / 2;
          const marker = this.add.graphics();
          marker.fillStyle(0xab47bc, 1);
          marker.fillCircle(mx, my, Math.max(4, detailTile / 3));
          mapContainer.add(marker);
          const label = this.add.text(mx, my - detailTile / 2 - 2, town.name, {
            fontSize: "9px", fontFamily: "monospace", color: "#fff",
            stroke: "#000", strokeThickness: 2,
          }).setOrigin(0.5, 1);
          mapContainer.add(label);
        }

        // Boss markers
        for (const boss of chunk.bosses) {
          const eKey = `${dcx},${dcy},${boss.x},${boss.y}`;
          if (!this.player.exploredTiles[eKey]) continue;
          if (this.defeatedBosses.has(boss.monsterId)) continue;
          const mx = ox + boss.x * detailTile + detailTile / 2;
          const my = oy + boss.y * detailTile + detailTile / 2;
          const marker = this.add.graphics();
          marker.fillStyle(0xff0000, 1);
          marker.fillCircle(mx, my, Math.max(4, detailTile / 3));
          marker.lineStyle(1, 0xffffff, 1);
          marker.strokeCircle(mx, my, Math.max(4, detailTile / 3));
          mapContainer.add(marker);
          const label = this.add.text(mx, my - detailTile / 2 - 2, "☠ " + boss.name, {
            fontSize: "8px", fontFamily: "monospace", color: "#ff4444",
            stroke: "#000", strokeThickness: 2,
          }).setOrigin(0.5, 1);
          mapContainer.add(label);
        }

        // Player marker if on this chunk
        if (dcx === this.player.chunkX && dcy === this.player.chunkY) {
          const pmx = ox + this.player.x * detailTile + detailTile / 2;
          const pmy = oy + this.player.y * detailTile + detailTile / 2;
          const pm = this.add.graphics();
          pm.fillStyle(0x00ff00, 1);
          pm.fillCircle(pmx, pmy, Math.max(4, detailTile / 3));
          pm.lineStyle(1, 0xffffff, 1);
          pm.strokeCircle(pmx, pmy, Math.max(4, detailTile / 3));
          mapContainer.add(pm);
        }

        // Back button
        const back = this.add.text(contentX + 4, contentY + 4, "◀ Back to World", {
          fontSize: "11px", fontFamily: "monospace", color: "#88ff88",
          backgroundColor: "#1a1a2e", padding: { x: 6, y: 3 },
        }).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        back.on("pointerover", () => back.setColor("#ffd700"));
        back.on("pointerout", () => back.setColor("#88ff88"));
        back.on("pointerdown", () => { detailChunk = null; redraw(); });
        mapContainer.add(back);

        return;
      }

      // ── OVERVIEW: all chunks ──
      const tp = baseTilePixel * zoomLevel;
      const chunkW = MAP_WIDTH * tp;
      const chunkH = MAP_HEIGHT * tp;
      const gapZ = gap * zoomLevel;
      const gridW = WORLD_WIDTH * chunkW + (WORLD_WIDTH - 1) * gapZ;
      const gridH = WORLD_HEIGHT * chunkH + (WORLD_HEIGHT - 1) * gapZ;

      // Center the grid, then apply pan offset
      const baseX = contentX + (contentW - gridW) / 2 + panX;
      const baseY = contentY + (contentH - gridH) / 2 + panY;

      for (let cy = 0; cy < WORLD_HEIGHT; cy++) {
        for (let cx = 0; cx < WORLD_WIDTH; cx++) {
          const chunk = getChunk(cx, cy);
          if (!chunk) continue;

          const ox = baseX + cx * (chunkW + gapZ);
          const oy = baseY + cy * (chunkH + gapZ);

          // Draw terrain
          const miniGfx = this.add.graphics();
          let hasExplored = false;
          for (let ty = 0; ty < MAP_HEIGHT; ty++) {
            for (let tx = 0; tx < MAP_WIDTH; tx++) {
              const terrain = chunk.mapData[ty][tx];
              const exploredKey = `${cx},${cy},${tx},${ty}`;
              const explored = !!this.player.exploredTiles[exploredKey];
              if (explored) hasExplored = true;
              // Show collected minor treasures as their base terrain color
              let color: number;
              if (!explored) {
                color = 0x0a0a0a;
              } else if (terrain === Terrain.MinorTreasure && this.player.collectedTreasures.includes(exploredKey)) {
                color = TERRAIN_COLORS[Terrain.Grass];
              } else {
                color = TERRAIN_COLORS[terrain];
              }
              miniGfx.fillStyle(color, 1);
              miniGfx.fillRect(ox + tx * tp, oy + ty * tp, tp, tp);
            }
          }
          mapContainer.add(miniGfx);

          // Border (gold for current chunk)
          const border = this.add.graphics();
          const isCurrent = cx === this.player.chunkX && cy === this.player.chunkY;
          border.lineStyle(isCurrent ? 2 : 1, isCurrent ? 0xffd700 : 0x333333, 1);
          border.strokeRect(ox, oy, chunkW, chunkH);
          mapContainer.add(border);

          // Click zone for detail view
          const clickZone = this.add.zone(ox + chunkW / 2, oy + chunkH / 2, chunkW, chunkH)
            .setInteractive({ useHandCursor: true });
          clickZone.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
            // Only on short click (not drag)
            if (pointer.getDistance() < 5) {
              detailChunk = { cx, cy };
              redraw();
            }
          });
          mapContainer.add(clickZone);

          // Town markers
          for (const town of chunk.towns) {
            const tKey = `${cx},${cy},${town.x},${town.y}`;
            if (!this.player.exploredTiles[tKey]) continue;
            const mx = ox + town.x * tp + tp / 2;
            const my = oy + town.y * tp + tp / 2;
            const m = this.add.graphics();
            m.fillStyle(0xab47bc, 1);
            m.fillCircle(mx, my, Math.max(2, 3 * zoomLevel));
            mapContainer.add(m);
          }

          // Boss markers
          for (const boss of chunk.bosses) {
            const bKey = `${cx},${cy},${boss.x},${boss.y}`;
            if (!this.player.exploredTiles[bKey] || this.defeatedBosses.has(boss.monsterId)) continue;
            const mx = ox + boss.x * tp + tp / 2;
            const my = oy + boss.y * tp + tp / 2;
            const m = this.add.graphics();
            m.fillStyle(0xff0000, 1);
            m.fillCircle(mx, my, Math.max(2, 3 * zoomLevel));
            m.lineStyle(1, 0xffffff, 1);
            m.strokeCircle(mx, my, Math.max(2, 3 * zoomLevel));
            mapContainer.add(m);
          }

          // Player marker
          if (isCurrent) {
            const pmx = ox + this.player.x * tp + tp / 2;
            const pmy = oy + this.player.y * tp + tp / 2;
            const pm = this.add.graphics();
            pm.fillStyle(0x00ff00, 1);
            pm.fillCircle(pmx, pmy, Math.max(2, 3 * zoomLevel));
            pm.lineStyle(1, 0xffffff, 1);
            pm.strokeCircle(pmx, pmy, Math.max(2, 3 * zoomLevel));
            mapContainer.add(pm);
          }
        }
      }
    };

    // Initial draw
    redraw();

    // ── Mouse wheel zoom ──
    this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _gameObjects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
      if (!this.worldMapOverlay || detailChunk) return;
      const oldZoom = zoomLevel;
      zoomLevel = Phaser.Math.Clamp(zoomLevel - deltaY * 0.001, minZoom, maxZoom);
      if (zoomLevel !== oldZoom) {
        // Scale pan to maintain center point
        panX = panX * (zoomLevel / oldZoom);
        panY = panY * (zoomLevel / oldZoom);
        redraw();
      }
    });

    // ── Drag to pan ──
    bg.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (detailChunk) return;
      isDragging = true;
      dragStartX = pointer.x;
      dragStartY = pointer.y;
      panStartX = panX;
      panStartY = panY;
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!isDragging || !this.worldMapOverlay) return;
      panX = panStartX + (pointer.x - dragStartX);
      panY = panStartY + (pointer.y - dragStartY);
      redraw();
    });
    this.input.on("pointerup", () => { isDragging = false; });

    // ── Legend ──
    const legendY = py + panelH - legendH + 4;
    const legendParts: { text: string; color: string }[] = [
      { text: "● ", color: "#00ff00" }, { text: "You  ", color: "#aaa" },
      { text: "● ", color: "#ff4444" }, { text: "Boss  ", color: "#aaa" },
      { text: "● ", color: "#ab47bc" }, { text: "Town  ", color: "#aaa" },
      { text: "|  Scroll to zoom · Drag to pan · Click chunk for detail  |  N to close", color: "#aaa" },
    ];
    let legendCursorX = 0;
    const legendContainer = this.add.container(0, legendY);
    for (const part of legendParts) {
      const t = this.add.text(legendCursorX, 0, part.text, {
        fontSize: "10px", fontFamily: "monospace", color: part.color,
      });
      legendContainer.add(t);
      legendCursorX += t.width;
    }
    legendContainer.setX(px + panelW / 2 - legendCursorX / 2);
    this.worldMapOverlay.add(legendContainer);

    // Zoom controls
    const zoomIn = this.add.text(px + panelW - panelPad - 40, legendY,
      "[+]", { fontSize: "12px", fontFamily: "monospace", color: "#88ff88" })
      .setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zoomIn.on("pointerdown", () => {
      if (detailChunk) return;
      zoomLevel = Phaser.Math.Clamp(zoomLevel + 0.3, minZoom, maxZoom);
      redraw();
    });
    this.worldMapOverlay.add(zoomIn);

    const zoomOut = this.add.text(px + panelW - panelPad - 20, legendY,
      "[-]", { fontSize: "12px", fontFamily: "monospace", color: "#88ff88" })
      .setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zoomOut.on("pointerdown", () => {
      if (detailChunk) return;
      zoomLevel = Phaser.Math.Clamp(zoomLevel - 0.3, minZoom, maxZoom);
      redraw();
    });
    this.worldMapOverlay.add(zoomOut);
  }
}
