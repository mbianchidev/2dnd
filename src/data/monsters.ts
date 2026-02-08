/**
 * Monster definitions: random encounters and fixed bosses.
 */

import type { DieType } from "../utils/dice";

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
}

export interface Monster {
  id: string;
  name: string;
  hp: number;
  ac: number; // armor class
  attackBonus: number;
  damageCount: number;
  damageDie: DieType;
  xpReward: number;
  goldReward: number;
  isBoss: boolean;
  color: number; // display color in battle
  drops?: MonsterDrop[];
  abilities?: MonsterAbility[];
}

export const MONSTERS: Monster[] = [
  // --- Random encounter monsters (ordered by difficulty) ---
  {
    id: "slime",
    name: "Slime",
    hp: 8,
    ac: 8,
    attackBonus: 1,
    damageCount: 1,
    damageDie: 4,
    xpReward: 25,
    goldReward: 5,
    isBoss: false,
    color: 0x44cc44,
    drops: [{ itemId: "potion", chance: 0.15 }],
  },
  {
    id: "goblin",
    name: "Goblin",
    hp: 15,
    ac: 12,
    attackBonus: 3,
    damageCount: 1,
    damageDie: 6,
    xpReward: 50,
    goldReward: 10,
    isBoss: false,
    color: 0x88aa44,
    drops: [{ itemId: "potion", chance: 0.2 }, { itemId: "ether", chance: 0.1 }],
  },
  {
    id: "skeleton",
    name: "Skeleton",
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
  },
  {
    id: "wolf",
    name: "Dire Wolf",
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
      { name: "Pounce", chance: 0.30, damageCount: 3, damageDie: 6, type: "damage" },
    ],
  },
  {
    id: "orc",
    name: "Orc Warrior",
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
  {
    id: "wraith",
    name: "Wraith",
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
      { name: "Life Drain", chance: 0.35, damageCount: 2, damageDie: 6, type: "damage", selfHeal: true },
      { name: "Necrotic Bolt", chance: 0.25, damageCount: 3, damageDie: 6, type: "damage" },
    ],
  },
  // --- Fixed boss encounters ---
  {
    id: "troll",
    name: "Cave Troll",
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
  },
  {
    id: "dragon",
    name: "Young Red Dragon",
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
      { name: "Fire Breath", chance: 0.40, damageCount: 6, damageDie: 8, type: "damage" },
      { name: "Tail Sweep", chance: 0.25, damageCount: 3, damageDie: 10, type: "damage" },
    ],
  },
];

/** Dungeon-exclusive monsters — tougher than overworld, unique pool. */
export const DUNGEON_MONSTERS: Monster[] = [
  {
    id: "giantRat",
    name: "Giant Rat",
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
      { name: "Shadow Drain", chance: 0.35, damageCount: 2, damageDie: 6, type: "damage", selfHeal: true },
    ],
  },
  {
    id: "mimic",
    name: "Mimic",
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
  {
    id: "stoneGolem",
    name: "Stone Golem",
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
  },
];

/** Get a random non-boss monster scaled to player level. */
export function getRandomEncounter(playerLevel: number): Monster {
  const nonBoss = MONSTERS.filter((m) => !m.isBoss);
  // Scale difficulty: higher level = chance of tougher monsters
  const maxIndex = Math.min(
    nonBoss.length - 1,
    Math.floor(playerLevel / 2) + 1
  );
  const index = Math.floor(Math.random() * (maxIndex + 1));
  // Return a copy so we don't mutate the template
  return { ...nonBoss[index] };
}

/** Get a random dungeon monster scaled to player level. */
export function getDungeonEncounter(playerLevel: number): Monster {
  const maxIndex = Math.min(
    DUNGEON_MONSTERS.length - 1,
    Math.floor(playerLevel / 3) + 1
  );
  const index = Math.floor(Math.random() * (maxIndex + 1));
  return { ...DUNGEON_MONSTERS[index] };
}

/** Get a specific boss by ID. */
export function getBoss(id: string): Monster | undefined {
  const boss = MONSTERS.find((m) => m.id === id && m.isBoss);
  return boss ? { ...boss } : undefined;
}
