import {
  MAX_NEW_GAME_PLUS_CYCLE,
  NEW_GAME_PLUS_LIFETIME_REWARD_IDS,
  NEW_GAME_PLUS_POLICY_VERSION,
  NEW_GAME_PLUS_SAVE_VERSION,
} from "../data/newGamePlus";
import { debugLog } from "../config";

export interface NewGamePlusState {
  cycle: number;
  parentCycle: number;
  cycleId: string;
  requestId: string;
  sourceFingerprint: string;
  createdAt: number;
  policyVersion: number;
  lifetimeRewardIds: string[];
  debug: boolean;
}

export function isNewGamePlusRequestId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9-]{0,79}$/.test(value);
}

/** Invalid cycle authority rejects a candidate, rather than silently removing its scaling. */
export function isNewGamePlusState(value: unknown): value is NewGamePlusState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = Object.fromEntries(Object.entries(value));
  return typeof record.cycle === "number" && Number.isSafeInteger(record.cycle)
    && record.cycle >= 1 && record.cycle <= MAX_NEW_GAME_PLUS_CYCLE
    && record.parentCycle === record.cycle - 1
    && isNewGamePlusRequestId(record.requestId)
    && record.cycleId === `ng:${record.requestId}`
    && typeof record.sourceFingerprint === "string" && /^[0-9a-f]{8}$/.test(record.sourceFingerprint)
    && typeof record.createdAt === "number" && Number.isSafeInteger(record.createdAt) && record.createdAt >= 0
    && record.policyVersion === NEW_GAME_PLUS_POLICY_VERSION
    && typeof record.debug === "boolean"
    && Array.isArray(record.lifetimeRewardIds)
    && record.lifetimeRewardIds.every((id) => typeof id === "string"
      && NEW_GAME_PLUS_LIFETIME_REWARD_IDS.includes(id));
}

export function normalizeNewGamePlusState(
  value: unknown,
  sourceVersion: number,
): { ok: true; state: NewGamePlusState | null } | { ok: false } {
  if (sourceVersion < NEW_GAME_PLUS_SAVE_VERSION || value === null) {
    return { ok: true, state: null };
  }
  if (!isNewGamePlusState(value)) {
    debugLog("[newGamePlus] Invalid cycle authority; isolated slot recovery is required.");
    return { ok: false };
  }
  return {
    ok: true,
    state: {
      cycle: value.cycle, parentCycle: value.parentCycle, cycleId: value.cycleId,
      requestId: value.requestId, sourceFingerprint: value.sourceFingerprint,
      createdAt: value.createdAt, policyVersion: value.policyVersion,
      lifetimeRewardIds: [...new Set(value.lifetimeRewardIds)], debug: value.debug,
    },
  };
}

/** Stable domain salt, not a security token and never a consumer of gameplay RNG. */
export function newGamePlusSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return hash >>> 0 || 1;
}

export function newGamePlusFingerprint(raw: string): string {
  return newGamePlusSeed(raw).toString(16).padStart(8, "0");
}
