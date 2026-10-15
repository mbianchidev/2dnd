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

    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/);
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
    expect(workflow).toContain("actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9");
    expect(workflow).toContain("actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333");
    expect(workflow).toContain("gh release create");
    expect(workflow).toContain("gh release upload");
    expect(workflow).toContain("GH_REPO: ${{ github.repository }}");
    expect(workflow).toContain("contents: write");
  });
});
