import type { Page } from "@playwright/test";
import { waitForGameInputFrame } from "./layout";

/** Observe real scene gates, then keep both input edges across complete game frames. */
export async function pressGameKey(page: Page, key: string, minimumHoldMs = 0): Promise<void> {
  await page.waitForFunction((pressedKey) => {
    const state = document.getElementById("debug-state")?.textContent ?? "";
    if (!state) return false;
    if (!/^(CUTSCENE|ENDING|DEFEAT)\b/.test(state)) return true;
    return state.includes(pressedKey === "Escape" && state.startsWith("CUTSCENE")
      ? "Skip: ready" : "Input: ready");
  }, key);
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
