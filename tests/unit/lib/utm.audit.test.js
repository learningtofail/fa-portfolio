import {
  auditRows,
  detectSeparatorStyle,
  extractUtmFromUrl,
  ISSUE_LABELS,
  normalizeUtmRow,
  summarizeIssues,
} from "../../../src/lib/utm/audit.js";

/** Builds a UtmRow with sensible defaults. */
const row = (over = {}) => ({
  url: "",
  source: "google",
  medium: "cpc",
  campaign: "spring-sale",
  term: "",
  content: "",
  ...over,
});
const types = (issues) => issues.map((i) => i.type);

describe("extractUtmFromUrl and normalizeUtmRow", () => {
  it("reads utm parameters from a URL and tolerates a bad URL", () => {
    expect(
      extractUtmFromUrl("https://x.com/?utm_source=g&utm_medium=cpc&utm_campaign=c&utm_term=t&utm_content=ct"),
    ).toEqual({
      source: "g",
      medium: "cpc",
      campaign: "c",
      term: "t",
      content: "ct",
    });
    expect(extractUtmFromUrl("not a url")).toEqual({ source: "", medium: "", campaign: "", term: "", content: "" });
  });

  it("prefers the url column over utm columns", () => {
    expect(normalizeUtmRow({ url: "https://x.com/?utm_source=fromurl", utm_source: "column" })).toMatchObject({
      url: "https://x.com/?utm_source=fromurl",
      source: "fromurl",
    });
  });

  it("falls back to utm_* columns, then bare column names, then empty", () => {
    expect(
      normalizeUtmRow({ utm_source: "a", utm_medium: "b", utm_campaign: "c", utm_term: "d", utm_content: "e" }),
    ).toEqual({
      url: "",
      source: "a",
      medium: "b",
      campaign: "c",
      term: "d",
      content: "e",
    });
    expect(normalizeUtmRow({ source: "a", medium: "b", campaign: "c", term: "d", content: "e" }).content).toBe("e");
    expect(normalizeUtmRow({})).toEqual({ url: "", source: "", medium: "", campaign: "", term: "", content: "" });
  });
});

describe("detectSeparatorStyle", () => {
  it.each([
    ["", null],
    ["plain", "none"],
    ["a-b", "hyphen"],
    ["a_b", "underscore"],
    ["a.b", "dot"],
    ["a-b_c", "mixed-within-value"],
  ])("%j is %s", (value, style) => expect(detectSeparatorStyle(value)).toBe(style));
});

describe("auditRows", () => {
  it("passes a clean file", () => {
    expect(auditRows([row(), row({ source: "bing" })])).toEqual([]);
  });

  it("flags each missing required field", () => {
    const issues = auditRows([row({ source: "", medium: "", campaign: "" })]);
    expect(issues.map((i) => i.detail)).toEqual(["Missing utm_source", "Missing utm_medium", "Missing utm_campaign"]);
  });

  it("flags whitespace and invalid characters, including in optional fields", () => {
    const issues = auditRows([row({ campaign: "spring sale", term: "a/b" })]);
    expect(types(issues)).toEqual(["whitespace", "invalid_chars", "invalid_chars"]);
    expect(issues.map((i) => i.field)).toEqual(["campaign", "campaign", "term"]);
  });

  it("flags casing drift on every row that shares the value", () => {
    const issues = auditRows([row({ source: "Google" }), row({ source: "google" })]);
    expect(types(issues)).toEqual(["casing_drift", "casing_drift"]);
    expect(issues[0].detail).toMatch(/2 casing variants.*Google, google/);
  });

  it("flags campaigns that break the majority separator style, and ignores plain words", () => {
    const issues = auditRows([
      row({ campaign: "spring-sale" }),
      row({ campaign: "summer-sale" }),
      row({ campaign: "fall_sale" }),
      row({ campaign: "winter" }),
    ]);
    expect(types(issues)).toEqual(["separator_drift"]);
    expect(issues[0]).toMatchObject({ rowIndex: 2, field: "campaign" });
  });

  it("flags one campaign tuple that points at different URLs", () => {
    const issues = auditRows([
      row({ url: "https://a.com" }),
      row({ url: "https://b.com" }),
      row({ url: "https://a.com" }),
    ]);
    expect(types(issues)).toEqual(["duplicate_tuple", "duplicate_tuple", "duplicate_tuple"]);
    expect(issues[0].detail).toMatch(/2 different URLs/);
  });

  it("does not treat rows without a url as destinations", () => {
    expect(auditRows([row(), row()])).toEqual([]);
  });

  it("gives every issue a unique id", () => {
    const issues = auditRows([row({ source: "", campaign: "a b" }), row({ source: "G" }), row({ source: "g" })]);
    expect(new Set(issues.map((i) => i.id)).size).toBe(issues.length);
  });

  it.each(["constructor", "__proto__", "toString", "hasOwnProperty"])("handles a value named %s (D2)", (name) => {
    const issues = auditRows([row({ source: name }), row({ source: name.toUpperCase() })]);
    expect(types(issues)).toEqual(["casing_drift", "casing_drift"]);
  });
});

describe("summarizeIssues", () => {
  it("counts rows with issues, the rate, and per-category totals in label order", () => {
    const issues = auditRows([row({ source: "" }), row(), row({ campaign: "a b" })]);
    const summary = summarizeIssues(issues, 3);
    expect(summary.rowsWithIssues).toBe(2);
    expect(summary.issueRate).toBe("67%");
    expect(summary.byCategory.map((c) => c.label)).toEqual(Object.values(ISSUE_LABELS));
    expect(summary.byCategory.find((c) => c.label === ISSUE_LABELS.missing_required).value).toBe(1);
  });

  it("reports 0% for an empty file", () => {
    expect(summarizeIssues([], 0).issueRate).toBe("0%");
  });
});
