/**
 * Shared debug utilities for cheat hotkeys and slash commands.
 *
 * Both OverworldScene and BattleScene use the same core cheats (gold, heal,
 * MP, level-up, etc.).  This module extracts the common logic so each scene
 * only registers its scene-specific extras.
 */

import Phaser from "phaser";
import { isDebug, debugLog, debugPanelLog, debugPanelClear, debugPanelState, setDebugCommandHandler } from "../config";
import { awardXP, processPendingLevelUps, xpForLevel, type PlayerState } from "./player";
import { ITEMS } from "../data/items";
import { MOUNTS } from "../data/mounts";
import { CITIES, DUNGEONS } from "../data/map";
import { ALL_MONSTERS } from "../data/monsters";
import { SPELLS } from "../data/spells";
import { ABILITIES } from "../data/abilities";
import { PLAYER_CLASSES } from "./classes";
import { TALENTS } from "../data/talents";

// ── Types ──────────────────────────────────────────────────────

/** Callback scenes provide so the shared module can refresh the UI. */
export interface DebugCallbacks {
  /** Refresh the HUD / player stats display after a cheat. */
  updateUI: () => void;
  /** Called when a level-up grants stat points (optional). */
  onLevelUp?: (asiGained: number) => void;
}

/** A single scene-specific slash command handler. */
export type CommandHandler = (args: string) => void;

/** Help entry for the /help listing. */
export interface HelpEntry {
  usage: string;
  desc: string;
}

// ── Shared Hotkeys ─────────────────────────────────────────────

/**
 * Register the hotkeys that are common to every scene:
 *   G = +100 gold, H = full heal, P = restore MP, L = level up
 *
 * Returns the key objects so the caller can add more keys.
 */
export function registerSharedHotkeys(
  scene: Phaser.Scene,
  player: PlayerState,
  cb: DebugCallbacks,
): void {
  const gKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.G);
  const hKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.H);
  const pKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.P);
  const lKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.L);

  gKey.on("down", () => {
    if (!isDebug()) return;
    player.gold += 100;
    debugLog("CHEAT: +100 gold", { total: player.gold });
    debugPanelLog(`[CHEAT] +100 gold (total: ${player.gold})`, true);
    cb.updateUI();
  });

  hKey.on("down", () => {
    if (!isDebug()) return;
    player.hp = player.maxHp;
    debugLog("CHEAT: Full heal");
    debugPanelLog(`[CHEAT] HP restored to ${player.maxHp}!`, true);
    cb.updateUI();
  });

  pKey.on("down", () => {
    if (!isDebug()) return;
    player.mp = player.maxMp;
    debugLog("CHEAT: Restore MP");
    debugPanelLog(`[CHEAT] MP restored to ${player.maxMp}!`, true);
    cb.updateUI();
  });

  lKey.on("down", () => {
    if (!isDebug()) return;
    const needed = xpForLevel(player.level + 1) - player.xp;
    awardXP(player, Math.max(needed, 0));
    const xpResult = processPendingLevelUps(player);
    debugLog("CHEAT: Level up", { newLevel: xpResult.newLevel });
    debugPanelLog(`[CHEAT] Level up! Now Lv.${xpResult.newLevel}`, true);
    for (const spell of xpResult.newSpells) {
      debugPanelLog(`[CHEAT] Learned ${spell.name}!`, true);
    }
    if (xpResult.asiGained > 0) {
      debugPanelLog(`[CHEAT] +${xpResult.asiGained} stat points!`, true);
    }
    cb.updateUI();
    if (xpResult.asiGained > 0 && cb.onLevelUp) {
      cb.onLevelUp(xpResult.asiGained);
    }
  });
}

// ── Shared Slash Commands ──────────────────────────────────────

/**
 * Build a map of slash-command handlers that are common to every scene:
 *   /gold, /exp (/xp), /hp, /mp, /heal, /help
 *
 * Scene-specific handlers and extra help entries are merged in by the caller.
 */
export function buildSharedCommands(
  player: PlayerState,
  cb: DebugCallbacks,
): Map<string, CommandHandler> {
  const cmds = new Map<string, CommandHandler>();

  cmds.set("gold", (args) => {
    const val = parseInt(args, 10);
    if (!isNaN(val)) { player.gold = val; cb.updateUI(); debugPanelLog(`[CMD] Gold set to ${val}`, true); }
    else debugPanelLog(`Usage: /gold <amount>`, true);
  });

  const expHandler: CommandHandler = (args) => {
    const val = parseInt(args, 10);
    if (!isNaN(val)) {
      awardXP(player, val);
      const result = processPendingLevelUps(player);
      cb.updateUI();
      debugPanelLog(`[CMD] +${val} XP (now Lv.${result.newLevel})`, true);
      if (result.leveledUp) debugPanelLog(`[CMD] Level up to ${result.newLevel}!`, true);
      if (result.asiGained > 0 && cb.onLevelUp) cb.onLevelUp(result.asiGained);
    } else debugPanelLog(`Usage: /exp <amount>`, true);
  };
  cmds.set("exp", expHandler);
  cmds.set("xp", expHandler);

  cmds.set("hp", (args) => {
    const val = parseInt(args, 10);
    if (!isNaN(val)) { player.hp = Math.min(val, player.maxHp); cb.updateUI(); debugPanelLog(`[CMD] HP set to ${player.hp}`, true); }
    else debugPanelLog(`Usage: /hp <amount>`, true);
  });

  cmds.set("mp", (args) => {
    const val = parseInt(args, 10);
    if (!isNaN(val)) { player.mp = Math.min(val, player.maxMp); cb.updateUI(); debugPanelLog(`[CMD] MP set to ${player.mp}`, true); }
    else debugPanelLog(`Usage: /mp <amount>`, true);
  });

  cmds.set("heal", () => {
    player.hp = player.maxHp;
    player.mp = player.maxMp;
    cb.updateUI();
    debugPanelLog(`[CMD] Fully healed!`, true);
  });

  cmds.set("list", (args) => {
    const category = args.trim().toLowerCase();
    const listMap: Record<string, () => string[]> = {
      item: () => ITEMS.map((i) => i.id),
      items: () => ITEMS.map((i) => i.id),
      weapon: () => ITEMS.filter((i) => i.type === "weapon").map((i) => i.id),
      weapons: () => ITEMS.filter((i) => i.type === "weapon").map((i) => i.id),
      armor: () => ITEMS.filter((i) => i.type === "armor").map((i) => i.id),
      armors: () => ITEMS.filter((i) => i.type === "armor").map((i) => i.id),
      shield: () => ITEMS.filter((i) => i.type === "shield").map((i) => i.id),
      shields: () => ITEMS.filter((i) => i.type === "shield").map((i) => i.id),
      consumable: () => ITEMS.filter((i) => i.type === "consumable").map((i) => i.id),
      consumables: () => ITEMS.filter((i) => i.type === "consumable").map((i) => i.id),
      mount: () => MOUNTS.map((m) => m.id),
      mounts: () => MOUNTS.map((m) => m.id),
      city: () => CITIES.map((c) => `${c.id} (${c.name})`),
      cities: () => CITIES.map((c) => `${c.id} (${c.name})`),
      dungeon: () => DUNGEONS.map((d) => `${d.id} (${d.name})`),
      dungeons: () => DUNGEONS.map((d) => `${d.id} (${d.name})`),
      monster: () => ALL_MONSTERS.map((m) => m.id),
      monsters: () => ALL_MONSTERS.map((m) => m.id),
      spell: () => SPELLS.map((s) => `${s.id} (${s.name})`),
      spells: () => SPELLS.map((s) => `${s.id} (${s.name})`),
      ability: () => ABILITIES.map((a) => `${a.id} (${a.name})`),
      abilities: () => ABILITIES.map((a) => `${a.id} (${a.name})`),
      class: () => PLAYER_CLASSES.map((c) => c.id),
      classes: () => PLAYER_CLASSES.map((c) => c.id),
      talent: () => TALENTS.map((t) => `${t.id} (Lv${t.levelRequired}${t.classRestriction ? " — " + t.classRestriction.join("/") : ""})`),
      talents: () => TALENTS.map((t) => `${t.id} (Lv${t.levelRequired}${t.classRestriction ? " — " + t.classRestriction.join("/") : ""})`),
    };
    const available = ["items", "weapons", "armor", "shields", "consumables", "mounts", "cities", "dungeons", "monsters", "spells", "abilities", "classes", "talents"];
    const getter = listMap[category];
    if (getter) {
      const entries = getter();
      debugPanelLog(`── ${category} (${entries.length}) ──`, true);
      for (const entry of entries) {
        debugPanelLog(`  ${entry}`, true);
      }
    } else {
      debugPanelLog(`Usage: /list <${available.join("|")}>`, true);
    }
  });

  return cmds;
}

// ── Help entries shared across scenes ──────────────────────────

export const SHARED_HELP: HelpEntry[] = [
  { usage: "/gold <n>", desc: "Set gold amount" },
  { usage: "/exp <n>", desc: "Award XP (alias: /xp)" },
  { usage: "/hp <n>", desc: "Set current HP" },
  { usage: "/mp <n>", desc: "Set current MP" },
  { usage: "/heal", desc: "Restore full HP & MP" },
  { usage: "/list <category>", desc: "List IDs: items, weapons, mounts, cities, monsters, etc." },
];

// ── Command Router ─────────────────────────────────────────────

/**
 * Register the final slash-command router.
 *
 * Merges shared + scene-specific commands, adds /help, and hooks into
 * the global setDebugCommandHandler.
 */
export function registerCommandRouter(
  commands: Map<string, CommandHandler>,
  sceneName: string,
  helpEntries: HelpEntry[],
): void {
  setDebugCommandHandler((cmd, args) => {
    const handler = commands.get(cmd);
    if (handler) {
      handler(args);
    } else if (cmd === "help" || cmd === "h") {
      debugPanelLog(`── Debug Commands (${sceneName}) ──`, true);
      for (const entry of helpEntries) {
        debugPanelLog(`  ${entry.usage.padEnd(24)} ${entry.desc}`, true);
      }
    } else if (cmd === "clear" || cmd === "cls") {
      debugPanelClear();
    } else {
      debugPanelLog(`Unknown command: /${cmd}. Try /help for a list of commands.`, true);
    }
  });
}

// ══════════════════════════════════════════════════════════════════════
// Overworld Debug Command System (merged from debugCommands.ts)
// ══════════════════════════════════════════════════════════════════════

import { WeatherType } from "./weather";
import type { WeatherState } from "./weather";
import { audioEngine } from "./audio";
import { getMount } from "../data/mounts";
import { getItem } from "../data/items";
import {
  getChunk,
  MAP_WIDTH,
  MAP_HEIGHT,
  WORLD_WIDTH,
  WORLD_HEIGHT,
} from "../data/map";
import type { WorldChunk } from "../data/map";
import { SPECIAL_NPC_DEFS } from "../data/npcs";
import type { SpecialNpcKind } from "../data/npcs";
import {
  MONSTERS,
  DUNGEON_MONSTERS,
  NIGHT_MONSTERS,
} from "../data/monsters";
import type { Monster } from "../data/monsters";
import { recordDefeat } from "./codex";
import type { CodexData } from "./codex";
import type { FogOfWar } from "../managers/fogOfWar";
import type { EncounterSystem } from "../managers/encounter";

/** Callbacks the OverworldScene provides so the debug system can trigger UI/game updates. */
export interface OverworldDebugCallbacks {
  updateHUD(): void;
  showStatOverlay(): void;
  renderMap(): void;
  applyDayNightTint(): void;
  createPlayer(): void;
  refreshWorldMap(): void;
  updateWeatherParticles(): void;
  updateAudio(): void;
  startBattle(monster: Monster): void;
  spawnSpecialNpcs(chunk: WorldChunk): void;
  autoSave(): void;
  restartScene(): void;
}

/** Wrapper so a primitive number can be shared by reference between the scene and this system. */
export interface TimeStepRef {
  value: number;
}

/**
 * Encapsulates all overworld debug commands and hotkeys.
 * Extracted from OverworldScene.setupDebug() for maintainability.
 */
export class DebugCommandSystem {
  private readonly scene: Phaser.Scene;
  private readonly player: PlayerState;
  private readonly callbacks: OverworldDebugCallbacks;

  /** Fog-of-war system — set before calling setup(). */
  fogOfWar!: FogOfWar;

  /** Encounter system — set before calling setup(). */
  encounterSystem!: EncounterSystem;

  /** Shared mutable array of pending special NPC spawns. */
  pendingSpecialSpawns!: SpecialNpcKind[];

  /** Mutable weather state — mutations are visible to the scene. */
  weatherState!: WeatherState;

  /** Time-step reference object so primitive changes propagate to the scene. */
  timeStepRef!: TimeStepRef;

  /** Bestiary data — set before calling setup(). */
  codex!: CodexData;

  /** Set of defeated boss IDs — set before calling setup(). */
  defeatedBosses!: Set<string>;

  /** Current timeStep value (delegates to the shared ref). */
  get timeStep(): number {
    return this.timeStepRef.value;
  }
  set timeStep(v: number) {
    this.timeStepRef.value = v;
  }

  constructor(scene: Phaser.Scene, player: PlayerState, callbacks: OverworldDebugCallbacks) {
    this.scene = scene;
    this.player = player;
    this.callbacks = callbacks;
  }

  /**
   * Register all debug hotkeys and slash commands.
   * Must be called after all public fields (fogOfWar, encounterSystem, etc.) are assigned.
   */
  setup(): void {
    debugPanelLog("── Overworld loaded ──", true);
    debugPanelState("OVERWORLD | Loading...");

    const cb = {
      updateUI: () => this.callbacks.updateHUD(),
      onLevelUp: (_asiGained: number) => {
        this.scene.time.delayedCall(200, () => {
          if (this.player.pendingStatPoints > 0) this.callbacks.showStatOverlay();
        });
      },
    };

    // Shared hotkeys: G=Gold, H=Heal, P=MP, L=LvUp
    registerSharedHotkeys(this.scene, this.player, cb);

    // ── Overworld-only hotkeys ──

    const fKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    fKey.on("down", () => {
      if (!isDebug()) return;
      const newState = !this.encounterSystem.areEncountersEnabled();
      this.encounterSystem.setEncountersEnabled(newState);
      debugLog("CHEAT: Encounters " + (newState ? "ON" : "OFF"));
      debugPanelLog(`[CHEAT] Encounters ${newState ? "ON" : "OFF"}`, true);
    });

    const rKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    rKey.on("down", () => {
      if (!isDebug()) return;
      this.fogOfWar.revealEntireWorld();
      this.player.progression.exploredTiles = this.fogOfWar.getExploredTiles();
      this.callbacks.renderMap();
      this.callbacks.applyDayNightTint();
      this.callbacks.createPlayer();
      this.callbacks.refreshWorldMap();
      debugPanelLog(`[CHEAT] Map revealed`, true);
    });

    const vKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.V);
    vKey.on("down", () => {
      if (!isDebug()) return;
      const newState = !this.fogOfWar.isFogDisabled();
      this.fogOfWar.setFogDisabled(newState);
      debugLog("CHEAT: Fog " + (newState ? "OFF" : "ON"));
      debugPanelLog(`[CHEAT] Fog of War ${newState ? "OFF" : "ON"}`, true);
      this.callbacks.renderMap();
      this.callbacks.applyDayNightTint();
      this.callbacks.createPlayer();
    });

    // ── Slash commands: shared + overworld-specific ──

    const cmds = buildSharedCommands(this.player, cb);

    cmds.set("reveal", () => {
      this.fogOfWar.revealEntireWorld();
      this.player.progression.exploredTiles = this.fogOfWar.getExploredTiles();
      this.callbacks.renderMap();
      this.callbacks.applyDayNightTint();
      this.callbacks.createPlayer();
      this.callbacks.refreshWorldMap();
      debugPanelLog(`[CMD] Entire world map revealed`, true);
    });

    cmds.set("max_hp", (args) => {
      const val = parseInt(args, 10);
      if (!isNaN(val)) { this.player.maxHp = val; this.player.hp = Math.min(this.player.hp, val); this.callbacks.updateHUD(); debugPanelLog(`[CMD] Max HP set to ${val}`, true); }
      else debugPanelLog(`Usage: /max_hp <amount>`, true);
    });
    cmds.set("maxhp", cmds.get("max_hp")!);

    cmds.set("max_mp", (args) => {
      const val = parseInt(args, 10);
      if (!isNaN(val)) { this.player.maxMp = val; this.player.mp = Math.min(this.player.mp, val); this.callbacks.updateHUD(); debugPanelLog(`[CMD] Max MP set to ${val}`, true); }
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
        this.callbacks.updateHUD();
        debugPanelLog(`[CMD] Level set to ${this.player.level}`, true);
        if (result.asiGained > 0 || this.player.pendingStatPoints > 0) {
          this.scene.time.delayedCall(200, () => this.callbacks.showStatOverlay());
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
        this.callbacks.applyDayNightTint();
        this.callbacks.updateWeatherParticles();
        this.callbacks.updateHUD();
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
        this.callbacks.applyDayNightTint();
        this.callbacks.updateHUD();
        debugPanelLog(`[CMD] Time set to ${timeArg} (step ${step})`, true);
      } else {
        debugPanelLog(`Usage: /time <dawn|day|dusk|night>`, true);
      }
    });

    cmds.set("spawn", (args) => {
      const query = args.trim().toLowerCase();
      if (!query) { debugPanelLog(`Usage: /spawn <monster|traveler|adventurer|merchant|hermit>`, true); return; }

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
          this.callbacks.spawnSpecialNpcs(chunk);
        }
        debugPanelLog(`[CMD] Spawned ${SPECIAL_NPC_DEFS[specialKind].label} on the overworld!`, true);
        return;
      }

      const allMonsters: Monster[] = [...MONSTERS, ...DUNGEON_MONSTERS, ...NIGHT_MONSTERS];
      let found = allMonsters.find(m => m.id.toLowerCase() === query);
      if (!found) found = allMonsters.find(m => m.name.toLowerCase() === query);
      if (!found) found = allMonsters.find(m => m.name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query));
      if (found) {
        debugPanelLog(`[CMD] Spawning ${found.name}...`, true);
        this.callbacks.startBattle({ ...found });
      } else {
        debugPanelLog(`[CMD] Unknown: "${args.trim()}". Try a monster name/id, or: traveler, adventurer, merchant, hermit`, true);
      }
    });

    cmds.set("teleport", (args) => {
      const parts = args.trim().split(/\s+/);
      const nameArg = args.trim().toLowerCase();
      if (nameArg && (parts.length !== 2 || isNaN(parseInt(parts[0], 10)))) {
        const city = CITIES.find((c) => c.name.toLowerCase() === nameArg || c.id.toLowerCase() === nameArg);
        if (city) {
          this.player.position.chunkX = city.chunkX;
          this.player.position.chunkY = city.chunkY;
          this.player.position.x = city.tileX;
          this.player.position.y = city.tileY;
          if (this.player.position.inDungeon) { this.player.position.inDungeon = false; this.player.position.dungeonId = ""; }
          if (this.player.position.inCity) { this.player.position.inCity = false; this.player.position.cityId = ""; }
          this.callbacks.renderMap();
          this.callbacks.createPlayer();
          this.callbacks.updateHUD();
          debugPanelLog(`[CMD] Teleported to city ${city.name}`, true);
          return;
        }
        const dungeon = DUNGEONS.find((d) => d.name.toLowerCase() === nameArg || d.id.toLowerCase() === nameArg);
        if (dungeon) {
          this.player.position.chunkX = dungeon.entranceChunkX;
          this.player.position.chunkY = dungeon.entranceChunkY;
          this.player.position.x = dungeon.entranceTileX;
          this.player.position.y = dungeon.entranceTileY;
          if (this.player.position.inDungeon) { this.player.position.inDungeon = false; this.player.position.dungeonId = ""; }
          if (this.player.position.inCity) { this.player.position.inCity = false; this.player.position.cityId = ""; }
          this.callbacks.renderMap();
          this.callbacks.createPlayer();
          this.callbacks.updateHUD();
          debugPanelLog(`[CMD] Teleported to dungeon ${dungeon.name}`, true);
          return;
        }
        const allNames = [
          ...CITIES.map((c) => ({ label: c.name, type: "city" })),
          ...DUNGEONS.map((d) => ({ label: d.name, type: "dungeon" })),
        ];
        const match = allNames.find((n) => n.label.toLowerCase().includes(nameArg));
        if (match) {
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
      this.player.position.x = Math.floor(MAP_WIDTH / 2);
      this.player.position.y = Math.floor(MAP_HEIGHT / 2);
      if (this.player.position.inDungeon) {
        this.player.position.inDungeon = false;
        this.player.position.dungeonId = "";
      }
      this.callbacks.renderMap();
      this.callbacks.createPlayer();
      this.callbacks.updateHUD();
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
          this.callbacks.updateAudio();
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
      this.callbacks.restartScene();
    });

    cmds.set("codex", (_args) => {
      let count = 0;
      for (const m of ALL_MONSTERS) {
        if (!(m.id in this.codex.entries)) {
          recordDefeat(this.codex, m, true, []);
          count++;
        }
      }
      debugPanelLog(`[CMD] Discovered ${count} new codex entries (${Object.keys(this.codex.entries).length} total)`, true);
    });

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
}
