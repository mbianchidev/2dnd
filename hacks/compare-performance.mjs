import { readFile } from "node:fs/promises";

async function readReport(path) {
  const content = await readFile(path, "utf8");
  const marker = "\nBaseline JSON:\n";
  const index = content.lastIndexOf(marker);
  if (index < 0) throw new Error(`Missing baseline JSON in ${path}`);
  const report = JSON.parse(content.slice(index + marker.length));
  if (!/^[0-9a-f]{40}$/.test(report.commit)
    || !/^[0-9a-f]{40}$/.test(report.harnessCommit)
    || report.workingTree?.dirty !== false
    || report.harnessWorkingTree?.dirty !== false
    || !Number.isInteger(report.startup?.sampleCount)
    || report.startup.sampleCount < 3 || report.startup.sampleCount > 30) {
    throw new Error(`Invalid or dirty performance provenance in ${path}`);
  }
  for (const scenario of ["emptySave", "freshSave"]) {
    if (!Array.isArray(report.startup.samples?.[scenario])
      || report.startup.samples[scenario].length !== report.startup.sampleCount
      || !Array.isArray(report.idleFrames?.[scenario])
      || report.idleFrames[scenario].length !== 3
      || report.idleFrames[scenario].some((sample) => sample.frameCount !== 120)) {
      throw new Error(`Incomplete performance samples in ${path}: ${scenario}`);
    }
  }
  return report;
}

function percentile(values, fraction) {
  if (values.length === 0 || values.some((value) => !Number.isFinite(value))) {
    throw new Error("Performance comparisons require finite non-empty samples");
  }
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(fraction * sorted.length) - 1];
}

function format(value) {
  return String(Math.round(value * 100) / 100);
}

function compareRow(label, base, head, unit = "") {
  const before = percentile(base, 0.5);
  const after = percentile(head, 0.5);
  const change = before === 0 ? (after === 0 ? "0%" : "n/a") : `${format((after / before - 1) * 100)}%`;
  return `| ${label} | ${format(before)}${unit} | ${format(after)}${unit} | ${change} |`;
}

async function main() {
  const paths = process.argv.slice(2);
  if (paths.length !== 4) {
    throw new Error("Usage: node hacks/compare-performance.mjs base-1.log head-1.log head-2.log base-2.log");
  }
  const reports = await Promise.all(paths.map(readReport));
  const base = [reports[0], reports[3]];
  const head = [reports[1], reports[2]];
  for (const report of reports) {
    for (const field of ["platform", "arch", "cpu", "logicalCpus", "node", "chromium"]) {
      if (report.environment[field] !== reports[0].environment[field]) {
        throw new Error(`Cannot compare different environments: ${field}`);
      }
    }
    if (report.harnessCommit !== reports[0].harnessCommit
      || report.startup.sampleCount !== reports[0].startup.sampleCount
      || report.workingTree.dirty) throw new Error("Comparison requires clean commits and an identical harness/sample count");
  }
  if (base[0].commit !== base[1].commit || head[0].commit !== head[1].commit) {
    throw new Error("Comparison revisions changed between repetitions");
  }
  const values = (runs, read) => runs.flatMap(read);
  console.log("## Paired production performance");
  console.log(`Base \`${base[0].commit}\`; head \`${head[0].commit}\`; harness \`${reports[0].harnessCommit}\`.`);
  console.log(`Order: base/head/head/base on one runner; ${reports[0].startup.sampleCount} cache-disabled samples per case per run. All samples, load averages and deviations remain in the artifacts.`);
  console.log("\n| Metric | Base median | Head median | Observed change |");
  console.log("| --- | ---: | ---: | ---: |");
  for (const scenario of ["emptySave", "freshSave"]) {
    const sample = (runs, metric) => values(runs, (run) => run.startup.samples[scenario].map((entry) => entry[metric]));
    console.log(compareRow(`${scenario} title`, sample(base, "titleReadyMs"), sample(head, "titleReadyMs"), " ms"));
    console.log(compareRow(`${scenario} textures`, sample(base, "bootTexturesMs"), sample(head, "bootTexturesMs"), " ms"));
    console.log(compareRow(`${scenario} heap`, sample(base, "jsHeapUsedBytes"), sample(head, "jsHeapUsedBytes"), " B"));
    const frames = (runs, read) => values(runs, (run) => run.idleFrames[scenario].map(read));
    const writes = (entry) => entry.canvasAttributeWrites + entry.debugStateWrites + entry.layoutReportWrites;
    console.log(compareRow(`${scenario} DOM writes / 120 frames`, frames(base, writes), frames(head, writes)));
    console.log(compareRow(`${scenario} script / 120 frames`, frames(base, (entry) => entry.scriptDurationMs), frames(head, (entry) => entry.scriptDurationMs), " ms"));
  }
  for (const [field, label] of [
    ["scriptBytes", "Total JavaScript"],
    ["scriptGzipBytes", "Gzipped JavaScript"],
    ["largestScriptBytes", "Largest JavaScript chunk"],
  ]) {
    console.log(compareRow(label, base.map((run) => run.bundle[field]), head.map((run) => run.bundle[field]), " B"));
  }
  console.log("\nTimings are observations, not portable FPS/latency guarantees. Deterministic work counts and byte sizes distinguish removed work from scheduling noise; wall-clock warnings or thresholds are not suppressed.");
}

main().catch((error) => {
  console.error(`[performance-comparison] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
