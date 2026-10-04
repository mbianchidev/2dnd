import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getGitProvenance } from "./lib/git-provenance.mjs";
import { formatSteamSourceNotice } from "../steam/config.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

try {
  const args = process.argv.slice(2);
  if (args.length !== 0 && (args.length !== 2 || args[0] !== "--output")) {
    throw new Error("Use no arguments, or --output <explicit notice file>");
  }
  const output = args.length === 2 ? resolve(args[1]) : join(ROOT, "build", "SOURCE.2dnd.txt");
  const template = await readFile(join(ROOT, "docs", "source-notice.txt"), "utf8");
  const provenance = await getGitProvenance(ROOT);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, formatSteamSourceNotice(template, provenance));
  process.stdout.write("Generated source notice before desktop packaging/signing.\n");
} catch (error) {
  process.stderr.write(`[desktop:notice] ${error instanceof Error ? error.message : "Generation failed"}\n`);
  process.exitCode = 1;
}
