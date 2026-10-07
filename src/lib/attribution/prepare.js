/**
 * Turns parsed CSV rows into scored journeys and a data-quality report. Each step that drops, merges, reorders or
 * reinterprets data is counted in the report, so the screen can say what was done to the file.
 */
import { buildChannelLabels } from "./channels.js";
import { detectColumns, missingRequired } from "./columns.js";
import { computeAttribution, DAY_MS, DEFAULT_HALF_LIFE_DAYS } from "./compute.js";
import { detectDateOrder, parseTimestamp } from "./dates.js";
import { detectAmountLocale, detectCurrency, parseAmount } from "./numbers.js";
import { orderTouches } from "./order.js";
import { journeyRevenue, revenuePattern } from "./revenue.js";

/** @typedef {import("./columns.js").ColumnMapping} ColumnMapping */
/** @typedef {import("./revenue.js").RevenueMode} RevenueMode */
/**
 * @typedef {{
 *   mapping: Partial<ColumnMapping>,
 *   revenueMode: RevenueMode,
 *   onlyRevenueConverts: boolean,
 *   dedupe: boolean,
 *   normalizeChannels: boolean,
 *   keepViews: boolean,
 *   lookbackDays: number | null,
 *   halfLifeDays: number,
 *   dateOrder: "auto" | "mdy" | "dmy",
 * }} AttributionOptions `mapping` entries override auto-detection; "" means no column.
 */

/** @type {AttributionOptions} */
export const DEFAULT_OPTIONS = Object.freeze({
  mapping: Object.freeze({}),
  revenueMode: "first",
  onlyRevenueConverts: true,
  dedupe: true,
  normalizeChannels: true,
  keepViews: true,
  lookbackDays: null,
  halfLifeDays: DEFAULT_HALF_LIFE_DAYS,
  dateOrder: "auto",
});

const VIEW_TOUCH = /^(view|views|impression|impressions|view[\s_-]?through|viewthrough|imp)$/i;
const TRUTHY = /^(1|y|yes|true|t|converted|won)$/i;
const MAX_EXAMPLES = 10;

/**
 * @param {Array<Record<string, string>>} rows Rows keyed by header text.
 * @param {string[]} headers Header text, in file order.
 * @param {Partial<AttributionOptions>} [overrides]
 * @returns {{ status: "missing", headers: string[], mapping: ColumnMapping, missing: string[] }
 *   | { status: "ok", headers: string[], mapping: ColumnMapping, result: import("./compute.js").AttributionResult, report: Report, unit: "revenue" | "conversions" }}
 */
export function analyzeRows(rows, headers, overrides = {}) {
  const options = { ...DEFAULT_OPTIONS, ...overrides };
  const mapping = { ...detectColumns(headers) };
  Object.entries(options.mapping).forEach(([key, header]) => {
    if (header !== undefined) mapping[/** @type {keyof ColumnMapping} */ (key)] = header;
  });
  const missing = missingRequired(mapping);
  if (missing.length > 0) return { status: "missing", headers, mapping, missing };

  const cell = (/** @type {Record<string, string>} */ row, /** @type {string} */ header) =>
    header ? String(row[header] ?? "") : "";
  const column = (/** @type {string} */ header) => (header ? rows.map((r) => cell(r, header)) : []);

  const dateInfo = detectDateOrder(column(mapping.timestamp));
  const order = options.dateOrder === "auto" ? dateInfo.order : options.dateOrder;
  const revenueCells = column(mapping.revenue);
  const locale = detectAmountLocale(revenueCells);

  const report = emptyReport(mapping, options, rows.length, dateInfo, order, detectCurrency(revenueCells), locale);

  // Pass 1: drop rows without a journey, drop duplicates, group by journey in file order.
  /** @type {Map<string, JourneyRows>} */
  const journeys = new Map();
  const seen = new Set();
  rows.forEach((row, i) => {
    const journeyId = cell(row, mapping.journey).trim();
    if (journeyId === "") {
      report.droppedNoJourney += 1;
      return;
    }
    const signature = headers.map((h) => cell(row, h)).join("\u0001");
    if (seen.has(signature)) {
      report.duplicateRows += 1;
      if (options.dedupe) return;
    }
    seen.add(signature);
    if (!journeys.has(journeyId)) journeys.set(journeyId, { touches: [], amounts: [], converted: false });
    const journey = journeys.get(journeyId);
    const rawChannel = cell(row, mapping.channel);
    if (rawChannel.trim() === "") report.blankChannelTouches += 1;
    const parsedAmount = parseAmount(cell(row, mapping.revenue), locale);
    if (parsedAmount.status === "invalid") {
      report.revenue.unparseable += 1;
      if (report.revenue.examples.length < MAX_EXAMPLES)
        report.revenue.examples.push({ row: i + 2, journeyId, raw: cell(row, mapping.revenue).trim() });
    } else if (parsedAmount.status === "ok") {
      journey.amounts.push(parsedAmount.value);
      if (parsedAmount.value <= 0) report.revenue.nonPositive += 1;
    }
    if (TRUTHY.test(cell(row, mapping.converted).trim())) journey.converted = true;
    journey.touches.push({
      rawChannel,
      time: parseTimestamp(cell(row, mapping.timestamp), order),
      index: i,
      isView: mapping.touchType !== "" && VIEW_TOUCH.test(cell(row, mapping.touchType).trim()),
    });
  });
  report.journeyCount = journeys.size;

  const labels = buildChannelLabels(
    [...journeys.values()].flatMap((j) => j.touches.map((t) => t.rawChannel)),
    options.normalizeChannels,
  );
  report.channelMerges = labels.merges;

  // Pass 2: decide which journeys converted and what each is worth.
  const hasRevenue = mapping.revenue !== "";
  report.conversionRule = mapping.converted
    ? "flag"
    : hasRevenue
      ? options.onlyRevenueConverts
        ? "revenue"
        : "all-mixed"
      : "all";
  /** @type {import("./compute.js").ScoredJourney[]} */
  const scored = [];
  journeys.forEach((journey, id) => {
    const pattern = revenuePattern(journey.amounts);
    if (pattern === "repeated") report.revenue.repeated += 1;
    else if (pattern === "cumulative") report.revenue.cumulative += 1;
    else if (pattern === "varied") report.revenue.varied += 1;
    const revenue = journeyRevenue(journey.amounts, options.revenueMode);
    const outcome = conversionOutcome(journey, revenue, hasRevenue, report.conversionRule);
    if (outcome.note === "no-revenue") report.convertedNoRevenue += 1;
    if (outcome.note === "ignored-revenue") report.revenueIgnoredOnNonConverted += 1;
    if (outcome.note === "counted-as-one") report.mixedUnitsJourneys += 1;
    if (!outcome.converted) {
      report.nonConvertingJourneys += 1;
      report.nonConvertingTouches += journey.touches.length;
      return;
    }
    const kept = journey.touches.filter((t) => options.keepViews || !t.isView);
    report.views.excluded += journey.touches.length - kept.length;
    if (kept.length === 0) {
      report.views.emptiedJourneys += 1;
      return;
    }
    const { ordered, undated, tied } = orderTouches(
      kept.map((t) => ({ channel: labels.label(t.rawChannel), time: t.time, index: t.index })),
    );
    if (undated > 0 && mapping.timestamp) {
      report.dates.undatedJourneys += 1;
      report.dates.undatedTouches += undated;
    }
    if (tied) report.dates.tiedJourneys += 1;
    let touches = ordered;
    if (options.lookbackDays !== null) {
      const cutoff = ordered[ordered.length - 1].time - options.lookbackDays * DAY_MS;
      touches = ordered.filter((t) => t.time >= cutoff);
      if (touches.length < ordered.length) {
        report.lookback.excludedTouches += ordered.length - touches.length;
        report.lookback.journeysAffected += 1;
      }
    }
    scored.push({ id, value: outcome.value, touches });
  });

  report.convertingJourneys = scored.length + report.views.emptiedJourneys;
  report.totalsUnreliable = totalsReasons(report, options);
  const result = computeAttribution(scored, { halfLifeDays: options.halfLifeDays });
  return { status: "ok", headers, mapping, result, report, unit: hasRevenue ? "revenue" : "conversions" };
}

/**
 * @param {JourneyRows} journey
 * @param {number} revenue Value under the chosen revenue mode, 0 when none.
 * @param {boolean} hasRevenue
 * @param {Report["conversionRule"]} rule
 * @returns {{ converted: boolean, value: number, note?: "no-revenue" | "ignored-revenue" | "counted-as-one" }}
 */
function conversionOutcome(journey, revenue, hasRevenue, rule) {
  if (rule === "flag") {
    if (!journey.converted) return { converted: false, value: 0, note: revenue > 0 ? "ignored-revenue" : undefined };
    if (!hasRevenue) return { converted: true, value: 1 };
    return { converted: true, value: revenue, note: revenue > 0 ? undefined : "no-revenue" };
  }
  if (rule === "revenue") return { converted: revenue > 0, value: revenue };
  if (rule === "all-mixed")
    return revenue > 0 ? { converted: true, value: revenue } : { converted: true, value: 1, note: "counted-as-one" };
  return { converted: true, value: 1 };
}

/**
 * @param {Report} report
 * @param {AttributionOptions} options
 * @returns {string[]} Why the totals cannot be trusted, empty when they can.
 */
function totalsReasons(report, options) {
  const reasons = [];
  if (options.revenueMode === "sum" && report.revenue.repeated + report.revenue.cumulative > 0) {
    reasons.push("Revenue is summed across rows and some journeys repeat or accumulate one value.");
  }
  if (report.mixedUnitsJourneys > 0 && report.mixedUnitsJourneys < report.convertingJourneys) {
    reasons.push("Journeys without revenue are counted as 1 next to revenue amounts, so the totals mix units.");
  }
  if (report.revenue.unparseable > 0) {
    reasons.push("Some revenue cells could not be read, so those journeys may be missing value.");
  }
  return reasons;
}

/**
 * @typedef {{ touches: Array<{ rawChannel: string, time: number | null, index: number, isView: boolean }>, amounts: number[], converted: boolean }} JourneyRows
 */
/**
 * @typedef {{
 *   mapping: ColumnMapping,
 *   revenueMode: RevenueMode,
 *   rowCount: number,
 *   droppedNoJourney: number,
 *   duplicateRows: number,
 *   dedupe: boolean,
 *   blankChannelTouches: number,
 *   channelMerges: Array<{ label: string, variants: string[] }>,
 *   journeyCount: number,
 *   convertingJourneys: number,
 *   nonConvertingJourneys: number,
 *   nonConvertingTouches: number,
 *   convertedNoRevenue: number,
 *   revenueIgnoredOnNonConverted: number,
 *   mixedUnitsJourneys: number,
 *   conversionRule: "flag" | "revenue" | "all-mixed" | "all",
 *   revenue: { hasColumn: boolean, locale: "dot" | "comma", currency: string, unparseable: number, examples: Array<{ row: number, journeyId: string, raw: string }>, nonPositive: number, repeated: number, cumulative: number, varied: number },
 *   dates: { hasColumn: boolean, order: "mdy" | "dmy", evidence: string, ambiguousCount: number, undatedTouches: number, undatedJourneys: number, tiedJourneys: number },
 *   views: { hasColumn: boolean, keep: boolean, excluded: number, emptiedJourneys: number },
 *   lookback: { days: number | null, excludedTouches: number, journeysAffected: number },
 *   totalsUnreliable: string[],
 * }} Report
 */

/** @returns {Report} */
function emptyReport(mapping, options, rowCount, dateInfo, order, currency, locale) {
  return {
    mapping,
    revenueMode: options.revenueMode,
    rowCount,
    droppedNoJourney: 0,
    duplicateRows: 0,
    dedupe: options.dedupe,
    blankChannelTouches: 0,
    channelMerges: [],
    journeyCount: 0,
    convertingJourneys: 0,
    nonConvertingJourneys: 0,
    nonConvertingTouches: 0,
    convertedNoRevenue: 0,
    revenueIgnoredOnNonConverted: 0,
    mixedUnitsJourneys: 0,
    conversionRule: "all",
    revenue: {
      hasColumn: mapping.revenue !== "",
      locale,
      currency,
      unparseable: 0,
      examples: [],
      nonPositive: 0,
      repeated: 0,
      cumulative: 0,
      varied: 0,
    },
    dates: {
      hasColumn: mapping.timestamp !== "",
      order,
      evidence: dateInfo.evidence,
      ambiguousCount: dateInfo.ambiguousCount,
      undatedTouches: 0,
      undatedJourneys: 0,
      tiedJourneys: 0,
    },
    views: { hasColumn: mapping.touchType !== "", keep: options.keepViews, excluded: 0, emptiedJourneys: 0 },
    lookback: { days: options.lookbackDays, excludedTouches: 0, journeysAffected: 0 },
    totalsUnreliable: [],
  };
}
