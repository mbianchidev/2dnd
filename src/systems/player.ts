/**
 * Player state management: stats, leveling, experience, spell unlocks.
 */

import { abilityModifier, rollDice } from "../systems/dice";
import type { DieType } from "../systems/dice";
import type { Spell } from "../data/spells";
import { SPELLS, getSpell } from "../data/spells";
import type { Ability } from "../data/abilities";
import { ABILITIES, getAbility } from "../data/abilities";
import { TALENTS, type Talent, getTalentAttackBonus, getTalentACBonus } from "../data/talents";
import type { Item } from "../data/items";
import { getItem } from "../data/items";
import { getMount } from "../data/mounts";
import { getPlayerClass, getClassSpells, getClassAbilities } from "./classes";

export interface PlayerStats {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

/** Player position and location tracking (overworld, dungeon, city). */
export interface PlayerPosition {
  x: number; // overworld tile position (local to chunk)
  y: number;
  chunkX: number; // world chunk X coordinate
  chunkY: number; // world chunk Y coordinate
  inDungeon: boolean;  // true when inside a dungeon interior
  dungeonId: string;   // ID of the current dungeon (empty if not in dungeon)
  inCity: boolean;     // true when inside a city interior
  cityId: string;      // ID of the current city (empty if not in city)
}

/** Player progression tracking (chests, treasures, fog of war). */
export interface PlayerProgression {
  openedChests: string[]; // IDs of chests already opened
  collectedTreasures: string[]; // keys like "cx,cy,x,y" for collected minor treasures
  exploredTiles: Record<string, boolean>; // fog of war — keys like "cx,cy,x,y" or "d:id,x,y"
}

// ── Point Buy System (D&D 5e) ─────────────────────────────────

/** Cost for each ability score value in the Point Buy system. */
export const POINT_BUY_COSTS: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9,
};

/** Total points available in Point Buy. */
export const POINT_BUY_TOTAL = 27;

/** Calculate total points spent for a given stat distribution. */
export function calculatePointsSpent(stats: PlayerStats): number {
  return Object.values(stats).reduce((sum, val) => sum + (POINT_BUY_COSTS[val] ?? 0), 0);
}

/** Check if a stat distribution is a valid Point Buy allocation. */
export function isValidPointBuy(stats: PlayerStats): boolean {
  const values = Object.values(stats);
  return (
    values.every(v => v >= 8 && v <= 15) &&
    calculatePointsSpent(stats) === POINT_BUY_TOTAL
  );
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
  equippedOffHand: Item | null; // off-hand weapon for Two-Weapon Fighting (must be light, one-handed)
  equippedArmor: Item | null;
  equippedShield: Item | null;
  appearanceId: string; // visual customization
  customAppearance?: { skinColor: number; hairStyle: number; hairColor: number };
  position: PlayerPosition; // player location tracking
  progression: PlayerProgression; // progression tracking (chests, treasures, fog of war)
  lastTownX: number;      // last town tile x (respawn point on death)
  lastTownY: number;      // last town tile y
  lastTownChunkX: number; // last town chunk x
  lastTownChunkY: number; // last town chunk y
  bankBalance: number;    // gold stored in the bank (accessible across all banks)
  lastBankDay: number;    // last day interest was applied (timeStep / CYCLE_LENGTH)
  mountId: string;        // ID of the currently active mount (empty = on foot)
  shortRestsRemaining: number; // short rests available (max 2, reset on inn long rest)
  pendingLevelUps: number; // levels earned but not yet applied (applied on rest)
}

/** D&D 5e ASI levels — the player gains 2 stat points at each of these. */
export const ASI_LEVELS = [4, 8, 12, 16, 19];

/** XP required to reach a given level. */
export function xpForLevel(level: number): number {
  return level * level * 100;
}

/** Create a fresh level-1 player with provided base stats + class boosts. */
export function createPlayer(
  name: string,
  baseStats: PlayerStats,
  appearanceId: string = "knight",
  customAppearance?: { skinColor: number; hairStyle: number; hairColor: number }
): PlayerState {
  const playerClass = getPlayerClass(appearanceId);

  // Copy base stats
  const stats: PlayerStats = { ...baseStats };

  // Apply class stat boosts
  for (const [key, bonus] of Object.entries(playerClass.statBoosts)) {
    stats[key as keyof PlayerStats] += bonus as number;
  }

  const conMod = abilityModifier(stats.constitution);
  const intMod = abilityModifier(stats.intelligence);
  const startHp = Math.max(10, 25 + conMod * 3);
  const startMp = Math.max(4, 8 + intMod * 2);

  // Starting spells — all class spells available at level 1
  const classSpellIds = playerClass.spells;
  const startingSpells = classSpellIds.filter((id) => {
    const sp = getSpell(id);
    return sp && sp.levelRequired <= 1;
  });
  // Fallback to first spell if no level-1 spells found
  if (startingSpells.length === 0 && playerClass.spells.length > 0) {
    startingSpells.push(playerClass.spells[0]);
  }

  // Starting abilities — all class abilities available at level 1
  const classAbilities = playerClass.abilities ?? [];
  const startingAbilities = classAbilities.filter((id) => {
    const ab = getAbility(id);
    return ab && ab.levelRequired <= 1;
  });

  // Starting weapon from class definition
  const startWeapon = getItem(playerClass.startingWeaponId) ?? null;

  // D&D 5e starting gold: roll Nd4 × 10 (N = class-specific dice count)
  const startingGold = rollDice(playerClass.startingGoldDice, 4) * 10;

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
    gold: startingGold,
    inventory: startWeapon ? [startWeapon] : [],
    knownSpells: startingSpells,
    knownAbilities: startingAbilities,
    knownTalents: [],
    equippedWeapon: startWeapon,
    equippedOffHand: null,
    equippedArmor: null,
    equippedShield: null,
    appearanceId,
    customAppearance,
    position: {
      x: 3,
      y: 3,
      chunkX: 4,
      chunkY: 2,
      inDungeon: false,
      dungeonId: "",
      inCity: false,
      cityId: "",
    },
    progression: {
      openedChests: [],
      collectedTreasures: [],
      exploredTiles: {},
    },
    lastTownX: 2,       // Willowdale default
    lastTownY: 2,
    lastTownChunkX: 4,
    lastTownChunkY: 2,
    bankBalance: 0,
    lastBankDay: 0,
    mountId: "",
    shortRestsRemaining: 2,
    pendingLevelUps: 0,
  };
}

/**
 * Apply 2% daily compound interest to the player's bank balance.
 * Should be called when the player visits a bank.
 * @returns the interest earned (0 if none).
 */
export function applyBankInterest(player: PlayerState, currentDay: number): number {
  if (player.bankBalance <= 0 || currentDay <= player.lastBankDay) return 0;
  const days = currentDay - player.lastBankDay;
  const rate = 0.02; // 2% per day
  const oldBalance = player.bankBalance;
  player.bankBalance = Math.floor(oldBalance * Math.pow(1 + rate, days));
  player.lastBankDay = currentDay;
  return player.bankBalance - oldBalance;
}

/** Get the attack modifier for the player (uses class primary stat for melee). */
export function getAttackModifier(player: PlayerState): number {
  const playerClass = getPlayerClass(player.appearanceId);
  const primaryStatValue = player.stats[playerClass.primaryStat];
  const proficiencyBonus = Math.floor((player.level - 1) / 4) + 2;
  return abilityModifier(primaryStatValue) + proficiencyBonus + getTalentAttackBonus(player.knownTalents);
}

/** Get the spell attack modifier (uses class primary stat for casters). */
export function getSpellModifier(player: PlayerState): number {
  const playerClass = getPlayerClass(player.appearanceId);
  const primaryStatValue = player.stats[playerClass.primaryStat];
  const proficiencyBonus = Math.floor((player.level - 1) / 4) + 2;
  return abilityModifier(primaryStatValue) + proficiencyBonus + getTalentAttackBonus(player.knownTalents);
}

/** Get the player's armor class. Optionally add a temporary bonus (e.g. from defending). */
export function getArmorClass(player: PlayerState, tempBonus: number = 0): number {
  const baseAC = 10 + abilityModifier(player.stats.dexterity);
  const armorBonus = player.equippedArmor?.effect ?? 0;
  const shieldBonus = player.equippedShield?.effect ?? 0;
  return baseAC + armorBonus + shieldBonus + getTalentACBonus(player.knownTalents) + tempBonus;
}

/** Check if a weapon can be used for Two-Weapon Fighting (must be light and one-handed). */
export function isLightWeapon(item: Item | null): boolean {
  if (!item || item.type !== "weapon") return false;
  return item.light === true && !item.twoHanded;
}

/** Check if the player can dual wield: main hand must be light and one-handed, no shield equipped. */
export function canDualWield(player: PlayerState): boolean {
  return isLightWeapon(player.equippedWeapon) && !player.equippedShield;
}

/** Check if the player has the Two-Weapon Fighting talent (adds ability mod to off-hand damage). */
export function hasTwoWeaponFighting(player: PlayerState): boolean {
  return player.knownTalents.includes("twoWeaponFighting");
}

/** Equip a weapon in the off-hand slot for Two-Weapon Fighting. Returns a result message. */
export function equipOffHand(
  player: PlayerState,
  item: Item
): { success: boolean; message: string } {
  if (item.type !== "weapon") {
    return { success: false, message: "Only weapons can be equipped in the off-hand!" };
  }
  if (!item.light || item.twoHanded) {
    return { success: false, message: `${item.name} is not a light weapon! Only light one-handed weapons can be dual wielded.` };
  }
  if (!isLightWeapon(player.equippedWeapon)) {
    return { success: false, message: "Main hand weapon must be light for dual wielding!" };
  }
  if (player.equippedWeapon?.id === item.id) {
    return { success: false, message: "Cannot dual wield two of the same weapon!" };
  }
  // Equipping off-hand unequips shield
  if (player.equippedShield) {
    player.equippedShield = null;
  }
  player.equippedOffHand = item;
  return { success: true, message: `Equipped ${item.name} in off-hand! (shield removed)` };
}

/** Award XP and track pending level-ups. Actual leveling happens during rest. */
export function awardXP(
  player: PlayerState,
  amount: number
): { pendingLevels: number } {
  if (!player) {
    throw new Error(`[player] awardXP: missing player`);
  }
  if (typeof amount !== "number" || amount < 0) {
    throw new Error(`[player] awardXP: invalid XP amount ${amount}`);
  }
  player.xp += amount;

  // Count how many levels the player has earned but not yet applied
  let pendingLevels = player.pendingLevelUps ?? 0;
  let virtualLevel = player.level + pendingLevels;
  while (virtualLevel < 20 && player.xp >= xpForLevel(virtualLevel + 1)) {
    virtualLevel++;
    pendingLevels++;
  }
  player.pendingLevelUps = pendingLevels;

  return { pendingLevels };
}

/**
 * Process all pending level-ups accumulated since last rest.
 * Called during short rest and inn (long) rest.
 * Returns details for the UI to display.
 */
export function processPendingLevelUps(
  player: PlayerState
): { leveledUp: boolean; newLevel: number; newSpells: Spell[]; newAbilities: Ability[]; newTalents: Talent[]; asiGained: number } {
  const pending = player.pendingLevelUps ?? 0;
  if (pending <= 0) {
    return { leveledUp: false, newLevel: player.level, newSpells: [], newAbilities: [], newTalents: [], asiGained: 0 };
  }

  let leveledUp = false;
  const newSpells: Spell[] = [];
  const newAbilities: Ability[] = [];
  const newTalents: Talent[] = [];
  let asiGained = 0;

  for (let i = 0; i < pending; i++) {
    if (player.level >= 20) break;
    player.level++;
    leveledUp = true;

    // Increase HP/MP on level up
    const conMod = abilityModifier(player.stats.constitution);
    const hpGain = Math.max(1, rollHitDie(player.appearanceId) + conMod);
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

    // Check for new talent unlocks (class-restricted or everyone)
    for (const talent of TALENTS) {
      if (
        talent.levelRequired <= player.level &&
        !player.knownTalents.includes(talent.id) &&
        (!talent.classRestriction || talent.classRestriction.includes(player.appearanceId))
      ) {
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

  player.pendingLevelUps = 0;
  return { leveledUp, newLevel: player.level, newSpells, newAbilities, newTalents, asiGained };
}

function rollHitDie(appearanceId: string = "knight"): number {
  const playerClass = getPlayerClass(appearanceId);
  return Math.floor(Math.random() * playerClass.hitDie) + 1;
}

/** Check if the player can afford an item. */
export function canAfford(player: PlayerState, cost: number): boolean {
  return player.gold >= cost;
}

/** Check if the player already owns a specific equipment item (weapon/armor/shield) or mount. */
export function ownsEquipment(player: PlayerState, itemId: string): boolean {
  const equipped =
    (player.equippedWeapon?.id === itemId) ||
    (player.equippedOffHand?.id === itemId) ||
    (player.equippedArmor?.id === itemId) ||
    (player.equippedShield?.id === itemId);
  const inInventory = player.inventory.some(
    (i) => i.id === itemId && (i.type === "weapon" || i.type === "armor" || i.type === "shield" || i.type === "mount")
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
): { used: boolean; message: string; teleport?: boolean } {
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
    if (item.id === "ether") {
      if (player.mp >= player.maxMp) {
        return { used: false, message: "MP is already full!" };
      }
      const restored = Math.min(item.effect, player.maxMp - player.mp);
      player.mp += restored;
      player.inventory.splice(itemIndex, 1);
      return { used: true, message: `Restored ${restored} MP!` };
    }
    if (item.id === "chimaeraWing") {
      if (player.position.inDungeon) {
        return { used: false, message: "Cannot use Chimaera Wing inside a dungeon!" };
      }
      // Chimaera Wing teleportation is handled by the scene;
      // here we just consume the item and signal success.
      player.inventory.splice(itemIndex, 1);
      return { used: true, message: "The Chimaera Wing glows and whisks you away!", teleport: true };
    }
    // All other consumables restore HP (potion, greaterPotion, etc.)
    if (player.hp >= player.maxHp) {
      return { used: false, message: "HP is already full!" };
    }
    const healed = Math.min(item.effect, player.maxHp - player.hp);
    player.hp += healed;
    player.inventory.splice(itemIndex, 1);
    return { used: true, message: `Healed ${healed} HP!` };
  }

  if (item.type === "weapon") {
    // If equipping a two-handed weapon, unequip shield and off-hand
    if (item.twoHanded && player.equippedShield) {
      player.equippedShield = null;
    }
    if (item.twoHanded && player.equippedOffHand) {
      player.equippedOffHand = null;
    }
    player.equippedWeapon = item;
    return { used: true, message: `Equipped ${item.name}!${item.twoHanded ? " (two-handed \u2014 shield & off-hand removed)" : ""}` };
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
    // Equipping a shield unequips the off-hand weapon
    if (player.equippedOffHand) {
      player.equippedOffHand = null;
    }
    player.equippedShield = item;
    return { used: true, message: `Equipped ${item.name}!${player.equippedOffHand === null ? "" : ""}` };
  }

  if (item.type === "mount") {
    const mount = item.mountId ? getMount(item.mountId) : undefined;
    if (!mount) return { used: false, message: "Unknown mount." };
    player.mountId = mount.id;
    return { used: true, message: `You mount the ${mount.name}!` };
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

/**
 * Perform a short rest in the overworld. Restores up to 50% of max HP and 50% of max MP,
 * capped at the player's current maximum. Decrements shortRestsRemaining.
 * Returns the actual amounts restored.
 */
export function shortRest(player: PlayerState): { hpRestored: number; mpRestored: number } {
  const hpRestore = Math.floor(player.maxHp * 0.5);
  const mpRestore = Math.floor(player.maxMp * 0.5);
  const actualHp = Math.min(hpRestore, player.maxHp - player.hp);
  const actualMp = Math.min(mpRestore, player.maxMp - player.mp);
  player.hp += actualHp;
  player.mp += actualMp;
  player.shortRestsRemaining--;
  return { hpRestored: actualHp, mpRestored: actualMp };
}

/** Cast a heal or utility spell outside of combat. Returns result. */
export function castSpellOutsideCombat(
  player: PlayerState,
  spellId: string
): { success: boolean; message: string; teleport?: boolean } {
  const spell = getSpell(spellId);
  if (!spell) return { success: false, message: "Unknown spell!" };

  if (spell.type === "damage") {
    return { success: false, message: "Cannot use damage spells outside battle!" };
  }

  if (player.mp < spell.mpCost) {
    return { success: false, message: "Not enough MP!" };
  }

  // Teleport spell — signal to scene to show town picker
  if (spellId === "teleport") {
    if (player.position.inDungeon) {
      return { success: false, message: "Cannot teleport from inside a dungeon!" };
    }
    return { success: true, message: "Choose a destination...", teleport: true };
  }

  if (spell.type === "heal") {
    if (player.hp >= player.maxHp) {
      return { success: false, message: "HP is already full!" };
    }
    const healAmount = rollDice(spell.damageCount, spell.damageDie as DieType);
    const actualHeal = Math.min(healAmount, player.maxHp - player.hp);
    player.hp += actualHeal;
    player.mp -= spell.mpCost;
    return { success: true, message: `${spell.name} healed ${actualHeal} HP! (${spell.mpCost} MP)` };
  }

  if (spell.type === "utility") {
    player.mp -= spell.mpCost;
    return { success: true, message: `${spell.name} cast! (${spell.mpCost} MP)` };
  }

  return { success: false, message: "Cannot use this spell here." };
}

/** Use a heal or utility ability outside of combat. Returns result. */
export function useAbilityOutsideCombat(
  player: PlayerState,
  abilityId: string
): { success: boolean; message: string; teleport?: boolean; evac?: boolean } {
  const ability = getAbility(abilityId);
  if (!ability) return { success: false, message: "Unknown ability!" };

  if (ability.type === "damage") {
    return { success: false, message: "Cannot use damage abilities outside battle!" };
  }

  if (player.mp < ability.mpCost) {
    return { success: false, message: "Not enough MP!" };
  }

  // Fast Travel ability — signal to scene to show town picker
  if (abilityId === "fastTravel") {
    if (player.position.inDungeon) {
      return { success: false, message: "Cannot fast travel from inside a dungeon!" };
    }
    return { success: true, message: "Choose a destination...", teleport: true };
  }

  // Evac ability — signal to scene to teleport to dungeon entrance
  if (abilityId === "evac") {
    if (!player.position.inDungeon) {
      return { success: false, message: "Evac can only be used inside a dungeon!" };
    }
    player.mp -= ability.mpCost;
    return { success: true, message: "You teleport to the dungeon entrance!", evac: true };
  }

  // Short Rest ability — usable in the overworld wilds
  if (abilityId === "shortRest") {
    if (player.position.inDungeon || player.position.inCity) {
      return { success: false, message: "Short Rest can only be used in the wilds!" };
    }
    if (player.shortRestsRemaining <= 0) {
      return { success: false, message: "No short rests remaining! Rest at an inn to refill." };
    }
    if (player.hp >= player.maxHp && player.mp >= player.maxMp && (player.pendingLevelUps ?? 0) <= 0) {
      return { success: false, message: "HP and MP are already full!" };
    }
    const { hpRestored, mpRestored } = shortRest(player);
    const levelResult = processPendingLevelUps(player);
    let msg = `Short Rest! Recovered ${hpRestored} HP and ${mpRestored} MP. (${player.shortRestsRemaining} rests left)`;
    if (levelResult.leveledUp) {
      msg += ` 🎉 LEVEL UP to ${levelResult.newLevel}!`;
      for (const sp of levelResult.newSpells) { msg += ` ✦ ${sp.name}!`; }
      for (const ab of levelResult.newAbilities) { msg += ` ⚡ ${ab.name}!`; }
      if (levelResult.asiGained > 0) { msg += ` ★ +${levelResult.asiGained} stat points!`; }
    }
    return { success: true, message: msg };
  }

  if (ability.type === "heal") {
    if (player.hp >= player.maxHp) {
      return { success: false, message: "HP is already full!" };
    }
    const healAmount = rollDice(ability.damageCount, ability.damageDie as DieType);
    const actualHeal = Math.min(healAmount, player.maxHp - player.hp);
    player.hp += actualHeal;
    player.mp -= ability.mpCost;
    return { success: true, message: `${ability.name} healed ${actualHeal} HP! (${ability.mpCost} MP)` };
  }

  if (ability.type === "utility") {
    player.mp -= ability.mpCost;
    return { success: true, message: `${ability.name} used! (${ability.mpCost} MP)` };
  }

  return { success: false, message: "Cannot use this ability here." };
}
