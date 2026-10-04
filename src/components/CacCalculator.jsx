import { useState, useMemo } from "react";
import PaybackChart from "./PaybackChart.jsx";

/** Lifespan assumed when churn is 0, so LTV stays finite. The input label and the warning both read this (D11). */
export const CAPPED_LIFESPAN_MONTHS = 60;

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

/** Parses a number input's string. An empty or non-numeric field is NaN, so results show dashes instead of 0. */
const parseField = (/** @type {string} */ text) => (text.trim() === "" ? NaN : Number(text));

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
  const horizon = Math.ceil(Math.min(lifespanMonths, paybackMonths * 2 || 12));
  const horizonMonths = Math.max(12, isFinite(horizon) ? horizon : 12);
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

export default function CacCalculator() {
  // Number inputs hold strings so a cleared field stays empty instead of snapping to 0 (D11).
  const [spend, setSpend] = useState("50000");
  const [newCustomers, setNewCustomers] = useState("200");
  const [avgRevenue, setAvgRevenue] = useState("80");
  const [grossMarginPct, setGrossMarginPct] = useState("70");
  const [churnPct, setChurnPct] = useState("3");

  const results = useMemo(
    () =>
      calculateCac({
        spend: parseField(spend),
        newCustomers: parseField(newCustomers),
        avgRevenue: parseField(avgRevenue),
        grossMarginPct: parseField(grossMarginPct),
        churnPct: parseField(churnPct),
      }),
    [spend, newCustomers, avgRevenue, grossMarginPct, churnPct],
  );

  const health = ltvCacHealth(results.ltvCacRatio);

  return (
    <div className="tool">
      <div className="field-grid">
        <div className="field">
          <label htmlFor="cac-spend" className="field__label">
            Total sales &amp; marketing spend ($)
          </label>
          <input
            id="cac-spend"
            type="number"
            min="0"
            value={spend}
            onChange={(e) => setSpend(e.target.value)}
            className="field__input"
          />
        </div>
        <div className="field">
          <label htmlFor="cac-customers" className="field__label">
            New customers acquired
          </label>
          <input
            id="cac-customers"
            type="number"
            min="0"
            value={newCustomers}
            onChange={(e) => setNewCustomers(e.target.value)}
            className="field__input"
          />
        </div>
        <div className="field">
          <label htmlFor="cac-revenue" className="field__label">
            Average revenue per customer / month ($)
          </label>
          <input
            id="cac-revenue"
            type="number"
            min="0"
            value={avgRevenue}
            onChange={(e) => setAvgRevenue(e.target.value)}
            className="field__input"
          />
        </div>
        <div className="field">
          <label htmlFor="cac-margin" className="field__label">
            Gross margin (%)
          </label>
          <input
            id="cac-margin"
            type="number"
            min="0"
            max="100"
            value={grossMarginPct}
            onChange={(e) => setGrossMarginPct(e.target.value)}
            className="field__input"
          />
        </div>
        <div className="field">
          <label htmlFor="cac-churn" className="field__label">
            Monthly churn rate (%) — 0 assumes a {CAPPED_LIFESPAN_MONTHS}-month cap
          </label>
          <input
            id="cac-churn"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={churnPct}
            onChange={(e) => setChurnPct(e.target.value)}
            className="field__input"
          />
        </div>
      </div>

      <div aria-live="polite" aria-atomic="true" className="stat-row">
        <StatCard label="CAC" value={isFinite(results.cac) ? `$${results.cac.toFixed(2)}` : "—"} />
        <StatCard label="LTV" value={isFinite(results.ltv) ? `$${results.ltv.toFixed(2)}` : "—"} />
        <StatCard
          label="LTV:CAC"
          value={isFinite(results.ltvCacRatio) ? `${results.ltvCacRatio.toFixed(2)}:1` : "—"}
          sub={health.label}
          tone={health.tone}
        />
        <StatCard
          label="Payback period"
          value={isFinite(results.paybackMonths) ? `${results.paybackMonths.toFixed(1)} months` : "—"}
        />
      </div>

      {results.usedCappedLifespan && (
        <p className="notice notice--warning">
          Churn rate is 0 — lifespan is capped at {CAPPED_LIFESPAN_MONTHS} months for this calculation rather than
          treated as infinite. Set a real churn rate for an accurate LTV.
        </p>
      )}

      {isFinite(results.cac) && isFinite(results.monthlyGrossProfit) && results.monthlyGrossProfit > 0 && (
        <>
          <h2>Cumulative gross profit vs. CAC</h2>
          <PaybackChart
            monthlyGrossProfit={results.monthlyGrossProfit}
            cac={results.cac}
            paybackMonths={results.paybackMonths}
            horizonMonths={results.horizonMonths}
          />
        </>
      )}

      <p className="fineprint">
        LTV:CAC benchmarks (3:1+ healthy, below 1:1 losing money per customer) are common SaaS rules of thumb, not
        universal targets — capital-intensive or long-sales-cycle businesses read differently. All calculations happen
        in this browser tab; nothing is sent anywhere.
      </p>
    </div>
  );
}

/** @param {{ label: string, value: string, sub?: string, tone?: Tone | null }} props */
function StatCard({ label, value, sub, tone }) {
  return (
    <div className="stat-card stat-card--wide">
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">{value}</div>
      {sub && <div className={tone ? `stat-card__sub stat-card__sub--${tone}` : "stat-card__sub"}>{sub}</div>}
    </div>
  );
}
