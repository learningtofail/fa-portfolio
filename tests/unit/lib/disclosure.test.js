import { checkItems, checkText, copyFromRows, splitLines } from "../../../src/lib/disclosure/check.js";
import { RULESETS } from "../../../src/lib/disclosure/rulesets.js";

describe("rulesets", () => {
  it("define labelled patterns for the four categories", () => {
    expect(Object.keys(RULESETS)).toEqual(["affiliate", "regulatedHealth", "cannabis", "financial"]);
    for (const ruleset of Object.values(RULESETS)) {
      expect(ruleset.label).toBeTruthy();
      expect(ruleset.patterns.length).toBeGreaterThan(0);
    }
  });
});

describe("checkText (D1 age patterns)", () => {
  it.each([
    ["Must be 19+ to enter", "19+"],
    ["19+ only", "19+"],
    ["(19+)", "19+"],
    ["You must be 21+ to enter.", "21+"],
    ["21+", "21+"],
  ])("finds %j", (text, label) => {
    expect(checkText(text, "cannabis")).toEqual({ pass: true, matched: [label] });
  });

  it.each(["Now 119+ flavours", "Over 219+ stores", "Call 19 times", "a21+"])("does not match %j", (text) => {
    expect(checkText(text, "cannabis").pass).toBe(false);
  });

  it("reports every pattern that matched", () => {
    expect(checkText("Sponsored by Acme #ad", "affiliate")).toEqual({
      pass: true,
      matched: ["#ad", '"sponsored by"'],
    });
  });

  it("throws on an unknown ruleset", () => {
    expect(() => checkText("x", "nope")).toThrow(/Unknown ruleset/);
  });
});

describe("splitLines, copyFromRows and checkItems", () => {
  it("splits pasted text into trimmed non-empty lines", () => {
    expect(splitLines("  a \n\n b\n   \n")).toEqual(["a", "b"]);
    expect(splitLines("")).toEqual([]);
  });

  it("reads the copy, then text, then content column and drops blanks", () => {
    expect(
      copyFromRows([{ copy: "one", text: "x" }, { text: "two" }, { content: "three" }, { copy: "  " }, { other: "y" }]),
    ).toEqual(["one", "two", "three"]);
  });

  it("numbers results by line, keeping duplicates distinct", () => {
    const results = checkItems(["Great #ad", "Great #ad", "Plain"], "affiliate");
    expect(results.map((r) => r.id)).toEqual(["line-1", "line-2", "line-3"]);
    expect(results.map((r) => r.pass)).toEqual([true, true, false]);
  });
});
