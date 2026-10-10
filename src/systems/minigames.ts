import {
  MINIGAME_COUNTER_LIMIT,
  MINIGAME_DIFFICULTIES,
  MINIGAME_DIFFICULTY_IDS,
  MINIGAME_GOLD_SCORE,
  MINIGAME_HISTORY_LIMIT,
  MINIGAME_MIN_BOAT_CONDITION,
  MINIGAME_VENUES,
  getMinigameActivity,
  getMinigameMilestoneId,
  getMinigameRecordId,
  getMinigameVenue,
} from "../data/minigames";
import { getTimePeriod } from "./daynight";
import {
  classifyCrownDice,
  createMinigameChallenge,
} from "./minigameRules";
import { getMinigameBasePayout, getMinigameOutcome, getMinigameScore } from "./minigameResults";
import { discoverMinigameVenue, isAtMinigameVenue } from "./minigameVenues";
import { getRegattaProgress } from "./minigameRegatta";
import { getMinigameRunId, getMinigameRunSequence } from "./minigameState";
import { findBoat } from "./nauticalState";
import { applySocialMutation } from "./reputation";
import { consumeSocialAchievementHooks } from "./achievements";
import { unlockCodexFromFutureSignal } from "./codex";
import { WeatherType } from "./weather";
import type {
  MinigameActivityId,
  MinigameDifficultyId,
  MinigameMilestoneId,
} from "../data/minigames";
import type { CodexData } from "./codex";
import type {
  MinigameActionRequest,
  MinigameMutationResult,
  MinigameOutcome,
  MinigameReceipt,
  MinigameSession,
  MinigameStartRequest,
  MinigameState,
  ResolvedCrownRoll,
} from "./minigameTypes";
import type { PlayerState } from "./player";

export type * from "./minigameTypes";
export { createMinigameState } from "./minigameState";
export * from "./minigameResults";
export * from "./minigameVenues";

function failure(message: string): MinigameMutationResult {
  return { ok: false, changed: false, idempotent: false, message };
}

function unchanged(message: string, receipt?: MinigameReceipt): MinigameMutationResult {
  return { ok: true, changed: false, idempotent: true, message, receipt };
}

export function getMinigameDifficultyReason(
  state: MinigameState,
  activityId: MinigameActivityId,
  difficultyId: MinigameDifficultyId,
): string | undefined {
  const index = MINIGAME_DIFFICULTY_IDS.indexOf(difficultyId);
  if (index === 0) return undefined;
  const previous = MINIGAME_DIFFICULTY_IDS[index - 1]!;
  const threshold = MINIGAME_DIFFICULTIES[difficultyId].prerequisiteScore;
  const learned = MINIGAME_VENUES.filter((venue) => venue.activityId === activityId).some((venue) => {
    const recordId = getMinigameRecordId(venue.id, previous);
    return Math.max(
      state.bests[recordId]?.score ?? 0,
      state.practiceBests[recordId]?.score ?? 0,
    ) >= threshold;
  });
  return learned ? undefined : `Earn ${threshold}+ in ${MINIGAME_DIFFICULTIES[previous].name} first.`;
}

export function getMinigameEntryReason(
  player: PlayerState,
  request: MinigameStartRequest,
): string | undefined {
  const venue = getMinigameVenue(request.venueId);
  const activity = getMinigameActivity(venue.activityId);
  const state = player.progression.minigames;
  if (!isAtMinigameVenue(player, venue)) return "Visit the activity's marked city venue first.";
  if (!Number.isSafeInteger(request.timeStep) || request.timeStep < 0) return "The venue clock is invalid.";
  if (!Object.values(WeatherType).some((weather) => weather === request.weather)) {
    return "The harbor forecast is invalid.";
  }
  if (venue.periods && !venue.periods.includes(getTimePeriod(request.timeStep))) {
    return "The Arrow Fair opens during Day and Dusk.";
  }
  if (
    player.progression.gathering.pending || player.progression.worldEvents.pending
    || player.progression.nautical.pendingMerchantRoute
    || player.progression.nautical.pendingEncounter || player.progression.nautical.pendingHazard
    || player.progression.pendingCutsceneIds.length > 0
  ) return "Finish the pending world activity first.";
  if (request.practice && !activity.practiceAvailable) return "This activity has no free practice.";
  if (!request.debug) {
    const difficultyReason = getMinigameDifficultyReason(state, venue.activityId, request.difficultyId);
    if (difficultyReason) return difficultyReason;
  }
  if (venue.activityId === "regatta") {
    const boat = findBoat(player.progression.nautical);
    if (!boat || boat.condition < MINIGAME_MIN_BOAT_CONDITION) {
      return "Harbor Regatta needs an active owned boat at 20+ condition.";
    }
  }
  const stake = venue.activityId === "crownAndBones"
    ? request.stake ?? MINIGAME_DIFFICULTIES[request.difficultyId].crownStakeCap
    : MINIGAME_DIFFICULTIES[request.difficultyId].entryFee;
  if (
    !Number.isSafeInteger(stake) || stake < 1
    || (venue.activityId === "crownAndBones"
      && stake > MINIGAME_DIFFICULTIES[request.difficultyId].crownStakeCap)
  ) return "Choose a whole-gold stake within this difficulty's cap.";
  if (!Number.isSafeInteger(player.gold) || player.gold < 0) return "The gold balance is invalid.";
  if (!request.debug && !request.practice && player.gold < stake) return "Not enough in-game gold for the entry.";
  return undefined;
}

/** Validate the complete session before atomically reserving its entry and exact challenge. */
export function startMinigame(
  player: PlayerState,
  request: MinigameStartRequest,
): MinigameMutationResult {
  const state = player.progression.minigames;
  const runId = getMinigameRunId(state.seed, request.sequence);
  if (request.sequence <= state.settledSequence) return unchanged("That session is already settled.");
  if (state.pending?.runId === runId) return unchanged("That activity is already pending.");
  if (state.pending) return failure("Finish or abandon the current activity first.");
  if (
    !Number.isSafeInteger(request.sequence) || request.sequence !== state.sequence + 1
    || request.sequence > MINIGAME_COUNTER_LIMIT
  ) return failure("The activity entry request is stale or invalid.");
  const reason = getMinigameEntryReason(player, request);
  if (reason) return failure(reason);
  const venue = getMinigameVenue(request.venueId);
  const challenge = createMinigameChallenge(venue.activityId, request.difficultyId, state.seed, runId);
  const practice = request.practice === true;
  const debug = request.debug === true;
  const feePaid = practice || debug ? 0 : venue.activityId === "crownAndBones"
    ? request.stake ?? MINIGAME_DIFFICULTIES[request.difficultyId].crownStakeCap
    : MINIGAME_DIFFICULTIES[request.difficultyId].entryFee;
  const base = {
    runId, sequence: request.sequence, venueId: request.venueId,
    rulesetId: getMinigameActivity(venue.activityId).rulesetId,
    difficultyId: request.difficultyId, feePaid, practice, debug,
    weather: request.weather, revision: 0, phase: "playing" as const, receipt: null,
  };
  let pending: MinigameSession;
  if (challenge.kind === "crownAndBones") {
    pending = {
      ...base, activityId: challenge.kind, challenge,
      game: { kind: challenge.kind, rollCount: 0, banked: false, abandoned: false },
    };
  } else if (challenge.kind === "archery") {
    pending = {
      ...base, activityId: challenge.kind, challenge,
      game: { kind: challenge.kind, aim: 0, shots: [], abandoned: false },
    };
  } else {
    const boat = findBoat(player.progression.nautical);
    if (!boat) return failure("The active boat is unavailable.");
    pending = {
      ...base, activityId: challenge.kind, challenge,
      boat: { ...boat, upgradeIds: [...boat.upgradeIds] },
      game: { kind: challenge.kind, headings: [], abandoned: false },
    };
  }
  state.sequence = request.sequence;
  state.pending = pending;
  player.gold -= feePaid;
  if (!debug) discoverMinigameVenue(state, request.venueId);
  if (!practice && !debug) state.statistics[venue.activityId].attempts += 1;
  return { ok: true, changed: true, idempotent: false, message: `Entered ${getMinigameActivity(venue.activityId).name}.` };
}

interface SettlementReward {
  readonly score: number;
  readonly medal: boolean;
  readonly baseGold: number;
  readonly bonusGold: number;
  readonly milestoneId?: MinigameMilestoneId;
}

function getSettlementReward(
  state: MinigameState,
  session: MinigameSession,
  outcome: MinigameOutcome,
): SettlementReward {
  const activity = getMinigameActivity(session.activityId);
  const score = getMinigameScore(session);
  const medal = !session.practice && !session.debug
    && (outcome === "completed" || outcome === "banked")
    && score >= MINIGAME_GOLD_SCORE;
  const milestoneId = getMinigameMilestoneId(session.activityId, session.difficultyId);
  const firstMedal = medal && !state.claimedMilestoneIds.includes(milestoneId);
  return {
    score, medal,
    baseGold: getMinigameBasePayout(
      { ...session, score, outcome },
      session.activityId === "crownAndBones" ? session.game.rollCount : 0,
    ),
    bonusGold: firstMedal
      ? activity.milestoneGold[MINIGAME_DIFFICULTY_IDS.indexOf(session.difficultyId)] : 0,
    ...(firstMedal ? { milestoneId } : {}),
  };
}

function settleMinigame(
  player: PlayerState,
  session: MinigameSession,
  outcome: MinigameOutcome,
  codex?: CodexData,
): MinigameReceipt {
  const state = player.progression.minigames;
  const activity = getMinigameActivity(session.activityId);
  const reward = getSettlementReward(state, session, outcome);
  const { score, bonusGold, milestoneId } = reward;
  const conditionLost = session.activityId === "regatta" ? getRegattaProgress(session).conditionLost : 0;
  const receipt: MinigameReceipt = {
    runId: session.runId, sequence: session.sequence,
    venueId: session.venueId, activityId: session.activityId,
    rulesetId: activity.rulesetId, difficultyId: session.difficultyId,
    scoreId: activity.scoreId, rewardId: activity.rewardId,
    score, outcome, feePaid: session.feePaid,
    goldPaid: reward.baseGold + bonusGold, bonusGold, conditionLost,
    practice: session.practice, debug: session.debug,
    ...(milestoneId ? { milestoneId } : {}),
  };
  player.gold += receipt.goldPaid;
  state.settledSequence = session.sequence;
  session.phase = "result";
  session.receipt = receipt;
  state.history.push(receipt);
  state.history = state.history.slice(-MINIGAME_HISTORY_LIMIT);
  if (!session.debug && (outcome === "completed" || outcome === "banked")) {
    const recordId = getMinigameRecordId(session.venueId, session.difficultyId);
    const bests = session.practice ? state.practiceBests : state.bests;
    if (score > (bests[recordId]?.score ?? -1)) {
      bests[recordId] = { score, sessionSequence: session.sequence };
    }
  }
  if (!session.practice && !session.debug) {
    if (outcome !== "abandoned") state.statistics[session.activityId].completions += 1;
    if (reward.medal) state.statistics[session.activityId].medals += 1;
    if (codex && outcome !== "abandoned") {
      unlockCodexFromFutureSignal(codex, { type: "minigame", activityId: session.activityId });
    }
  }
  if (milestoneId) {
    state.claimedMilestoneIds.push(milestoneId);
    const rank = MINIGAME_DIFFICULTY_IDS.indexOf(session.difficultyId) + 1;
    const social = applySocialMutation(player, {
      sourceId: `minigame:${milestoneId}`,
      cause: `First ${MINIGAME_DIFFICULTIES[session.difficultyId].name} medal in ${activity.name}`,
      reputation: [
        { kind: "town", targetId: getMinigameVenue(session.venueId).cityId, delta: rank * 2 },
        { kind: "faction", targetId: activity.factionId, delta: rank },
      ],
    }, codex);
    consumeSocialAchievementHooks(player, social.achievementHooks);
  }
  return receipt;
}

/** A revision is consumed once; stale input never pays, charges, or advances another action. */
export function applyMinigameAction(
  player: PlayerState,
  request: MinigameActionRequest,
  codex?: CodexData,
): MinigameMutationResult {
  const state = player.progression.minigames;
  const pending = state.pending;
  if (!pending || pending.runId !== request.runId) {
    const sequence = getMinigameRunSequence(request.runId, state.seed);
    return sequence !== undefined && sequence <= state.settledSequence
      ? unchanged("That session is already settled.")
      : failure("No matching activity is pending.");
  }
  if (!Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 0) {
    return failure("The activity action revision is invalid.");
  }
  if (request.expectedRevision < pending.revision) return unchanged("That input was already applied.", pending.receipt ?? undefined);
  if (request.expectedRevision !== pending.revision) return failure("The activity action is stale.");
  if (request.action.type === "acknowledge") {
    if (pending.phase !== "result") return failure("Finish the activity before leaving its result.");
    state.pending = null;
    return { ok: true, changed: true, idempotent: false, message: "Activity result closed." };
  }
  if (pending.phase !== "playing") return unchanged("The activity is already settled.", pending.receipt ?? undefined);
  if (pending.revision >= MINIGAME_COUNTER_LIMIT && request.action.type !== "abandon") {
    return failure("The activity action limit has been reached; abandon this session.");
  }
  if (!Number.isSafeInteger(player.gold) || player.gold < 0) return failure("The gold balance is invalid.");
  const next = structuredClone(pending);
  let roll: ResolvedCrownRoll | undefined;
  let conditionDelta = 0;
  const action = request.action;
  if (action.type === "abandon") {
    next.game.abandoned = true;
  } else if (next.activityId === "crownAndBones" && action.type === "roll") {
    const naturalRolls = next.challenge.rolls[next.game.rollCount];
    if (!naturalRolls) return failure("No further dice remain.");
    next.game.rollCount += 1;
    roll = { ...classifyCrownDice(naturalRolls), rollId: `${next.runId}:roll:${next.game.rollCount}` };
    if (next.game.rollCount === 4) next.game.banked = true;
  } else if (next.activityId === "crownAndBones" && action.type === "bank") {
    next.game.banked = true;
  } else if (next.activityId === "archery" && action.type === "aim") {
    if (action.delta !== -1 && action.delta !== 1) return failure("The aim adjustment is invalid.");
    next.game.aim = Math.max(0, Math.min(100, next.game.aim + action.delta));
  } else if (next.activityId === "archery" && action.type === "aimTo") {
    if (!Number.isInteger(action.aim) || action.aim < 0 || action.aim > 100) {
      return failure("The selected aim must be a whole position from 0 to 100.");
    }
    next.game.aim = action.aim;
  } else if (next.activityId === "archery" && action.type === "fire") {
    const aim = action.aim ?? next.game.aim;
    if (!Number.isInteger(aim) || aim < 0 || aim > 100) return failure("The visible shot position is invalid.");
    next.game.shots.push(aim);
    next.game.aim = 0;
  } else if (next.activityId === "regatta" && action.type === "sail") {
    const before = getRegattaProgress(next);
    next.game.headings.push(action.heading);
    const after = getRegattaProgress(next);
    if (!after.valid) return failure("The sailing input cannot advance this finished course.");
    conditionDelta = after.conditionLost - before.conditionLost;
    const boat = findBoat(player.progression.nautical, next.boat.id);
    if (!boat || player.progression.nautical.activeBoatId !== next.boat.id
      || boat.condition !== next.boat.condition - before.conditionLost
      || boat.upgradeIds.length !== next.boat.upgradeIds.length
      || boat.upgradeIds.some((id, index) => id !== next.boat.upgradeIds[index])
    ) {
      return failure("The course's boat condition changed outside the activity.");
    }
  } else {
    return failure("That control is not valid for this activity.");
  }
  next.revision = Math.min(MINIGAME_COUNTER_LIMIT, next.revision + 1);
  const outcome = getMinigameOutcome(next);
  if (outcome) {
    const reward = getSettlementReward(state, next, outcome);
    if (!Number.isSafeInteger(player.gold + reward.baseGold + reward.bonusGold)) {
      return failure("The gold balance cannot safely receive this activity's reward.");
    }
  }
  if (conditionDelta > 0 && next.activityId === "regatta") {
    const boat = findBoat(player.progression.nautical, next.boat.id)!;
    boat.condition -= conditionDelta;
    player.progression.nautical.stats.conditionLost += conditionDelta;
  }
  state.pending = next;
  const receipt = outcome ? settleMinigame(player, next, outcome, codex) : undefined;
  return {
    ok: true, changed: true, idempotent: false,
    message: receipt
      ? `${getMinigameActivity(next.activityId).name}: ${receipt.outcome}, score ${receipt.score}, payout ${receipt.goldPaid}g.`
      : roll ? `${roll.naturalRolls.join(" + ")} = ${roll.total}: ${roll.outcome}.` : "Activity input accepted.",
    roll, receipt,
  };
}
