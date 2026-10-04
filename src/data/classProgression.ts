import { getAbility } from "./abilities";
import { getSpell } from "./spells";
import { TALENTS } from "./talents";
import { getPlayerClass } from "../systems/classes";
import type { PlayerStats } from "../systems/player";

export const BASE_CLASS_IDS = [
  "knight", "ranger", "wizard", "sorcerer", "rogue", "paladin",
  "warlock", "cleric", "druid", "barbarian", "monk", "bard",
] as const;

export type BaseClassId = typeof BASE_CLASS_IDS[number];
export type ExternalProgressionTrackId = `prestige:${string}`;
export type ProgressionTrackId = BaseClassId | ExternalProgressionTrackId;
export type ProgressionFeatureKind = "spell" | "ability" | "talent";
export type EquipmentPermission = "weapon" | "armor" | "shield";

export const NORMAL_LEVEL_CAP = 20;
export const ASI_LEVELS: readonly number[] = [4, 8, 12, 16, 19];
export const ASI_POINTS = 2;
export const STAT_KEYS: readonly (keyof PlayerStats)[] = [
  "strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma",
];
export const MAX_ABILITY_SCORE = 30;

export type ProgressionRequirement =
  | { readonly type: "abilityScore"; readonly stat: keyof PlayerStats; readonly minimum: number }
  | { readonly type: "totalLevel"; readonly minimum: number }
  | { readonly type: "classLevel"; readonly classId: BaseClassId; readonly minimum: number }
  | { readonly type: "feature"; readonly kind: ProgressionFeatureKind; readonly id: string }
  | { readonly type: "anyOf"; readonly requirements: readonly ProgressionRequirement[] };

export interface ProgressionFeatureGrant {
  readonly kind: ProgressionFeatureKind;
  readonly id: string;
  readonly rank: number;
  readonly stat?: keyof PlayerStats;
}

export interface ProgressionTrackProfile {
  readonly id: ProgressionTrackId;
  readonly kind: "base" | "prestige";
  readonly label: string;
  readonly maxRank: number;
  readonly primaryStat: keyof PlayerStats;
  readonly entryRequirements: readonly ProgressionRequirement[];
  readonly hpGrowth: {
    readonly hitDie: 6 | 8 | 10 | 12;
    readonly stat: "constitution";
    readonly minimum: number;
  };
  readonly mpGrowth: {
    readonly pool: "mp";
    readonly base: number;
    readonly stat: "intelligence";
    readonly minimum: number;
  };
  readonly grants: readonly ProgressionFeatureGrant[];
  readonly equipmentPermissions: readonly EquipmentPermission[];
}

export interface HeroProgressionContext {
  readonly profiles: readonly ProgressionTrackProfile[];
}

export const STARTING_RESOURCE_RULES = Object.freeze({
  hp: { base: 25, stat: "constitution", multiplier: 3, minimum: 10 },
  mp: { base: 8, stat: "intelligence", multiplier: 2, minimum: 4 },
} as const);

const score = (stat: keyof PlayerStats): ProgressionRequirement => ({
  type: "abilityScore", stat, minimum: 13,
});

const ENTRY_REQUIREMENTS: Readonly<Record<BaseClassId, readonly ProgressionRequirement[]>> = {
  knight: [{ type: "anyOf", requirements: [score("strength"), score("dexterity")] }],
  ranger: [score("dexterity"), score("wisdom")],
  wizard: [score("intelligence")],
  sorcerer: [score("charisma")],
  rogue: [score("dexterity")],
  paladin: [score("strength"), score("charisma")],
  warlock: [score("charisma")],
  cleric: [score("wisdom")],
  druid: [score("wisdom")],
  barbarian: [score("strength")],
  monk: [score("dexterity"), score("wisdom")],
  bard: [score("charisma")],
};

function createBaseProfile(classId: BaseClassId): ProgressionTrackProfile {
  const definition = getPlayerClass(classId);
  const grants: ProgressionFeatureGrant[] = [
    ...definition.spells.map((id): ProgressionFeatureGrant => {
      const spell = getSpell(id);
      if (!spell) throw new Error(`[progression] Unknown ${classId} spell: ${id}`);
      return { kind: "spell", id, rank: spell.levelRequired, stat: definition.primaryStat };
    }),
    ...definition.abilities.map((id): ProgressionFeatureGrant => {
      const ability = getAbility(id);
      if (!ability) throw new Error(`[progression] Unknown ${classId} ability: ${id}`);
      return { kind: "ability", id, rank: ability.levelRequired, stat: ability.statKey };
    }),
    ...TALENTS.filter((talent) => talent.classRestriction?.includes(classId))
      .map((talent): ProgressionFeatureGrant => ({
        kind: "talent", id: talent.id, rank: talent.levelRequired,
      })),
  ];
  return Object.freeze({
    id: classId,
    kind: "base",
    label: definition.label,
    maxRank: NORMAL_LEVEL_CAP,
    primaryStat: definition.primaryStat,
    entryRequirements: ENTRY_REQUIREMENTS[classId],
    hpGrowth: Object.freeze({
      hitDie: definition.hitDie, stat: "constitution", minimum: 1,
    }),
    mpGrowth: Object.freeze({
      pool: "mp", base: 2, stat: "intelligence", minimum: 1,
    }),
    grants: Object.freeze(grants.map((grant) => Object.freeze(grant))),
    equipmentPermissions: Object.freeze(["weapon", "armor", "shield"] as const),
  });
}

export const BASE_CLASS_PROFILES: readonly ProgressionTrackProfile[] = Object.freeze(
  BASE_CLASS_IDS.map(createBaseProfile),
);

/** Static registry seam: only the twelve base classes are shipped here. */
export const PROGRESSION_PROFILES = BASE_CLASS_PROFILES;
export const DEFAULT_PROGRESSION_CONTEXT: HeroProgressionContext = {
  profiles: PROGRESSION_PROFILES,
};

export function isBaseClassId(value: unknown): value is BaseClassId {
  return typeof value === "string" && BASE_CLASS_IDS.some((id) => id === value);
}

export function isExternalProgressionTrackId(value: unknown): value is ExternalProgressionTrackId {
  return typeof value === "string" && /^prestige:[a-z][a-zA-Z0-9]*$/.test(value);
}

export function getProgressionProfile(
  id: string,
  context: HeroProgressionContext = DEFAULT_PROGRESSION_CONTEXT,
): ProgressionTrackProfile | undefined {
  return context.profiles.find((profile) => profile.id === id);
}
