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
  // --- Bosses added for expanded biomes ---
  {
    id: "frostGiant",
    name: "Frost Giant",
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
      { name: "Icy Smash", chance: 0.35, damageCount: 4, damageDie: 8, type: "damage" },
      { name: "Frost Aura", chance: 0.2, damageCount: 2, damageDie: 10, type: "damage" },
    ],
  },
  {
    id: "swampHydra",
    name: "Swamp Hydra",
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
  },
  {
    id: "volcanicWyrm",
    name: "Volcanic Wyrm",
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
      { name: "Lava Burst", chance: 0.4, damageCount: 5, damageDie: 8, type: "damage" },
      { name: "Magma Shield", chance: 0.2, damageCount: 3, damageDie: 10, type: "heal" },
    ],
  },
  {
    id: "canyonDrake",
    name: "Canyon Drake",
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
      { name: "Fire Breath", chance: 0.2, damageCount: 2, damageDie: 6, type: "damage" },
    ],
  },
  {
    id: "greatChimaera",
    name: "Great Chimaera",
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

/** Heartlands Crypt monsters — undead theme. */
export const HEARTLANDS_CRYPT_MONSTERS: Monster[] = [
  {
    id: "cryptSkeleton",
    name: "Crypt Skeleton",
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
      { name: "Cursed Strike", chance: 0.3, damageCount: 2, damageDie: 8, type: "damage" },
    ],
  },
  {
    id: "tombWraith",
    name: "Tomb Wraith",
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
      { name: "Soul Rend", chance: 0.35, damageCount: 3, damageDie: 6, type: "damage", selfHeal: true },
      { name: "Wail of the Dead", chance: 0.2, damageCount: 4, damageDie: 4, type: "damage" },
    ],
  },
  {
    id: "bonePile",
    name: "Animated Bone Pile",
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
  {
    id: "iceElemental",
    name: "Ice Elemental",
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
      { name: "Frost Nova", chance: 0.3, damageCount: 3, damageDie: 4, type: "damage" },
      { name: "Ice Armor", chance: 0.2, damageCount: 2, damageDie: 6, type: "heal" },
    ],
  },
  {
    id: "frostSpider",
    name: "Frost Spider",
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
      { name: "Web Snare", chance: 0.25, damageCount: 1, damageDie: 4, type: "damage" },
      { name: "Frozen Bite", chance: 0.3, damageCount: 2, damageDie: 8, type: "damage" },
    ],
  },
  {
    id: "glacialBear",
    name: "Glacial Bear",
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
  },
];

/** Volcanic Forge monsters — fire theme. */
export const VOLCANIC_FORGE_MONSTERS: Monster[] = [
  {
    id: "magmaSlime",
    name: "Magma Slime",
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
      { name: "Lava Splash", chance: 0.3, damageCount: 2, damageDie: 8, type: "damage" },
    ],
  },
  {
    id: "cinderWraith",
    name: "Cinder Wraith",
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
      { name: "Ember Storm", chance: 0.3, damageCount: 3, damageDie: 6, type: "damage" },
      { name: "Ashen Veil", chance: 0.2, damageCount: 2, damageDie: 6, type: "heal" },
    ],
  },
  {
    id: "obsidianGolem",
    name: "Obsidian Golem",
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
      { name: "Molten Slam", chance: 0.35, damageCount: 4, damageDie: 8, type: "damage" },
      { name: "Magma Shell", chance: 0.15, damageCount: 3, damageDie: 8, type: "heal" },
    ],
  },
];

/** Map of dungeon ID → unique monster pool. Falls back to generic DUNGEON_MONSTERS. */
export const DUNGEON_MONSTER_POOLS: Record<string, Monster[]> = {
  heartlands_dungeon: [...DUNGEON_MONSTERS, ...HEARTLANDS_CRYPT_MONSTERS],
  frost_cavern: [...DUNGEON_MONSTERS, ...FROST_CAVERN_MONSTERS],
  volcanic_forge: [...DUNGEON_MONSTERS, ...VOLCANIC_FORGE_MONSTERS],
};

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

/** Get a random dungeon monster scaled to player level. Uses dungeon-specific pool if available. */
export function getDungeonEncounter(playerLevel: number, dungeonId?: string): Monster {
  const pool = (dungeonId && DUNGEON_MONSTER_POOLS[dungeonId]) || DUNGEON_MONSTERS;
  const maxIndex = Math.min(
    pool.length - 1,
    Math.floor(playerLevel / 3) + 1
  );
  const index = Math.floor(Math.random() * (maxIndex + 1));
  return { ...pool[index] };
}

/** Get a specific boss by ID. */
export function getBoss(id: string): Monster | undefined {
  const boss = MONSTERS.find((m) => m.id === id && m.isBoss);
  return boss ? { ...boss } : undefined;
}

/** Night-only overworld monsters — appear during Dusk and Night. */
export const NIGHT_MONSTERS: Monster[] = [
  {
    id: "nightWolf",
    name: "Night Wolf",
    hp: 20,
    ac: 12,
    attackBonus: 4,
    damageCount: 2,
    damageDie: 6,
    xpReward: 60,
    goldReward: 8,
    isBoss: false,
    color: 0x334466,
    drops: [{ itemId: "potion", chance: 0.2 }],
    abilities: [
      { name: "Shadow Howl", chance: 0.3, damageCount: 2, damageDie: 4, type: "damage" },
    ],
  },
  {
    id: "vampireBat",
    name: "Vampire Bat",
    hp: 28,
    ac: 14,
    attackBonus: 5,
    damageCount: 1,
    damageDie: 8,
    xpReward: 80,
    goldReward: 14,
    isBoss: false,
    color: 0x442244,
    drops: [{ itemId: "ether", chance: 0.2 }],
    abilities: [
      { name: "Blood Drain", chance: 0.35, damageCount: 2, damageDie: 6, type: "damage", selfHeal: true },
    ],
  },
  {
    id: "specter",
    name: "Specter",
    hp: 40,
    ac: 14,
    attackBonus: 5,
    damageCount: 2,
    damageDie: 8,
    xpReward: 120,
    goldReward: 20,
    isBoss: false,
    color: 0x8888cc,
    drops: [{ itemId: "ether", chance: 0.2 }, { itemId: "greaterPotion", chance: 0.1 }],
    abilities: [
      { name: "Chill Touch", chance: 0.3, damageCount: 3, damageDie: 6, type: "damage" },
    ],
  },
];

/** Tundra night monsters — frost-touched horrors. */
export const TUNDRA_NIGHT_MONSTERS: Monster[] = [
  {
    id: "frostWraith",
    name: "Frost Wraith",
    hp: 35,
    ac: 14,
    attackBonus: 5,
    damageCount: 2,
    damageDie: 8,
    xpReward: 90,
    goldReward: 16,
    isBoss: false,
    color: 0xb3e5fc,
    drops: [{ itemId: "ether", chance: 0.25 }],
    abilities: [
      { name: "Frostbite", chance: 0.35, damageCount: 3, damageDie: 6, type: "damage" },
      { name: "Glacial Mist", chance: 0.2, damageCount: 2, damageDie: 4, type: "damage" },
    ],
  },
  {
    id: "snowStalker",
    name: "Snow Stalker",
    hp: 25,
    ac: 13,
    attackBonus: 5,
    damageCount: 2,
    damageDie: 6,
    xpReward: 70,
    goldReward: 10,
    isBoss: false,
    color: 0xcfd8dc,
    drops: [{ itemId: "potion", chance: 0.2 }],
    abilities: [
      { name: "Ambush", chance: 0.35, damageCount: 3, damageDie: 6, type: "damage" },
    ],
  },
];

/** Swamp night monsters — boggy lurkers. */
export const SWAMP_NIGHT_MONSTERS: Monster[] = [
  {
    id: "willOWisp",
    name: "Will-o'-Wisp",
    hp: 22,
    ac: 16,
    attackBonus: 4,
    damageCount: 2,
    damageDie: 8,
    xpReward: 85,
    goldReward: 12,
    isBoss: false,
    color: 0x76ff03,
    drops: [{ itemId: "ether", chance: 0.3 }],
    abilities: [
      { name: "Lure Light", chance: 0.35, damageCount: 2, damageDie: 8, type: "damage" },
      { name: "Consume Life", chance: 0.2, damageCount: 2, damageDie: 6, type: "damage", selfHeal: true },
    ],
  },
  {
    id: "bogCreeper",
    name: "Bog Creeper",
    hp: 38,
    ac: 12,
    attackBonus: 5,
    damageCount: 2,
    damageDie: 8,
    xpReward: 95,
    goldReward: 15,
    isBoss: false,
    color: 0x33691e,
    drops: [{ itemId: "potion", chance: 0.25 }],
    abilities: [
      { name: "Entangle", chance: 0.3, damageCount: 2, damageDie: 6, type: "damage" },
      { name: "Toxic Spore", chance: 0.25, damageCount: 3, damageDie: 4, type: "damage" },
    ],
  },
];

/** Deep Forest night monsters — ancient woodland terrors. */
export const FOREST_NIGHT_MONSTERS: Monster[] = [
  {
    id: "darkTreent",
    name: "Dark Treant",
    hp: 50,
    ac: 15,
    attackBonus: 6,
    damageCount: 2,
    damageDie: 10,
    xpReward: 110,
    goldReward: 20,
    isBoss: false,
    color: 0x1b5e20,
    drops: [{ itemId: "greaterPotion", chance: 0.15 }],
    abilities: [
      { name: "Root Crush", chance: 0.35, damageCount: 3, damageDie: 8, type: "damage" },
      { name: "Bark Shield", chance: 0.2, damageCount: 3, damageDie: 6, type: "heal" },
    ],
  },
  {
    id: "gloomSprite",
    name: "Gloom Sprite",
    hp: 18,
    ac: 15,
    attackBonus: 4,
    damageCount: 1,
    damageDie: 10,
    xpReward: 65,
    goldReward: 10,
    isBoss: false,
    color: 0x2e7d32,
    drops: [{ itemId: "ether", chance: 0.2 }],
    abilities: [
      { name: "Thorn Dart", chance: 0.3, damageCount: 2, damageDie: 6, type: "damage" },
      { name: "Sleep Dust", chance: 0.2, damageCount: 1, damageDie: 6, type: "damage" },
    ],
  },
];

/** Canyon night monsters — stone predators. */
export const CANYON_NIGHT_MONSTERS: Monster[] = [
  {
    id: "stoneLurker",
    name: "Stone Lurker",
    hp: 45,
    ac: 16,
    attackBonus: 6,
    damageCount: 2,
    damageDie: 10,
    xpReward: 100,
    goldReward: 18,
    isBoss: false,
    color: 0x8d6e63,
    drops: [{ itemId: "potion", chance: 0.2 }],
    abilities: [
      { name: "Rock Slide", chance: 0.35, damageCount: 3, damageDie: 8, type: "damage" },
      { name: "Burrow", chance: 0.15, damageCount: 2, damageDie: 6, type: "heal" },
    ],
  },
  {
    id: "dustDevil",
    name: "Dust Devil",
    hp: 30,
    ac: 14,
    attackBonus: 5,
    damageCount: 2,
    damageDie: 8,
    xpReward: 75,
    goldReward: 12,
    isBoss: false,
    color: 0xbcaaa4,
    drops: [{ itemId: "ether", chance: 0.2 }],
    abilities: [
      { name: "Sand Blast", chance: 0.3, damageCount: 3, damageDie: 4, type: "damage" },
      { name: "Whirlwind", chance: 0.25, damageCount: 2, damageDie: 8, type: "damage" },
    ],
  },
];

/** Biome-name prefix → night monster pool. */
const BIOME_NIGHT_POOLS: Record<string, Monster[]> = {
  Frozen:   TUNDRA_NIGHT_MONSTERS,
  Murky:    SWAMP_NIGHT_MONSTERS,
  Woodland: FOREST_NIGHT_MONSTERS,
  Rocky:    CANYON_NIGHT_MONSTERS,
  Arid:     CANYON_NIGHT_MONSTERS,
  Scorched: [], // volcanic — no night encounters in lava fields
  Highland: NIGHT_MONSTERS,
  Ancient:  NIGHT_MONSTERS,
};

/** Get the biome-specific night pool for a given biome name. Falls back to generic. */
function getBiomeNightPool(biomeName: string): Monster[] {
  for (const [prefix, pool] of Object.entries(BIOME_NIGHT_POOLS)) {
    if (biomeName.startsWith(prefix)) return pool.length > 0 ? pool : NIGHT_MONSTERS;
  }
  return NIGHT_MONSTERS;
}

/** Get a random night-only monster scaled to player level, optionally biome-specific. */
export function getNightEncounter(playerLevel: number, biomeName?: string): Monster {
  const pool = biomeName ? getBiomeNightPool(biomeName) : NIGHT_MONSTERS;
  const maxIndex = Math.min(
    pool.length - 1,
    Math.floor(playerLevel / 2) + 1
  );
  const index = Math.floor(Math.random() * (maxIndex + 1));
  return { ...pool[index] };
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
    NIGHT_MONSTERS,
    TUNDRA_NIGHT_MONSTERS,
    SWAMP_NIGHT_MONSTERS,
    FOREST_NIGHT_MONSTERS,
    CANYON_NIGHT_MONSTERS,
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
