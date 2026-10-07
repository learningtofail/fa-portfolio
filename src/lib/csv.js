import Papa from "papaparse";

/**
 * A CSV row after header normalization. Headers come from the user's file, so the object has no prototype:
 * a header named `constructor` or `__proto__` is just a key (D2).
 * @typedef {Record<string, string>} CsvRow
 */

/**
 * @param {string} header Header text from the file.
 * @returns {string} Trimmed, lowercased, without a byte order mark.
 */
export const normalizeHeader = (header) =>
  header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase();

/**
 * Lowercases and trims every header of a row.
 * @param {Record<string, any>} row Row as parsed by PapaParse with `header: true`.
 * @returns {CsvRow}
 */
export function lowercaseKeys(row) {
  /** @type {CsvRow} */
  const out = Object.create(null);
  Object.keys(row).forEach((key) => {
    out[normalizeHeader(key)] = row[key];
  });
  return out;
}

/**
 * Turns PapaParse errors into one message, or "" when there is nothing to report. PapaParse's "Delimiter" type is
 * an informational notice (a single-column file has nothing to auto-detect), so it is not a warning.
 * @param {Array<{ type: string, message: string }> | undefined} errors
 * @returns {string}
 */
export function describeParseWarnings(errors) {
  const real = (errors || []).filter((e) => e.type !== "Delimiter");
  if (real.length === 0) return "";
  return `Parsed with ${real.length} warning(s). Results may be incomplete. First: ${real[0].message}`;
}

/**
 * Parses a CSV file in the browser. Nothing is uploaded.
 * @param {File} file
 * @returns {Promise<{ rows: CsvRow[], headers: string[], warning: string }>} Rejects with a readable Error when the file cannot be read.
 */
export function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = (results.meta.fields || []).map(normalizeHeader);
        resolve({ rows: results.data.map(lowercaseKeys), headers, warning: describeParseWarnings(results.errors) });
      },
      error: (err) => reject(new Error(`Could not parse this file: ${err.message}`)),
    });
  });
}

/**
 * Reads a file as text in the browser.
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read this file."));
    reader.readAsText(file);
  });
}
