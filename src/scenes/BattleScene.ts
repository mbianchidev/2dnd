import Phaser from 'phaser'

import { BattleSystem } from '../systems/BattleSystem'
import { getActor, HERO_ID } from '../data/actors'
import { getMonster } from '../data/monsters'
import type { ActorData, MonsterData, BattleAction, BattleResult } from '../types'
import { SCALE_FACTOR } from '../main'

interface BattleSceneData {
  returnScene: string
  monsters: string[]
}

/**
 * Battle scene - turn-based DQ-style combat
 */
export class BattleScene extends Phaser.Scene {
  private battleSystem!: BattleSystem
  private returnScene = 'OverworldScene'

  // UI elements
  private messageText!: Phaser.GameObjects.Text
  private menuContainer!: Phaser.GameObjects.Container
  private enemySprites: Phaser.GameObjects.Sprite[] = []
  private playerSprite!: Phaser.GameObjects.Sprite

  // Menu state
  private menuItems: Phaser.GameObjects.Text[] = []
  private selectedIndex = 0
  private currentMenu: 'main' | 'skill' | 'item' | 'target' = 'main'
  private pendingAction?: Partial<BattleAction>

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys

  constructor() {
    super({ key: 'BattleScene' })
  }

  init(data: BattleSceneData): void {
    this.returnScene = data.returnScene || 'OverworldScene'

    // Initialize battle system with party and enemies
    const party: ActorData[] = [getActor(HERO_ID)]
    const enemies: MonsterData[] = data.monsters.map((id) => getMonster(id))

    this.battleSystem = new BattleSystem(party, enemies)
  }

  create(): void {
    this.createBackground()
    this.createEnemySprites()
    this.createPlayerSprite()
    this.createUI()
    this.setupInput()

    // Show encounter message
    this.showMessage(this.getEncounterMessage())

    // Start first turn after delay
    this.time.delayedCall(1500, () => {
      this.startPlayerTurn()
    })
  }

  private createBackground(): void {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // Battle background gradient
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x1a1a4e, 0x1a1a4e, 0x2a2a6e, 0x2a2a6e, 1)
    bg.fillRect(0, 0, width, height / 2)

    // Ground
    bg.fillStyle(0x3a5a3a)
    bg.fillRect(0, height / 2, width, height / 2)
  }

  private createEnemySprites(): void {
    const enemies = this.battleSystem.getEnemies()
    const width = this.cameras.main.width
    const spacing = width / (enemies.length + 1)

    enemies.forEach((enemy, index) => {
      const x = spacing * (index + 1)
      const y = this.cameras.main.height / 3

      const sprite = this.add.sprite(x, y, enemy.spriteKey || 'monster_slime')
      sprite.setScale(SCALE_FACTOR * 2)
      sprite.setData('actorId', enemy.id)
      this.enemySprites.push(sprite)
    })
  }

  private createPlayerSprite(): void {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    this.playerSprite = this.add.sprite(width - 100, height - 200, 'hero')
    this.playerSprite.setScale(SCALE_FACTOR * 2)
  }

  private createUI(): void {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // Message box
    const msgBg = this.add.graphics()
    msgBg.fillStyle(0x000000, 0.8)
    msgBg.fillRoundedRect(20, height - 120, width - 40, 100, 8)
    msgBg.lineStyle(2, 0xffffff, 0.5)
    msgBg.strokeRoundedRect(20, height - 120, width - 40, 100, 8)

    this.messageText = this.add.text(40, height - 100, '', {
      fontSize: '20px',
      color: '#ffffff',
      wordWrap: { width: width - 80 },
    })

    // Menu container (hidden initially)
    this.menuContainer = this.add.container(0, 0)
    this.menuContainer.setVisible(false)

    // Stats display
    this.createStatsDisplay()
  }

  private createStatsDisplay(): void {
    const height = this.cameras.main.height
    const party = this.battleSystem.getParty()
    const hero = party[0]

    const statsText = this.add.text(30, height - 180, '', {
      fontSize: '18px',
      color: '#ffffff',
    })

    // Update stats display
    this.events.on('update-stats', () => {
      const current = this.battleSystem.getParty()[0]
      statsText.setText(`HP: ${current.stats.hp}/${current.stats.maxHp}\nMP: ${current.stats.mp || 0}/${current.stats.maxMp || 0}`)
    })

    // Initial display
    statsText.setText(`HP: ${hero.stats.hp}/${hero.stats.maxHp}\nMP: ${hero.stats.mp || 0}/${hero.stats.maxMp || 0}`)
  }

  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys()

    this.input.keyboard!.on('keydown-ENTER', () => this.confirmSelection())
    this.input.keyboard!.on('keydown-SPACE', () => this.confirmSelection())
    this.input.keyboard!.on('keydown-ESC', () => this.cancelSelection())
  }

  update(): void {
    if (!this.menuContainer.visible) return

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
      this.navigateMenu(-1)
    } else if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
      this.navigateMenu(1)
    }
  }

  private showMessage(text: string): void {
    this.messageText.setText(text)
  }

  private getEncounterMessage(): string {
    const enemies = this.battleSystem.getEnemies()
    if (enemies.length === 1) {
      return `A ${enemies[0].name} appeared!`
    }
    return `${enemies.length} monsters appeared!`
  }

  private startPlayerTurn(): void {
    this.currentMenu = 'main'
    this.showMainMenu()
  }

  private showMainMenu(): void {
    this.menuContainer.removeAll(true)
    this.menuItems = []
    this.selectedIndex = 0

    const options = ['Attack', 'Skills', 'Items', 'Defend', 'Flee']
    const width = this.cameras.main.width

    // Menu background
    const menuBg = this.add.graphics()
    menuBg.fillStyle(0x000000, 0.9)
    menuBg.fillRoundedRect(width - 180, 20, 160, options.length * 35 + 20, 8)
    menuBg.lineStyle(2, 0xffffff, 0.5)
    menuBg.strokeRoundedRect(width - 180, 20, 160, options.length * 35 + 20, 8)
    this.menuContainer.add(menuBg)

    options.forEach((option, index) => {
      const text = this.add.text(width - 160, 35 + index * 35, option, {
        fontSize: '22px',
        color: index === 0 ? '#ffff00' : '#ffffff',
      })
      text.setInteractive({ useHandCursor: true })
      text.on('pointerover', () => this.selectMenuItem(index))
      text.on('pointerdown', () => this.confirmSelection())
      this.menuItems.push(text)
      this.menuContainer.add(text)
    })

    this.menuContainer.setVisible(true)
    this.showMessage('What will you do?')
  }

  private navigateMenu(direction: number): void {
    this.selectMenuItem(this.selectedIndex + direction)
  }

  private selectMenuItem(index: number): void {
    if (index < 0) index = this.menuItems.length - 1
    if (index >= this.menuItems.length) index = 0

    this.menuItems[this.selectedIndex].setColor('#ffffff')
    this.selectedIndex = index
    this.menuItems[this.selectedIndex].setColor('#ffff00')
  }

  private confirmSelection(): void {
    if (!this.menuContainer.visible) return

    switch (this.currentMenu) {
      case 'main':
        this.handleMainMenuSelection()
        break
      case 'target':
        this.handleTargetSelection()
        break
      case 'skill':
        // TODO: Implement skill selection
        break
      case 'item':
        // TODO: Implement item selection
        break
    }
  }

  private handleMainMenuSelection(): void {
    const party = this.battleSystem.getParty()
    const hero = party[0]

    switch (this.selectedIndex) {
      case 0: // Attack
        this.pendingAction = { type: 'attack', actorId: hero.id }
        this.showTargetMenu()
        break
      case 1: // Skills
        // TODO: Show skill menu
        this.showMessage('Skills not yet implemented')
        break
      case 2: // Items
        // TODO: Show item menu
        this.showMessage('Items not yet implemented')
        break
      case 3: // Defend
        this.executeAction({ type: 'defend', actorId: hero.id })
        break
      case 4: // Flee
        this.attemptFlee()
        break
    }
  }

  private showTargetMenu(): void {
    this.currentMenu = 'target'
    this.menuContainer.removeAll(true)
    this.menuItems = []
    this.selectedIndex = 0

    const enemies = this.battleSystem.getEnemies().filter((e) => e.stats.hp > 0)
    const width = this.cameras.main.width

    // Menu background
    const menuBg = this.add.graphics()
    menuBg.fillStyle(0x000000, 0.9)
    menuBg.fillRoundedRect(width - 180, 20, 160, enemies.length * 35 + 20, 8)
    menuBg.lineStyle(2, 0xffffff, 0.5)
    menuBg.strokeRoundedRect(width - 180, 20, 160, enemies.length * 35 + 20, 8)
    this.menuContainer.add(menuBg)

    enemies.forEach((enemy, index) => {
      const text = this.add.text(width - 160, 35 + index * 35, enemy.name, {
        fontSize: '22px',
        color: index === 0 ? '#ffff00' : '#ffffff',
      })
      text.setInteractive({ useHandCursor: true })
      text.on('pointerover', () => this.selectMenuItem(index))
      text.on('pointerdown', () => this.confirmSelection())
      this.menuItems.push(text)
      this.menuContainer.add(text)
    })

    // Highlight first enemy sprite
    this.highlightEnemy(0)
    this.showMessage('Select target')
  }

  private highlightEnemy(index: number): void {
    // Reset all enemy sprites
    this.enemySprites.forEach((sprite, i) => {
      sprite.setTint(i === index ? 0xffff88 : 0xffffff)
    })
  }

  private handleTargetSelection(): void {
    const enemies = this.battleSystem.getEnemies().filter((e) => e.stats.hp > 0)
    const target = enemies[this.selectedIndex]

    if (this.pendingAction) {
      const action: BattleAction = {
        ...this.pendingAction,
        targetIds: [target.id],
      } as BattleAction

      this.executeAction(action)
    }
  }

  private cancelSelection(): void {
    if (this.currentMenu === 'target' || this.currentMenu === 'skill' || this.currentMenu === 'item') {
      // Reset highlights
      this.enemySprites.forEach((sprite) => sprite.clearTint())
      this.currentMenu = 'main'
      this.showMainMenu()
    }
  }

  private executeAction(action: BattleAction): void {
    this.menuContainer.setVisible(false)
    this.enemySprites.forEach((sprite) => sprite.clearTint())

    // Execute the action
    const result = this.battleSystem.executePlayerAction(action)

    // Show action message
    this.showMessage(result.message)

    // Update stats display
    this.events.emit('update-stats')

    // Check for dead enemies and animate
    this.updateEnemySprites()

    // Continue battle after delay
    this.time.delayedCall(1500, () => {
      if (this.battleSystem.isVictory()) {
        this.handleVictory()
      } else if (this.battleSystem.isDefeat()) {
        this.handleDefeat()
      } else {
        this.executeEnemyTurns()
      }
    })
  }

  private updateEnemySprites(): void {
    const enemies = this.battleSystem.getEnemies()

    enemies.forEach((enemy, index) => {
      if (enemy.stats.hp <= 0 && this.enemySprites[index]) {
        // Death animation
        this.tweens.add({
          targets: this.enemySprites[index],
          alpha: 0,
          duration: 500,
          onComplete: () => {
            this.enemySprites[index].destroy()
          },
        })
      }
    })
  }

  private executeEnemyTurns(): void {
    const enemyActions = this.battleSystem.getEnemyActions()

    let delay = 0
    enemyActions.forEach((result) => {
      this.time.delayedCall(delay, () => {
        this.showMessage(result.message)

        // Flash player sprite if damaged
        if (result.damage && result.damage > 0) {
          this.playerSprite.setTint(0xff0000)
          this.time.delayedCall(200, () => {
            this.playerSprite.clearTint()
          })
        }

        this.events.emit('update-stats')
      })
      delay += 1500
    })

    this.time.delayedCall(delay, () => {
      if (this.battleSystem.isDefeat()) {
        this.handleDefeat()
      } else {
        this.startPlayerTurn()
      }
    })
  }

  private attemptFlee(): void {
    this.menuContainer.setVisible(false)

    const success = this.battleSystem.attemptFlee()

    if (success) {
      this.showMessage('Got away safely!')
      this.time.delayedCall(1500, () => {
        this.endBattle({ victory: false, fled: true, experienceGained: 0, goldGained: 0, itemsDropped: [], defeatedMonsters: [] })
      })
    } else {
      this.showMessage("Couldn't escape!")
      this.time.delayedCall(1500, () => {
        this.executeEnemyTurns()
      })
    }
  }

  private handleVictory(): void {
    const rewards = this.battleSystem.getRewards()

    this.showMessage(`Victory! Gained ${rewards.experience} EXP and ${rewards.gold} Gold!`)

    this.time.delayedCall(2000, () => {
      this.endBattle({
        victory: true,
        fled: false,
        experienceGained: rewards.experience,
        goldGained: rewards.gold,
        itemsDropped: rewards.items,
        defeatedMonsters: this.battleSystem.getEnemies().map((e) => e.id),
      })
    })
  }

  private handleDefeat(): void {
    this.showMessage('You have been defeated...')

    // Fade to black
    this.cameras.main.fadeOut(2000, 0, 0, 0)

    this.time.delayedCall(2000, () => {
      // TODO: Handle game over / return to last save
      this.scene.start('TitleScene')
    })
  }

  private endBattle(result: BattleResult): void {
    // Notify the overworld scene
    const overworldScene = this.scene.get(this.returnScene) as { onBattleComplete?: (result: BattleResult) => void }
    if (overworldScene.onBattleComplete) {
      overworldScene.onBattleComplete(result)
    }

    this.scene.stop()
  }
}
