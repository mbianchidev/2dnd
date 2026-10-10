import {
  _electron as electron,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { access } from "node:fs/promises";
import { join, resolve } from "node:path";

export const APP_ROOT = resolve(import.meta.dirname, "../..");

function createLaunchEnvironment(userDataDirectory: string): Record<string, string> {
  const environment: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== "ELECTRON_RUN_AS_NODE") {
      environment[key] = value;
    }
  }
  environment["ELECTRON_TEST_MODE"] = "1";
  environment["ELECTRON_USER_DATA_DIR"] = userDataDirectory;
  return environment;
}

export async function launchDesktop(
  userDataDirectory: string,
): Promise<ElectronApplication> {
  await access(join(APP_ROOT, "dist-electron", "main.js"));
  return electron.launch({
    args: [APP_ROOT],
    cwd: APP_ROOT,
    env: createLaunchEnvironment(userDataDirectory),
  });
}

export async function closeDesktop(desktop: ElectronApplication): Promise<void> {
  if (desktop.windows().length === 0) {
    const child = desktop.process();
    if (child.exitCode !== null) return;
    await Promise.all([
      desktop.waitForEvent("close", { timeout: 10_000 }),
      Promise.resolve().then(() => {
        if (!child.kill("SIGTERM")) {
          throw new Error(`Could not stop test Electron process ${child.pid}`);
        }
      }),
    ]);
    return;
  }
  await desktop.close();
}

export async function holdKey(
  page: Page,
  key: string,
  duration = 180,
): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(duration);
  await page.keyboard.up(key);
  await page.waitForTimeout(120);
}

export async function waitForState(page: Page, text: string): Promise<void> {
  await expect(page.locator("#debug-state")).toContainText(text);
}
