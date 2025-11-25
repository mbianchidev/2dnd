import Phaser from 'phaser'

/**
 * Preload scene - load all game assets with progress bar
 */
export class PreloadScene extends Phaser.Scene {
  private progressBar!: Phaser.GameObjects.Graphics
  private progressBox!: Phaser.GameObjects.Graphics
  private loadingText!: Phaser.GameObjects.Text

  constructor() {
    super({ key: 'PreloadScene' })
  }

  preload(): void {
    this.createLoadingUI()
    this.setupLoadEvents()
    this.loadAssets()
  }

  private createLoadingUI(): void {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // Progress box (background)
    this.progressBox = this.add.graphics()
    this.progressBox.fillStyle(0x222222, 0.8)
    this.progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50)

    // Progress bar (foreground)
    this.progressBar = this.add.graphics()

    // Loading text
    this.loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
      fontSize: '24px',
      color: '#ffffff',
    })
    this.loadingText.setOrigin(0.5)
  }

  private setupLoadEvents(): void {
    this.load.on('progress', (value: number) => {
      const width = this.cameras.main.width
      const height = this.cameras.main.height

      this.progressBar.clear()
      this.progressBar.fillStyle(0x4a9eff, 1)
      this.progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30)
    })

    this.load.on('complete', () => {
      this.progressBar.destroy()
      this.progressBox.destroy()
      this.loadingText.destroy()
    })
  }

  private loadAssets(): void {
    // Placeholder - load actual assets when available
    // Example asset loading:
    // this.load.image('tileset', 'assets/sprites/tileset.png')
    // this.load.tilemapTiledJSON('map_village', 'assets/maps/village.json')
    // this.load.spritesheet('hero', 'assets/sprites/hero.png', { frameWidth: 16, frameHeight: 16 })
    // this.load.audio('bgm_field', 'assets/audio/field.mp3')

    // For now, create placeholder graphics in create()
  }

  create(): void {
    // Create placeholder graphics for testing
    this.createPlaceholderTextures()

    // Proceed to title scene
    this.scene.start('TitleScene')
  }

  private createPlaceholderTextures(): void {
    // Hero sprite (16x16 blue square)
    const heroGraphics = this.make.graphics({ x: 0, y: 0 })
    heroGraphics.fillStyle(0x4a9eff)
    heroGraphics.fillRect(0, 0, 16, 16)
    heroGraphics.generateTexture('hero', 16, 16)
    heroGraphics.destroy()

    // Monster sprites
    const slimeGraphics = this.make.graphics({ x: 0, y: 0 })
    slimeGraphics.fillStyle(0x44ff44)
    slimeGraphics.fillCircle(8, 10, 6)
    slimeGraphics.generateTexture('monster_slime', 16, 16)
    slimeGraphics.destroy()

    const goblinGraphics = this.make.graphics({ x: 0, y: 0 })
    goblinGraphics.fillStyle(0x88aa44)
    goblinGraphics.fillRect(2, 2, 12, 12)
    goblinGraphics.generateTexture('monster_goblin', 16, 16)
    goblinGraphics.destroy()

    // Tileset placeholder (single tile)
    const tileGraphics = this.make.graphics({ x: 0, y: 0 })
    tileGraphics.fillStyle(0x558855)
    tileGraphics.fillRect(0, 0, 16, 16)
    tileGraphics.lineStyle(1, 0x336633)
    tileGraphics.strokeRect(0, 0, 16, 16)
    tileGraphics.generateTexture('tile_grass', 16, 16)
    tileGraphics.destroy()
  }
}
