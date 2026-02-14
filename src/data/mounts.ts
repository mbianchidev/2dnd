/**
 * Mount definitions for overworld travel.
 *
 * Mounts increase movement speed and may grant special abilities
 * such as reduced encounter rates or terrain traversal.
 */

export interface MountAbility {
  /** Unique ability identifier. */
  id: string;
  /** Human-readable label. */
  name: string;
  /** Short description shown in UI. */
  description: string;
}

export interface MountData {
  /** Unique camelCase identifier. */
  id: string;
  /** Display name. */
  name: string;
  /** Flavor text. */
  description: string;
  /** Gold cost in shops (0 = quest reward only). */
  cost: number;
  /**
   * Movement speed multiplier.
   * 1.0 = normal, 1.5 = 50% faster, 2.0 = double speed.
   * Applied by halving `moveDelay` proportionally.
   */
  speedMultiplier: number;
  /**
   * Encounter-rate multiplier while mounted (1.0 = normal, 0.5 = half).
   */
  encounterMultiplier: number;
  /** Optional special abilities. */
  abilities: MountAbility[];
}

// ── Ability constants ────────────────────────────────────────────
export const MOUNT_ABILITY_AVOID_ENCOUNTERS: MountAbility = {
  id: "avoidEncounters",
  name: "Swift Escape",
  description: "Greatly reduces random encounter rate",
};

export const MOUNT_ABILITY_CROSS_RIVERS: MountAbility = {
  id: "crossRivers",
  name: "Water Stride",
  description: "Can traverse shallow water tiles",
};

// ── Mount catalogue ──────────────────────────────────────────────
export const MOUNTS: MountData[] = [
  {
    id: "donkey",
    name: "Donkey",
    description: "A sturdy pack animal. Slightly faster than walking.",
    cost: 75,
    speedMultiplier: 1.25,
    encounterMultiplier: 0.9,
    abilities: [],
  },
  {
    id: "horse",
    name: "Horse",
    description: "A reliable steed for overland travel.",
    cost: 200,
    speedMultiplier: 1.5,
    encounterMultiplier: 0.75,
    abilities: [],
  },
  {
    id: "warHorse",
    name: "War Horse",
    description: "A powerful warhorse bred for battle and speed.",
    cost: 500,
    speedMultiplier: 1.75,
    encounterMultiplier: 0.7,
    abilities: [],
  },
  {
    id: "shadowSteed",
    name: "Shadow Steed",
    description: "A rare magical mount that moves like the wind and shuns danger.",
    cost: 0, // quest reward only
    speedMultiplier: 2.0,
    encounterMultiplier: 0.4,
    abilities: [MOUNT_ABILITY_AVOID_ENCOUNTERS],
  },
];

/** Look up a mount definition by ID. */
export function getMount(id: string): MountData | undefined {
  return MOUNTS.find((m) => m.id === id);
}

/** Get all mounts available for purchase (cost > 0). */
export function getShopMounts(): MountData[] {
  return MOUNTS.filter((m) => m.cost > 0);
}
