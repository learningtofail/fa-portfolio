// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";

const raw = readFileSync(path.join(process.cwd(), ".github/workflows/ci.yml"), "utf8");
const workflow = parse(raw);
const deploy = workflow.jobs.deploy;
const steps = (job) => workflow.jobs[job].steps;

describe("ci.yml delivery rules (Phase 5)", () => {
  it("builds once and every later job needs it", () => {
    const builds = Object.entries(workflow.jobs).filter(([, job]) => job.steps?.some((s) => s.run === "npm run build"));
    expect(builds.map(([name]) => name)).toEqual(["build"]);
    expect(workflow.jobs.e2e.needs).toBe("build");
    expect(deploy.needs).toEqual(expect.arrayContaining(["static", "unit", "build", "e2e", "audit"]));
  });

  it("deploys only from main, in the production environment, with least privilege", () => {
    expect(deploy.if).toContain("refs/heads/main");
    expect(deploy.environment).toBe("production");
    expect(deploy.permissions).toEqual({ contents: "read" });
    expect(workflow.permissions).toEqual({ contents: "read" });
  });

  it("queues deploys instead of cancelling them", () => {
    expect(deploy.concurrency.group).toBe("deploy-production");
    expect(deploy.concurrency["cancel-in-progress"]).toBe(false);
  });

  it("downloads the artifact instead of rebuilding", () => {
    expect(steps("deploy").some((s) => s.uses?.startsWith("actions/download-artifact"))).toBe(true);
    expect(steps("deploy").some((s) => /npm (ci|run build)/.test(s.run || ""))).toBe(false);
  });

  it("pins the Tailscale action by full commit SHA", () => {
    const ts = steps("deploy").find((s) => s.uses?.startsWith("tailscale/github-action"));
    expect(ts.uses).toMatch(/^tailscale\/github-action@[0-9a-f]{40}$/);
  });

  it("never interpolates secrets into a shell script", () => {
    for (const job of Object.values(workflow.jobs)) {
      for (const step of job.steps) expect(step.run ?? "").not.toMatch(/\$\{\{\s*secrets\./);
    }
  });

  it("passes secrets through env and checks the pinned host key first, with no ssh-keyscan", () => {
    expect(raw).not.toMatch(/ssh-keyscan\s+-/);
    const guard = steps("deploy")[0];
    expect(guard.env.SSH_KNOWN_HOSTS).toContain("secrets.SSH_KNOWN_HOSTS");
    expect(guard.run).toMatch(/SSH_KNOWN_HOSTS is empty/);
    const run = steps("deploy").find((s) => s.run?.includes("deploy-release.sh"));
    expect(run.env.DEPLOY_KNOWN_HOSTS).toContain("secrets.SSH_KNOWN_HOSTS");
  });

  it("keeps the audit gate blocking and tokens:check strict in CI", () => {
    expect(JSON.stringify(workflow.jobs.audit)).not.toContain("continue-on-error");
    const tokens = steps("static").find((s) => s.run === "npm run tokens:check");
    expect(tokens.env.TOKENS_CHECK_REQUIRE_NETWORK).toBe("1");
  });

  it("names no secret values or hostnames", () => {
    expect(raw).not.toMatch(/faysalahmed|jrflab|\.ts\.net|100\.\d+\.\d+\.\d+/);
  });
});
