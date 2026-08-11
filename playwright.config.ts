/// <reference types="node" />

import { defineConfig } from "@playwright/test";

const DEFAULT_BASE_PATH = "/2dnd/";

function normalizeBasePath(value: string): string {
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash
    : `${withLeadingSlash}/`;
}

function readPort(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PLAYWRIGHT_PORT: ${value}`);
  }
  return port;
}

const port = readPort(process.env.PLAYWRIGHT_PORT)
  ?? 4173;
const basePath = normalizeBasePath(
  process.env.PLAYWRIGHT_BASE_PATH ?? DEFAULT_BASE_PATH,
);
const serverUrl = `http://127.0.0.1:${port}${basePath}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 300_000,
  expect: {
    timeout: 30_000,
  },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "line",
  outputDir: "test-results",
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}{ext}",
  use: {
    baseURL: serverUrl,
    viewport: { width: 1440, height: 900 },
    // Phaser repaints every frame; omit the trace filmstrip so teardown does not
    // spend minutes flushing thousands of canvas screenshots.
    trace: {
      mode: "retain-on-failure",
      screenshots: false,
      snapshots: true,
      sources: true,
    },
    screenshot: "only-on-failure",
    video: "off",
    launchOptions: {
      args: [
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
      ],
    },
  },
  webServer: {
    command: `VITE_BASE_PATH=${basePath} npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: serverUrl,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
