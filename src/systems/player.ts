/**
 * Player state management: stats, leveling, experience, spell unlocks.
 */

import { abilityModifier } from "../utils/dice";
import type { Spell } from "../data/spells";
import { SPELLS } from "../data/spells";
import type { Item } from "../data/items";

export interface PlayerStats {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export interface PlayerState {
  name: string;
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  stats: PlayerStats;
  gold: number;
  inventory: Item[];
  knownSpells: string[]; // spell IDs
  equippedWeapon: Item | null;
  equippedArmor: Item | null;
  x: number; // overworld tile position
  y: number;
}

/** XP required to reach a given level. */
export function xpForLevel(level: number): number {
  return level * level * 100;
}

/** Create a fresh level-1 player. */
export function createPlayer(name: string): PlayerState {
  return {
    name,
    level: 1,
    xp: 0,
    hp: 30,
    maxHp: 30,
    mp: 10,
    maxMp: 10,
    stats: {
      strength: 12,
      dexterity: 10,
      constitution: 14,
      intelligence: 10,
      wisdom: 10,
      charisma: 8,
    },
    gold: 50,
    inventory: [],
    knownSpells: ["fireBolt"], // start with a cantrip
    equippedWeapon: null,
    equippedArmor: null,
    x: 7,
    y: 7,
  };
}

/** Get the attack modifier for the player (STR-based melee). */
export function getAttackModifier(player: PlayerState): number {
  const proficiencyBonus = Math.floor((player.level - 1) / 4) + 2;
  return abilityModifier(player.stats.strength) + proficiencyBonus;
}

/** Get the spell attack modifier (INT-based). */
export function getSpellModifier(player: PlayerState): number {
  const proficiencyBonus = Math.floor((player.level - 1) / 4) + 2;
  return abilityModifier(player.stats.intelligence) + proficiencyBonus;
}

/** Get the player's armor class. */
export function getArmorClass(player: PlayerState): number {
  const baseAC = 10 + abilityModifier(player.stats.dexterity);
  const armorBonus = player.equippedArmor?.effect ?? 0;
  return baseAC + armorBonus;
}

/** Award XP and handle level-ups. Returns list of new spells learned. */
export function awardXP(
  player: PlayerState,
  amount: number
): { leveledUp: boolean; newLevel: number; newSpells: Spell[] } {
  if (!player) {
    throw new Error(`[player] awardXP: missing player`);
  }
  if (typeof amount !== "number" || amount < 0) {
    throw new Error(`[player] awardXP: invalid XP amount ${amount}`);
  }
  player.xp += amount;
  let leveledUp = false;
  const newSpells: Spell[] = [];

  while (player.xp >= xpForLevel(player.level + 1)) {
    player.level++;
    leveledUp = true;

    // Increase stats on level up
    const conMod = abilityModifier(player.stats.constitution);
    const hpGain = Math.max(1, rollHitDie() + conMod);
    player.maxHp += hpGain;
    player.hp = player.maxHp;

    const mpGain = Math.max(1, 2 + abilityModifier(player.stats.intelligence));
    player.maxMp += mpGain;
    player.mp = player.maxMp;

    // Boost a stat every even level
    if (player.level % 2 === 0) {
      player.stats.strength += 1;
      player.stats.intelligence += 1;
    }

    // Check for new spell unlocks
    for (const spell of SPELLS) {
      if (
        spell.levelRequired <= player.level &&
        !player.knownSpells.includes(spell.id)
      ) {
        player.knownSpells.push(spell.id);
        newSpells.push(spell);
      }
    }
  }

  return { leveledUp, newLevel: player.level, newSpells };
}

function rollHitDie(): number {
  return Math.floor(Math.random() * 8) + 1; // d8 hit die
}

/** Check if the player can afford an item. */
export function canAfford(player: PlayerState, cost: number): boolean {
  return player.gold >= cost;
}

/** Buy an item: deduct gold, add to inventory. Returns success. */
export function buyItem(player: PlayerState, item: Item): boolean {
  if (!canAfford(player, item.cost)) return false;
  player.gold -= item.cost;
  player.inventory.push({ ...item });
  return true;
}

/** Use a consumable item from inventory. Returns true if used. */
export function useItem(
  player: PlayerState,
  itemIndex: number
): { used: boolean; message: string } {
  if (!player) {
    throw new Error(`[player] useItem: missing player`);
  }
  if (typeof itemIndex !== "number" || itemIndex < 0) {
    throw new Error(`[player] useItem: invalid itemIndex ${itemIndex}`);
  }
  const item = player.inventory[itemIndex];
  if (!item) {
    throw new Error(`[player] useItem: no item at index ${itemIndex} (inventory size: ${player.inventory.length})`);
  }

  if (item.type === "consumable") {
    if (item.id === "potion") {
      const healed = Math.min(item.effect, player.maxHp - player.hp);
      player.hp += healed;
      player.inventory.splice(itemIndex, 1);
      return { used: true, message: `Healed ${healed} HP!` };
    }
    if (item.id === "ether") {
      const restored = Math.min(item.effect, player.maxMp - player.mp);
      player.mp += restored;
      player.inventory.splice(itemIndex, 1);
      return { used: true, message: `Restored ${restored} MP!` };
    }
  }

  if (item.type === "weapon") {
    player.equippedWeapon = item;
    return { used: true, message: `Equipped ${item.name}!` };
  }

  if (item.type === "armor") {
    player.equippedArmor = item;
    return { used: true, message: `Equipped ${item.name}!` };
  }

  return { used: false, message: "Cannot use this item." };
}
