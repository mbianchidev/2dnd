import {
  _electron as electron,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { resolve } from "node:path";

export const APP_ROOT = resolve(import.meta.dirname, "../..");

export async function launchDesktop(
  userDataDirectory: string,
): Promise<ElectronApplication> {
  const environment: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (
      value !== undefined && key !== "ELECTRON_RUN_AS_NODE"
      && key !== "ELECTRON_RENDERER_URL"
    ) environment[key] = value;
  }
  environment["ELECTRON_TEST_MODE"] = "1";
  environment["ELECTRON_USER_DATA_DIR"] = userDataDirectory;
  const executablePath = process.env.ELECTRON_TEST_EXECUTABLE;
  return electron.launch({
    ...(executablePath ? { executablePath } : {}),
    args: executablePath ? [] : [APP_ROOT],
    cwd: APP_ROOT,
    env: environment,
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

export async function waitForState(page: Page, text: string): Promise<void> {
  await expect(page.locator("#debug-state")).toContainText(text);
}
