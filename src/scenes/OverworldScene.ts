import Phaser from 'phaser'

import { SCALE_FACTOR } from '../main'

/**
 * Overworld scene - exploration, NPCs, encounter triggers
 */
export class OverworldScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key }

  // Movement
  private readonly PLAYER_SPEED = 100 * SCALE_FACTOR
  private stepCounter = 0
  private readonly ENCOUNTER_CHECK_INTERVAL = 16 // pixels between encounter checks
  private readonly BASE_ENCOUNTER_RATE = 0.05 // 5% chance per check

  // Map layers (for when Tiled maps are added)
  // @ts-expect-error - will be used when Tiled maps are added
  private _groundLayer?: Phaser.Tilemaps.TilemapLayer
  private collisionLayer?: Phaser.Tilemaps.TilemapLayer

  constructor() {
    super({ key: 'OverworldScene' })
  }

  create(): void {
    this.createPlaceholderMap()
    this.createPlayer()
    this.setupCamera()
    this.setupInput()
    this.setupCollisions()
  }

  private createPlaceholderMap(): void {
    const width = this.cameras.main.width
    const height = this.cameras.main.height
    const tileSize = 16 * SCALE_FACTOR

    // Create a simple grid of grass tiles
    for (let x = 0; x < width; x += tileSize) {
      for (let y = 0; y < height; y += tileSize) {
        const tile = this.add.image(x + tileSize / 2, y + tileSize / 2, 'tile_grass')
        tile.setScale(SCALE_FACTOR)
      }
    }

    // Add some visual variation
    const variation = this.add.graphics()
    variation.fillStyle(0x447744, 0.3)

    // Random darker patches
    for (let i = 0; i < 20; i++) {
      const x = Phaser.Math.Between(0, width)
      const y = Phaser.Math.Between(0, height)
      const size = Phaser.Math.Between(tileSize, tileSize * 3)
      variation.fillCircle(x, y, size)
    }
  }

  private createPlayer(): void {
    const centerX = this.cameras.main.width / 2
    const centerY = this.cameras.main.height / 2

    this.player = this.physics.add.sprite(centerX, centerY, 'hero')
    this.player.setScale(SCALE_FACTOR)
    this.player.setCollideWorldBounds(true)
    this.player.setDepth(10)

    // Set physics body size
    this.player.body?.setSize(14, 14)
  }

  private setupCamera(): void {
    this.cameras.main.startFollow(this.player, true)
    this.cameras.main.setZoom(1)
  }

  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    }

    // Menu key
    this.input.keyboard!.on('keydown-ESC', () => {
      this.openMenu()
    })

    // Debug: Force encounter
    if (import.meta.env.DEV) {
      this.input.keyboard!.on('keydown-B', () => {
        this.startBattle()
      })
    }
  }

  private setupCollisions(): void {
    // When Tiled maps are added, set up collisions with the collision layer
    if (this.collisionLayer) {
      this.physics.add.collider(this.player, this.collisionLayer)
    }
  }

  update(): void {
    this.handleMovement()
    this.checkEncounters()
  }

  private handleMovement(): void {
    const speed = this.PLAYER_SPEED

    // Reset velocity
    this.player.setVelocity(0)

    // Horizontal movement
    if (this.cursors.left.isDown || this.wasd.A.isDown) {
      this.player.setVelocityX(-speed)
    } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
      this.player.setVelocityX(speed)
    }

    // Vertical movement
    if (this.cursors.up.isDown || this.wasd.W.isDown) {
      this.player.setVelocityY(-speed)
    } else if (this.cursors.down.isDown || this.wasd.S.isDown) {
      this.player.setVelocityY(speed)
    }

    // Normalize diagonal movement
    const velocity = this.player.body?.velocity
    if (velocity && velocity.x !== 0 && velocity.y !== 0) {
      this.player.setVelocity(velocity.x * 0.707, velocity.y * 0.707)
    }
  }

  private checkEncounters(): void {
    const velocity = this.player.body?.velocity
    if (!velocity || (velocity.x === 0 && velocity.y === 0)) return

    // Track distance traveled
    const distance = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y) * (1 / 60) // Assuming 60fps
    this.stepCounter += distance

    if (this.stepCounter >= this.ENCOUNTER_CHECK_INTERVAL) {
      this.stepCounter = 0

      // Roll for encounter
      if (Math.random() < this.BASE_ENCOUNTER_RATE) {
        this.startBattle()
      }
    }
  }

  private startBattle(): void {
    // Flash effect before battle
    this.cameras.main.flash(200, 255, 255, 255)

    this.time.delayedCall(200, () => {
      this.scene.pause()
      this.scene.launch('BattleScene', {
        returnScene: 'OverworldScene',
        // TODO: Pass encounter data based on current zone
        monsters: ['slime'],
      })
    })
  }

  private openMenu(): void {
    // TODO: Open in-game menu
    // eslint-disable-next-line no-console
    console.log('Menu not yet implemented')
  }

  // Called when returning from battle
  public onBattleComplete(result: { victory: boolean; fled: boolean }): void {
    if (result.fled) {
      // Teleport player slightly to avoid immediate re-encounter
      this.stepCounter = -this.ENCOUNTER_CHECK_INTERVAL * 5
    }
    this.scene.resume()
  }
}
