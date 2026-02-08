/**
 * 2D&D - Main entry point.
 * A browser-based JRPG with Dragon Quest gameplay and D&D mechanics.
 */

import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { OverworldScene } from "./scenes/OverworldScene";
import { BattleScene } from "./scenes/BattleScene";
import { ShopScene } from "./scenes/ShopScene";
import { GAME_WIDTH, GAME_HEIGHT, toggleDebug, isDebug, onDebugChanged } from "./config";

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
  },
  scene: [BootScene, OverworldScene, BattleScene, ShopScene],
};

new Phaser.Game(config);

// Wire up the HTML debug toggle
const checkbox = document.getElementById("debug-checkbox") as HTMLInputElement | null;
const label = document.getElementById("debug-label") as HTMLElement | null;
const panel = document.getElementById("debug-panel") as HTMLElement | null;
if (checkbox) {
  checkbox.checked = isDebug();
  checkbox.addEventListener("change", () => {
    const on = toggleDebug();
    checkbox.checked = on;
    if (label) label.style.color = on ? "#00ff00" : "#555";
    if (panel) panel.style.display = on ? "block" : "none";
  });
  onDebugChanged((on) => {
    checkbox.checked = on;
    if (label) label.style.color = on ? "#00ff00" : "#555";
    if (panel) panel.style.display = on ? "block" : "none";
  });
}
