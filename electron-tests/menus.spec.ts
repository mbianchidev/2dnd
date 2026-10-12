import { expect, test, type ElectronApplication } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDesktop, launchDesktop, monitorRendererErrors, resizeDesktop, waitForState } from "./helpers/desktop";
import { expectVisibleCanvas } from "../e2e/helpers/layout";
import { expectNoticeDeferred, finishNoticeMenu, prepareNoticeMenu, visitNoticeMenuPages } from "../e2e/helpers/notifications";

test("menus and active achievement notices stay separate at 150% text in Electron", async () => {
  const directory = await mkdtemp(join(tmpdir(), "2dnd-menu-electron-"));
  let application: ElectronApplication | undefined;
  try {
    application = await launchDesktop(directory);
    const page = await application.firstWindow();
    await resizeDesktop(application, 932, 430);
    const errors = monitorRendererErrors(page);
    await expect.poll(() => page.evaluate(() => location.origin)).toBe("app://2dnd");
    await waitForState(page, "BOOT | Screen: title");
    const fixture = await prepareNoticeMenu(page, "keyboard", 1.5);
    await page.waitForTimeout(3100);
    for (const [width, height] of [[1280, 800], [932, 430]] as const) {
      await resizeDesktop(application, width, height);
      await expectVisibleCanvas(page);
      await expectNoticeDeferred(page, fixture);
      const path = test.info().outputPath(`menu-notice-deferred-${width}x${height}.png`);
      await page.screenshot({ path });
      await test.info().attach("menu-notice-deferred", { path, contentType: "image/png" });
    }
    await visitNoticeMenuPages(page, "keyboard", fixture);
    await finishNoticeMenu(page, "keyboard", fixture);
    expect(errors).toEqual([]);
  } finally {
    if (application) await closeDesktop(application);
    await rm(directory, { recursive: true, force: true });
  }
});
