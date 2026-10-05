import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Loads every page under the policy proposed in docs/caddy/Caddyfile.proposed.md, ENFORCED, so a policy that
// would blank the site or break a tool fails here instead of in production.
const doc = readFileSync(new URL("../../docs/caddy/Caddyfile.proposed.md", import.meta.url), "utf8");
const POLICY = /Content-Security-Policy-Report-Only "([^"]+)"/.exec(doc)?.[1] ?? "";
const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

const PAGES = [
  ["/", null],
  ["/tools/", null],
  ["/tools/utm-auditor/", "utm.csv"],
  ["/tools/gtm-auditor/", "gtm.json"],
  ["/tools/attribution/", "attribution.csv"],
  ["/tools/cac-calculator/", null],
  ["/tools/disclosure-check/", null],
];

test("the proposed policy is present and allows only the www origin to embed", () => {
  expect(POLICY).toContain("default-src 'none'");
  expect(POLICY).toContain("frame-ancestors https://www.faysalahmed.ca");
  expect(POLICY).not.toContain("unsafe-inline");
  expect(POLICY).not.toContain("unsafe-eval");
});

for (const [path, upload] of PAGES) {
  test(`${path} works under the enforced policy`, async ({ page }) => {
    await page.route("**/*", async (route) => {
      if (route.request().resourceType() !== "document") return route.continue();
      const response = await route.fetch();
      return route.fulfill({ response, headers: { ...response.headers(), "content-security-policy": POLICY } });
    });
    const problems = [];
    page.on("console", (msg) => {
      if (/content security policy|refused to/i.test(msg.text())) problems.push(msg.text());
    });
    page.on("pageerror", (e) => problems.push(e.message));

    await page.goto(path);
    if (path.startsWith("/tools/") && path !== "/tools/") {
      // The islands hydrate through inline scripts, which only run if their hashes are in the policy.
      await page.waitForFunction(() => !document.querySelector("astro-island[ssr]"));
    }
    if (upload) {
      await page.setInputFiles('input[type="file"]', fixture(upload));
      await expect(page.locator(".stat-card").first()).toBeVisible();
    }
    if (path === "/tools/cac-calculator/") await expect(page.getByText("$250.00")).toBeVisible();
    expect(problems).toEqual([]);
  });
}
