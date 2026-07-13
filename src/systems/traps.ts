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
import type { SkillCheckRecord } from "../data/skillChecks";
import { getTalent } from "../data/talents";
import { rollDice } from "./dice";
import { awardXP, type PlayerState } from "./player";
import {
  applyNonlethalDamage,
  resolveSkillCheck,
  rollSkillCheck,
} from "./skillChecks";
import { applyStatusEffect } from "./statusEffects";

export const TRAP_LAYOUT_CHECK_ID = "trap:layout";
export const TRAP_GUIDANCE_ITEM_ID = "adventurerTrapNotes";

type TrapCheckPhase = "detect" | "disarm";

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

export interface TrapLayoutSeedResult {
  seed: number;
  created: boolean;
}

export type TrapEntryDisposition = "safe" | "blocked" | "trigger" | "check";

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

export function getTrapCheckId(trap: DungeonTrap | string): string {
  const trapId = typeof trap === "string" ? trap : trap.id;
  return `trap:${trapId}`;
}

export function getTrapStateFromRecord(
  record: SkillCheckRecord | undefined,
): TrapState | undefined {
  if (!record) return undefined;
  if (record.optionId?.startsWith("triggered:")) return "triggered";
  if (record.optionId === "disarm") {
    return record.success ? "disarmed" : "missed";
  }
  if (record.optionId === "detect") {
    return record.success ? "detected" : "missed";
  }
  return undefined;
}

export function getTrapState(
  player: PlayerState,
  trap: DungeonTrap | string,
): TrapState | undefined {
  return getTrapStateFromRecord(
    player.progression.skillChecks[getTrapCheckId(trap)],
  );
}

export function getOrCreateTrapLayoutSeed(
  player: PlayerState,
  naturalRoll?: number,
): TrapLayoutSeedResult {
  let record = player.progression.skillChecks[TRAP_LAYOUT_CHECK_ID];
  let created = false;
  if (!record) {
    record = naturalRoll === undefined
      ? rollSkillCheck(player.stats, "wisdom", 1, { optionId: "layout" })
      : resolveSkillCheck(
        player.stats,
        "wisdom",
        1,
        naturalRoll,
        { optionId: "layout" },
      );
    player.progression.skillChecks[TRAP_LAYOUT_CHECK_ID] = record;
    created = true;
  }

  if (record.optionId?.startsWith("layout:")) {
    const legacySeed = Number(record.optionId.slice("layout:".length));
    if (Number.isInteger(legacySeed) && legacySeed > 0) {
      return { seed: legacySeed, created };
    }
  }

  const customAppearance = player.customAppearance
    ? [
      player.customAppearance.skinColor,
      player.customAppearance.hairStyle,
      player.customAppearance.hairColor,
    ].join(":")
    : "default";
  const seed = hashString([
    player.name,
    player.appearanceId,
    customAppearance,
    record.naturalRoll,
    record.modifier,
  ].join(":"));
  return { seed, created };
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
  player: PlayerState,
  x: number,
  y: number,
  focusedTrapId: string | null = null,
): DungeonTrap | undefined {
  const detected = getNearbyDungeonTraps(traps, x, y, 1)
    .filter((trap) => getTrapState(player, trap) === "detected");
  if (focusedTrapId) {
    const focused = detected.find((trap) => trap.id === focusedTrapId);
    if (focused) return focused;
  }
  return detected.sort((left, right) => left.id.localeCompare(right.id))[0];
}

export function getTrapCheckModifiers(
  player: PlayerState,
): TrapCheckModifiers {
  let detectionBonus = 0;
  let disarmBonus = 0;
  let autoDetect = false;

  for (const talentId of player.knownTalents) {
    const talent = getTalent(talentId);
    detectionBonus += talent?.trapDetectionBonus ?? 0;
    disarmBonus += talent?.trapDisarmBonus ?? 0;
    autoDetect ||= talent?.autoDetectTraps === true;
  }

  const guidanceOwned = player.inventory.some(
    (item) => item.id === TRAP_GUIDANCE_ITEM_ID,
  );
  if (guidanceOwned) {
    detectionBonus += 2;
    disarmBonus += 1;
  }

  detectionBonus += player.inventory.reduce(
    (highest, item) => item.id === TRAP_GUIDANCE_ITEM_ID
      ? highest
      : Math.max(highest, item.trapDetectionBonus ?? 0),
    0,
  );
  disarmBonus += player.inventory.reduce(
    (highest, item) => item.id === TRAP_GUIDANCE_ITEM_ID
      ? highest
      : Math.max(highest, item.trapDisarmBonus ?? 0),
    0,
  );

  return { detectionBonus, disarmBonus, autoDetect };
}

function toTrapCheckResult(
  record: SkillCheckRecord,
  attempted: boolean,
  automatic: boolean,
  rewardXp = 0,
): TrapCheckResult {
  return {
    attempted,
    success: record.success,
    automatic,
    roll: record.naturalRoll,
    modifier: record.modifier,
    total: record.total,
    dc: record.dc,
    rewardXp,
  };
}

function resolveTrapCheck(
  player: PlayerState,
  trap: DungeonTrap,
  phase: TrapCheckPhase,
  modifierBonus: number,
  naturalRoll?: number,
): SkillCheckRecord {
  const definition = getTrapDefinition(trap.type);
  const ability = phase === "detect"
    ? definition.detectionAbility
    : definition.disarmAbility;
  const dc = phase === "detect" ? trap.detectionDC : trap.disarmDC;
  return naturalRoll === undefined
    ? rollSkillCheck(player.stats, ability, dc, {
      modifierBonus,
      optionId: phase,
    })
    : resolveSkillCheck(player.stats, ability, dc, naturalRoll, {
      modifierBonus,
      optionId: phase,
    });
}

export function attemptTrapDetection(
  player: PlayerState,
  trap: DungeonTrap,
  naturalRoll?: number,
  automatic = false,
): TrapCheckResult {
  const checkId = getTrapCheckId(trap);
  const existing = player.progression.skillChecks[checkId];
  if (existing && getTrapStateFromRecord(existing) !== undefined) {
    return toTrapCheckResult(existing, false, false);
  }

  const modifiers = getTrapCheckModifiers(player);
  const record = resolveTrapCheck(
    player,
    trap,
    "detect",
    modifiers.detectionBonus,
    naturalRoll,
  );
  player.progression.skillChecks[checkId] = record;
  return toTrapCheckResult(record, true, automatic);
}

export function attemptTrapDisarm(
  player: PlayerState,
  trap: DungeonTrap,
  naturalRoll?: number,
): TrapCheckResult {
  if (getTrapState(player, trap) !== "detected") {
    const existing = player.progression.skillChecks[getTrapCheckId(trap)];
    return existing
      ? toTrapCheckResult(existing, false, false)
      : {
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

  const modifiers = getTrapCheckModifiers(player);
  const record = resolveTrapCheck(
    player,
    trap,
    "disarm",
    modifiers.disarmBonus,
    naturalRoll,
  );
  player.progression.skillChecks[getTrapCheckId(trap)] = record;
  if (record.success) awardXP(player, trap.rewardXp);
  return toTrapCheckResult(
    record,
    true,
    false,
    record.success ? trap.rewardXp : 0,
  );
}

export function getTrapEntryDisposition(
  state: TrapState | undefined,
): TrapEntryDisposition {
  if (state === undefined) return "check";
  if (state === "detected") return "blocked";
  if (state === "missed") return "trigger";
  return "safe";
}

export function triggerDungeonTrap(
  player: PlayerState,
  trap: DungeonTrap,
  damageRoller: (count: number, sides: TrapDie) => number = rollDice,
): TrapTriggerResult {
  const state = getTrapState(player, trap);
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

  const definition = getTrapDefinition(trap.type);
  const checkId = getTrapCheckId(trap);
  const existing = player.progression.skillChecks[checkId];
  const phase = existing?.optionId === "disarm"
    ? "disarm"
    : existing?.optionId === "detect"
      ? "detect"
      : "entry";
  const triggerRecord = existing ?? resolveSkillCheck(
    player.stats,
    definition.detectionAbility,
    trap.detectionDC,
    1,
    { optionId: "triggered:entry" },
  );
  player.progression.skillChecks[checkId] = {
    ...triggerRecord,
    optionId: `triggered:${phase}`,
  };

  const rolledDamage = definition.damage
    ? Math.max(0, damageRoller(definition.damage.count, definition.damage.sides))
    : 0;
  const nextHp = applyNonlethalDamage(player.hp, rolledDamage);
  const damage = player.hp - nextHp;
  player.hp = nextHp;

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
