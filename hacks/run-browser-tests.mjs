import { execFile, spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { createBrowserShards } from "./lib/browserShards.ts";

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to allocate a browser test server port"));
        return;
      }
      server.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}

const playwrightCli = fileURLToPath(
  new URL("../node_modules/@playwright/test/cli.js", import.meta.url),
);

async function main() {
  const args = process.argv.slice(2);
  const balanced = args.find((argument) => argument.startsWith("--balanced-shard="));
  const port = process.env.PLAYWRIGHT_PORT ?? String(await findAvailablePort());
  const env = { ...process.env, PLAYWRIGHT_PORT: port };
  let temporaryDirectory;
  let plan;
  try {
    if (balanced) {
      const match = balanced.match(/^--balanced-shard=([1-9]\d*)\/([1-9]\d*)$/);
      if (!match || Number(match[1]) > Number(match[2])
        || args.some((argument) => argument.startsWith("--shard"))) {
        throw new Error("Use one --balanced-shard=current/total without --shard");
      }
      const current = Number(match[1]);
      const count = Number(match[2]);
      args.splice(args.indexOf(balanced), 1);
      const discover = async () => {
        const result = await promisify(execFile)(process.execPath, [
          playwrightCli, "test", ...args, "--list", "--reporter=json",
        ], {
          env: {
            ...env, PLAYWRIGHT_JSON_OUTPUT_NAME: "", PLAYWRIGHT_JSON_OUTPUT_FILE: "",
            PLAYWRIGHT_JSON_OUTPUT_DIR: "",
          },
          maxBuffer: 10 * 1024 * 1024,
        });
        return JSON.parse(result.stdout);
      };
      const report = await discover();
      const shards = createBrowserShards(report, count);
      temporaryDirectory = await mkdtemp(join(tmpdir(), "2dnd-browser-shard-"));
      const selected = join(temporaryDirectory, "selected.txt");
      await writeFile(selected, `${shards[current - 1].join("\n")}\n`);
      args.push("--test-list", selected);
      const actual = createBrowserShards(await discover(), 1)[0];
      if (JSON.stringify(actual.sort()) !== JSON.stringify([...shards[current - 1]].sort())) {
        throw new Error("Native Playwright selection does not match the complete shard plan");
      }
      plan = { current, count, shards };
      console.log(`[browser-tests] Interleaved shard ${current}/${count}: ${shards[current - 1].length}/${shards.flat().length} cases`);
    }
    const code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [playwrightCli, "test", ...args], {
        env, stdio: "inherit",
      });
      child.once("error", reject);
      child.once("exit", (status, signal) => {
        if (signal) reject(new Error(`Playwright stopped by ${signal}`));
        else resolve(status ?? 1);
      });
    });
    if (plan) {
      await mkdir("test-results", { recursive: true });
      await writeFile("test-results/shard-plan.json", JSON.stringify(plan, null, 2));
    }
    process.exitCode = code;
  } finally {
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`[browser-tests] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
