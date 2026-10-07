import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

/** Astro islands ship server-rendered markup first; interacting before hydration drops events. */
const hydrated = (page) => page.waitForFunction(() => !document.querySelector("astro-island[ssr]"));

const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

const reviewFixture = (name) => fileURLToPath(new URL(`../fixtures/attribution-review/${name}`, import.meta.url));

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
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/tools/attribution/");
    await hydrated(page);
    await page.setInputFiles('input[type="file"]', fixture("constructor-attribution.csv"));
    await expect(page.getByRole("table").first()).toBeVisible({ timeout: 3000 });
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
    await expect(page.getByRole("table").first()).toBeVisible();
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
  const CASES = [
    ["utm-auditor", "utm.csv"],
    ["gtm-auditor", "gtm.json"],
    ["attribution", "attribution.csv"],
  ];
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

test.describe("attribution controls", () => {
  const open = async (page, file) => {
    await page.goto("/tools/attribution/");
    await hydrated(page);
    await page.setInputFiles('input[type="file"]', file);
    await expect(page.getByRole("heading", { name: "Data quality" })).toBeVisible();
  };
  const creditTable = (page) => page.getByRole("table").first();

  test("counts a repeated revenue once, and the sum mode marks the totals unreliable", async ({ page }) => {
    await open(page, reviewFixture("03-trap-repeated-revenue-automotive.csv"));
    await expect(page.getByText("Credit is measured in revenue")).toBeVisible();
    await expect(creditTable(page).locator("tr", { hasText: "Total" }).first()).toContainText("8,920.00");
    await expect(page.getByRole("status", { name: "Totals warning" })).toHaveCount(0);
    await page.getByLabel("Revenue per journey").selectOption("sum");
    await expect(creditTable(page).locator("tr", { hasText: "Total" }).first()).toContainText("35,430.00");
    await expect(page.getByRole("status", { name: "Totals warning" })).toContainText("Totals are unreliable");
  });

  test("maps a 'Journey ID' header and reads a decimal comma", async ({ page }) => {
    await open(page, reviewFixture("02b-dirty-headers-spaces.csv"));
    await expect(page.getByLabel(/Journey ID column/)).toHaveValue("journey id");
    await open(page, reviewFixture("02c-semicolon-eu-export.csv"));
    await expect(creditTable(page).locator("tr", { hasText: "Paid Search" })).toContainText("100.50");
  });

  test("lists the headers seen when a required column is missing", async ({ page }) => {
    await page.goto("/tools/attribution/");
    await hydrated(page);
    await page.setInputFiles('input[type="file"]', {
      name: "odd.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("who,where\nj1,email\n"),
    });
    await expect(page.getByRole("alert")).toContainText("Headers seen: who, where");
    await page.getByLabel(/Journey ID column/).selectOption("who");
    await page.getByLabel(/Channel column/).selectOption("where");
    await expect(page.getByRole("heading", { name: "Data quality" })).toBeVisible();
  });

  test("view-through, lookback, half-life and conversion controls change the result", async ({ page }) => {
    await open(page, fixture("attribution-controls.csv"));
    await expect(
      page.getByText("2 journeys did not convert").or(page.getByText("1 journey did not convert")),
    ).toBeVisible();
    await expect(creditTable(page).locator("tr", { hasText: "Display" })).toBeVisible();
    await page.getByLabel(/Keep view-through touches/).uncheck();
    await expect(page.getByText(/2 view-through touches excluded/)).toBeVisible();
    await expect(creditTable(page).locator("tr", { hasText: "Display" })).toHaveCount(0);
    await page.getByLabel(/Lookback window/).fill("20");
    await expect(page.getByText(/Lookback 20 days/)).toBeVisible();
    await page.getByLabel(/Time-decay half-life/).fill("30");
    await expect(page.getByText(/every 30 days/)).toBeVisible();
    await page.getByLabel("Only journeys with revenue count as conversions").uncheck();
    await expect(page.getByRole("status", { name: "Totals warning" })).toBeVisible();
  });

  test("shows shares, ranks and a labelled chart axis", async ({ page }) => {
    await open(page, reviewFixture("01-ecommerce-clean.csv"));
    await expect(page.getByRole("heading", { name: "Rank by model" })).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(3);
    await expect(page.locator(".chart__axis-title")).toContainText("Credit (revenue");
  });

  test("downloads the matrix and shares as CSV", async ({ page }) => {
    await open(page, reviewFixture("01-ecommerce-clean.csv"));
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Download credit and shares as CSV/ }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("attribution-credit.csv");
  });

  test("has no axe violations with warnings and every control on screen", async ({ page }) => {
    await open(page, reviewFixture("02-b2b-saas-messy.csv"));
    const results = await new AxeBuilder({ page: /** @type {any} */ (page) }).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    expect(await page.locator("[style]").count()).toBe(0);
  });

  test("has no axe violations with the unreliable-totals banner and the view-through control", async ({ page }) => {
    await open(page, fixture("attribution-controls.csv"));
    await page.getByLabel("Only journeys with revenue count as conversions").uncheck();
    const results = await new AxeBuilder({ page: /** @type {any} */ (page) }).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
});
