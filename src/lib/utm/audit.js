/**
 * Pure UTM governance audit. Input rows come from `parseCsvFile`; nothing here touches the DOM.
 * User values are only ever used as Map/Set keys (D2).
 */

/** @typedef {"source" | "medium" | "campaign" | "term" | "content"} UtmField */
/** @typedef {{ url: string, source: string, medium: string, campaign: string, term: string, content: string }} UtmRow */
/** @typedef {"missing_required" | "whitespace" | "invalid_chars" | "casing_drift" | "separator_drift" | "duplicate_tuple"} IssueType */
/** @typedef {{ id: string, rowIndex: number, field: UtmField, type: IssueType, detail: string }} UtmIssue */

export const UTM_FIELDS = /** @type {const} */ (["source", "medium", "campaign", "term", "content"]);
export const REQUIRED_FIELDS = /** @type {const} */ (["source", "medium", "campaign"]);
const VALID_CHARS = /^[a-zA-Z0-9_-]*$/;

/** @type {Record<IssueType, string>} */
export const ISSUE_LABELS = {
  missing_required: "Missing required field",
  whitespace: "Whitespace in value",
  invalid_chars: "Invalid characters",
  casing_drift: "Casing inconsistency",
  separator_drift: "Separator inconsistency",
  duplicate_tuple: "Duplicate campaign, different URL",
};

/**
 * @param {string} url
 * @returns {Omit<UtmRow, "url">} UTM parameters from the query string; all empty when the URL does not parse.
 */
export function extractUtmFromUrl(url) {
  try {
    const params = new URL(url).searchParams;
    return {
      source: params.get("utm_source") || "",
      medium: params.get("utm_medium") || "",
      campaign: params.get("utm_campaign") || "",
      term: params.get("utm_term") || "",
      content: params.get("utm_content") || "",
    };
  } catch {
    return { source: "", medium: "", campaign: "", term: "", content: "" };
  }
}

/**
 * Prefers an explicit `url` column and falls back to `utm_*` (or bare) columns.
 * @param {Record<string, string>} keys A row with lowercased headers (see `lowercaseKeys`).
 * @returns {UtmRow}
 */
export function normalizeUtmRow(keys) {
  if (keys.url) return { url: keys.url, ...extractUtmFromUrl(keys.url) };
  return {
    url: "",
    source: keys.utm_source || keys.source || "",
    medium: keys.utm_medium || keys.medium || "",
    campaign: keys.utm_campaign || keys.campaign || "",
    term: keys.utm_term || keys.term || "",
    content: keys.utm_content || keys.content || "",
  };
}

/**
 * @param {string} value
 * @returns {"none" | "hyphen" | "underscore" | "dot" | "mixed-within-value" | null} null for an empty value.
 */
export function detectSeparatorStyle(value) {
  if (!value) return null;
  const styles = [
    value.includes("-") && "hyphen",
    value.includes("_") && "underscore",
    value.includes(".") && "dot",
  ].filter(Boolean);
  if (styles.length === 0) return "none";
  if (styles.length > 1) return "mixed-within-value";
  return /** @type {"hyphen" | "underscore" | "dot"} */ (styles[0]);
}

/** @param {UtmRow} row */
const tupleKey = (row) => `${row.source.toLowerCase()}|${row.medium.toLowerCase()}|${row.campaign.toLowerCase()}`;

/**
 * Casing variants per field: field to lowercase value to the set of spellings seen.
 * @param {UtmRow[]} rows
 * @returns {Map<string, Map<string, Set<string>>>}
 */
function groupCasings(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    REQUIRED_FIELDS.forEach((field) => {
      const val = row[field];
      if (!val) return;
      if (!groups.has(field)) groups.set(field, new Map());
      const byValue = groups.get(field);
      const key = val.toLowerCase();
      if (!byValue.has(key)) byValue.set(key, new Set());
      byValue.get(key).add(val);
    });
  });
  return groups;
}

/**
 * The separator style most campaigns use (hyphen, underscore or dot), or undefined when none use one.
 * @param {UtmRow[]} rows
 */
function majoritySeparator(rows) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  rows.forEach((row) => {
    const style = detectSeparatorStyle(row.campaign);
    if (style && style !== "none") counts.set(style, (counts.get(style) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/**
 * Distinct destination URLs per source/medium/campaign tuple.
 * @param {UtmRow[]} rows
 * @returns {Map<string, Set<string>>}
 */
function groupTupleUrls(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    if (!row.source || !row.medium || !row.campaign) return;
    const key = tupleKey(row);
    if (!groups.has(key)) groups.set(key, new Set());
    if (row.url) groups.get(key).add(row.url);
  });
  return groups;
}

/**
 * Audits normalized rows for governance drift.
 * @param {UtmRow[]} rows
 * @returns {UtmIssue[]} One entry per problem; a row can appear several times. `id` is unique within the result.
 */
export function auditRows(rows) {
  /** @type {UtmIssue[]} */
  const issues = [];
  const casingGroups = groupCasings(rows);
  const majorityStyle = majoritySeparator(rows);
  const tupleUrls = groupTupleUrls(rows);

  /** @param {number} rowIndex @param {UtmField} field @param {IssueType} type @param {string} detail */
  const add = (rowIndex, field, type, detail) =>
    issues.push({ id: `${rowIndex}:${field}:${type}`, rowIndex, field, type, detail });

  rows.forEach((row, rowIndex) => {
    REQUIRED_FIELDS.forEach((field) => {
      if (!row[field]) add(rowIndex, field, "missing_required", `Missing utm_${field}`);
    });

    UTM_FIELDS.forEach((field) => {
      const val = row[field];
      if (!val) return;
      if (/\s/.test(val)) add(rowIndex, field, "whitespace", `"${val}" contains whitespace`);
      if (!VALID_CHARS.test(val)) {
        add(rowIndex, field, "invalid_chars", `"${val}" has characters outside [a-zA-Z0-9_-]`);
      }
    });

    REQUIRED_FIELDS.forEach((field) => {
      const val = row[field];
      if (!val) return;
      const variants = casingGroups.get(field)?.get(val.toLowerCase());
      if (variants && variants.size > 1) {
        add(
          rowIndex,
          field,
          "casing_drift",
          `"${val}" has ${variants.size} casing variants in this file: ${[...variants].join(", ")}`,
        );
      }
    });

    if (row.campaign && majorityStyle) {
      const style = detectSeparatorStyle(row.campaign);
      if (style && style !== "none" && style !== majorityStyle) {
        add(
          rowIndex,
          "campaign",
          "separator_drift",
          `"${row.campaign}" uses "${style}" separators; most campaigns in this file use "${majorityStyle}"`,
        );
      }
    }

    if (row.source && row.medium && row.campaign) {
      const urls = tupleUrls.get(tupleKey(row));
      if (urls && urls.size > 1) {
        add(
          rowIndex,
          "campaign",
          "duplicate_tuple",
          `Same source/medium/campaign combination points to ${urls.size} different URLs in this file`,
        );
      }
    }
  });

  return issues;
}

/**
 * @param {UtmIssue[]} issues
 * @param {number} rowCount
 * @returns {{ rowsWithIssues: number, issueRate: string, byCategory: Array<{ label: string, value: number }> }}
 */
export function summarizeIssues(issues, rowCount) {
  const rowsWithIssues = new Set(issues.map((i) => i.rowIndex)).size;
  return {
    rowsWithIssues,
    issueRate: rowCount ? `${Math.round((rowsWithIssues / rowCount) * 100)}%` : "0%",
    byCategory: /** @type {IssueType[]} */ (Object.keys(ISSUE_LABELS)).map((type) => ({
      label: ISSUE_LABELS[type],
      value: issues.filter((i) => i.type === type).length,
    })),
  };
}
