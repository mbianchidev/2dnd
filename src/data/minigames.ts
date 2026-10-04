import type { PortId } from "./nautical";
import type { FactionId, TownId } from "./reputation";
import { TimePeriod } from "../systems/daynight";

export const MINIGAME_ACTIVITY_IDS = ["crownAndBones", "archery", "regatta"] as const;
export type MinigameActivityId = (typeof MINIGAME_ACTIVITY_IDS)[number];
export const MINIGAME_DIFFICULTY_IDS = ["friendly", "seasoned", "expert"] as const;
export type MinigameDifficultyId = (typeof MINIGAME_DIFFICULTY_IDS)[number];
export type MinigameRulesetId = "crownAndBonesV1" | "archeryV1" | "harborRegattaV1";
export type MinigameScoreId = "crownsHeld" | "archeryPrecision" | "regattaEfficiency";
export type MinigameRewardId = "crownBank" | "archeryLaurel" | "regattaPennant";

export interface MinigameActivityDefinition {
  readonly id: MinigameActivityId;
  readonly name: string;
  readonly rulesetId: MinigameRulesetId;
  readonly scoreId: MinigameScoreId;
  readonly rewardId: MinigameRewardId;
  readonly summary: string;
  readonly instructions: readonly string[];
  readonly practiceAvailable: boolean;
  readonly milestoneGold: readonly [number, number, number];
  readonly factionId: FactionId;
}

export interface MinigameDifficultyDefinition {
  readonly id: MinigameDifficultyId;
  readonly name: string;
  readonly entryFee: number;
  readonly crownStakeCap: number;
  readonly archeryPenalty: number;
  readonly archeryMeterStep: number;
  readonly regattaObstacles: number;
  readonly regattaWearCap: number;
  readonly regattaMoveLimit: number;
  readonly prerequisiteScore: number;
}

export const MINIGAME_ACTIVITIES: Readonly<Record<
  MinigameActivityId,
  MinigameActivityDefinition
>> = {
  crownAndBones: {
    id: "crownAndBones",
    name: "Crown & Bones",
    rulesetId: "crownAndBonesV1",
    scoreId: "crownsHeld",
    rewardId: "crownBank",
    summary: "An original four-roll push-your-luck tavern game. In-game gold only.",
    instructions: [
      "Roll two six-sided dice. A total of 7 is Bones: the hand ends and its stake is lost.",
      "Doubles are Crowns; other non-7 pairs are safe. Each safe roll scores 20, plus 5 for a Crown.",
      "Bank after 1/2/3/4 safe rolls for 0.5/1/1.5/2 times the stake, rounded down. Payout includes your stake.",
      "Four safe rolls bank automatically. Leaving or banking before the first roll forfeits the stake.",
      "Every roll has 6/36 Bones, 6/36 Crown, and 24/36 other safe outcomes. The next roll is never shown.",
    ],
    practiceAvailable: false,
    milestoneGold: [0, 0, 0],
    factionId: "roadwardens",
  },
  archery: {
    id: "archery",
    name: "Archery Challenge",
    rulesetId: "archeryV1",
    scoreId: "archeryPrecision",
    rewardId: "archeryLaurel",
    summary: "Five seeded targets, one borrowed bow, and identical scoring for every class.",
    instructions: [
      "Fire five arrows. Confirm releases the arrow at the visible meter position; left/right adjusts aim.",
      "Match the numbered target. Precision is 100 minus distance times the difficulty penalty, never below 0.",
      "The final score is the average of all five arrows. Class, stats, equipment, and input source grant no bonus.",
      "Reduced motion stops the meter; use left/right or the visible aim buttons before firing. Scores and targets stay identical.",
      "A score of 80+ refunds the entry fee. The first paid 80+ per difficulty grants a finite laurel bonus; practice grants no rewards.",
    ],
    practiceAvailable: true,
    milestoneGold: [8, 16, 24],
    factionId: "heartlandsWardens",
  },
  regatta: {
    id: "regatta",
    name: "Harbor Regatta",
    rulesetId: "harborRegattaV1",
    scoreId: "regattaEfficiency",
    rewardId: "regattaPennant",
    summary: "Steer an owned boat through ordered buoys, reefs, and a saved harbor forecast.",
    instructions: [
      "Use the four directions to sail one tile at a time. Visit numbered buoys in order, then reach F.",
      "B marks your boat, # marks a reef, and numbers mark buoys. The current position and next buoy are also written out.",
      "The saved forecast changes effort against the wind and periodic hull wear. The course always has a clear cardinal route.",
      "Collisions and extra effort reduce the score. Hull upgrades reduce wear; wear is capped and never strands a boat below 1 condition.",
      "An active owned boat at 20+ condition is required. Practice causes no wear or rewards. A paid 80+ refunds the fee and earns a first-only pennant bonus.",
      "The party remains at the venue: no campaign sailing, fog, encounters, quests, or travel state changes.",
    ],
    practiceAvailable: true,
    milestoneGold: [10, 20, 30],
    factionId: "sunRoadCompact",
  },
};

export const MINIGAME_DIFFICULTIES: Readonly<Record<
  MinigameDifficultyId,
  MinigameDifficultyDefinition
>> = {
  friendly: {
    id: "friendly", name: "Friendly", entryFee: 5, crownStakeCap: 5,
    archeryPenalty: 4, archeryMeterStep: 2,
    regattaObstacles: 5, regattaWearCap: 4, regattaMoveLimit: 60,
    prerequisiteScore: 0,
  },
  seasoned: {
    id: "seasoned", name: "Seasoned", entryFee: 10, crownStakeCap: 10,
    archeryPenalty: 5, archeryMeterStep: 3,
    regattaObstacles: 9, regattaWearCap: 8, regattaMoveLimit: 70,
    prerequisiteScore: 60,
  },
  expert: {
    id: "expert", name: "Expert", entryFee: 20, crownStakeCap: 20,
    archeryPenalty: 6, archeryMeterStep: 4,
    regattaObstacles: 13, regattaWearCap: 12, regattaMoveLimit: 80,
    prerequisiteScore: 70,
  },
};

export interface MinigameVenueDefinition {
  readonly id: string;
  readonly name: string;
  readonly activityId: MinigameActivityId;
  readonly cityId: TownId;
  readonly cityChunkIndex: number;
  readonly x: number;
  readonly y: number;
  readonly portId?: PortId;
  readonly periods?: readonly TimePeriod[];
  readonly festival?: boolean;
}

export const MINIGAME_VENUES = [
  {
    id: "willowInnTable", name: "Willow Inn Dice Table", activityId: "crownAndBones",
    cityId: "willowdale_city", cityChunkIndex: 0, x: 13, y: 12,
  },
  {
    id: "desertRoseTable", name: "Desert Rose Dice Table", activityId: "crownAndBones",
    cityId: "sandport_city", cityChunkIndex: 0, x: 13, y: 8,
  },
  {
    id: "willowdaleRange", name: "Willowdale Practice Range", activityId: "archery",
    cityId: "willowdale_city", cityChunkIndex: 0, x: 5, y: 12,
  },
  {
    id: "thornvaleFestival", name: "Thornvale Arrow Fair", activityId: "archery",
    cityId: "thornvale_city", cityChunkIndex: 0, x: 7, y: 12,
    periods: [TimePeriod.Day, TimePeriod.Dusk], festival: true,
  },
  {
    id: "sandportRegatta", name: "Sandport Buoy Circuit", activityId: "regatta",
    cityId: "sandport_city", cityChunkIndex: 1, x: 10, y: 12,
    portId: "sandportHarbor",
  },
  {
    id: "tidehavenRegatta", name: "Tidehaven Reef Regatta", activityId: "regatta",
    cityId: "tidehaven_city", cityChunkIndex: 1, x: 10, y: 10,
    portId: "tidehavenPort",
  },
] as const satisfies readonly MinigameVenueDefinition[];

export type MinigameVenueId = (typeof MINIGAME_VENUES)[number]["id"];
export type MinigameRecordId =
  `record:${MinigameVenueId}:${MinigameRulesetId}:${MinigameDifficultyId}`;
export type MinigameMilestoneId =
  `milestone:${MinigameActivityId}:${MinigameDifficultyId}`;

export const MINIGAME_HISTORY_LIMIT = 40;
export const MINIGAME_GOLD_SCORE = 80;
export const MINIGAME_MIN_BOAT_CONDITION = 20;
export const MINIGAME_COUNTER_LIMIT = 1_000_000;

export function getMinigameActivity(id: MinigameActivityId): MinigameActivityDefinition {
  return MINIGAME_ACTIVITIES[id];
}

export function getMinigameVenue(
  id: MinigameVenueId,
): MinigameVenueDefinition & { readonly id: MinigameVenueId } {
  const venue = MINIGAME_VENUES.find((candidate) => candidate.id === id);
  if (!venue) throw new Error(`[minigames] Unknown venue ${id}`);
  return venue;
}

export function isMinigameActivityId(value: unknown): value is MinigameActivityId {
  return typeof value === "string"
    && (MINIGAME_ACTIVITY_IDS as readonly string[]).includes(value);
}

export function isMinigameDifficultyId(value: unknown): value is MinigameDifficultyId {
  return typeof value === "string"
    && (MINIGAME_DIFFICULTY_IDS as readonly string[]).includes(value);
}

export function isMinigameVenueId(value: unknown): value is MinigameVenueId {
  return typeof value === "string" && MINIGAME_VENUES.some((venue) => venue.id === value);
}

export function getMinigameRecordId(
  venueId: MinigameVenueId,
  difficultyId: MinigameDifficultyId,
): MinigameRecordId {
  const ruleset = getMinigameActivity(getMinigameVenue(venueId).activityId).rulesetId;
  return `record:${venueId}:${ruleset}:${difficultyId}`;
}

export function isMinigameRecordId(value: unknown): value is MinigameRecordId {
  return typeof value === "string" && MINIGAME_VENUES.some((venue) =>
    MINIGAME_DIFFICULTY_IDS.some((difficulty) =>
      getMinigameRecordId(venue.id, difficulty) === value
    )
  );
}

export function getMinigameMilestoneId(
  activityId: MinigameActivityId,
  difficultyId: MinigameDifficultyId,
): MinigameMilestoneId {
  return `milestone:${activityId}:${difficultyId}`;
}

export function isMinigameMilestoneId(value: unknown): value is MinigameMilestoneId {
  return typeof value === "string" && MINIGAME_ACTIVITY_IDS.some((activity) =>
    MINIGAME_DIFFICULTY_IDS.some((difficulty) =>
      getMinigameMilestoneId(activity, difficulty) === value
    )
  );
}
