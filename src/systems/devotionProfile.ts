import {
  DEVOTION_DOMAINS,
  DEVOTION_TENETS,
  TEMPLE_RITES,
  TEMPLES,
  getDeity,
  type DeityId,
  type TempleId,
} from "../data/devotion";
import { describeDevotionCause, getDevotionProgress } from "./devotion";
import {
  getActiveDevotionBlessing,
  getTempleRiteAvailability,
  type TempleRiteAvailability,
} from "./devotionTemples";
import type { PlayerState } from "./player";

export function getDevotionProfileLines(player: PlayerState): readonly string[] {
  const state = player.progression.devotion;
  const deity = state.deityId ? getDeity(state.deityId) : null;
  const progress = getDevotionProgress(state);
  const blessing = getActiveDevotionBlessing(player);
  return [
    deity ? `Affiliation: ${deity.name}, ${deity.epithet}.` : "Affiliation: none. Your road remains your own.",
    deity
      ? `Devotion: ${state.score}/100 - ${progress.tier!.name}. ${progress.nextTier
        ? `${progress.current}/${progress.target} toward ${progress.nextTier.name} at ${progress.nextTier.minimum}.`
        : "Highest tier reached."}`
      : "Devotion: 0/100 - unaffiliated. Historical causes never become retroactive points.",
    ...(deity ? getDeityTenetLines(deity.id) : [
      "Domains and tenets: no figure chosen. Browse the original fictional pantheon without making a commitment.",
    ]),
    blessing
      ? `Active blessing: ${blessing.definition.name}, +1 AC; ${blessing.effect.remainingTurns} hero turns remain. Battle exit and inn rest clear it.`
      : "Active blessing: none. Every affiliation and unaffiliated visitor receives the same optional traveling thread.",
    `Temple visits: ${state.visitedTempleIds.length}/${TEMPLES.length}. Rites are once per site, never farmable or required.`,
    "Affiliation, devotion, alignment, and reputation are separate. Every choice can finish the Twelvefold Covenant.",
  ];
}

export function getDeityTenetLines(deityId: DeityId): readonly string[] {
  const deity = getDeity(deityId);
  return [
    `Domains: ${deity.domainIds.map((id) =>
      DEVOTION_DOMAINS.find((domain) => domain.id === id)!.name).join(", ")}.`,
    ...deity.tenetIds.map((id) =>
      `Tenet: ${DEVOTION_TENETS.find((tenet) => tenet.id === id)!.text}`),
  ];
}

export function getDevotionHistoryLines(player: PlayerState): readonly string[] {
  const history = player.progression.devotion.history;
  return history.length > 0
    ? [...history].reverse().map(describeDevotionCause)
    : ["No causes recorded. The next explicit choice will name its cause here."];
}

export function getDevotionRites(
  player: PlayerState,
  templeId: TempleId,
): readonly TempleRiteAvailability[] {
  return TEMPLE_RITES.filter((rite) => rite.templeId === templeId)
    .map((rite) => getTempleRiteAvailability(player, rite));
}
