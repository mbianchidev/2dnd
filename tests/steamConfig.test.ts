import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  getSteamDepot,
  isAllowedSteamAppEntry,
  isForbiddenSteamPath,
  isSteamId,
  parseSteamBuildIds,
  renderSteamTemplate,
  STEAM_DEPOTS,
  STEAM_INTEGRATIONS,
} from "../steam/config";
import { INPUT_ACTIONS, STANDARD_GAMEPAD_BINDINGS } from "../src/systems/input";
import controllerLayout from "../steam/controller-layout.json";
import manifest from "../package.json";

const MOCK_IDS = {
  STEAM_APP_ID: "123450",
  STEAM_DEPOT_WINDOWS_ID: "123451",
  STEAM_DEPOT_MACOS_ID: "123452",
  STEAM_DEPOT_LINUX_ID: "123453",
};

describe("Steam distribution contract", () => {
  it("keeps the emulation recipe complete and identical to semantic input", () => {
    expect(Object.keys(controllerLayout.semanticRoutes).sort()).toEqual([...INPUT_ACTIONS].sort());
    expect(controllerLayout.nativeSteamInputApi).toBe(false);
    expect(controllerLayout.buttons.map((button) => ({
      button: button.index, action: button.action,
    }))).toEqual(STANDARD_GAMEPAD_BINDINGS
      .filter((binding) => binding.button !== undefined)
      .map((binding) => ({ button: binding.button, action: binding.action })));
    expect(controllerLayout.axes.map((axis) => ({
      axis: axis.index, direction: axis.direction, action: axis.action,
    }))).toEqual(STANDARD_GAMEPAD_BINDINGS
      .filter((binding) => binding.axis !== undefined)
      .map((binding) => ({ axis: binding.axis, direction: binding.direction, action: binding.action })));
    expect(controllerLayout.cursor).toMatchObject({ axes: [2, 3], clickButton: 11 });
  });
  it("uses native x64 Linux, x64 Windows and an explicit macOS universal payload", () => {
    expect(STEAM_DEPOTS.map((depot) => depot.platform)).toEqual([
      "windows-x64", "macos-universal", "linux-x64",
    ]);
    expect(getSteamDepot("linux-x64").executable).toBe("2D-and-D");
    expect(getSteamDepot("windows-x64").executable).toBe("2D-and-D.exe");
    expect(getSteamDepot("macos-universal").executable).toBe("2D-and-D.app");
    expect(getSteamDepot("macos-universal").architectures).toEqual(["x64", "arm64"]);
    const executableName = manifest.build.executableName;
    expect(getSteamDepot("macos-universal").binary).toBe(
      `${executableName}.app/Contents/MacOS/${executableName}`,
    );
    expect(getSteamDepot("windows-x64").binary).toBe(`${executableName}.exe`);
    expect(getSteamDepot("linux-x64").binary).toBe(executableName);
    expect(() => getSteamDepot("proton")).toThrow(/platform/i);
    expect(STEAM_INTEGRATIONS).toEqual({
      sdk: false, achievements: false, cloud: false, nativeInput: false,
    });
  });

  it.each([undefined, null, 123450, "", "0", "-1", "001", "1e6", "1.2", "4294967296", " 1", "1\n"])(
    "rejects an invalid or ambiguous partner ID (%s)",
    (value) => expect(isSteamId(value)).toBe(false),
  );

  it("requires all unique partner IDs only when rendering a private config", () => {
    expect(isSteamId("4294967295")).toBe(true);
    expect(parseSteamBuildIds(MOCK_IDS)).toEqual({
      appId: "123450",
      depots: {
        "windows-x64": "123451",
        "macos-universal": "123452",
        "linux-x64": "123453",
      },
    });
    expect(() => parseSteamBuildIds({})).toThrow(/STEAM_APP_ID/);
    expect(() => parseSteamBuildIds({
      ...MOCK_IDS, STEAM_DEPOT_LINUX_ID: "123451",
    })).toThrow(/unique/i);
    expect(() => parseSteamBuildIds({
      ...MOCK_IDS, STEAM_DEPOT_LINUX_ID: MOCK_IDS.STEAM_APP_ID,
    })).toThrow(/unique/i);
  });

  it("renders approved placeholders without allowing VDF injection or missing values", () => {
    expect(renderSteamTemplate('"AppID" "{{STEAM_APP_ID}}"', MOCK_IDS)).toBe(
      '"AppID" "123450"',
    );
    expect(() => renderSteamTemplate('{{UNKNOWN}}', MOCK_IDS)).toThrow(/placeholder/i);
    expect(() => renderSteamTemplate('{{STEAM_APP_ID}}', {})).toThrow(/missing/i);
    expect(() => renderSteamTemplate('{{BUILD_DESCRIPTION}}', {
      BUILD_DESCRIPTION: 'mock" } "SetLive" "default',
    })).toThrow(/unsafe/i);
  });

  it("keeps public templates credential-free and never sets a build live", async () => {
    const app = await readFile("steam/templates/app_build.vdf.in", "utf8");
    expect(app).toContain('"Preview" "{{STEAM_PREVIEW}}"');
    expect(app).toContain('"SetLive" ""');
    expect(app).toContain("{{STEAM_APP_ID}}");
    for (const depot of STEAM_DEPOTS) {
      expect(app).toContain(`{{${depot.idEnvironment}}}`);
      const template = await readFile(`steam/templates/depot_${depot.os}.vdf.in`, "utf8");
      expect(template).toContain(`../content/${depot.platform}`);
      expect(template).toContain('"FileExclusion" "*.map"');
      expect(template).not.toMatch(/password|login|token/i);
    }
    expect(app).not.toMatch(/password|login|token/i);
  });

  it.each([
    "src/main.ts", ".git/config", ".env.production", "renderer.js.map",
    "steam_appid.txt", "Local Storage/leveldb/000001.log",
    "IndexedDB/data", "logs/session.log", "tests/mock.json",
    "node_modules/native/index.js", "sdk/steam_api64.dll", "save.json",
  ])("rejects development, secret, SDK or profile content: %s", (path) => {
    expect(isForbiddenSteamPath(path)).toBe(true);
  });

  it("allows required runtime/licenses but only the actual game in app.asar", () => {
    for (const path of [
      "2D-and-D", "resources/app.asar", "libEGL.so",
      "LICENSES.chromium.html", "LICENSE.2dnd.txt",
    ]) expect(isForbiddenSteamPath(path)).toBe(false);
    for (const path of [
      "/package.json", "/dist/game.html", "/dist/assets/game-mock.js",
      "/dist/favicon.svg", "/dist-electron/main.js", "/dist-electron/preload.cjs",
    ]) expect(isAllowedSteamAppEntry(path)).toBe(true);
    for (const path of [
      "/dist/index.html", "/dist/screenshots/mock.png", "/dist/assets/landing-mock.css",
      "/dist/assets/game.js.map", "/node_modules/native/index.js", "/.env",
    ]) expect(isAllowedSteamAppEntry(path)).toBe(false);
  });
});
