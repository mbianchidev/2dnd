import Phaser from 'phaser'

/**
 * Boot scene - minimal setup before loading assets
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload(): void {
    // Load only what's needed for the loading screen
    // Could load a loading bar graphic here if available
  }

  create(): void {
    // Proceed to preload scene
    this.scene.start('PreloadScene')
  }
}
