/**
 * Shared debug utilities for cheat hotkeys and slash commands.
 *
 * Both OverworldScene and BattleScene use the same core cheats (gold, heal,
 * MP, level-up, etc.).  This module extracts the common logic so each scene
 * only registers its scene-specific extras.
 */

import Phaser from "phaser";
import { isDebug, debugLog, debugPanelLog, debugPanelClear, setDebugCommandHandler } from "../config";
import { awardXP, processPendingLevelUps, xpForLevel, type PlayerState } from "./player";
import { getSpell } from "../data/spells";
import { getItem } from "../data/items";

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

  return cmds;
}

// ── Help entries shared across scenes ──────────────────────────

export const SHARED_HELP: HelpEntry[] = [
  { usage: "/gold <n>", desc: "Set gold amount" },
  { usage: "/exp <n>", desc: "Award XP (alias: /xp)" },
  { usage: "/hp <n>", desc: "Set current HP" },
  { usage: "/mp <n>", desc: "Set current MP" },
  { usage: "/heal", desc: "Restore full HP & MP" },
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
