import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const directories: string[] = [];

async function receipt(
  root: string,
  name: string,
  commit: string,
  times: number[],
  writes: number,
  dirty = false,
  browser = "mock-browser",
): Promise<string> {
  const samples = times.map((titleReadyMs) => ({
    titleReadyMs, bootTexturesMs: 1, jsHeapUsedBytes: 100,
  }));
  const report = {
    commit, harnessCommit: "3".repeat(40), workingTree: { dirty },
    harnessWorkingTree: { dirty: false },
    environment: {
      platform: "mock-os", arch: "mock-arch", cpu: "mock-cpu",
      logicalCpus: 2, node: "mock-node", chromium: browser,
    },
    startup: {
      sampleCount: 3, samples: { emptySave: samples, freshSave: samples },
    },
    idleFrames: {
      emptySave: Array.from({ length: 3 }, () => ({
        frameCount: 120, canvasAttributeWrites: writes, debugStateWrites: 0,
        layoutReportWrites: 0, scriptDurationMs: 2,
      })),
      freshSave: Array.from({ length: 3 }, () => ({
        frameCount: 120, canvasAttributeWrites: writes, debugStateWrites: 0,
        layoutReportWrites: 0, scriptDurationMs: 2,
      })),
    },
    bundle: { scriptBytes: 100, scriptGzipBytes: 50, largestScriptBytes: 50 },
  };
  const path = join(root, name);
  await writeFile(path, `Build output\nBaseline JSON:\n${JSON.stringify(report)}`);
  return path;
}

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe("balanced performance receipts", () => {
  it.each(["valid", "dirty", "different-browser"] as const)(
    "handles %s paired receipts without discarding slower samples",
    async (scenario) => {
      const root = await mkdtemp(join(tmpdir(), "2dnd-performance-fixture-"));
      directories.push(root);
      const paths = [
        await receipt(root, "base-1.log", "1".repeat(40), [10, 20, 90], 1_200),
        await receipt(root, "head-1.log", "2".repeat(40), [5, 6, 7], 0, scenario === "dirty"),
        await receipt(root, "head-2.log", "2".repeat(40), [30, 40, 900], 0, false,
          scenario === "different-browser" ? "different-mock-browser" : "mock-browser"),
        await receipt(root, "base-2.log", "1".repeat(40), [11, 21, 99], 1_200),
      ];
      const result = spawnSync(process.execPath, ["hacks/compare-performance.mjs", ...paths], {
        encoding: "utf8",
      });
      expect(result.status).toBe(scenario === "valid" ? 0 : 1);
      if (scenario === "valid") {
        expect(result.stderr).toBe("");
        expect(result.stdout).toContain("| emptySave title | 20 ms | 7 ms | -65% |");
        expect(result.stdout).toContain("| emptySave DOM writes / 120 frames | 1200 | 0 | -100% |");
        expect(result.stdout).toContain("not portable FPS/latency guarantees");
      } else {
        expect(result.stderr).toContain(scenario === "dirty"
          ? "Invalid or dirty performance provenance" : "different environments");
      }
    },
  );
});
