import { expect, test } from "@playwright/test";
import manifest from "../package.json" with { type: "json" };

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

  const macosHelp = page.locator("#macos-launch-help");
  const macosCommand = macosHelp.locator("pre code");
  await expect(macosHelp).toHaveJSProperty("open", false);
  await expect(macosCommand).toBeHidden();
  await macosHelp.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(macosHelp).toHaveJSProperty("open", true);
  await expect(macosHelp.getByRole("link", { name: "official GitHub Releases page" }))
    .toHaveAttribute("href", "https://github.com/mbianchidev/2dnd/releases/latest");
  await expect(macosHelp).toContainText("trust the download");
  await expect(macosHelp).toContainText("Applications");
  await expect(macosCommand).toHaveText(
    `xattr -dr com.apple.quarantine "/Applications/${manifest.build.executableName}.app"`,
  );
  await expect(macosHelp).toContainText("removes quarantine");
  await expect(macosHelp).toContainText("Reopen");
  await expect(macosHelp).toContainText("Keep Gatekeeper enabled");
  await macosHelp.scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("macos-help-desktop.png") });

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
  await macosHelp.scrollIntoViewIfNeeded();
  await expect(macosCommand).toBeVisible();
  await expect.poll(() => macosHelp.locator("pre").evaluate(
    (element) => element.scrollWidth <= element.clientWidth,
  )).toBe(true);
  await page.screenshot({ path: test.info().outputPath("macos-help-mobile.png") });
  await macosHelp.locator("summary").click();
  await expect(macosHelp).toHaveJSProperty("open", false);
  await page.locator("#play-browser").scrollIntoViewIfNeeded();
  await page.locator("#play-browser").click();
  await expect(page).toHaveURL(/game\.html$/);
  await expect(page.locator("#game-container canvas")).toBeVisible();
  await expect(page.locator("#debug-state")).toContainText("BOOT");
  expect(browserErrors).toEqual([]);
});
