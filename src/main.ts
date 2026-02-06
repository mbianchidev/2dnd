/**
 * 2D&D - Main entry point.
 * A browser-based JRPG with Dragon Quest gameplay and D&D mechanics.
 */

import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { OverworldScene } from "./scenes/OverworldScene";
import { BattleScene } from "./scenes/BattleScene";
import { ShopScene } from "./scenes/ShopScene";
import { GAME_WIDTH, GAME_HEIGHT } from "./config";

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
