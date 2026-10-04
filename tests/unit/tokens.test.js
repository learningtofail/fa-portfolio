import { SOURCE_FILES, buildVendored, reduceFile, sha256 } from "../../scripts/tokens/build.mjs";

const colors = [
  ":root {",
  "  --white: #FFFFFF;",
  "  /* ── Accent ── */",
  "  --primary: var(--blue-light);",
  "  --background: var(--bg-e);",
  "}",
  "",
].join("\n");

describe("token vendoring transform", () => {
  it("strips the Google Fonts @import", () => {
    const out = reduceFile('/* c */\n@import url("https://fonts.googleapis.com/css2?x");\n:root { --a: 1; }\n', {
      stripImports: true,
    });
    expect(out).not.toContain("@import");
    expect(out).toContain("--a: 1");
  });

  it("keeps the palette and drops the dark surface semantics after the cut marker", () => {
    const out = reduceFile(colors, { cutBefore: "/* ── Accent ── */" });
    expect(out).toContain("--white");
    expect(out).not.toContain("--primary");
    expect(out).not.toContain("--background");
    expect(out.trimEnd().endsWith("}")).toBe(true);
  });

  it("fails loudly when an upstream marker disappears", () => {
    expect(() => reduceFile("a", { cutBefore: "missing" })).toThrow(/Marker not found/);
  });

  it("is deterministic and records the pinned sha in the header", () => {
    const contents = Object.fromEntries(SOURCE_FILES.map((f) => [f.path, f.cutBefore ? colors : ":root {}\n"]));
    const a = buildVendored("abc123", contents);
    expect(a).toBe(buildVendored("abc123", contents));
    expect(a).toContain("abc123");
    expect(sha256(a)).toHaveLength(64);
  });

  it("refuses to build when an upstream file is missing", () => {
    expect(() => buildVendored("abc", {})).toThrow(/Missing upstream file/);
  });
});
