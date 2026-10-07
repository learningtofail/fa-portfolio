import { creditFor } from "../../../src/lib/attribution/compute.js";
import { analyzeText, tryAnalyzeText } from "./attributionHelpers.js";

const HEAD = "journey_id,channel,timestamp,revenue\n";
const run = (body, options) => analyzeText(HEAD + body, options);
const credit = (a, model, channel) => creditFor(a.result, model, channel);

describe("column mapping", () => {
  it("lists the headers seen when a required column is missing", () => {
    const a = tryAnalyzeText("foo,bar\n1,2\n");
    expect(a).toMatchObject({ status: "missing", missing: ["Journey ID", "Channel"], headers: ["foo", "bar"] });
  });

  it("maps aliases and accepts a manual override, including none", () => {
    const text = "user_id,source,date,value,other\nu1,email,2026-01-01,\nu1,paid,2026-01-02,40\n";
    const auto = analyzeText(text);
    expect(auto.mapping).toMatchObject({ journey: "user_id", channel: "source", timestamp: "date", revenue: "value" });
    expect(credit(auto, "Last-touch", "paid")).toBe(40);
    const chosen = analyzeText(text, { mapping: { channel: "other", revenue: "" } });
    expect(chosen.unit).toBe("conversions");
    const missing = tryAnalyzeText(text, { mapping: { journey: "" } });
    expect(missing.status).toBe("missing");
  });

  it("reads a BOM and semicolon-delimited files", () => {
    const a = analyzeText("﻿Journey ID;Channel;Timestamp;Revenue\nj;a;2026-01-01;12,5\n");
    expect(a.result.totalValue).toBe(12.5);
  });
});

describe("revenue per journey", () => {
  const repeated = "j,a,2026-01-01,100\nj,b,2026-01-02,100\nj,c,2026-01-03,100\n";

  it("defaults to the first non-zero value, so a repeated value is counted once", () => {
    const a = run(repeated);
    expect(a.result.totalValue).toBe(100);
    expect(a.report.revenue.repeated).toBe(1);
    expect(a.report.totalsUnreliable).toEqual([]);
  });

  it("offers max, last and sum", () => {
    const rows = "j,a,2026-01-01,50\nj,b,2026-01-02,120\nj,c,2026-01-03,80\n";
    expect(run(rows, { revenueMode: "max" }).result.totalValue).toBe(120);
    expect(run(rows, { revenueMode: "last" }).result.totalValue).toBe(80);
    expect(run(rows, { revenueMode: "sum" }).result.totalValue).toBe(250);
  });

  it("marks totals unreliable when summing repeated or cumulative values", () => {
    expect(run(repeated, { revenueMode: "sum" }).report.totalsUnreliable[0]).toMatch(/summed/);
    const cumulative = run("j,a,2026-01-01,50\nj,b,2026-01-02,80\nj,c,2026-01-03,120\n", { revenueMode: "sum" });
    expect(cumulative.report.revenue.cumulative).toBe(1);
    expect(cumulative.report.totalsUnreliable).toHaveLength(1);
  });

  it("does not flag summing when every journey has one revenue row", () => {
    expect(run("j,a,2026-01-01,\nj,b,2026-01-02,100\n", { revenueMode: "sum" }).report.totalsUnreliable).toEqual([]);
  });

  it("ignores zero and negative rows outside sum mode and reports them", () => {
    const a = run("j,a,2026-01-01,0\nj,b,2026-01-02,(50)\nj,c,2026-01-03,100\n");
    expect(a.result.totalValue).toBe(100);
    expect(a.report.revenue.nonPositive).toBe(2);
  });
});

describe("conversion definition", () => {
  const mixed = "j1,a,2026-01-01,\nj1,b,2026-01-02,100\nj2,c,2026-01-01,\nj2,a,2026-01-02,\n";

  it("counts only journeys with revenue by default and reports the rest", () => {
    const a = run(mixed);
    expect(a.report).toMatchObject({
      conversionRule: "revenue",
      convertingJourneys: 1,
      nonConvertingJourneys: 1,
      nonConvertingTouches: 2,
    });
    expect(credit(a, "First-touch", "c")).toBe(0);
    expect(a.result.journeyCount).toBe(1);
    expect(a.report.totalsUnreliable).toEqual([]);
  });

  it("can count every journey, worth 1 beside revenue, and then says the units are mixed", () => {
    const a = run(mixed, { onlyRevenueConverts: false });
    expect(a.report).toMatchObject({ conversionRule: "all-mixed", mixedUnitsJourneys: 1 });
    expect(a.result.totalValue).toBe(101);
    expect(a.report.totalsUnreliable[0]).toMatch(/mix units/);
  });

  it("does not call a file with no revenue mixed", () => {
    const a = run("j,a,2026-01-01,\n", { onlyRevenueConverts: false });
    expect(a.report.totalsUnreliable).toEqual([]);
  });

  it("uses a converted column when mapped (yes, true, 1)", () => {
    const text =
      "journey_id,channel,timestamp,converted\nj1,a,2026-01-01,\nj1,b,2026-01-02,yes\nj2,a,2026-01-01,no\nj3,c,2026-01-01,1\nj4,d,2026-01-01,TRUE\n";
    const a = analyzeText(text);
    expect(a.report).toMatchObject({ conversionRule: "flag", convertingJourneys: 3, nonConvertingJourneys: 1 });
    expect(a.result.totalValue).toBe(3);
    expect(a.unit).toBe("conversions");
  });

  it("with converted and revenue, revenue is the value, and mismatches are reported", () => {
    const text =
      "journey_id,channel,timestamp,revenue,converted\nj1,a,2026-01-01,100,yes\nj2,a,2026-01-01,,yes\nj3,b,2026-01-01,70,no\nj4,b,2026-01-01,,no\n";
    const a = analyzeText(text);
    expect(a.result.totalValue).toBe(100);
    expect(a.report).toMatchObject({
      convertedNoRevenue: 1,
      revenueIgnoredOnNonConverted: 1,
      convertingJourneys: 2,
      nonConvertingJourneys: 2,
    });
  });

  it("counts every journey as one conversion with no revenue and no converted column", () => {
    const a = analyzeText("journey_id,channel\nj1,a\nj2,b\n");
    expect(a.report.conversionRule).toBe("all");
    expect(a.result.totalValue).toBe(2);
  });

  it("returns an empty result when nothing converts", () => {
    const a = run("j,a,2026-01-01,\n");
    expect(a.result.journeyCount).toBe(0);
  });
});

describe("timestamps", () => {
  it("never sorts a blank timestamp to the start of a journey", () => {
    const a = run("j,Email,2026-05-01,\nj,Paid Search,,\nj,Direct,2026-05-10,100\n");
    expect(credit(a, "First-touch", "Email")).toBe(100);
    expect(credit(a, "First-touch", "Paid Search")).toBe(0);
    expect(credit(a, "Time-decay", "Paid Search")).toBeGreaterThan(0);
    expect(a.report.dates).toMatchObject({ undatedJourneys: 1, undatedTouches: 1 });
  });

  it("reads date-only and datetime values as UTC", () => {
    const a = run("j,Email,2026-05-01,\nj,Paid Search,2026-05-01 01:00:00,100\n");
    expect(credit(a, "Last-touch", "Paid Search")).toBe(100);
  });

  it("detects day-first files and defaults ambiguous files to month first with a flag", () => {
    const dmy = run("j,a,13/03/2026,\nj,b,01/04/2026,100\n");
    expect(dmy.report.dates).toMatchObject({ order: "dmy", evidence: "day-first" });
    expect(credit(dmy, "Last-touch", "b")).toBe(100);
    const ambiguous = run("j,a,03/04/2026,\nj,b,05/04/2026,100\n");
    expect(ambiguous.report.dates).toMatchObject({ order: "mdy", evidence: "ambiguous" });
    const forced = run("j,a,05/04/2026,\nj,b,03/04/2026,100\n", { dateOrder: "dmy" });
    expect(forced.report.dates.order).toBe("dmy");
    expect(credit(forced, "Last-touch", "b")).toBe(0);
    expect(credit(forced, "Last-touch", "a")).toBe(100);
  });

  it("orders ties by file order and counts journeys with tied timestamps", () => {
    const ab = run("j,A,2026-05-01,\nj,B,2026-05-01,100\n");
    const ba = run("j,B,2026-05-01,\nj,A,2026-05-01,100\n");
    expect(credit(ab, "Last-touch", "B")).toBe(100);
    expect(credit(ba, "Last-touch", "A")).toBe(100);
    expect(ab.report.dates.tiedJourneys).toBe(1);
  });

  it("uses file order when there is no timestamp column and does not count undated journeys", () => {
    const a = analyzeText("journey_id,channel\nj,first\nj,last\n");
    expect(credit(a, "Last-touch", "last")).toBe(1);
    expect(a.report.dates).toMatchObject({ hasColumn: false, undatedJourneys: 0 });
  });
});

describe("revenue cell parsing", () => {
  it("reads currency and locale formats and lists unreadable cells", () => {
    const a = run(
      'j1,a,2026-01-01,"$12,500.00"\nj2,a,2026-01-01,"18,000"\nj3,a,2026-01-01,"9.600,00"\nj4,a,2026-01-01,TBD\nj5,a,2026-01-01,n/a\n',
    );
    expect(a.result.totalValue).toBe(12500 + 18000 + 9600);
    expect(a.report.revenue.unparseable).toBe(2);
    expect(a.report.revenue.examples).toEqual([
      { row: 5, journeyId: "j4", raw: "TBD" },
      { row: 6, journeyId: "j5", raw: "n/a" },
    ]);
    expect(a.report.revenue.currency).toBe("$");
    expect(a.report.totalsUnreliable[0]).toMatch(/could not be read/);
  });

  it("caps the example list", () => {
    const body = Array.from({ length: 15 }, (_, i) => `j${i},a,2026-01-01,x\n`).join("");
    const a = run(body);
    expect(a.report.revenue.unparseable).toBe(15);
    expect(a.report.revenue.examples).toHaveLength(10);
  });

  it("reads a decimal comma column", () => {
    expect(run('j,a,2026-01-01,"100,50"\n').result.totalValue).toBe(100.5);
  });
});

describe("data cleaning", () => {
  it("drops rows with no journey id and counts them", () => {
    const a = run(",a,2026-01-01,\nj,a,2026-01-01,5\n");
    expect(a.report.droppedNoJourney).toBe(1);
  });

  it("removes exact duplicate rows by default, and keeps them on request", () => {
    const body = "j,a,2026-01-01,\nj,a,2026-01-01,\nj,b,2026-01-02,100\n";
    const on = run(body);
    expect(on.result.touchpointCount).toBe(2);
    expect(on.report).toMatchObject({ duplicateRows: 1, dedupe: true });
    const off = run(body, { dedupe: false });
    expect(off.result.touchpointCount).toBe(3);
    expect(off.report).toMatchObject({ duplicateRows: 1, dedupe: false });
  });

  it("merges channel names by case and spacing, with a toggle, and reports the merges", () => {
    const body = "j,Paid Search,2026-01-01,\nj,paid search ,2026-01-02,20\nk,Paid Search,2026-01-01,50\n";
    const on = run(body);
    expect(on.result.channels).toEqual(["Paid Search"]);
    expect(on.report.channelMerges).toEqual([{ label: "Paid Search", variants: ["Paid Search", "paid search"] }]);
    expect(run(body, { normalizeChannels: false }).result.channels).toEqual(["Paid Search", "paid search "]);
  });

  it("scores a blank channel under its own label and reports it", () => {
    const a = run("j,,2026-01-01,100\n");
    expect(a.result.channels).toEqual(["(blank channel)"]);
    expect(a.report.blankChannelTouches).toBe(1);
  });
});

describe("touch type and lookback", () => {
  const text =
    "journey_id,channel,timestamp,revenue,touch_type\nj,Display,2026-01-01,,view\nj,Meta,2026-02-01,,click\nj,Brand,2026-03-01,100,click\nk,Display,2026-02-01,,impression\nk,Brand,2026-03-01,50,CLICK\nv,Display,2026-03-01,70,view-through\n";

  it("keeps view-through touches by default and excludes them on request, with a count", () => {
    const keep = analyzeText(text);
    expect(credit(keep, "First-touch", "Display")).toBe(100 + 50 + 70);
    const drop = analyzeText(text, { keepViews: false });
    expect(drop.report.views).toMatchObject({ excluded: 3, emptiedJourneys: 1, keep: false });
    expect(credit(drop, "First-touch", "Display")).toBe(0);
    expect(credit(drop, "First-touch", "Meta")).toBe(100);
    expect(drop.result.journeyCount).toBe(2);
    expect(drop.report.convertingJourneys).toBe(3);
  });

  it("measures the lookback window back from the last touch of each journey", () => {
    const a = analyzeText(text, { lookbackDays: 30 });
    // j: Meta is 28 days before the last touch (kept), Display is 59 days back (dropped). k is 28 days back (kept).
    expect(a.report.lookback).toEqual({ days: 30, excludedTouches: 1, journeysAffected: 1 });
    expect(credit(a, "First-touch", "Meta")).toBe(100);
    expect(credit(a, "First-touch", "Display")).toBe(50 + 70);
  });

  it("applies no lookback by default", () => {
    expect(analyzeText(text).report.lookback).toEqual({ days: null, excludedTouches: 0, journeysAffected: 0 });
  });

  it("uses the half-life option in time-decay", () => {
    const body = "journey_id,channel,timestamp\nj,a,2026-01-01\nj,b,2026-01-08\n";
    const seven = analyzeText(body);
    const fourteen = analyzeText(body, { halfLifeDays: 14 });
    expect(credit(seven, "Time-decay", "a")).toBeCloseTo(1 / 3, 10);
    expect(credit(fourteen, "Time-decay", "a")).toBeGreaterThan(credit(seven, "Time-decay", "a"));
  });
});
