import {
  _electron as electron,
  expect,
  type CDPSession,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { access } from "node:fs/promises";
import { join, resolve } from "node:path";

export const APP_ROOT = resolve(import.meta.dirname, "../..");
const rendererSessions = new WeakMap<Page, CDPSession>();

export interface DesktopLaunchOptions {
  readonly executablePath?: string;
  readonly workingDirectory?: string;
}

async function getRendererSession(page: Page): Promise<CDPSession> {
  let session = rendererSessions.get(page);
  if (!session) {
    session = await page.context().newCDPSession(page);
    rendererSessions.set(page, session);
  }
  return session;
}

export async function setDesktopOffline(page: Page): Promise<void> {
  // Electron's BrowserContext offline flag does not update its renderer network state.
  const session = await getRendererSession(page);
  await session.send("Network.enable");
  await session.send("Network.emulateNetworkConditions", {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
}

function createLaunchEnvironment(userDataDirectory: string): Record<string, string> {
  const environment: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (
      value !== undefined && key !== "ELECTRON_RUN_AS_NODE"
      && key !== "ELECTRON_RENDERER_URL"
    ) {
      environment[key] = value;
    }
  }
  environment["ELECTRON_TEST_MODE"] = "1";
  environment["ELECTRON_USER_DATA_DIR"] = userDataDirectory;
  return environment;
}

export async function launchDesktop(
  userDataDirectory: string,
  options: DesktopLaunchOptions = {},
): Promise<ElectronApplication> {
  const executablePath = options.executablePath ?? process.env.ELECTRON_TEST_EXECUTABLE;
  await access(executablePath ?? join(APP_ROOT, "dist-electron", "main.js"));
  return electron.launch({
    ...(executablePath ? { executablePath } : {}),
    args: executablePath ? [] : [APP_ROOT],
    cwd: options.workingDirectory ?? APP_ROOT,
    env: createLaunchEnvironment(userDataDirectory),
  });
}

export function monitorRendererErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
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

export async function resizeDesktop(
  desktop: ElectronApplication,
  width = 1280,
  height = 800,
): Promise<void> {
  const page = await desktop.firstWindow();
  await desktop.evaluate(({ BrowserWindow }, viewport) => {
    const window = BrowserWindow.getAllWindows()[0];
    if (!window) throw new Error("Missing equivalent desktop window");
    window.setContentSize(viewport.width, viewport.height);
  }, { width, height });
  const session = await getRendererSession(page);
  await session.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    screenWidth: width,
    screenHeight: height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await expect.poll(() => page.evaluate(() => ({
    width: innerWidth, height: innerHeight,
  }))).toEqual({ width, height });
  await page.evaluate(() => new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  ));
}
