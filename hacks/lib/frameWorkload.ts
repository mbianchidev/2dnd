import type { Page } from "@playwright/test";

export interface FrameWorkloadSample {
  frameCount: number;
  canvasAttributeWrites: number;
  debugStateWrites: number;
  layoutReportWrites: number;
  medianFrameMs: number;
  p95FrameMs: number;
  scriptDurationMs: number;
  frameIntervalsMs: number[];
}

/** Read-only work counters and timings over 120 frames; no clock, RNG or game-state changes. */
export async function measureFrameWorkload(page: Page): Promise<FrameWorkloadSample> {
  const client = await page.context().newCDPSession(page);
  try {
    await client.send("Performance.enable");
    const before = await client.send("Performance.getMetrics");
    const sample = await page.evaluate(() => new Promise<
      Omit<FrameWorkloadSample, "scriptDurationMs">
    >((resolve) => {
      const canvas = document.querySelector("#game-container canvas");
      const state = document.getElementById("debug-state");
      const report = document.getElementById("layout-report");
      if (!canvas || !state || !report) throw new Error("Missing frame-workload surfaces");
      const counts = { canvasAttributeWrites: 0, debugStateWrites: 0, layoutReportWrites: 0 };
      const count = (records: MutationRecord[]): void => {
        for (const record of records) {
          if (record.target === canvas) counts.canvasAttributeWrites++;
          else if (record.target === state || state.contains(record.target)) counts.debugStateWrites++;
          else counts.layoutReportWrites++;
        }
      };
      const observer = new MutationObserver(count);
      observer.observe(canvas, { attributes: true });
      observer.observe(state, { childList: true, characterData: true, subtree: true });
      observer.observe(report, { childList: true, characterData: true, subtree: true });
      const frameIntervalsMs: number[] = [];
      let previous = performance.now();
      const tick = (time: number): void => {
        frameIntervalsMs.push(time - previous);
        previous = time;
        if (frameIntervalsMs.length < 120) {
          requestAnimationFrame(tick);
          return;
        }
        count(observer.takeRecords());
        observer.disconnect();
        const sorted = [...frameIntervalsMs].sort((left, right) => left - right);
        resolve({
          frameCount: frameIntervalsMs.length,
          medianFrameMs: sorted[59]!,
          p95FrameMs: sorted[113]!,
          frameIntervalsMs,
          ...counts,
        });
      };
      requestAnimationFrame(tick);
    }));
    const after = await client.send("Performance.getMetrics");
    const scriptDuration = (metrics: typeof before): number => {
      const value = metrics.metrics.find((metric) => metric.name === "ScriptDuration")?.value;
      if (value === undefined) throw new Error("Missing browser script-duration metric");
      return value;
    };
    return {
      ...sample,
      scriptDurationMs: (scriptDuration(after) - scriptDuration(before)) * 1000,
    };
  } finally {
    await client.detach();
  }
}
