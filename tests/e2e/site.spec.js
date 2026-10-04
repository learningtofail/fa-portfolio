import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

/** Astro islands ship server-rendered markup first; interacting before hydration drops events. */
const hydrated = (page) => page.waitForFunction(() => !document.querySelector("astro-island[ssr]"));

const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

const TOOL_PAGES = [
  { slug: "utm-auditor", heading: /UTM/i },
  { slug: "gtm-auditor", heading: /GTM/i },
  { slug: "cac-calculator", heading: /CAC/i },
  { slug: "attribution", heading: /Attribution/i },
  { slug: "disclosure-check", heading: /Disclosure/i },
];

test.describe("resume page", () => {
  test("renders every section and links the five tools", async ({ page }) => {
    await page.goto("/");
    for (const id of ["summary", "experience", "skills", "tools", "contact"]) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
    await expect(page.locator("#tools a.tool-card")).toHaveCount(5);
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

  test("utm-auditor flags a row with a missing field", async ({ page }) => {
    await page.goto("/tools/utm-auditor/");
    await hydrated(page);
    await page.setInputFiles('input[type="file"]', fixture("utm.csv"));
    await expect(page.getByText("Rows with issues")).toBeVisible();
    await expect(page.getByText("Missing utm_campaign")).toBeVisible();
  });

  test("cac-calculator shows the default CAC", async ({ page }) => {
    await page.goto("/tools/cac-calculator/");
    await hydrated(page);
    await expect(page.getByText("$250.00")).toBeVisible();
  });

  test("disclosure-check passes copy with #ad", async ({ page }) => {
    await page.goto("/tools/disclosure-check/");
    await hydrated(page);
    await page.getByPlaceholder("One piece of copy per line...").fill("Great blender #ad");
    await expect(page.getByRole("cell", { name: "Pass" })).toBeVisible();
  });

  test("dropzones open with the keyboard", async ({ page }) => {
    await page.goto("/tools/utm-auditor/");
    await hydrated(page);
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /csv/i }).focus();
    await page.keyboard.press("Enter");
    await chooser;
  });
});

test.describe("prototype-colliding user data (D2)", () => {
  test("utm-auditor survives a utm_source of 'constructor'", async ({ page }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/tools/utm-auditor/");
    await hydrated(page);
    await page.setInputFiles('input[type="file"]', fixture("constructor-utm.csv"));
    await expect(page.getByText("Rows with issues")).toBeVisible({ timeout: 3000 });
    expect(errors).toEqual([]);
  });

  test("attribution survives a channel named 'constructor'", async ({ page }) => {
    test.fail();
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
