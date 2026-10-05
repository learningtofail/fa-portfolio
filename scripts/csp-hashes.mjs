// Prints the CSP hashes for the built site's inline scripts and styles (Astro island hydration).
//   node scripts/csp-hashes.mjs [--dist dist]              print the hashes
//   node scripts/csp-hashes.mjs --check docs/caddy/Caddyfile.proposed.md   exit 1 when the file lacks a current hash
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { collectHashes } from "./csp/hashes.mjs";

const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const dist = flag("--dist") || "dist";
const checkFile = flag("--check");

/** @param {string} dir @returns {string[]} */
function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    // /marketing/ is vendored output with its own CSP (docs/decisions/0007), not part of the Astro policy.
    if (full === path.join(dist, "marketing")) return [];
    if (statSync(full).isDirectory()) return htmlFiles(full);
    return full.endsWith(".html") ? [full] : [];
  });
}

const { scriptHashes, styleHashes } = collectHashes(htmlFiles(dist).map((f) => readFileSync(f, "utf8")));

if (checkFile) {
  const text = readFileSync(checkFile, "utf8");
  const missing = [...scriptHashes, ...styleHashes].filter((h) => !text.includes(h));
  if (missing.length > 0) {
    console.error(`${checkFile} is missing current CSP hashes:\n  ${missing.join("\n  ")}`);
    process.exit(1);
  }
  console.log(
    `CSP hashes in ${checkFile} match the build (${scriptHashes.length} script, ${styleHashes.length} style).`,
  );
} else {
  console.log(`script-src ${scriptHashes.join(" ")}`);
  console.log(`style-src ${styleHashes.join(" ")}`);
}
