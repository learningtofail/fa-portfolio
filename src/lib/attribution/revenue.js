/**
 * Turns the revenue cells of one journey into one value. Exports often copy the conversion value onto every
 * touchpoint row, or log a running total, so summing the rows overstates the sale by about the number of touches.
 */

/** @typedef {"first" | "max" | "last" | "sum"} RevenueMode */

export const REVENUE_MODES = /** @type {const} */ ([
  { value: "first", label: "First non-zero value (default)" },
  { value: "max", label: "Largest value" },
  { value: "last", label: "Last non-zero value" },
  { value: "sum", label: "Sum of all rows" },
]);

/**
 * Zero and negative cells (refunds, blanks written as 0) are ignored by the first, largest and last modes.
 * The sum mode adds every cell, so a refund nets against the sale, and a total of zero or less is no revenue.
 * @param {number[]} amounts The journey's revenue cells in file order.
 * @param {RevenueMode} mode
 * @returns {number} The journey's value, 0 when it has none.
 */
export function journeyRevenue(amounts, mode) {
  if (mode === "sum")
    return Math.max(
      amounts.reduce((a, b) => a + b, 0),
      0,
    );
  const positives = amounts.filter((a) => a > 0);
  if (positives.length === 0) return 0;
  if (mode === "max") return Math.max(...positives);
  return mode === "last" ? positives[positives.length - 1] : positives[0];
}

/**
 * @param {number[]} amounts The journey's revenue cells in file order.
 * @returns {"none" | "single" | "repeated" | "cumulative" | "varied"} How the positive values on the rows relate:
 *   the same value again (`repeated`), a running total that only grows (`cumulative`), or unrelated values.
 */
export function revenuePattern(amounts) {
  const positives = amounts.filter((a) => a > 0);
  if (positives.length === 0) return "none";
  if (positives.length === 1) return "single";
  if (positives.every((a) => a === positives[0])) return "repeated";
  const growing = positives.every((a, i) => i === 0 || a >= positives[i - 1]);
  return growing ? "cumulative" : "varied";
}
