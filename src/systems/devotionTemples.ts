import {
  DEVOTION_BLESSINGS,
  TEMPLE_CONVERSATIONS,
  TEMPLE_RITES,
  TEMPLES,
  getDeity,
  getTemple,
  isDeityId,
  type DevotionBlessingDefinition,
  type TempleDefinition,
  type TempleDialogueChoiceId,
  type TempleId,
  type TempleRiteDefinition,
  type TempleRiteId,
} from "../data/devotion";
import { getCity, getCityChunk, isWalkable } from "../data/map";
import { appendDevotionCause, applyDevotionSource, type DevotionMutationResult } from "./devotion";
import { shortRest, type PlayerPosition, type PlayerState } from "./player";
import { applyStatusEffect, removeStatusEffect, type ActiveStatusEffect } from "./statusEffects";
import {
  applySocialMutation,
  getAlignmentName,
  getReputationScore,
  getReputationTier,
  type SocialMutationResult,
} from "./reputation";

export interface ActiveDevotionBlessing {
  readonly definition: DevotionBlessingDefinition;
  readonly effect: ActiveStatusEffect;
  readonly riteId: TempleRiteId;
}

export interface TempleRiteAvailability {
  readonly definition: TempleRiteDefinition;
  readonly available: boolean;
  readonly reason: string;
}

export interface DevotionAffiliationSnapshot {
  readonly expectedDeityId: PlayerState["progression"]["devotion"]["deityId"];
  readonly expectedScore: number;
}

export function getDevotionAffiliationConsequences(
  player: PlayerState,
  target: PlayerState["progression"]["devotion"]["deityId"],
): string {
  if (player.progression.devotion.deityId !== null) {
    return "Switching and renouncing consequences are awaiting policy review. This checkpoint keeps your current affiliation and score unchanged.";
  }
  return `Choosing ${target ? getDeity(target).name : "no figure"} starts at 0 devotion. Any prepared traveling thread clears; all source and visit ledgers stay consumed.`;
}

/** Commit only after an explicit temple confirmation of the current snapshot. */
export function changeDevotionAffiliation(
  player: PlayerState,
  templeId: TempleId,
  target: PlayerState["progression"]["devotion"]["deityId"],
  snapshot: DevotionAffiliationSnapshot,
): DevotionMutationResult {
  if (target !== null && !isDeityId(target)) throw new Error("[devotion] Unknown affiliation");
  const state = player.progression.devotion;
  const unchanged = (message: string): DevotionMutationResult => ({ changed: false, delta: 0, message });
  if (!isAtDevotionTemple(player, templeId)) return unchanged("Approach this temple first.");
  if (state.deityId !== snapshot.expectedDeityId || state.score !== snapshot.expectedScore) {
    return unchanged("Your devotion changed. Review the choice again before confirming.");
  }
  if (state.deityId === target) return unchanged("Your affiliation is already unchanged.");
  if (state.deityId !== null) {
    return unchanged("Switching policy is awaiting review; no affiliation, score, blessing or ledger changed.");
  }
  if (state.affiliationChanges >= 1_000_000) return unchanged("Affiliation history is at its safe limit.");
  state.affiliationChanges++;
  state.deityId = target;
  state.score = 0;
  removeStatusEffect(player.activeEffects, "templeWard");
  appendDevotionCause(state, {
    sourceId: `affiliation:${state.affiliationChanges}:${target ?? "none"}`,
    deityId: target, delta: 0, score: 0, debug: false,
  });
  return {
    changed: true, delta: 0,
    message: `Chose ${target ? getDeity(target).name : "no affiliation"} at 0 devotion. Traveling thread cleared; sources and visits preserved.`,
  };
}

export function getAdjacentDevotionTemple(position: PlayerPosition): TempleDefinition | undefined {
  if (!position.inCity || position.inDungeon) return undefined;
  return TEMPLES.find((temple) =>
    temple.cityId === position.cityId
    && temple.cityChunkIndex === position.cityChunkIndex
    && Math.abs(temple.x - position.x) + Math.abs(temple.y - position.y) === 1);
}

export function isAtDevotionTemple(player: PlayerState, templeId: TempleId): boolean {
  const temple = getAdjacentDevotionTemple(player.position);
  if (temple?.id !== templeId || player.progression.nautical.sailing) return false;
  const city = getCity(temple.cityId);
  const chunk = city ? getCityChunk(city, temple.cityChunkIndex) : undefined;
  const terrain = chunk?.mapData[player.position.y]?.[player.position.x];
  return terrain !== undefined && isWalkable(terrain);
}

export function visitDevotionTemple(player: PlayerState, templeId: TempleId): DevotionMutationResult {
  if (!isAtDevotionTemple(player, templeId)) {
    return { changed: false, delta: 0, message: "Approach this temple's marked site first." };
  }
  const state = player.progression.devotion;
  if (state.visitedTempleIds.includes(templeId)) {
    return { changed: false, delta: 0, message: "This temple welcomes you again." };
  }
  state.visitedTempleIds.push(templeId);
  return { changed: true, delta: 0, message: `${getTemple(templeId).name} discovered. Affiliation is optional.` };
}

function blessingSource(riteId: TempleRiteId, blessingId: string): string {
  return `devotion:${riteId}:${blessingId}`;
}

export function getActiveDevotionBlessing(player: PlayerState): ActiveDevotionBlessing | null {
  const effect = player.activeEffects.find((entry) => entry.id === "templeWard");
  if (!effect) return null;
  for (const rite of TEMPLE_RITES) {
    if (rite.kind !== "blessing") continue;
    const definition = DEVOTION_BLESSINGS.find((blessing) =>
      blessing.deityId === player.progression.devotion.deityId
      && effect.source === blessingSource(rite.id, blessing.id));
    if (
      definition
      && player.progression.devotion.appliedSourceIds.includes(rite.id)
      && !player.progression.devotion.debugSourceIds.includes(rite.id)
      && effect.remainingTurns > 0 && effect.remainingTurns <= definition.turns
    ) {
      return { definition, effect, riteId: rite.id };
    }
  }
  return null;
}

/** Repair only temple-owned cross-fields; duration and expiry remain status-system authority. */
export function normalizeDevotionBlessing(
  player: PlayerState,
  savedEffects: unknown = player.activeEffects,
): void {
  const effect = player.activeEffects.find((entry) => entry.id === "templeWard");
  if (!effect) return;
  const savedDurationIsValid = Array.isArray(savedEffects) && savedEffects.some(
    (entry: unknown) => {
      if (typeof entry !== "object" || entry === null
        || !("id" in entry) || !("source" in entry) || !("remainingTurns" in entry)) return false;
      return entry.id === "templeWard" && entry.source === effect.source
        && typeof entry.remainingTurns === "number"
        && Number.isInteger(entry.remainingTurns) && entry.remainingTurns > 0;
    },
  );
  if (effect.remainingTurns > 3) effect.remainingTurns = 3;
  if (!savedDurationIsValid || !getActiveDevotionBlessing(player)) {
    player.activeEffects.splice(player.activeEffects.indexOf(effect), 1);
  }
}

export function getTempleRiteAvailability(
  player: PlayerState,
  rite: TempleRiteDefinition,
): TempleRiteAvailability {
  const unavailable = (reason: string): TempleRiteAvailability =>
    ({ definition: rite, available: false, reason });
  if (!isAtDevotionTemple(player, rite.templeId)) return unavailable("Visit this temple to perform its rites.");
  if (player.hp <= 0) return unavailable("Recover before taking part.");
  if (player.progression.achievements.debugMutationActive) {
    return unavailable("Rites cannot grant blessings or spend rests during a debug mutation.");
  }
  if (player.progression.devotion.appliedSourceIds.includes(rite.id)) {
    return unavailable("Already performed here; this rite is once per campaign.");
  }
  if (rite.kind === "blessing" && player.activeEffects.some((effect) => effect.id === "templeWard")) {
    return unavailable("A traveling thread is already active; threads cannot stack or refresh.");
  }
  if (rite.kind === "rest") {
    if (player.shortRestsRemaining <= 0) return unavailable("No short rests remain. Rest at an inn.");
    if (player.hp >= player.maxHp && player.mp >= player.maxMp) {
      return unavailable("HP and MP are full; no rest is needed.");
    }
  }
  return { definition: rite, available: true, reason: rite.description };
}

/** Validate every requirement before spending a rest or applying a status. */
export function performTempleRite(player: PlayerState, riteId: TempleRiteId): DevotionMutationResult {
  const rite = TEMPLE_RITES.find((entry) => entry.id === riteId);
  if (!rite) throw new Error(`[devotion] Unknown rite: ${riteId}`);
  const availability = getTempleRiteAvailability(player, rite);
  if (!availability.available) return { changed: false, delta: 0, message: availability.reason };
  let resultText: string;
  if (rite.kind === "rest") {
    const result = shortRest(player);
    resultText = `Normal short rest: +${result.hpRestored} HP, +${result.mpRestored} MP; ${player.shortRestsRemaining} rests left.`;
  } else {
    const blessing = DEVOTION_BLESSINGS.find((entry) =>
      entry.deityId === player.progression.devotion.deityId)!;
    const result = applyStatusEffect(
      player.activeEffects, blessing.statusId, blessingSource(rite.id, blessing.id), blessing.turns,
    );
    if (!result.applied) return { changed: false, delta: 0, message: result.message };
    resultText = `${blessing.name}: +1 AC for three hero turns in the next battle.`;
  }
  const devotion = applyDevotionSource(player, rite.id);
  return { ...devotion, message: `${resultText} ${devotion.message}` };
}

export function resolveTempleConversation(
  player: PlayerState,
  templeId: TempleId,
  choiceId: TempleDialogueChoiceId,
): DevotionMutationResult & { readonly socialEffect?: SocialMutationResult } {
  const conversation = TEMPLE_CONVERSATIONS.find((entry) => entry.templeId === templeId)!;
  const choice = conversation.choices.find((entry) => entry.id === choiceId);
  if (!choice) throw new Error(`[devotion] Unknown choice: ${choiceId}`);
  if (!isAtDevotionTemple(player, templeId)) {
    return { changed: false, delta: 0, message: "Speak with the keeper at this temple first." };
  }
  if (!choice.sourceId) {
    return { changed: false, delta: 0, message: "The keeper accepts your answer. No score or affiliation changes." };
  }
  const result = applyDevotionSource(player, choice.sourceId);
  if (!result.changed) return result;
  const socialEffect = applySocialMutation(player, {
    sourceId: `devotionDialogue:${conversation.id}:${choice.id}`,
    cause: `${getTemple(templeId).name}: offered a place to another traveler`,
    alignment: { goodEvil: 2 },
    reputation: [{ kind: "town", targetId: getTemple(templeId).cityId, delta: 2 }],
  });
  return {
    ...result, socialEffect,
    message: `${result.message} Social: ${socialEffect.summary}`,
  };
}

export function getTempleGreeting(player: PlayerState, temple: TempleDefinition): string {
  const state = player.progression.devotion;
  const affiliation = state.deityId ? getDeity(state.deityId).name : "no figure";
  const standing = getReputationTier(
    getReputationScore(player.progression.social, "town", temple.cityId),
  ).name;
  return `${temple.keeper}: You follow ${affiliation}; you are welcome here. Your ${getAlignmentName(
    player.progression.social.alignment,
  )} outlook and ${standing} town standing are context, not an affiliation rule.`;
}
