import { readFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import {
  computeAttribution,
  creditFor,
  detectRevenueIssues,
  groupJourneys,
  HALF_LIFE_DAYS,
  MODELS,
  normalizeTouchpoint,
  revenueWarnings,
} from "../../../src/lib/attribution/compute.js";
import { lowercaseKeys } from "../../../src/lib/csv.js";

const rowsFrom = (text) => Papa.parse(text, { header: true, skipEmptyLines: true }).data.map(lowercaseKeys);
const load = (name) => computeFrom(readFileSync(path.join(process.cwd(), "tests/fixtures", name), "utf8"));
const computeFrom = (text) => computeAttribution(groupJourneys(rowsFrom(text)).journeys);
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

  it("uses a 7 day half-life", () => expect(HALF_LIFE_DAYS).toBe(7));
});

describe("normalizeTouchpoint", () => {
  it("accepts journey and channel aliases and defaults the channel", () => {
    expect(normalizeTouchpoint({ journeyid: "j", touchpoint: "tv" }, 0)).toMatchObject({
      journeyId: "j",
      channel: "tv",
    });
    expect(normalizeTouchpoint({ journey: "j" }, 0)).toMatchObject({ journeyId: "j", channel: "(unknown)" });
    expect(normalizeTouchpoint({}, 0).journeyId).toBe("");
  });

  it("falls back to row order when the timestamp is missing or unparseable", () => {
    const missing = normalizeTouchpoint({ journey_id: "j" }, 3);
    expect(missing).toMatchObject({ timeIsFallback: true, time: 3 * 86400000 });
    expect(normalizeTouchpoint({ journey_id: "j", timestamp: "garbage" }, 1).timeIsFallback).toBe(true);
    expect(normalizeTouchpoint({ journey_id: "j", timestamp: "2026-01-01" }, 1).timeIsFallback).toBe(false);
  });

  it("reads revenue only when it is a number", () => {
    expect(normalizeTouchpoint({ revenue: "12.5" }, 0).revenue).toBe(12.5);
    expect(normalizeTouchpoint({ revenue: "" }, 0).revenue).toBeNull();
    expect(normalizeTouchpoint({ revenue: "n/a" }, 0).revenue).toBeNull();
    expect(normalizeTouchpoint({}, 0).revenue).toBeNull();
  });
});

describe("groupJourneys", () => {
  it("skips rows with no journey id and reports revenue and timestamp fallbacks", () => {
    const { journeys, anyRevenue, anyFallbackTime } = groupJourneys(
      rowsFrom("journey_id,channel,revenue\nj1,a,5\n,b,\nj1,c,\n"),
    );
    expect([...journeys.keys()]).toEqual(["j1"]);
    expect(journeys.get("j1")).toHaveLength(2);
    expect(anyRevenue).toBe(true);
    expect(anyFallbackTime).toBe(true);
  });

  it("is empty when no row has a journey id", () => {
    expect(groupJourneys(rowsFrom("channel\nemail\n")).journeys.size).toBe(0);
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
});

describe("revenue issues (D9)", () => {
  const issuesFor = (text) => detectRevenueIssues(groupJourneys(rowsFrom(text)).journeys);

  it("flags a journey that repeats one revenue figure on several rows", () => {
    expect(issuesFor("journey_id,channel,revenue\nj,a,100\nj,b,100\n")).toMatchObject({
      repeatedRevenueJourneys: 1,
      mixedUnits: false,
    });
  });

  it("does not flag distinct revenue values or a single revenue row", () => {
    expect(issuesFor("journey_id,channel,revenue\nj,a,100\nj,b,50\nk,a,10\n").repeatedRevenueJourneys).toBe(0);
  });

  it("flags journeys with and without revenue together", () => {
    expect(issuesFor("journey_id,channel,revenue\nj,a,100\nk,b,\n")).toMatchObject({
      journeysWithRevenue: 1,
      journeysWithoutRevenue: 1,
      mixedUnits: true,
    });
  });

  it("turns issues into warnings, and none for clean input", () => {
    expect(revenueWarnings(issuesFor("journey_id,channel,revenue\nj,a,100\nj,b,100\nk,b,\n"))).toHaveLength(2);
    expect(revenueWarnings(issuesFor("journey_id,channel\nj,a\n"))).toEqual([]);
  });
});
