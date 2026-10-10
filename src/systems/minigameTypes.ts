import type {
  MinigameActivityId,
  MinigameDifficultyId,
  MinigameMilestoneId,
  MinigameRecordId,
  MinigameRewardId,
  MinigameRulesetId,
  MinigameScoreId,
  MinigameVenueId,
} from "../data/minigames";
import type { CardinalHeading } from "../data/nautical";
import type { BoatState } from "./nauticalState";
import type { WeatherType } from "./weather";

export type CrownNaturalDice = readonly [number, number];
export type CrownDiceOutcome = "bones" | "crown" | "safe";

export interface CrownDiceResult {
  readonly sides: 6;
  readonly naturalRolls: CrownNaturalDice;
  readonly modifier: 0;
  readonly total: number;
  readonly outcome: CrownDiceOutcome;
}

export interface ResolvedCrownRoll extends CrownDiceResult {
  readonly rollId: string;
}

export interface MinigamePoint {
  readonly x: number;
  readonly y: number;
}

export interface CrownChallenge {
  readonly kind: "crownAndBones";
  readonly rolls: readonly CrownNaturalDice[];
}

export interface ArcheryChallenge {
  readonly kind: "archery";
  readonly targets: readonly number[];
}

export interface RegattaChallenge {
  readonly kind: "regatta";
  readonly width: number;
  readonly height: number;
  readonly start: MinigamePoint;
  readonly finish: MinigamePoint;
  readonly buoys: readonly MinigamePoint[];
  readonly obstacles: readonly MinigamePoint[];
  readonly route: readonly MinigamePoint[];
  readonly windPattern: readonly CardinalHeading[];
}

export type MinigameChallenge = CrownChallenge | ArcheryChallenge | RegattaChallenge;

export interface CrownGame {
  kind: "crownAndBones";
  rollCount: number;
  banked: boolean;
  abandoned: boolean;
}

export interface ArcheryGame {
  kind: "archery";
  aim: number;
  shots: number[];
  abandoned: boolean;
}

export interface RegattaGame {
  kind: "regatta";
  headings: CardinalHeading[];
  abandoned: boolean;
}

export type MinigameOutcome = "banked" | "completed" | "bones" | "abandoned" | "timeout";

export interface MinigameReceipt {
  readonly runId: string;
  readonly sequence: number;
  readonly venueId: MinigameVenueId;
  readonly activityId: MinigameActivityId;
  readonly rulesetId: MinigameRulesetId;
  readonly difficultyId: MinigameDifficultyId;
  readonly scoreId: MinigameScoreId;
  readonly rewardId: MinigameRewardId;
  readonly score: number;
  readonly outcome: MinigameOutcome;
  readonly feePaid: number;
  readonly goldPaid: number;
  readonly bonusGold: number;
  readonly conditionLost: number;
  readonly practice: boolean;
  readonly debug: boolean;
  readonly milestoneId?: MinigameMilestoneId;
}

export interface MinigameSessionBase {
  runId: string;
  sequence: number;
  venueId: MinigameVenueId;
  rulesetId: MinigameRulesetId;
  difficultyId: MinigameDifficultyId;
  feePaid: number;
  practice: boolean;
  debug: boolean;
  weather: WeatherType;
  revision: number;
  phase: "playing" | "result";
  receipt: MinigameReceipt | null;
}

export interface CrownSession extends MinigameSessionBase {
  activityId: "crownAndBones";
  challenge: CrownChallenge;
  game: CrownGame;
}

export interface ArcherySession extends MinigameSessionBase {
  activityId: "archery";
  challenge: ArcheryChallenge;
  game: ArcheryGame;
}

export interface RegattaSession extends MinigameSessionBase {
  activityId: "regatta";
  challenge: RegattaChallenge;
  game: RegattaGame;
  boat: BoatState;
}

export type MinigameSession = CrownSession | ArcherySession | RegattaSession;

export interface MinigamePersonalBest {
  readonly score: number;
  readonly sessionSequence: number;
}

export interface MinigameActivityStatistics {
  attempts: number;
  completions: number;
  medals: number;
}

export interface MinigameState {
  seed: number;
  sequence: number;
  settledSequence: number;
  discoveredVenueIds: MinigameVenueId[];
  bests: Partial<Record<MinigameRecordId, MinigamePersonalBest>>;
  practiceBests: Partial<Record<MinigameRecordId, MinigamePersonalBest>>;
  statistics: Record<MinigameActivityId, MinigameActivityStatistics>;
  claimedMilestoneIds: MinigameMilestoneId[];
  pending: MinigameSession | null;
  history: MinigameReceipt[];
}

export type MinigameAction =
  | { readonly type: "roll" }
  | { readonly type: "bank" }
  | { readonly type: "aim"; readonly delta: -1 | 1 }
  | { readonly type: "aimTo"; readonly aim: number }
  | { readonly type: "fire"; readonly aim?: number }
  | { readonly type: "sail"; readonly heading: CardinalHeading }
  | { readonly type: "abandon" }
  | { readonly type: "acknowledge" };

export interface MinigameActionRequest {
  readonly runId: string;
  readonly expectedRevision: number;
  readonly action: MinigameAction;
}

export interface MinigameStartRequest {
  readonly sequence: number;
  readonly venueId: MinigameVenueId;
  readonly difficultyId: MinigameDifficultyId;
  readonly stake?: number;
  readonly practice?: boolean;
  readonly debug?: boolean;
  readonly timeStep: number;
  readonly weather: WeatherType;
}

export interface MinigameMutationResult {
  readonly ok: boolean;
  readonly changed: boolean;
  readonly idempotent: boolean;
  readonly message: string;
  readonly roll?: ResolvedCrownRoll;
  readonly receipt?: MinigameReceipt;
}
