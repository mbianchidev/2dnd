import { CITIES } from "./cities";

export const ALIGNMENT_SCORE_MIN = -100;
export const ALIGNMENT_SCORE_MAX = 100;
export const ALIGNMENT_THRESHOLD = 25;

export const ALIGNMENT_AXES = ["lawChaos", "goodEvil"] as const;
export type AlignmentAxis = (typeof ALIGNMENT_AXES)[number];

export const ALIGNMENT_NAMES = [
  "Lawful Good",
  "Neutral Good",
  "Chaotic Good",
  "Lawful Neutral",
  "True Neutral",
  "Chaotic Neutral",
  "Lawful Evil",
  "Neutral Evil",
  "Chaotic Evil",
] as const;
export type AlignmentName = (typeof ALIGNMENT_NAMES)[number];

export const FACTION_DEFINITIONS = [
  { id: "twelvefoldCovenant", name: "Twelvefold Covenant" },
  { id: "heartlandsWardens", name: "Heartlands Wardens" },
  { id: "rootspeakers", name: "Rootspeakers" },
  { id: "winterWitnesses", name: "Winter Witnesses" },
  { id: "sunRoadCompact", name: "Sun Road Compact" },
  { id: "marshCompact", name: "Marsh Compact" },
  { id: "ashenWatch", name: "Ashen Watch" },
  { id: "roadwardens", name: "Roadwardens" },
] as const;

export type FactionId = (typeof FACTION_DEFINITIONS)[number]["id"];
export type TownId = (typeof CITIES)[number]["id"];
export type ReputationTargetKind = "town" | "faction";

export const REPUTATION_SCORE_MIN = -100;
export const REPUTATION_SCORE_MAX = 100;

export const REPUTATION_TIERS = [
  {
    id: "hostile",
    name: "Hostile",
    minimum: REPUTATION_SCORE_MIN,
    shopAdjustment: -0.2,
  },
  { id: "wary", name: "Wary", minimum: -49, shopAdjustment: -0.1 },
  { id: "neutral", name: "Neutral", minimum: -14, shopAdjustment: 0 },
  { id: "friendly", name: "Friendly", minimum: 15, shopAdjustment: 0.05 },
  { id: "trusted", name: "Trusted", minimum: 50, shopAdjustment: 0.1 },
  { id: "exalted", name: "Exalted", minimum: 80, shopAdjustment: 0.15 },
] as const;

export type ReputationTierId = (typeof REPUTATION_TIERS)[number]["id"];

export const REPUTATION_MILESTONE_IDS = [
  "friendly",
  "trusted",
  "exalted",
] as const;
export type ReputationMilestoneId =
  (typeof REPUTATION_MILESTONE_IDS)[number];

export const SOCIAL_HISTORY_LIMIT = 40;

export interface SocialOutcomeDefinition {
  readonly alignment?: Partial<Record<AlignmentAxis, number>>;
  readonly reputation?: readonly {
    readonly kind: ReputationTargetKind;
    readonly targetId: string;
    readonly delta: number;
  }[];
}

export function isFactionId(value: unknown): value is FactionId {
  return typeof value === "string"
    && FACTION_DEFINITIONS.some((definition) => definition.id === value);
}

export function isTownId(value: unknown): value is TownId {
  return typeof value === "string" && CITIES.some((city) => city.id === value);
}

export function getFactionName(factionId: FactionId): string {
  return FACTION_DEFINITIONS.find((definition) =>
    definition.id === factionId
  )!.name;
}

export function getTownName(townId: TownId): string {
  return CITIES.find((city) => city.id === townId)!.name;
}
