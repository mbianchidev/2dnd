import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import manifest from "../package.json";

describe("Electron packaging configuration", () => {
  it("keeps installer artifacts distinct and the packaged app dependency-free", async () => {
    expect(manifest.main).toBe("dist-electron/main.js");
    expect(manifest.desktopName).toBe("2D-and-D.desktop");
    expect(manifest.build.appId).toBe("dev.mbianchidev.2dnd");
    expect(manifest.build.executableName).toBe("2D-and-D");
    expect(manifest.build.linux.syncDesktopName).toBe(true);
    expect(manifest.build.nsis.artifactName).toContain("-setup.");
    expect(manifest.build.portable.artifactName).toContain("-portable.");
    expect(manifest.build.nsis.artifactName).not.toBe(
      manifest.build.portable.artifactName,
    );
    expect("dependencies" in manifest).toBe(false);
    expect(manifest.devDependencies.phaser).toBe("^4.2.1");
    expect(manifest.devDependencies["electron-builder"]).toBe("26.15.7");
    expect(manifest.overrides).toEqual({
      "@electron/asar": "4.2.1",
      "fast-uri": "3.1.7",
      "global-agent": "4.1.3",
    });
    expect(manifest.allowScripts).toEqual({
      "electron-winstaller@5.4.0": true,
      "fsevents@2.3.3": true,
      "fsevents@2.3.2": true,
    });
    await expect(readFile(".npmrc", "utf8")).resolves.toBe("omit=peer\n");
  });
});
