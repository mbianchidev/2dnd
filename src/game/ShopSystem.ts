import { Player, Item } from '../types/game';
import { ITEMS } from './data';
import { rollDice } from './dice';

export class ShopSystem {
  /**
   * Get available items in shop
   */
  getShopInventory(): Item[] {
    return Object.values(ITEMS);
  }

  /**
   * Purchase an item
   */
  buyItem(player: Player, itemId: string): boolean {
    const item = ITEMS[itemId];
    if (!item) {
      return false;
    }

    if (player.gold >= item.value) {
      player.gold -= item.value;
      player.inventory.push({ ...item });
      return true;
    }

    return false;
  }

  /**
   * Sell an item (50% of purchase price)
   */
  sellItem(player: Player, itemIndex: number): boolean {
    if (itemIndex < 0 || itemIndex >= player.inventory.length) {
      return false;
    }

    const item = player.inventory[itemIndex];
    player.gold += Math.floor(item.value / 2);
    player.inventory.splice(itemIndex, 1);
    return true;
  }

  /**
   * Use an item
   */
  useItem(player: Player, itemIndex: number): { success: boolean; message: string } {
    if (itemIndex < 0 || itemIndex >= player.inventory.length) {
      return { success: false, message: 'Invalid item' };
    }

    const item = player.inventory[itemIndex];
    
    switch (item.id) {
      case 'health-potion':
        if (item.effect) {
          const healing = rollDice(item.effect);
          player.health = Math.min(player.health + healing, player.maxHealth);
          player.inventory.splice(itemIndex, 1);
          return { success: true, message: `Restored ${healing} HP!` };
        }
        break;
        
      case 'mana-potion':
        if (item.effect) {
          const manaRestored = rollDice(item.effect);
          player.mana = Math.min(player.mana + manaRestored, player.maxMana);
          player.inventory.splice(itemIndex, 1);
          return { success: true, message: `Restored ${manaRestored} MP!` };
        }
        break;
        
      default:
        return { success: false, message: 'Cannot use this item now' };
    }

    return { success: false, message: 'Failed to use item' };
  }

  /**
   * Equip an item
   */
  equipItem(player: Player, itemIndex: number): boolean {
    if (itemIndex < 0 || itemIndex >= player.inventory.length) {
      return false;
    }

    const item = player.inventory[itemIndex];
    
    if (item.type === 'weapon') {
      if (player.equipment.weapon) {
        player.inventory.push(player.equipment.weapon);
      }
      player.equipment.weapon = item;
      player.inventory.splice(itemIndex, 1);
      return true;
    } else if (item.type === 'armor') {
      if (player.equipment.armor) {
        player.inventory.push(player.equipment.armor);
      }
      player.equipment.armor = item;
      player.inventory.splice(itemIndex, 1);
      return true;
    }

    return false;
  }
}
