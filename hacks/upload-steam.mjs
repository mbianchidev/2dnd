import { spawnSync } from "node:child_process";
import { closeSync, openSync, readFileSync, readSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { parseSteamBuildIds } from "../steam/config.ts";

class PublicUploadError extends Error {}

function readLogTail(path) {
  const size = statSync(path).size;
  const bytes = Buffer.alloc(Math.min(size, 64 * 1024));
  const descriptor = openSync(path, "r");
  try {
    readSync(descriptor, bytes, 0, bytes.length, size - bytes.length);
  } finally {
    closeSync(descriptor);
  }
  return bytes.toString("utf8");
}

try {
  if (
    process.env.STEAM_UPLOAD_AUTHORIZED !== "1"
    || process.env.GITHUB_EVENT_NAME !== "workflow_dispatch"
    || process.env.GITHUB_REF !== "refs/heads/main"
  ) throw new PublicUploadError("Explicit main-branch dispatch approval is required");
  process.umask(0o077);
  const ids = parseSteamBuildIds(process.env);
  const executable = process.env.STEAMCMD_PATH;
  const account = process.env.STEAM_BUILD_ACCOUNT;
  const directory = process.env.STEAM_PRIVATE_BUILD_DIR;
  if (!executable || !isAbsolute(executable) || !statSync(executable).isFile()) {
    throw new PublicUploadError("Configure the protected runner's absolute STEAMCMD_PATH");
  }
  if (!account || !/^[a-zA-Z0-9_]{1,64}$/.test(account)) {
    throw new PublicUploadError("Configure the protected preauthenticated build account");
  }
  if (!directory || !isAbsolute(directory)) {
    throw new PublicUploadError("Missing protected private build directory");
  }
  const build = join(resolve(directory), "scripts", "app_build.vdf");
  const config = readFileSync(build, "utf8");
  const liveSettings = [...config.matchAll(/"SetLive"\s+"([^"]*)"/gi)];
  if (
    !config.includes(`"AppID" "${ids.appId}"`)
    || !config.includes('"Preview" "0"')
    || liveSettings.length !== 1 || liveSettings[0][1] !== ""
    || config.includes("{{")
  ) throw new PublicUploadError("Refusing an unresolved, preview or auto-publishing build config");
  const logPath = join(directory, "output", "steamcmd-private.log");
  const log = openSync(logPath, "wx", 0o600);
  let result;
  try {
    result = spawnSync(executable, [
      "+@ShutdownOnFailedCommand", "1",
      "+@NoPromptForPassword", "1",
      "+login", account,
      "+run_app_build", build,
      "+quit",
    ], {
      cwd: resolve(directory),
      stdio: ["ignore", log, log],
      timeout: 2 * 60 * 60 * 1000,
      windowsHide: true,
    });
  } finally {
    closeSync(log);
  }
  const output = readLogTail(logPath);
  if (
    result.error || result.signal || result.status !== 0
    || !output.includes(`Success! App '${ids.appId}' fully built.`)
  ) {
    throw new PublicUploadError("SteamCMD did not report success; inspect restricted host logs");
  }
  process.stdout.write("SteamPipe upload completed. No branch set live; human Steamworks review is still required.\n");
} catch (error) {
  const code = typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code)
    ? ` (${error.code})` : "";
  const reason = error instanceof PublicUploadError
    ? error.message
    : `Protected configuration/runner operation failed${code}; inspect restricted host logs`;
  process.stderr.write(
    `[steam:upload] ${reason}. No account details are printed.\n`,
  );
  process.exitCode = 1;
}
