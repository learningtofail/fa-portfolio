import { detectAmountLocale, detectCurrency, parseAmount } from "../../../src/lib/attribution/numbers.js";

const value = (raw, locale) => parseAmount(raw, locale).value;

describe("parseAmount", () => {
  it.each([
    ["12500", 12500],
    ["$12,500.00", 12500],
    ["18,000", 18000],
    ["9.600,00", 9600],
    ["100,50", 100.5],
    ["1,234,567", 1234567],
    ["1.234.567", 1234567],
    ["1,234.5", 1234.5],
    ["€ 1 250,75", 1250.75],
    ["USD 40", 40],
    ["40 CAD", 40],
    ["(50)", -50],
    ["-50", -50],
    ["50-", -50],
    ["$-50", -50],
    ["+7", 7],
    ["0.5", 0.5],
    [".5", 0.5],
    ["0,500", 0.5],
    ["1,5", 1.5],
  ])("reads %s as %d", (raw, expected) => expect(value(raw)).toBeCloseTo(expected, 10));

  it("reads an ambiguous single separator by the column locale", () => {
    expect(value("1,500", "dot")).toBe(1500);
    expect(value("1,500", "comma")).toBe(1.5);
    expect(value("1.500", "dot")).toBe(1.5);
    expect(value("1.500", "comma")).toBe(1500);
  });

  it("treats blanks and a lone dash as blank", () => {
    for (const raw of ["", "  ", "-", "—", undefined])
      expect(parseAmount(raw)).toEqual({ status: "blank", value: null });
  });

  it.each(["n/a", "TBD", "12k", "1,2,3", "1.2.3,4", "1,234.567.8", "--5", "5 5 x", "1,2345,6"])(
    "flags %s as invalid",
    (raw) => {
      expect(parseAmount(raw)).toEqual({ status: "invalid", value: null });
    },
  );
});

describe("detectAmountLocale", () => {
  it("votes for a decimal comma from clear cells", () => {
    expect(detectAmountLocale(["100,50", "1,500"])).toBe("comma");
    expect(detectAmountLocale(["1.234.567", "12"])).toBe("comma");
    expect(detectAmountLocale(["9.600,00"])).toBe("comma");
  });

  it("defaults to a dot, also on ties and for text", () => {
    expect(detectAmountLocale(["$12,500.00", "9.600,00"])).toBe("dot");
    expect(detectAmountLocale(["18,000", "n/a", ""])).toBe("dot");
    expect(detectAmountLocale(["1,234,567", "12.50"])).toBe("dot");
    expect(detectAmountLocale([])).toBe("dot");
  });
});

describe("detectCurrency", () => {
  it("finds a symbol or a code", () => {
    expect(detectCurrency(["", "12", "$5"])).toBe("$");
    expect(detectCurrency(["CAD 10"])).toBe("CAD");
    expect(detectCurrency(["10 eur"])).toBe("EUR");
  });

  it("is empty when there is none", () => {
    expect(detectCurrency(["10", "n/a", ""])).toBe("");
  });
});
