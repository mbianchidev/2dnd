import { afterEach, describe, expect, it } from "vitest";
import {
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDesktopLogger } from "../electron/logger";

const temporaryDirectories: string[] = [];

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "2dnd-log-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(
      (directory) => rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("Electron persistent logger", () => {
  it("writes timestamped single-line diagnostics with restricted permissions", async () => {
    const directory = await createTemporaryDirectory();
    const logger = createDesktopLogger(directory, {
      now: () => new Date("2026-08-15T12:00:00.000Z"),
    });

    logger.error("Renderer failed\nsecond line\u0000");

    const contents = await readFile(logger.filePath, "utf8");
    expect(contents).toBe(
      "2026-08-15T12:00:00.000Z [ERROR] "
      + "Renderer failed\\nsecond line?\n",
    );
  });

  it("keeps one bounded previous log when the active file fills", async () => {
    const directory = await createTemporaryDirectory();
    const logger = createDesktopLogger(directory, {
      maxBytes: 180,
      now: () => new Date("2026-08-15T12:00:00.000Z"),
    });

    logger.info(`first-${"a".repeat(110)}`);
    logger.warn(`second-${"b".repeat(110)}`);

    const [active, previous] = await Promise.all([
      readFile(logger.filePath, "utf8"),
      readFile(logger.previousFilePath, "utf8"),
    ]);
    expect(active).toContain("[WARN] second-");
    expect(active).not.toContain("first-");
    expect(previous).toContain("[INFO] first-");
  });
});
