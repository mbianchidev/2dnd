import { describe, expect, it } from "vitest";
import {
  SaveSlotStorageAdapter,
  getSaveSlotBackupKey,
  getSaveSlotStagingKey,
  getSaveSlotStorageKey,
  type SaveKeyValueStorage,
} from "../src/systems/saveStorage";

class MemoryStorage implements SaveKeyValueStorage {
  readonly values = new Map<string, string>();
  failOnSetKey: string | null = null;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (key === this.failOnSetKey) {
      const error = new Error("Storage quota reached");
      error.name = "QuotaExceededError";
      throw error;
    }
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const decode = (raw: string): { value: number } | null => {
  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed !== "object"
    || parsed === null
    || !("value" in parsed)
    || typeof parsed.value !== "number"
  ) {
    return null;
  }
  return { value: parsed.value };
};

describe("SaveSlotStorageAdapter", () => {
  it("atomically writes a primary document and retains the prior valid backup", () => {
    const storage = new MemoryStorage();
    const adapter = new SaveSlotStorageAdapter(storage);

    expect(adapter.write("autosave", '{"value":1}', decode)).toEqual({ ok: true });
    expect(adapter.write("autosave", '{"value":2}', decode)).toEqual({ ok: true });

    expect(storage.getItem(getSaveSlotStorageKey("autosave"))).toBe('{"value":2}');
    expect(storage.getItem(getSaveSlotBackupKey("autosave"))).toBe('{"value":1}');
    expect(storage.getItem(getSaveSlotStagingKey("autosave"))).toBeNull();
  });

  it("leaves the previous primary untouched when staging fails", () => {
    const storage = new MemoryStorage();
    const adapter = new SaveSlotStorageAdapter(storage);
    expect(adapter.write("manual-1", '{"value":1}', decode)).toEqual({ ok: true });
    storage.failOnSetKey = getSaveSlotStagingKey("manual-1");

    const result = adapter.write("manual-1", '{"value":2}', decode);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "quota" },
      previousValuePreserved: true,
    });
    expect(storage.getItem(getSaveSlotStorageKey("manual-1"))).toBe('{"value":1}');
  });

  it("recovers one corrupt primary from its valid backup", () => {
    const storage = new MemoryStorage();
    const adapter = new SaveSlotStorageAdapter(storage);
    storage.setItem(getSaveSlotStorageKey("manual-2"), "{broken");
    storage.setItem(getSaveSlotBackupKey("manual-2"), '{"value":7}');

    const result = adapter.read("manual-2", decode);

    expect(result).toMatchObject({
      ok: true,
      value: { value: 7 },
      source: "backup",
      recovered: true,
    });
    expect(storage.getItem(getSaveSlotStorageKey("manual-2"))).toBe('{"value":7}');
  });

  it("keeps corruption isolated to the affected slot", () => {
    const storage = new MemoryStorage();
    const adapter = new SaveSlotStorageAdapter(storage);
    storage.setItem(getSaveSlotStorageKey("manual-1"), "{broken");
    storage.setItem(getSaveSlotStorageKey("manual-2"), '{"value":9}');

    expect(adapter.read("manual-1", decode)).toMatchObject({
      ok: false,
      error: { code: "corrupt" },
      present: true,
    });
    expect(adapter.read("manual-2", decode)).toMatchObject({
      ok: true,
      value: { value: 9 },
    });
  });

  it("rejects invalid outgoing payloads before touching storage", () => {
    const storage = new MemoryStorage();
    const adapter = new SaveSlotStorageAdapter(storage);

    const result = adapter.write("manual-3", "{}", decode);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "invalid" },
      previousValuePreserved: true,
    });
    expect(storage.values.size).toBe(0);
  });
});
