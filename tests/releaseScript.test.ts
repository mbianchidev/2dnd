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
}

interface MockState {
  local: string;
  remote: string;
  watched?: string;
  afterWatch?: boolean;
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
const commit = "a".repeat(40);
const oid = "b".repeat(40);
const tag = "v1.2.3";
function finish(code = 0, value = "", error = "") {
  fs.writeFileSync(statePath, JSON.stringify(state));
  if (value) process.stdout.write(typeof value === "string" ? value : JSON.stringify(value));
  if (error) process.stderr.write(error);
  process.exit(code);
}
function run(id = 99) {
  return { id, workflow_id: 77, event: "push", head_sha: config.wrongRun ? "f".repeat(40) : commit, head_branch: tag,
    html_url: "https://github.com/fixtureOwner/fixtureGame/actions/runs/" + id };
}
if (binary === "git") {
  if (args[0] === "check-ref-format") finish();
  if (args[0] === "status") finish(0, config.dirty ? " M package.json" : "");
  if (args[0] === "remote") finish(0, "https://github.com/fixtureOwner/fixtureGame.git");
  if (args[0] === "fetch") finish();
  if (args[0] === "merge-base") finish(config.notOnMain ? 1 : 0);
  if (args[0] === "show-ref") finish(state.local ? 0 : 1);
  if (args[0] === "rev-parse") {
    if (args[args.length - 1] === "HEAD") finish(0, config.changedHead && state.preflight ? "f".repeat(40) : commit);
    if (args[args.length - 1] === "FETCH_HEAD") finish(0, commit);
    finish(state.local ? 0 : 1, state.local);
  }
  if (args[0] === "show") finish(0, fs.readFileSync(path.join(process.cwd(),
    args[1].endsWith(":package-lock.json") ? "package-lock.json" : "package.json"), "utf8"));
  if (args[0] === "ls-remote") finish(0, state.remote ? state.remote + "\\trefs/tags/" + tag : "");
  if (args[0] === "-c" && args.includes("--annotate")) { state.local = oid; finish(); }
  if (args[0] === "push" && args.includes("--delete")) {
    if (config.rollbackFailure) finish(1, "", "mock remote deletion denied");
    state.remote = ""; finish();
  }
  if (args[0] === "push") {
    if (config.pushFailure !== "before") state.remote = oid;
    finish(config.pushFailure ? 1 : 0, "", config.pushFailure ? "mock push connection lost" : "");
  }
  if (args[0] === "update-ref") {
    if (state.local !== args[args.length - 1]) finish(1, "", "mock local ownership changed");
    state.local = ""; finish();
  }
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
    if (config.existingRelease) finish(0, {tag_name: tag});
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

async function invoke(scenario: Scenario = {}, args: string[] = []): Promise<{
  code: number | null; stdout: string; stderr: string; state: MockState;
}> {
  const root = await mkdtemp(join(tmpdir(), "2dnd-release-"));
  directories.push(root);
  await Promise.all([
    mkdir(join(root, "scripts")), mkdir(join(root, "hacks")), mkdir(join(root, "bin")),
  ]);
  await Promise.all([
    cp("scripts/release.sh", join(root, "scripts/release.sh")),
    cp("hacks/release.mjs", join(root, "hacks/release.mjs")),
    writeFile(join(root, "package.json"), JSON.stringify({ version: "1.2.3" })),
    writeFile(join(root, "package-lock.json"), JSON.stringify({
      version: scenario.badLock ? "1.2.2" : "1.2.3", packages: { "": { version: "1.2.3" } },
    })),
    writeFile(join(root, "bin/git"), mockCommand, { mode: 0o755 }),
    writeFile(join(root, "bin/gh"), mockCommand, { mode: 0o755 }),
    writeFile(join(root, "config.json"), JSON.stringify(scenario)),
    writeFile(join(root, "state.json"), JSON.stringify({
      local: scenario.existingLocal ? "d".repeat(40) : "",
      remote: scenario.existingRemote ? "e".repeat(40) : "",
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
  return { code: result.status, stdout: result.stdout, stderr: result.stderr, state };
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe.skipIf(process.platform === "win32")("release entry point with fully mocked Git and GitHub", () => {
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
    const result = await invoke(scenario);
    expect(result.code).toBe(1);
    expect(result.state.calls.some((call) =>
      call.binary === "git" && ["push", "-c", "update-ref"].includes(call.args[0])
    )).toBe(false);
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
