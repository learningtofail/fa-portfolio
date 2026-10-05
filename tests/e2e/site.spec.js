import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

/** Astro islands ship server-rendered markup first; interacting before hydration drops events. */
const hydrated = (page) => page.waitForFunction(() => !document.querySelector("astro-island[ssr]"));

const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

const TOOL_PAGES = [
  { slug: "attribution", heading: /Attribution/i },
  { slug: "disclosure-check", heading: /Disclosure/i },
];

test.describe("resume page", () => {
  test("renders every section and links the two tools", async ({ page }) => {
    await page.goto("/");
    for (const id of ["summary", "experience", "skills", "tools", "contact"]) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
    await expect(page.locator("#tools a.tool-card")).toHaveCount(2);
  });

  test("serves the generated resume PDF", async ({ request }) => {
    const response = await request.get("/faysal-ahmed-resume.pdf");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("pdf");
  });

  test("skip link moves focus to main content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("is hidden from crawlers", async ({ page, request }) => {
    await page.goto("/");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /");
  });
});

test.describe("retired tool URLs", () => {
  for (const [old, target] of [
    ["utm-auditor", "/marketing/utm-governance-auditor.html"],
    ["gtm-auditor", "/marketing/gtm-container-auditor.html"],
    ["cac-calculator", "/marketing/cac-payback-modeler.html"],
  ]) {
    test(`/tools/${old}/ redirects to ${target}`, async ({ page }) => {
      await page.goto(`/tools/${old}/`);
      await page.waitForURL(`**${target}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }

  test("the tools index lists only the two remaining tools", async ({ page }) => {
    await page.goto("/tools/");
    await expect(page.getByRole("link", { name: /Multi-Touch Attribution/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Disclosure Language Checker/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /UTM Governance Auditor/ })).toHaveCount(0);
  });
});

test.describe("tool pages", () => {
  for (const { slug, heading } of TOOL_PAGES) {
    test(`${slug} loads without page errors`, async ({ page }) => {
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`/tools/${slug}/`);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
      expect(errors).toEqual([]);
    });
  }

  test("disclosure-check passes copy with #ad", async ({ page }) => {
    await page.goto("/tools/disclosure-check/");
    await hydrated(page);
    await page.getByPlaceholder("One piece of copy per line...").fill("Great blender #ad");
    await expect(page.getByRole("cell", { name: "Pass" })).toBeVisible();
  });

  test("dropzones open with the keyboard", async ({ page }) => {
    await page.goto("/tools/attribution/");
    await hydrated(page);
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /csv/i }).focus();
    await page.keyboard.press("Enter");
    await chooser;
  });
});

test.describe("prototype-colliding user data (D2)", () => {
  test("attribution survives a channel named 'constructor'", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/tools/attribution/");
    await hydrated(page);
    await page.setInputFiles('input[type="file"]', fixture("constructor-attribution.csv"));
    await expect(page.getByRole("table")).toBeVisible({ timeout: 3000 });
    expect(errors).toEqual([]);
  });
});

test.describe("accessibility", () => {
  for (const path of ["/", "/tools/", ...TOOL_PAGES.map((t) => `/tools/${t.slug}/`)]) {
    test(`${path} has no axe violations`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page: /** @type {any} */ (page) }).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    });
  }
});

test.describe("styling rules (Phase 3)", () => {
  const ALL_PATHS = ["/", "/tools/", ...TOOL_PAGES.map((t) => `/tools/${t.slug}/`)];

  for (const path of ALL_PATHS) {
    test(`${path} has no inline style attributes`, async ({ page }) => {
      await page.goto(path);
      if (path.startsWith("/tools/") && path !== "/tools/") await hydrated(page);
      expect(await page.locator("[style]").count()).toBe(0);
    });
  }

  test("charts render without inline styles or hex attributes", async ({ page }) => {
    await page.goto("/tools/attribution/");
    await hydrated(page);
    await page.setInputFiles('input[type="file"]', fixture("attribution.csv"));
    await expect(page.getByRole("table")).toBeVisible();
    expect(await page.locator("[style]").count()).toBe(0);
    expect(await page.locator('svg [fill^="#"], svg [stroke^="#"]').count()).toBe(0);
    // Series colors resolve from the site tokens through classes.
    const fill = await page
      .locator("svg .chart__series--1")
      .first()
      .evaluate((el) => getComputedStyle(el).fill);
    expect(fill).toBe("rgb(58, 90, 155)");
  });

  test("hover transition is removed under prefers-reduced-motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const duration = await page
      .locator("a.tool-card")
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(duration).toBe("0s");
  });
});

test.describe("accessibility with results on screen", () => {
  const CASES = [["attribution", "attribution.csv"]];
  for (const [slug, file] of CASES) {
    test(`/tools/${slug}/ has no axe violations after an upload`, async ({ page }) => {
      await page.goto(`/tools/${slug}/`);
      await hydrated(page);
      await page.setInputFiles('input[type="file"]', fixture(file));
      await expect(page.locator(".stat-card").first()).toBeVisible();
      const results = await new AxeBuilder({ page: /** @type {any} */ (page) }).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    });
  }

  test("disclosure-check results table has no axe violations", async ({ page }) => {
    await page.goto("/tools/disclosure-check/");
    await hydrated(page);
    await page.getByPlaceholder("One piece of copy per line...").fill("Great blender #ad\nPlain copy");
    await expect(page.getByRole("cell", { name: "Missing disclosure" })).toBeVisible();
    const results = await new AxeBuilder({ page: /** @type {any} */ (page) }).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});
