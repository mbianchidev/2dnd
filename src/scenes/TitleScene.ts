import Phaser from 'phaser'

/**
 * Title scene - main menu
 */
export class TitleScene extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private menuItems: Phaser.GameObjects.Text[] = []
  private selectedIndex = 0

  constructor() {
    super({ key: 'TitleScene' })
  }

  create(): void {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // Title
    const title = this.add.text(width / 2, height / 3, '2DND', {
      fontSize: '72px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    title.setOrigin(0.5)

    // Subtitle
    const subtitle = this.add.text(width / 2, height / 3 + 60, 'A Browser JRPG', {
      fontSize: '24px',
      color: '#aaaaaa',
    })
    subtitle.setOrigin(0.5)

    // Menu items
    const menuOptions = ['New Game', 'Continue', 'Settings']
    const startY = height / 2 + 50

    menuOptions.forEach((option, index) => {
      const text = this.add.text(width / 2, startY + index * 40, option, {
        fontSize: '28px',
        color: index === 0 ? '#ffff00' : '#ffffff',
      })
      text.setOrigin(0.5)
      text.setInteractive({ useHandCursor: true })

      text.on('pointerover', () => {
        this.selectMenuItem(index)
      })

      text.on('pointerdown', () => {
        this.confirmSelection()
      })

      this.menuItems.push(text)
    })

    // Keyboard input
    this.cursors = this.input.keyboard!.createCursorKeys()

    this.input.keyboard!.on('keydown-ENTER', () => {
      this.confirmSelection()
    })

    this.input.keyboard!.on('keydown-SPACE', () => {
      this.confirmSelection()
    })

    // Instructions
    const instructions = this.add.text(width / 2, height - 40, 'Use Arrow Keys + Enter to navigate', {
      fontSize: '16px',
      color: '#666666',
    })
    instructions.setOrigin(0.5)
  }

  update(): void {
    // Handle menu navigation
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
      this.selectMenuItem(this.selectedIndex - 1)
    } else if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
      this.selectMenuItem(this.selectedIndex + 1)
    }
  }

  private selectMenuItem(index: number): void {
    // Wrap around
    if (index < 0) index = this.menuItems.length - 1
    if (index >= this.menuItems.length) index = 0

    // Update colors
    this.menuItems[this.selectedIndex].setColor('#ffffff')
    this.selectedIndex = index
    this.menuItems[this.selectedIndex].setColor('#ffff00')
  }

  private confirmSelection(): void {
    switch (this.selectedIndex) {
      case 0: // New Game
        this.startNewGame()
        break
      case 1: // Continue
        this.loadGame()
        break
      case 2: // Settings
        this.openSettings()
        break
    }
  }

  private startNewGame(): void {
    // TODO: Initialize new game state
    this.scene.start('OverworldScene')
  }

  private loadGame(): void {
    // TODO: Load from save
    // For now, just start the game
    this.scene.start('OverworldScene')
  }

  private openSettings(): void {
    // TODO: Open settings menu
    // eslint-disable-next-line no-console
    console.log('Settings not yet implemented')
  }
}
