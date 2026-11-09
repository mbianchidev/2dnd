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

/** Hold through the movement cooldown and release in the renderer on the accepted tile. */
export async function stepGameTile(
  page: Page, key: "W" | "A" | "S" | "D", x: number, y: number,
): Promise<void> {
  await page.waitForFunction(() => document.getElementById("debug-state")?.textContent?.includes("Move: ready"));
  await page.evaluate(({ direction, position }) => new Promise<void>((resolve, reject) => {
    const event = { key: direction.toLowerCase(), code: `Key${direction}`,
      keyCode: direction.charCodeAt(0), which: direction.charCodeAt(0), bubbles: true };
    const deadline = performance.now() + 5_000;
    const finish = (error?: Error): void => {
      window.dispatchEvent(new KeyboardEvent("keyup", event));
      if (error) reject(error);
      else resolve();
    };
    const observe = (): void => {
      const state = document.getElementById("debug-state")?.textContent ?? "";
      if (state.includes(position)) finish();
      else if (performance.now() > deadline) finish(new Error(`Movement did not reach ${position}: ${state}`));
      else requestAnimationFrame(observe);
    };
    requestAnimationFrame(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", event));
      requestAnimationFrame(observe);
    });
  }), { direction: key, position: `Pos: (${x},${y})` });
  await waitForGameInputFrame(page);
  await page.waitForFunction(() => document.getElementById("debug-state")?.textContent?.includes("Move: ready"));
}
