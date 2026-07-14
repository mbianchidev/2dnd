import type { PlayerStats } from "../systems/player";

export const COMPANION_IDS = ["guardian", "scout", "mystic"] as const;

export type CompanionId = (typeof COMPANION_IDS)[number];
export type CompanionControlMode = "manual" | "gambit";

export interface CompanionLoadout {
  minLevel: number;
  itemIds: string[];
  equippedWeaponId?: string;
  equippedArmorId?: string;
  equippedShieldId?: string;
}

export interface CompanionDefinition {
  id: CompanionId;
  name: string;
  classId: "paladin" | "ranger" | "cleric";
  baseStats: PlayerStats;
  customAppearance: {
    skinColor: number;
    hairStyle: number;
    hairColor: number;
  };
  dialogue: string[];
  loadouts: CompanionLoadout[];
}

export const COMPANION_DEFINITIONS: CompanionDefinition[] = [
  {
    id: "guardian",
    name: "Bram Ironward",
    classId: "paladin",
    baseStats: {
      strength: 15,
      dexterity: 10,
      constitution: 14,
      intelligence: 8,
      wisdom: 10,
      charisma: 14,
    },
    customAppearance: {
      skinColor: 0xc68642,
      hairStyle: 1,
      hairColor: 0x3e2723,
    },
    dialogue: [
      "A shield is a promise. I intend to keep mine.",
      "We should check everyone's supplies before the next fight.",
      "Point me toward the danger. I will hold the line.",
      "No road stays closed forever when good people stand together.",
    ],
    loadouts: [
      {
        minLevel: 1,
        itemIds: ["startSword", "woodenShield", "potion"],
        equippedWeaponId: "startSword",
        equippedShieldId: "woodenShield",
      },
      {
        minLevel: 5,
        itemIds: ["longSword", "chainMail", "ironShield", "greaterPotion"],
        equippedWeaponId: "longSword",
        equippedArmorId: "chainMail",
        equippedShieldId: "ironShield",
      },
      {
        minLevel: 9,
        itemIds: ["longSword", "plateArmor", "towerShield", "greaterPotion", "ether"],
        equippedWeaponId: "longSword",
        equippedArmorId: "plateArmor",
        equippedShieldId: "towerShield",
      },
      {
        minLevel: 13,
        itemIds: ["longSword", "plateArmor", "towerShield", "greaterPotion", "greaterPotion", "ether"],
        equippedWeaponId: "longSword",
        equippedArmorId: "plateArmor",
        equippedShieldId: "towerShield",
      },
      {
        minLevel: 17,
        itemIds: ["longSword", "plateArmor", "towerShield", "greaterPotion", "greaterPotion", "ether", "antidote"],
        equippedWeaponId: "longSword",
        equippedArmorId: "plateArmor",
        equippedShieldId: "towerShield",
      },
    ],
  },
  {
    id: "scout",
    name: "Kaia Swiftstep",
    classId: "ranger",
    baseStats: {
      strength: 10,
      dexterity: 15,
      constitution: 13,
      intelligence: 10,
      wisdom: 14,
      charisma: 10,
    },
    customAppearance: {
      skinColor: 0xd7a97c,
      hairStyle: 2,
      hairColor: 0x5d4037,
    },
    dialogue: [
      "The quiet trail usually tells the loudest story.",
      "I can range ahead, but I will not leave the party behind.",
      "Watch the ridgelines. Trouble likes the high ground.",
      "A clean escape is useful. A clean shot is better.",
    ],
    loadouts: [
      {
        minLevel: 1,
        itemIds: ["startBow", "leatherArmor", "potion"],
        equippedWeaponId: "startBow",
        equippedArmorId: "leatherArmor",
      },
      {
        minLevel: 5,
        itemIds: ["startBow", "leatherArmor", "greaterPotion", "antidote"],
        equippedWeaponId: "startBow",
        equippedArmorId: "leatherArmor",
      },
      {
        minLevel: 9,
        itemIds: ["startBow", "leatherArmor", "greaterPotion", "ether", "antidote"],
        equippedWeaponId: "startBow",
        equippedArmorId: "leatherArmor",
      },
      {
        minLevel: 13,
        itemIds: ["canyonBow", "leatherArmor", "greaterPotion", "ether", "antidote"],
        equippedWeaponId: "canyonBow",
        equippedArmorId: "leatherArmor",
      },
      {
        minLevel: 17,
        itemIds: ["canyonBow", "leatherArmor", "greaterPotion", "greaterPotion", "ether", "antidote"],
        equippedWeaponId: "canyonBow",
        equippedArmorId: "leatherArmor",
      },
    ],
  },
  {
    id: "mystic",
    name: "Selene Vey",
    classId: "cleric",
    baseStats: {
      strength: 8,
      dexterity: 12,
      constitution: 14,
      intelligence: 12,
      wisdom: 15,
      charisma: 11,
    },
    customAppearance: {
      skinColor: 0xffccbc,
      hairStyle: 3,
      hairColor: 0xeeeeee,
    },
    dialogue: [
      "Magic answers best when we listen before we command it.",
      "A wound ignored becomes a battle lost.",
      "The old wards are restless. Stay close.",
      "Courage is contagious. Let us spread it.",
    ],
    loadouts: [
      {
        minLevel: 1,
        itemIds: ["startMace", "woodenShield", "ether"],
        equippedWeaponId: "startMace",
        equippedShieldId: "woodenShield",
      },
      {
        minLevel: 5,
        itemIds: ["startMace", "chainMail", "woodenShield", "ether", "potion"],
        equippedWeaponId: "startMace",
        equippedArmorId: "chainMail",
        equippedShieldId: "woodenShield",
      },
      {
        minLevel: 9,
        itemIds: ["startMace", "chainMail", "ironShield", "ether", "greaterPotion"],
        equippedWeaponId: "startMace",
        equippedArmorId: "chainMail",
        equippedShieldId: "ironShield",
      },
      {
        minLevel: 13,
        itemIds: ["startMace", "plateArmor", "ironShield", "ether", "ether", "greaterPotion"],
        equippedWeaponId: "startMace",
        equippedArmorId: "plateArmor",
        equippedShieldId: "ironShield",
      },
      {
        minLevel: 17,
        itemIds: ["startMace", "plateArmor", "towerShield", "ether", "ether", "greaterPotion", "antidote"],
        equippedWeaponId: "startMace",
        equippedArmorId: "plateArmor",
        equippedShieldId: "towerShield",
      },
    ],
  },
];

export function isCompanionId(value: unknown): value is CompanionId {
  return typeof value === "string"
    && COMPANION_IDS.includes(value as CompanionId);
}

export function getCompanionDefinition(
  id: string,
): CompanionDefinition | undefined {
  return COMPANION_DEFINITIONS.find((definition) => definition.id === id);
}
