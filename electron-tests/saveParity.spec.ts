import {
  chromium,
  expect,
  test,
  type Browser,
  type ElectronApplication,
} from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, type ViteDevServer } from "vite";
import {
  APP_ROOT,
  closeDesktop,
  holdKey,
  launchDesktop,
  waitForState,
} from "./helpers/desktop";

test("browser JSON exports load equivalent state and metadata in isolated Electron storage", async () => {
  const userDataDirectory = await mkdtemp(join(tmpdir(), "2dnd-slot-parity-"));
  let server: ViteDevServer | undefined;
  let browser: Browser | undefined;
  let desktop: ElectronApplication | undefined;
  const errors: string[] = [];
  try {
    desktop = await launchDesktop(userDataDirectory);
    const native = await desktop.firstWindow();
    native.on("pageerror", (error) => errors.push(error.message));
    native.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await waitForState(native, "BOOT | Screen: title");
    expect(await native.evaluate(() => location.origin)).toBe("app://2dnd");
    expect(await native.evaluate(() =>
      localStorage.getItem("2dnd_inventory_prefs")
    )).toBeNull();
    const preferences = await native.evaluate(() =>
      localStorage.getItem("2dnd_preferences")
    );

    server = await createServer({
      root: APP_ROOT,
      base: "/2dnd/",
      server: {
        host: "127.0.0.1",
        port: 0,
        strictPort: true,
        watch: {
          ignored: ["**/test-results/**", "**/electron-test-results/**"],
        },
      },
    });
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") {
      throw new Error("Parity server has no TCP address");
    }
    browser = await chromium.launch();
    const web = await browser.newPage();
    web.on("pageerror", (error) => errors.push(error.message));
    web.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await web.goto(`http://127.0.0.1:${address.port}/2dnd/game.html`, {
      waitUntil: "networkidle",
    });
    await waitForState(web, "BOOT | Screen: title");
    await web.evaluate(async () => {
      const playerPath = "/2dnd/src/systems/player.ts";
      const codexPath = "/2dnd/src/systems/codex.ts";
      const slotsPath = "/2dnd/src/systems/saveSlots.ts";
      const partyPath = "/2dnd/src/systems/party.ts";
      const player = await import(playerPath);
      const codex = await import(codexPath);
      const slots = await import(slotsPath);
      const party = await import(partyPath);
      const hero = player.createPlayer("Portable Hero", {
        strength: 10, dexterity: 10, constitution: 10,
        intelligence: 10, wisdom: 10, charisma: 10,
      }, "wizard");
      hero.gold = 75;
      hero.progression.pendingCutsceneIds = [];
      hero.progression.pendingFeatureRevealIds = [];
      hero.progression.tutorial.completed = true;
      party.recruitCompanion(hero, "guardian");
      const result = slots.saveGameToSlot(
        "manual-1", hero, new Set(["cryptLich"]), codex.createCodex(),
        hero.appearanceId, 123, undefined, { name: "Origin parity" },
      );
      if (!result.ok) throw new Error(result.message);
      localStorage.setItem("2dnd_inventory_prefs", JSON.stringify({
        sortMode: "name", filter: "all", search: "mock-web-only",
      }));
    });
    await holdKey(web, "l");
    await waitForState(web, "[SAVE_SLOT:manual-1]");
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const state = await web.locator("#debug-state").textContent() ?? "";
      if (state.includes("[SAVE_ACTION:export]")) break;
      await holdKey(web, "ArrowRight", 80);
    }
    await waitForState(web, "[SAVE_ACTION:export]");
    const description = await web.locator("#save-slot-live-region").textContent();
    if (!description) throw new Error("Browser slot metadata was not announced");
    const expectedDescription = description.split(". Export")[0]!;
    const downloading = web.waitForEvent("download");
    await holdKey(web, "Enter");
    const download = await downloading;
    const stream = await download.createReadStream();
    if (!stream) throw new Error("Browser export has no readable JSON stream");
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const json = Buffer.concat(chunks).toString("utf8");
    const exported: unknown = JSON.parse(json);
    if (
      typeof exported !== "object"
      || exported === null
      || !("save" in exported)
    ) {
      throw new Error("Browser export has no campaign document");
    }
    expect(await web.evaluate(() => location.origin)).toMatch(/^http:\/\/127\.0\.0\.1:/);
    await browser.close();
    browser = undefined;
    await server.close();
    server = undefined;

    await holdKey(native, "l");
    await waitForState(native, "[SAVE_SLOTS:load]");
    await holdKey(native, "ArrowDown", 80);
    await waitForState(native, "[SAVE_SLOT:manual-1]");
    await waitForState(native, "[SAVE_ACTION:import]");
    const choosing = native.waitForEvent("filechooser");
    await holdKey(native, "Enter");
    await (await choosing).setFiles({
      name: download.suggestedFilename(),
      mimeType: "application/json",
      buffer: Buffer.from(json),
    });
    await expect(native.locator("#save-slot-live-region")).toContainText(
      expectedDescription,
    );
    const raw = await native.evaluate(() =>
      localStorage.getItem("2dnd_save_slot_manual-1")
    );
    if (!raw) throw new Error("Imported desktop campaign is missing");
    expect(JSON.parse(raw) as unknown).toEqual(exported.save);
    expect(await native.evaluate(() =>
      localStorage.getItem("2dnd_preferences")
    )).toBe(preferences);
    expect(await native.evaluate(() =>
      localStorage.getItem("2dnd_inventory_prefs")
    )).toBeNull();
    expect(errors).toEqual([]);
  } finally {
    try {
      if (desktop) await closeDesktop(desktop);
    } finally {
      try {
        await browser?.close();
      } finally {
        await server?.close();
        await rm(userDataDirectory, { recursive: true, force: true });
      }
    }
  }
});
