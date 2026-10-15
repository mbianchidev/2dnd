import { execFileSync } from "node:child_process";
import { cp, mkdir, readdir, readFile, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createSteamTemplateValues,
  getSteamDepot,
  parseSteamBuildIds,
  renderSteamTemplate,
  STEAM_INTEGRATIONS,
} from "../steam/config.ts";
import {
  inspectSteamPayload,
  readSteamSourceContext,
  readSteamSourceReceipt,
  steamSourceArchiveName,
  STEAM_MANIFEST_FORMAT,
  verifyPrivateSteamBuild,
  verifySteamPreviewSet,
  withinSteamDirectory,
} from "./lib/steam-payload.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATES = join(ROOT, "steam", "templates");

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
  if (withinSteamDirectory(source, output) || withinSteamDirectory(output, source)) {
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
  const context = await readSteamSourceContext();
  const { source, output } = await createOutput(options.output, options.input);
  const inspected = await inspectSteamPayload(source, depot, context);
  const content = join(output, "content", depot.platform);
  await mkdir(dirname(content));
  await cp(source, content, {
    recursive: true, preserveTimestamps: true, verbatimSymlinks: true,
  });
  const staged = await inspectSteamPayload(content, depot, context);
  if (JSON.stringify(inspected) !== JSON.stringify(staged)) {
    throw new Error("Staged Steam payload did not preserve source bytes and permissions");
  }
  if (!context.dirty) {
    execFileSync("git", ["archive", "--format=tar.gz",
      `--output=${join(output, steamSourceArchiveName(context, depot))}`, context.commit], {
      cwd: ROOT,
    });
  }
  const correspondingSource = await readSteamSourceReceipt(output, context, depot);
  const manifest = {
    format: STEAM_MANIFEST_FORMAT,
    commit: context.commit,
    dirty: context.dirty,
    diffHash: context.diffHash,
    platform: depot.platform,
    architectures: depot.architectures,
    executable: depot.executable,
    integrations: STEAM_INTEGRATIONS,
    source: correspondingSource,
    ...staged,
  };
  const manifestName = `manifest-${depot.platform}.json`;
  await writeFile(join(output, manifestName), `${JSON.stringify(manifest, null, 2)}\n`);
  await writePublicTemplates(output);
  execFileSync("tar", [
    "-czf", join(output, `${depot.platform}.tar.gz`),
    "-C", output, "content", manifestName,
    ...(correspondingSource ? [correspondingSource.archive] : []),
  ]);
  process.stdout.write(`Prepared credential-free ${depot.platform} depot preview (${inspected.files.length} entries).\n`);
}

async function renderPrivate(options) {
  process.umask(0o077);
  const ids = parseSteamBuildIds(process.env);
  const source = await realpath(options.input);
  const manifests = await verifySteamPreviewSet(source, options.upload);
  const { output } = await createOutput(options.output, source);
  await cp(join(source, "content"), join(output, "content"), {
    recursive: true, preserveTimestamps: true, verbatimSymlinks: true,
  });
  for (const manifest of manifests) {
    const name = `manifest-${manifest.platform}.json`;
    await cp(join(source, name), join(output, name));
    if (manifest.source) {
      await cp(join(source, manifest.source.archive), join(output, manifest.source.archive));
    }
  }
  const scripts = join(output, "scripts");
  await mkdir(scripts);
  await mkdir(join(output, "output"));
  const values = createSteamTemplateValues(ids, manifests[0], options.upload);
  for (const name of await readdir(TEMPLATES)) {
    const template = await readFile(join(TEMPLATES, name), "utf8");
    await writeFile(join(scripts, name.replace(/\.in$/, "")), renderSteamTemplate(template, values), {
      mode: 0o600,
    });
  }
  if (options.upload) await verifyPrivateSteamBuild(output, ids);
  else await verifySteamPreviewSet(output);
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
    await verifySteamPreviewSet(resolve(options.input));
    process.stdout.write("Verified all three Steam preview depots and receipts.\n");
  } else {
    await renderPrivate(options);
  }
} catch (error) {
  process.stderr.write(`[steam:prepare] ${error instanceof Error ? error.message : "Preparation failed"}\n`);
  process.exitCode = 1;
}
