/**
 * Monster definitions: random encounters and fixed bosses.
 */

import type { DieType } from "../systems/dice";
import { Element } from "./elements";
import type { ElementalProfile } from "./elements";
import type { StatusEffectId } from "../systems/statusEffects";
import type { MonsterFamilyId } from "./monsterFamilies";
import {
  FROST_SLIME,
  GOBLIN_SHAMAN,
  ICE_GOLEM,
  ORC_BERSERKER,
  RUNIC_MIMIC,
  TOXIC_SLIME,
} from "./monsterVariants";
import {
  CANYON_NIGHT_MONSTERS,
  FOREST_NIGHT_MONSTERS,
  getNightMonsterPool,
  NIGHT_MONSTERS,
  SWAMP_NIGHT_MONSTERS,
  TUNDRA_NIGHT_MONSTERS,
} from "./nightMonsters";
import {
  KRAKEN,
  SEA_DAY_MONSTER_DEFINITIONS,
  SEA_NIGHT_MONSTER_DEFINITIONS,
} from "./seaMonsters";

export {
  CANYON_NIGHT_MONSTERS,
  FOREST_NIGHT_MONSTERS,
  NIGHT_MONSTERS,
  SWAMP_NIGHT_MONSTERS,
  TUNDRA_NIGHT_MONSTERS,
} from "./nightMonsters";
export {
  KRAKEN,
  SEA_DAY_MONSTER_DEFINITIONS,
  SEA_NIGHT_MONSTER_DEFINITIONS,
} from "./seaMonsters";

export interface MonsterDrop {
  itemId: string;
  chance: number; // 0–1 probability
}

export interface MonsterAbility {
  name: string;
  chance: number;       // 0–1 probability of using instead of basic attack
  damageCount: number;
  damageDie: DieType;
  type: "damage" | "heal";
  /** If true AND type is "damage", the monster also heals for the damage dealt. */
  selfHeal?: boolean;
  /** Elemental type of this ability's damage. */
  element?: Element;
  /** Status effect applied when this ability deals damage. */
  statusEffect?: StatusEffectId;
}

export interface Monster {
  id: string;
  name: string;
  family: MonsterFamilyId;
  /** Base roster member used to validate deliberate palette/stat variants. */
  variantOf?: string;
  /** Dominant elemental identity shown by the Codex. */
  affinity?: Element;
  hp: number;
  ac: number; // armor class
  attackBonus: number;
  damageCount: number;
  damageDie: DieType;
  xpReward: number;
  goldReward: number;
  isBoss: boolean;
  color: number; // display color in battle
  /** Earliest player level at which this monster can enter a random pool. */
  minPlayerLevel?: number;
  /** Relative selection weight after level eligibility has been applied. */
  encounterWeight?: number;
  drops?: MonsterDrop[];
  abilities?: MonsterAbility[];
  /** Elemental resistances, weaknesses, and immunities. */
  elementalProfile?: ElementalProfile;
}

export const MONSTERS: Monster[] = [
  // --- Random encounter monsters (ordered by difficulty) ---
  {
    id: "slime",
    name: "Slime",
    family: "slime",
    hp: 8,
    ac: 8,
    attackBonus: 1,
    damageCount: 1,
    damageDie: 4,
    xpReward: 25,
    goldReward: 5,
    isBoss: false,
    color: 0x44cc44,
    drops: [{ itemId: "potion", chance: 0.15 }, { itemId: "antidote", chance: 0.1 }],
    abilities: [
      { name: "Acid Spit", chance: 0.2, damageCount: 1, damageDie: 4, type: "damage", element: Element.Poison, statusEffect: "poison" },
    ],
  },
  TOXIC_SLIME,
  {
    id: "goblin",
    name: "Goblin",
    family: "raider",
    hp: 15,
    ac: 12,
    attackBonus: 3,
    damageCount: 1,
    damageDie: 6,
    xpReward: 50,
    goldReward: 10,
    isBoss: false,
    color: 0x88aa44,
    drops: [{ itemId: "potion", chance: 0.2 }, { itemId: "ether", chance: 0.1 }, { itemId: "antidote", chance: 0.08 }],
  },
  GOBLIN_SHAMAN,
  {
    id: "skeleton",
    name: "Skeleton",
    family: "skeletal",
    hp: 22,
    ac: 13,
    attackBonus: 4,
    damageCount: 1,
    damageDie: 8,
    xpReward: 75,
    goldReward: 15,
    isBoss: false,
    color: 0xcccccc,
    drops: [{ itemId: "ether", chance: 0.15 }],
    abilities: [
      { name: "Bone Throw", chance: 0.25, damageCount: 2, damageDie: 4, type: "damage" },
    ],
    elementalProfile: {
      weaknesses: [Element.Radiant],
      resistances: [Element.Necrotic, Element.Poison],
    },
  },
  {
    id: "wolf",
    name: "Dire Wolf",
    family: "lupine",
    hp: 30,
    ac: 13,
    attackBonus: 5,
    damageCount: 2,
    damageDie: 6,
    xpReward: 100,
    goldReward: 12,
    isBoss: false,
    color: 0x888888,
    drops: [{ itemId: "potion", chance: 0.25 }],
    abilities: [
      { name: "Pounce", chance: 0.30, damageCount: 3, damageDie: 6, type: "damage", statusEffect: "prone" },
    ],
  },
  {
    id: "orc",
    name: "Orc Warrior",
    family: "raider",
    hp: 42,
    ac: 14,
    attackBonus: 6,
    damageCount: 1,
    damageDie: 12,
    xpReward: 150,
    goldReward: 25,
    isBoss: false,
    color: 0x669944,
    drops: [{ itemId: "potion", chance: 0.2 }, { itemId: "shortSword", chance: 0.05 }],
    abilities: [
      { name: "Cleave", chance: 0.35, damageCount: 2, damageDie: 10, type: "damage" },
    ],
  },
  ORC_BERSERKER,
  {
    id: "wraith",
    name: "Wraith",
    family: "spectral",
    affinity: Element.Necrotic,
    hp: 55,
    ac: 15,
    attackBonus: 6,
    damageCount: 2,
    damageDie: 8,
    xpReward: 200,
    goldReward: 30,
    isBoss: false,
    color: 0x554488,
    drops: [{ itemId: "ether", chance: 0.25 }, { itemId: "greaterPotion", chance: 0.1 }],
    abilities: [
      { name: "Life Drain", chance: 0.35, damageCount: 2, damageDie: 6, type: "damage", selfHeal: true, element: Element.Necrotic },
      { name: "Necrotic Bolt", chance: 0.25, damageCount: 3, damageDie: 6, type: "damage", element: Element.Necrotic, statusEffect: "frightened" },
    ],
    elementalProfile: {
      weaknesses: [Element.Radiant],
      resistances: [Element.Necrotic],
      immunities: [Element.Poison],
    },
  },
  // --- Fixed boss encounters ---
  {
    id: "troll",
    name: "Cave Troll",
    family: "colossus",
    hp: 84,
    ac: 15,
    attackBonus: 7,
    damageCount: 2,
    damageDie: 10,
    xpReward: 500,
    goldReward: 100,
    isBoss: true,
    color: 0x447744,
    drops: [{ itemId: "greaterPotion", chance: 0.5 }, { itemId: "chainMail", chance: 0.25 }],
    abilities: [
      { name: "Regenerate", chance: 0.25, damageCount: 3, damageDie: 8, type: "heal" },
      { name: "Rock Slam", chance: 0.35, damageCount: 3, damageDie: 10, type: "damage" },
    ],
    elementalProfile: {
      weaknesses: [Element.Fire],
    },
  },
  {
    id: "dragon",
    name: "Young Red Dragon",
    family: "drake",
    affinity: Element.Fire,
    hp: 178,
    ac: 18,
    attackBonus: 10,
    damageCount: 4,
    damageDie: 10,
    xpReward: 2000,
    goldReward: 500,
    isBoss: true,
    color: 0xcc2222,
    drops: [{ itemId: "greaterPotion", chance: 0.75 }, { itemId: "plateArmor", chance: 0.3 }, { itemId: "greatSword", chance: 0.2 }],
    abilities: [
      { name: "Fire Breath", chance: 0.40, damageCount: 6, damageDie: 8, type: "damage", element: Element.Fire, statusEffect: "burn" },
      { name: "Tail Sweep", chance: 0.25, damageCount: 3, damageDie: 10, type: "damage" },
    ],
    elementalProfile: {
      immunities: [Element.Fire],
      weaknesses: [Element.Ice],
    },
  },
  // --- Bosses added for expanded biomes ---
  {
    id: "frostGiant",
    name: "Frost Giant",
    family: "colossus",
    variantOf: "troll",
    affinity: Element.Ice,
    hp: 120,
    ac: 16,
    attackBonus: 8,
    damageCount: 3,
    damageDie: 10,
    xpReward: 750,
    goldReward: 180,
    isBoss: true,
    color: 0x90caf9,
    drops: [{ itemId: "greaterPotion", chance: 0.6 }, { itemId: "chainMail", chance: 0.3 }],
    abilities: [
      { name: "Icy Smash", chance: 0.35, damageCount: 4, damageDie: 8, type: "damage", element: Element.Ice },
      { name: "Frost Aura", chance: 0.2, damageCount: 2, damageDie: 10, type: "damage", element: Element.Ice, statusEffect: "freeze" },
    ],
    elementalProfile: {
      immunities: [Element.Ice],
      weaknesses: [Element.Fire],
    },
  },
  {
    id: "swampHydra",
    name: "Swamp Hydra",
    family: "chimaera",
    variantOf: "greatChimaera",
    affinity: Element.Poison,
    hp: 140,
    ac: 14,
    attackBonus: 8,
    damageCount: 2,
    damageDie: 12,
    xpReward: 900,
    goldReward: 200,
    isBoss: true,
    color: 0x558b2f,
    drops: [{ itemId: "greaterPotion", chance: 0.7 }, { itemId: "plateArmor", chance: 0.2 }],
    abilities: [
      { name: "Multi-Bite", chance: 0.4, damageCount: 5, damageDie: 6, type: "damage" },
      { name: "Regenerate", chance: 0.2, damageCount: 4, damageDie: 8, type: "heal" },
    ],
    elementalProfile: {
      weaknesses: [Element.Fire, Element.Ice],
      resistances: [Element.Poison],
    },
  },
  {
    id: "volcanicWyrm",
    name: "Volcanic Wyrm",
    family: "drake",
    variantOf: "dragon",
    affinity: Element.Fire,
    hp: 160,
    ac: 17,
    attackBonus: 9,
    damageCount: 3,
    damageDie: 12,
    xpReward: 1200,
    goldReward: 350,
    isBoss: true,
    color: 0xbf360c,
    drops: [{ itemId: "greaterPotion", chance: 0.8 }, { itemId: "greatSword", chance: 0.25 }],
    abilities: [
      { name: "Lava Burst", chance: 0.4, damageCount: 5, damageDie: 8, type: "damage", element: Element.Fire, statusEffect: "burn" },
      { name: "Magma Shield", chance: 0.2, damageCount: 3, damageDie: 10, type: "heal" },
    ],
    elementalProfile: {
      immunities: [Element.Fire],
      weaknesses: [Element.Ice],
    },
  },
  {
    id: "canyonDrake",
    name: "Canyon Drake",
    family: "drake",
    variantOf: "dragon",
    hp: 130,
    ac: 16,
    attackBonus: 8,
    damageCount: 3,
    damageDie: 10,
    xpReward: 800,
    goldReward: 220,
    isBoss: true,
    color: 0xa1887f,
    drops: [{ itemId: "greaterPotion", chance: 0.65 }, { itemId: "ironShield", chance: 0.3 }],
    abilities: [
      { name: "Stone Barrage", chance: 0.35, damageCount: 4, damageDie: 8, type: "damage" },
      { name: "Wing Gust", chance: 0.25, damageCount: 3, damageDie: 6, type: "damage" },
    ],
  },
  // ── Chimaera enemies (Chimaera Wing drops) ────────────────────
  {
    id: "chimaera",
    name: "Chimaera",
    family: "chimaera",
    affinity: Element.Fire,
    hp: 48,
    ac: 14,
    attackBonus: 8,
    damageCount: 2,
    damageDie: 8,
    xpReward: 120,
    goldReward: 35,
    isBoss: false,
    color: 0x8b6914,
    drops: [{ itemId: "chimaeraWing", chance: 0.15 }, { itemId: "potion", chance: 0.2 }],
    abilities: [
      { name: "Fire Breath", chance: 0.2, damageCount: 2, damageDie: 6, type: "damage", element: Element.Fire },
    ],
  },
  {
    id: "greatChimaera",
    name: "Great Chimaera",
    family: "chimaera",
    variantOf: "chimaera",
    hp: 72,
    ac: 16,
    attackBonus: 11,
    damageCount: 3,
    damageDie: 8,
    xpReward: 250,
    goldReward: 65,
    isBoss: false,
    color: 0xa0522d,
    drops: [{ itemId: "chimaeraWing", chance: 0.25 }, { itemId: "greaterPotion", chance: 0.15 }],
    abilities: [
      { name: "Triple Strike", chance: 0.3, damageCount: 3, damageDie: 8, type: "damage" },
    ],
  },
];

/** Dungeon-exclusive monsters — tougher than overworld, unique pool. */
export const DUNGEON_MONSTERS: Monster[] = [
  // --- Shared dungeon monsters (appear in all dungeons) ---
  {
    id: "giantRat",
    name: "Giant Rat",
    family: "stalker",
    hp: 14,
    ac: 11,
    attackBonus: 3,
    damageCount: 1,
    damageDie: 6,
    xpReward: 18,
    goldReward: 5,
    isBoss: false,
    color: 0x8d6e63,
    drops: [{ itemId: "potion", chance: 0.2 }],
    abilities: [
      { name: "Frenzy Bite", chance: 0.25, damageCount: 2, damageDie: 4, type: "damage" },
    ],
  },
  {
    id: "shadow",
    name: "Shadow",
    family: "spectral",
    variantOf: "wraith",
    affinity: Element.Necrotic,
    hp: 26,
    ac: 13,
    attackBonus: 5,
    damageCount: 2,
    damageDie: 6,
    xpReward: 35,
    goldReward: 12,
    isBoss: false,
    color: 0x37474f,
    drops: [{ itemId: "ether", chance: 0.25 }],
    abilities: [
      { name: "Shadow Drain", chance: 0.35, damageCount: 2, damageDie: 6, type: "damage", selfHeal: true, element: Element.Necrotic },
    ],
    elementalProfile: {
      weaknesses: [Element.Radiant],
      resistances: [Element.Necrotic, Element.Poison],
    },
  },
  {
    id: "mimic",
    name: "Mimic",
    family: "mimic",
    hp: 40,
    ac: 14,
    attackBonus: 6,
    damageCount: 2,
    damageDie: 8,
    xpReward: 55,
    goldReward: 30,
    isBoss: false,
    color: 0x795548,
    drops: [
      { itemId: "greaterPotion", chance: 0.4 },
      { itemId: "longSword", chance: 0.15 },
    ],
    abilities: [
      { name: "Chomp", chance: 0.3, damageCount: 3, damageDie: 6, type: "damage" },
    ],
  },
  RUNIC_MIMIC,
  {
    id: "stoneGolem",
    name: "Stone Golem",
    family: "construct",
    hp: 60,
    ac: 16,
    attackBonus: 7,
    damageCount: 3,
    damageDie: 8,
    xpReward: 80,
    goldReward: 40,
    isBoss: false,
    color: 0x9e9e9e,
    drops: [
      { itemId: "greaterPotion", chance: 0.3 },
      { itemId: "plateArmor", chance: 0.1 },
    ],
    abilities: [
      { name: "Ground Slam", chance: 0.35, damageCount: 4, damageDie: 6, type: "damage" },
    ],
    elementalProfile: {
      immunities: [Element.Poison, Element.Psychic],
      resistances: [Element.Fire, Element.Lightning],
      weaknesses: [Element.Thunder],
    },
  },
];

/** Heartlands Crypt monsters — undead theme. */
export const HEARTLANDS_CRYPT_MONSTERS: Monster[] = [
  {
    id: "cryptSkeleton",
    name: "Crypt Skeleton",
    family: "skeletal",
    variantOf: "skeleton",
    affinity: Element.Necrotic,
    hp: 30,
    ac: 14,
    attackBonus: 5,
    damageCount: 2,
    damageDie: 6,
    xpReward: 45,
    goldReward: 15,
    isBoss: false,
    color: 0xbdbdbd,
    drops: [{ itemId: "ether", chance: 0.2 }],
    abilities: [
      { name: "Bone Shield", chance: 0.2, damageCount: 2, damageDie: 4, type: "heal" },
      { name: "Cursed Strike", chance: 0.3, damageCount: 2, damageDie: 8, type: "damage", element: Element.Necrotic },
    ],
    elementalProfile: {
      weaknesses: [Element.Radiant],
      resistances: [Element.Necrotic, Element.Poison],
    },
  },
  {
    id: "tombWraith",
    name: "Tomb Wraith",
    family: "spectral",
    variantOf: "wraith",
    affinity: Element.Necrotic,
    hp: 45,
    ac: 15,
    attackBonus: 6,
    damageCount: 2,
    damageDie: 8,
    xpReward: 65,
    goldReward: 25,
    isBoss: false,
    color: 0x4a148c,
    drops: [{ itemId: "ether", chance: 0.3 }, { itemId: "greaterPotion", chance: 0.15 }],
    abilities: [
      { name: "Soul Rend", chance: 0.35, damageCount: 3, damageDie: 6, type: "damage", selfHeal: true, element: Element.Necrotic },
      { name: "Wail of the Dead", chance: 0.2, damageCount: 4, damageDie: 4, type: "damage", element: Element.Necrotic },
    ],
    elementalProfile: {
      weaknesses: [Element.Radiant],
      immunities: [Element.Poison, Element.Necrotic],
    },
  },
  {
    id: "bonePile",
    name: "Animated Bone Pile",
    family: "skeletal",
    variantOf: "skeleton",
    hp: 55,
    ac: 12,
    attackBonus: 5,
    damageCount: 3,
    damageDie: 6,
    xpReward: 70,
    goldReward: 30,
    isBoss: false,
    color: 0xd7ccc8,
    drops: [{ itemId: "potion", chance: 0.3 }],
    abilities: [
      { name: "Bone Shrapnel", chance: 0.35, damageCount: 4, damageDie: 4, type: "damage" },
      { name: "Reassemble", chance: 0.2, damageCount: 3, damageDie: 6, type: "heal" },
    ],
  },
];

/** Frost Cavern monsters — icy theme. */
export const FROST_CAVERN_MONSTERS: Monster[] = [
  FROST_SLIME,
  {
    id: "iceElemental",
    name: "Ice Elemental",
    family: "elemental",
    affinity: Element.Ice,
    hp: 35,
    ac: 14,
    attackBonus: 5,
    damageCount: 2,
    damageDie: 8,
    xpReward: 50,
    goldReward: 18,
    isBoss: false,
    color: 0x80deea,
    drops: [{ itemId: "ether", chance: 0.2 }],
    abilities: [
      { name: "Frost Nova", chance: 0.3, damageCount: 3, damageDie: 4, type: "damage", element: Element.Ice },
      { name: "Ice Armor", chance: 0.2, damageCount: 2, damageDie: 6, type: "heal" },
    ],
    elementalProfile: {
      immunities: [Element.Ice],
      weaknesses: [Element.Fire],
    },
  },
  {
    id: "frostSpider",
    name: "Frost Spider",
    family: "stalker",
    variantOf: "giantRat",
    affinity: Element.Ice,
    hp: 28,
    ac: 13,
    attackBonus: 5,
    damageCount: 2,
    damageDie: 6,
    xpReward: 40,
    goldReward: 14,
    isBoss: false,
    color: 0xb3e5fc,
    drops: [{ itemId: "potion", chance: 0.25 }],
    abilities: [
      { name: "Web Snare", chance: 0.25, damageCount: 1, damageDie: 4, type: "damage", statusEffect: "slow" },
      { name: "Frozen Bite", chance: 0.3, damageCount: 2, damageDie: 8, type: "damage", element: Element.Ice },
    ],
    elementalProfile: {
      resistances: [Element.Ice],
      weaknesses: [Element.Fire],
    },
  },
  {
    id: "glacialBear",
    name: "Glacial Bear",
    family: "colossus",
    affinity: Element.Ice,
    hp: 65,
    ac: 15,
    attackBonus: 7,
    damageCount: 3,
    damageDie: 8,
    xpReward: 85,
    goldReward: 35,
    isBoss: false,
    color: 0xe0f7fa,
    drops: [{ itemId: "greaterPotion", chance: 0.3 }],
    abilities: [
      { name: "Maul", chance: 0.35, damageCount: 4, damageDie: 6, type: "damage" },
    ],
    elementalProfile: {
      resistances: [Element.Ice],
      weaknesses: [Element.Fire],
    },
  },
  ICE_GOLEM,
];

/** Volcanic Forge monsters — fire theme. */
export const VOLCANIC_FORGE_MONSTERS: Monster[] = [
  {
    id: "magmaSlime",
    name: "Magma Slime",
    family: "slime",
    variantOf: "slime",
    affinity: Element.Fire,
    hp: 32,
    ac: 12,
    attackBonus: 5,
    damageCount: 2,
    damageDie: 6,
    xpReward: 45,
    goldReward: 16,
    isBoss: false,
    color: 0xff6e40,
    drops: [{ itemId: "potion", chance: 0.2 }],
    abilities: [
      { name: "Lava Splash", chance: 0.3, damageCount: 2, damageDie: 8, type: "damage", element: Element.Fire, statusEffect: "burn" },
    ],
    elementalProfile: {
      immunities: [Element.Fire],
      weaknesses: [Element.Ice],
    },
  },
  {
    id: "cinderWraith",
    name: "Cinder Wraith",
    family: "spectral",
    variantOf: "wraith",
    affinity: Element.Fire,
    hp: 42,
    ac: 14,
    attackBonus: 6,
    damageCount: 2,
    damageDie: 8,
    xpReward: 60,
    goldReward: 22,
    isBoss: false,
    color: 0xdd2c00,
    drops: [{ itemId: "ether", chance: 0.25 }],
    abilities: [
      { name: "Ember Storm", chance: 0.3, damageCount: 3, damageDie: 6, type: "damage", element: Element.Fire },
      { name: "Ashen Veil", chance: 0.2, damageCount: 2, damageDie: 6, type: "heal" },
    ],
    elementalProfile: {
      resistances: [Element.Fire],
      weaknesses: [Element.Ice, Element.Radiant],
    },
  },
  {
    id: "obsidianGolem",
    name: "Obsidian Golem",
    family: "construct",
    variantOf: "stoneGolem",
    affinity: Element.Fire,
    hp: 70,
    ac: 17,
    attackBonus: 7,
    damageCount: 3,
    damageDie: 10,
    xpReward: 90,
    goldReward: 45,
    isBoss: false,
    color: 0x3e2723,
    drops: [
      { itemId: "greaterPotion", chance: 0.35 },
      { itemId: "chainMail", chance: 0.1 },
    ],
    abilities: [
      { name: "Molten Slam", chance: 0.35, damageCount: 4, damageDie: 8, type: "damage", element: Element.Fire },
      { name: "Magma Shell", chance: 0.15, damageCount: 3, damageDie: 8, type: "heal" },
    ],
    elementalProfile: {
      resistances: [Element.Fire],
      immunities: [Element.Poison],
      weaknesses: [Element.Ice, Element.Thunder],
    },
  },
];

/** Map of dungeon ID → unique monster pool. Falls back to generic DUNGEON_MONSTERS. */
export const DUNGEON_MONSTER_POOLS: Record<string, Monster[]> = {
  tideglass_grotto: [
    ...DUNGEON_MONSTERS,
    ...SEA_DAY_MONSTER_DEFINITIONS,
    ...SEA_NIGHT_MONSTER_DEFINITIONS,
  ],
  heartlands_dungeon: [...DUNGEON_MONSTERS, ...HEARTLANDS_CRYPT_MONSTERS],
  frost_cavern: [...DUNGEON_MONSTERS, ...FROST_CAVERN_MONSTERS],
  volcanic_forge: [...DUNGEON_MONSTERS, ...VOLCANIC_FORGE_MONSTERS],
};

/** Unique dungeon bosses — one per dungeon, encountered on the deepest level. */
export const DUNGEON_BOSSES: Monster[] = [
  KRAKEN,
  {
    id: "cryptLich",
    name: "Crypt Lich",
    family: "skeletal",
    variantOf: "skeleton",
    affinity: Element.Necrotic,
    hp: 110,
    ac: 17,
    attackBonus: 8,
    damageCount: 3,
    damageDie: 8,
    xpReward: 800,
    goldReward: 200,
    isBoss: true,
    color: 0x4a148c,
    drops: [{ itemId: "greaterPotion", chance: 0.75 }, { itemId: "plateArmor", chance: 0.2 }],
    abilities: [
      { name: "Necrotic Ray", chance: 0.4, damageCount: 4, damageDie: 8, type: "damage", element: Element.Necrotic, statusEffect: "frightened" },
      { name: "Soul Harvest", chance: 0.25, damageCount: 3, damageDie: 6, type: "damage", selfHeal: true, element: Element.Necrotic },
      { name: "Dark Mending", chance: 0.2, damageCount: 3, damageDie: 8, type: "heal" },
    ],
    elementalProfile: {
      immunities: [Element.Necrotic, Element.Poison],
      weaknesses: [Element.Radiant],
    },
  },
  {
    id: "frostWarden",
    name: "Frost Warden",
    family: "spectral",
    variantOf: "frostWraith",
    affinity: Element.Ice,
    hp: 130,
    ac: 18,
    attackBonus: 9,
    damageCount: 3,
    damageDie: 10,
    xpReward: 1000,
    goldReward: 250,
    isBoss: true,
    color: 0x80deea,
    drops: [{ itemId: "greaterPotion", chance: 0.8 }, { itemId: "chainMail", chance: 0.3 }],
    abilities: [
      { name: "Blizzard", chance: 0.35, damageCount: 5, damageDie: 6, type: "damage", element: Element.Ice },
      { name: "Glacial Tomb", chance: 0.3, damageCount: 4, damageDie: 8, type: "damage", element: Element.Ice, statusEffect: "paralysis" },
      { name: "Permafrost Shell", chance: 0.2, damageCount: 4, damageDie: 6, type: "heal" },
    ],
    elementalProfile: {
      immunities: [Element.Ice],
      weaknesses: [Element.Fire],
    },
  },
  {
    id: "infernoForgemaster",
    name: "Inferno Forgemaster",
    family: "construct",
    variantOf: "obsidianGolem",
    affinity: Element.Fire,
    hp: 150,
    ac: 19,
    attackBonus: 10,
    damageCount: 4,
    damageDie: 10,
    xpReward: 1500,
    goldReward: 400,
    isBoss: true,
    color: 0xbf360c,
    drops: [{ itemId: "greaterPotion", chance: 0.85 }, { itemId: "greatSword", chance: 0.3 }],
    abilities: [
      { name: "Molten Eruption", chance: 0.35, damageCount: 5, damageDie: 8, type: "damage", element: Element.Fire, statusEffect: "burn" },
      { name: "Forge Hammer", chance: 0.3, damageCount: 4, damageDie: 10, type: "damage" },
      { name: "Magma Rebirth", chance: 0.15, damageCount: 4, damageDie: 8, type: "heal" },
    ],
    elementalProfile: {
      immunities: [Element.Fire],
      weaknesses: [Element.Ice, Element.Thunder],
    },
  },
];

/** Map of dungeon ID → unique boss ID. */
export const DUNGEON_BOSS_MAP: Record<string, string> = {
  tideglass_grotto: "kraken",
  heartlands_dungeon: "cryptLich",
  frost_cavern: "frostWarden",
  volcanic_forge: "infernoForgemaster",
};

/** Get the unique boss for a dungeon by dungeon ID. Returns a copy. */
export function getDungeonBoss(dungeonId: string): Monster | undefined {
  const bossId = DUNGEON_BOSS_MAP[dungeonId];
  if (!bossId) return undefined;
  const boss = DUNGEON_BOSSES.find((b) => b.id === bossId);
  return boss ? { ...boss } : undefined;
}

export function getEligibleEncounterMonsters(
  pool: readonly Monster[],
  playerLevel: number,
  levelDivisor: number,
): Monster[] {
  const levelEligible = pool.filter(
    (monster) => playerLevel >= (monster.minPlayerLevel ?? 0),
  );
  if (levelEligible.length === 0) return [];
  const maxIndex = Math.min(
    levelEligible.length - 1,
    Math.floor(Math.max(0, playerLevel) / levelDivisor) + 1,
  );
  return levelEligible.slice(0, maxIndex + 1);
}

export function selectWeightedMonster(
  pool: readonly Monster[],
  random: () => number = Math.random,
): Monster {
  if (pool.length === 0) {
    throw new Error("Cannot select an encounter from an empty monster pool.");
  }
  const totalWeight = pool.reduce(
    (total, monster) => total + Math.max(0, monster.encounterWeight ?? 1),
    0,
  );
  if (totalWeight <= 0) {
    throw new Error("Encounter pool must contain a positive monster weight.");
  }
  let pick = Math.max(0, Math.min(0.999999, random())) * totalWeight;
  for (const monster of pool) {
    pick -= Math.max(0, monster.encounterWeight ?? 1);
    if (pick < 0) return { ...monster };
  }
  return { ...pool[pool.length - 1]! };
}

/** Get a random non-boss monster scaled to player level. */
export function getRandomEncounter(
  playerLevel: number,
  random: () => number = Math.random,
): Monster {
  const nonBoss = MONSTERS.filter((m) => !m.isBoss);
  return selectWeightedMonster(
    getEligibleEncounterMonsters(nonBoss, playerLevel, 2),
    random,
  );
}

/** Get a random dungeon monster scaled to player level. Uses dungeon-specific pool if available. */
export function getDungeonEncounter(
  playerLevel: number,
  dungeonId?: string,
  random: () => number = Math.random,
): Monster {
  const pool = (dungeonId && DUNGEON_MONSTER_POOLS[dungeonId]) || DUNGEON_MONSTERS;
  return selectWeightedMonster(
    getEligibleEncounterMonsters(pool, playerLevel, 3),
    random,
  );
}

/** Get a specific boss by ID (O(1) lookup). */
export function getBoss(id: string): Monster | undefined {
  const boss = BOSS_MAP.get(id);
  return boss ? { ...boss } : undefined;
}

/** Get a random night-only monster scaled to player level, optionally biome-specific. */
export function getNightEncounter(
  playerLevel: number,
  biomeName?: string,
  random: () => number = Math.random,
): Monster {
  const pool = getNightMonsterPool(biomeName);
  return selectWeightedMonster(
    getEligibleEncounterMonsters(pool, playerLevel, 2),
    random,
  );
}

/**
 * Master list of every unique monster in the game, de-duplicated by ID.
 * The order follows the definition arrays: overworld → bosses → dungeon → night,
 * which naturally groups monsters by area and difficulty.
 */
export const ALL_MONSTERS: Monster[] = (() => {
  const seen = new Set<string>();
  const list: Monster[] = [];
  const pools = [
    MONSTERS,
    DUNGEON_MONSTERS,
    HEARTLANDS_CRYPT_MONSTERS,
    FROST_CAVERN_MONSTERS,
    VOLCANIC_FORGE_MONSTERS,
    DUNGEON_BOSSES,
    NIGHT_MONSTERS,
    TUNDRA_NIGHT_MONSTERS,
    SWAMP_NIGHT_MONSTERS,
    FOREST_NIGHT_MONSTERS,
    CANYON_NIGHT_MONSTERS,
    SEA_DAY_MONSTER_DEFINITIONS,
    SEA_NIGHT_MONSTER_DEFINITIONS,
    [KRAKEN],
  ];
  for (const pool of pools) {
    for (const m of pool) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        list.push(m);
      }
    }
  }
  return list;
})();

/** O(1) monster lookup by ID, built from ALL_MONSTERS. */
const MONSTER_MAP: Map<string, Monster> = new Map(
  ALL_MONSTERS.map((m) => [m.id, m])
);

/** O(1) boss lookup by ID. */
const BOSS_MAP: Map<string, Monster> = new Map(
  ALL_MONSTERS.filter((m) => m.isBoss).map((m) => [m.id, m])
);

/** Get any monster by ID (O(1) lookup). Returns a copy to avoid mutation. */
export function getMonster(id: string): Monster | undefined {
  const m = MONSTER_MAP.get(id);
  return m ? { ...m } : undefined;
}

/** Find any monster by case-insensitive ID or name, with partial matching as fallback. */
export function findMonster(query: string): Monster | undefined {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return undefined;

  const monster = ALL_MONSTERS.find((candidate) =>
    candidate.id.toLowerCase() === normalized
  ) ?? ALL_MONSTERS.find((candidate) =>
    candidate.name.toLowerCase() === normalized
  ) ?? ALL_MONSTERS.find((candidate) =>
    candidate.name.toLowerCase().includes(normalized)
      || candidate.id.toLowerCase().includes(normalized)
  );

  return monster ? { ...monster } : undefined;
}
