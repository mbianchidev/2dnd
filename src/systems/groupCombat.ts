/**
 * Pure state and rules for multi-monster battles.
 */

import type { Element, ElementalInteraction } from "../data/elements";
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
import {
  getArmorClass,
  type PlayerState,
  type PlayerStats,
} from "./player";
import type { ActiveStatusEffect } from "./statusEffects";

export type AttackRange = "melee" | "ranged";

export type BattleCombatantId = string;
export type CombatSide = "party" | "enemy";
export type BattleActorKind = "hero" | "companion" | "monster";
export type BattleOutcome = "victory" | "defeat" | "fled";

export const HERO_COMBATANT_ID: BattleCombatantId = "party:hero";

export interface BattleCombatantState {
  readonly id: BattleCombatantId;
  readonly side: CombatSide;
  readonly actorKind: BattleActorKind;
  label: string;
  currentHp: number;
  readonly maxHp: number;
  position: FormationPosition;
  isAlive: boolean;
  isKnockedOut: boolean;
  isDefending: boolean;
  effects: ActiveStatusEffect[];
}

export interface PartyCombatantSource {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  stats: PlayerStats;
  activeEffects: ActiveStatusEffect[];
  getArmorClass(defendBonus: number): number;
}

export interface PartyCombatant extends BattleCombatantState {
  readonly side: "party";
  readonly actorKind: "hero" | "companion";
  readonly sourceId: string;
  readonly stats: PlayerStats;
  getArmorClass(defendBonus: number): number;
}

export interface GroupCombatant extends BattleCombatantState {
  readonly side: "enemy";
  readonly actorKind: "monster";
  monster: Monster;
  acHighestMiss: number;
  acLowestHit: number;
  acDiscovered: boolean;
  hpRevealed: boolean;
  droppedItemIds: string[];
  elementalDiscoveries: Set<Element>;
}

export interface BattleTurn {
  combatantId: BattleCombatantId;
  initiative: number;
}

export interface BattleInitiativeResult {
  order: BattleTurn[];
  rolls: Record<BattleCombatantId, number>;
}

export interface GroupInitiativeResult extends BattleInitiativeResult {
  playerRoll: number;
  monsterRolls: number[];
}

export interface GroupCombatState {
  combatants: BattleCombatantState[];
  activeSynergy: GroupSynergy | null;
  turnOrder: BattleTurn[];
  currentTurnIndex: number;
  playerTurn: boolean;
  isOver: boolean;
  playerWon: boolean;
  fled: boolean;
}

export interface BattleReward {
  xp: number;
  gold: number;
}

export interface BattleResult {
  outcome: BattleOutcome;
  defeatedEnemyIds: BattleCombatantId[];
  survivingPartyIds: BattleCombatantId[];
  knockedOutPartyIds: BattleCombatantId[];
  rewards: BattleReward;
  droppedItemIds: string[];
}

export interface CompanionTurnContext {
  combatant: PartyCombatant;
  actors: BattleCombatantState[];
  enemies: GroupCombatant[];
  weatherPenalty: number;
  getEnemyDefenseBonus(targetId: BattleCombatantId): number;
  recordElementalInteraction(
    targetId: BattleCombatantId,
    interaction: ElementalInteraction,
    element: Element,
  ): void;
  applyEnemyDamage(targetId: BattleCombatantId, damage: number): void;
  addLog(message: string): void;
  completeTurn(): void;
}

export interface BattleResolutionHooks {
  adjustRewards?(
    baseRewards: BattleReward,
    encounter: MonsterEncounter,
  ): BattleReward;
  onCombatantDefeated?(combatant: GroupCombatant): void;
  onCompanionTurn?(context: CompanionTurnContext): void;
  onBattleResolved?(result: BattleResult): void;
}

/** Create an accessor-backed party combatant without duplicating source state. */
export function createPartyCombatant(
  source: PartyCombatantSource,
  actorKind: "hero" | "companion",
  position: FormationPosition = "front",
): PartyCombatant {
  let defending = false;
  let knockedOut = source.hp <= 0;
  const id = actorKind === "hero"
    ? HERO_COMBATANT_ID
    : `party:companion:${source.id}`;

  return {
    id,
    side: "party",
    actorKind,
    sourceId: source.id,
    label: source.name,
    position,
    get currentHp(): number {
      return source.hp;
    },
    set currentHp(value: number) {
      source.hp = Math.max(0, Math.min(source.maxHp, value));
      if (source.hp > 0) knockedOut = false;
    },
    get maxHp(): number {
      return source.maxHp;
    },
    get isAlive(): boolean {
      return source.hp > 0 && !knockedOut;
    },
    set isAlive(value: boolean) {
      if (value) {
        knockedOut = false;
        if (source.hp <= 0) source.hp = 1;
      } else {
        knockedOut = true;
        source.hp = 0;
      }
    },
    get isKnockedOut(): boolean {
      return knockedOut || source.hp <= 0;
    },
    set isKnockedOut(value: boolean) {
      knockedOut = value;
      if (value) source.hp = 0;
    },
    get isDefending(): boolean {
      return defending;
    },
    set isDefending(value: boolean) {
      defending = value;
    },
    get effects(): ActiveStatusEffect[] {
      return source.activeEffects;
    },
    set effects(value: ActiveStatusEffect[]) {
      source.activeEffects = value;
    },
    get stats(): PlayerStats {
      return source.stats;
    },
    getArmorClass: (defendBonus: number): number =>
      source.getArmorClass(defendBonus),
  };
}

export function createHeroCombatant(player: PlayerState): PartyCombatant {
  return createPartyCombatant(
    {
      id: "hero",
      name: player.name,
      get hp(): number {
        return player.hp;
      },
      set hp(value: number) {
        player.hp = value;
      },
      get maxHp(): number {
        return player.maxHp;
      },
      stats: player.stats,
      get activeEffects(): ActiveStatusEffect[] {
        return player.activeEffects;
      },
      set activeEffects(value: ActiveStatusEffect[]) {
        player.activeEffects = value;
      },
      getArmorClass: (defendBonus: number): number =>
        getArmorClass(player, defendBonus),
    },
    "hero",
  );
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
      id: `${encounter.id}:enemy:${member.monster.id}:${occurrence}`,
      side: "enemy",
      actorKind: "monster",
      label: `${member.monster.name}${suffix}`,
      monster: member.monster,
      currentHp: member.monster.hp,
      maxHp: member.monster.hp,
      position: member.position,
      isAlive: true,
      isKnockedOut: false,
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

/** Roll and order initiative for arbitrary party and enemy combatants. */
export function rollBattleInitiative(
  combatants: BattleCombatantState[],
  getModifier: (combatant: BattleCombatantState) => number,
  roller: (modifier: number) => number = (modifier) => rollD20(modifier).total,
): BattleInitiativeResult {
  const activeCombatants = combatants.filter(isCombatantActive);
  const originalOrder = new Map(
    activeCombatants.map((combatant, index) => [combatant.id, index]),
  );
  const rolls: Record<BattleCombatantId, number> = {};
  const order = activeCombatants.map((combatant): BattleTurn => {
    const initiative = roller(getModifier(combatant));
    rolls[combatant.id] = initiative;
    return { combatantId: combatant.id, initiative };
  });
  order.sort((a, b) => {
    if (a.initiative !== b.initiative) return b.initiative - a.initiative;
    return (originalOrder.get(a.combatantId) ?? 0)
      - (originalOrder.get(b.combatantId) ?? 0);
  });
  return { order, rolls };
}

/** Backward-compatible player-plus-monsters initiative adapter. */
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
  const rolls: Record<BattleCombatantId, number> = {
    [HERO_COMBATANT_ID]: playerRoll,
  };
  for (const [index, combatant] of combatants.entries()) {
    rolls[combatant.id] = monsterRolls[index]!;
  }
  const originalOrder = new Map<BattleCombatantId, number>([
    [HERO_COMBATANT_ID, 0],
    ...combatants.map(
      (combatant, index): [BattleCombatantId, number] => [
        combatant.id,
        index + 1,
      ],
    ),
  ]);
  const order: BattleTurn[] = [
    { combatantId: HERO_COMBATANT_ID, initiative: playerRoll },
    ...combatants.map((combatant, index) => ({
      combatantId: combatant.id,
      initiative: monsterRolls[index]!,
    })),
  ];
  order.sort((a, b) => {
    if (a.initiative !== b.initiative) return b.initiative - a.initiative;
    return (originalOrder.get(a.combatantId) ?? 0)
      - (originalOrder.get(b.combatantId) ?? 0);
  });

  return { order, rolls, playerRoll, monsterRolls };
}

export function getCombatantById<T extends BattleCombatantState>(
  combatants: T[],
  combatantId: BattleCombatantId,
): T | undefined {
  return combatants.find((combatant) => combatant.id === combatantId);
}

export function isCombatantActive(combatant: BattleCombatantState): boolean {
  return combatant.isAlive
    && !combatant.isKnockedOut
    && combatant.currentHp > 0;
}

export function getAliveCombatantIndices(
  combatants: GroupCombatant[],
): number[] {
  return combatants.flatMap((combatant, index) =>
    isCombatantActive(combatant) ? [index] : []
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

/** Resolve actor-relative enemy and ally scopes to stable combatant IDs. */
export function getBattleTargetIds(
  combatants: BattleCombatantState[],
  actorId: BattleCombatantId,
  targetType: TargetType,
  random: () => number = Math.random,
): BattleCombatantId[] {
  const actor = getCombatantById(combatants, actorId);
  if (!actor) return [];
  const active = combatants.filter(isCombatantActive);
  const enemies = active.filter((combatant) => combatant.side !== actor.side);
  const allies = active.filter(
    (combatant) => combatant.side === actor.side && combatant.id !== actor.id,
  );
  const party = active.filter((combatant) => combatant.side === actor.side);

  if (targetType === "self") return actor.isAlive ? [actor.id] : [];
  if (targetType === "single_ally") {
    return allies[0] ? [allies[0].id] : actor.isAlive ? [actor.id] : [];
  }
  if (targetType === "all_allies") {
    return allies.map((combatant) => combatant.id);
  }
  if (targetType === "all_party") {
    return party.map((combatant) => combatant.id);
  }
  if (targetType === "all_enemies") {
    return enemies.map((combatant) => combatant.id);
  }
  if (targetType === "front_row" || targetType === "front_row_enemies") {
    const front = enemies.filter((combatant) => combatant.position === "front");
    const row = front.length > 0
      ? front
      : enemies.filter((combatant) => combatant.position === "back");
    return row.map((combatant) => combatant.id);
  }
  if (targetType === "back_row" || targetType === "back_row_enemies") {
    return enemies
      .filter((combatant) => combatant.position === "back")
      .map((combatant) => combatant.id);
  }
  if (targetType === "random_2") {
    const available = enemies.slice();
    const selected: BattleCombatantId[] = [];
    while (available.length > 0 && selected.length < 2) {
      const pick = Math.floor(
        Math.max(0, Math.min(0.999999, random())) * available.length,
      );
      selected.push(available.splice(pick, 1)[0]!.id);
    }
    return selected;
  }
  const firstEnemy = enemies[0];
  return firstEnemy ? [firstEnemy.id] : [];
}

/** Resolve target metadata to living combatant indices. */
export function getTargetIndices(
  combatants: GroupCombatant[],
  targetType: TargetType,
  random: () => number = Math.random,
): number[] {
  const alive = getAliveCombatantIndices(combatants);
  if (
    targetType === "self"
    || targetType === "single_ally"
    || targetType === "all_allies"
    || targetType === "all_party"
  ) {
    return [];
  }
  if (targetType === "single" || targetType === "single_enemy") {
    return alive.slice(0, 1);
  }
  if (targetType === "all_enemies") return alive;
  if (targetType === "front_row" || targetType === "front_row_enemies") {
    const front = alive.filter((index) => combatants[index]?.position === "front");
    return front.length > 0
      ? front
      : alive.filter((index) => combatants[index]?.position === "back");
  }
  if (targetType === "back_row" || targetType === "back_row_enemies") {
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

/** Choose a living, conscious party member for a monster action. */
export function selectMonsterTarget(
  partyCombatants: PartyCombatant[],
  random: () => number = Math.random,
): PartyCombatant | undefined {
  const candidates = partyCombatants.filter(isCombatantActive);
  if (candidates.length === 0) return undefined;
  const index = Math.floor(
    Math.max(0, Math.min(0.999999, random())) * candidates.length,
  );
  return candidates[index];
}

export function isPartyDefeated(
  partyCombatants: PartyCombatant[],
): boolean {
  return partyCombatants.every((combatant) => !isCombatantActive(combatant));
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
): BattleReward {
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

export function resolveBattleRewards(
  encounter: MonsterEncounter,
  hooks?: BattleResolutionHooks,
): BattleReward {
  const baseRewards = calculateEncounterRewards(encounter);
  return hooks?.adjustRewards?.({ ...baseRewards }, encounter) ?? baseRewards;
}

export function createBattleResult(
  outcome: BattleOutcome,
  partyCombatants: PartyCombatant[],
  enemies: GroupCombatant[],
  rewards: BattleReward = { xp: 0, gold: 0 },
  droppedItemIds: string[] = [],
): BattleResult {
  return {
    outcome,
    defeatedEnemyIds: enemies
      .filter((combatant) => !isCombatantActive(combatant))
      .map((combatant) => combatant.id),
    survivingPartyIds: partyCombatants
      .filter(isCombatantActive)
      .map((combatant) => combatant.id),
    knockedOutPartyIds: partyCombatants
      .filter((combatant) => combatant.isKnockedOut || combatant.currentHp <= 0)
      .map((combatant) => combatant.id),
    rewards: { ...rewards },
    droppedItemIds: droppedItemIds.slice(),
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
