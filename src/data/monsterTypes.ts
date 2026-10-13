import type { DieType } from "../systems/dice";
import type { StatusEffectId } from "../systems/statusEffects";
import type { Element, ElementalProfile } from "./elements";
import type { MonsterFamilyId } from "./monsterFamilies";
import type { MonsterAnatomyId, MonsterSize } from "./anatomy";
import type { PhysicalDamageType, PhysicalProfile } from "./damageTypes";

export interface MonsterDrop {
  itemId: string;
  chance: number;
}

export interface MonsterAbility {
  name: string;
  chance: number;
  damageCount: number;
  damageDie: DieType;
  type: "damage" | "heal";
  /** Damage abilities with life drain heal by their actual damage, without another roll. */
  selfHeal?: boolean;
  element?: Element;
  /** Explicit physical component; elemental-only abilities remain outside armor resistance. */
  physicalDamageType?: PhysicalDamageType;
  statusEffect?: StatusEffectId;
}

export interface Monster {
  minimumNewGamePlusCycle?: number;
  id: string;
  name: string;
  family: MonsterFamilyId;
  /** Canonical roster sizes are explicit; compatible runtime fixtures may omit them. */
  size?: MonsterSize;
  anatomy?: MonsterAnatomyId;
  physicalProfile?: PhysicalProfile;
  /** Physical source of a basic attack, independent of defensive affinities. */
  physicalDamageType?: PhysicalDamageType;
  /** Base roster member used to validate deliberate palette/stat variants. */
  variantOf?: string;
  /** Dominant elemental identity shown by the Codex. */
  affinity?: Element;
  hp: number;
  ac: number;
  attackBonus: number;
  damageCount: number;
  damageDie: DieType;
  xpReward: number;
  goldReward: number;
  isBoss: boolean;
  color: number;
  /** Earliest player level at which this monster can enter a random pool. */
  minPlayerLevel?: number;
  /** Relative selection weight after level eligibility has been applied. */
  encounterWeight?: number;
  drops?: MonsterDrop[];
  abilities?: MonsterAbility[];
  elementalProfile?: ElementalProfile;
}
