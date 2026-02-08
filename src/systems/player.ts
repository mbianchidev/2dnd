/**
 * Player state management: stats, leveling, experience, spell unlocks.
 */

import { abilityModifier, rollAbilityScore } from "../utils/dice";
import type { Spell } from "../data/spells";
import { SPELLS } from "../data/spells";
import type { Ability } from "../data/abilities";
import { ABILITIES, getAbility } from "../data/abilities";
import { TALENTS, type Talent, getTalentAttackBonus, getTalentACBonus } from "../data/talents";
import type { Item } from "../data/items";
import { getAppearance, getClassSpells, getClassAbilities } from "./appearance";

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
  knownAbilities: string[]; // martial ability IDs (non-casters)
  knownTalents: string[]; // talent IDs (everyone)
  equippedWeapon: Item | null;
  equippedArmor: Item | null;
  equippedShield: Item | null;
  appearanceId: string; // visual customization
  x: number; // overworld tile position (local to chunk)
  y: number;
  chunkX: number; // world chunk X coordinate
  chunkY: number; // world chunk Y coordinate
  inDungeon: boolean;  // true when inside a dungeon interior
  dungeonId: string;   // ID of the current dungeon (empty if not in dungeon)
  openedChests: string[]; // IDs of chests already opened
  exploredTiles: Record<string, boolean>; // fog of war — keys like "cx,cy,x,y" or "d:id,x,y"
}

/** D&D 5e ASI levels — the player gains 2 stat points at each of these. */
export const ASI_LEVELS = [4, 8, 12, 16, 19];

/** XP required to reach a given level. */
export function xpForLevel(level: number): number {
  return level * level * 100;
}

/** Create a fresh level-1 player with 4d6-drop-lowest rolled stats + class boosts. */
export function createPlayer(name: string, appearanceId: string = "knight"): PlayerState {
  const appearance = getAppearance(appearanceId);

  // Roll base stats — subtract 1 from each to compensate for class bonuses
  const roll = () => Math.max(3, rollAbilityScore() - 1);

  const stats: PlayerStats = {
    strength: roll(),
    dexterity: roll(),
    constitution: roll(),
    intelligence: roll(),
    wisdom: roll(),
    charisma: roll(),
  };

  // Apply class stat boosts
  for (const [key, bonus] of Object.entries(appearance.statBoosts)) {
    stats[key as keyof PlayerStats] += bonus as number;
  }

  const conMod = abilityModifier(stats.constitution);
  const intMod = abilityModifier(stats.intelligence);
  const startHp = Math.max(10, 25 + conMod * 3);
  const startMp = Math.max(4, 8 + intMod * 2);

  // Starting spell — first spell in the class list
  const startingSpell = appearance.spells[0] ?? "fireBolt";

  // Starting abilities — all class abilities available at level 1
  const classAbilities = appearance.abilities ?? [];
  const startingAbilities = classAbilities.filter((id) => {
    const ab = getAbility(id);
    return ab && ab.levelRequired <= 1;
  });

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
    knownSpells: [startingSpell],
    knownAbilities: startingAbilities,
    knownTalents: [],
    equippedWeapon: null,
    equippedArmor: null,
    equippedShield: null,
    appearanceId,
    x: 3,
    y: 3,
    chunkX: 1,
    chunkY: 1,
    inDungeon: false,
    dungeonId: "",
    openedChests: [],
    exploredTiles: {},
  };
}

/** Get the attack modifier for the player (STR-based melee). */
export function getAttackModifier(player: PlayerState): number {
  const proficiencyBonus = Math.floor((player.level - 1) / 4) + 2;
  return abilityModifier(player.stats.strength) + proficiencyBonus + getTalentAttackBonus(player.knownTalents ?? []);
}

/** Get the spell attack modifier (INT-based). */
export function getSpellModifier(player: PlayerState): number {
  const proficiencyBonus = Math.floor((player.level - 1) / 4) + 2;
  return abilityModifier(player.stats.intelligence) + proficiencyBonus + getTalentAttackBonus(player.knownTalents ?? []);
}

/** Get the player's armor class. Optionally add a temporary bonus (e.g. from defending). */
export function getArmorClass(player: PlayerState, tempBonus: number = 0): number {
  const baseAC = 10 + abilityModifier(player.stats.dexterity);
  const armorBonus = player.equippedArmor?.effect ?? 0;
  const shieldBonus = player.equippedShield?.effect ?? 0;
  return baseAC + armorBonus + shieldBonus + getTalentACBonus(player.knownTalents ?? []) + tempBonus;
}

/** Award XP and handle level-ups. Returns list of new spells/abilities/talents learned. */
export function awardXP(
  player: PlayerState,
  amount: number
): { leveledUp: boolean; newLevel: number; newSpells: Spell[]; newAbilities: Ability[]; newTalents: Talent[]; asiGained: number } {
  if (!player) {
    throw new Error(`[player] awardXP: missing player`);
  }
  if (typeof amount !== "number" || amount < 0) {
    throw new Error(`[player] awardXP: invalid XP amount ${amount}`);
  }
  player.xp += amount;
  let leveledUp = false;
  const newSpells: Spell[] = [];
  const newAbilities: Ability[] = [];
  const newTalents: Talent[] = [];
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

    // Check for new spell unlocks (class-filtered)
    const classSpells = getClassSpells(player.appearanceId);
    for (const spell of SPELLS) {
      if (
        spell.levelRequired <= player.level &&
        !player.knownSpells.includes(spell.id) &&
        classSpells.includes(spell.id)
      ) {
        player.knownSpells.push(spell.id);
        newSpells.push(spell);
      }
    }

    // Check for new ability unlocks (class-filtered)
    const classAbilityIds = getClassAbilities(player.appearanceId);
    for (const ability of ABILITIES) {
      if (
        ability.levelRequired <= player.level &&
        !(player.knownAbilities ?? []).includes(ability.id) &&
        classAbilityIds.includes(ability.id)
      ) {
        if (!player.knownAbilities) player.knownAbilities = [];
        player.knownAbilities.push(ability.id);
        newAbilities.push(ability);
      }
    }

    // Check for new talent unlocks (everyone)
    for (const talent of TALENTS) {
      if (
        talent.levelRequired <= player.level &&
        !(player.knownTalents ?? []).includes(talent.id)
      ) {
        if (!player.knownTalents) player.knownTalents = [];
        player.knownTalents.push(talent.id);
        newTalents.push(talent);
        // Apply one-time stat bonuses
        if (talent.maxHpBonus) {
          player.maxHp += talent.maxHpBonus;
          player.hp += talent.maxHpBonus;
        }
        if (talent.maxMpBonus) {
          player.maxMp += talent.maxMpBonus;
          player.mp += talent.maxMpBonus;
        }
      }
    }
  }

  return { leveledUp, newLevel: player.level, newSpells, newAbilities, newTalents, asiGained };
}

function rollHitDie(): number {
  return Math.floor(Math.random() * 8) + 1; // d8 hit die
}

/** Check if the player can afford an item. */
export function canAfford(player: PlayerState, cost: number): boolean {
  return player.gold >= cost;
}

/** Check if the player already owns a specific equipment item (weapon/armor/shield). */
export function ownsEquipment(player: PlayerState, itemId: string): boolean {
  const equipped =
    (player.equippedWeapon?.id === itemId) ||
    (player.equippedArmor?.id === itemId) ||
    (player.equippedShield?.id === itemId);
  const inInventory = player.inventory.some(
    (i) => i.id === itemId && (i.type === "weapon" || i.type === "armor" || i.type === "shield")
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
    // If equipping a two-handed weapon, unequip shield
    if (item.twoHanded && player.equippedShield) {
      player.equippedShield = null;
    }
    player.equippedWeapon = item;
    return { used: true, message: `Equipped ${item.name}!${item.twoHanded ? " (two-handed — shield removed)" : ""}` };
  }

  if (item.type === "armor") {
    player.equippedArmor = item;
    return { used: true, message: `Equipped ${item.name}!` };
  }

  if (item.type === "shield") {
    // Cannot equip shield with a two-handed weapon
    if (player.equippedWeapon?.twoHanded) {
      return { used: false, message: `Cannot equip shield with a two-handed weapon!` };
    }
    player.equippedShield = item;
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
