/**
 * Turn-based combat system with D&D-like dice mechanics.
 */

import {
  rollD20,
  rollDice,
  rollWithDisadvantage,
  type DieType,
} from "../systems/dice";
import type { Monster, MonsterAbility } from "../data/monsters";
import { getSpell } from "../data/spells";
import { getAbility } from "../data/abilities";
import { getTalentAttackBonus, getTalentDamageBonus } from "../data/talents";
import {
  getAttackModifier,
  getSpellModifier,
  getArmorClass,
  hasTwoWeaponFighting,
  type PlayerState,
} from "./player";
import { abilityModifier } from "../systems/dice";
import { getPlayerClass } from "./classes";
import {
  applyElementalModifier,
  elementDisplayName,
} from "../data/elements";
import type {
  Element,
  ElementalInteraction,
} from "../data/elements";
import {
  applyStatusEffect,
  getEffectACModifier,
  getEffectAccuracyModifier,
  getEffectDamageModifier,
  hasAttackDisadvantage,
} from "./statusEffects";
import type { ActiveStatusEffect } from "./statusEffects";
import { getFleeDC } from "./groupCombat";

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
  /** Elemental interaction observed on a successful hit. */
  elementalLabel?: ElementalInteraction;
  /** Whether the attack roll used disadvantage. */
  disadvantage?: boolean;
}

export interface SpellTarget {
  monster: Monster;
  monsterEffects?: ActiveStatusEffect[];
  /** Additional AC imposed by formation or other target-specific protection. */
  acPenalty?: number;
  weatherPenalty?: number;
}

export interface HealingTarget {
  id: string;
  label: string;
  currentHp: number;
  readonly maxHp: number;
}

export interface HealingTargetResult {
  targetIndex: number;
  targetId: string;
  healing: number;
}

export interface MonsterAttackTarget {
  label: string;
  currentHp: number;
  readonly maxHp: number;
  effects: ActiveStatusEffect[];
  getArmorClass(defendBonus: number): number;
}

export interface SpellTargetResult extends CombatResult {
  targetIndex: number;
  spellMod?: number;
  totalRoll?: number;
  targetAC?: number;
  autoHit?: boolean;
}

export interface MultiTargetSpellResult {
  message: string;
  damage: number;
  hit: boolean;
  mpUsed: number;
  results: SpellTargetResult[];
  healingResults: HealingTargetResult[];
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

interface CombatD20Roll {
  roll: number;
  total: number;
  disadvantage: boolean;
}

function rollCombatD20(
  modifier: number,
  effects: ActiveStatusEffect[],
): CombatD20Roll {
  if (hasAttackDisadvantage(effects)) {
    const result = rollWithDisadvantage(modifier);
    return {
      roll: result.chosen,
      total: result.total,
      disadvantage: true,
    };
  }
  const result = rollD20(modifier);
  return {
    roll: result.roll,
    total: result.total,
    disadvantage: false,
  };
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

function buildElementalMessage(
  targetName: string,
  element: Element | undefined,
  interaction: ElementalInteraction,
): string {
  if (!interaction || !element) return "";
  const elementName = elementDisplayName(element);
  if (interaction === "immune") {
    return ` ${targetName} is immune to ${elementName}!`;
  }
  if (interaction === "weak") {
    return ` ${targetName} is weak to ${elementName}!`;
  }
  return ` ${targetName} resists ${elementName}!`;
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
  weatherPenalty: number = 0,
  monsterEffects: ActiveStatusEffect[] = [],
): CombatResult & { attackMod: number; totalRoll: number; targetAC: number } {
  if (!player || !monster) {
    throw new Error(`[combat] playerAttack: missing player or monster`);
  }
  const playerEffects = player.activeEffects;
  const attackMod = getAttackModifier(player)
    + getEffectAccuracyModifier(playerEffects);
  const statusDamage = getEffectDamageModifier(playerEffects);
  const roll = rollCombatD20(attackMod, playerEffects);
  const effectiveAC = monster.ac
    + monsterDefendBonus
    + weatherPenalty
    + getEffectACModifier(monsterEffects);
  const outcome = resolveAttackRoll(roll, effectiveAC);
  const meta = {
    attackMod,
    totalRoll: roll.total,
    targetAC: effectiveAC,
    disadvantage: roll.disadvantage,
  };

  if (outcome.fumble) {
    return {
      message: `Critical miss! ${player.name}'s attack goes wild!`,
      damage: 0, hit: false, critical: false, roll: outcome.roll, ...meta,
    };
  }

  if (outcome.hit) {
    const weaponBonus = player.equippedWeapon?.effect ?? 0;
    const talentDmg = getTalentDamageBonus(player.knownTalents);
    // Physical attacks use STR, or max(STR, DEX) for finesse weapons
    const strMod = abilityModifier(player.stats.strength);
    const dexMod = abilityModifier(player.stats.dexterity);
    const isFinesse = player.equippedWeapon?.finesse === true;
    const dmgMod = isFinesse ? Math.max(strMod, dexMod) : strMod;
    const baseDamage = rollAttackDamage(
      1,
      6,
      outcome.critical,
      weaponBonus + talentDmg + dmgMod + statusDamage,
      outcome.critical ? 0 : 1,
    );
    const weaponElement = player.equippedWeapon?.element;
    const { damage, interaction: elementalLabel } = applyElementalModifier(
      baseDamage,
      weaponElement,
      monster.elementalProfile,
    );
    const prefix = outcome.critical ? "CRITICAL HIT! " : "";
    const verb = outcome.critical ? "strikes" : "hits";
    const elementalMessage = buildElementalMessage(
      monster.name,
      weaponElement,
      elementalLabel,
    );
    return {
      message: `${prefix}${player.name} ${verb} for ${damage} damage!${elementalMessage}`,
      damage,
      hit: true,
      critical: outcome.critical,
      roll: outcome.roll,
      elementalLabel,
      ...meta,
    };
  }

  return {
    message: `${player.name} misses!`,
    damage: 0, hit: false, roll: outcome.roll, ...meta,
  };
}

/**
 * Player makes a bonus-action off-hand attack (Two-Weapon Fighting).
 * Damage does NOT add ability modifier unless the player has the
 * Two-Weapon Fighting talent or the modifier is negative.
 */
export function playerOffHandAttack(
  player: PlayerState,
  monster: Monster,
  monsterDefendBonus: number = 0,
  weatherPenalty: number = 0,
  monsterEffects: ActiveStatusEffect[] = [],
): CombatResult & { attackMod: number; totalRoll: number; targetAC: number } {
  if (!player || !monster) {
    throw new Error(`[combat] playerOffHandAttack: missing player or monster`);
  }
  if (!player.equippedOffHand) {
    throw new Error(`[combat] playerOffHandAttack: no off-hand weapon equipped`);
  }

  const playerEffects = player.activeEffects;
  const attackMod = getAttackModifier(player)
    + getEffectAccuracyModifier(playerEffects);
  const statusDamage = getEffectDamageModifier(playerEffects);
  const roll = rollCombatD20(attackMod, playerEffects);
  const effectiveAC = monster.ac
    + monsterDefendBonus
    + weatherPenalty
    + getEffectACModifier(monsterEffects);
  const outcome = resolveAttackRoll(roll, effectiveAC);
  const meta = {
    attackMod,
    totalRoll: roll.total,
    targetAC: effectiveAC,
    disadvantage: roll.disadvantage,
  };

  if (outcome.fumble) {
    return {
      message: `Critical miss! ${player.name}'s off-hand attack goes wild!`,
      damage: 0, hit: false, critical: false, roll: outcome.roll, ...meta,
    };
  }

  if (outcome.hit) {
    const offHandBonus = player.equippedOffHand.effect ?? 0;
    const talentDmg = getTalentDamageBonus(player.knownTalents);
    // D&D 5e: off-hand does NOT add ability modifier to damage
    // unless player has Two-Weapon Fighting style OR modifier is negative
    const primaryStatMod = (() => {
      const playerClass = getPlayerClass(player.appearanceId);
      return abilityModifier(player.stats[playerClass.primaryStat]);
    })();
    const addAbilityMod = hasTwoWeaponFighting(player) || primaryStatMod < 0;
    const abilityDmgBonus = addAbilityMod ? primaryStatMod : 0;
    const baseDamage = rollAttackDamage(
      1,
      6,
      outcome.critical,
      offHandBonus + talentDmg + abilityDmgBonus + statusDamage,
      outcome.critical ? 0 : 1,
    );
    const offHandElement = player.equippedOffHand.element;
    const { damage, interaction: elementalLabel } = applyElementalModifier(
      baseDamage,
      offHandElement,
      monster.elementalProfile,
    );
    const prefix = outcome.critical ? "CRITICAL HIT! " : "";
    const verb = outcome.critical ? "strikes" : "hits";
    const hand = "off-hand";
    const elementalMessage = buildElementalMessage(
      monster.name,
      offHandElement,
      elementalLabel,
    );
    return {
      message: `${prefix}${player.name}'s ${hand} ${verb} for ${damage} damage!${elementalMessage}`,
      damage,
      hit: true,
      critical: outcome.critical,
      roll: outcome.roll,
      elementalLabel,
      ...meta,
    };
  }

  return {
    message: `${player.name}'s off-hand misses!`,
    damage: 0, hit: false, roll: outcome.roll, ...meta,
  };
}

/** Resolve one spell cast against zero or more targets, consuming MP once. */
export function playerCastSpellAtTargets(
  player: PlayerState,
  spellId: string,
  targets: SpellTarget[],
  healingTargets?: HealingTarget[],
): MultiTargetSpellResult {
  if (!player) {
    throw new Error("[combat] playerCastSpellAtTargets: missing player");
  }
  if (!spellId) {
    throw new Error("[combat] playerCastSpellAtTargets: missing spellId");
  }
  const spell = getSpell(spellId);
  if (!spell) {
    return {
      message: "Unknown spell!",
      damage: 0,
      hit: false,
      mpUsed: 0,
      results: [],
      healingResults: [],
    };
  }

  if (player.mp < spell.mpCost) {
    return {
      message: "Not enough MP!",
      damage: 0,
      hit: false,
      mpUsed: 0,
      results: [],
      healingResults: [],
    };
  }

  // Utility spells cannot be used in combat
  if (spell.type === "utility") {
    return {
      message: `${spell.name} cannot be used in battle!`,
      damage: 0,
      hit: false,
      mpUsed: 0,
      results: [],
      healingResults: [],
    };
  }

  if (spell.type === "heal") {
    const resolvedHealingTargets = healingTargets ?? [{
      id: "party:hero",
      label: player.name,
      get currentHp(): number {
        return player.hp;
      },
      set currentHp(value: number) {
        player.hp = value;
      },
      get maxHp(): number {
        return player.maxHp;
      },
    }];
    if (resolvedHealingTargets.length === 0) {
      return {
        message: "No valid targets!",
        damage: 0,
        hit: false,
        mpUsed: 0,
        results: [],
        healingResults: [],
      };
    }
    const healAmount = rollDice(
      spell.damageCount,
      spell.damageDie as DieType
    );
    const healingResults = resolvedHealingTargets.map(
      (target, targetIndex): HealingTargetResult => {
        const actualHeal = Math.min(
          healAmount,
          target.maxHp - target.currentHp,
        );
        target.currentHp += actualHeal;
        return {
          targetIndex,
          targetId: target.id,
          healing: actualHeal,
        };
      },
    );
    player.mp -= spell.mpCost;
    return {
      message: `${player.name} casts ${spell.name}!`,
      damage: 0,
      hit: true,
      mpUsed: spell.mpCost,
      results: [],
      healingResults,
    };
  }

  if (targets.length === 0) {
    return {
      message: "No valid targets!",
      damage: 0,
      hit: false,
      mpUsed: 0,
      results: [],
      healingResults: [],
    };
  }

  // Damage spell - roll once, then resolve independently against each target.
  const playerEffects = player.activeEffects;
  const spellMod = getSpellModifier(player)
    + getEffectAccuracyModifier(playerEffects);
  const statusDamage = getEffectDamageModifier(playerEffects);
  const autoHit = spell.id === "magicMissile";
  const roll = autoHit
    ? { roll: 0, total: 0, disadvantage: false }
    : rollCombatD20(spellMod, playerEffects);
  player.mp -= spell.mpCost;
  const talentDmg = getTalentDamageBonus(player.knownTalents);
  const baseDamage = rollDice(
    spell.damageCount,
    spell.damageDie as DieType,
  ) + talentDmg + statusDamage;

  const results = targets.map((target, targetIndex): SpellTargetResult => {
    const effectiveAC = target.monster.ac
      + (target.weatherPenalty ?? 0)
      + (target.acPenalty ?? 0)
      + getEffectACModifier(target.monsterEffects ?? []);
    const outcome = autoHit
      ? {
          hit: true,
          critical: false,
          fumble: false,
          roll: 0,
          total: 0,
        }
      : resolveAttackRoll(roll, effectiveAC);
    const meta = {
      targetIndex,
      roll: autoHit ? undefined : roll.roll,
      spellMod,
      totalRoll: autoHit ? undefined : roll.total,
      targetAC: effectiveAC,
      autoHit,
      disadvantage: roll.disadvantage,
    };

    if (!outcome.hit) {
      return {
        message: `${spell.name} misses ${target.monster.name}!`,
        damage: 0,
        hit: false,
        ...meta,
      };
    }

    const { damage, interaction: elementalLabel } = applyElementalModifier(
      baseDamage,
      spell.element,
      target.monster.elementalProfile,
    );
    const elementalMessage = buildElementalMessage(
      target.monster.name,
      spell.element,
      elementalLabel,
    );
    return {
      message: `${target.monster.name} takes ${damage} damage!${elementalMessage}`,
      damage,
      hit: true,
      elementalLabel,
      ...meta,
    };
  });

  return {
    message: `${player.name} casts ${spell.name}!`,
    damage: results.reduce((total, result) => total + result.damage, 0),
    hit: results.some((result) => result.hit),
    mpUsed: spell.mpCost,
    results,
    healingResults: [],
  };
}

/** Backward-compatible single-target spell wrapper. */
export function playerCastSpell(
  player: PlayerState,
  spellId: string,
  monster: Monster,
  weatherPenalty: number = 0,
  monsterEffects: ActiveStatusEffect[] = [],
): CombatResult & { mpUsed: number; spellMod?: number; totalRoll?: number; targetAC?: number; autoHit?: boolean } {
  if (!player || !monster) {
    throw new Error("[combat] playerCastSpell: missing player or monster");
  }
  const result = playerCastSpellAtTargets(player, spellId, [{
    monster,
    weatherPenalty,
    monsterEffects,
  }]);
  const targetResult = result.results[0];
  if (!targetResult) {
    return {
      message: result.message,
      damage: result.damage,
      hit: result.hit,
      mpUsed: result.mpUsed,
    };
  }
  return {
    ...targetResult,
    message: `${result.message} ${targetResult.message}`,
    mpUsed: result.mpUsed,
  };
}

/** Monster attacks a party combatant. Returns roll breakdown for debug logging.
 *  weatherPenalty raises the effective AC the monster must beat.
 *  monsterAtkBoost comes from weather affinity. */
export function monsterAttackTarget(
  monster: Monster,
  target: MonsterAttackTarget,
  playerDefendBonus: number = 0,
  weatherPenalty: number = 0,
  monsterAtkBoost: number = 0,
  monsterEffects: ActiveStatusEffect[] = [],
  synergyAttackBonus: number = 0,
  synergyDamageBonus: number = 0,
): CombatResult & { attackBonus: number; totalRoll: number; targetAC: number } {
  if (!monster || !target) {
    throw new Error("[combat] monsterAttackTarget: missing monster or target");
  }
  const playerAC = target.getArmorClass(playerDefendBonus) + weatherPenalty;
  const effectiveAtkBonus = monster.attackBonus
    + monsterAtkBoost
    + synergyAttackBonus
    + getEffectAccuracyModifier(monsterEffects);
  const roll = rollCombatD20(effectiveAtkBonus, monsterEffects);
  const outcome = resolveAttackRoll(roll, playerAC);
  const meta = {
    attackBonus: effectiveAtkBonus,
    totalRoll: roll.total,
    targetAC: playerAC,
    disadvantage: roll.disadvantage,
  };

  if (outcome.fumble) {
    return {
      message: `${monster.name} stumbles and misses!`,
      damage: 0, hit: false, roll: outcome.roll, ...meta,
    };
  }

  if (outcome.hit) {
    const damage = rollAttackDamage(
      monster.damageCount,
      monster.damageDie,
      outcome.critical,
      getEffectDamageModifier(monsterEffects) + synergyDamageBonus,
    );
    target.currentHp = Math.max(0, target.currentHp - damage);
    const prefix = outcome.critical ? "CRITICAL! " : "";
    const verb = outcome.critical ? "savages" : "hits";
    return {
      message: `${prefix}${monster.name} ${verb} ${target.label} for ${damage} damage!`,
      damage, hit: true, critical: outcome.critical, roll: outcome.roll, ...meta,
    };
  }

  return {
    message: `${monster.name} misses!`,
    damage: 0, hit: false, roll: outcome.roll, ...meta,
  };
}

/** Backward-compatible PlayerState monster-attack adapter. */
export function monsterAttack(
  monster: Monster,
  player: PlayerState,
  playerDefendBonus: number = 0,
  weatherPenalty: number = 0,
  monsterAtkBoost: number = 0,
  monsterEffects: ActiveStatusEffect[] = [],
  synergyAttackBonus: number = 0,
  synergyDamageBonus: number = 0,
): CombatResult & { attackBonus: number; totalRoll: number; targetAC: number } {
  return monsterAttackTarget(
    monster,
    {
      label: player.name,
      get currentHp(): number {
        return player.hp;
      },
      set currentHp(value: number) {
        player.hp = value;
      },
      get maxHp(): number {
        return player.maxHp;
      },
      get effects(): ActiveStatusEffect[] {
        return player.activeEffects;
      },
      set effects(value: ActiveStatusEffect[]) {
        player.activeEffects = value;
      },
      getArmorClass: (defendBonus: number): number =>
        getArmorClass(player, defendBonus),
    },
    playerDefendBonus,
    weatherPenalty,
    monsterAtkBoost,
    monsterEffects,
    synergyAttackBonus,
    synergyDamageBonus,
  );
}

/** Attempt to flee from combat. Larger living groups raise the DEX-check DC. */
export function attemptFlee(dexModifier: number, aliveCount: number = 1): {
  success: boolean;
  message: string;
} {
  if (typeof dexModifier !== "number") {
    throw new Error(`[combat] attemptFlee: invalid dexModifier ${dexModifier}`);
  }
  const roll = rollD20(dexModifier);
  const dc = getFleeDC(aliveCount);
  if (roll.total >= dc) {
    return { success: true, message: `Escaped! (rolled ${roll.total})` };
  }
  return {
    success: false,
    message: `Failed to escape! (rolled ${roll.total}, needed ${dc})`,
  };
}

// ── Player Ability (martial / non-caster) ──────────────────────

/** Player uses a martial ability. */
export function playerUseAbility(
  player: PlayerState,
  abilityId: string,
  monster: Monster,
  weatherPenalty: number = 0,
  monsterEffects: ActiveStatusEffect[] = [],
  healingTargets?: HealingTarget[],
): CombatResult & {
  mpUsed: number;
  attackMod?: number;
  totalRoll?: number;
  targetAC?: number;
  healingResults?: HealingTargetResult[];
} {
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

  if (ability.type === "buff") {
    if (!ability.selfEffect) {
      return {
        message: `${ability.name} has no effect!`,
        damage: 0,
        hit: false,
        mpUsed: 0,
      };
    }
    const effectResult = applyStatusEffect(
      player.activeEffects,
      ability.selfEffect,
      player.name,
    );
    if (!effectResult.applied) {
      return {
        message: effectResult.message,
        damage: 0,
        hit: false,
        mpUsed: 0,
      };
    }
    player.mp -= ability.mpCost;
    return {
      message: `${player.name} uses ${ability.name}! ${effectResult.message}`,
      damage: 0,
      hit: true,
      mpUsed: ability.mpCost,
    };
  }

  // Heal abilities
  if (ability.type === "heal") {
    const targets = healingTargets ?? [{
      id: "party:hero",
      label: player.name,
      get currentHp(): number {
        return player.hp;
      },
      set currentHp(value: number) {
        player.hp = value;
      },
      get maxHp(): number {
        return player.maxHp;
      },
    }];
    if (targets.length === 0) {
      return {
        message: "No valid targets!",
        damage: 0,
        hit: false,
        mpUsed: 0,
        healingResults: [],
      };
    }
    const healAmount = rollDice(ability.damageCount, ability.damageDie as DieType);
    const healingResults = targets.map(
      (target, targetIndex): HealingTargetResult => {
        const actualHeal = Math.min(
          healAmount,
          target.maxHp - target.currentHp,
        );
        target.currentHp += actualHeal;
        return {
          targetIndex,
          targetId: target.id,
          healing: actualHeal,
        };
      },
    );
    player.mp -= ability.mpCost;
    return {
      message: `${player.name} uses ${ability.name}!`,
      damage: 0,
      hit: true,
      mpUsed: ability.mpCost,
      healingResults,
    };
  }

  // Damage ability — uses STR, DEX, or WIS
  const playerEffects = player.activeEffects;
  const stat = player.stats[ability.statKey];
  const profBonus = Math.floor((player.level - 1) / 4) + 2;
  const talentAtk = getTalentAttackBonus(player.knownTalents);
  const talentDmg = getTalentDamageBonus(player.knownTalents);
  const attackMod = abilityModifier(stat)
    + profBonus
    + talentAtk
    + getEffectAccuracyModifier(playerEffects);
  const roll = rollCombatD20(attackMod, playerEffects);
  const effectiveAC = monster.ac
    + weatherPenalty
    + getEffectACModifier(monsterEffects);
  const outcome = resolveAttackRoll(roll, effectiveAC);
  const meta = {
    mpUsed: ability.mpCost,
    attackMod,
    totalRoll: roll.total,
    targetAC: effectiveAC,
    disadvantage: roll.disadvantage,
  };

  player.mp -= ability.mpCost;

  if (outcome.fumble) {
    return {
      message: `${player.name} uses ${ability.name} but fumbles!`,
      damage: 0, hit: false, critical: false, roll: outcome.roll, ...meta,
    };
  }

  if (outcome.hit) {
    const baseDamage = rollAttackDamage(
      ability.damageCount,
      ability.damageDie as DieType,
      outcome.critical,
      talentDmg + getEffectDamageModifier(playerEffects),
    );
    const { damage, interaction: elementalLabel } = applyElementalModifier(
      baseDamage,
      ability.element,
      monster.elementalProfile,
    );
    const prefix = outcome.critical ? "CRITICAL! " : "";
    const elementalMessage = buildElementalMessage(
      monster.name,
      ability.element,
      elementalLabel,
    );
    let statusMessage = "";
    if (ability.targetEffect) {
      const effectResult = applyStatusEffect(
        monsterEffects,
        ability.targetEffect,
        player.name,
      );
      if (effectResult.applied) statusMessage = ` ${effectResult.message}`;
    }
    return {
      message: `${prefix}${player.name} uses ${ability.name}! ${damage} damage!${elementalMessage}${statusMessage}`,
      damage,
      hit: true,
      critical: outcome.critical,
      roll: outcome.roll,
      elementalLabel,
      ...meta,
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
  element?: Element;
}

/** Monster uses a special ability against a party combatant. */
export function monsterUseAbilityTarget(
  ability: MonsterAbility,
  monster: Monster,
  target: MonsterAttackTarget,
  monsterEffects: ActiveStatusEffect[] = [],
  synergyDamageBonus: number = 0,
): MonsterAbilityResult {
  if (ability.type === "heal") {
    const healing = rollDice(ability.damageCount, ability.damageDie);
    return {
      message: `${monster.name} uses ${ability.name}! Recovers ${healing} HP!`,
      damage: 0,
      healing,
      abilityName: ability.name,
      element: ability.element,
    };
  }

  // Damage ability (bypasses AC — like breath weapons)
  const damage = Math.max(
    0,
    rollDice(ability.damageCount, ability.damageDie)
      + getEffectDamageModifier(monsterEffects)
      + synergyDamageBonus,
  );
  target.currentHp = Math.max(0, target.currentHp - damage);

  const selfHealMsg = ability.selfHeal
    ? ` ${monster.name} absorbs the life force!`
    : "";
  const elementalSuffix = ability.element
    ? ` (${elementDisplayName(ability.element)})`
    : "";
  let statusMessage = "";
  if (ability.statusEffect && damage > 0) {
    const effectResult = applyStatusEffect(
      target.effects,
      ability.statusEffect,
      monster.name,
    );
    if (effectResult.applied) statusMessage = ` ${effectResult.message}`;
  }

  return {
    message: `${monster.name} uses ${ability.name}!${elementalSuffix} ${damage} damage!${selfHealMsg}${statusMessage}`,
    damage,
    healing: ability.selfHeal ? damage : 0,
    abilityName: ability.name,
    element: ability.element,
  };
}

/** Backward-compatible PlayerState monster-ability adapter. */
export function monsterUseAbility(
  ability: MonsterAbility,
  monster: Monster,
  player: PlayerState,
  monsterEffects: ActiveStatusEffect[] = [],
  synergyDamageBonus: number = 0,
): MonsterAbilityResult {
  return monsterUseAbilityTarget(
    ability,
    monster,
    {
      label: player.name,
      get currentHp(): number {
        return player.hp;
      },
      set currentHp(value: number) {
        player.hp = value;
      },
      get maxHp(): number {
        return player.maxHp;
      },
      get effects(): ActiveStatusEffect[] {
        return player.activeEffects;
      },
      set effects(value: ActiveStatusEffect[]) {
        player.activeEffects = value;
      },
      getArmorClass: (defendBonus: number): number =>
        getArmorClass(player, defendBonus),
    },
    monsterEffects,
    synergyDamageBonus,
  );
}
