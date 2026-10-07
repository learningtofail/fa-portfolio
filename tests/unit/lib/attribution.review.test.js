import { creditFor, MODELS } from "../../../src/lib/attribution/compute.js";
import { qualityNotes } from "../../../src/lib/attribution/notes.js";
import { analyzeFixture } from "./attributionHelpers.js";

// Golden tests on the eight review samples (tests/fixtures/attribution-review). Expected values were checked
// against an independent Python implementation in the review; see the sample README for the sources.
const DIR = "attribution-review/";
const run = (name, options) => analyzeFixture(DIR + name, options);
const credit = (a, model, channel) => creditFor(a.result, model, channel);
const near = (actual, expected) => expect(actual).toBeCloseTo(expected, 2);

describe("01 clean ecommerce: the math is unchanged", () => {
  const a = run("01-ecommerce-clean.csv");
  it("matches the values the review verified", () => {
    expect(a.result).toMatchObject({ journeyCount: 60, touchpointCount: 150 });
    expect(a.result.channels).toHaveLength(6);
    near(credit(a, "Last-touch", "Paid Search"), 2457.11);
    near(credit(a, "First-touch", "Paid Search"), 2796.35);
    near(credit(a, "First-touch", "Organic Search"), 1651.33);
    near(credit(a, "Last-touch", "Organic Search"), 518.38);
  });
  it("conserves value in every model and has no warnings", () => {
    for (const m of MODELS)
      near(
        a.result.channels.reduce((s, c) => s + credit(a, m, c), 0),
        a.result.totalValue,
      );
    expect(qualityNotes(a.report).filter((n) => n.level === "warning")).toEqual([]);
    expect(a.report.totalsUnreliable).toEqual([]);
  });
});

describe("02 messy B2B export", () => {
  const a = run("02-b2b-saas-messy.csv");
  it("reports what was wrong with the file", () => {
    expect(a.report).toMatchObject({ droppedNoJourney: 1, journeyCount: 26, duplicateRows: 5, blankChannelTouches: 1 });
    expect(a.report.dates).toMatchObject({
      undatedJourneys: 8,
      undatedTouches: 8,
      order: "mdy",
      evidence: "month-first",
    });
    expect(a.report.channelMerges.map((m) => m.label).sort()).toEqual(["Paid Search", "organic search"]);
  });
  it("reads $12,500.00, 18,000 and 9.600,00 instead of discarding them", () => {
    expect(a.report.revenue.unparseable).toBe(0);
    expect(credit(a, "Last-touch", "Content Syndication, Tier 1")).toBe(12500);
    // ACME-021 (18,000, last touch paid search) and ACME-025 (18,000, last touch G2).
    expect(credit(a, "Last-touch", "G2 Review Site") + credit(a, "Last-touch", "Paid Search")).toBeGreaterThan(
      18000 * 2,
    );
  });
  it("counts only the 22 journeys with revenue as conversions and says so", () => {
    expect(a.report).toMatchObject({ convertingJourneys: 22, nonConvertingJourneys: 4 });
    expect(a.result.totalValue).toBe(495600);
    expect(a.report.totalsUnreliable).toEqual([]);
  });
  it("keeps a blank timestamp where it was in the file (no 1970 first touch)", () => {
    // ACME-002: Webinar, Paid Search, Outbound SDR, (Webinar, blank), Outbound SDR, paid search 24,000.
    // The first touch stays the dated Webinar of 2026-01-15, so Webinar first-touch includes ACME-002's 24,000.
    expect(credit(a, "First-touch", "Webinar")).toBe(24000);
  });
  it("scores a blank channel only under an explicit label", () => {
    expect(a.result.channels).toContain("(blank channel)");
    expect(a.result.channels).not.toContain("(unknown)");
  });
  it("can keep duplicates and skip merging, and the numbers move accordingly", () => {
    const raw = run("02-b2b-saas-messy.csv", { dedupe: false, normalizeChannels: false });
    expect(raw.result.touchpointCount).toBe(a.result.touchpointCount + 5);
    expect(raw.result.channels.length).toBeGreaterThan(a.result.channels.length);
  });
});

it("02b maps the 'Journey ID' header", () => {
  const a = run("02b-dirty-headers-spaces.csv");
  expect(a.mapping.journey).toBe("journey id");
  near(credit(a, "Last-touch", "Paid Search"), 100);
});

it("02c reads the decimal-comma revenue and never claims there is no revenue column", () => {
  const a = run("02c-semicolon-eu-export.csv");
  near(credit(a, "Last-touch", "Paid Search"), 100.5);
  expect(a.unit).toBe("revenue");
  expect(a.report.revenue).toMatchObject({ hasColumn: true, locale: "comma", unparseable: 0 });
});

describe("03 repeated revenue (automotive)", () => {
  const a = run("03-trap-repeated-revenue-automotive.csv");
  it("totals the true 8,920, not 35,430", () => {
    expect(a.result.totalValue).toBe(8920);
    for (const m of MODELS)
      near(
        a.result.channels.reduce((s, c) => s + credit(a, m, c), 0),
        8920,
      );
  });
  it("credits SEO Listings Pages 3,920 first-touch and 1,500 last-touch, rank 4 on last-touch", () => {
    expect(credit(a, "First-touch", "SEO Listings Pages")).toBe(3920);
    expect(credit(a, "Last-touch", "SEO Listings Pages")).toBe(1500);
    const seo = a.result.channels.map((c) => credit(a, "Last-touch", c)).filter((v) => v > 1500).length + 1;
    expect(seo).toBe(4);
  });
  it("tells the user the value repeats, and flags the inflated total in sum mode", () => {
    expect(a.report.revenue.repeated).toBe(38);
    const summed = run("03-trap-repeated-revenue-automotive.csv", { revenueMode: "sum" });
    expect(summed.result.totalValue).toBe(35430);
    expect(summed.report.totalsUnreliable.length).toBeGreaterThan(0);
  });
});

describe("04 ties and cross-device", () => {
  const a = run("04-ties-and-cross-device.csv");
  it("breaks ties by file order and reports the tied journeys", () => {
    expect(credit(a, "Last-touch", "Direct")).toBe(100 + 200);
    expect(credit(a, "Last-touch", "Paid Social")).toBe(100);
    expect(a.report.dates.tiedJourneys).toBe(2);
  });
  it("gives the two non-converting anonymous journeys no credit", () => {
    expect(a.report.nonConvertingJourneys).toBe(2);
    expect(credit(a, "Linear", "Organic Search")).toBe(0);
  });
});

describe("05 travel, lag and view-through", () => {
  it("says every journey is a conversion when there is no revenue column", () => {
    const a = run("05-travel-view-through-lag.csv");
    expect(a.unit).toBe("conversions");
    expect(a.report.conversionRule).toBe("all");
    expect(a.result.totalValue).toBe(30);
    near(credit(a, "First-touch", "Display (view-through)"), 30);
    near(credit(a, "Time-decay", "Display (view-through)"), 0.14);
  });
  it("exposes the half-life and the lookback", () => {
    const slow = run("05-travel-view-through-lag.csv", { halfLifeDays: 60 });
    expect(credit(slow, "Time-decay", "Display (view-through)")).toBeGreaterThan(5);
    const cut = run("05-travel-view-through-lag.csv", { lookbackDays: 45 });
    expect(credit(cut, "First-touch", "Display (view-through)")).toBeLessThan(30);
    expect(cut.report.lookback.excludedTouches).toBeGreaterThan(0);
  });
});

describe("06 non-converters (nonprofit)", () => {
  const a = run("06-trap-nonconverters-nonprofit.csv");
  it("counts 30 donors and 4,025 in gifts, ignoring the 90 who did not give", () => {
    expect(a.report).toMatchObject({ journeyCount: 120, convertingJourneys: 30, nonConvertingJourneys: 90 });
    expect(a.result.totalValue).toBe(4025);
  });
  it("gives Paid Social 25 of real donation dollars as last-touch, not 89", () => {
    expect(credit(a, "Last-touch", "Paid Social")).toBe(25);
  });
  it("with the revenue column unmapped, says every journey is counted and shows the old 65 of 120", () => {
    const counted = run("06-trap-nonconverters-nonprofit.csv", { mapping: { revenue: "" } });
    expect(counted.report.conversionRule).toBe("all");
    expect(counted.unit).toBe("conversions");
    expect(credit(counted, "Last-touch", "Paid Social")).toBe(65);
  });
});
