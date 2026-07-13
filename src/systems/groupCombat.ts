/**
 * Pure state and rules for multi-monster battles.
 */

import type { Element } from "../data/elements";
import type {
  GroupSynergy,
  MonsterEncounter,
} from "../data/monsterGroups";
import type { FormationPosition } from "../data/monsterGroups";
import type { Item } from "../data/items";
import type { Monster } from "../data/monsters";
import type { TargetType } from "../data/spells";
import {
  discoverElement,
  recordDefeat,
  type CodexData,
} from "./codex";
import { rollD20 } from "./dice";
import type { PlayerStats } from "./player";
import type { ActiveStatusEffect } from "./statusEffects";

export type AttackRange = "melee" | "ranged";

export interface GroupCombatant {
  id: string;
  label: string;
  monster: Monster;
  currentHp: number;
  position: FormationPosition;
  isAlive: boolean;
  isDefending: boolean;
  effects: ActiveStatusEffect[];
  acHighestMiss: number;
  acLowestHit: number;
  acDiscovered: boolean;
  hpRevealed: boolean;
  droppedItemIds: string[];
  elementalDiscoveries: Set<Element>;
}

export type GroupTurn =
  | { type: "player"; initiative: number }
  | { type: "monster"; index: number; initiative: number };

export interface GroupInitiativeResult {
  order: GroupTurn[];
  playerRoll: number;
  monsterRolls: number[];
}

export interface GroupCombatState {
  combatants: GroupCombatant[];
  activeSynergy: GroupSynergy | null;
  turnOrder: GroupTurn[];
  currentTurnIndex: number;
  playerTurn: boolean;
  isOver: boolean;
  playerWon: boolean;
  fled: boolean;
}

/** Build isolated runtime combatants and disambiguate duplicate names. */
export function createGroupCombatants(
  encounter: MonsterEncounter,
): GroupCombatant[] {
  const nameCounts = new Map<string, number>();
  for (const member of encounter.members) {
    nameCounts.set(
      member.monster.name,
      (nameCounts.get(member.monster.name) ?? 0) + 1,
    );
  }
  const nameOccurrences = new Map<string, number>();

  return encounter.members.map((member, index) => {
    const occurrence = (nameOccurrences.get(member.monster.name) ?? 0) + 1;
    nameOccurrences.set(member.monster.name, occurrence);
    const duplicate = (nameCounts.get(member.monster.name) ?? 0) > 1;
    const suffix = duplicate
      ? ` ${String.fromCharCode("A".charCodeAt(0) + occurrence - 1)}`
      : "";

    return {
      id: `${member.monster.id}:${index}`,
      label: `${member.monster.name}${suffix}`,
      monster: member.monster,
      currentHp: member.monster.hp,
      position: member.position,
      isAlive: true,
      isDefending: false,
      effects: [],
      acHighestMiss: 0,
      acLowestHit: Infinity,
      acDiscovered: false,
      hpRevealed: false,
      droppedItemIds: [],
      elementalDiscoveries: new Set<Element>(),
    };
  });
}

/** Roll and order initiative for the player and every monster. */
export function rollGroupInitiative(
  playerDexMod: number,
  combatants: GroupCombatant[],
  getMonsterBonus: (monster: Monster, index: number) => number = () => 0,
  roller: (modifier: number) => number = (modifier) => rollD20(modifier).total,
): GroupInitiativeResult {
  const playerRoll = roller(playerDexMod);
  const monsterRolls = combatants.map((combatant, index) =>
    roller(combatant.monster.attackBonus + getMonsterBonus(combatant.monster, index))
  );
  const order: GroupTurn[] = [
    { type: "player", initiative: playerRoll },
    ...monsterRolls.map(
      (initiative, index): GroupTurn => ({
        type: "monster",
        index,
        initiative,
      }),
    ),
  ];

  order.sort((a, b) => {
    if (a.initiative !== b.initiative) return b.initiative - a.initiative;
    if (a.type !== b.type) return a.type === "player" ? -1 : 1;
    if (a.type === "monster" && b.type === "monster") return a.index - b.index;
    return 0;
  });

  return { order, playerRoll, monsterRolls };
}

export function getAliveCombatantIndices(
  combatants: GroupCombatant[],
): number[] {
  return combatants.flatMap((combatant, index) =>
    combatant.isAlive && combatant.currentHp > 0 ? [index] : []
  );
}

export function countAliveCombatants(combatants: GroupCombatant[]): number {
  return getAliveCombatantIndices(combatants).length;
}

export function getAttackRangeForWeapon(
  weapon: Item | null | undefined,
): AttackRange {
  return weapon?.weaponSprite === "bow" ? "ranged" : "melee";
}

/** Melee must clear the front row before selecting protected back-row units. */
export function getSelectableTargetIndices(
  combatants: GroupCombatant[],
  range: AttackRange,
): number[] {
  const alive = getAliveCombatantIndices(combatants);
  if (range === "ranged") return alive;
  const front = alive.filter((index) => combatants[index]?.position === "front");
  return front.length > 0
    ? front
    : alive.filter((index) => combatants[index]?.position === "back");
}

/** Once exposed, a back-row target still imposes a -2 melee attack penalty. */
export function getFormationAttackPenalty(
  combatants: GroupCombatant[],
  targetIndex: number,
  range: AttackRange,
): number {
  const target = combatants[targetIndex];
  if (!target?.isAlive || range === "ranged") return 0;
  return target.position === "back" ? 2 : 0;
}

/** Resolve target metadata to living combatant indices. */
export function getTargetIndices(
  combatants: GroupCombatant[],
  targetType: TargetType,
  random: () => number = Math.random,
): number[] {
  const alive = getAliveCombatantIndices(combatants);
  if (targetType === "self") return [];
  if (targetType === "single") return alive.slice(0, 1);
  if (targetType === "all_enemies") return alive;
  if (targetType === "front_row") {
    const front = alive.filter((index) => combatants[index]?.position === "front");
    return front.length > 0
      ? front
      : alive.filter((index) => combatants[index]?.position === "back");
  }
  if (targetType === "back_row") {
    return alive.filter((index) => combatants[index]?.position === "back");
  }

  const available = alive.slice();
  const selected: number[] = [];
  while (available.length > 0 && selected.length < 2) {
    const pick = Math.floor(
      Math.max(0, Math.min(0.999999, random())) * available.length,
    );
    selected.push(available.splice(pick, 1)[0]!);
  }
  return selected;
}

export function isSynergyActive(
  synergy: GroupSynergy | undefined,
  combatants: GroupCombatant[],
): boolean {
  if (!synergy) return false;
  const defeated = combatants.length - countAliveCombatants(combatants);
  return defeated < synergy.breakThreshold;
}

export function getSynergyAttackBonus(
  synergy: GroupSynergy | undefined,
  combatants: GroupCombatant[],
  _combatantIndex: number,
  warCryActive = false,
): number {
  const base = isSynergyActive(synergy, combatants)
    ? (synergy?.attackBonus ?? 0)
    : 0;
  return base + (warCryActive ? 2 : 0);
}

export function getSynergyACBonus(
  synergy: GroupSynergy | undefined,
  combatants: GroupCombatant[],
  combatantIndex: number,
): number {
  if (!isSynergyActive(synergy, combatants) || !synergy) return 0;
  const combatant = combatants[combatantIndex];
  if (synergy.type === "shield_wall") {
    const guarded = combatants.some(
      (member) => member.isAlive && member.position === "back",
    );
    return combatant?.position === "front" && guarded
      ? (synergy.acBonus ?? 0)
      : 0;
  }
  return synergy.acBonus ?? 0;
}

export function getSynergyDamageBonus(
  synergy: GroupSynergy | undefined,
  combatants: GroupCombatant[],
  _combatantIndex: number,
): number {
  return isSynergyActive(synergy, combatants)
    ? (synergy?.damageBonus ?? 0)
    : 0;
}

export function getMonsterDefendChance(
  synergy: GroupSynergy | undefined,
  combatants: GroupCombatant[],
  combatantIndex: number,
): number {
  if (
    synergy?.type === "shield_wall"
    && isSynergyActive(synergy, combatants)
    && combatants[combatantIndex]?.position === "front"
    && combatants.some((member) => member.isAlive && member.position === "back")
  ) {
    return 0.3;
  }
  return 0.08;
}

export function getFleeDC(aliveCount: number): number {
  return 10 + Math.max(0, aliveCount - 1) * 2;
}

export function calculateEncounterRewards(
  encounter: MonsterEncounter,
): { xp: number; gold: number } {
  const totals = encounter.members.reduce(
    (reward, member) => ({
      xp: reward.xp + member.monster.xpReward,
      gold: reward.gold + member.monster.goldReward,
    }),
    { xp: 0, gold: 0 },
  );
  if (!encounter.isGroup) return totals;
  return {
    xp: Math.floor(totals.xp * 0.85),
    gold: Math.floor(totals.gold * 0.85),
  };
}

/** Record every defeated combatant independently, including duplicate species. */
export function recordGroupDefeats(
  codex: CodexData,
  combatants: GroupCombatant[],
): void {
  for (const combatant of combatants) {
    recordDefeat(
      codex,
      combatant.monster,
      combatant.acDiscovered,
      combatant.droppedItemIds,
    );
    for (const element of combatant.elementalDiscoveries) {
      discoverElement(codex, combatant.monster.id, element);
    }
  }
}

/** Select the living ally with the lowest remaining HP percentage. */
export function findLowestHpAllyIndex(
  combatants: GroupCombatant[],
): number | undefined {
  let selected: number | undefined;
  let lowestRatio = Infinity;
  for (const [index, combatant] of combatants.entries()) {
    if (!combatant.isAlive || combatant.currentHp <= 0) continue;
    const ratio = combatant.currentHp / combatant.monster.hp;
    if (ratio < lowestRatio) {
      selected = index;
      lowestRatio = ratio;
    }
  }
  return selected;
}

/** Derive bounded saving-throw stats from a monster's attack bonus. */
export function deriveMonsterStats(attackBonus: number): PlayerStats {
  const physical = Math.min(20, 10 + attackBonus);
  const mental = Math.min(18, 10 + Math.floor(attackBonus / 2));
  return {
    strength: physical,
    dexterity: physical,
    constitution: physical,
    intelligence: mental,
    wisdom: mental,
    charisma: mental,
  };
}
