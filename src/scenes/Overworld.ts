/**
 * Overworld scene: tile-based map with WASD movement and encounters.
 */

import Phaser from "phaser";
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
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
  getCityShopNearby,
  getInnCost,
  getTownBiome,
  hasSparkleAt,
  type WorldChunk,
  type CityData,
} from "../data/map";
import { getRandomEncounter, getDungeonEncounter, getBoss, getNightEncounter, ALL_MONSTERS, MONSTERS, DUNGEON_MONSTERS, NIGHT_MONSTERS, type Monster } from "../data/monsters";
import { createPlayer, getArmorClass, awardXP, processPendingLevelUps, xpForLevel, allocateStatPoint, applyBankInterest, castSpellOutsideCombat, useAbilityOutsideCombat, useItem, isLightWeapon, canDualWield, equipOffHand, type PlayerState, type PlayerStats } from "../systems/player";
import { abilityModifier } from "../systems/dice";
import { getPlayerClass, getActiveWeaponSprite } from "../systems/classes";
import { isDebug, debugLog, debugPanelLog, debugPanelState } from "../config";
import type { BestiaryData } from "../systems/codex";
import { createBestiary, recordDefeat } from "../systems/codex";
import { saveGame } from "../systems/save";
import { getItem, ITEMS } from "../data/items";
import { getTimePeriod, getEncounterMultiplier, isNightTime, TimePeriod, PERIOD_TINT, PERIOD_LABEL, CYCLE_LENGTH } from "../systems/daynight";
import { registerSharedHotkeys, buildSharedCommands, registerCommandRouter, SHARED_HELP, type HelpEntry } from "../systems/debug";
import {
  type WeatherState,
  WeatherType,
  createWeatherState,
  advanceWeather,
  changeZoneWeather,
  getWeatherEncounterMultiplier,
  WEATHER_TINT,
  WEATHER_LABEL,
} from "../systems/weather";
import { audioEngine } from "../systems/audio";
import { getMount } from "../data/mounts";
import {
  CITY_NPCS,
  getNpcTemplate,
  getNpcColors,
  getNpcDialogue,
  getShopkeeperDialogue,
  getSpecialNpcDialogue,
  rollSpecialNpcSpawns,
  SPECIAL_NPC_DEFS,
  SPECIAL_NPC_FAREWELLS,
  ANIMAL_DIALOGUES,
  NPC_SKIN_COLORS,
  type NpcInstance,
  type NpcTemplate,
  type SavedSpecialNpc,
  type SpecialNpcKind,
  type SpecialNpcDef,
} from "../data/npcs";
import { getSpell } from "../data/spells";
import { getAbility } from "../data/abilities";
import { FogOfWar } from "../managers/fog";
import { EncounterSystem } from "../systems/encounter";
import { HUDRenderer } from "../renderers/hud";
import { tryGridMove } from "../systems/movement";

const TILE_SIZE = 32;

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
  private equipPage: "gear" | "skills" | "items" = "gear";
  /** Mini-page indices for gear slot lists (weapons, armor, shields). */
  private gearWeaponPage = 0;
  private gearOffHandPage = 0;
  private gearArmorPage = 0;
  private gearShieldPage = 0;
  private gearMountPage = 0;
  private itemsPage = 0;
  private spellsPage = 0;
  private abilitiesPage = 0;
  private statOverlay: Phaser.GameObjects.Container | null = null;
  private menuOverlay: Phaser.GameObjects.Container | null = null;
  private worldMapOverlay: Phaser.GameObjects.Container | null = null;
  private settingsOverlay: Phaser.GameObjects.Container | null = null;
  private isNewPlayer = false;
  private messageText: Phaser.GameObjects.Text | null = null;
  private timeStep = 0; // day/night cycle step counter
  private weatherState: WeatherState = createWeatherState();
  private weatherParticles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private stormLightningTimer: Phaser.Time.TimerEvent | null = null;
  private biomeDecoEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private cityAnimals: Phaser.GameObjects.Sprite[] = [];
  private cityAnimalTimers: Phaser.Time.TimerEvent[] = [];
  private cityNpcSprites: Phaser.GameObjects.Sprite[] = [];
  private cityNpcTimers: Phaser.Time.TimerEvent[] = [];
  private cityNpcData: NpcInstance[] = [];
  private shopRoofGraphics: Phaser.GameObjects.Graphics[] = [];
  private shopRoofBounds: { x: number; y: number; w: number; h: number; shopX: number; shopY: number; shopIdx: number }[] = [];
  /** Maps "x,y" → shop index for ShopFloor tiles so we know which shop each floor tile belongs to. */
  private shopFloorMap: Map<string, number> = new Map();
  private dialogueOverlay: Phaser.GameObjects.Container | null = null;
  private innConfirmOverlay: Phaser.GameObjects.Container | null = null;
  private bankOverlay: Phaser.GameObjects.Container | null = null;
  private townPickerOverlay: Phaser.GameObjects.Container | null = null;
  /** MP cost to deduct once the player picks a teleport destination. */
  private pendingTeleportCost = 0;
  /** Active special (rare) NPCs in the current city visit. */
  private specialNpcSprites: Phaser.GameObjects.Sprite[] = [];
  private specialNpcTimers: Phaser.Time.TimerEvent[] = [];
  private specialNpcDefs: { def: SpecialNpcDef; x: number; y: number; interactions: number }[] = [];
  /** Queue of special NPC kinds to force-spawn via /spawn command. */
  private pendingSpecialSpawns: SpecialNpcKind[] = [];
  /** Saved special NPC state to restore after scene transitions (battles, shops, etc.). */
  private savedSpecialNpcs: SavedSpecialNpc[] = [];
  /** Day number (timeStep / CYCLE_LENGTH) when a special NPC last spawned naturally.
   *  Spawn chance drops to 0 for the rest of that day, resetting at dawn. */
  private lastSpecialSpawnDay = -1;
  private mountSprite: Phaser.GameObjects.Sprite | null = null;
  
  // Extracted systems
  private fogOfWar!: FogOfWar;
  private encounterSystem!: EncounterSystem;
  private hudRenderer!: HUDRenderer;

  constructor() {
    super({ key: "OverworldScene" });
  }

  init(data?: { player?: PlayerState; defeatedBosses?: Set<string>; bestiary?: BestiaryData; timeStep?: number; weatherState?: WeatherState; savedSpecialNpcs?: SavedSpecialNpc[] }): void {
    // Initialize systems
    this.fogOfWar = new FogOfWar();
    this.encounterSystem = new EncounterSystem();
    this.hudRenderer = new HUDRenderer(this);
    
    if (data?.player) {
      this.player = data.player;
      this.isNewPlayer = false;
      // Load fog of war from player state
      this.fogOfWar.setExploredTiles(this.player.progression.exploredTiles);
    } else {
      this.player = createPlayer("Hero", {
        strength: 10, dexterity: 10, constitution: 10,
        intelligence: 10, wisdom: 10, charisma: 10,
      });
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
    if (data?.savedSpecialNpcs) {
      this.savedSpecialNpcs = data.savedSpecialNpcs;
    } else {
      this.savedSpecialNpcs = [];
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
    if (this.player.position.inDungeon) {
      this.weatherState.current = WeatherType.Clear;
    }

    // Reveal tiles around player on creation (fog of war)
    this.fogOfWar.revealAround(this.player.position.x, this.player.position.y, 2, this.player);

    this.renderMap();
    this.applyDayNightTint();
    this.createPlayer();
    this.refreshPlayerSprite();
    this.setupInput();
    this.createHUD();
    this.setupDebug();
    this.updateLocationText();
    this.updateWeatherParticles();

    // Start audio: biome music + weather SFX
    this.updateAudio();

    // Show rolled stats on new game, or ASI overlay if points are pending
    if (this.isNewPlayer) {
      this.showRolledStatsOverlay();
    } else if (this.player.pendingStatPoints > 0) {
      this.time.delayedCall(400, () => this.showStatOverlay());
    }
  }

  private setupDebug(): void {
    debugPanelLog("── Overworld loaded ──", true);
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
      const newState = !this.encounterSystem.areEncountersEnabled();
      this.encounterSystem.setEncountersEnabled(newState);
      debugLog("CHEAT: Encounters " + (newState ? "ON" : "OFF"));
      debugPanelLog(`[CHEAT] Encounters ${newState ? "ON" : "OFF"}`, true);
    });

    const rKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    rKey.on("down", () => {
      if (!isDebug()) return;
      this.fogOfWar.revealEntireWorld();
      // Sync back to player state
      this.player.progression.exploredTiles = this.fogOfWar.getExploredTiles();
      // Refresh visible tiles and world map overlay
      this.renderMap();
      this.applyDayNightTint();
      this.createPlayer();
      this.refreshWorldMap();
      debugPanelLog(`[CHEAT] Map revealed`, true);
    });

    const vKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.V);
    vKey.on("down", () => {
      if (!isDebug()) return;
      const newState = !this.fogOfWar.isFogDisabled();
      this.fogOfWar.setFogDisabled(newState);
      debugLog("CHEAT: Fog " + (newState ? "OFF" : "ON"));
      debugPanelLog(`[CHEAT] Fog of War ${newState ? "OFF" : "ON"}`, true);
      this.renderMap();
      this.applyDayNightTint();
      this.createPlayer();
    });

    // Slash commands: shared + overworld-specific
    const cmds = buildSharedCommands(this.player, cb);

    // Overworld-only commands
    cmds.set("reveal", () => {
      this.fogOfWar.revealEntireWorld();
      // Sync back to player state
      this.player.progression.exploredTiles = this.fogOfWar.getExploredTiles();
      // Refresh visible tiles and world map overlay
      this.renderMap();
      this.applyDayNightTint();
      this.createPlayer();
      this.refreshWorldMap();
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
      const arg = args.trim().toLowerCase();
      let targetLevel: number;
      if (arg === "max") {
        targetLevel = 20;
      } else {
        targetLevel = parseInt(arg, 10);
      }
      if (!isNaN(targetLevel) && targetLevel >= 1 && targetLevel <= 20) {
        while (this.player.level + (this.player.pendingLevelUps ?? 0) < targetLevel) {
          const virtualLevel = this.player.level + (this.player.pendingLevelUps ?? 0);
          const needed = xpForLevel(virtualLevel + 1) - this.player.xp;
          awardXP(this.player, Math.max(needed, 0));
        }
        const result = processPendingLevelUps(this.player);
        this.updateHUD();
        debugPanelLog(`[CMD] Level set to ${this.player.level}`, true);
        if (result.asiGained > 0 || this.player.pendingStatPoints > 0) {
          this.time.delayedCall(200, () => this.showStatOverlay());
        }
      } else debugPanelLog(`Usage: /level <1-20|max>`, true);
    });
    cmds.set("lvl", cmds.get("level")!);

    cmds.set("item", (args) => {
      const itemId = args.trim();
      if (itemId.toLowerCase() === "all") {
        let count = 0;
        for (const item of ITEMS) {
          this.player.inventory.push({ ...item });
          count++;
        }
        debugPanelLog(`[CMD] Added all ${count} items to inventory`, true);
      } else if (itemId) {
        const item = getItem(itemId);
        if (item) {
          this.player.inventory.push({ ...item });
          debugPanelLog(`[CMD] Added ${item.name} to inventory`, true);
        } else {
          debugPanelLog(`[CMD] Unknown item: ${itemId}`, true);
        }
      } else debugPanelLog(`Usage: /item <itemId|all>`, true);
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
      if (!query) { debugPanelLog(`Usage: /spawn <monster|traveler|adventurer|merchant|hermit>`, true); return; }

      // Check for special NPC spawn
      const specialAliases: Record<string, SpecialNpcKind> = {
        traveler: "traveler",
        traveller: "traveler",
        adventurer: "adventurer",
        merchant: "wanderingMerchant",
        "wandering merchant": "wanderingMerchant",
        wanderingmerchant: "wanderingMerchant",
        hermit: "hermit",
      };
      const specialKind = specialAliases[query];
      if (specialKind) {
        if (this.player.position.inCity || this.player.position.inDungeon) {
          debugPanelLog(`[CMD] Must be on the overworld to spawn special NPCs. Leave the city/dungeon first.`, true);
          return;
        }
        this.pendingSpecialSpawns.push(specialKind);
        const chunk = getChunk(this.player.position.chunkX, this.player.position.chunkY);
        if (chunk) {
          this.spawnSpecialNpcs(chunk);
        }
        debugPanelLog(`[CMD] Spawned ${SPECIAL_NPC_DEFS[specialKind].label} on the overworld!`, true);
        return;
      }

      // Search all monster pools by id or name (case-insensitive partial match)
      const allMonsters: Monster[] = [...MONSTERS, ...DUNGEON_MONSTERS, ...NIGHT_MONSTERS];
      let found = allMonsters.find(m => m.id.toLowerCase() === query);
      if (!found) found = allMonsters.find(m => m.name.toLowerCase() === query);
      if (!found) found = allMonsters.find(m => m.name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query));
      if (found) {
        debugPanelLog(`[CMD] Spawning ${found.name}...`, true);
        this.startBattle({ ...found });
      } else {
        debugPanelLog(`[CMD] Unknown: "${args.trim()}". Try a monster name/id, or: traveler, adventurer, merchant, hermit`, true);
      }
    });

    cmds.set("teleport", (args) => {
      const parts = args.trim().split(/\s+/);
      // Try name-based teleport first (city or dungeon)
      const nameArg = args.trim().toLowerCase();
      if (nameArg && (parts.length !== 2 || isNaN(parseInt(parts[0], 10)))) {
        // Search cities
        const city = CITIES.find((c) => c.name.toLowerCase() === nameArg || c.id.toLowerCase() === nameArg);
        if (city) {
          this.player.position.chunkX = city.chunkX;
          this.player.position.chunkY = city.chunkY;
          this.player.position.x = city.tileX;
          this.player.position.y = city.tileY;
          if (this.player.position.inDungeon) { this.player.position.inDungeon = false; this.player.position.dungeonId = ""; }
          if (this.player.position.inCity) { this.player.position.inCity = false; this.player.position.cityId = ""; }
          this.renderMap();
          this.createPlayer();
          this.updateHUD();
          debugPanelLog(`[CMD] Teleported to city ${city.name}`, true);
          return;
        }
        // Search dungeons
        const dungeon = DUNGEONS.find((d) => d.name.toLowerCase() === nameArg || d.id.toLowerCase() === nameArg);
        if (dungeon) {
          this.player.position.chunkX = dungeon.entranceChunkX;
          this.player.position.chunkY = dungeon.entranceChunkY;
          this.player.position.x = dungeon.entranceTileX;
          this.player.position.y = dungeon.entranceTileY;
          if (this.player.position.inDungeon) { this.player.position.inDungeon = false; this.player.position.dungeonId = ""; }
          if (this.player.position.inCity) { this.player.position.inCity = false; this.player.position.cityId = ""; }
          this.renderMap();
          this.createPlayer();
          this.updateHUD();
          debugPanelLog(`[CMD] Teleported to dungeon ${dungeon.name}`, true);
          return;
        }
        // Fuzzy match
        const allNames = [
          ...CITIES.map((c) => ({ label: c.name, type: "city" })),
          ...DUNGEONS.map((d) => ({ label: d.name, type: "dungeon" })),
        ];
        const match = allNames.find((n) => n.label.toLowerCase().includes(nameArg));
        if (match) {
          // Re-run with exact name
          cmds.get("teleport")!(match.label);
          return;
        }
        debugPanelLog(`[CMD] No city or dungeon matching "${args.trim()}". Use /tp <name> or /tp <x> <y>`, true);
        return;
      }
      if (parts.length !== 2) { debugPanelLog(`Usage: /teleport <chunkX> <chunkY> or /teleport <cityName>`, true); return; }
      const cx = parseInt(parts[0], 10);
      const cy = parseInt(parts[1], 10);
      if (isNaN(cx) || isNaN(cy) || cx < 0 || cx >= WORLD_WIDTH || cy < 0 || cy >= WORLD_HEIGHT) {
        debugPanelLog(`[CMD] Invalid chunk coords. Range: 0-${WORLD_WIDTH - 1} x 0-${WORLD_HEIGHT - 1}`, true);
        return;
      }
      const chunk = getChunk(cx, cy);
      if (!chunk) { debugPanelLog(`[CMD] No chunk at (${cx}, ${cy})`, true); return; }
      this.player.position.chunkX = cx;
      this.player.position.chunkY = cy;
      // Place player at center of chunk
      this.player.position.x = Math.floor(MAP_WIDTH / 2);
      this.player.position.y = Math.floor(MAP_HEIGHT / 2);
      // Exit dungeon if inside one
      if (this.player.position.inDungeon) {
        this.player.position.inDungeon = false;
        this.player.position.dungeonId = "";
      }
      this.renderMap();
      this.createPlayer();
      this.updateHUD();
      debugPanelLog(`[CMD] Teleported to chunk (${cx}, ${cy}) — ${chunk.name}`, true);
    });
    cmds.set("tp", cmds.get("teleport")!);

    cmds.set("audio", (args) => {
      const sub = args.trim().toLowerCase();
      if (sub === "play" || sub === "demo") {
        debugPanelLog(`[CMD] Playing audio demo... (each sound ~3s)`, true);
        audioEngine.init();
        audioEngine.playAllSounds().then(() => {
          debugPanelLog(`[CMD] Audio demo complete.`, true);
          this.updateAudio();
        });
      } else if (sub === "mute") {
        const muted = audioEngine.toggleMute();
        debugPanelLog(`[CMD] Audio ${muted ? "muted" : "unmuted"}`, true);
      } else if (sub === "stop") {
        audioEngine.stopAll();
        debugPanelLog(`[CMD] Audio stopped`, true);
      } else {
        debugPanelLog(`Usage: /audio <play|mute|stop>`, true);
      }
    });

    cmds.set("mount", (args) => {
      const id = args.trim().toLowerCase();
      if (!id || id === "none" || id === "off") {
        this.player.mountId = "";
        debugPanelLog(`[CMD] Dismounted`, true);
      } else {
        const mount = getMount(id);
        if (mount) {
          this.player.mountId = mount.id;
          // Also add the mount item to inventory if not already owned
          const mountItemId = `mount${mount.id.charAt(0).toUpperCase()}${mount.id.slice(1)}`;
          const mountItem = getItem(mountItemId);
          if (mountItem && !this.player.inventory.some((i) => i.id === mountItemId)) {
            this.player.inventory.push({ ...mountItem });
            debugPanelLog(`[CMD] Spawned ${mount.name} item & mounted (speed ×${mount.speedMultiplier})`, true);
          } else {
            debugPanelLog(`[CMD] Mounted ${mount.name} (speed ×${mount.speedMultiplier})`, true);
          }
        } else {
          debugPanelLog(`Unknown mount: ${id}. Available: donkey, horse, warHorse, shadowSteed`, true);
        }
      }
      this.scene.restart({
        player: this.player,
        defeatedBosses: this.defeatedBosses,
        bestiary: this.bestiary,
        timeStep: this.timeStep,
        weatherState: this.weatherState,
      });
    });

    cmds.set("codex", (_args) => {
      let count = 0;
      for (const m of ALL_MONSTERS) {
        if (!(m.id in this.bestiary.entries)) {
          recordDefeat(this.bestiary, m, true, []);
          count++;
        }
      }
      debugPanelLog(`[CMD] Discovered ${count} new codex entries (${Object.keys(this.bestiary.entries).length} total)`, true);
    });

    // Help entries
    const helpEntries: HelpEntry[] = [
      ...SHARED_HELP,
      { usage: "/reveal", desc: "Reveal entire world map" },
      { usage: "/max_hp <n>", desc: "Set max HP (alias: /maxhp)" },
      { usage: "/max_mp <n>", desc: "Set max MP (alias: /maxmp)" },
      { usage: "/level <1-20|max>", desc: "Set level (alias: /lvl)" },
      { usage: "/item <id|all>", desc: "Add item (or all) to inventory" },
      { usage: "/weather <w>", desc: "Set weather (clear|rain|snow|sandstorm|storm|fog)" },
      { usage: "/time <t>", desc: "Set time (dawn|day|dusk|night)" },
      { usage: "/spawn <name>", desc: "Spawn monster or NPC (traveler/adventurer/merchant/hermit)" },
      { usage: "/audio <cmd>", desc: "Audio: play (demo all) | mute | stop" },
      { usage: "/teleport <x> <y>", desc: "Teleport to chunk or /tp <name>" },
      { usage: "/mount <id>", desc: "Mount: donkey|horse|warHorse|shadowSteed|none" },
      { usage: "/codex all", desc: "Discover all codex entries" },
    ];

    registerCommandRouter(cmds, "Overworld", helpEntries);
  }

  private renderMap(): void {
    // Clear old tile sprites if re-rendering (chunk transition)
    for (const row of this.tileSprites) {
      for (const sprite of row) {
        sprite.destroy();
      }
    }
    this.tileSprites = [];
    // Clear biome decoration emitters
    for (const em of this.biomeDecoEmitters) em.destroy();
    this.biomeDecoEmitters = [];
    // Clear city animals
    for (const a of this.cityAnimals) a.destroy();
    this.cityAnimals = [];
    for (const t of this.cityAnimalTimers) t.destroy();
    this.cityAnimalTimers = [];
    // Clear city NPCs
    for (const s of this.cityNpcSprites) s.destroy();
    this.cityNpcSprites = [];
    for (const t of this.cityNpcTimers) t.destroy();
    this.cityNpcTimers = [];
    this.cityNpcData = [];
    // Clear shop roofs
    for (const g of this.shopRoofGraphics) g.destroy();
    this.shopRoofGraphics = [];
    this.shopRoofBounds = [];
    // Clear special NPCs
    for (const s of this.specialNpcSprites) s.destroy();
    this.specialNpcSprites = [];
    for (const t of this.specialNpcTimers) t.destroy();
    this.specialNpcTimers = [];
    this.specialNpcDefs = [];

    // If inside a dungeon, render the dungeon interior
    if (this.player.position.inDungeon) {
      const dungeon = getDungeon(this.player.position.dungeonId);
      if (!dungeon) return;
      for (let y = 0; y < MAP_HEIGHT; y++) {
        this.tileSprites[y] = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
          const explored = this.isExplored(x, y);
          const terrain = dungeon.mapData[y][x];
          let texKey = explored ? `tile_${terrain}` : "tile_fog";
          // Show open chest texture for opened chests
          if (explored && terrain === Terrain.Chest) {
            const chest = getChestAt(x, y, { type: "dungeon", dungeonId: this.player.position.dungeonId });
            if (chest && this.player.progression.openedChests.includes(chest.id)) {
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
    if (this.player.position.inCity) {
      const city = getCity(this.player.position.cityId);
      if (!city) return;
      // Determine surrounding biome so city floor matches the landscape
      const cityBiome = getTownBiome(city.chunkX, city.chunkY, city.tileX, city.tileY);
      const biomeFloorTex = `tile_${cityBiome}`;
      // Pick biome-appropriate wall texture
      const BIOME_WALL_MAP: Record<number, string> = {
        [Terrain.Grass]: "tile_citywall_wood",
        [Terrain.Forest]: "tile_citywall_moss",
        [Terrain.DeepForest]: "tile_citywall_moss",
        [Terrain.Sand]: "tile_citywall_sand",
        [Terrain.Tundra]: "tile_citywall_ice",
        [Terrain.Swamp]: "tile_citywall_dark",
        [Terrain.Volcanic]: "tile_citywall_volcanic",
        [Terrain.Canyon]: "tile_citywall_sand",
      };
      const biomeWallTex = BIOME_WALL_MAP[cityBiome] ?? `tile_${Terrain.CityWall}`;
      // Pick biome-appropriate path texture
      const BIOME_PATH_MAP: Record<number, string> = {
        [Terrain.Grass]: "tile_path_wood",
        [Terrain.Forest]: "tile_path_moss",
        [Terrain.DeepForest]: "tile_path_moss",
        [Terrain.Sand]: "tile_path_sand",
        [Terrain.Tundra]: "tile_path_gravel",
        [Terrain.Swamp]: "tile_path_dark",
        [Terrain.Volcanic]: "tile_path_lava",
        [Terrain.Canyon]: "tile_path_sand",
      };
      const biomePathTex = BIOME_PATH_MAP[cityBiome] ?? "tile_path_cobble";
      // Build a map of shop entrance positions → shop-type colored carpet texture
      const shopCarpetMap = new Map<string, string>();
      const SHOP_CARPET_TEX: Record<string, string> = {
        weapon: "tile_carpet_weapon",
        armor: "tile_carpet_armor",
        general: "tile_carpet_general",
        magic: "tile_carpet_magic",
        bank: "tile_carpet_bank",
        inn: "tile_carpet_inn",
        stable: "tile_carpet_general",
      };
      for (const shop of city.shops) {
        const carpetTex = SHOP_CARPET_TEX[shop.type];
        if (carpetTex) {
          shopCarpetMap.set(`${shop.x},${shop.y}`, carpetTex);
        } else {
          // Unknown shop types: no carpet, use biome floor
          shopCarpetMap.set(`${shop.x},${shop.y}`, biomeFloorTex);
        }
      }

      // Build a mapping of ShopFloor "x,y" → shop index via flood-fill from each shop entrance
      this.shopFloorMap.clear();
      for (let si = 0; si < city.shops.length; si++) {
        const shop = city.shops[si];
        const queue: { x: number; y: number }[] = [];
        const visited = new Set<string>();
        // Seed: scan near the carpet entrance for ShopFloor tiles
        for (let dy = -3; dy <= 0; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const tx = shop.x + dx;
            const ty = shop.y + dy;
            if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
              if (city.mapData[ty][tx] === Terrain.ShopFloor) {
                const key = `${tx},${ty}`;
                if (!visited.has(key)) { visited.add(key); queue.push({ x: tx, y: ty }); }
              }
            }
          }
        }
        // Expand to connected ShopFloor tiles
        while (queue.length > 0) {
          const cur = queue.pop()!;
          this.shopFloorMap.set(`${cur.x},${cur.y}`, si);
          for (const [ddx, ddy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nx = cur.x + ddx;
            const ny = cur.y + ddy;
            const key = `${nx},${ny}`;
            if (visited.has(key)) continue;
            if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;
            if (city.mapData[ny][nx] === Terrain.ShopFloor) {
              visited.add(key);
              queue.push({ x: nx, y: ny });
            }
          }
        }
      }

      // Determine which shop the player is currently inside of (-1 = none)
      const activeShopIdx = this.getPlayerShopIndex(city);

      for (let y = 0; y < MAP_HEIGHT; y++) {
        this.tileSprites[y] = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
          const explored = this.isExplored(x, y);
          const terrain = city.mapData[y][x];
          let texKey = explored ? `tile_${terrain}` : "tile_fog";
          // City floor uses the biome ground texture instead of cobblestone
          if (explored && terrain === Terrain.CityFloor) {
            texKey = biomeFloorTex;
          }
          // City walls use biome-appropriate material
          if (explored && terrain === Terrain.CityWall) {
            texKey = biomeWallTex;
          }
          // Shop entrance carpets use shop-type color
          if (explored && terrain === Terrain.Carpet) {
            const carpetOverride = shopCarpetMap.get(`${x},${y}`);
            if (carpetOverride) {
              texKey = carpetOverride;
            }
          }
          // City paths use biome-appropriate material
          if (explored && terrain === Terrain.CityPath) {
            texKey = biomePathTex;
          }
          // Shop interior hidden from outside — only visible when player is inside that shop
          if (terrain === Terrain.ShopFloor) {
            const tileShopIdx = this.shopFloorMap.get(`${x},${y}`) ?? -1;
            if (tileShopIdx !== activeShopIdx) {
              texKey = biomeWallTex;
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
          const icon = shop.type === "weapon" ? "⚔" : shop.type === "armor" ? "🛡" : shop.type === "inn" ? "🏨" : shop.type === "bank" ? "🏦" : shop.type === "stable" ? "🐴" : "🏪";
          this.add
            .text(shop.x * TILE_SIZE + TILE_SIZE / 2, shop.y * TILE_SIZE - 6, `${icon} ${shop.name}`, {
              fontSize: "9px",
              fontFamily: "monospace",
              color: "#ffffff",
              stroke: "#000000",
              strokeThickness: 3,
              backgroundColor: "#00000088",
              padding: { x: 3, y: 1 },
            })
            .setOrigin(0.5, 1)
            .setDepth(15); // above roof overlays
        }
      }
      // Spawn city animals
      this.spawnCityAnimals(city);
      // Spawn city NPCs
      this.spawnCityNpcs(city);
      // Draw shop building roofs (above NPCs so they hide interiors)
      this.createShopRoofs(city, cityBiome);
      // Set initial roof transparency based on player position
      this.updateShopRoofAlpha();
      return;
    }

    const chunk = getChunk(this.player.position.chunkX, this.player.position.chunkY);
    if (!chunk) return;

    for (let y = 0; y < MAP_HEIGHT; y++) {
      this.tileSprites[y] = [];
      for (let x = 0; x < MAP_WIDTH; x++) {
        const explored = this.isExplored(x, y);
        const terrain = chunk.mapData[y][x];
        let texKey = explored ? `tile_${terrain}` : "tile_fog";
        // Use biome-colored town texture
        if (explored && terrain === Terrain.Town) {
          const biome = getTownBiome(this.player.position.chunkX, this.player.position.chunkY, x, y);
          texKey = `tile_town_${biome}`;
        }
        // Show open chest texture for opened chests
        if (explored && terrain === Terrain.Chest) {
          const chest = getChestAt(x, y, { type: "overworld", chunkX: this.player.position.chunkX, chunkY: this.player.position.chunkY });
          if (chest && this.player.progression.openedChests.includes(chest.id)) {
            texKey = "tile_chest_open";
          }
        }
        // Show sparkle for uncollected minor treasures
        if (explored && hasSparkleAt(this.player.position.chunkX, this.player.position.chunkY, x, y)) {
          const tKey = `${this.player.position.chunkX},${this.player.position.chunkY},${x},${y}`;
          if (!this.player.progression.collectedTreasures.includes(tKey)) {
            texKey = `tile_${Terrain.MinorTreasure}`;
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

    // Biome decoration creature emitters (butterflies, snakes, smoke, mosquitos)
    this.spawnBiomeCreatures(chunk);

    // Spawn rare special NPCs on the overworld (random or forced via /spawn)
    this.spawnSpecialNpcs(chunk);
  }

  /** Spawn animated animal sprites in cities. Animals wander on walkable tiles. */
  private spawnCityAnimals(city: CityData): void {
    // Animal definitions per city
    const CITY_ANIMALS: Record<string, Array<{ sprite: string; x: number; y: number; moves: boolean }>> = {
      willowdale_city: [
        { sprite: "sprite_chicken", x: 8, y: 5, moves: true },
        { sprite: "sprite_chicken", x: 11, y: 8, moves: true },
        { sprite: "sprite_chicken", x: 14, y: 5, moves: true },
        { sprite: "sprite_dog", x: 9, y: 10, moves: true },
      ],
      ironhold_city: [
        { sprite: "sprite_cow", x: 12, y: 8, moves: true },
        { sprite: "sprite_sheep", x: 10, y: 9, moves: true },
      ],
      frostheim_city: [
        { sprite: "sprite_cat", x: 5, y: 7, moves: false },
        { sprite: "sprite_cat", x: 14, y: 7, moves: false },
        { sprite: "sprite_sheep", x: 10, y: 9, moves: true },
      ],
      deeproot_city: [
        { sprite: "sprite_cat", x: 9, y: 6, moves: false },
        { sprite: "sprite_cat", x: 11, y: 8, moves: false },
        { sprite: "sprite_sheep", x: 7, y: 12, moves: true },
        { sprite: "sprite_sheep", x: 9, y: 12, moves: true },
      ],
      sandport_city: [
        { sprite: "sprite_cat", x: 12, y: 9, moves: false },
        { sprite: "sprite_chicken", x: 7, y: 7, moves: true },
        { sprite: "sprite_chicken", x: 9, y: 6, moves: true },
      ],
      bogtown_city: [
        { sprite: "sprite_mouse", x: 8, y: 7, moves: true },
        { sprite: "sprite_mouse", x: 12, y: 6, moves: true },
        { sprite: "sprite_frog", x: 10, y: 10, moves: true },
      ],
      thornvale_city: [
        { sprite: "sprite_frog", x: 9, y: 8, moves: true },
        { sprite: "sprite_frog", x: 11, y: 7, moves: true },
        { sprite: "sprite_cow", x: 8, y: 12, moves: true },
        { sprite: "sprite_cow", x: 13, y: 8, moves: true },
        { sprite: "sprite_sheep", x: 10, y: 10, moves: true },
      ],
      canyonwatch_city: [
        { sprite: "sprite_dog", x: 10, y: 8, moves: true },
        { sprite: "sprite_chicken", x: 8, y: 6, moves: true },
        { sprite: "sprite_chicken", x: 12, y: 6, moves: true },
      ],
      ridgewatch_city: [
        { sprite: "sprite_sheep", x: 8, y: 7, moves: true },
        { sprite: "sprite_sheep", x: 11, y: 7, moves: true },
        { sprite: "sprite_sheep", x: 9, y: 9, moves: true },
        { sprite: "sprite_dog", x: 13, y: 8, moves: true },
      ],
      ashfall_city: [
        { sprite: "sprite_lizard", x: 9, y: 8, moves: true },
        { sprite: "sprite_lizard", x: 12, y: 5, moves: true },
      ],
      dunerest_city: [
        { sprite: "sprite_lizard", x: 7, y: 7, moves: true },
        { sprite: "sprite_cat", x: 10, y: 9, moves: false },
      ],
      shadowfen_city: [
        { sprite: "sprite_frog", x: 8, y: 8, moves: true },
        { sprite: "sprite_mouse", x: 11, y: 10, moves: true },
      ],
    };

    const animals = CITY_ANIMALS[city.id];
    if (!animals) return;

    // Credible animal sizes relative to a human NPC (32px tile)
    const ANIMAL_SCALE: Record<string, number> = {
      sprite_cow: 2.5,
      sprite_dog: 1.6,
      sprite_sheep: 1.8,
      sprite_cat: 1.3,
      sprite_chicken: 1.0,
      sprite_frog: 0.8,
      sprite_mouse: 0.7,
      sprite_lizard: 0.9,
    };

    for (const def of animals) {
      if (!this.isExplored(def.x, def.y)) continue;

      const sprite = this.add.sprite(
        def.x * TILE_SIZE + TILE_SIZE / 2,
        def.y * TILE_SIZE + TILE_SIZE / 2,
        def.sprite
      );
      const animalScale = ANIMAL_SCALE[def.sprite] ?? 1.0;
      sprite.setScale(animalScale);
      sprite.setDepth(11);
      this.cityAnimals.push(sprite);

      if (def.moves) {
        // Wander: periodically move to a random adjacent walkable tile
        const wander = () => {
          const dirs = [
            { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
            { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
          ];
          const pick = dirs[Math.floor(Math.random() * dirs.length)];
          const curTileX = Math.floor(sprite.x / TILE_SIZE);
          const curTileY = Math.floor(sprite.y / TILE_SIZE);
          const nx = curTileX + pick.dx;
          const ny = curTileY + pick.dy;
          if (
            nx >= 1 && nx < MAP_WIDTH - 1 &&
            ny >= 1 && ny < MAP_HEIGHT - 1 &&
            isWalkable(city.mapData[ny][nx])
          ) {
            this.tweens.add({
              targets: sprite,
              x: nx * TILE_SIZE + TILE_SIZE / 2,
              y: ny * TILE_SIZE + TILE_SIZE / 2,
              duration: 600 + Math.random() * 400,
              ease: "Sine.easeInOut",
              onUpdate: () => {
                // Flip sprite based on movement direction
                if (pick.dx !== 0) sprite.setFlipX(pick.dx < 0);
              },
            });
          }
        };
        const delay = 1500 + Math.random() * 2000;
        const timer = this.time.addEvent({
          delay,
          callback: wander,
          loop: true,
        });
        this.cityAnimalTimers.push(timer);
      } else {
        // Sleeping animal: subtle breathing animation
        this.tweens.add({
          targets: sprite,
          scaleY: animalScale * 0.9,
          duration: 1200,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    }
  }

  /**
   * Draw roof overlays over shop buildings.  Each shop has a cluster of
   * CityWall + ShopFloor tiles that form the structure; the roof covers
   * them and fades out when the player is nearby.
   */
  private createShopRoofs(city: CityData, biome: Terrain): void {
    // Biome-based roof colour palettes
    const BIOME_ROOF_COLORS: Record<number, { base: number; ridge: number; border: number }> = {
      [Terrain.Grass]:      { base: 0x8d6e63, ridge: 0x6d4c41, border: 0x4e342e },  // warm brown thatch
      [Terrain.Forest]:     { base: 0x5d7a4f, ridge: 0x3e5a30, border: 0x2e4420 },  // mossy green
      [Terrain.DeepForest]: { base: 0x4a6040, ridge: 0x334830, border: 0x223420 },  // dark green
      [Terrain.Sand]:       { base: 0xc8a864, ridge: 0xa08844, border: 0x806830 },  // sandstone
      [Terrain.Tundra]:     { base: 0x8899aa, ridge: 0x667788, border: 0x445566 },  // slate blue
      [Terrain.Swamp]:      { base: 0x5a5a4a, ridge: 0x3e3e30, border: 0x2a2a20 },  // murky grey
      [Terrain.Volcanic]:   { base: 0x6a3a2a, ridge: 0x4a2a1a, border: 0x3a1a0a },  // charred red
      [Terrain.Canyon]:     { base: 0xb07050, ridge: 0x905838, border: 0x704028 },  // terracotta
    };
    const palette = BIOME_ROOF_COLORS[biome] ?? BIOME_ROOF_COLORS[Terrain.Grass];

    for (let si = 0; si < city.shops.length; si++) {
      const shop = city.shops[si];
      // Find building bounds by flood-filling from the ShopFloor tile above the carpet entrance
      const visited = new Set<string>();
      const tiles: { x: number; y: number }[] = [];
      const queue: { x: number; y: number }[] = [];

      // Seed: scan a small area around the shop entrance for ShopFloor tiles
      for (let dy = -3; dy <= 0; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const tx = shop.x + dx;
          const ty = shop.y + dy;
          if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
            const t = city.mapData[ty][tx];
            if (t === Terrain.ShopFloor) {
              const key = `${tx},${ty}`;
              if (!visited.has(key)) {
                visited.add(key);
                queue.push({ x: tx, y: ty });
                tiles.push({ x: tx, y: ty });
              }
            }
          }
        }
      }

      // Expand to include surrounding CityWall tiles
      while (queue.length > 0) {
        const cur = queue.pop()!;
        for (const [ddx, ddy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nx = cur.x + ddx;
          const ny = cur.y + ddy;
          const key = `${nx},${ny}`;
          if (visited.has(key)) continue;
          if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;
          const t = city.mapData[ny][nx];
          if (t === Terrain.ShopFloor) {
            visited.add(key);
            queue.push({ x: nx, y: ny });
            tiles.push({ x: nx, y: ny });
          } else if (t === Terrain.CityWall) {
            // Only include wall tiles adjacent to shop floor (building walls, not city walls)
            visited.add(key);
            tiles.push({ x: nx, y: ny });
          }
        }
      }

      if (tiles.length === 0) continue;

      // Compute bounding box
      let minX = tiles[0].x, maxX = tiles[0].x, minY = tiles[0].y, maxY = tiles[0].y;
      for (const t of tiles) {
        if (t.x < minX) minX = t.x;
        if (t.x > maxX) maxX = t.x;
        if (t.y < minY) minY = t.y;
        if (t.y > maxY) maxY = t.y;
      }

      const bx = minX * TILE_SIZE;
      const by = minY * TILE_SIZE;
      const bw = (maxX - minX + 1) * TILE_SIZE;
      const bh = (maxY - minY + 1) * TILE_SIZE;

      // Draw a roof graphic over the building area
      const gfx = this.add.graphics();
      gfx.setDepth(14); // above NPCs (11) and animals (11) but below HUD

      // Main roof colour — vary slightly by shop type
      const typeShift = shop.type === "inn" ? 0x101010 : shop.type === "weapon" ? -0x080808 : 0;
      const roofColor = Math.max(0, palette.base + typeShift);
      gfx.fillStyle(roofColor, 1);
      gfx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);

      // Ridge lines for a tiled-roof look
      gfx.lineStyle(1, palette.ridge, 0.6);
      for (let ry = by; ry < by + bh; ry += 6) {
        gfx.lineBetween(bx - 2, ry, bx + bw + 2, ry);
      }

      // Roof border
      gfx.lineStyle(2, palette.border, 0.9);
      gfx.strokeRect(bx - 2, by - 2, bw + 4, bh + 4);

      // Ridge cap (center horizontal line)
      gfx.lineStyle(2, palette.ridge, 0.8);
      gfx.lineBetween(bx - 2, by + bh / 2, bx + bw + 2, by + bh / 2);

      this.shopRoofGraphics.push(gfx);
      this.shopRoofBounds.push({
        x: minX, y: minY,
        w: maxX - minX + 1, h: maxY - minY + 1,
        shopX: shop.x, shopY: shop.y, shopIdx: si,
      });
    }
  }

  /** Return the shop index the player is currently inside (-1 if not in any shop). */
  private getPlayerShopIndex(city: CityData): number {
    const px = this.player.position.x;
    const py = this.player.position.y;
    const terrain = city.mapData[py]?.[px];
    if (terrain === Terrain.ShopFloor) {
      return this.shopFloorMap.get(`${px},${py}`) ?? -1;
    }
    if (terrain === Terrain.Carpet) {
      // The carpet is the entrance; find the shop whose entrance matches
      for (let si = 0; si < city.shops.length; si++) {
        if (city.shops[si].x === px && city.shops[si].y === py) return si;
      }
    }
    return -1;
  }

  /** Fade shop roofs: only transparent when the player is inside the shop. */
  private updateShopRoofAlpha(): void {
    const city = this.player.position.inCity ? getCity(this.player.position.cityId) : null;
    const activeIdx = city ? this.getPlayerShopIndex(city) : -1;
    for (let i = 0; i < this.shopRoofBounds.length; i++) {
      const gfx = this.shopRoofGraphics[i];
      if (!gfx) continue;
      gfx.setAlpha(this.shopRoofBounds[i].shopIdx === activeIdx ? 0.1 : 1);
    }
  }

  /**
   * Generate (or retrieve from cache) an NPC texture with skin, hair, and
   * dress colours baked in so that `setTint` isn't needed.  This prevents the
   * entire sprite — skin, hair, legs — from being tinted a single colour.
   */
  private getOrCreateNpcTexture(
    tpl: NpcTemplate,
    skinColor: number,
    hairColor: number,
    dressColor: number,
  ): string {
    const key = `npc_${tpl.id}_${skinColor.toString(16)}_${hairColor.toString(16)}_${dressColor.toString(16)}`;
    if (this.textures.exists(key)) return key;

    const S = TILE_SIZE;
    const gfx = this.add.graphics();
    const isChild = tpl.ageGroup === "child";
    const bodyW = isChild ? 10 : 14;
    const bodyH = isChild ? 10 : 14;
    const headR = isChild ? 5 : 6;
    const legW = isChild ? 3 : 4;
    const legH = isChild ? 4 : 5;
    const bx = Math.floor((S - bodyW) / 2);
    const by = isChild ? 14 : 10;

    // Body / dress — uses the per-instance dress colour
    gfx.fillStyle(dressColor, 1);
    gfx.fillRect(bx, by, bodyW, bodyH);

    // Head — real skin colour
    gfx.fillStyle(skinColor, 1);
    gfx.fillCircle(S / 2, by - headR + 2, headR);

    // Hair
    gfx.fillStyle(hairColor, 1);
    if (tpl.ageGroup === "child") {
      gfx.fillRect(S / 2 - headR + 1, by - headR * 2 + 3, headR * 2 - 2, 3);
    } else if (tpl.ageGroup === "female") {
      gfx.fillRect(S / 2 - headR, by - headR * 2 + 2, headR * 2, 4);
      gfx.fillRect(S / 2 - headR, by - headR + 4, 2, headR);
      gfx.fillRect(S / 2 + headR - 2, by - headR + 4, 2, headR);
    } else {
      gfx.fillRect(S / 2 - headR + 1, by - headR * 2 + 2, headR * 2 - 2, 4);
    }

    // Eyes
    gfx.fillStyle(0x111111, 1);
    gfx.fillRect(S / 2 - 2, by - headR + 3, 1, 1);
    gfx.fillRect(S / 2 + 2, by - headR + 3, 1, 1);

    // Legs — neutral brown
    gfx.fillStyle(0x6d4c41, 1);
    gfx.fillRect(bx + 1, by + bodyH, legW, legH);
    gfx.fillRect(bx + bodyW - legW - 1, by + bodyH, legW, legH);

    gfx.generateTexture(key, S, S);
    gfx.destroy();
    return key;
  }

  /** Clear existing city NPCs and re-spawn them (used after inn rest to reflect time change). */
  private respawnCityNpcs(): void {
    if (!this.player.position.inCity) return;
    const city = getCity(this.player.position.cityId);
    if (!city) return;
    // Destroy existing NPC sprites and timers
    for (const s of this.cityNpcSprites) s.destroy();
    this.cityNpcSprites = [];
    for (const t of this.cityNpcTimers) t.destroy();
    this.cityNpcTimers = [];
    this.cityNpcData = [];
    // Re-spawn
    this.spawnCityNpcs(city);
  }

  /** Spawn NPC sprites in cities with wandering / stationary behaviour. */
  private spawnCityNpcs(city: CityData): void {
    const npcs = CITY_NPCS[city.id];
    if (!npcs) return;

    const isNight = getTimePeriod(this.timeStep) === TimePeriod.Night;

    // At night, track how many non-essential NPCs we keep (about 30%)
    let nonEssentialCount = 0;

    this.cityNpcData = npcs;

    for (let i = 0; i < npcs.length; i++) {
      const def = npcs[i];
      const tpl = getNpcTemplate(def.templateId);
      if (!tpl) continue;

      // At night, skip most non-essential NPCs (children always go, most villagers too)
      if (isNight && def.shopIndex === undefined) {
        const isGuard = def.templateId.startsWith("guard_");
        const isChild = tpl.ageGroup === "child";
        if (isChild) {
          // Children are never out at night
          continue;
        }
        if (!isGuard) {
          // Keep only ~30% of regular villagers at night
          nonEssentialCount++;
          if (nonEssentialCount % 3 !== 0) continue;
        }
      }

      // Shopkeeper NPCs are placed inside their shop (on the nearest ShopFloor tile)
      let spawnX = def.x;
      let spawnY = def.y;
      if (def.shopIndex !== undefined) {
        const shop = city.shops[def.shopIndex];
        if (shop) {
          // Search for a ShopFloor tile near the shop entrance (carpet)
          for (let dy = -2; dy <= 0; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const tx = shop.x + dx;
              const ty = shop.y + dy;
              if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_HEIGHT) {
                if (city.mapData[ty][tx] === Terrain.ShopFloor) {
                  spawnX = tx;
                  spawnY = ty;
                }
              }
            }
          }
        }
      }

      if (!this.isExplored(spawnX, spawnY)) continue;

      // Generate a per-instance texture with proper skin/hair/dress colours
      const colors = getNpcColors(city.id, i);
      // Elders always have grey hair
      const hairColor = def.templateId.includes("elder") ? 0xaaaaaa : colors.hairColor;
      const texKey = this.getOrCreateNpcTexture(tpl, colors.skinColor, hairColor, colors.dressColor);
      const sprite = this.add.sprite(
        spawnX * TILE_SIZE + TILE_SIZE / 2,
        spawnY * TILE_SIZE + TILE_SIZE / 2,
        texKey
      );
      sprite.setDepth(11);

      // Scale children smaller
      if (tpl.heightScale < 1) {
        sprite.setScale(tpl.heightScale);
      }

      this.cityNpcSprites.push(sprite);

      if (def.moves) {
        const wander = (): void => {
          const dirs = [
            { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
            { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
          ];
          const pick = dirs[Math.floor(Math.random() * dirs.length)];
          const curTileX = Math.floor(sprite.x / TILE_SIZE);
          const curTileY = Math.floor(sprite.y / TILE_SIZE);
          const nx = curTileX + pick.dx;
          const ny = curTileY + pick.dy;
          if (
            nx >= 1 && nx < MAP_WIDTH - 1 &&
            ny >= 1 && ny < MAP_HEIGHT - 1 &&
            isWalkable(city.mapData[ny][nx])
          ) {
            this.tweens.add({
              targets: sprite,
              x: nx * TILE_SIZE + TILE_SIZE / 2,
              y: ny * TILE_SIZE + TILE_SIZE / 2,
              duration: 800 + Math.random() * 400,
              ease: "Sine.easeInOut",
              onUpdate: () => {
                if (pick.dx !== 0) sprite.setFlipX(pick.dx < 0);
              },
            });
          }
        };
        const delay = 2000 + Math.random() * 2000;
        const timer = this.time.addEvent({
          delay,
          callback: wander,
          loop: true,
        });
        this.cityNpcTimers.push(timer);
      } else {
        // Idle breathing for stationary NPCs
        this.tweens.add({
          targets: sprite,
          scaleY: (tpl.heightScale < 1 ? tpl.heightScale : 1) * 0.97,
          duration: 1500,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    }
  }

  /** Spawn rare special NPCs on the overworld (traveler, adventurer, wandering merchant, hermit). */
  private spawnSpecialNpcs(chunk: WorldChunk): void {
    // If we have saved special NPCs from a scene transition, restore them.
    if (this.savedSpecialNpcs.length > 0) {
      for (const saved of this.savedSpecialNpcs) {
        const def = SPECIAL_NPC_DEFS[saved.kind];
        this.placeSpecialNpcSprite(def, chunk, saved.x, saved.y, saved.interactions);
      }
      this.savedSpecialNpcs = [];
      return;
    }

    // Determine which specials to spawn — use forced queue or random roll
    let toSpawn: SpecialNpcKind[];
    if (this.pendingSpecialSpawns.length > 0) {
      toSpawn = [...this.pendingSpecialSpawns];
      this.pendingSpecialSpawns = [];
    } else {
      // After a special NPC spawns, drop chance to 0 until the next day
      const currentDay = Math.floor(this.timeStep / CYCLE_LENGTH);
      const multiplier = currentDay === this.lastSpecialSpawnDay ? 0 : 1;
      toSpawn = rollSpecialNpcSpawns(multiplier);
      if (toSpawn.length > 0) {
        this.lastSpecialSpawnDay = currentDay;
      }
    }
    if (toSpawn.length === 0) return;

    // Find walkable positions that aren't occupied by towns, bosses, etc.
    const occupied = new Set<string>();
    for (const town of chunk.towns) occupied.add(`${town.x},${town.y}`);
    for (const boss of chunk.bosses) occupied.add(`${boss.x},${boss.y}`);
    const walkable: { x: number; y: number }[] = [];
    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
      for (let x = 1; x < MAP_WIDTH - 1; x++) {
        if (
          isWalkable(chunk.mapData[y][x]) &&
          !occupied.has(`${x},${y}`) &&
          this.isExplored(x, y)
        ) {
          walkable.push({ x, y });
        }
      }
    }
    if (walkable.length === 0) return;

    for (const kind of toSpawn) {
      const def = SPECIAL_NPC_DEFS[kind];

      // Pick a random spawn position
      const posIdx = Math.floor(Math.random() * walkable.length);
      const pos = walkable[posIdx];
      walkable.splice(posIdx, 1);

      this.placeSpecialNpcSprite(def, chunk, pos.x, pos.y, 0);
      this.showMessage(`A ${def.label} has appeared!`, "#4dd0e1");
      if (walkable.length === 0) break;
    }
  }

  /** Create a special NPC sprite + wander logic at the given tile position. */
  private placeSpecialNpcSprite(
    def: SpecialNpcDef,
    chunk: WorldChunk,
    tx: number,
    ty: number,
    interactions: number,
  ): void {
    const tpl = getNpcTemplate(def.templateId);
    if (!tpl) return;
    debugPanelLog(`[NPC] Spawned ${def.kind} at (${tx},${ty})`, true);

    const specialSkin = NPC_SKIN_COLORS[Math.abs(def.kind.length * 7) % NPC_SKIN_COLORS.length];
    const texKey = this.getOrCreateNpcTexture(tpl, specialSkin, 0x5d4037, def.tintColor);
    const sprite = this.add.sprite(
      tx * TILE_SIZE + TILE_SIZE / 2,
      ty * TILE_SIZE + TILE_SIZE / 2,
      texKey
    );
    sprite.setDepth(11);

    this.specialNpcSprites.push(sprite);
    this.specialNpcDefs.push({ def, x: tx, y: ty, interactions });

    if (def.moves) {
      const wander = (): void => {
        const dirs = [
          { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
          { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
        ];
        const pick = dirs[Math.floor(Math.random() * dirs.length)];
        const curTileX = Math.floor(sprite.x / TILE_SIZE);
        const curTileY = Math.floor(sprite.y / TILE_SIZE);
        const nx = curTileX + pick.dx;
        const ny = curTileY + pick.dy;
        if (
          nx >= 1 && nx < MAP_WIDTH - 1 &&
          ny >= 1 && ny < MAP_HEIGHT - 1 &&
          isWalkable(chunk.mapData[ny][nx])
        ) {
          this.tweens.add({
            targets: sprite,
            x: nx * TILE_SIZE + TILE_SIZE / 2,
            y: ny * TILE_SIZE + TILE_SIZE / 2,
            duration: 800 + Math.random() * 400,
            ease: "Sine.easeInOut",
            onUpdate: () => {
              if (pick.dx !== 0) sprite.setFlipX(pick.dx < 0);
            },
          });
        }
      };
      const delay = 2000 + Math.random() * 2000;
      const timer = this.time.addEvent({ delay, callback: wander, loop: true });
      this.specialNpcTimers.push(timer);
    } else {
      this.tweens.add({
        targets: sprite,
        scaleY: 0.97,
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  /**
   * Find a special NPC adjacent to or on the player's current position.
   */
  private findAdjacentSpecialNpc(): { index: number; def: SpecialNpcDef } | null {
    const px = this.player.position.x;
    const py = this.player.position.y;
    const checks = [
      { x: px, y: py },
      { x: px - 1, y: py }, { x: px + 1, y: py },
      { x: px, y: py - 1 }, { x: px, y: py + 1 },
    ];

    for (let i = 0; i < this.specialNpcDefs.length; i++) {
      const spr = this.specialNpcSprites[i];
      if (!spr || !spr.active) continue;
      const nx = Math.floor(spr.x / TILE_SIZE);
      const ny = Math.floor(spr.y / TILE_SIZE);
      for (const c of checks) {
        if (c.x === nx && c.y === ny) {
          return { index: i, def: this.specialNpcDefs[i].def };
        }
      }
    }
    return null;
  }

  /** Show dialogue for a special NPC; despawn after all unique lines are exhausted. */
  private interactSpecialNpc(index: number): void {
    const entry = this.specialNpcDefs[index];
    if (!entry) return;

    const line = getSpecialNpcDialogue(entry.def.kind, entry.interactions);
    const farewell = SPECIAL_NPC_FAREWELLS[entry.def.kind];
    const isFarewell = line === farewell;
    entry.interactions++;

    if (audioEngine.initialized) audioEngine.playDialogueBlips(line);

    // If this is the farewell line, show it then despawn after a short delay.
    if (isFarewell) {
      // Wandering merchant still opens shop on farewell, but despawns after.
      if (entry.def.kind === "wanderingMerchant") {
        this.showSpecialDialogue(entry.def.label, line);
        this.time.delayedCall(800, () => {
          this.dismissDialogue();
          const chunk = getChunk(this.player.position.chunkX, this.player.position.chunkY);
          const regionName = chunk?.name ?? "Overworld";
          this.autoSave();
          this.scene.start("ShopScene", {
            player: this.player,
            townName: `${regionName} - Wandering Merchant`,
            defeatedBosses: this.defeatedBosses,
            bestiary: this.bestiary,
            shopItemIds: entry.def.shopItems ?? ["potion", "ether"],
            timeStep: this.timeStep,
            weatherState: this.weatherState,
            discount: 0.2,
            savedSpecialNpcs: this.snapshotSpecialNpcs().filter((s) => s.kind !== entry.def.kind),
          });
        });
        return;
      }

      this.showSpecialDialogue(entry.def.label, line);
      this.time.delayedCall(1500, () => {
        this.dismissDialogue();
        const spr = this.specialNpcSprites[index];
        if (spr && spr.active) {
          this.tweens.add({
            targets: spr,
            alpha: 0,
            duration: 600,
            onComplete: () => spr.destroy(),
          });
        }
      });
      return;
    }

    // Wandering merchant — show dialogue then open shop (preserving special NPCs)
    if (entry.def.kind === "wanderingMerchant") {
      this.showSpecialDialogue(entry.def.label, line);
      this.time.delayedCall(800, () => {
        this.dismissDialogue();
        const chunk = getChunk(this.player.position.chunkX, this.player.position.chunkY);
        const regionName = chunk?.name ?? "Overworld";
        this.autoSave();
        this.scene.start("ShopScene", {
          player: this.player,
          townName: `${regionName} - Wandering Merchant`,
          defeatedBosses: this.defeatedBosses,
          bestiary: this.bestiary,
          shopItemIds: entry.def.shopItems ?? ["potion", "ether"],
          timeStep: this.timeStep,
          weatherState: this.weatherState,
          discount: 0.2,
          savedSpecialNpcs: this.snapshotSpecialNpcs(),
        });
      });
      return;
    }

    // Regular dialogue for traveler / adventurer / hermit
    this.showSpecialDialogue(entry.def.label, line);
  }

  /** Show a dialogue overlay for a special NPC. */
  private showSpecialDialogue(speakerName: string, line: string): void {
    if (this.dialogueOverlay) {
      this.dialogueOverlay.destroy();
      this.dialogueOverlay = null;
    }

    const container = this.add.container(0, 0).setDepth(50);
    const boxW = MAP_WIDTH * TILE_SIZE - 40;
    const boxH = 52;
    const boxX = 20;
    const boxY = MAP_HEIGHT * TILE_SIZE - boxH - 10;

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRoundedRect(boxX, boxY, boxW, boxH, 6);
    bg.lineStyle(2, 0x4dd0e1, 1);
    bg.strokeRoundedRect(boxX, boxY, boxW, boxH, 6);
    container.add(bg);

    const nameText = this.add.text(boxX + 10, boxY + 6, `✦ ${speakerName}`, {
      fontSize: "10px",
      fontFamily: "monospace",
      color: "#4dd0e1",
      stroke: "#000",
      strokeThickness: 1,
    });
    container.add(nameText);

    const lineText = this.add.text(boxX + 10, boxY + 22, line, {
      fontSize: "11px",
      fontFamily: "monospace",
      color: "#ddd",
      wordWrap: { width: boxW - 20 },
    });
    container.add(lineText);

    const hint = this.add.text(boxX + boxW - 10, boxY + boxH - 14, "[SPACE]", {
      fontSize: "8px",
      fontFamily: "monospace",
      color: "#888",
    }).setOrigin(1, 0);
    container.add(hint);

    this.dialogueOverlay = container;
  }

  /**
   * Find an NPC adjacent to or on the player's current position.
   * Shopkeeper NPCs can only be talked to from inside their shop
   * (player must be on a ShopFloor tile, not the carpet entrance).
   */
  private findAdjacentNpc(): { npcDef: NpcInstance; npcIndex: number } | null {
    const npcs = this.cityNpcData;
    if (!npcs.length) return null;

    const px = this.player.position.x;
    const py = this.player.position.y;

    // Check what tile the player is standing on
    const city = getCity(this.player.position.cityId);
    const playerTerrain = city?.mapData[py]?.[px];
    const playerInsideShop = playerTerrain === Terrain.ShopFloor || playerTerrain === Terrain.CityFloor || playerTerrain === Terrain.Carpet;

    const checks = [
      { x: px, y: py },
      { x: px - 1, y: py }, { x: px + 1, y: py },
      { x: px, y: py - 1 }, { x: px, y: py + 1 },
    ];

    for (let i = 0; i < npcs.length; i++) {
      const npc = npcs[i];
      // Shopkeeper NPCs require the player to be inside the shop (on carpet or shop floor).
      // Stables are open-air, so the player just needs to be nearby on any walkable city tile.
      if (npc.shopIndex !== undefined) {
        const shop = city?.shops[npc.shopIndex];
        const isOutdoorShop = shop?.type === "stable";
        if (!isOutdoorShop && !playerInsideShop) continue;
      }

      // For wandering NPCs or shopkeepers (placed programmatically), use sprite position
      let nx: number;
      let ny: number;
      if (this.cityNpcSprites[i]) {
        nx = Math.floor(this.cityNpcSprites[i].x / TILE_SIZE);
        ny = Math.floor(this.cityNpcSprites[i].y / TILE_SIZE);
      } else {
        nx = npc.x;
        ny = npc.y;
      }
      for (const c of checks) {
        if (c.x === nx && c.y === ny) {
          return { npcDef: npc, npcIndex: i };
        }
      }
    }
    return null;
  }

  /** Check if the player is adjacent to a city animal sprite. */
  private findAdjacentAnimal(): { spriteName: string } | null {
    const px = this.player.position.x;
    const py = this.player.position.y;
    const checks = [
      { x: px, y: py },
      { x: px - 1, y: py }, { x: px + 1, y: py },
      { x: px, y: py - 1 }, { x: px, y: py + 1 },
    ];

    for (const sprite of this.cityAnimals) {
      if (!sprite.active) continue;
      const ax = Math.floor(sprite.x / TILE_SIZE);
      const ay = Math.floor(sprite.y / TILE_SIZE);
      for (const c of checks) {
        if (c.x === ax && c.y === ay) {
          return { spriteName: sprite.texture.key };
        }
      }
    }
    return null;
  }

  /** Show an animal dialogue bubble with a simple sound/verse. */
  private showAnimalDialogue(spriteName: string): void {
    if (this.dialogueOverlay) {
      this.dialogueOverlay.destroy();
      this.dialogueOverlay = null;
    }

    const pool = ANIMAL_DIALOGUES[spriteName];
    if (!pool) return;

    const line = pool[Math.floor(Math.random() * pool.length)];
    // Derive a display name from the sprite key (e.g. "sprite_cow" → "Cow")
    const rawName = spriteName.replace("sprite_", "");
    const speakerName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

    if (audioEngine.initialized) audioEngine.playDialogueBlips(line, -5);

    const container = this.add.container(0, 0).setDepth(50);
    const boxW = MAP_WIDTH * TILE_SIZE - 40;
    const boxH = 52;
    const boxX = 20;
    const boxY = MAP_HEIGHT * TILE_SIZE - boxH - 10;

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRoundedRect(boxX, boxY, boxW, boxH, 6);
    bg.lineStyle(2, 0xc0a060, 1);
    bg.strokeRoundedRect(boxX, boxY, boxW, boxH, 6);
    container.add(bg);

    const nameText = this.add.text(boxX + 10, boxY + 6, speakerName, {
      fontSize: "11px", fontFamily: "monospace", color: "#ffd700", fontStyle: "bold",
    });
    container.add(nameText);

    const lineText = this.add.text(boxX + 10, boxY + 22, line, {
      fontSize: "12px", fontFamily: "monospace", color: "#ffffff",
      wordWrap: { width: boxW - 20 },
    });
    container.add(lineText);

    this.dialogueOverlay = container;
    this.time.delayedCall(2000, () => {
      if (this.dialogueOverlay === container) {
        container.destroy();
        this.dialogueOverlay = null;
      }
    });
  }

  /** Show a dialogue box when the player interacts with an NPC. */
  private showNpcDialogue(npcDef: NpcInstance, npcIndex: number, city: CityData): void {
    if (this.dialogueOverlay) {
      this.dialogueOverlay.destroy();
      this.dialogueOverlay = null;
    }

    const tpl = getNpcTemplate(npcDef.templateId);
    if (!tpl) return;

    let speakerName: string;
    let line: string;
    const isNight = getTimePeriod(this.timeStep) === TimePeriod.Night;

    if (npcDef.shopIndex !== undefined) {
      const shop = city.shops[npcDef.shopIndex];
      if (shop) {
        speakerName = shop.name;
        line = getShopkeeperDialogue(shop.type, npcIndex);
      } else {
        speakerName = tpl.label;
        line = getNpcDialogue(city.id, npcIndex, tpl.ageGroup, npcDef.templateId, isNight);
      }
    } else {
      speakerName = tpl.label;
      line = getNpcDialogue(city.id, npcIndex, tpl.ageGroup, npcDef.templateId, isNight);
    }

    if (audioEngine.initialized) audioEngine.playDialogueBlips(line);

    const container = this.add.container(0, 0).setDepth(50);
    const boxW = MAP_WIDTH * TILE_SIZE - 40;
    const boxH = 52;
    const boxX = 20;
    const boxY = MAP_HEIGHT * TILE_SIZE - boxH - 10;

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRoundedRect(boxX, boxY, boxW, boxH, 6);
    bg.lineStyle(2, 0xc0a060, 1);
    bg.strokeRoundedRect(boxX, boxY, boxW, boxH, 6);
    container.add(bg);

    const nameText = this.add.text(boxX + 10, boxY + 6, speakerName, {
      fontSize: "10px",
      fontFamily: "monospace",
      color: "#ffd700",
      stroke: "#000",
      strokeThickness: 1,
    });
    container.add(nameText);

    const lineText = this.add.text(boxX + 10, boxY + 22, line, {
      fontSize: "11px",
      fontFamily: "monospace",
      color: "#ddd",
      wordWrap: { width: boxW - 20 },
    });
    container.add(lineText);

    const hint = this.add.text(boxX + boxW - 10, boxY + boxH - 14, "[SPACE]", {
      fontSize: "8px",
      fontFamily: "monospace",
      color: "#888",
    }).setOrigin(1, 0);
    container.add(hint);

    this.dialogueOverlay = container;
  }

  /** Dismiss the current dialogue overlay. */
  private dismissDialogue(): void {
    if (this.dialogueOverlay) {
      this.dialogueOverlay.destroy();
      this.dialogueOverlay = null;
    }
  }

  /** Show inn confirmation overlay. */
  private showInnConfirmation(): void {
    if (this.innConfirmOverlay) return;
    const innCost = getInnCost(this.player.position.cityId);
    const container = this.add.container(0, 0).setDepth(55);
    const boxW = 280;
    const boxH = 120;
    const boxX = (MAP_WIDTH * TILE_SIZE - boxW) / 2;
    const boxY = (MAP_HEIGHT * TILE_SIZE - boxH) / 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.97);
    bg.fillRoundedRect(boxX, boxY, boxW, boxH, 8);
    bg.lineStyle(2, 0xc0a060, 1);
    bg.strokeRoundedRect(boxX, boxY, boxW, boxH, 8);
    container.add(bg);

    const prompt = this.add.text(boxX + boxW / 2, boxY + 10, `Rest at the inn for ${innCost}g?`, {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#ffd700",
    }).setOrigin(0.5, 0);
    container.add(prompt);

    // Dawn = step 0 of the next cycle, Night starts at step 265
    const DAWN_STEP = 0;
    const NIGHT_STEP = 265;

    const sleepBtn = this.add.text(boxX + boxW / 2, boxY + 32, "🌅 Sleep Until Morning", {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#88ff88",
      backgroundColor: "#2a2a4e",
      padding: { x: 10, y: 4 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    sleepBtn.on("pointerover", () => sleepBtn.setColor("#ffd700"));
    sleepBtn.on("pointerout", () => sleepBtn.setColor("#88ff88"));
    sleepBtn.on("pointerdown", () => {
      const currentCycle = Math.floor(this.timeStep / CYCLE_LENGTH);
      const targetStep = (currentCycle + 1) * CYCLE_LENGTH + DAWN_STEP;
      this.executeInnRest(targetStep, "You sleep soundly at the inn. Good morning! HP and MP restored.");
    });
    container.add(sleepBtn);

    const waitBtn = this.add.text(boxX + boxW / 2, boxY + 58, "🌙 Wait Until Night", {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#aaaaff",
      backgroundColor: "#2a2a4e",
      padding: { x: 10, y: 4 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    waitBtn.on("pointerover", () => waitBtn.setColor("#ffd700"));
    waitBtn.on("pointerout", () => waitBtn.setColor("#aaaaff"));
    waitBtn.on("pointerdown", () => {
      const currentPos = ((this.timeStep % CYCLE_LENGTH) + CYCLE_LENGTH) % CYCLE_LENGTH;
      const currentCycle = Math.floor(this.timeStep / CYCLE_LENGTH);
      const targetStep = currentPos < NIGHT_STEP
        ? currentCycle * CYCLE_LENGTH + NIGHT_STEP
        : (currentCycle + 1) * CYCLE_LENGTH + NIGHT_STEP;
      this.executeInnRest(targetStep, "You rest at the inn and wait for nightfall. HP and MP restored.");
    });
    container.add(waitBtn);

    const cancelBtn = this.add.text(boxX + boxW / 2, boxY + 86, "Cancel", {
      fontSize: "12px",
      fontFamily: "monospace",
      color: "#ff8888",
      backgroundColor: "#2a2a4e",
      padding: { x: 12, y: 4 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    cancelBtn.on("pointerover", () => cancelBtn.setColor("#ffd700"));
    cancelBtn.on("pointerout", () => cancelBtn.setColor("#ff8888"));
    cancelBtn.on("pointerdown", () => this.dismissInnConfirmation());
    container.add(cancelBtn);

    this.innConfirmOverlay = container;
  }

  /** Execute inn rest: deduct gold, heal, advance time to target step with fade animation. */
  private executeInnRest(targetTimeStep: number, message: string): void {
    this.dismissInnConfirmation();
    const innCost = getInnCost(this.player.position.cityId);
    if (this.player.gold < innCost) {
      this.showMessage(`Not enough gold to rest! (Need ${innCost}g)`, "#ff6666");
      return;
    }

    // Fade to black
    this.cameras.main.fadeOut(800, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      // Apply rest effects while screen is black
      this.player.gold -= innCost;
      this.player.hp = this.player.maxHp;
      this.player.mp = this.player.maxMp;
      this.player.shortRestsRemaining = 2;
      this.timeStep = targetTimeStep;

      // Process any pending level-ups on inn (long) rest
      const levelResult = processPendingLevelUps(this.player);
      let fullMsg = message;
      if (levelResult.leveledUp) {
        fullMsg += ` 🎉 LEVEL UP to ${levelResult.newLevel}!`;
        for (const spell of levelResult.newSpells) {
          fullMsg += ` ✦ Learned ${spell.name}!`;
        }
        for (const ability of levelResult.newAbilities) {
          fullMsg += ` ⚡ Learned ${ability.name}!`;
        }
        if (levelResult.asiGained > 0) {
          fullMsg += ` ★ +${levelResult.asiGained} stat points!`;
        }
      }

      // Update visual tint to reflect new time of day
      this.applyDayNightTint();

      // Re-spawn city NPCs to reflect time change (fewer at night)
      this.respawnCityNpcs();

      this.updateHUD();
      this.autoSave();

      // Fade back in from black
      this.cameras.main.fadeIn(800, 0, 0, 0);
      this.showMessage(fullMsg, "#88ff88");

      if (levelResult.asiGained > 0 || this.player.pendingStatPoints > 0) {
        this.time.delayedCall(500, () => this.showStatOverlay());
      }
    });
  }

  /** Dismiss inn confirmation overlay. */
  private dismissInnConfirmation(): void {
    if (this.innConfirmOverlay) {
      this.innConfirmOverlay.destroy();
      this.innConfirmOverlay = null;
    }
  }

  /** Show a town picker overlay for Teleport/Fast Travel. Lists visited cities. */
  private showTownPicker(): void {
    if (this.townPickerOverlay) return;

    const w = MAP_WIDTH * TILE_SIZE;
    const h = MAP_HEIGHT * TILE_SIZE;

    // Determine which cities the player has visited (explored tiles with "c:<cityId>")
    const visitedCityIds = new Set<string>();
    for (const key of Object.keys(this.player.progression.exploredTiles)) {
      if (key.startsWith("c:")) {
        const cityId = key.split(",")[0].substring(2);
        visitedCityIds.add(cityId);
      }
    }

    const visitedCities = CITIES.filter((c) => visitedCityIds.has(c.id));

    const container = this.add.container(0, 0).setDepth(56);

    // Dim background
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.6);
    dim.fillRect(0, 0, w, h);
    dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    dim.on("pointerdown", () => this.dismissTownPicker());
    container.add(dim);

    const panelW = 240;
    const panelH = Math.min(60 + visitedCities.length * 22, h - 40);
    const px = (w - panelW) / 2;
    const py = (h - panelH) / 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a3e, 0.95);
    bg.fillRoundedRect(px, py, panelW, panelH, 8);
    bg.lineStyle(2, 0xffd700, 1);
    bg.strokeRoundedRect(px, py, panelW, panelH, 8);
    container.add(bg);

    const title = this.add.text(px + panelW / 2, py + 10, "🗺 Travel to...", {
      fontSize: "13px", fontFamily: "monospace", color: "#ffd700",
    }).setOrigin(0.5, 0);
    container.add(title);

    if (visitedCities.length === 0) {
      const noTowns = this.add.text(px + panelW / 2, py + 36, "No towns visited yet!", {
        fontSize: "11px", fontFamily: "monospace", color: "#ff8888",
      }).setOrigin(0.5, 0);
      container.add(noTowns);
    } else {
      let cy = py + 34;
      for (const city of visitedCities) {
        // Skip current city
        const isCurrent = this.player.position.inCity && this.player.position.cityId === city.id;
        const isCurrentChunk = !this.player.position.inCity && !this.player.position.inDungeon
          && this.player.position.chunkX === city.chunkX && this.player.position.chunkY === city.chunkY
          && this.player.position.x === city.tileX && this.player.position.y === city.tileY;
        const here = isCurrent || isCurrentChunk;
        const color = here ? "#666" : "#ccffcc";
        const label = here ? `${city.name} (here)` : city.name;
        const btn = this.add.text(px + panelW / 2, cy, label, {
          fontSize: "11px", fontFamily: "monospace", color,
        }).setOrigin(0.5, 0).setInteractive({ useHandCursor: !here });

        if (!here) {
          btn.on("pointerover", () => btn.setColor("#ffd700"));
          btn.on("pointerout", () => btn.setColor(color));
          btn.on("pointerdown", () => {
            // Deduct MP
            this.player.mp -= this.pendingTeleportCost;
            // Teleport to the city entrance on the overworld
            this.player.position.chunkX = city.chunkX;
            this.player.position.chunkY = city.chunkY;
            this.player.position.x = city.tileX;
            this.player.position.y = city.tileY;
            if (this.player.position.inDungeon) { this.player.position.inDungeon = false; this.player.position.dungeonId = ""; }
            if (this.player.position.inCity) { this.player.position.inCity = false; this.player.position.cityId = ""; }
            this.dismissTownPicker();
            audioEngine.playTeleportSFX();
            this.showMessage(`Teleported to ${city.name}!`, "#88ff88");
            this.renderMap();
            this.applyDayNightTint();
            this.createPlayer();
            this.updateHUD();
            this.autoSave();
          });
        }
        container.add(btn);
        cy += 20;
      }
    }

    // Cancel hint
    const hint = this.add.text(px + panelW / 2, py + panelH - 14, "Click outside to cancel", {
      fontSize: "9px", fontFamily: "monospace", color: "#666",
    }).setOrigin(0.5, 1);
    container.add(hint);

    this.townPickerOverlay = container;
  }

  /** Dismiss the town picker overlay. */
  private dismissTownPicker(): void {
    if (this.townPickerOverlay) {
      this.townPickerOverlay.destroy();
      this.townPickerOverlay = null;
    }
    this.pendingTeleportCost = 0;
  }

  /** Show bank deposit/withdraw overlay with interest info. */
  private showBankOverlay(): void {
    if (this.bankOverlay) return;

    // Apply interest before showing balance
    const currentDay = Math.floor(this.timeStep / CYCLE_LENGTH);
    const interest = applyBankInterest(this.player, currentDay);

    const container = this.add.container(0, 0).setDepth(55);
    const boxW = 280;
    const boxH = 140;
    const boxX = (MAP_WIDTH * TILE_SIZE - boxW) / 2;
    const boxY = (MAP_HEIGHT * TILE_SIZE - boxH) / 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.97);
    bg.fillRoundedRect(boxX, boxY, boxW, boxH, 8);
    bg.lineStyle(2, 0xc0a060, 1);
    bg.strokeRoundedRect(boxX, boxY, boxW, boxH, 8);
    container.add(bg);

    this.add.text(boxX + boxW / 2, boxY + 10, "🏦 Bank", {
      fontSize: "14px", fontFamily: "monospace", color: "#ffd700",
    }).setOrigin(0.5, 0).setDepth(56);
    container.add(container.last!);

    let statusText = `Balance: ${this.player.bankBalance}g  |  Gold: ${this.player.gold}g`;
    if (interest > 0) {
      statusText += `\n+${interest}g interest earned!`;
    }
    statusText += "\n2% daily interest on deposits";

    const info = this.add.text(boxX + boxW / 2, boxY + 30, statusText, {
      fontSize: "10px", fontFamily: "monospace", color: "#ccc", align: "center", lineSpacing: 3,
    }).setOrigin(0.5, 0);
    container.add(info);

    const btnY = boxY + 78;

    // Deposit button
    const depositBtn = this.add.text(boxX + boxW / 2 - 70, btnY, "Deposit 10g", {
      fontSize: "12px", fontFamily: "monospace", color: "#88ff88",
      backgroundColor: "#2a2a4e", padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    depositBtn.on("pointerover", () => depositBtn.setColor("#ffd700"));
    depositBtn.on("pointerout", () => depositBtn.setColor("#88ff88"));
    depositBtn.on("pointerdown", () => {
      const amount = Math.min(10, this.player.gold);
      if (amount > 0) {
        this.player.gold -= amount;
        this.player.bankBalance += amount;
        if (this.player.lastBankDay === 0) this.player.lastBankDay = currentDay;
        this.dismissBankOverlay();
        this.showBankOverlay();
        this.updateHUD();
        this.autoSave();
      }
    });
    container.add(depositBtn);

    // Deposit All button
    const depositAllBtn = this.add.text(boxX + boxW / 2, btnY, "Deposit All", {
      fontSize: "12px", fontFamily: "monospace", color: "#66dd66",
      backgroundColor: "#2a2a4e", padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    depositAllBtn.on("pointerover", () => depositAllBtn.setColor("#ffd700"));
    depositAllBtn.on("pointerout", () => depositAllBtn.setColor("#66dd66"));
    depositAllBtn.on("pointerdown", () => {
      if (this.player.gold > 0) {
        this.player.bankBalance += this.player.gold;
        this.player.gold = 0;
        if (this.player.lastBankDay === 0) this.player.lastBankDay = currentDay;
        this.dismissBankOverlay();
        this.showBankOverlay();
        this.updateHUD();
        this.autoSave();
      }
    });
    container.add(depositAllBtn);

    // Withdraw button
    const withdrawBtn = this.add.text(boxX + boxW / 2 + 70, btnY, "Withdraw 10g", {
      fontSize: "12px", fontFamily: "monospace", color: "#ffaa66",
      backgroundColor: "#2a2a4e", padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    withdrawBtn.on("pointerover", () => withdrawBtn.setColor("#ffd700"));
    withdrawBtn.on("pointerout", () => withdrawBtn.setColor("#ffaa66"));
    withdrawBtn.on("pointerdown", () => {
      const amount = Math.min(10, this.player.bankBalance);
      if (amount > 0) {
        this.player.bankBalance -= amount;
        this.player.gold += amount;
        this.dismissBankOverlay();
        this.showBankOverlay();
        this.updateHUD();
        this.autoSave();
      }
    });
    container.add(withdrawBtn);

    // Close button
    const closeBtn = this.add.text(boxX + boxW / 2, btnY + 30, "Close", {
      fontSize: "12px", fontFamily: "monospace", color: "#ff8888",
      backgroundColor: "#2a2a4e", padding: { x: 12, y: 4 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    closeBtn.on("pointerover", () => closeBtn.setColor("#ffd700"));
    closeBtn.on("pointerout", () => closeBtn.setColor("#ff8888"));
    closeBtn.on("pointerdown", () => this.dismissBankOverlay());
    container.add(closeBtn);

    this.bankOverlay = container;
  }

  /** Dismiss bank overlay. */
  private dismissBankOverlay(): void {
    if (this.bankOverlay) {
      this.bankOverlay.destroy();
      this.bankOverlay = null;
    }
  }

  /** Spawn small animated creature emitters near biome decoration tiles. */
  private spawnBiomeCreatures(chunk: WorldChunk): void {
    const DECO_CREATURES: Record<number, { texture: string; config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig }> = {
      [Terrain.Flower]: {
        texture: "particle_butterfly",
        config: {
          lifespan: 3000,
          speed: { min: 8, max: 20 },
          angle: { min: 200, max: 340 },
          scale: { start: 0.9, end: 0.4 },
          alpha: { start: 0.9, end: 0.2 },
          quantity: 1,
          frequency: 1200,
          gravityY: -5,
        },
      },
      [Terrain.Cactus]: {
        texture: "particle_snake",
        config: {
          lifespan: 4000,
          speedX: { min: -8, max: 8 },
          speedY: { min: -2, max: 2 },
          scale: { start: 0.8, end: 0.8 },
          alpha: { start: 0.85, end: 0.0 },
          quantity: 1,
          frequency: 3000,
          gravityY: 0,
        },
      },
      [Terrain.Geyser]: {
        texture: "particle_smoke",
        config: {
          lifespan: 2000,
          speedY: { min: -30, max: -60 },
          speedX: { min: -6, max: 6 },
          scale: { start: 0.5, end: 1.8 },
          alpha: { start: 0.7, end: 0.0 },
          quantity: 1,
          frequency: 400,
          gravityY: -8,
        },
      },
      [Terrain.Mushroom]: {
        texture: "particle_mosquito",
        config: {
          lifespan: 2500,
          speed: { min: 10, max: 25 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.7, end: 0.3 },
          alpha: { start: 0.9, end: 0.15 },
          quantity: 1,
          frequency: 900,
          gravityY: 0,
        },
      },
    };

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        if (!this.isExplored(x, y)) continue;
        const terrain = chunk.mapData[y][x];
        const entry = DECO_CREATURES[terrain];
        if (!entry) continue;
        const px = x * TILE_SIZE + TILE_SIZE / 2;
        const py = y * TILE_SIZE + TILE_SIZE / 2;
        const em = this.add.particles(px, py, entry.texture, entry.config);
        em.setDepth(12);
        this.biomeDecoEmitters.push(em);
      }
    }
  }

  // ─── Fog of War helpers (delegates to fogOfWar system) ─────────────────────────────────────────

  /** Check if a tile has been explored. */
  private isExplored(x: number, y: number): boolean {
    return this.fogOfWar.isExplored(x, y, this.player);
  }

  /** Reveal tiles in a radius around the player's current position. */
  private revealAround(radius = 2): void {
    this.fogOfWar.revealAround(this.player.position.x, this.player.position.y, radius, this.player);
    // Sync back to player state
    this.player.progression.exploredTiles = this.fogOfWar.getExploredTiles();
  }

  /** Update tile sprites for newly revealed tiles without full re-render. */
  private revealTileSprites(): void {
    if (this.player.position.inDungeon) {
      const dungeon = getDungeon(this.player.position.dungeonId);
      if (!dungeon) return;
      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          if (this.isExplored(x, y) && this.tileSprites[y]?.[x]) {
            const terrain = dungeon.mapData[y][x];
            let texKey = `tile_${terrain}`;
            if (terrain === Terrain.Chest) {
              const chest = getChestAt(x, y, { type: "dungeon", dungeonId: this.player.position.dungeonId });
              if (chest && this.player.progression.openedChests.includes(chest.id)) {
                texKey = "tile_chest_open";
              }
            }
            this.tileSprites[y][x].setTexture(texKey);
          }
        }
      }
    } else if (this.player.position.inCity) {
      const city = getCity(this.player.position.cityId);
      if (!city) return;
      const cityBiome = getTownBiome(city.chunkX, city.chunkY, city.tileX, city.tileY);
      const biomeFloorTex = `tile_${cityBiome}`;
      // Biome-appropriate wall texture
      const BIOME_WALL_MAP: Record<number, string> = {
        [Terrain.Grass]: "tile_citywall_wood",
        [Terrain.Forest]: "tile_citywall_moss",
        [Terrain.DeepForest]: "tile_citywall_moss",
        [Terrain.Sand]: "tile_citywall_sand",
        [Terrain.Tundra]: "tile_citywall_ice",
        [Terrain.Swamp]: "tile_citywall_dark",
        [Terrain.Volcanic]: "tile_citywall_volcanic",
        [Terrain.Canyon]: "tile_citywall_sand",
      };
      const biomeWallTex = BIOME_WALL_MAP[cityBiome] ?? `tile_${Terrain.CityWall}`;
      // Biome path texture
      const BIOME_PATH_MAP2: Record<number, string> = {
        [Terrain.Grass]: "tile_path_wood", [Terrain.Forest]: "tile_path_moss",
        [Terrain.DeepForest]: "tile_path_moss", [Terrain.Sand]: "tile_path_sand",
        [Terrain.Tundra]: "tile_path_gravel", [Terrain.Swamp]: "tile_path_dark",
        [Terrain.Volcanic]: "tile_path_lava", [Terrain.Canyon]: "tile_path_sand",
      };
      const biomePathTex = BIOME_PATH_MAP2[cityBiome] ?? "tile_path_cobble";
      // Shop-type colored carpet lookup
      const SHOP_CARPET_TEX: Record<string, string> = {
        weapon: "tile_carpet_weapon", armor: "tile_carpet_armor",
        general: "tile_carpet_general", magic: "tile_carpet_magic",
        bank: "tile_carpet_bank", inn: "tile_carpet_inn",
      };
      const shopCarpetMap = new Map<string, string>();
      for (const shop of city.shops) {
        const ct = SHOP_CARPET_TEX[shop.type];
        shopCarpetMap.set(`${shop.x},${shop.y}`, ct ?? biomeFloorTex);
      }
      const activeShopIdx = city ? this.getPlayerShopIndex(city) : -1;
      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          if (this.isExplored(x, y) && this.tileSprites[y]?.[x]) {
            const terrain = city.mapData[y][x];
            let texKey = `tile_${terrain}`;
            if (terrain === Terrain.CityFloor) texKey = biomeFloorTex;
            if (terrain === Terrain.CityWall) texKey = biomeWallTex;
            if (terrain === Terrain.Carpet) {
              const override = shopCarpetMap.get(`${x},${y}`);
              if (override) texKey = override;
            }
            if (terrain === Terrain.CityPath) texKey = biomePathTex;
            // Shop interior hidden from outside
            if (terrain === Terrain.ShopFloor) {
              const tileShopIdx = this.shopFloorMap.get(`${x},${y}`) ?? -1;
              if (tileShopIdx !== activeShopIdx) {
                texKey = biomeWallTex;
              }
            }
            this.tileSprites[y][x].setTexture(texKey);
          }
        }
      }
    } else {
      const chunk = getChunk(this.player.position.chunkX, this.player.position.chunkY);
      if (!chunk) return;
      for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
          if (this.isExplored(x, y) && this.tileSprites[y]?.[x]) {
            const terrain = chunk.mapData[y][x];
            let texKey = `tile_${terrain}`;
            // Use biome-colored town texture
            if (terrain === Terrain.Town) {
              const biome = getTownBiome(this.player.position.chunkX, this.player.position.chunkY, x, y);
              texKey = `tile_town_${biome}`;
            }
            if (terrain === Terrain.Chest) {
              const chest = getChestAt(x, y, { type: "overworld", chunkX: this.player.position.chunkX, chunkY: this.player.position.chunkY });
              if (chest && this.player.progression.openedChests.includes(chest.id)) {
                texKey = "tile_chest_open";
              }
            }
            // Show sparkle overlay if uncollected, otherwise real terrain
            if (hasSparkleAt(this.player.position.chunkX, this.player.position.chunkY, x, y)) {
              const tKey = `${this.player.position.chunkX},${this.player.position.chunkY},${x},${y}`;
              if (!this.player.progression.collectedTreasures.includes(tKey)) {
                texKey = `tile_${Terrain.MinorTreasure}`;
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
    this.hudRenderer.showMessage(text, color);
  }

  /** Rider offset when mounted: shift left so mount head/neck is visible, shift up to sit on mount back. */
  private static readonly MOUNT_RIDER_OFFSET_X = -3;
  private static readonly MOUNT_RIDER_OFFSET_Y = 8;

  private createPlayer(): void {
    if (this.playerSprite) {
      this.playerSprite.destroy();
    }
    if (this.mountSprite) {
      this.mountSprite.destroy();
      this.mountSprite = null;
    }

    const isMounted = this.player.mountId && !this.player.position.inDungeon && !this.player.position.inCity;
    const tileX = this.player.position.x * TILE_SIZE + TILE_SIZE / 2;
    const tileY = this.player.position.y * TILE_SIZE + TILE_SIZE / 2;

    // Player texture — prefer the equipped variant (reflects weapon/shield), fall back to base class texture
    const equippedKey = `player_equipped_${this.player.appearanceId}`;
    const baseKey = `player_${this.player.appearanceId}`;
    const playerKey = this.textures.exists(equippedKey) ? equippedKey : this.textures.exists(baseKey) ? baseKey : "player";

    if (isMounted) {
      // Render mount sprite beneath the player
      const mountKey = `mount_${this.player.mountId}`;
      this.mountSprite = this.add.sprite(tileX, tileY, mountKey);
      this.mountSprite.setDepth(9);

      // Render player sprite shifted left + up so it sits naturally on the mount
      this.playerSprite = this.add.sprite(
        tileX + OverworldScene.MOUNT_RIDER_OFFSET_X,
        tileY - OverworldScene.MOUNT_RIDER_OFFSET_Y,
        playerKey
      );
      this.playerSprite.setDepth(10);
    } else {
      this.playerSprite = this.add.sprite(tileX, tileY, playerKey);
      this.playerSprite.setDepth(10);
    }

    // (Re)generate the equipped texture so legs & equipment are rendered correctly
    this.refreshPlayerSprite();
  }

  /** Toggle mount / dismount with the T key. */
  private toggleMount(): void {
    if (this.isOverlayOpen()) return;
    if (this.player.position.inDungeon || this.player.position.inCity) {
      this.showMessage("Cannot ride mounts here.", "#ff6666");
      return;
    }

    if (this.player.mountId) {
      // Dismount
      const mount = getMount(this.player.mountId);
      this.player.mountId = "";
      this.createPlayer();
      this.updateHUD();
      this.showMessage(`Dismounted${mount ? ` ${mount.name}` : ""}.`);
    } else {
      // Find the best mount in inventory
      const ownedMounts = this.player.inventory.filter((i) => i.type === "mount" && i.mountId);
      if (ownedMounts.length === 0) {
        this.showMessage("No mount owned. Visit a stable!", "#ff6666");
        return;
      }
      // Pick the fastest mount available
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
      this.createPlayer();
      this.updateHUD();
      this.showMessage(`🐴 Mounted ${mount?.name ?? "mount"}!`, "#88ff88");
    }
  }

  /** Regenerate the player texture to reflect current equipment (weapon sprite).
   *  Uses a separate key so the base class texture stays clean for the title screen. */
  private refreshPlayerSprite(): void {
    const cls = getPlayerClass(this.player.appearanceId);
    const texKey = `player_equipped_${this.player.appearanceId}`;
    const weaponSpr = getActiveWeaponSprite(this.player.appearanceId, this.player.equippedWeapon);
    if (this.textures.exists(texKey)) this.textures.remove(texKey);

    const gfx = this.add.graphics();
    // Body
    gfx.fillStyle(cls.bodyColor, 1);
    gfx.fillRect(8, 10, 16, 16);
    // Clothing details
    this.drawClothingInline(gfx, cls.bodyColor, cls.clothingStyle);
    // Head (use custom appearance if set)
    const skinColor = this.player.customAppearance?.skinColor ?? cls.skinColor;
    gfx.fillStyle(skinColor, 1);
    gfx.fillCircle(16, 8, 6);
    // Hair
    if (this.player.customAppearance && this.player.customAppearance.hairStyle > 0) {
      gfx.fillStyle(this.player.customAppearance.hairColor, 1);
      const hs = this.player.customAppearance.hairStyle;
      if (hs === 1) {
        gfx.fillRect(11, 2, 10, 4);
      } else if (hs === 2) {
        gfx.fillRect(10, 1, 12, 5);
        gfx.fillRect(9, 4, 4, 6);
        gfx.fillRect(19, 4, 4, 6);
      } else if (hs === 3) {
        gfx.fillRect(10, 1, 12, 5);
        gfx.fillRect(8, 3, 5, 14);
        gfx.fillRect(19, 3, 5, 14);
      }
    }
    // Legs — when mounted only draw the near-side leg (far leg hidden behind mount body)
    gfx.fillStyle(cls.legColor, 1);
    const isMounted = !!this.player.mountId && !this.player.position.inDungeon && !this.player.position.inCity;
    if (isMounted) {
      gfx.fillRect(12, 24, 6, 5);
    } else {
      gfx.fillRect(9, 26, 5, 6);
      gfx.fillRect(18, 26, 5, 6);
    }
    // Weapon from current equipment
    this.drawWeaponInline(gfx, weaponSpr);
    // Shield (if equipped and weapon is not two-handed)
    this.drawShieldInline(gfx, !!this.player.equippedShield && !this.player.equippedWeapon?.twoHanded);

    gfx.generateTexture(texKey, TILE_SIZE, TILE_SIZE);
    gfx.destroy();

    this.playerSprite.setTexture(texKey);
  }

  /** Inline clothing drawing for OverworldScene sprite refresh. */
  private drawClothingInline(
    gfx: Phaser.GameObjects.Graphics,
    bodyColor: number,
    clothingStyle: string
  ): void {
    const darker = (c: number) => {
      const r = Math.max(0, ((c >> 16) & 0xff) - 40);
      const g = Math.max(0, ((c >> 8) & 0xff) - 40);
      const b = Math.max(0, (c & 0xff) - 40);
      return (r << 16) | (g << 8) | b;
    };
    const lighter = (c: number) => {
      const r = Math.min(255, ((c >> 16) & 0xff) + 50);
      const g = Math.min(255, ((c >> 8) & 0xff) + 50);
      const b = Math.min(255, (c & 0xff) + 50);
      return (r << 16) | (g << 8) | b;
    };

    switch (clothingStyle) {
      case "heavy":
        gfx.fillStyle(lighter(bodyColor), 1);
        gfx.fillRect(6, 10, 4, 5);
        gfx.fillRect(22, 10, 4, 5);
        gfx.fillStyle(darker(bodyColor), 1);
        gfx.fillRect(12, 14, 8, 2);
        gfx.fillRect(14, 10, 4, 2);
        break;
      case "robe":
        gfx.fillStyle(darker(bodyColor), 1);
        gfx.fillRect(6, 12, 3, 16);
        gfx.fillRect(23, 12, 3, 16);
        gfx.fillStyle(lighter(bodyColor), 1);
        gfx.fillRect(13, 10, 6, 1);
        gfx.fillRect(10, 25, 12, 2);
        break;
      case "leather":
        gfx.fillStyle(darker(bodyColor), 1);
        gfx.fillRect(10, 12, 2, 10);
        gfx.fillRect(20, 12, 2, 10);
        gfx.fillStyle(lighter(bodyColor), 1);
        gfx.fillRect(12, 22, 8, 2);
        break;
      case "vestment":
        gfx.fillStyle(lighter(bodyColor), 1);
        gfx.fillRect(13, 10, 2, 14);
        gfx.fillRect(17, 10, 2, 14);
        gfx.fillStyle(0xffd700, 1);
        gfx.fillRect(14, 12, 4, 4);
        gfx.fillRect(15, 11, 2, 1);
        break;
      case "bare":
        gfx.fillStyle(darker(bodyColor), 1);
        gfx.fillRect(10, 11, 12, 1);
        gfx.fillRect(11, 12, 2, 8);
        gfx.fillRect(19, 12, 2, 8);
        gfx.fillStyle(0x5d4037, 1);
        gfx.fillRect(8, 10, 3, 2);
        gfx.fillRect(21, 10, 3, 2);
        break;
      case "wrap":
        gfx.fillStyle(darker(bodyColor), 1);
        gfx.fillRect(10, 20, 12, 3);
        gfx.fillStyle(lighter(bodyColor), 1);
        gfx.fillRect(8, 14, 2, 6);
        gfx.fillRect(22, 14, 2, 6);
        gfx.fillRect(14, 10, 4, 1);
        break;
      case "performer":
        gfx.fillStyle(lighter(bodyColor), 1);
        gfx.fillRect(6, 10, 3, 14);
        gfx.fillStyle(darker(bodyColor), 1);
        gfx.fillRect(12, 22, 8, 2);
        gfx.fillStyle(0xffd700, 1);
        gfx.fillRect(13, 10, 6, 1);
        gfx.fillRect(15, 22, 2, 2);
        break;
    }
  }

  /** Inline weapon drawing for OverworldScene sprite refresh. */
  private drawWeaponInline(
    gfx: Phaser.GameObjects.Graphics,
    weaponSprite: string
  ): void {
    switch (weaponSprite) {
      case "sword":
        gfx.fillStyle(0xb0bec5, 1);
        gfx.fillRect(26, 6, 3, 18);
        gfx.fillStyle(0x795548, 1);
        gfx.fillRect(24, 20, 7, 3);
        break;
      case "staff":
        gfx.fillStyle(0x5d4037, 1);
        gfx.fillRect(27, 4, 2, 22);
        gfx.fillStyle(0x64ffda, 1);
        gfx.fillCircle(28, 4, 3);
        break;
      case "dagger":
        gfx.fillStyle(0xb0bec5, 1);
        gfx.fillRect(26, 14, 2, 10);
        gfx.fillStyle(0x795548, 1);
        gfx.fillRect(25, 22, 4, 2);
        break;
      case "bow":
        gfx.fillStyle(0x795548, 1);
        gfx.fillRect(27, 5, 2, 20);
        gfx.fillStyle(0xbdbdbd, 1);
        gfx.fillRect(29, 7, 1, 16);
        break;
      case "mace":
        gfx.fillStyle(0x795548, 1);
        gfx.fillRect(27, 12, 2, 14);
        gfx.fillStyle(0xb0bec5, 1);
        gfx.fillRect(25, 8, 6, 6);
        break;
      case "axe":
        gfx.fillStyle(0x795548, 1);
        gfx.fillRect(27, 6, 2, 18);
        gfx.fillStyle(0xb0bec5, 1);
        gfx.fillRect(24, 6, 5, 8);
        break;
      case "fist":
        gfx.fillStyle(0xbdbdbd, 1);
        gfx.fillRect(25, 16, 6, 6);
        gfx.fillStyle(0x9e9e9e, 1);
        gfx.fillRect(25, 17, 6, 1);
        gfx.fillRect(25, 19, 6, 1);
        break;
    }
  }

  /** Inline shield drawing for OverworldScene sprite refresh. */
  private drawShieldInline(gfx: Phaser.GameObjects.Graphics, hasShield: boolean): void {
    if (!hasShield) return;
    // Shield body (wood base)
    gfx.fillStyle(0x795548, 1);
    gfx.fillRect(1, 12, 6, 10);
    // Shield face (metal)
    gfx.fillStyle(0x90a4ae, 1);
    gfx.fillRect(2, 13, 4, 8);
    // Shield emblem (cross)
    gfx.fillStyle(0xffd700, 1);
    gfx.fillRect(3, 15, 2, 4);
    gfx.fillRect(2, 16, 4, 2);
  }

  private setupInput(): void {
    this.keys = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      SPACE: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    };

    // C key opens codex
    const cKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    cKey.on("down", () => this.openCodex());

    // E key toggles equipment overlay
    const eKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    eKey.on("down", () => this.toggleEquipOverlay());

    // M key opens game menu
    const mKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    mKey.on("down", () => {
      if (this.settingsOverlay) {
        this.toggleSettingsOverlay();
      } else {
        this.toggleMenuOverlay();
      }
    });

    // N key opens world map overlay
    const nKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.N);
    nKey.on("down", () => this.toggleWorldMap());

    // T key toggles mount / dismount
    const tKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.T);
    tKey.on("down", () => this.toggleMount());
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
    if (p.position.inDungeon) {
      const dungeon = getDungeon(p.position.dungeonId);
      regionName = dungeon ? `🔻 ${dungeon.name}` : "Dungeon";
    } else {
      const chunk = getChunk(p.position.chunkX, p.position.chunkY);
      regionName = chunk?.name ?? "Unknown";
    }
    const asiHint = p.pendingStatPoints > 0 ? `  ★ ${p.pendingStatPoints} Stat Pts` : "";
    const timeLabel = p.position.inDungeon ? PERIOD_LABEL[TimePeriod.Dungeon] : PERIOD_LABEL[getTimePeriod(this.timeStep)];
    const weatherLabel = WEATHER_LABEL[this.weatherState.current];
    const mountLabel = (p.mountId && !p.position.inDungeon && !p.position.inCity) ? `  🐴 ${getMount(p.mountId)?.name ?? "Mount"}` : "";
    this.hudText.setText(
      `${p.name} Lv.${p.level}  —  ${regionName}  ${timeLabel}  ${weatherLabel}${mountLabel}\n` +
        `HP: ${p.hp}/${p.maxHp}  MP: ${p.mp}/${p.maxMp}  Gold: ${p.gold}${asiHint}`
    );
  }

  private updateLocationText(): void {
    // In dungeon: show dungeon-specific text
    if (this.player.position.inDungeon) {
      const dungeon = getDungeon(this.player.position.dungeonId);
      if (!dungeon) { this.locationText.setText("???"); return; }
      const terrain = dungeon.mapData[this.player.position.y]?.[this.player.position.x];
      if (terrain === Terrain.DungeonExit) {
        this.locationText.setText(`${dungeon.name}\n[SPACE] Exit Dungeon`);
      } else if (terrain === Terrain.Chest) {
        const chest = getChestAt(this.player.position.x, this.player.position.y, { type: "dungeon", dungeonId: this.player.position.dungeonId });
        if (chest && !this.player.progression.openedChests.includes(chest.id)) {
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
    if (this.player.position.inCity) {
      const city = getCity(this.player.position.cityId);
      if (!city) { this.locationText.setText("???"); return; }
      const terrain = city.mapData[this.player.position.y]?.[this.player.position.x];
      if (terrain === Terrain.CityExit) {
        this.locationText.setText(`${city.name}\n[SPACE] Leave City`);
      } else {
        const shop = getCityShopNearby(city, this.player.position.x, this.player.position.y);
        if (shop) {
          this.locationText.setText(`${shop.name}`);
        } else {
          this.locationText.setText(city.name);
        }
      }
      return;
    }

    const terrain = getTerrainAt(this.player.position.chunkX, this.player.position.chunkY, this.player.position.x, this.player.position.y);
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

    const chunk = getChunk(this.player.position.chunkX, this.player.position.chunkY);
    const town = chunk?.towns.find(
      (t) => t.x === this.player.position.x && t.y === this.player.position.y
    );
    const boss = chunk?.bosses.find(
      (b) => b.x === this.player.position.x && b.y === this.player.position.y
    );

    let locStr = TERRAIN_DISPLAY_NAMES[terrain ?? 0] ?? "Unknown";
    if (town) {
      const city = getCityForTown(this.player.position.chunkX, this.player.position.chunkY, town.x, town.y);
      locStr = city ? `${town.name}\n[SPACE] Enter City` : `${town.name}\n[SPACE] Enter Shop`;
    }
    if (boss && !this.defeatedBosses.has(boss.monsterId))
      locStr = `${boss.name}'s Lair\n[SPACE] Challenge Boss`;

    // Dungeon entrance hint
    if (terrain === Terrain.Dungeon) {
      const dungeon = getDungeonAt(this.player.position.chunkX, this.player.position.chunkY, this.player.position.x, this.player.position.y);
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
      const chest = getChestAt(this.player.position.x, this.player.position.y, { type: "overworld", chunkX: this.player.position.chunkX, chunkY: this.player.position.chunkY });
      if (chest && !this.player.progression.openedChests.includes(chest.id)) {
        locStr = `Treasure Chest\n[SPACE] Open`;
      } else {
        locStr = "Opened Chest";
      }
    }

    this.locationText.setText(locStr);
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
      `Bosses: ${this.defeatedBosses.size} | Chests: ${p.progression.openedChests.length}`
    );
  }

  /** Check whether any overlay (menu, map, equip, stat allocation) is currently open. */
  private isOverlayOpen(): boolean {
    return !!(this.menuOverlay || this.worldMapOverlay || this.equipOverlay || this.statOverlay || this.settingsOverlay);
  }

  /** Tween the player (and mount sprite if mounted) to a tile position. */
  private tweenPlayerTo(tileX: number, tileY: number, duration: number, onComplete: () => void): void {
    const destX = tileX * TILE_SIZE + TILE_SIZE / 2;
    const destY = tileY * TILE_SIZE + TILE_SIZE / 2;

    this.tweens.add({
      targets: this.playerSprite,
      x: destX + (this.mountSprite ? OverworldScene.MOUNT_RIDER_OFFSET_X : 0),
      y: destY - (this.mountSprite ? OverworldScene.MOUNT_RIDER_OFFSET_Y : 0),
      duration,
      onComplete,
    });

    if (this.mountSprite) {
      this.tweens.add({
        targets: this.mountSprite,
        x: destX,
        y: destY,
        duration,
      });
    }
  }

  /** Get move delay adjusted for mount speed. Mounts only apply on the overworld (not in dungeons/cities). */
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
    if (this.isMoving) return;
    if (this.isOverlayOpen()) return; // block movement when menus/maps are open
    if (time - this.lastMoveTime < this.getEffectiveMoveDelay()) return;

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
    let newX = this.player.position.x + dx;
    let newY = this.player.position.y + dy;

    // In dungeon: no chunk transitions, just wall checks
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

      // Footstep sound for dungeon terrain
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

    // In city: no chunk transitions, no encounters
    if (this.player.position.inCity) {
      // Dismiss any open overlays when moving
      this.dismissDialogue();
      this.dismissInnConfirmation();
      this.dismissBankOverlay();

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

      // Shop interior only accessible via the carpet entrance
      if (targetTerrain === Terrain.ShopFloor) {
        const curTerrain = city.mapData[this.player.position.y]?.[this.player.position.x];
        if (curTerrain !== Terrain.Carpet && curTerrain !== Terrain.ShopFloor) {
          return;
        }
      }

      // Shop exit only through the carpet (door)
      const curTerrain = city.mapData[this.player.position.y]?.[this.player.position.x];
      if (curTerrain === Terrain.ShopFloor && targetTerrain !== Terrain.ShopFloor && targetTerrain !== Terrain.Carpet) {
        return; // silently block — must leave through the door
      }

      this.lastMoveTime = time;
      this.isMoving = true;
      this.player.position.x = newX;
      this.player.position.y = newY;

      // Footstep sound for city terrain
      if (audioEngine.initialized) audioEngine.playFootstepSFX(targetTerrain);

      this.tweenPlayerTo(newX, newY, 120, () => {
        this.isMoving = false;
        this.advanceTime();
        this.revealAround();
        this.revealTileSprites();
        this.updateHUD();
        this.updateLocationText();
        this.updateShopRoofAlpha();
        // No encounters in cities
      });
      return;
    }

    let newChunkX = this.player.position.chunkX;
    let newChunkY = this.player.position.chunkY;

    // Dismiss any open dialogue overlay when moving on the overworld
    this.dismissDialogue();

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

    // ── Shared position resolution via tryGridMove ──────────────
    const result = tryGridMove(this.player, dx, dy);
    if (!result.moved) {
      if (!this.player.position.inDungeon && !this.player.position.inCity) {
        debugLog("Blocked move", { dx, dy });
      }
      return;
    }

    this.lastMoveTime = time;
    this.isMoving = true;

    // Handle chunk transition (overworld only)
    if (result.chunkChanged) {
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

    // ── Footstep audio ─────────────────────────────────────────
    if (audioEngine.initialized && result.newTerrain !== undefined) {
      if (!this.player.position.inDungeon && !this.player.position.inCity && this.player.mountId) {
        audioEngine.playMountedFootstepSFX();
      } else {
        audioEngine.playFootstepSFX(result.newTerrain);
      }
    }

    // ── Tween to new position + post-move callbacks ────────────
    this.tweenPlayerTo(this.player.position.x, this.player.position.y, 120, () => {
      this.isMoving = false;
      this.advanceTime();
      this.revealAround();
      this.revealTileSprites();
      if (!this.player.position.inCity) this.collectMinorTreasure();
      this.updateHUD();
      this.updateLocationText();
      if (this.player.position.inCity) {
        this.updateShopRoofAlpha();
      } else {
        this.checkEncounter(result.newTerrain!);
      }
    });
  }

  /** Auto-collect minor treasure when stepping on it. Awards 5-25 gold. */
  private collectMinorTreasure(): void {
    const px = this.player.position.x;
    const py = this.player.position.y;

    if (this.player.position.inDungeon) return; // no minor treasures in dungeons

    if (!hasSparkleAt(this.player.position.chunkX, this.player.position.chunkY, px, py)) return;

    const key = `${this.player.position.chunkX},${this.player.position.chunkY},${px},${py}`;
    if (this.player.progression.collectedTreasures.includes(key)) return;

    this.player.progression.collectedTreasures.push(key);
    const goldAmount = 5 + Math.floor(Math.random() * 21); // 5-25
    this.player.gold += goldAmount;

    // Update tile sprite to show real terrain underneath
    const terrain = getTerrainAt(this.player.position.chunkX, this.player.position.chunkY, px, py);
    if (this.tileSprites[py]?.[px] && terrain !== undefined) {
      const realTexKey = terrain === Terrain.Town
        ? `tile_town_${getTownBiome(this.player.position.chunkX, this.player.position.chunkY, px, py)}`
        : `tile_${terrain}`;
      this.tileSprites[py][px].setTexture(realTexKey);
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

    // Debug: encounters can be toggled off
    if (isDebug() && !this.encounterSystem.areEncountersEnabled()) return;

    const mountEncMult = (!this.player.position.inDungeon && this.player.mountId) ? (getMount(this.player.mountId)?.encounterMultiplier ?? 1) : 1;
    const rate = ENCOUNTER_RATES[terrain] * getEncounterMultiplier(this.timeStep) * getWeatherEncounterMultiplier(this.weatherState.current) * mountEncMult;
    if (Math.random() < rate) {
      let monster;
      if (this.player.position.inDungeon) {
        monster = getDungeonEncounter(this.player.level, this.player.position.dungeonId);
      } else if (isNightTime(this.timeStep) && Math.random() < 0.4) {
        // 40% chance of a night-exclusive monster during dusk/night
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

  private handleAction(): void {
    // ── Dungeon exit: pressing SPACE on an exit tile inside a dungeon ──
    if (this.player.position.inDungeon) {
      const dungeon = getDungeon(this.player.position.dungeonId);
      if (!dungeon) return;
      const terrain = dungeon.mapData[this.player.position.y]?.[this.player.position.x];
      if (terrain === Terrain.DungeonExit) {
        // Return to overworld at the dungeon entrance tile
        this.player.position.inDungeon = false;
        this.player.position.dungeonId = "";
        this.player.position.chunkX = dungeon.entranceChunkX;
        this.player.position.chunkY = dungeon.entranceChunkY;
        this.player.position.x = dungeon.entranceTileX;
        this.player.position.y = dungeon.entranceTileY;
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
        const chest = getChestAt(this.player.position.x, this.player.position.y, { type: "dungeon", dungeonId: this.player.position.dungeonId });
        if (chest && !this.player.progression.openedChests.includes(chest.id)) {
          const item = getItem(chest.itemId);
          if (item) {
            this.player.progression.openedChests.push(chest.id);
            this.player.inventory.push({ ...item });
            if (audioEngine.initialized) audioEngine.playChestOpenSFX();
            // Auto-equip if better
            if (item.type === "weapon" && (!this.player.equippedWeapon || item.effect > this.player.equippedWeapon.effect)) {
              this.player.equippedWeapon = item;
              if (item.twoHanded) { this.player.equippedShield = null; this.player.equippedOffHand = null; }
              if (!isLightWeapon(item)) { this.player.equippedOffHand = null; }
              this.refreshPlayerSprite();
            }
            if (item.type === "armor" && (!this.player.equippedArmor || item.effect > this.player.equippedArmor.effect)) {
              this.player.equippedArmor = item;
            }
            if (item.type === "shield" && !this.player.equippedWeapon?.twoHanded && (!this.player.equippedShield || item.effect > this.player.equippedShield.effect)) {
              this.player.equippedShield = item;
              this.refreshPlayerSprite();
            }
            this.showMessage(`🎁 Found ${item.name}!`);
            this.updateHUD();
            this.autoSave();
          }
        } else if (chest && this.player.progression.openedChests.includes(chest.id)) {
          this.showMessage("Already opened.", "#666666");
        }
        return;
      }
      return;
    }

    // ── City actions: exit, NPC dialogue, and shop interaction ──
    if (this.player.position.inCity) {
      // If a dialogue is showing, dismiss it
      if (this.dialogueOverlay) {
        this.dismissDialogue();
        return;
      }
      // If inn confirmation is showing, dismiss it
      if (this.innConfirmOverlay) {
        this.dismissInnConfirmation();
        return;
      }
      // If bank overlay is showing, dismiss it
      if (this.bankOverlay) {
        this.dismissBankOverlay();
        return;
      }

      const city = getCity(this.player.position.cityId);
      if (!city) return;
      const terrain = city.mapData[this.player.position.y]?.[this.player.position.x];
      if (terrain === Terrain.CityExit) {
        // Return to overworld at the town tile
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
          player: this.player,
          defeatedBosses: this.defeatedBosses,
          bestiary: this.bestiary,
          timeStep: this.timeStep,
          weatherState: this.weatherState,
        });
        return;
      }

      // Check if adjacent to or on an NPC
      const npcResult = this.findAdjacentNpc();
      if (npcResult) {
        const { npcDef, npcIndex } = npcResult;
        // Shopkeeper NPC → show dialogue, then open shop
        if (npcDef.shopIndex !== undefined) {
          const shop = city.shops[npcDef.shopIndex];
          if (shop) {
            if (shop.type === "inn") {
              this.showNpcDialogue(npcDef, npcIndex, city);
              // After a short delay, show inn confirmation
              this.time.delayedCall(300, () => {
                this.dismissDialogue();
                this.showInnConfirmation();
              });
              return;
            }
            // Only the inn is open at night — all other shops (including bank) are closed
            const period = getTimePeriod(this.timeStep);
            if (period === TimePeriod.Night) {
              this.showMessage("The shop is closed for the night. Come back in the morning!", "#ff8888");
              return;
            }
            if (shop.type === "bank") {
              this.showNpcDialogue(npcDef, npcIndex, city);
              this.time.delayedCall(800, () => {
                this.dismissDialogue();
                this.showBankOverlay();
              });
              return;
            }
            // Other shopkeepers → dialogue then open shop
            this.showNpcDialogue(npcDef, npcIndex, city);
            this.time.delayedCall(800, () => {
              this.dismissDialogue();
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
            });
            return;
          }
        }
        // Regular NPC → show dialogue
        this.showNpcDialogue(npcDef, npcIndex, city);
        return;
      }

      // Check if adjacent to a city animal
      const animalResult = this.findAdjacentAnimal();
      if (animalResult) {
        this.showAnimalDialogue(animalResult.spriteName);
        return;
      }

      // No fallback tile-based shop opening — shops only open via shopkeeper NPCs
      return;
    }

    // ── Overworld actions ──
    const chunk = getChunk(this.player.position.chunkX, this.player.position.chunkY);
    if (!chunk) return;

    // If a dialogue is showing, dismiss it
    if (this.dialogueOverlay) {
      this.dismissDialogue();
      return;
    }

    // Check if adjacent to a special (rare) NPC on the overworld
    const specialResult = this.findAdjacentSpecialNpc();
    if (specialResult) {
      this.interactSpecialNpc(specialResult.index);
      return;
    }

    // Check if on a town
    const town = chunk.towns.find(
      (t) => t.x === this.player.position.x && t.y === this.player.position.y
    );
    if (town?.hasShop) {
      // Track this town as the last visited (respawn point on death)
      this.player.lastTownX = town.x;
      this.player.lastTownY = town.y;
      this.player.lastTownChunkX = this.player.position.chunkX;
      this.player.lastTownChunkY = this.player.position.chunkY;

      // Check if this town has an explorable city layout
      const city = getCityForTown(this.player.position.chunkX, this.player.position.chunkY, town.x, town.y);
      if (city) {
        // Auto-dismount when entering a city
        if (this.player.mountId) {
          this.player.mountId = "";
        }
        // Enter the city interior
        this.player.position.inCity = true;
        this.player.position.cityId = city.id;
        debugPanelLog(`[CITY] Entered ${city.name}`, true);
        this.player.position.x = city.spawnX;
        this.player.position.y = city.spawnY;
        this.weatherState.current = WeatherType.Clear;
        // Reveal all city tiles — cities are always fully visible
        for (let ty = 0; ty < MAP_HEIGHT; ty++) {
          for (let tx = 0; tx < MAP_WIDTH; tx++) {
            this.player.progression.exploredTiles[`c:${city.id},${tx},${ty}`] = true;
          }
        }
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
      // Auto-dismount when entering a shop
      if (this.player.mountId) {
        this.player.mountId = "";
      }
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
        savedSpecialNpcs: this.snapshotSpecialNpcs(),
      });
      return;
    }

    // Check if on a dungeon entrance tile
    const terrain = getTerrainAt(this.player.position.chunkX, this.player.position.chunkY, this.player.position.x, this.player.position.y);
    if (terrain === Terrain.Dungeon) {
      const dungeon = getDungeonAt(
        this.player.position.chunkX,
        this.player.position.chunkY,
        this.player.position.x,
        this.player.position.y
      );
      if (dungeon) {
        const hasKey = this.player.inventory.some((i) => i.id === "dungeonKey");
        if (hasKey || isDebug()) {
          // Auto-dismount when entering a dungeon
          if (this.player.mountId) {
            this.player.mountId = "";
          }
          // Enter the dungeon — force clear weather (closed space)
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
      const chest = getChestAt(this.player.position.x, this.player.position.y, { type: "overworld", chunkX: this.player.position.chunkX, chunkY: this.player.position.chunkY });
      if (chest && !this.player.progression.openedChests.includes(chest.id)) {
        const item = getItem(chest.itemId);
        if (item) {
          this.player.progression.openedChests.push(chest.id);
          this.player.inventory.push({ ...item });
          if (audioEngine.initialized) audioEngine.playChestOpenSFX();
          if (item.type === "weapon" && (!this.player.equippedWeapon || item.effect > this.player.equippedWeapon.effect)) {
            this.player.equippedWeapon = item;
            if (item.twoHanded) { this.player.equippedShield = null; this.player.equippedOffHand = null; }
            if (!isLightWeapon(item)) { this.player.equippedOffHand = null; }
            this.refreshPlayerSprite();
          }
          if (item.type === "armor" && (!this.player.equippedArmor || item.effect > this.player.equippedArmor.effect)) {
            this.player.equippedArmor = item;
          }
          if (item.type === "shield" && !this.player.equippedWeapon?.twoHanded && (!this.player.equippedShield || item.effect > this.player.equippedShield.effect)) {
            this.player.equippedShield = item;
            this.refreshPlayerSprite();
          }
          this.showMessage(`🎁 Found ${item.name}!`);
          this.updateHUD();
          this.autoSave();
        }
      } else if (chest && this.player.progression.openedChests.includes(chest.id)) {
        this.showMessage("Already opened.", "#666666");
      }
      return;
    }

    // Check if on a boss tile
    const boss = chunk.bosses.find(
      (b) => b.x === this.player.position.x && b.y === this.player.position.y
    );
    if (boss && !this.defeatedBosses.has(boss.monsterId)) {
      const monster = getBoss(boss.monsterId);
      if (monster) {
        this.startBattle(monster, Terrain.Boss);
      }
    }
  }

  /** Map terrain to a biome string for battle backgrounds. */
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
        player: this.player,
        monster,
        defeatedBosses: this.defeatedBosses,
        bestiary: this.bestiary,
        timeStep: this.timeStep,
        weatherState: this.weatherState,
        biome: this.terrainToBiome(terrain),
        savedSpecialNpcs: this.snapshotSpecialNpcs(),
      });
    });
  }

  private openCodex(): void {
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
      savedSpecialNpcs: this.snapshotSpecialNpcs(),
    });
  }

  private autoSave(): void {
    saveGame(this.player, this.defeatedBosses, this.bestiary, this.player.appearanceId, this.timeStep, this.weatherState);
  }

  /** Snapshot active special NPCs so they survive scene transitions. */
  private snapshotSpecialNpcs(): SavedSpecialNpc[] {
    return this.specialNpcDefs
      .filter((_entry, i) => {
        const spr = this.specialNpcSprites[i];
        return spr && spr.active;
      })
      .map((entry) => ({
        kind: entry.def.kind,
        x: entry.x,
        y: entry.y,
        interactions: entry.interactions,
      }));
  }

  /** Advance the day/night cycle by one step and update the map tint. */
  private advanceTime(): void {
    // Time stands still inside cities and dungeons.
    if (this.player.position.inCity || this.player.position.inDungeon) return;

    const oldPeriod = getTimePeriod(this.timeStep);
    this.timeStep = (this.timeStep + 1) % CYCLE_LENGTH;
    const newPeriod = getTimePeriod(this.timeStep);

    // Advance weather step countdown (can also shift naturally over time)
    const biomeName = getChunk(this.player.position.chunkX, this.player.position.chunkY)?.name ?? "Heartlands";
    const weatherChanged = advanceWeather(this.weatherState, biomeName, this.timeStep);

    if (oldPeriod !== newPeriod || weatherChanged) {
      this.applyDayNightTint();
      if (weatherChanged) this.updateWeatherParticles();
      this.updateAudio();
    }
  }

  /**
   * Re-roll weather for the current biome (called on chunk transition and town entry).
   * Updates tint and particle effects if the weather changed.
   */
  private rerollWeather(): void {
    const biomeName = getChunk(this.player.position.chunkX, this.player.position.chunkY)?.name ?? "Heartlands";
    const weatherChanged = changeZoneWeather(this.weatherState, biomeName, this.timeStep);
    if (weatherChanged) {
      this.applyDayNightTint();
      this.updateWeatherParticles();
      this.updateAudio();
    }
  }

  /** Start or update biome music and weather SFX to match the current state. */
  private updateAudio(): void {
    if (!audioEngine.initialized) return;
    const chunk = getChunk(this.player.position.chunkX, this.player.position.chunkY);
    const biomeName = chunk?.name ?? "Heartlands";
    const period = getTimePeriod(this.timeStep);
    audioEngine.playBiomeMusic(biomeName, period);
    audioEngine.playWeatherSFX(this.weatherState.current);
  }

  /** Apply a color tint to all map tiles based on time period + weather. */
  private applyDayNightTint(): void {
    const period = this.player.position.inDungeon ? TimePeriod.Dungeon : getTimePeriod(this.timeStep);
    const dayTint = PERIOD_TINT[period];
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

    this.equipPage = "gear";
    this.gearWeaponPage = 0;
    this.gearOffHandPage = 0;
    this.gearArmorPage = 0;
    this.gearShieldPage = 0;
    this.gearMountPage = 0;
    this.itemsPage = 0;
    this.spellsPage = 0;
    this.abilitiesPage = 0;
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
    const panelH = 470;
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

    // --- Tab bar ---
    const tabY = py + 8;
    const tabCount = 3;
    const tabPositions = [0.17, 0.5, 0.83];
    const tabs: { label: string; page: "gear" | "skills" | "items" }[] = [
      { label: "⚔ Gear", page: "gear" },
      { label: "✦ Skills", page: "skills" },
      { label: "🎒 Items", page: "items" },
    ];
    const ulGfx = this.add.graphics();
    ulGfx.lineStyle(2, 0xffd700, 1);
    for (let t = 0; t < tabCount; t++) {
      const tx = px + panelW * tabPositions[t];
      const tab = this.add.text(tx, tabY, tabs[t].label, {
        fontSize: "12px", fontFamily: "monospace",
        color: this.equipPage === tabs[t].page ? "#ffd700" : "#888",
      }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
      const pg = tabs[t].page;
      tab.on("pointerdown", () => { this.equipPage = pg; this.buildEquipOverlay(); });
      this.equipOverlay.add(tab);
      if (this.equipPage === tabs[t].page) {
        ulGfx.lineBetween(tx - 28, tabY + 16, tx + 28, tabY + 16);
      }
    }
    this.equipOverlay.add(ulGfx);

    if (this.equipPage === "gear") {
      this.buildEquipGearPage(px, py + 28, panelW, panelH - 28);
    } else if (this.equipPage === "skills") {
      this.buildEquipSkillsPage(px, py + 28, panelW, panelH - 28);
    } else {
      this.buildEquipItemsPage(px, py + 28, panelW, panelH - 28);
    }

    // Close hint
    const hint = this.add.text(px + panelW / 2, py + panelH - 14, "Press E or click to close", {
      fontSize: "10px",
      fontFamily: "monospace",
      color: "#666",
    }).setOrigin(0.5, 1);
    this.equipOverlay.add(hint);
  }

  /** Gear page content (header, stats, equipment, mounts). */
  private buildEquipGearPage(px: number, py: number, panelW: number, _panelH: number): void {
    const p = this.player;
    const ac = getArmorClass(p);
    let cy = py + 6;

    // --- Header stats ---
    const xpNeeded = xpForLevel(p.level + 1);
    const header = this.add.text(px + 14, cy, [
      `${p.name}  Lv.${p.level}`,
      `HP: ${p.hp}/${p.maxHp}   MP: ${p.mp}/${p.maxMp}   AC: ${ac}`,
      `EXP: ${p.xp}/${xpNeeded}  (${xpNeeded - p.xp} to next)`,
    ].join("\n"), {
      fontSize: "11px", fontFamily: "monospace", color: "#ccc", lineSpacing: 4,
    });
    this.equipOverlay!.add(header);
    cy += 48;

    // --- Ability Scores (right after EXP) ---
    const fmtStat = (label: string, val: number) => {
      const mod = abilityModifier(val);
      const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
      const padVal = val < 10 ? ` ${val}` : `${val}`;
      return `${label} ${padVal} (${modStr})`;
    };
    const appearance = getPlayerClass(p.appearanceId);
    const primaryVal = p.stats[appearance.primaryStat];
    const primaryMod = abilityModifier(primaryVal);
    const profBonus = Math.floor((p.level - 1) / 4) + 2;
    const toHit = primaryMod + profBonus;
    const toHitStr = toHit >= 0 ? `+${toHit}` : `${toHit}`;
    const statsBlock = this.add.text(px + 14, cy, [
      `― Stats ―  To-Hit: ${toHitStr}`,
      `${fmtStat("STR", p.stats.strength)}  ${fmtStat("DEX", p.stats.dexterity)}`,
      `${fmtStat("CON", p.stats.constitution)}  ${fmtStat("INT", p.stats.intelligence)}`,
      `${fmtStat("WIS", p.stats.wisdom)}  ${fmtStat("CHA", p.stats.charisma)}`,
    ].join("\n"), {
      fontSize: "11px", fontFamily: "monospace", color: "#ccc", lineSpacing: 4,
    });
    this.equipOverlay!.add(statsBlock);
    cy += 68;

    const MAX_SLOT_VISIBLE = 3;

    // --- Weapon slot (paginated) ---
    cy = this.renderGearSlot(px, cy, panelW, "Weapon", "weapon",
      p.equippedWeapon, (item) => {
        p.equippedWeapon = item;
        if (item?.twoHanded) { p.equippedShield = null; p.equippedOffHand = null; }
        // If new main hand is not light, unequip off-hand
        if (!isLightWeapon(item)) { p.equippedOffHand = null; }
        this.refreshPlayerSprite(); this.buildEquipOverlay();
      },
      () => { p.equippedWeapon = null; p.equippedOffHand = null; this.refreshPlayerSprite(); this.buildEquipOverlay(); },
      this.gearWeaponPage, MAX_SLOT_VISIBLE,
      (dir) => { this.gearWeaponPage += dir; this.buildEquipOverlay(); },
      "dmg");
    cy += 4;

    // --- Off-hand weapon slot (only when main hand is light, no two-handed, no shield) ---
    const canShowOffHand = isLightWeapon(p.equippedWeapon) && !p.equippedWeapon?.twoHanded;
    if (canShowOffHand) {
      const offHandWeapons = p.inventory.filter(
        (i) => i.type === "weapon" && i.light && !i.twoHanded && i.id !== p.equippedWeapon?.id
      );
      if (offHandWeapons.length > 0 || p.equippedOffHand) {
        cy = this.renderGearSlot(px, cy, panelW, "Off-Hand", "weapon",
          p.equippedOffHand,
          (item) => {
            if (item) {
              const result = equipOffHand(p, item);
              if (!result.success) {
                this.showMessage(result.message, "#ff6666");
              }
            }
            this.refreshPlayerSprite(); this.buildEquipOverlay();
          },
          () => { p.equippedOffHand = null; this.buildEquipOverlay(); },
          this.gearOffHandPage, MAX_SLOT_VISIBLE,
          (dir) => { this.gearOffHandPage += dir; this.buildEquipOverlay(); },
          "dmg",
          offHandWeapons);
        cy += 4;
      }
    }

    // --- Armor slot (paginated) ---
    cy = this.renderGearSlot(px, cy, panelW, "Armor", "armor",
      p.equippedArmor, (item) => { p.equippedArmor = item; this.buildEquipOverlay(); },
      () => { p.equippedArmor = null; this.buildEquipOverlay(); },
      this.gearArmorPage, MAX_SLOT_VISIBLE,
      (dir) => { this.gearArmorPage += dir; this.buildEquipOverlay(); },
      "AC");
    cy += 4;

    // --- Shield slot (paginated) ---
    const isTwoHanded = p.equippedWeapon?.twoHanded === true;
    if (isTwoHanded) {
      const shieldLabel = this.add.text(px + 14, cy, "Shield:", { fontSize: "11px", fontFamily: "monospace", color: "#c0a060" });
      this.equipOverlay!.add(shieldLabel);
      cy += 16;
      const note = this.add.text(px + 20, cy, "(two-handed weapon)", { fontSize: "11px", fontFamily: "monospace", color: "#666" });
      this.equipOverlay!.add(note);
      cy += 16;
    } else {
      cy = this.renderGearSlot(px, cy, panelW, "Shield", "shield",
        p.equippedShield, (item) => { p.equippedShield = item; if (item) p.equippedOffHand = null; this.refreshPlayerSprite(); this.buildEquipOverlay(); },
        () => { p.equippedShield = null; this.refreshPlayerSprite(); this.buildEquipOverlay(); },
        this.gearShieldPage, MAX_SLOT_VISIBLE,
        (dir) => { this.gearShieldPage += dir; this.buildEquipOverlay(); },
        "AC");
    }
    cy += 4;

    // --- Mount slot (paginated, max 3) ---
    const mountLabel = this.add.text(px + 14, cy, "Mount:", {
      fontSize: "11px", fontFamily: "monospace", color: "#c0a060",
    });
    this.equipOverlay!.add(mountLabel);
    cy += 16;

    const ownedMounts = p.inventory.filter((i) => i.type === "mount");
    const currentMount = p.mountId ? getMount(p.mountId) : undefined;
    const MAX_MOUNT_VISIBLE = 3;

    if (ownedMounts.length === 0 && !currentMount) {
      const none = this.add.text(px + 20, cy, "On Foot", {
        fontSize: "11px", fontFamily: "monospace", color: "#666",
      });
      this.equipOverlay!.add(none);
      cy += 16;
    } else {
      const mountEntries: { mountId: string; name: string; speed: number; isActive: boolean }[] = [];
      if (currentMount) {
        mountEntries.push({ mountId: currentMount.id, name: currentMount.name, speed: currentMount.speedMultiplier, isActive: true });
      }
      for (const mi of ownedMounts) {
        if (mi.mountId && mi.mountId !== p.mountId) {
          const md = getMount(mi.mountId);
          if (md) mountEntries.push({ mountId: md.id, name: md.name, speed: md.speedMultiplier, isActive: false });
        }
      }
      // Add dismount option as an entry
      if (currentMount) {
        mountEntries.push({ mountId: "", name: "Dismount (on foot)", speed: 0, isActive: false });
      }

      const mountTotalPages = Math.max(1, Math.ceil(mountEntries.length / MAX_MOUNT_VISIBLE));
      const mountPage = Math.min(this.gearMountPage, mountTotalPages - 1);
      const mountStart = mountPage * MAX_MOUNT_VISIBLE;
      const visibleMounts = mountEntries.slice(mountStart, mountStart + MAX_MOUNT_VISIBLE);

      for (const me of visibleMounts) {
        if (me.mountId === "" && me.speed === 0) {
          // Dismount option
          const dismountTxt = this.add.text(px + 20, cy, "  Dismount (on foot)", {
            fontSize: "11px", fontFamily: "monospace", color: "#aaddff",
          }).setInteractive({ useHandCursor: true });
          dismountTxt.on("pointerover", () => dismountTxt.setColor("#ffd700"));
          dismountTxt.on("pointerout", () => dismountTxt.setColor("#aaddff"));
          dismountTxt.on("pointerdown", () => { p.mountId = ""; this.buildEquipOverlay(); });
          this.equipOverlay!.add(dismountTxt);
        } else {
          const prefix = me.isActive ? "► " : "  ";
          const color = me.isActive ? "#88ff88" : "#aaddff";
          const txt = this.add.text(px + 20, cy,
            `${prefix}${me.name} (×${me.speed} speed)${me.isActive ? " [riding]" : ""}`,
            { fontSize: "11px", fontFamily: "monospace", color }
          ).setInteractive({ useHandCursor: true });
          if (me.isActive) {
            txt.on("pointerover", () => txt.setColor("#ff6666"));
            txt.on("pointerout", () => txt.setColor(color));
            txt.on("pointerdown", () => { p.mountId = ""; this.buildEquipOverlay(); });
          } else {
            txt.on("pointerover", () => txt.setColor("#ffd700"));
            txt.on("pointerout", () => txt.setColor(color));
            txt.on("pointerdown", () => { p.mountId = me.mountId; this.buildEquipOverlay(); });
          }
          this.equipOverlay!.add(txt);
        }
        cy += 14;
      }

      if (mountTotalPages > 1) {
        const nav = this.add.text(px + 20, cy, `◄ ${mountPage + 1}/${mountTotalPages} ►`, {
          fontSize: "10px", fontFamily: "monospace", color: "#888",
        }).setInteractive({ useHandCursor: true });
        nav.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
          const mid = nav.x + nav.width / 2;
          this.gearMountPage += pointer.x < mid ? -1 : 1;
          this.gearMountPage = Math.max(0, Math.min(this.gearMountPage, mountTotalPages - 1));
          this.buildEquipOverlay();
        });
        this.equipOverlay!.add(nav);
        cy += 14;
      }
    }
    cy += 6;
  }

  /** Render a paginated gear slot (weapon/armor/shield) and return the new cy. */
  private renderGearSlot(
    px: number, cy: number, _panelW: number,
    slotLabel: string, slotType: string,
    equipped: import("../data/items").Item | null,
    onEquip: (item: import("../data/items").Item | null) => void,
    onUnequip: () => void,
    page: number, maxVisible: number,
    onPageChange: (dir: number) => void,
    effectLabel: string,
    customItems?: import("../data/items").Item[],
  ): number {
    const p = this.player;
    const label = this.add.text(px + 14, cy, `${slotLabel}:`, {
      fontSize: "11px", fontFamily: "monospace", color: "#c0a060",
    });
    this.equipOverlay!.add(label);
    cy += 16;

    const ownedItems = customItems ?? p.inventory.filter((i) => i.type === slotType);
    if (ownedItems.length === 0 && !equipped) {
      const none = this.add.text(px + 20, cy, slotType === "weapon" ? "Bare Hands" : `No ${slotLabel}`, {
        fontSize: "11px", fontFamily: "monospace", color: "#666",
      });
      this.equipOverlay!.add(none);
      cy += 16;
      return cy;
    }

    const allItems = equipped
      ? [equipped, ...ownedItems.filter((i) => i.id !== equipped.id)]
      : ownedItems;

    const totalPages = Math.ceil(allItems.length / maxVisible);
    const safePage = Math.min(page, totalPages - 1);
    const start = safePage * maxVisible;
    const visible = allItems.slice(start, start + maxVisible);

    for (const item of visible) {
      const isEquipped = equipped?.id === item.id;
      const prefix = isEquipped ? "► " : "  ";
      const color = isEquipped ? "#88ff88" : "#aaddff";
      const txt = this.add.text(px + 20, cy,
        `${prefix}${item.name} (+${item.effect} ${effectLabel})${isEquipped ? " [eq]" : ""}`,
        { fontSize: "11px", fontFamily: "monospace", color }
      ).setInteractive({ useHandCursor: true });
      if (isEquipped) {
        txt.on("pointerover", () => txt.setColor("#ff6666"));
        txt.on("pointerout", () => txt.setColor(color));
        txt.on("pointerdown", () => onUnequip());
      } else {
        txt.on("pointerover", () => txt.setColor("#ffd700"));
        txt.on("pointerout", () => txt.setColor(color));
        txt.on("pointerdown", () => onEquip(item));
      }
      this.equipOverlay!.add(txt);
      cy += 14;
    }

    // Show page controls if multiple pages
    if (totalPages > 1) {
      const pg = safePage;
      const nav = this.add.text(px + 20, cy, `◄ ${pg + 1}/${totalPages} ►`, {
        fontSize: "10px", fontFamily: "monospace", color: "#888",
      }).setInteractive({ useHandCursor: true });
      nav.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        const mid = nav.x + nav.width / 2;
        onPageChange(pointer.x < mid ? -1 : 1);
      });
      this.equipOverlay!.add(nav);
      cy += 14;
    }

    return cy;
  }

  /** Items page with descriptions and pagination (max 10 per page). */
  private buildEquipItemsPage(px: number, py: number, panelW: number, _panelH: number): void {
    const p = this.player;
    let cy = py + 6;
    const MAX_ITEMS_VISIBLE = 10;

    // Build combined list: consumables (grouped) + key items
    const consumables = p.inventory.filter((i) => i.type === "consumable");
    const grouped = new Map<string, { item: typeof consumables[0]; count: number }>();
    for (const item of consumables) {
      const existing = grouped.get(item.id);
      if (existing) { existing.count++; } else { grouped.set(item.id, { item, count: 1 }); }
    }
    const keyItems = p.inventory.filter((i) => i.type === "key");

    // Build flat list of renderable entries
    type ItemEntry = { label: string; desc: string; color: string; itemId?: string };
    const allEntries: ItemEntry[] = [];
    for (const [, { item, count }] of grouped) {
      allEntries.push({ label: `${item.name} ×${count}`, desc: item.description, color: "#aaddff", itemId: item.id });
    }
    for (const ki of keyItems) {
      allEntries.push({ label: ki.name, desc: ki.description, color: "#ffdd88" });
    }

    const totalPages = Math.max(1, Math.ceil(allEntries.length / MAX_ITEMS_VISIBLE));
    const safePage = Math.min(this.itemsPage, totalPages - 1);
    const visible = allEntries.slice(safePage * MAX_ITEMS_VISIBLE, (safePage + 1) * MAX_ITEMS_VISIBLE);

    const header = this.add.text(px + 14, cy, `― Items (${allEntries.length}) ―`, {
      fontSize: "12px", fontFamily: "monospace", color: "#c0a060",
    });
    this.equipOverlay!.add(header);
    cy += 18;

    if (allEntries.length === 0) {
      const none = this.add.text(px + 20, cy, "No items.", {
        fontSize: "11px", fontFamily: "monospace", color: "#666",
      });
      this.equipOverlay!.add(none);
      cy += 16;
    } else {
      for (const entry of visible) {
        const isConsumable = !!entry.itemId;
        const txt = this.add.text(px + 20, cy, entry.label, {
          fontSize: "11px", fontFamily: "monospace", color: entry.color,
        });
        if (isConsumable) {
          txt.setInteractive({ useHandCursor: true });
          txt.on("pointerover", () => txt.setColor("#ffd700"));
          txt.on("pointerout", () => txt.setColor(entry.color));
          txt.on("pointerdown", () => {
            const idx = p.inventory.findIndex((i) => i.id === entry.itemId && i.type === "consumable");
            if (idx >= 0) {
              const result = useItem(p, idx);
              if (result.used) {
                if (result.teleport) {
                  this.pendingTeleportCost = 0;
                  this.toggleEquipOverlay();
                  this.showTownPicker();
                  if (audioEngine.initialized) audioEngine.playTeleportSFX();
                  return;
                }
                if (audioEngine.initialized) audioEngine.playPotionSFX();
                this.updateHUD();
              } else {
                this.showMessage(result.message, "#ff6666");
              }
              this.buildEquipOverlay();
            }
          });
        }
        this.equipOverlay!.add(txt);
        const desc = this.add.text(px + 30, cy + 13, entry.desc, {
          fontSize: "9px", fontFamily: "monospace", color: "#888",
          wordWrap: { width: panelW - 50 },
        });
        this.equipOverlay!.add(desc);
        cy += 28;
      }
    }

    if (totalPages > 1) {
      cy += 4;
      const nav = this.add.text(px + 20, cy, `◄ ${safePage + 1}/${totalPages} ►`, {
        fontSize: "10px", fontFamily: "monospace", color: "#888",
      }).setInteractive({ useHandCursor: true });
      nav.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        const mid = nav.x + nav.width / 2;
        this.itemsPage += pointer.x < mid ? -1 : 1;
        this.itemsPage = Math.max(0, Math.min(this.itemsPage, totalPages - 1));
        this.buildEquipOverlay();
      });
      this.equipOverlay!.add(nav);
    }
  }

  /** Skills page with paginated spells (max 5) and abilities (max 5). */
  private buildEquipSkillsPage(px: number, py: number, panelW: number, _panelH: number): void {
    const p = this.player;
    const appearance = getPlayerClass(p.appearanceId);
    const primaryMod = abilityModifier(p.stats[appearance.primaryStat]);
    const primaryLabel = appearance.primaryStat.slice(0, 3).toUpperCase();
    let cy = py + 6;
    const MAX_SPELL_VISIBLE = 5;
    const MAX_ABILITY_VISIBLE = 5;

    // --- Spells (paginated) ---
    const spellTotalPages = Math.max(1, Math.ceil(p.knownSpells.length / MAX_SPELL_VISIBLE));
    const spellPage = Math.min(this.spellsPage, spellTotalPages - 1);
    const spellStart = spellPage * MAX_SPELL_VISIBLE;
    const visibleSpells = p.knownSpells.slice(spellStart, spellStart + MAX_SPELL_VISIBLE);

    const spellsHeader = this.add.text(px + 14, cy, `― Spells (${p.knownSpells.length}) ―`, {
      fontSize: "12px", fontFamily: "monospace", color: "#c0a060",
    });
    this.equipOverlay!.add(spellsHeader);
    cy += 18;

    if (p.knownSpells.length === 0) {
      const none = this.add.text(px + 20, cy, "No spells learned yet.", {
        fontSize: "11px", fontFamily: "monospace", color: "#666",
      });
      this.equipOverlay!.add(none);
      cy += 16;
    } else {
      for (const spellId of visibleSpells) {
        const spell = getSpell(spellId);
        if (!spell) continue;
        const dmgOrHeal = spell.type === "heal" ? "heal" : "dmg";
        const hasDice = spell.damageDie > 0 && spell.damageCount > 0;
        const diceStr = hasDice ? `${spell.damageCount}d${spell.damageDie}` : "";
        const modStr = primaryMod >= 0 ? `+${primaryMod}` : `${primaryMod}`;
        const diceInfo = hasDice ? `  ${diceStr}${modStr} ${dmgOrHeal}` : "";
        const isUsable = spell.type === "heal" || spell.type === "utility";
        const restTag = spell.id === "shortRest" ? ` (${p.shortRestsRemaining} left)` : "";
        let canCast = false;
        if (isUsable) {
          canCast = p.mp >= spell.mpCost && (spell.type !== "heal" || p.hp < p.maxHp);
          if (spell.id === "shortRest") {
            canCast = p.shortRestsRemaining > 0 && (p.hp < p.maxHp || p.mp < p.maxMp || (p.pendingLevelUps ?? 0) > 0);
          }
        }
        const baseColor = isUsable ? (canCast ? "#ccffcc" : "#666") : "#aaddff";
        const txt = this.add.text(px + 20, cy,
          `${spell.name}  ${spell.mpCost} MP${diceInfo}${restTag}`,
          { fontSize: "11px", fontFamily: "monospace", color: baseColor }
        );
        if (isUsable) {
          txt.setInteractive({ useHandCursor: canCast });
          if (canCast) {
            txt.on("pointerover", () => txt.setColor("#ffd700"));
            txt.on("pointerout", () => txt.setColor(baseColor));
            txt.on("pointerdown", () => {
              const result = castSpellOutsideCombat(p, spell.id);
              if (result.teleport) {
                this.pendingTeleportCost = spell.mpCost;
                this.toggleEquipOverlay();
                this.showTownPicker();
                return;
              }
              this.showMessage(result.message);
              if (spell.id === "shortRest") {
                audioEngine.playCampfireSFX();
              } else {
                audioEngine.playPotionSFX();
              }
              this.buildEquipOverlay();
              this.updateHUD();
            });
          }
        }
        this.equipOverlay!.add(txt);
        const desc = this.add.text(px + 30, cy + 14,
          spell.description,
          { fontSize: "9px", fontFamily: "monospace", color: "#888", wordWrap: { width: panelW - 50 } }
        );
        this.equipOverlay!.add(desc);
        cy += 30;
      }
      if (spellTotalPages > 1) {
        const nav = this.add.text(px + 20, cy, `◄ ${spellPage + 1}/${spellTotalPages} ►`, {
          fontSize: "10px", fontFamily: "monospace", color: "#888",
        }).setInteractive({ useHandCursor: true });
        nav.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
          const mid = nav.x + nav.width / 2;
          this.spellsPage += pointer.x < mid ? -1 : 1;
          this.spellsPage = Math.max(0, Math.min(this.spellsPage, spellTotalPages - 1));
          this.buildEquipOverlay();
        });
        this.equipOverlay!.add(nav);
        cy += 16;
      }
    }
    cy += 8;

    // --- Abilities (paginated) ---
    const knownAbilities = p.knownAbilities ?? [];
    const abilityTotalPages = Math.max(1, Math.ceil(knownAbilities.length / MAX_ABILITY_VISIBLE));
    const abilityPage = Math.min(this.abilitiesPage, abilityTotalPages - 1);
    const abilityStart = abilityPage * MAX_ABILITY_VISIBLE;
    const visibleAbilities = knownAbilities.slice(abilityStart, abilityStart + MAX_ABILITY_VISIBLE);

    const abilitiesHeader = this.add.text(px + 14, cy, `― Abilities (${knownAbilities.length}) ―`, {
      fontSize: "12px", fontFamily: "monospace", color: "#c0a060",
    });
    this.equipOverlay!.add(abilitiesHeader);
    cy += 18;

    if (knownAbilities.length === 0) {
      const none = this.add.text(px + 20, cy, "No abilities learned yet.", {
        fontSize: "11px", fontFamily: "monospace", color: "#666",
      });
      this.equipOverlay!.add(none);
      cy += 16;
    } else {
      for (const abilityId of visibleAbilities) {
        const ability = getAbility(abilityId);
        if (!ability) continue;
        const dmgOrHeal = ability.type === "heal" ? "heal" : "dmg";
        const hasDice = ability.damageDie > 0 && ability.damageCount > 0;
        const diceStr = hasDice ? `${ability.damageCount}d${ability.damageDie}` : "";
        const aMod = abilityModifier(p.stats[ability.statKey]);
        const aModStr = aMod >= 0 ? `+${aMod}` : `${aMod}`;
        const statLabel = ability.statKey.slice(0, 3).toUpperCase();
        const bonusTag = ability.bonusAction ? " [bonus]" : "";
        const diceInfo = hasDice ? `  ${diceStr}${aModStr} ${dmgOrHeal}` : "";
        const isUsable = ability.type === "heal" || ability.type === "utility";
        const canUse = isUsable && p.mp >= ability.mpCost && (ability.type !== "heal" || p.hp < p.maxHp);
        const baseColor = isUsable ? (canUse ? "#ccffcc" : "#666") : "#aaddff";
        const txt = this.add.text(px + 20, cy,
          `${ability.name}  ${ability.mpCost} MP${diceInfo}${bonusTag}`,
          { fontSize: "11px", fontFamily: "monospace", color: baseColor }
        );
        if (isUsable) {
          txt.setInteractive({ useHandCursor: canUse });
          if (canUse) {
            txt.on("pointerover", () => txt.setColor("#ffd700"));
            txt.on("pointerout", () => txt.setColor(baseColor));
            txt.on("pointerdown", () => {
              const result = useAbilityOutsideCombat(p, ability.id);
              if (result.teleport) {
                this.pendingTeleportCost = ability.mpCost;
                this.toggleEquipOverlay();
                this.showTownPicker();
                return;
              }
              this.showMessage(result.message);
              audioEngine.playPotionSFX();
              this.buildEquipOverlay();
              this.updateHUD();
            });
          }
        }
        this.equipOverlay!.add(txt);
        const desc = this.add.text(px + 30, cy + 14,
          ability.description,
          { fontSize: "9px", fontFamily: "monospace", color: "#888", wordWrap: { width: panelW - 50 } }
        );
        this.equipOverlay!.add(desc);
        cy += 30;
      }
      if (abilityTotalPages > 1) {
        const nav = this.add.text(px + 20, cy, `◄ ${abilityPage + 1}/${abilityTotalPages} ►`, {
          fontSize: "10px", fontFamily: "monospace", color: "#888",
        }).setInteractive({ useHandCursor: true });
        nav.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
          const mid = nav.x + nav.width / 2;
          this.abilitiesPage += pointer.x < mid ? -1 : 1;
          this.abilitiesPage = Math.max(0, Math.min(this.abilitiesPage, abilityTotalPages - 1));
          this.buildEquipOverlay();
        });
        this.equipOverlay!.add(nav);
      }
    }
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

    const title = this.add.text(px + panelW / 2, py + 12, "📊 Your Stats", {
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
    const panelH = 200;
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
    const resumeBtn = this.add.text(px + panelW / 2, py + 48, "▶ Resume", {
      fontSize: "14px", fontFamily: "monospace", color: "#88ff88",
      backgroundColor: "#2a2a4e", padding: { x: 16, y: 6 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    resumeBtn.on("pointerover", () => resumeBtn.setColor("#ffd700"));
    resumeBtn.on("pointerout", () => resumeBtn.setColor("#88ff88"));
    resumeBtn.on("pointerdown", () => this.toggleMenuOverlay());
    this.menuOverlay.add(resumeBtn);

    // Settings button
    const settingsBtn = this.add.text(px + panelW / 2, py + 90, "🔊 Settings", {
      fontSize: "14px", fontFamily: "monospace", color: "#aabbff",
      backgroundColor: "#2a2a4e", padding: { x: 16, y: 6 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    settingsBtn.on("pointerover", () => settingsBtn.setColor("#ffd700"));
    settingsBtn.on("pointerout", () => settingsBtn.setColor("#aabbff"));
    settingsBtn.on("pointerdown", () => {
      this.toggleMenuOverlay();
      this.showSettingsOverlay();
    });
    this.menuOverlay.add(settingsBtn);

    // Quit to Title button
    const quitBtn = this.add.text(px + panelW / 2, py + 132, "✕ Quit to Title", {
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

  // ─── Settings Overlay ────────────────────────────────────────────

  private toggleSettingsOverlay(): void {
    if (this.settingsOverlay) {
      this.settingsOverlay.destroy();
      this.settingsOverlay = null;
      return;
    }
    this.showSettingsOverlay();
  }

  private showSettingsOverlay(): void {
    // Close other overlays
    if (this.menuOverlay) { this.menuOverlay.destroy(); this.menuOverlay = null; }
    if (this.equipOverlay) { this.equipOverlay.destroy(); this.equipOverlay = null; }
    if (this.statOverlay) { this.statOverlay.destroy(); this.statOverlay = null; }
    if (this.settingsOverlay) { this.settingsOverlay.destroy(); this.settingsOverlay = null; }

    const w = this.cameras.main.width;
    const h = this.cameras.main.height;
    const panelW = 300;
    const panelH = 290;
    const px = Math.floor((w - panelW) / 2);
    const py = Math.floor((h - panelH) / 2) - 10;

    this.settingsOverlay = this.add.container(0, 0).setDepth(75);

    // Dim — only closes when clicking outside the panel
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.6);
    dim.fillRect(0, 0, w, h);
    dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    dim.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      // Only close if the click is outside the panel area
      if (pointer.x < px || pointer.x > px + panelW || pointer.y < py || pointer.y > py + panelH) {
        this.toggleSettingsOverlay();
      }
    });
    this.settingsOverlay.add(dim);

    // Panel background — absorb clicks so they don't reach the dim layer
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRect(px, py, panelW, panelH);
    bg.lineStyle(2, 0xffd700, 1);
    bg.strokeRect(px, py, panelW, panelH);
    bg.setInteractive(new Phaser.Geom.Rectangle(px, py, panelW, panelH), Phaser.Geom.Rectangle.Contains);
    this.settingsOverlay.add(bg);

    // Title
    const title = this.add.text(px + panelW / 2, py + 12, "🔊 Audio Settings", {
      fontSize: "14px", fontFamily: "monospace", color: "#ffd700",
    }).setOrigin(0.5, 0);
    this.settingsOverlay.add(title);

    // Volume slider helper
    const sliderY = py + 44;
    const sliderX = px + 16;
    const sliderW = panelW - 32;
    const barH = 10;
    const sliderSpacing = 48;

    const channels: { label: string; value: number; setter: (v: number) => void }[] = [
      { label: "Master", value: audioEngine.state.masterVolume, setter: (v) => audioEngine.setMasterVolume(v) },
      { label: "Music",  value: audioEngine.state.musicVolume,  setter: (v) => audioEngine.setMusicVolume(v) },
      { label: "SFX",    value: audioEngine.state.sfxVolume,    setter: (v) => audioEngine.setSFXVolume(v) },
      { label: "Dialog", value: audioEngine.state.dialogVolume, setter: (v) => audioEngine.setDialogVolume(v) },
    ];

    channels.forEach((ch, i) => {
      const y = sliderY + i * sliderSpacing;

      // Label + value text
      const valText = this.add.text(sliderX + sliderW, y - 2, `${ch.label}: ${Math.round(ch.value * 100)}%`, {
        fontSize: "11px", fontFamily: "monospace", color: "#ccc",
      }).setOrigin(1, 0);
      this.settingsOverlay!.add(valText);

      // Slider track
      const track = this.add.graphics();
      track.fillStyle(0x333355, 1);
      track.fillRect(sliderX, y + 14, sliderW, barH);
      track.lineStyle(1, 0x555577, 1);
      track.strokeRect(sliderX, y + 14, sliderW, barH);
      this.settingsOverlay!.add(track);

      // Filled portion
      const fill = this.add.graphics();
      const drawFill = (v: number) => {
        fill.clear();
        fill.fillStyle(0x4488ff, 1);
        fill.fillRect(sliderX, y + 14, sliderW * v, barH);
      };
      drawFill(ch.value);
      this.settingsOverlay!.add(fill);

      // Knob
      let currentKnobX = sliderX + sliderW * ch.value;
      const knob = this.add.graphics();
      const drawKnob = (kx: number) => {
        knob.clear();
        knob.fillStyle(0xffd700, 1);
        knob.fillCircle(kx, y + 14 + barH / 2, 7);
        knob.lineStyle(1, 0xaa8800, 1);
        knob.strokeCircle(kx, y + 14 + barH / 2, 7);
      };
      drawKnob(currentKnobX);
      this.settingsOverlay!.add(knob);

      // Draggable zone centered on the knob only
      const knobZone = this.add.zone(currentKnobX, y + 14 + barH / 2, 22, 22)
        .setInteractive({ useHandCursor: true, draggable: true });
      this.settingsOverlay!.add(knobZone);

      knobZone.on("drag", (_pointer: Phaser.Input.Pointer, dragX: number) => {
        const clampedX = Phaser.Math.Clamp(dragX, sliderX, sliderX + sliderW);
        const ratio = (clampedX - sliderX) / sliderW;
        ch.setter(ratio);
        ch.value = ratio;
        currentKnobX = clampedX;
        drawFill(ratio);
        drawKnob(clampedX);
        knobZone.setPosition(clampedX, y + 14 + barH / 2);
        valText.setText(`${ch.label}: ${Math.round(ratio * 100)}%`);
      });
    });

    // Mute toggle
    const muteY = sliderY + channels.length * sliderSpacing + 4;
    const muteBtn = this.add.text(px + panelW / 2, muteY, audioEngine.state.muted ? "🔇 Unmute" : "🔊 Mute All", {
      fontSize: "13px", fontFamily: "monospace", color: audioEngine.state.muted ? "#ff6666" : "#88ccff",
      backgroundColor: "#2a2a4e", padding: { x: 12, y: 4 },
    }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    muteBtn.on("pointerdown", () => {
      const muted = audioEngine.toggleMute();
      muteBtn.setText(muted ? "🔇 Unmute" : "🔊 Mute All");
      muteBtn.setColor(muted ? "#ff6666" : "#88ccff");
    });
    this.settingsOverlay.add(muteBtn);

    // Close hint
    const hint = this.add.text(px + panelW / 2, py + panelH - 10, "Click outside or press M to close", {
      fontSize: "10px", fontFamily: "monospace", color: "#666",
    }).setOrigin(0.5, 1);
    this.settingsOverlay.add(hint);
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
    const panelH = 320;
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
          this.showStatOverlay(); // rebuild (shows confirm when 0 points left)
        }
      });

      this.statOverlay.add(btn);
      cy += 28;
    }

    // When no points remain, show a Confirm / Undo bar instead of hint
    if (p.pendingStatPoints <= 0) {
      const confirmBtn = this.add.text(px + panelW / 2, py + panelH - 36, "✔ Confirm", {
        fontSize: "12px", fontFamily: "monospace", color: "#88ff88",
        backgroundColor: "#1a2e1a", padding: { x: 6, y: 3 },
      }).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });
      confirmBtn.on("pointerover", () => confirmBtn.setColor("#ffd700"));
      confirmBtn.on("pointerout", () => confirmBtn.setColor("#88ff88"));
      confirmBtn.on("pointerdown", () => {
        this.statOverlay?.destroy();
        this.statOverlay = null;
      });
      this.statOverlay.add(confirmBtn);

      const hint = this.add.text(px + panelW / 2, py + panelH - 10,
        "All points allocated!", {
          fontSize: "9px", fontFamily: "monospace", color: "#666",
        }).setOrigin(0.5, 1);
      this.statOverlay.add(hint);
    } else {
      const hint = this.add.text(px + panelW / 2, py + panelH - 10,
        "Click [+] to allocate", {
          fontSize: "10px", fontFamily: "monospace", color: "#666",
        }).setOrigin(0.5, 1);
      this.statOverlay.add(hint);
    }
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

  /** Refresh the world map overlay in-place if it is currently open. */
  private refreshWorldMap(): void {
    if (!this.worldMapOverlay) return;
    this.worldMapOverlay.destroy();
    this.worldMapOverlay = null;
    this.input.off("wheel");
    this.input.off("pointermove");
    this.input.off("pointerup");
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
            const explored = !!this.player.progression.exploredTiles[exploredKey];
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
          if (!this.player.progression.exploredTiles[eKey]) continue;
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
          if (!this.player.progression.exploredTiles[eKey]) continue;
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
        if (dcx === this.player.position.chunkX && dcy === this.player.position.chunkY) {
          const pmx = ox + this.player.position.x * detailTile + detailTile / 2;
          const pmy = oy + this.player.position.y * detailTile + detailTile / 2;
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
              const explored = !!this.player.progression.exploredTiles[exploredKey];
              if (explored) hasExplored = true;
              // Show collected minor treasures as their base terrain color
              let color: number;
              if (!explored) {
                color = 0x0a0a0a;
              } else if (hasSparkleAt(cx, cy, tx, ty) && !this.player.progression.collectedTreasures.includes(exploredKey)) {
                color = TERRAIN_COLORS[Terrain.MinorTreasure];
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
          const isCurrent = cx === this.player.position.chunkX && cy === this.player.position.chunkY;
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
            if (!this.player.progression.exploredTiles[tKey]) continue;
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
            if (!this.player.progression.exploredTiles[bKey] || this.defeatedBosses.has(boss.monsterId)) continue;
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
            const pmx = ox + this.player.position.x * tp + tp / 2;
            const pmy = oy + this.player.position.y * tp + tp / 2;
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
