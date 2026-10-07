/**
 * Presentation helpers for an attribution result: shares, rank by model, number formatting and the CSV export.
 */
import Papa from "papaparse";
import { creditFor, MODELS } from "./compute.js";

/** @typedef {import("./compute.js").AttributionResult} AttributionResult */

/**
 * @param {AttributionResult} result
 * @param {string} model
 * @returns {number} All credit the model handed out.
 */
export function modelTotal(result, model) {
  return result.channels.reduce((sum, channel) => sum + creditFor(result, model, channel), 0);
}

/**
 * @param {AttributionResult} result
 * @param {string} model
 * @param {string} channel
 * @returns {number} The channel's share of the model's credit from 0 to 1, 0 when the model has no credit.
 */
export function shareFor(result, model, channel) {
  const total = modelTotal(result, model);
  return total > 0 ? creditFor(result, model, channel) / total : 0;
}

/**
 * Rank of every channel under every model (1 is the most credit; equal credit shares a rank).
 * @param {AttributionResult} result
 * @returns {Array<{ channel: string, ranks: Map<string, number>, spread: number }>} `spread` is the best rank minus
 *   the worst rank across the models, so 0 means every model agrees.
 */
export function rankByModel(result) {
  /** @type {Map<string, Map<string, number>>} */
  const byChannel = new Map(result.channels.map((c) => [c, new Map()]));
  MODELS.forEach((model) => {
    const amounts = result.channels.map((channel) => ({
      channel,
      amount: Math.round(creditFor(result, model, channel) * 1e6),
    }));
    amounts.sort((a, b) => b.amount - a.amount);
    let rank = 0;
    amounts.forEach((entry, i) => {
      if (i === 0 || entry.amount !== amounts[i - 1].amount) rank = i + 1;
      byChannel.get(entry.channel).set(model, rank);
    });
  });
  return result.channels.map((channel) => {
    const ranks = byChannel.get(channel);
    const values = [...ranks.values()];
    return { channel, ranks, spread: Math.max(...values) - Math.min(...values) };
  });
}

/**
 * @param {number} value
 * @param {"revenue" | "conversions"} unit Revenue shows two decimals; conversions show up to two, without trailing zeros.
 * @returns {string}
 */
export function formatCredit(value, unit) {
  const digits =
    unit === "revenue" ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 2 };
  return value.toLocaleString("en-US", digits);
}

/** @param {number} share From 0 to 1. @returns {string} For example "31.2%". */
export const formatShare = (share) => `${(share * 100).toFixed(1)}%`;

/**
 * @param {"revenue" | "conversions"} unit
 * @param {string} currency Symbol or code typed by the user, "" when none.
 * @returns {string} The unit the credit is measured in, for headings, axis titles and the CSV.
 */
export function unitLabel(unit, currency) {
  if (unit === "conversions") return "conversions";
  return currency.trim() === "" ? "revenue (currency not set)" : `revenue (${currency.trim()})`;
}

/**
 * The matrix and the shares as CSV text, with a total row. Cells that start with a formula character are escaped.
 * @param {AttributionResult} result
 * @param {"revenue" | "conversions"} unit
 * @param {string} currency
 * @returns {string}
 */
export function matrixCsv(result, unit, currency) {
  const label = unitLabel(unit, currency);
  const header = ["Channel", ...MODELS.map((m) => `${m} (${label})`), ...MODELS.map((m) => `${m} share`)];
  const round = (/** @type {number} */ n) => Math.round(n * 1e6) / 1e6;
  const rows = result.channels.map((channel) => [
    channel,
    ...MODELS.map((m) => round(creditFor(result, m, channel))),
    ...MODELS.map((m) => formatShare(shareFor(result, m, channel))),
  ]);
  const total = ["Total", ...MODELS.map((m) => round(modelTotal(result, m))), ...MODELS.map(() => "100.0%")];
  return Papa.unparse([header, ...rows, total], { escapeFormulae: true });
}
