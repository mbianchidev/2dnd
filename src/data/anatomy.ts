import { PhysicalDamageType, type PhysicalProfile } from "./damageTypes";
import type { Monster } from "./monsters";
import type { StatusEffectId } from "../systems/statusEffects";

export const MONSTER_SIZES = ["tiny", "small", "medium", "large", "huge", "gargantuan"] as const;
export type MonsterSize = (typeof MONSTER_SIZES)[number];
export type MonsterAnatomyId =
  | "humanoid" | "quadruped" | "winged" | "hydra" | "serpent"
  | "tentacled" | "arthropod" | "treant" | "elemental";
export type BodyPartId =
  | "head" | "body" | "arms" | "legs" | "wings" | "tail"
  | "tentacles" | "shell" | "claws" | "core" | "roots"
  | "headOne" | "headTwo" | "headThree" | "headFour" | "headFive";

export interface BodyPart {
  readonly id: BodyPartId;
  readonly label: string;
  readonly aimPenalty: number;
  readonly physicalProfile?: PhysicalProfile;
  readonly effectId?: StatusEffectId;
  readonly anchor: { readonly x: number; readonly y: number };
}

export interface PhysicalDiscovery {
  readonly damageType: PhysicalDamageType;
  readonly bodyPartId?: BodyPartId;
}

const { Bludgeoning, Slashing, Piercing } = PhysicalDamageType;

export const MONSTER_PHYSICAL_PROFILES = {
  skeletal: { weaknesses: [Bludgeoning], resistances: [Piercing] },
  spectral: { resistances: [Bludgeoning, Slashing, Piercing] },
  stone: { weaknesses: [Bludgeoning], resistances: [Slashing, Piercing] },
  scales: { resistances: [Slashing] },
  soft: { weaknesses: [Slashing], resistances: [Bludgeoning] },
  bark: { weaknesses: [Slashing], resistances: [Piercing] },
} as const satisfies Record<string, PhysicalProfile>;

const HEAD: BodyPart = {
  id: "head", label: "Head", aimPenalty: 3,
  physicalProfile: { weaknesses: [Piercing] },
  effectId: "confused", anchor: { x: 0.5, y: 0.2 },
};
const BODY: BodyPart = {
  id: "body", label: "Body", aimPenalty: 0, anchor: { x: 0.5, y: 0.5 },
};
const ARMS: BodyPart = {
  id: "arms", label: "Arms", aimPenalty: 2,
  physicalProfile: { weaknesses: [Slashing] },
  effectId: "weakened", anchor: { x: 0.25, y: 0.5 },
};
const LEGS: BodyPart = {
  id: "legs", label: "Legs", aimPenalty: 2,
  physicalProfile: { weaknesses: [Bludgeoning] },
  effectId: "slow", anchor: { x: 0.5, y: 0.8 },
};
const WINGS: BodyPart = {
  id: "wings", label: "Wings", aimPenalty: 2,
  physicalProfile: { weaknesses: [Slashing] },
  effectId: "prone", anchor: { x: 0.8, y: 0.35 },
};
const TAIL: BodyPart = {
  id: "tail", label: "Tail", aimPenalty: 2,
  physicalProfile: { weaknesses: [Slashing] },
  effectId: "weakened", anchor: { x: 0.85, y: 0.7 },
};
const CORE: BodyPart = {
  id: "core", label: "Core", aimPenalty: 3,
  physicalProfile: { weaknesses: [Piercing] },
  effectId: "confused", anchor: { x: 0.5, y: 0.4 },
};

export const MONSTER_ANATOMIES: Readonly<Record<MonsterAnatomyId, readonly BodyPart[]>> = {
  humanoid: [HEAD, BODY, ARMS, LEGS],
  quadruped: [HEAD, BODY, LEGS],
  winged: [HEAD, BODY, WINGS, LEGS, TAIL],
  hydra: [
    { ...HEAD, id: "headOne", label: "First head", anchor: { x: 0.15, y: 0.3 } },
    { ...HEAD, id: "headTwo", label: "Second head", anchor: { x: 0.3, y: 0.2 } },
    { ...HEAD, id: "headThree", label: "Central head", anchor: { x: 0.5, y: 0.15 } },
    { ...HEAD, id: "headFour", label: "Fourth head", anchor: { x: 0.7, y: 0.2 } },
    { ...HEAD, id: "headFive", label: "Fifth head", anchor: { x: 0.85, y: 0.3 } },
    BODY, LEGS, TAIL,
  ],
  serpent: [HEAD, BODY, TAIL],
  tentacled: [
    HEAD, BODY,
    {
      id: "tentacles", label: "Tentacles", aimPenalty: 2,
      physicalProfile: { weaknesses: [Slashing] },
      effectId: "weakened", anchor: { x: 0.25, y: 0.75 },
    },
  ],
  arthropod: [
    HEAD,
    {
      id: "shell", label: "Shell", aimPenalty: 0,
      physicalProfile: MONSTER_PHYSICAL_PROFILES.stone, anchor: { x: 0.5, y: 0.45 },
    },
    {
      ...ARMS, id: "claws", label: "Claws", anchor: { x: 0.2, y: 0.6 },
    },
    LEGS,
  ],
  treant: [
    CORE, { ...BODY, label: "Trunk" }, { ...ARMS, label: "Branches" },
    { ...LEGS, id: "roots", label: "Roots" },
  ],
  elemental: [CORE, { ...BODY, label: "Mantle" }, { ...ARMS, label: "Extensions" }],
};

/** Humanoid forms are aimable at any size; other anatomical creatures require Large+. */
export function getTargetableBodyParts(monster: Monster): readonly BodyPart[] {
  if (!monster.anatomy) return [];
  const size = MONSTER_SIZES.indexOf(monster.size ?? "medium");
  if (monster.anatomy !== "humanoid" && size < MONSTER_SIZES.indexOf("large")) return [];
  return MONSTER_ANATOMIES[monster.anatomy];
}

export function getBodyPart(monster: Monster, id: BodyPartId | undefined): BodyPart | undefined {
  return id === undefined ? undefined : getTargetableBodyParts(monster).find((part) => part.id === id);
}
