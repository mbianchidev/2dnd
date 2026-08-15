import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { resolve } from "node:path";
import electronPath from "electron";

const root = process.cwd();
const vitePath = resolve(root, "node_modules", "vite", "bin", "vite.js");
if (typeof electronPath !== "string" || electronPath.length === 0) {
  throw new Error("Electron executable is unavailable; run npm ci first");
}

async function findAvailablePort() {
  const server = createServer();
  server.unref();
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Unable to allocate a desktop development port");
  }
  const { port } = address;
  await new Promise((resolveClose, rejectClose) => {
    server.close((error) => {
      if (error) rejectClose(error);
      else resolveClose();
    });
  });
  return port;
}

async function waitForServer(url, child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Vite exited before Electron started (${child.exitCode})`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 150));
  }
  throw new Error(`Timed out waiting for Vite at ${url}`);
}

function stopChild(child) {
  if (child && child.exitCode === null && !child.killed) {
    child.kill("SIGTERM");
  }
}

const port = await findAvailablePort();
const rendererUrl = `http://127.0.0.1:${port}/`;
const vite = spawn(
  process.execPath,
  [
    vitePath,
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort",
  ],
  {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  },
);

let electron;
const shutdown = () => {
  stopChild(electron);
  stopChild(vite);
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

try {
  await waitForServer(rendererUrl, vite);
  process.stdout.write(`[desktop] Starting Electron at ${rendererUrl}\n`);
  electron = spawn(electronPath, [root], {
    cwd: root,
    env: {
      ...process.env,
      ELECTRON_RENDERER_URL: rendererUrl,
    },
    stdio: "inherit",
  });
  const [exitCode] = await once(electron, "exit");
  process.exitCode = typeof exitCode === "number" ? exitCode : 1;
} catch (error) {
  process.stderr.write(
    `[desktop] Development startup failed: ${
      error instanceof Error ? error.stack ?? error.message : String(error)
    }\n`,
  );
  process.exitCode = 1;
} finally {
  shutdown();
}
