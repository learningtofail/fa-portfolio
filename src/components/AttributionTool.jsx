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

/**
 * Flags revenue input that the credit math cannot interpret safely (D9). It only reports; the math is unchanged.
 * Two signals: a journey whose rows all repeat one identical revenue figure (likely the conversion value copied
 * onto every touchpoint, so the sum counts it n times), and a mix of journeys with and without revenue (dollar
 * values and the count-based fallback of 1 end up in the same totals).
 * @param {Map<string, {revenue: number|null}[]>} journeyMap Touchpoints grouped by journey id.
 * @returns {{repeatedRevenueJourneys: number, journeysWithRevenue: number, journeysWithoutRevenue: number, mixedUnits: boolean}}
 */
export function detectRevenueIssues(journeyMap) {
  let repeatedRevenueJourneys = 0;
  let journeysWithRevenue = 0;
  let journeysWithoutRevenue = 0;
  journeyMap.forEach((touches) => {
    const amounts = touches.map((t) => t.revenue || 0).filter((r) => r > 0);
    if (amounts.length === 0) {
      journeysWithoutRevenue += 1;
      return;
    }
    journeysWithRevenue += 1;
    if (amounts.length > 1 && amounts.every((a) => a === amounts[0])) repeatedRevenueJourneys += 1;
  });
  return {
    repeatedRevenueJourneys,
    journeysWithRevenue,
    journeysWithoutRevenue,
    mixedUnits: journeysWithRevenue > 0 && journeysWithoutRevenue > 0,
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
    revenueIssues: detectRevenueIssues(journeyMap),
  };
}

/** Human-readable warnings for the D9 revenue checks. */
function revenueWarnings(issues) {
  const out = [];
  if (issues.repeatedRevenueJourneys > 0) {
    out.push(
      `${issues.repeatedRevenueJourneys} journey(s) repeat the same revenue on several rows. Revenue is summed across a journey's rows, so a conversion value copied onto every touchpoint is counted once per row.`,
    );
  }
  if (issues.mixedUnits) {
    out.push(
      `${issues.journeysWithRevenue} journey(s) have revenue and ${issues.journeysWithoutRevenue} do not. Journeys without revenue count as 1 next to revenue amounts from other journeys, so the totals mix units.`,
    );
  }
  return out;
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

  const warnings = result ? revenueWarnings(result.revenueIssues) : [];

  return (
    <div className="tool tool--wide">
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
        className="dropzone"
        onClick={() => fileInputRef.current?.click()}
      >
        <p className="dropzone__title">Drop a touchpoint CSV here, or click to choose a file.</p>
        <p className="dropzone__hint">
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
          className="dropzone__input"
        />
      </div>

      {error && (
        <p role="alert" className="notice notice--error">
          {error}
        </p>
      )}

      {result && (
        <>
          <div aria-live="polite" aria-atomic="true" className="stat-row stat-row--tight">
            <StatCard label="File" value={fileName} />
            <StatCard label="Journeys" value={result.journeyCount} />
            <StatCard label="Touchpoints" value={result.touchpointCount} />
            <StatCard label="Channels" value={result.channels.length} />
          </div>

          <p className="hint">
            {usedRevenue
              ? "Weighted by the revenue column where present (count-weighted as a fallback for journeys with no revenue value)."
              : "No revenue column found — every journey is weighted as 1 conversion."}
            {fallbackTimeWarning &&
              " Some rows had no parseable timestamp — those journeys are ordered by row order in the file instead."}{" "}
            Time-decay uses a {HALF_LIFE_DAYS}-day half-life.
          </p>

          {warnings.length > 0 && (
            <div role="status" aria-label="Revenue data warnings">
              {warnings.map((w) => (
                <p key={w}>
                  <strong>Warning:</strong> {w}
                </p>
              ))}
            </div>
          )}

          <h2>Credit by channel, across models</h2>
          {chartData && <GroupedBarChart data={chartData} seriesKeys={MODELS} />}

          <h2 className="heading--spaced">Full matrix</h2>
          <div className="data-table__scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Channel</th>
                  {MODELS.map((m) => (
                    <th key={m}>{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.channels.map((channel) => (
                  <tr key={channel}>
                    <td>{channel}</td>
                    {MODELS.map((m) => (
                      <td key={m}>{(creditFor(result, m, channel) || 0).toFixed(2)}</td>
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
    <div className="stat-card">
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">{value}</div>
    </div>
  );
}
