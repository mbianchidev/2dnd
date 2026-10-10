import { createPackage } from "@electron/asar";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import {
  cp, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertSteamBinary,
  getSteamDepot,
  STEAM_DEPOTS,
  STEAM_LICENSE_FILES,
  type SteamPlatform,
} from "../steam/config";

const ROOT = resolve(import.meta.dirname, "..");
const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "2dnd-steam-contract-"));
  temporaryDirectories.push(path);
  return path;
}

function mockBinary(platform: SteamPlatform): Buffer {
  const bytes = Buffer.alloc(128);
  if (platform === "linux-x64") {
    bytes.set([0x7f, 0x45, 0x4c, 0x46, 2, 1]);
    bytes.writeUInt16LE(0x3e, 18);
  } else if (platform === "windows-x64") {
    bytes.write("MZ");
    bytes.writeUInt32LE(64, 0x3c);
    bytes.set([0x50, 0x45, 0, 0], 64);
    bytes.writeUInt16LE(0x8664, 68);
  } else {
    bytes.writeUInt32BE(0xcafebabe, 0);
    bytes.writeUInt32BE(2, 4);
    bytes.writeUInt32BE(0x01000007, 8);
    bytes.writeUInt32BE(0x0100000c, 28);
  }
  return bytes;
}

async function mockPayload(root: string, platform: SteamPlatform): Promise<string> {
  const depot = getSteamDepot(platform);
  const payload = join(root, `payload-${platform}`);
  const application = join(root, `app-${platform}`);
  await mkdir(join(application, "dist", "assets"), { recursive: true });
  await mkdir(join(application, "dist-electron"));
  await writeFile(join(application, "package.json"), JSON.stringify({
    name: "2dnd", version: "1.1.0", main: "dist-electron/main.js",
  }));
  await writeFile(join(application, "dist", "game.html"), "<!doctype html><title>Mock game</title>");
  await writeFile(join(application, "dist", "assets", "game-mock.js"), "export {};");
  await writeFile(join(application, "dist-electron", "main.js"), "export {};");
  await writeFile(join(application, "dist-electron", "preload.cjs"), '"use strict";');
  await mkdir(dirname(join(payload, depot.binary)), { recursive: true });
  await writeFile(join(payload, depot.binary), mockBinary(platform), { mode: 0o755 });
  await mkdir(dirname(join(payload, depot.appArchive)), { recursive: true });
  await createPackage(application, join(payload, depot.appArchive));
  const licenseRoot = join(payload, depot.licenseDirectory);
  await mkdir(licenseRoot, { recursive: true });
  const licenses = [
    "LICENSE", "node_modules/phaser/LICENSE.md", "node_modules/eventemitter3/LICENSE",
  ];
  for (const [index, file] of STEAM_LICENSE_FILES.entries()) {
    await cp(join(ROOT, licenses[index]!), join(licenseRoot, file));
  }
  const notice = spawnSync(process.execPath, [
    "hacks/generate-desktop-notice.mjs", "--output", join(licenseRoot, "SOURCE.2dnd.txt"),
  ], { cwd: ROOT, encoding: "utf8" });
  if (notice.status !== 0) throw new Error(notice.stderr);
  const electronLicenses = platform === "macos-universal"
    ? join(payload, "2D-and-D.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Resources")
    : payload;
  await mkdir(electronLicenses, { recursive: true });
  await writeFile(join(electronLicenses, "LICENSE"), "Mock Electron license fixture");
  await writeFile(join(electronLicenses, "LICENSES.chromium.html"), "Mock Chromium notices fixture");
  return payload;
}

function prepare(
  args: string[],
  environment: Record<string, string | undefined> = {},
): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, ["hacks/prepare-steam.mjs", ...args], {
    cwd: ROOT, encoding: "utf8", env: { ...process.env, ...environment },
  });
}

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe("Steam payload preparation without Steamworks", () => {
  it.each(STEAM_DEPOTS.map((depot) => depot.platform))(
    "inspects %s architecture and rejects a different or malformed executable",
    (platform) => {
      expect(() => assertSteamBinary(mockBinary(platform), platform)).not.toThrow();
      expect(() => assertSteamBinary(Buffer.alloc(8), platform)).toThrow(/architecture/);
      const incompatible = mockBinary(platform === "linux-x64" ? "windows-x64" : "linux-x64");
      expect(() => assertSteamBinary(incompatible, platform)).toThrow(/architecture/);
    },
  );

  it("requires both x64 and arm64 in the macOS executable", () => {
    const bytes = mockBinary("macos-universal");
    bytes.writeUInt32BE(0x01000007, 28);
    expect(() => assertSteamBinary(bytes, "macos-universal")).toThrow(/architecture/);
  });

  it("prepares all public depots and validates private preview rendering with mock IDs", async () => {
    const root = await temporaryDirectory();
    const assembled = join(root, "assembled");
    await mkdir(join(assembled, "content"), { recursive: true });
    for (const depot of STEAM_DEPOTS) {
      const payload = await mockPayload(root, depot.platform);
      const output = join(root, `preview-${depot.platform}`);
      const result = prepare([
        "prepare", "--platform", depot.platform, "--input", payload, "--output", output,
      ]);
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      await cp(join(output, "content", depot.platform), join(assembled, "content", depot.platform), {
        recursive: true, verbatimSymlinks: true,
      });
      await cp(
        join(output, `manifest-${depot.platform}.json`),
        join(assembled, `manifest-${depot.platform}.json`),
      );
      const template = await readFile(join(output, "scripts/app_build.vdf.in"), "utf8");
      expect(template).toContain("{{STEAM_APP_ID}}");
    }
    const verification = prepare(["verify", "--input", assembled]);
    expect(verification.stderr).toBe("");
    expect(verification.status).toBe(0);
    const privateOutput = join(root, "private");
    const rendered = prepare([
      "render", "--input", assembled, "--output", privateOutput,
    ], {
      STEAM_APP_ID: "123450", STEAM_DEPOT_WINDOWS_ID: "123451",
      STEAM_DEPOT_MACOS_ID: "123452", STEAM_DEPOT_LINUX_ID: "123453",
    });
    expect(rendered.stderr).toBe("");
    expect(rendered.status).toBe(0);
    expect(rendered.stdout).not.toContain("123450");
    const config = await readFile(join(privateOutput, "scripts/app_build.vdf"), "utf8");
    expect(config).toContain('"Preview" "1"');
    expect(config).toContain('"SetLive" ""');
    expect(config).not.toContain("{{");
  }, 30_000);

  it("refuses development or unrecognized payload files rather than silently dropping them", async () => {
    const root = await temporaryDirectory();
    const payload = await mockPayload(root, "linux-x64");
    await writeFile(join(payload, "private-config.json"), '{"mock":"not runtime"}');
    const result = prepare([
      "prepare", "--platform", "linux-x64", "--input", payload, "--output", join(root, "preview"),
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unexpected native runtime content");
  });

  it.skipIf(process.platform === "win32")("rejects linked game entries inside app.asar", async () => {
    const root = await temporaryDirectory();
    const payload = await mockPayload(root, "linux-x64");
    const application = join(root, "app-linux-x64");
    await symlink("game-mock.js", join(application, "dist", "assets", "game-linked.js"));
    await createPackage(application, join(payload, getSteamDepot("linux-x64").appArchive));
    const result = prepare([
      "prepare", "--platform", "linux-x64", "--input", payload, "--output", join(root, "preview"),
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unexpected packaged application entry");
  });

  it("rejects escaping symlinks, overlapping output and unauthorized upload configs", async () => {
    const root = await temporaryDirectory();
    const payload = await mockPayload(root, "linux-x64");
    if (process.platform !== "win32") {
      await symlink(root, join(payload, "escape"));
      const escaped = prepare([
        "prepare", "--platform", "linux-x64", "--input", payload, "--output", join(root, "escaped"),
      ]);
      expect(escaped.status).toBe(1);
      expect(escaped.stderr).toContain("symlink escapes");
    }
    const overlap = prepare([
      "prepare", "--platform", "linux-x64", "--input", payload, "--output", join(payload, "preview"),
    ]);
    expect(overlap.status).toBe(1);
    expect(overlap.stderr).toContain("must not overlap");
    const unauthorized = prepare([
      "render", "--upload", "--input", payload, "--output", join(root, "private"),
    ], { STEAM_UPLOAD_AUTHORIZED: undefined });
    expect(unauthorized.status).toBe(1);
    expect(unauthorized.stderr).toContain("explicit protected authorization");
  });

  it("cannot upload anything without an approved dispatch", () => {
    const result = spawnSync(process.execPath, ["hacks/upload-steam.mjs"], {
      cwd: ROOT, encoding: "utf8",
      env: { ...process.env, STEAM_UPLOAD_AUTHORIZED: "", STEAM_BUILD_ACCOUNT: "mock_build" },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain("mock_build");
  });

  it.skipIf(process.platform === "win32")(
    "confines mock SDK output to private logs and distinguishes success from failure",
    async () => {
      const root = await temporaryDirectory();
      const environment = {
        ...process.env,
        GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/main",
        STEAM_UPLOAD_AUTHORIZED: "1",
        STEAM_APP_ID: "123450", STEAM_DEPOT_WINDOWS_ID: "123451",
        STEAM_DEPOT_MACOS_ID: "123452", STEAM_DEPOT_LINUX_ID: "123453",
        STEAM_BUILD_ACCOUNT: "mock_build",
      };
      for (const successful of [false, true]) {
        const privateRoot = join(root, successful ? "success" : "failure");
        await mkdir(join(privateRoot, "scripts"), { recursive: true });
        await mkdir(join(privateRoot, "output"));
        await writeFile(join(privateRoot, "scripts/app_build.vdf"),
          '"AppBuild" { "AppID" "123450" "Preview" "0" "SetLive" "" }\n');
        const executable = join(privateRoot, "mock-steamcmd");
        await writeFile(executable,
          `#!${process.execPath}\n`
          + 'process.stdout.write("mock_build MOCK_PRIVATE_TOKEN_NOT_REAL\\n");\n'
          + (successful
            ? 'process.stdout.write("Success! App \'123450\' fully built.\\n");\n'
            : 'process.stdout.write("Mock SDK failure\\n");\nprocess.exitCode = 1;\n'),
          { mode: 0o700 });
        const result = spawnSync(process.execPath, ["hacks/upload-steam.mjs"], {
          cwd: ROOT, encoding: "utf8", env: {
            ...environment, STEAMCMD_PATH: executable, STEAM_PRIVATE_BUILD_DIR: privateRoot,
          },
        });
        expect(result.status).toBe(successful ? 0 : 1);
        expect(`${result.stdout}${result.stderr}`).not.toMatch(/123450|mock_build|MOCK_PRIVATE_TOKEN/);
        const log = join(privateRoot, "output/steamcmd-private.log");
        expect((await stat(log)).mode & 0o777).toBe(0o600);
        expect(await readFile(log, "utf8")).toContain("MOCK_PRIVATE_TOKEN_NOT_REAL");
      }
    },
  );

  it.skipIf(process.platform === "win32")(
    "rejects duplicate/case-varied live settings before invoking even a mock SDK",
    async () => {
      const root = await temporaryDirectory();
      await mkdir(join(root, "scripts"));
      await mkdir(join(root, "output"));
      const executable = join(root, "mock-steamcmd");
      await writeFile(executable, `#!${process.execPath}\nprocess.exitCode = 99;\n`, { mode: 0o700 });
      await writeFile(join(root, "scripts/app_build.vdf"),
        '"AppBuild" { "AppID" "123450" "Preview" "0" "SetLive" "" "setlive" "mock-beta" }\n');
      const result = spawnSync(process.execPath, ["hacks/upload-steam.mjs"], {
        cwd: ROOT, encoding: "utf8", env: {
          ...process.env, GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/main",
          STEAM_UPLOAD_AUTHORIZED: "1", STEAM_APP_ID: "123450",
          STEAM_DEPOT_WINDOWS_ID: "123451", STEAM_DEPOT_MACOS_ID: "123452",
          STEAM_DEPOT_LINUX_ID: "123453", STEAM_BUILD_ACCOUNT: "mock_build",
          STEAMCMD_PATH: executable, STEAM_PRIVATE_BUILD_DIR: root,
        },
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("auto-publishing");
      expect(result.stderr).not.toContain("mock-beta");
      expect(await readFile(join(root, "scripts/app_build.vdf"), "utf8")).toContain("mock-beta");
      expect(result.stdout).toBe("");
    },
  );
});
