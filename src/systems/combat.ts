/**
 * Turn-based combat system with D&D-like dice mechanics.
 */

import { rollD20, rollDice, type DieType } from "../utils/dice";
import type { Monster } from "../data/monsters";
import type { Spell } from "../data/spells";
import { getSpell } from "../data/spells";
import {
  getAttackModifier,
  getSpellModifier,
  getArmorClass,
  type PlayerState,
} from "./player";

export interface CombatAction {
  type: "attack" | "spell" | "item" | "flee";
  spellId?: string;
  itemIndex?: number;
}

export interface CombatResult {
  message: string;
  damage: number;
  hit: boolean;
  critical?: boolean;
  roll?: number;
}

export interface CombatState {
  playerTurn: boolean;
  monster: Monster;
  monsterCurrentHp: number;
  turnLog: string[];
  isOver: boolean;
  playerWon: boolean;
  fled: boolean;
}

/** Roll initiative to determine who goes first. */
export function rollInitiative(
  playerDexMod: number,
  monsterBonus: number
): { playerFirst: boolean; playerRoll: number; monsterRoll: number } {
  if (typeof playerDexMod !== "number" || typeof monsterBonus !== "number") {
    throw new Error(`[combat] rollInitiative: invalid modifiers playerDex=${playerDexMod} monster=${monsterBonus}`);
  }
  const playerInit = rollD20(playerDexMod);
  const monsterInit = rollD20(monsterBonus);
  return {
    playerFirst: playerInit.total >= monsterInit.total,
    playerRoll: playerInit.total,
    monsterRoll: monsterInit.total,
  };
}

/** Player attacks the monster with a melee weapon. */
export function playerAttack(
  player: PlayerState,
  monster: Monster
): CombatResult {
  if (!player || !monster) {
    throw new Error(`[combat] playerAttack: missing player or monster`);
  }
  const attackMod = getAttackModifier(player);
  const roll = rollD20(attackMod);

  if (roll.roll === 20) {
    // Critical hit - double dice
    const weaponBonus = player.equippedWeapon?.effect ?? 0;
    const damage = rollDice(2, 6) + weaponBonus; // 2d6 crit + weapon
    return {
      message: `CRITICAL HIT! ${player.name} strikes for ${damage} damage!`,
      damage,
      hit: true,
      critical: true,
      roll: roll.roll,
    };
  }

  if (roll.roll === 1) {
    return {
      message: `Critical miss! ${player.name}'s attack goes wild!`,
      damage: 0,
      hit: false,
      critical: false,
      roll: roll.roll,
    };
  }

  if (roll.total >= monster.ac) {
    const weaponBonus = player.equippedWeapon?.effect ?? 0;
    const damage = Math.max(1, rollDice(1, 6) + weaponBonus);
    return {
      message: `${player.name} hits for ${damage} damage! (rolled ${roll.roll}+${attackMod}=${roll.total} vs AC ${monster.ac})`,
      damage,
      hit: true,
      roll: roll.roll,
    };
  }

  return {
    message: `${player.name} misses! (rolled ${roll.roll}+${attackMod}=${roll.total} vs AC ${monster.ac})`,
    damage: 0,
    hit: false,
    roll: roll.roll,
  };
}

/** Player casts a spell. */
export function playerCastSpell(
  player: PlayerState,
  spellId: string,
  monster: Monster
): CombatResult & { mpUsed: number } {
  if (!player || !monster) {
    throw new Error(`[combat] playerCastSpell: missing player or monster`);
  }
  if (!spellId) {
    throw new Error(`[combat] playerCastSpell: missing spellId`);
  }
  const spell = getSpell(spellId);
  if (!spell) {
    return {
      message: "Unknown spell!",
      damage: 0,
      hit: false,
      mpUsed: 0,
    };
  }

  if (player.mp < spell.mpCost) {
    return {
      message: "Not enough MP!",
      damage: 0,
      hit: false,
      mpUsed: 0,
    };
  }

  if (spell.type === "heal") {
    const healAmount = rollDice(
      spell.damageCount,
      spell.damageDie as DieType
    );
    const actualHeal = Math.min(healAmount, player.maxHp - player.hp);
    player.hp += actualHeal;
    player.mp -= spell.mpCost;
    return {
      message: `${player.name} casts ${spell.name}! Healed ${actualHeal} HP!`,
      damage: 0,
      hit: true,
      mpUsed: spell.mpCost,
    };
  }

  // Damage spell - use spell attack roll
  const spellMod = getSpellModifier(player);
  const roll = rollD20(spellMod);

  if (roll.total >= monster.ac || spell.id === "magicMissile") {
    // Magic Missile always hits
    const damage = rollDice(spell.damageCount, spell.damageDie as DieType);
    player.mp -= spell.mpCost;
    return {
      message: `${player.name} casts ${spell.name}! ${damage} damage!`,
      damage,
      hit: true,
      mpUsed: spell.mpCost,
      roll: roll.roll,
    };
  }

  player.mp -= spell.mpCost;
  return {
    message: `${player.name} casts ${spell.name} but it misses! (${roll.total} vs AC ${monster.ac})`,
    damage: 0,
    hit: false,
    mpUsed: spell.mpCost,
    roll: roll.roll,
  };
}

/** Monster attacks the player. Returns roll breakdown for debug logging. */
export function monsterAttack(
  monster: Monster,
  player: PlayerState
): CombatResult & { attackBonus: number; totalRoll: number; targetAC: number } {
  if (!monster || !player) {
    throw new Error(`[combat] monsterAttack: missing monster or player`);
  }
  const playerAC = getArmorClass(player);
  const roll = rollD20(monster.attackBonus);

  if (roll.roll === 20) {
    const damage = rollDice(monster.damageCount * 2, monster.damageDie);
    player.hp = Math.max(0, player.hp - damage);
    return {
      message: `CRITICAL! ${monster.name} savages you for ${damage} damage!`,
      damage,
      hit: true,
      critical: true,
      roll: roll.roll,
      attackBonus: monster.attackBonus,
      totalRoll: roll.total,
      targetAC: playerAC,
    };
  }

  if (roll.roll === 1) {
    return {
      message: `${monster.name} stumbles and misses!`,
      damage: 0,
      hit: false,
      roll: roll.roll,
      attackBonus: monster.attackBonus,
      totalRoll: roll.total,
      targetAC: playerAC,
    };
  }

  if (roll.total >= playerAC) {
    const damage = rollDice(monster.damageCount, monster.damageDie);
    player.hp = Math.max(0, player.hp - damage);
    return {
      message: `${monster.name} hits you for ${damage} damage!`,
      damage,
      hit: true,
      roll: roll.roll,
      attackBonus: monster.attackBonus,
      totalRoll: roll.total,
      targetAC: playerAC,
    };
  }

  return {
    message: `${monster.name} misses! (${roll.total} vs AC ${playerAC})`,
    damage: 0,
    hit: false,
    roll: roll.roll,
    attackBonus: monster.attackBonus,
    totalRoll: roll.total,
    targetAC: playerAC,
  };
}

/** Attempt to flee from combat. DC 10 DEX check. */
export function attemptFlee(dexModifier: number): {
  success: boolean;
  message: string;
} {
  if (typeof dexModifier !== "number") {
    throw new Error(`[combat] attemptFlee: invalid dexModifier ${dexModifier}`);
  }
  const roll = rollD20(dexModifier);
  if (roll.total >= 10) {
    return { success: true, message: `Escaped! (rolled ${roll.total})` };
  }
  return {
    success: false,
    message: `Failed to escape! (rolled ${roll.total}, needed 10)`,
  };
}
