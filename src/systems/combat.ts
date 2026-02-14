/**
 * Turn-based combat system with D&D-like dice mechanics.
 */

import { rollD20, rollDice, type DieType } from "../utils/dice";
import type { Monster, MonsterAbility } from "../data/monsters";
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

// ── Shared Attack Resolution ──────────────────────────────────

/** Outcome of a d20 attack roll against an AC target. */
interface AttackOutcome {
  hit: boolean;
  critical: boolean;
  fumble: boolean;
  roll: number;
  total: number;
}

/** Resolve a d20 attack roll into a hit/miss/crit/fumble outcome. */
function resolveAttackRoll(
  d20Roll: { roll: number; total: number },
  targetAC: number,
  autoHit: boolean = false
): AttackOutcome {
  if (d20Roll.roll === 20) {
    return { hit: true, critical: true, fumble: false, roll: d20Roll.roll, total: d20Roll.total };
  }
  if (d20Roll.roll === 1) {
    return { hit: false, critical: false, fumble: true, roll: d20Roll.roll, total: d20Roll.total };
  }
  const hit = d20Roll.total >= targetAC || autoHit;
  return { hit, critical: false, fumble: false, roll: d20Roll.roll, total: d20Roll.total };
}

/** Roll damage dice, doubling on critical hits. */
function rollAttackDamage(
  count: number,
  die: DieType,
  isCritical: boolean,
  bonusDamage: number = 0,
  minDamage: number = 0
): number {
  const dice = isCritical ? count * 2 : count;
  return Math.max(minDamage, rollDice(dice, die) + bonusDamage);
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
  const effectiveAC = monster.ac + monsterDefendBonus + weatherPenalty;
  const outcome = resolveAttackRoll(roll, effectiveAC);
  const meta = { attackMod, totalRoll: roll.total, targetAC: effectiveAC };

  if (outcome.fumble) {
    return {
      message: `Critical miss! ${player.name}'s attack goes wild!`,
      damage: 0, hit: false, critical: false, roll: outcome.roll, ...meta,
    };
  }

  if (outcome.hit) {
    const weaponBonus = player.equippedWeapon?.effect ?? 0;
    const talentDmg = getTalentDamageBonus(player.knownTalents ?? []);
    const damage = rollAttackDamage(1, 6, outcome.critical, weaponBonus + talentDmg, outcome.critical ? 0 : 1);
    const prefix = outcome.critical ? "CRITICAL HIT! " : "";
    const verb = outcome.critical ? "strikes" : "hits";
    return {
      message: `${prefix}${player.name} ${verb} for ${damage} damage!`,
      damage, hit: true, critical: outcome.critical, roll: outcome.roll, ...meta,
    };
  }

  return {
    message: `${player.name} misses!`,
    damage: 0, hit: false, roll: outcome.roll, ...meta,
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

  // Utility spells cannot be used in combat
  if (spell.type === "utility") {
    return {
      message: `${spell.name} cannot be used in battle!`,
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
  const effectiveAC = monster.ac + weatherPenalty;
  const outcome = resolveAttackRoll(roll, effectiveAC, autoHit);

  player.mp -= spell.mpCost;

  if (outcome.hit) {
    const talentDmg = getTalentDamageBonus(player.knownTalents ?? []);
    const damage = rollDice(spell.damageCount, spell.damageDie as DieType) + talentDmg;
    return {
      message: `${player.name} casts ${spell.name}! ${damage} damage!`,
      damage, hit: true, mpUsed: spell.mpCost, roll: roll.roll,
      spellMod, totalRoll: roll.total, targetAC: effectiveAC, autoHit,
    };
  }

  return {
    message: `${player.name} casts ${spell.name} but it misses!`,
    damage: 0, hit: false, mpUsed: spell.mpCost, roll: roll.roll,
    spellMod, totalRoll: roll.total, targetAC: effectiveAC, autoHit: false,
  };
}

/** Monster attacks the player. Returns roll breakdown for debug logging.
 *  weatherPenalty raises the effective AC the monster must beat.
 *  monsterAtkBoost comes from weather affinity. */
export function monsterAttack(
  monster: Monster,
  player: PlayerState,
  playerDefendBonus: number = 0,
  weatherPenalty: number = 0,
  monsterAtkBoost: number = 0,
): CombatResult & { attackBonus: number; totalRoll: number; targetAC: number } {
  if (!monster || !player) {
    throw new Error(`[combat] monsterAttack: missing monster or player`);
  }
  const playerAC = getArmorClass(player, playerDefendBonus) + weatherPenalty;
  const effectiveAtkBonus = monster.attackBonus + monsterAtkBoost;
  const roll = rollD20(effectiveAtkBonus);
  const outcome = resolveAttackRoll(roll, playerAC);
  const meta = { attackBonus: effectiveAtkBonus, totalRoll: roll.total, targetAC: playerAC };

  if (outcome.fumble) {
    return {
      message: `${monster.name} stumbles and misses!`,
      damage: 0, hit: false, roll: outcome.roll, ...meta,
    };
  }

  if (outcome.hit) {
    const damage = rollAttackDamage(monster.damageCount, monster.damageDie, outcome.critical);
    player.hp = Math.max(0, player.hp - damage);
    const prefix = outcome.critical ? "CRITICAL! " : "";
    const verb = outcome.critical ? "savages you" : "hits you";
    return {
      message: `${prefix}${monster.name} ${verb} for ${damage} damage!`,
      damage, hit: true, critical: outcome.critical, roll: outcome.roll, ...meta,
    };
  }

  return {
    message: `${monster.name} misses!`,
    damage: 0, hit: false, roll: outcome.roll, ...meta,
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

  // Utility abilities cannot be used in combat
  if (ability.type === "utility") {
    return { message: `${ability.name} cannot be used in battle!`, damage: 0, hit: false, mpUsed: 0 };
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

  // Damage ability — uses STR, DEX, or WIS
  const stat = player.stats[ability.statKey];
  const profBonus = Math.floor((player.level - 1) / 4) + 2;
  const talentAtk = getTalentAttackBonus(player.knownTalents ?? []);
  const talentDmg = getTalentDamageBonus(player.knownTalents ?? []);
  const attackMod = abilityModifier(stat) + profBonus + talentAtk;
  const roll = rollD20(attackMod);
  const effectiveAC = monster.ac + weatherPenalty;
  const outcome = resolveAttackRoll(roll, effectiveAC);
  const meta = { mpUsed: ability.mpCost, attackMod, totalRoll: roll.total, targetAC: effectiveAC };

  player.mp -= ability.mpCost;

  if (outcome.fumble) {
    return {
      message: `${player.name} uses ${ability.name} but fumbles!`,
      damage: 0, hit: false, critical: false, roll: 1, ...meta,
    };
  }

  if (outcome.hit) {
    const damage = rollAttackDamage(ability.damageCount, ability.damageDie as DieType, outcome.critical, talentDmg);
    const prefix = outcome.critical ? "CRITICAL! " : "";
    return {
      message: `${prefix}${player.name} uses ${ability.name}! ${damage} damage!`,
      damage, hit: true, critical: outcome.critical, roll: outcome.roll, ...meta,
    };
  }

  return {
    message: `${player.name} uses ${ability.name} but misses!`,
    damage: 0, hit: false, roll: outcome.roll, ...meta,
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
