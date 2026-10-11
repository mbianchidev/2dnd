import { Element } from "./elements";
import type { Ability } from "./abilities";
import type { Spell } from "./spells";
import type { Talent } from "./talents";

export const PRESTIGE_ABILITIES: readonly Ability[] = [
  {
    id: "roadglassBrace", name: "Roadglass Brace",
    description: "Raise a shield: +2 AC for 2 turns. Bonus action; shield required.",
    progressionScope: "track", equipmentRequirement: "shield",
    mpCost: 4, levelRequired: 1, damageCount: 0, damageDie: 0,
    type: "buff", statKey: "strength", targetType: "self",
    bonusAction: true, selfEffect: "sneakStance",
  },
  {
    id: "waylineStrike", name: "Wayline Strike",
    physicalDamageType: "weapon",
    description: "A measured physical strike. Melee weapon required.",
    progressionScope: "track", equipmentRequirement: "meleeWeapon",
    mpCost: 6, levelRequired: 3, damageCount: 2, damageDie: 8,
    type: "damage", statKey: "strength", targetType: "single_enemy", range: "melee",
  },
  {
    id: "roadglassCrash", name: "Roadglass Crash",
    description: "Release a thunderous shield-line blow. Melee weapon required.",
    progressionScope: "track", equipmentRequirement: "meleeWeapon",
    mpCost: 9, levelRequired: 5, damageCount: 3, damageDie: 8,
    type: "damage", statKey: "strength", targetType: "single_enemy", range: "melee",
    element: Element.Thunder,
  },
  {
    id: "rootwakeLash", name: "Rootwake Lash",
    description: "A poisonous vine slows a foe on hit; normal saves still apply.",
    progressionScope: "track",
    mpCost: 5, levelRequired: 1, damageCount: 2, damageDie: 6,
    type: "damage", statKey: "wisdom", targetType: "single_enemy", range: "ranged",
    element: Element.Poison, targetEffect: "slow",
  },
  {
    id: "duskthreadFeint", name: "Duskthread Feint",
    description: "An unsettling feint frightens on hit. Light weapon or bow required.",
    progressionScope: "track", equipmentRequirement: "lightWeaponOrBow",
    mpCost: 5, levelRequired: 1, damageCount: 1, damageDie: 6,
    type: "damage", statKey: "dexterity", targetType: "single_enemy", range: "ranged",
    element: Element.Psychic, targetEffect: "frightened",
  },
  {
    id: "foldedShade", name: "Folded Shade",
    description: "+2 AC for 2 turns. Bonus action; light one-handed weapon required.",
    progressionScope: "track", equipmentRequirement: "lightWeapon",
    mpCost: 4, levelRequired: 3, damageCount: 0, damageDie: 0,
    type: "buff", statKey: "dexterity", targetType: "self",
    bonusAction: true, selfEffect: "sneakStance",
  },
  {
    id: "threadcut", name: "Threadcut",
    physicalDamageType: "piercing",
    description: "A precise physical strike. Light weapon or bow required.",
    progressionScope: "track", equipmentRequirement: "lightWeaponOrBow",
    mpCost: 9, levelRequired: 5, damageCount: 4, damageDie: 6,
    type: "damage", statKey: "dexterity", targetType: "single_enemy", range: "ranged",
  },
  {
    id: "steelCadence", name: "Steel Cadence",
    physicalDamageType: "weapon",
    description: "Rhythm infuses a physical strike using CHA. Melee weapon required.",
    progressionScope: "track", equipmentRequirement: "meleeWeapon",
    mpCost: 9, levelRequired: 5, damageCount: 3, damageDie: 8,
    type: "damage", statKey: "charisma", targetType: "single_enemy", range: "melee",
  },
];

export const PRESTIGE_SPELLS: readonly Spell[] = [
  {
    id: "prismNeedle", name: "Prism Needle",
    description: "Send a narrow strand of force toward one foe.",
    progressionScope: "track",
    mpCost: 5, levelRequired: 1, damageCount: 2, damageDie: 6,
    type: "damage", targetType: "single_enemy", element: Element.Force,
  },
  {
    id: "prismFan", name: "Prism Fan",
    description: "Scatter lightning across the enemy front row.",
    progressionScope: "track",
    mpCost: 7, levelRequired: 3, damageCount: 3, damageDie: 6,
    type: "damage", targetType: "front_row_enemies", element: Element.Lightning,
  },
  {
    id: "prismVeil", name: "Prism Veil",
    description: "Gain Haste for 3 turns; no extra action is granted.",
    progressionScope: "track",
    mpCost: 8, levelRequired: 5, damageCount: 0, damageDie: 0,
    type: "buff", targetType: "self", targetEffect: "haste",
  },
  {
    id: "hearthMend", name: "Hearth Mend",
    description: "Restore a conscious ally with shelter-warm light.",
    progressionScope: "track",
    mpCost: 4, levelRequired: 1, damageCount: 2, damageDie: 6,
    type: "heal", targetType: "single_ally",
  },
  {
    id: "hearthLantern", name: "Hearth Lantern",
    description: "Radiant shelter-light washes over every foe.",
    progressionScope: "track",
    mpCost: 6, levelRequired: 3, damageCount: 2, damageDie: 6,
    type: "damage", targetType: "all_enemies", element: Element.Radiant,
  },
  {
    id: "commonHearth", name: "Common Hearth",
    description: "Restore the conscious party; does not revive or cure.",
    progressionScope: "track",
    mpCost: 9, levelRequired: 5, damageCount: 3, damageDie: 6,
    type: "heal", targetType: "all_party",
  },
  {
    id: "sapReturn", name: "Sap Return",
    description: "Return borrowed vitality to a conscious ally.",
    progressionScope: "track",
    mpCost: 5, levelRequired: 3, damageCount: 2, damageDie: 6,
    type: "heal", targetType: "single_ally",
  },
  {
    id: "rootwakeRumble", name: "Rootwake Rumble",
    description: "Thunder rises beneath the enemy front row.",
    progressionScope: "track",
    mpCost: 9, levelRequired: 5, damageCount: 4, damageDie: 6,
    type: "damage", targetType: "front_row_enemies", element: Element.Thunder,
  },
  {
    id: "chordsteelNote", name: "Chordsteel Note",
    description: "A focused note carries thunder toward one foe.",
    progressionScope: "track",
    mpCost: 5, levelRequired: 1, damageCount: 2, damageDie: 6,
    type: "damage", targetType: "single_enemy", element: Element.Thunder,
  },
  {
    id: "measuredRefrain", name: "Measured Refrain",
    description: "Gain Inspired for 3 turns; one normal action is used.",
    progressionScope: "track",
    mpCost: 6, levelRequired: 3, damageCount: 0, damageDie: 0,
    type: "buff", targetType: "self", targetEffect: "inspired",
  },
];

export const PRESTIGE_TALENTS: readonly Talent[] = [
  {
    id: "waylineStudy", name: "Wayline Study", description: "+1 trap detection",
    progressionScope: "track", levelRequired: 2, trapDetectionBonus: 1,
  },
  {
    id: "reserveLattice", name: "Reserve Lattice", description: "+3 max MP once",
    progressionScope: "track", levelRequired: 2, maxMpBonus: 3,
  },
  {
    id: "warmthKeeper", name: "Warmth Keeper", description: "+5 max HP once",
    progressionScope: "track", levelRequired: 2, maxHpBonus: 5,
  },
  {
    id: "rootlineSense", name: "Rootline Sense", description: "+1 trap detection and disarm",
    progressionScope: "track", levelRequired: 2, trapDetectionBonus: 1, trapDisarmBonus: 1,
  },
  {
    id: "threadwiseHands", name: "Threadwise Hands", description: "+2 trap disarm",
    progressionScope: "track", levelRequired: 2, trapDisarmBonus: 2,
  },
  {
    id: "temperedMeasure", name: "Tempered Measure", description: "+2 max HP and MP once",
    progressionScope: "track", levelRequired: 2, maxHpBonus: 2, maxMpBonus: 2,
  },
];
