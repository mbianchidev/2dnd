import Phaser from 'phaser';
import { TilemapScene } from './scenes/TilemapScene';
import { BattleScene } from './scenes/BattleScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'app',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0, x: 0 },
      debug: false,
    },
  },
  scene: [TilemapScene, BattleScene],
};

new Phaser.Game(config);
