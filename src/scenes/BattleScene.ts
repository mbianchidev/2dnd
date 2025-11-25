import Phaser from 'phaser';
import { Combatant } from '../types/Combat';

export class BattleScene extends Phaser.Scene {
  private combatants: Combatant[] = [];
  private turnQueue: Combatant[] = [];
  private currentTurnIndex: number = 0;
  private combatantGraphics: Map<string, Phaser.GameObjects.Container> = new Map();
  private battleLog!: Phaser.GameObjects.Text;
  private menuContainer!: Phaser.GameObjects.Container;

  constructor() {
    super('BattleScene');
  }

  init(data: { enemies: Combatant[] }) {
    // Initialize combatants (party + enemies)
    // For MVP, hardcode party
    const hero: Combatant = {
      id: 'hero',
      name: 'Hero',
      hp: 100,
      maxHp: 100,
      sp: 20,
      maxSp: 20,
      stats: { str: 10, def: 5, spd: 10 },
      isPlayer: true,
    };
    
    this.combatants = [hero, ...data.enemies];
    // Don't start battle here, wait for create to render first
  }

  create() {
    this.add.rectangle(400, 300, 800, 600, 0x222222); // Background
    this.add.text(400, 50, 'Battle Start!', { fontSize: '32px', color: '#fff' }).setOrigin(0.5);
    
    this.battleLog = this.add.text(400, 550, '', { fontSize: '16px', color: '#aaa' }).setOrigin(0.5);

    // Render combatants
    this.combatants.forEach((c, index) => {
        const x = c.isPlayer ? 200 : 600;
        const y = 200 + (index * 100); // Simple layout
        
        const container = this.add.container(x, y);
        const color = c.isPlayer ? 0x0000ff : 0xff0000;
        const rect = this.add.rectangle(0, 0, 64, 64, color);
        const nameText = this.add.text(0, -40, c.name, { fontSize: '16px', color: '#fff' }).setOrigin(0.5);
        const hpText = this.add.text(0, 40, `HP: ${c.hp}/${c.maxHp}`, { fontSize: '14px', color: '#fff' }).setOrigin(0.5);
        
        container.add([rect, nameText, hpText]);
        this.combatantGraphics.set(c.id, container);
    });

    this.menuContainer = this.add.container(400, 450);
    this.menuContainer.setVisible(false);

    this.startBattle();
  }

  startBattle() {
    // Sort by speed
    this.turnQueue = [...this.combatants].sort((a, b) => b.stats.spd - a.stats.spd);
    this.currentTurnIndex = 0;
    this.time.delayedCall(1000, () => this.nextTurn());
  }

  nextTurn() {
    const currentCombatant = this.turnQueue[this.currentTurnIndex];
    this.battleLog.setText(`Turn: ${currentCombatant.name}`);

    if (currentCombatant.hp <= 0) {
        // Skip dead combatants
        this.currentTurnIndex = (this.currentTurnIndex + 1) % this.turnQueue.length;
        this.nextTurn();
        return;
    }

    // Highlight current turn
    this.combatantGraphics.forEach((g, id) => {
        g.setAlpha(id === currentCombatant.id ? 1.0 : 0.5);
    });

    if (currentCombatant.isPlayer) {
      // Enable UI for player input
      this.playerInput(currentCombatant);
    } else {
      // AI logic
      this.time.delayedCall(1000, () => this.enemyAI(currentCombatant));
    }
  }

  playerInput(combatant: Combatant) {
    this.menuContainer.removeAll(true);
    this.menuContainer.setVisible(true);

    const attackBtn = this.add.text(0, 0, 'Attack', { fontSize: '24px', color: '#0f0', backgroundColor: '#333', padding: { x: 10, y: 5 } })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
            this.menuContainer.setVisible(false);
            // Select target (simplified: first enemy)
            const target = this.combatants.find(c => !c.isPlayer && c.hp > 0);
            if (target) {
                this.executeAction(combatant, target, 'attack');
            }
        });
    
    this.menuContainer.add(attackBtn);
  }

  enemyAI(combatant: Combatant) {
    // Placeholder: Attack hero
    const target = this.combatants.find(c => c.isPlayer && c.hp > 0);
    if (target) {
        this.executeAction(combatant, target, 'attack');
    } else {
        this.endBattle(false);
    }
  }

  executeAction(user: Combatant, target: Combatant, actionType: string) {
    this.battleLog.setText(`${user.name} uses ${actionType} on ${target.name}`);
    
    // Damage formula (DQ style / simple)
    // Dmg = (Atk / 2) - (Def / 4)
    const damage = Math.max(1, Math.floor(user.stats.str / 2 - target.stats.def / 4));
    target.hp -= damage;
    
    // Update visuals
    const targetGraphics = this.combatantGraphics.get(target.id);
    if (targetGraphics) {
        const hpText = targetGraphics.list[2] as Phaser.GameObjects.Text;
        hpText.setText(`HP: ${target.hp}/${target.maxHp}`);
        
        // Shake effect
        this.tweens.add({
            targets: targetGraphics,
            x: targetGraphics.x + 10,
            duration: 50,
            yoyo: true,
            repeat: 3
        });
    }

    if (target.hp <= 0) {
        this.battleLog.setText(`${target.name} defeated!`);
        if (targetGraphics) targetGraphics.setAlpha(0.2);
    }

    // Check win/loss
    const playersAlive = this.combatants.some(c => c.isPlayer && c.hp > 0);
    const enemiesAlive = this.combatants.some(c => !c.isPlayer && c.hp > 0);

    if (!playersAlive) {
        this.time.delayedCall(1000, () => this.endBattle(false));
    } else if (!enemiesAlive) {
        this.time.delayedCall(1000, () => this.endBattle(true));
    } else {
        this.currentTurnIndex = (this.currentTurnIndex + 1) % this.turnQueue.length;
        // Simple delay for pacing
        this.time.delayedCall(1500, () => this.nextTurn());
    }
  }

  endBattle(win: boolean) {
    console.log(`Battle Ended. Win: ${win}`);
    this.scene.start('TilemapScene');
  }
}
