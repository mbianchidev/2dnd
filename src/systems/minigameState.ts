import { debugLog } from "../config";
import {
  MINIGAME_ACTIVITY_IDS,
  MINIGAME_COUNTER_LIMIT,
  MINIGAME_DIFFICULTIES,
  MINIGAME_DIFFICULTY_IDS,
  MINIGAME_GOLD_SCORE,
  MINIGAME_HISTORY_LIMIT,
  MINIGAME_MIN_BOAT_CONDITION,
  getMinigameActivity,
  getMinigameMilestoneId,
  getMinigameVenue,
  isMinigameDifficultyId,
  isMinigameMilestoneId,
  isMinigameRecordId,
  isMinigameVenueId,
} from "../data/minigames";
import {
  getBoat,
  isBoatCosmeticId,
  isBoatId,
  isBoatUpgradeId,
} from "../data/nautical";
import { classifyCrownDice, createMinigameChallenge } from "./minigameRules";
import { getRegattaProgress } from "./minigameRegatta";
import { getMinigameBasePayout, getMinigameOutcome, getMinigameScore } from "./minigameResults";
import { isAtMinigameVenue } from "./minigameVenues";
import { findBoat } from "./nauticalState";
import { WeatherType } from "./weather";
import type { MinigameMilestoneId, MinigameRecordId } from "../data/minigames";
import type { BoatUpgradeId, CardinalHeading } from "../data/nautical";
import type { BoatState } from "./nauticalState";
import type {
  MinigameOutcome,
  MinigamePersonalBest,
  MinigameReceipt,
  MinigameSession,
  MinigameSessionBase,
  MinigameState,
  RegattaSession,
} from "./minigameTypes";
import type { PlayerState } from "./player";

export const LEGACY_MINIGAME_SEED = 0x2d0d0167;
export const MINIGAME_SAVE_VERSION = 19;
const recoveryNotices = new WeakMap<MinigameState, string>();

export function createMinigameState(
  seed = Math.floor(Math.random() * 0xffff_ffff) || LEGACY_MINIGAME_SEED,
): MinigameState {
  if (!Number.isSafeInteger(seed) || seed < 1 || seed > 0xffff_ffff) {
    throw new Error("[minigames] A positive unsigned 32-bit seed is required.");
  }
  return {
    seed, sequence: 0, settledSequence: 0,
    discoveredVenueIds: [], bests: {}, practiceBests: {},
    statistics: {
      crownAndBones: { attempts: 0, completions: 0, medals: 0 },
      archery: { attempts: 0, completions: 0, medals: 0 },
      regatta: { attempts: 0, completions: 0, medals: 0 },
    },
    claimedMilestoneIds: [], pending: null, history: [],
  };
}

export function getMinigameSessionId(seed: number, sequence: number): string {
  return `mg:${seed.toString(16)}:${sequence}`;
}

export function getMinigameSessionSequence(sessionId: string, seed: number): number | undefined {
  const prefix = `mg:${seed.toString(16)}:`;
  if (!sessionId.startsWith(prefix)) return undefined;
  const sequence = Number(sessionId.slice(prefix.length));
  return Number.isSafeInteger(sequence) && sequence > 0
    && getMinigameSessionId(seed, sequence) === sessionId
    ? sequence : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function integerIn(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value)
    && value >= minimum && value <= maximum;
}

function counter(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value)
    ? Math.max(0, Math.min(MINIGAME_COUNTER_LIMIT, value)) : 0;
}

function isHeading(value: unknown): value is CardinalHeading {
  return value === "north" || value === "east" || value === "south" || value === "west";
}

function isWeather(value: unknown): value is WeatherType {
  return Object.values(WeatherType).some((weather) => weather === value);
}

function isOutcome(value: unknown): value is MinigameOutcome {
  return value === "banked" || value === "completed" || value === "bones"
    || value === "abandoned" || value === "timeout";
}

function matchesExpected(value: unknown, expected: unknown): boolean {
  if (Array.isArray(expected)) {
    return Array.isArray(value) && value.length === expected.length
      && expected.every((entry: unknown, index: number) => matchesExpected(value[index], entry));
  }
  if (isRecord(expected)) {
    return isRecord(value) && Object.entries(expected).every(
      ([key, entry]) => matchesExpected(value[key], entry),
    );
  }
  return value === expected;
}

function normalizeBoatSnapshot(value: unknown): BoatState | undefined {
  if (
    !isRecord(value) || !isBoatId(value["id"])
    || !integerIn(value["condition"], MINIGAME_MIN_BOAT_CONDITION, 100)
    || !isBoatCosmeticId(value["cosmeticId"]) || !Array.isArray(value["upgradeIds"])
  ) return undefined;
  const definition = getBoat(value["id"]);
  const upgradeIds: BoatUpgradeId[] = [];
  for (const entry of value["upgradeIds"]) {
    if (
      !isBoatUpgradeId(entry) || !definition.allowedUpgradeIds.includes(entry)
      || upgradeIds.includes(entry)
    ) return undefined;
    upgradeIds.push(entry);
  }
  return {
    id: value["id"], condition: value["condition"],
    upgradeIds, cosmeticId: value["cosmeticId"],
  };
}

function normalizeReceipt(
  value: unknown,
  seed: number,
  claimed: ReadonlySet<MinigameMilestoneId>,
): MinigameReceipt | undefined {
  if (
    !isRecord(value) || !isMinigameVenueId(value["venueId"])
    || !isMinigameDifficultyId(value["difficultyId"])
    || !integerIn(value["sequence"], 1, MINIGAME_COUNTER_LIMIT)
    || value["sessionId"] !== getMinigameSessionId(seed, value["sequence"])
    || !integerIn(value["score"], 0, 100) || !isOutcome(value["outcome"])
    || typeof value["practice"] !== "boolean" || typeof value["debug"] !== "boolean"
    || !integerIn(value["feePaid"], 0, 20) || !integerIn(value["goldPaid"], 0, 70)
    || !integerIn(value["bonusGold"], 0, 30) || !integerIn(value["conditionLost"], 0, 12)
  ) return undefined;
  const venue = getMinigameVenue(value["venueId"]);
  const activity = getMinigameActivity(venue.activityId);
  const difficulty = MINIGAME_DIFFICULTIES[value["difficultyId"]];
  if (
    value["activityId"] !== activity.id || value["rulesetId"] !== activity.rulesetId
    || value["scoreId"] !== activity.scoreId || value["rewardId"] !== activity.rewardId
    || (value["practice"] && !activity.practiceAvailable)
    || (activity.id !== "regatta" && value["conditionLost"] !== 0)
    || value["conditionLost"] > difficulty.regattaWearCap
    || ((value["practice"] || value["debug"]) && (value["feePaid"] !== 0 || value["conditionLost"] !== 0))
    || (!value["practice"] && !value["debug"] && (
      activity.id === "crownAndBones"
        ? value["feePaid"] < 1 || value["feePaid"] > difficulty.crownStakeCap
        : value["feePaid"] !== difficulty.entryFee
    ))
    || (value["outcome"] === "banked" && activity.id !== "crownAndBones")
    || (value["outcome"] === "bones" && activity.id !== "crownAndBones")
    || (value["outcome"] === "completed" && activity.id === "crownAndBones")
    || (value["outcome"] === "timeout" && activity.id !== "regatta")
    || (["bones", "abandoned", "timeout"].includes(value["outcome"]) && value["score"] !== 0)
  ) return undefined;
  let crownRolls = 0;
  const score = value["score"];
  if (activity.id === "crownAndBones" && value["outcome"] === "banked") {
    const count = [0, 1, 2, 3, 4].find((rolls) =>
      score >= rolls * 20 && score <= rolls * 25
        && (score - rolls * 20) % 5 === 0);
    if (count === undefined) return undefined;
    crownRolls = count;
  }
  const milestoneId = value["milestoneId"];
  const hasMilestone = milestoneId !== undefined;
  if (hasMilestone && (
    !isMinigameMilestoneId(milestoneId) || !claimed.has(milestoneId)
    || milestoneId !== getMinigameMilestoneId(activity.id, value["difficultyId"])
    || value["score"] < MINIGAME_GOLD_SCORE || value["practice"] || value["debug"]
    || (value["outcome"] !== "banked" && value["outcome"] !== "completed")
  )) return undefined;
  const bonusGold = hasMilestone
    ? activity.milestoneGold[MINIGAME_DIFFICULTY_IDS.indexOf(value["difficultyId"])] : 0;
  const receipt: MinigameReceipt = {
    sessionId: getMinigameSessionId(seed, value["sequence"]), sequence: value["sequence"],
    venueId: value["venueId"], activityId: activity.id, rulesetId: activity.rulesetId,
    difficultyId: value["difficultyId"], scoreId: activity.scoreId, rewardId: activity.rewardId,
    score: value["score"], outcome: value["outcome"], feePaid: value["feePaid"],
    goldPaid: value["goldPaid"], bonusGold, conditionLost: value["conditionLost"],
    practice: value["practice"], debug: value["debug"],
    ...(isMinigameMilestoneId(milestoneId) ? { milestoneId } : {}),
  };
  return value["bonusGold"] === bonusGold
    && receipt.goldPaid === getMinigameBasePayout(receipt, crownRolls) + bonusGold
    ? receipt : undefined;
}

function normalizePending(value: unknown, state: MinigameState): MinigameSession | null {
  if (
    !isRecord(value) || !isMinigameVenueId(value["venueId"])
    || !isMinigameDifficultyId(value["difficultyId"]) || !isWeather(value["weather"])
    || !integerIn(value["sequence"], 1, MINIGAME_COUNTER_LIMIT)
    || value["sessionId"] !== getMinigameSessionId(state.seed, value["sequence"])
    || value["sequence"] !== state.sequence
    || !integerIn(value["revision"], 0, MINIGAME_COUNTER_LIMIT)
    || !integerIn(value["feePaid"], 0, 20)
    || typeof value["practice"] !== "boolean" || typeof value["debug"] !== "boolean"
    || (value["phase"] !== "playing" && value["phase"] !== "result")
    || !isRecord(value["game"]) || typeof value["game"]["abandoned"] !== "boolean"
  ) return null;
  const venue = getMinigameVenue(value["venueId"]);
  const activity = getMinigameActivity(venue.activityId);
  const difficulty = MINIGAME_DIFFICULTIES[value["difficultyId"]];
  const game = value["game"];
  const abandoned = game["abandoned"];
  if (typeof abandoned !== "boolean") return null;
  if (
    value["activityId"] !== activity.id || value["rulesetId"] !== activity.rulesetId
    || (value["practice"] && !activity.practiceAvailable)
    || game["kind"] !== activity.id
    || ((value["practice"] || value["debug"]) && value["feePaid"] !== 0)
    || (!value["practice"] && !value["debug"] && (
      activity.id === "crownAndBones"
        ? value["feePaid"] < 1 || value["feePaid"] > difficulty.crownStakeCap
        : value["feePaid"] !== difficulty.entryFee
    ))
  ) return null;
  const challenge = createMinigameChallenge(
    activity.id, value["difficultyId"], state.seed, getMinigameSessionId(state.seed, value["sequence"]),
  );
  if (!matchesExpected(value["challenge"], challenge)) return null;
  const base: MinigameSessionBase = {
    sessionId: getMinigameSessionId(state.seed, value["sequence"]), sequence: value["sequence"],
    venueId: value["venueId"], rulesetId: activity.rulesetId, difficultyId: value["difficultyId"],
    feePaid: value["feePaid"], practice: value["practice"], debug: value["debug"],
    weather: value["weather"], revision: value["revision"], phase: value["phase"], receipt: null,
  };
  let pending: MinigameSession;
  if (challenge.kind === "crownAndBones") {
    if (
      !integerIn(game["rollCount"], 0, 4) || typeof game["banked"] !== "boolean"
      || base.revision < game["rollCount"] + Number(abandoned)
      || (abandoned && game["banked"])
      || (game["banked"] && game["rollCount"] < 4 && base.revision <= game["rollCount"])
    ) return null;
    const taken = challenge.rolls.slice(0, game["rollCount"]);
    const bonesIndex = taken.findIndex((roll) => classifyCrownDice(roll).outcome === "bones");
    if (bonesIndex >= 0 && (
      bonesIndex !== taken.length - 1 || abandoned
      || (game["banked"] && game["rollCount"] < 4)
    )) return null;
    pending = {
      ...base, activityId: challenge.kind, challenge,
      game: { kind: challenge.kind, rollCount: game["rollCount"], banked: game["banked"], abandoned },
    };
  } else if (challenge.kind === "archery") {
    if (
      !integerIn(game["aim"], 0, 100)
      || !Array.isArray(game["shots"]) || game["shots"].length > challenge.targets.length
      || base.revision < game["shots"].length + Number(abandoned)
      || (game["shots"].length === challenge.targets.length
        && (abandoned || game["aim"] !== 0))
    ) return null;
    const shots: number[] = [];
    for (const shot of game["shots"]) {
      if (!integerIn(shot, 0, 100)) return null;
      shots.push(shot);
    }
    pending = {
      ...base, activityId: challenge.kind, challenge,
      game: { kind: challenge.kind, aim: game["aim"], shots, abandoned },
    };
  } else {
    const boat = normalizeBoatSnapshot(value["boat"]);
    if (!boat || !Array.isArray(game["headings"])
      || game["headings"].length > difficulty.regattaMoveLimit
      || base.revision !== game["headings"].length + Number(abandoned)
    ) return null;
    const headings: CardinalHeading[] = [];
    for (const heading of game["headings"]) {
      if (!isHeading(heading)) return null;
      headings.push(heading);
    }
    const regatta: RegattaSession = {
      ...base, activityId: challenge.kind, challenge, boat,
      game: { kind: challenge.kind, headings, abandoned },
    };
    const progress = getRegattaProgress(regatta);
    if (!progress.valid || (abandoned && (progress.complete || progress.timeout))) return null;
    pending = regatta;
  }
  const outcome = getMinigameOutcome(pending);
  if (pending.phase === "playing") {
    return outcome === undefined && value["receipt"] === null
      && state.settledSequence === pending.sequence - 1 ? pending : null;
  }
  const receipt = normalizeReceipt(value["receipt"], state.seed, new Set(state.claimedMilestoneIds));
  if (
    !receipt || outcome === undefined || receipt.sessionId !== pending.sessionId
    || state.settledSequence !== pending.sequence
    || receipt.score !== getMinigameScore(pending) || receipt.outcome !== outcome
    || receipt.venueId !== pending.venueId || receipt.difficultyId !== pending.difficultyId
    || receipt.feePaid !== pending.feePaid || receipt.practice !== pending.practice || receipt.debug !== pending.debug
    || (pending.activityId === "regatta" && receipt.conditionLost !== getRegattaProgress(pending).conditionLost)
  ) return null;
  pending.receipt = receipt;
  return pending;
}

function normalizeBests(
  value: unknown,
  settledSequence: number,
): Partial<Record<MinigameRecordId, MinigamePersonalBest>> {
  const bests: Partial<Record<MinigameRecordId, MinigamePersonalBest>> = {};
  if (!isRecord(value)) return bests;
  for (const [id, entry] of Object.entries(value)) {
    if (!isMinigameRecordId(id) || !isRecord(entry)
      || !integerIn(entry["score"], 0, 100)
      || !integerIn(entry["sessionSequence"], 1, settledSequence)
    ) continue;
    bests[id] = { score: entry["score"], sessionSequence: entry["sessionSequence"] };
  }
  return bests;
}

function retirePending(state: MinigameState, reason: string): void {
  state.settledSequence = state.sequence;
  state.pending = null;
  recoveryNotices.set(state, "Damaged activity recovery was closed safely. No entry was charged again and no reward was replayed.");
  debugLog(`[minigames] Retired pending session: ${reason}`);
}

/** Normalize known authority only; corrupt pending repair never refunds, pays, or rerolls. */
export function normalizeMinigameState(value: unknown, sourceVersion: number): MinigameState {
  if (sourceVersion < MINIGAME_SAVE_VERSION || !isRecord(value)) {
    return createMinigameState(LEGACY_MINIGAME_SEED);
  }
  const seedValid = integerIn(value["seed"], 1, 0xffff_ffff);
  const state = createMinigameState(
    integerIn(value["seed"], 1, 0xffff_ffff) ? value["seed"] : LEGACY_MINIGAME_SEED,
  );
  state.sequence = Math.max(counter(value["sequence"]), counter(value["settledSequence"]));
  state.settledSequence = counter(value["settledSequence"]);
  const rawPending = value["pending"];
  if (isRecord(rawPending) && integerIn(rawPending["sequence"], 1, MINIGAME_COUNTER_LIMIT)) {
    state.sequence = Math.max(state.sequence, rawPending["sequence"]);
  }
  state.discoveredVenueIds = Array.isArray(value["discoveredVenueIds"])
    ? [...new Set(value["discoveredVenueIds"].filter(isMinigameVenueId))] : [];
  state.claimedMilestoneIds = Array.isArray(value["claimedMilestoneIds"])
    ? [...new Set(value["claimedMilestoneIds"].filter(isMinigameMilestoneId))] : [];
  const claimed = new Set(state.claimedMilestoneIds);
  if (seedValid && Array.isArray(value["history"])) {
    const seen = new Set<string>();
    for (const entry of value["history"].slice(-MINIGAME_HISTORY_LIMIT)) {
      const receipt = normalizeReceipt(entry, state.seed, claimed);
      if (!receipt || seen.has(receipt.sessionId)) continue;
      seen.add(receipt.sessionId);
      state.history.push(receipt);
    }
    state.history.sort((left, right) => left.sequence - right.sequence);
  }
  state.settledSequence = Math.min(state.sequence, state.settledSequence);
  state.pending = seedValid ? normalizePending(rawPending, state) : null;
  if (rawPending !== null && rawPending !== undefined && !state.pending) {
    retirePending(state, seedValid ? "invalid session, challenge, receipt, or ledger" : "invalid deterministic seed");
  } else if (!state.pending && state.settledSequence < state.sequence) {
    retirePending(state, "the active snapshot is missing");
  }
  state.history = state.history.filter((receipt) => receipt.sequence <= state.settledSequence);
  state.bests = normalizeBests(value["bests"], state.settledSequence);
  state.practiceBests = normalizeBests(value["practiceBests"], state.settledSequence);
  const statistics = isRecord(value["statistics"]) ? value["statistics"] : {};
  for (const activity of MINIGAME_ACTIVITY_IDS) {
    const raw = isRecord(statistics[activity]) ? statistics[activity] : {};
    const attempts = Math.min(state.sequence, counter(raw["attempts"]));
    const completions = Math.min(attempts, counter(raw["completions"]));
    state.statistics[activity] = {
      attempts, completions, medals: Math.min(completions, counter(raw["medals"])),
    };
  }
  if (Object.values(state.statistics).reduce((total, statistics) => total + statistics.attempts, 0) > state.sequence) {
    for (const activity of MINIGAME_ACTIVITY_IDS) {
      const receipts = state.history.filter((receipt) =>
        receipt.activityId === activity && !receipt.practice && !receipt.debug);
      const activeAttempt = state.pending?.phase === "playing" && state.pending.activityId === activity
        && !state.pending.practice && !state.pending.debug ? 1 : 0;
      state.statistics[activity] = {
        attempts: receipts.length + activeAttempt,
        completions: receipts.filter((receipt) => receipt.outcome !== "abandoned").length,
        medals: receipts.filter((receipt) =>
          (receipt.outcome === "banked" || receipt.outcome === "completed") && receipt.score >= MINIGAME_GOLD_SCORE).length,
      };
    }
    debugLog("[minigames] Repaired impossible cross-activity statistics.");
  }
  return state;
}

/** Cross-domain recovery preserves the live wallet, position, and already-applied hull wear. */
export function validateMinigameRecovery(player: PlayerState): void {
  const state = player.progression.minigames;
  const pending = state.pending;
  if (!pending) return;
  const nautical = player.progression.nautical;
  if (
    !isAtMinigameVenue(player, getMinigameVenue(pending.venueId))
    || player.progression.gathering.pending || player.progression.worldEvents.pending
    || nautical.pendingMerchantRoute || nautical.pendingEncounter || nautical.pendingHazard
  ) {
    retirePending(state, "the recovered world location or activity does not match the venue");
    return;
  }
  if (pending.activityId === "regatta") {
    const boat = findBoat(nautical, pending.boat.id);
    const lost = getRegattaProgress(pending).conditionLost;
    if (
      !boat || nautical.activeBoatId !== pending.boat.id
      || boat.condition !== pending.boat.condition - lost
      || !matchesExpected(boat.upgradeIds, pending.boat.upgradeIds)
    ) retirePending(state, "the owned boat or condition does not match the saved course");
  }
}

export function consumeMinigameRecoveryNotice(state: MinigameState): string | undefined {
  const notice = recoveryNotices.get(state);
  recoveryNotices.delete(state);
  return notice;
}
