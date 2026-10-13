import { MAIN_QUEST_ID } from "../data/quests";
import { debugLog } from "../config";
import { isQuestCompleted } from "./quests";
import { buildNewGamePlus } from "./newGamePlus";
import { newGamePlusFingerprint, isNewGamePlusRequestId } from "./newGamePlusState";
import {
  decodeStoredSave, getSaveStorage, reportSaveFailure,
  type SaveActionResult, type SaveData,
} from "./save";
import {
  MANUAL_SAVE_SLOT_IDS, SaveSlotStorageAdapter, getSaveSlotStorageKey,
  getSaveSlotBackupKey, getSaveSlotStagingKey, getSaveSlotNameKey,
  type SaveKeyValueStorage, type SaveSlotId,
} from "./saveStorage";

export type ManualSaveSlotId = Exclude<SaveSlotId, "autosave">;

export interface CampaignSlotInspection {
  slotId: SaveSlotId;
  token: string;
  data: SaveData | null;
  raw: string | null;
  present: boolean;
}

export interface NewGamePlusRequest {
  sourceSlotId: ManualSaveSlotId;
  targetSlotId: ManualSaveSlotId;
  sourceToken: string;
  targetToken: string;
  requestId: string;
  createdAt: number;
  overwrite: boolean;
}

export type CampaignInspectionResult =
  | { ok: true; inspection: CampaignSlotInspection }
  | { ok: false; message: string };

function isManualSlot(id: unknown): id is ManualSaveSlotId {
  return MANUAL_SAVE_SLOT_IDS.some((slot) => slot === id);
}

/** Snapshot exact source sidecars, then decode that detached snapshot without recovery writes. */
export function inspectCampaignSlot(
  slotId: SaveSlotId,
  storage: SaveKeyValueStorage | null = getSaveStorage(),
): CampaignInspectionResult {
  if (!storage) return { ok: false, message: "Local campaign storage is unavailable." };
  const keys = [
    getSaveSlotStorageKey(slotId), getSaveSlotStagingKey(slotId),
    getSaveSlotBackupKey(slotId), getSaveSlotNameKey(slotId),
  ];
  const values = new Map<string, string | null>();
  try {
    for (const key of keys) values.set(key, storage.getItem(key));
  } catch (error: unknown) {
    return { ok: false, message: `Cannot inspect ${slotId}: ${String(error)}` };
  }
  const snapshot: SaveKeyValueStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: () => { throw new Error("[newGamePlus] Source inspection cannot write."); },
    removeItem: () => { throw new Error("[newGamePlus] Source inspection cannot delete."); },
  };
  const decoded = new SaveSlotStorageAdapter(snapshot).inspect(slotId, decodeStoredSave);
  return {
    ok: true,
    inspection: {
      slotId, token: JSON.stringify(keys.map((key) => values.get(key) ?? null)),
      data: decoded.ok ? decoded.value : null,
      raw: decoded.ok ? decoded.raw : null,
      present: keys.slice(0, 3).some((key) => values.get(key) !== null),
    },
  };
}

export function prepareNewGamePlus(
  sourceSlotId: ManualSaveSlotId,
  targetSlotId: ManualSaveSlotId,
  requestId: string,
  overwrite = false,
  createdAt = Date.now(),
): { ok: true; request: NewGamePlusRequest } | { ok: false; message: string } {
  if (!isManualSlot(sourceSlotId) || !isManualSlot(targetSlotId) || sourceSlotId === targetSlotId) {
    return { ok: false, message: "Choose a protected manual source and a different manual destination." };
  }
  if (!isNewGamePlusRequestId(requestId) || !Number.isSafeInteger(createdAt) || createdAt < 0) {
    return { ok: false, message: "Invalid New Game+ request identity." };
  }
  const source = inspectCampaignSlot(sourceSlotId);
  const target = inspectCampaignSlot(targetSlotId);
  if (!source.ok) return source;
  if (!target.ok) return target;
  if (!source.inspection.data
    || !isQuestCompleted(source.inspection.data.player.progression.quests, MAIN_QUEST_ID)) {
    return { ok: false, message: "Select a valid completed manual campaign." };
  }
  if (target.inspection.present && !overwrite) {
    return { ok: false, message: "The destination is occupied. Explicitly confirm replacing it." };
  }
  return {
    ok: true,
    request: {
      sourceSlotId, targetSlotId, sourceToken: source.inspection.token,
      targetToken: target.inspection.token, requestId, createdAt, overwrite,
    },
  };
}

/** Revalidate the exact source/target and commit only the independent child; retry never rewinds it. */
export function createNewGamePlusSlot(
  request: NewGamePlusRequest,
): SaveActionResult & { data?: SaveData } {
  if (!isManualSlot(request.sourceSlotId) || !isManualSlot(request.targetSlotId)
    || request.sourceSlotId === request.targetSlotId) {
    return reportSaveFailure("invalid", "New Game+ requires different manual source and destination slots.");
  }
  const storage = getSaveStorage();
  const source = inspectCampaignSlot(request.sourceSlotId, storage);
  const target = inspectCampaignSlot(request.targetSlotId, storage);
  if (!source.ok || !target.ok || !storage) {
    return reportSaveFailure("unavailable", !source.ok ? source.message
      : !target.ok ? target.message : "Local storage is unavailable.");
  }
  if (source.inspection.token !== request.sourceToken || !source.inspection.data || !source.inspection.raw) {
    return reportSaveFailure("invalid", "The source changed. Review a new preview; no campaign was overwritten.");
  }
  const existing = target.inspection.data;
  const parentCycle = source.inspection.data.player.newGamePlus?.cycle ?? 0;
  if (existing?.player.newGamePlus?.requestId === request.requestId
    && existing.player.newGamePlus.createdAt === request.createdAt
    && existing.player.newGamePlus.parentCycle === parentCycle
    && existing.player.newGamePlus.cycle === parentCycle + 1
    && existing.player.newGamePlus.sourceFingerprint === newGamePlusFingerprint(source.inspection.raw)) {
    return { ok: true, data: existing, message: "This New Game+ cycle was already created." };
  }
  if (target.inspection.token !== request.targetToken || (target.inspection.present && !request.overwrite)) {
    return reportSaveFailure("occupied", "The destination changed. Choose and confirm a destination again.");
  }
  const built = buildNewGamePlus(source.inspection.data, request.requestId,
    request.createdAt, newGamePlusFingerprint(source.inspection.raw));
  if (!built.ok) return reportSaveFailure("invalid", built.message);
  const adapter = new SaveSlotStorageAdapter(storage);
  const write = adapter.write(request.targetSlotId, JSON.stringify(built.data), decodeStoredSave);
  if (!write.ok) return reportSaveFailure(write.error.code, write.error.message);
  const named = adapter.setName(request.targetSlotId,
    `NG+ ${built.data.player.newGamePlus!.cycle} ${built.data.player.name}`.slice(0, 24));
  if (!named.ok) debugLog(`[newGamePlus] Cycle saved, but naming failed: ${named.error.message}`);
  return {
    ok: true, data: built.data, message: "Independent New Game+ snapshot created. The completed source is unchanged.",
    ...(!named.ok ? { warning: `Cycle saved, but naming failed: ${named.error.message}` } : {}),
  };
}

/** Explicit snapshot-first step; the autosave is inspected, not loaded, recovered or activated. */
export function copyCompletedSnapshot(
  targetSlotId: ManualSaveSlotId,
  sourceToken: string,
  targetToken: string,
  overwrite: boolean,
): SaveActionResult {
  if (!isManualSlot(targetSlotId)) return reportSaveFailure("invalid", "Choose a manual snapshot destination.");
  const storage = getSaveStorage();
  const source = inspectCampaignSlot("autosave", storage);
  const target = inspectCampaignSlot(targetSlotId, storage);
  if (!storage || !source.ok || !target.ok) {
    return reportSaveFailure("unavailable", "Cannot inspect campaign storage.");
  }
  if (source.inspection.token !== sourceToken || !source.inspection.data
    || !isQuestCompleted(source.inspection.data.player.progression.quests, MAIN_QUEST_ID)) {
    return reportSaveFailure("invalid", "The completed autosave changed. Select it again.");
  }
  const raw = JSON.stringify(source.inspection.data);
  if (target.inspection.raw === raw) return { ok: true, message: "The completed snapshot is already saved." };
  if (target.inspection.token !== targetToken || (target.inspection.present && !overwrite)) {
    return reportSaveFailure("occupied", "Review the occupied snapshot destination before replacing it.");
  }
  const adapter = new SaveSlotStorageAdapter(storage);
  const write = adapter.write(targetSlotId, raw, decodeStoredSave);
  if (!write.ok) return reportSaveFailure(write.error.code, write.error.message);
  const name = adapter.setName(targetSlotId, `Completed ${source.inspection.data.player.name}`.slice(0, 24));
  if (!name.ok) debugLog(`[newGamePlus] Snapshot saved, but naming failed: ${name.error.message}`);
  return {
    ok: true, message: "Completed campaign protected in a manual snapshot. Select it as the source.",
    ...(!name.ok ? { warning: `Snapshot saved, but naming failed: ${name.error.message}` } : {}),
  };
}
