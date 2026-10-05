import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const DIR = resolve("public/marketing");
const FILES = readdirSync(DIR).filter((f) => f.endsWith(".html"));

describe("vendored marketing tools", () => {
  it("has 21 pages, none of them the directory page", () => {
    expect(FILES).toHaveLength(21);
    expect(FILES).not.toContain("index.html");
  });

  it.each(FILES)("%s is self-contained, has no outside links and no consultancy brand", (file) => {
    const html = readFileSync(join(DIR, file), "utf8");
    expect(html).toMatch(/<h1[^>]*>[^<]+<\/h1>/);
    // Inline code can mention tags in strings (the GTM auditor does), so look at the markup around it.
    const markup = html.replace(/<script>[\s\S]*?<\/script>/g, "").replace(/<style>[\s\S]*?<\/style>/g, "");
    expect(markup).not.toMatch(/<(script|link|img|iframe)[^>]+(src|href)="https?:/i);
    expect(html).not.toMatch(/(fetch|XMLHttpRequest|sendBeacon|WebSocket)\s*\(/);
    expect(html).not.toContain('href="index.html"');
    expect(html.toLowerCase()).not.toContain("gibran");
  });
});
