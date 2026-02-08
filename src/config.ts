/**
 * Game configuration constants.
 */

export const GAME_WIDTH = 640;
export const GAME_HEIGHT = 560; // 480 map + 80 HUD
export const TILE_SIZE = 32;

/**
 * Debug mode — toggled via the [debug mode] checkbox above the game canvas.
 * When enabled: shows a debug panel below the game with full action logs
 * and live state, prints to the browser console, and enables cheat keys
 * in battle (K = kill monster, H = full heal, P = restore MP,
 * G = +100 gold, L = level up, X = max XP).
 */
let _debug = false;
type DebugListener = (on: boolean) => void;
const _listeners: DebugListener[] = [];

export function isDebug(): boolean {
  return _debug;
}
export function toggleDebug(): boolean {
  _debug = !_debug;
  _listeners.forEach((fn) => fn(_debug));
  return _debug;
}
export function setDebug(on: boolean): void {
  if (_debug !== on) {
    _debug = on;
    _listeners.forEach((fn) => fn(_debug));
  }
}
export function onDebugChanged(fn: DebugListener): void {
  _listeners.push(fn);
}
export function offDebugChanged(fn: DebugListener): void {
  const idx = _listeners.indexOf(fn);
  if (idx >= 0) _listeners.splice(idx, 1);
}
export function debugLog(...args: unknown[]): void {
  if (_debug) console.log("[DEBUG]", ...args);
}

// --- HTML Debug Panel ---

/** Append a message to the HTML debug log panel. */
export function debugPanelLog(msg: string, isDebugMsg = false, cssClass?: string): void {
  const el = document.getElementById("debug-log");
  if (!el) return;
  const line = document.createElement("div");
  line.textContent = msg;
  if (cssClass) line.className = cssClass;
  else if (isDebugMsg) line.className = "debug-msg";
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

/** Update the live state bar in the HTML debug panel. */
export function debugPanelState(info: string): void {
  const el = document.getElementById("debug-state");
  if (!el) return;
  el.textContent = info;
}

/** Clear the HTML debug log panel (e.g. when entering a new scene). */
export function debugPanelClear(): void {
  const el = document.getElementById("debug-log");
  if (!el) return;
  el.innerHTML = "";
}

// --- Debug Command Input ---

type DebugCommandHandler = (command: string, args: string) => void;
let _debugCommandHandler: DebugCommandHandler | null = null;

/** Register a command handler for the debug text input. Called by the active scene. */
export function setDebugCommandHandler(handler: DebugCommandHandler | null): void {
  _debugCommandHandler = handler;
}

/** Initialize the debug command input listener (called once on startup). */
export function initDebugCommandInput(): void {
  const input = document.getElementById("debug-cmd") as HTMLInputElement | null;
  if (!input) return;
  input.addEventListener("keydown", (e) => {
    e.stopPropagation(); // prevent Phaser from capturing keys while typing
    if (e.key === "Enter") {
      const raw = input.value.trim();
      input.value = "";
      if (!raw.startsWith("/")) {
        debugPanelLog(`Unknown command: ${raw}. Commands start with /`, true);
        return;
      }
      if (!_debug) {
        debugPanelLog("Debug mode is off!", true);
        return;
      }
      const parts = raw.slice(1).split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1).join(" ");
      if (_debugCommandHandler) {
        _debugCommandHandler(cmd, args);
      } else {
        debugPanelLog(`No active command handler.`, true);
      }
    }
  });
  // Prevent Phaser from stealing focus events  
  input.addEventListener("keyup", (e) => e.stopPropagation());
  input.addEventListener("keypress", (e) => e.stopPropagation());
}
