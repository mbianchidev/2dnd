/**
 * 2D&D - Main entry point.
 * A browser-based JRPG with Dragon Quest gameplay and D&D mechanics.
 */

import Phaser from "phaser";
import { BootScene } from "./scenes/Boot";
import { OverworldScene } from "./scenes/Overworld";
import { BattleScene } from "./scenes/Battle";
import { ShopScene } from "./scenes/Shop";
import { CodexScene } from "./scenes/Codex";
import { GAME_WIDTH, GAME_HEIGHT, toggleDebug, isDebug, onDebugChanged, initDebugCommandInput, isLocalDev } from "./config";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  backgroundColor: "#111111",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom: 2,
  },
  scene: [BootScene, OverworldScene, BattleScene, ShopScene, CodexScene],
};

new Phaser.Game(config);

// Wire up the HTML debug toggle (local dev only)
const debugToggle = document.getElementById("debug-toggle") as HTMLElement | null;
const checkbox = document.getElementById("debug-checkbox") as HTMLInputElement | null;
const label = document.getElementById("debug-label") as HTMLElement | null;
const panel = document.getElementById("debug-panel") as HTMLElement | null;

const debugCheatsSection = document.getElementById("debug-cheats") as HTMLElement | null;

if (!isLocalDev()) {
  // Hide all debug UI on production (github.io)
  if (debugToggle) debugToggle.style.display = "none";
  if (panel) panel.style.display = "none";
} else {
  if (checkbox) {
    checkbox.checked = isDebug();
    // Blur on change so that pressing SPACE to start the game doesn't
    // accidentally toggle the checkbox off.
    checkbox.addEventListener("change", () => {
      const on = toggleDebug();
      checkbox.checked = on;
      checkbox.blur();
      if (label) label.style.color = on ? "#00ff00" : "#555";
      if (panel) panel.style.display = on ? "block" : "none";
      if (debugCheatsSection) debugCheatsSection.style.display = on ? "block" : "none";
    });
    onDebugChanged((on) => {
      checkbox.checked = on;
      if (label) label.style.color = on ? "#00ff00" : "#555";
      if (panel) panel.style.display = on ? "block" : "none";
      if (debugCheatsSection) debugCheatsSection.style.display = on ? "block" : "none";
    });
    // Sync initial state in case debug was already on
    if (isDebug()) {
      if (label) label.style.color = "#00ff00";
      if (panel) panel.style.display = "block";
      if (debugCheatsSection) debugCheatsSection.style.display = "block";
    }
  }

  // Initialize debug command textbox
  initDebugCommandInput();
}

// Clicking on the game canvas should blur the debug command input
// so that Phaser regains keyboard focus
const gameContainer = document.getElementById("game-container");
const debugCmd = document.getElementById("debug-cmd") as HTMLInputElement | null;
if (gameContainer && debugCmd) {
  gameContainer.addEventListener("pointerdown", () => {
    if (document.activeElement === debugCmd) {
      debugCmd.blur();
    }
  });
}
