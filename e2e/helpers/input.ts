import type { Page } from "@playwright/test";
import { waitForGameInputFrame } from "./layout";

/** Observe real scene gates, then keep both input edges across complete game frames. */
export async function pressGameKey(page: Page, key: string, minimumHoldMs = 0): Promise<void> {
  const initialState = await page.locator("#debug-state").textContent() ?? "";
  const expectedScope = /^(CUTSCENE|ENDING|DEFEAT)\b/.test(initialState)
    ? initialState.split(" | ").slice(0, 3).join(" | ") : null;
  await page.waitForFunction(({ pressedKey, scope }) => {
    const state = document.getElementById("debug-state")?.textContent ?? "";
    if (!state) return false;
    if (scope && !state.startsWith(scope)) return true;
    if (!/^(CUTSCENE|ENDING|DEFEAT)\b/.test(state)) return true;
    return state.includes(pressedKey === "Escape" && state.startsWith("CUTSCENE")
      ? "Skip: ready" : "Input: ready");
  }, { pressedKey: key, scope: expectedScope });
  if (expectedScope && !(await page.locator("#debug-state").textContent())?.startsWith(expectedScope)) return;
  await page.keyboard.down(key);
  try {
    await Promise.all([
      waitForGameInputFrame(page),
      minimumHoldMs > 0 ? page.waitForTimeout(minimumHoldMs) : Promise.resolve(),
    ]);
  } finally {
    await page.keyboard.up(key);
  }
  await waitForGameInputFrame(page);
}
