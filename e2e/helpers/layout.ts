import { expect, type Page } from "@playwright/test";

const GAME_WIDTH = 640;
const GAME_HEIGHT = 528;

interface LayoutReportItem {
  id: string;
  bounds: { x: number; y: number; width: number; height: number };
}

interface LayoutReport {
  overlapCount: number;
  clippingCount: number;
  groups: Record<string, { items: LayoutReportItem[] }>;
}

async function readLayoutReport(page: Page): Promise<LayoutReport> {
  await expect(page.locator("#layout-report")).not.toHaveText("");
  return page.locator("#layout-report").evaluate((element) =>
    JSON.parse(element.textContent ?? "{}") as LayoutReport
  );
}

export async function layoutItemCenter(
  page: Page,
  id: string,
): Promise<{ x: number; y: number }> {
  await expect.poll(async () => {
    const report = await readLayoutReport(page);
    return Object.values(report.groups)
      .flatMap((group) => group.items)
      .some((item) => item.id === id);
  }).toBe(true);
  const report = await readLayoutReport(page);
  const item = Object.values(report.groups)
    .flatMap((group) => group.items)
    .find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Missing layout item: ${id}`);
  return {
    x: item.bounds.x + item.bounds.width / 2,
    y: item.bounds.y + item.bounds.height / 2,
  };
}

export async function clickLayoutItem(page: Page, id: string): Promise<void> {
  const point = await layoutItemCenter(page, id);
  const canvas = page.locator("#game-container canvas");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Game canvas has no rendered bounds");
  await page.mouse.click(
    bounds.x + (point.x / GAME_WIDTH) * bounds.width,
    bounds.y + (point.y / GAME_HEIGHT) * bounds.height,
  );
  await page.waitForTimeout(120);
}

export async function tapLayoutItem(page: Page, id: string): Promise<void> {
  const point = await layoutItemCenter(page, id);
  const canvas = page.locator("#game-container canvas");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Game canvas has no rendered bounds");
  await page.touchscreen.tap(
    bounds.x + (point.x / GAME_WIDTH) * bounds.width,
    bounds.y + (point.y / GAME_HEIGHT) * bounds.height,
  );
  await page.waitForTimeout(120);
}

export async function expectCleanLayout(page: Page): Promise<void> {
  const canvas = page.locator("#game-container canvas");
  await expect(canvas).toHaveAttribute("data-layout-overlap-count", "0");
  await expect(canvas).toHaveAttribute("data-layout-clipping-count", "0");
}
