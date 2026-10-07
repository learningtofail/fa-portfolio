/**
 * Timestamp parsing for touchpoint files. Every value is read as UTC (a value with an explicit offset or "Z"
 * keeps it), so the result never depends on the browser's time zone. Slash and dash dates are read month first
 * or day first for the whole file, decided by detectDateOrder.
 */

/** @typedef {"mdy" | "dmy"} DateOrder */
/** @typedef {"day-first" | "month-first" | "ambiguous" | "conflict" | "none"} DateEvidence */

const MONTH_NAMES = new Map([
  ["jan", 1],
  ["january", 1],
  ["janv", 1],
  ["janvier", 1],
  ["feb", 2],
  ["february", 2],
  ["fev", 2],
  ["fevr", 2],
  ["fevrier", 2],
  ["mar", 3],
  ["march", 3],
  ["mars", 3],
  ["apr", 4],
  ["april", 4],
  ["avr", 4],
  ["avril", 4],
  ["may", 5],
  ["mai", 5],
  ["jun", 6],
  ["june", 6],
  ["juin", 6],
  ["jul", 7],
  ["july", 7],
  ["juil", 7],
  ["juillet", 7],
  ["aug", 8],
  ["august", 8],
  ["aout", 8],
  ["sep", 9],
  ["sept", 9],
  ["september", 9],
  ["septembre", 9],
  ["oct", 10],
  ["october", 10],
  ["octobre", 10],
  ["nov", 11],
  ["november", 11],
  ["novembre", 11],
  ["dec", 12],
  ["december", 12],
  ["decembre", 12],
]);

const TIME = String.raw`(?:(?:[T\s,]+|\s*,\s*)(\d{1,2})(?::|h)(\d{2})(?::(\d{2})(?:[.,]\d+)?)?\s*([ap]m)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?)?`;
const ISO = new RegExp(String.raw`^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})${TIME}$`, "i");
const NUMERIC = new RegExp(String.raw`^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4}|\d{2})${TIME}$`, "i");
const DAY_NAME = new RegExp(String.raw`^(\d{1,2})[\s\-/.]+(\p{L}+)\.?[\s\-/.,]+(\d{4})${TIME}$`, "iu");
const NAME_DAY = new RegExp(String.raw`^(\p{L}+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})${TIME}$`, "iu");

/** @param {string} name @returns {number | undefined} Month 1 to 12 for an English or French month name. */
function monthFromName(name) {
  const key = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return MONTH_NAMES.get(key);
}

/**
 * @param {number} y @param {number} m @param {number} d
 * @param {string[]} time Capture groups: hour, minute, second, am/pm, offset.
 * @returns {number | null}
 */
function toUtc(y, m, d, time) {
  const [hRaw, minRaw, sRaw, meridiem, offset] = time;
  let hour = hRaw === undefined ? 0 : Number(hRaw);
  const minute = minRaw === undefined ? 0 : Number(minRaw);
  const second = sRaw === undefined ? 0 : Number(sRaw);
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (meridiem.toLowerCase() === "pm" ? 12 : 0);
  }
  if (m < 1 || m > 12 || d < 1 || hour > 23 || minute > 59 || second > 59) return null;
  const ms = Date.UTC(y, m - 1, d, hour, minute, second);
  const check = new Date(ms);
  if (check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  let shift = 0;
  if (offset && offset.toUpperCase() !== "Z") {
    const digits = offset.slice(1).replace(":", "");
    const minutes = Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2) || 0);
    shift = (offset[0] === "-" ? -1 : 1) * minutes * 60000;
  }
  return ms - shift;
}

/** @param {string} y @returns {number} A four digit year; two digit years are read as 20xx. */
const fullYear = (y) => (y.length === 2 ? 2000 + Number(y) : Number(y));

/**
 * @param {string} raw
 * @param {DateOrder} [order] How to read ambiguous numeric dates such as 03/04/2026.
 * @returns {number | null} Milliseconds since the epoch in UTC, or null for a blank or unreadable value.
 */
export function parseTimestamp(raw, order = "mdy") {
  const s = (raw ?? "").trim();
  if (s === "") return null;
  if (/^\d{10}$/.test(s)) return Number(s) * 1000;
  if (/^\d{13}$/.test(s)) return Number(s);
  let m = s.match(ISO);
  if (m) return toUtc(Number(m[1]), Number(m[2]), Number(m[3]), m.slice(4));
  m = s.match(NUMERIC);
  if (m) {
    const [first, second] = [Number(m[1]), Number(m[2])];
    const [month, day] = order === "dmy" ? [second, first] : [first, second];
    return toUtc(fullYear(m[3]), month, day, m.slice(4));
  }
  m = s.match(DAY_NAME);
  if (m) {
    const month = monthFromName(m[2]);
    return month ? toUtc(Number(m[3]), month, Number(m[1]), m.slice(4)) : null;
  }
  m = s.match(NAME_DAY);
  if (m) {
    const month = monthFromName(m[1]);
    return month ? toUtc(Number(m[3]), month, Number(m[2]), m.slice(4)) : null;
  }
  return null;
}

/**
 * Decides month first or day first for a whole file from the slash and dash dates in it.
 * @param {string[]} cells Raw timestamp cells.
 * @returns {{ order: DateOrder, evidence: DateEvidence, ambiguousCount: number }} Month first is the default;
 *   `ambiguousCount` is how many dates read differently in each order and nothing in the file settles it.
 */
export function detectDateOrder(cells) {
  let dayFirst = 0;
  let monthFirst = 0;
  let ambiguous = 0;
  cells.forEach((cell) => {
    const m = cell.trim().match(NUMERIC);
    if (!m) return;
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a > 12 && b <= 12) dayFirst += 1;
    else if (b > 12 && a <= 12) monthFirst += 1;
    else if (a <= 12 && b <= 12 && a !== b) ambiguous += 1;
  });
  if (dayFirst > 0 && monthFirst > 0) return { order: "mdy", evidence: "conflict", ambiguousCount: ambiguous };
  if (dayFirst > 0) return { order: "dmy", evidence: "day-first", ambiguousCount: 0 };
  if (monthFirst > 0) return { order: "mdy", evidence: "month-first", ambiguousCount: 0 };
  if (ambiguous > 0) return { order: "mdy", evidence: "ambiguous", ambiguousCount: ambiguous };
  return { order: "mdy", evidence: "none", ambiguousCount: 0 };
}
