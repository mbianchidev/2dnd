/**
 * Spell definitions with level requirements for unlocking.
 */

import type { DieType } from "../systems/dice";

export interface Spell {
  id: string;
  name: string;
  description: string;
  mpCost: number;
  levelRequired: number;
  damageCount: number; // number of dice
  damageDie: DieType; // die type
  type: "damage" | "heal" | "utility";
}

export const SPELLS: Spell[] = [
  // ── Cantrips (0 MP) ──────────────────────────────────────────
  { id: "fireBolt", name: "Fire Bolt", description: "Hurl a bolt of fire at a foe",
    mpCost: 0, levelRequired: 1, damageCount: 1, damageDie: 10, type: "damage" },
  { id: "eldritchBlast", name: "Eldritch Blast", description: "A beam of crackling eldritch energy",
    mpCost: 0, levelRequired: 1, damageCount: 1, damageDie: 10, type: "damage" },
  { id: "sacredFlame", name: "Sacred Flame", description: "Radiant flame descends on a foe",
    mpCost: 0, levelRequired: 1, damageCount: 1, damageDie: 8, type: "damage" },
  { id: "viciousMockery", name: "Vicious Mockery", description: "Insults laced with subtle enchantment",
    mpCost: 0, levelRequired: 1, damageCount: 1, damageDie: 4, type: "damage" },
  { id: "produceFlame", name: "Produce Flame", description: "A flickering flame appears in your hand",
    mpCost: 0, levelRequired: 1, damageCount: 1, damageDie: 8, type: "damage" },
  { id: "tollTheDead", name: "Toll the Dead", description: "The sound of a dolorous bell damages a creature",
    mpCost: 0, levelRequired: 1, damageCount: 1, damageDie: 12, type: "damage" },
  { id: "rayOfFrost", name: "Ray of Frost", description: "A frigid beam of blue-white light",
    mpCost: 0, levelRequired: 1, damageCount: 1, damageDie: 8, type: "damage" },
  { id: "shockingGrasp", name: "Shocking Grasp", description: "Lightning springs from your hand",
    mpCost: 0, levelRequired: 1, damageCount: 1, damageDie: 8, type: "damage" },
  { id: "wordOfRadiance", name: "Word of Radiance", description: "A divine word burns nearby foes",
    mpCost: 0, levelRequired: 1, damageCount: 1, damageDie: 6, type: "damage" },

  // ── 1st Level Spells ─────────────────────────────────────────
  { id: "cureWounds", name: "Cure Wounds", description: "Heal wounds with divine magic",
    mpCost: 2, levelRequired: 1, damageCount: 1, damageDie: 8, type: "heal" },
  { id: "healingWord", name: "Healing Word", description: "Quick healing incantation",
    mpCost: 2, levelRequired: 1, damageCount: 1, damageDie: 4, type: "heal" },
  { id: "magicMissile", name: "Magic Missile", description: "Three darts of magical force (auto-hit)",
    mpCost: 3, levelRequired: 2, damageCount: 3, damageDie: 4, type: "damage" },
  { id: "thunderwave", name: "Thunderwave", description: "A wave of thunderous force",
    mpCost: 3, levelRequired: 2, damageCount: 2, damageDie: 8, type: "damage" },
  { id: "hexCurse", name: "Hex", description: "Curse a foe, dealing necrotic damage",
    mpCost: 2, levelRequired: 2, damageCount: 1, damageDie: 6, type: "damage" },
  { id: "guidingBolt", name: "Guiding Bolt", description: "A flash of light streaks toward a creature",
    mpCost: 3, levelRequired: 2, damageCount: 4, damageDie: 6, type: "damage" },
  { id: "dissonantWhispers", name: "Dissonant Whispers", description: "Discordant melody wracks the target",
    mpCost: 3, levelRequired: 2, damageCount: 3, damageDie: 6, type: "damage" },
  { id: "hellishRebuke", name: "Hellish Rebuke", description: "Flames engulf the one who wronged you",
    mpCost: 3, levelRequired: 2, damageCount: 2, damageDie: 10, type: "damage" },
  { id: "huntersMark", name: "Hunter's Mark", description: "Mark prey for extra damage",
    mpCost: 2, levelRequired: 2, damageCount: 1, damageDie: 6, type: "damage" },
  { id: "goodberry", name: "Goodberry", description: "Create berries that restore vitality",
    mpCost: 2, levelRequired: 1, damageCount: 2, damageDie: 4, type: "heal" },

  // ── 2nd Level Spells ─────────────────────────────────────────
  { id: "scorchingRay", name: "Scorching Ray", description: "Three rays of fire streak toward targets",
    mpCost: 4, levelRequired: 4, damageCount: 6, damageDie: 6, type: "damage" },
  { id: "shatter", name: "Shatter", description: "A sudden loud noise deals thunder damage",
    mpCost: 4, levelRequired: 4, damageCount: 3, damageDie: 8, type: "damage" },
  { id: "moonbeam", name: "Moonbeam", description: "A silvery beam of pale light shines down",
    mpCost: 4, levelRequired: 4, damageCount: 2, damageDie: 10, type: "damage" },
  { id: "spiritualWeapon", name: "Spiritual Weapon", description: "A floating spectral weapon strikes",
    mpCost: 4, levelRequired: 4, damageCount: 1, damageDie: 8, type: "damage" },
  { id: "spikeGrowth", name: "Spike Growth", description: "Ground sprouts thorns that shred foes",
    mpCost: 4, levelRequired: 4, damageCount: 2, damageDie: 4, type: "damage" },

  // ── 3rd Level Spells ─────────────────────────────────────────
  { id: "fireball", name: "Fireball", description: "A bright streak explodes into flame",
    mpCost: 6, levelRequired: 6, damageCount: 8, damageDie: 6, type: "damage" },
  { id: "lightningBolt", name: "Lightning Bolt", description: "A stroke of lightning in a line",
    mpCost: 6, levelRequired: 6, damageCount: 8, damageDie: 6, type: "damage" },
  { id: "spiritGuardians", name: "Spirit Guardians", description: "Spectral spirits swirl and strike",
    mpCost: 6, levelRequired: 6, damageCount: 3, damageDie: 8, type: "damage" },
  { id: "callLightning", name: "Call Lightning", description: "A storm cloud appears and strikes",
    mpCost: 6, levelRequired: 6, damageCount: 3, damageDie: 10, type: "damage" },
  { id: "hungerOfHadar", name: "Hunger of Hadar", description: "A sphere of blackness and bitter cold",
    mpCost: 6, levelRequired: 6, damageCount: 4, damageDie: 6, type: "damage" },
  { id: "hypnoticPattern", name: "Synaptic Static", description: "Psychic energy explodes in the mind",
    mpCost: 7, levelRequired: 7, damageCount: 8, damageDie: 6, type: "damage" },

  // ── 4th Level Spells ─────────────────────────────────────────
  { id: "iceStorm", name: "Ice Storm", description: "Hail and freezing rain pound the area",
    mpCost: 8, levelRequired: 9, damageCount: 4, damageDie: 8, type: "damage" },
  { id: "flameStrike", name: "Flame Strike", description: "A column of divine fire roars down",
    mpCost: 8, levelRequired: 9, damageCount: 4, damageDie: 6, type: "damage" },
  { id: "greaterHeal", name: "Greater Heal", description: "Powerful restorative magic",
    mpCost: 8, levelRequired: 9, damageCount: 4, damageDie: 8, type: "heal" },
  { id: "massCureWounds", name: "Mass Cure Wounds", description: "Healing energy washes over allies",
    mpCost: 8, levelRequired: 9, damageCount: 3, damageDie: 8, type: "heal" },
  { id: "destructiveWave", name: "Destructive Wave", description: "Divine energy erupts in a shockwave",
    mpCost: 8, levelRequired: 9, damageCount: 5, damageDie: 6, type: "damage" },

  // ── 5th Level Spells ─────────────────────────────────────────
  { id: "coneOfCold", name: "Cone of Cold", description: "A blast of cold erupts from your hands",
    mpCost: 10, levelRequired: 11, damageCount: 8, damageDie: 8, type: "damage" },
  { id: "heal", name: "Heal", description: "A surge of positive energy cures wounds",
    mpCost: 10, levelRequired: 11, damageCount: 7, damageDie: 10, type: "heal" },
  { id: "sunbeam", name: "Sunbeam", description: "A beam of brilliant light sears foes",
    mpCost: 10, levelRequired: 11, damageCount: 6, damageDie: 8, type: "damage" },
  { id: "swiftQuiver", name: "Swift Quiver", description: "Arrows fly with supernatural speed",
    mpCost: 9, levelRequired: 11, damageCount: 4, damageDie: 8, type: "damage" },

  // ── 6th Level Spells ─────────────────────────────────────────
  { id: "chainLightning", name: "Chain Lightning", description: "Lightning arcs between targets",
    mpCost: 12, levelRequired: 13, damageCount: 10, damageDie: 8, type: "damage" },
  { id: "disintegrate", name: "Disintegrate", description: "A thin green ray reduces the target to dust",
    mpCost: 12, levelRequired: 13, damageCount: 10, damageDie: 6, type: "damage" },
  { id: "harm", name: "Harm", description: "Unleash a virulent disease on a creature",
    mpCost: 12, levelRequired: 13, damageCount: 14, damageDie: 6, type: "damage" },
  { id: "bladeBarrier", name: "Blade Barrier", description: "A wall of whirling blades shreds all",
    mpCost: 12, levelRequired: 13, damageCount: 6, damageDie: 10, type: "damage" },
  { id: "fireStorm", name: "Fire Storm", description: "A storm of fire rains from the sky",
    mpCost: 12, levelRequired: 13, damageCount: 7, damageDie: 10, type: "damage" },

  // ── 7th+ Level Spells ────────────────────────────────────────
  { id: "regenerate", name: "Regenerate", description: "Touch restores body and spirit",
    mpCost: 14, levelRequired: 15, damageCount: 4, damageDie: 8, type: "heal" },
  { id: "massHeal", name: "Mass Heal", description: "A flood of healing energy restores all",
    mpCost: 16, levelRequired: 17, damageCount: 10, damageDie: 10, type: "heal" },
  { id: "meteorSwarm", name: "Meteor Swarm", description: "Blazing orbs plummet from the sky",
    mpCost: 20, levelRequired: 19, damageCount: 24, damageDie: 6, type: "damage" },
  { id: "powerWordKill", name: "Power Word Kill", description: "A word of power that slays outright",
    mpCost: 20, levelRequired: 19, damageCount: 20, damageDie: 10, type: "damage" },

  // ── Utility ──────────────────────────────────────────────────
  { id: "teleport", name: "Teleport", description: "Instantly travel to a known town",
    mpCost: 8, levelRequired: 5, damageCount: 0, damageDie: 0, type: "utility" },
];

/** Look up a spell by ID. */
export function getSpell(id: string): Spell | undefined {
  return SPELLS.find((s) => s.id === id);
}

/** Get all spells available at a given player level. */
export function getAvailableSpells(level: number): Spell[] {
  return SPELLS.filter((s) => s.levelRequired <= level);
}
