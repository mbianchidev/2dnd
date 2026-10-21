import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

describe("desktop application icons", () => {
  it("provides valid generated PNG, ICO, and ICNS resources", async () => {
    const directory = await mkdtemp(resolve(tmpdir(), "2dnd-native-icons-"));
    try {
      const generated = spawnSync(process.execPath, [resolve("hacks/generate-desktop-icons.mjs")], {
        cwd: directory, encoding: "utf8",
      });
      if (generated.error) throw generated.error;
      expect(generated.status, generated.stderr).toBe(0);
      const [png, ico, icns] = await Promise.all([
        readFile(resolve(directory, "build/icon.png")),
        readFile(resolve(directory, "build/icon.ico")),
        readFile(resolve(directory, "build/icon.icns")),
      ]);
      expect(png.subarray(0, 8)).toEqual(PNG_SIGNATURE);
      expect(png.readUInt32BE(16)).toBe(1024);
      expect(png.readUInt32BE(20)).toBe(1024);
      expect(ico.readUInt16LE(0)).toBe(0);
      expect(ico.readUInt16LE(2)).toBe(1);
      expect(ico.readUInt16LE(4)).toBeGreaterThanOrEqual(6);
      expect(icns.subarray(0, 4).toString("ascii")).toBe("icns");
      expect(icns.readUInt32BE(4)).toBe(icns.length);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
