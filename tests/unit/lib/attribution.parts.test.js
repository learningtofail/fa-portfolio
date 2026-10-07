import { BLANK_CHANNEL, buildChannelLabels } from "../../../src/lib/attribution/channels.js";
import { parseHalfLifeDays, parseLookbackDays } from "../../../src/lib/attribution/inputs.js";
import { orderTouches } from "../../../src/lib/attribution/order.js";
import { journeyRevenue, revenuePattern } from "../../../src/lib/attribution/revenue.js";

const touch = (channel, time, index) => ({ channel, time, index });
const names = (r) => r.ordered.map((t) => t.channel);

describe("orderTouches", () => {
  it("sorts by time, breaking ties by file order", () => {
    const r = orderTouches([touch("c", 5, 0), touch("a", 1, 1), touch("b", 5, 2)]);
    expect(names(r)).toEqual(["a", "c", "b"]);
    expect(r).toMatchObject({ undated: 0, tied: true });
  });

  it("keeps an undated touch next to the dated touch before it, not at 1970", () => {
    const r = orderTouches([touch("email", 100, 0), touch("search", null, 1), touch("direct", 200, 2)]);
    expect(names(r)).toEqual(["email", "search", "direct"]);
    expect(r).toMatchObject({ undated: 1, tied: false });
    expect(r.ordered[1].time).toBe(100);
  });

  it("puts a leading undated touch before the first dated one", () => {
    expect(names(orderTouches([touch("x", null, 0), touch("a", 50, 1), touch("b", 60, 2)]))).toEqual(["x", "a", "b"]);
  });

  it("keeps file order when nothing is dated", () => {
    const r = orderTouches([touch("a", null, 0), touch("b", null, 1)]);
    expect(names(r)).toEqual(["a", "b"]);
    expect(r.undated).toBe(2);
    expect(r.tied).toBe(false);
  });
});

describe("buildChannelLabels", () => {
  const raws = ["Paid Search", "paid search", "Paid Search", " organic search ", "Organic Search", "Direct", "Direct"];

  it("merges case and spacing variants under the most common spelling and lists the merges", () => {
    const { label, merges } = buildChannelLabels(raws, true);
    expect(label("paid  SEARCH")).toBe("Paid Search");
    expect(label("organic search ")).toBe("organic search");
    expect(label("Direct")).toBe("Direct");
    expect(merges).toEqual([
      { label: "Paid Search", variants: ["Paid Search", "paid search"] },
      { label: "organic search", variants: ["organic search", "Organic Search"] },
    ]);
  });

  it("leaves names alone when off, and labels blanks either way", () => {
    const off = buildChannelLabels(raws, false);
    expect(off.label("paid search")).toBe("paid search");
    expect(off.merges).toEqual([]);
    expect(off.label("  ")).toBe(BLANK_CHANNEL);
    expect(buildChannelLabels(["", "a"], true).label("")).toBe(BLANK_CHANNEL);
  });

  it.each(["constructor", "__proto__"])("handles a channel named %s (D2)", (name) => {
    expect(buildChannelLabels([name], true).label(name)).toBe(name);
  });
});

describe("journeyRevenue", () => {
  const amounts = [50, 80, 120];
  it("picks one value by mode", () => {
    expect(journeyRevenue(amounts, "first")).toBe(50);
    expect(journeyRevenue(amounts, "max")).toBe(120);
    expect(journeyRevenue(amounts, "last")).toBe(120);
    expect(journeyRevenue(amounts, "sum")).toBe(250);
    expect(journeyRevenue([30, 90, 60], "last")).toBe(60);
  });

  it("ignores zero and negative rows except when summing, where refunds net", () => {
    expect(journeyRevenue([0, -50, 100], "first")).toBe(100);
    expect(journeyRevenue([-50], "first")).toBe(0);
    expect(journeyRevenue([100, -30], "sum")).toBe(70);
    expect(journeyRevenue([100, -150], "sum")).toBe(0);
    expect(journeyRevenue([], "max")).toBe(0);
  });
});

describe("revenuePattern", () => {
  it("tells repeated, cumulative and unrelated values apart", () => {
    expect(revenuePattern([])).toBe("none");
    expect(revenuePattern([0, -5])).toBe("none");
    expect(revenuePattern([0, 100])).toBe("single");
    expect(revenuePattern([100, 100, 100])).toBe("repeated");
    expect(revenuePattern([50, 80, 120])).toBe("cumulative");
    expect(revenuePattern([120, 50])).toBe("varied");
  });
});

describe("input parsing", () => {
  it("lookback: blank, zero, negative and text mean no limit", () => {
    expect(parseLookbackDays("30")).toBe(30);
    expect(parseLookbackDays(" 7.5 ")).toBe(7.5);
    for (const t of ["", " ", "0", "-3", "abc"]) expect(parseLookbackDays(t)).toBeNull();
  });

  it("half-life: invalid values fall back to 7", () => {
    expect(parseHalfLifeDays("14")).toBe(14);
    for (const t of ["", "0", "-1", "x"]) expect(parseHalfLifeDays(t)).toBe(7);
  });
});
