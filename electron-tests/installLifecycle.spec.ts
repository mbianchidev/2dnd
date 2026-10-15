import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { cp, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { getSteamDepot } from "../steam/config";
import packageMetadata from "../package.json" with { type: "json" };
import { createPlayer } from "../src/systems/player";
import { createCodex } from "../src/systems/codex";
import { createCurrentSaveData, normalizeSaveData, SAVE_VERSION } from "../src/systems/save";
import {
  closeDesktop, launchDesktop, monitorRendererErrors, resizeDesktop, setDesktopOffline, waitForState,
} from "./helpers/desktop";
import {
  clickControllerLayoutItem, installController, pressController, selectControllerAction,
} from "./helpers/controller";

async function readDocuments(page: Page): Promise<Record<string, string | null>> {
  return page.evaluate(() => Object.fromEntries(
    Object.keys(localStorage).filter((key) => key.startsWith("2dnd")).sort()
      .map((key) => [key, localStorage.getItem(key)]),
  ));
}

function campaignFixture(name: string): string {
  const player = createPlayer(name, {
    strength: 15, dexterity: 14, constitution: 13,
    intelligence: 12, wisdom: 10, charisma: 8,
  }, "knight");
  player.progression.tutorial.completed = true;
  player.progression.seenCutsceneIds = ["campaign.opening"];
  const data = normalizeSaveData(createCurrentSaveData(
    player, new Set(), createCodex(), player.appearanceId, 45,
  ));
  if (!data) throw new Error("Invalid synthetic install campaign");
  return JSON.stringify(data);
}

async function returnToTitle(page: Page): Promise<void> {
  await pressController(page, 9);
  await waitForState(page, "[MENU]");
  await selectControllerAction(page, "[MENU_SELECTION:quit]");
  await waitForState(page, "BOOT | Screen: title");
}

test("packaged install replacement, removal and offline reinstall preserve isolated documents", async () => {
  const executable = process.env["ELECTRON_TEST_EXECUTABLE"];
  test.skip(!executable, "Install lifecycle requires the actual inspected packaged depot");
  if (!executable) throw new Error("Missing packaged test executable");
  const depot = getSteamDepot(process.platform === "darwin"
    ? "macos-universal" : process.platform === "win32" ? "windows-x64" : "linux-x64");
  const source = resolve(dirname(executable), depot.os === "macos" ? "../../.." : ".");
  expect(resolve(source, depot.binary)).toBe(resolve(executable));
  const recovery = campaignFixture("Recovery fixture");
  const directory = await mkdtemp(join(tmpdir(), "2dnd-install-lifecycle-"));
  const profile = join(directory, "user-data");
  const installations = [join(directory, "original"), join(directory, "replacement")];
  let application: ElectronApplication | undefined;
  const errors: string[][] = [];
  const receipts: {
    phase: string; origin: string; appVersion: string; schema: number; offline: boolean;
  }[] = [];
  let expectedDocuments: Record<string, string | null> = {};
  let protectedManual = "";
  try {
    await mkdir(profile);
    for (const [phase, install] of [
      ["original", installations[0]!],
      ["replacement", installations[1]!],
      ["reinstall", installations[0]!],
    ] as const) {
      await cp(source, install, { recursive: true, preserveTimestamps: true, verbatimSymlinks: true });
      application = await launchDesktop(profile, {
        executablePath: join(install, depot.binary),
        workingDirectory: install,
      });
      const page = await application.firstWindow();
      const rendererErrors = monitorRendererErrors(page);
      errors.push(rendererErrors);
      await waitForState(page, "BOOT | Screen: title");
      await installController(page, 1.5, phase === "original");
      await setDesktopOffline(page);
      if (phase === "original") {
        await page.evaluate((raw) => localStorage.setItem("2dnd_save", raw),
          campaignFixture("Install fixture"));
      }
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForState(page, "BOOT | Screen: title");
      await resizeDesktop(application);
      const launch = await page.evaluate(() => ({
        origin: location.origin, offline: !navigator.onLine,
      }));
      expect(launch).toEqual({ origin: "app://2dnd", offline: true });
      const desktopState = await page.evaluate(() => window.desktop?.getState());
      expect(desktopState?.appVersion).toBe(packageMetadata.version);
      if (phase !== "original") {
        expect(await readDocuments(page)).toEqual(expectedDocuments);
        expect(await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-1")))
          .toBe(protectedManual);
      }
      if (phase === "reinstall") {
        await selectControllerAction(page, "[TITLE_ACTION:saveSlots]");
        await waitForState(page, "[SAVE_SLOTS:load]");
        for (let attempt = 0; attempt < 4; attempt += 1) {
          if ((await page.locator("#debug-state").textContent())?.includes("[SAVE_SLOT:manual-2]")) break;
          await pressController(page, 13);
        }
        await waitForState(page, "[SAVE_SLOT:manual-2]");
        await clickControllerLayoutItem(page, "save-slot-action-load");
      } else {
        await selectControllerAction(page, "[TITLE_ACTION:continue]");
      }
      await waitForState(page, "OVERWORLD");
      await expect(page.locator("#game-container canvas")).toHaveAttribute("data-text-scale", "1.5");
      const loaded = normalizeSaveData(JSON.parse(
        (await page.evaluate(() => localStorage.getItem("2dnd_save"))) ?? "null",
      ));
      if (!loaded) throw new Error("Install lifecycle did not load a valid campaign");
      expect(loaded.version).toBe(SAVE_VERSION);
      expect(loaded.player.name).toBe(phase === "reinstall" ? "Recovery fixture" : "Install fixture");
      receipts.push({ phase, ...launch, appVersion: packageMetadata.version, schema: loaded.version });
      if (phase === "original") {
        await pressController(page, 9);
        await waitForState(page, "[MENU]");
        await selectControllerAction(page, "[MENU_SELECTION:save]");
        await waitForState(page, "[SAVE_SLOTS:save]");
        await pressController(page, 0);
        await expect.poll(() => page.evaluate(
          () => localStorage.getItem("2dnd_save_slot_manual-1"),
        )).not.toBeNull();
        const manual = await page.evaluate(
          () => localStorage.getItem("2dnd_save_slot_manual-1"),
        );
        if (!manual) throw new Error("Missing actual manual snapshot");
        protectedManual = manual;
        await pressController(page, 1);
        await expect(page.locator("#debug-state")).not.toContainText("[SAVE_SLOTS:");
      }
      await returnToTitle(page);
      if (phase === "original") {
        await page.evaluate((raw) => {
          localStorage.setItem("2dnd_save_slot_manual-2", raw);
          localStorage.setItem("2dnd_save_slot_manual-2:name", "Recovery fixture");
        }, recovery);
      } else if (phase === "replacement") {
        await page.evaluate(({ raw, version }) => {
          localStorage.setItem("2dnd_save_slot_manual-2:staging", raw);
          localStorage.setItem("2dnd_save_slot_manual-2", JSON.stringify({ version, player: {} }));
        }, { raw: recovery, version: SAVE_VERSION });
      } else {
        expect(await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-2"))).toBe(recovery);
        expect(await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-2:staging"))).toBeNull();
        expect(await page.evaluate(() => localStorage.getItem("2dnd_save_slot_manual-1"))).toBe(protectedManual);
      }
      expectedDocuments = await readDocuments(page);
      expect(rendererErrors).toEqual([]);
      const closing = application.waitForEvent("close");
      await selectControllerAction(page, "[TITLE_ACTION:quit]", false);
      await page.evaluate(() => window.__mockController.button(0, true));
      await closing;
      application = undefined;
      await rm(install, { recursive: true });
      expect((await stat(profile)).isDirectory()).toBe(true);
    }
    expect(errors.every((messages) => messages.length === 0)).toBe(true);
    const path = test.info().outputPath("install-lifecycle-equivalent.json");
    await writeFile(path, JSON.stringify({
      schema: SAVE_VERSION,
      steamClient: false,
      sameVersionReplacement: true,
      physicalDeck: false,
      phases: receipts,
      protectedManualPreserved: true,
      isolatedStagingRecovery: true,
    }, null, 2));
    await test.info().attach("install-lifecycle-equivalent", { path, contentType: "application/json" });
  } finally {
    if (application) await closeDesktop(application);
    await rm(directory, { recursive: true, force: true });
  }
});
