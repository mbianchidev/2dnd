import { expect, test } from "@playwright/test";

test("showcase leads players to browser and desktop builds", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  await page.goto("./", { waitUntil: "networkidle" });

  await expect(page).toHaveTitle(/2D&D/);
  await expect(page.getByRole("heading", { name: "2D and D" })).toBeVisible();
  await expect(page.getByText("Coming soon on Steam")).toBeVisible();
  await expect(page.locator("#download-desktop")).toHaveAttribute(
    "href",
    "https://github.com/mbianchidev/2dnd/releases/latest",
  );

  const screenshots = page.locator("main img");
  await expect(screenshots).toHaveCount(3);
  for (let index = 0; index < await screenshots.count(); index += 1) {
    await screenshots.nth(index).scrollIntoViewIfNeeded();
    await expect(screenshots.nth(index)).toHaveJSProperty("complete", true);
    await expect(screenshots.nth(index)).not.toHaveJSProperty("naturalWidth", 0);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText("Coming soon on Steam")).toBeVisible();
  await expect.poll(() => page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  )).toBe(true);
  await page.locator("#play-browser").scrollIntoViewIfNeeded();
  await page.locator("#play-browser").click();
  await expect(page).toHaveURL(/game\.html$/);
  await expect(page.locator("#game-container canvas")).toBeVisible();
  await expect(page.locator("#debug-state")).toContainText("BOOT");
  expect(browserErrors).toEqual([]);
});
