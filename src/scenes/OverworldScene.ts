import Phaser from 'phaser'
import { HERO_ID } from '../data/actors'

export default class OverworldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private battleKey!: Phaser.Input.Keyboard.Key

  constructor() {
    super('Overworld')
  }

  create() {
    this.add.text(8, 8, '2DND Overworld\nArrows: move\nB: battle', {
      fontSize: '8px',
      color: '#ffffff',
    })

    this.player = this.add.rectangle(160, 90, 10, 10, 0x4caf50)
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.battleKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.B)
  }

  update() {
    const speed = 60
    const move = { x: 0, y: 0 }

    if (this.cursors.left?.isDown) move.x -= 1
    else if (this.cursors.right?.isDown) move.x += 1

    if (this.cursors.up?.isDown) move.y -= 1
    else if (this.cursors.down?.isDown) move.y += 1

    this.player.x += move.x * speed * this.game.loop.delta / 1000
    this.player.y += move.y * speed * this.game.loop.delta / 1000

    if (Phaser.Input.Keyboard.JustDown(this.battleKey)) {
      this.scene.start('Battle', { enemyId: 'slime', heroId: HERO_ID })
    }
  }
}
