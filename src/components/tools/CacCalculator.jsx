import { useMemo, useState } from "react";
import { calculateCac, CAPPED_LIFESPAN_MONTHS, ltvCacHealth, parseField } from "../../lib/cac/calc.js";
import PaybackChart from "../charts/PaybackChart.jsx";
import StatCard from "../kit/StatCard.jsx";
import StatRow from "../kit/StatRow.jsx";
import ToolShell from "../kit/ToolShell.jsx";

/** Number inputs hold strings so a cleared field stays empty instead of snapping to 0 (D11). */
const FIELDS = [
  {
    id: "cac-spend",
    name: "spend",
    label: "Total sales & marketing spend ($)",
    initial: "50000",
    limits: { min: "0" },
  },
  { id: "cac-customers", name: "newCustomers", label: "New customers acquired", initial: "200", limits: { min: "0" } },
  {
    id: "cac-revenue",
    name: "avgRevenue",
    label: "Average revenue per customer / month ($)",
    initial: "80",
    limits: { min: "0" },
  },
  {
    id: "cac-margin",
    name: "grossMarginPct",
    label: "Gross margin (%)",
    initial: "70",
    limits: { min: "0", max: "100" },
  },
  {
    id: "cac-churn",
    name: "churnPct",
    label: `Monthly churn rate (%) — 0 assumes a ${CAPPED_LIFESPAN_MONTHS}-month cap`,
    initial: "3",
    limits: { min: "0", max: "100", step: "0.1" },
  },
];

const money = (/** @type {number} */ n) => (isFinite(n) ? `$${n.toFixed(2)}` : "—");

export default function CacCalculator() {
  const [values, setValues] = useState(() => Object.fromEntries(FIELDS.map((f) => [f.name, f.initial])));
  const results = useMemo(
    () =>
      calculateCac({
        spend: parseField(values.spend),
        newCustomers: parseField(values.newCustomers),
        avgRevenue: parseField(values.avgRevenue),
        grossMarginPct: parseField(values.grossMarginPct),
        churnPct: parseField(values.churnPct),
      }),
    [values],
  );
  const health = ltvCacHealth(results.ltvCacRatio);
  const showChart = isFinite(results.cac) && results.monthlyGrossProfit > 0;

  return (
    <ToolShell>
      <div className="field-grid">
        {FIELDS.map(({ id, name, label, limits }) => (
          <div key={id} className="field">
            <label htmlFor={id} className="field__label">
              {label}
            </label>
            <input
              id={id}
              type="number"
              {...limits}
              value={values[name]}
              onChange={(e) => setValues((prev) => ({ ...prev, [name]: e.target.value }))}
              className="field__input"
            />
          </div>
        ))}
      </div>

      <StatRow>
        <StatCard label="CAC" value={money(results.cac)} size="wide" />
        <StatCard label="LTV" value={money(results.ltv)} size="wide" />
        <StatCard
          label="LTV:CAC"
          value={isFinite(results.ltvCacRatio) ? `${results.ltvCacRatio.toFixed(2)}:1` : "—"}
          sub={health.label}
          tone={health.tone}
          size="wide"
        />
        <StatCard
          label="Payback period"
          value={isFinite(results.paybackMonths) ? `${results.paybackMonths.toFixed(1)} months` : "—"}
          size="wide"
        />
      </StatRow>

      {results.usedCappedLifespan && (
        <p className="notice notice--warning">
          Churn rate is 0 — lifespan is capped at {CAPPED_LIFESPAN_MONTHS} months for this calculation rather than
          treated as infinite. Set a real churn rate for an accurate LTV.
        </p>
      )}

      {showChart && (
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
    </ToolShell>
  );
}
