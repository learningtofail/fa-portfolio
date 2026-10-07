import { DEFAULT_HALF_LIFE_DAYS } from "./compute.js";

/**
 * @param {string} text Lookback field text.
 * @returns {number | null} Days, or null (no limit) for a blank, zero, negative or unreadable value.
 */
export function parseLookbackDays(text) {
  const n = Number(text.trim());
  return text.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * @param {string} text Half-life field text.
 * @returns {number} Days, or the default of 7 for a blank, zero, negative or unreadable value.
 */
export function parseHalfLifeDays(text) {
  const n = Number(text.trim());
  return text.trim() !== "" && Number.isFinite(n) && n > 0 ? n : DEFAULT_HALF_LIFE_DAYS;
}
