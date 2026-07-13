import {
  Terrain,
  getDungeon,
  getDungeonLevelMap,
  getDungeonLevelSpawn,
  getDungeonTotalLevels,
  type DungeonData,
} from "../data/map";
import {
  getTrapDefinition,
  type DungeonTrap,
  type TrapDie,
  type TrapState,
} from "../data/traps";
import { getTalent } from "../data/talents";
import { abilityModifier, rollDice } from "./dice";
import { awardXP, type PlayerState } from "./player";
import { resolveSkillCheck, rollSkillCheck } from "./skillChecks";
import { applyStatusEffect } from "./statusEffects";

interface TrapCandidate {
  x: number;
  y: number;
  protectsTreasure: boolean;
}

export interface TrapCheckModifiers {
  detectionBonus: number;
  disarmBonus: number;
  autoDetect: boolean;
}

export interface TrapCheckResult {
  attempted: boolean;
  success: boolean;
  automatic: boolean;
  roll: number | null;
  modifier: number;
  total: number;
  dc: number;
  rewardXp: number;
}

export type TrapEntryDisposition = "safe" | "blocked" | "trigger";

export interface TrapTriggerResult {
  triggered: boolean;
  damage: number;
  mpLoss: number;
  startsEncounter: boolean;
  dropsLevel: boolean;
  statusApplied?: string;
  message: string;
}

export interface TrapDropDestination {
  level: number;
  x: number;
  y: number;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: number, salt: string): () => number {
  let state = (seed ^ hashString(salt)) >>> 0;
  if (state === 0) state = 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function shuffleCandidates(
  candidates: TrapCandidate[],
  random: () => number,
): TrapCandidate[] {
  const shuffled = [...candidates];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

function hasAdjacentTerrain(
  mapData: Terrain[][],
  x: number,
  y: number,
  terrains: ReadonlySet<Terrain>,
): boolean {
  const checks = [
    { x: x - 1, y },
    { x: x + 1, y },
    { x, y: y - 1 },
    { x, y: y + 1 },
  ];
  return checks.some((position) => {
    const terrain = mapData[position.y]?.[position.x];
    return terrain !== undefined && terrains.has(terrain);
  });
}

function buildTrapCandidates(
  dungeon: DungeonData,
  level: number,
): TrapCandidate[] {
  const mapData = getDungeonLevelMap(dungeon, level);
  const spawn = getDungeonLevelSpawn(dungeon, level);
  const transitionTerrains = new Set([
    Terrain.DungeonExit,
    Terrain.DungeonStairs,
    Terrain.DungeonBoss,
  ]);
  const candidates: TrapCandidate[] = [];

  for (let y = 0; y < mapData.length; y++) {
    for (let x = 0; x < mapData[y].length; x++) {
      if (mapData[y][x] !== Terrain.DungeonFloor) continue;
      if (Math.abs(x - spawn.x) + Math.abs(y - spawn.y) <= 1) continue;
      if (hasAdjacentTerrain(mapData, x, y, transitionTerrains)) continue;
      candidates.push({
        x,
        y,
        protectsTreasure: hasAdjacentTerrain(
          mapData,
          x,
          y,
          new Set([Terrain.Chest]),
        ),
      });
    }
  }

  return candidates;
}

function selectTrapCandidates(
  dungeon: DungeonData,
  level: number,
  random: () => number,
): TrapCandidate[] {
  const candidates = buildTrapCandidates(dungeon, level);
  const protectedCandidates = candidates.filter(
    (candidate) => candidate.protectsTreasure,
  );
  const selected: TrapCandidate[] = [];
  const selectedKeys = new Set<string>();
  const mapData = getDungeonLevelMap(dungeon, level);

  for (let y = 0; y < mapData.length; y++) {
    for (let x = 0; x < mapData[y].length; x++) {
      if (mapData[y][x] !== Terrain.Chest) continue;
      const adjacent = protectedCandidates.filter(
        (candidate) =>
          Math.abs(candidate.x - x) + Math.abs(candidate.y - y) === 1
          && !selectedKeys.has(`${candidate.x},${candidate.y}`),
      );
      if (adjacent.length === 0) continue;
      const chosen = adjacent[Math.floor(random() * adjacent.length)];
      selected.push(chosen);
      selectedKeys.add(`${chosen.x},${chosen.y}`);
    }
  }

  const targetCount = Math.min(
    candidates.length,
    Math.max(dungeon.trapProfile.trapsPerLevel + level, selected.length),
  );
  const remaining = shuffleCandidates(
    candidates.filter(
      (candidate) => !selectedKeys.has(`${candidate.x},${candidate.y}`),
    ),
    random,
  );
  for (const candidate of remaining) {
    if (selected.length >= targetCount) break;
    selected.push(candidate);
  }

  return selected;
}

/** Generate a stable, immutable trap layout for one dungeon level. */
export function generateDungeonTraps(
  dungeon: DungeonData,
  level: number,
  seed: number,
): DungeonTrap[] {
  const random = createSeededRandom(seed, `${dungeon.id}:${level}`);
  const candidates = selectTrapCandidates(dungeon, level, random);
  const deepestLevel = getDungeonTotalLevels(dungeon) - 1;

  return candidates.map((candidate, index) => {
    const type = level === deepestLevel && index === 0
      ? dungeon.trapProfile.thematicType
      : dungeon.trapProfile.types[
        Math.floor(random() * dungeon.trapProfile.types.length)
      ];
    const definition = getTrapDefinition(type);
    const treasureModifier = candidate.protectsTreasure ? 1 : 0;
    const difficulty = dungeon.trapProfile.difficultyModifier
      + level
      + treasureModifier;
    return {
      id: `${dungeon.id}:${level}:${candidate.x},${candidate.y}:${type}`,
      dungeonId: dungeon.id,
      level,
      x: candidate.x,
      y: candidate.y,
      type,
      detectionDC: definition.detectionDC + difficulty,
      disarmDC: definition.disarmDC + difficulty,
      rewardXp: definition.rewardXp + level * 5 + treasureModifier * 10,
      protectsTreasure: candidate.protectsTreasure,
    };
  });
}

export function getDungeonTrapAt(
  traps: DungeonTrap[],
  x: number,
  y: number,
): DungeonTrap | undefined {
  return traps.find((trap) => trap.x === x && trap.y === y);
}

export function getNearbyDungeonTraps(
  traps: DungeonTrap[],
  x: number,
  y: number,
  radius = 1,
): DungeonTrap[] {
  return traps.filter(
    (trap) => Math.abs(trap.x - x) + Math.abs(trap.y - y) <= radius,
  );
}

export function selectActionableTrap(
  traps: DungeonTrap[],
  trapStates: Record<string, TrapState>,
  x: number,
  y: number,
  focusedTrapId: string | null = null,
): DungeonTrap | undefined {
  const detected = getNearbyDungeonTraps(traps, x, y, 1)
    .filter((trap) => trapStates[trap.id] === "detected");
  if (focusedTrapId) {
    const focused = detected.find((trap) => trap.id === focusedTrapId);
    if (focused) return focused;
  }
  return detected.sort((left, right) => left.id.localeCompare(right.id))[0];
}

export function getTrapCheckModifiers(
  player: PlayerState,
): TrapCheckModifiers {
  let detectionBonus = player.progression.trapGuidance ? 2 : 0;
  let disarmBonus = player.progression.trapGuidance ? 1 : 0;
  let autoDetect = false;

  for (const talentId of player.knownTalents) {
    const talent = getTalent(talentId);
    detectionBonus += talent?.trapDetectionBonus ?? 0;
    disarmBonus += talent?.trapDisarmBonus ?? 0;
    autoDetect ||= talent?.autoDetectTraps === true;
  }

  detectionBonus += player.inventory.reduce(
    (highest, item) => Math.max(highest, item.trapDetectionBonus ?? 0),
    0,
  );
  disarmBonus += player.inventory.reduce(
    (highest, item) => Math.max(highest, item.trapDisarmBonus ?? 0),
    0,
  );

  return { detectionBonus, disarmBonus, autoDetect };
}

function mapTrapCheckResult(
  record: ReturnType<typeof resolveSkillCheck>,
  rewardXp = 0,
): TrapCheckResult {
  return {
    attempted: true,
    success: record.success,
    automatic: false,
    roll: record.naturalRoll,
    modifier: record.modifier,
    total: record.total,
    dc: record.dc,
    rewardXp,
  };
}

export function attemptTrapDetection(
  player: PlayerState,
  trap: DungeonTrap,
  naturalRoll?: number,
): TrapCheckResult {
  const currentState = player.progression.trapStates[trap.id];
  if (currentState !== undefined) {
    return {
      attempted: false,
      success: currentState === "detected",
      automatic: false,
      roll: null,
      modifier: 0,
      total: 0,
      dc: trap.detectionDC,
      rewardXp: 0,
    };
  }

  const definition = getTrapDefinition(trap.type);
  const modifiers = getTrapCheckModifiers(player);
  if (modifiers.autoDetect) {
    const modifier = abilityModifier(
      player.stats[definition.detectionAbility],
    ) + modifiers.detectionBonus;
    player.progression.trapStates[trap.id] = "detected";
    return {
      attempted: true,
      success: true,
      automatic: true,
      roll: null,
      modifier,
      total: trap.detectionDC,
      dc: trap.detectionDC,
      rewardXp: 0,
    };
  }

  const record = naturalRoll === undefined
    ? rollSkillCheck(player.stats, definition.detectionAbility, trap.detectionDC, {
      situationalModifier: modifiers.detectionBonus,
    })
    : resolveSkillCheck(
      player.stats,
      definition.detectionAbility,
      trap.detectionDC,
      naturalRoll,
      { situationalModifier: modifiers.detectionBonus },
    );
  player.progression.trapStates[trap.id] = record.success
    ? "detected"
    : "missed";
  return mapTrapCheckResult(record);
}

export function attemptTrapDisarm(
  player: PlayerState,
  trap: DungeonTrap,
  naturalRoll?: number,
): TrapCheckResult {
  if (player.progression.trapStates[trap.id] !== "detected") {
    return {
      attempted: false,
      success: false,
      automatic: false,
      roll: null,
      modifier: 0,
      total: 0,
      dc: trap.disarmDC,
      rewardXp: 0,
    };
  }

  const definition = getTrapDefinition(trap.type);
  const modifiers = getTrapCheckModifiers(player);
  const record = naturalRoll === undefined
    ? rollSkillCheck(player.stats, definition.disarmAbility, trap.disarmDC, {
      situationalModifier: modifiers.disarmBonus,
    })
    : resolveSkillCheck(
      player.stats,
      definition.disarmAbility,
      trap.disarmDC,
      naturalRoll,
      { situationalModifier: modifiers.disarmBonus },
    );
  if (record.success) {
    player.progression.trapStates[trap.id] = "disarmed";
    awardXP(player, trap.rewardXp);
  }
  return mapTrapCheckResult(record, record.success ? trap.rewardXp : 0);
}

export function getTrapEntryDisposition(
  state: TrapState | undefined,
): TrapEntryDisposition {
  if (state === "detected") return "blocked";
  if (state === "disarmed" || state === "triggered") return "safe";
  return "trigger";
}

export function triggerDungeonTrap(
  player: PlayerState,
  trap: DungeonTrap,
  damageRoller: (count: number, sides: TrapDie) => number = rollDice,
): TrapTriggerResult {
  const state = player.progression.trapStates[trap.id];
  if (state === "disarmed" || state === "triggered") {
    return {
      triggered: false,
      damage: 0,
      mpLoss: 0,
      startsEncounter: false,
      dropsLevel: false,
      message: "",
    };
  }

  player.progression.trapStates[trap.id] = "triggered";
  const definition = getTrapDefinition(trap.type);
  const rolledDamage = definition.damage
    ? Math.max(0, damageRoller(definition.damage.count, definition.damage.sides))
    : 0;
  const damage = Math.min(Math.max(0, player.hp - 1), rolledDamage);
  player.hp -= damage;

  const mpLoss = Math.min(player.mp, definition.mpLoss ?? 0);
  player.mp -= mpLoss;

  let statusApplied: string | undefined;
  if (definition.statusEffect) {
    const result = applyStatusEffect(
      player.activeEffects,
      definition.statusEffect,
      definition.name,
    );
    if (result.applied) statusApplied = definition.statusEffect;
  }

  const consequences: string[] = [];
  if (damage > 0) consequences.push(`${damage} HP`);
  if (mpLoss > 0) consequences.push(`${mpLoss} MP`);
  if (statusApplied) consequences.push(statusApplied);
  const detail = consequences.length > 0
    ? ` Lost ${consequences.join(", ")}.`
    : "";

  return {
    triggered: true,
    damage,
    mpLoss,
    startsEncounter: definition.startsEncounter === true,
    dropsLevel: definition.dropsLevel === true,
    statusApplied,
    message: `${definition.name} triggered!${detail}`,
  };
}

export function getTrapDropDestination(
  player: PlayerState,
): TrapDropDestination | null {
  if (!player.position.inDungeon) return null;
  const dungeon = getDungeon(player.position.dungeonId);
  if (!dungeon) return null;
  const nextLevel = player.position.dungeonLevel + 1;
  if (nextLevel >= getDungeonTotalLevels(dungeon)) return null;
  const spawn = getDungeonLevelSpawn(dungeon, nextLevel);
  return { level: nextLevel, x: spawn.x, y: spawn.y };
}
