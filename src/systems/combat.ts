/**
 * Turn-based combat system with D&D-like dice mechanics.
 */

import { rollD20, rollDice, type DieType } from "../utils/dice";
import type { Monster, MonsterAbility } from "../data/monsters";
import type { Spell } from "../data/spells";
import { getSpell } from "../data/spells";
import { getAbility } from "../data/abilities";
import { getTalentAttackBonus, getTalentDamageBonus } from "../data/talents";
import {
  getAttackModifier,
  getSpellModifier,
  getArmorClass,
  type PlayerState,
} from "./player";
import { abilityModifier } from "../utils/dice";

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
  monster: Monster,
  monsterDefendBonus: number = 0,
  weatherPenalty: number = 0
): CombatResult & { attackMod: number; totalRoll: number; targetAC: number } {
  if (!player || !monster) {
    throw new Error(`[combat] playerAttack: missing player or monster`);
  }
  const attackMod = getAttackModifier(player);
  const roll = rollD20(attackMod);
  const effectiveAC = monster.ac + monsterDefendBonus;
  const extra = { attackMod, totalRoll: roll.total, targetAC: effectiveAC };

  if (roll.roll === 20) {
    // Critical hit - double dice
    const weaponBonus = player.equippedWeapon?.effect ?? 0;
    const talentDmg = getTalentDamageBonus(player.knownTalents ?? []);
    const damage = rollDice(2, 6) + weaponBonus + talentDmg; // 2d6 crit + weapon + talent
    return {
      message: `CRITICAL HIT! ${player.name} strikes for ${damage} damage!`,
      damage,
      hit: true,
      critical: true,
      roll: roll.roll,
      ...extra,
    };
  }

  if (roll.roll === 1) {
    return {
      message: `Critical miss! ${player.name}'s attack goes wild!`,
      damage: 0,
      hit: false,
      critical: false,
      roll: roll.roll,
      ...extra,
    };
  }

  if (roll.total - weatherPenalty >= effectiveAC) {
    const weaponBonus = player.equippedWeapon?.effect ?? 0;
    const talentDmg = getTalentDamageBonus(player.knownTalents ?? []);
    const damage = Math.max(1, rollDice(1, 6) + weaponBonus + talentDmg);
    return {
      message: `${player.name} hits for ${damage} damage!`,
      damage,
      hit: true,
      roll: roll.roll,
      ...extra,
    };
  }

  return {
    message: `${player.name} misses!`,
    damage: 0,
    hit: false,
    roll: roll.roll,
    ...extra,
  };
}

/** Player casts a spell. */
export function playerCastSpell(
  player: PlayerState,
  spellId: string,
  monster: Monster,
  weatherPenalty: number = 0
): CombatResult & { mpUsed: number; spellMod?: number; totalRoll?: number; targetAC?: number; autoHit?: boolean } {
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
  const autoHit = spell.id === "magicMissile";

  if (roll.total - weatherPenalty >= monster.ac || autoHit) {
    // Magic Missile always hits
    const talentDmg = getTalentDamageBonus(player.knownTalents ?? []);
    const damage = rollDice(spell.damageCount, spell.damageDie as DieType) + talentDmg;
    player.mp -= spell.mpCost;
    return {
      message: `${player.name} casts ${spell.name}! ${damage} damage!`,
      damage,
      hit: true,
      mpUsed: spell.mpCost,
      roll: roll.roll,
      spellMod,
      totalRoll: roll.total,
      targetAC: monster.ac,
      autoHit,
    };
  }

  player.mp -= spell.mpCost;
  return {
    message: `${player.name} casts ${spell.name} but it misses!`,
    damage: 0,
    hit: false,
    mpUsed: spell.mpCost,
    roll: roll.roll,
    spellMod,
    totalRoll: roll.total,
    targetAC: monster.ac,
    autoHit: false,
  };
}

/** Monster attacks the player. Returns roll breakdown for debug logging. */
export function monsterAttack(
  monster: Monster,
  player: PlayerState,
  playerDefendBonus: number = 0,
  weatherPenalty: number = 0
): CombatResult & { attackBonus: number; totalRoll: number; targetAC: number } {
  if (!monster || !player) {
    throw new Error(`[combat] monsterAttack: missing monster or player`);
  }
  const playerAC = getArmorClass(player, playerDefendBonus);
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

  if (roll.total - weatherPenalty >= playerAC) {
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
    message: `${monster.name} misses!`,
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

// ── Player Ability (martial / non-caster) ──────────────────────

/** Player uses a martial ability. */
export function playerUseAbility(
  player: PlayerState,
  abilityId: string,
  monster: Monster,
  weatherPenalty: number = 0
): CombatResult & { mpUsed: number; attackMod?: number; totalRoll?: number; targetAC?: number } {
  if (!player || !monster) {
    throw new Error(`[combat] playerUseAbility: missing player or monster`);
  }
  const ability = getAbility(abilityId);
  if (!ability) {
    return { message: "Unknown ability!", damage: 0, hit: false, mpUsed: 0 };
  }

  if (player.mp < ability.mpCost) {
    return { message: "Not enough MP!", damage: 0, hit: false, mpUsed: 0 };
  }

  // Heal abilities
  if (ability.type === "heal") {
    const healAmount = rollDice(ability.damageCount, ability.damageDie as DieType);
    const actualHeal = Math.min(healAmount, player.maxHp - player.hp);
    player.hp += actualHeal;
    player.mp -= ability.mpCost;
    return {
      message: `${player.name} uses ${ability.name}! Healed ${actualHeal} HP!`,
      damage: 0, hit: true, mpUsed: ability.mpCost,
    };
  }

  // Damage ability — uses STR or DEX
  const stat = ability.statKey === "strength"
    ? player.stats.strength
    : player.stats.dexterity;
  const profBonus = Math.floor((player.level - 1) / 4) + 2;
  const talentAtk = getTalentAttackBonus(player.knownTalents ?? []);
  const talentDmg = getTalentDamageBonus(player.knownTalents ?? []);
  const attackMod = abilityModifier(stat) + profBonus + talentAtk;
  const roll = rollD20(attackMod);

  if (roll.roll === 1) {
    player.mp -= ability.mpCost;
    return {
      message: `${player.name} uses ${ability.name} but fumbles!`,
      damage: 0, hit: false, critical: false, roll: 1,
      mpUsed: ability.mpCost, attackMod, totalRoll: roll.total, targetAC: monster.ac,
    };
  }

  if (roll.roll === 20 || roll.total - weatherPenalty >= monster.ac) {
    const isCrit = roll.roll === 20;
    const dice = isCrit ? ability.damageCount * 2 : ability.damageCount;
    const damage = rollDice(dice, ability.damageDie as DieType) + talentDmg;
    player.mp -= ability.mpCost;
    return {
      message: `${isCrit ? "CRITICAL! " : ""}${player.name} uses ${ability.name}! ${damage} damage!`,
      damage, hit: true, critical: isCrit, roll: roll.roll,
      mpUsed: ability.mpCost, attackMod, totalRoll: roll.total, targetAC: monster.ac,
    };
  }

  player.mp -= ability.mpCost;
  return {
    message: `${player.name} uses ${ability.name} but misses!`,
    damage: 0, hit: false, roll: roll.roll,
    mpUsed: ability.mpCost, attackMod, totalRoll: roll.total, targetAC: monster.ac,
  };
}

// ── Monster Ability ────────────────────────────────────────────

export interface MonsterAbilityResult {
  message: string;
  damage: number;
  healing: number;
  abilityName: string;
}

/** Monster uses a special ability instead of its basic attack. */
export function monsterUseAbility(
  ability: MonsterAbility,
  monster: Monster,
  player: PlayerState
): MonsterAbilityResult {
  if (ability.type === "heal") {
    const healing = rollDice(ability.damageCount, ability.damageDie);
    return {
      message: `${monster.name} uses ${ability.name}! Recovers ${healing} HP!`,
      damage: 0, healing, abilityName: ability.name,
    };
  }

  // Damage ability (bypasses AC — like breath weapons)
  const damage = rollDice(ability.damageCount, ability.damageDie);
  player.hp = Math.max(0, player.hp - damage);

  const selfHealMsg = ability.selfHeal
    ? ` ${monster.name} absorbs the life force!`
    : "";

  return {
    message: `${monster.name} uses ${ability.name}! ${damage} damage!${selfHealMsg}`,
    damage,
    healing: ability.selfHeal ? damage : 0,
    abilityName: ability.name,
  };
}
