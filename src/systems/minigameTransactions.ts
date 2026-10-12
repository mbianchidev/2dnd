import { debugLog } from "../config";
import { featureAvailability, getAvailableFeatureIds } from "./featureDiscovery";
import type { CodexData } from "./codex";
import type { MinigameMutationResult } from "./minigameTypes";
import type { PlayerState } from "./player";
import type { SaveActionResult } from "./save";

/** A rejected write restores every domain touched by the autosave reconciliation path. */
export function commitMinigameMutation(
  player: PlayerState,
  codex: CodexData,
  operation: () => MinigameMutationResult,
  persist: () => SaveActionResult,
): MinigameMutationResult {
  const gold = player.gold;
  const progression = structuredClone(player.progression);
  const savedCodex = structuredClone(codex);
  const restore = (): void => {
    player.gold = gold;
    player.progression = progression;
    codex.entries = savedCodex.entries;
    codex.unlockedEntryIds = savedCodex.unlockedEntryIds;
    featureAvailability.set(getAvailableFeatureIds(player));
  };
  let result: MinigameMutationResult;
  try {
    result = operation();
  } catch (error: unknown) {
    restore();
    debugLog("[minigames] Transaction failed before persistence", error);
    throw error;
  }
  if (!result.ok) {
    restore();
    return result;
  }
  if (!result.changed) return result;
  let saved: SaveActionResult;
  try {
    saved = persist();
  } catch (error: unknown) {
    restore();
    debugLog("[minigames] Persistence failed", error);
    throw error;
  }
  if (saved.ok) return result;
  restore();
  debugLog("[minigames] Transaction rolled back", saved.message);
  return {
    ok: false, changed: false, idempotent: false,
    message: `Activity was not changed: ${saved.message} Retry after local saving is available.`,
  };
}
