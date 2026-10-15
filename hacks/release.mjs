import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const workflowPath = ".github/workflows/release.yml";
const args = process.argv.slice(2);
const env = {
  ...process.env,
  GH_PROMPT_DISABLED: "1",
  GIT_TERMINAL_PROMPT: "0",
  GIT_PAGER: "cat",
};
delete env.GH_REPO;
let tag = "";
let tagOid = "";
let created = false;
let mayRollback = false;
let runUrl = "";
let repository = "";
let hostname = "";
let versionCommit = "";
let versionPrepared = false;
const versionFiles = ["package.json", "package-lock.json", "README.md", "AGENTS.md"];
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

function log(message) {
  process.stdout.write(`[release] ${message}\n`);
}

function report(message) {
  process.stderr.write(`[release] ${message.replace(/(https?:\/\/)[^/\s@]+@/g, "$1[redacted]@")}\n`);
}

function command(binary, parameters, live = false) {
  const result = spawnSync(binary, parameters, {
    cwd: root,
    env,
    encoding: "utf8",
    stdio: live ? "inherit" : "pipe",
    ...(live ? {} : { timeout: 60_000 }),
  });
  if (result.error) throw new Error(`Cannot run ${binary}: ${result.error.message}`);
  return {
    status: result.status,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

function checked(binary, parameters) {
  const result = command(binary, parameters);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || `exit ${result.status}`)
      .replace(/(https?:\/\/)[^/\s@]+@/g, "$1[redacted]@");
    throw new Error(`${binary} ${parameters[0]} failed: ${detail}`);
  }
  return result.stdout;
}

function object(value, context) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid ${context} response.`);
  }
  return value;
}

function json(text, context) {
  try {
    return object(JSON.parse(text), context);
  } catch (error) {
    throw new Error(`Cannot read ${context}: ${error.message}`);
  }
}

function api(endpoint) {
  return json(checked("gh", ["api", "--hostname", hostname, endpoint]), endpoint);
}

function remoteRefOid(reference) {
  const output = checked("git", ["ls-remote", "--refs", "origin", reference]);
  if (!output) return "";
  const entries = output.split("\n");
  const [oid, ref] = entries[0].split(/\s+/);
  if (entries.length !== 1 || ref !== reference || !/^[a-f0-9]{40,64}$/.test(oid)) {
    throw new Error(`Cannot verify the remote ref identity: ${reference}.`);
  }
  return oid;
}

function remoteOid() {
  return remoteRefOid(`refs/tags/${tag}`);
}

function packageVersion(manifest, lock) {
  if (typeof manifest.version !== "string" || !versionPattern.test(manifest.version)) {
    throw new Error("package.json must contain a valid release version.");
  }
  if (lock.version !== manifest.version
    || object(object(lock.packages, "lock packages")[""], "lock root").version !== manifest.version) {
    throw new Error("package.json and both lockfile version fields must match.");
  }
  return manifest.version;
}

function compareVersions(left, right) {
  const leftParts = versionPattern.exec(left);
  const rightParts = versionPattern.exec(right);
  if (!leftParts || !rightParts) throw new Error("Cannot compare invalid release versions.");
  for (const index of [1, 2, 3]) {
    const leftNumber = BigInt(leftParts[index]);
    const rightNumber = BigInt(rightParts[index]);
    if (leftNumber !== rightNumber) return leftNumber > rightNumber ? 1 : -1;
  }
  const leftPrerelease = leftParts[4]?.split(".") ?? [];
  const rightPrerelease = rightParts[4]?.split(".") ?? [];
  if (leftPrerelease.length === 0 || rightPrerelease.length === 0) {
    if (leftPrerelease.length === rightPrerelease.length) return 0;
    return leftPrerelease.length === 0 ? 1 : -1;
  }
  for (let index = 0; index < Math.max(leftPrerelease.length, rightPrerelease.length); index++) {
    const leftIdentifier = leftPrerelease[index];
    const rightIdentifier = rightPrerelease[index];
    if (leftIdentifier === undefined || rightIdentifier === undefined) {
      return leftIdentifier === undefined ? -1 : 1;
    }
    if (leftIdentifier === rightIdentifier) continue;
    const leftNumeric = /^\d+$/.test(leftIdentifier);
    const rightNumeric = /^\d+$/.test(rightIdentifier);
    if (leftNumeric && rightNumeric) {
      return BigInt(leftIdentifier) > BigInt(rightIdentifier) ? 1 : -1;
    }
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftIdentifier > rightIdentifier ? 1 : -1;
  }
  return 0;
}

function committedVersion(commit) {
  return packageVersion(
    json(checked("git", ["show", `${commit}:package.json`]), "committed package.json"),
    json(checked("git", ["show", `${commit}:package-lock.json`]), "committed package-lock.json"),
  );
}

function assertMainCheckout(commit) {
  if (checked("git", ["symbolic-ref", "--quiet", "--short", "HEAD"]) !== "main") {
    throw new Error("Run the release command from a clean main checkout, not a feature branch or detached HEAD.");
  }
  if (checked("git", ["rev-parse", "--verify", "HEAD"]) !== commit) {
    throw new Error("The release commit changed during preparation; inspect the checkout before retrying.");
  }
}

function changedPaths(staged = false) {
  const output = checked("git", ["diff", ...(staged ? ["--cached"] : []), "--name-only", "--"]);
  return output ? output.split("\n").sort() : [];
}

function matchesVersionFiles(paths) {
  const expected = [...versionFiles].sort();
  return paths.length === versionFiles.length
    && paths.every((path, index) => path === expected[index]);
}

async function prepareVersion(commit, currentVersion, targetVersion, requestedVersion) {
  const references = [
    ["README.md", `Current release: **v${currentVersion}**`, `Current release: **v${targetVersion}**`],
    ["AGENTS.md", `| Product | Browser/Electron JRPG, release v${currentVersion} |`,
      `| Product | Browser/Electron JRPG, release v${targetVersion} |`],
  ];
  const updates = await Promise.all(references.map(async ([path, before, after]) => {
    const content = await readFile(join(root, path), "utf8");
    if (content.split(before).length !== 2) {
      throw new Error(`Cannot identify the owned current-release reference in ${path}; no version bump was started.`);
    }
    return { path, before: content, after: content.replace(before, after) };
  }));
  assertMainCheckout(commit);
  if (checked("git", ["status", "--porcelain=v1", "--untracked-files=normal"])) {
    throw new Error("The worktree changed before npm version; no version update was started.");
  }
  versionPrepared = true;
  log(`Preparing npm version: ${currentVersion} -> ${targetVersion}.`);
  checked("npm", ["version", requestedVersion ?? "patch", "--no-git-tag-version"]);
  const actualVersion = packageVersion(
    json(await readFile(join(root, "package.json"), "utf8"), "updated package.json"),
    json(await readFile(join(root, "package-lock.json"), "utf8"), "updated package-lock.json"),
  );
  if (actualVersion !== targetVersion) throw new Error(`npm produced ${actualVersion}, expected ${targetVersion}.`);
  for (const update of updates) {
    if (await readFile(join(root, update.path), "utf8") !== update.before) {
      throw new Error(`${update.path} changed during npm version; it was not overwritten.`);
    }
    await writeFile(join(root, update.path), update.after);
  }
  assertMainCheckout(commit);
  if (!matchesVersionFiles(changedPaths()) || changedPaths(true).length > 0
    || checked("git", ["ls-files", "--others", "--exclude-standard"])) {
    throw new Error("Unexpected file/index changes during the version bump; nothing was committed or pushed.");
  }
  checked("git", ["add", "--", ...versionFiles]);
  if (!matchesVersionFiles(changedPaths(true)) || changedPaths().length > 0) {
    throw new Error("Version files changed while staging; inspect the index before retrying.");
  }
  checked("git", ["commit", "--no-gpg-sign", "-m", `Bump version to ${targetVersion}`]);
  versionCommit = checked("git", ["rev-parse", "--verify", "HEAD"]);
  const committedPaths = checked("git", ["diff", "--name-only", commit, versionCommit, "--"]).split("\n").sort();
  if (!/^[a-f0-9]{40,64}$/.test(versionCommit)
    || checked("git", ["rev-parse", "--verify", "HEAD^"]) !== commit
    || !matchesVersionFiles(committedPaths)
    || committedVersion(versionCommit) !== targetVersion
    || checked("git", ["status", "--porcelain=v1", "--untracked-files=normal"])) {
    throw new Error("The version commit/worktree is not the expected single clean bump; no branch was pushed.");
  }
  assertMainCheckout(versionCommit);
  log(`Created version commit ${versionCommit}.`);
  const push = command("git", ["push", "origin", `${versionCommit}:refs/heads/main`]);
  if (remoteRefOid("refs/heads/main") !== versionCommit) {
    throw new Error(`Cannot confirm the version commit on origin/main; no tag was created. ${push.stderr}`);
  }
  if (push.status !== 0) report("Main push reported an error, but the exact version commit is confirmed remotely.");
  log("Pushed the version commit to origin/main.");
  return versionCommit;
}

function assertRun(run, commit, workflowId) {
  if (!Number.isSafeInteger(run.id) || run.id < 1 || run.head_sha !== commit
    || run.head_branch !== tag || run.event !== "push" || run.workflow_id !== workflowId
    || typeof run.html_url !== "string") {
    throw new Error("Refusing to monitor a workflow that does not match this tag, commit and release workflow.");
  }
}

function rollback() {
  if (!created || !tagOid) return;
  const remote = remoteOid();
  if (remote && remote !== tagOid) {
    throw new Error("Remote tag changed ownership; neither tag was deleted. Inspect both refs manually.");
  }
  const local = checked("git", ["rev-parse", "--verify", `refs/tags/${tag}`]);
  if (local !== tagOid) {
    throw new Error("Local tag changed ownership; neither tag was deleted. Inspect both refs manually.");
  }
  if (remote) {
    checked("git", ["push", "origin", "--delete", `refs/tags/${tag}`]);
    if (remoteOid()) throw new Error("Remote tag deletion could not be verified; the local tag was retained.");
    log(`Rolled back remote tag ${tag}.`);
  }
  checked("git", ["update-ref", "-d", `refs/tags/${tag}`, tagOid]);
  log(`Rolled back local tag ${tag}.`);
}

async function release() {
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
    log("Usage: scripts/release.sh [vVERSION]");
    log("Default: npm patch. An explicit higher VERSION prepares that version; both sync references, commit unsigned, push main, tag and wait for release.yml.");
    log("Requires clean up-to-date main, git, gh and Node.js 24+. Explicit current VERSION retries without another version update.");
    log("Confirmed failed CI removes only this invocation's unchanged local/remote tags.");
    log("The version commit is retained on main; no branch history is rolled back.");
    return;
  }
  if (args.length > 1 || args[0]?.startsWith("-")) throw new Error("Usage: scripts/release.sh [vVERSION]");
  if (checked("git", ["status", "--porcelain=v1", "--untracked-files=normal"])) {
    throw new Error("The working tree must be clean before automatically preparing a release.");
  }
  let commit = checked("git", ["rev-parse", "--verify", "HEAD"]);
  if (!/^[a-f0-9]{40,64}$/.test(commit)) throw new Error("Cannot resolve the release commit.");
  assertMainCheckout(commit);
  const version = committedVersion(commit);
  const parts = versionPattern.exec(version);
  // npm patch promotes an existing prerelease without incrementing its patch.
  const nextVersion = `${parts[1]}.${parts[2]}.${BigInt(parts[3]) + (parts[4] ? 0n : 1n)}`;
  const requested = args.length > 0 ? args[0].replace(/^v/, "") : undefined;
  if (requested !== undefined && requested !== version
    && (!versionPattern.test(requested) || compareVersions(requested, version) <= 0)) {
    throw new Error(`Expected a valid version greater than ${version}, or current ${version} for an explicit retry.`);
  }
  const shouldBump = requested !== version;
  const targetVersion = requested ?? nextVersion;
  tag = `v${targetVersion}`;
  checked("git", ["check-ref-format", `refs/tags/${tag}`]);
  const fetchUrl = checked("git", ["remote", "get-url", "origin"]);
  const pushUrl = checked("git", ["remote", "get-url", "--push", "--all", "origin"]);
  if (fetchUrl !== pushUrl || pushUrl.includes("\n")) {
    throw new Error("origin must have one matching fetch/push destination.");
  }
  const repo = json(checked("gh", [
    "repo", "view", pushUrl, "--json", "nameWithOwner,url,defaultBranchRef",
  ]), "GitHub repository");
  if (typeof repo.nameWithOwner !== "string" || !/^[\w.-]+\/[\w.-]+$/.test(repo.nameWithOwner)
    || typeof repo.url !== "string") throw new Error("Cannot resolve the GitHub release repository.");
  repository = repo.nameWithOwner;
  hostname = new URL(repo.url).hostname;
  const branch = object(repo.defaultBranchRef, "default branch").name;
  if (branch !== "main") throw new Error("This release workflow requires the main branch.");
  checked("git", ["fetch", "--no-tags", "--quiet", "origin", "refs/heads/main"]);
  const mainCommit = checked("git", ["rev-parse", "--verify", "FETCH_HEAD"]);
  if (!/^[a-f0-9]{40,64}$/.test(mainCommit)) throw new Error("Cannot resolve the fetched main commit.");
  if (commit !== mainCommit) {
    throw new Error("Local main must match origin/main exactly. Update it with a fast-forward before releasing.");
  }
  const local = command("git", ["show-ref", "--verify", "--quiet", `refs/tags/${tag}`]);
  if (local.status === 0 || remoteOid()) throw new Error(`Tag ${tag} already exists; no refs were changed.`);
  if (local.status !== 1) throw new Error("Cannot verify whether the local tag exists.");
  const existingRelease = command("gh", [
    "api", "--hostname", hostname, `repos/${repository}/releases/tags/${encodeURIComponent(tag)}`,
  ]);
  if (existingRelease.status === 0) throw new Error(`GitHub release ${tag} already exists; no refs were changed.`);
  if (!/\bHTTP 404\b/.test(existingRelease.stderr)) {
    throw new Error(`Cannot check for an existing release: ${existingRelease.stderr}`);
  }
  const workflow = api(`repos/${repository}/actions/workflows/release.yml`);
  if (workflow.state !== "active" || workflow.path !== workflowPath || !Number.isSafeInteger(workflow.id)) {
    throw new Error("The release workflow must be active before creating a tag.");
  }
  const endpoint = `repos/${repository}/actions/workflows/${workflow.id}/runs`
    + `?event=push&branch=${encodeURIComponent(tag)}&per_page=100`;
  const before = api(endpoint).workflow_runs;
  if (!Array.isArray(before)) throw new Error("Cannot read existing release workflow runs.");
  const oldRuns = new Set(before.map((run) => object(run, "workflow run").id));
  if (checked("git", ["rev-parse", "--verify", "HEAD"]) !== commit
    || checked("git", ["status", "--porcelain=v1", "--untracked-files=normal"])) {
    throw new Error("The release commit or worktree changed during preflight; no tag was created.");
  }
  if (shouldBump) commit = await prepareVersion(commit, version, targetVersion, requested);
  else log(`Retrying committed version ${version} without another bump or main push.`);
  assertMainCheckout(commit);
  checked("git", ["-c", "tag.gpgSign=false", "tag", "--annotate",
    "--message", `2D&D release ${tag}`, tag, commit]);
  created = true;
  mayRollback = true;
  tagOid = checked("git", ["rev-parse", "--verify", `refs/tags/${tag}`]);
  if (!/^[a-f0-9]{40,64}$/.test(tagOid)) throw new Error("Cannot verify the newly created tag object.");
  log(`Created ${tag} at ${commit}.`);
  mayRollback = false;
  const push = command("git", ["push", "origin", `refs/tags/${tag}:refs/tags/${tag}`]);
  const pushedOid = remoteOid();
  if (!pushedOid) {
    mayRollback = true;
    throw new Error(`Tag push failed: ${push.stderr || "remote tag is absent"}`);
  }
  if (pushedOid !== tagOid) throw new Error("Remote tag does not match the created tag; it will not be deleted.");
  if (push.status !== 0) report("Push reported an error, but the exact owned tag exists remotely; monitoring CI.");
  log(`Pushed tag ${tag}; waiting for ${workflowPath}.`);
  let run;
  for (let attempt = 0; attempt < 30; attempt++) {
    const runs = api(endpoint).workflow_runs;
    if (!Array.isArray(runs)) throw new Error("Cannot read release workflow runs.");
    const candidates = runs.filter((item) => !oldRuns.has(object(item, "workflow run").id));
    if (candidates.length > 1) throw new Error("Multiple new release runs found; refusing to guess or delete tags.");
    if (candidates.length === 1) {
      run = object(candidates[0], "workflow run");
      assertRun(run, commit, workflow.id);
      break;
    }
    await delay(10_000);
  }
  if (!run) throw new Error("Release CI did not appear within five minutes; tags retained for investigation.");
  runUrl = run.html_url;
  log(`Watching ${runUrl}`);
  const watcher = command("gh", ["run", "watch", String(run.id), "--repo", `${hostname}/${repository}`,
    "--exit-status", "--interval", "10"], true);
  if (watcher.status !== 0) report("CI watcher exited nonzero; checking the authoritative workflow outcome.");
  const result = api(`repos/${repository}/actions/runs/${run.id}`);
  assertRun(result, commit, workflow.id);
  if (result.status !== "completed" || typeof result.conclusion !== "string") {
    throw new Error("CI outcome is unconfirmed; tags retained because the workflow may still publish.");
  }
  if (result.conclusion !== "success") {
    mayRollback = true;
    throw new Error(`Release CI ${result.conclusion}: ${runUrl}`);
  }
  if (remoteOid() !== tagOid) throw new Error("CI passed but the tag changed; inspect the release manually.");
  log(`Release ${tag} succeeded. ${runUrl}`);
}

release().catch((error) => {
  report(error instanceof Error ? error.message : String(error));
  if (created && mayRollback) {
    if (runUrl) report("Any partially created GitHub release/assets are retained; inspect the failed workflow.");
    try {
      rollback();
    } catch (rollbackError) {
      report(`ROLLBACK INCOMPLETE: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
    }
  } else if (created) {
    report(`Tags were retained because publication status or ownership is uncertain. ${runUrl}`);
  }
  if (versionCommit) {
    report(`The version commit ${versionCommit} is retained; main history is never rolled back. Reconcile main before retrying ${tag}.`);
  } else if (versionPrepared) {
    report("Inspect the prepared version files and local HEAD before retrying; no release tag was created.");
  }
  report("Release failed. Existing releases, unrelated tags and branches were not changed.");
  process.exitCode = 1;
});
