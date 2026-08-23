export const SAVE_SLOT_IDS = [
  "autosave",
  "manual-1",
  "manual-2",
  "manual-3",
] as const;

export type SaveSlotId = (typeof SAVE_SLOT_IDS)[number];

export const MANUAL_SAVE_SLOT_IDS = [
  "manual-1",
  "manual-2",
  "manual-3",
] as const satisfies readonly SaveSlotId[];

export const LEGACY_SAVE_STORAGE_KEY = "2dnd_save";
export const SAVE_SLOT_MIGRATION_KEY = "2dnd_save_slots_migrated_v1";

export interface SaveKeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type SaveStorageErrorCode =
  | "missing"
  | "corrupt"
  | "invalid"
  | "quota"
  | "unavailable"
  | "verification";

export interface SaveStorageError {
  code: SaveStorageErrorCode;
  message: string;
}

export type SaveStorageWriteResult =
  | { ok: true }
  | { ok: false; error: SaveStorageError; previousValuePreserved: boolean };

export type SaveStorageReadResult<T> =
  | {
    ok: true;
    value: T;
    raw: string;
    source: "primary" | "staging" | "backup";
    recovered: boolean;
    recoveryError?: SaveStorageError;
  }
  | {
    ok: false;
    error: SaveStorageError;
    present: boolean;
  };

export function isSaveSlotId(value: unknown): value is SaveSlotId {
  return typeof value === "string"
    && (SAVE_SLOT_IDS as readonly string[]).includes(value);
}

export function getSaveSlotStorageKey(slotId: SaveSlotId): string {
  return slotId === "autosave"
    ? LEGACY_SAVE_STORAGE_KEY
    : `2dnd_save_slot_${slotId}`;
}

export function getSaveSlotBackupKey(slotId: SaveSlotId): string {
  return `${getSaveSlotStorageKey(slotId)}:backup`;
}

export function getSaveSlotStagingKey(slotId: SaveSlotId): string {
  return `${getSaveSlotStorageKey(slotId)}:staging`;
}

export function getSaveSlotNameKey(slotId: SaveSlotId): string {
  return `${getSaveSlotStorageKey(slotId)}:name`;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function classifyStorageError(error: unknown, action: string): SaveStorageError {
  const name = typeof error === "object"
      && error !== null
      && "name" in error
      && typeof error.name === "string"
    ? error.name
    : "";
  const quota = name === "QuotaExceededError"
    || name === "NS_ERROR_DOM_QUOTA_REACHED";
  return {
    code: quota ? "quota" : "unavailable",
    message: quota
      ? `${action} failed because local save storage is full.`
      : `${action} failed: ${describeError(error)}`,
  };
}

export class SaveSlotStorageAdapter {
  constructor(private readonly storage: SaveKeyValueStorage) {}

  read<T>(
    slotId: SaveSlotId,
    decode: (raw: string) => T | null,
  ): SaveStorageReadResult<T> {
    const candidates: ReadonlyArray<{
      source: "primary" | "staging" | "backup";
      key: string;
    }> = [
      { source: "primary", key: getSaveSlotStorageKey(slotId) },
      { source: "staging", key: getSaveSlotStagingKey(slotId) },
      { source: "backup", key: getSaveSlotBackupKey(slotId) },
    ];
    let present = false;

    for (const candidate of candidates) {
      let raw: string | null;
      try {
        raw = this.storage.getItem(candidate.key);
      } catch (error: unknown) {
        return {
          ok: false,
          error: classifyStorageError(error, `Reading ${slotId}`),
          present,
        };
      }
      if (raw === null) continue;
      present = true;

      let value: T | null = null;
      try {
        value = decode(raw);
      } catch {
        value = null;
      }
      if (value === null) continue;

      if (candidate.source === "primary") {
        return {
          ok: true,
          value,
          raw,
          source: candidate.source,
          recovered: false,
        };
      }

      const recoveryError = this.restorePrimary(slotId, raw);
      return {
        ok: true,
        value,
        raw,
        source: candidate.source,
        recovered: true,
        ...(recoveryError ? { recoveryError } : {}),
      };
    }

    return {
      ok: false,
      error: {
        code: present ? "corrupt" : "missing",
        message: present
          ? `${slotId} and its recovery copies are corrupt.`
          : `${slotId} is empty.`,
      },
      present,
    };
  }

  write<T>(
    slotId: SaveSlotId,
    raw: string,
    decode: (candidate: string) => T | null,
  ): SaveStorageWriteResult {
    let decoded: T | null;
    try {
      decoded = decode(raw);
    } catch {
      decoded = null;
    }
    if (decoded === null) {
      return {
        ok: false,
        error: {
          code: "invalid",
          message: `Refused to write invalid data to ${slotId}.`,
        },
        previousValuePreserved: true,
      };
    }

    const primaryKey = getSaveSlotStorageKey(slotId);
    const stagingKey = getSaveSlotStagingKey(slotId);
    const backupKey = getSaveSlotBackupKey(slotId);
    let previous: string | null = null;
    let primaryChanged = false;

    try {
      previous = this.storage.getItem(primaryKey);
      this.storage.setItem(stagingKey, raw);
      const staged = this.storage.getItem(stagingKey);
      if (staged !== raw || decode(staged) === null) {
        return this.rollbackWrite(
          slotId,
          previous,
          primaryChanged,
          {
            code: "verification",
            message: `Could not verify staged data for ${slotId}.`,
          },
        );
      }

      if (previous !== null && decode(previous) !== null) {
        this.storage.setItem(backupKey, previous);
      }

      this.storage.setItem(primaryKey, raw);
      primaryChanged = true;
      const written = this.storage.getItem(primaryKey);
      if (written !== raw || decode(written) === null) {
        return this.rollbackWrite(
          slotId,
          previous,
          primaryChanged,
          {
            code: "verification",
            message: `Could not verify saved data for ${slotId}.`,
          },
        );
      }
      this.storage.removeItem(stagingKey);
      return { ok: true };
    } catch (error: unknown) {
      return this.rollbackWrite(
        slotId,
        previous,
        primaryChanged,
        classifyStorageError(error, `Writing ${slotId}`),
      );
    }
  }

  delete(slotId: SaveSlotId): SaveStorageWriteResult {
    const keys = [
      getSaveSlotStorageKey(slotId),
      getSaveSlotStagingKey(slotId),
      getSaveSlotBackupKey(slotId),
      getSaveSlotNameKey(slotId),
    ];
    try {
      for (const key of keys) this.storage.removeItem(key);
      return { ok: true };
    } catch (error: unknown) {
      return {
        ok: false,
        error: classifyStorageError(error, `Deleting ${slotId}`),
        previousValuePreserved: true,
      };
    }
  }

  getName(slotId: SaveSlotId): string | null {
    try {
      const value = this.storage.getItem(getSaveSlotNameKey(slotId));
      return value?.trim() ? value : null;
    } catch {
      return null;
    }
  }

  setName(slotId: SaveSlotId, name: string): SaveStorageWriteResult {
    try {
      const key = getSaveSlotNameKey(slotId);
      if (name.length === 0) {
        this.storage.removeItem(key);
      } else {
        this.storage.setItem(key, name);
        if (this.storage.getItem(key) !== name) {
          return {
            ok: false,
            error: {
              code: "verification",
              message: `Could not verify the name for ${slotId}.`,
            },
            previousValuePreserved: false,
          };
        }
      }
      return { ok: true };
    } catch (error: unknown) {
      return {
        ok: false,
        error: classifyStorageError(error, `Renaming ${slotId}`),
        previousValuePreserved: true,
      };
    }
  }

  private restorePrimary(
    slotId: SaveSlotId,
    raw: string,
  ): SaveStorageError | undefined {
    try {
      this.storage.setItem(getSaveSlotStorageKey(slotId), raw);
      this.storage.removeItem(getSaveSlotStagingKey(slotId));
      return undefined;
    } catch (error: unknown) {
      return classifyStorageError(error, `Recovering ${slotId}`);
    }
  }

  private rollbackWrite(
    slotId: SaveSlotId,
    previous: string | null,
    primaryChanged: boolean,
    error: SaveStorageError,
  ): SaveStorageWriteResult {
    let previousValuePreserved = !primaryChanged;
    try {
      if (primaryChanged) {
        if (previous === null) {
          this.storage.removeItem(getSaveSlotStorageKey(slotId));
        } else {
          this.storage.setItem(getSaveSlotStorageKey(slotId), previous);
        }
        previousValuePreserved = true;
      }
      this.storage.removeItem(getSaveSlotStagingKey(slotId));
    } catch {
      previousValuePreserved = false;
    }
    return { ok: false, error, previousValuePreserved };
  }
}
