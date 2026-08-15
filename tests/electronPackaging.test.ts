import { describe, expect, it } from "vitest";
import manifest from "../package.json";

describe("Electron packaging configuration", () => {
  it("keeps installer artifacts distinct and the packaged app dependency-free", () => {
    expect(manifest.main).toBe("dist-electron/main.js");
    expect(manifest.build.appId).toBe("dev.mbianchidev.2dnd");
    expect(manifest.build.nsis.artifactName).toContain("-setup.");
    expect(manifest.build.portable.artifactName).toContain("-portable.");
    expect(manifest.build.nsis.artifactName).not.toBe(
      manifest.build.portable.artifactName,
    );
    expect("dependencies" in manifest).toBe(false);
    expect(manifest.devDependencies.phaser).toBe("^4.2.1");
  });
});
