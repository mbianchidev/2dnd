import type { ProgressionTrackProfile } from "./classProgression";
import type { Talent } from "./talents";

export const EPIC_LEVEL_CAP = 30;
export const EPIC_TRACK_ID = "epic:roadwarden" as const;
export const EPIC_ASI_LEVELS: readonly number[] = Object.freeze([22, 26, 30]);
export const EPIC_TALENTS: readonly Talent[] = Object.freeze([
  Object.freeze({
    id: "roadwardenResolve", name: "Roadwarden Resolve",
    description: "+10 maximum HP once; earned at epic rank 1.",
    levelRequired: 21, progressionScope: "track", maxHpBonus: 10,
  }),
  Object.freeze({
    id: "roadwardenFocus", name: "Roadwarden Focus",
    description: "+5 maximum MP once; earned at epic rank 5.",
    levelRequired: 25, progressionScope: "track", maxMpBonus: 5,
  }),
  Object.freeze({
    id: "roadwardenEdge", name: "Roadwarden Edge",
    description: "+2 damage; earned at epic rank 9.",
    levelRequired: 29, progressionScope: "track", damageBonus: 2,
  }),
]);

/** Ten registered ranks extend, rather than advance or impersonate, base/prestige ownership. */
export const EPIC_PROFILE: ProgressionTrackProfile = Object.freeze({
  id: EPIC_TRACK_ID, kind: "epic", label: "Epic Roadwarden",
  maxRank: 10, primaryStat: "intelligence",
  entryRequirements: Object.freeze([{ type: "totalLevel", minimum: 20 } as const]),
  hpGrowth: Object.freeze({ hitDie: 8, stat: "constitution", minimum: 1 }),
  mpGrowth: Object.freeze({ pool: "mp", base: 2, stat: "intelligence", minimum: 1 }),
  grants: Object.freeze([
    Object.freeze({ kind: "talent", id: "roadwardenResolve", rank: 1 } as const),
    Object.freeze({ kind: "talent", id: "roadwardenFocus", rank: 5 } as const),
    Object.freeze({ kind: "talent", id: "roadwardenEdge", rank: 9 } as const),
  ]),
  equipmentPermissions: Object.freeze([]),
});
