import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, readlink } from "node:fs/promises";
import { join } from "node:path";

export async function getGitProvenance(root) {
  const runGit = (args) => {
    const result = spawnSync("git", args, { cwd: root, maxBuffer: 50 * 1024 * 1024 });
    if (result.status !== 0) {
      throw new Error(`Git provenance failed: ${result.stderr.toString().trim()}`);
    }
    return result.stdout;
  };
  const commit = runGit(["rev-parse", "HEAD"]).toString().trim();
  const status = runGit(["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  if (status.length === 0) return { commit, dirty: false, diffHash: null };
  const hash = createHash("sha256");
  hash.update(status);
  hash.update(runGit(["diff", "--binary", "HEAD", "--no-ext-diff"]));
  const paths = status.toString().split("\0")
    .filter((entry) => entry.startsWith("?? "))
    .map((entry) => entry.slice(3)).sort();
  for (const path of paths) {
    const absolute = join(root, path);
    hash.update(path);
    hash.update((await lstat(absolute)).isSymbolicLink()
      ? await readlink(absolute)
      : await readFile(absolute));
  }
  return { commit, dirty: true, diffHash: hash.digest("hex") };
}
