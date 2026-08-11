import { getItem, type Item, type WeaponSpriteType } from "../data/items";
import { Element } from "../data/elements";
import {
  getActiveWeaponSprite,
  getPlayerClass,
  type PlayerClass,
} from "./classes";
import type { PlayerState } from "./player";

export type HeroBodyBuild = "light" | "standard" | "broad";
export type HeroFacing = "front" | "back" | "side";
export type HeroPose = "standard" | "mounted";
export type HeroEquipmentVisualSlot =
  | "back"
  | "body"
  | "mainHand"
  | "offHand"
  | "shield";
export type HeroEquipmentVisualFamily =
  | PlayerClass["clothingStyle"]
  | WeaponSpriteType
  | "cloak"
  | "mail"
  | "plate"
  | "pelt"
  | "armor"
  | "woodenShield"
  | "metalShield"
  | "towerShield"
  | "runicShield"
  | "crystalShield"
  | "volcanicShield";

export interface HeroAppearanceVisual {
  readonly skinColor: number;
  readonly hairStyle: number;
  readonly hairColor: number;
}

export interface HeroEquipmentVisualLayer {
  readonly slot: HeroEquipmentVisualSlot;
  readonly order: number;
  readonly itemId: string;
  readonly itemName: string;
  readonly category: "weapon" | "armor" | "shield";
  readonly family: HeroEquipmentVisualFamily;
  readonly primaryColor: number;
  readonly accentColor: number;
  readonly fallbackUsed: boolean;
}

export interface HeroVisualDescriptor {
  readonly version: 1;
  readonly classId: string;
  readonly classLabel: string;
  readonly clothingStyle: PlayerClass["clothingStyle"];
  readonly bodyBuild: HeroBodyBuild;
  readonly bodyColor: number;
  readonly legColor: number;
  readonly appearance: HeroAppearanceVisual;
  readonly equipmentLayers: readonly HeroEquipmentVisualLayer[];
}

export interface HeroVisualSource {
  readonly appearanceId: string;
  readonly customAppearance?: {
    readonly skinColor: number;
    readonly hairStyle: number;
    readonly hairColor: number;
  };
  readonly equippedWeapon: Item | null;
  readonly equippedOffHand: Item | null;
  readonly equippedArmor: Item | null;
  readonly equippedShield: Item | null;
}

export const HERO_VISUAL_FIXTURE_IDS = [
  "knightLight",
  "wizardDeep",
  "barbarianTan",
  "bardBlue",
] as const;

export type HeroVisualFixtureId = (typeof HERO_VISUAL_FIXTURE_IDS)[number];

export function isHeroVisualFixtureId(
  value: string,
): value is HeroVisualFixtureId {
  return (HERO_VISUAL_FIXTURE_IDS as readonly string[]).includes(value);
}

export const HERO_VISUAL_LOADOUT_IDS = [
  "unarmored",
  "plateShield",
  "robes",
  "dualWield",
  "lateGame",
] as const;

export type HeroVisualLoadoutId = (typeof HERO_VISUAL_LOADOUT_IDS)[number];

export function isHeroVisualLoadoutId(
  value: string,
): value is HeroVisualLoadoutId {
  return (HERO_VISUAL_LOADOUT_IDS as readonly string[]).includes(value);
}

const LAYER_ORDER: Record<HeroEquipmentVisualSlot, number> = {
  back: 10,
  body: 30,
  mainHand: 70,
  offHand: 71,
  shield: 72,
};

const ELEMENT_COLORS: Partial<Record<NonNullable<Item["element"]>, number>> = {
  [Element.Fire]: 0xff7043,
  [Element.Ice]: 0x90caf9,
  [Element.Lightning]: 0x64b5f6,
  [Element.Poison]: 0x8bc34a,
  [Element.Necrotic]: 0x7e57c2,
  [Element.Radiant]: 0xffd54f,
  [Element.Thunder]: 0x9575cd,
  [Element.Force]: 0x4dd0e1,
  [Element.Psychic]: 0xec407a,
};

const ITEM_PALETTE = [
  0x78909c,
  0x8d6e63,
  0x5c6bc0,
  0x00897b,
  0x7cb342,
  0xef6c00,
  0x8e24aa,
] as const;

function clampColor(value: number, fallback: number): number {
  return Number.isInteger(value)
    ? Math.max(0, Math.min(0xffffff, value))
    : fallback;
}

function clampHairStyle(value: number): number {
  return Number.isInteger(value) ? Math.max(0, Math.min(3, value)) : 0;
}

function shade(color: number, amount: number): number {
  const red = Math.max(0, Math.min(255, ((color >> 16) & 0xff) + amount));
  const green = Math.max(0, Math.min(255, ((color >> 8) & 0xff) + amount));
  const blue = Math.max(0, Math.min(255, (color & 0xff) + amount));
  return (red << 16) | (green << 8) | blue;
}

function stableItemColor(item: Item): number {
  if (item.element) {
    return ELEMENT_COLORS[item.element] ?? 0x90a4ae;
  }
  const tags = new Set(item.tags ?? []);
  if (tags.has("frost")) return 0x90caf9;
  if (tags.has("storm") || tags.has("conductive")) return 0x64b5f6;
  if (tags.has("fire") || tags.has("volcanic")) return 0xff7043;
  if (tags.has("shadow") || tags.has("abyssal")) return 0x5c4b8a;
  if (tags.has("swamp") || tags.has("vine")) return 0x66bb6a;
  if (tags.has("radiant")) return 0xffd54f;
  if (tags.has("wood")) return 0x8d6e63;
  if (tags.has("rune") || tags.has("ward")) return 0x9fa8da;
  let hash = 0;
  for (const character of item.id) {
    hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  }
  return ITEM_PALETTE[Math.abs(hash) % ITEM_PALETTE.length]!;
}

function resolveBodyBuild(playerClass: PlayerClass): HeroBodyBuild {
  if (
    playerClass.clothingStyle === "heavy"
    || playerClass.clothingStyle === "bare"
  ) {
    return "broad";
  }
  if (
    playerClass.clothingStyle === "leather"
    || playerClass.clothingStyle === "wrap"
    || playerClass.clothingStyle === "performer"
  ) {
    return "light";
  }
  return "standard";
}

function resolveArmorFamily(item: Item): {
  slot: "back" | "body";
  family: HeroEquipmentVisualFamily;
  fallbackUsed: boolean;
} {
  const identity = `${item.id} ${item.name} ${(item.tags ?? []).join(" ")}`
    .toLowerCase();
  if (identity.includes("cloak") || identity.includes("mantle")) {
    return { slot: "back", family: "cloak", fallbackUsed: false };
  }
  if (identity.includes("pelt")) {
    return { slot: "back", family: "pelt", fallbackUsed: false };
  }
  if (identity.includes("plate")) {
    return { slot: "body", family: "plate", fallbackUsed: false };
  }
  if (identity.includes("mail") || identity.includes("chain")) {
    return { slot: "body", family: "mail", fallbackUsed: false };
  }
  if (identity.includes("leather")) {
    return { slot: "body", family: "leather", fallbackUsed: false };
  }
  return { slot: "body", family: "armor", fallbackUsed: true };
}

function resolveShieldFamily(item: Item): {
  family: HeroEquipmentVisualFamily;
  fallbackUsed: boolean;
} {
  const identity = `${item.id} ${item.name} ${(item.tags ?? []).join(" ")}`
    .toLowerCase();
  if (identity.includes("tower")) {
    return { family: "towerShield", fallbackUsed: false };
  }
  if (identity.includes("runic") || identity.includes("rune")) {
    return { family: "runicShield", fallbackUsed: false };
  }
  if (identity.includes("glacial") || identity.includes("crystal")) {
    return { family: "crystalShield", fallbackUsed: false };
  }
  if (identity.includes("volcanic") || identity.includes("basalt")) {
    return { family: "volcanicShield", fallbackUsed: false };
  }
  if (identity.includes("wood")) {
    return { family: "woodenShield", fallbackUsed: false };
  }
  if (
    identity.includes("iron")
    || identity.includes("guardian")
    || identity.includes("aegis")
  ) {
    return { family: "metalShield", fallbackUsed: false };
  }
  return { family: "metalShield", fallbackUsed: true };
}

function createWeaponLayer(
  item: Item,
  slot: "mainHand" | "offHand",
  classId: string,
): HeroEquipmentVisualLayer {
  const fallbackUsed = item.weaponSprite === undefined;
  const family = item.weaponSprite
    ?? getActiveWeaponSprite(classId, item);
  const primaryColor = stableItemColor(item);
  return {
    slot,
    order: LAYER_ORDER[slot],
    itemId: item.id,
    itemName: item.name,
    category: "weapon",
    family,
    primaryColor,
    accentColor: shade(primaryColor, 56),
    fallbackUsed,
  };
}

function createArmorLayer(item: Item): HeroEquipmentVisualLayer {
  const resolved = resolveArmorFamily(item);
  const primaryColor = stableItemColor(item);
  return {
    slot: resolved.slot,
    order: LAYER_ORDER[resolved.slot],
    itemId: item.id,
    itemName: item.name,
    category: "armor",
    family: resolved.family,
    primaryColor,
    accentColor: shade(primaryColor, 48),
    fallbackUsed: resolved.fallbackUsed,
  };
}

function createShieldLayer(item: Item): HeroEquipmentVisualLayer {
  const resolved = resolveShieldFamily(item);
  const primaryColor = stableItemColor(item);
  return {
    slot: "shield",
    order: LAYER_ORDER.shield,
    itemId: item.id,
    itemName: item.name,
    category: "shield",
    family: resolved.family,
    primaryColor,
    accentColor: shade(primaryColor, 64),
    fallbackUsed: resolved.fallbackUsed,
  };
}

export function resolveHeroVisualDescriptor(
  source: HeroVisualSource | PlayerState,
): HeroVisualDescriptor {
  const playerClass = getPlayerClass(source.appearanceId);
  const customAppearance = source.customAppearance;
  const equipmentLayers: HeroEquipmentVisualLayer[] = [];
  if (source.equippedArmor) {
    equipmentLayers.push(createArmorLayer(source.equippedArmor));
  }
  if (source.equippedWeapon) {
    equipmentLayers.push(createWeaponLayer(
      source.equippedWeapon,
      "mainHand",
      playerClass.id,
    ));
  }
  if (source.equippedOffHand && !source.equippedWeapon?.twoHanded) {
    equipmentLayers.push(createWeaponLayer(
      source.equippedOffHand,
      "offHand",
      playerClass.id,
    ));
  } else if (source.equippedShield && !source.equippedWeapon?.twoHanded) {
    equipmentLayers.push(createShieldLayer(source.equippedShield));
  }
  equipmentLayers.sort((left, right) => left.order - right.order);

  return {
    version: 1,
    classId: playerClass.id,
    classLabel: playerClass.label,
    clothingStyle: playerClass.clothingStyle,
    bodyBuild: resolveBodyBuild(playerClass),
    bodyColor: clampColor(playerClass.bodyColor, 0x3f51b5),
    legColor: clampColor(playerClass.legColor, 0x1a237e),
    appearance: {
      skinColor: clampColor(
        customAppearance?.skinColor ?? playerClass.skinColor,
        playerClass.skinColor,
      ),
      hairStyle: clampHairStyle(customAppearance?.hairStyle ?? 0),
      hairColor: clampColor(
        customAppearance?.hairColor ?? shade(playerClass.skinColor, -80),
        shade(playerClass.skinColor, -80),
      ),
    },
    equipmentLayers,
  };
}

function encodeKeyPart(value: string): string {
  return encodeURIComponent(value).split("%").join("_");
}

function colorKey(color: number): string {
  return color.toString(16).padStart(6, "0");
}

export function getHeroVisualTextureKey(
  descriptor: HeroVisualDescriptor,
  facing: HeroFacing,
  pose: HeroPose = "standard",
  highContrast = false,
): string {
  const appearance = descriptor.appearance;
  const layerKey = descriptor.equipmentLayers.map((layer) => [
    layer.slot,
    layer.itemId,
    layer.family,
    colorKey(layer.primaryColor),
    colorKey(layer.accentColor),
    layer.fallbackUsed ? "fallback" : "dedicated",
  ].map(encodeKeyPart).join("~")).join("|");
  return [
    "heroVisual.v1",
    facing,
    pose,
    highContrast ? "contrast" : "normal",
    encodeKeyPart(descriptor.classId),
    descriptor.bodyBuild,
    descriptor.clothingStyle,
    colorKey(descriptor.bodyColor),
    colorKey(descriptor.legColor),
    colorKey(appearance.skinColor),
    String(appearance.hairStyle),
    colorKey(appearance.hairColor),
    layerKey,
  ].join(":");
}

function requiredItem(itemId: string): Item {
  const item = getItem(itemId);
  if (!item) {
    throw new Error(`[hero-visual] Missing debug fixture item: ${itemId}`);
  }
  return item;
}

export function createDebugHeroVisualDescriptor(
  fixtureId: HeroVisualFixtureId,
  loadoutId: HeroVisualLoadoutId,
): HeroVisualDescriptor {
  const fixtures: Record<HeroVisualFixtureId, {
    appearanceId: string;
    skinColor: number;
    hairStyle: number;
    hairColor: number;
  }> = {
    knightLight: {
      appearanceId: "knight",
      skinColor: 0xffccbc,
      hairStyle: 1,
      hairColor: 0x3e2723,
    },
    wizardDeep: {
      appearanceId: "wizard",
      skinColor: 0x5d4037,
      hairStyle: 3,
      hairColor: 0xeeeeee,
    },
    barbarianTan: {
      appearanceId: "barbarian",
      skinColor: 0xc68642,
      hairStyle: 2,
      hairColor: 0xb71c1c,
    },
    bardBlue: {
      appearanceId: "bard",
      skinColor: 0xd7a97c,
      hairStyle: 3,
      hairColor: 0x1565c0,
    },
  };
  const loadouts: Record<HeroVisualLoadoutId, {
    weapon: string;
    offHand?: string;
    armor?: string;
    shield?: string;
  }> = {
    unarmored: { weapon: "startDagger" },
    plateShield: {
      weapon: "longSword",
      armor: "plateArmor",
      shield: "towerShield",
    },
    robes: {
      weapon: "elderwoodFocus",
      armor: "shadowCloak",
    },
    dualWield: {
      weapon: "startDagger",
      offHand: "frostfang",
      armor: "leatherArmor",
    },
    lateGame: {
      weapon: "dawnforgedBlade",
      armor: "frostWardMail",
      shield: "runicAegis",
    },
  };
  const fixture = fixtures[fixtureId];
  const loadout = loadouts[loadoutId];
  return resolveHeroVisualDescriptor({
    appearanceId: fixture.appearanceId,
    customAppearance: {
      skinColor: fixture.skinColor,
      hairStyle: fixture.hairStyle,
      hairColor: fixture.hairColor,
    },
    equippedWeapon: requiredItem(loadout.weapon),
    equippedOffHand: loadout.offHand ? requiredItem(loadout.offHand) : null,
    equippedArmor: loadout.armor ? requiredItem(loadout.armor) : null,
    equippedShield: loadout.shield ? requiredItem(loadout.shield) : null,
  });
}

export function describeHeroVisual(
  descriptor: HeroVisualDescriptor,
): string {
  const layers = descriptor.equipmentLayers
    .map((layer) =>
      `${layer.slot}=${layer.itemId}/${layer.family}`
      + `${layer.fallbackUsed ? "/fallback" : ""}`
    )
    .join(",");
  return `${descriptor.classId}/${descriptor.bodyBuild}`
    + ` skin=${colorKey(descriptor.appearance.skinColor)}`
    + ` hair=${descriptor.appearance.hairStyle}:${colorKey(descriptor.appearance.hairColor)}`
    + ` layers=[${layers}]`;
}
