import {
  getBodyPart, getTargetableBodyParts, type BodyPart, type BodyPartId, type PhysicalDiscovery,
} from "../data/anatomy";
import {
  applyPhysicalModifier, physicalDamageTypeName,
  type DamageInteraction, type PhysicalDamageType,
} from "../data/damageTypes";
import type { Monster } from "../data/monsters";
import { captureEffectAdjustment } from "./effectRolls";
import { applyStatusEffect, getStatusEffectDef, type ActiveStatusEffect } from "./statusEffects";
import type { ResolvedEffectRoll } from "./rollResults";

export interface PhysicalHitResult {
  damage: number;
  readonly damageRoll: ResolvedEffectRoll;
  physicalType?: PhysicalDamageType;
  physicalLabel?: DamageInteraction;
  bodyPartId?: BodyPartId;
  bodyPartLabel?: string;
  message: string;
}

export interface BodyTargetChoice {
  readonly id: BodyPartId | "whole";
  readonly label: string;
  readonly description: string;
  readonly bodyPartId?: BodyPartId;
}

/** Preview public aim penalties and only empirically observed physical defenses. */
export function getBodyTargetChoices(
  monster: Monster,
  type: PhysicalDamageType,
  discoveries: readonly PhysicalDiscovery[],
): BodyTargetChoice[] {
  return [undefined, ...getTargetableBodyParts(monster)].map((part) => {
    const observed = discoveries.some((entry) =>
      entry.damageType === type && entry.bodyPartId === part?.id
    );
    const interaction = applyPhysicalModifier(1, type, monster.physicalProfile, part?.physicalProfile).interaction;
    const defense = !observed ? "Defense unknown" : interaction === "immune" ? "Immune"
      : interaction === "weak" ? "Weakness x2"
        : interaction === "resistant" ? "Resistance /2" : "Neutral";
    const effect = part?.effectId ? getStatusEffectDef(part.effectId)?.name : undefined;
    return {
      id: part?.id ?? "whole",
      label: `${part?.label ?? "Whole target"} | Aim -${part?.aimPenalty ?? 0}`,
      description: `${physicalDamageTypeName(type)}: ${defense}.`
        + (effect ? ` ${effect}, up to 2 target turns on damaging hit.` : " No limb effect."),
      bodyPartId: part?.id,
    };
  });
}

/** Reject unavailable parts before RNG, MP, HP or action-economy mutation. */
export function requireAimedBodyPart(
  monster: Monster,
  bodyPartId: BodyPartId | undefined,
  physicalType: PhysicalDamageType | undefined,
): BodyPart | undefined {
  if (bodyPartId === undefined) return undefined;
  const part = getBodyPart(monster, bodyPartId);
  if (!part || !physicalType) throw new Error("That body part cannot be targeted by this action.");
  return part;
}

/** Resolve physical damage once, retaining exact faces and the applied affinity stage. */
export function resolvePhysicalHit(
  roll: ResolvedEffectRoll,
  type: PhysicalDamageType | undefined,
  monster: Monster,
  part?: BodyPart,
): PhysicalHitResult {
  const { damage, interaction } = applyPhysicalModifier(
    roll.amount, type, monster.physicalProfile, part?.physicalProfile,
  );
  const name = type ? physicalDamageTypeName(type) : "";
  const operation = interaction === "weak" ? "weakness x2"
    : interaction === "resistant" ? "resistance /2 (floor)" : "immunity";
  const target = part ? `${monster.name} [${part.label}]` : monster.name;
  const message = !interaction ? "" : interaction === "weak"
    ? ` ${target} is weak to ${name}!`
    : interaction === "immune" ? ` ${target} is immune to ${name}!`
      : ` ${target} resists ${name}!`;
  return {
    damage,
    damageRoll: interaction
      ? captureEffectAdjustment(roll, `${part ? `${part.label}: ` : ""}${name} ${operation}`, damage)
      : roll,
    physicalType: type,
    physicalLabel: type ? interaction : undefined,
    bodyPartId: part?.id,
    bodyPartLabel: part?.label,
    message,
  };
}

/** Limb effects use the existing target-owned status clock and never add a roll or skip. */
export function applyAimedHitEffect(
  effects: ActiveStatusEffect[],
  part: BodyPart | undefined,
  damage: number,
  source: string,
): string {
  if (!part?.effectId || damage <= 0) return "";
  const result = applyStatusEffect(effects, part.effectId, source, 2);
  return result.applied ? ` ${result.message}` : "";
}
