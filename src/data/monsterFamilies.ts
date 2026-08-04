import { Element } from "./elements";

export const MONSTER_FAMILY_IDS = [
  "slime",
  "raider",
  "skeletal",
  "lupine",
  "spectral",
  "colossus",
  "drake",
  "chimaera",
  "construct",
  "stalker",
  "fey",
  "flora",
  "mimic",
  "elemental",
] as const;

export type MonsterFamilyId = (typeof MONSTER_FAMILY_IDS)[number];
export type MonsterVisualForm = "normal" | "boss";
export type MonsterTextureFrame = "idle";
export type MonsterTextureKey =
  `monster-${string}-${MonsterVisualForm}-${MonsterTextureFrame}`;

export interface MonsterFamily {
  id: MonsterFamilyId;
  name: string;
  description: string;
  symbol: string;
  sharedTraits: readonly string[];
  sortOrder: number;
}

export interface MonsterPalette {
  primary: number;
  secondary: number;
  detail: number;
  outline: number;
}

export interface MonsterVisualIdentity {
  id: string;
  family: MonsterFamilyId;
  color: number;
  isBoss: boolean;
  affinity?: Element;
}

export const MONSTER_FAMILIES: readonly MonsterFamily[] = [
  {
    id: "slime",
    name: "Slime Family",
    description: "Amorphous scavengers whose bodies take on local elements.",
    symbol: "●",
    sharedTraits: ["Amorphous", "Low profile", "Element-adaptive"],
    sortOrder: 0,
  },
  {
    id: "raider",
    name: "Raider Warband",
    description: "Armed humanoids that win through numbers, tricks, and fury.",
    symbol: "⚔",
    sharedTraits: ["Weapon users", "Coordinated", "Aggressive"],
    sortOrder: 1,
  },
  {
    id: "skeletal",
    name: "Bonebound",
    description: "Animated remains held together by old vows and darker magic.",
    symbol: "☠",
    sharedTraits: ["Undead", "Bone armor", "Reanimated"],
    sortOrder: 2,
  },
  {
    id: "lupine",
    name: "Lupine Pack",
    description: "Swift four-legged hunters that pressure isolated prey.",
    symbol: "◆",
    sharedTraits: ["Pack hunters", "Pouncing", "Fast"],
    sortOrder: 3,
  },
  {
    id: "spectral",
    name: "Spectral Host",
    description: "Unquiet spirits that drain life and bend hostile elements.",
    symbol: "◇",
    sharedTraits: ["Ethereal", "Life-draining", "Unquiet"],
    sortOrder: 4,
  },
  {
    id: "colossus",
    name: "Colossal Kin",
    description: "Massive brutes whose reach and endurance define the fight.",
    symbol: "▰",
    sharedTraits: ["High endurance", "Heavy blows", "Large frame"],
    sortOrder: 5,
  },
  {
    id: "drake",
    name: "Draconic Lineage",
    description: "Winged and serpentine predators with devastating breath.",
    symbol: "▲",
    sharedTraits: ["Scaled", "Breath attacks", "Winged"],
    sortOrder: 6,
  },
  {
    id: "chimaera",
    name: "Manymaws",
    description: "Multi-headed predators that attack from several angles.",
    symbol: "♜",
    sharedTraits: ["Multiple heads", "Mixed attacks", "Relentless"],
    sortOrder: 7,
  },
  {
    id: "construct",
    name: "Construct Assembly",
    description: "Forged guardians animated by runes, frost, or living flame.",
    symbol: "⬡",
    sharedTraits: ["High armor", "Rune-driven", "Heavy frame"],
    sortOrder: 8,
  },
  {
    id: "stalker",
    name: "Crawling Stalkers",
    description: "Low-slung ambushers that strike from floors, walls, and stone.",
    symbol: "✣",
    sharedTraits: ["Ambushers", "Low silhouette", "Natural weapons"],
    sortOrder: 9,
  },
  {
    id: "fey",
    name: "Night Fey",
    description: "Small airborne terrors that lure travelers with false light.",
    symbol: "✦",
    sharedTraits: ["Airborne", "Elusive", "Magical"],
    sortOrder: 10,
  },
  {
    id: "flora",
    name: "Corrupted Flora",
    description: "Rooted horrors that crush, entangle, and spread toxic spores.",
    symbol: "♣",
    sharedTraits: ["Plantlike", "Root attacks", "Fire-vulnerable"],
    sortOrder: 11,
  },
  {
    id: "mimic",
    name: "False Treasures",
    description: "Dungeon predators that imitate valuables until prey draws near.",
    symbol: "▣",
    sharedTraits: ["Deceptive", "Armored shell", "Ambush bite"],
    sortOrder: 12,
  },
  {
    id: "elemental",
    name: "Elemental Spirits",
    description: "Living weather and raw magic condensed into hostile forms.",
    symbol: "✺",
    sharedTraits: ["Elemental body", "Affinity-driven", "Unnatural motion"],
    sortOrder: 13,
  },
] as const;

const FAMILY_BY_ID = new Map(
  MONSTER_FAMILIES.map((family) => [family.id, family]),
);

export function getMonsterFamily(
  familyId: MonsterFamilyId,
): MonsterFamily {
  return FAMILY_BY_ID.get(familyId)!;
}

export function getMonsterVisualForm(
  monster: Pick<MonsterVisualIdentity, "isBoss">,
): MonsterVisualForm {
  return monster.isBoss ? "boss" : "normal";
}

export function getMonsterTextureKey(
  monster: Pick<MonsterVisualIdentity, "id" | "isBoss">,
  frame: MonsterTextureFrame = "idle",
): MonsterTextureKey {
  return `monster-${monster.id}-${getMonsterVisualForm(monster)}-${frame}`;
}

function clampColorChannel(channel: number): number {
  return Math.max(0, Math.min(255, Math.round(channel)));
}

function shiftColor(color: number, amount: number): number {
  const red = clampColorChannel(((color >> 16) & 0xff) + amount);
  const green = clampColorChannel(((color >> 8) & 0xff) + amount);
  const blue = clampColorChannel((color & 0xff) + amount);
  return (red << 16) | (green << 8) | blue;
}

export function getMonsterPalette(
  monster: MonsterVisualIdentity,
): MonsterPalette {
  const affinityDetail: Partial<Record<Element, number>> = {
    [Element.Fire]: 0xfff176,
    [Element.Ice]: 0xe1f5fe,
    [Element.Lightning]: 0xffeb3b,
    [Element.Poison]: 0xce93d8,
    [Element.Necrotic]: 0xb39ddb,
    [Element.Radiant]: 0xffffff,
    [Element.Thunder]: 0xb0bec5,
    [Element.Force]: 0x80cbc4,
    [Element.Psychic]: 0xf48fb1,
  };
  return {
    primary: monster.color,
    secondary: shiftColor(monster.color, monster.isBoss ? 52 : 34),
    detail: monster.affinity
      ? (affinityDetail[monster.affinity] ?? 0xffffff)
      : 0xffd166,
    outline: shiftColor(monster.color, -72),
  };
}
