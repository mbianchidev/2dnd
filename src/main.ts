import Phaser from 'phaser'

import { BootScene } from './scenes/BootScene'
import { PreloadScene } from './scenes/PreloadScene'
import { TitleScene } from './scenes/TitleScene'
import { OverworldScene } from './scenes/OverworldScene'
import { BattleScene } from './scenes/BattleScene'

// Target resolution (320x180 at 3x scale = 960x540)
const GAME_WIDTH = 320
const GAME_HEIGHT = 180
const SCALE_FACTOR = 3

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH * SCALE_FACTOR,
  height: GAME_HEIGHT * SCALE_FACTOR,
  pixelArt: true,
  backgroundColor: '#1a1a2e',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: import.meta.env.DEV,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, PreloadScene, TitleScene, OverworldScene, BattleScene],
}

const game = new Phaser.Game(config)

// Export for debugging in development
if (import.meta.env.DEV) {
  // @ts-expect-error - expose game globally for debugging
  window.__GAME__ = game
}

export { game, GAME_WIDTH, GAME_HEIGHT, SCALE_FACTOR }
