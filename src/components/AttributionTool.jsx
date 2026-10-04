import { useState, useRef, useCallback } from "react";
import Papa from "papaparse";
import GroupedBarChart from "./GroupedBarChart.jsx";

const MODELS = ["Last-touch", "First-touch", "Linear", "Position-based", "Time-decay"];
const HALF_LIFE_DAYS = 7;

function normalizeRow(row, fallbackIndex) {
  const keys = Object.keys(row).reduce((acc, k) => {
    acc[k.trim().toLowerCase()] = row[k];
    return acc;
  }, /** @type {Record<string, any>} */ ({}));
  const rawRevenue = keys.revenue;
  const revenue =
    rawRevenue !== undefined && rawRevenue !== "" && !isNaN(Number(rawRevenue)) ? Number(rawRevenue) : null;
  const parsedTime = keys.timestamp ? Date.parse(keys.timestamp) : NaN;

  return {
    journeyId: keys.journey_id || keys.journeyid || keys.journey || "",
    channel: keys.channel || keys.touchpoint || "(unknown)",
    time: isNaN(parsedTime) ? fallbackIndex * 86400000 : parsedTime,
    timeIsFallback: isNaN(parsedTime),
    revenue,
  };
}

function computeAttribution(journeyMap) {
  // Channel names come from user data, so credit is keyed with Map, never a plain object (D2).
  /** @type {Map<string, Map<string, number>>} model -> channel -> credit */
  const credit = new Map(MODELS.map((m) => [m, new Map()]));
  let totalValue = 0;
  let touchpointCount = 0;

  const addCredit = (model, channel, amt) => {
    const byChannel = credit.get(model);
    byChannel.set(channel, (byChannel.get(channel) || 0) + amt);
  };

  [...journeyMap.values()].forEach((touchesRaw) => {
    const touches = [...touchesRaw].sort((a, b) => a.time - b.time);
    const n = touches.length;
    touchpointCount += n;
    const revenueSum = touches.reduce((sum, t) => sum + (t.revenue || 0), 0);
    const value = revenueSum > 0 ? revenueSum : 1; // count-based fallback if no revenue in the journey
    totalValue += value;

    addCredit("Last-touch", touches[n - 1].channel, value);
    addCredit("First-touch", touches[0].channel, value);
    touches.forEach((t) => addCredit("Linear", t.channel, value / n));

    if (n === 1) {
      addCredit("Position-based", touches[0].channel, value);
    } else if (n === 2) {
      addCredit("Position-based", touches[0].channel, value * 0.5);
      addCredit("Position-based", touches[1].channel, value * 0.5);
    } else {
      addCredit("Position-based", touches[0].channel, value * 0.4);
      addCredit("Position-based", touches[n - 1].channel, value * 0.4);
      const middleShare = (value * 0.2) / (n - 2);
      for (let i = 1; i < n - 1; i++) addCredit("Position-based", touches[i].channel, middleShare);
    }

    const lastTime = touches[n - 1].time;
    const weights = touches.map((t) => Math.pow(2, -((lastTime - t.time) / (HALF_LIFE_DAYS * 86400000))));
    const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
    touches.forEach((t, i) => addCredit("Time-decay", t.channel, (value * weights[i]) / totalWeight));
  });

  const channels = new Set();
  MODELS.forEach((m) => credit.get(m).forEach((_, c) => channels.add(c)));

  return {
    credit,
    channels: [...channels].sort(),
    totalValue,
    touchpointCount,
    journeyCount: journeyMap.size,
  };
}

/** Credit a model gave a channel, or 0. */
function creditFor(result, model, channel) {
  return result.credit.get(model).get(channel) || 0;
}

export default function AttributionTool() {
  const [result, setResult] = useState(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [usedRevenue, setUsedRevenue] = useState(false);
  const [fallbackTimeWarning, setFallbackTimeWarning] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = useCallback((file) => {
    setError("");
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const realErrors = (results.errors || []).filter((e) => e.type !== "Delimiter");
        if (realErrors.length > 0) {
          setError(`Parsed with warnings — results may be incomplete. First: ${realErrors[0].message}`);
        }

        /** @type {Map<string, any[]>} */
        const journeyMap = new Map();
        let anyRevenue = false;
        let anyFallback = false;
        results.data.forEach((row, i) => {
          const norm = normalizeRow(row, i);
          if (!norm.journeyId) return; // skip rows with no journey id — can't group them
          if (norm.revenue != null) anyRevenue = true;
          if (norm.timeIsFallback) anyFallback = true;
          if (!journeyMap.has(norm.journeyId)) journeyMap.set(norm.journeyId, []);
          journeyMap.get(norm.journeyId).push(norm);
        });

        if (journeyMap.size === 0) {
          setError('No usable rows — check for a "journey_id" column.');
          setResult(null);
          return;
        }

        setUsedRevenue(anyRevenue);
        setFallbackTimeWarning(anyFallback);
        setResult(computeAttribution(journeyMap));
      },
      error: (err) => {
        setError(`Could not parse this file: ${err.message}`);
        setResult(null);
      },
    });
  }, []);

  const onInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };
  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const chartData = result
    ? result.channels.map((channel) => ({
        group: channel,
        series: MODELS.map((m) => ({ key: m, value: Math.round((creditFor(result, m, channel) || 0) * 100) / 100 })),
      }))
    : null;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 960 }}>
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        style={{
          border: "2px dashed #999",
          borderRadius: 8,
          padding: "2rem",
          textAlign: "center",
          marginBottom: "1.5rem",
          cursor: "pointer",
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <p style={{ margin: 0 }}>Drop a touchpoint CSV here, or click to choose a file.</p>
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", color: "#666" }}>
          Columns: <code>journey_id</code>, <code>channel</code>, <code>timestamp</code>, optional <code>revenue</code>.
          One row per touchpoint. Nothing you upload leaves this browser tab.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onInputChange}
          tabIndex={-1}
          aria-hidden="true"
          style={{ display: "none" }}
        />
      </div>

      {error && (
        <p role="alert" style={{ color: "#b00020" }}>
          {error}
        </p>
      )}

      {result && (
        <>
          <div
            aria-live="polite"
            aria-atomic="true"
            style={{ display: "flex", gap: "1.5rem", marginBottom: "1rem", flexWrap: "wrap" }}
          >
            <StatCard label="File" value={fileName} />
            <StatCard label="Journeys" value={result.journeyCount} />
            <StatCard label="Touchpoints" value={result.touchpointCount} />
            <StatCard label="Channels" value={result.channels.length} />
          </div>

          <p style={{ fontSize: "0.85rem", color: "#666" }}>
            {usedRevenue
              ? "Weighted by the revenue column where present (count-weighted as a fallback for journeys with no revenue value)."
              : "No revenue column found — every journey is weighted as 1 conversion."}
            {fallbackTimeWarning &&
              " Some rows had no parseable timestamp — those journeys are ordered by row order in the file instead."}{" "}
            Time-decay uses a {HALF_LIFE_DAYS}-day half-life.
          </p>

          <h2>Credit by channel, across models</h2>
          {chartData && <GroupedBarChart data={chartData} seriesKeys={MODELS} />}

          <h2 style={{ marginTop: "2rem" }}>Full matrix</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Channel</th>
                  {MODELS.map((m) => (
                    <th style={thStyle} key={m}>
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.channels.map((channel) => (
                  <tr key={channel}>
                    <td style={tdStyle}>{channel}</td>
                    {MODELS.map((m) => (
                      <td style={tdStyle} key={m}>
                        {(creditFor(result, m, channel) || 0).toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: "0.75rem 1rem", minWidth: 120 }}>
      <div style={{ fontSize: "0.75rem", color: "#666", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: "1.25rem", fontWeight: 600 }}>{value}</div>
    </div>
  );
}

/** @type {import("react").CSSProperties} */
const thStyle = { textAlign: "left", borderBottom: "2px solid #ccc", padding: "0.4rem 0.6rem" };
/** @type {import("react").CSSProperties} */
const tdStyle = { borderBottom: "1px solid #eee", padding: "0.4rem 0.6rem" };
