#!/usr/bin/env node
// Template for the start-isolated-worktree skill. Copy this into your project's
// scripts/ folder and fill in setupStack()/teardownStack() with your real dev
// stack (Supabase, Docker Compose, a local DB, whatever your project uses).
// The worktree/branch/port/safety mechanics below are project-agnostic and
// should not need changes.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import net from "node:net";

const WORKTREES_DIR = ".worktrees"; // adapt to your project's convention
const DEV_PORT_BASE = 5273; // adapt: your dev server's default port range

// No shell involved — args are passed as an array, never interpolated into a
// command string, so branch/slug names can never be interpreted as shell syntax.
function run(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function tryRun(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: "utf8" });
  return { ok: result.status === 0, stdout: result.stdout?.trim() ?? "", stderr: result.stderr?.trim() ?? "" };
}

function parseArgs(argv) {
  const args = { teardown: false, deleteBranch: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--branch") args.branch = argv[++i];
    else if (a === "--name") args.name = argv[++i];
    else if (a === "--teardown") args.teardown = true;
    else if (a === "--delete-branch") args.deleteBranch = true;
  }
  if (!args.name) throw new Error("--name <slug> is required");
  return args;
}

async function findFreePort(startPort) {
  let port = startPort;
  while (await new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, "127.0.0.1");
  }) === false) {
    port++;
  }
  return port;
}

// FIXME: stub — replace with your project's real stack setup (start a DB
// container, isolate its config inside the worktree, write env files, etc.)
// — how to fix: configure a separate stack and ports for each worktree
// (unique project_id/ports per worktree, inherit maintree secrets, never
// touch the maintree's own config) for your project's actual stack.
async function setupStack({ worktreePath, devPort }) {
  console.log(`[setupStack] TODO: start your dev stack for ${worktreePath} on port ${devPort}`);
}

// FIXME: stub — replace with your project's real stack teardown (stop the DB
// container / services started by setupStack()) — how to fix: mirror
// setupStack()'s customization, just the inverse operation.
async function teardownStack({ worktreePath }) {
  console.log(`[teardownStack] TODO: stop your dev stack for ${worktreePath}`);
}

function isInsideAnyWorktree() {
  return process.cwd().includes(`/${WORKTREES_DIR}/`);
}

async function create(args) {
  if (isInsideAnyWorktree()) {
    throw new Error("Run this from the maintree, not from inside another worktree.");
  }
  const worktreePath = `${WORKTREES_DIR}/${args.name}`;
  if (existsSync(worktreePath)) {
    throw new Error(`${worktreePath} already exists — pick another --name or reuse it.`);
  }
  if (!args.branch) throw new Error("--branch <source-branch> is required to create a worktree");

  run("git", ["fetch", "origin", args.branch]);
  mkdirSync(WORKTREES_DIR, { recursive: true });
  run("git", ["worktree", "add", worktreePath, "-b", args.name, `origin/${args.branch}`]);

  const devPort = await findFreePort(DEV_PORT_BASE);
  await setupStack({ worktreePath, devPort });
  console.log(`\nWorktree ready: ${worktreePath} (branch ${args.name}, dev port ${devPort})`);
  console.log(`Next: EnterWorktree(path="${worktreePath}"), then npm run dev -- --port ${devPort} --strictPort`);
}

function hasUncommittedChanges(worktreePath, expectedIsolatedFiles) {
  const status = run("git", ["-C", worktreePath, "status", "--porcelain"]);
  return status
    .split("\n")
    .filter(Boolean)
    .map((l) => l.slice(3))
    .filter((f) => !expectedIsolatedFiles.includes(f));
}

function hasUnpushedCommits(branch) {
  const result = tryRun("git", ["rev-list", `origin/${branch}..${branch}`, "--count"]);
  if (!result.ok) return true; // no upstream at all — treat as "unpushed" to be safe
  return parseInt(result.stdout, 10) > 0;
}

function isBranchMerged(branch) {
  const prResult = tryRun("gh", ["pr", "list", "--state", "all", "--head", branch, "--json", "state", "--limit", "1"]);
  if (prResult.ok) {
    try {
      const parsed = JSON.parse(prResult.stdout);
      if (parsed[0]?.state === "MERGED") return true;
    } catch {
      // fall through to the merge-base check below
    }
  }
  const mergeBase = tryRun("git", ["merge-base", branch, "origin/main"]);
  const branchTip = tryRun("git", ["rev-parse", branch]);
  return mergeBase.ok && branchTip.ok && mergeBase.stdout === branchTip.stdout;
}

async function teardown(args) {
  const worktreePath = `${WORKTREES_DIR}/${args.name}`;
  if (!existsSync(worktreePath)) throw new Error(`${worktreePath} does not exist`);

  // FIXME: list here whatever config files setupStack() isolates inside the
  // worktree (expected to differ from the maintree, never committed) — how
  // to fix: match the files your setupStack() writes.
  const expectedIsolatedFiles = [];
  const dirty = hasUncommittedChanges(worktreePath, expectedIsolatedFiles);
  if (dirty.length > 0) {
    throw new Error(`Uncommitted changes in ${worktreePath}, refusing to tear down:\n${dirty.join("\n")}`);
  }

  if (hasUnpushedCommits(args.name)) {
    console.warn(`WARNING: branch ${args.name} has unpushed commits — it will be the only copy after teardown.`);
  }

  await teardownStack({ worktreePath });
  run("git", ["worktree", "remove", worktreePath]);
  console.log(`Removed worktree ${worktreePath}.`);

  if (args.deleteBranch) {
    if (!isBranchMerged(args.name)) {
      console.error(`Refusing --delete-branch: ${args.name} does not appear merged. Leaving it in place.`);
      return;
    }
    if (hasUnpushedCommits(args.name)) {
      console.error(`Refusing --delete-branch: ${args.name} has unpushed commits. Leaving it in place.`);
      return;
    }
    run("git", ["branch", "-d", args.name]);
    console.log(`Deleted branch ${args.name}.`);
  }
}

const args = parseArgs(process.argv.slice(2));
if (args.teardown) {
  teardown(args).catch((e) => { console.error(e.message); process.exit(1); });
} else {
  create(args).catch((e) => { console.error(e.message); process.exit(1); });
}
