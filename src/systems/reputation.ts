import {
  ALIGNMENT_AXES,
  ALIGNMENT_SCORE_MAX,
  ALIGNMENT_SCORE_MIN,
  ALIGNMENT_THRESHOLD,
  REPUTATION_MILESTONE_IDS,
  REPUTATION_SCORE_MAX,
  REPUTATION_SCORE_MIN,
  REPUTATION_TIERS,
  SOCIAL_HISTORY_LIMIT,
  getFactionName,
  getTownName,
  isFactionId,
  isTownId,
  type AlignmentAxis,
  type AlignmentName,
  type FactionId,
  type ReputationMilestoneId,
  type ReputationTargetKind,
  type ReputationTierId,
  type SocialOutcomeDefinition,
  type TownId,
} from "../data/reputation";
import type { CodexData, CodexUnlockResult } from "./codex";
import { unlockCodexFromFutureSignal } from "./codex";
import type { PlayerState } from "./player";

export interface AlignmentScores {
  lawChaos: number;
  goodEvil: number;
}

export interface SocialHistoryEntry {
  sourceId: string;
  cause: string;
  summary: string;
}

export interface SocialState {
  alignment: AlignmentScores;
  townReputation: Partial<Record<TownId, number>>;
  factionReputation: Partial<Record<FactionId, number>>;
  appliedSourceIds: string[];
  history: SocialHistoryEntry[];
}

export type SocialAchievementHook =
  | {
    readonly type: "alignmentChanged";
    readonly alignment: AlignmentName;
    readonly sourceId: string;
  }
  | {
    readonly type: "reputationTierReached";
    readonly targetKind: ReputationTargetKind;
    readonly targetId: string;
    readonly tier: ReputationTierId;
    readonly sourceId: string;
  };

export interface SocialMutationRequest extends SocialOutcomeDefinition {
  readonly sourceId: string;
  readonly cause: string;
}

export interface SocialMutationResult {
  readonly changed: boolean;
  readonly summary: string;
  readonly codexUnlocks: CodexUnlockResult;
  readonly achievementHooks: readonly SocialAchievementHook[];
}

export const EMPTY_CODEX_UNLOCKS: CodexUnlockResult = {
  unlockedIds: [],
  entries: [],
};

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function axisWord(score: number, positive: string, negative: string): string {
  if (score >= ALIGNMENT_THRESHOLD) return positive;
  if (score <= -ALIGNMENT_THRESHOLD) return negative;
  return "Neutral";
}

export function getAlignmentName(scores: AlignmentScores): AlignmentName {
  const order = axisWord(scores.lawChaos, "Lawful", "Chaotic");
  const morality = axisWord(scores.goodEvil, "Good", "Evil");
  if (order === "Neutral" && morality === "Neutral") return "True Neutral";
  return `${order} ${morality}` as AlignmentName;
}

export function getAlignmentAxisLabel(axis: AlignmentAxis, score: number): string {
  if (axis === "lawChaos") {
    return score >= ALIGNMENT_THRESHOLD
      ? "Lawful"
      : score <= -ALIGNMENT_THRESHOLD ? "Chaotic" : "Neutral";
  }
  return score >= ALIGNMENT_THRESHOLD
    ? "Good"
    : score <= -ALIGNMENT_THRESHOLD ? "Evil" : "Neutral";
}

export function getReputationTier(score: number): (typeof REPUTATION_TIERS)[number] {
  const clamped = clampInteger(
    score,
    REPUTATION_SCORE_MIN,
    REPUTATION_SCORE_MAX,
  );
  return [...REPUTATION_TIERS].reverse().find(
    (tier) => clamped >= tier.minimum,
  )!;
}

export function getReputationScore(
  social: SocialState,
  kind: ReputationTargetKind,
  targetId: string,
): number {
  if (kind === "town") {
    return isTownId(targetId) ? social.townReputation[targetId] ?? 0 : 0;
  }
  return isFactionId(targetId)
    ? social.factionReputation[targetId] ?? 0
    : 0;
}

export function getReachedReputationMilestones(
  score: number,
): readonly ReputationMilestoneId[] {
  const tier = getReputationTier(score);
  const tierIndex = REPUTATION_TIERS.findIndex((entry) => entry.id === tier.id);
  return REPUTATION_MILESTONE_IDS.filter((milestoneId) => {
    const milestoneIndex = REPUTATION_TIERS.findIndex(
      (entry) => entry.id === milestoneId,
    );
    return milestoneIndex <= tierIndex;
  });
}

export function createSocialState(): SocialState {
  return {
    alignment: {
      lawChaos: -50,
      goodEvil: 0,
    },
    townReputation: {},
    factionReputation: {},
    appliedSourceIds: [],
    history: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeScore(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback = 0,
): number {
  return typeof value === "number"
    ? clampInteger(value, minimum, maximum)
    : fallback;
}

function normalizeHistory(
  value: unknown,
  appliedSourceIds: ReadonlySet<string>,
): SocialHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const history: SocialHistoryEntry[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const sourceId = entry["sourceId"];
    const cause = entry["cause"];
    const summary = entry["summary"];
    if (
      typeof sourceId !== "string"
      || sourceId.trim().length === 0
      || !appliedSourceIds.has(sourceId)
      || seen.has(sourceId)
      || typeof cause !== "string"
      || cause.trim().length === 0
      || typeof summary !== "string"
      || summary.trim().length === 0
    ) {
      continue;
    }
    seen.add(sourceId);
    history.push({
      sourceId,
      cause: cause.trim(),
      summary: summary.trim(),
    });
  }
  return history.slice(-SOCIAL_HISTORY_LIMIT);
}

export function normalizeSocialState(value: unknown): SocialState {
  if (!isRecord(value)) return createSocialState();
  const alignmentValue = isRecord(value["alignment"])
    ? value["alignment"]
    : {};
  const social: SocialState = {
    alignment: {
      lawChaos: normalizeScore(
        alignmentValue["lawChaos"],
        ALIGNMENT_SCORE_MIN,
        ALIGNMENT_SCORE_MAX,
        -50,
      ),
      goodEvil: normalizeScore(
        alignmentValue["goodEvil"],
        ALIGNMENT_SCORE_MIN,
        ALIGNMENT_SCORE_MAX,
      ),
    },
    townReputation: {},
    factionReputation: {},
    appliedSourceIds: Array.isArray(value["appliedSourceIds"])
      ? [...new Set(value["appliedSourceIds"].filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0,
      ).map((entry) => entry.trim()))]
      : [],
    history: [],
  };

  const townValue = value["townReputation"];
  if (isRecord(townValue)) {
    for (const [townId, score] of Object.entries(townValue)) {
      if (!isTownId(townId)) continue;
      social.townReputation[townId] = normalizeScore(
        score,
        REPUTATION_SCORE_MIN,
        REPUTATION_SCORE_MAX,
      );
    }
  }

  const factionValue = value["factionReputation"];
  if (isRecord(factionValue)) {
    for (const [factionId, score] of Object.entries(factionValue)) {
      if (!isFactionId(factionId)) continue;
      social.factionReputation[factionId] = normalizeScore(
        score,
        REPUTATION_SCORE_MIN,
        REPUTATION_SCORE_MAX,
      );
    }
  }

  social.history = normalizeHistory(
    value["history"],
    new Set(social.appliedSourceIds),
  );
  return social;
}

function describeTarget(kind: ReputationTargetKind, targetId: string): string {
  return kind === "town"
    ? getTownName(targetId as TownId)
    : getFactionName(targetId as FactionId);
}

export function applySocialMutation(
  player: PlayerState,
  request: SocialMutationRequest,
  codex?: CodexData,
): SocialMutationResult {
  const sourceId = request.sourceId.trim();
  const cause = request.cause.trim();
  if (!sourceId) throw new Error("[reputation] Source ID is required");
  if (!cause) throw new Error("[reputation] Cause is required");
  const social = player.progression.social;
  if (social.appliedSourceIds.includes(sourceId)) {
    return {
      changed: false,
      summary: "Already applied.",
      codexUnlocks: EMPTY_CODEX_UNLOCKS,
      achievementHooks: [],
    };
  }

  const oldAlignment = getAlignmentName(social.alignment);
  const summaries: string[] = [];
  const achievementHooks: SocialAchievementHook[] = [];
  for (const axis of ALIGNMENT_AXES) {
    const delta = request.alignment?.[axis];
    if (delta === undefined || delta === 0) continue;
    if (!Number.isFinite(delta)) {
      throw new Error(`[reputation] Invalid ${axis} shift`);
    }
    const before = social.alignment[axis];
    social.alignment[axis] = clampInteger(
      before + delta,
      ALIGNMENT_SCORE_MIN,
      ALIGNMENT_SCORE_MAX,
    );
    const applied = social.alignment[axis] - before;
    if (applied !== 0) {
      summaries.push(`${axis === "lawChaos" ? "Law/Chaos" : "Good/Evil"} ${applied > 0 ? "+" : ""}${applied}`);
    }
  }

  const codexUnlockedIds: string[] = [];
  const codexEntries: CodexUnlockResult["entries"][number][] = [];
  for (const change of request.reputation ?? []) {
    const validTarget = change.kind === "town"
      ? isTownId(change.targetId)
      : isFactionId(change.targetId);
    if (!validTarget) {
      throw new Error(
        `[reputation] Unknown ${change.kind} ID: ${change.targetId}`,
      );
    }
    if (!Number.isFinite(change.delta)) {
      throw new Error(`[reputation] Invalid reputation shift`);
    }
    const before = getReputationScore(social, change.kind, change.targetId);
    const beforeTier = getReputationTier(before);
    const after = clampInteger(
      before + change.delta,
      REPUTATION_SCORE_MIN,
      REPUTATION_SCORE_MAX,
    );
    if (change.kind === "town") {
      social.townReputation[change.targetId as TownId] = after;
    } else {
      social.factionReputation[change.targetId as FactionId] = after;
    }
    const applied = after - before;
    if (applied === 0) continue;
    const afterTier = getReputationTier(after);
    summaries.push(
      `${describeTarget(change.kind, change.targetId)} ${applied > 0 ? "+" : ""}${applied} (${afterTier.name})`,
    );
    if (afterTier.id !== beforeTier.id) {
      achievementHooks.push({
        type: "reputationTierReached",
        targetKind: change.kind,
        targetId: change.targetId,
        tier: afterTier.id,
        sourceId,
      });
    }
    if (codex && change.kind === "faction") {
      const previousMilestones = new Set(
        getReachedReputationMilestones(before),
      );
      for (const milestoneId of getReachedReputationMilestones(after)) {
        if (previousMilestones.has(milestoneId)) continue;
        const result = unlockCodexFromFutureSignal(codex, {
          type: "reputationMilestone",
          factionId: change.targetId,
          milestoneId,
        });
        codexUnlockedIds.push(...result.unlockedIds);
        codexEntries.push(...result.entries);
      }
    }
  }

  const newAlignment = getAlignmentName(social.alignment);
  if (newAlignment !== oldAlignment) {
    achievementHooks.push({
      type: "alignmentChanged",
      alignment: newAlignment,
      sourceId,
    });
  }
  social.appliedSourceIds.push(sourceId);
  const summary = summaries.length > 0
    ? summaries.join(" | ")
    : `No score change (${newAlignment})`;
  social.history.push({ sourceId, cause, summary });
  if (social.history.length > SOCIAL_HISTORY_LIMIT) {
    social.history.splice(0, social.history.length - SOCIAL_HISTORY_LIMIT);
  }

  return {
    changed: true,
    summary,
    codexUnlocks: {
      unlockedIds: [...new Set(codexUnlockedIds)],
      entries: [...new Map(codexEntries.map((entry) => [entry.id, entry])).values()],
    },
    achievementHooks,
  };
}

export function getTownShopAdjustment(
  player: PlayerState,
  townId: string,
): number {
  return isTownId(townId)
    ? getReputationTier(
      getReputationScore(player.progression.social, "town", townId),
    ).shopAdjustment
    : 0;
}

export function combineShopAdjustments(
  negotiationDiscount: number,
  reputationAdjustment: number,
): number {
  return Math.min(0.35, Math.max(-0.25,
    negotiationDiscount + reputationAdjustment
  ));
}

export function getNpcSocialReaction(
  player: PlayerState,
  townId: string,
): string {
  if (!isTownId(townId)) return "";
  const score = getReputationScore(player.progression.social, "town", townId);
  const tier = getReputationTier(score);
  if (tier.id === "hostile") return "The room goes quiet when you approach. ";
  if (tier.id === "wary") return "They watch you carefully. ";
  if (tier.id === "trusted" || tier.id === "exalted") {
    return "Your name earns an immediate welcome. ";
  }
  if (tier.id === "friendly") return "They greet you warmly. ";
  return "";
}

export function getAlignmentThresholdExplanation(): readonly string[] {
  return [
    `Lawful at +${ALIGNMENT_THRESHOLD}; Chaotic at -${ALIGNMENT_THRESHOLD}.`,
    `Good at +${ALIGNMENT_THRESHOLD}; Evil at -${ALIGNMENT_THRESHOLD}.`,
    "Scores between those boundaries are Neutral.",
  ];
}

export function getReputationThresholdExplanation(): string {
  return REPUTATION_TIERS.map((tier) =>
    `${tier.name} ${tier.minimum >= 0 ? "+" : ""}${tier.minimum}`
  ).join(" | ");
}

export function explainSocialState(player: PlayerState): readonly string[] {
  const social = player.progression.social;
  return [
    `${getAlignmentName(social.alignment)} | Law/Chaos ${social.alignment.lawChaos} | Good/Evil ${social.alignment.goodEvil}`,
    ...getAlignmentThresholdExplanation(),
    getReputationThresholdExplanation(),
  ];
}

export interface SocialDebugCommandResult {
  readonly changed: boolean;
  readonly lines: readonly string[];
}

export function executeSocialDebugCommand(
  player: PlayerState,
  domain: "alignment" | "reputation",
  args: string,
  codex?: CodexData,
): SocialDebugCommandResult {
  const parts = args.trim().split(/\s+/).filter(Boolean);
  const action = parts[0]?.toLowerCase() ?? "list";
  if (action === "list" || action === "explain") {
    if (domain === "alignment") {
      return {
        changed: false,
        lines: explainSocialState(player),
      };
    }
    const social = player.progression.social;
    const townLines = Object.entries(social.townReputation).map(
      ([id, score]) =>
        `town ${id}: ${getReputationTier(score ?? 0).name} (${score ?? 0})`,
    );
    const factionLines = Object.entries(social.factionReputation).map(
      ([id, score]) =>
        `faction ${id}: ${getReputationTier(score ?? 0).name} (${score ?? 0})`,
    );
    return {
      changed: false,
      lines: action === "explain"
        ? [getReputationThresholdExplanation(), ...townLines, ...factionLines]
        : [...townLines, ...factionLines].length > 0
          ? [...townLines, ...factionLines]
          : ["No non-neutral reputation scores."],
    };
  }

  if (domain === "alignment") {
    const axis = ALIGNMENT_AXES.find((candidate) => candidate === parts[1]);
    const value = Number(parts[2]);
    if (
      (action !== "set" && action !== "adjust")
      || !axis
      || !Number.isInteger(value)
    ) {
      return {
        changed: false,
        lines: ["Usage: /alignment <list|explain|set|adjust> [lawChaos|goodEvil] [integer]"],
      };
    }
    const delta = action === "set"
      ? value - player.progression.social.alignment[axis]
      : value;
    const result = applySocialMutation(player, {
      sourceId: `debug:alignment:${action}:${axis}:${value}:${player.progression.social.appliedSourceIds.length + 1}`,
      cause: `Debug ${action} ${axis}`,
      alignment: { [axis]: delta },
    }, codex);
    return { changed: result.changed, lines: [result.summary] };
  }

  const kind = parts[1] === "town" || parts[1] === "faction"
    ? parts[1]
    : undefined;
  const targetId = parts[2] ?? "";
  const value = Number(parts[3]);
  const validTarget = kind === "town"
    ? isTownId(targetId)
    : kind === "faction" ? isFactionId(targetId) : false;
  if (
    (action !== "set" && action !== "adjust")
    || !kind
    || !validTarget
    || !Number.isInteger(value)
  ) {
    return {
      changed: false,
      lines: ["Usage: /reputation <list|explain|set|adjust> <town|faction> <id> <integer>"],
    };
  }
  const current = getReputationScore(
    player.progression.social,
    kind,
    targetId,
  );
  const result = applySocialMutation(player, {
    sourceId: `debug:reputation:${action}:${kind}:${targetId}:${value}:${player.progression.social.appliedSourceIds.length + 1}`,
    cause: `Debug ${action} ${kind} ${targetId}`,
    reputation: [{
      kind,
      targetId,
      delta: action === "set" ? value - current : value,
    }],
  }, codex);
  return { changed: result.changed, lines: [result.summary] };
}
