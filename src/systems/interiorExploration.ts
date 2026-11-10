import { getCity, getCityChunk } from "../data/cities";
import { getItem } from "../data/items";
import { getSpell } from "../data/spells";
import { INTERIOR_STUDIES } from "../data/interiorBooks";
import type { InteriorPropData } from "../data/mapTypes";
import { debugLog } from "../config";
import { unlockCodexEntries, type CodexData } from "./codex";
import { getCampaignDifficultyRules, scaleReward } from "./difficulty";
import type { PlayerState } from "./player";
import { getInteriorPropDistance } from "./interiorLayout";

export interface InteriorExplorationResult {
  readonly ok: boolean;
  readonly changed: boolean;
  readonly message: string;
  readonly unlockedIds: readonly string[];
}

export function getCityInteriorProp(player: PlayerState, id?: string): InteriorPropData | undefined {
  const position = player.position;
  if (!position.inCity || position.inDungeon) return undefined;
  const city = getCity(position.cityId);
  const room = city ? getCityChunk(city, position.cityChunkIndex) : undefined;
  return room?.interior?.props.find((prop) => (!id || prop.id === id)
    && (prop.reward || prop.kind === "counter")
    && (getInteriorPropDistance(prop, position.x, position.y) <= 1
      || (prop.kind === "counter" && Math.abs(position.x - prop.x) + Math.abs(position.y - (prop.y - 1)) <= 1)));
}

/** Claim fixed offered supplies or reading knowledge once, with save-before-feedback rollback. */
export function claimCityInteriorProp(
  player: PlayerState, codex: CodexData, id: string, persist: () => boolean,
): InteriorExplorationResult {
  const result = (ok: boolean, changed: boolean, message: string, unlockedIds: readonly string[] = []): InteriorExplorationResult =>
    ({ ok, changed, message, unlockedIds });
  const prop = getCityInteriorProp(player, id);
  if (!prop) return result(false, false, "Move next to the furnishing before searching it.");
  if (!prop.reward) return result(true, false, prop.label);
  const ledger = player.progression.collectedTreasures;
  if (ledger.includes(prop.id)) return result(true, false, `Already searched: ${prop.label}.`);
  if (player.progression.gathering.pending || player.progression.minigames.pending
    || player.progression.worldEvents.pending) return result(false, false, "Finish the current activity before searching.");
  const study = prop.reward.studyId
    ? INTERIOR_STUDIES.find((entry) => entry.id === prop.reward?.studyId) : undefined;
  if (study && (!study.classIds.some((classId) => (player.classProgression.classLevels[classId] ?? 0) >= study.minimumRank)
    || player.stats[study.stat] < 13)) {
    return result(false, false, `${study.label} requires a listed class at rank ${study.minimumRank} and ${study.stat.toUpperCase()} 13.`);
  }
  const item = prop.reward.itemId ? getItem(prop.reward.itemId) : undefined;
  const spell = study ? getSpell(study.spellId) : undefined;
  if ((prop.reward.itemId && !item) || (prop.reward.studyId && (!study || !spell || spell.progressionScope === "track"))) {
    throw new Error(`[interiors] Invalid canonical reward in ${prop.id}.`);
  }
  const before = {
    gold: player.gold, inventoryLength: player.inventory.length, spells: [...player.knownSpells],
    ledger: [...ledger], knowledge: [...codex.unlockedEntryIds],
  };
  const rollback = (): void => {
    player.gold = before.gold;
    player.inventory.splice(before.inventoryLength);
    player.knownSpells.splice(0, player.knownSpells.length, ...before.spells);
    ledger.splice(0, ledger.length, ...before.ledger);
    codex.unlockedEntryIds.splice(0, codex.unlockedEntryIds.length, ...before.knowledge);
  };
  const gold = scaleReward(prop.reward.gold ?? 0, "gold", getCampaignDifficultyRules(player));
  ledger.push(prop.id);
  player.gold += gold;
  if (item) player.inventory.push({ ...item });
  const learned = study && spell && !player.knownSpells.includes(spell.id);
  if (study && spell) {
    if (!ledger.includes(`study:${study.id}`)) ledger.push(`study:${study.id}`);
    if (learned) player.knownSpells.push(spell.id);
  }
  const unlock = prop.reward.knowledgeId ? unlockCodexEntries(codex, [prop.reward.knowledgeId]) : { unlockedIds: [] };
  try {
    if (!persist()) {
      rollback();
      return result(false, false, "Could not save the discovery. No supplies or knowledge were claimed.");
    }
  } catch (error: unknown) {
    rollback();
    debugLog("[interiors] Discovery save failed", error);
    return result(false, false, "Could not save the discovery. No supplies or knowledge were claimed.");
  }
  const gains = [gold > 0 ? `${gold}g` : "", item?.name ?? "", learned ? `Learned ${spell.name}` : "",
    prop.reward.knowledgeId ? "Book knowledge recorded" : "", study && !learned ? "Already mastered" : ""].filter(Boolean);
  return result(true, true, `${prop.label}: ${gains.join(", ")}.`, unlock.unlockedIds);
}
