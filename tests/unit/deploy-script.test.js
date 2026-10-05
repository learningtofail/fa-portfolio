// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SCRIPT = path.join(process.cwd(), "scripts/deploy-release.sh");
/** @type {string} */
let sandbox;

/** Fake `ssh` runs the remote command locally; fake `rsync` copies the last two arguments. */
function installShims(binDir) {
  writeFileSync(
    path.join(binDir, "ssh"),
    '#!/usr/bin/env bash\nwhile [[ "$1" != *@* ]]; do shift; done\nshift\nexec "$@"\n',
  );
  writeFileSync(
    path.join(binDir, "rsync"),
    '#!/usr/bin/env bash\nsrc="${@: -2:1}"; dest="${@: -1}"; dest="${dest#*:}"\nmkdir -p "$dest"\ncp -a "$src." "$dest"\n',
  );
  chmodSync(path.join(binDir, "ssh"), 0o755);
  chmodSync(path.join(binDir, "rsync"), 0o755);
}

function run(args, env = {}) {
  return spawnSync("bash", [SCRIPT, ...args], {
    encoding: "utf8",
    env: {
      PATH: `${path.join(sandbox, "bin")}:${process.env.PATH}`,
      HOME: sandbox,
      DEPLOY_HOST: "host.example",
      DEPLOY_USER: "deploy",
      DEPLOY_KNOWN_HOSTS: "host.example ssh-ed25519 AAAAFAKE",
      DEPLOY_SSH_KEY_B64: Buffer.from("fake-key").toString("base64"),
      DEPLOY_PATH: path.join(sandbox, "site"),
      DIST_DIR: path.join(sandbox, "dist"),
      KEEP_RELEASES: "3",
      ...env,
    },
  });
}

const site = (...p) => path.join(sandbox, "site", ...p);
const currentId = () => path.basename(readlinkSync(site("current")));

beforeEach(() => {
  sandbox = mkdtempSync(path.join(tmpdir(), "deploy-test-"));
  mkdirSync(path.join(sandbox, "bin"));
  installShims(path.join(sandbox, "bin"));
  mkdirSync(path.join(sandbox, "dist"));
  writeFileSync(path.join(sandbox, "dist/index.html"), "<h1>new</h1>");
  // The host migration: releases/ plus a current symlink.
  mkdirSync(site("releases/20250101000000-seed"), { recursive: true });
  writeFileSync(site("releases/20250101000000-seed/index.html"), "seed");
  execFileSync("ln", ["-s", "releases/20250101000000-seed", site("current")]);
});
afterEach(() => rmSync(sandbox, { recursive: true, force: true }));

describe("deploy-release.sh guards", () => {
  it("fails fast with a clear message when the SSH_KNOWN_HOSTS value is empty", () => {
    const r = run([], { DEPLOY_KNOWN_HOSTS: "", RELEASE_ID: "20250102000000-r1" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/DEPLOY_KNOWN_HOSTS is empty.*SSH_KNOWN_HOSTS secret/);
  });

  it("refuses to deploy an empty or missing dist before touching the host", () => {
    writeFileSync(path.join(sandbox, "dist/index.html"), "");
    const r = run([], { RELEASE_ID: "20250102000000-r1" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/missing or empty; refusing to deploy/);
    expect(currentId()).toBe("20250101000000-seed");
    expect(existsSync(site("releases/20250102000000-r1"))).toBe(false);
  });

  it("rejects unsafe release ids and paths", () => {
    expect(run([], { RELEASE_ID: "a b; rm -rf /" }).status).not.toBe(0);
    expect(run([], { RELEASE_ID: "20250102000000-r1", DEPLOY_PATH: "relative/path" }).status).not.toBe(0);
    expect(run([], { RELEASE_ID: "20250102000000-r1", KEEP_RELEASES: "0" }).status).not.toBe(0);
  });

  it("refuses to deploy to a host that is not migrated yet", () => {
    rmSync(site("current"));
    const r = run([], { RELEASE_ID: "20250102000000-r1" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/not a symlink.*migration/);
  });

  it("dry run prints the plan and changes nothing", () => {
    const r = run(["--dry-run"], { RELEASE_ID: "20250102000000-r1" });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/DRY RUN: ssh .*prepare/);
    expect(r.stdout).toMatch(/DRY RUN: rsync/);
    expect(r.stdout).toMatch(/DRY RUN: ssh .*switch/);
    expect(currentId()).toBe("20250101000000-seed");
    expect(existsSync(site("releases/20250102000000-r1"))).toBe(false);
  });
});

describe("deploy-release.sh releases", () => {
  it("copies dist into releases/<id> and switches current to it", () => {
    const r = run([], { RELEASE_ID: "20250102000000-r1" });
    expect(r.status).toBe(0);
    expect(readFileSync(site("releases/20250102000000-r1/index.html"), "utf8")).toBe("<h1>new</h1>");
    expect(currentId()).toBe("20250102000000-r1");
    // The previous release is still on disk, ready for a rollback.
    expect(existsSync(site("releases/20250101000000-seed/index.html"))).toBe(true);
  });

  it("keeps only the newest KEEP_RELEASES releases and never prunes the live one", () => {
    for (const n of [2, 3, 4, 5]) {
      expect(run([], { RELEASE_ID: `2025010${n}000000-r${n}` }).status).toBe(0);
    }
    expect(readReleases()).toEqual(["20250103000000-r3", "20250104000000-r4", "20250105000000-r5"]);
    expect(currentId()).toBe("20250105000000-r5");
  });

  it("never deletes releases while rolling back", () => {
    for (const n of [2, 3, 4]) expect(run([], { RELEASE_ID: `2025010${n}000000-r${n}` }).status).toBe(0);
    const before = readReleases();
    expect(run(["rollback"]).status).toBe(0);
    expect(readReleases()).toEqual(before);
  });

  it("rolls back one release at a time, or to a named one", () => {
    expect(run([], { RELEASE_ID: "20250102000000-r2" }).status).toBe(0);
    expect(run([], { RELEASE_ID: "20250103000000-r3" }).status).toBe(0);
    expect(run(["rollback"]).status).toBe(0);
    expect(currentId()).toBe("20250102000000-r2");
    expect(run(["rollback"]).status).toBe(0);
    expect(currentId()).toBe("20250101000000-seed");
    const none = run(["rollback"]);
    expect(none.status).not.toBe(0);
    expect(none.stderr).toMatch(/no release older than/);
    expect(run(["rollback", "20250103000000-r3"]).status).toBe(0);
    expect(currentId()).toBe("20250103000000-r3");
  });

  it("will not switch to a release that has no index.html", () => {
    mkdirSync(site("releases/broken"));
    const r = run(["rollback", "broken"]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/index.html is missing or empty/);
    expect(currentId()).toBe("20250101000000-seed");
  });
});

function readReleases() {
  return execFileSync("ls", ["-1", site("releases")], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}
