/**
 * Overworld scene: tile-based map with WASD movement and encounters.
 *
 * Delegates rendering, overlays, NPCs, dialogue, and debug commands to
 * extracted subsystems — see systems/ folder.
 */

import Phaser from "phaser";
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  ENCOUNTER_RATES,
  Terrain,
  isWalkable,
  getTerrainAt,
  getChunk,
  getDungeonAt,
  getDungeon,
  getChestAt,
  getCity,
  getCityForTown,
  getCityShopNearby,
  hasSparkleAt,
  getTownBiome,
  type WorldChunk,
} from "../data/map";
import {
  getRandomEncounter,
  getDungeonEncounter,
  getBoss,
  getNightEncounter,
} from "../data/monsters";
import {
  createPlayer,
  isLightWeapon,
  type PlayerState,
} from "../systems/player";
import { isDebug, debugLog, debugPanelLog, debugPanelState, TILE_SIZE } from "../config";
import type { CodexData } from "../systems/codex";
import { createCodex } from "../systems/codex";
import { saveGame } from "../systems/save";
import { getItem } from "../data/items";
import {
  getTimePeriod,
  getEncounterMultiplier,
  isNightTime,
  TimePeriod,
  PERIOD_LABEL,
  CYCLE_LENGTH,
} from "../systems/daynight";
import {
  type WeatherState,
  WeatherType,
  createWeatherState,
  advanceWeather,
  changeZoneWeather,
  getWeatherEncounterMultiplier,
  WEATHER_LABEL,
} from "../systems/weather";
import { audioEngine } from "../systems/audio";
import { getMount } from "../data/mounts";
import type { SavedSpecialNpc } from "../data/npcs";
import { FogOfWar } from "../managers/fogOfWar";
import { EncounterSystem } from "../managers/encounter";
import { HUDRenderer } from "../renderers/hud";
import { tryGridMove } from "../systems/movement";
import { MapRenderer } from "../renderers/map";
import { CityRenderer } from "../renderers/city";
import { PlayerRenderer } from "../renderers/player";
import { DialogueSystem } from "../managers/dialogue";
import { SpecialNpcManager, type SpecialNpcCallbacks } from "../managers/specialNpc";
import { OverlayManager } from "../managers/overlay";
import { DebugCommandSystem, type TimeStepRef } from "../systems/debug";
import { findAdjacentNpc, findAdjacentAnimal } from "../managers/npc";

/** Terrain enum → human-readable display name for the location HUD. */
const TERRAIN_DISPLAY_NAMES: Record<number, string> = {
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
  [Terrain.Flower]: "Grassland",
  [Terrain.Cactus]: "Desert",
  [Terrain.Geyser]: "Volcanic",
  [Terrain.Mushroom]: "Swamp",
  [Terrain.River]: "River",
  [Terrain.Mill]: "Grassland",
  [Terrain.CropField]: "Grassland",
  [Terrain.Casino]: "Town",
  [Terrain.House]: "Town",
};

/** Terrain enum → short debug label for the debug panel. */
const TERRAIN_DEBUG_NAMES: Record<number, string> = {
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

export class OverworldScene extends Phaser.Scene {
  private player!: PlayerState;
  private keys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
  };
  private isMoving = false;
  private moveDelay = 150;
  private lastMoveTime = 0;
  private hudText!: Phaser.GameObjects.Text;
  private locationText!: Phaser.GameObjects.Text;
  private lastLocationStr = "";
  private defeatedBosses: Set<string> = new Set();
  private codex: CodexData = createCodex();
  private isNewPlayer = false;
  private timeStep = 0;
  private weatherState: WeatherState = createWeatherState();

  // ── Extracted subsystems ──
  private fogOfWar!: FogOfWar;
  private encounterSystem!: EncounterSystem;
  private hudRenderer!: HUDRenderer;
  private mapRenderer!: MapRenderer;
  private cityRenderer!: CityRenderer;
  private playerRenderer!: PlayerRenderer;
  private dialogueSystem!: DialogueSystem;
  private specialNpcManager!: SpecialNpcManager;
  private overlayManager!: OverlayManager;
  private debugCommandSystem!: DebugCommandSystem;

  constructor() {
    super({ key: "OverworldScene" });
  }

  init(data?: {
    player?: PlayerState;
    defeatedBosses?: Set<string>;
    codex?: CodexData;
    timeStep?: number;
    weatherState?: WeatherState;
    savedSpecialNpcs?: SavedSpecialNpc[];
  }): void {
    // Instantiate subsystems
    this.fogOfWar = new FogOfWar();
    this.encounterSystem = new EncounterSystem();
    this.hudRenderer = new HUDRenderer(this);
    this.mapRenderer = new MapRenderer(this);
    this.cityRenderer = new CityRenderer(this);
    this.playerRenderer = new PlayerRenderer(this);
    this.dialogueSystem = new DialogueSystem(this);
    this.specialNpcManager = new SpecialNpcManager(this);
    this.overlayManager = new OverlayManager(this, {
      updateHUD: () => this.updateHUD(),
      autoSave: () => this.autoSave(),
      showMessage: (text: string, color?: string) => this.showMessage(text, color),
      renderMap: () => this.renderMap(),
      applyDayNightTint: () => this.applyDayNightTint(),
      createPlayer: () => this.createPlayerSprite(),
      refreshPlayerSprite: () => this.playerRenderer.refreshPlayerSprite(this.player),
      respawnCityNpcs: () => this.cityRenderer.respawnCityNpcs(
        this.player, this.timeStep,
        (x: number, y: number) => this.fogOfWar.isExplored(x, y, this.player),
      ),
      saveAndQuit: () => {
        this.autoSave();
        this.scene.start("BootScene");
      },
      getTimeStep: () => this.timeStep,
      setTimeStep: (t: number) => { this.timeStep = t; },
      evacuateDungeon: () => this.evacuateDungeon(),
      getHUDInfo: () => this.getHUDInfo(),
    });

    // Load scene data
    if (data?.player) {
      this.player = data.player;
      this.isNewPlayer = false;
      this.fogOfWar.setExploredTiles(this.player.progression.exploredTiles);
    } else {
      this.player = createPlayer("Hero", {
        strength: 10, dexterity: 10, constitution: 10,
        intelligence: 10, wisdom: 10, charisma: 10,
      });
      this.isNewPlayer = true;
    }
    if (data?.defeatedBosses) this.defeatedBosses = data.defeatedBosses;
    if (data?.codex) this.codex = data.codex;
    if (data?.timeStep !== undefined) this.timeStep = data.timeStep;
    if (data?.weatherState) this.weatherState = data.weatherState;
    if (data?.savedSpecialNpcs) {
      this.specialNpcManager.savedSpecialNpcs = data.savedSpecialNpcs;
    }

    // Reset movement state — a tween may have been orphaned when the scene
    // switched to battle mid-move, leaving isMoving permanently true.
    this.isMoving = false;
    this.lastMoveTime = 0;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x111111);
    this.cameras.main.fadeIn(500);

    // Dungeons are enclosed — always force clear weather
    if (this.player.position.inDungeon) {
      this.weatherState.current = WeatherType.Clear;
    }

    // Reveal tiles around player on creation (fog of war)
    this.fogOfWar.revealAround(this.player.position.x, this.player.position.y, 2, this.player);

    this.renderMap();
    this.applyDayNightTint();
    this.createPlayerSprite();
    this.playerRenderer.refreshPlayerSprite(this.player);
    this.setupInput();
    this.createHUD();
    this.setupDebug();
    this.updateLocationText();
    this.mapRenderer.updateWeatherParticles(this.weatherState);
    this.updateAudio();

    // Show rolled stats on new game, or ASI overlay if points are pending
    if (this.isNewPlayer) {
      this.overlayManager.showRolledStatsOverlay(this.player);
    } else if (this.player.pendingStatPoints > 0) {
      this.time.delayedCall(400, () => this.overlayManager.showStatOverlay(this.player));
    }
  }

  // ── Debug ───────────────────────────────────────────────────────────────

  private setupDebug(): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const scene = this;
    const ref: TimeStepRef = {
      get value(): number { return scene.timeStep; },
      set value(v: number) { scene.timeStep = v; },
    };

    this.debugCommandSystem = new DebugCommandSystem(this, this.player, {
      updateHUD: () => this.updateHUD(),
      showStatOverlay: () => this.overlayManager.showStatOverlay(this.player),
      renderMap: () => this.renderMap(),
      applyDayNightTint: () => this.applyDayNightTint(),
      createPlayer: () => this.createPlayerSprite(),
      refreshWorldMap: () => this.overlayManager.refreshWorldMap(this.player, this.defeatedBosses),
      updateWeatherParticles: () => this.mapRenderer.updateWeatherParticles(this.weatherState),
      updateAudio: () => this.updateAudio(),
      startBattle: (monster) => this.startBattle(monster),
      spawnSpecialNpcs: (chunk) => this.spawnSpecialNpcs(chunk),
      autoSave: () => this.autoSave(),
      restartScene: () => this.scene.restart({
        player: this.player,
        defeatedBosses: this.defeatedBosses,
        codex: this.codex,
        timeStep: this.timeStep,
        weatherState: this.weatherState,
      }),
    });
    this.debugCommandSystem.fogOfWar = this.fogOfWar;
    this.debugCommandSystem.encounterSystem = this.encounterSystem;
    this.debugCommandSystem.pendingSpecialSpawns = this.specialNpcManager.pendingSpecialSpawns;
    this.debugCommandSystem.weatherState = this.weatherState;
    this.debugCommandSystem.timeStepRef = ref;
    this.debugCommandSystem.codex = this.codex;
    this.debugCommandSystem.defeatedBosses = this.defeatedBosses;
    this.debugCommandSystem.setup();
  }

  // ── Input ───────────────────────────────────────────────────────────────

  private setupInput(): void {
    this.keys = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      SPACE: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    };

    const cKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    cKey.on("down", () => this.openCodex());

    const eKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    eKey.on("down", () => this.overlayManager.toggleEquipOverlay(this.player));

    const mKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    mKey.on("down", () => this.overlayManager.toggleWorldMap(this.player, this.defeatedBosses));

    const escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    escKey.on("down", () => {
      // ESC closes the topmost open overlay, or opens the menu
      if (this.overlayManager.settingsOverlay) {
        this.overlayManager.toggleSettingsOverlay();
      } else if (this.overlayManager.worldMapOverlay) {
        this.overlayManager.toggleWorldMap(this.player, this.defeatedBosses);
      } else if (this.overlayManager.equipOverlay) {
        this.overlayManager.toggleEquipOverlay(this.player);
      } else if (this.overlayManager.bankOverlay) {
        this.overlayManager.dismissBankOverlay();
      } else if (this.overlayManager.innConfirmOverlay) {
        this.overlayManager.dismissInnConfirmation();
      } else if (this.overlayManager.townPickerOverlay) {
        this.overlayManager.dismissTownPicker();
      } else if (this.overlayManager.statOverlay) {
        // Stat overlay stays open (must allocate points)
      } else if (this.overlayManager.menuOverlay) {
        this.overlayManager.toggleMenuOverlay(this.player, this.defeatedBosses, this.codex);
      } else {
        this.overlayManager.toggleMenuOverlay(this.player, this.defeatedBosses, this.codex);
      }
    });

    const tKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.T);
    tKey.on("down", () => this.toggleMount());
  }

  // ── HUD ─────────────────────────────────────────────────────────────────

  private createHUD(): void {
    const hudBg = this.add.graphics();
    hudBg.fillStyle(0x1a1a2e, 0.85);
    hudBg.fillRect(0, MAP_HEIGHT * TILE_SIZE, MAP_WIDTH * TILE_SIZE, 48);
    hudBg.lineStyle(2, 0xc0a060, 1);
    hudBg.strokeRect(0, MAP_HEIGHT * TILE_SIZE, MAP_WIDTH * TILE_SIZE, 48);
    hudBg.setDepth(20);
    hudBg.setAlpha(0); // hidden by default

    this.hudText = this.add
      .text(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE + 8, "", {
        fontSize: "13px",
        fontFamily: "monospace",
        color: "#ddd",
        lineSpacing: 4,
        align: "center",
        wordWrap: { width: MAP_WIDTH * TILE_SIZE - 20 },
      })
      .setOrigin(0.5, 0)
      .setDepth(21)
      .setAlpha(0);

    // Store hudBg ref for fade
    this.hudBg = hudBg;

    // Location text is now part of the HUD message bar
    this.locationText = this.add
      .text(MAP_WIDTH * TILE_SIZE - 10, MAP_HEIGHT * TILE_SIZE + 6, "", {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#aaa",
        align: "right",
        lineSpacing: 2,
      })
      .setOrigin(1, 0)
      .setDepth(21)
      .setAlpha(0);
  }

  private hudBg!: Phaser.GameObjects.Graphics;
  private hudFadeTimer?: Phaser.Time.TimerEvent;

  /** Show a message in the HUD bar (auto-fades after delay). */
  private showHUDMessage(text: string, color = "#ddd", duration = 3000): void {
    this.hudText.setText(text);
    this.hudText.setColor(color);
    this.hudBg.setAlpha(1);
    this.hudText.setAlpha(1);

    // Cancel previous fade
    if (this.hudFadeTimer) this.hudFadeTimer.remove();
    this.tweens.killTweensOf(this.hudBg);
    this.tweens.killTweensOf(this.hudText);

    this.hudFadeTimer = this.time.delayedCall(duration, () => {
      this.tweens.add({ targets: [this.hudBg, this.hudText], alpha: 0, duration: 800 });
    });
  }

  /**
   * Show location info in the HUD bar only when it's actionable
   * (e.g. [SPACE] prompts, entering a new zone). Plain terrain is suppressed.
   */
  private showLocationInfo(): void {
    const text = this.getLocationString();
    if (!text) return;

    // Only show the HUD bar for actionable prompts (e.g. [SPACE] Enter/Open/Exit)
    const isActionable = text.includes("[SPACE]");
    if (!isActionable) return;
    if (text === this.lastLocationStr) return;
    this.lastLocationStr = text;

    // Show the right location text
    this.locationText.setText(text);
    this.locationText.setAlpha(1);
    this.hudBg.setAlpha(1);

    // Cancel previous fade
    if (this.hudFadeTimer) this.hudFadeTimer.remove();
    this.tweens.killTweensOf(this.hudBg);
    this.tweens.killTweensOf(this.hudText);
    this.tweens.killTweensOf(this.locationText);

    this.hudFadeTimer = this.time.delayedCall(3000, () => {
      this.tweens.add({ targets: [this.hudBg, this.hudText, this.locationText], alpha: 0, duration: 800 });
    });
  }

  /** Build the HUD info text for the current position — kept for menu. */
  getHUDInfo(): string {
    const p = this.player;
    let regionName: string;
    if (p.position.inDungeon) {
      const dungeon = getDungeon(p.position.dungeonId);
      regionName = dungeon ? `🔻 ${dungeon.name}` : "Dungeon";
    } else if (p.position.inCity) {
      const city = getCity(p.position.cityId);
      regionName = city ? `🏘 ${city.name}` : "City";
    } else {
      const chunk = getChunk(p.position.chunkX, p.position.chunkY);
      regionName = chunk?.name ?? "Unknown";
    }
    const timeLabel = p.position.inDungeon ? PERIOD_LABEL[TimePeriod.Dungeon] : PERIOD_LABEL[getTimePeriod(this.timeStep)];
    const weatherLabel = WEATHER_LABEL[this.weatherState.current];
    const mountLabel = (p.mountId && !p.position.inDungeon && !p.position.inCity)
      ? `  🐴 ${getMount(p.mountId)?.name ?? "Mount"}` : "";
    return `${regionName}  ${timeLabel}  ${weatherLabel}${mountLabel}`;
  }

  private updateHUD(): void {
    // HUD is now event-driven — no persistent display
  }

  private updateLocationText(): void {
    this.showLocationInfo();
  }

  private getLocationString(): string {
    if (this.player.position.inDungeon) {
      const dungeon = getDungeon(this.player.position.dungeonId);
      if (!dungeon) return "???";
      const terrain = dungeon.mapData[this.player.position.y]?.[this.player.position.x];
      if (terrain === Terrain.DungeonExit) return `${dungeon.name}  [SPACE] Exit`;
      if (terrain === Terrain.Chest) {
        const chest = getChestAt(this.player.position.x, this.player.position.y, { type: "dungeon", dungeonId: this.player.position.dungeonId });
        return (chest && !this.player.progression.openedChests.includes(chest.id))
          ? "Treasure Chest  [SPACE] Open" : "Opened Chest";
      }
      return dungeon.name;
    }

    if (this.player.position.inCity) {
      const city = getCity(this.player.position.cityId);
      if (!city) return "???";
      const terrain = city.mapData[this.player.position.y]?.[this.player.position.x];
      if (terrain === Terrain.CityExit) return `${city.name}  [SPACE] Leave`;
      const shop = getCityShopNearby(city, this.player.position.x, this.player.position.y);
      return shop ? shop.name : city.name;
    }

    const terrain = getTerrainAt(this.player.position.chunkX, this.player.position.chunkY, this.player.position.x, this.player.position.y);
    const chunk = getChunk(this.player.position.chunkX, this.player.position.chunkY);
    const town = chunk?.towns.find(
      (t) => t.x === this.player.position.x && t.y === this.player.position.y,
    );
    const boss = chunk?.bosses.find(
      (b) => b.x === this.player.position.x && b.y === this.player.position.y,
    );

    let locStr = TERRAIN_DISPLAY_NAMES[terrain ?? 0] ?? "Unknown";
    if (town) {
      const city = getCityForTown(this.player.position.chunkX, this.player.position.chunkY, town.x, town.y);
      locStr = city ? `${town.name}  [SPACE] Enter` : `${town.name}  [SPACE] Shop`;
    }
    if (boss && !this.defeatedBosses.has(boss.monsterId)) {
      locStr = `${boss.name}'s Lair  [SPACE] Challenge`;
    }
    if (terrain === Terrain.Dungeon) {
      const dungeon = getDungeonAt(this.player.position.chunkX, this.player.position.chunkY, this.player.position.x, this.player.position.y);
      if (dungeon) {
        const hasKey = this.player.inventory.some((i) => i.id === "dungeonKey");
        locStr = (hasKey || isDebug())
          ? `${dungeon.name}  [SPACE] Enter Dungeon`
          : `${dungeon.name}  (Locked — need key)`;
      }
    }
    if (terrain === Terrain.Chest) {
      const chest = getChestAt(this.player.position.x, this.player.position.y, { type: "overworld", chunkX: this.player.position.chunkX, chunkY: this.player.position.chunkY });
      locStr = (chest && !this.player.progression.openedChests.includes(chest.id))
        ? "Treasure Chest  [SPACE] Open" : "Opened Chest";
    }

    return locStr;
  }

  private updateDebugPanel(): void {
    const p = this.player;
    let terrain: Terrain | undefined;
    if (p.position.inDungeon) {
      const dungeon = getDungeon(p.position.dungeonId);
      terrain = dungeon?.mapData[p.position.y]?.[p.position.x];
    } else {
      terrain = getTerrainAt(p.position.chunkX, p.position.chunkY, p.position.x, p.position.y);
    }

    const tName = TERRAIN_DEBUG_NAMES[terrain ?? 0] ?? "?";
    const rate = terrain !== undefined ? (ENCOUNTER_RATES[terrain] ?? 0) : 0;
    const encMult = getEncounterMultiplier(this.timeStep);
    const weatherEncMult = getWeatherEncounterMultiplier(this.weatherState.current);
    const mountEncMult = (!p.position.inDungeon && p.mountId) ? (getMount(p.mountId)?.encounterMultiplier ?? 1) : 1;
    const effectiveRate = rate * encMult * weatherEncMult * mountEncMult;
    const dungeonTag = p.position.inDungeon ? ` [DUNGEON:${p.position.dungeonId}]` : "";
    const mountTag = p.mountId ? ` [MOUNT:${p.mountId}]` : "";
    const timePeriod = getTimePeriod(this.timeStep);
    debugPanelState(
      `OVERWORLD | Chunk: (${p.position.chunkX},${p.position.chunkY}) Pos: (${p.position.x},${p.position.y}) ${tName}${dungeonTag}${mountTag} | ` +
      `Time: ${timePeriod} (step ${this.timeStep}) | Weather: ${this.weatherState.current} (${this.weatherState.stepsUntilChange} steps) | ` +
      `Enc: ${(effectiveRate * 100).toFixed(0)}% (×${encMult}×${weatherEncMult}${mountEncMult !== 1 ? `×${mountEncMult}` : ""})${this.encounterSystem.areEncountersEnabled() ? "" : " [OFF]"}${this.fogOfWar.isFogDisabled() ? " Fog[OFF]" : ""} | ` +
      `Bosses: ${this.defeatedBosses.size} | Chests: ${p.progression.openedChests.length}`,
    );
  }

  // ── Overlay & dialogue state ────────────────────────────────────────────

  private isOverlayOpen(): boolean {
    return this.overlayManager.isOpen();
  }

  // ── Player movement ─────────────────────────────────────────────────────

  private tweenPlayerTo(tileX: number, tileY: number, duration: number, onComplete: () => void): void {
    const destX = tileX * TILE_SIZE + TILE_SIZE / 2;
    const destY = tileY * TILE_SIZE + TILE_SIZE / 2;
    const mounted = !!this.playerRenderer.mountSprite;
    const flipped = this.playerRenderer.playerSprite.flipX;
    const riderOffX = flipped ? -PlayerRenderer.riderOffsetX : PlayerRenderer.riderOffsetX;

    this.tweens.add({
      targets: this.playerRenderer.playerSprite,
      x: destX + (mounted ? riderOffX : 0),
      y: destY - (mounted ? PlayerRenderer.riderOffsetY : 0),
      duration,
      onComplete,
    });

    if (this.playerRenderer.mountSprite) {
      this.tweens.add({
        targets: this.playerRenderer.mountSprite,
        x: destX,
        y: destY,
        duration,
      });
    }
  }

  private getEffectiveMoveDelay(): number {
    if (this.player.position.inDungeon || this.player.position.inCity || !this.player.mountId) {
      return this.moveDelay;
    }
    const mount = getMount(this.player.mountId);
    if (!mount) return this.moveDelay;
    return Math.round(this.moveDelay / mount.speedMultiplier);
  }

  update(time: number): void {
    this.updateDebugPanel();

    // SPACE actions must be processed even when overlays/dialogue are open
    // so the player can dismiss dialogues, inn confirmations, etc.
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) {
      this.handleAction();
      return;
    }

    if (this.isMoving) return;
    if (this.isOverlayOpen()) return;
    if (time - this.lastMoveTime < this.getEffectiveMoveDelay()) return;

    let dx = 0;
    let dy = 0;
    if (this.keys.W.isDown) dy = -1;
    else if (this.keys.S.isDown) dy = 1;
    else if (this.keys.A.isDown) dx = -1;
    else if (this.keys.D.isDown) dx = 1;

    if (dx !== 0 || dy !== 0) this.tryMove(dx, dy, time);
  }

  private tryMove(dx: number, dy: number, time: number): void {
    const newX = this.player.position.x + dx;
    const newY = this.player.position.y + dy;

    // Update sprite facing direction based on horizontal movement
    if (dx !== 0) {
      const faceLeft = dx < 0;
      this.playerRenderer.playerSprite.setFlipX(faceLeft);
      if (this.playerRenderer.mountSprite) {
        this.playerRenderer.mountSprite.setFlipX(faceLeft);
      }
    }

    // Update front/back/side facing based on movement direction
    this.playerRenderer.setFacingDirection(dx, dy, this.player);

    // ── Dungeon movement ──
    if (this.player.position.inDungeon) {
      const dungeon = getDungeon(this.player.position.dungeonId);
      if (!dungeon) return;
      if (newX < 0 || newX >= MAP_WIDTH || newY < 0 || newY >= MAP_HEIGHT) return;
      const terrain = dungeon.mapData[newY][newX];
      if (!isWalkable(terrain)) return;

      this.lastMoveTime = time;
      this.isMoving = true;
      this.player.position.x = newX;
      this.player.position.y = newY;
      if (audioEngine.initialized) audioEngine.playFootstepSFX(terrain);

      this.tweenPlayerTo(newX, newY, 120, () => {
        this.isMoving = false;
        this.advanceTime();
        this.revealAround();
        this.revealTileSprites();
        this.collectMinorTreasure();
        this.updateHUD();
        this.updateLocationText();
        this.checkEncounter(terrain);
      });
      return;
    }

    // ── City movement ──
    if (this.player.position.inCity) {
      this.dialogueSystem.dismissDialogue();
      this.overlayManager.dismissInnConfirmation();
      this.overlayManager.dismissBankOverlay();

      const city = getCity(this.player.position.cityId);
      if (!city) return;
      const targetX = this.player.position.x + dx;
      const targetY = this.player.position.y + dy;
      if (targetX < 0 || targetX >= MAP_WIDTH || targetY < 0 || targetY >= MAP_HEIGHT) return;
      const targetTerrain = city.mapData[targetY][targetX];
      if (!isWalkable(targetTerrain)) return;

      // Block entry to shops at night (except inn)
      if ((targetTerrain === Terrain.Carpet || targetTerrain === Terrain.ShopFloor) && getTimePeriod(this.timeStep) === TimePeriod.Night) {
        const nearbyShop = getCityShopNearby(city, targetX, targetY);
        if (nearbyShop && nearbyShop.type !== "inn") {
          this.showMessage("The shop is closed for the night. Come back in the morning!", "#ff8888");
          return;
        }
      }

      // Shop interior only accessible via carpet entrance
      if (targetTerrain === Terrain.ShopFloor) {
        const curTerrain = city.mapData[this.player.position.y]?.[this.player.position.x];
        if (curTerrain !== Terrain.Carpet && curTerrain !== Terrain.ShopFloor) return;
      }

      // Shop exit only through carpet (door)
      const curTerrain = city.mapData[this.player.position.y]?.[this.player.position.x];
      if (curTerrain === Terrain.ShopFloor && targetTerrain !== Terrain.ShopFloor && targetTerrain !== Terrain.Carpet) return;

      this.lastMoveTime = time;
      this.isMoving = true;
      this.player.position.x = newX;
      this.player.position.y = newY;
      if (audioEngine.initialized) audioEngine.playFootstepSFX(targetTerrain);

      this.tweenPlayerTo(newX, newY, 120, () => {
        this.isMoving = false;
        this.advanceTime();
        this.revealAround();
        this.revealTileSprites();
        this.updateHUD();
        this.updateLocationText();
        const city2 = getCity(this.player.position.cityId);
        if (city2) {
          const idx = this.cityRenderer.getPlayerShopIndex(city2, this.player.position.x, this.player.position.y);
          this.cityRenderer.updateShopRoofAlpha(idx);
        }
      });
      return;
    }

    // ── Overworld movement ──
    this.dialogueSystem.dismissDialogue();

    const result = tryGridMove(this.player, dx, dy);
    if (!result.moved) {
      debugLog("Blocked move", { dx, dy });
      return;
    }

    this.lastMoveTime = time;
    this.isMoving = true;

    if (result.chunkChanged) {
      this.advanceTime();
      this.rerollWeather();
      this.cameras.main.flash(200, 255, 255, 255);
      this.scene.restart({
        player: this.player,
        defeatedBosses: this.defeatedBosses,
        codex: this.codex,
        timeStep: this.timeStep,
        weatherState: this.weatherState,
      });
      return;
    }

    if (audioEngine.initialized && result.newTerrain !== undefined) {
      if (!this.player.position.inDungeon && !this.player.position.inCity && this.player.mountId) {
        audioEngine.playMountedFootstepSFX();
      } else {
        audioEngine.playFootstepSFX(result.newTerrain);
      }
    }

    this.tweenPlayerTo(this.player.position.x, this.player.position.y, 120, () => {
      this.isMoving = false;
      this.advanceTime();
      this.revealAround();
      this.revealTileSprites();
      if (!this.player.position.inCity) this.collectMinorTreasure();
      this.updateHUD();
      this.updateLocationText();
      if (this.player.position.inCity) {
        const city = getCity(this.player.position.cityId);
        if (city) {
          const idx = this.cityRenderer.getPlayerShopIndex(city, this.player.position.x, this.player.position.y);
          this.cityRenderer.updateShopRoofAlpha(idx);
        }
      } else {
        this.checkEncounter(result.newTerrain!);
      }
    });
  }

  // ── Encounters & treasure ───────────────────────────────────────────────

  private collectMinorTreasure(): void {
    const px = this.player.position.x;
    const py = this.player.position.y;
    if (this.player.position.inDungeon) return;
    if (!hasSparkleAt(this.player.position.chunkX, this.player.position.chunkY, px, py)) return;

    const key = `${this.player.position.chunkX},${this.player.position.chunkY},${px},${py}`;
    if (this.player.progression.collectedTreasures.includes(key)) return;

    this.player.progression.collectedTreasures.push(key);
    const goldAmount = 5 + Math.floor(Math.random() * 21);
    this.player.gold += goldAmount;

    const terrain = getTerrainAt(this.player.position.chunkX, this.player.position.chunkY, px, py);
    if (this.mapRenderer.tileSprites[py]?.[px] && terrain !== undefined) {
      const realTexKey = terrain === Terrain.Town
        ? `tile_town_${getTownBiome(this.player.position.chunkX, this.player.position.chunkY, px, py)}`
        : `tile_${terrain}`;
      this.mapRenderer.tileSprites[py][px].setTexture(realTexKey);
    }

    this.showMessage(`✨ Found ${goldAmount} gold!`, "#4fc3f7");
    this.updateHUD();
  }

  private checkEncounter(terrain: Terrain): void {
    this.autoSave();
    if (terrain === Terrain.Boss || terrain === Terrain.Town || terrain === Terrain.DungeonExit || terrain === Terrain.Chest) return;
    if (isDebug() && !this.encounterSystem.areEncountersEnabled()) return;

    const mountEncMult = (!this.player.position.inDungeon && this.player.mountId)
      ? (getMount(this.player.mountId)?.encounterMultiplier ?? 1) : 1;
    const rate = ENCOUNTER_RATES[terrain] * getEncounterMultiplier(this.timeStep) * getWeatherEncounterMultiplier(this.weatherState.current) * mountEncMult;

    if (Math.random() < rate) {
      let monster;
      if (this.player.position.inDungeon) {
        monster = getDungeonEncounter(this.player.level, this.player.position.dungeonId);
      } else if (isNightTime(this.timeStep) && Math.random() < 0.4) {
        const chunk = getChunk(this.player.position.chunkX, this.player.position.chunkY);
        monster = getNightEncounter(this.player.level, chunk?.name);
      } else {
        monster = getRandomEncounter(this.player.level);
      }
      debugLog("Encounter!", { terrain: Terrain[terrain], rate, monster: monster.name, inDungeon: this.player.position.inDungeon, time: getTimePeriod(this.timeStep) });
      debugPanelLog(`[ENC] ${monster.name} appeared! (${(rate * 100).toFixed(0)}% chance)`, true);
      this.startBattle(monster, terrain);
    }
  }

  /** Evac: teleport player to the dungeon entrance (used by Evac ability). */
  private evacuateDungeon(): void {
    if (!this.player.position.inDungeon) return;
    const dungeon = getDungeon(this.player.position.dungeonId);
    if (!dungeon) return;
    this.player.position.inDungeon = false;
    this.player.position.dungeonId = "";
    this.player.position.chunkX = dungeon.entranceChunkX;
    this.player.position.chunkY = dungeon.entranceChunkY;
    this.player.position.x = dungeon.entranceTileX;
    this.player.position.y = dungeon.entranceTileY;
    this.rerollWeather();
    this.autoSave();
    this.cameras.main.flash(300, 200, 255, 200);
    this.scene.restart({
      player: this.player, defeatedBosses: this.defeatedBosses,
      codex: this.codex, timeStep: this.timeStep, weatherState: this.weatherState,
    });
  }

  // ── SPACE action handler ────────────────────────────────────────────────

  private handleAction(): void {
    // ── Dungeon ──
    if (this.player.position.inDungeon) {
      const dungeon = getDungeon(this.player.position.dungeonId);
      if (!dungeon) return;
      const terrain = dungeon.mapData[this.player.position.y]?.[this.player.position.x];

      if (terrain === Terrain.DungeonExit) {
        this.player.position.inDungeon = false;
        this.player.position.dungeonId = "";
        this.player.position.chunkX = dungeon.entranceChunkX;
        this.player.position.chunkY = dungeon.entranceChunkY;
        this.player.position.x = dungeon.entranceTileX;
        this.player.position.y = dungeon.entranceTileY;
        this.rerollWeather();
        this.autoSave();
        this.cameras.main.flash(300, 255, 255, 255);
        this.scene.restart({
          player: this.player, defeatedBosses: this.defeatedBosses,
          codex: this.codex, timeStep: this.timeStep, weatherState: this.weatherState,
        });
        return;
      }

      if (terrain === Terrain.Chest) {
        this.openChest({ type: "dungeon", dungeonId: this.player.position.dungeonId });
        return;
      }
      return;
    }

    // ── City ──
    if (this.player.position.inCity) {
      if (this.dialogueSystem.isDialogueOpen()) { this.dialogueSystem.dismissDialogue(); return; }
      if (this.overlayManager.innConfirmOverlay) { this.overlayManager.dismissInnConfirmation(); return; }
      if (this.overlayManager.bankOverlay) { this.overlayManager.dismissBankOverlay(); return; }

      const city = getCity(this.player.position.cityId);
      if (!city) return;
      const terrain = city.mapData[this.player.position.y]?.[this.player.position.x];

      if (terrain === Terrain.CityExit) {
        this.player.position.inCity = false;
        this.player.position.cityId = "";
        this.player.position.chunkX = city.chunkX;
        this.player.position.chunkY = city.chunkY;
        this.player.position.x = city.tileX;
        this.player.position.y = city.tileY;
        this.rerollWeather();
        this.autoSave();
        this.cameras.main.flash(300, 255, 255, 255);
        this.scene.restart({
          player: this.player, defeatedBosses: this.defeatedBosses,
          codex: this.codex, timeStep: this.timeStep, weatherState: this.weatherState,
        });
        return;
      }

      // NPC interaction
      const npcResult = findAdjacentNpc(city, this.player.position.x, this.player.position.y, this.cityRenderer);
      if (npcResult) {
        const { npcDef, npcIndex } = npcResult;
        if (npcDef.shopIndex !== undefined) {
          const shop = city.shops[npcDef.shopIndex];
          if (shop) {
            if (shop.type === "inn") {
              this.dialogueSystem.showNpcDialogue(npcDef, npcIndex, city, this.timeStep);
              this.time.delayedCall(300, () => {
                this.dialogueSystem.dismissDialogue();
                this.overlayManager.showInnConfirmation(this.player);
              });
              return;
            }
            if (getTimePeriod(this.timeStep) === TimePeriod.Night) {
              this.showMessage("The shop is closed for the night. Come back in the morning!", "#ff8888");
              return;
            }
            if (shop.type === "bank") {
              this.dialogueSystem.showNpcDialogue(npcDef, npcIndex, city, this.timeStep);
              this.time.delayedCall(800, () => {
                this.dialogueSystem.dismissDialogue();
                this.overlayManager.showBankOverlay(this.player);
              });
              return;
            }
            this.dialogueSystem.showNpcDialogue(npcDef, npcIndex, city, this.timeStep);
            this.time.delayedCall(800, () => {
              this.dialogueSystem.dismissDialogue();
              this.autoSave();
              this.scene.start("ShopScene", {
                player: this.player,
                townName: `${city.name} - ${shop.name}`,
                defeatedBosses: this.defeatedBosses,
                codex: this.codex,
                shopItemIds: shop.shopItems,
                timeStep: this.timeStep,
                weatherState: this.weatherState,
                fromCity: true,
                cityId: city.id,
              });
            });
            return;
          }
        }
        this.dialogueSystem.showNpcDialogue(npcDef, npcIndex, city, this.timeStep);
        return;
      }

      // Animal interaction
      const animalResult = findAdjacentAnimal(this.player.position.x, this.player.position.y, this.cityRenderer.cityAnimals);
      if (animalResult) {
        this.dialogueSystem.showAnimalDialogue(animalResult.spriteName);
        return;
      }
      return;
    }

    // ── Overworld ──
    const chunk = getChunk(this.player.position.chunkX, this.player.position.chunkY);
    if (!chunk) return;

    if (this.dialogueSystem.isDialogueOpen()) { this.dialogueSystem.dismissDialogue(); return; }

    // Special NPC interaction
    const specialResult = this.specialNpcManager.findAdjacentSpecialNpc(this.player.position.x, this.player.position.y);
    if (specialResult) {
      const regionName = chunk.name ?? "Overworld";
      const callbacks: SpecialNpcCallbacks = {
        autoSave: () => this.autoSave(),
        startShopScene: (config) => {
          this.scene.start("ShopScene", {
            player: this.player,
            townName: config.townName,
            defeatedBosses: this.defeatedBosses,
            codex: this.codex,
            shopItemIds: config.shopItemIds,
            timeStep: this.timeStep,
            weatherState: this.weatherState,
            discount: config.discount,
            savedSpecialNpcs: config.savedSpecialNpcs,
          });
        },
      };
      this.specialNpcManager.interactSpecialNpc(specialResult.index, this.dialogueSystem, callbacks, regionName);
      return;
    }

    // Town entry
    const town = chunk.towns.find(
      (t) => t.x === this.player.position.x && t.y === this.player.position.y,
    );
    if (town?.hasShop) {
      this.player.lastTownX = town.x;
      this.player.lastTownY = town.y;
      this.player.lastTownChunkX = this.player.position.chunkX;
      this.player.lastTownChunkY = this.player.position.chunkY;

      const city = getCityForTown(this.player.position.chunkX, this.player.position.chunkY, town.x, town.y);
      if (city) {
        if (this.player.mountId) this.player.mountId = "";
        this.player.position.inCity = true;
        this.player.position.cityId = city.id;
        debugPanelLog(`[CITY] Entered ${city.name}`, true);
        this.player.position.x = city.spawnX;
        this.player.position.y = city.spawnY;
        this.weatherState.current = WeatherType.Clear;
        for (let ty = 0; ty < MAP_HEIGHT; ty++) {
          for (let tx = 0; tx < MAP_WIDTH; tx++) {
            this.player.progression.exploredTiles[`c:${city.id},${tx},${ty}`] = true;
          }
        }
        this.autoSave();
        this.cameras.main.flash(300, 200, 180, 160);
        this.scene.restart({
          player: this.player, defeatedBosses: this.defeatedBosses,
          codex: this.codex, timeStep: this.timeStep, weatherState: this.weatherState,
        });
        return;
      }

      // No city layout — open shop directly (legacy)
      if (this.player.mountId) this.player.mountId = "";
      this.rerollWeather();
      this.autoSave();
      this.scene.start("ShopScene", {
        player: this.player, townName: town.name,
        defeatedBosses: this.defeatedBosses, codex: this.codex,
        shopItemIds: town.shopItems, timeStep: this.timeStep,
        weatherState: this.weatherState,
        savedSpecialNpcs: this.specialNpcManager.snapshotSpecialNpcs(),
      });
      return;
    }

    // Dungeon entry
    const terrain = getTerrainAt(this.player.position.chunkX, this.player.position.chunkY, this.player.position.x, this.player.position.y);
    if (terrain === Terrain.Dungeon) {
      const dungeon = getDungeonAt(this.player.position.chunkX, this.player.position.chunkY, this.player.position.x, this.player.position.y);
      if (dungeon) {
        const hasKey = this.player.inventory.some((i) => i.id === "dungeonKey");
        if (hasKey || isDebug()) {
          // Consume the dungeon key on first use
          if (hasKey) {
            const keyIdx = this.player.inventory.findIndex((i) => i.id === "dungeonKey");
            if (keyIdx >= 0) {
              this.player.inventory.splice(keyIdx, 1);
              this.showMessage("The dungeon key shatters as the seal breaks!", "#ffd700");
            }
          }
          if (this.player.mountId) this.player.mountId = "";
          this.player.position.inDungeon = true;
          this.player.position.dungeonId = dungeon.id;
          debugPanelLog(`[DUNGEON] Entered ${dungeon.name}`, true);
          this.player.position.x = dungeon.spawnX;
          this.player.position.y = dungeon.spawnY;
          this.weatherState.current = WeatherType.Clear;
          if (audioEngine.initialized) audioEngine.playDungeonEnterSFX();
          this.autoSave();
          this.cameras.main.flash(300, 100, 100, 100);
          this.scene.restart({
            player: this.player, defeatedBosses: this.defeatedBosses,
            codex: this.codex, timeStep: this.timeStep, weatherState: this.weatherState,
          });
        }
      }
      return;
    }

    // Overworld chest
    if (terrain === Terrain.Chest) {
      this.openChest({ type: "overworld", chunkX: this.player.position.chunkX, chunkY: this.player.position.chunkY });
      return;
    }

    // Boss tile
    const boss = chunk.bosses.find(
      (b) => b.x === this.player.position.x && b.y === this.player.position.y,
    );
    if (boss && !this.defeatedBosses.has(boss.monsterId)) {
      const monster = getBoss(boss.monsterId);
      if (monster) this.startBattle(monster, Terrain.Boss);
    }
  }

  // ── Shared chest opening logic ──────────────────────────────────────────

  private openChest(location: { type: "dungeon"; dungeonId: string } | { type: "overworld"; chunkX: number; chunkY: number }): void {
    const chest = getChestAt(this.player.position.x, this.player.position.y, location);
    if (!chest) return;
    if (this.player.progression.openedChests.includes(chest.id)) {
      this.showMessage("Already opened.", "#666666");
      return;
    }
    const item = getItem(chest.itemId);
    if (!item) return;

    this.player.progression.openedChests.push(chest.id);
    this.player.inventory.push({ ...item });
    if (audioEngine.initialized) audioEngine.playChestOpenSFX();

    // Auto-equip if better
    if (item.type === "weapon" && (!this.player.equippedWeapon || item.effect > this.player.equippedWeapon.effect)) {
      this.player.equippedWeapon = item;
      if (item.twoHanded) { this.player.equippedShield = null; this.player.equippedOffHand = null; }
      if (!isLightWeapon(item)) { this.player.equippedOffHand = null; }
      this.playerRenderer.refreshPlayerSprite(this.player);
    }
    if (item.type === "armor" && (!this.player.equippedArmor || item.effect > this.player.equippedArmor.effect)) {
      this.player.equippedArmor = item;
    }
    if (item.type === "shield" && !this.player.equippedWeapon?.twoHanded && (!this.player.equippedShield || item.effect > this.player.equippedShield.effect)) {
      this.player.equippedShield = item;
      this.playerRenderer.refreshPlayerSprite(this.player);
    }

    this.showMessage(`🎁 Found ${item.name}!`);
    this.updateHUD();
    this.autoSave();
  }

  // ── Mount toggle ────────────────────────────────────────────────────────

  private toggleMount(): void {
    if (this.isOverlayOpen()) return;
    if (this.player.position.inDungeon || this.player.position.inCity) {
      this.showMessage("Cannot ride mounts here.", "#ff6666");
      return;
    }

    if (this.player.mountId) {
      const mount = getMount(this.player.mountId);
      this.player.mountId = "";
      this.createPlayerSprite();
      this.updateHUD();
      this.showMessage(`Dismounted${mount ? ` ${mount.name}` : ""}.`);
    } else {
      const ownedMounts = this.player.inventory.filter((i) => i.type === "mount" && i.mountId);
      if (ownedMounts.length === 0) {
        this.showMessage("No mount owned. Visit a stable!", "#ff6666");
        return;
      }
      let bestItem = ownedMounts[0];
      let bestSpeed = getMount(bestItem.mountId!)?.speedMultiplier ?? 0;
      for (let i = 1; i < ownedMounts.length; i++) {
        const md = getMount(ownedMounts[i].mountId!);
        if (md && md.speedMultiplier > bestSpeed) {
          bestSpeed = md.speedMultiplier;
          bestItem = ownedMounts[i];
        }
      }
      this.player.mountId = bestItem.mountId!;
      const mount = getMount(this.player.mountId);
      this.createPlayerSprite();
      this.updateHUD();
      this.showMessage(`🐴 Mounted ${mount?.name ?? "mount"}!`, "#88ff88");
    }
  }

  // ── Delegation helpers ──────────────────────────────────────────────────

  private renderMap(): void {
    this.cityRenderer.clearAll();
    this.specialNpcManager.clearAll();
    this.mapRenderer.renderMap(
      this.player,
      this.defeatedBosses,
      (x, y) => this.fogOfWar.isExplored(x, y, this.player),
      this.cityRenderer,
      this.timeStep,
    );
    // Spawn special NPCs on overworld (not in city/dungeon)
    if (!this.player.position.inDungeon && !this.player.position.inCity) {
      const chunk = getChunk(this.player.position.chunkX, this.player.position.chunkY);
      if (chunk) this.spawnSpecialNpcs(chunk);
    }
  }

  private spawnSpecialNpcs(chunk: WorldChunk): void {
    this.specialNpcManager.spawnSpecialNpcs(
      chunk,
      this.timeStep,
      this.cityRenderer,
      (text, color) => this.showMessage(text, color),
      (x, y) => this.fogOfWar.isExplored(x, y, this.player),
    );
  }

  private applyDayNightTint(): void {
    this.mapRenderer.applyDayNightTint(this.player, this.timeStep, this.weatherState);
  }

  private createPlayerSprite(): void {
    this.playerRenderer.createPlayer(this.player);
    this.playerRenderer.refreshPlayerSprite(this.player);
  }

  private showMessage(text: string, color = "#ffd700"): void {
    this.showHUDMessage(text, color);
  }

  private revealAround(radius = 2): void {
    this.fogOfWar.revealAround(this.player.position.x, this.player.position.y, radius, this.player);
    this.player.progression.exploredTiles = this.fogOfWar.getExploredTiles();
  }

  private revealTileSprites(): void {
    this.mapRenderer.revealTileSprites(
      this.player,
      (x, y) => this.fogOfWar.isExplored(x, y, this.player),
      (city) => this.cityRenderer.getPlayerShopIndex(city, this.player.position.x, this.player.position.y),
      this.cityRenderer.shopFloorMap,
    );
  }

  // ── Battle / codex / save ───────────────────────────────────────────────

  private terrainToBiome(terrain?: Terrain): string {
    if (this.player.position.inDungeon) return "dungeon";
    switch (terrain) {
      case Terrain.Forest: return "forest";
      case Terrain.DeepForest: return "deep_forest";
      case Terrain.Sand: case Terrain.Cactus: return "sand";
      case Terrain.Tundra: return "tundra";
      case Terrain.Swamp: case Terrain.Mushroom: return "swamp";
      case Terrain.Volcanic: case Terrain.Geyser: return "volcanic";
      case Terrain.Canyon: return "canyon";
      default: return "grass";
    }
  }

  private startBattle(monster: ReturnType<typeof getRandomEncounter>, terrain?: Terrain): void {
    this.autoSave();
    debugPanelLog(`[BATTLE] Fighting ${monster.name} (HP:${monster.hp} AC:${monster.ac})`, true);
    this.cameras.main.flash(300, 255, 255, 255);
    this.time.delayedCall(300, () => {
      this.scene.start("BattleScene", {
        player: this.player, monster,
        defeatedBosses: this.defeatedBosses, codex: this.codex,
        timeStep: this.timeStep, weatherState: this.weatherState,
        biome: this.terrainToBiome(terrain),
        savedSpecialNpcs: this.specialNpcManager.snapshotSpecialNpcs(),
      });
    });
  }

  private openCodex(): void {
    this.overlayManager.destroyAll();
    this.autoSave();
    this.scene.start("CodexScene", {
      player: this.player,
      defeatedBosses: this.defeatedBosses,
      codex: this.codex,
      timeStep: this.timeStep,
      weatherState: this.weatherState,
      savedSpecialNpcs: this.specialNpcManager.snapshotSpecialNpcs(),
    });
  }

  private autoSave(): void {
    saveGame(this.player, this.defeatedBosses, this.codex, this.player.appearanceId, this.timeStep, this.weatherState);
  }

  // ── Time, weather & audio ───────────────────────────────────────────────

  private advanceTime(): void {
    if (this.player.position.inCity || this.player.position.inDungeon) return;

    const oldPeriod = getTimePeriod(this.timeStep);
    this.timeStep = (this.timeStep + 1) % CYCLE_LENGTH;
    const newPeriod = getTimePeriod(this.timeStep);

    const biomeName = getChunk(this.player.position.chunkX, this.player.position.chunkY)?.name ?? "Heartlands";
    const weatherChanged = advanceWeather(this.weatherState, biomeName, this.timeStep);

    if (oldPeriod !== newPeriod || weatherChanged) {
      this.applyDayNightTint();
      if (weatherChanged) this.mapRenderer.updateWeatherParticles(this.weatherState);
      this.updateAudio();
    }
  }

  private rerollWeather(): void {
    const biomeName = getChunk(this.player.position.chunkX, this.player.position.chunkY)?.name ?? "Heartlands";
    const weatherChanged = changeZoneWeather(this.weatherState, biomeName, this.timeStep);
    if (weatherChanged) {
      this.applyDayNightTint();
      this.mapRenderer.updateWeatherParticles(this.weatherState);
      this.updateAudio();
    }
  }

  private updateAudio(): void {
    if (!audioEngine.initialized) return;
    const chunk = getChunk(this.player.position.chunkX, this.player.position.chunkY);
    const biomeName = chunk?.name ?? "Heartlands";
    const period = getTimePeriod(this.timeStep);
    audioEngine.playBiomeMusic(biomeName, period);
    audioEngine.playWeatherSFX(this.weatherState.current);
  }
}
