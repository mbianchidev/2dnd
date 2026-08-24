import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("tagged desktop release workflow", () => {
  it("keeps package release metadata synchronized", async () => {
    const manifest = JSON.parse(
      await readFile("package.json", "utf8"),
    ) as { version: string };
    const lockfile = JSON.parse(
      await readFile("package-lock.json", "utf8"),
    ) as { version: string; packages: Record<string, { version: string }> };

    expect(manifest.version).toBe("1.1.0");
    expect(lockfile.version).toBe(manifest.version);
    expect(lockfile.packages[""].version).toBe(manifest.version);
  });

  it("verifies, packages, and publishes every supported platform", async () => {
    const workflow = await readFile(".github/workflows/release.yml", "utf8");

    expect(workflow).toContain('tags: ["v*"]');
    expect(workflow).toContain("Release tag ");
    expect(workflow).toContain("git merge-base --is-ancestor");
    expect(workflow).toContain("npm audit");
    expect(workflow).toContain("npm run test:browser");
    expect(workflow).toContain("npm run test:desktop:built");
    expect(workflow).toContain("builderArgument: --linux");
    expect(workflow).toContain("builderArgument: --mac");
    expect(workflow).toContain("builderArgument: --win");
    expect(workflow).toContain("actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a");
    expect(workflow).toContain("actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c");
    expect(workflow).toContain("gh release create");
    expect(workflow).toContain("gh release upload");
    expect(workflow).toContain("GH_REPO: ${{ github.repository }}");
    expect(workflow).toContain("contents: write");
  });
});
