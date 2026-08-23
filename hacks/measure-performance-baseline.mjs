import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import {
  arch,
  cpus,
  platform,
  release,
  totalmem,
} from "node:os";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, "dist");
const BASE_PATH = "/2dnd/";
const SAVE_KEY = "2dnd_save";
const BOOT_TEXTURE_MEASURE = "2dnd:boot-textures";
const DEFAULT_SAMPLE_COUNT = 20;
const SAVE_WRITE_BATCHES = 50;
const SAVE_WRITES_PER_BATCH = 100;

function readSampleCount(value) {
  if (value === undefined) return DEFAULT_SAMPLE_COUNT;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 3 || parsed > 30) {
    throw new Error(
      `PERFORMANCE_SAMPLES must be an integer from 3 to 30, received: ${value}`,
    );
  }
  return parsed;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function percentile(values, percentileValue) {
  if (values.length === 0) {
    throw new Error("Cannot summarize an empty metric sample");
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil(percentileValue * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function summarize(values, digits = 2) {
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error("Metric samples must contain only finite numbers");
  }
  return {
    min: round(Math.min(...values), digits),
    median: round(percentile(values, 0.5), digits),
    p95: round(percentile(values, 0.95), digits),
    max: round(Math.max(...values), digits),
  };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${round(bytes / 1024)} KiB`;
  return `${round(bytes / 1024 ** 2)} MiB`;
}

function runGit(args) {
  const result = spawnSync("git", args, {
    cwd: ROOT,
    maxBuffer: 50 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `Git command failed: git ${args.join(" ")}\n`
      + `${result.stderr.toString().trim() || "git failed"}`,
    );
  }
  return result.stdout;
}

async function getGitProvenance() {
  const commit = runGit(["rev-parse", "HEAD"]).toString().trim();
  const status = runGit([
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
  ]);
  if (status.length === 0) {
    return {
      commit,
      dirty: false,
      diffHash: null,
    };
  }

  const trackedDiff = runGit(["diff", "--binary", "HEAD", "--no-ext-diff"]);
  const hash = createHash("sha256");
  hash.update(status);
  hash.update(trackedDiff);

  const statusEntries = status.toString().split("\0").filter(Boolean);
  const untrackedPaths = statusEntries
    .filter((entry) => entry.startsWith("?? "))
    .map((entry) => entry.slice(3))
    .sort();
  for (const path of untrackedPaths) {
    hash.update(path);
    hash.update(await readFile(join(ROOT, path)));
  }

  return {
    commit,
    dirty: true,
    diffHash: hash.digest("hex"),
  };
}

function assertMatchingProvenance(before, after) {
  if (
    before.commit !== after.commit
    || before.dirty !== after.dirty
    || before.diffHash !== after.diffHash
  ) {
    throw new Error(
      "The git worktree changed during measurement; discard this run and retry.",
    );
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: "inherit",
      ...options,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} stopped by ${signal}`));
      } else if (code !== 0) {
        reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
      } else {
        resolve();
      }
    });
  });
}

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to allocate a baseline preview port"));
        return;
      }
      server.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}

function getContentType(path) {
  switch (extname(path)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
    case ".map":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

function isNodeError(error) {
  return typeof error === "object" && error !== null && "code" in error;
}

function startStaticServer(port) {
  const server = createHttpServer(async (request, response) => {
    const requestUrl = new URL(
      request.url ?? "/",
      `http://127.0.0.1:${port}`,
    );
    if (!requestUrl.pathname.startsWith(BASE_PATH)) {
      response.writeHead(404).end("Not found");
      return;
    }

    const requestedPath = decodeURIComponent(
      requestUrl.pathname.slice(BASE_PATH.length),
    ) || "index.html";
    if (
      requestedPath.startsWith("/")
      || requestedPath.split("/").includes("..")
    ) {
      response.writeHead(400).end("Invalid path");
      return;
    }

    const filePath = join(DIST, requestedPath);
    try {
      const data = await readFile(filePath);
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": getContentType(filePath),
      });
      response.end(data);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        response.writeHead(404).end("Not found");
        return;
      }
      response.writeHead(500).end("Failed to read built asset");
      console.error(
        `[performance-baseline] Failed to read ${filePath}:`,
        error,
      );
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function stopStaticServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(path));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files;
}

async function measureBundle() {
  const files = await listFiles(DIST);
  const measurements = [];
  for (const path of files) {
    const data = await readFile(path);
    measurements.push({
      path: relative(DIST, path),
      extension: extname(path),
      bytes: data.byteLength,
      gzipBytes: gzipSync(data, { level: 9 }).byteLength,
    });
  }
  const deployedFiles = measurements.filter((file) => file.extension !== ".map");
  const sourceMaps = measurements.filter((file) => file.extension === ".map");
  const scripts = deployedFiles.filter((file) => file.extension === ".js");
  return {
    deployedBytes: deployedFiles.reduce((total, file) => total + file.bytes, 0),
    deployedGzipBytes: deployedFiles.reduce(
      (total, file) => total + file.gzipBytes,
      0,
    ),
    scriptBytes: scripts.reduce((total, file) => total + file.bytes, 0),
    scriptGzipBytes: scripts.reduce(
      (total, file) => total + file.gzipBytes,
      0,
    ),
    sourceMapBytes: sourceMaps.reduce((total, file) => total + file.bytes, 0),
    files: measurements,
  };
}

const BASELINE_INIT_SCRIPT = `
(() => {
  let seed = 0x2d0d2026;
  Math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x1_0000_0000;
  };

  const state = {};
  Object.defineProperty(globalThis, "__2dndPerformanceBaseline", {
    configurable: true,
    value: state,
  });

  const recordTitleReady = () => {
    const debugState = document.getElementById("debug-state");
    if (
      state.titleReadyMs === undefined
      && debugState?.textContent?.includes("BOOT | Screen: title")
    ) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          state.titleReadyMs = performance.now();
        });
      });
    }
  };

  const observer = new MutationObserver(recordTitleReady);
  const observe = () => {
    observer.observe(document, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    recordTitleReady();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observe, { once: true });
  } else {
    observe();
  }
})();
`;

async function prepareContext(browser, url, rawSave) {
  const storageState = rawSave === null
    ? undefined
    : {
        cookies: [],
        origins: [{
          origin: new URL(url).origin,
          localStorage: [{
            name: SAVE_KEY,
            value: rawSave,
          }],
        }],
      };
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState,
  });
  await context.addInitScript(BASELINE_INIT_SCRIPT);
  return context;
}

async function readStartupMetrics(page, client) {
  await page.waitForFunction(() => {
    const state = globalThis.__2dndPerformanceBaseline;
    return typeof state?.titleReadyMs === "number";
  });
  await page.waitForLoadState("load");
  await page.evaluate(() => {
    if (typeof globalThis.gc === "function") globalThis.gc();
  });
  await page.waitForTimeout(50);

  const [heap, dom, browserMetrics] = await Promise.all([
    client.send("Runtime.getHeapUsage"),
    client.send("Memory.getDOMCounters"),
    page.evaluate((measureName) => {
      const navigation = performance.getEntriesByType("navigation").at(-1);
      const bootMeasure = performance.getEntriesByName(measureName).at(-1);
      const state = globalThis.__2dndPerformanceBaseline;
      if (!(navigation instanceof PerformanceNavigationTiming)) {
        throw new Error("Missing navigation performance entry");
      }
      if (!(bootMeasure instanceof PerformanceMeasure)) {
        throw new Error(`Missing ${measureName} performance measure`);
      }
      if (typeof state?.titleReadyMs !== "number") {
        throw new Error("Missing title-ready performance marker");
      }
      const resources = performance.getEntriesByType("resource");
      return {
        titleReadyMs: state.titleReadyMs,
        bootTexturesMs: bootMeasure.duration,
        domContentLoadedMs: navigation.domContentLoadedEventEnd,
        loadEventMs: navigation.loadEventEnd,
        titleAfterDomContentLoadedMs:
          state.titleReadyMs - navigation.domContentLoadedEventEnd,
        transferBytes:
          navigation.transferSize
          + resources.reduce((total, entry) => {
            return total + (
              entry instanceof PerformanceResourceTiming ? entry.transferSize : 0
            );
          }, 0),
        decodedBodyBytes:
          navigation.decodedBodySize
          + resources.reduce((total, entry) => {
            return total + (
              entry instanceof PerformanceResourceTiming
                ? entry.decodedBodySize
                : 0
            );
          }, 0),
      };
    }, BOOT_TEXTURE_MEASURE),
  ]);

  return {
    ...browserMetrics,
    jsHeapUsedBytes: heap.usedSize,
    jsHeapTotalBytes: heap.totalSize,
    documents: dom.documents,
    domNodes: dom.nodes,
    jsEventListeners: dom.jsEventListeners,
  };
}

async function measureStartup(browser, url, rawSave) {
  const context = await prepareContext(browser, url, rawSave);
  try {
    const page = await context.newPage();
    const client = await context.newCDPSession(page);
    await client.send("Network.enable");
    await client.send("Network.setCacheDisabled", { cacheDisabled: true });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    return await readStartupMetrics(page, client);
  } finally {
    await context.close();
  }
}

async function clickGame(page, gameX, gameY) {
  const canvas = page.locator("#game-container canvas");
  await canvas.waitFor({ state: "visible" });
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Game canvas has no rendered bounds");
  await page.mouse.click(
    bounds.x + (gameX / 640) * bounds.width,
    bounds.y + (gameY / 528) * bounds.height,
  );
}

async function waitForState(page, text) {
  await page.waitForFunction(
    (expected) => document.getElementById("debug-state")
      ?.textContent
      ?.includes(expected),
    text,
  );
}

async function createFreshSave(browser, url) {
  const context = await prepareContext(browser, url, null);
  try {
    const page = await context.newPage();
    const client = await context.newCDPSession(page);
    await client.send("Network.enable");
    await client.send("Network.setCacheDisabled", { cacheDisabled: true });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await waitForState(page, "BOOT | Screen: title");
    await clickGame(page, 320, 324);
    await waitForState(page, "BOOT | Screen: character");
    await page.waitForTimeout(100);
    await page.keyboard.press("Enter");
    await waitForState(page, "BOOT | Screen: stats");
    await clickGame(page, 390, 64);
    await clickGame(page, 400, 460);
    await waitForState(page, "BOOT | Screen: appearance");
    await clickGame(page, 420, 312);
    await waitForState(page, "CUTSCENE | campaign.opening");

    return await page.evaluate(
      (saveKey) => {
        const raw = localStorage.getItem(saveKey);
        if (!raw) throw new Error(`Missing localStorage save: ${saveKey}`);
        const save = JSON.parse(raw);
        return {
          raw,
          schemaVersion: save.version,
          bytes: new TextEncoder().encode(raw).byteLength,
        };
      },
      SAVE_KEY,
    );
  } finally {
    await context.close();
  }
}

async function measureSaveWrites(browser, url, rawSave) {
  const context = await prepareContext(browser, url, rawSave);
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await waitForState(page, "BOOT | Screen: title");
    return await page.evaluate(
      ({ saveKey, writeBatches, writesPerBatch }) => {
        const raw = localStorage.getItem(saveKey);
        if (!raw) throw new Error(`Missing localStorage save: ${saveKey}`);
        const save = JSON.parse(raw);
        const serializeMs = [];
        const storageWriteMs = [];
        const combinedWriteMs = [];

        for (let batch = 0; batch < writeBatches; batch += 1) {
          let serialized = "";
          const startedAt = performance.now();
          for (let index = 0; index < writesPerBatch; index += 1) {
            save.timestamp += 1;
            serialized = JSON.stringify(save);
          }
          serializeMs.push(
            (performance.now() - startedAt) / writesPerBatch,
          );

          const storagePayloads = [];
          for (let index = 0; index < writesPerBatch; index += 1) {
            save.timestamp += 1;
            storagePayloads.push(JSON.stringify(save));
          }
          const storageStartedAt = performance.now();
          for (const payload of storagePayloads) {
            localStorage.setItem(saveKey, payload);
          }
          storageWriteMs.push(
            (performance.now() - storageStartedAt) / writesPerBatch,
          );

          const combinedStartedAt = performance.now();
          for (let index = 0; index < writesPerBatch; index += 1) {
            save.timestamp += 1;
            serialized = JSON.stringify(save);
            localStorage.setItem(saveKey, serialized);
          }
          combinedWriteMs.push(
            (performance.now() - combinedStartedAt) / writesPerBatch,
          );
        }
        return {
          serializeMs,
          storageWriteMs,
          combinedWriteMs,
        };
      },
      {
        saveKey: SAVE_KEY,
        writeBatches: SAVE_WRITE_BATCHES,
        writesPerBatch: SAVE_WRITES_PER_BATCH,
      },
    );
  } finally {
    await context.close();
  }
}

function summarizeStartup(samples) {
  const metric = (name) => summarize(samples.map((sample) => sample[name]));
  return {
    titleReadyMs: metric("titleReadyMs"),
    bootTexturesMs: metric("bootTexturesMs"),
    titleAfterDomContentLoadedMs: metric("titleAfterDomContentLoadedMs"),
    transferBytes: metric("transferBytes"),
    decodedBodyBytes: metric("decodedBodyBytes"),
    jsHeapUsedBytes: metric("jsHeapUsedBytes"),
    domNodes: metric("domNodes"),
    jsEventListeners: metric("jsEventListeners"),
  };
}

function printReport(result) {
  const empty = result.startup.emptySave;
  const saved = result.startup.freshSave;
  console.log("\n## 2D&D performance baseline");
  console.log(`- Commit: \`${result.commit}\``);
  console.log(
    `- Working tree: ${result.workingTree.dirty
      ? `dirty (SHA-256 \`${result.workingTree.diffHash}\`)`
      : "clean"}`,
  );
  console.log(`- Timestamp: ${result.timestamp}`);
  console.log(
    `- Environment: ${result.environment.platform} ${result.environment.arch}, `
    + `${result.environment.cpu}, Node ${result.environment.node}, `
    + `Chromium ${result.environment.chromium}`,
  );
  console.log(
    `- Method: ${result.startup.sampleCount} cache-disabled production `
    + "navigations per startup case; fresh schema-v17 campaign for save metrics.",
  );
  console.log("");
  console.log("| Metric | Empty save median | Empty save p95 | Fresh save median | Fresh save p95 |");
  console.log("| --- | ---: | ---: | ---: | ---: |");
  console.log(
    `| Title ready | ${empty.titleReadyMs.median} ms | `
    + `${empty.titleReadyMs.p95} ms | ${saved.titleReadyMs.median} ms | `
    + `${saved.titleReadyMs.p95} ms |`,
  );
  console.log(
    `| Boot texture generation | ${empty.bootTexturesMs.median} ms | `
    + `${empty.bootTexturesMs.p95} ms | ${saved.bootTexturesMs.median} ms | `
    + `${saved.bootTexturesMs.p95} ms |`,
  );
  console.log(
    `| JS heap used | ${formatBytes(empty.jsHeapUsedBytes.median)} | `
    + `${formatBytes(empty.jsHeapUsedBytes.p95)} | `
    + `${formatBytes(saved.jsHeapUsedBytes.median)} | `
    + `${formatBytes(saved.jsHeapUsedBytes.p95)} |`,
  );
  console.log(
    `| DOM nodes | ${empty.domNodes.median} | ${empty.domNodes.p95} | `
    + `${saved.domNodes.median} | ${saved.domNodes.p95} |`,
  );
  console.log(
    `| JS event listeners | ${empty.jsEventListeners.median} | `
    + `${empty.jsEventListeners.p95} | ${saved.jsEventListeners.median} | `
    + `${saved.jsEventListeners.p95} |`,
  );
  console.log("");
  console.log(
    `- Deployed build: ${formatBytes(result.bundle.deployedBytes)} raw, `
    + `${formatBytes(result.bundle.deployedGzipBytes)} gzip; JavaScript `
    + `${formatBytes(result.bundle.scriptBytes)} raw / `
    + `${formatBytes(result.bundle.scriptGzipBytes)} gzip; source maps `
    + `${formatBytes(result.bundle.sourceMapBytes)}.`,
  );
  console.log(
    `- Fresh schema-v${result.save.schemaVersion} save: `
    + `${formatBytes(result.save.bytes)}; stringify + localStorage write `
    + `${result.save.combinedWriteMs.median} ms median / `
    + `${result.save.combinedWriteMs.p95} ms p95.`,
  );
  console.log("\nBaseline JSON:");
  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  const sampleCount = readSampleCount(process.env.PERFORMANCE_SAMPLES);
  const npmCli = process.env.npm_execpath;
  if (!npmCli) {
    throw new Error(
      "Missing npm_execpath; run the harness through "
      + "`npm run benchmark:baseline`.",
    );
  }
  const initialProvenance = await getGitProvenance();
  await runCommand(process.execPath, [npmCli, "run", "build"], {
    env: {
      ...process.env,
      VITE_BASE_PATH: BASE_PATH,
    },
  });

  const bundle = await measureBundle();
  const port = await findAvailablePort();
  const url = `http://127.0.0.1:${port}${BASE_PATH}game.html`;
  const server = await startStaticServer(port);

  try {
    const browser = await chromium.launch({
      headless: true,
      args: [
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--enable-precise-memory-info",
        "--js-flags=--expose-gc",
      ],
    });
    try {
      const freshSave = await createFreshSave(browser, url);
      if (freshSave.schemaVersion !== 17) {
        throw new Error(
          `Expected fresh save schema v17, received v${freshSave.schemaVersion}`,
        );
      }

      await measureStartup(browser, url, null);
      await measureStartup(browser, url, freshSave.raw);

      const emptySaveSamples = [];
      const freshSaveSamples = [];
      for (let index = 0; index < sampleCount; index += 1) {
        if (index % 2 === 0) {
          emptySaveSamples.push(await measureStartup(browser, url, null));
          freshSaveSamples.push(
            await measureStartup(browser, url, freshSave.raw),
          );
        } else {
          freshSaveSamples.push(
            await measureStartup(browser, url, freshSave.raw),
          );
          emptySaveSamples.push(await measureStartup(browser, url, null));
        }
      }
      const saveWrites = await measureSaveWrites(
        browser,
        url,
        freshSave.raw,
      );

      const result = {
        timestamp: new Date().toISOString(),
        commit: initialProvenance.commit,
        workingTree: {
          dirty: initialProvenance.dirty,
          diffHash: initialProvenance.diffHash,
        },
        environment: {
          platform: `${platform()} ${release()}`,
          arch: arch(),
          cpu: cpus()[0]?.model ?? "unknown",
          logicalCpus: cpus().length,
          totalMemoryBytes: totalmem(),
          node: process.version,
          chromium: browser.version(),
        },
        bundle,
        startup: {
          sampleCount,
          emptySave: summarizeStartup(emptySaveSamples),
          freshSave: summarizeStartup(freshSaveSamples),
        },
        save: {
          schemaVersion: freshSave.schemaVersion,
          bytes: freshSave.bytes,
          writeBatches: SAVE_WRITE_BATCHES,
          writesPerBatch: SAVE_WRITES_PER_BATCH,
          serializeMs: summarize(saveWrites.serializeMs, 3),
          storageWriteMs: summarize(saveWrites.storageWriteMs, 3),
          combinedWriteMs: summarize(saveWrites.combinedWriteMs, 3),
        },
      };
      const finalProvenance = await getGitProvenance();
      assertMatchingProvenance(initialProvenance, finalProvenance);
      printReport(result);
    } finally {
      await browser.close();
    }
  } finally {
    await stopStaticServer(server);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[performance-baseline] ${message}`);
  if (
    message.includes("Executable doesn't exist")
    || message.includes("browserType.launch")
  ) {
    console.error(
      "[performance-baseline] Install Chromium with "
      + "`npm run test:browser:install`.",
    );
  }
  process.exitCode = 1;
});
