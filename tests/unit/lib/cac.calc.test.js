import {
  CAPPED_LIFESPAN_MONTHS,
  calculateCac,
  ltvCacHealth,
  MIN_HORIZON_MONTHS,
  parseField,
} from "../../../src/lib/cac/calc.js";

const BASE = { spend: 50000, newCustomers: 200, avgRevenue: 80, grossMarginPct: 70, churnPct: 3 };

describe("calculateCac", () => {
  it("computes the default scenario by hand", () => {
    const r = calculateCac(BASE);
    expect(r.cac).toBe(250); // 50,000 / 200
    expect(r.monthlyGrossProfit).toBeCloseTo(56); // 80 * 70%
    expect(r.lifespanMonths).toBeCloseTo(100 / 3); // 1 / 3%
    expect(r.ltv).toBeCloseTo(1866.667, 2);
    expect(r.ltvCacRatio).toBeCloseTo(7.4667, 3);
    expect(r.paybackMonths).toBeCloseTo(250 / 56);
    expect(r.usedCappedLifespan).toBe(false);
  });

  it("caps lifespan at CAPPED_LIFESPAN_MONTHS when churn is zero", () => {
    const r = calculateCac({ ...BASE, churnPct: 0 });
    expect(r.lifespanMonths).toBe(CAPPED_LIFESPAN_MONTHS);
    expect(r.usedCappedLifespan).toBe(true);
    expect(r.ltv).toBeCloseTo(56 * 60);
  });

  it("returns NaN, never Infinity, when there are no customers", () => {
    const r = calculateCac({ ...BASE, newCustomers: 0 });
    expect(r.cac).toBeNaN();
    expect(r.ltvCacRatio).toBeNaN();
    expect(r.paybackMonths).toBeNaN();
  });

  it("propagates an empty (NaN) field only to the metrics that need it", () => {
    const noChurn = calculateCac({ ...BASE, churnPct: NaN });
    expect(noChurn.cac).toBe(250);
    expect(noChurn.ltv).toBeNaN();
    expect(noChurn.usedCappedLifespan).toBe(false);
    expect(calculateCac({ ...BASE, spend: NaN }).cac).toBeNaN();
    expect(calculateCac({ ...BASE, avgRevenue: NaN }).paybackMonths).toBeNaN();
  });

  it("keeps the chart horizon finite and at least the minimum", () => {
    expect(calculateCac({ ...BASE, churnPct: NaN }).horizonMonths).toBe(MIN_HORIZON_MONTHS);
    expect(calculateCac({ ...BASE, spend: 1_000_000 }).horizonMonths).toBeGreaterThanOrEqual(MIN_HORIZON_MONTHS);
    expect(Number.isFinite(calculateCac({ ...BASE, avgRevenue: 0 }).horizonMonths)).toBe(true);
  });
});

describe("parseField", () => {
  it.each([
    ["", NaN],
    ["   ", NaN],
    ["abc", NaN],
    ["0", 0],
    ["12.5", 12.5],
    [" 7 ", 7],
  ])("%j parses to %s", (text, expected) => expect(parseField(text)).toBe(expected));
});

describe("ltvCacHealth", () => {
  it.each([
    [NaN, null, "N/A"],
    [Infinity, null, "N/A"],
    [0, null, "N/A"],
    [0.99, "bad", /Losing money/],
    [1, "warn", /Marginal/],
    [2.99, "warn", /Marginal/],
    [3, "good", "Healthy"],
    [5, "good", "Healthy"],
    [5.01, "warn", /under-investing/],
  ])("ratio %s", (ratio, tone, label) => {
    const health = ltvCacHealth(ratio);
    expect(health.tone).toBe(tone);
    expect(health.label).toMatch(label);
  });
});
