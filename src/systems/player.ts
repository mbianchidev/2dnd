/**
 * Player state management: stats, leveling, experience, spell unlocks.
 */

import { abilityModifier, rollAbilityScore } from "../utils/dice";
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
  pendingStatPoints: number; // ASI points waiting to be allocated
  gold: number;
  inventory: Item[];
  knownSpells: string[]; // spell IDs
  equippedWeapon: Item | null;
  equippedArmor: Item | null;
  appearanceId: string; // visual customization
  x: number; // overworld tile position
  y: number;
}

/** D&D 5e ASI levels — the player gains 2 stat points at each of these. */
export const ASI_LEVELS = [4, 8, 12, 16, 19];

/** XP required to reach a given level. */
export function xpForLevel(level: number): number {
  return level * level * 100;
}

/** Create a fresh level-1 player with 4d6-drop-lowest rolled stats. */
export function createPlayer(name: string): PlayerState {
  const stats: PlayerStats = {
    strength: rollAbilityScore(),
    dexterity: rollAbilityScore(),
    constitution: rollAbilityScore(),
    intelligence: rollAbilityScore(),
    wisdom: rollAbilityScore(),
    charisma: rollAbilityScore(),
  };

  const conMod = abilityModifier(stats.constitution);
  const intMod = abilityModifier(stats.intelligence);
  const startHp = Math.max(10, 25 + conMod * 3);
  const startMp = Math.max(4, 8 + intMod * 2);

  return {
    name,
    level: 1,
    xp: 0,
    hp: startHp,
    maxHp: startHp,
    mp: startMp,
    maxMp: startMp,
    stats,
    pendingStatPoints: 0,
    gold: 50,
    inventory: [],
    knownSpells: ["fireBolt"], // start with a cantrip
    equippedWeapon: null,
    equippedArmor: null,
    appearanceId: "knight",
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
): { leveledUp: boolean; newLevel: number; newSpells: Spell[]; asiGained: number } {
  if (!player) {
    throw new Error(`[player] awardXP: missing player`);
  }
  if (typeof amount !== "number" || amount < 0) {
    throw new Error(`[player] awardXP: invalid XP amount ${amount}`);
  }
  player.xp += amount;
  let leveledUp = false;
  const newSpells: Spell[] = [];
  let asiGained = 0;

  while (player.level < 20 && player.xp >= xpForLevel(player.level + 1)) {
    player.level++;
    leveledUp = true;

    // Increase HP/MP on level up
    const conMod = abilityModifier(player.stats.constitution);
    const hpGain = Math.max(1, rollHitDie() + conMod);
    player.maxHp += hpGain;
    player.hp = player.maxHp;

    const mpGain = Math.max(1, 2 + abilityModifier(player.stats.intelligence));
    player.maxMp += mpGain;
    player.mp = player.maxMp;

    // Grant ASI points at D&D 5e levels (4, 8, 12, 16, 19)
    if (ASI_LEVELS.includes(player.level)) {
      player.pendingStatPoints += 2;
      asiGained += 2;
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

  return { leveledUp, newLevel: player.level, newSpells, asiGained };
}

function rollHitDie(): number {
  return Math.floor(Math.random() * 8) + 1; // d8 hit die
}

/** Check if the player can afford an item. */
export function canAfford(player: PlayerState, cost: number): boolean {
  return player.gold >= cost;
}

/** Check if the player already owns a specific equipment item (weapon/armor). */
export function ownsEquipment(player: PlayerState, itemId: string): boolean {
  const equipped =
    (player.equippedWeapon?.id === itemId) ||
    (player.equippedArmor?.id === itemId);
  const inInventory = player.inventory.some(
    (i) => i.id === itemId && (i.type === "weapon" || i.type === "armor")
  );
  return equipped || inInventory;
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

/** Allocate one pending stat point to the given ability. Returns true if allocated. */
export function allocateStatPoint(
  player: PlayerState,
  stat: keyof PlayerStats
): boolean {
  if (player.pendingStatPoints <= 0) return false;
  player.stats[stat] += 1;
  player.pendingStatPoints -= 1;

  // Recalculate HP/MP if CON or INT changed
  if (stat === "constitution") {
    const bonus = player.level; // retroactive: +1 HP per level per CON bump
    player.maxHp += bonus;
    player.hp = Math.min(player.hp + bonus, player.maxHp);
  }
  if (stat === "intelligence") {
    const bonus = Math.max(1, player.level); // +1 MP per level
    player.maxMp += bonus;
    player.mp = Math.min(player.mp + bonus, player.maxMp);
  }

  return true;
}
