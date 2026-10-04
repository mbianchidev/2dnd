import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
} from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  MINIGAME_TEST_WEATHER,
  continueMinigameFixture,
  crownFixtureSeed,
  finishArcheryFixture,
  finishRegattaFixture,
  installMinigameGamepad,
  minigameBrowserErrors,
  minigameCancel,
  minigameConfirm,
  minigameFixture,
  openMinigameFixture,
  readMinigameSave,
  seedMinigamePage,
  waitMinigameState,
} from "../e2e/helpers/minigames";
import type { MinigameVenueId } from "../src/data/minigames";
import type { MinigameTestSource } from "../e2e/helpers/minigames";

const APP_ROOT = resolve(import.meta.dirname, "..");

function launchEnvironment(userDataDirectory: string): Record<string, string> {
  const environment: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && key !== "ELECTRON_RUN_AS_NODE") environment[key] = value;
  }
  environment["ELECTRON_TEST_MODE"] = "1";
  environment["ELECTRON_USER_DATA_DIR"] = userDataDirectory;
  return environment;
}

for (const [venueId, expectedPayout] of [
  ["willowInnTable", 10],
  ["willowdaleRange", 13],
  ["sandportRegatta", 15],
] as const satisfies readonly (readonly [MinigameVenueId, number])[]) {
  for (const source of ["keyboard", "touch", "gamepad"] as const satisfies readonly MinigameTestSource[]) {
    test(`${venueId} persists actual ${source} play and once-only results in Electron`, async () => {
      const directory = await mkdtemp(join(tmpdir(), "2dnd-minigame-electron-"));
      let application: ElectronApplication | undefined;
      try {
        application = await electron.launch({
          args: [APP_ROOT], cwd: APP_ROOT, env: launchEnvironment(directory),
        });
        const page = await application.firstWindow();
        const errors = minigameBrowserErrors(page);
        await expect.poll(() => page.evaluate(() => location.origin)).toBe("app://2dnd");
        await installMinigameGamepad(page);
        const fixture = minigameFixture(venueId, venueId === "willowInnTable" ? crownFixtureSeed() : 167);
        if (venueId === "sandportRegatta") {
          fixture.weatherState = { current: MINIGAME_TEST_WEATHER, stepsUntilChange: 40 };
        }
        await seedMinigamePage(page, fixture, source);
        await openMinigameFixture(page, source);
        const started = await readMinigameSave(page);
        expect(started.player.gold).toBe(995);
        const pending = started.player.progression.minigames.pending;
        await page.reload({ waitUntil: "networkidle" });
        await continueMinigameFixture(page);
        await waitMinigameState(page, "[MINIGAME_VIEW:game]");
        expect((await readMinigameSave(page)).player.progression.minigames.pending).toEqual(pending);
        if (venueId === "willowInnTable") {
          for (let index = 0; index < 4; index += 1) await minigameConfirm(page, source);
        } else if (venueId === "willowdaleRange") {
          await finishArcheryFixture(page, source);
        } else {
          await finishRegattaFixture(page, source);
        }
        await waitMinigameState(page, "[MINIGAME_VIEW:result]");
        const settled = await readMinigameSave(page);
        expect(settled.player.gold).toBe(995 + expectedPayout);
        expect(settled.player.progression.minigames.history).toHaveLength(1);
        const receipt = settled.player.progression.minigames.pending?.receipt;
        await page.reload({ waitUntil: "networkidle" });
        await continueMinigameFixture(page);
        await waitMinigameState(page, "[MINIGAME_VIEW:result]");
        const resumed = await readMinigameSave(page);
        expect(resumed.player.progression.minigames.pending?.receipt).toEqual(receipt);
        expect(resumed.player.gold).toBe(995 + expectedPayout);
        await minigameCancel(page, source);
        await expect(page.locator("#debug-state")).not.toContainText("[MINIGAME:");
        await expect(page.locator("#minigame-live-region")).toHaveCount(0);
        expect((await readMinigameSave(page)).player.progression.minigames.pending).toBeNull();
        expect(errors).toEqual([]);
      } finally {
        await application?.close();
        await rm(directory, { recursive: true, force: true });
      }
    });
  }
}
