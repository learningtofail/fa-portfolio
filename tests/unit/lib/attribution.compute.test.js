import {
  computeAttribution,
  creditFor,
  DEFAULT_HALF_LIFE_DAYS,
  MODELS,
  POSITION_WEIGHTS,
} from "../../../src/lib/attribution/compute.js";
import { analyzeFixture, analyzeText } from "./attributionHelpers.js";

const load = (name) => analyzeFixture(name).result;
const computeFrom = (text, options) => analyzeText(text, options).result;
const near = (actual, expected) => expect(actual).toBeCloseTo(expected, 10);

describe("golden: the hand-verified sample (docs/history.md)", () => {
  // j1: email (Jan 1) then paid (Jan 8). j2: paid only (Jan 2). No revenue, so each journey is worth 1.
  // Last-touch:     email 0,   paid 1 + 1 = 2
  // First-touch:    email 1,   paid 1 (j2)
  // Linear:         email 1/2, paid 1/2 + 1 = 3/2
  // Position-based: two touches split 50/50, a single touch takes all: email 1/2, paid 3/2
  // Time-decay (7-day half-life): j1 weights email 2^-1 = 1/2, paid 1, so email 1/3 and paid 2/3; paid also takes j2's 1
  const EXPECTED = {
    "Last-touch": { email: 0, paid: 2 },
    "First-touch": { email: 1, paid: 1 },
    Linear: { email: 0.5, paid: 1.5 },
    "Position-based": { email: 0.5, paid: 1.5 },
    "Time-decay": { email: 1 / 3, paid: 5 / 3 },
  };

  it("matches the hand-computed credit for every model and channel", () => {
    const result = load("attribution-golden.csv");
    expect(result.channels).toEqual(["email", "paid"]);
    for (const model of MODELS) {
      for (const channel of result.channels) near(creditFor(result, model, channel), EXPECTED[model][channel]);
    }
    expect(result.journeyCount).toBe(2);
    expect(result.touchpointCount).toBe(3);
    expect(result.totalValue).toBe(2);
  });

  it("conserves each journey's value under every model", () => {
    const result = load("attribution-golden.csv");
    for (const model of MODELS) {
      const total = result.channels.reduce((sum, c) => sum + creditFor(result, model, c), 0);
      near(total, result.totalValue);
    }
  });
});

describe("golden: one three-touch journey worth 90", () => {
  // a (day 0), b (day 7), c (day 14), revenue 90.
  // Last c 90; first a 90; linear 30 each; position-based 40/20/40: a 36, b 18, c 36
  // Time-decay weights a 2^-2 = 1/4, b 1/2, c 1, total 7/4: a 90/7, b 180/7, c 360/7
  it("matches the hand-computed credit", () => {
    const r = load("attribution-revenue-golden.csv");
    near(creditFor(r, "Last-touch", "c"), 90);
    near(creditFor(r, "First-touch", "a"), 90);
    ["a", "b", "c"].forEach((ch) => near(creditFor(r, "Linear", ch), 30));
    near(creditFor(r, "Position-based", "a"), 36);
    near(creditFor(r, "Position-based", "b"), 18);
    near(creditFor(r, "Position-based", "c"), 36);
    near(creditFor(r, "Time-decay", "a"), 90 / 7);
    near(creditFor(r, "Time-decay", "b"), 180 / 7);
    near(creditFor(r, "Time-decay", "c"), 360 / 7);
    expect(r.totalValue).toBe(90);
  });

  it("uses a 7 day half-life by default and 40/20/40 position weights", () => {
    expect(DEFAULT_HALF_LIFE_DAYS).toBe(7);
    expect(POSITION_WEIGHTS).toEqual({ first: 0.4, middle: 0.2, last: 0.4, two: 0.5 });
  });

  it("applies a custom half-life", () => {
    // j1: email 7 days before paid. With a 14 day half-life email weighs 2^-0.5 against 1.
    const r = computeFrom("journey_id,channel,timestamp\nj1,email,2026-01-01\nj1,paid,2026-01-08\n", {
      halfLifeDays: 14,
    });
    const w = Math.pow(2, -0.5);
    near(creditFor(r, "Time-decay", "email"), w / (1 + w));
  });
});

describe("computeAttribution edge cases", () => {
  it("handles a journey ordered by file position when timestamps are missing", () => {
    const r = computeFrom("journey_id,channel\nj,first\nj,last\n");
    near(creditFor(r, "First-touch", "first"), 1);
    near(creditFor(r, "Last-touch", "last"), 1);
  });

  it("handles a single touch and an unknown model or channel", () => {
    const r = computeFrom("journey_id,channel,timestamp\nj,solo,2026-01-01\n");
    for (const model of MODELS) near(creditFor(r, model, "solo"), 1);
    expect(creditFor(r, "Nope", "solo")).toBe(0);
    expect(creditFor(r, "Linear", "missing")).toBe(0);
  });

  it.each(["constructor", "__proto__", "toString"])("handles a journey and channel named %s (D2)", (name) => {
    const r = computeFrom(`journey_id,channel,timestamp\n${name},${name},2026-01-01\n${name},email,2026-01-03\n`);
    expect(r.journeyCount).toBe(1);
    near(creditFor(r, "First-touch", name), 1);
  });

  it("skips journeys with no touches and scores nothing for an empty list", () => {
    const r = computeAttribution([{ id: "j", value: 5, touches: [] }]);
    expect(r).toMatchObject({ journeyCount: 0, touchpointCount: 0, totalValue: 0, channels: [] });
  });

  it("conserves value for a 4-touch journey under every model", () => {
    const r = computeFrom(
      "journey_id,channel,timestamp,revenue\nj,a,2026-01-01,\nj,b,2026-01-02,\nj,c,2026-01-03,\nj,d,2026-01-04,100\n",
    );
    for (const model of MODELS)
      near(
        r.channels.reduce((s, c) => s + creditFor(r, model, c), 0),
        100,
      );
    near(creditFor(r, "Position-based", "b"), 10);
  });
});
