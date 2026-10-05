import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";

// The vendored marketing tools run under the policy the host serves for /marketing/*
// (docs/caddy/Caddyfile.proposed.md), ENFORCED here, inside a frame with the flags www gives it.
const doc = readFileSync(new URL("../../docs/caddy/Caddyfile.proposed.md", import.meta.url), "utf8");
const POLICY = /handle \/marketing\/\*[\s\S]*?Content-Security-Policy "([^"]+)"/.exec(doc)?.[1] ?? "";
const FILES = readdirSync(new URL("../../public/marketing/", import.meta.url)).filter((f) => f.endsWith(".html"));
const SANDBOX = "allow-scripts allow-same-origin allow-downloads allow-modals";

/**
 * Serves /marketing pages with the host policy. `embedder` stands in for www in the frame test, since the real
 * `frame-ancestors` names a host this test server is not.
 * @param {import("@playwright/test").Page} page
 * @param {string} [embedder]
 */
async function enforce(page, embedder) {
  const policy = embedder ? POLICY.replace("https://www.faysalahmed.ca", embedder) : POLICY;
  await page.route("**/marketing/*.html", async (route) => {
    const response = await route.fetch();
    return route.fulfill({ response, headers: { ...response.headers(), "content-security-policy": policy } });
  });
}

test("the marketing policy blocks every network path and allows only www to embed", () => {
  expect(POLICY).toContain("default-src 'none'");
  expect(POLICY).toContain("connect-src 'none'");
  expect(POLICY).toContain("form-action 'none'");
  expect(POLICY).toContain("frame-ancestors https://www.faysalahmed.ca");
  expect(POLICY).not.toContain("unsafe-eval");
});

test("all 21 tools are present", () => {
  expect(FILES).toHaveLength(21);
});

for (const file of FILES) {
  test(`${file} runs under the enforced policy with no outside requests`, async ({ page, baseURL }) => {
    await enforce(page);
    const problems = /** @type {string[]} */ ([]);
    const outside = /** @type {string[]} */ ([]);
    page.on("console", (msg) => {
      if (/content security policy|refused to/i.test(msg.text())) problems.push(msg.text());
    });
    page.on("pageerror", (e) => problems.push(e.message));
    page.on("request", (req) => {
      const url = req.url();
      if (
        !url.startsWith("data:") &&
        !url.startsWith("blob:") &&
        new URL(url).origin !== new URL(baseURL ?? "").origin
      ) {
        outside.push(url);
      }
    });

    await page.goto(`/marketing/${file}`);
    await expect(page.locator("h1")).toBeVisible();
    const sample = page.locator("#smp");
    if (await sample.count()) await sample.click();
    const go = page.locator("#go");
    if (await go.count()) await go.click();
    await expect(page.locator("#err:not(:empty)")).toHaveCount(0);

    expect(problems).toEqual([]);
    expect(outside).toEqual([]);
  });
}

test("inside a sandboxed frame a tool keeps its saved inputs across a reload", async ({ page, baseURL }) => {
  await enforce(page, baseURL);
  await page.goto("/");
  await page.setContent(
    `<iframe id="f" title="t" sandbox="${SANDBOX}" src="${new URL("/marketing/utm-governance-auditor.html", page.url()).href}"></iframe>`,
  );
  const frame = page.frameLocator("#f");
  await expect(frame.locator("h1")).toHaveText("UTM Governance Auditor");
  await frame.locator("#paste").fill("https://example.com/?utm_source=Facebook&utm_medium=cpc&utm_campaign=x");
  await frame.locator("#go").click();
  await expect(frame.locator("#out")).not.toBeEmpty();
  await page.waitForTimeout(400);
  await page.reload();
  await page.setContent(
    `<iframe id="f" title="t" sandbox="${SANDBOX}" src="${new URL("/marketing/utm-governance-auditor.html", page.url()).href}"></iframe>`,
  );
  await expect(page.frameLocator("#f").locator("#paste")).toHaveValue(/utm_source=Facebook/);
});
