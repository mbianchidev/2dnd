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
 * in battle (K = kill monster, H = full heal, M = restore MP,
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
export function debugPanelLog(msg: string, isDebugMsg = false): void {
  const el = document.getElementById("debug-log");
  if (!el) return;
  const line = document.createElement("div");
  line.textContent = msg;
  if (isDebugMsg) line.className = "debug-msg";
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
