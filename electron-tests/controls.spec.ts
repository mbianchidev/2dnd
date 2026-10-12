import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDesktop, holdKey, launchDesktop, monitorRendererErrors, resizeDesktop, waitForState } from "./helpers/desktop";
import { clickLayoutItem } from "../e2e/helpers/layout";
import { minigameFixture, readMinigameSave, seedMinigamePage } from "../e2e/helpers/minigames";

async function movementFrame(page: Page, key: string, code: string, keyCode: number): Promise<void> {
  await page.evaluate((descriptor) => {
    window.addEventListener("keydown", () => {
      requestAnimationFrame(() => {
        const release = new KeyboardEvent("keyup", { key: descriptor.key, code: descriptor.code, bubbles: true });
        Object.defineProperty(release, "keyCode", { value: descriptor.keyCode });
        Object.defineProperty(release, "which", { value: descriptor.keyCode });
        window.dispatchEvent(release);
      });
    }, { once: true });
  }, { key, code, keyCode });
  await page.keyboard.down(key);
  try {
    await page.evaluate(() => new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  } finally {
    await page.keyboard.up(key);
  }
}

test("desktop hides saved mobile controls and isolates physical WASD typing from movement", async () => {
  const directory = await mkdtemp(join(tmpdir(), "2dnd-desktop-controls-"));
  let application: ElectronApplication | undefined;
  try {
    application = await launchDesktop(directory);
    const page = await application.firstWindow();
    const errors = monitorRendererErrors(page);
    await resizeDesktop(application);
    await waitForState(page, "BOOT | Screen: title");
    await page.evaluate(() => localStorage.setItem("2dnd_preferences", JSON.stringify({
      version: 3,
      accessibility: { textScale: 1.5, highContrast: true, reducedMotion: true },
      controls: { touchControls: "on", promptSource: "touch", handedness: "left" },
    })));
    await page.reload({ waitUntil: "networkidle" });
    await waitForState(page, "BOOT | Screen: title");
    await expect(page.locator("#touch-controls")).toHaveCount(0);
    await expect(page.locator("#game-container canvas")).toHaveAttribute("data-touch-controls", "false");
    await holdKey(page, "Enter");
    await waitForState(page, "BOOT | Screen: character");
    await clickLayoutItem(page, "creation-name");
    const field = page.locator("#mobile-text-input input");
    await expect(field).toBeFocused();
    await page.keyboard.type("wasd");
    await expect(field).toHaveValue("wasd");
    await expect(page.locator("#controller-keyboard")).toBeHidden();
    await page.keyboard.press("Enter");
    await expect(page.locator("#mobile-text-input")).toHaveCount(0);
    await waitForState(page, "BOOT | Screen: character");

    const fixture = minigameFixture("willowInnTable");
    await seedMinigamePage(page, fixture, "keyboard", { textScale: 1.5, touchControls: "on" });
    await expect(page.locator("#touch-controls")).toHaveCount(0);
    let position = { x: fixture.player.position.x, y: fixture.player.position.y };
    for (const [key, code, keyCode, dx, dy] of [
      ["w", "KeyW", 87, 0, -1], ["a", "KeyA", 65, -1, 0],
      ["s", "KeyS", 83, 0, 1], ["d", "KeyD", 68, 1, 0],
    ] as const) {
      position = { x: position.x + dx, y: position.y + dy };
      await movementFrame(page, key, code, keyCode);
      await waitForState(page, `Pos: (${position.x},${position.y})`);
      await waitForState(page, "Move: ready");
      await page.waitForTimeout(170);
    }
    expect((await readMinigameSave(page)).player.position).toMatchObject(position);
    const path = test.info().outputPath("desktop-keyboard-no-mobile-controls.png");
    await page.screenshot({ path });
    await test.info().attach("desktop-keyboard-no-mobile-controls", { path, contentType: "image/png" });
    expect(errors).toEqual([]);
  } finally {
    if (application) await closeDesktop(application);
    await rm(directory, { recursive: true, force: true });
  }
});
