import Phaser from 'phaser'
import './style.css'
import BootScene from './scenes/BootScene'
import PreloadScene from './scenes/PreloadScene'
import OverworldScene from './scenes/OverworldScene'
import BattleScene from './scenes/BattleScene'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 320,
  height: 180,
  parent: 'app',
  backgroundColor: '#000000',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, PreloadScene, OverworldScene, BattleScene],
}

void new Phaser.Game(config)
