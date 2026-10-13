import { describe, expect, it } from "vitest";
import { createBrowserShards } from "../hacks/lib/browserShards";

describe("complete balanced browser shards", () => {
  const specs = Array.from({ length: 9 }, (_, index) => ({
    file: "mock.spec.ts", title: `Mock case ${index}`,
    tests: [{ projectName: "" }],
  }));
  const report = { suites: [{
    file: "mock.spec.ts", title: "mock.spec.ts", specs,
    suites: [{
      title: "Nested fixture", file: "mock.spec.ts",
      specs: [{ file: "mock.spec.ts", title: "Nested case", tests: [{ projectName: "mock-project" }] }],
    }],
  }] };

  it("distributes adjacent expensive cases without losing, duplicating or changing test identities", () => {
    const shards = createBrowserShards(report, 4);
    expect(shards.map((shard) => shard.length)).toEqual([3, 3, 2, 2]);
    expect(shards[0]).toEqual([
      "mock.spec.ts > Mock case 0", "mock.spec.ts > Mock case 4", "mock.spec.ts > Mock case 8",
    ]);
    expect(shards[1]).toContain("[mock-project] > mock.spec.ts > Nested fixture > Nested case");
    expect(new Set(shards.flat()).size).toBe(10);
    expect(shards.flat().sort()).toEqual(createBrowserShards(report, 1).flat().sort());
  });

  it("puts each of five adjacent campaign journeys on a separate shard", () => {
    const campaign = {
      title: "mock-campaign.spec.ts",
      file: "mock-campaign.spec.ts",
      specs: Array.from({ length: 5 }, (_, index) => ({
        file: "mock-campaign.spec.ts", title: `Mock campaign ${index}`,
        tests: [{ projectName: "" }],
      })),
    };
    const discovery = { suites: [...report.suites, campaign] };
    const shards = createBrowserShards(discovery, 5);
    expect(shards.map((shard) => shard.length)).toEqual([3, 3, 3, 3, 3]);
    expect(shards.map((shard) => shard.filter((test) =>
      test.startsWith("mock-campaign.spec.ts > ")).length)).toEqual([1, 1, 1, 1, 1]);
    expect(new Set(shards.flat()).size).toBe(15);
    expect(shards.flat().sort()).toEqual(createBrowserShards(discovery, 1).flat().sort());
  });

  it("rejects missing, duplicate and ambiguous discovery rather than reporting an incomplete gate", () => {
    expect(() => createBrowserShards({}, 4)).toThrow(/discovery/);
    expect(() => createBrowserShards({ ...report, errors: ["mock failure"] }, 4)).toThrow(/discovery/);
    expect(() => createBrowserShards(report, 0)).toThrow(/positive/);
    expect(() => createBrowserShards(report, 11)).toThrow(/identities/);
    expect(() => createBrowserShards({ suites: [report.suites[0], report.suites[0]] }, 4)).toThrow(/identities/);
    expect(() => createBrowserShards({
      suites: [{ title: "mock.spec.ts", file: "mock.spec.ts",
        specs: [{ ...specs[0], title: "invalid > mock" }] }],
    }, 1)).toThrow(/Ambiguous/);
  });
});
