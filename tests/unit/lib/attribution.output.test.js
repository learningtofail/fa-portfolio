import Papa from "papaparse";
import { downloadText } from "../../../src/lib/download.js";
import { MODELS } from "../../../src/lib/attribution/compute.js";
import { methodNote, qualityNotes, revenueNote } from "../../../src/lib/attribution/notes.js";
import {
  formatCredit,
  formatShare,
  matrixCsv,
  modelTotal,
  rankByModel,
  shareFor,
  unitLabel,
} from "../../../src/lib/attribution/output.js";
import { analyzeText } from "./attributionHelpers.js";

// j1: email then paid (100). j2: paid only (50). j3: email only (50).
const A = analyzeText(
  "journey_id,channel,timestamp,revenue\nj1,email,2026-01-01,\nj1,paid,2026-01-02,100\nj2,paid,2026-01-02,50\nj3,email,2026-01-03,50\n",
);

describe("shares, totals and ranks", () => {
  it("totals each model and computes shares", () => {
    for (const m of MODELS) expect(modelTotal(A.result, m)).toBeCloseTo(200, 8);
    expect(shareFor(A.result, "Last-touch", "paid")).toBeCloseTo(0.75, 10);
    expect(shareFor(A.result, "First-touch", "email")).toBeCloseTo(0.75, 10);
  });

  it("has a zero share when a model has no credit", () => {
    const empty = analyzeText("journey_id,channel,revenue\nj,a,\n");
    expect(shareFor(empty.result, "Linear", "a")).toBe(0);
  });

  it("ranks channels per model with a spread, sharing a rank on equal credit", () => {
    // Last-touch: paid 150, email 50. First-touch: email 150, paid 50.
    const ranks = Object.fromEntries(rankByModel(A.result).map((r) => [r.channel, r]));
    expect(ranks.paid.ranks.get("Last-touch")).toBe(1);
    expect(ranks.paid.ranks.get("First-touch")).toBe(2);
    expect(ranks.email.ranks.get("First-touch")).toBe(1);
    expect(ranks.email.spread).toBe(1);
    const tie = analyzeText("journey_id,channel\nj1,a\nj2,b\nj3,c\nj3,c\n", { dedupe: false });
    const tied = Object.fromEntries(rankByModel(tie.result).map((r) => [r.channel, r.ranks.get("First-touch")]));
    expect(tied).toEqual({ a: 1, b: 1, c: 1 });
  });
});

describe("formatting", () => {
  it("shows revenue with two decimals and conversions without trailing zeros", () => {
    expect(formatCredit(5980, "revenue")).toBe("5,980.00");
    expect(formatCredit(2, "conversions")).toBe("2");
    expect(formatCredit(1 / 3, "conversions")).toBe("0.33");
    expect(formatShare(0.3125)).toBe("31.3%");
  });

  it("labels the unit", () => {
    expect(unitLabel("conversions", "$")).toBe("conversions");
    expect(unitLabel("revenue", " CAD ")).toBe("revenue (CAD)");
    expect(unitLabel("revenue", "")).toBe("revenue (currency not set)");
  });
});

describe("matrixCsv", () => {
  it("has credit and share columns per model, a total row, and a unit", () => {
    const parsed = Papa.parse(matrixCsv(A.result, "revenue", "$"), { header: true });
    expect(parsed.meta.fields).toHaveLength(1 + MODELS.length * 2);
    expect(parsed.meta.fields[1]).toBe("Last-touch (revenue ($))");
    const total = parsed.data.find((r) => r.Channel === "Total");
    expect(Number(total["Last-touch (revenue ($))"])).toBeCloseTo(200, 5);
    expect(total["Last-touch share"]).toBe("100.0%");
    const paid = parsed.data.find((r) => r.Channel === "paid");
    expect(paid["Last-touch share"]).toBe("75.0%");
  });

  it("escapes channel names that start like a formula", () => {
    const a = analyzeText("journey_id,channel,revenue\nj,=cmd|x,10\n");
    expect(matrixCsv(a.result, "revenue", "")).toMatch(/'=cmd/);
  });
});

describe("notes", () => {
  const ids = (a) => qualityNotes(a.report).map((n) => n.id);

  it("states the conversion rule and the timestamp zone", () => {
    expect(ids(A)).toEqual(expect.arrayContaining(["conversion-rule", "utc", "revenue-format"]));
    const text = qualityNotes(A.report)
      .map((n) => n.text)
      .join(" ");
    expect(text).toMatch(/Only journeys with revenue count as conversions/);
    expect(text).toMatch(/UTC/);
  });

  it("puts warnings before information", () => {
    const messy = analyzeText("journey_id,channel,timestamp\n,a,2026-01-01\nj,a,x\n");
    const levels = qualityNotes(messy.report).map((n) => n.level);
    expect(levels).toEqual([...levels].sort((a, b) => (a === b ? 0 : a === "warning" ? -1 : 1)));
    expect(levels[0]).toBe("warning");
  });

  it("says every journey is a conversion when nothing defines one", () => {
    const a = analyzeText("journey_id,channel\nj,a\n");
    const note = qualityNotes(a.report).find((n) => n.id === "conversion-rule");
    expect(note).toMatchObject({ level: "warning" });
    expect(note.text).toMatch(/every journey is counted as one conversion/);
    expect(ids(a)).toContain("no-timestamp");
  });

  it("covers every cleaning and revenue note when its condition holds", () => {
    const text = [
      "journey_id,channel,timestamp,revenue,converted,touch_type",
      "j1,Email,13/03/2026,100,yes,view",
      "j1,email,13/03/2026,100,yes,click",
      "j1,email,,100,yes,click",
      "j1,,2026-03-15,(5),yes,click",
      "j1,,2026-03-15,(5),yes,click",
      "j1,X,03/13/2026,TBD,yes,click",
      ",X,2026-03-15,,,",
      "j2,Y,2026-03-15,7,no,click",
      "j3,Y,2026-03-15,,yes,click",
      "j4,V,2026-03-15,60,yes,view",
      "j5,V,2026-03-15,50,yes,click",
      "j5,V,2026-03-15,90,yes,click",
    ].join("\n");
    const a = analyzeText(text, { keepViews: false, lookbackDays: 1 });
    const found = ids(a);
    for (const id of [
      "converted-no-revenue",
      "revenue-ignored",
      "revenue-multi",
      "revenue-unparseable",
      "revenue-nonpositive",
      "date-conflict",
      "undated",
      "ties",
      "dropped",
      "duplicates",
      "blank-channel",
      "merge-email",
      "views",
      "lookback",
    ]) {
      expect(found).toContain(id);
    }
    expect(qualityNotes(a.report).find((n) => n.id === "views").text).toMatch(/left 1 journey with no touches/);
  });

  it("covers sum-mode, date-order, ambiguity, kept duplicates and mixed units wording", () => {
    const sum = analyzeText(
      "journey_id,channel,timestamp,revenue\nj,a,03/04/2026,100\nj,b,05/04/2026,100\nk,a,2026-01-01,\n",
      {
        revenueMode: "sum",
        dedupe: false,
        onlyRevenueConverts: false,
      },
    );
    const text = qualityNotes(sum.report)
      .map((n) => n.text)
      .join(" | ");
    expect(text).toMatch(/Revenue is summed across rows/);
    expect(text).toMatch(/could be read either way/);
    expect(text).toMatch(/without revenue count as 1/);
    const dup = analyzeText("journey_id,channel,timestamp\nj,a,2026-01-01\nj,a,2026-01-01\n", { dedupe: false });
    expect(qualityNotes(dup.report).find((n) => n.id === "duplicates").text).toMatch(/kept/);
    const dayFirst = analyzeText("journey_id,channel,timestamp\nj,a,13/01/2026\n");
    expect(qualityNotes(dayFirst.report).find((n) => n.id === "date-order").text).toMatch(/day first/);
  });

  it("states the weights, the half-life and the revenue default", () => {
    expect(methodNote(7)).toMatch(/40\/20\/40/);
    expect(methodNote(7)).toMatch(/50\/50 for two touches/);
    expect(methodNote(30)).toMatch(/every 30 days/);
    expect(revenueNote("first")).toMatch(/first non-zero value.*the default/);
    expect(revenueNote("sum")).toMatch(/sum of its rows/);
    expect(revenueNote("max")).toMatch(/largest/);
    expect(revenueNote("last")).toMatch(/last non-zero/);
  });
});

describe("downloadText", () => {
  it("clicks a temporary link and revokes the object URL", () => {
    const calls = [];
    const link = { click: () => calls.push("click"), remove: () => calls.push("remove") };
    const env = {
      document: { createElement: () => link, body: { append: () => calls.push("append") } },
      url: { createObjectURL: () => "blob:x", revokeObjectURL: (u) => calls.push(`revoke ${u}`) },
    };
    downloadText("a.csv", "x", undefined, /** @type {any} */ (env));
    expect(link).toMatchObject({ href: "blob:x", download: "a.csv" });
    expect(calls).toEqual(["append", "click", "remove", "revoke blob:x"]);
  });

  it("uses the browser by default", () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    URL.createObjectURL = () => "blob:y";
    URL.revokeObjectURL = () => {};
    downloadText("b.csv", "y");
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });
});
