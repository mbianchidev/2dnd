import { Player, Monster, BattleState } from '../types/game';
import { rollDice, rollD20, getAbilityModifier, rollInitiative } from './dice';
import { MONSTERS } from './data';

export class BattleSystem {
  private battleState: BattleState;

  constructor() {
    this.battleState = {
      active: false,
      playerTurn: true,
      battleLog: [],
    };
  }

  startBattle(monsterId: string): Monster {
    const monsterTemplate = MONSTERS[monsterId];
    if (!monsterTemplate) {
      throw new Error(`Unknown monster: ${monsterId}`);
    }

    // Create a copy of the monster
    const monster: Monster = {
      ...monsterTemplate,
      health: monsterTemplate.maxHealth,
    };

    this.battleState = {
      active: true,
      monster,
      playerTurn: true,
      battleLog: [`A wild ${monster.name} appears!`],
    };

    return monster;
  }

  rollInitiative(player: Player): void {
    if (!this.battleState.monster) return;

    const playerInit = rollInitiative(player.dexterity);
    const monsterInit = rollInitiative(10); // Assume 10 dex for monsters

    this.battleState.playerTurn = playerInit >= monsterInit;
    
    if (this.battleState.playerTurn) {
      this.addLog('You act first!');
    } else {
      this.addLog('The enemy acts first!');
    }
  }

  playerAttack(player: Player): { hit: boolean; damage: number } {
    if (!this.battleState.monster) {
      return { hit: false, damage: 0 };
    }

    const attackRoll = rollD20();
    const attackBonus = getAbilityModifier(player.strength) + 2; // +2 proficiency
    const totalAttack = attackRoll + attackBonus;

    if (totalAttack >= this.battleState.monster.armorClass) {
      // Hit!
      const damage = rollDice('1d8') + getAbilityModifier(player.strength);
      this.battleState.monster.health -= damage;
      this.addLog(`You hit for ${damage} damage!`);
      
      if (this.battleState.monster.health <= 0) {
        this.addLog(`${this.battleState.monster.name} is defeated!`);
      }
      
      return { hit: true, damage };
    } else {
      // Miss
      this.addLog('Your attack misses!');
      return { hit: false, damage: 0 };
    }
  }

  playerCastSpell(_player: Player, spellDamage: string): { success: boolean; damage: number } {
    if (!this.battleState.monster) {
      return { success: false, damage: 0 };
    }

    const damage = rollDice(spellDamage);
    this.battleState.monster.health -= damage;
    this.addLog(`Your spell hits for ${damage} damage!`);
    
    if (this.battleState.monster.health <= 0) {
      this.addLog(`${this.battleState.monster.name} is defeated!`);
    }
    
    return { success: true, damage };
  }

  monsterAttack(player: Player): { hit: boolean; damage: number } {
    if (!this.battleState.monster) {
      return { hit: false, damage: 0 };
    }

    const attackRoll = rollD20();
    const totalAttack = attackRoll + this.battleState.monster.attackBonus;
    const playerAC = 10 + getAbilityModifier(player.dexterity);

    if (totalAttack >= playerAC) {
      // Hit!
      const damage = rollDice(this.battleState.monster.damage);
      this.addLog(`${this.battleState.monster.name} hits you for ${damage} damage!`);
      return { hit: true, damage };
    } else {
      // Miss
      this.addLog(`${this.battleState.monster.name} misses!`);
      return { hit: false, damage: 0 };
    }
  }

  playerFlee(): boolean {
    const fleeChance = Math.random();
    if (fleeChance < 0.5) {
      this.addLog('You successfully flee from battle!');
      this.battleState.active = false;
      return true;
    } else {
      this.addLog('You failed to escape!');
      return false;
    }
  }

  endBattle(_player: Player): { experience: number; gold: number } {
    if (!this.battleState.monster) {
      return { experience: 0, gold: 0 };
    }

    const experience = this.battleState.monster.experience;
    const gold = this.battleState.monster.gold;
    
    this.addLog(`You gained ${experience} XP and ${gold} gold!`);
    
    this.battleState.active = false;
    this.battleState.monster = undefined;
    
    return { experience, gold };
  }

  getBattleState(): BattleState {
    return this.battleState;
  }

  getBattleLog(): string[] {
    return this.battleState.battleLog;
  }

  addLog(message: string) {
    this.battleState.battleLog.push(message);
    // Keep only last 10 messages
    if (this.battleState.battleLog.length > 10) {
      this.battleState.battleLog.shift();
    }
  }

  setPlayerTurn(turn: boolean) {
    this.battleState.playerTurn = turn;
  }

  isPlayerTurn(): boolean {
    return this.battleState.playerTurn;
  }
}
