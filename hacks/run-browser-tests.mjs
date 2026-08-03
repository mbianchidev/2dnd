import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";

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

const port = process.env.PLAYWRIGHT_PORT ?? String(await findAvailablePort());
const playwrightCli = fileURLToPath(
  new URL("../node_modules/@playwright/test/cli.js", import.meta.url),
);
const child = spawn(
  process.execPath,
  [playwrightCli, "test", ...process.argv.slice(2)],
  {
    env: {
      ...process.env,
      PLAYWRIGHT_PORT: port,
    },
    stdio: "inherit",
  },
);

child.once("error", (error) => {
  console.error(`[browser-tests] Failed to start Playwright: ${error.message}`);
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  if (signal) {
    console.error(`[browser-tests] Playwright stopped by ${signal}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
