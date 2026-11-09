export interface InteriorStudy {
  readonly id: string;
  readonly cityId: string;
  readonly label: string;
  readonly spellId: string;
  readonly classIds: readonly BaseClassId[];
  readonly minimumRank: number;
  readonly stat: "intelligence" | "wisdom" | "charisma";
}

/** Only three original manuscripts teach a modest extra base spell, never a path-only grant. */
export const INTERIOR_STUDIES: readonly InteriorStudy[] = [
  { id: "winterPrimer", cityId: "frostheim_city", label: "The Winter Primer", spellId: "rayOfFrost",
    classIds: ["sorcerer", "warlock", "bard"], minimumRank: 4, stat: "charisma" },
  { id: "rootAndEmber", cityId: "deeproot_city", label: "Root and Ember", spellId: "produceFlame",
    classIds: ["ranger", "cleric"], minimumRank: 4, stat: "wisdom" },
  { id: "copperCircuit", cityId: "ironhold_city", label: "The Copper Circuit", spellId: "shockingGrasp",
    classIds: ["sorcerer", "warlock", "bard"], minimumRank: 4, stat: "charisma" },
];

export const INTERIOR_PRIMER_ID = "historyRoadsAndRest";
export const INTERIOR_PRIMER_TEXT: readonly string[] = [
  "A traveler leaves a town with more than provisions. An open kitchen, a borrowed bed and a well-kept library are the quiet work that keeps the roads alive.",
  "The margins describe how river towns exchange seeds with the woodland settlements, while northern cellars preserve the harvest through the long frost.",
  "A final note asks the reader to take only the offered supplies, leave the shelves in order, and carry a little of that hospitality to the next town.",
];
import type { BaseClassId } from "./classProgression";
