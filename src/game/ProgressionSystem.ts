import { Player } from '../types/game';
import { experienceForLevel } from './dice';
import { SPELLS } from './data';

export class ProgressionSystem {
  /**
   * Add experience to player and handle leveling up
   */
  addExperience(player: Player, amount: number): boolean {
    player.experience += amount;
    
    const neededExp = experienceForLevel(player.level);
    if (player.experience >= neededExp) {
      this.levelUp(player);
      return true;
    }
    
    return false;
  }

  /**
   * Level up the player
   */
  private levelUp(player: Player) {
    player.level++;
    player.experience = 0;
    
    // Increase stats
    player.maxHealth += 8; // d8 hit die
    player.health = player.maxHealth;
    player.maxMana += 4;
    player.mana = player.maxMana;
    
    // Every few levels, increase ability scores
    if (player.level % 4 === 0) {
      player.strength += 1;
      player.constitution += 1;
    }
    
    // Learn new spells at certain levels
    this.checkSpellUnlocks(player);
  }

  /**
   * Check if player unlocks new spells at their level
   */
  private checkSpellUnlocks(player: Player) {
    const availableSpells = SPELLS.filter(
      spell => spell.level <= Math.ceil(player.level / 2)
    );
    
    for (const spell of availableSpells) {
      if (!player.spells.find(s => s.id === spell.id)) {
        player.spells.push(spell);
      }
    }
  }

  /**
   * Add gold to player
   */
  addGold(player: Player, amount: number) {
    player.gold += amount;
  }

  /**
   * Spend gold (returns false if insufficient funds)
   */
  spendGold(player: Player, amount: number): boolean {
    if (player.gold >= amount) {
      player.gold -= amount;
      return true;
    }
    return false;
  }

  /**
   * Heal player
   */
  heal(player: Player, amount: number) {
    player.health = Math.min(player.health + amount, player.maxHealth);
  }

  /**
   * Restore mana
   */
  restoreMana(player: Player, amount: number) {
    player.mana = Math.min(player.mana + amount, player.maxMana);
  }

  /**
   * Rest at an inn (full heal and mana restore)
   */
  rest(player: Player) {
    player.health = player.maxHealth;
    player.mana = player.maxMana;
  }
}
