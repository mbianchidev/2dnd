import Phaser from 'phaser'
import { BattleEngine } from '../core/battle/BattleEngine'
import type { BattleEngine as BattleEngineType } from '../core/battle/BattleEngine'

interface BattleSceneData {
  heroId: string
  enemyId: string
}

export default class BattleScene extends Phaser.Scene {
  private engine!: BattleEngineType
  private hpText!: Phaser.GameObjects.Text
  private enemyHpText!: Phaser.GameObjects.Text
  private logText!: Phaser.GameObjects.Text
  private actionKey!: Phaser.Input.Keyboard.Key
  private backKey!: Phaser.Input.Keyboard.Key

  constructor() {
    super('Battle')
  }

  init(data: BattleSceneData) {
    const { heroId = 'hero', enemyId = 'slime' } = data || {}
    this.engine = new BattleEngine(heroId, enemyId)
  }

  create() {
    this.add.text(8, 8, 'Battle!\nA: Attack\nSpace: back when done', {
      fontSize: '8px',
      color: '#ffffff',
    })
    this.hpText = this.add.text(8, 40, '', { fontSize: '8px', color: '#8bc34a' })
    this.enemyHpText = this.add.text(8, 52, '', { fontSize: '8px', color: '#f44336' })
    this.logText = this.add.text(8, 70, '', { fontSize: '8px', color: '#ffffff', wordWrap: { width: 304 } })

    this.actionKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A)
    this.backKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)

    this.updateUi()
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.actionKey) && !this.engine.isBattleOver()) {
      const result = this.engine.playerAttack()
      this.updateUi()
      if (result) {
        this.logText.setText(this.engine.log.map((l) => l.message).join('\n'))
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.backKey) && this.engine.isBattleOver()) {
      this.scene.start('Overworld')
    }
  }

  private updateUi() {
    this.hpText.setText(`Hero HP: ${this.engine.hero.stats.hp}/${this.engine.hero.stats.maxHp}`)
    this.enemyHpText.setText(
      `${this.engine.enemy.name} HP: ${this.engine.enemy.stats.hp}/${this.engine.enemy.stats.maxHp}`
    )
    this.logText.setText(this.engine.log.map((l) => l.message).join('\n'))
  }
}
