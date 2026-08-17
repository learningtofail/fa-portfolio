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

function ltvCacHealth(ratio) {
  if (!isFinite(ratio) || ratio <= 0) return { label: "N/A", color: "#666" };
  if (ratio < 1) return { label: "Losing money on every customer", color: "#b00020" };
  if (ratio < 3) return { label: "Marginal — typical SaaS target is 3:1+", color: "#8a6408" };
  if (ratio <= 5) return { label: "Healthy", color: "#216e3b" };
  return { label: "Possibly under-investing in growth", color: "#3a5a9b" };
}

export default function CacCalculator() {
  const [spend, setSpend] = useState(50000);
  const [newCustomers, setNewCustomers] = useState(200);
  const [avgRevenue, setAvgRevenue] = useState(80);
  const [grossMarginPct, setGrossMarginPct] = useState(70);
  const [churnPct, setChurnPct] = useState(3);

  const results = useMemo(() => {
    const cac = newCustomers > 0 ? spend / newCustomers : NaN;
    const marginDecimal = grossMarginPct / 100;
    const monthlyGrossProfit = avgRevenue * marginDecimal;
    const cappedLifespan = 60; // 5-year cap when churn is 0 or unset
    const lifespanMonths = churnPct > 0 ? 1 / (churnPct / 100) : cappedLifespan;
    const ltv = monthlyGrossProfit * lifespanMonths;
    const ltvCacRatio = cac > 0 ? ltv / cac : NaN;
    const paybackMonths = monthlyGrossProfit > 0 ? cac / monthlyGrossProfit : NaN;
    const horizonMonths = Math.max(12, Math.ceil(Math.min(lifespanMonths, paybackMonths * 2 || 12)));

    return { cac, monthlyGrossProfit, lifespanMonths, ltv, ltvCacRatio, paybackMonths, horizonMonths, usedCappedLifespan: churnPct <= 0 };
  }, [spend, newCustomers, avgRevenue, grossMarginPct, churnPct]);

  const health = ltvCacHealth(results.ltvCacRatio);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 900 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <div style={fieldStyle}>
          <label htmlFor="cac-spend" style={labelStyle}>Total sales &amp; marketing spend ($)</label>
          <input id="cac-spend" type="number" min="0" value={spend} onChange={(e) => setSpend(Number(e.target.value))} style={inputStyle} />
        </div>
        <div style={fieldStyle}>
          <label htmlFor="cac-customers" style={labelStyle}>New customers acquired</label>
          <input id="cac-customers" type="number" min="0" value={newCustomers} onChange={(e) => setNewCustomers(Number(e.target.value))} style={inputStyle} />
        </div>
        <div style={fieldStyle}>
          <label htmlFor="cac-revenue" style={labelStyle}>Average revenue per customer / month ($)</label>
          <input id="cac-revenue" type="number" min="0" value={avgRevenue} onChange={(e) => setAvgRevenue(Number(e.target.value))} style={inputStyle} />
        </div>
        <div style={fieldStyle}>
          <label htmlFor="cac-margin" style={labelStyle}>Gross margin (%)</label>
          <input id="cac-margin" type="number" min="0" max="100" value={grossMarginPct} onChange={(e) => setGrossMarginPct(Number(e.target.value))} style={inputStyle} />
        </div>
        <div style={fieldStyle}>
          <label htmlFor="cac-churn" style={labelStyle}>Monthly churn rate (%) — 0 assumes a 60-month cap</label>
          <input id="cac-churn" type="number" min="0" max="100" step="0.1" value={churnPct} onChange={(e) => setChurnPct(Number(e.target.value))} style={inputStyle} />
        </div>
      </div>

      <div aria-live="polite" aria-atomic="true" style={{ display: "flex", gap: "1.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <StatCard label="CAC" value={isFinite(results.cac) ? `$${results.cac.toFixed(2)}` : "—"} />
        <StatCard label="LTV" value={isFinite(results.ltv) ? `$${results.ltv.toFixed(2)}` : "—"} />
        <StatCard label="LTV:CAC" value={isFinite(results.ltvCacRatio) ? `${results.ltvCacRatio.toFixed(2)}:1` : "—"} sub={health.label} subColor={health.color} />
        <StatCard label="Payback period" value={isFinite(results.paybackMonths) ? `${results.paybackMonths.toFixed(1)} months` : "—"} />
      </div>

      {results.usedCappedLifespan && (
        <p style={{ fontSize: "0.85rem", color: "#8a6408" }}>
          Churn rate is 0 — lifespan is capped at 60 months for this calculation rather than treated as infinite. Set a real churn rate for an accurate LTV.
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
        LTV:CAC benchmarks (3:1+ healthy, below 1:1 losing money per customer) are common SaaS
        rules of thumb, not universal targets — capital-intensive or long-sales-cycle businesses
        read differently. All calculations happen in this browser tab; nothing is sent anywhere.
      </p>
    </div>
  );
}

function StatCard({ label, value, sub, subColor }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: "0.75rem 1rem", minWidth: 150 }}>
      <div style={{ fontSize: "0.75rem", color: "#666", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>{value}</div>
      {sub && <div style={{ fontSize: "0.75rem", color: subColor || "#666", marginTop: "0.15rem" }}>{sub}</div>}
    </div>
  );
}
