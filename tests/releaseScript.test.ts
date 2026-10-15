import { spawnSync } from "node:child_process";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

interface Scenario {
  dirty?: boolean;
  existingLocal?: boolean;
  existingRemote?: boolean;
  existingRelease?: boolean;
  deniedReleaseLookup?: boolean;
  disabledWorkflow?: boolean;
  notOnMain?: boolean;
  oldRun?: boolean;
  outcome?: string;
  pushFailure?: "before" | "after";
  changedRemote?: boolean;
  rollbackFailure?: boolean;
  monitoringFailure?: boolean;
  changedHead?: boolean;
  wrongRun?: boolean;
  badLock?: boolean;
  featureBranch?: boolean;
  npmFailure?: boolean;
  badBump?: boolean;
  unexpectedChange?: boolean;
  commitFailure?: boolean;
  mainPushFailure?: boolean;
  mainPushLostAck?: boolean;
  unexpectedCommitChange?: boolean;
  untrackedChange?: boolean;
  missingVersionReference?: boolean;
}

interface MockState {
  local: string;
  remote: string;
  watched?: string;
  afterWatch?: boolean;
  head: string;
  main: string;
  tag: string;
  versionCommit?: string;
  calls: Array<{ binary: string; args: string[] }>;
}

const directories: string[] = [];
const mockCommand = `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const binary = path.basename(process.argv[1]);
const args = process.argv.slice(2);
const config = JSON.parse(fs.readFileSync(process.env.RELEASE_MOCK_CONFIG, "utf8"));
const statePath = process.env.RELEASE_MOCK_STATE;
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
state.calls.push({binary, args});
const originalCommit = "a".repeat(40);
const versionCommit = "9".repeat(40);
const oid = "b".repeat(40);
const versionFiles = ["package.json", "package-lock.json", "README.md", "AGENTS.md"];
function finish(code = 0, value = "", error = "") {
  fs.writeFileSync(statePath, JSON.stringify(state));
  if (value) process.stdout.write(typeof value === "string" ? value : JSON.stringify(value));
  if (error) process.stderr.write(error);
  process.exit(code);
}
function run(id = 99) {
  return { id, workflow_id: 77, event: "push", head_sha: config.wrongRun ? "f".repeat(40) : state.head, head_branch: state.tag,
    html_url: "https://github.com/fixtureOwner/fixtureGame/actions/runs/" + id };
}
if (binary === "git") {
  if (args[0] === "check-ref-format") { state.tag = args[1].replace("refs/tags/", ""); finish(); }
  if (args[0] === "symbolic-ref") finish(0, config.featureBranch ? "feature" : "main");
  if (args[0] === "status") finish(0, config.dirty ? " M package.json" :
    state.bumped && !state.versionCommit ? " M package.json\\n M package-lock.json" : "");
  if (args[0] === "remote") finish(0, "https://github.com/fixtureOwner/fixtureGame.git");
  if (args[0] === "fetch") finish();
  if (args[0] === "merge-base") finish(config.notOnMain ? 1 : 0);
  if (args[0] === "show-ref") finish(state.local ? 0 : 1);
  if (args[0] === "rev-parse") {
    if (args[args.length - 1] === "HEAD") finish(0, config.changedHead && state.preflight ? "f".repeat(40) : state.head);
    if (args[args.length - 1] === "HEAD^") finish(0, originalCommit);
    if (args[args.length - 1] === "FETCH_HEAD") finish(0, config.notOnMain ? "f".repeat(40) : state.main);
    finish(state.local ? 0 : 1, state.local);
  }
  if (args[0] === "show") {
    const [sha, file] = args[1].split(":");
    finish(0, sha === originalCommit ? state.originalFiles[file] :
      fs.readFileSync(path.join(process.cwd(), file), "utf8"));
  }
  if (args[0] === "diff") finish(0, (args.includes(originalCommit) && args.includes(versionCommit)
    ? [...versionFiles, ...(config.unexpectedCommitChange ? ["unrelated.txt"] : [])] :
    args.includes("--cached") ? state.staged :
    state.bumped && !state.versionCommit && state.staged.length === 0
      ? [...versionFiles, ...(config.unexpectedChange ? ["unrelated.txt"] : [])] : []).join("\\n"));
  if (args[0] === "ls-files") finish(0, config.untrackedChange ? "unrelated.txt" : "");
  if (args[0] === "add") { state.staged = args.slice(2); finish(); }
  if (args[0] === "commit") {
    if (config.commitFailure) finish(1, "", "mock commit hook failed");
    state.versionCommit = versionCommit; state.head = versionCommit; state.staged = []; finish();
  }
  if (args[0] === "ls-remote") {
    if (args[args.length - 1] === "refs/heads/main") finish(0, state.main + "\\trefs/heads/main");
    finish(0, state.remote ? state.remote + "\\trefs/tags/" + state.tag : "");
  }
  if (args[0] === "-c" && args.includes("--annotate")) { state.local = oid; finish(); }
  if (args[0] === "push" && args.includes("--delete")) {
    if (config.rollbackFailure) finish(1, "", "mock remote deletion denied");
    state.remote = ""; finish();
  }
  if (args[0] === "push") {
    if (args.some(arg => arg.endsWith(":refs/heads/main"))) {
      if (!config.mainPushFailure) state.main = state.head;
      finish(config.mainPushFailure || config.mainPushLostAck ? 1 : 0, "",
        config.mainPushFailure || config.mainPushLostAck ? "mock main push failed" : "");
    }
    if (config.pushFailure !== "before") state.remote = oid;
    finish(config.pushFailure ? 1 : 0, "", config.pushFailure ? "mock push connection lost" : "");
  }
  if (args[0] === "update-ref") {
    if (state.local !== args[args.length - 1]) finish(1, "", "mock local ownership changed");
    state.local = ""; finish();
  }
}
if (binary === "npm" && args[0] === "version") {
  if (config.npmFailure) finish(1, "", "mock npm version failed");
  state.bumped = true;
  for (const file of ["package.json", "package-lock.json"]) {
    const filePath = path.join(process.cwd(), file);
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    data.version = config.badBump ? "7.7.7" : "1.2.4";
    if (file === "package-lock.json") data.packages[""].version = data.version;
    fs.writeFileSync(filePath, JSON.stringify(data));
  }
  finish(0, "v1.2.4");
}
if (binary === "gh") {
  if (args[0] === "repo") finish(0, {
    nameWithOwner: "fixtureOwner/fixtureGame", url: "https://github.com/fixtureOwner/fixtureGame",
    defaultBranchRef: { name: "main" }
  });
  if (args[0] === "run" && args[1] === "watch") {
    state.watched = args[2]; state.afterWatch = true;
    if (config.changedRemote) state.remote = "c".repeat(40);
    finish(config.outcome && config.outcome !== "success" ? 1 : 0);
  }
  const endpoint = args[args.length - 1];
  if (endpoint.includes("/releases/tags/")) {
    if (config.existingRelease) finish(0, {tag_name: state.tag});
    if (config.deniedReleaseLookup) finish(1, "", "gh: forbidden (HTTP 403)");
    finish(1, "", "gh: Not Found (HTTP 404)");
  }
  if (endpoint.endsWith("/workflows/release.yml")) finish(0, {
    id: 77, state: config.disabledWorkflow ? "disabled_manually" : "active",
    path: ".github/workflows/release.yml"
  });
  if (endpoint.includes("/workflows/77/runs?")) {
    if (config.monitoringFailure && state.remote) finish(1, "", "mock GitHub unavailable");
    const runs = config.oldRun ? [run(42)] : [];
    if (state.remote) runs.unshift(run());
    state.preflight = true;
    finish(0, {workflow_runs: runs});
  }
  if (endpoint.endsWith("/actions/runs/99")) finish(0, {
    ...run(), status: config.outcome === "unconfirmed" ? "in_progress" : "completed",
    conclusion: config.outcome === "unconfirmed" ? null : config.outcome || "success"
  });
}
finish(2, "", "Unexpected mock command: " + binary + " " + args.join(" "));
`;

async function invoke(scenario: Scenario = {}, args: string[] = ["v1.2.3"]): Promise<{
  code: number | null; stdout: string; stderr: string; state: MockState;
  files: { manifest: { version: string }; lock: { version: string; packages: Record<string, { version: string }> };
    readme: string; agents: string };
}> {
  const root = await mkdtemp(join(tmpdir(), "2dnd-release-"));
  directories.push(root);
  const originalFiles = {
    "package.json": JSON.stringify({ version: "1.2.3" }),
    "package-lock.json": JSON.stringify({
      version: scenario.badLock ? "1.2.2" : "1.2.3", packages: { "": { version: "1.2.3" } },
    }),
    "README.md": scenario.missingVersionReference ? "Missing release reference\n" : "Current release: **v1.2.3**\n",
    "AGENTS.md": "| Product | Browser/Electron JRPG, release v1.2.3 |\n",
  };
  await Promise.all([
    mkdir(join(root, "scripts")), mkdir(join(root, "hacks")), mkdir(join(root, "bin")),
  ]);
  await Promise.all([
    cp("scripts/release.sh", join(root, "scripts/release.sh")),
    cp("hacks/release.mjs", join(root, "hacks/release.mjs")),
    ...Object.entries(originalFiles).map(([name, content]) => writeFile(join(root, name), content)),
    writeFile(join(root, "bin/git"), mockCommand, { mode: 0o755 }),
    writeFile(join(root, "bin/gh"), mockCommand, { mode: 0o755 }),
    writeFile(join(root, "bin/npm"), mockCommand, { mode: 0o755 }),
    writeFile(join(root, "config.json"), JSON.stringify(scenario)),
    writeFile(join(root, "state.json"), JSON.stringify({
      local: scenario.existingLocal ? "d".repeat(40) : "",
      remote: scenario.existingRemote ? "e".repeat(40) : "",
      head: "a".repeat(40), main: "a".repeat(40), tag: "v1.2.3",
      staged: [], originalFiles,
      calls: [],
    })),
  ]);
  const result = spawnSync("bash", [join(root, "scripts/release.sh"), ...args], {
    cwd: tmpdir(), encoding: "utf8", timeout: 25_000,
    env: {
      ...process.env,
      PATH: `${join(root, "bin")}:${process.env.PATH}`,
      RELEASE_MOCK_CONFIG: join(root, "config.json"),
      RELEASE_MOCK_STATE: join(root, "state.json"),
    },
  });
  if (result.error) throw result.error;
  const state = JSON.parse(await readFile(join(root, "state.json"), "utf8")) as MockState;
  return {
    code: result.status, stdout: result.stdout, stderr: result.stderr, state,
    files: {
      manifest: JSON.parse(await readFile(join(root, "package.json"), "utf8")),
      lock: JSON.parse(await readFile(join(root, "package-lock.json"), "utf8")),
      readme: await readFile(join(root, "README.md"), "utf8"),
      agents: await readFile(join(root, "AGENTS.md"), "utf8"),
    },
  };
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe.skipIf(process.platform === "win32")("release entry point with fully mocked Git and GitHub", () => {
  it("defaults to npm patch, synchronizes versions, commits/pushes main before tagging that exact commit", async () => {
    const result = await invoke({}, []);
    expect(result.code, result.stderr).toBe(0);
    expect(result.files.manifest.version).toBe("1.2.4");
    expect(result.files.lock.version).toBe("1.2.4");
    expect(result.files.lock.packages[""].version).toBe("1.2.4");
    expect(result.files.readme).toContain("Current release: **v1.2.4**");
    expect(result.files.agents).toContain("release v1.2.4");
    expect(result.state.main).toBe("9".repeat(40));
    expect(result.state.tag).toBe("v1.2.4");
    expect(result.state.calls).toContainEqual({
      binary: "npm", args: ["version", "patch", "--no-git-tag-version"],
    });
    const pushes = result.state.calls.filter((call) => call.binary === "git" && call.args[0] === "push");
    expect(pushes).toEqual([
      { binary: "git", args: ["push", "origin", `${"9".repeat(40)}:refs/heads/main`] },
      { binary: "git", args: ["push", "origin", "refs/tags/v1.2.4:refs/tags/v1.2.4"] },
    ]);
    const commit = result.state.calls.find((call) => call.binary === "git" && call.args[0] === "commit");
    expect(commit?.args).toContain("--no-gpg-sign");
    expect(commit?.args.join(" ")).not.toMatch(/copilot|co-authored|agent/i);
    expect(result.state.calls.find((call) => call.args.includes("--annotate"))?.args.slice(-1)).toEqual(["9".repeat(40)]);
  }, 30_000);

  it("accepts an explicit next patch version as the same automatic workflow", async () => {
    const result = await invoke({}, ["v1.2.4"]);
    expect(result.code, result.stderr).toBe(0);
    expect(result.state.versionCommit).toBe("9".repeat(40));
  }, 30_000);

  it.each<Scenario>([
    { npmFailure: true }, { badBump: true }, { unexpectedChange: true },
    { commitFailure: true }, { mainPushFailure: true }, { untrackedChange: true },
    { unexpectedCommitChange: true },
  ])("does not create or push a tag when the automatic version step fails: %j", async (scenario) => {
    const result = await invoke(scenario, []);
    expect(result.code).toBe(1);
    expect(result.state.local).toBe("");
    expect(result.state.remote).toBe("");
    expect(result.state.calls.some((call) => call.args.includes("--annotate"))).toBe(false);
    if (!scenario.mainPushFailure) {
      expect(result.state.calls.some((call) => call.args[0] === "push")).toBe(false);
    }
  }, 30_000);

  it("confirms a lost main-push acknowledgement before tagging the new version commit", async () => {
    const result = await invoke({ mainPushLostAck: true }, []);
    expect(result.code, result.stderr).toBe(0);
    expect(result.state.main).toBe(result.state.versionCommit);
    expect(result.state.watched).toBe("99");
    expect(result.stderr).toContain("exact version commit is confirmed remotely");
  }, 30_000);

  it("leaves package metadata unchanged if a release reference cannot be updated safely", async () => {
    const result = await invoke({ missingVersionReference: true }, []);
    expect(result.code).toBe(1);
    expect(result.files.manifest.version).toBe("1.2.3");
    expect(result.state.calls.some((call) => call.binary === "npm")).toBe(false);
  }, 30_000);

  it("keeps the pushed version commit and rolls back only the release tags after failed CI", async () => {
    const result = await invoke({ outcome: "failure" }, []);
    expect(result.code).toBe(1);
    expect(result.state.local).toBe("");
    expect(result.state.remote).toBe("");
    expect(result.state.main).toBe("9".repeat(40));
    expect(result.stderr).toContain("version commit");
  }, 30_000);

  it("rejects a feature checkout before changing version files", async () => {
    const result = await invoke({ featureBranch: true }, []);
    expect(result.code).toBe(1);
    expect(result.state.calls.some((call) => call.binary === "npm")).toBe(false);
  }, 30_000);

  it("tags the committed version, pushes only that tag and watches the exact new release run", async () => {
    const result = await invoke({ oldRun: true }, ["1.2.3"]);
    expect(result.code, result.stderr).toBe(0);
    expect(result.state.local).toBe("b".repeat(40));
    expect(result.state.remote).toBe(result.state.local);
    expect(result.state.watched).toBe("99");
    expect(result.stdout).toContain("Release v1.2.3 succeeded");
    const push = result.state.calls.filter((call) => call.binary === "git" && call.args[0] === "push");
    expect(push).toEqual([{ binary: "git", args: ["push", "origin", "refs/tags/v1.2.3:refs/tags/v1.2.3"] }]);
    expect(result.state.calls.some((call) => call.args.includes("tag.gpgSign=false"))).toBe(true);
    expect(result.state.calls.some((call) => call.binary === "npm" || call.args[0] === "commit")).toBe(false);
  }, 30_000);

  it.each(["failure", "cancelled", "timed_out", "action_required"])(
    "removes owned local and remote tags and fails when CI concludes %s",
    async (outcome) => {
      const result = await invoke({ outcome });
      expect(result.code).toBe(1);
      expect(result.state.local).toBe("");
      expect(result.state.remote).toBe("");
      expect(result.stderr).toContain(`Release CI ${outcome}`);
      expect(result.stdout).toContain("Rolled back remote tag");
      expect(result.stdout).toContain("Rolled back local tag");
      expect(result.state.calls).toContainEqual({
        binary: "git", args: ["push", "origin", "--delete", "refs/tags/v1.2.3"],
      });
    }, 30_000,
  );

  it.each<Scenario>([
    { dirty: true }, { existingLocal: true }, { existingRemote: true },
    { existingRelease: true }, { deniedReleaseLookup: true },
    { disabledWorkflow: true }, { notOnMain: true },
    { changedHead: true }, { badLock: true },
  ])("does not mutate any ref when preflight rejects %j", async (scenario) => {
    const result = await invoke(scenario, []);
    expect(result.code).toBe(1);
    expect(result.state.calls.some((call) =>
      call.binary === "git" && ["push", "-c", "update-ref"].includes(call.args[0])
    )).toBe(false);
    expect(result.state.calls.some((call) => call.binary === "npm")).toBe(false);
  }, 30_000);

  it("rolls back only the local tag if the push never reached the remote", async () => {
    const result = await invoke({ pushFailure: "before" });
    expect(result.code).toBe(1);
    expect(result.state.local).toBe("");
    expect(result.state.remote).toBe("");
    expect(result.state.calls.some((call) => call.args.includes("--delete"))).toBe(false);
  }, 30_000);

  it("monitors a confirmed remote push even when the client lost its acknowledgement", async () => {
    const result = await invoke({ pushFailure: "after" });
    expect(result.code).toBe(0);
    expect(result.state.watched).toBe("99");
    expect(result.stderr).toContain("exact owned tag exists remotely");
  }, 30_000);

  it.each<Scenario>([{ outcome: "unconfirmed" }, { monitoringFailure: true }, { wrongRun: true }])(
    "retains both tags when monitoring cannot prove CI failure: %j", async (scenario) => {
      const result = await invoke(scenario);
      expect(result.code).toBe(1);
      expect(result.state.local).toBe("b".repeat(40));
      expect(result.state.remote).toBe(result.state.local);
      expect(result.stderr).toContain("Tags were retained");
    }, 30_000,
  );

  it("never deletes a replacement remote tag", async () => {
    const result = await invoke({ outcome: "failure", changedRemote: true });
    expect(result.code).toBe(1);
    expect(result.state.remote).toBe("c".repeat(40));
    expect(result.state.local).toBe("b".repeat(40));
    expect(result.stderr).toContain("ROLLBACK INCOMPLETE");
    expect(result.state.calls.some((call) => call.args.includes("--delete"))).toBe(false);
  }, 30_000);

  it("retains the local receipt and reports a failed remote rollback", async () => {
    const result = await invoke({ outcome: "failure", rollbackFailure: true });
    expect(result.code).toBe(1);
    expect(result.state.local).toBe("b".repeat(40));
    expect(result.state.remote).toBe(result.state.local);
    expect(result.stderr).toContain("ROLLBACK INCOMPLETE");
    expect(result.state.calls.some((call) => call.args[0] === "update-ref")).toBe(false);
  }, 30_000);

  it("shows help without contacting Git/GitHub, and rejects a mismatched version", async () => {
    const help = await invoke({}, ["--help"]);
    expect(help.code).toBe(0);
    expect(help.state.calls).toHaveLength(0);
    const mismatch = await invoke({}, ["v9.9.9"]);
    expect(mismatch.code).toBe(1);
    expect(mismatch.state.calls.some((call) => ["push", "-c", "update-ref"].includes(call.args[0]))).toBe(false);
  }, 30_000);
});
