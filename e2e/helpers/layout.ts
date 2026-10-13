import { expect, type CDPSession, type Page } from "@playwright/test";
import type { LayoutAuditItem, LayoutAuditResult } from "../../src/systems/layout";

const GAME_WIDTH = 640;
const GAME_HEIGHT = 528;
const nativeTouchSessions = new WeakMap<Page, CDPSession>();

/** Advertise native touch before game boot and keep that device stable across reloads. */
export async function enableNativeCanvasTouch(page: Page): Promise<CDPSession> {
  let protocol = nativeTouchSessions.get(page);
  if (!protocol) {
    protocol = await page.context().newCDPSession(page);
    nativeTouchSessions.set(page, protocol);
  }
  await protocol.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  return protocol;
}

interface LayoutReport {
  overlapCount: number;
  clippingCount: number;
  groups: Record<string, LayoutAuditResult & { items: LayoutAuditItem[] }>;
}

export async function waitForGameInputFrame(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

export async function pressPointerAt(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.move(x, y);
  await waitForGameInputFrame(page);
  await page.mouse.down();
}

export async function clickPointerAt(page: Page, x: number, y: number): Promise<void> {
  await pressPointerAt(page, x, y);
  try {
    await waitForGameInputFrame(page);
  } finally {
    await page.mouse.up();
  }
}

export async function tapPointerAt(page: Page, x: number, y: number): Promise<void> {
  const nativeDesktop = await page.evaluate(() => window.desktop !== undefined);
  const protocol = nativeDesktop
    ? await enableNativeCanvasTouch(page)
    : await page.context().newCDPSession(page);
  try {
    await protocol.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
    await protocol.send("Input.dispatchTouchEvent", {
      type: "touchStart", touchPoints: [{ x, y, id: 1 }],
    });
    try {
      await waitForGameInputFrame(page);
    } finally {
      await protocol.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
  } finally {
    if (!nativeDesktop) await protocol.detach();
  }
}

export async function readLayoutReport(page: Page): Promise<LayoutReport> {
  await expect(page.locator("#layout-report")).not.toHaveText("");
  return page.locator("#layout-report").evaluate((element) =>
    JSON.parse(element.textContent ?? "{}") as LayoutReport
  );
}

export async function layoutItemCenter(
  page: Page,
  id: string,
): Promise<{ x: number; y: number }> {
  const handle = await page.waitForFunction((layoutId) => {
    const content = document.getElementById("layout-report")?.textContent;
    if (!content) return null;
    const report = JSON.parse(content) as LayoutReport;
    const item = Object.values(report.groups)
      .flatMap((group) => group.items)
      .find((candidate) => candidate.id === layoutId);
    return item ? {
      x: item.bounds.x + item.bounds.width / 2,
      y: item.bounds.y + item.bounds.height / 2,
    } : null;
  }, id);
  try {
    const point = await handle.jsonValue();
    if (!point) throw new Error(`Missing layout item: ${id}`);
    return point;
  } finally {
    await handle.dispose();
  }
}

export async function clickLayoutItem(page: Page, id: string): Promise<void> {
  const canvas = page.locator("#game-container canvas");
  const initial = await layoutItemCenter(page, id);
  const initialBounds = await canvas.boundingBox();
  if (!initialBounds) throw new Error("Game canvas has no rendered bounds");
  await page.mouse.move(
    initialBounds.x + (initial.x / GAME_WIDTH) * initialBounds.width,
    initialBounds.y + (initial.y / GAME_HEIGHT) * initialBounds.height,
  );
  await waitForGameInputFrame(page);
  const point = await layoutItemCenter(page, id);
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Game canvas has no rendered bounds");
  await clickPointerAt(page,
    bounds.x + (point.x / GAME_WIDTH) * bounds.width,
    bounds.y + (point.y / GAME_HEIGHT) * bounds.height,
  );
  await waitForGameInputFrame(page);
}

export async function tapLayoutItem(page: Page, id: string): Promise<void> {
  const point = await layoutItemCenter(page, id);
  const canvas = page.locator("#game-container canvas");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Game canvas has no rendered bounds");
  await tapPointerAt(page,
    bounds.x + (point.x / GAME_WIDTH) * bounds.width,
    bounds.y + (point.y / GAME_HEIGHT) * bounds.height,
  );
  await waitForGameInputFrame(page);
}

export async function expectCleanLayout(page: Page): Promise<void> {
  const canvas = page.locator("#game-container canvas");
  const report = JSON.stringify(await readLayoutReport(page));
  await expect(canvas, report).toHaveAttribute("data-layout-overlap-count", "0");
  await expect(canvas, report).toHaveAttribute("data-layout-clipping-count", "0");
}

export async function expectVisibleCanvas(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#game-container canvas");
    const host = document.getElementById("game-container");
    if (!canvas || !host) return { fits: false };
    const bounds = canvas.getBoundingClientRect();
    const viewport = host.getBoundingClientRect();
    const fits = bounds.left >= viewport.left - 1 && bounds.right <= viewport.right + 1
      && bounds.top >= viewport.top - 1 && bounds.bottom <= viewport.bottom + 1
      && bounds.bottom <= innerHeight + 1;
    return { fits, canvas: bounds.toJSON(), host: viewport.toJSON(), viewportHeight: innerHeight };
  })).toMatchObject({ fits: true });
}
