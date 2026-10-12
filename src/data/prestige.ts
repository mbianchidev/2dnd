import type {
  BaseClassId, ProgressionFeatureGrant, ProgressionRequirement, ProgressionTrackProfile,
} from "./classProgression";
import type { PlayerStats } from "../systems/player";

export const PRESTIGE_SAVE_VERSION = 20;
export const PRESTIGE_PATH_IDS = [
  "roadglassBulwark", "prismScribe", "hearthlightCustodian",
  "rootwakeKeeper", "duskthreadCourier", "chordsteelEnvoy",
] as const;
export type PrestigePathId = typeof PRESTIGE_PATH_IDS[number];
export type PrestigeTrackId = `prestige:${PrestigePathId}`;
export type PrestigeArchetype = "martial" | "arcane" | "divine" | "primal" | "stealth" | "hybrid";

export interface PrestigePath extends ProgressionTrackProfile {
  readonly id: PrestigeTrackId;
  readonly pathId: PrestigePathId;
  readonly kind: "prestige";
  readonly archetype: PrestigeArchetype;
  readonly description: string;
  readonly tradeoff: string;
  readonly equipmentNotes: string;
}

function score(stat: keyof PlayerStats): ProgressionRequirement {
  return { type: "abilityScore", stat, minimum: 13 };
}

function classes(ids: readonly BaseClassId[], minimum: number): ProgressionRequirement {
  return { type: "anyOf", requirements: ids.map((classId) => ({ type: "classLevel", classId, minimum })) };
}

function standing(targetId: "heartlandsWardens" | "winterWitnesses" | "twelvefoldCovenant"
  | "rootspeakers" | "roadwardens"): ProgressionRequirement {
  return { type: "reputation", kind: "faction", targetId, minimum: 15 };
}

const keystone: ProgressionRequirement = {
  type: "questStageCompleted", questId: "twelvefoldCovenant", stageId: "stoneAndRoot",
};
const martialSources: readonly { classId: BaseClassId; stat: "strength" | "dexterity" }[] = [
  { classId: "knight", stat: "strength" }, { classId: "ranger", stat: "dexterity" },
  { classId: "rogue", stat: "dexterity" }, { classId: "paladin", stat: "strength" },
  { classId: "barbarian", stat: "strength" }, { classId: "monk", stat: "dexterity" },
];
const casterSources: readonly BaseClassId[] = [
  "wizard", "sorcerer", "warlock", "cleric", "druid", "bard", "paladin", "ranger",
];
const distinctHybrid: ProgressionRequirement = {
  type: "anyOf",
  requirements: martialSources.map(({ classId, stat }) => ({
    type: "allOf", requirements: [
      { type: "classLevel", classId, minimum: 2 }, score(stat),
      classes(casterSources.filter((id) => id !== classId), 2),
    ],
  })),
};

function freezeRequirement(requirement: ProgressionRequirement): ProgressionRequirement {
  return requirement.type === "anyOf" || requirement.type === "allOf"
    ? Object.freeze({ ...requirement, requirements: Object.freeze(requirement.requirements.map(freezeRequirement)) })
    : Object.freeze(requirement);
}

function path(
  pathId: PrestigePathId, label: string, archetype: PrestigeArchetype,
  primaryStat: keyof PlayerStats, hitDie: 6 | 8 | 10,
  description: string, tradeoff: string, equipmentNotes: string,
  entryRequirements: readonly ProgressionRequirement[], grants: readonly ProgressionFeatureGrant[],
): PrestigePath {
  return Object.freeze({
    id: `prestige:${pathId}`, pathId, kind: "prestige", label, archetype, primaryStat, maxRank: 5,
    description, tradeoff, equipmentNotes,
    entryRequirements: Object.freeze([{ type: "totalLevel", minimum: 6 } as const,
      ...entryRequirements].map(freezeRequirement)),
    hpGrowth: Object.freeze({ hitDie, stat: "constitution", minimum: 1 }),
    mpGrowth: Object.freeze({ pool: "mp", base: 2, stat: "intelligence", minimum: 1 }),
    equipmentPermissions: Object.freeze([]),
    grants: Object.freeze(grants.map((grant) => Object.freeze(grant))),
  });
}

export const PRESTIGE_PATHS: readonly PrestigePath[] = Object.freeze([
  path("roadglassBulwark", "Roadglass Bulwark", "martial", "strength", 10,
    "Iron-road shield keepers catch glancing blows between layers of roadglass.",
    "Delays base-class attack and defense talents; its brace needs a shield and the shared bonus action.",
    "Brace: shield. Strikes: melee weapon. No new gear permissions.",
    [
      classes(["knight", "barbarian", "paladin"], 4), score("strength"), score("constitution"),
      { type: "anyOf", requirements: [
        { type: "questCompleted", questId: "ironboundDispatch" }, standing("heartlandsWardens"),
      ] },
    ],
    [
      { kind: "ability", id: "roadglassBrace", rank: 1 },
      { kind: "talent", id: "waylineStudy", rank: 2 },
      { kind: "ability", id: "waylineStrike", rank: 3 },
      { kind: "ability", id: "roadglassCrash", rank: 5 },
    ]),
  path("prismScribe", "Prism Scribe", "arcane", "intelligence", 6,
    "Keystone scholars stitch broken refractions into precise, narrow spells.",
    "Delays stronger base-class spells; limited front-row coverage and a normal-action self veil.",
    "Uses inherited equipment permissions; casting uses INT.",
    [
      classes(["wizard", "sorcerer", "warlock"], 4), score("intelligence"),
      { type: "anyOf", requirements: [keystone, standing("winterWitnesses")] },
    ],
    [
      { kind: "spell", id: "prismNeedle", rank: 1 },
      { kind: "talent", id: "reserveLattice", rank: 2 },
      { kind: "spell", id: "prismFan", rank: 3 },
      { kind: "spell", id: "prismVeil", rank: 5 },
    ]),
  path("hearthlightCustodian", "Hearthlight Custodian", "divine", "wisdom", 8,
    "Shelter guardians preserve warmth and welcome without requiring worship.",
    "Delays base divine progression; healing cannot revive and has no free or bonus-action recovery.",
    "Uses inherited equipment permissions; casting uses WIS. Affiliation is not required.",
    [
      classes(["cleric", "paladin"], 4), score("wisdom"),
      { type: "alignmentAxis", axis: "goodEvil", minimum: 0 },
      { type: "anyOf", requirements: [
        { type: "questCompleted", questId: "recruitMystic" }, standing("twelvefoldCovenant"),
      ] },
    ],
    [
      { kind: "spell", id: "hearthMend", rank: 1 },
      { kind: "talent", id: "warmthKeeper", rank: 2 },
      { kind: "spell", id: "hearthLantern", rank: 3 },
      { kind: "spell", id: "commonHearth", rank: 5 },
    ]),
  path("rootwakeKeeper", "Rootwake Keeper", "primal", "wisdom", 8,
    "Deeproot listeners follow living routes and return borrowed vitality.",
    "Delays primal or martial base features; poison can be resisted and thunder covers only the front row.",
    "Uses inherited equipment permissions; its ranged vine uses WIS.",
    [
      classes(["druid", "ranger", "barbarian"], 4), score("wisdom"),
      { type: "anyOf", requirements: [
        { type: "cityDiscovered", cityId: "deeproot_city" }, standing("rootspeakers"),
      ] },
    ],
    [
      { kind: "ability", id: "rootwakeLash", rank: 1 },
      { kind: "talent", id: "rootlineSense", rank: 2 },
      { kind: "spell", id: "sapReturn", rank: 3 },
      { kind: "spell", id: "rootwakeRumble", rank: 5 },
    ]),
  path("duskthreadCourier", "Duskthread Courier", "stealth", "dexterity", 8,
    "Marsh couriers protect a message with feints, folded shade and quick hands.",
    "Delays stronger base precision talents; fear has normal saves and light-weapon restrictions remain.",
    "Feint/Threadcut: light one-handed weapon or bow. Folded Shade: light one-handed weapon.",
    [
      classes(["rogue", "ranger", "monk"], 4), score("dexterity"),
      { type: "alignmentAxis", axis: "lawChaos", minimum: -100, maximum: 24 },
      { type: "anyOf", requirements: [
        { type: "questCompleted", questId: "silkAgainstTheCold" },
        { type: "cityDiscovered", cityId: "shadowfen_city" },
      ] },
    ],
    [
      { kind: "ability", id: "duskthreadFeint", rank: 1 },
      { kind: "talent", id: "threadwiseHands", rank: 2 },
      { kind: "ability", id: "foldedShade", rank: 3 },
      { kind: "ability", id: "threadcut", rank: 5 },
    ]),
  path("chordsteelEnvoy", "Chordsteel Envoy", "hybrid", "charisma", 8,
    "Road envoys bind a spoken rhythm to a weapon's disciplined movement.",
    "Needs two distinct base classes and CHA; delays both base progressions and grants no extra action.",
    "Steel Cadence: melee weapon, CHA. No extra equipment permissions.",
    [
      distinctHybrid, score("charisma"),
      { type: "anyOf", requirements: [keystone, standing("roadwardens")] },
    ],
    [
      { kind: "spell", id: "chordsteelNote", rank: 1 },
      { kind: "talent", id: "temperedMeasure", rank: 2 },
      { kind: "spell", id: "measuredRefrain", rank: 3 },
      { kind: "ability", id: "steelCadence", rank: 5 },
    ]),
]);

export function getPrestigePath(id: string): PrestigePath | undefined {
  return PRESTIGE_PATHS.find((entry) => entry.id === id || entry.pathId === id);
}
