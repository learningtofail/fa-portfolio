/**
 * Money parsing for revenue columns. Handles currency symbols and codes, thousands separators, decimal commas
 * and accounting negatives such as "(50)". A decimal comma is decided once per column (detectAmountLocale), so
 * "1,500" is read the same way for every cell of a file.
 */

/** @typedef {"dot" | "comma"} AmountLocale Which character is the decimal separator when a cell is otherwise ambiguous. */
/** @typedef {{ status: "blank" | "ok" | "invalid", value: number | null }} ParsedAmount */

const SYMBOLS = /[$€£¥₹]/g;
const SPACES = /[\s\u00a0\u202f\u2009]/g;
const LEADING_CODE = /^[A-Za-z]{3}(?=[\s\d(+\-−])/;
const TRAILING_CODE = /(?<=[\d)])\s*[A-Za-z]{3}$/;
const BODY = /^(?:\d[\d.,]*|[.,]\d+)$/;

/**
 * @param {string} raw
 * @returns {{ negative: boolean, body: string } | null} The unsigned digits-and-separators text, or null when the cell is not a number.
 */
function strip(raw) {
  let s = raw.replace(SYMBOLS, "").trim().replace(LEADING_CODE, "").replace(TRAILING_CODE, "").replace(SPACES, "");
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/^[-−]/.test(s)) {
    negative = !negative;
    s = s.slice(1);
  } else if (/^\+/.test(s)) {
    s = s.slice(1);
  } else if (/-$/.test(s)) {
    negative = !negative;
    s = s.slice(0, -1);
  }
  return BODY.test(s) ? { negative, body: s } : null;
}

/**
 * Classifies the separators of an unsigned body.
 * @param {string} body
 * @returns {{ kind: "plain" } | { kind: "decimal", char: "." | "," } | { kind: "thousands", char: "." | "," }
 *   | { kind: "ambiguous", char: "." | "," } | { kind: "invalid" }}
 */
function classify(body) {
  const lastDot = body.lastIndexOf(".");
  const lastComma = body.lastIndexOf(",");
  if (lastDot < 0 && lastComma < 0) return { kind: "plain" };
  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? "." : ",";
    const group = decimal === "." ? "," : ".";
    const [intPart] = body.split(decimal);
    const oneDecimal = body.split(decimal).length === 2;
    const groupsOk = intPart.split(group).every((g, i) => (i === 0 ? g.length >= 1 : g.length === 3));
    return oneDecimal && groupsOk ? { kind: "decimal", char: decimal } : { kind: "invalid" };
  }
  const char = lastDot >= 0 ? "." : ",";
  const parts = body.split(char);
  if (parts.length > 2) {
    const groupsOk = parts.every((g, i) => (i === 0 ? g.length >= 1 && g.length <= 3 : g.length === 3));
    return groupsOk ? { kind: "thousands", char } : { kind: "invalid" };
  }
  const [head, tail] = parts;
  if (tail.length === 3 && head.length >= 1 && head.length <= 3 && head !== "0") return { kind: "ambiguous", char };
  return { kind: "decimal", char };
}

/**
 * Picks the column's decimal separator from the cells that make it clear. Ties and columns with no evidence use a dot.
 * @param {string[]} cells Raw revenue cells.
 * @returns {AmountLocale}
 */
export function detectAmountLocale(cells) {
  let dot = 0;
  let comma = 0;
  cells.forEach((cell) => {
    const parsed = strip(cell);
    if (!parsed) return;
    const c = classify(parsed.body);
    if (c.kind === "decimal") {
      if (c.char === ".") dot += 1;
      else comma += 1;
    } else if (c.kind === "thousands") {
      if (c.char === ".") comma += 1;
      else dot += 1;
    }
  });
  return comma > dot ? "comma" : "dot";
}

/**
 * @param {string} raw One revenue cell.
 * @param {AmountLocale} [locale] The column's decimal separator, used only for ambiguous cells such as "1,500".
 * @returns {ParsedAmount} `blank` for empty cells (and a lone dash), `invalid` when the text is not a number.
 */
export function parseAmount(raw, locale = "dot") {
  const text = (raw ?? "").trim();
  if (text === "" || /^[-\u2013\u2014]$/.test(text)) return { status: "blank", value: null };
  const parsed = strip(text);
  if (!parsed) return { status: "invalid", value: null };
  const c = classify(parsed.body);
  if (c.kind === "invalid") return { status: "invalid", value: null };
  let normalized = parsed.body;
  if (c.kind === "thousands") {
    normalized = parsed.body.split(c.char).join("");
  } else if (c.kind === "decimal") {
    const group = c.char === "." ? "," : ".";
    normalized = parsed.body.split(group).join("").replace(c.char, ".");
  } else if (c.kind === "ambiguous") {
    const isDecimal = (locale === "comma") === (c.char === ",");
    normalized = isDecimal ? parsed.body.replace(c.char, ".") : parsed.body.split(c.char).join("");
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) return { status: "invalid", value: null };
  return { status: "ok", value: parsed.negative ? -value : value };
}

/**
 * @param {string[]} cells Raw revenue cells.
 * @returns {string} The first currency symbol or ISO-style code found, or "".
 */
export function detectCurrency(cells) {
  for (const cell of cells) {
    const symbol = cell.match(/[$€£¥₹]/);
    if (symbol) return symbol[0];
    const code = cell.trim().match(LEADING_CODE) || cell.match(TRAILING_CODE);
    if (code && /\d/.test(cell)) return code[0].trim().toUpperCase();
  }
  return "";
}
