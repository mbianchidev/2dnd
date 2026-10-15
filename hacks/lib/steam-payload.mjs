import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  lstat, open, readdir, readFile, readlink, realpath, stat,
} from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { createGunzip } from "node:zlib";
import { extractFile, listPackage, statFile } from "@electron/asar";
import { getGitProvenance } from "./git-provenance.mjs";
import {
  assertSteamBinary,
  createSteamTemplateValues,
  formatSteamSourceNotice,
  getSteamFileMode,
  isAllowedSteamAppEntry,
  isAllowedSteamRuntimeEntry,
  isForbiddenSteamPath,
  renderSteamTemplate,
  STEAM_DEPOTS,
  STEAM_INTEGRATIONS,
  STEAM_LICENSE_FILES,
} from "../../steam/config.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TEMPLATES = join(ROOT, "steam", "templates");
export const STEAM_MANIFEST_FORMAT = 2;

export function withinSteamDirectory(root, candidate) {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

async function hashFile(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

export async function readSteamSourceContext() {
  const provenance = await getGitProvenance(ROOT);
  const metadata = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
  const template = await readFile(join(ROOT, "docs", "source-notice.txt"), "utf8");
  return {
    ...provenance,
    version: metadata.version,
    sourceNotice: formatSteamSourceNotice(template, provenance),
  };
}

async function scanPayload(root, depot, directory = root) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  for (const entry of entries) {
    const path = join(directory, entry.name);
    const name = relative(root, path).split("\\").join("/");
    if (isForbiddenSteamPath(name)) {
      throw new Error(`Forbidden content in Steam payload: ${name}`);
    }
    if (entry.isDirectory()) {
      files.push(...await scanPayload(root, depot, path));
    } else if (entry.isSymbolicLink()) {
      const target = await readlink(path);
      if (isAbsolute(target) || !withinSteamDirectory(root, await realpath(path))) {
        throw new Error(`Steam payload symlink escapes its root: ${name}`);
      }
      files.push({ path: name, symlink: target });
    } else if (entry.isFile()) {
      const info = await stat(path);
      files.push({
        path: name,
        bytes: info.size,
        mode: getSteamFileMode(info.mode, depot),
        sha256: await hashFile(path),
      });
    } else {
      throw new Error(`Unsupported file type in Steam payload: ${name}`);
    }
  }
  return files;
}

function inspectAppArchive(path, expectedVersion) {
  const entries = listPackage(path, { isPack: false }).map((entry) =>
    entry.split("\\").join("/")
  );
  const files = entries.filter((entry) =>
    !("files" in statFile(path, normalize(entry.replace(/^\/+/, "")), false))
  );
  for (const file of files) {
    const info = statFile(path, normalize(file.replace(/^\/+/, "")), false);
    if ("link" in info || !isAllowedSteamAppEntry(file)) {
      throw new Error(`Unexpected packaged application entry: ${file}`);
    }
  }
  for (const required of ["/package.json", "/dist/game.html", "/dist-electron/main.js", "/dist-electron/preload.cjs"]) {
    if (!files.includes(required)) throw new Error(`Missing application runtime entry: ${required}`);
  }
  if (!files.some((file) => /^\/dist\/assets\/game-[\w-]+\.js$/.test(file))) {
    throw new Error("Missing bundled game JavaScript");
  }
  const metadata = JSON.parse(extractFile(path, "package.json").toString("utf8"));
  if (
    metadata.name !== "2dnd" || metadata.main !== "dist-electron/main.js"
    || metadata.version !== expectedVersion
    || Object.keys(metadata.dependencies ?? {}).length !== 0
  ) {
    throw new Error("Packaged application version or metadata does not match reviewed source");
  }
  return { version: metadata.version, appEntries: files.sort() };
}

export async function inspectSteamPayload(root, depot, source) {
  const files = await scanPayload(root, depot);
  for (const file of files) {
    if (!isAllowedSteamRuntimeEntry(file.path, depot)) {
      throw new Error(`Unexpected native runtime content: ${file.path}`);
    }
  }
  const binary = join(root, depot.binary);
  const handle = await open(binary, "r");
  try {
    const header = Buffer.alloc(4096);
    const result = await handle.read(header, 0, header.length, 0);
    assertSteamBinary(header.subarray(0, result.bytesRead), depot.platform);
  } finally {
    await handle.close();
  }
  if (depot.os !== "windows" && ((await stat(binary)).mode & 0o111) === 0) {
    throw new Error("Steam launch executable is missing its executable permission");
  }
  const licenseSources = [
    join(ROOT, "LICENSE"),
    join(ROOT, "node_modules", "phaser", "LICENSE.md"),
    join(ROOT, "node_modules", "eventemitter3", "LICENSE"),
  ];
  for (const [index, name] of STEAM_LICENSE_FILES.entries()) {
    const packaged = await readFile(join(root, depot.licenseDirectory, name));
    if (!packaged.equals(await readFile(licenseSources[index]))) {
      throw new Error(`Missing or mismatched runtime license: ${name}`);
    }
  }
  if (
    !files.some((file) => file.path.endsWith("LICENSES.chromium.html"))
    || !files.some((file) => /(?:^|\/)LICENSE(?:\.electron\.txt)?$/.test(file.path))
  ) {
    throw new Error("Missing Electron or Chromium runtime notices");
  }
  if (await readFile(join(root, depot.licenseDirectory, "SOURCE.2dnd.txt"), "utf8")
    !== source.sourceNotice) {
    throw new Error("Packaged source notice does not match reviewed source; rebuild before staging");
  }
  return { ...inspectAppArchive(join(root, depot.appArchive), source.version), files };
}

export function steamSourceArchiveName(source, depot) {
  return `source-${source.commit}-${depot.platform}.tar.gz`;
}

export async function readSteamSourceReceipt(input, source, depot) {
  if (source.dirty) return null;
  const archive = steamSourceArchiveName(source, depot);
  const path = join(input, archive);
  if (!(await lstat(path)).isFile()) {
    throw new Error("Corresponding-source archive must be a regular file");
  }
  let header = Buffer.alloc(0);
  await pipeline(createReadStream(path), createGunzip(), async (chunks) => {
    for await (const chunk of chunks) {
      if (header.length < 1024) {
        header = Buffer.concat([header, chunk.subarray(0, 1024 - header.length)]);
      }
    }
  });
  const commit = execFileSync("git", ["get-tar-commit-id"], {
    input: header, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
  }).trim();
  if (commit !== source.commit) {
    throw new Error("Corresponding-source archive does not match reviewed commit");
  }
  return { archive, sha256: await hashFile(path) };
}

export async function verifySteamPreviewSet(input, requireClean = false) {
  const source = await readSteamSourceContext();
  if (requireClean && source.dirty) {
    throw new Error("Uploading a modified-worktree preview is forbidden; use reviewed committed source");
  }
  const manifests = [];
  for (const depot of STEAM_DEPOTS) {
    const manifest = JSON.parse(await readFile(
      join(input, `manifest-${depot.platform}.json`), "utf8",
    ));
    const inspected = await inspectSteamPayload(join(input, "content", depot.platform), depot, source);
    const correspondingSource = await readSteamSourceReceipt(input, source, depot);
    if (
      !manifest || typeof manifest !== "object" || Array.isArray(manifest)
      || manifest.format !== STEAM_MANIFEST_FORMAT || manifest.commit !== source.commit
      || manifest.dirty !== source.dirty || manifest.diffHash !== source.diffHash
      || manifest.platform !== depot.platform || manifest.executable !== depot.executable
      || JSON.stringify(manifest.architectures) !== JSON.stringify(depot.architectures)
      || JSON.stringify(manifest.integrations) !== JSON.stringify(STEAM_INTEGRATIONS)
      || manifest.version !== inspected.version
      || JSON.stringify(manifest.appEntries) !== JSON.stringify(inspected.appEntries)
      || JSON.stringify(manifest.files) !== JSON.stringify(inspected.files)
      || JSON.stringify(manifest.source) !== JSON.stringify(correspondingSource)
    ) {
      throw new Error("Steam preview receipt does not match reviewed source or payload");
    }
    manifests.push(manifest);
  }
  return manifests;
}

export async function verifyPrivateSteamBuild(input, ids) {
  const manifests = await verifySteamPreviewSet(input, true);
  const values = createSteamTemplateValues(ids, manifests[0], true);
  const names = (await readdir(TEMPLATES)).sort();
  if (JSON.stringify((await readdir(join(input, "scripts"))).sort())
    !== JSON.stringify(names.map((name) => name.replace(/\.in$/, "")))) {
    throw new Error("Unexpected private SteamPipe configuration files");
  }
  for (const name of names) {
    const template = await readFile(join(TEMPLATES, name), "utf8");
    const actual = await readFile(join(input, "scripts", name.replace(/\.in$/, "")), "utf8");
    if (actual !== renderSteamTemplate(template, values)) {
      throw new Error("Private SteamPipe configuration differs from reviewed templates");
    }
    if (name === "app_build.vdf.in") {
      const liveSettings = [...actual.matchAll(/"SetLive"\s+"([^"]*)"/gi)];
      if (
        !actual.includes(`"AppID" "${ids.appId}"`) || !actual.includes('"Preview" "0"')
        || liveSettings.length !== 1 || liveSettings[0][1] !== "" || actual.includes("{{")
      ) {
        throw new Error("Refusing an unresolved, preview or auto-publishing build config");
      }
    }
  }
  return manifests;
}
