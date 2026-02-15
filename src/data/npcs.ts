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

  // ── Guards (2) ──
  { id: "guard_male",   ageGroup: "male",   label: "Guard",       bodyColor: 0x546e7a, heightScale: 1.0 },
  { id: "guard_female", ageGroup: "female", label: "Guard",       bodyColor: 0x546e7a, heightScale: 1.0 },
];

// ── Jobs ──

export type NpcJob =
  | "blacksmith"
  | "innkeeper"
  | "farmer"
  | "merchant"
  | "cook"
  | "villager"
  | "guard"
  | "stablemaster";

/** Accent colour applied to the NPC's apron / accessory based on job. */
export const JOB_ACCENT_COLORS: Record<NpcJob, number> = {
  blacksmith: 0x37474f,
  innkeeper: 0x6d4c41,
  farmer: 0x558b2f,
  merchant: 0xf9a825,
  cook: 0xfafafa,
  villager: 0x90a4ae,
  guard: 0x455a64,
  stablemaster: 0x795548,
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
  stable: [
    "Looking for a trusty steed?",
    "A good mount makes all the difference.",
    "These are the finest beasts around!",
    "Hop on and ride—your journey awaits.",
  ],
};

/** Dialogue for animal NPCs — simple sounds. */
/** Dialogue sounds for city animals, keyed by sprite name. */
export const ANIMAL_DIALOGUES: Record<string, string[]> = {
  sprite_cow:     ["Moo!", "Mooo...", "*chews cud*"],
  sprite_cat:     ["Meow!", "Mrrrow.", "Purrrr...", "*licks paw*"],
  sprite_dog:     ["Woof!", "Bark bark!", "*wags tail*", "Arf!"],
  sprite_chicken: ["Bawk bawk!", "Cluck cluck.", "*pecks at ground*"],
  sprite_horse:   ["Neigh!", "*snorts*", "*stomps hoof*", "Whinny!"],
  sprite_sheep:   ["Baa!", "Baaah...", "*nibbles grass*"],
  sprite_mouse:   ["Squeak!", "*scurries*", "Eek!"],
  sprite_frog:    ["Ribbit!", "Croak.", "*splash*"],
  sprite_lizard:  ["*blinks slowly*", "*flicks tongue*", "..."],
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

/** Guard NPC dialogue pool. */
export const GUARD_DIALOGUES: string[] = [
  "Move along, citizen.",
  "Stay out of trouble.",
  "The city is under our protection.",
  "No funny business on my watch.",
  "Keep your weapons sheathed in town.",
  "Report any suspicious activity.",
  "Halt! ...oh, you're just an adventurer. Carry on.",
  "The roads outside are dangerous. Be careful.",
  "I've been on duty since dawn. Ugh.",
  "We don't tolerate troublemakers here.",
];

// ── Night-specific dialogue pools ──

/** Villager phrases used during night hours. */
export const VILLAGER_NIGHT_DIALOGUES: string[] = [
  "Can't sleep... too many strange noises.",
  "What are you doing out so late?",
  "The monsters are worse after dark.",
  "I should be in bed...",
  "The stars are beautiful tonight.",
  "Keep your voice down, people are sleeping!",
  "I heard something howling earlier...",
  "Be careful, the streets aren't safe at night.",
  "The inn's still open if you need rest.",
  "Quiet night... almost too quiet.",
];

/** Guard NPC dialogue during night hours. */
export const GUARD_NIGHT_DIALOGUES: string[] = [
  "Night patrol. Stay vigilant.",
  "The gates are closed until dawn.",
  "Keep off the streets after dark.",
  "I heard something by the walls...",
  "Another long night shift...",
  "No trouble tonight, I hope.",
  "The torches are burning low.",
  "Watch your step in the dark.",
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
    { templateId: "male_stout",   job: "blacksmith",    x: 4,  y: 5,  moves: false, shopIndex: 0 },
    { templateId: "female_tall",  job: "merchant",      x: 15, y: 5,  moves: false, shopIndex: 1 },
    { templateId: "male_tall",    job: "merchant",      x: 4,  y: 12, moves: false, shopIndex: 2 },
    { templateId: "female_stout", job: "innkeeper",     x: 15, y: 12, moves: false, shopIndex: 3 },
    { templateId: "male_elder",   job: "stablemaster",  x: 10, y: 5,  moves: false, shopIndex: 4 },
    { templateId: "child_boy1",   job: "villager",      x: 8,  y: 7,  moves: true },
    { templateId: "child_girl1",  job: "villager",      x: 12, y: 8,  moves: true },
    { templateId: "female_young", job: "villager",      x: 6,  y: 9,  moves: true },
  ],
  ironhold_city: [
    { templateId: "male_stout",   job: "blacksmith",    x: 4,  y: 3,  moves: false, shopIndex: 0 },
    { templateId: "male_tall",    job: "merchant",      x: 15, y: 3,  moves: false, shopIndex: 1 },
    { templateId: "female_thin",  job: "merchant",      x: 8,  y: 6,  moves: false, shopIndex: 2 },
    { templateId: "female_stout", job: "innkeeper",     x: 11, y: 6,  moves: false, shopIndex: 3 },
    { templateId: "male_young",   job: "stablemaster",  x: 10, y: 10, moves: false, shopIndex: 4 },
    { templateId: "child_boy2",   job: "villager",      x: 8,  y: 8,  moves: true },
    { templateId: "female_elder", job: "farmer",        x: 14, y: 10, moves: false },
    { templateId: "guard_male",   job: "guard",         x: 9,  y: 12, moves: false },
    { templateId: "guard_female", job: "guard",         x: 11, y: 12, moves: false },
  ],
  sandport_city: [
    { templateId: "male_thin",    job: "blacksmith",    x: 4,  y: 4,  moves: false, shopIndex: 0 },
    { templateId: "female_tall",  job: "merchant",      x: 15, y: 4,  moves: false, shopIndex: 1 },
    { templateId: "male_elder",   job: "merchant",      x: 4,  y: 8,  moves: false, shopIndex: 2 },
    { templateId: "female_young", job: "innkeeper",     x: 15, y: 8,  moves: false, shopIndex: 3 },
    { templateId: "male_young",   job: "merchant",      x: 5,  y: 12, moves: false, shopIndex: 4 },
    { templateId: "female_stout", job: "merchant",      x: 14, y: 12, moves: false, shopIndex: 5 },
    { templateId: "male_stout",   job: "stablemaster",  x: 10, y: 8,  moves: false, shopIndex: 6 },
    { templateId: "child_girl2",  job: "villager",      x: 9,  y: 3,  moves: true },
    { templateId: "child_kid",    job: "villager",      x: 8,  y: 9,  moves: true },
  ],
  frostheim_city: [
    { templateId: "female_thin",  job: "merchant",    x: 4,  y: 4,  moves: false, shopIndex: 0 },
    { templateId: "male_stout",   job: "merchant",    x: 15, y: 4,  moves: false, shopIndex: 1 },
    { templateId: "male_tall",    job: "blacksmith",  x: 4,  y: 11, moves: false, shopIndex: 2 },
    { templateId: "female_stout", job: "innkeeper",   x: 8,  y: 11, moves: false, shopIndex: 3 },
    { templateId: "male_young",   job: "merchant",    x: 11, y: 11, moves: false, shopIndex: 4 },
    { templateId: "female_tall",  job: "blacksmith",  x: 14, y: 11, moves: false, shopIndex: 5 },
    { templateId: "child_boy1",   job: "villager",    x: 10, y: 5,  moves: true },
    { templateId: "male_elder",   job: "farmer",      x: 6,  y: 8,  moves: false },
    { templateId: "guard_male",   job: "guard",       x: 9,  y: 12, moves: false },
  ],
  deeproot_city: [
    { templateId: "male_tall",    job: "blacksmith",  x: 5,  y: 4,  moves: false, shopIndex: 0 },
    { templateId: "female_thin",  job: "merchant",    x: 14, y: 4,  moves: false, shopIndex: 1 },
    { templateId: "male_young",   job: "merchant",    x: 5,  y: 12, moves: false, shopIndex: 2 },
    { templateId: "female_young", job: "innkeeper",   x: 14, y: 12, moves: false, shopIndex: 3 },
    { templateId: "child_girl1",  job: "villager",    x: 10, y: 4,  moves: true },
    { templateId: "female_elder", job: "cook",        x: 8,  y: 8,  moves: false },
    { templateId: "male_stout",   job: "farmer",      x: 12, y: 8,  moves: true },
  ],
  canyonwatch_city: [
    { templateId: "male_stout",   job: "blacksmith",  x: 3,  y: 3,  moves: false, shopIndex: 0 },
    { templateId: "female_stout", job: "merchant",    x: 16, y: 3,  moves: false, shopIndex: 1 },
    { templateId: "male_thin",    job: "merchant",    x: 7,  y: 8,  moves: false, shopIndex: 2 },
    { templateId: "female_tall",  job: "innkeeper",   x: 12, y: 8,  moves: false, shopIndex: 3 },
    { templateId: "child_kid",    job: "villager",    x: 10, y: 6,  moves: true },
    { templateId: "male_elder",   job: "villager",    x: 6,  y: 10, moves: false },
    { templateId: "guard_male",   job: "guard",       x: 9,  y: 12, moves: false },
    { templateId: "guard_female", job: "guard",       x: 11, y: 12, moves: false },
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
    { templateId: "female_stout", job: "cook",        x: 11, y: 6,  moves: false },
  ],
  ashfall_city: [
    { templateId: "male_stout",   job: "blacksmith",  x: 4,  y: 4,  moves: false, shopIndex: 0 },
    { templateId: "female_stout", job: "merchant",    x: 15, y: 4,  moves: false, shopIndex: 1 },
    { templateId: "male_thin",    job: "merchant",    x: 7,  y: 7,  moves: false, shopIndex: 2 },
    { templateId: "female_tall",  job: "innkeeper",   x: 12, y: 7,  moves: false, shopIndex: 3 },
    { templateId: "female_thin",  job: "merchant",    x: 4,  y: 11, moves: false, shopIndex: 4 },
    { templateId: "male_tall",    job: "merchant",    x: 15, y: 11, moves: false, shopIndex: 5 },
    { templateId: "child_boy1",   job: "villager",    x: 10, y: 9,  moves: true },
    { templateId: "male_elder",   job: "villager",    x: 7,  y: 9,  moves: false },
    { templateId: "guard_male",   job: "guard",       x: 9,  y: 12, moves: false },
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
    { templateId: "guard_male",   job: "guard",       x: 9,  y: 12, moves: false },
    { templateId: "guard_female", job: "guard",       x: 11, y: 12, moves: false },
  ],
  shadowfen_city: [
    { templateId: "female_thin",  job: "merchant",    x: 5,  y: 4,  moves: false, shopIndex: 0 },
    { templateId: "male_tall",    job: "blacksmith",  x: 14, y: 4,  moves: false, shopIndex: 1 },
    { templateId: "male_young",   job: "merchant",    x: 5,  y: 12, moves: false, shopIndex: 2 },
    { templateId: "female_stout", job: "innkeeper",   x: 14, y: 12, moves: false, shopIndex: 3 },
    { templateId: "child_boy2",   job: "villager",    x: 10, y: 7,  moves: true },
    { templateId: "female_elder", job: "villager",    x: 8,  y: 9,  moves: false },
    { templateId: "male_stout",   job: "cook",        x: 11, y: 9,  moves: false },
  ],
};

// ── Special / Rare NPC types ──

export type SpecialNpcKind = "traveler" | "adventurer" | "wanderingMerchant" | "hermit";

export const SPECIAL_NPC_KINDS: SpecialNpcKind[] = [
  "traveler",
  "adventurer",
  "wanderingMerchant",
  "hermit",
];

export interface SpecialNpcDef {
  kind: SpecialNpcKind;
  label: string;
  templateId: string;
  /** Tint colour for the special NPC sprite. */
  tintColor: number;
  /** Base spawn probability when entering a new overworld chunk (0–1). */
  spawnChance: number;
  /** Whether this NPC wanders. */
  moves: boolean;
  /** For wanderingMerchant — item IDs available to buy. */
  shopItems?: string[];
}

/** Serialisable snapshot of a special NPC for persistence across scene transitions. */
export interface SavedSpecialNpc {
  kind: SpecialNpcKind;
  x: number;
  y: number;
  interactions: number;
}

export const SPECIAL_NPC_DEFS: Record<SpecialNpcKind, SpecialNpcDef> = {
  traveler: {
    kind: "traveler",
    label: "Traveler",
    templateId: "male_young",
    tintColor: 0x4dd0e1,
    spawnChance: 0.025,
    moves: true,
  },
  adventurer: {
    kind: "adventurer",
    label: "Adventurer",
    templateId: "male_stout",
    tintColor: 0xffa000,
    spawnChance: 0.025,
    moves: false,
  },
  wanderingMerchant: {
    kind: "wanderingMerchant",
    label: "Wandering Merchant",
    templateId: "female_stout",
    tintColor: 0xffd740,
    spawnChance: 0.025,
    moves: false,
    shopItems: ["potion", "ether"],
  },
  hermit: {
    kind: "hermit",
    label: "Hermit",
    templateId: "male_elder",
    tintColor: 0x90a4ae,
    spawnChance: 0.025,
    moves: false,
  },
};

/** Dialogue pool for the friendly but clueless Traveler. */
export const TRAVELER_DIALOGUES: string[] = [
  "Oh hello! I'm just passing through.",
  "Is this the road to... anywhere?",
  "I've been walking for days! Lovely scenery though.",
  "Do you know where the nearest inn is? I forgot.",
  "I thought I saw a dragon! ...It was a cloud.",
  "Traveling is so exciting! And confusing.",
  "I'm sure this map is upside down.",
  "The stars are beautiful out here. No idea which way is north, though!",
];

/** Dialogue pool for the grumpy but wise Adventurer. */
export const ADVENTURER_DIALOGUES: string[] = [
  "Hmph. Another rookie. Fine, listen up...",
  "Save before a boss fight. Trust me.",
  "Don't waste gold on weak gear. Save for plate armour.",
  "Night monsters are tougher. Travel during the day if you're weak.",
  "Always keep potions stocked. You'll thank me later.",
  "The dungeons get harder the further east you go.",
  "Grumble... I've cleared more dungeons than you've had hot meals.",
  "Check the bestiary. Knowing your enemy's AC helps you plan.",
];

/** Dialogue pool for the Wandering Merchant. */
export const WANDERING_MERCHANT_DIALOGUES: string[] = [
  "Psst! Rare wares, traveler. Take a look!",
  "I carry only the finest portable goods.",
  "Special prices, just for you!",
  "My pack is light today—buy something, won't you?",
];

/** Dialogue pool for the reclusive Hermit. Lines cycle, then dismissal. */
export const HERMIT_DIALOGUES: string[] = [
  "...what do you want?",
  "Leave me alone. I came here to be alone.",
  "Fine. One thing: beware the eastern wastes. Now go away.",
];

/** The hermit's farewell line when they leave. */
export const HERMIT_FAREWELL = "I said LEAVE. *walks away*";

/** Farewell lines for each special NPC kind (shown before despawn). */
export const SPECIAL_NPC_FAREWELLS: Record<SpecialNpcKind, string> = {
  traveler: "Well, I should be off! Safe travels, friend!",
  adventurer: "That's all I've got for you. Now scram.",
  wanderingMerchant: "I must move on to the next town. Farewell!",
  hermit: HERMIT_FAREWELL,
};

/**
 * Get a dialogue line for a special NPC.  Returns the farewell line once
 * all unique lines have been spoken.
 */
export function getSpecialNpcDialogue(
  kind: SpecialNpcKind,
  interactionCount: number,
): string {
  switch (kind) {
    case "traveler":
      if (interactionCount < TRAVELER_DIALOGUES.length) {
        return TRAVELER_DIALOGUES[interactionCount];
      }
      return SPECIAL_NPC_FAREWELLS.traveler;
    case "adventurer":
      if (interactionCount < ADVENTURER_DIALOGUES.length) {
        return ADVENTURER_DIALOGUES[interactionCount];
      }
      return SPECIAL_NPC_FAREWELLS.adventurer;
    case "wanderingMerchant":
      if (interactionCount < WANDERING_MERCHANT_DIALOGUES.length) {
        return WANDERING_MERCHANT_DIALOGUES[interactionCount];
      }
      return SPECIAL_NPC_FAREWELLS.wanderingMerchant;
    case "hermit":
      if (interactionCount < HERMIT_DIALOGUES.length) {
        return HERMIT_DIALOGUES[interactionCount];
      }
      return HERMIT_FAREWELL;
  }
}

/**
 * Roll for which (if any) special NPCs should appear on the overworld.
 * Each kind is rolled independently.
 * @param chanceMultiplier  Scales the base spawn chance (default 1).
 *   After a special NPC has already appeared today the caller should
 *   pass a reduced value (e.g. 0) until the next dawn.
 */
export function rollSpecialNpcSpawns(chanceMultiplier = 1): SpecialNpcKind[] {
  const candidates: SpecialNpcKind[] = [];
  for (const kind of SPECIAL_NPC_KINDS) {
    if (Math.random() < SPECIAL_NPC_DEFS[kind].spawnChance * chanceMultiplier) {
      candidates.push(kind);
    }
  }
  if (candidates.length === 0) return [];
  // Special NPCs never spawn together — pick one at random
  return [candidates[Math.floor(Math.random() * candidates.length)]];
}

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
 * When `nightTime` is true, uses night-specific dialogue pools.
 */
export function getNpcDialogue(cityId: string, index: number, ageGroup: NpcAgeGroup, templateId?: string, nightTime = false): string {
  let pool: string[];
  if (templateId?.startsWith("guard_")) {
    pool = nightTime ? GUARD_NIGHT_DIALOGUES : GUARD_DIALOGUES;
  } else if (ageGroup === "child") {
    pool = CHILD_DIALOGUES;
  } else {
    pool = nightTime ? VILLAGER_NIGHT_DIALOGUES : VILLAGER_DIALOGUES;
  }
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
