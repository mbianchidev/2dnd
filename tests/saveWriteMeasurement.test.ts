import { describe, expect, it } from "vitest";
import { SAVE_WRITE_MEASURE, SaveSlotStorageAdapter } from "../src/systems/saveStorage";

describe("actual atomic save-write measurement", () => {
  it("keeps only the latest outcome without changing the slot or adapter result", () => {
    const adapter = new SaveSlotStorageAdapter(localStorage);
    const decode = (raw: string): number | null => raw === "1" ? 1 : null;
    performance.clearMeasures(SAVE_WRITE_MEASURE);
    for (let count = 0; count < 50; count += 1) {
      expect(adapter.write("manual-1", "1", decode)).toEqual({ ok: true });
    }
    expect(localStorage.getItem("2dnd_save_slot_manual-1")).toBe("1");
    const measurements = performance.getEntriesByName(SAVE_WRITE_MEASURE);
    expect(measurements).toHaveLength(1);
    expect(measurements[0]!.duration).toBeGreaterThanOrEqual(0);
    const measured = measurements[0]!;
    if (!("detail" in measured)) throw new Error("Expected a PerformanceMeasure");
    expect(measured.detail).toEqual({
      slotId: "manual-1", ok: true,
    });
    expect(adapter.write("manual-1", "invalid", decode).ok).toBe(false);
    expect(performance.getEntriesByName(SAVE_WRITE_MEASURE)).toHaveLength(1);
    expect(localStorage.getItem("2dnd_save_slot_manual-1")).toBe("1");
  });
});
