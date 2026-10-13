import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { measureFrameWorkload } from "../hacks/lib/frameWorkload";
import type { FrameWorkloadSample } from "../hacks/lib/frameWorkload";
import { expectCleanLayout, layoutItemCenter, waitForGameInputFrame } from "./helpers/layout";
import {
  minigameBrowserErrors,
  minigameFixture,
  seedMinigamePage,
} from "./helpers/minigames";

test("settled scenes do no redundant DOM work and live preferences still reflow", async ({ page }) => {
  const errors = minigameBrowserErrors(page);
  const record = async (phase: string, sample: FrameWorkloadSample): Promise<void> => {
    const path = test.info().outputPath(`${phase}-frame-workload.json`);
    await writeFile(path, JSON.stringify(sample, null, 2));
    await test.info().attach(`${phase} frame workload`, { path, contentType: "application/json" });
  };
  await page.goto("game.html", { waitUntil: "domcontentloaded" });
  await layoutItemCenter(page, "title-new-game");
  const title = await measureFrameWorkload(page);
  await record("title", title);
  expect(title).toMatchObject({
    frameCount: 120, canvasAttributeWrites: 0, debugStateWrites: 0, layoutReportWrites: 0,
  });

  await seedMinigamePage(page, minigameFixture("willowdaleRange"), "keyboard");
  await layoutItemCenter(page, "minigame-venue-willowdaleRange");
  const exploration = await measureFrameWorkload(page);
  await record("exploration", exploration);
  expect(exploration).toMatchObject({
    frameCount: 120, canvasAttributeWrites: 0, debugStateWrites: 0, layoutReportWrites: 0,
  });
  const save = await page.evaluate(() => localStorage.getItem("2dnd_save"));
  await page.evaluate(async () => {
    const path = "/2dnd/src/systems/accessibility.ts";
    const { gamePreferences }: typeof import("../src/systems/accessibility") = await import(path);
    gamePreferences.cycleTextScale();
    gamePreferences.setHighContrast(false);
  });
  const canvas = page.locator("#game-container canvas");
  await expect(canvas).toHaveAttribute("data-text-scale", "1.25");
  await expect(canvas).toHaveAttribute("data-high-contrast", "false");
  await waitForGameInputFrame(page);
  await expectCleanLayout(page);
  expect(await page.evaluate(() => localStorage.getItem("2dnd_save"))).toBe(save);
  const reflowed = await measureFrameWorkload(page);
  await record("reflowed", reflowed);
  expect(reflowed).toMatchObject({
    frameCount: 120, canvasAttributeWrites: 0, debugStateWrites: 0, layoutReportWrites: 0,
  });

  expect(errors).toEqual([]);
});
