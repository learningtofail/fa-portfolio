import { RULESETS } from "./rulesets.js";

/** @typedef {{ id: string, text: string, pass: boolean, matched: string[] }} CheckResult */

/**
 * @param {string} text One piece of copy.
 * @param {string} rulesetKey Key of `RULESETS`.
 * @returns {{ pass: boolean, matched: string[] }} Pass means at least one disclosure phrase was found.
 * @throws {Error} For an unknown ruleset key.
 */
export function checkText(text, rulesetKey) {
  const ruleset = RULESETS[rulesetKey];
  if (!ruleset) throw new Error(`Unknown ruleset: ${rulesetKey}`);
  const matched = ruleset.patterns.filter((p) => p.re.test(text));
  return { pass: matched.length > 0, matched: matched.map((m) => m.label) };
}

/**
 * Splits pasted text into one item per non-empty line.
 * @param {string} pasted
 * @returns {string[]}
 */
export function splitLines(pasted) {
  return pasted
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Picks the copy column out of CSV rows (lowercased headers): `copy`, else `text`, else `content`.
 * @param {Array<Record<string, string>>} rows
 * @returns {string[]} Non-blank copy values.
 */
export function copyFromRows(rows) {
  return rows.map((row) => row.copy || row.text || row.content || "").filter((t) => t && t.trim());
}

/**
 * @param {string[]} items
 * @param {string} rulesetKey
 * @returns {CheckResult[]} `id` is the 1-based line number: lines are positional and may repeat.
 */
export function checkItems(items, rulesetKey) {
  return items.map((text, i) => ({ id: `line-${i + 1}`, text, ...checkText(text, rulesetKey) }));
}
