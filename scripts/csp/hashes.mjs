// Content Security Policy hashes for the inline code Astro emits. Pure helpers, no I/O.
import { createHash } from "node:crypto";

/** @param {string} body @returns {string} CSP source expression for an inline script or style body. */
export const cspHash = (body) => `'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`;

/**
 * Inline script and style bodies in an HTML document. External scripts (`src`) and JSON data blocks are skipped.
 * @param {string} html
 * @returns {{ scripts: string[], styles: string[] }}
 */
export function inlineCode(html) {
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(([, attrs]) => !/type="(application\/(ld\+)?json|importmap)"/.test(attrs))
    .map(([, , body]) => body);
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(([, body]) => body);
  return { scripts, styles };
}

/**
 * Unique, sorted hashes across many documents.
 * @param {string[]} documents HTML sources.
 * @returns {{ scriptHashes: string[], styleHashes: string[] }}
 */
export function collectHashes(documents) {
  const scriptHashes = new Set();
  const styleHashes = new Set();
  for (const html of documents) {
    const { scripts, styles } = inlineCode(html);
    scripts.forEach((body) => scriptHashes.add(cspHash(body)));
    styles.forEach((body) => styleHashes.add(cspHash(body)));
  }
  return { scriptHashes: [...scriptHashes].sort(), styleHashes: [...styleHashes].sort() };
}
