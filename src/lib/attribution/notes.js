/**
 * Plain-language data-quality notes built from the analysis report. Every sentence states something the
 * analysis actually did, so what is on screen is true for the file that was uploaded.
 */
import { MODELS, POSITION_WEIGHTS } from "./compute.js";
import { BLANK_CHANNEL } from "./channels.js";
import { REVENUE_MODES } from "./revenue.js";

/** @typedef {import("./prepare.js").Report} Report */
/** @typedef {{ id: string, level: "warning" | "info", text: string }} Note */

const plural = (/** @type {number} */ n, /** @type {string} */ one, /** @type {string} */ many = `${one}s`) =>
  `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

const was = (/** @type {number} */ n) => (n === 1 ? "was" : "were");

/** @param {Report} r @returns {Note[]} */
function conversionNotes(r) {
  /** @type {Note[]} */
  const out = [];
  const rules = {
    flag: `A journey counts as a conversion when the "${r.mapping.converted}" column marks it yes, true or 1.`,
    revenue: "Only journeys with revenue count as conversions, because a revenue column is present.",
    "all-mixed": "Every journey counts as a conversion, including journeys with no revenue.",
    all: "No revenue or converted column is mapped, so every journey is counted as one conversion.",
  };
  out.push({
    id: "conversion-rule",
    level: r.conversionRule === "all" ? "warning" : "info",
    text: rules[r.conversionRule],
  });
  if (r.nonConvertingJourneys > 0) {
    out.push({
      id: "non-converting",
      level: "info",
      text: `${plural(r.nonConvertingJourneys, "journey")} did not convert and got no credit (${plural(r.nonConvertingTouches, "touchpoint")}). ${plural(r.convertingJourneys, "journey")} converted.`,
    });
  }
  if (r.convertedNoRevenue > 0) {
    out.push({
      id: "converted-no-revenue",
      level: "warning",
      text: `${plural(r.convertedNoRevenue, "converted journey", "converted journeys")} had no revenue value and add 0 to the revenue totals.`,
    });
  }
  if (r.revenueIgnoredOnNonConverted > 0) {
    out.push({
      id: "revenue-ignored",
      level: "warning",
      text: `${plural(r.revenueIgnoredOnNonConverted, "journey")} ${r.revenueIgnoredOnNonConverted === 1 ? "carries" : "carry"} revenue but ${r.revenueIgnoredOnNonConverted === 1 ? "is" : "are"} marked not converted. Their revenue was ignored.`,
    });
  }
  if (r.mixedUnitsJourneys > 0) {
    out.push({
      id: "mixed-units",
      level: "warning",
      text: `${plural(r.mixedUnitsJourneys, "journey")} without revenue count as 1 next to revenue amounts from other journeys.`,
    });
  }
  return out;
}

/** @param {Report} r @returns {Note[]} */
function revenueNotes(r) {
  /** @type {Note[]} */
  const out = [];
  if (!r.revenue.hasColumn) return out;
  const modeLabel = REVENUE_MODES.find((m) => m.value === r.revenueMode)
    ?.label.replace(" (default)", "")
    .toLowerCase();
  const multi = r.revenue.repeated + r.revenue.cumulative + r.revenue.varied;
  if (multi > 0) {
    const detail = `${r.revenue.repeated} repeat one value, ${r.revenue.cumulative} look cumulative, ${r.revenue.varied} differ`;
    out.push({
      id: "revenue-multi",
      level: r.revenueMode === "sum" ? "warning" : "info",
      text:
        r.revenueMode === "sum"
          ? `${plural(multi, "journey")} ${multi === 1 ? "carries" : "carry"} revenue on several rows (${detail}). Revenue is summed across rows, so those journeys are overstated.`
          : `${plural(multi, "journey")} ${multi === 1 ? "carries" : "carry"} revenue on several rows (${detail}). Each journey is valued once, using the ${modeLabel}.`,
    });
  }
  if (r.revenue.unparseable > 0) {
    const list = r.revenue.examples.map((e) => `row ${e.row} "${e.raw}"`).join(", ");
    const more = r.revenue.unparseable > r.revenue.examples.length ? ", and more" : "";
    out.push({
      id: "revenue-unparseable",
      level: "warning",
      text: `${plural(r.revenue.unparseable, "revenue cell")} could not be read as a number and ${was(r.revenue.unparseable)} ignored: ${list}${more}.`,
    });
  }
  if (r.revenue.nonPositive > 0) {
    out.push({
      id: "revenue-nonpositive",
      level: "info",
      text: `${plural(r.revenue.nonPositive, "revenue cell")} ${was(r.revenue.nonPositive)} zero or negative (refunds). ${r.revenueMode === "sum" ? "They net against the journey's sales." : "They are ignored when valuing a journey."}`,
    });
  }
  out.push({
    id: "revenue-format",
    level: "info",
    text: `Revenue is read with currency symbols and thousands separators removed, "(50)" as a refund, and ${r.revenue.locale === "comma" ? "a comma as the decimal separator" : "a dot as the decimal separator"} for ambiguous values such as 1,500.`,
  });
  return out;
}

/** @param {Report} r @returns {Note[]} */
function timeNotes(r) {
  /** @type {Note[]} */
  const out = [];
  if (!r.dates.hasColumn) {
    out.push({
      id: "no-timestamp",
      level: "warning",
      text: "No timestamp column is mapped, so touches are ordered by row order in the file and time-decay treats them as simultaneous.",
    });
    return out;
  }
  out.push({
    id: "utc",
    level: "info",
    text: "Timestamps are read as UTC (a value with its own offset keeps it), so results do not depend on your time zone.",
  });
  const orderName = r.dates.order === "dmy" ? "day first (DD/MM/YYYY)" : "month first (MM/DD/YYYY)";
  if (r.dates.evidence === "ambiguous") {
    out.push({
      id: "date-ambiguous",
      level: "warning",
      text: `${plural(r.dates.ambiguousCount, "date")} such as 03/04/2026 could be read either way. They are read ${orderName}. Change the date order if that is wrong.`,
    });
  } else if (r.dates.evidence === "conflict") {
    out.push({
      id: "date-conflict",
      level: "warning",
      text: `The file mixes day-first and month-first dates. Dates are read ${orderName}, and the ones that do not fit are treated as missing.`,
    });
  } else if (r.dates.evidence === "day-first" || r.dates.evidence === "month-first") {
    out.push({
      id: "date-order",
      level: "info",
      text: `Numeric dates are read ${orderName}, decided from the dates in this file.`,
    });
  }
  if (r.dates.undatedJourneys > 0) {
    out.push({
      id: "undated",
      level: "warning",
      text: `${plural(r.dates.undatedJourneys, "journey")} had ${plural(r.dates.undatedTouches, "touchpoint")} with a blank or unreadable timestamp. Those touches keep their file order next to the dated touches around them and are not moved to the start.`,
    });
  }
  if (r.dates.tiedJourneys > 0) {
    out.push({
      id: "ties",
      level: "warning",
      text: `${plural(r.dates.tiedJourneys, "journey")} had touches with the same timestamp. They are ordered by file order, so the file's row order decides which is last.`,
    });
  }
  return out;
}

/** @param {Report} r @returns {Note[]} */
function cleaningNotes(r) {
  /** @type {Note[]} */
  const out = [];
  if (r.droppedNoJourney > 0) {
    out.push({
      id: "dropped",
      level: "warning",
      text: `${plural(r.droppedNoJourney, "row")} had no journey ID and ${was(r.droppedNoJourney)} dropped.`,
    });
  }
  if (r.duplicateRows > 0) {
    out.push({
      id: "duplicates",
      level: "info",
      text: r.dedupe
        ? `${plural(r.duplicateRows, "exact duplicate row")} removed.`
        : `${plural(r.duplicateRows, "exact duplicate row")} kept, and each counts as an extra touch.`,
    });
  }
  if (r.blankChannelTouches > 0) {
    out.push({
      id: "blank-channel",
      level: "warning",
      text: `${plural(r.blankChannelTouches, "touchpoint")} had no channel. ${r.blankChannelTouches === 1 ? "It is" : "They are"} scored under the name "${BLANK_CHANNEL}", which is not a real channel.`,
    });
  }
  r.channelMerges.forEach((m) => {
    out.push({
      id: `merge-${m.label}`,
      level: "info",
      text: `Channel names merged under "${m.label}": ${m.variants.join(", ")}.`,
    });
  });
  if (r.views.hasColumn && !r.views.keep) {
    out.push({
      id: "views",
      level: "info",
      text: `${plural(r.views.excluded, "view-through touch", "view-through touches")} excluded${r.views.emptiedJourneys > 0 ? `, which left ${plural(r.views.emptiedJourneys, "journey")} with no touches` : ""}.`,
    });
  }
  if (r.lookback.days !== null) {
    out.push({
      id: "lookback",
      level: "info",
      text: `Lookback ${r.lookback.days} days from each journey's last touch: ${plural(r.lookback.excludedTouches, "touchpoint")} in ${plural(r.lookback.journeysAffected, "journey")} fell outside the window and were excluded.`,
    });
  }
  return out;
}

/**
 * @param {Report} report
 * @returns {Note[]} Warnings first, then information, each with a stable id.
 */
export function qualityNotes(report) {
  const all = [...conversionNotes(report), ...revenueNotes(report), ...timeNotes(report), ...cleaningNotes(report)];
  return [...all.filter((n) => n.level === "warning"), ...all.filter((n) => n.level === "info")];
}

/**
 * @param {number} halfLifeDays
 * @returns {string} What each model does, including the position weights and the half-life.
 */
export function methodNote(halfLifeDays) {
  const pct = (/** @type {number} */ w) => Math.round(w * 100);
  return `${MODELS.length} models. Last-touch and first-touch give all credit to one touch. Linear splits it evenly. Position-based gives ${pct(POSITION_WEIGHTS.first)}/${pct(POSITION_WEIGHTS.middle)}/${pct(POSITION_WEIGHTS.last)} to the first, middle and last touches (${pct(POSITION_WEIGHTS.two)}/${pct(POSITION_WEIGHTS.two)} for two touches, all of it for one). Time-decay halves a touch's weight for every ${halfLifeDays} days before the last touch.`;
}

/**
 * @param {import("./revenue.js").RevenueMode} mode
 * @returns {string} How one journey's revenue is chosen from its rows, including the default.
 */
export function revenueNote(mode) {
  const how = {
    first: "the first non-zero value on its rows (the default, so a value copied onto every row is counted once)",
    max: "the largest value on its rows",
    last: "the last non-zero value on its rows",
    sum: "the sum of its rows (use this only when each row is a separate sale)",
  };
  return `Revenue per journey is ${how[mode]}.`;
}
