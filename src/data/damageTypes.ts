export const PhysicalDamageType = {
  Bludgeoning: "bludgeoning",
  Slashing: "slashing",
  Piercing: "piercing",
} as const;
export type PhysicalDamageType = (typeof PhysicalDamageType)[keyof typeof PhysicalDamageType];

export interface DamageProfile<T extends string> {
  readonly resistances?: readonly T[];
  readonly weaknesses?: readonly T[];
  readonly immunities?: readonly T[];
}

export type PhysicalProfile = DamageProfile<PhysicalDamageType>;
export type DamageInteraction = "" | "immune" | "weak" | "resistant";

export interface DamageProfileResult {
  damage: number;
  interaction: DamageInteraction;
}

/** Shared precedence for physical and elemental affinities. */
export function applyDamageProfile<T extends string>(
  baseDamage: number,
  damageType: T | undefined,
  profile: DamageProfile<T> | undefined,
): DamageProfileResult {
  if (!damageType || !profile) return { damage: baseDamage, interaction: "" };
  if (profile.immunities?.includes(damageType)) return { damage: 0, interaction: "immune" };
  if (profile.weaknesses?.includes(damageType)) return { damage: baseDamage * 2, interaction: "weak" };
  if (profile.resistances?.includes(damageType)) {
    return { damage: Math.floor(baseDamage / 2), interaction: "resistant" };
  }
  return { damage: baseDamage, interaction: "" };
}

/** Local affinities replace a matching whole-body affinity, never whole-body immunity. */
export function applyPhysicalModifier(
  baseDamage: number,
  damageType: PhysicalDamageType | undefined,
  profile: PhysicalProfile | undefined,
  localProfile?: PhysicalProfile,
): DamageProfileResult {
  const whole = applyDamageProfile(baseDamage, damageType, profile);
  if (whole.interaction === "immune") return whole;
  const local = applyDamageProfile(baseDamage, damageType, localProfile);
  return local.interaction ? local : whole;
}

export function isPhysicalDamageType(value: unknown): value is PhysicalDamageType {
  return Object.values(PhysicalDamageType).some((type) => type === value);
}

export function physicalDamageTypeName(type: PhysicalDamageType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}
