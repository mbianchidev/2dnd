import type { CompanionId } from "../data/companions";
import type { StatusEffectId } from "./statusEffects";
import type { PlayerStats } from "./player";

export type GambitComparison = "<" | "<=" | "=" | ">=" | ">";

export type GambitSubjectSelector =
  | { kind: "self" }
  | { kind: "hero" }
  | { kind: "anyPartyMember" }
  | { kind: "companion"; companionId: CompanionId }
  | { kind: "anyEnemy" };

export type GambitCondition =
  | {
      kind: "resource";
      resource: "hp" | "mp";
      scale: "absolute" | "percent";
      comparison: GambitComparison;
      value: number;
    }
  | {
      kind: "status";
      statusId: StatusEffectId;
      present: boolean;
    }
  | {
      kind: "state";
      state: "alive" | "knockedOut";
    }
  | {
      kind: "stat";
      stat: keyof PlayerStats;
      comparison: GambitComparison;
      value: number;
    };

export type GambitAction =
  | { kind: "attack" }
  | { kind: "defend" }
  | { kind: "spell"; spellId: string }
  | { kind: "ability"; abilityId: string }
  | { kind: "item"; itemId: string };

export type GambitTargetSelector =
  | { kind: "matchedSubject" }
  | { kind: "self" }
  | { kind: "hero" }
  | { kind: "companion"; companionId: CompanionId }
  | { kind: "lowestHpAlly" }
  | { kind: "highestHpAlly" }
  | { kind: "lowestHpEnemy" }
  | { kind: "highestHpEnemy" }
  | { kind: "anyEnemy" }
  | { kind: "automatic" };

export interface GambitRule {
  id: string;
  rank: number;
  enabled: boolean;
  subject: GambitSubjectSelector;
  condition: GambitCondition;
  action: GambitAction;
  target: GambitTargetSelector;
}
