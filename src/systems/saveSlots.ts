import { debugLog } from "../config";
import { CAMPAIGN_EPILOGUE_CUTSCENE_ID } from "../data/cutscenes";
import {
  getChunk,
  getCity,
  getDungeon,
} from "../data/map";
import { MAIN_QUEST_ID } from "../data/quests";
import {
  getSeaZone,
  getSeaZoneAt,
} from "../data/nautical";
import { getPlayerClass } from "./classes";
import type { CodexData } from "./codex";
import type { PlayerState } from "./player";
import { isQuestCompleted } from "./quests";
import {
  createCurrentSaveData,
  decodeStoredSave,
  ensureSaveStorageMigrated,
  normalizeSaveData,
  persistSaveData,
  readSaveSlotData,
  reportSaveFailure,
  type SaveActionErrorCode,
  type SaveActionResult,
  type SaveData,
} from "./save";
import {
  MANUAL_SAVE_SLOT_IDS,
  SAVE_SLOT_IDS,
  SaveSlotStorageAdapter,
  getSaveSlotStorageKey,
  type SaveSlotId,
} from "./saveStorage";
import type { WeatherState } from "./weather";

const SAVE_EXPORT_FORMAT = "2dnd-save-slot";
const SAVE_EXPORT_VERSION = 1;
const MAX_SLOT_NAME_LENGTH = 24;

export type SaveSlotState = "empty" | "valid" | "corrupt" | "unavailable";
export type SaveCampaignStatus = "Prologue" | "In progress" | "Complete" | "Post-game";

export interface SaveSlotMetadata {
  slotId: SaveSlotId;
  slotName: string;
  characterName: string;
  classId: string;
  className: string;
  level: number;
  location: string;
  campaignStatus: SaveCampaignStatus;
  schemaVersion: number;
  savedAt: number;
  playtimeSeconds: number;
}

export interface SaveSlotInfo {
  slotId: SaveSlotId;
  kind: "autosave" | "manual";
  state: SaveSlotState;
  displayName: string;
  metadata?: SaveSlotMetadata;
  diagnostic?: string;
  recovered?: boolean;
}

export interface SaveToSlotOptions {
  overwrite?: boolean;
  name?: string;
}

export type SaveExportResult =
  | { ok: true; fileName: string; json: string }
  | { ok: false; code: SaveActionErrorCode; message: string };

function getStorageAdapter(): SaveSlotStorageAdapter | null {
  return typeof localStorage === "undefined"
    ? null
    : new SaveSlotStorageAdapter(localStorage);
}

function slotDisplayName(
  slotId: SaveSlotId,
  storedName?: string | null,
): string {
  if (slotId === "autosave") return "Autosave";
  const normalizedName = storedName ? normalizeSlotName(storedName) : null;
  if (normalizedName) return normalizedName;
  return `Manual ${Number(slotId.slice("manual-".length))}`;
}

function deriveCampaignStatus(data: SaveData): SaveCampaignStatus {
  if (isQuestCompleted(data.player.progression.quests, MAIN_QUEST_ID)) {
    return data.player.progression.seenCutsceneIds.includes(
      CAMPAIGN_EPILOGUE_CUTSCENE_ID,
    )
      ? "Post-game"
      : "Complete";
  }
  const mainQuest = data.player.progression.quests.quests[MAIN_QUEST_ID];
  const hasProgress = (mainQuest?.stage ?? 0) > 0
    || Object.values(mainQuest?.objectives ?? {}).some((value) => value > 0);
  return hasProgress ? "In progress" : "Prologue";
}

function deriveSaveLocation(player: PlayerState): string {
  if (player.position.inCity) {
    return getCity(player.position.cityId)?.name ?? "Unknown city";
  }
  if (player.position.inDungeon) {
    const dungeon = getDungeon(player.position.dungeonId);
    return dungeon
      ? `${dungeon.name} L${player.position.dungeonLevel + 1}`
      : "Unknown dungeon";
  }
  if (player.progression.nautical.sailing) {
    const sea = getSeaZoneAt(
      player.position.chunkX,
      player.position.chunkY,
      player.position.x,
      player.position.y,
    );
    if (sea) return getSeaZone(sea.zoneId).name;
  }
  return getChunk(player.position.chunkX, player.position.chunkY)?.name
    ?? "Unknown lands";
}

function deriveSlotMetadata(
  slotId: SaveSlotId,
  slotName: string,
  data: SaveData,
): SaveSlotMetadata {
  const playerClass = getPlayerClass(data.player.appearanceId);
  return {
    slotId,
    slotName,
    characterName: data.player.name,
    classId: playerClass.id,
    className: playerClass.label,
    level: data.player.level,
    location: deriveSaveLocation(data.player),
    campaignStatus: deriveCampaignStatus(data),
    schemaVersion: data.version,
    savedAt: data.timestamp,
    playtimeSeconds: data.playtimeSeconds,
  };
}

function getSlotInfo(
  slotId: SaveSlotId,
  adapter: SaveSlotStorageAdapter,
): SaveSlotInfo {
  const displayName = slotDisplayName(slotId, adapter.getName(slotId));
  const result = adapter.read(slotId, decodeStoredSave);
  if (!result.ok) {
    return {
      slotId,
      kind: slotId === "autosave" ? "autosave" : "manual",
      state: result.error.code === "missing"
        ? "empty"
        : result.error.code === "corrupt"
          ? "corrupt"
          : "unavailable",
      displayName,
      ...(result.error.code === "missing"
        ? {}
        : { diagnostic: result.error.message }),
    };
  }
  if (result.recoveryError) {
    debugLog(`[save] ${result.recoveryError.message}`);
  } else if (result.recovered) {
    debugLog(`[save] Recovered ${slotId} from ${result.source}.`);
  }
  return {
    slotId,
    kind: slotId === "autosave" ? "autosave" : "manual",
    state: "valid",
    displayName,
    metadata: deriveSlotMetadata(slotId, displayName, result.value),
    recovered: result.recovered,
    ...(result.recoveryError
      ? { diagnostic: result.recoveryError.message }
      : {}),
  };
}

function normalizeSlotName(name: string): string | null {
  const normalized = name
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SLOT_NAME_LENGTH);
  return normalized.length > 0 ? normalized : null;
}

/** Save the current game state to one stable autosave or manual slot. */
export function saveGameToSlot(
  slotId: SaveSlotId,
  player: PlayerState,
  defeatedBosses: Set<string>,
  codex: CodexData,
  appearanceId: string,
  timeStep: number = 0,
  weatherState?: WeatherState,
  options: SaveToSlotOptions = {},
): SaveActionResult {
  const adapter = getStorageAdapter();
  const data = createCurrentSaveData(
    player,
    defeatedBosses,
    codex,
    appearanceId,
    timeStep,
    weatherState,
  );
  const result = persistSaveData(
    slotId,
    data,
    slotId === "autosave" || options.overwrite === true,
  );
  if (!result.ok || slotId === "autosave") return result;
  if (!adapter) {
    return reportSaveFailure(
      "unavailable",
      "Campaign saved, but slot naming is unavailable.",
    );
  }
  const requestedName = options.name
    ? normalizeSlotName(options.name)
    : adapter.getName(slotId);
  const name = requestedName ?? data.player.name.slice(0, MAX_SLOT_NAME_LENGTH);
  const named = adapter.setName(slotId, name);
  const warning = named.ok
    ? undefined
    : `Campaign saved, but the slot name could not be updated: ${named.error.message}`;
  if (warning) debugLog(`[save] ${warning}`);
  return {
    ok: true,
    message: `Saved ${data.player.name} to ${slotDisplayName(slotId, adapter.getName(slotId))}.`,
    ...(warning ? { warning } : {}),
  };
}

/** List autosave and every manual slot without changing the active campaign. */
export function listSaveSlots(): SaveSlotInfo[] {
  const adapter = getStorageAdapter();
  if (!adapter || typeof localStorage === "undefined") {
    return SAVE_SLOT_IDS.map((slotId) => ({
      slotId,
      kind: slotId === "autosave" ? "autosave" : "manual",
      state: "unavailable",
      displayName: slotDisplayName(slotId),
      diagnostic: "Local campaign storage is unavailable.",
    }));
  }
  ensureSaveStorageMigrated(localStorage, adapter);
  return SAVE_SLOT_IDS.map((slotId) => getSlotInfo(slotId, adapter));
}

/** Rename one manual slot without rewriting its campaign payload. */
export function renameSaveSlot(
  slotId: SaveSlotId,
  name: string,
): SaveActionResult {
  if (slotId === "autosave") {
    return reportSaveFailure(
      "unsupported",
      "The Autosave slot cannot be renamed.",
    );
  }
  const normalized = normalizeSlotName(name);
  if (!normalized) {
    return reportSaveFailure("invalid-name", "Enter a non-empty slot name.");
  }
  const adapter = getStorageAdapter();
  if (!adapter) {
    return reportSaveFailure(
      "unavailable",
      "Local campaign storage is unavailable.",
    );
  }
  const slot = adapter.read(slotId, decodeStoredSave);
  if (!slot.ok) {
    return reportSaveFailure(
      slot.error.code === "missing" ? "not-found" : slot.error.code,
      slot.error.message,
    );
  }
  const result = adapter.setName(slotId, normalized);
  return result.ok
    ? { ok: true, message: `Renamed ${slotId} to ${normalized}.` }
    : reportSaveFailure(result.error.code, result.error.message);
}

/** Copy one independent campaign snapshot into another stable slot. */
export function copySaveSlot(
  sourceSlotId: SaveSlotId,
  targetSlotId: SaveSlotId,
  overwrite = false,
): SaveActionResult {
  if (sourceSlotId === targetSlotId) {
    return reportSaveFailure(
      "invalid",
      "Choose a different destination slot.",
    );
  }
  const source = readSaveSlotData(sourceSlotId);
  if (!source) {
    return reportSaveFailure(
      "not-found",
      `${sourceSlotId} has no valid campaign.`,
    );
  }
  source.timestamp = Date.now();
  const adapter = getStorageAdapter();
  const result = persistSaveData(targetSlotId, source, overwrite);
  if (!result.ok || targetSlotId === "autosave" || !adapter) return result;
  const sourceName = adapter.getName(sourceSlotId);
  const name = normalizeSlotName(
    sourceName ? `Copy of ${sourceName}` : `Copy of ${source.player.name}`,
  ) ?? source.player.name;
  const named = adapter.setName(targetSlotId, name);
  if (!named.ok) {
    return {
      ok: true,
      message: result.message,
      warning: `Campaign copied, but naming failed: ${named.error.message}`,
    };
  }
  return {
    ok: true,
    message: `Copied ${source.player.name} to ${slotDisplayName(targetSlotId, name)}.`,
  };
}

function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (
    typeof value !== "object"
    || value === null
    || Array.isArray(value)
  ) {
    return value;
  }
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map((key) => [key, canonicalizeJson(record[key])]),
  );
}

/** Export one validated slot as deterministic, standalone JSON. */
export function exportSaveSlot(slotId: SaveSlotId): SaveExportResult {
  const data = readSaveSlotData(slotId);
  if (!data) {
    return {
      ok: false,
      code: "not-found",
      message: `${slotDisplayName(slotId)} has no valid campaign to export.`,
    };
  }
  const adapter = getStorageAdapter();
  const name = slotDisplayName(slotId, adapter?.getName(slotId));
  const document = canonicalizeJson({
    format: SAVE_EXPORT_FORMAT,
    formatVersion: SAVE_EXPORT_VERSION,
    name,
    save: data,
  });
  const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || slotId;
  return {
    ok: true,
    fileName: `2dnd-${safeName}.json`,
    json: `${JSON.stringify(document, null, 2)}\n`,
  };
}

/** Import one validated standalone export or legacy campaign document. */
export function importSaveSlot(
  slotId: SaveSlotId,
  json: string,
  overwrite = false,
): SaveActionResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch {
    return reportSaveFailure(
      "invalid-import",
      "The selected file is not valid JSON.",
    );
  }
  const exported = typeof parsed === "object"
      && parsed !== null
      && !Array.isArray(parsed)
      && "format" in parsed
      && parsed.format === SAVE_EXPORT_FORMAT
      && "formatVersion" in parsed
      && parsed.formatVersion === SAVE_EXPORT_VERSION
    ? parsed as Record<string, unknown>
    : null;
  const value = exported?.["save"] ?? parsed;
  const data = normalizeSaveData(value);
  if (!data) {
    return reportSaveFailure(
      "invalid-import",
      "The selected file is not a supported 2D&D campaign save.",
    );
  }
  const result = persistSaveData(slotId, data, overwrite);
  if (!result.ok || slotId === "autosave") return result;
  const exportedName = typeof exported?.["name"] === "string"
    ? normalizeSlotName(exported["name"])
    : null;
  const adapter = getStorageAdapter();
  if (exportedName && adapter) {
    const named = adapter.setName(slotId, exportedName);
    if (!named.ok) {
      return {
        ok: true,
        message: result.message,
        warning: `Campaign imported, but naming failed: ${named.error.message}`,
      };
    }
  }
  return {
    ok: true,
    message: `Imported ${data.player.name} into ${slotDisplayName(slotId, exportedName)}.`,
  };
}

export function formatSavePlaytime(playtimeSeconds: number): string {
  const totalMinutes = Math.floor(Math.max(0, playtimeSeconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export {
  MANUAL_SAVE_SLOT_IDS,
  SAVE_SLOT_IDS,
  getSaveSlotStorageKey,
  type SaveSlotId,
};
