import { createPackage } from "@electron/asar";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod, cp, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile,
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
import packageMetadata from "../package.json";

const ROOT = resolve(import.meta.dirname, "..");
const temporaryDirectories: string[] = [];
let sourceNotice: Promise<string> | null = null;

async function temporaryDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "2dnd-steam-contract-"));
  temporaryDirectories.push(path);
  return path;
}

function sourceNoticeFixture(projectRoot = ROOT): Promise<string> {
  const generate = async (): Promise<string> => {
    const root = await temporaryDirectory();
    const output = join(root, "SOURCE.2dnd.txt");
    const result = spawnSync(process.execPath, [
      "hacks/generate-desktop-notice.mjs", "--output", output,
    ], { cwd: projectRoot, encoding: "utf8" });
    if (result.status !== 0 || result.stderr) {
      throw new Error(result.stderr || result.error?.message || "Source notice generation failed");
    }
    return readFile(output, "utf8");
  };
  if (projectRoot !== ROOT) return generate();
  sourceNotice ??= generate();
  return sourceNotice;
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

async function mockPayload(
  root: string,
  platform: SteamPlatform,
  projectRoot = ROOT,
): Promise<string> {
  const depot = getSteamDepot(platform);
  const payload = join(root, `payload-${platform}`);
  const application = join(root, `app-${platform}`);
  await mkdir(join(application, "dist", "assets"), { recursive: true });
  await mkdir(join(application, "dist-electron"));
  await writeFile(join(application, "package.json"), JSON.stringify({
    name: "2dnd", version: packageMetadata.version, main: "dist-electron/main.js",
  }));
  await writeFile(join(application, "dist", "game.html"),
    '<!doctype html><title>Mock game</title><link rel="stylesheet" href="./assets/game-mock.css">'
    + '<script type="module" src="./assets/game-mock.js"></script>');
  await writeFile(join(application, "dist", "assets", "game-mock.js"), "export {};");
  await writeFile(join(application, "dist", "assets", "game-mock.css"), ".mock-dice { display: block; }");
  await writeFile(join(application, "dist-electron", "main.js"), "export {};");
  await writeFile(join(application, "dist-electron", "preload.cjs"), '"use strict";');
  await mkdir(dirname(join(payload, depot.binary)), { recursive: true });
  await writeFile(join(payload, depot.binary), mockBinary(platform), { mode: 0o755 });
  if (platform === "windows-x64") {
    await writeFile(join(payload, "electron_wer.dll"), mockBinary(platform));
    if (process.platform !== "win32") {
      await chmod(join(payload, depot.binary), 0o666);
    }
  }
  await mkdir(dirname(join(payload, depot.appArchive)), { recursive: true });
  await createPackage(application, join(payload, depot.appArchive));
  const licenseRoot = join(payload, depot.licenseDirectory);
  await mkdir(licenseRoot, { recursive: true });
  const licenses = [
    "LICENSE", "node_modules/phaser/LICENSE.md", "node_modules/eventemitter3/LICENSE",
  ];
  for (const [index, file] of STEAM_LICENSE_FILES.entries()) {
    await cp(join(projectRoot, licenses[index]!), join(licenseRoot, file));
  }
  await writeFile(join(licenseRoot, "SOURCE.2dnd.txt"), await sourceNoticeFixture(projectRoot));
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
  projectRoot = ROOT,
): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, ["hacks/prepare-steam.mjs", ...args], {
    cwd: projectRoot, encoding: "utf8", env: { ...process.env, ...environment },
  });
}

async function preparePreviewSet(root: string, projectRoot = ROOT): Promise<string> {
  const assembled = join(root, "assembled");
  await mkdir(join(assembled, "content"), { recursive: true });
  for (const depot of STEAM_DEPOTS) {
    const payload = await mockPayload(root, depot.platform, projectRoot);
    const output = join(root, `preview-${depot.platform}`);
    const result = prepare([
      "prepare", "--platform", depot.platform, "--input", payload, "--output", output,
    ], {}, projectRoot);
    if (result.status !== 0) throw new Error(result.stderr);
    const extracted = spawnSync("tar", [
      "-xpzf", join(output, `${depot.platform}.tar.gz`), "-C", assembled,
    ], { encoding: "utf8" });
    if (extracted.status !== 0) throw new Error(extracted.stderr);
  }
  return assembled;
}

function fixtureGit(projectRoot: string, args: string[]): string {
  const result = spawnSync("git", args, { cwd: projectRoot, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

async function reviewedProject(root: string, unsafeLiveSetting = false): Promise<string> {
  const project = join(root, "project");
  await mkdir(project);
  for (const path of [
    ".gitignore", "LICENSE", "package.json", "docs/source-notice.txt",
    "steam", "hacks/prepare-steam.mjs", "hacks/upload-steam.mjs",
    "hacks/generate-desktop-notice.mjs", "hacks/lib/git-provenance.mjs",
    "hacks/lib/steam-payload.mjs",
  ]) {
    await mkdir(dirname(join(project, path)), { recursive: true });
    await cp(join(ROOT, path), join(project, path), { recursive: true });
  }
  await symlink(join(ROOT, "node_modules"), join(project, "node_modules"),
    process.platform === "win32" ? "junction" : "dir");
  if (unsafeLiveSetting) {
    const path = join(project, "steam/templates/app_build.vdf.in");
    await writeFile(path, (await readFile(path, "utf8"))
      .replace('"SetLive" ""', '"SetLive" "" "setlive" "mock-beta"'));
  }
  fixtureGit(project, ["init", "--quiet", "--initial-branch=main"]);
  fixtureGit(project, ["config", "core.autocrlf", "false"]);
  fixtureGit(project, ["add", "."]);
  fixtureGit(project, [
    "-c", "user.name=Mock Maintainer", "-c", "user.email=mock@example.invalid",
    "commit", "--quiet", "--no-gpg-sign", "-m", "Mock reviewed Steam source",
  ]);
  return project;
}

const MOCK_UPLOAD_ENVIRONMENT = {
  GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/main",
  STEAM_UPLOAD_AUTHORIZED: "1",
  STEAM_APP_ID: "123450", STEAM_DEPOT_WINDOWS_ID: "123451",
  STEAM_DEPOT_MACOS_ID: "123452", STEAM_DEPOT_LINUX_ID: "123453",
  STEAM_BUILD_ACCOUNT: "mock_build",
};

async function privateBuild(root: string): Promise<{ project: string; directory: string }> {
  const project = await reviewedProject(root);
  const assembled = await preparePreviewSet(root, project);
  const directory = join(root, "private");
  const result = prepare([
    "render", "--upload", "--input", assembled, "--output", directory,
  ], MOCK_UPLOAD_ENVIRONMENT, project);
  if (result.status !== 0) throw new Error(result.stderr);
  return { project, directory };
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

  it("rejects a stale packaged version even with a current source notice", async () => {
    const root = await temporaryDirectory();
    const payload = await mockPayload(root, "linux-x64");
    const application = join(root, "app-linux-x64");
    await writeFile(join(application, "package.json"), JSON.stringify({
      name: "2dnd", version: "0.0.0", main: "dist-electron/main.js",
    }));
    await createPackage(application, join(payload, getSteamDepot("linux-x64").appArchive));
    const result = prepare([
      "prepare", "--platform", "linux-x64", "--input", payload, "--output", join(root, "preview"),
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("version");
  });

  it("rechecks the source notice instead of trusting a self-consistent file receipt", async () => {
    const root = await temporaryDirectory();
    const assembled = await preparePreviewSet(root);
    const depot = getSteamDepot("linux-x64");
    const noticePath = join(depot.licenseDirectory, "SOURCE.2dnd.txt");
    const notice = "Mock receipt for an unrelated source commit\n";
    await writeFile(join(assembled, "content", depot.platform, noticePath), notice);
    const manifestPath = join(assembled, `manifest-${depot.platform}.json`);
    const receipt = JSON.parse(await readFile(manifestPath, "utf8")) as {
      files: { path: string; bytes: number; sha256: string }[];
    };
    const file = receipt.files.find((entry) => entry.path === noticePath);
    if (!file) throw new Error("Missing source notice receipt");
    file.bytes = Buffer.byteLength(notice);
    file.sha256 = createHash("sha256").update(notice).digest("hex");
    await writeFile(manifestPath, JSON.stringify(receipt));
    const result = prepare(["verify", "--input", assembled]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("source notice");
  }, 30_000);

  it("prepares all public depots and validates private preview rendering with mock IDs", async () => {
    const root = await temporaryDirectory();
    const assembled = await preparePreviewSet(root);
    for (const depot of STEAM_DEPOTS) {
      const output = join(root, `preview-${depot.platform}`);
      const template = await readFile(join(output, "scripts/app_build.vdf.in"), "utf8");
      expect(template).toContain("{{STEAM_APP_ID}}");
    }
    expect(await readFile(join(assembled, "content/windows-x64/electron_wer.dll"))).toEqual(
      mockBinary("windows-x64"),
    );
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
      const { project, directory } = await privateBuild(root);
      for (const successful of [false, true]) {
        const privateRoot = join(root, successful ? "success" : "failure");
        await cp(directory, privateRoot, { recursive: true, verbatimSymlinks: true });
        const executable = join(root, successful ? "mock-success-steamcmd" : "mock-failure-steamcmd");
        await writeFile(executable,
          `#!${process.execPath}\n`
          + 'process.stdout.write("mock_build MOCK_PRIVATE_TOKEN_NOT_REAL\\n");\n'
          + (successful
            ? 'process.stdout.write("Success! App \'123450\' fully built.\\n");\n'
            : 'process.stdout.write("Mock SDK failure\\n");\nprocess.exitCode = 1;\n'),
          { mode: 0o700 });
        const result = spawnSync(process.execPath, ["hacks/upload-steam.mjs"], {
          cwd: project, encoding: "utf8", env: {
            ...process.env, ...MOCK_UPLOAD_ENVIRONMENT,
            GITHUB_SHA: fixtureGit(project, ["rev-parse", "HEAD"]),
            STEAMCMD_PATH: executable, STEAM_PRIVATE_BUILD_DIR: privateRoot,
          },
        });
        expect(result.status).toBe(successful ? 0 : 1);
        expect(`${result.stdout}${result.stderr}`).not.toMatch(/123450|mock_build|MOCK_PRIVATE_TOKEN/);
        const log = join(privateRoot, "output/steamcmd-private.log");
        expect((await stat(log)).mode & 0o777).toBe(0o600);
        expect(await readFile(log, "utf8")).toContain("MOCK_PRIVATE_TOKEN_NOT_REAL");
      }
    }, 30_000,
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

  it("retains distinct corresponding-source archives and rejects missing or modified source", async () => {
    const root = await temporaryDirectory();
    const project = await reviewedProject(root);
    const assembled = await preparePreviewSet(root, project);
    const sources: string[] = [];
    for (const depot of STEAM_DEPOTS) {
      const receipt = JSON.parse(await readFile(
        join(assembled, `manifest-${depot.platform}.json`), "utf8",
      )) as { format: number; source: { archive: string; sha256: string } };
      expect(receipt.format).toBe(2);
      expect(receipt.source.archive).toContain(depot.platform);
      const source = join(assembled, receipt.source.archive);
      expect(createHash("sha256").update(await readFile(source)).digest("hex"))
        .toBe(receipt.source.sha256);
      sources.push(source);
    }
    expect(new Set(sources).size).toBe(3);
    expect(prepare(["verify", "--input", assembled], {}, project).status).toBe(0);
    const original = await readFile(sources[0]!);
    await rm(sources[0]!);
    expect(prepare(["verify", "--input", assembled], {}, project).status).toBe(1);
    await writeFile(sources[0]!, Buffer.concat([original, Buffer.from("mock corruption")]));
    expect(prepare(["verify", "--input", assembled], {}, project).status).toBe(1);
  }, 30_000);

  it("refuses auto-publishing settings even when they match a committed template", async () => {
    const root = await temporaryDirectory();
    const project = await reviewedProject(root, true);
    const assembled = await preparePreviewSet(root, project);
    const result = prepare([
      "render", "--upload", "--input", assembled, "--output", join(root, "private"),
    ], MOCK_UPLOAD_ENVIRONMENT, project);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("auto-publishing");
    expect(`${result.stdout}${result.stderr}`).not.toMatch(/12345[0-3]|mock_build|mock-beta/);
  }, 30_000);

  it.skipIf(process.platform === "win32").each([
    "payload", "depot", "app", "receipt", "source", "workflow",
  ])("rejects changed private %s before invoking a mock SDK", async (mutation) => {
    const root = await temporaryDirectory();
    const { project, directory } = await privateBuild(root);
    const receiptPath = join(directory, "manifest-linux-x64.json");
    const receipt = JSON.parse(await readFile(receiptPath, "utf8")) as {
      source: { archive: string };
    };
    if (mutation === "payload") {
      await writeFile(join(directory, "content/linux-x64/2D-and-D"), mockBinary("windows-x64"));
    } else if (mutation === "depot") {
      const path = join(directory, "scripts/depot_linux.vdf");
      await writeFile(path, (await readFile(path, "utf8")).replace('"DepotPath" "."', '"DepotPath" "mock"'));
    } else if (mutation === "app") {
      const path = join(directory, "scripts/app_build.vdf");
      await writeFile(path, (await readFile(path, "utf8")).replace('"SetLive" ""', '"SetLive" "mock-beta"'));
    } else if (mutation === "receipt") {
      await writeFile(receiptPath, "null");
    } else if (mutation === "source") {
      await rm(join(directory, receipt.source.archive));
    }
    const invoked = join(root, "mock-invoked");
    const executable = join(root, "mock-steamcmd");
    await writeFile(executable, `#!${process.execPath}\n`
      + `require("node:fs").writeFileSync(${JSON.stringify(invoked)}, "mock");\n`, { mode: 0o700 });
    const result = spawnSync(process.execPath, ["hacks/upload-steam.mjs"], {
      cwd: project, encoding: "utf8", env: {
        ...process.env, ...MOCK_UPLOAD_ENVIRONMENT,
        GITHUB_SHA: mutation === "workflow" ? "0".repeat(40) : fixtureGit(project, ["rev-parse", "HEAD"]),
        STEAMCMD_PATH: executable, STEAM_PRIVATE_BUILD_DIR: directory,
      },
    });
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).not.toMatch(/12345[0-3]|mock_build|mock-beta/);
    await expect(stat(invoked)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(stat(join(directory, "output/steamcmd-private.log")))
      .rejects.toMatchObject({ code: "ENOENT" });
  }, 30_000);
});
