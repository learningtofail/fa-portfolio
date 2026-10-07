import {
  describeParseWarnings,
  lowercaseKeys,
  normalizeHeader,
  parseCsvFile,
  readFileText,
} from "../../../src/lib/csv.js";

describe("lowercaseKeys", () => {
  it("trims and lowercases headers", () => {
    expect({ ...lowercaseKeys({ " UTM_Source ": "google", Medium: "cpc" }) }).toEqual({
      utm_source: "google",
      medium: "cpc",
    });
  });

  it("returns a prototype-free object so hostile headers are plain keys (D2)", () => {
    const row = lowercaseKeys({ constructor: "x", __proto__: "y", toString: "z" });
    expect(Object.getPrototypeOf(row)).toBeNull();
    expect(row.constructor).toBe("x");
    expect(row.tostring).toBe("z");
  });
});

describe("describeParseWarnings", () => {
  it("is empty without errors, and ignores the informational Delimiter notice", () => {
    expect(describeParseWarnings(undefined)).toBe("");
    expect(describeParseWarnings([])).toBe("");
    expect(describeParseWarnings([{ type: "Delimiter", message: "Unable to auto-detect delimiting character" }])).toBe(
      "",
    );
  });

  it("counts real errors and quotes the first", () => {
    const message = describeParseWarnings([
      { type: "Quotes", message: "Quoted field unterminated" },
      { type: "FieldMismatch", message: "Too few fields" },
    ]);
    expect(message).toMatch(/Parsed with 2 warning\(s\)/);
    expect(message).toMatch(/First: Quoted field unterminated/);
  });
});

describe("parseCsvFile and readFileText", () => {
  it("parses rows with lowercased headers and skips empty lines", async () => {
    const file = new File(["Name,Value\na,1\n\nb,2\n"], "x.csv", { type: "text/csv" });
    const { rows, warning } = await parseCsvFile(file);
    expect(rows.map((r) => ({ ...r }))).toEqual([
      { name: "a", value: "1" },
      { name: "b", value: "2" },
    ]);
    expect(warning).toBe("");
  });

  it("returns the normalized headers, strips a BOM and reads semicolons", async () => {
    const file = new File(["\uFEFFJourney ID ;Value\nj;1\n"], "x.csv", { type: "text/csv" });
    const { rows, headers } = await parseCsvFile(file);
    expect(headers).toEqual(["journey id", "value"]);
    expect({ ...rows[0] }).toEqual({ "journey id": "j", value: "1" });
    expect(normalizeHeader("\uFEFF Name ")).toBe("name");
  });

  it("reports a malformed row as a warning", async () => {
    const { warning } = await parseCsvFile(new File(['a,b\n"unterminated,1\n'], "bad.csv"));
    expect(warning).toMatch(/warning/);
  });

  it("reads a file as text", async () => {
    expect(await readFileText(new File(["hello"], "h.txt"))).toBe("hello");
  });

  it("rejects when the file cannot be read", async () => {
    const original = globalThis.FileReader;
    globalThis.FileReader = /** @type {any} */ (
      class {
        /** @type {(() => void) | undefined} */
        onerror;
        readAsText() {
          queueMicrotask(() => this.onerror?.());
        }
      }
    );
    try {
      await expect(readFileText(new File(["x"], "x.txt"))).rejects.toThrow(/Could not read/);
    } finally {
      globalThis.FileReader = original;
    }
  });
});
