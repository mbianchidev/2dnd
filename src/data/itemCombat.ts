import { PhysicalDamageType, physicalDamageTypeName } from "./damageTypes";
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
  return item.type === "weapon"
    ? `${item.description} | ${physicalDamageTypeName(getWeaponPhysicalDamageType(item))}`
    : item.description;
}
