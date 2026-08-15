/// <reference types="node" />

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./electron-tests",
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: {
    timeout: 30_000,
  },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "line",
  outputDir: "electron-test-results",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
});
