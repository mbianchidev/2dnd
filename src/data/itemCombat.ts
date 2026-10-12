import { PhysicalDamageType, physicalDamageTypeName } from "./damageTypes";
import type { PhysicalProfile } from "./damageTypes";
import { getItem, type Item } from "./items";

/** Old canonical copies retain their exact metadata; resolve new weapon typing at use time. */
export function getWeaponPhysicalDamageType(weapon: Item | null | undefined): PhysicalDamageType {
  const canonical = weapon ? getItem(weapon.id) : undefined;
  const explicit = weapon?.physicalDamageType ?? canonical?.physicalDamageType;
  if (explicit) return explicit;
  switch (weapon?.weaponSprite) {
    case "sword":
    case "axe": return PhysicalDamageType.Slashing;
    case "bow":
    case "dagger": return PhysicalDamageType.Piercing;
    default: return PhysicalDamageType.Bludgeoning;
  }
}

export function getItemDescription(item: Item): string {
  if (item.type === "weapon") {
    return `${item.description} | ${physicalDamageTypeName(getWeaponPhysicalDamageType(item))}`;
  }
  if (item.type === "armor") {
    const resistances = getArmorPhysicalProfile(item)?.resistances ?? [];
    return `${item.description} | Resists: ${resistances.length > 0
      ? resistances.map(physicalDamageTypeName).join(", ") : "none"}`;
  }
  return item.description;
}

/** Resolve old armor copies at use time without replacing their exact owned metadata. */
export function getArmorPhysicalProfile(armor: Item | null | undefined): PhysicalProfile | undefined {
  if (armor?.type !== "armor") return undefined;
  const resistances = armor.physicalResistances ?? getItem(armor.id)?.physicalResistances;
  return resistances === undefined ? undefined : { resistances };
}
