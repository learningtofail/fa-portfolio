import { useState, useMemo } from "react";
import PaybackChart from "./PaybackChart.jsx";

const inputStyle = {
  width: "100%",
  padding: "0.5rem",
  border: "1px solid #ccc",
  borderRadius: 4,
  fontSize: "1rem",
};
const labelStyle = { display: "block", fontSize: "0.85rem", color: "#444", marginBottom: "0.25rem" };
const fieldStyle = { marginBottom: "1rem" };

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

/** Presentation for each tone; Phase 3 replaces this lookup with CSS classes. */
const TONE_COLORS = { good: "#216e3b", warn: "#8a6408", bad: "#b00020" };

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
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 900 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={fieldStyle}>
          <label htmlFor="cac-spend" style={labelStyle}>
            Total sales &amp; marketing spend ($)
          </label>
          <input
            id="cac-spend"
            type="number"
            min="0"
            value={spend}
            onChange={(e) => setSpend(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={fieldStyle}>
          <label htmlFor="cac-customers" style={labelStyle}>
            New customers acquired
          </label>
          <input
            id="cac-customers"
            type="number"
            min="0"
            value={newCustomers}
            onChange={(e) => setNewCustomers(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={fieldStyle}>
          <label htmlFor="cac-revenue" style={labelStyle}>
            Average revenue per customer / month ($)
          </label>
          <input
            id="cac-revenue"
            type="number"
            min="0"
            value={avgRevenue}
            onChange={(e) => setAvgRevenue(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={fieldStyle}>
          <label htmlFor="cac-margin" style={labelStyle}>
            Gross margin (%)
          </label>
          <input
            id="cac-margin"
            type="number"
            min="0"
            max="100"
            value={grossMarginPct}
            onChange={(e) => setGrossMarginPct(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={fieldStyle}>
          <label htmlFor="cac-churn" style={labelStyle}>
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
            style={inputStyle}
          />
        </div>
      </div>

      <div
        aria-live="polite"
        aria-atomic="true"
        style={{ display: "flex", gap: "1.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}
      >
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
        <p style={{ fontSize: "0.85rem", color: "#8a6408" }}>
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

      <p style={{ fontSize: "0.8rem", color: "#6b6b6b", marginTop: "1.5rem" }}>
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
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: "0.75rem 1rem", minWidth: 150 }}>
      <div style={{ fontSize: "0.75rem", color: "#666", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>{value}</div>
      {sub && (
        <div style={{ fontSize: "0.75rem", color: (tone && TONE_COLORS[tone]) || "#666", marginTop: "0.15rem" }}>
          {sub}
        </div>
      )}
    </div>
  );
}
