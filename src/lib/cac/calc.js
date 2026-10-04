/** Pure CAC, LTV and payback maths for the calculator. NaN means "cannot be computed from these inputs". */

/** Lifespan assumed when churn is 0, so LTV stays finite. The input label and the warning both read this (D11). */
export const CAPPED_LIFESPAN_MONTHS = 60;

/** Floor for the payback chart's horizon. */
export const MIN_HORIZON_MONTHS = 12;

/** @typedef {"good" | "warn" | "bad"} Tone */

/**
 * Plain-language read of an LTV:CAC ratio. Returns a tone, never a color: presentation maps tone to style (D11).
 * @param {number} ratio
 * @returns {{ label: string, tone: Tone | null }} tone is null when there is no ratio to judge.
 */
export function ltvCacHealth(ratio) {
  if (!isFinite(ratio) || ratio <= 0) return { label: "N/A", tone: null };
  if (ratio < 1) return { label: "Losing money on every customer", tone: "bad" };
  if (ratio < 3) return { label: "Marginal — typical SaaS target is 3:1+", tone: "warn" };
  if (ratio <= 5) return { label: "Healthy", tone: "good" };
  return { label: "Possibly under-investing in growth", tone: "warn" };
}

/**
 * Parses a number input's string. An empty or non-numeric field is NaN, so results show dashes instead of 0.
 * @param {string} text
 * @returns {number}
 */
export function parseField(text) {
  return text.trim() === "" ? NaN : Number(text);
}

/**
 * @param {{ spend: number, newCustomers: number, avgRevenue: number, grossMarginPct: number, churnPct: number }} inputs
 * Any NaN input propagates to the metrics that depend on it.
 */
export function calculateCac({ spend, newCustomers, avgRevenue, grossMarginPct, churnPct }) {
  const cac = newCustomers > 0 ? spend / newCustomers : NaN;
  const monthlyGrossProfit = avgRevenue * (grossMarginPct / 100);
  const usedCappedLifespan = churnPct <= 0;
  let lifespanMonths = NaN;
  if (usedCappedLifespan) lifespanMonths = CAPPED_LIFESPAN_MONTHS;
  else if (churnPct > 0) lifespanMonths = 1 / (churnPct / 100);
  const ltv = monthlyGrossProfit * lifespanMonths;
  const ltvCacRatio = cac > 0 ? ltv / cac : NaN;
  const paybackMonths = monthlyGrossProfit > 0 ? cac / monthlyGrossProfit : NaN;
  const horizon = Math.ceil(Math.min(lifespanMonths, paybackMonths * 2 || MIN_HORIZON_MONTHS));
  const horizonMonths = Math.max(MIN_HORIZON_MONTHS, isFinite(horizon) ? horizon : MIN_HORIZON_MONTHS);
  return {
    cac,
    monthlyGrossProfit,
    lifespanMonths,
    ltv,
    ltvCacRatio,
    paybackMonths,
    horizonMonths,
    usedCappedLifespan,
  };
}
