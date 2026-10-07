import { readFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { analyzeRows } from "../../../src/lib/attribution/prepare.js";
import { lowercaseKeys, normalizeHeader } from "../../../src/lib/csv.js";

/** Parses CSV text the way parseCsvFile does, then runs the full analysis. Returns the failure when columns are missing. */
export function tryAnalyzeText(text, options = {}) {
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  return analyzeRows(parsed.data.map(lowercaseKeys), (parsed.meta.fields || []).map(normalizeHeader), options);
}

/**
 * Like tryAnalyzeText, but throws when a required column is missing, so tests can read the result directly.
 * @returns {Extract<ReturnType<typeof analyzeRows>, { status: "ok" }>}
 */
export function analyzeText(text, options = {}) {
  const analysis = tryAnalyzeText(text, options);
  if (analysis.status !== "ok") throw new Error(`Missing columns: ${analysis.missing.join(", ")}`);
  return analysis;
}

/** Same as analyzeText, for a file under tests/fixtures (or a sub folder). */
export function analyzeFixture(name, options = {}) {
  return analyzeText(readFileSync(path.join(process.cwd(), "tests/fixtures", name), "utf8"), options);
}
