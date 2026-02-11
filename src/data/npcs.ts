/**
 * NPC data definitions — visual templates, jobs, dialogues, and city assignments.
 *
 * NPCs come in three age groups (child, male adult, female adult) with 5 visual
 * templates each.  Every NPC has a job that determines its appearance accent
 * colour and idle behaviour.  Hair, dress, and skin colour variations are
 * randomised per-instance to make each city feel populated and unique.
 */

// ── Visual template types ──

export type NpcAgeGroup = "child" | "male" | "female";

export interface NpcTemplate {
  id: string;
  ageGroup: NpcAgeGroup;
  /** Label shown in dialogue header. */
  label: string;
  /** Base body colour (can be overridden per-instance by dress colour). */
  bodyColor: number;
  /** Sprite height scale relative to adult (children are shorter). */
  heightScale: number;
}

export const NPC_TEMPLATES: NpcTemplate[] = [
  // ── Children (5) ──
  { id: "child_boy1",  ageGroup: "child",  label: "Boy",         bodyColor: 0x42a5f5, heightScale: 0.7 },
  { id: "child_boy2",  ageGroup: "child",  label: "Boy",         bodyColor: 0x66bb6a, heightScale: 0.7 },
  { id: "child_girl1", ageGroup: "child",  label: "Girl",        bodyColor: 0xef5350, heightScale: 0.7 },
  { id: "child_girl2", ageGroup: "child",  label: "Girl",        bodyColor: 0xab47bc, heightScale: 0.7 },
  { id: "child_kid",   ageGroup: "child",  label: "Kid",         bodyColor: 0xffa726, heightScale: 0.7 },

  // ── Male adults (5) ──
  { id: "male_tall",   ageGroup: "male",   label: "Man",         bodyColor: 0x5c6bc0, heightScale: 1.0 },
  { id: "male_stout",  ageGroup: "male",   label: "Man",         bodyColor: 0x8d6e63, heightScale: 1.0 },
  { id: "male_thin",   ageGroup: "male",   label: "Man",         bodyColor: 0x78909c, heightScale: 1.0 },
  { id: "male_elder",  ageGroup: "male",   label: "Old Man",     bodyColor: 0x607d8b, heightScale: 1.0 },
  { id: "male_young",  ageGroup: "male",   label: "Young Man",   bodyColor: 0x26a69a, heightScale: 1.0 },

  // ── Female adults (5) ──
  { id: "female_tall",  ageGroup: "female", label: "Woman",       bodyColor: 0xec407a, heightScale: 1.0 },
  { id: "female_stout", ageGroup: "female", label: "Woman",       bodyColor: 0x7e57c2, heightScale: 1.0 },
  { id: "female_thin",  ageGroup: "female", label: "Woman",       bodyColor: 0x29b6f6, heightScale: 1.0 },
  { id: "female_elder", ageGroup: "female", label: "Old Woman",   bodyColor: 0x8d6e63, heightScale: 1.0 },
  { id: "female_young", ageGroup: "female", label: "Young Woman", bodyColor: 0x26c6da, heightScale: 1.0 },
];

// ── Jobs ──

export type NpcJob =
  | "blacksmith"
  | "innkeeper"
  | "farmer"
  | "merchant"
  | "cook"
  | "villager";

/** Accent colour applied to the NPC's apron / accessory based on job. */
export const JOB_ACCENT_COLORS: Record<NpcJob, number> = {
  blacksmith: 0x37474f,
  innkeeper: 0x6d4c41,
  farmer: 0x558b2f,
  merchant: 0xf9a825,
  cook: 0xfafafa,
  villager: 0x90a4ae,
};

// ── Skin / Hair / Dress colour palettes ──

export const NPC_SKIN_COLORS: number[] = [
  0xffccbc, // light
  0xd7a97c, // tan
  0xc68642, // medium
  0x8d6e63, // dark
  0x5d4037, // deep
];

export const NPC_HAIR_COLORS: number[] = [
  0x1a1a1a, // black
  0x5d4037, // brown
  0xffd54f, // blonde
  0xb71c1c, // red
  0xeeeeee, // white
  0x1565c0, // blue
];

export const NPC_DRESS_COLORS: number[] = [
  0x42a5f5, // blue
  0x66bb6a, // green
  0xef5350, // red
  0xffa726, // orange
  0xab47bc, // purple
  0x78909c, // grey
  0xfdd835, // yellow
  0x26a69a, // teal
];

// ── Dialogue pools ──

/** Generic phrases for regular villager NPCs. */
export const VILLAGER_DIALOGUES: string[] = [
  "Lovely day, isn't it?",
  "Watch out for monsters at night!",
  "I heard there's treasure in the north.",
  "This town has the best inn around.",
  "Have you visited the shops?",
  "Be careful in the dungeons!",
  "The blacksmith makes fine blades.",
  "I've lived here my whole life.",
  "Did you hear that howling last night?",
  "Welcome, traveller!",
  "Stay safe on the road.",
  "The merchant has rare goods today.",
  "My grandmother told tales of dragons.",
  "A hero! How exciting!",
  "The fields need rain soon.",
  "I wonder what's beyond the mountains.",
  "Try the local stew, it's delicious!",
  "Monsters have been restless lately.",
  "They say a great evil stirs in the east.",
  "I wish I could go on an adventure too.",
  "The guards keep us safe... usually.",
  "That last storm was something fierce.",
  "Good luck on your quest!",
  "Don't forget to rest at the inn.",
  "The well water here is crisp and clear.",
];

/** Dialogue lines for shopkeeper NPCs, keyed by shop type. */
export const SHOPKEEPER_DIALOGUES: Record<string, string[]> = {
  weapon: [
    "Looking for a new blade?",
    "Only the finest steel here!",
    "These weapons are battle-tested.",
    "Need something sharp? You've come to the right place.",
  ],
  armor: [
    "Protection is key to survival!",
    "Try on some armour—fit matters.",
    "A good shield can save your life.",
    "Nothing but the sturdiest gear here.",
  ],
  magic: [
    "Potions and elixirs—come browse!",
    "Magical remedies for weary travellers.",
    "My potions never fail... mostly.",
    "Ether keeps your spells flowing.",
  ],
  general: [
    "Supplies for every adventurer!",
    "Stock up before you head out.",
    "We've got everything you need.",
    "A well-prepared hero is a living hero.",
  ],
  inn: [
    "Rest your weary bones? (10g)",
    "A warm bed and a hot meal await!",
    "You look exhausted—stay the night?",
    "Our rooms are the cosiest in town.",
  ],
  bank: [
    "Your gold is safe with us.",
    "Need to check your balance?",
    "We offer the best rates around.",
    "Deposits and withdrawals—at your service.",
  ],
};

/** Dialogue for child NPCs. */
export const CHILD_DIALOGUES: string[] = [
  "Wow, are you a real hero?",
  "Tag! You're it!",
  "I wanna be an adventurer someday!",
  "Mommy says monsters are scary.",
  "Can I see your sword?",
  "I found a cool rock today!",
  "Race ya to the fountain!",
  "I'm not scared of the dark... much.",
];

// ── Per-city NPC placement ──

export interface NpcInstance {
  templateId: string;
  job: NpcJob;
  x: number;
  y: number;
  /** Whether this NPC wanders. */
  moves: boolean;
  /** Unique dialogue line (set at spawn time if not provided). */
  dialogue?: string;
  /** If set, this NPC is the shopkeeper for the given shop index. */
  shopIndex?: number;
}

/**
 * NPC spawn definitions for each city.  Shopkeeper NPCs use `shopIndex` to
 * link to the corresponding entry in the city's `shops` array.
 */
export const CITY_NPCS: Record<string, NpcInstance[]> = {
  willowdale_city: [
    { templateId: "male_stout",   job: "blacksmith",  x: 4,  y: 5,  moves: false, shopIndex: 0 },
    { templateId: "female_tall",  job: "merchant",    x: 15, y: 5,  moves: false, shopIndex: 1 },
    { templateId: "male_tall",    job: "merchant",    x: 4,  y: 12, moves: false, shopIndex: 2 },
    { templateId: "female_stout", job: "innkeeper",   x: 15, y: 12, moves: false, shopIndex: 3 },
    { templateId: "child_boy1",   job: "villager",    x: 8,  y: 7,  moves: true },
    { templateId: "child_girl1",  job: "villager",    x: 12, y: 8,  moves: true },
    { templateId: "male_elder",   job: "farmer",      x: 10, y: 6,  moves: false },
    { templateId: "female_young", job: "villager",    x: 6,  y: 9,  moves: true },
  ],
  ironhold_city: [
    { templateId: "male_stout",   job: "blacksmith",  x: 4,  y: 3,  moves: false, shopIndex: 0 },
    { templateId: "male_tall",    job: "merchant",    x: 15, y: 3,  moves: false, shopIndex: 1 },
    { templateId: "female_thin",  job: "merchant",    x: 8,  y: 6,  moves: false, shopIndex: 2 },
    { templateId: "female_stout", job: "innkeeper",   x: 11, y: 6,  moves: false, shopIndex: 3 },
    { templateId: "male_young",   job: "villager",    x: 10, y: 8,  moves: true },
    { templateId: "child_boy2",   job: "villager",    x: 7,  y: 9,  moves: true },
    { templateId: "female_elder", job: "farmer",      x: 14, y: 10, moves: false },
  ],
  sandport_city: [
    { templateId: "male_thin",    job: "blacksmith",  x: 4,  y: 4,  moves: false, shopIndex: 0 },
    { templateId: "female_tall",  job: "merchant",    x: 15, y: 4,  moves: false, shopIndex: 1 },
    { templateId: "male_elder",   job: "merchant",    x: 4,  y: 8,  moves: false, shopIndex: 2 },
    { templateId: "female_young", job: "innkeeper",   x: 15, y: 8,  moves: false, shopIndex: 3 },
    { templateId: "male_young",   job: "merchant",    x: 5,  y: 12, moves: false, shopIndex: 4 },
    { templateId: "female_stout", job: "merchant",    x: 14, y: 12, moves: false, shopIndex: 5 },
    { templateId: "child_girl2",  job: "villager",    x: 10, y: 6,  moves: true },
    { templateId: "child_kid",    job: "villager",    x: 8,  y: 9,  moves: true },
    { templateId: "male_stout",   job: "cook",        x: 12, y: 9,  moves: false },
  ],
  frostheim_city: [
    { templateId: "female_thin",  job: "merchant",    x: 4,  y: 4,  moves: false, shopIndex: 0 },
    { templateId: "male_stout",   job: "merchant",    x: 15, y: 4,  moves: false, shopIndex: 1 },
    { templateId: "male_tall",    job: "blacksmith",  x: 4,  y: 11, moves: false, shopIndex: 2 },
    { templateId: "female_stout", job: "innkeeper",   x: 8,  y: 11, moves: false, shopIndex: 3 },
    { templateId: "male_young",   job: "merchant",    x: 11, y: 11, moves: false, shopIndex: 4 },
    { templateId: "female_tall",  job: "blacksmith",  x: 14, y: 11, moves: false, shopIndex: 5 },
    { templateId: "child_boy1",   job: "villager",    x: 9,  y: 7,  moves: true },
    { templateId: "male_elder",   job: "farmer",      x: 6,  y: 8,  moves: false },
  ],
  deeproot_city: [
    { templateId: "male_tall",    job: "blacksmith",  x: 5,  y: 4,  moves: false, shopIndex: 0 },
    { templateId: "female_thin",  job: "merchant",    x: 14, y: 4,  moves: false, shopIndex: 1 },
    { templateId: "male_young",   job: "merchant",    x: 5,  y: 12, moves: false, shopIndex: 2 },
    { templateId: "female_young", job: "innkeeper",   x: 14, y: 12, moves: false, shopIndex: 3 },
    { templateId: "child_girl1",  job: "villager",    x: 10, y: 7,  moves: true },
    { templateId: "female_elder", job: "cook",        x: 8,  y: 9,  moves: false },
    { templateId: "male_stout",   job: "farmer",      x: 12, y: 9,  moves: true },
  ],
  canyonwatch_city: [
    { templateId: "male_stout",   job: "blacksmith",  x: 4,  y: 4,  moves: false, shopIndex: 0 },
    { templateId: "female_stout", job: "merchant",    x: 15, y: 4,  moves: false, shopIndex: 1 },
    { templateId: "male_thin",    job: "merchant",    x: 7,  y: 8,  moves: false, shopIndex: 2 },
    { templateId: "female_tall",  job: "innkeeper",   x: 12, y: 8,  moves: false, shopIndex: 3 },
    { templateId: "child_kid",    job: "villager",    x: 10, y: 6,  moves: true },
    { templateId: "male_elder",   job: "villager",    x: 6,  y: 10, moves: false },
  ],
  bogtown_city: [
    { templateId: "female_thin",  job: "merchant",    x: 4,  y: 5,  moves: false, shopIndex: 0 },
    { templateId: "male_tall",    job: "merchant",    x: 15, y: 5,  moves: false, shopIndex: 1 },
    { templateId: "male_stout",   job: "blacksmith",  x: 4,  y: 12, moves: false, shopIndex: 2 },
    { templateId: "female_stout", job: "innkeeper",   x: 15, y: 12, moves: false, shopIndex: 3 },
    { templateId: "child_boy2",   job: "villager",    x: 10, y: 8,  moves: true },
    { templateId: "female_elder", job: "cook",        x: 8,  y: 7,  moves: false },
    { templateId: "male_young",   job: "farmer",      x: 13, y: 9,  moves: true },
  ],
  thornvale_city: [
    { templateId: "male_tall",    job: "blacksmith",  x: 6,  y: 4,  moves: false, shopIndex: 0 },
    { templateId: "female_tall",  job: "merchant",    x: 13, y: 4,  moves: false, shopIndex: 1 },
    { templateId: "male_young",   job: "merchant",    x: 6,  y: 11, moves: false, shopIndex: 2 },
    { templateId: "female_young", job: "innkeeper",   x: 13, y: 11, moves: false, shopIndex: 3 },
    { templateId: "child_girl2",  job: "villager",    x: 10, y: 7,  moves: true },
    { templateId: "male_elder",   job: "farmer",      x: 8,  y: 6,  moves: false },
    { templateId: "female_stout", job: "cook",        x: 12, y: 6,  moves: false },
  ],
  ashfall_city: [
    { templateId: "male_stout",   job: "blacksmith",  x: 5,  y: 5,  moves: false, shopIndex: 0 },
    { templateId: "female_stout", job: "merchant",    x: 14, y: 5,  moves: false, shopIndex: 1 },
    { templateId: "male_thin",    job: "merchant",    x: 8,  y: 8,  moves: false, shopIndex: 2 },
    { templateId: "female_tall",  job: "innkeeper",   x: 11, y: 8,  moves: false, shopIndex: 3 },
    { templateId: "female_thin",  job: "merchant",    x: 5,  y: 12, moves: false, shopIndex: 4 },
    { templateId: "male_tall",    job: "merchant",    x: 14, y: 12, moves: false, shopIndex: 5 },
    { templateId: "child_boy1",   job: "villager",    x: 10, y: 6,  moves: true },
    { templateId: "male_elder",   job: "villager",    x: 7,  y: 10, moves: false },
  ],
  dunerest_city: [
    { templateId: "male_thin",    job: "blacksmith",  x: 4,  y: 4,  moves: false, shopIndex: 0 },
    { templateId: "female_thin",  job: "merchant",    x: 15, y: 4,  moves: false, shopIndex: 1 },
    { templateId: "male_young",   job: "merchant",    x: 4,  y: 12, moves: false, shopIndex: 2 },
    { templateId: "female_young", job: "innkeeper",   x: 15, y: 12, moves: false, shopIndex: 3 },
    { templateId: "child_girl1",  job: "villager",    x: 10, y: 7,  moves: true },
    { templateId: "male_stout",   job: "cook",        x: 8,  y: 9,  moves: false },
    { templateId: "female_elder", job: "farmer",      x: 12, y: 9,  moves: true },
  ],
  ridgewatch_city: [
    { templateId: "male_stout",   job: "blacksmith",  x: 5,  y: 4,  moves: false, shopIndex: 0 },
    { templateId: "female_tall",  job: "merchant",    x: 14, y: 4,  moves: false, shopIndex: 1 },
    { templateId: "male_tall",    job: "merchant",    x: 5,  y: 12, moves: false, shopIndex: 2 },
    { templateId: "female_stout", job: "innkeeper",   x: 14, y: 12, moves: false, shopIndex: 3 },
    { templateId: "child_kid",    job: "villager",    x: 10, y: 8,  moves: true },
    { templateId: "male_elder",   job: "villager",    x: 8,  y: 6,  moves: false },
    { templateId: "female_young", job: "farmer",      x: 12, y: 6,  moves: true },
  ],
  shadowfen_city: [
    { templateId: "female_thin",  job: "merchant",    x: 5,  y: 4,  moves: false, shopIndex: 0 },
    { templateId: "male_tall",    job: "blacksmith",  x: 14, y: 4,  moves: false, shopIndex: 1 },
    { templateId: "male_young",   job: "merchant",    x: 5,  y: 12, moves: false, shopIndex: 2 },
    { templateId: "female_stout", job: "innkeeper",   x: 14, y: 12, moves: false, shopIndex: 3 },
    { templateId: "child_boy2",   job: "villager",    x: 10, y: 7,  moves: true },
    { templateId: "female_elder", job: "villager",    x: 8,  y: 9,  moves: false },
    { templateId: "male_stout",   job: "cook",        x: 12, y: 9,  moves: false },
  ],
};

// ── Helpers ──

export function getNpcTemplate(id: string): NpcTemplate | undefined {
  return NPC_TEMPLATES.find((t) => t.id === id);
}

/**
 * Build deterministic NPC colour overrides for a given city + index.
 * Uses simple hashing so each NPC always looks the same on repeat visits.
 */
export function getNpcColors(cityId: string, index: number): {
  skinColor: number;
  hairColor: number;
  dressColor: number;
} {
  // Simple deterministic hash from cityId + index
  let hash = index * 7;
  for (let i = 0; i < cityId.length; i++) {
    hash = ((hash << 5) - hash + cityId.charCodeAt(i)) | 0;
  }
  const abs = Math.abs(hash);
  return {
    skinColor: NPC_SKIN_COLORS[abs % NPC_SKIN_COLORS.length],
    hairColor: NPC_HAIR_COLORS[(abs >> 4) % NPC_HAIR_COLORS.length],
    dressColor: NPC_DRESS_COLORS[(abs >> 8) % NPC_DRESS_COLORS.length],
  };
}

/**
 * Pick a dialogue line for a regular (non-shopkeeper) NPC.
 * Uses deterministic selection so the same NPC always says the same thing.
 */
export function getNpcDialogue(cityId: string, index: number, ageGroup: NpcAgeGroup): string {
  const pool = ageGroup === "child" ? CHILD_DIALOGUES : VILLAGER_DIALOGUES;
  let hash = index * 13;
  for (let i = 0; i < cityId.length; i++) {
    hash = ((hash << 5) - hash + cityId.charCodeAt(i)) | 0;
  }
  return pool[Math.abs(hash) % pool.length];
}

/**
 * Pick a shopkeeper dialogue line for a given shop type.
 */
export function getShopkeeperDialogue(shopType: string, index: number): string {
  const pool = SHOPKEEPER_DIALOGUES[shopType] ?? SHOPKEEPER_DIALOGUES["general"];
  return pool[Math.abs(index) % pool.length];
}
