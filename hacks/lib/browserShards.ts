function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function entries(value: unknown): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("Invalid Playwright discovery entries");
  return value;
}

/** Interleave adjacent cases instead of putting an entire expensive file on one runner. */
export function createBrowserShards(report: unknown, count: number): string[][] {
  if (!Number.isInteger(count) || count < 1) throw new Error("Browser shard count must be a positive integer");
  if (!isRecord(report) || !Array.isArray(report.suites) || entries(report.errors).length > 0) {
    throw new Error("Cannot shard an invalid or failed Playwright discovery");
  }
  const descriptions: string[] = [];
  const visit = (suite: unknown, ancestors: string[] = []): void => {
    if (!isRecord(suite) || typeof suite.title !== "string") {
      throw new Error("Invalid Playwright discovery suite");
    }
    const path = suite.file === suite.title ? ancestors : [...ancestors, suite.title];
    for (const spec of entries(suite.specs)) {
      if (!isRecord(spec) || typeof spec.file !== "string" || typeof spec.title !== "string") {
        throw new Error("Invalid Playwright discovery case");
      }
      for (const test of entries(spec.tests)) {
        if (!isRecord(test) || typeof test.projectName !== "string") {
          throw new Error("Invalid Playwright discovery project");
        }
        const titles = [spec.file, ...path, spec.title];
        if (titles.some((title) => typeof title !== "string" || !title || /[\r\n>]/.test(title))
        ) throw new Error("Ambiguous Playwright test-list identity");
        descriptions.push([
          ...(test.projectName ? [`[${test.projectName}]`] : []),
          ...titles,
        ].join(" > "));
      }
    }
    for (const child of entries(suite.suites)) visit(child, path);
  };
  for (const suite of report.suites) visit(suite);
  if (descriptions.length < count || new Set(descriptions).size !== descriptions.length) {
    throw new Error("Browser shards require unique non-empty test identities");
  }
  const shards: string[][] = Array.from({ length: count }, () => []);
  descriptions.forEach((description, index) => shards[index % count].push(description));
  return shards;
}
