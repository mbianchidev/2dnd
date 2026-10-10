import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  cp, mkdir, open, readdir, readFile, readlink, realpath, stat, writeFile,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { extractFile, listPackage, statFile } from "@electron/asar";
import { getGitProvenance } from "./lib/git-provenance.mjs";
import {
  assertSteamBinary,
  formatSteamSourceNotice,
  getSteamDepot,
  isAllowedSteamAppEntry,
  isAllowedSteamRuntimeEntry,
  isForbiddenSteamPath,
  parseSteamBuildIds,
  renderSteamTemplate,
  STEAM_DEPOTS,
  STEAM_INTEGRATIONS,
  STEAM_LICENSE_FILES,
} from "../steam/config.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATES = join(ROOT, "steam", "templates");

function within(root, candidate) {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

async function hashFile(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function scanPayload(root, directory = root) {
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
      files.push(...await scanPayload(root, path));
    } else if (entry.isSymbolicLink()) {
      const target = await readlink(path);
      if (isAbsolute(target) || !within(root, await realpath(path))) {
        throw new Error(`Steam payload symlink escapes its root: ${name}`);
      }
      files.push({ path: name, symlink: target });
    } else if (entry.isFile()) {
      const info = await stat(path);
      files.push({
        path: name,
        bytes: info.size,
        mode: info.mode & 0o777,
        sha256: await hashFile(path),
      });
    } else {
      throw new Error(`Unsupported file type in Steam payload: ${name}`);
    }
  }
  return files;
}

function inspectAppArchive(path) {
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
    || typeof metadata.version !== "string"
    || !/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][\w.-]+)?$/.test(metadata.version)
    || Object.keys(metadata.dependencies ?? {}).length !== 0
  ) {
    throw new Error("Unexpected packaged application metadata or runtime dependencies");
  }
  return { version: metadata.version, appEntries: files.sort() };
}

async function inspectPayload(root, depot) {
  const files = await scanPayload(root);
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
  return { ...inspectAppArchive(join(root, depot.appArchive)), files };
}

async function canonicalOutput(path) {
  let ancestor = resolve(path);
  const suffix = [];
  while (true) {
    try {
      return join(await realpath(ancestor), ...suffix);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      suffix.unshift(basename(ancestor));
      ancestor = dirname(ancestor);
    }
  }
}

async function createOutput(path, input) {
  const output = await canonicalOutput(path);
  const source = await realpath(input);
  if (within(source, output) || within(output, source)) {
    throw new Error("Steam output and input directories must not overlap");
  }
  await mkdir(dirname(output), { recursive: true });
  await mkdir(output, { mode: 0o700 });
  return { output, source };
}

async function writePublicTemplates(output) {
  const scripts = join(output, "scripts");
  await mkdir(scripts);
  for (const name of await readdir(TEMPLATES)) {
    if (!name.endsWith(".vdf.in")) throw new Error("Unexpected Steam template file");
    await cp(join(TEMPLATES, name), join(scripts, name));
  }
}

async function prepare(options) {
  const depot = getSteamDepot(options.platform);
  const { source, output } = await createOutput(options.output, options.input);
  const inspected = await inspectPayload(source, depot);
  const provenance = await getGitProvenance(ROOT);
  const content = join(output, "content", depot.platform);
  await mkdir(dirname(content));
  await cp(source, content, {
    recursive: true, preserveTimestamps: true, verbatimSymlinks: true,
  });
  const staged = await inspectPayload(content, depot);
  if (JSON.stringify(inspected) !== JSON.stringify(staged)) {
    throw new Error("Staged Steam payload did not preserve source bytes and permissions");
  }
  const sourceNotice = await readFile(join(ROOT, "docs", "source-notice.txt"), "utf8");
  if (await readFile(join(content, depot.licenseDirectory, "SOURCE.2dnd.txt"), "utf8")
    !== formatSteamSourceNotice(sourceNotice, provenance)) {
    throw new Error("Packaged source notice does not match source; rebuild before staging");
  }
  const manifest = {
    format: 1,
    ...provenance,
    platform: depot.platform,
    architectures: depot.architectures,
    executable: depot.executable,
    integrations: STEAM_INTEGRATIONS,
    ...staged,
  };
  const manifestName = `manifest-${depot.platform}.json`;
  await writeFile(join(output, manifestName), `${JSON.stringify(manifest, null, 2)}\n`);
  await writePublicTemplates(output);
  execFileSync("tar", [
    "-czf", join(output, `${depot.platform}.tar.gz`),
    "-C", output, "content", manifestName,
  ]);
  if (!provenance.dirty) {
    execFileSync("git", ["archive", "--format=tar.gz",
      `--output=${join(output, `source-${provenance.commit}.tar.gz`)}`, provenance.commit], {
      cwd: ROOT,
    });
  }
  process.stdout.write(`Prepared credential-free ${depot.platform} depot preview (${inspected.files.length} entries).\n`);
}

async function verifySet(input) {
  const manifestFiles = [];
  const provenance = await getGitProvenance(ROOT);
  for (const depot of STEAM_DEPOTS) {
    const manifest = JSON.parse(await readFile(
      join(input, `manifest-${depot.platform}.json`), "utf8",
    ));
    const inspected = await inspectPayload(join(input, "content", depot.platform), depot);
    if (
      manifest.format !== 1 || manifest.commit !== provenance.commit
      || manifest.dirty !== provenance.dirty || manifest.diffHash !== provenance.diffHash
      || manifest.platform !== depot.platform || manifest.executable !== depot.executable
      || JSON.stringify(manifest.architectures) !== JSON.stringify(depot.architectures)
      || JSON.stringify(manifest.integrations) !== JSON.stringify(STEAM_INTEGRATIONS)
      || manifest.version !== inspected.version
      || JSON.stringify(manifest.appEntries) !== JSON.stringify(inspected.appEntries)
      || JSON.stringify(manifest.files) !== JSON.stringify(inspected.files)
    ) {
      throw new Error("Steam preview receipt does not match reviewed source or payload");
    }
    manifestFiles.push(manifest);
  }
  if (new Set(manifestFiles.map((manifest) => manifest.version)).size !== 1) {
    throw new Error("All Steam depots must use the same application version");
  }
  return manifestFiles;
}

async function renderPrivate(options) {
  process.umask(0o077);
  const ids = parseSteamBuildIds(process.env);
  const source = await realpath(options.input);
  const manifests = await verifySet(source);
  if (options.upload && manifests.some((manifest) => manifest.dirty)) {
    throw new Error("Uploading a modified-worktree preview is forbidden; use reviewed committed source");
  }
  const { output } = await createOutput(options.output, source);
  await cp(join(source, "content"), join(output, "content"), {
    recursive: true, preserveTimestamps: true, verbatimSymlinks: true,
  });
  const scripts = join(output, "scripts");
  await mkdir(scripts);
  await mkdir(join(output, "output"));
  const values = {
    STEAM_APP_ID: ids.appId,
    STEAM_DEPOT_WINDOWS_ID: ids.depots["windows-x64"],
    STEAM_DEPOT_MACOS_ID: ids.depots["macos-universal"],
    STEAM_DEPOT_LINUX_ID: ids.depots["linux-x64"],
    STEAM_PREVIEW: options.upload ? "0" : "1",
    BUILD_DESCRIPTION: `2D-and-D ${manifests[0].version} ${manifests[0].commit}`,
  };
  for (const name of await readdir(TEMPLATES)) {
    const template = await readFile(join(TEMPLATES, name), "utf8");
    await writeFile(join(scripts, name.replace(/\.in$/, "")), renderSteamTemplate(template, values), {
      mode: 0o600,
    });
  }
  process.stdout.write("Rendered private SteamPipe configuration; no IDs or credentials logged.\n");
}

function readOptions(args) {
  const [command = "help", ...parameters] = args;
  if (!["help", "prepare", "verify", "render"].includes(command)) {
    throw new Error("Use prepare, verify or render; run steam:prepare without arguments for help");
  }
  const options = { command, upload: false };
  for (let index = 0; index < parameters.length; index += 1) {
    const flag = parameters[index];
    if (flag === "--upload") {
      options.upload = true;
      continue;
    }
    if (!["--platform", "--input", "--output"].includes(flag)) {
      throw new Error("Unknown Steam preparation option");
    }
    const value = parameters[++index];
    if (!value || value.startsWith("--")) throw new Error(`Missing ${flag} value`);
    options[flag.slice(2)] = value;
  }
  if (command !== "help" && !options.input) throw new Error("Missing --input directory");
  if (["prepare", "render"].includes(command) && !options.output) {
    throw new Error("Missing --output directory");
  }
  if (command === "prepare" && !options.platform) throw new Error("Missing --platform");
  if (options.upload && (
    command !== "render" || process.env.STEAM_UPLOAD_AUTHORIZED !== "1"
  )) throw new Error("Upload configuration requires explicit protected authorization");
  return options;
}

try {
  const options = readOptions(process.argv.slice(2));
  if (options.command === "help") {
    process.stdout.write(
      "Steam preparation (Node 24+; no account or SDK needed for prepare):\n"
      + "  prepare --platform <windows-x64|macos-universal|linux-x64> --input <unpacked> --output <new directory>\n"
      + "  verify --input <assembled preview set>\n"
      + "  render --input <assembled preview set> --output <new private directory> [--upload]\n",
    );
  } else if (options.command === "prepare") {
    await prepare(options);
  } else if (options.command === "verify") {
    await verifySet(resolve(options.input));
    process.stdout.write("Verified all three Steam preview depots and receipts.\n");
  } else {
    await renderPrivate(options);
  }
} catch (error) {
  process.stderr.write(`[steam:prepare] ${error instanceof Error ? error.message : "Preparation failed"}\n`);
  process.exitCode = 1;
}
