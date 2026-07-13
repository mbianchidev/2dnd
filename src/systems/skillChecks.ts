import {
  EXPLORATION_EVENTS,
  SKILL_CHECK_ABILITIES,
  getShopNegotiationOption,
} from "../data/skillChecks";
import { abilityModifier, rollDie } from "./dice";
import type {
  ExplorationEventDefinition,
  SkillCheckAbility,
  SkillCheckEnvironment,
  SkillCheckRecord,
} from "../data/skillChecks";
import type { PlayerStats } from "./player";
import type { Terrain } from "../data/map";

export interface RollSkillCheckOptions {
  optionId?: string;
  modifierBonus?: number;
  roller?: () => number;
}

export interface ResolveSkillCheckOptions {
  optionId?: string;
  modifierBonus?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

export function isSkillCheckAbility(value: unknown): value is SkillCheckAbility {
  return typeof value === "string"
    && SKILL_CHECK_ABILITIES.includes(value as SkillCheckAbility);
}

export function resolveSkillCheck(
  stats: PlayerStats,
  ability: SkillCheckAbility,
  dc: number,
  naturalRoll: number,
  options: ResolveSkillCheckOptions = {},
): SkillCheckRecord {
  if (!Number.isInteger(naturalRoll) || naturalRoll < 1 || naturalRoll > 20) {
    throw new Error(`[skillChecks] Invalid d20 roll: ${naturalRoll}`);
  }
  if (!Number.isInteger(dc) || dc < 1) {
    throw new Error(`[skillChecks] Invalid difficulty class: ${dc}`);
  }

  const modifierBonus = options.modifierBonus ?? 0;
  if (!Number.isInteger(modifierBonus)) {
    throw new Error(`[skillChecks] Invalid modifier bonus: ${modifierBonus}`);
  }
  const modifier = abilityModifier(stats[ability]) + modifierBonus;
  const total = naturalRoll + modifier;
  const result: SkillCheckRecord = {
    ability,
    naturalRoll,
    modifier,
    total,
    dc,
    success: total >= dc,
  };
  const optionId = options.optionId?.trim();
  return optionId ? { ...result, optionId } : result;
}

export function rollSkillCheck(
  stats: PlayerStats,
  ability: SkillCheckAbility,
  dc: number,
  options: RollSkillCheckOptions = {},
): SkillCheckRecord {
  const naturalRoll = (options.roller ?? (() => rollDie(20)))();
  return resolveSkillCheck(stats, ability, dc, naturalRoll, options);
}

export function formatSkillCheckResult(result: SkillCheckRecord): string {
  const modifier = result.modifier >= 0
    ? `+${result.modifier}`
    : String(result.modifier);
  return `d20 ${result.naturalRoll} ${modifier} = ${result.total} vs DC ${result.dc}`;
}

export function getShopNegotiationDiscount(
  record: SkillCheckRecord | undefined,
): number {
  if (!record?.success || !record.optionId) return 0;
  return getShopNegotiationOption(record.optionId)?.discount ?? 0;
}

export function selectExplorationEvent(
  terrain: Terrain,
  environment: SkillCheckEnvironment,
  randomValue: number = Math.random(),
): ExplorationEventDefinition | undefined {
  if (randomValue < 0 || randomValue >= 1 || !Number.isFinite(randomValue)) {
    throw new Error(`[skillChecks] Invalid event roll: ${randomValue}`);
  }

  let cumulativeChance = 0;
  for (const event of EXPLORATION_EVENTS) {
    if (
      !event.environments.includes(environment)
      || !event.terrains.includes(terrain)
    ) {
      continue;
    }
    cumulativeChance += event.chance;
    if (randomValue < cumulativeChance) return event;
  }
  return undefined;
}

export function getMinorTreasureGold(
  success: boolean,
  randomValue: number = Math.random(),
): number {
  if (randomValue < 0 || randomValue >= 1 || !Number.isFinite(randomValue)) {
    throw new Error(`[skillChecks] Invalid treasure roll: ${randomValue}`);
  }
  return success
    ? 15 + Math.floor(randomValue * 21)
    : 1 + Math.floor(randomValue * 5);
}

export function applyNonlethalDamage(currentHp: number, damage: number): number {
  if (!Number.isFinite(currentHp) || !Number.isFinite(damage) || damage < 0) {
    throw new Error("[skillChecks] Invalid nonlethal damage values");
  }
  return Math.max(1, currentHp - damage);
}

export function normalizeSkillCheckRecords(
  value: unknown,
): Record<string, SkillCheckRecord> {
  if (!isRecord(value)) return {};

  const records: Record<string, SkillCheckRecord> = {};
  for (const [id, candidate] of Object.entries(value)) {
    if (!id || !isRecord(candidate)) continue;

    const ability = candidate["ability"];
    const naturalRoll = candidate["naturalRoll"];
    const modifier = candidate["modifier"];
    const dc = candidate["dc"];
    const optionValue = candidate["optionId"];

    if (
      !isSkillCheckAbility(ability)
      || !isInteger(naturalRoll)
      || naturalRoll < 1
      || naturalRoll > 20
      || !isInteger(modifier)
      || !isInteger(dc)
      || dc < 1
      || (optionValue !== undefined && typeof optionValue !== "string")
    ) {
      continue;
    }

    const optionId = typeof optionValue === "string"
      ? optionValue.trim()
      : undefined;
    const total = naturalRoll + modifier;
    records[id] = {
      ability,
      naturalRoll,
      modifier,
      total,
      dc,
      success: total >= dc,
      ...(optionId ? { optionId } : {}),
    };
  }
  return records;
}
