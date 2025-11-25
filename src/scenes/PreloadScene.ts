import Phaser from 'phaser'

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload')
  }

  preload() {
    // Load assets here when available
    // Example: this.load.image('player', 'assets/sprites/player.png')
  }

  create() {
    this.scene.start('Overworld')
  }
}
